// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Audit Emission (boundary seam)              │
// │ EPIC-003-006 M3 · emits append-only audit events through the  │
// │ AuditStore persistence boundary (defaultAuditStore). An        │
// │ optional sink (e.g. D1-backed writer) can still be attached.   │
// └─────────────────────────────────────────────────────────────┘

import type { AuditEvent as CanonicalAuditEvent } from "../../shared/interfaces/audit.js";
import { defaultAuditStore } from "./store.js";
import {
  emitAudit as _emitAudit,
  setAuditSink as _setAuditSink,
  registerAuditStore,
  type AuditEvent,
} from "./emitter.js";

// Wire the real store into the emitter so production emission persists.
registerAuditStore({
  append: (e) => {
    const canonical: CanonicalAuditEvent = {
      type: e.type,
      actor: e.actor,
      at: e.at,
      action: e.action,
      meta: e.meta,
      ...(e.tenant !== undefined ? { tenant: e.tenant } : {}),
      ...(e.workflow !== undefined ? { workflow: e.workflow } : {}),
      ...(e.category !== undefined ? { category: e.category as CanonicalAuditEvent["category"] } : {}),
      ...(e.decision !== undefined ? { decision: e.decision } : {}),
    };
    defaultAuditStore.append(canonical);
  },
});

/** Public audit event shape (legacy-compatible; carries `detail`). */
export type { AuditEvent };

/** Attach a durable sink (e.g. D1-backed writer). Optional. */
export const setAuditSink = _setAuditSink;

/** Emit an audit event through the persistence boundary. Never throws. */
export const emitAudit = _emitAudit;

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
