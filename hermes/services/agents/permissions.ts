// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent Permission Boundary                    │
// │ EPIC-002-006D · PHASE 4                                        │
// │ Agent permissions are SEPARATE from human permissions. An       │
// │ agent's effective permission set is data-driven (granted at     │
// │ registration/assignment) and is evaluated independently of the  │
// │ human operator's principal permissions. This module defines the │
// │ agent permission catalog and an evaluator.                      │
// │                                                 EXAMPLES:       │
// │  QA Agent:        read:code, read:tests, create:reports         │
// │  Security Agent:  read:security-config, create:findings         │
// │  Documentation:   read:docs, create:documentation               │
// │  Deployment:      prepare:deployment-plan (NO deploy authority) │
// └─────────────────────────────────────────────────────────────┘

import { getAgent } from "../../agents/registry.js";
import { emitAudit } from "../../audit/event.js";

/** All known agent-scoped permission keys (catalog). */
export const AGENT_PERMISSION_CATALOG = [
  "read:code",
  "read:tests",
  "create:reports",
  "read:security-config",
  "create:findings",
  "read:docs",
  "create:documentation",
  "prepare:deployment-plan", // DEPLOYMENT AUTHORITY IS EXPLICITLY EXCLUDED
  "read:finance",
  "read:research",
  "read:support",
  "draft:support-reply",
  "read:leads",
  "write:leads",
  "read:consultations",
] as const;

export type AgentPermission = (typeof AGENT_PERMISSION_CATALOG)[number];

/**
 * Default permission grants per agent id (data-driven baseline). Mirrors the
 * EPIC examples. Deployment Agent gets plan-prep ONLY — never deploy:execute.
 */
export const AGENT_DEFAULT_PERMISSIONS: Record<string, AgentPermission[]> = {
  "qa-agent": ["read:code", "read:tests", "create:reports"],
  "security-agent": ["read:security-config", "create:findings"],
  "documentation-agent": ["read:docs", "create:documentation"],
  "deployment-agent": ["prepare:deployment-plan"],
  "finance-agent": ["read:finance"],
  "research-agent": ["read:research"],
  "customer-support-agent": ["read:support", "draft:support-reply"],
  "ags-fertility-ops-agent": ["read:leads", "write:leads", "read:consultations"],
};

/**
 * Resolve an agent's effective permission set.
 *
 * Precedence: explicit `agent.permissions` (from registry) OVERRIDES the
 * default catalog grant. If neither is present, the agent has NO permissions
 * (fail-closed — least privilege).
 */
export function resolveAgentPermissions(agentId: string): Set<AgentPermission> {
  const agent = getAgent(agentId);
  if (!agent) throw new Error(`Unknown agent: ${agentId}`);

  // Explicit grants win (data-driven, set at registration/assignment time).
  if (agent.permissions && agent.permissions.length > 0) {
    return new Set(agent.permissions as AgentPermission[]);
  }
  const defaults = AGENT_DEFAULT_PERMISSIONS[agentId] ?? [];
  return new Set(defaults);
}

/** Boolean check: does the agent hold `perm` within its OWN boundary? */
export function agentHasPermission(agentId: string, perm: AgentPermission): boolean {
  return resolveAgentPermissions(agentId).has(perm);
}

/**
 * Authorize an agent action by the AGENT's own permissions — NOT the human's.
 * This is the core boundary: an agent may only do what its grant allows,
 * regardless of who triggered it.
 *
 * Returns a decision and emits an audit event (allow OR deny).
 */
export function authorizeAgentAction(
  agentId: string,
  perm: AgentPermission,
  context?: { taskId?: string; applicationId?: string },
): { allowed: boolean; granted: AgentPermission[] } {
  const granted = resolveAgentPermissions(agentId);
  const allowed = granted.has(perm);
  emitAudit(allowed ? "agent.authz.allow" : "agent.authz.deny", `agent:${agentId}`, {
    agentId,
    permission: perm,
    ...(context ?? {}),
  });
  return { allowed, granted: [...granted] };
}

/**
 * Enforce: throw if the agent lacks `perm`. Used by task execution gates
 * (Phase 3 runtime) to guarantee agents never exceed their boundary.
 */
export function requireAgentPermission(agentId: string, perm: AgentPermission): void {
  const { allowed } = authorizeAgentAction(agentId, perm);
  if (!allowed) {
    throw new Error(`Agent ${agentId} lacks permission "${perm}" (boundary violation)`);
  }
}

/** Test/introspection helper. */
export function listAgentPermissions(agentId: string): AgentPermission[] {
  return [...resolveAgentPermissions(agentId)];
}
