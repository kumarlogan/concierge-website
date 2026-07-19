// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Events & Audit                      │
// │ EPIC-002-006D · PHASE 6                                        │
// │ Canonical workforce event model. Every event is timestamped,    │
// │ identity-recorded, and auditable. Built on top of the           │
// │ provider-neutral audit buffer (hermes/audit/event.ts).          │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit, readAuditBuffer, _clearAuditBuffer, type AuditEvent } from "../audit/event.js";

/** Canonical workforce event types (catalog). */
export const WORKFORCE_EVENTS = {
  // Agent lifecycle
  AGENT_REGISTERED: "agent.registered",
  AGENT_ASSIGNED: "agent.assigned",
  AGENT_APPROVAL_REQUESTED: "agent.approval.requested",
  AGENT_APPROVED: "agent.approved",
  AGENT_ACTIVATED: "agent.activated",
  AGENT_PAUSED: "agent.paused",
  AGENT_RETIRED: "agent.retired",
  // Task lifecycle
  TASK_CREATED: "task.created",
  TASK_ASSIGNED: "task.assigned",
  TASK_APPROVED: "task.approved",
  TASK_RUNNING: "task.running",
  TASK_COMPLETED: "task.completed",
  TASK_FAILED: "task.failed",
  TASK_CANCELLED: "task.cancelled",
  // Authorization
  AGENT_AUTHZ_ALLOW: "agent.authz.allow",
  AGENT_AUTHZ_DENY: "agent.authz.deny",
  MEMORY_DENIED: "memory.denied",
} as const;

export type WorkforceEventType = (typeof WORKFORCE_EVENTS)[keyof typeof WORKFORCE_EVENTS];

/**
 * Emit a typed workforce event. Thin wrapper over emitAudit that guarantees
 * the event type is from the canonical catalog and the actor identity is
 * recorded. Never throws.
 */
export function emitWorkforceEvent(
  type: WorkforceEventType,
  actor: string,
  detail: Record<string, unknown> = {},
): void {
  emitAudit(type, actor, detail);
}

/** Read the full audit trail (for the admin console / validation). */
export function readWorkforceAudit(): readonly AuditEvent[] {
  return readAuditBuffer();
}

/** Filter the audit trail by event type. */
export function readWorkforceAuditByType(type: WorkforceEventType): readonly AuditEvent[] {
  return readAuditBuffer().filter((e) => e.type === type);
}

/** Filter the audit trail by actor. */
export function readWorkforceAuditByActor(actor: string): readonly AuditEvent[] {
  return readAuditBuffer().filter((e) => e.actor === actor);
}

/** Test/reset helper. */
export function _clearWorkforceAudit(): void {
  _clearAuditBuffer();
}
