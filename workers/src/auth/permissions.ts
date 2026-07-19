// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Permission Resolver                    │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Resolves the EFFECTIVE permission set for a principal entirely from data.
//
//   effective(principal) = role_grants(role) ∪ user_grants − user_revokes
//
// Rules (per ADR-003):
//   • role_grants are read from role_permissions (NEVER a code constant).
//   • user_permissions rows layer individual grants/revokes on top.
//   • DENY WINS: a revoke overrides any grant from any source.
//   • OWNER is an implicit superuser: it short-circuits to "all permissions"
//     and holds no role_permissions rows. We return a sentinel set containing
//     every permission key present in the database.
//
// Application code must NOT hardcode role→permission maps. The only exception
// to "read from DB" is the OWNER short-circuit, which is a deliberate, single,
// documented rule — not a per-role mapping.

import type { D1Database } from "@cloudflare/workers-types";

/** Sentinel role name that bypasses all permission checks. */
export const OWNER_ROLE_NAME = "OWNER";

/** Row shape from role_permissions join permissions. */
interface RolePermissionRow {
  permission_key: string;
}

/** Row shape from user_permissions. */
interface UserPermissionRow {
  permission_key: string;
  effect: "grant" | "revoke";
}

/**
 * Compute the effective permission set for a (role, user) pair.
 *
 * @param db D1 binding.
 * @param roleId the principal's role id.
 * @param userId the principal's user id (for user_permissions overrides).
 * @returns a Set of permission keys the principal effectively holds.
 */
export async function resolveEffectivePermissions(
  db: D1Database,
  roleId: string,
  userId: string,
): Promise<Set<string>> {
  // ── 0. OWNER short-circuit ─────────────────────────────────
  const roleName = await getRoleName(db, roleId);
  if (roleName === OWNER_ROLE_NAME) {
    // Superuser: holds every permission that exists in the platform.
    return await allPermissionKeys(db);
  }

  // ── 1. Role grants from role_permissions (data-driven) ─────
  const roleStmt = db
    .prepare(
      `SELECT p.key AS permission_key
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ?1`,
    )
    .bind(roleId);
  const roleRows = await roleStmt.all<RolePermissionRow>();
  const effective = new Set<string>(
    (roleRows.results ?? []).map((r) => r.permission_key),
  );

  // ── 2. User overrides (grant adds, revoke removes) ────────
  const userStmt = db
    .prepare(
      `SELECT p.key AS permission_key, up.effect AS effect
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = ?1`,
    )
    .bind(userId);
  const userRows = await userStmt.all<UserPermissionRow>();

  for (const row of userRows.results ?? []) {
    if (row.effect === "revoke") {
      effective.delete(row.permission_key); // deny wins
    } else {
      effective.add(row.permission_key);
    }
  }

  return effective;
}

/**
 * Fast boolean check used by the Authorization Middleware:
 * does the principal (role + user) effectively hold `permission`?
 *
 * Honors the full data-driven rule including user overrides: a user-level
 * `revoke` must win even when the role grants the permission (deny wins).
 */
export async function hasPermission(
  db: D1Database,
  roleId: string,
  userId: string,
  permission: string,
): Promise<boolean> {
  const roleName = await getRoleName(db, roleId);
  if (roleName === OWNER_ROLE_NAME) return true; // superuser short-circuit

  // Check role grant directly (single row lookup via unique index).
  const rpStmt = db
    .prepare(
      `SELECT 1 AS hit
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role_id = ?1 AND p.key = ?2
        LIMIT 1`,
    )
    .bind(roleId, permission);
  const roleHit = await rpStmt.first<{ hit: number }>();

  // Check user overrides (grant before revoke — deny wins).
  const upStmt = db
    .prepare(
      `SELECT p.key AS permission_key, up.effect AS effect
         FROM user_permissions up
         JOIN permissions p ON p.id = up.permission_id
        WHERE up.user_id = ?1 AND p.key = ?2`,
    )
    .bind(userId, permission);
  const upRows = await upStmt.all<UserPermissionRow>();

  let override: boolean | null = null;
  for (const row of upRows.results ?? []) {
    // Later rows override earlier; revoke always wins if present.
    override = row.effect === "revoke" ? false : true;
  }

  if (override !== null) {
    // A user override (grant OR revoke) takes precedence over the role grant.
    return override;
  }

  return roleHit ? true : false;
}

// ── Helpers ──────────────────────────────────────────────────

async function getRoleName(db: D1Database, roleId: string): Promise<string | null> {
  const stmt = db
    .prepare(`SELECT name FROM roles WHERE id = ?1 LIMIT 1`)
    .bind(roleId);
  const row = await stmt.first<{ name: string }>();
  return row ? row.name : null;
}

async function allPermissionKeys(db: D1Database): Promise<Set<string>> {
  const stmt = db.prepare(`SELECT key FROM permissions`);
  const rows = await stmt.all<{ key: string }>();
  return new Set((rows.results ?? []).map((r) => r.key));
}
