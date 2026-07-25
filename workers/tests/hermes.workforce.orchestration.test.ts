// EPIC-003-005 — Workforce Orchestration Coordinator (M1–M7)
// Run: npx vitest run hermes.workforce.orchestration.test.ts  (from workers/)
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createWorkflow,
  assignWorkflow,
  requestTaskApproval,
  grantTaskApproval,
  rejectTaskApproval,
  runTask,
  retryTask,
  cancelWorkflow,
  pauseWorkflow,
  resumeWorkflow,
  getWorkflowView,
  listWorkflows,
  _clearWorkflows,
} from "../../hermes/services/workforce/orchestration.js";
import { _clearAgents, registerAgent } from "../../hermes/agents/registry.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";
import { adminViewWorkflows } from "../../hermes/admin/index.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import type { WorkItem } from "../../hermes/services/execution/work-planner.js";

// A verified human owner principal (admin read for the operations domain).
const humanOwner: Principal = {
  id: "principal:admin-kl",
  permissions: ["hermes:admin:read", "hermes:admin:workforce-write", "hermes:admin:task-write", "hermes:admin:audit-read", "hermes:admin:role-grant"],
};

// Executor stub: drives the injected backend; fails on first attempt when
// asked so we can test retry / failure recovery.
const makeExecutor = (failTimes = 0) => {
  let calls = 0;
  return async (capability: string, _args: unknown) => {
    calls += 1;
    if (calls <= failTimes) return { ok: false, error: "transient", backend: "test" };
    return { ok: true, data: { capability }, backend: "test" };
  };
};

const sampleItems: WorkItem[] = [
  { id: "t1", title: "Build & ship web", capability: "deploy.web", priority: 3, dependsOn: [] },
  { id: "t2", title: "Migrate DB", capability: "db.migrate", priority: 3, dependsOn: ["t1"] },
  { id: "t3", title: "Smoke test", capability: "smoke.test", priority: 2, dependsOn: ["t2"], parallelizable: true },
];

beforeEach(() => {
  _clearWorkflows();
  _clearAgents();
  _clearAuditBuffer();
  // M3: dynamic capability resolution via the WORKFORCE REGISTRY (agents
  // advertising capabilities). dispatchCapability falls back to the registry
  // when no active capability provider resolves — this proves resolution is
  // dynamic and registry-driven (never hardcoded).
  for (const cap of ["deploy.web", "db.migrate", "smoke.test"]) {
    registerAgent({
      id: `agent-${cap}`,
      name: `Agent ${cap}`,
      domain: "engineering",
      state: "registered",
      activation: "disabled",
      capabilities: [{ id: cap, description: "d", autonomous: false }],
      principalId: "principal:ops",
      registeredAt: new Date().toISOString(),
    });
  }
});

describe("M1+M5 · objective → plan → workflow lifecycle", () => {
  it("plans an objective and records a dependency-respecting ordered plan", () => {
    const wf = createWorkflow({
      title: "Ship release 2.0",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: sampleItems,
    });
    expect(wf.state).toBe("queued");
    expect(wf.plan).toBeDefined();
    // t1 before t2 before t3 (topological order preserved).
    const order = wf.plan!.ordered.map((i) => i.id);
    expect(order.indexOf("t1")).toBeLessThan(order.indexOf("t2"));
    expect(order.indexOf("t2")).toBeLessThan(order.indexOf("t3"));
    // M1: every capability dynamically resolved via the workforce registry.
    for (const t of wf.tasks) {
      expect(t.dispatch.via).toBe("workforce-agent");
      expect(t.dispatch.agentId).toBeTruthy();
    }
    // M6: created + planning + queued audit events emitted.
    const buf = readAuditBuffer();
    expect(buf.some((e) => e.type === "workflow.created")).toBe(true);
    expect(buf.some((e) => e.type === "workflow.state" && e.detail.state === "queued")).toBe(true);
  });

  it("enters waiting (not queued) when a capability is unresolved", () => {
    _clearAgents();
    const wf = createWorkflow({
      title: "Unknown capability",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "x", title: "Do unknown thing", capability: "nonexistent.cap", priority: 1 }],
    });
    expect(wf.state).toBe("waiting");
    expect(wf.tasks[0].dispatch.via).toBe("unresolved");
  });
});

describe("M2+M4 · assign + approval gating (fail-closed)", () => {
  it("assigns planned tasks, then requires human approval before any run", async () => {
    const wf = createWorkflow({
      title: "Deploy flow",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "production",
      items: sampleItems,
    });
    assignWorkflow(wf.id, "principal:kl");
    expect(wf.tasks.every((t) => t.queueId)).toBe(true);
    expect(wf.state).toBe("waiting");

    // Request + grant approval for t1 (production exec → human gate).
    requestTaskApproval(wf.id, "t1", "principal:kl");
    grantTaskApproval(wf.id, "t1", "principal:ops");

    // Running t1 now succeeds; t2/t3 still blocked (no approval) → throws.
    await runTask(wf.id, "t1", "principal:ops", makeExecutor(), {});
    expect(getWorkflowView(wf.id).tasks.find((t) => t.itemId === "t1")!.queueId).toBeTruthy();
    await expect(runTask(wf.id, "t2", "principal:ops", makeExecutor(), {})).rejects.toThrow(/approval/i);
  });

  it("never runs a task with a pending approval (autonomous-execution prohibition)", async () => {
    const wf = createWorkflow({
      title: "Blocked flow",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "production",
      items: [{ id: "only", title: "Only step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "only", "principal:kl");
    // No grant → must throw, never auto-run.
    await expect(runTask(wf.id, "only", "principal:ops", makeExecutor(), {})).rejects.toThrow(/approval/i);
  });
});

describe("M2 · failure recovery + retry", () => {
  it("surfaces a genuine final failure when all attempts are exhausted", async () => {
    const wf = createWorkflow({
      title: "Flaky deploy",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "f", title: "Flaky step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "f", "principal:kl");
    grantTaskApproval(wf.id, "f", "principal:ops");

    // Executor fails more times than maxAttempts → genuine final failure.
    const r1 = await runTask(wf.id, "f", "principal:ops", makeExecutor(5), {}, { maxAttempts: 3 });
    expect(r1.ok).toBe(false);
    expect(wf.failureCount).toBeGreaterThanOrEqual(1);
    expect(wf.state).toBe("failed");
  });

  it("retries a failed task and recovers after transient failures", async () => {
    const wf = createWorkflow({
      title: "Recoverable deploy",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "f", title: "Recoverable step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "f", "principal:kl");
    grantTaskApproval(wf.id, "f", "principal:ops");

    // First run fails (exhausts attempts because executor always fails).
    const r1 = await runTask(wf.id, "f", "principal:ops", makeExecutor(5), {}, { maxAttempts: 1 });
    expect(r1.ok).toBe(false);

    // Re-approve (fail-closed: retry re-enters the approval gate) then retry recovers.
    requestTaskApproval(wf.id, "f", "principal:kl");
    grantTaskApproval(wf.id, "f", "principal:ops");
    const r2 = await retryTask(wf.id, "f", "principal:ops", makeExecutor(0), {}, { maxAttempts: 3 });
    expect(r2.ok).toBe(true);
    expect(wf.retryCount).toBeGreaterThanOrEqual(1);
  });
});

describe("M2 · cancellation / pause / resume", () => {
  it("cancels the workflow and all entries", () => {
    const wf = createWorkflow({
      title: "Cancel me",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: sampleItems,
    });
    assignWorkflow(wf.id, "principal:kl");
    cancelWorkflow(wf.id, "principal:ops");
    expect(wf.state).toBe("cancelled");
    expect(wf.approvals.size).toBe(0);
  });

  it("pauses and resumes (M5 resumable) without autonomous execution", async () => {
    const wf = createWorkflow({
      title: "Pause me",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "p", title: "Pausable step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    pauseWorkflow(wf.id, "principal:ops");
    expect(wf.state).toBe("paused");
    expect(wf.tasks[0].queueId).toBeTruthy(); // assignment preserved across pause
    resumeWorkflow(wf.id, "principal:ops");
    expect(wf.state).toBe("queued"); // resumable, NOT auto-run
    // A task that requires production approval still cannot run without a grant.
    requestTaskApproval(wf.id, "p", "principal:kl");
    await expect(runTask(wf.id, "p", "principal:ops", makeExecutor(), {})).rejects.toThrow(/approval/i);
  });
});

describe("M6 · audit trail integrity", () => {
  it("emits a complete audit trail for the orchestration lifecycle", async () => {
    const wf = createWorkflow({
      title: "Audited flow",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "a", title: "Audited step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "a", "principal:kl");
    grantTaskApproval(wf.id, "a", "principal:ops");
    await runTask(wf.id, "a", "principal:ops", makeExecutor(), {});

    const buf = readAuditBuffer().map((e) => e.type);
    for (const ev of ["workflow.created", "workflow.assigned", "workflow.approval.requested", "workflow.approval.granted", "workflow.task.completed"]) {
      expect(buf).toContain(ev);
    }
  });
});

describe("M7 · admin read-only workflow view", () => {
  it("exposes workflow status, stage, agents, approvals, timeline (human-gated, no public route)", () => {
    const wf = createWorkflow({
      title: "Admin visible",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: sampleItems,
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "t1", "principal:kl");

    const views = adminViewWorkflows(humanOwner);
    expect(views.length).toBe(1);
    const v = views[0];
    expect(v.id).toBe(wf.id);
    expect(v.state).toBe("waiting");
    expect(v.tasks.length).toBe(3);
    expect(v.waitingApprovals.length).toBe(1); // t1 approval pending
    expect(v.timeline.length).toBeGreaterThan(0);
    expect(typeof v.retryCount).toBe("number");
    expect(typeof v.failureCount).toBe("number");
  });

  it("agent principals are forbidden from the admin boundary (inherited guard)", () => {
    const agentPrincipal: Principal = { id: "agent:demo", permissions: humanOwner.permissions };
    expect(() => adminViewWorkflows(agentPrincipal)).toThrow(/HUMAN principal/i);
  });

  it("filters workflows by state", () => {
    createWorkflow({
      title: "W1",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "a", title: "Step", capability: "deploy.web", priority: 2 }],
    });
    const queued = listWorkflows({ state: "queued" });
    expect(queued.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── Notification integration tests ─────────────────────────

describe("Notification · approval events fire exactly once", () => {
  it("emits a notification when approval is requested", async () => {
    const notif = await import("../../hermes/services/notification/notification.js");
    const spy = vi.spyOn(notif, "notify").mockResolvedValue(undefined);

    const wf = createWorkflow({
      title: "Notified flow",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "production",
      items: [{ id: "n1", title: "Notified step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "n1", "principal:kl");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Approval Requested" }),
      "principal:kl",
    );

    spy.mockRestore();
  });

  it("emits a notification when approval is granted", async () => {
    const notif = await import("../../hermes/services/notification/notification.js");
    const spy = vi.spyOn(notif, "notify").mockResolvedValue(undefined);

    const wf = createWorkflow({
      title: "Grant notified",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "production",
      items: [{ id: "n2", title: "Granted step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "n2", "principal:kl");
    spy.mockClear(); // clear the requested call
    await grantTaskApproval(wf.id, "n2", "principal:ops");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Approval Granted" }),
      "principal:ops",
    );

    spy.mockRestore();
  });

  it("emits a notification when approval expires during execution attempt", async () => {
    const notif = await import("../../hermes/services/notification/notification.js");
    const spy = vi.spyOn(notif, "notify").mockResolvedValue(undefined);

    const wf = createWorkflow({
      title: "Expiry notified",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "n3", title: "Expiring step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "n3", "principal:kl");
    // Set the request expiry to the past so runTask will find it expired.
    const t = wf.tasks.find((x) => x.itemId === "n3")!;
    const req = wf.approvals.get(t.queueId);
    if (req) req.expiresAt = new Date(Date.now() - 60000).toISOString();
    spy.mockClear();
    await expect(runTask(wf.id, "n3", "principal:ops", makeExecutor(), {})).rejects.toThrow(/expired/i);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Approval Expired" }),
      "principal:ops",
    );

    spy.mockRestore();
  });

  it("emits a notification when approval is rejected", async () => {
    const notif = await import("../../hermes/services/notification/notification.js");
    const spy = vi.spyOn(notif, "notify").mockResolvedValue(undefined);

    const wf = createWorkflow({
      title: "Rejected notification",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "n4", title: "Rejected step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");
    requestTaskApproval(wf.id, "n4", "principal:kl");
    spy.mockClear();
    await rejectTaskApproval(wf.id, "n4", "principal:ops");

    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({ subject: "Approval Rejected" }),
      "principal:ops",
    );

    spy.mockRestore();
  });

  it("rejects a non-existent approval request", async () => {
    const wf = createWorkflow({
      title: "Reject missing",
      applicationId: "app-1",
      requestedBy: "principal:kl",
      env: "staging",
      items: [{ id: "n5", title: "Missing step", capability: "deploy.web", priority: 2 }],
    });
    assignWorkflow(wf.id, "principal:kl");

    await expect(rejectTaskApproval(wf.id, "n5", "principal:ops")).rejects.toThrow(/No pending approval/i);
  });
});
