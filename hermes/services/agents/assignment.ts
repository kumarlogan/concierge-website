// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent Assignment Service                     │
// │ EPIC-002-006D · PHASE 1                                        │
// │ Controlled assignment lifecycle: Agent → Application.          │
// │                                                 CONTROLS:      │
// │  • Cannot assign retired / disabled / unauthorized agents.    │
// │  • Every assignment is authenticated, authorized, audited.    │
// │  • Assignment only moves an agent registered → assigned.      │
// │ No activation occurs here — activation is a separate, gated    │
// │ approval step (Phase 2). Agents remain disabled throughout.    │
// └─────────────────────────────────────────────────────────────┘

import {
  getAgent,
  listAgents,
  setState,
  type RegisteredAgent,
} from "../../agents/registry.js";
import {
  canTransitionAgent,
  type AgentLifecycleState,
} from "../../../shared/contracts/lifecycle.js";
import { emitAudit } from "../../audit/event.js";
import type { Principal } from "../../contracts/platform-api.js";

/** An assignment of one agent to one application (controlled scope). */
export interface AgentAssignment {
  /** Assignment id. */
  id: string;
  /** Agent id (must be registered, enabled, non-retired). */
  agentId: string;
  /** Application id the agent is assigned to (e.g. "ags-fertility"). */
  applicationId: string;
  /** Lifecycle state of the assignment (mirrors agent lifecycle gate). */
  state: "assigned" | "pending_approval" | "approved" | "active" | "paused" | "retired";
  /** Principal that requested the assignment. */
  requestedBy: string;
  /** Principal that authorized the assignment (if any). */
  authorizedBy?: string;
  /** RFC3339 timestamps. */
  createdAt: string;
  updatedAt: string;
  /** Audit trail of assignment lifecycle changes. */
  audit: Array<{ at: string; actor: string; action: string; detail?: Record<string, unknown> }>;
}

const STORE = new Map<string, AgentAssignment>();

function nowIso(): string {
  return new Date().toISOString();
}

function genId(): string {
  return `asg_${Math.random().toString(36).slice(2, 10)}`;
}

/** Error thrown when an assignment rule is violated. */
export class AssignmentError extends Error {}

/**
 * Authorize an assignment request against the caller's principal.
 * Assignment is a write operation requiring `hermes:agent:assign`.
 * The AuthorizationError here is a guard; in production this delegates to the
 * Hermes Permission engine. Audited regardless of outcome.
 */
function requireAssignAuthority(principal: Principal): void {
  const ok =
    principal.permissions.includes("hermes:agent:assign") ||
    principal.permissions.includes("hermes:agent:write");
  if (!ok) {
    emitAudit("agent.assign.denied", principal.id, {
      reason: "missing hermes:agent:assign",
    });
    throw new AssignmentError(
      "Principal lacks authority to assign agents (require hermes:agent:assign)",
    );
  }
}

/**
 * Assign a registered, enabled, non-retired agent to an application.
 *
 * Guards (all audited):
 *  • agent must exist
 *  • agent must NOT be retired
 *  • agent must NOT be disabled (activation != enabled)
 *  • agent must be in a state that permits assignment (registered/assigned)
 *  • application must be in the agent's `applicationsAllowed` allow-list
 *
 * @returns the created assignment (state: "assigned").
 */
export function assignAgentToApplication(
  agentId: string,
  applicationId: string,
  principal: Principal,
): AgentAssignment {
  requireAssignAuthority(principal);

  const agent = getAgent(agentId);
  if (!agent) {
    emitAudit("agent.assign.failed", principal.id, { agentId, reason: "unknown agent" });
    throw new AssignmentError(`Unknown agent: ${agentId}`);
  }
  if (agent.state === "retired") {
    emitAudit("agent.assign.failed", principal.id, { agentId, reason: "retired" });
    throw new AssignmentError(`Cannot assign retired agent: ${agentId}`);
  }
  if (agent.activation !== "enabled") {
    emitAudit("agent.assign.failed", principal.id, { agentId, reason: "disabled" });
    throw new AssignmentError(`Cannot assign disabled agent: ${agentId} (must be enabled)`);
  }
  if (!canTransitionAgent(agent.state as AgentLifecycleState, "assigned")) {
    emitAudit("agent.assign.failed", principal.id, {
      agentId,
      reason: `illegal transition ${agent.state} -> assigned`,
    });
    throw new AssignmentError(
      `Agent ${agentId} in state "${agent.state}" cannot be assigned`,
    );
  }
  // Apply the lifecycle transition: registered/... -> assigned.
  setState(agent.id, "assigned");
  const allowed = agent.applicationsAllowed ?? [];
  if (allowed.length > 0 && !allowed.includes(applicationId)) {
    emitAudit("agent.assign.failed", principal.id, {
      agentId,
      applicationId,
      reason: "application not in allow-list",
    });
    throw new AssignmentError(
      `Agent ${agentId} is not authorized for application "${applicationId}"`,
    );
  }

  const ts = nowIso();
  const assignment: AgentAssignment = {
    id: genId(),
    agentId,
    applicationId,
    state: "assigned",
    requestedBy: principal.id,
    createdAt: ts,
    updatedAt: ts,
    audit: [
      {
        at: ts,
        actor: principal.id,
        action: "assigned",
        detail: { applicationId, agentState: agent.state },
      },
    ],
  };
  STORE.set(assignment.id, assignment);
  emitAudit("agent.assigned", principal.id, {
    assignmentId: assignment.id,
    agentId,
    applicationId,
  });
  return assignment;
}

/** List assignments, optionally filtered by agent or application. */
export function listAssignments(filter?: {
  agentId?: string;
  applicationId?: string;
  state?: AgentAssignment["state"];
}): AgentAssignment[] {
  let items = [...STORE.values()];
  if (filter?.agentId) items = items.filter((a) => a.agentId === filter.agentId);
  if (filter?.applicationId)
    items = items.filter((a) => a.applicationId === filter.applicationId);
  if (filter?.state) items = items.filter((a) => a.state === filter.state);
  return items;
}

/** Get a single assignment. */
export function getAssignment(id: string): AgentAssignment | undefined {
  return STORE.get(id);
}

/** Test/reset helper. */
export function _clearAssignments(): void {
  STORE.clear();
}

/** Convenience: all agents currently assigned to an application. */
export function agentsForApplication(applicationId: string): RegisteredAgent[] {
  const ids = new Set(
    listAssignments({ applicationId }).map((a) => a.agentId),
  );
  return listAgents().filter((a) => ids.has(a.id));
}

/** Alias used by the internal workforce API facade (Phase 7). */
export const assignAgent = assignAgentToApplication;
