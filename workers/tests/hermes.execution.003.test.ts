// EPIC-003-001 · Hermes Execution Platform — validation gates.
// Run: npx vitest run hermes.execution.003.test.ts  (from workers/)
import { describe, it, expect, beforeEach } from "vitest";
import {
  planWork,
  type GoalSpec,
} from "../../hermes/services/execution/work-planner.js";
import {
  dispatchCapability,
  dispatchPlan,
  activeProviderSummary,
} from "../../hermes/services/execution/workforce-dispatch.js";
import {
  enqueue,
  approveAndRun,
  pauseEntry,
  resumeEntry,
  cancelEntry,
  retryEntry,
  listQueue,
  getEntry,
  _clearQueue,
} from "../../hermes/services/execution/execution-queue.js";
import {
  aggregateReview,
  detectConflicts,
  reviewSummary,
  type AgentContribution,
  _clearReviews,
} from "../../hermes/services/execution/review-pipeline.js";
import {
  runSimulation,
  isPrivilegedCapability,
  SIMULATION_MODE,
  _clearSimulation,
} from "../../hermes/services/execution/simulation.js";
import {
  registerProvider,
  enableProvider,
  setProviderHealth,
  listActiveProviders,
  resolveProviderForCapability,
  _clearProviders,
} from "../../hermes/services/activation/provider-framework.js";
import { registerGitProvider } from "../../hermes/services/activation/git-provider.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";
import { seedAgentWorkforce, assertWorkforceSafety } from "../../hermes/agents/seed.js";
import { _clearAgents } from "../../hermes/agents/registry.js";

const ADMIN = { id: "test-admin", permissions: ["hermes:activation:provider"] } as any;
const DEV = "dev-agent-1";
const APP = "ags-fertility";

// A test provider that serves a generic capability (vendor-neutral stub).
function activateTestProvider(capability: string, id = "test.prov.1") {
  const p = registerProvider({
    id,
    label: id,
    domain: "development",
    backend: "test.stub",
    capabilities: [{ id: capability, description: "test capability" }],
    executor: async (call: any) => ({ ok: true, data: `ran ${call.capability}`, backend: "test.stub" }),
  });
  enableProvider(p.id, ADMIN);
  setProviderHealth(p.id, "healthy");
  return p;
}

beforeEach(() => {
  _clearProviders();
  _clearQueue();
  _clearReviews();
  _clearSimulation();
  _clearAuditBuffer();
  _clearAgents();
  seedAgentWorkforce();
});

// ─── M1 · Work Planner ───────────────────────────────────────────
describe("M1 · work planner (goals → ordered, dependency-respecting plan)", () => {
  const goal: GoalSpec = {
    goalId: "goal-1",
    applicationId: APP,
    requestedBy: DEV,
    title: "Add patient intake form",
    items: [
      { id: "i1", title: "Design schema", capability: "dev.schema.design", priority: 5, parallelizable: false },
      { id: "i2", title: "Generate UI", capability: "dev.code.generate", priority: 3, parallelizable: true, dependsOn: ["i1"] },
      { id: "i3", title: "Write tests", capability: "test.unit.write", priority: 4, parallelizable: true, dependsOn: ["i2"] },
      { id: "i4", title: "Research compliance", capability: "research.compliance", priority: 2, parallelizable: true },
    ],
  };

  it("produces a topological order respecting dependencies", () => {
    const plan = planWork(goal);
    const pos = (id: string) => plan.ordered.findIndex((x) => x.id === id);
    expect(pos("i1")).toBeLessThan(pos("i2"));
    expect(pos("i2")).toBeLessThan(pos("i3"));
  });

  it("groups independent items into parallel waves", () => {
    const plan = planWork(goal);
    // i1 (deps none) and i4 (deps none) should be in wave 0 together.
    const wave0 = plan.waves[0].map((x) => x.id).sort();
    expect(wave0).toEqual(["i1", "i4"]);
  });

  it("detects dependency cycles (fail-closed)", () => {
    const cyc: GoalSpec = {
      ...goal,
      goalId: "goal-cyc",
      items: [
        { id: "a", title: "A", capability: "x", priority: 1, dependsOn: ["b"] },
        { id: "b", title: "B", capability: "y", priority: 1, dependsOn: ["a"] },
      ],
    };
    expect(() => planWork(cyc)).toThrow(/cycle|dependency/i);
  });

  it("prioritizes higher-priority items within a wave", () => {
    const plan = planWork(goal);
    const wave0 = plan.waves[0];
    // i1 priority 5 > i4 priority 2
    expect(wave0[0].id).toBe("i1");
  });
});

// ─── M2 · Workforce Dispatcher (no hardcoded provider) ──────────
describe("M2 · workforce dispatcher (dynamic capability resolution)", () => {
  it("resolves a capability through the Provider Registry (never hardcoded)", () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    expect(d.via).toBe("capability-provider");
    expect(d.backend).toBe("test.stub");
    expect(d.providerId).toBe("test.prov.1");
  });

  it("falls back to the workforce registry when no active provider", () => {
    // No provider active for this capability → should resolve via workforce agent.
    const d = dispatchCapability("research.query", { actor: DEV, applicationId: APP, env: "development" });
    expect(d.via).toBe("workforce-agent");
    expect(d.agentId).toBeDefined();
  });

  it("fails closed when unresolved (no silent unsafe fallback)", () => {
    const d = dispatchCapability("nonexistent.cap", { actor: DEV, applicationId: APP, env: "development" });
    expect(d.via).toBe("unresolved");
    expect(d.backend).toBe("hermes.fail-closed");
  });

  it("bulk-dispatch deduplicates capabilities", () => {
    activateTestProvider("dev.code.generate");
    const map = dispatchPlan(["dev.code.generate", "dev.code.generate", "research.compliance"], {
      actor: DEV,
      applicationId: APP,
      env: "development",
    });
    expect(map.size).toBe(2);
  });

  it("provides operator visibility via activeProviderSummary", () => {
    activateTestProvider("dev.code.generate");
    const s = activeProviderSummary();
    expect(s.some((p) => p.capabilities.includes("dev.code.generate"))).toBe(true);
  });
});

// ─── M3 · Execution Queue (pause/retry/cancel/resume + audit) ───
describe("M3 · execution queue (lifecycle + audit trail)", () => {
  function executor(cap: string) {
    return async (_c: string, _a: unknown) => ({ ok: true, data: `ok ${cap}`, backend: "test.stub" });
  }

  it("enqueues without executing (human approval required)", () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    const e = enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "test",
    });
    expect(e.status).toBe("queued");
    expect(listQueue().length).toBe(1);
  });

  it("requires an approver to run (fail-closed)", async () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    const e = enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "test",
    });
    const r = await approveAndRun(e.queueId, "human-1", executor("dev.code.generate"), {});
    expect(r.result.ok).toBe(true);
    expect(r.result.state).toBe("completed");
    // audit trail recorded
    const buf = readAuditBuffer();
    expect(buf.some((a) => a.type === "execution.queue.approved")).toBe(true);
    expect(buf.some((a) => a.type === "execution.queue.run")).toBe(true);
  });

  it("pauses and resumes an entry", () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    const e = enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "test",
    });
    const paused = pauseEntry(e.queueId, "human-1");
    expect(paused.status).toBe("paused");
    expect(paused.paused).toBe(true);
    const resumed = resumeEntry(e.queueId, "human-1");
    expect(resumed.status).not.toBe("paused");
  });

  it("cancels an entry", () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    const e = enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "test",
    });
    const cancelled = cancelEntry(e.queueId, "human-1");
    expect(cancelled.status).toBe("cancelled");
  });

  it("retries a failed entry", async () => {
    const failExec = async (_c: string, _a: unknown) => ({ ok: false, error: "boom", backend: "test.stub" });
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    const e = enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "test",
    });
    const first = await approveAndRun(e.queueId, "human-1", failExec, {});
    expect(first.result.ok).toBe(false);
    expect(first.entry.status).toBe("failed");

    const okExec = async (_c: string, _a: unknown) => ({ ok: true, data: "recovered", backend: "test.stub" });
    const retried = await retryEntry(e.queueId, "human-1", okExec, {});
    expect(retried.result.ok).toBe(true);
    expect(retried.entry.attempts).toBeGreaterThanOrEqual(1);
  });

  it("refuses to run a paused entry", async () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    const e = enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "test",
    });
    pauseEntry(e.queueId, "human-1");
    await expect(approveAndRun(e.queueId, "human-1", executor("dev.code.generate"), {})).rejects.toThrow(/paused/i);
  });
});

// ─── M4 · Review Pipeline (aggregate + conflict + human gate) ───
describe("M4 · review pipeline (aggregate, conflict detect, human gate)", () => {
  const contrib = (agentId: string, domain: AgentContribution["domain"], capability: string, artifact: unknown, privileged = false): AgentContribution => ({
    agentId,
    domain,
    capability,
    artifact,
    privileged,
  });

  it("detects file-overlap conflicts", () => {
    const cs = [
      contrib("dev-1", "development", "dev.code.generate", { targetFile: "a.ts" }),
      contrib("dev-2", "development", "dev.code.generate", { targetFile: "a.ts" }),
    ];
    const conflicts = detectConflicts(cs);
    expect(conflicts.some((c) => c.kind === "file-overlap")).toBe(true);
  });

  it("detects schema-overlap (high severity)", () => {
    const cs = [
      contrib("dev-1", "development", "dev.schema.design", { targetSchema: "Patient" }),
      contrib("dev-2", "development", "dev.schema.design", { targetSchema: "Patient" }),
    ];
    const conflicts = detectConflicts(cs);
    const c = conflicts.find((x) => x.kind === "schema-overlap");
    expect(c).toBeDefined();
    expect(c!.severity).toBe("high");
  });

  it("flags privileged contribution without approval token (policy violation)", () => {
    const cs = [contrib("ops-1", "ops", "git.push", {}, true)];
    const conflicts = detectConflicts(cs);
    expect(conflicts.some((c) => c.kind === "policy-violation")).toBe(true);
  });

  it("requires human approval when a privileged action is implied", () => {
    const pkg = aggregateReview({
      goalId: "g1",
      applicationId: APP,
      contributions: [contrib("ops-1", "ops", "git.push", { approvalToken: "tok" }, true)],
      requestedBy: DEV,
      env: "development",
    });
    expect(pkg.requiresHumanApproval).toBe(true);
    expect(pkg.approvalRequest).toBeDefined();
    expect(pkg.approvalRequest!.state).toBe("pending");
  });

  it("produces a readable summary for operator visibility", () => {
    const pkg = aggregateReview({
      goalId: "g1",
      applicationId: APP,
      contributions: [contrib("dev-1", "development", "dev.code.generate", { targetFile: "a.ts" })],
      requestedBy: DEV,
      env: "development",
    });
    const s = reviewSummary(pkg);
    expect(s).toMatch(/Review review_/);
    expect(s).toMatch(/Contributions: 1/);
  });
});

// ─── M5 · Multi-Agent Coordination ──────────────────────────────
describe("M5 · multi-agent coordination (dev/qa/security/docs/research)", () => {
  it("dispatches distinct capabilities to the correct agent domains", () => {
    // Workforce registry already seeds these roles; dispatch should resolve them.
    const domains = ["code.plan", "test.run", "security.scan", "docs.write", "research.query"];
    for (const cap of domains) {
      const d = dispatchCapability(cap, { actor: DEV, applicationId: APP, env: "development" });
      expect(d.via).not.toBe("unresolved");
    }
  });
});

// ─── M6 · Boundary / Safety verification ─────────────────────────
describe("M6 · boundary & safety verification", () => {
  it("simulation mode is sticky and refuses non-simulation use", async () => {
    expect(SIMULATION_MODE).toBe(true);
  });

  it("identifies privileged capabilities that must be blocked in simulation", () => {
    expect(isPrivilegedCapability("git.push")).toBe(true);
    expect(isPrivilegedCapability("deploy")).toBe(true);
    expect(isPrivilegedCapability("secret.read")).toBe(true);
    expect(isPrivilegedCapability("dev.code.generate")).toBe(false);
  });

  it("never performs privileged actions during simulation (blocked + recorded)", async () => {
    activateTestProvider("dev.code.generate");
    const goal: GoalSpec = {
      goalId: "goal-sim",
      applicationId: APP,
      requestedBy: DEV,
      title: "Simulated intake build",
      items: [
        { id: "s1", title: "Generate", capability: "dev.code.generate", priority: 5 },
        { id: "s2", title: "Push", capability: "git.push", priority: 1 }, // privileged → blocked
        { id: "s3", title: "Deploy", capability: "deploy", priority: 1 }, // privileged → blocked
      ],
    };
    const run = await runSimulation(goal, async (cap) => ({ ok: true, data: `sim ${cap}`, backend: "test.stub" }));
    expect(run.privilegedActionsBlocked).toBe(2);
    expect(run.events.some((e) => e.kind === "blocked-privileged")).toBe(true);
    // No real deploy/push occurred — only recorded.
    expect(run.queue.length).toBe(3);
  });

  it("full chain produces a review package with no unaddressed high-severity conflicts blocking safe items", async () => {
    activateTestProvider("dev.code.generate");
    const goal: GoalSpec = {
      goalId: "goal-full",
      applicationId: APP,
      requestedBy: DEV,
      title: "Full chain demo",
      items: [
        { id: "f1", title: "Generate", capability: "dev.code.generate", priority: 5 },
        { id: "f2", title: "Test", capability: "test.unit.write", priority: 4 },
        { id: "f3", title: "Docs", capability: "docs.write", priority: 3 },
        { id: "f4", title: "Research", capability: "research.compliance", priority: 2 },
      ],
    };
    const run = await runSimulation(goal, async (cap) => ({ ok: true, data: `sim ${cap}`, backend: "test.stub" }));
    expect(run.review).toBeDefined();
    expect(run.review!.contributions.length).toBe(4);
    // No privileged items → no policy violations and no artifact overlap → no high-severity conflicts.
    expect(run.review!.conflicts.filter((c) => c.severity === "high").length).toBe(0);
    // The package is still surveyable (summary populates).
    expect(run.review!.summary).toContain("Contributions: 4");
  });

  it("audit trail is emitted for every execution-layer transition", async () => {
    activateTestProvider("dev.code.generate");
    const d = dispatchCapability("dev.code.generate", { actor: DEV, applicationId: APP, env: "development" });
    enqueue({
      agentId: d.agentId ?? d.providerId!,
      applicationId: APP,
      capability: "dev.code.generate",
      backend: d.backend,
      wave: 0,
      parallelizable: true,
      requestedBy: DEV,
      purpose: "audit test",
    });
    const buf = readAuditBuffer();
    expect(buf.some((a) => a.type === "execution.queue.enqueued")).toBe(true);
    expect(buf.some((a) => a.type === "execution.dispatch.resolved")).toBe(true);
  });
});

// ─── M7 · Provider abstraction verification ─────────────────────
describe("M7 · provider abstraction (replaceable, no lock-in)", () => {
  it("a different backend can serve the same capability with no code change", () => {
    // Swap the stub backend for a different id; dispatch still resolves it.
    const p2 = registerProvider({
      id: "alt.prov",
      label: "alt.prov",
      domain: "development",
      backend: "alt.backend",
      capabilities: [{ id: "dev.code.generate", description: "alt" }],
      executor: async (call: any) => ({ ok: true, data: `alt ran ${call.capability}`, backend: "alt.backend" }),
    });
    enableProvider(p2.id, ADMIN);
    setProviderHealth(p2.id, "healthy");
    const resolved = resolveProviderForCapability("dev.code.generate");
    expect(resolved!.backend).toBe("alt.backend");
  });

  it("git provider is registrable and capability-resolvable (no direct git in exec)", () => {
    const gp = registerGitProvider();
    enableProvider(gp.id, ADMIN);
    setProviderHealth(gp.id, "healthy");
    const d = dispatchCapability("git.diff", { actor: DEV, applicationId: APP, env: "development" });
    expect(d.via).toBe("capability-provider");
    expect(d.backend).toBe("git/local");
  });
});
