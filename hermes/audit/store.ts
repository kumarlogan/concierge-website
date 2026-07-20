// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — In-Memory Audit Store                        │
// │ EPIC-003-006 M3 implementation of AuditStore.                  │
// │ Default persistence boundary: append-only, in-process, and     │
// │ swappable for a D1-backed store behind the same interface.      │
// └─────────────────────────────────────────────────────────────┘

import type { AuditEvent, AuditQuery, AuditStore } from "../../shared/interfaces/audit.js";

/** Append-only in-memory store. Safe for workers edge (single isolate). */
export class MemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];
  private seq = 0;

  append(event: AuditEvent): void {
    const id = event.id ?? `audit_${Date.now().toString(36)}_${(this.seq++).toString(36)}`;
    const at = event.at ?? new Date().toISOString();
    // Copy to avoid later mutation of the caller's object leaking in.
    this.events.push({ ...event, id, at });
  }

  query(filter: AuditQuery = {}): AuditEvent[] {
    let out = this.events;
    if (filter.type) out = out.filter((e) => e.type === filter.type);
    if (filter.category) out = out.filter((e) => e.category === filter.category);
    if (filter.actor) out = out.filter((e) => e.actor === filter.actor);
    if (filter.resource) out = out.filter((e) => e.resource === filter.resource);
    if (filter.decision) out = out.filter((e) => e.decision === filter.decision);
    if (filter.since) out = out.filter((e) => e.at >= filter.since!);
    if (filter.until) out = out.filter((e) => e.at <= filter.until!);
    if (typeof filter.limit === "number" && filter.limit >= 0) {
      out = out.slice(-filter.limit);
    }
    // Return copies so callers cannot mutate stored records.
    return out.map((e) => ({ ...e }));
  }

  clear(): void {
    this.events.length = 0;
    this.seq = 0;
  }
}

/** Process-wide default store (the active persistence boundary). */
export const defaultAuditStore: AuditStore = new MemoryAuditStore();

/** Re-export the canonical type for convenience. */
export type { AuditEvent, AuditQuery, AuditStore } from "../../shared/interfaces/audit.js";
