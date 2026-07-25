// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Audit Emitter (lightweight seam)             │
// │                                                           │
// │ Holds the audit *sink* and an *injectable store*. This module  │
// │ has NO heavy transitive imports (no store implementation, no   │
// │ admin/access, no platform contracts) so it is safe to load in  │
// │ any environment — tests, edge workers, or the platform core.   │
// │                                                           │
// │ `event.ts` registers the real in-memory store at load time;    │
// │ tests may register their own sink via `setAuditSink`.          │
// └─────────────────────────────────────────────────────────────┘

/** Minimal append-only store contract the emitter knows about. */
export interface AuditAppendStore {
  append(event: { type: string; actor: string; at: string; action: string; meta: Record<string, unknown>; tenant?: string; workflow?: string; category?: string; decision?: "allow" | "deny" }): void;
}

/** A single emitted audit event (legacy-compatible; carries `detail`). */
export interface AuditEvent {
  type: string;
  actor: string;
  at: string;
  detail: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

type AuditSink = (event: AuditEvent) => void;

let SINK: AuditSink | null = null;
let STORE: AuditAppendStore | null = null;

/** Attach a durable sink (e.g. D1-backed writer or test capture). Optional. */
export function setAuditSink(sink: AuditSink | null): void {
  SINK = sink;
}

/** Register the active append-only store (called by event.ts at load). */
export function registerAuditStore(store: AuditAppendStore): void {
  STORE = store;
}

/**
 * Emit an audit event through the registered store and any attached sink.
 * Never throws (non-blocking): failures in the store or sink are logged but
 * never propagated to the caller — audit emission must not break the action
 * it is observing.
 */
export function emitAudit(
  type: string,
  actor: string,
  detail: Record<string, unknown> = {},
  opts: { tenant?: string; workflow?: string; category?: string; decision?: "allow" | "deny" } = {},
): void {
  const at = new Date().toISOString();
  if (STORE) {
    try {
      STORE.append({
        type,
        actor,
        at,
        action: type,
        meta: detail,
        ...(opts.tenant !== undefined ? { tenant: opts.tenant } : {}),
        ...(opts.workflow !== undefined ? { workflow: opts.workflow } : {}),
        ...(opts.category !== undefined ? { category: opts.category } : {}),
        ...(opts.decision !== undefined ? { decision: opts.decision } : {}),
      });
    } catch (err) {
      console.error("audit store append failed:", err instanceof Error ? err.message : String(err));
    }
  }
  if (SINK) {
    try {
      SINK({ type, actor, at, detail });
    } catch (err) {
      console.error("audit sink failed:", err instanceof Error ? err.message : String(err));
    }
  }
}
