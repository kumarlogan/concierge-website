// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider-neutral Audit Event                │
// │ EPIC-002-006C · PHASE 1                                        │
// │ Decouples services from the D1-backed auth audit writer.       │
// │ Emits append-only audit events to an in-memory buffer; an      │
// │ optional sink (e.g. D1 via shared/interfaces) can be attached. │
// └─────────────────────────────────────────────────────────────┘

export interface AuditEvent {
  /** Event type, e.g. "registry.register", "agent.activated". */
  type: string;
  /** Actor principal id (from Hermes Identity). */
  actor: string;
  /** RFC3339 timestamp. */
  at: string;
  /** Arbitrary structured detail. */
  detail: Record<string, unknown>;
}

type AuditSink = (event: AuditEvent) => void;

const BUFFER: AuditEvent[] = [];
let SINK: AuditSink | null = null;

/** Attach a durable sink (e.g. D1-backed writer). Optional. */
export function setAuditSink(sink: AuditSink | null): void {
  SINK = sink;
}

/** Emit an audit event. Never throws (non-blocking, like the auth writer). */
export function emitAudit(type: string, actor: string, detail: Record<string, unknown> = {}): void {
  const event: AuditEvent = { type, actor, at: new Date().toISOString(), detail };
  BUFFER.push(event);
  if (SINK) {
    try {
      SINK(event);
    } catch (err) {
      console.error("audit sink failed:", err instanceof Error ? err.message : String(err));
    }
  }
}

/** Read the in-memory buffer (for tests / introspection). */
export function readAuditBuffer(): readonly AuditEvent[] {
  return BUFFER;
}

/** Test helper. */
export function _clearAuditBuffer(): void {
  BUFFER.length = 0;
}
