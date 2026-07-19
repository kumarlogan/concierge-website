# ADR-003: Permission Resolution Strategy

**Status:** Accepted
**Date:** 2026-07-18

---

## Context

The RBAC foundation (EPIC-002-001, migration `0002`) defined roles, permissions,
and users, but left the role→permission mapping as an *implicit* agreement
between the design document and the (future) authorization middleware. The
mapping was described in prose in `RBAC_DESIGN.md` §4.3 and intended to live as a
code constant inside the middleware.

This created a structural risk: authorization logic — arguably the most
security-critical part of the platform — would be split across two sources of
truth (documentation prose + application code). Any drift between them (a
permission renamed in the DB but not in code, or a role's grants changed in one
place but not the other) would silently produce incorrect authorization
decisions. It also meant changing a role's capabilities required a code deploy,
not a data change.

A cleaner model treats permissions as **data**: the complete role→permission
mapping is stored in the database and resolved at request time by middleware.

---

## Decision

1. **Role→permission mappings are stored as data** in a new `role_permissions`
   table (migration `0003_role_permissions.sql`). Each row grants one
   permission to one role. This is the single source of truth for default
   role grants.
2. **Middleware resolves effective permissions dynamically** from the database:
   `role_permissions` (role grants) ∪ `user_permissions` grants −
   `user_permissions` revokes (deny wins). OWNER is the sole exception — it is
   short-circuited to allow all permissions, so it intentionally holds no
   `role_permissions` rows.
3. **Application code must not hardcode role-to-permission mappings.** No
   `const ROLE_PERMISSIONS = { ADMIN: [...] }` constant, no switch statement,
   no inline mapping. To change what a role can do, insert/delete
   `role_permissions` rows — do not edit code.
4. **Roles are configuration, not code.** `roles` and `permissions` are seeded
   reference data; their vocabulary and mappings evolve through migrations and
   administrative data changes, not through application logic.

This decision is consistent with and builds upon ADR-002 (all interfaces reach
D1 only via the Worker API, behind a shared Authorization Middleware).

---

## Reasons

| Factor | Detail |
|---|---|
| Single source of truth | One place (the `role_permissions` table) defines role grants. No doc↔code drift. |
| Change without deploy | Adjusting a role's access is a data write, not a code merge + deploy + migration cycle. |
| Auditability | Role grants are queryable and joinable like any other data; changes can be logged to `audit_logs`. |
| Testability | Middleware can be tested against real DB rows; behavior changes with seed data, not magic constants. |
| Least privilege by data | New roles/permissions can be introduced via migration without touching enforcement code. |

---

## Consequences

### Positive
- **No implicit mappings.** Every role grant is a visible, queryable row.
- **Faster policy iteration.** Permission changes ship as data, not code.
- **Cleaner middleware.** The middleware becomes a pure resolver (read rows → compute effective set), free of embedded policy tables.
- **Extensible.** Custom roles added later participate in the same resolution path automatically.

### Negative
- **One extra query per authorization resolution.** The middleware must read
  `role_permissions` (and `user_permissions`) for the principal's role. Mitigated
  by indexes (`idx_role_permissions_role_id`, `idx_role_permissions_role_perm`)
  and by caching the resolved set per request / short TTL in the Worker.
- **Data must be protected.** Because permissions are now data, the
  `roles.manage` / `permissions` administration surface (when built) becomes
  high-privilege and must itself be behind the same middleware.
- **Seed must stay consistent.** The seeded mappings in `0003` are the deployed
  default; any future change should be a new forward migration, not an edit to
  the seed (consistent with the ADR-governed migration policy, AD-8).

---

## Implementation Notes

- Table: `role_permissions(id TEXT PK, role_id FK→roles, permission_id FK→permissions, created_at)`, with `UNIQUE(role_id, permission_id)`.
- Seed (migration `0003`): ADMIN×6, OPERATIONS×4, VIEWER×2; OWNER implicit (no rows).
- Resolution rule implemented by middleware (EPIC-002-002):
  `effective = roleGrants(role) ∪ userGrants − userRevokes`, where
  `roleGrants(role)` is read from `role_permissions`.

---

## Related Decisions
- **ADR-001** — Cloudflare-only backend (Workers + D1). Permissions-as-data fits D1's relational model.
- **ADR-002** — Multi-Agent Operations Architecture. All interfaces authorize via the Worker middleware, which now resolves permissions from `role_permissions`.

## Supersedes
*None.*
