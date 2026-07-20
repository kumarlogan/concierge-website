// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Audit Emission (boundary seam)              │
// │ EPIC-003-006 M3 · emits append-only audit events through the  │
// │ AuditStore persistence boundary (defaultAuditStore). An        │
// │ optional sink (e.g. D1-backed writer) can still be attached.   │
// └─────────────────────────────────────────────────────────────┘

import type { AuditEvent as CanonicalAuditEvent } from "../../shared/interfaces/audit.js";
import { defaultAuditStore } from "./store.js";

/**
 * Public audit event shape (legacy-compatible; carries `detail`). Backed by
 * the canonical AuditStore, which normalizes events to AuditEvent (meta).
 */
export interface AuditEvent {
  /** Event type, e.g. "registry.register", "agent.activated". */
  type: string;
  /** Actor principal id (from Hermes Identity). */
  actor: string;
  /** RFC3339 timestamp. */
  at: string;
  /** Arbitrary structured detail. */
  detail: Record<string, unknown>;
  /** Canonical meta (mirror of detail; present when read back from store). */
  meta?: Record<string, unknown>;
}

type AuditSink = (event: AuditEvent) => void;

let SINK: AuditSink | null = null;

/** Attach a durable sink (e.g. D1-backed writer). Optional. */
export function setAuditSink(sink: AuditSink | null): void {
  SINK = sink;
}

/**
 * Emit an audit event through the persistence boundary. Never throws
 * (non-blocking, like the auth writer). Failures in the store or sink are
 * logged but never propagated to the caller.
 */
export function emitAudit(
  type: string,
  actor: string,
  detail: Record<string, unknown> = {},
  opts: { tenant?: string; workflow?: string; category?: string; decision?: "allow" | "deny" } = {},
): void {
  const canonical: CanonicalAuditEvent = {
    type,
    actor,
    at: new Date().toISOString(),
    action: type,
    meta: detail,
    ...(opts.tenant !== undefined ? { tenant: opts.tenant } : {}),
    ...(opts.workflow !== undefined ? { workflow: opts.workflow } : {}),
    ...(opts.category !== undefined ? { category: opts.category as CanonicalAuditEvent["category"] } : {}),
    ...(opts.decision !== undefined ? { decision: opts.decision } : {}),
  };
  try {
    defaultAuditStore.append(canonical);
  } catch (err) {
    console.error("audit store append failed:", err instanceof Error ? err.message : String(err));
  }
  if (SINK) {
    try {
      SINK({ type, actor, at: canonical.at, detail });
    } catch (err) {
      console.error("audit sink failed:", err instanceof Error ? err.message : String(err));
    }
  }
}

/** Adapt a canonical stored event to the public (detail-bearing) shape. */
function toPublic(e: CanonicalAuditEvent): AuditEvent {
  return {
    type: e.type,
    actor: e.actor,
    at: e.at,
    detail: e.meta ?? {},
    meta: e.meta,
  };
}

/** Read the persisted buffer (for tests / introspection). */
export function readAuditBuffer(): readonly AuditEvent[] {
  return defaultAuditStore.query().map(toPublic);
}

/** Test helper. */
export function _clearAuditBuffer(): void {
  defaultAuditStore.clear();
}
