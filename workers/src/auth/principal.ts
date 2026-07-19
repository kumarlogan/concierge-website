// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Principal Builder                      │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Turns a resolved identity (IdentityResolution) into a fully-formed
// Principal: the canonical caller object every downstream business service
// receives.
//
// The Principal Builder:
//   1. Looks up the users row by provider_identifier (external_id).
//   2. Confirms the principal is active.
//   3. Resolves the role name.
//   4. Delegates effective-permission computation to the PermissionResolver
//      (data-driven; never hardcoded — see ADR-003).
//
// Business services receive ONLY the Principal. They never inspect the raw
// request and never read a provider-specific identifier.

import type { D1Database } from "@cloudflare/workers-types";
import type { IdentityResolution, Principal } from "./types.js";
import { AuthError } from "./types.js";
import { resolveEffectivePermissions } from "./permissions.js";

/** Shape of a users row as needed by the builder. */
interface UserRow {
  id: string;
  role_id: string;
  external_id: string;
  is_active: number;
  display_name: string | null;
}

/** Shape of a roles row. */
interface RoleRow {
  id: string;
  name: string;
}

/**
 * Build a Principal from a resolved identity.
 *
 * @param db D1 binding.
 * @param identity the resolution produced by an IdentityResolver.
 * @returns a fully-populated Principal with effective permissions.
 * @throws AuthError if the identity has no corresponding active user, or the
 *         role cannot be resolved.
 */
export async function buildPrincipal(
  db: D1Database,
  identity: IdentityResolution,
): Promise<Principal> {
  const userStmt = db
    .prepare(
      `SELECT id, role_id, external_id, is_active, display_name
         FROM users
        WHERE external_id = ?1
        LIMIT 1`,
    )
    .bind(identity.providerIdentifier);
  const user = await userStmt.first<UserRow>();

  if (!user) {
    throw new AuthError(
      `No active principal for provider identifier "${identity.providerIdentifier}"`,
      401,
    );
  }

  if (user.is_active !== 1) {
    throw new AuthError("Principal is disabled", 403);
  }

  const roleStmt = db
    .prepare(`SELECT id, name FROM roles WHERE id = ?1 LIMIT 1`)
    .bind(user.role_id);
  const role = await roleStmt.first<RoleRow>();

  if (!role) {
    throw new AuthError(
      `Principal "${user.id}" has an unresolvable role "${user.role_id}"`,
      500,
    );
  }

  const permissions = await resolveEffectivePermissions(db, user.role_id, user.id);

  return {
    userId: user.id,
    roleId: role.id,
    roleName: role.name,
    permissions,
    provider: identity.provider,
    providerIdentifier: identity.providerIdentifier,
    metadata: {
      ...(identity.metadata ?? {}),
      displayName: user.display_name,
    },
  };
}
