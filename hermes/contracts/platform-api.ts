// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Internal API Contracts                       │
// │ EPIC-002-006C · PHASE 7                                        │
// │ Every operation is authenticated, authorized, and audited.     │
// │ No public exposure; these are invoked in-process by authorized │
// │ platform code only.                                            │
// └─────────────────────────────────────────────────────────────┘

import type { ResourceKind, ResourceLifecycleState } from "../../shared/contracts/resource.js";

/**
 * Tenant / organization boundary.
 *
 * Every Principal is scoped to a tenant (organization). Cross-tenant access is
 * forbidden by construction: the auth layer (hermes/admin/access.ts) MUST
 * enforce that a principal can only act within resources owned by
 * `organizationId` / listed in `scopes`. This is the single insertion point
 * for multi-tenant isolation (EPIC-003-006 M4) — add scope checks here, not
 * ad-hoc per-caller.
 */
export interface TenantScope {
  /** Owning organization/tenant id (e.g. "ags-fertility"). */
  organizationId: string;
  /** Optional finer-grained tenant qualifier. */
  tenantId?: string;
}

/** An access scope a principal is authorized to operate within. */
export interface AccessScope extends TenantScope {
  /** Application the scope is bound to (e.g. "ags-fertility"). */
  application?: string;
  /** Environment qualifier the scope covers. */
  env?: "production" | "staging" | "development" | "*";
}

/** Minimal authenticated principal passed to every API call. */
export interface Principal {
  id: string;
  /** Hermes permission grants the principal holds. */
  permissions: string[];
  // ── Tenant / org boundary (EPIC-003-006 M4) ──
  /** Organization/tenant the principal belongs to. */
  organizationId?: string;
  /** Optional finer-grained tenant qualifier. */
  tenantId?: string;
  /**
   * Explicit access scopes the principal is authorized for. When present,
   * authorization MUST verify the target resource falls within one of these
   * scopes. Empty/absent means "no scoped grant" (treated as deny for
   * tenant-protected resources). This is the insertion point for
   * tenant-scoped authorization checks.
   */
  scopes?: AccessScope[];
}

/** Result envelope for all platform API calls. */
export interface ApiResult<T> {
  ok: boolean;
  data?: T;
  error?: string;
}

// ── Registry API ────────────────────────────────────────────────
export interface RegisterResourceInput {
  kind: ResourceKind;
  name: string;
  owner: string;
  env: string;
  provider: string;
  region?: string;
  state?: ResourceLifecycleState;
  meta?: Record<string, unknown>;
}

// ── Discovery API ──────────────────────────────────────────────
export interface DiscoveryQuery {
  kind?: ResourceKind;
  owner?: string;
  provider?: string;
  state?: ResourceLifecycleState;
}

// ── Lifecycle API ───────────────────────────────────────────────
export interface TransitionInput {
  id: string;
  from: ResourceLifecycleState | string;
  to: ResourceLifecycleState | string;
  /** Required for any activation transition. */
  authorized?: boolean;
}

// ── Agent management API ───────────────────────────────────────
export interface AgentTransitionInput {
  id: string;
  from: string;
  to: string;
  authorized: boolean;
}

/**
 * Authorization check stub. In production this delegates to the Hermes
 * Permission engine (extracted in 006B). Kept as a single choke point so
 * the rule "every action authorized" is enforced in one place.
 */
export type Authorizer = (principal: Principal, required: string) => boolean;

export const PLATFORM_PERMISSIONS = {
  REGISTRY_WRITE: "hermes:registry:write",
  REGISTRY_READ: "hermes:registry:read",
  DISCOVERY_READ: "hermes:discovery:read",
  LIFECYCLE_WRITE: "hermes:lifecycle:write",
  AGENT_WRITE: "hermes:agent:write",
  AGENT_ACTIVATE: "hermes:agent:activate",
  // EPIC-002-007 · Activation platform
  ACTIVATION_READ: "hermes:activation:read",
  ACTIVATION_WRITE: "hermes:activation:write",
  ACTIVATION_PROVIDER: "hermes:activation:provider",
  // EPIC-003-001 · Execution platform
  EXECUTION_PLAN: "hermes:execution:plan",
  EXECUTION_DISPATCH: "hermes:execution:dispatch",
  EXECUTION_QUEUE: "hermes:execution:queue",
  EXECUTION_REVIEW: "hermes:execution:review",
  EXECUTION_SIMULATE: "hermes:execution:simulate",
} as const;
