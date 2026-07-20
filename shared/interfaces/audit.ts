// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Audit Persistence Boundary                  │
// │ EPIC-003-006 M3 · Provider-neutral audit contract.            │
// │ A single canonical AuditEvent + an AuditStore persistence      │
// │ boundary. The in-memory store is the default; a D1-backed      │
// │ store can be dropped in behind the same interface (ADR-007).   │
// └─────────────────────────────────────────────────────────────┘

/** Coarse classification used for filtering and retention policy. */
export type AuditCategory =
  | "auth"
  | "data"
  | "agent"
  | "admin"
  | "system"
  | "security";

/**
 * Canonical audit event. Provider-neutral: no D1 / Cloudflare assumptions.
 * The store assigns `id` and `at` when omitted (fail-safe defaults).
 */
export interface AuditEvent {
  /** Stable event id (assigned by the store if absent). */
  id?: string;
  /** Event type / noun, e.g. "registry.register", "auth.denied", "agent.activated". */
  type: string;
  /** Coarse classification for filtering. */
  category?: AuditCategory;
  /** Actor principal id (from Hermes Identity), or "system". */
  actor: string;
  /** RFC3339 timestamp (assigned by the store if absent). */
  at: string;
  /** Human-readable action label. */
  action: string;
  /** Optional resource the action targeted (id / path / urn). */
  resource?: string;
  /** Authorization decision when applicable. */
  decision?: "allow" | "deny";
  /** Structured detail (free-form; never include secrets). */
  meta?: Record<string, unknown>;
  /** Tenant/organization the event belongs to (multi-tenant isolation). */
  tenant?: string;
  /** Workflow the event is correlated to (execution correlation). */
  workflow?: string;
}

/** Optional filter for reading stored events. */
export interface AuditQuery {
  type?: string;
  category?: AuditCategory;
  actor?: string;
  resource?: string;
  decision?: "allow" | "deny";
  /** Tenant/organization the event belongs to (multi-tenant isolation). */
  tenant?: string;
  /** Workflow the event is correlated to (execution correlation). */
  workflow?: string;
  since?: string; // RFC3339 lower bound (inclusive)
  until?: string; // RFC3339 upper bound (inclusive)
  limit?: number;
}

/**
 * Audit persistence boundary. Implementations MUST be append-only and
 * non-blocking from the caller's perspective — a store failure MUST NOT
 * break the request that emitted the audit event ("log, don't leak").
 *
 * The in-memory store satisfies this for dev/test/edge; a D1-backed store
 * implements the same interface for durable persistence (ADR-007).
 */
export interface AuditStore {
  /** Persist one event (idempotent by event.id when provided). */
  append(event: AuditEvent): void;
  /** Query stored events by optional filter. */
  query(filter?: AuditQuery): AuditEvent[];
  /** Clear all stored events (test/reset helper). */
  clear(): void;
}

/**
 * Low-level write sink (kept for backward compatibility with the existing
 * auth audit writer path). A store MAY forward to an AuditProvider, but the
 * AuditStore interface is the authoritative persistence boundary.
 */
export interface AuditProvider {
  /** Persist an audit event. MUST be non-blocking / best-effort. */
  write(event: AuditEvent): Promise<void>;
}
