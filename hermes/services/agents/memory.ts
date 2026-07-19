// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent Memory Boundary                        │
// │ EPIC-002-006D · PHASE 5                                        │
// │ Memory scope model. Contracts ONLY — no external AI memory     │
// │ provider is connected in this EPIC.                            │
// │                                                 SCOPES:       │
// │  organization · application · agent · task                     │
// │                                                 RULES:         │
// │  • Agent cannot read another application's memory.             │
// │  • Agent cannot read another agent's private memory.           │
// │  • Agent cannot read restricted organizational data.           │
// │  • Task memory is visible only to its owning agent+task.       │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";

/** The four memory scopes in the platform. */
export type MemoryScope = "organization" | "application" | "agent" | "task";

/** A memory reference request the boundary evaluates. */
export interface MemoryAccessRequest {
  /** Agent requesting access. */
  agentId: string;
  /** Application the agent is scoped to. */
  applicationId: string;
  /** Scope the agent wants to read/write. */
  scope: MemoryScope;
  /** For application/agent/task scopes: the target id. */
  targetId?: string;
  /** Whether the data is flagged restricted (org-confidential). */
  restricted?: boolean;
}

/** Result of a memory boundary evaluation. */
export interface MemoryAccessDecision {
  allowed: boolean;
  reason: string;
  scope: MemoryScope;
}

/** Flags a memory region as organization-restricted (never agent-visible). */
const RESTRICTED_ORG_KEYS = new Set([
  "finance.ledger",
  "security.credentials",
  "identity.secrets",
  "org.contracts",
]);

/**
 * Evaluate whether an agent may access a memory region.
 *
 * This is a PURE contract check — it does not read or write any memory
 * backend. The actual memory store is wired in a later EPIC; this module
 * defines the enforceable boundary so no future integration can bypass it.
 */
export function evaluateMemoryAccess(req: MemoryAccessRequest): MemoryAccessDecision {
  const { agentId, applicationId, scope, targetId, restricted } = req;

  // Rule 0: restricted org data is NEVER agent-accessible.
  if (restricted || (scope === "organization" && RESTRICTED_ORG_KEYS.has(targetId ?? ""))) {
    emitAudit("memory.denied", `agent:${agentId}`, {
      agentId,
      scope,
      targetId,
      reason: "restricted organizational data",
    });
    return {
      allowed: false,
      reason: "Access to restricted organizational data is denied to agents",
      scope,
    };
  }

  // Rule 1: agent cannot read another application's memory.
  if (scope === "application") {
    if (targetId && targetId !== applicationId) {
      emitAudit("memory.denied", `agent:${agentId}`, {
        agentId,
        scope,
        targetId,
        applicationId,
        reason: "cross-application access",
      });
      return {
        allowed: false,
        reason: `Agent scoped to "${applicationId}" cannot access application "${targetId}" memory`,
        scope,
      };
    }
    return { allowed: true, reason: "application-scoped access permitted", scope };
  }

  // Rule 2: agent cannot read ANOTHER agent's private memory.
  if (scope === "agent") {
    if (targetId && targetId !== agentId) {
      emitAudit("memory.denied", `agent:${agentId}`, {
        agentId,
        scope,
        targetId,
        reason: "cross-agent private memory",
      });
      return {
        allowed: false,
        reason: `Agent "${agentId}" cannot access agent "${targetId}" private memory`,
        scope,
      };
    }
    return { allowed: true, reason: "own agent memory permitted", scope };
  }

  // Rule 3: task memory is only visible to its owning agent (targetId = taskId,
  // validated by caller binding task→agent). Here we allow task scope for the
  // requesting agent; cross-task validation is the caller's responsibility.
  if (scope === "task") {
    return { allowed: true, reason: "task-scoped access permitted", scope };
  }

  // organization (non-restricted) read is permitted for discovery/context.
  if (scope === "organization") {
    return { allowed: true, reason: "non-restricted organization memory permitted", scope };
  }

  return { allowed: false, reason: "unknown scope", scope };
}
