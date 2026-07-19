# EPIC-002-006A — Hermes Platform Extraction Baseline

> **Milestone:** Phase 0 (Baseline) — implementation readiness
> **Status:** REPORTING ONLY · No production changes made · No code/migration/Worker/Cloudflare/secrets modified
> **Governing decision:** ADR-007 (Proposed)
> **Date:** 2026-07-19
> **Repo:** `/home/ubuntu/hermes-website`

---

## 1. Baseline Report

### 1.1 Git state (verified)

| Field | Value |
|---|---|
| Current commit | `8f836548985d4803abb290172a5adcbdcb07bd5b` |
| Current branch | `main` |
| Working tree | **DIRTY** — see 1.2 |
| Remote tracking | (not inspected — read-only) |

> ⚠️ **Baseline blocker:** The working tree has uncommitted modifications. A
> reliable baseline tag must point at a clean, known-good commit. **Before
> tagging `baseline-002-006`, the dirty tree must be resolved** (commit the
> intentional changes or stash them). The currently uncommitted changes include
> regenerated API client code (`lib/api-zod`, `lib/api-client-react`,
> `lib/api-spec`) plus a few source edits and two untracked docs
> (`AI_OPERATING_MODEL.md`, `API.md`).

### 1.2 Uncommitted modifications (verified via `git status`)

**Modified (tracked):**
- `artifacts/ags-fertility/src/components/forms/ConsultationForm.tsx`
- `artifacts/ags-fertility/src/main.tsx`
- `artifacts/ags-fertility/src/pages/AboutPage.tsx`
- `lib/api-client-react/src/generated/api.schemas.ts`
- `lib/api-client-react/src/generated/api.ts`
- `lib/api-client-react/src/index.ts`
- `lib/api-spec/openapi.yaml`
- `lib/api-spec/orval.config.ts`
- `lib/api-zod/src/generated/api.ts`
- `lib/api-zod/src/generated/types/consultationConfirmation.ts`
- `lib/api-zod/src/generated/types/consultationCount.ts`
- `lib/api-zod/src/generated/types/consultationInput.ts`
- `lib/api-zod/src/generated/types/healthStatus.ts`
- `lib/api-zod/src/generated/types/index.ts`
- `pnpm-lock.yaml`
- `pnpm-workspace.yaml`

**Deleted (tracked):**
- `lib/api-zod/src/generated/types/consultationInputTreatmentInterest.ts`
- `lib/api-zod/src/generated/types/errorResponse.ts`

**Untracked:**
- `AI_OPERATING_MODEL.md`
- `API.md`

### 1.3 Test status (verified via `pnpm test --run` in `workers/`)

| Metric | Value |
|---|---|
| Result | **141 passed / 141** (7 test files) |
| Duration | ~7.58s |
| Test files | `tests/health/health.test.ts` (10), `tests/auth/engine.unit.test.ts` (14), `tests/auth/engine.integration.test.ts`, `tests/telegram/bot.integration.test.ts`, `tests/ops/ops.integration.test.ts`, `tests/consultation/consultation.test.ts`, `tests/integration/api.test.ts` |
| Environment | vitest (no runtime DB required for unit; integration uses seeded D1) |

**Note:** Tests log `health: database check failed` in degraded-path cases —
this is expected (unit tests exercise the no-DB path) and does **not** indicate
a failure.

### 1.4 Migration state (verified `workers/migrations/`)

| File | Purpose | Status |
|---|---|---|
| `0001_initial_schema.sql` | leads, consultations (app tables) | Applied (baseline) |
| `0002_rbac_foundation.sql` | roles, user_roles, role_permissions, user_permissions, audit_logs | Applied (baseline) |
| `0003_ops_lead_fields.sql` | ops_* columns on leads | Applied (baseline) |
| `0004_role_permissions_seed.sql` | seed role/permission grants | Applied (baseline) |

No pending migrations. **Schema frozen for Phase 0** (ADR-007 prohibits schema
changes in this milestone).

### 1.5 Deployed components (verified via `wrangler.jsonc`, structure only — no secrets read)

| Component | Name | Binding / Domain | Notes |
|---|---|---|---|
| API Worker | `agsynergy-api` | D1 `agsynergy-db` (binding `DB`), `api.agsynergy.ca` (custom domain) | Hosts app API + auth + bot |
| Site Worker | `hermes-website` | `agsynergy.ca`, `www.agsynergy.ca` (custom domains) | Static frontend |
| CI | `.github/workflows/deploy.yml` | on push → `main` | builds + `wrangler deploy` |

> No deploy performed in this milestone. Domain/binding names recorded for
> rollback reference only.

### 1.6 Current Worker boundaries (verified `workers/src/router/index.ts`)

- Single Worker `agsynergy-api` serves **app API + auth engine + Telegram bot**
  in one process.
- Router: dependency-free `URLPattern`-based, method+path → handler.
- Route surface (from handlers registered): `/api/v1/health`,
  `/api/v1/leads*`, `/api/v1/consultations*`, `/api/v1/telegram` (bot webhook).
- **Auth boundary:** every protected handler calls `authorize(env.DB, request,
  { permission })` (from `workers/src/auth/middleware.ts`) before business logic.
- **No separate Hermes boundary yet** — extraction target.

### 1.7 Current authentication flow (verified `workers/src/auth/*`)

```
Request
  → router matches /api/v1/... → handler
  → authorize(env.DB, request, {permission})
       1. resolveIdentity(request)        [providers.ts — Telegram resolver]
       2. buildPrincipal(db, identity)    [principal.ts — loads user+role]
       3. hasPermission(db, roleId, userId, key)  [permissions.ts — role∪user−revoke; OWNER short-circuit]
       4. writeAuditEvent(db, decision)   [audit.ts — tolerant, non-blocking]
       5. return Principal | 401/403
  → handler runs business logic (opsService / consultationService)
```

- Identity providers registered in `providers.ts` via a registry map (currently
  only Telegram).
- Permission evaluation is **data-driven** (ADR-003): no hardcoded maps;
  `effective = role_permissions ∪ user_permissions − revocations`.
- OWNER role short-circuits to allow.
- Audit writer never blocks the request on failure (logs server-side only).

---

## 2. Extraction Inventory

### 2.1 Current → Target mapping

| Current path | Lines | Target (`hermes/` or `shared/`) | Phase |
|---|---|---|---|
| `workers/src/auth/index.ts` | 20 | `hermes/identity` (re-export surface) | 2 |
| `workers/src/auth/types.ts` | — | `hermes/interfaces` + `hermes/identity` | 1/2 |
| `workers/src/auth/providers.ts` | ~4555 B | `hermes/identity` + `hermes/providers` | 2 |
| `workers/src/auth/principal.ts` | — | `hermes/identity` | 2 |
| `workers/src/auth/permissions.ts` | ~6310 B | `hermes/permissions` | 2 |
| `workers/src/auth/audit.ts` | ~3148 B | `hermes/audit` | 2 |
| `workers/src/auth/middleware.ts` | ~8358 B | `hermes/permissions` | 2 |
| `workers/src/routes/telegram.ts` | ~18347 B | `hermes/agents/ops` | 5 |
| `workers/src/services/opsService.ts` | — | **stays** (app business logic) | — |
| `workers/src/services/consultationService.ts` | — | **stays** (app business logic) | — |
| `workers/migrations/0002_rbac_foundation.sql` | — | `hermes/migrations/0001_rbac.sql` (copy) | 4 |
| `workers/migrations/0004_role_permissions_seed.sql` | — | `hermes/migrations/0001_rbac.sql` (copy) | 4 |
| `workers/migrations/0001_initial_schema.sql` | — | **stays** (app tables) | — |
| `workers/migrations/0003_ops_lead_fields.sql` | — | **stays** (app fields) | — |

> Sizes are byte counts from prior reads; line counts to be finalized at
> Phase 2 copy time.

### 2.2 Target structure (per ADR-007)

```
hermes/
├── identity/       # providers.ts, principal.ts, types.ts (identity resolution)
├── permissions/    # permissions.ts, middleware.ts (resolver + authorize)
├── audit/          # audit.ts (audit writer)
├── providers/      # providers.ts registry contract + cloudflare adapter
└── migrations/     # hermes-owned RBAC tables (Phase 4)

shared/
├── interfaces/     # hermes/interfaces — shared TS contracts (auth/types.ts)
└── contracts/      # OpenAPI/Zod contracts (lib/api-zod, lib/api-spec reuse)
```

### 2.3 Non-extraction (stays in AGS Fertility)

- `workers/src/services/opsService.ts`, `consultationService.ts` — business logic.
- `workers/src/routes/ops.ts`, `consultations.ts` — app route handlers.
- `workers/src/router/index.ts` — route table (imports Hermes services post-extract).
- `workers/src/index.ts` — thin Worker entry (calls Hermes `authorize`).
- Migrations `0001`, `0003` — app tables/fields.
- Frontend, site Worker, app DB tables.

---

## 3. Golden Regression Checks

These tests **must remain identical** (same pass count, same JSON shape, same
status codes) across every extraction phase. If any drift, halt and roll back.

| # | Category | Gating test file(s) | What must stay identical |
|---|---|---|---|
| G1 | **Authentication** | `tests/auth/engine.unit.test.ts`, `tests/auth/engine.integration.test.ts` | Identity resolution (Telegram), principal building, 401 on missing identity |
| G2 | **Authorization** | `tests/auth/engine.*.test.ts` | `authorize` returns Principal or 401/403 with identical bodies |
| G3 | **RBAC** | `tests/auth/engine.*.test.ts` | `hasPermission` results for seeded roles (OWNER short-circuit, role∪user−revoke) |
| G4 | **Audit** | `tests/auth/engine.integration.test.ts` | Audit row written on allow/deny; tolerant writer never blocks |
| G5 | **Telegram identity** | `tests/telegram/bot.integration.test.ts` | Bot resolves operator identity; read-only commands return same payload |
| G6 | **Lead access** | `tests/ops/ops.integration.test.ts`, `tests/integration/api.test.ts` | `leads.read/.update/.assign` behavior byte-identical (status, shape) |
| G7 | **Consultation** | `tests/consultation/consultation.test.ts` | Consultation CRUD unchanged |
| G8 | **Health** | `tests/health/health.test.ts` | `/api/v1/health` shape + degraded-path handling |

**Golden total:** 141/141 tests passing, with recorded request/response pairs
for `leads.read`, `leads.update`, `leads.assign`, and one Telegram bot command
replayed after every phase for byte-equality.

---

## 4. Rollback Procedure

### 4.1 Baseline tag strategy

1. Resolve dirty tree (commit intentional changes or `git stash`).
2. `git tag baseline-002-006 8f83654` (or the new clean commit SHA).
3. Push tag: `git push origin baseline-002-006` (read-only until approved).
4. Capture D1 schema dump of `agsynergy-db` to
   `docs/operations/baseline-d1-schema-2026-07-19.sql` (read-only `SELECT`; no
   modification).
5. Record this report's §1 values as the canonical baseline.

### 4.2 Rollback criteria (any one triggers rollback)

- Golden test count drops below 141, OR any G1–G8 test fails.
- Recorded golden request/response differs byte-for-byte.
- `leads.*` customer-facing behavior changes.
- A phase cannot be flagged-off via `HERMES_PLATFORM_MODE`.
- Data-ownership move (Phase 4) shows RBAC row-parity < 100%.

### 4.3 Recovery steps (per phase)

- **Phase 1 (shim):** Delete `workers/src/auth/hermes-shim.ts`; revert import to
  original. No behavior change → cosmetic revert.
- **Phase 2 (packages):** Set `HERMES_PLATFORM_MODE=local`; app imports
  `workers/src/auth` again. Hermes packages left unused.
- **Phase 3 (Hermes unit):** Set `HERMES_PLATFORM_MODE=package`; app imports
  package directly (Phase 2 state).
- **Phase 4 (RBAC move):** Run `hermes/migrations/0002_rollback.sql`;
  flip app `DB` binding to app D1; stop dual-write.
- **Phase 5 (agent):** `UPDATE agent_registry SET status='inactive'` (one row)
  → bot returns "inactive"; no code change.
- **Phase 6 (cleanup):** Restore `workers/src/auth` from `baseline-002-006`;
  re-point imports.

**Universal escape hatch:** `git checkout baseline-002-006 -- workers/`
restores the entire Worker to the frozen baseline commit.

---

## 5. Implementation Readiness

| Gate | Status | Evidence |
|---|---|---|
| Tests green (141/141) | ✅ PASS | `pnpm test --run` output |
| Schema frozen | ✅ PASS | 4 migrations applied, none pending |
| Auth flow documented | ✅ PASS | §1.7 verified from source |
| Extraction inventory complete | ✅ PASS | §2 mapping to target modules |
| Golden checks defined | ✅ PASS | §3 G1–G8 + 141 total |
| Rollback defined | ✅ PASS | §4 tag/trigger/recovery |
| **Working tree clean for tagging** | ⚠️ **BLOCKER** | Dirty tree (§1.2) — resolve before `git tag` |

### Readiness verdict

**CONDITIONALLY READY.** All technical baselines are captured and verified.
The only open item is administrative: **the working tree is dirty.** The
baseline tag `baseline-002-006` cannot be created against a clean known-good
commit until the uncommitted changes are either committed (if intentional) or
stashed (if not part of this milestone).

### Recommended next action (Phase 0 close-out, requires human approval)

1. Human reviews the §1.2 dirty-tree list.
2. Commit intentional changes (or `git stash` the rest) → produce clean commit.
3. `git tag baseline-002-006 <clean-sha>` + push.
4. Dump D1 schema (read-only) to `docs/operations/`.
5. Mark EPIC-002-006A complete → proceed to Phase 1 (ADR-007 gated).

---

*Documentation only. No Worker code, migrations, Cloudflare config, deployments,
or secrets were modified. Stopping after readiness report per milestone rules.*
