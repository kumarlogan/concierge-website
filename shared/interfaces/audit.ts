export type AuditEventType =
  | "authorization.decision"
  | "authorization.denied"
  | "data.access"
  | "data.mutation"
  | "agent.action"
  | string;

export interface AuditEvent {
  type: AuditEventType;
  principalId?: string;
  action: string;
  resource?: string;
  decision?: "allow" | "deny";
  meta?: Record<string, unknown>;
  timestamp?: string;
}

export interface AuditProvider {
  /**
   * Persist an audit event. MUST be non-blocking / best-effort — audit
   * failures MUST NOT break the caller's request (the existing
   * "log, don't leak" posture is preserved).
   */
  write(event: AuditEvent): Promise<void>;
}
