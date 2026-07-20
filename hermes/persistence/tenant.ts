// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Persistence Tenant Enforcement               │
// │ EPIC-004 PHASE 4 · shared tenant boundary for all stores.     │
// │ Uses the existing `withinTenantScope` insertion point from     │
// │ hermes/admin/access.ts — never re-implements tenant logic.     │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { withinTenantScope } from "../admin/access.js";

export interface TenantBound {
  /** Owning tenant/organization id. */
  tenantId: string;
}

/**
 * Enforce that `principal` may access a resource owned by `tenantId`.
 *
 * Rules (from withinTenantScope, centralized here so every store calls the
 * SAME gate — no ad-hoc per-store tenant logic):
 *   - Cross-tenant  -> DENY (hard wall)
 *   - Unbound principal (no organizationId) for a tenant-protected resource
 *     -> DENY
 *   - Scope mismatch -> DENY
 *
 * Throws on any violation (fail-closed). Callers MUST invoke this before
 * reading or writing tenant-scoped state.
 */
export function enforceTenant(principal: Principal, tenantId: string): void {
  const ok = withinTenantScope(
    principal,
    { organizationId: tenantId },
    { requireScope: true },
  );
  if (!ok) {
    throw new TenantViolationError(
      `Principal ${principal.id} denied access to tenant ${tenantId}`,
    );
  }
}

/** Thrown when a cross-tenant or unbound access is attempted. */
export class TenantViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TenantViolationError";
  }
}
