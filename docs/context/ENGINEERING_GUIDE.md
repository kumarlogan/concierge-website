# Engineering Guide — kumarlogan/concierge-website

> Written for someone about to make a change. All facts are sourced from discovery reports; gaps are marked `unknown`. Rules that are recommendations only (not current practice) are marked `[RECOMMENDED]`.

---

## 1. Orientation

### What this repository is

`concierge-website` is a monorepo containing a Cloudflare Workers-based backend API and a React/Vite SPA for the AGS Fertility Concierge patient portal (`agsynergy.ca`). It is actively built by a single developer at high velocity (~7–15 commits/day), with AI agents committing directly. The entire stack runs on Cloudflare (Workers + D1 + R2); there is no traditional server.

### Monorepo layout

| Directory | What lives there | Status |
|---|---|---|
| `artifacts/ags-fertility/` | React/Vite SPA — the production frontend (`agsynergy.ca`) | **Active** |
| `artifacts/api-server/` | Legacy Express prototype server | Dead — not deployed |
| `artifacts/mockup-sandbox/` | Design/mockup workspace | Unknown |
| `workers/` | Cloudflare Worker API (`api.agsynergy.ca`) — all backend logic | **Active** |
| `workers/src/platform/` | Platform subsystems: identity, trust, workflow, documents, notifications, EPCL, WAS, WEF | Mixed — see Section 10 |
| `workers/migrations/` | Forward-only D1 SQL migration files | **Active** |
| `hermes/` | AI workforce control plane — not a pnpm package; consumed via `@hermes/*` path alias | **Active** |
| `shared/` | Provider-neutral contracts and interfaces; consumed by `hermes/` via relative imports | **Active** |
| `lib/api-client-react/` | Generated React Query API client, consumed by `artifacts/ags-fertility` | **Active** |
| `lib/api-spec/` | OpenAPI spec + Orval codegen config; dev tooling only | **Active** |
| `lib/api-zod/` | Zod schemas from legacy prototype | Dead — do not modify |
| `lib/db/` | Drizzle/PostgreSQL schema from legacy prototype | Dead — do not modify |
| `scripts/` | CI helper scripts: integrity checks, deploy gates | **Active** |
| `.hermes/` | AI agent planning artifacts (2 files); NOT source code | Docs/state only |
| `hermes-website/` | **Misleading name** — this is the Cloudflare Worker name for the FRONTEND worker (not a directory) | N/A |

### The single most important thing to know before changing code

**Pushing to `main` immediately deploys to production.** There is no test gate, no typecheck gate, and no approval step in the deploy pipeline. If your change breaks something, it is live within minutes of the push. Typecheck and test locally before committing.

---

## 2. Environment Setup

### Package manager and version

pnpm `11.13.1` — pinned via `"packageManager": "pnpm@11.13.1"` in `package.json`. Corepack picks this up automatically. Do not use npm or yarn; the `preinstall` script removes lockfiles and enforces pnpm-only.

### Node version — HAZARD

| Context | Node version |
|---|---|
| `.node-version` (local tooling, CI) | `22` |
| CI `deploy.yml` hard-coded `NODE_VERSION` | `22` |
| Replit runtime (`.replit` `modules`) | `nodejs-24` |

**The Replit environment runs Node 24 while CI runs Node 22.** Code that relies on Node 24 behaviour (newer APIs, different V8) may pass locally on Replit and fail in CI or behave differently in the Cloudflare Workers runtime. Replit is the primary development environment for this project.

### Install

```bash
pnpm install
```

`frozen-lockfile` is NOT enforced (`.npmrc` `frozen-lockfile=false`; CI also uses `--frozen-lockfile=false`). Packages are hoisted via `shamefully-hoist=true`. New packages must be at least 1 day old before pnpm accepts them (`minimumReleaseAge: 1440` in `pnpm-workspace.yaml`), except `@replit/*` packages.

### Workspace wiring

`pnpm-workspace.yaml` declares five globs: `artifacts/*`, `lib/*`, `lib/integrations/*`, `scripts`, `workers`. `hermes/` and `shared/` are NOT pnpm workspace packages — they are consumed by `workers/` via TypeScript path aliases and Wrangler bundler aliases only.

### Path aliases

Aliases are defined in two places and must be kept in sync:

**`workers/tsconfig.json`** (TypeScript resolution):

| Alias | Resolves to |
|---|---|
| `@hermes/*` | `../hermes/*` (i.e., repo-root `hermes/`) |
| `@shared/*` | `../shared/*` |

**`workers/wrangler.jsonc`** (Wrangler bundler resolution at deploy time):

The `alias` map in `workers/wrangler.jsonc` contains explicit `.js` → `.ts` remappings for every file under `hermes/` that is imported by `workers/`. This is required because Cloudflare Workers TypeScript source uses `.js` extensions in imports (ESM convention) but the actual files are `.ts`. If you add a new `@hermes/*` import in `workers/`, you must add a corresponding alias entry in `workers/wrangler.jsonc`.

**`artifacts/ags-fertility`** (Vite):

Uses `@` → `src/` alias. Does not use `@hermes` or `@shared`.

The `scripts/import-integrity-check.py` script (run as a CI gate) understands all of the above alias schemes and will catch unresolvable imports before deploy.

---

## 3. Common Commands

| Command | What it does | When to use |
|---|---|---|
| `pnpm install` | Install all workspace dependencies | After checkout or pulling changes |
| `pnpm run typecheck` | Typecheck all libs + all artifacts + scripts (runs `tsc --build` for libs, then `tsc --noEmit` for each artifact) | Before pushing; this is NOT run in CI deploy |
| `pnpm run typecheck:libs` | Typecheck only the three lib packages via project references (`lib/db`, `lib/api-client-react`, `lib/api-zod`) | After changing a lib |
| `pnpm run build` | Typechecks then builds the SPA (`artifacts/ags-fertility`) to `artifacts/ags-fertility/dist/public/` | Before deploy or to verify SPA builds clean |
| `pnpm --filter @workspace/ags-fertility run dev` | Vite dev server for the SPA on `0.0.0.0` | Local frontend development |
| `pnpm --filter @workspace/workers run dev` | Wrangler local dev server for the API worker | Local API development |
| `pnpm --filter @workspace/workers run test` | Run all worker tests once via `workers/vitest.config.ts` (uses `@cloudflare/vitest-pool-workers`) | After changing workers/ code |
| `pnpm --filter @workspace/workers run test:watch` | Watch mode for worker tests | During active development |
| `pnpm --filter @workspace/workers run test:coverage` | Worker tests with coverage report (no thresholds enforced) | Spot coverage checks |
| `vitest run --config vitest.config.ts` | Root-level vitest: all `**/*.test.ts` in node environment (excludes CF-pool and custom-runner files) | Running hermes/ unit tests |
| `vitest run --config workers/vitest.epic005.config.ts` | Epic-005 regression suite: pure Node tests for providers, activation, execution, audit in `hermes/` | Targeted regression testing for EPIC-005 |
| `pnpm --filter @workspace/workers run typecheck` | Typecheck `workers/` only | After changing workers/src or hermes/ |
| `pnpm --filter @workspace/api-spec run codegen` | Run Orval codegen then typecheck libs; regenerates `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` | After changing `lib/api-spec/openapi.yaml` |
| `wrangler d1 migrations apply agsynergy-db --env production` | Apply pending D1 migrations to production database | After adding a migration file (manual; no CI step) |
| `wrangler d1 migrations apply agsynergy-db` | Apply migrations to local/dev D1 | Local schema setup |
| Deploy | Happens automatically on `push` to `main` via `.github/workflows/deploy.yml` | Do not run manually unless needed via `workflow_dispatch` |

---

## 4. Working on the API Worker

### Where routes live

```
workers/src/
  index.ts              — entrypoint: request lifecycle, platform engine init, router wiring
  router/index.ts       — custom URLPattern-based router
  routes/
    health.ts           — GET /api/v1/health
    consultations.ts    — POST /api/v1/consultations
    contact.ts          — POST /api/v1/contact
    ops.ts              — /api/v1/ops/** (RBAC-protected)
    trustRuntime.ts     — /api/v1/trust/**, /api/v1/consent/**, /api/v1/policy/**, /api/v1/delegation/**, /api/v1/authorization/**
    documents.ts        — /api/v1/documents/**, /api/v1/caregiver/**
    wave7.ts            — /api/v1/appointments/**, /api/v1/messages/**, /api/v1/notifications/**, /api/v1/workflows/**
    telegram.ts         — /telegram/webhook
    adminBot.ts         — /admin/webhook
    clinic.ts           — /api/v1/clinic/**
```

### Convention for adding a route

1. **Entrypoint** (`workers/src/index.ts`): The `router.fetch(request, safeEnv)` call dispatches all routes. New route groups are registered here by calling a `register*Routes(router, ...)` function or by calling `router.add(method, pattern, handler)` directly.
2. **Router** (`workers/src/router/index.ts`): First matching `{method, URLPattern}` wins. Registration order matters.
3. **Route file** (`workers/src/routes/*.ts`): Handler receives `(request: Request, env: Env, params: Record<string, string>)`. Return a `Response` object.
4. **Middleware**: Apply middleware at the handler level, not at the router level. See `withJwtAuth()` and `requirePermission()` patterns in existing route files.

### How to add auth to a route

Two auth mechanisms exist:

**JWT (RS256 Bearer token)** — for patient-facing and platform APIs:
```typescript
import { withJwtAuth } from '../auth/jwt'
// Wrap your handler:
router.add('GET', '/api/v1/myroute', withJwtAuth(async (request, env, params, identity) => {
  // identity is the decoded JWT principal
  return new Response(JSON.stringify({ ok: true }))
}))
```

**RBAC** — for ops staff routes (uses `@hermes/permissions/middleware`):
```typescript
import { requirePermission } from '../auth/permissions'
// Inside handler:
const authResult = await requirePermission(env.DB, request, 'leads.read')
if (!authResult.ok) return authResult.response
```

Clinic routes require clinic identity for all `/clinic/*` paths — see `routes/clinic.ts` and PR #3 (`fix/clinic-route-auth-guard`) for the pattern.

### Where env bindings are typed

`workers/src/types/env.ts` — all Cloudflare bindings (`D1Database`, `R2Bucket`, secrets, vars) are declared on the `Env` interface. The `safeEnv` object passed to handlers is an augmented version of `Env` that also carries platform engine instances injected by `wirePlatformEngines()` at request time.

### Rule: adding a new binding

If you add a new D1 database, R2 bucket, KV namespace, or secret:
1. Add the binding to `workers/wrangler.jsonc` (and the `env.production` section if needed).
2. Add the corresponding property to the `Env` interface in `workers/src/types/env.ts`.
3. If it is a secret, add it to the GitHub Secrets and update the "Inject JWT config" step in `.github/workflows/deploy.yml` if it needs to be injected at deploy time.

Do not leave a binding with an empty `database_id` — the `NOTIFICATIONS` binding in `workers/wrangler.jsonc` currently has `database_id: ""`, which means it is unprovisioned. Accessing `env.NOTIFICATIONS` in code will fail at runtime.

---

## 5. Working on the Frontend

### Where it is

`artifacts/ags-fertility/` — this is the React/Vite SPA. Do NOT work in `artifacts/api-server/` (dead legacy code) or look for a directory called `hermes-website/` (that is only the Cloudflare Worker name for the deployed frontend, not a directory in the repo).

### Stack

- React 18, Vite, TypeScript
- TanStack Query (React Query) for data fetching
- `@` path alias → `src/`
- Builds to `artifacts/ags-fertility/dist/public/`

### How it calls the API

The SPA calls the API exclusively through `@workspace/api-client-react`. It does not make raw `fetch()` calls to the API. The base URL is injected at build time via the `VITE_API_BASE` environment variable (set as a GitHub Secret, injected during the build step in `deploy.yml`).

### How auth tokens are handled

The API client uses a `setAuthTokenGetter(fn)` / `setBaseUrl(url)` mechanism defined in `lib/api-client-react/src/custom-fetch.ts`. A caller registers a function that returns the Bearer token; the custom fetch wrapper calls it on every request. The registration should happen in `artifacts/ags-fertility/src/main.tsx` or equivalent app init code.

### Generated API client story

```
lib/api-spec/openapi.yaml       ← authoritative API contract (version 0.1.0 currently)
         ↓  (Orval codegen)
lib/api-client-react/src/generated/api.ts        ← React Query hooks
lib/api-client-react/src/generated/api.schemas.ts ← TypeScript interfaces
         ↓
artifacts/ags-fertility          ← consumes hooks via @workspace/api-client-react
```

**When you change the API contract** (add/remove/rename an endpoint or field in `lib/api-spec/openapi.yaml`), you must regenerate the client:

```bash
pnpm --filter @workspace/api-spec run codegen
```

This runs Orval and then typechecks the libs. The generated files in `lib/api-client-react/src/generated/` are committed to the repo. If you push without regenerating, the frontend will use the stale generated client, which may cause type mismatches or missing hooks at runtime.

Note: `lib/api-zod/` is also generated from the same spec but is deprecated — `api-zod` is consumed only by the dead `artifacts/api-server`.

---

## 6. Database Changes

### Migration convention

Migrations are forward-only SQL files in `workers/migrations/`. The naming scheme is:

```
0NNN_description.sql
```

where `NNN` is a zero-padded three-digit integer (e.g., `0012_my_feature.sql`).

### How migrations are applied

Wrangler manages the migration state internally via a `d1_migrations` meta-table. Apply with:

```bash
# Development / local:
wrangler d1 migrations apply agsynergy-db

# Production (run from workers/):
wrangler d1 migrations apply agsynergy-db --env production
```

**This is a manual step. There is no CI/CD pipeline that applies migrations automatically.** Deploying code that references columns from a new migration without first applying the migration to the live database will cause runtime failures.

### Warnings

**No rollback migrations exist by design.** Once applied, a migration cannot be automatically undone. Add a new migration to undo the change if needed.

**The migration numbering is already broken in two places:**
- `workers/migrations/0002_identity_core.sql` and `workers/migrations/0002_rbac_foundation.sql` share the same `0002_` prefix. Wrangler's application order for these two is undefined-by-name.
- `workers/migrations/011_notifications.sql` uses `011_` (missing the leading zero) instead of `0011_`. File-system sort ordering differs from lexicographic ordering for this file.

**The `consents` table is defined in two migrations with incompatible schemas:**
- `0006_trust_runtime.sql`: defines `consents` with one schema.
- `0008_consent_engine.sql`: redefines `consents` with `CREATE TABLE IF NOT EXISTS consents (...)` — a superset schema with additional columns (`patient_identity_id`, `status`, `resource_type`, `resource_id`, `revoked_by`, `revoke_reason`, `updated_at`).

Because of `IF NOT EXISTS`, whichever migration runs first wins and the second is silently a no-op. The live `consents` table is likely missing the columns added in `0008`. Code in `workers/src/platform/trust/consent-engine.ts` that targets the 0008 schema may be writing to columns that do not exist.

### Required convention for the next migration

`[RECOMMENDED]` The next migration file MUST be named `0012_description.sql` (four digits, leading zero, incrementing past the highest unambiguous existing number). Do not reuse any prefix. The broken `0002_` and `011_` files must not be used as a template.

---

## 7. Testing

### Framework

Vitest — used across all test configurations.

### The three configs and their scopes

| Config | Command | Runtime | What it covers |
|---|---|---|---|
| `workers/vitest.config.ts` | `pnpm --filter @workspace/workers run test` | `@cloudflare/vitest-pool-workers` (Miniflare) | `workers/tests/**/*.test.ts` — API routes, D1 store operations, workforce/agent orchestration, platform APIs. Applies D1 migrations via `tests/globalSetup.ts` before tests run. |
| `vitest.config.ts` (root) | `vitest run --config vitest.config.ts` | Node | All `**/*.test.ts` excluding CF-pool and custom-runner files. Covers `hermes/` service unit tests, `workers/src/` co-located tests. |
| `workers/vitest.epic005.config.ts` | `vitest run --config workers/vitest.epic005.config.ts` | Node (threads pool) | `hermes/services/providers/**`, `hermes/services/activation/**`, `hermes/services/execution/**`, `hermes/audit/**` — EPIC-005 regression suite. |

### Where tests live

- `workers/tests/` — 30+ flat test files covering API, D1 stores, security, admin, platform
- `workers/tests/{admin,auth,consultation,health,integration,launch,ops,platform,runtime,telegram}/` — subdirectory tests
- `workers/src/platform/notifications/` and `workers/src/platform/workflow/` — co-located `*.test.ts` files
- `hermes/services/providers/__tests__/` — EPIC-005 provider unit tests
- `hermes/services/execution/gateway/__tests__/` — execution gateway tests

### Current count

68 test files observed across the repository.

### What is NOT covered

- **`artifacts/ags-fertility` has zero test files.** No React component tests, no integration tests for the SPA.
- **Coverage is not enforced.** The `test:coverage` script exists but no coverage thresholds are configured in any vitest config.
- **Tests are not run in the deploy pipeline.** See Section 8.

Several test files are excluded from the standard runners because they require custom runners, live deployments, or fail under the Cloudflare pool (e.g., files using `renameSync`, smoke tests requiring `SMOKE_TEST_URL`).

---

## 8. Deployment

### What happens on push to main

The `.github/workflows/deploy.yml` pipeline runs automatically on every push to `main`:

1. Checkout + pnpm install
2. **Gate: Repo Integrity** — `scripts/repo-integrity-check.sh` (clean working tree, correct branch, synced with remote)
3. **Gate: Required Files** — `scripts/required-files-check.sh` (required deployment files exist)
4. **Gate: Import Resolution** — `python3 scripts/import-integrity-check.py` (static import graph, all imports resolve, handles `@hermes/*` and `@shared/*` aliases)
5. Build SPA: `pnpm --filter @workspace/ags-fertility run build` with `VITE_API_BASE` injected
6. **Guard: Production bundle** — fails if built JS references `kumarlogan.workers.dev` or `localhost:*`; also fails if the `VITE_API_BASE` host is NOT present in the bundle. This guard was added after the 2026-07-28 incident where the wrong API URL was baked into the production bundle.
7. Inject JWT secrets into `workers/wrangler.jsonc` in-place (JWT keys, Turnstile key)
8. Deploy API worker (`agsynergy-api --env production`) from `workers/`
9. Deploy frontend worker (`hermes-website`) from repo root
10. (On `workflow_dispatch` only) Deploy API preview (`--env preview`)

### WARNING: no test or typecheck gate in the deploy pipeline

**Neither `vitest` nor `tsc` is run during deployment.** The CI pipeline will deploy TypeScript that does not compile and code that fails all tests, as long as the integrity checks and bundle guard pass. Correctness is entirely the author's responsibility before pushing to `main`. Run `pnpm run typecheck` and `pnpm --filter @workspace/workers run test` locally before every push.

### Preview deployment

The API preview environment (`--env preview`) deploys only on manual `workflow_dispatch` trigger, not on every push. The frontend has no separate preview deployment.

---

## 9. Conventions

### Commit message scheme

The project uses a hybrid of Conventional Commits and project-specific work-item prefixes:

**Layer 1 — Conventional Commits** (standard type prefixes):
`fix:`, `feat:`, `docs:`, `ci:`, `test:`, `revert:`, `hotfix:`, `release:`, `refactor:`

**Layer 2 — Epic/Wave prefixes** (uppercase, project-specific):
`EPIC-XXX-YYY:`, `GOV-XXX:`, `wave5:`, `Wave 6:`, `Wave 8:`

**Layer 3 — Scoped types**:
`fix(workers):`, `fix(api):`, `fix(frontend):`, `fix(ci):`, `fix(identity):`, `fix(security):`

**Real examples from the commit history:**
```
fix: robust account lookup, idempotent app find, clean token refs
feat: add Cloudflare Access setup workflow
Wave 8: Workflow & Automation Engine — Engineering Reconciliation
release: AGS Fertility v1.6.0 — Wave 6 Production Promotion
EPIC-004 (3/6): WorkflowStore abstraction + persistence contracts
GOV-002: Operational Governance & Phase 2 Kickoff
hotfix: reduce PBKDF2 iterations to 100k for Cloudflare Workers compatibility
fix(security): require clinic identity for all /clinic/* routes
```

Work-item identifiers in use: `EPIC-00X`, `EPIC-00X-00Y`, `EPIC-00X.Y`, `Wave N`, `GOV-00X`, `MVP-XXX`, `AGS-XXX`.

### Branching

Trunk-based development. Approximately 98% of commits go directly to `main` without a pull request. Feature branches are used only in exceptional cases (2 non-main branches currently exist, both with open PRs). There is no branch protection policy enforced by configuration files in the repo.

### Code review

No external code review occurs. When PRs are used, they are self-merged, sometimes within minutes of opening. PR #2 (P0 fix) was self-merged 2 minutes after opening. PR #3 (clinic auth security fix) was opened on 2026-08-03 and is currently unmerged.

### Versioning

`workers/src/version.ts` exports `SERVICE_VERSION = "1.1.0"`. The CHANGELOG records versions through `1.6.0` (Wave 6, 2026-08-01) with planned entries up to `1.21.0`. **`version.ts` is stale** — it is documented as auto-generated from `CHANGELOG.md` via `bash scripts/extract-version.sh`, but the script has not been run since the `v1.1.0` tag. The header comment on `version.ts` does not reflect current reality. If you need the accurate version, read `CHANGELOG.md`, not `version.ts`.

Git tags are applied selectively to major wave releases (e.g., `wave-6-rc1`, `v1.6.0`), not every CHANGELOG entry.

---

## 10. Hazards Checklist

The following are the specific traps most likely to cause incorrect assumptions or broken changes:

**1. In-memory singletons that look like persistence.**
`ConsentEngine` (`workers/src/platform/trust/consent-engine.ts`) and `DelegationEngine` (`workers/src/platform/trust/delegation-engine.ts`) are module-level singletons backed by `Map` objects. D1 tables (`consents`, `delegations`) exist in the schema but the live code does not read or write them. Consent grants and delegations evaporate on every Worker isolate restart. Similarly, `InMemoryAppointmentEngine`, `InMemoryMessageEngine`, `InMemoryTimelineEngine`, and several hermes backends hold state that vanishes on restart.

**2. Dormant feature-flagged subsystems.**
EPCL (`workers/src/platform/epcl/`) and WAS (`workers/src/platform/was/`) have all feature flags set to `false` by default. Neither has a live HTTP route. Their `require*()` guards throw if the flags are off. Do not assume these subsystems are active in production.

**3. The unprovisioned NOTIFICATIONS binding.**
`workers/wrangler.jsonc` declares a `NOTIFICATIONS` D1 binding with `database_id: ""`. The database has not been provisioned. Any code path that accesses `env.NOTIFICATIONS` will fail at runtime. The notification tables (`notifications`, `notification_delivery`, etc.) from migration `011_notifications.sql` target the main `DB` binding, not `NOTIFICATIONS`.

**4. The duplicate `consents` table definition.**
`0006_trust_runtime.sql` and `0008_consent_engine.sql` both define `consents` with incompatible schemas. The live table schema is whichever ran first; the other's `CREATE TABLE IF NOT EXISTS` was silently skipped. Code in `consent-engine.ts` assumes a newer schema that may not exist in the live database.

**5. `AUTHORIZATION_ENGINE` is never constructed.**
The `Env` type in `workers/src/types/env.ts` includes platform engines injected by `wirePlatformEngines()`. If `wirePlatformEngines()` is not called or a particular engine is not wired, accessing it on `env` will be `undefined` at runtime even though TypeScript believes it is defined.

**6. The two directories whose names mislead.**
- `hermes-website/` — this does NOT exist as a directory. It is the Cloudflare Worker name (value of the `name` field in the root `wrangler.jsonc`) for the frontend static-asset worker. The actual frontend source is in `artifacts/ags-fertility/`.
- `artifacts/` — despite its name suggesting build outputs, this directory contains source code for deployable applications. The actual built output is inside `artifacts/ags-fertility/dist/public/`, which is git-ignored.

**7. Migration numbering is broken; do not follow the existing pattern.**
Two files share the `0002_` prefix; one file uses `011_` instead of `0011_`. The next migration MUST be `0012_description.sql`. `[RECOMMENDED]`

**8. The deploy pipeline has no test or typecheck step.**
Covered in Section 8. Repeating here because it is the most dangerous property of this repository: broken code ships automatically.
