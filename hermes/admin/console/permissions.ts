// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Permission-Aware Rendering              │
// │ EPIC-002-006F · PHASE 1                                        │
// │ Client-side visibility rules. The SPA uses these to decide      │
// │ which domains/panels a given PrincipalView may SEE. This is a   │
// │ UX gate only — the authoritative gate is server-side in         │
// │ hermes/admin/access.ts. Fail-closed: if a permission is missing │
// │ or unknown, the panel is HIDDEN (never shown by default).        │
// │                                                 BOUNDARY:      │
// │  • Imports ONLY types from ui-contracts.ts (no runtime service  │
// │    coupling). Uses no emitAudit, no platform services.          │
// └─────────────────────────────────────────────────────────────┘

import type { PrincipalView } from "../ui-contracts.js";
import type { DashboardDomainId } from "../ui-contracts.js";

/** Minimum console permission required to render each domain. */
const DOMAIN_REQUIRED_PERMISSION: Record<DashboardDomainId, string> = {
  organization: "hermes:admin:read",
  infrastructure: "hermes:admin:read",
  workforce: "hermes:admin:read",
  security: "hermes:admin:audit-read",
  operations: "hermes:admin:read",
  governance: "hermes:admin:read",
};

/**
 * Fail-closed check: a domain is visible ONLY if the principal holds the
 * required permission. Anything missing or ambiguous => false.
 */
export function canRenderDomain(
  principal: PrincipalView,
  domain: DashboardDomainId,
): boolean {
  const required = DOMAIN_REQUIRED_PERMISSION[domain];
  if (!required) return false;
  return principal.permissions.includes(required);
}

/**
 * Fail-closed panel check. A panel is rendered only if its parent domain is
 * visible AND the principal holds every permission the panel declares.
 */
export function canRenderPanel(
  principal: PrincipalView,
  domain: DashboardDomainId,
  requiredPermissions: string[] = [],
): boolean {
  if (!canRenderDomain(principal, domain)) return false;
  return requiredPermissions.every((p) => principal.permissions.includes(p));
}

/** Human-readable reason a domain/panel is hidden (for audit/UX logging). */
export function denialReason(
  principal: PrincipalView,
  domain: DashboardDomainId,
): string | null {
  const required = DOMAIN_REQUIRED_PERMISSION[domain];
  if (!principal.permissions.includes(required)) {
    return `missing ${required}`;
  }
  return null;
}
