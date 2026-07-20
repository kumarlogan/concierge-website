// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Shared Contracts (provider-neutral)          │
// │ EPIC-002-006C · PHASE 1                                        │
// │ Data models shared by Hermes services. No vendor assumptions. │
// └─────────────────────────────────────────────────────────────┘

// ── Resource kinds tracked by the Registry ──────────────────────
export type ResourceKind =
  | "organization"
  | "application"
  | "environment"
  | "worker"
  | "database"
  | "storage"
  | "queue"
  | "provider"
  | "service"
  | "agent";

// ── Lifecycle states (resources) ────────────────────────────────
export type ResourceLifecycleState =
  | "planned"
  | "active"
  | "suspended"
  | "deprecated"
  | "deleted";

// ── Lifecycle states (agents) ───────────────────────────────────
// Authoritative agent lifecycle vocabulary (EPIC-003-006 M2):
//   registered → assigned → approved → active → (paused | suspended) → retired
// `activation` (enabled/disabled) is ORTHOGONAL — see registry. An agent may
// only execute when BOTH activation === "enabled" AND state === "active".
export type AgentLifecycleState =
  | "registered"
  | "assigned"
  | "approved"
  | "active"
  | "paused"
  | "suspended"
  | "retired";

// ── Ownership / scope ───────────────────────────────────────────
export interface Ownership {
  /** Owner account or org unit, e.g. "ags-fertility". */
  owner: string;
  /** Scope the resource lives in (org / app / env). */
  scope: "organization" | "application" | "environment";
  /** Hermes permission grant required to mutate this resource. */
  permission: string;
  /** Current lifecycle state. */
  lifecycleState: ResourceLifecycleState | AgentLifecycleState;
}

// ── Core resource record (provider-neutral) ─────────────────────
export interface ResourceRecord {
  id: string;
  kind: ResourceKind;
  /** Human label. */
  name: string;
  /** Owning application or org unit. */
  owner: string;
  /** Environment qualifier (production/staging/development) or "*". */
  env: string;
  /** Provider NAME as a data field — never a hardcoded import. */
  provider: string;
  /** Coarse region/zone hint (free-form, adapter interprets). */
  region?: string;
  /** Lifecycle state. */
  state: ResourceLifecycleState;
  /** Free-form metadata (bindings, versions, etc.). */
  meta: Record<string, unknown>;
  /** RFC3339 created timestamp. */
  createdAt: string;
  /** RFC3339 last-modified timestamp. */
  updatedAt: string;
}

// ── Discovery query result ──────────────────────────────────────
export interface DiscoveryResult {
  kind: ResourceKind;
  id: string;
  name: string;
  owner: string;
  provider: string;
  state: string;
}

// ── Lifecycle event (audit) ─────────────────────────────────────
export interface LifecycleEvent {
  resourceId: string;
  kind: ResourceKind;
  from: string;
  to: string;
  /** Actor principal id (from Hermes Identity). */
  actor: string;
  /** RFC3339 timestamp. */
  at: string;
  reason?: string;
}
