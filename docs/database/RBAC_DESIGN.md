# RBAC Security & Authorization Design

> **Document Version:** 1.2
> **Created:** 2026-07-18
> **Updated:** 2026-07-18 (EPIC-002-002 — authorization engine implemented)
> **Phase:** 2 — Operations Platform Foundation (EPIC-002)
> **Database:** Cloudflare D1 (`agsynergy-db`)
> **Binding:** `DB` in Worker environment
> **Migration:** `workers/migrations/0002_rbac_foundation.sql` + `0003_role_permissions.sql`

---

## 1. Purpose

This document describes the **database foundation** for Role-Based Access
Control (RBAC) on the AG Synergy Operations Platform. It defines the tables,
relationships, seed data, and the security model that future interfaces
(Hermes Admin, Operations Bot, dashboard, mobile) will rely on.

**This is a storage-only milestone.** No authentication, no authorization
middleware, and no agent/bot code is implemented here. The tables and seed
rows exist so that the authorization middleware (a future EPIC-002 task) and
the interface layer can be built on a stable, already-migrated schema.

### Scope Boundary (per EPIC-002-001)

✅ **In scope**
- 5 RBAC tables (`roles`, `permissions`, `users`, `user_permissions`, `audit_logs`)
- **`role_permissions` — the role→permission group-grant mapping, stored as data (0003)**
- Primary keys, timestamps, indexes, relationships
- Seed roles (OWNER, ADMIN, OPERATIONS, VIEWER)
- Seed permissions (8 operations capabilities)
- Seed role→permission mappings (ADMIN×6, OPERATIONS×4, VIEWER×2; OWNER implicit)
- This design document

❌ **Out of scope (explicitly NOT done here)**
- Authentication flows (login, tokens, MFA) — a future phase
- Authorization middleware (enforcement) — a future EPIC-002 task
- Telegram bots (Hermes Admin, Operations Bot)
- Dashboard / mobile UI
- Any PHI, medical, or clinical data
- Direct AI-agent access to D1

### Architecture Rule (ADR-002)

All future interfaces communicate **only** through the Workers API. D1 remains
accessible **only** through Worker services. AI agents (Hermes, Operations Bot)
never touch D1 directly — they call the Worker, which enforces authorization
via middleware before any query runs.

---

## 2. Table Purpose

### 2.1 `roles`

Named access tiers. The coarse-grained unit of authorization.

| Aspect | Detail |
|---|---|
| **Purpose** | Define trust tiers for platform principals |
| **Key fields** | `name` (UNIQUE), `description`, `is_system` |
| **Seed rows** | OWNER, ADMIN, OPERATIONS, VIEWER |
| **Lifecycle** | System roles (`is_system = 1`) are non-deletable; custom roles may be added later |

### 2.2 `permissions`

Fine-grained, dot-namespaced capabilities.

| Aspect | Detail |
|---|---|
| **Purpose** | Enumerate every capability the platform can authorize |
| **Key fields** | `key` (UNIQUE, e.g. `leads.read`), `resource`, `action` |
| **Seed rows** | 8 (see §4) |
| **Format** | `resource.action` — machine-checkable and human-readable |

### 2.3 `users`

Human or agent principals. **Storage foundation only — no auth columns.**

| Aspect | Detail |
|---|---|
| **Purpose** | Represent an authorized principal (person or bot identity) |
| **Key fields** | `role_id` (FK), `external_id` (soft ref to identity provider), `display_name`, `is_active` |
| **Relationships** | Belongs to exactly one `role`; has many `user_permissions` |
| **Auth note** | No password/token/MFA columns yet — those arrive with the auth implementation |

### 2.4 `user_permissions`

Per-user permission overrides — the row-level refinement layer.

| Aspect | Detail |
|---|---|
| **Purpose** | Grant extra capabilities or revoke role-granted ones, per user |
| **Key fields** | `user_id`, `permission_id`, `effect` (`grant`/`revoke`), `granted_by` |
| **Relationships** | FK → `users`, FK → `permissions`, FK → `users` (granted_by) |
| **Deny wins** | A `revoke` row overrides any `grant` from the role mapping |

### 2.5 `audit_logs`

Append-only record of security-relevant and mutating actions.

| Aspect | Detail |
|---|---|
| **Purpose** | Compliance, forensics, and accountability for every sensitive action |
| **Key fields** | `actor_id` (soft ref), `action`, `target_type`, `target_id`, `ip_address`, `user_agent`, `metadata` |
| **Lifecycle** | Append-only in practice — middleware INSERTs only; no UPDATE/DELETE path |
| **Integrity** | `actor_id` is a **soft link** (no FK) so the trail survives user deletion |

### 2.6 `role_permissions` *(added in 0003 — EPIC-002-001.5)*

The **canonical group-grant layer** of RBAC. Each row grants one permission to
one role. This is the single source of truth for "what does role X get by
default" — and it lives in the **database, not in application code**.

| Aspect | Detail |
|---|---|
| **Purpose** | Store role→permission mappings as queryable data (not hardcoded constants) |
| **Key fields** | `role_id` (FK → `roles`), `permission_id` (FK → `permissions`), `created_at` |
| **Uniqueness** | `(role_id, permission_id)` UNIQUE — a role holds a given permission at most once |
| **Seed rows** | 12: ADMIN×6, OPERATIONS×4, VIEWER×2 |
| **OWNER** | Special-cased in middleware (allowed everything) — intentionally has **no** rows here |
| **Resolution** | Middleware reads this table dynamically; it must never replicate the mapping in code |

> **Rule (ADR-003):** Permissions are stored as data and resolved by middleware.
> Application code must not hardcode role-to-permission mappings. To change what
> a role can do, insert/delete `role_permissions` rows — do not edit code.

---

## 3. Relationships

```
┌──────────┐        ┌──────────────┐        ┌──────────────┐
│  roles   │◀───┐   │    users     │──▶┌────│ permissions  │
└────┬─────┘    │   └──────┬───────┘   │    └──────┬───────┘
     │ (FK)     │          │ (FK)      │ (FK)      │
     │          │          ▼           ▼           │
     │      ┌───┴──────────────────────┐───────────┘
     │      │     user_permissions     │
     │      └───────┬──────────────────┘
     │              │ (granted_by FK → users)
     │              │
     │   ┌──────────▼───────────┐
     └──▶│   role_permissions    │──▶ (FK → permissions.id)
     │   └───────────────────────┘
     │
     │   ┌──────────────┐
     └──▶│  audit_logs  │  (actor_id = soft link → users.id)
         └──────────────┘
```

**Key relationships**

| Relationship | Type | Notes |
|---|---|---|
| `users.role_id → roles.id` | Hard FK | Each user has exactly one role |
| `role_permissions.role_id → roles.id` | Hard FK | Group-grant layer (0003) |
| `role_permissions.permission_id → permissions.id` | Hard FK | Which capability the role gets |
| `role_permissions (role_id, permission_id)` | UNIQUE | A role holds a permission at most once |
| `user_permissions.user_id → users.id` | Hard FK | Per-user overrides |
| `user_permissions.permission_id → permissions.id` | Hard FK | Which capability |
| `user_permissions.granted_by → users.id` | Hard FK | Who set the override (nullable) |
| `audit_logs.actor_id → users.id` | **Soft link** (no FK) | Audit survives user deletion |

**Epic 1 tables are untouched.** `leads`, `contacts`, `consultations`,
`clinics`, `services`, `faqs` remain exactly as migration `0001` created them.
This migration is purely additive.

---

## 4. Seed Data

### 4.1 Roles

| name | description | is_system |
|---|---|---|
| `OWNER` | Full platform control — account owner. All permissions implicitly. | 1 |
| `ADMIN` | Administrative control short of owning the account. | 1 |
| `OPERATIONS` | Day-to-day lead and consultation management. | 1 |
| `VIEWER` | Read-only access for reporting and oversight. | 1 |

### 4.2 Permissions

| key | resource | action | description |
|---|---|---|---|
| `leads.read` | leads | read | View lead records and lists |
| `leads.update` | leads | update | Edit lead records (status, notes, assignment) |
| `leads.assign` | leads | assign | Assign leads to operations staff |
| `consultations.read` | consultations | read | View consultation records and schedules |
| `consultations.update` | consultations | update | Edit consultation records |
| `users.manage` | users | manage | Create, disable, and manage platform users |
| `roles.manage` | roles | manage | Create, modify, and assign roles and permissions |
| `audit.read` | audit | read | Read the audit log for compliance and forensics |

### 4.3 Default Role → Permission Mapping

The canonical role→permission mappings are now **stored as data** in the
`role_permissions` table (migration 0003). This table is the single source of
truth — the middleware reads it dynamically and must NOT hardcode the mapping
(see ADR-003). The values below are the seeded defaults and are shown for
reference only.

> effective_permissions(principal) =
>   role_grants(role) ∪ user_grants − user_revokes
>
> where `role_grants(role)` is resolved by reading `role_permissions`
> for the user's role.

| Role | Permissions (from `role_permissions`) |
|---|---|
| `OWNER` | **ALL** — middleware short-circuits OWNER to allow everything (no rows needed) |
| `ADMIN` | leads.read, leads.update, leads.assign, consultations.read, consultations.update, audit.read (6 rows) |
| `OPERATIONS` | leads.read, leads.update, consultations.read, consultations.update (4 rows) |
| `VIEWER` | leads.read, consultations.read (2 rows) |

`user_permissions` rows (grant/revoke) layer on top of this base for
individual exceptions.

---

## 5. Security Model

### 5.1 Principle of Least Privilege

Every action the platform takes on behalf of a principal is gated by a
permission check. The default role mapping grants the minimum capability each
role needs: VIEWER cannot write, OPERATIONS cannot manage users or roles,
only OWNER/ADMIN can touch users and roles.

### 5.2 Deny Wins

`user_permissions.effect = 'revoke'` always overrides a `grant` — whether the
grant comes from the role mapping or from a `grant` override. This lets an
admin narrow a user's access without changing their role.

### 5.3 Append-Only Audit

`audit_logs` is the accountability backstop. Every authorization decision
(allow/deny), sensitive read, and write is appended. Because `actor_id` is a
soft link, deleting a user never erases their historical actions.

### 5.4 Defense in Depth (Interfaces)

- **No direct D1 access.** Hermes, the Operations Bot, and any dashboard call
  the Worker API only. The Worker is the sole gatekeeper.
- **Authorization at the edge.** The future middleware runs inside the Worker,
  before any handler logic, so an unauthorized request never reaches a query.
- **Audit on every decision.** The middleware writes to `audit_logs` for both
  allowed and denied sensitive actions.

### 5.5 Data Classification

RBAC tables hold **only** operational identity and authorization metadata —
no PHI, no medical data, no payment data. `external_id` and `email` are
operational contact identifiers, not patient data.

---

## 6. Authorization Engine (Implemented — EPIC-002-002)

The authorization engine described below as "future" in earlier revisions is
**now implemented** in `workers/src/auth/`. It is a standalone, provider-agnostic
module set that any future interface (Telegram, dashboard, mobile) can reuse.

### 6.1 Module Layout

| Module | Responsibility |
|---|---|
| `src/auth/types.ts` | `Principal`, `IdentityResolution`, `AuthContext`, `AuditEvent` types |
| `src/auth/providers.ts` | `IdentityResolver` interface + registry; ships `TelegramIdentityResolver` (header `X-Telegram-Chat-Id` → `users.external_id`) |
| `src/auth/principal.ts` | `buildPrincipal()` — resolve `users` row → role → `Principal` (throws `401` unknown / `403` disabled) |
| `src/auth/permissions.ts` | `resolveEffectivePermissions()` (full set) + `hasPermission()` (fast check) — data-driven, deny-wins, OWNER short-circuit |
| `src/auth/middleware.ts` | `authorize()` + `requirePermission()` guard + `composeSecurityPipeline()` |
| `src/auth/audit.ts` | `AuditMiddleware` — appends to `audit_logs` for allow + deny |
| `src/auth/index.ts` | Barrel export |

### 6.2 Resolution Flow (matches the data model exactly)

```
request (X-Telegram-Chat-Id: <chatId>)
   │
   ├─ resolveIdentity()        → IdentityResolution { provider, providerIdentifier }
   ├─ buildPrincipal(DB)       → SELECT users WHERE external_id = ?
   │                              • unknown → AuthError 401
   │                              • is_active = 0 → AuthError 403
   ├─ hasPermission(DB, roleId, userId, perm)
   │      • OWNER → true (short-circuit)
   │      • role_grants from role_permissions
   │      • user override (grant OR revoke) wins over the role grant (deny-wins)
   ├─ audit(allow │ deny)      → INSERT audit_logs
   └─ return Principal (handler gets ONLY the Principal — no provider id leakage)
```

Key properties verified by tests:
- **No hardcoded role→permission maps** (ADR-003). All resolution reads
  `role_permissions` / `user_permissions` from D1.
- **Deny wins** — a `user_permissions` `revoke` removes a capability even when
  the role grants it; a `grant` adds a capability the role lacks.
- **OWNER short-circuit** — OWNER is authorized for any permission with no
  `role_permissions` rows required.
- **Provider isolation** — `Principal` exposes only `provider` (logical name),
  never the raw `providerIdentifier`/`external_id`, so business services cannot
  leak identity-provider internals.
- **Opt-in** — the engine does NOT auto-wire into existing Epic 1 routes. Guards
  are applied explicitly per route, so existing endpoints are untouched.

### 6.3 Usage

```ts
import { requirePermission } from "./auth";

// Inside a route handler:
const guard = requirePermission(env.DB, "leads.assign");
const decision = await guard(req, { type: "lead", id: leadId });
if (!decision.authorized) return decision.response; // 401 / 403

// decision.principal is the fully-resolved Principal — pass it to services.
```

Or compose the whole pipeline (identity → principal → authorize → audit):

```ts
import { authorize, authedRequest } from "./auth";

const result = await authorize(env.DB, authedRequest("tg-owner", "users.manage"), {
  permission: "users.manage",
});
if (result.authorized) { /* result.principal available */ }
else { /* result.response is a 401/403 */ }
```

### 6.4 Tests

- `tests/auth/engine.unit.test.ts` — 14 unit tests against a mock D1 (permission
  math, deny-wins, OWNER short-circuit, principal building, audit serialization).
- `tests/auth/engine.integration.test.ts` — 11 integration tests against real
  Miniflare D1 seeded with RBAC rows (full pipeline via `X-Telegram-Chat-Id`).

All 25 new tests pass; the 74 Epic 1 tests remain green.

---

## 7. Indexing Summary

| Table | Index | Purpose |
|---|---|---|
| `roles` | `idx_roles_name` | Resolve role by stable name |
| `permissions` | `idx_permissions_key` | Resolve permission by key |
| `permissions` | `idx_permissions_resource` | Group permissions by namespace |
| `users` | `idx_users_external_id` | Login / bot identity lookup |
| `users` | `idx_users_is_active` | Filter active principals |
| `role_permissions` | `idx_role_permissions_role_id` | Load all permissions for a role |
| `role_permissions` | `idx_role_permissions_role_perm` | Resolve one (role, permission) grant |
| `role_permissions` | `idx_role_permissions_permission_id` | Reverse lookup: which roles hold a permission |
| `user_permissions` | `idx_user_permissions_user_id` | Load a user's overrides |
| `user_permissions` | `idx_user_permissions_user_perm` | Resolve one override (user+perm) |
| `audit_logs` | `idx_audit_logs_actor_id` | Trail for an actor |
| `audit_logs` | `idx_audit_logs_action` | Trail by action |
| `audit_logs` | `idx_audit_logs_target` | Trail by target entity |
| `audit_logs` | `idx_audit_logs_created_at` | Time-ordered retrieval |

---

## 8. References

- `workers/migrations/0002_rbac_foundation.sql` — The migration that creates the 5 base RBAC tables
- `workers/migrations/0003_role_permissions.sql` — The migration that adds `role_permissions` + seeds mappings
- `workers/migrations/0001_initial_schema.sql` — Epic 1 schema (unchanged)
- `docs/database/MIGRATION_STRATEGY.md` — Migration numbering & process
- `docs/database/DATABASE_DESIGN.md` — Full entity design (Epic 1)
- `docs/decisions/ADR-002-multi-agent-operations-architecture.md` — Interface/auth architecture
- `docs/decisions/ADR-003-permission-resolution-strategy.md` — Permissions resolved as data (no code constants)
- `ARCHITECTURE.md` — System architecture and D1 role
- Cloudflare D1 Docs: https://developers.cloudflare.com/d1/
