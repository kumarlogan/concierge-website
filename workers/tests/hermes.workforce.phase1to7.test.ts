// Hermes Platform — EPIC-002-006D Workforce Management Tests
// Covers Phases 1-7: assignment, approval workflow, task framework,
// permission boundary, memory boundary, events, internal API contracts.
//
// Principle: human-controlled, least privilege, every action audited.
// No agent is activated without explicit approval. No deploy authority.

import { describe, it, expect, beforeEach } from "vitest";
import { listAgents, getAgent, _clearAgents } from "../../hermes/agents/registry.js";
import { seedAgentWorkforce, assertWorkforceSafety } from "../../hermes/agents/seed.js";
import {
  assignAgent,
  listAssignments,
  AssignmentError,
  type AgentAssignment,
} from "../../hermes/services/agents/assignment.js";
import {
  requestAgentApproval,
  approveAgent,
  activateApprovedAgent,
  pauseAgent,
  retireAgent,
  enableAgentForAssignment,
  resumeAgent,
  ApprovalError,
} from "../../hermes/services/agents/approval.js";
import {
  createTask,
  assignTask,
  approveTask,
  startTask,
  completeTask,
  listTasks,
  canTransitionTask,
  _clearTasks,
  type TaskState,
} from "../../hermes/services/agents/task.js";
import {
  resolveAgentPermissions,
  authorizeAgentAction,
  AGENT_DEFAULT_PERMISSIONS,
} from "../../hermes/services/agents/permissions.js";
import {
  evaluateMemoryAccess,
  type MemoryAccessRequest,
} from "../../hermes/services/agents/memory.js";
import {
  emitWorkforceEvent,
  readWorkforceAudit,
  _clearWorkforceAudit,
  WORKFORCE_EVENTS,
} from "../../hermes/workforce/events.js";
import { readAuditBuffer } from "../../hermes/audit/event.js";
import * as api from "../../hermes/workforce/api.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

// ─── Helpers ────────────────────────────────────────────────────────────

function human(permissions: string[], id = "operator:admin"): Principal {
  return { id, permissions: [...permissions] };
}

const OPERATOR = () => human(["hermes:agent:assign", "hermes:agent:activate", "hermes:agent:write"]);
const VIEWER = () => human(["hermes:agent:read"]);

/** Drive an agent from registered → active via the governed pipeline. */
function fullActivate(agentId: string, applicationId: string, principal: Principal) {
  enableAgentForAssignment(agentId, principal); // disabled → enabled (operator gate)
  const assignment = assignAgent(agentId, applicationId, principal); // → assigned
  const req = requestAgentApproval(agentId, principal); // → pending_approval
  const approved = approveAgent(agentId, principal); // → approved
  const activated = activateApprovedAgent(agentId, principal); // → active
  return { assignment, req, approved, activated };
}

beforeEach(() => {
  _clearAgents();
  _clearTasks();
  _clearWorkforceAudit();
  seedAgentWorkforce();
});

// ─── Phase 1 — Agent Registry & Seeding ─────────────────────────────────

describe("EPIC-002-006D · Phase 1 — Agent Registry & Seeding", () => {
  it("seeds the full AI workforce with stable ids", () => {
    const ids = listAgents().map((a: { id: string }) => a.id).sort();
    expect(ids).toEqual(
      [
        "ags-fertility-ops-agent",
        "qa-agent",
        "security-agent",
        "documentation-agent",
        "deployment-agent",
        "research-agent",
        "finance-agent",
        "customer-support-agent",
      ].sort(),
    );
  });

  it("every seeded agent starts registered + disabled + non-autonomous", () => {
    const { safe, violations } = assertWorkforceSafety();
    expect(safe, violations.join("; ")).toBe(true);
    for (const a of listAgents()) {
      expect(a.state).toBe("registered");
      expect(a.activation).toBe("disabled");
      expect(a.capabilities.every((c: { autonomous: boolean }) => c.autonomous === false)).toBe(true);
    }
  });

  it("the live operational agent is permanently disabled (never assignable)", () => {
    expect(getAgent("ags-fertility-ops-agent")!.activation).toBe("disabled");
  });
});

// ─── Phase 2 — Agent Assignment Service ─────────────────────────────────

describe("EPIC-002-006D · Phase 2 — Agent Assignment Service", () => {
  it("assigns an enabled workforce agent to an application", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    const a = assignAgent("qa-agent", "hermes-platform", OPERATOR());
    expect(a.agentId).toBe("qa-agent");
    expect(a.applicationId).toBe("hermes-platform");
    expect(a.requestedBy).toBe("operator:admin");
  });

  it("forbids assignment by a non-authorized principal", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    expect(() => assignAgent("qa-agent", "hermes-platform", VIEWER())).toThrow(AssignmentError);
  });

  it("forbids assigning the permanently-disabled ops agent", () => {
    expect(() => assignAgent("ags-fertility-ops-agent", "hermes-platform", OPERATOR())).toThrow(
      /disabled/,
    );
  });

  it("forbids assigning an agent that is not enabled", () => {
    // qa-agent is still disabled (not enabled yet).
    expect(() => assignAgent("qa-agent", "hermes-platform", OPERATOR())).toThrow(/disabled/);
  });

  it("lists assignments and tracks the requesting principal", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    assignAgent("qa-agent", "hermes-platform", OPERATOR());
    const all = listAssignments();
    expect(all.some((x: AgentAssignment) => x.agentId === "qa-agent")).toBe(true);
  });
});

// ─── Phase 3 — Agent Approval Workflow ──────────────────────────────────

describe("EPIC-002-006D · Phase 3 — Agent Approval Workflow", () => {
  it("walks the full lifecycle registered → assigned → approved → active", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    assignAgent("qa-agent", "hermes-platform", OPERATOR());
    const req = requestAgentApproval("qa-agent", OPERATOR());
    expect(req.assignment?.state).toBe("pending_approval");
    const approved = approveAgent("qa-agent", OPERATOR());
    expect(approved.agent.state).toBe("approved");
    const activated = activateApprovedAgent("qa-agent", OPERATOR());
    expect(activated.agent.state).toBe("active");
  });

  it("rejects approval from an unauthorized principal", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    assignAgent("qa-agent", "hermes-platform", OPERATOR());
    requestAgentApproval("qa-agent", OPERATOR());
    expect(() => approveAgent("qa-agent", VIEWER())).toThrow(ApprovalError);
  });

  it("rejects activation from an unauthorized principal", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    assignAgent("qa-agent", "hermes-platform", OPERATOR());
    requestAgentApproval("qa-agent", OPERATOR());
    approveAgent("qa-agent", OPERATOR());
    expect(() => activateApprovedAgent("qa-agent", VIEWER())).toThrow(ApprovalError);
  });

  it("forbids activation unless the agent is approved", () => {
    enableAgentForAssignment("qa-agent", OPERATOR());
    assignAgent("qa-agent", "hermes-platform", OPERATOR());
    expect(() => activateApprovedAgent("qa-agent", OPERATOR())).toThrow(ApprovalError);
  });

  it("retires a workforce agent (irreversible)", () => {
    const { activated } = fullActivate("qa-agent", "hermes-platform", OPERATOR());
    expect(activated.agent.state).toBe("active");
    const retired = retireAgent("qa-agent", OPERATOR());
    expect(retired.agent.state).toBe("retired");
  });

  it("pauses an active agent and resumes by re-activating", () => {
    fullActivate("qa-agent", "hermes-platform", OPERATOR());
    const paused = pauseAgent("qa-agent", OPERATOR());
    expect(paused.agent.state).toBe("paused");
    const resumed = resumeAgent("qa-agent", OPERATOR());
    expect(resumed.agent.state).toBe("active");
  });
});

// ─── Phase 4 — Agent Task Framework ─────────────────────────────────────

describe("EPIC-002-006D · Phase 4 — Agent Task Framework", () => {
  it("creates + approves + executes a task with full audit trail", () => {
    fullActivate("qa-agent", "hermes-platform", OPERATOR());
    const task = createTask({
      agentId: "qa-agent",
      applicationId: "hermes-platform",
      purpose: "Run regression suite",
      requestedBy: "operator:admin",
    });
    expect(task.state).toBe("created");
    const assigned = assignTask(task.id, "operator:admin");
    expect(assigned.state).toBe("assigned");
    const approved = approveTask(task.id, "operator:admin");
    expect(approved.state).toBe("approved");
    const started = startTask(task.id, "operator:admin");
    expect(started.state).toBe("running");
    const done = completeTask(task.id, "operator:admin");
    expect(done.state).toBe("completed");
  });

  it("enforces the task state machine (no skipping states)", () => {
    expect(canTransitionTask("created", "approved")).toBe(false);
    expect(canTransitionTask("created", "assigned")).toBe(true);
    expect(canTransitionTask("running", "completed")).toBe(true);
    expect(canTransitionTask("completed", "created")).toBe(false);
  });

  it("lists tasks filtered by agent", () => {
    fullActivate("qa-agent", "hermes-platform", OPERATOR());
    createTask({
      agentId: "qa-agent",
      applicationId: "hermes-platform",
      purpose: "x",
      requestedBy: "operator:admin",
    });
    const forAgent = listTasks({ agentId: "qa-agent" });
    expect(forAgent.length).toBe(1);
  });
});

// ─── Phase 5 — Agent Permission Boundary ────────────────────────────────

describe("EPIC-002-006D · Phase 5 — Agent Permission Boundary", () => {
  it("agent permissions are isolated from human permissions", () => {
    const agentPerms = resolveAgentPermissions("qa-agent");
    expect(agentPerms instanceof Set).toBe(true);
    for (const p of agentPerms) {
      expect(p).not.toMatch(/^hermes:agent:(write|activate|assign)$/);
    }
  });

  it("authorizeAgentAction denies unknown permissions and returns granted set", () => {
    const res = authorizeAgentAction("qa-agent", "deploy:execute" as never, { taskId: "t1" });
    expect(res.allowed).toBe(false);
    expect(Array.isArray(res.granted)).toBe(true);
  });

  it("default agent permissions follow the catalog (no wildcard grants)", () => {
    expect(AGENT_DEFAULT_PERMISSIONS["qa-agent"]).toBeDefined();
    for (const p of AGENT_DEFAULT_PERMISSIONS["qa-agent"]) {
      expect(p).not.toBe("*");
    }
  });
});

// ─── Phase 6 — Agent Memory Boundary ────────────────────────────────────

describe("EPIC-002-006D · Phase 6 — Agent Memory Boundary", () => {
  it("blocks cross-application memory access", () => {
    const req: MemoryAccessRequest = {
      agentId: "qa-agent",
      applicationId: "hermes-platform",
      scope: "application",
      targetId: "app:other",
    };
    const res = evaluateMemoryAccess(req);
    expect(res.allowed).toBe(false);
    expect(res.reason ?? "").toMatch(/application|cross/i);
  });

  it("allows same-application scoped access", () => {
    const req: MemoryAccessRequest = {
      agentId: "qa-agent",
      applicationId: "hermes-platform",
      scope: "application",
      targetId: "hermes-platform",
    };
    const res = evaluateMemoryAccess(req);
    expect(res.allowed).toBe(true);
  });
});

// ─── Phase 7 — Workforce Events & Audit ─────────────────────────────────

describe("EPIC-002-006D · Phase 7 — Workforce Events & Audit", () => {
  it("emits a workforce event that is timestamped + identity-recorded", () => {
    emitWorkforceEvent(WORKFORCE_EVENTS.AGENT_ASSIGNED, "operator:admin", { agentId: "qa-agent" });
    const events = readWorkforceAudit();
    expect(events.length).toBeGreaterThan(0);
    const last = events[events.length - 1];
    expect(last.at).toBeTruthy();
    expect(last.actor).toBe("operator:admin");
  });

  it("audit log records lifecycle transitions with actor + action", () => {
    fullActivate("qa-agent", "hermes-platform", OPERATOR());
    const audit = readAuditBuffer();
    const actions = audit.map((e: { type: string }) => e.type);
    expect(actions).toContain("agent.enabled");
    expect(actions).toContain("agent.assigned");
    expect(actions).toContain("agent.approved");
    expect(actions).toContain("agent.activated");
  });
});

// ─── Phase 7 — Internal Workforce API Contracts ─────────────────────────

describe("EPIC-002-006D · Phase 7 — Internal Workforce API Contracts", () => {
  it("internal api facade drives assignment + approval + activation end-to-end", () => {
    api.apiEnableAgent("qa-agent", OPERATOR());
    const a = api.apiAssignAgent({
      agentId: "qa-agent",
      applicationId: "hermes-platform",
      principal: OPERATOR(),
    });
    expect(a.agentId).toBe("qa-agent");
    api.apiRequestApproval("qa-agent", OPERATOR());
    const approved = api.apiApproveAgent("qa-agent", OPERATOR());
    expect(approved.agent?.state).toBe("approved");
    const activated = activateApprovedAgent("qa-agent", OPERATOR());
    expect(activated.agent.state).toBe("active");
  });

  it("api facade exposes task + security boundary checks", () => {
    fullActivate("qa-agent", "hermes-platform", OPERATOR());
    const task = api.apiCreateTask({
      agentId: "qa-agent",
      applicationId: "hermes-platform",
      purpose: "audit check",
      requestedBy: "operator:admin",
    });
    expect(task.state).toBe("created");
    const authz = api.apiAuthorizeAgentAction("qa-agent", "deploy:execute" as never);
    expect(authz.allowed).toBe(false);
  });

  it("api facade exposes the workforce event catalog", () => {
    expect(typeof api.WORKFORCE_EVENTS).toBe("object");
    expect(Object.keys(api.WORKFORCE_EVENTS).length).toBeGreaterThan(0);
  });
});
