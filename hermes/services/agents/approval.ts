// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent Approval Workflow                      │
// │ EPIC-002-006D · PHASE 2                                        │
// │ Human approval gates. Lifecycle:                             │
// │   registered → assigned → pending_approval → approved → active│
// │                                                 RULES:        │
// │  • NO direct registered → active transition.                 │
// │  • Activation (→ active) requires:                           │
// │      – authorized human identity (principal)                 │
// │      – explicit permission check (hermes:agent:activate)     │
// │      – audit event                                            │
// │  • "pending_approval" is an intermediate assignment state     │
// │    tracked here; the canonical AgentLifecycleState only      │
// │    advances on explicit human approval.                      │
// └─────────────────────────────────────────────────────────────┘

import { getAgent, activateAgent, deactivateAgent, setState, type RegisteredAgent } from "../../agents/registry.js";
import {
  transitionAgent,
  LifecycleError,
} from "../lifecycle/lifecycle.js";
import {
  canTransitionAgent,
  type AgentLifecycleState,
} from "../../../shared/contracts/lifecycle.js";
import { emitAudit } from "../../audit/event.js";
import type { Principal } from "../../contracts/platform-api.js";
import {
  getAssignment,
  listAssignments,
  type AgentAssignment,
} from "./assignment.js";

/** Error thrown by the approval workflow. */
export class ApprovalError extends Error {}

/** Alias used by the activation gate (human approval required). */
export class ActivationError extends ApprovalError {}

/**
 * Submit an assigned agent for approval. Moves the assignment to
 * "pending_approval". This does NOT activate the agent.
 *
 * Precondition: agent must be in `assigned` state and have a live assignment.
 */
export function requestAgentApproval(
  agentId: string,
  principal: Principal,
): { agent: RegisteredAgent; assignment?: AgentAssignment } {
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  if (agent.state !== "assigned") {
    throw new ApprovalError(
      `Agent ${agentId} must be "assigned" before approval (current: ${agent.state})`,
    );
  }
  const assignment = listAssignments({ agentId }).find((a) => a.state === "assigned");
  if (assignment) {
    assignment.state = "pending_approval" as AgentAssignment["state"];
    assignment.updatedAt = new Date().toISOString();
    assignment.audit.push({
      at: assignment.updatedAt,
      actor: principal.id,
      action: "approval.requested",
    });
  }
  emitAudit("agent.approval.requested", principal.id, { agentId });
  return { agent, assignment };
}

/**
 * Approve an agent. This advances the agent lifecycle
 * assigned → approved (NOT active). Activation is a separate, explicit gate.
 *
 * Requires `hermes:agent:activate` (or `hermes:agent:write`).
 */
export function approveAgent(
  agentId: string,
  approver: Principal,
): { agent: RegisteredAgent; transition: ReturnType<typeof transitionAgent> } {
  const ok =
    approver.permissions.includes("hermes:agent:activate") ||
    approver.permissions.includes("hermes:agent:write");
  if (!ok) {
    emitAudit("agent.approve.denied", approver.id, { agentId, reason: "missing authority" });
    throw new ApprovalError(
      "Approval requires hermes:agent:activate (authorized human identity)",
    );
  }
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  if (!canTransitionAgent(agent.state as AgentLifecycleState, "approved")) {
    throw new ApprovalError(
      `Illegal approval transition: ${agent.state} -> approved`,
    );
  }
  const transition = transitionAgent(
    agentId,
    agent.state as AgentLifecycleState,
    "approved",
    approver.id,
    true, // explicit human authorization
    "human approval gate",
  );
  const assignment = listAssignments({ agentId }).find(
    (a) => a.state === "pending_approval" || a.state === "assigned",
  );
  if (assignment) {
    assignment.state = "approved";
    assignment.authorizedBy = approver.id;
    assignment.updatedAt = new Date().toISOString();
    assignment.audit.push({
      at: assignment.updatedAt,
      actor: approver.id,
      action: "approved",
    });
  }
  emitAudit("agent.approved", approver.id, { agentId, approver: approver.id });
  const persisted = setState(agentId, "approved");
  return { agent: persisted, transition };
}

/**
 * Activate an approved agent. This is the ONLY path to `active`, and it
 * requires a DISTINCT authorized human identity + permission + audit.
 *
 * GUARD: refuses any direct registered/assigned → active jump. The
 * lifecycle.ts canTransitionAgent already forbids registered→active, but we
 * add an explicit defense-in-depth check here.
 */
export function activateApprovedAgent(
  agentId: string,
  activator: Principal,
): { agent: RegisteredAgent; transition: ReturnType<typeof transitionAgent> } {
  const ok =
    activator.permissions.includes("hermes:agent:activate") ||
    activator.permissions.includes("hermes:agent:write");
  if (!ok) {
    emitAudit("agent.activate.denied", activator.id, { agentId, reason: "missing authority" });
    throw new ApprovalError("Activation requires hermes:agent:activate");
  }
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  // Defense-in-depth: never allow skipping approval.
  if (agent.state !== "approved") {
    throw new ApprovalError(
      `Agent ${agentId} must be "approved" before activation (current: ${agent.state})`,
    );
  }
  const transition = transitionAgent(
    agentId,
    "approved",
    "active",
    activator.id,
    true,
    "explicit human activation",
  );
  // Activation ALSO flips the registry activation flag (enabled was set at enable time).
  emitAudit("agent.activated", activator.id, { agentId, activator: activator.id });
  const persisted = setState(agentId, "active");
  return { agent: persisted, transition };
}

/** Pause an active agent (active → paused). Reversible. */
export function pauseAgent(
  agentId: string,
  principal: Principal,
): { agent: RegisteredAgent; transition: ReturnType<typeof transitionAgent> } {
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  const transition = transitionAgent(
    agentId,
    agent.state as AgentLifecycleState,
    "paused",
    principal.id,
    true,
    "human pause",
  );
  emitAudit("agent.paused", principal.id, { agentId });
  const persisted = setState(agentId, "paused");
  return { agent: persisted, transition };
}

/**
 * Resume a paused agent (paused → active). Pause/resume does NOT require
 * re-approval — the agent was already approved before it was activated — but
 * it MUST be a distinct authorized human action (no silent auto-resume).
 */
export function resumeAgent(
  agentId: string,
  principal: Principal,
): { agent: RegisteredAgent; transition: ReturnType<typeof transitionAgent> } {
  const ok =
    principal.permissions.includes("hermes:agent:activate") ||
    principal.permissions.includes("hermes:agent:write");
  if (!ok) {
    emitAudit("agent.resume.denied", principal.id, { agentId, reason: "missing authority" });
    throw new ApprovalError("Resume requires hermes:agent:activate");
  }
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  if (agent.state !== "paused") {
    throw new ApprovalError(
      `Agent ${agentId} must be "paused" before resume (current: ${agent.state})`,
    );
  }
  const transition = transitionAgent(
    agentId,
    "paused",
    "active",
    principal.id,
    true,
    "human resume",
  );
  emitAudit("agent.resumed", principal.id, { agentId, actor: principal.id });
  const persisted = setState(agentId, "active");
  return { agent: persisted, transition };
}

/** Retire an agent (from any non-retired state → retired). Irreversible by design. */
export function retireAgent(
  agentId: string,
  principal: Principal,
): { agent: RegisteredAgent; transition: ReturnType<typeof transitionAgent> } {
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  const transition = transitionAgent(
    agentId,
    agent.state as AgentLifecycleState,
    "retired",
    principal.id,
    true,
    "human retirement",
  );
  emitAudit("agent.retired", principal.id, { agentId });
  const persisted = setState(agentId, "retired");
  return { agent: persisted, transition };
}

/** Re-export for convenience. */
export { LifecycleError };
export { getAssignment };

/**
 * Enable an agent for assignment. Registration ALWAYS starts `disabled`
 * (registry safety invariant). Bringing an agent into service requires an
 * explicit, authorized operator action — this is that action. It only flips
 * the `activation` flag to `enabled`; the agent still cannot act until a
 * human walks it through assigned → approved → active.
 *
 * The live operational agent (ags-fertility-ops-agent) must NEVER be enabled.
 */
export function enableAgentForAssignment(agentId: string, principal: Principal): RegisteredAgent {
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  if (agentId === "ags-fertility-ops-agent")
    throw new ApprovalError("ags-fertility-ops-agent is permanently disabled and cannot be enabled");
  if (!principal.permissions.includes("hermes:agent:write"))
    throw new ApprovalError(`Unauthorized to enable agent ${agentId}: missing hermes:agent:write`);
  if (agent.state === "active")
    throw new ApprovalError(`Agent ${agentId} is already active; cannot re-enable`);
  const updated = activateAgent(agentId);
  emitAudit("agent.enabled", principal.id, { agentId });
  return updated;
}

/** Disable an agent (flip activation back to disabled). Stops further assignment. */
export function disableAgentForAssignment(agentId: string, principal: Principal): RegisteredAgent {
  const agent = getAgent(agentId);
  if (!agent) throw new ApprovalError(`Unknown agent: ${agentId}`);
  if (!principal.permissions.includes("hermes:agent:write"))
    throw new ApprovalError(`Unauthorized to disable agent ${agentId}: missing hermes:agent:write`);
  const updated = deactivateAgent(agentId);
  emitAudit("agent.disabled", principal.id, { agentId });
  return updated;
}
