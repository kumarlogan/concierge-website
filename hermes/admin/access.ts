// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin Platform: Permission-Aware Access   │
// │ EPIC-002-006E · PHASE 1                                        │
// │ Defines the authorization model for the Admin Console.        │
// │ The console is INTERNAL-ONLY and permission-gated: every      │
// │ operation requires an authenticated human principal with the  │
// │ correct scoped permission. This module is the gate — it is    │
// │ called by the admin facade BEFORE any mutating operation.      │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { emitAudit } from "../audit/event.js";

/**
 * Admin console roles. Each maps to a set of console-scoped permissions.
 * Roles are derived from the human principal's permission set — they are NOT
 * stored here; the platform permission service remains the single source of
 * truth for authorization.
 */
export type AdminRole = "owner" | "platform-admin" | "auditor" | "operator" | "viewer";

/** Console-scoped permission catalog (distinct from agent/human app perms). */
export const ADMIN_PERMISSIONS = [
  "hermes:admin:read", // view any dashboard domain
  "hermes:admin:workforce-write", // approve/pause/retire/enable agents
  "hermes:admin:task-write", // create/assign/approve controlled tasks
  "hermes:admin:resource-write", // register/update resources
  "hermes:admin:audit-read", // read the unified audit trail
  "hermes:admin:role-grant", // grant/revoke admin roles (owner only)
] as const;

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number];

/** Minimum permission required to read each dashboard domain. */
export const DOMAIN_READ_PERMISSION: Record<string, AdminPermission> = {
  organization: "hermes:admin:read",
  infrastructure: "hermes:admin:read",
  workforce: "hermes:admin:read",
  operations: "hermes:admin:read",
  security: "hermes:admin:read",
  governance: "hermes:admin:read",
};

/** Validate that a principal is a human (not an agent) before any admin call. */
export function assertHumanPrincipal(principal: Principal): void {
  if (principal.id.startsWith("agent:") || principal.id.startsWith("principal:agent")) {
    emitAudit("admin.access.denied", principal.id, { reason: "agent principal forbidden" });
    throw new Error("Admin Console requires a HUMAN principal; agent principals are forbidden");
  }
}

/** Check a single admin permission on a human principal. */
export function adminHasPermission(principal: Principal, perm: AdminPermission): boolean {
  return principal.permissions.includes(perm);
}

/** Require a single admin permission or throw (used as a guard). */
export function requireAdminPermission(principal: Principal, perm: AdminPermission): void {
  assertHumanPrincipal(principal);
  if (!adminHasPermission(principal, perm)) {
    emitAudit("admin.access.denied", principal.id, { reason: "missing permission", permission: perm });
    throw new Error(`Admin action requires ${perm}`);
  }
  emitAudit("admin.access.granted", principal.id, { permission: perm });
}

/** Require permission to read a dashboard domain. */
export function requireDomainRead(principal: Principal, domain: keyof typeof DOMAIN_READ_PERMISSION): void {
  requireAdminPermission(principal, DOMAIN_READ_PERMISSION[domain]);
}

/**
 * Derive the effective admin role from a human principal's permission set.
 * Owner is implicitly granted by holding `hermes:admin:role-grant`.
 * This is a VIEW of permissions, never an authority grant.
 */
export function deriveAdminRole(principal: Principal): AdminRole {
  if (principal.permissions.includes("hermes:admin:role-grant")) return "owner";
  if (
    principal.permissions.includes("hermes:admin:workforce-write") ||
    principal.permissions.includes("hermes:admin:resource-write")
  )
    return "platform-admin";
  if (principal.permissions.includes("hermes:admin:task-write")) return "operator";
  if (principal.permissions.includes("hermes:admin:audit-read")) return "auditor";
  if (principal.permissions.includes("hermes:admin:read")) return "viewer";
  throw new Error(`Principal ${principal.id} holds no admin permission; cannot derive role`);
}

/**
 * Visibility scope: which applications a principal may see in the console.
 * Owners/admins see all; scoped operators may be limited. Default: all.
 * (Hook for future per-application scoping — currently returns "all".)
 */
export function visibleApplications(principal: Principal): string[] | "all" {
  deriveAdminRole(principal); // throws if no admin authority
  return "all";
}

 /**
  * Tenant / organization boundary check (EPIC-003-006 M4 insertion point).
  *
  * Returns true when `principal` is authorized to act on a resource owned by
  * `targetOrg` (and optionally `targetTenant`). The boundary is enforced here,
  * in one place, rather than ad-hoc per caller.
  *
  * Rules:
  *  - A principal without an `organizationId` is treated as unbound → deny for
  *    any tenant-protected resource (callers pass `requireScope: true` to force
  *    the check; pass `requireScope: false` when the resource is not
  *    tenant-protected and cross-tenant access is acceptable).
  *  - If the principal declares `scopes`, the target org/tenant MUST match at
  *    least one scope (scope = explicit grant).
  *  - If the principal has `organizationId` but no `scopes`, it may act within
  *    its own organization only.
  */
 export function withinTenantScope(
   principal: Principal,
   target: { organizationId: string; tenantId?: string },
   opts: { requireScope?: boolean } = {},
 ): boolean {
   const ownOrg = principal.organizationId;
   // Unbound principal: deny unless tenant protection is not required.
   if (!ownOrg) return opts.requireScope === false;
   // Cross-organization is always denied (hard tenant wall).
   if (ownOrg !== target.organizationId) return false;
   // Tenant qualifier must match when both declare one.
   if (target.tenantId && principal.tenantId && target.tenantId !== principal.tenantId) {
     return false;
   }
   // Explicit scopes narrow the grant further.
   if (principal.scopes && principal.scopes.length > 0) {
     return principal.scopes.some(
       (s) =>
         s.organizationId === target.organizationId &&
         (!target.tenantId || !s.tenantId || s.tenantId === target.tenantId),
     );
   }
   return true;
 }
