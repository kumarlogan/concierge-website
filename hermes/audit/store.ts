// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — In-Memory Audit Store                        │
// │ EPIC-003-006 M3 implementation of AuditStore.                  │
// │ Default persistence boundary: append-only, in-process, and     │
// │ swappable for a D1-backed store behind the same interface.      │
// │ EPIC-004 PHASE 4: tenant enforcement added (queryScoped).      │
// └─────────────────────────────────────────────────────────────┘

import type { AuditEvent, AuditQuery, AuditStore } from "../../shared/interfaces/audit.js";
import { enforceTenant } from "../persistence/tenant.js";
import type { Principal } from "../contracts/platform-api.js";
import { createProductionAuditStore, type FileBackendDeps } from "./store.durable.js";

/**
 * EPIC-005.9 (P2): production wiring (env-gated, deferred init).
 *
 * The default store is in-memory (dev/test). Production calls
 * `configureFileAuditStore(path, fs)` once at startup to swap the active
 * store to a restart-safe FileAuditBackend. The function is only CALLED at
 * runtime (never at module load), so there is no circular-init hazard with
 * `store.durable.js`. Existing tests that import `defaultAuditStore` keep
 * the in-memory behavior.
 *
 * The instance is created lazily (first access) so the `MemoryAuditStore`
 * class below is fully declared before it is instantiated — avoiding a
 * "used before declaration" error.
 */
let activeAuditStore: AuditStore | null = null;

function getStore(): AuditStore {
  if (activeAuditStore === null) activeAuditStore = new MemoryAuditStore();
  return activeAuditStore;
}

/** Swap the active persistence boundary (called once in production startup). */
export function configureFileAuditStore(filePath: string, fs: FileBackendDeps): void {
  activeAuditStore = createProductionAuditStore({ filePath, fs });
}

/** Process-wide default store (the active persistence boundary). */
export const defaultAuditStore: AuditStore = new Proxy({} as AuditStore, {
  get(_t, prop) {
    return (getStore() as unknown as Record<string | symbol, unknown>)[prop];
  },
}) as unknown as AuditStore;

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
    if (filter.tenant) out = out.filter((e) => e.tenant === filter.tenant);
    if (filter.workflow) out = out.filter((e) => e.workflow === filter.workflow);
    if (filter.since) out = out.filter((e) => e.at >= filter.since!);
    if (filter.until) out = out.filter((e) => e.at <= filter.until!);
    if (typeof filter.limit === "number" && filter.limit >= 0) {
      out = out.slice(-filter.limit);
    }
    // Return copies so callers cannot mutate stored records.
    return out.map((e) => ({ ...e }));
  }

  /**
   * EPIC-004 PHASE 4: tenant-scoped read. Enforces the principal may read the
   * tenant named in the filter (cross-tenant / unbound => DENY, fail-closed).
   * Defense-in-depth: never returns events outside the principal's tenant.
   */
  queryScoped(filter: AuditQuery, principal: Principal): AuditEvent[] {
    if (filter.tenant) enforceTenant(principal, filter.tenant);
    const results = this.query(filter);
    if (!principal.organizationId) return [];
    return results.filter((e) => !e.tenant || e.tenant === principal.organizationId);
  }

  clear(): void {
    this.events.length = 0;
    this.seq = 0;
  }
}

/** Re-export the canonical type for convenience. */
export type { AuditEvent, AuditQuery, AuditStore } from "../../shared/interfaces/audit.js";
