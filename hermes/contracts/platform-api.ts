// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Internal API Contracts                       │
// │ EPIC-002-006C · PHASE 7                                        │
// │ Every operation is authenticated, authorized, and audited.     │
// │ No public exposure; these are invoked in-process by authorized │
// │ platform code only.                                            │
// └─────────────────────────────────────────────────────────────┘

import type { ResourceKind, ResourceLifecycleState } from "../../shared/contracts/resource.js";

/** Minimal authenticated principal passed to every API call. */
export interface Principal {
  id: string;
  /** Hermes permission grants the principal holds. */
  permissions: string[];
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
} as const;
