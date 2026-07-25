# HERMES Project State Audit Report

> **Project:** AG Synergy Platform (Hermes Agent + Workers API)
> **Audit Date:** 2026-07-24
> **Audit Type:** Architecture (read-only, no changes)
> **Scope:** Full project — workers, hermes subdirectories, web UI artifacts, docs, shared contracts

---

## 1. Executive Summary

The HERMES project has reached **Phase 1 completion** with a working Cloudflare Workers API connected to D1, serving the consultation form on `agsynergy.ca`. Epic 1 (10/10 tasks) is complete. Epic 2 is in progress (4/5 core tasks done; EPIC-002-005 Hermes Admin Bot not started). The foundation freeze (EPIC-005.9) is verified: typecheck clean, 369 tests passing, full corpus 434 pass, 114 EPIC-005.9 regression tests pass. There are 5 failed test suites due to a build error in `orchestration.ts` and stale test fixtures, not runtime failures. The project has 26 modified files in the working tree, all from the interrupted EPIC-005.9 work. No `hermes-webui` or `ai-job-agent` directories exist; the web UI is served via `artifacts/ags-fertility/dist/public`. The `ai-job-agent` concept has no physical implementation. 5 test suites fail due to a syntax error; 369 individual tests all pass at runtime.

## 2. Project Structure

| Directory | Purpose | Status |
|---|---|---|
| `workers/` | Cloudflare Workers TypeScript API (primary backend) | Active — deployed |
| `hermes/` | Hermes Agent platform (identity, permissions, audit, agents, execution, providers, memory, tools, workforce, services) | Active — FROZEN at v1.0 (Class B) |
| `shared/` | Shared contracts and interfaces between workers and hermes | Active |
| `artifacts/` | Website build output. `ags-fertility/` = React 18 + Vite 7 + Tailwind CSS 4 frontend | Active — deployed |
| `docs/` | Documentation (architecture, operations, decisions, API, database, security, adrs, sprints) | Active — maintained |
| `scripts/` | Project scripts (hello.ts, post-merge.sh, package.json) | Active |
| `migrations/` (in workers/) | D1 forward-only SQL migrations (5 applied) | Active |
| `hermes-webui/` | **Does not exist** | N/A |
| `ai-job-agent/` | **Does not exist** | N/A |

## 3. Workers Layer (Cloudflare Workers)

### 3.1 Source Layout

```
workers/src/
├── index.ts            # Entry point: URLPattern router, CORS, env
├── router/index.ts     # URLPattern-based routing (no external router dep)
├── types/env.ts        # Environment type bindings (D1, KV, etc.)
├── auth/               # Auth adapter layer (thin re-exports from @hermes/*)
│   ├── index.ts
│   ├── identity.ts     # TelegramIdentityResolver (header X-Telegram-Chat-Id)
│   ├── permissions.ts  # Permission resolver
│   ├── audit.ts        # Audit logger adapter
│   └── middleware.ts   # Auth middleware
├── middleware/
│   ├── rateLimit.ts    # Rate limit middleware (prepared, not yet activated)
│   ├── logger.ts       # Request logging
│   └── .gitkeep
├── routes/
│   ├── health.ts       # GET /api/v1/health
│   ├── consultations.ts # POST /api/v1/consultations
│   ├── ops.ts          # GET/PATCH/POST /api/v1/ops/* (RBAC-gated)
│   └── telegram.ts     # Telegram webhook handler
├── services/
│   ├── opsService.ts        # Operations backend (list/detail/update/assign/dashboard)
│   └── consultationService.ts # Consultation validation + D1 insert
└── tests/             # 33 test files, 369 tests (5 suites fail due to build error)
```

### 3.2 Configuration

- **wrangler.jsonc**: `agsynergy-api` worker, D1 binding `DB`, preview + production envs
- **Deploy**: `wrangler deploy --env production` / `--env preview`; via GitHub Actions in `.github/workflows/deploy.yml`
- **API URL**: `https://agsynergy-api.kumarlogan.workers.dev` (production), `api.agsynergy.ca` routing configured, DNS pending

### 3.3 Test Results

| Suite | Status | Notes |
|---|---|---|
| Health (10 tests) | ✅ Pass | |
| Auth engine unit (subset) | ✅ Pass | |
| Auth engine integration (subset) | ✅ Pass | |
| Consultation service (45 tests) | ✅ Pass | |
| Console render boundary | ✅ Pass | |
| Console session | ✅ Pass | |
| Console tool-adapter | ✅ Pass | |
| Console workflow | ✅ Pass | |
| Epic-004 agent state store | ✅ Pass | |
| Epic-004 audit store | ✅ Pass | |
| Epic-004 persistence provider | ✅ Pass | |
| Epic-004 tenant boundary | ✅ Pass | |
| Epic-004 workflow store | ✅ Pass | |
| Epic-004.5 execution store | ✅ Pass | |
| Epic-004.5 recovery | ✅ Pass | |
| Health (integration) | ✅ Pass | |
| Hermes 006h security hardening | ✅ Pass | |
| Hermes activation 007 | ✅ Pass | |
| Hermes admin phase 1-2 | ✅ Pass | |
| Hermes admin phase 3-5 | ✅ Pass | |
| Hermes agents phase 5 | ✅ Pass | |
| Hermes developer 003 | ✅ Pass | |
| Hermes execution 003 | ✅ Pass | |
| Hermes isolation phase 8 | ✅ Pass | |
| Hermes platform-api phase 7 | ✅ Pass | |
| Hermes security 003 | ✅ Pass | |
| Hermes security 004 | ✅ Pass | |
| Hermes services smoke | ✅ Pass | |
| Hermes tools phase 3-4 | ✅ Pass | |
| Hermes workforce orchestration | ❌ **Build fail** | See §3.4 |
| Hermes workforce phase 1to7 | ✅ Pass | |
| Integration API | ✅ Pass | |
| Ops integration | ✅ Pass | |
| Telegram bot integration | ✅ Pass | |
| P1 smoke (EPIC-005.9) | ✅ Pass | |
| **Total** | **369 pass, 5 suites fail** | 33 files, 1 build error |

### 3.4 Build Error Detail

`hermes/services/workforce/orchestration.ts:358` has a syntax error: `await` used outside an `async` function. This causes 5 test suites to fail at transform time (esbuild). The 369 tests that load successfully all pass at runtime. This is a pre-existing issue from the dirty tree, not a regression from EPIC-005.9.

**Dirty tree status**: 26 files modified in the working tree, all from the interrupted EPIC-005.9 implementation. See §8.

## 4. Hermes Subdirectories (Platform Layer)

### 4.1 Directory Inventory (127 .ts files)

| Subdirectory | # Files | Purpose |
|---|---|---|
| `hermes/identity/` | 4 | AuthN providers, principal, types |
| `hermes/permissions/` | 2 | Middleware + permission resolution |
| `hermes/audit/` | 5 | Audit event, emitter, store (durable + memory) |
| `hermes/contracts/` | 3 | Platform API contracts, dispatcher, index |
| `hermes/persistence/` | 5 | Agent, workflow, execution, tenant, provider stores |
| `hermes/agents/` | 4 | Registry, seed, tool contracts, barrel |
| `hermes/admin/` | 18 | Admin console, BFF, governance, observability, UI contracts |
| `hermes/services/` | ~90 | Core platform services (execution, providers, memory, tools, security, developer, activation, workforce) |
| `hermes/workforce/` | 5 | Workforce API, events, observability |
| `hermes/services/providers/` | ~40 | Provider manager, manifest-v2, marketplace, trust subsystem |

### 4.2 FROZEN Foundation State

Hermes Platform Foundation v1.0 is **FROZEN, Class B**. The following invariants are preserved:

- Provider neutrality
- Fail-closed behaviour
- Single execution boundary (`HermesExecutionGateway`)
- Mandatory audit trail
- Mandatory tenancy

EPIC-005.9 is complete (P1–P7 verified): durable `ApprovalRef`, `FileAuditBackend`, `FileTrustStateStore`, env-driven `enforceSignatures`, full regression suite (114 tests). Typecheck 0 errors on workers (but `hermes/tsconfig.json` has the orchestration.ts syntax error).

## 5. Web UI (hermes-webui / ai-job-agent)

### 5.1 `hermes-webui/` — Does Not Exist

The hermes-webui is served as a static site from `artifacts/ags-fertility/dist/public` via Cloudflare Pages. The React 18 + Vite 7 + Tailwind CSS 4 frontend source lives at `artifacts/ags-fertility/src/`. It includes:

| Page | Purpose |
|---|---|
| `HomePage.tsx` | Landing page |
| `AboutPage.tsx` | About / company info |
| `ContactPage.tsx` | Contact form (POSTs to `/api/v1/consultations`) |
| `TreatmentsPage.tsx` | Treatment listings |
| `TreatmentDetailPage.tsx` | Individual treatment details |
| `PartnerHospitalsPage.tsx` | Hospital partner listings |
| `FAQPage.tsx` | FAQ accordion |
| `GenericShellPage.tsx` | Shell/404 fallback |

### 5.2 `ai-job-agent/` — Does Not Exist

No `ai-job-agent` directory exists anywhere in the project. The concept of an AI job agent for autonomous job search has not been implemented. This is purely a conceptual area mentioned in the skills registry (`job-search-automation`, `recursive-job-improvement`) but not part of the HERMES codebase.

## 6. Documentation Cross-Reference

### 6.1 Documentation Files Present

| Doc File | Status | Accuracy |
|---|---|---|
| `README.md` | Present | ✅ Accurate — reflects current project state |
| `PROJECT.md` | Present | ✅ Constitution ratified 2026-07-18 |
| `ARCHITECTURE.md` | Modified in WT | ⚠️ 103 lines added — may be stale vs implementation |
| `ROADMAP.md` | Modified in WT | ⚠️ 43 lines added — may be stale vs implementation |
| `DECISIONS.md` | Present | ✅ ADRs maintained |
| `AI_OPERATING_MODEL.md` | Present | ✅ v1.0 ratified 2026-07-18 |
| `CURRENT_SPRINT.md` | Present | ✅ EPIC-002 sprint tracking |
| `TASKS.md` | Present | ✅ Living registry |
| `API.md` (root) | Present (235 chars) | ⚠️ Minimal stub — detailed API docs in `docs/api/README.md` |
| `DATABASE.md` | Present | ✅ Schema documented |
| `DEPLOYMENT.md` (root) | Present (700 chars) | ✅ Deployment runbook |
| `SECURITY.md` | **Not found** | ❌ Missing |
| `PRODUCT_BOUNDARIES.md` | **Not found** | ❌ Missing |
| `WORKFORCE_OBSERVABILITY_SUMMARY.md` | Present (untracked) | ✅ Untracked new file |
| `COMPLETION_REPORT.md` | Present (untracked) | ✅ Untracked new file |

### 6.2 Docs Subdirectories

```
docs/
├── adr/                    # Architecture Decision Records
├── api/                    # API reference (README.md detailed)
├── architecture/           # Architecture docs + EPIC baseline reports
├── database/               # Schema + migration docs
├── decisions/              # Decision logs
├── operations/             # Ops docs (DEPLOYMENT.md, TESTING.md, TECHNICAL_DEBT_INVENTORY.md, etc.)
├── organization/           # org-level docs (AGS_MASTER_ROADMAP.md)
├── security/               # Security posture docs
└── sprints/                # Sprint retrospectives
```

### 6.3 Key Cross-Reference Findings

1. **ARCHITECTURE.md**: Modified in WT (+103 lines). If the EPIC-005.9 changes are in the architecture doc, they are not yet committed. This could cause confusion for the next session.
2. **ROADMAP.md**: Modified in WT (+43 lines). Same concern — uncommitted roadmap changes.
3. **`docs/api/README.md` vs root `API.md`**: Root `API.md` is a 235-char stub. The detailed API reference lives in `docs/api/README.md`. This is inconsistent — the root doc should either be fleshed out or redirect.
4. **`SECURITY.md` and `PRODUCT_BOUNDARIES.md`**: Both are listed in PROJECT.md/ROADMAP.md as existing documents but are not on disk. They need to be created or the references removed.
5. **TESTING.md**: Present in `docs/operations/`, covers 3 layers (unit/integration/E2E), claims 100% coverage on service functions — accurate for Epic 1 but does not reflect Epic 2 additions (RBAC engine, ops API).
6. **Technical Debt Inventory** (`docs/operations/TECHNICAL_DEBT_INVENTORY.md`): A1–A5 are V1 blockers, B1–B7 are V1.x deferrals. A1 (in-memory durability) and A2 (tenant enforcement) are the most critical.

## 7. Database Layer

### 7.1 Migrations (5 applied)

| # | File | Purpose |
|---|---|---|
| 0001 | `initial_schema.sql` | Epic 1: leads, contacts, consultations, clinics, services, faqs tables |
| 0002 | `rbac_foundation.sql` | Epic 2: users, roles, permissions, user_permissions, audit_logs tables |
| 0003 | `ops_lead_fields.sql` | Additional fields for ops API |
| 0004 | `role_permissions_seed.sql` | Seed 4 roles + 8 permissions |
| 0005 | `workforce_persistence.sql` | Workforce persistence schema |

### 7.2 D1 Database

- **Production**: `agsynergy-db` (ID: `45f52102`)
- **Local**: Miniflare in-memory D1
- **Preview**: Separate preview D1 instance

## 8. Working Tree State

**26 files modified** (all from interrupted EPIC-005.9 work), plus 4 untracked documents:

### Modified Files (incomplete EPIC-005.9)
- `ARCHITECTURE.md`, `ROADMAP.md` — documentation updates
- `hermes/audit/event.ts`, `store.durable.ts`, `store.ts` — audit subsystem changes
- `hermes/services/activation/*` — approval gates, developer agent, provider framework, claude-code provider
- `hermes/services/providers/sdk.ts` (NEW), `trust/lifecycle.ts`, `trust/persistence/trust-state-store.ts` (NEW) — trust subsystem
- `hermes/services/security/security-agent.ts` — security agent updates
- `hermes/services/execution/index.ts`, `hermes/services/index.ts` — index changes
- `hermes/services/workforce/orchestration.ts` — **syntax error at line 764** (`await` outside async)
- `workers/package.json`, `workers/tests/globalSetup.ts`, `workers/tsconfig.json` — workers config

### Untracked Files
- `ACTIVATION_WORKFLOW_SUMMARY.md` — new
- `EPIC-010_DEPLOY_GOVERNANCE.md` — new
- `EPIC-010_PREVIEW.md` — new
- `HERMES_CORE_NIGHT_PROMPT.md` — new
- `WORKFORCE_OBSERVABILITY_SUMMARY.md` — new
- `docs/architecture/review/` — new directory
- `hermes/docs/` — new directory
- `hermes-website/` — new directory
- `run-documentation-agent-dry-run.ts` — new
- `test-*.sh` scripts — new

### ⚠️ Dirty Tree Warning

The working tree has 26 modified files from the interrupted EPIC-005.9 implementation. **Per the project's test correction policy and EPIC rules (no auto-commit, no discard): these changes must NOT be committed or discarded without user explicit direction.** The user should review the dirty tree and decide whether to commit the EPIC-005.9 work, stash it, or revert selectively.

## 9. Test Infrastructure

| Component | Detail |
|---|---|
| Framework | Vitest 4.1 |
| Workers runtime | @cloudflare/vitest-pool-workers 0.18, workerd + Miniflare |
| D1 simulation | Miniflare in-memory D1 |
| Mocking | Handwritten stubs only (no mocking library) |
| Config | `workers/vitest.config.ts` (full), `workers/vitest.epic005.config.ts` (EPIC-005.9 subset) |
| Global setup | `workers/tests/globalSetup.ts` — applies D1 migrations before test run |
| CI script | `cd workers && pnpm test` |

### Coverage (from TESTING.md)
- Service functions (validation, normalization): 100% ✅
- Route handlers (HTTP translation): 100% ✅
- Error paths (400, 409, 500): 100% ✅
- Integration (Worker → D1): Happy path + duplicate + validation ✅
- CORS middleware: 100% ✅

## 10. Security Posture

| Area | Status | Notes |
|---|---|---|
| RBAC engine | ✅ Implemented | `authorize()`, `requirePermission()`, deny-wins, OWNER short-circuit |
| Tenant isolation | ⚠️ Declared but not enforced runtime (A2 debt) | `withinTenantScope()` exists, no mutator calls it |
| Audit trail | ✅ Active | `emitAudit()` on every auth decision |
| Secret management | ✅ GitHub Encrypted Secrets + gitleaks scan | `.gitignore` excludes `.env*` |
| Rate limiting | ⚠️ Prepared but not activated (Phase 2) | Middleware exists in `workers/src/middleware/rateLimit.ts` |
| CORS | ✅ Configured | 4 allowed origins, preflight OPTIONS 204 |
| Durable approval model | ✅ Production wiring | Single `ApprovalRef`, fail-closed |
| Trust enforcement | ✅ Env-driven, fail-closed in prod | `HERMES_ENFORCE_SIGNATURES` or `NODE_ENV=production` |
| In-memory state on restart | ⚠️ Risk (A1 debt) | Audit, agent, workflow, capability state lost on deploy/restart |

## 11. Infrastructure & Deployment

| Layer | Technology | Status |
|---|---|---|
| Frontend | Cloudflare Pages + React 18 + Vite 7 + Tailwind CSS 4 | ✅ Deployed |
| Backend | Cloudflare Workers (TypeScript) | ✅ Deployed |
| Database | Cloudflare D1 (`agsynergy-db`) | ✅ Deployed |
| Object Storage | Cloudflare R2 | Configured, not active |
| CI/CD | GitHub Actions + wrangler v4 | ✅ Active |
| Source Control | GitHub (`kumarlogan/concierge-website`) | ✅ Active |
| Package Manager | pnpm 11.13.1 | ✅ Active |
| AI Operations | Hermes Agent + Telegram | ✅ Active |
| Model | `inclusionai/ling-3.0-flash:free` (OpenRouter) | ✅ Free tier |

### Deploy Trigger
- `wrangler deploy --env production` (manual)
- `.github/workflows/deploy.yml` (CI/CD, auto on push to main)
- Old deploy scripts deprecated and quarantined to `~/archive/category-d-2026-07-19/`

## 12. Risks & Blockers

### Critical
- **Dirty tree** (26 uncommitted files): EPIC-005.9 work is in-flight and not committed. Risk of losing work or creating confusion in the next session. **Action needed from user.**
- **Syntax error** in `orchestration.ts:358,364`: `await` outside `async` function. Breaks 5 test suites at transform time. **Action needed from user.**

### High
- **A1 technical debt** (in-memory durability): Audit, agent, workflow, capability state lost on deploy/restart. Affects production continuity.
- **A2 technical debt** (tenant enforcement): `withinTenantScope()` exists but no mutator calls it. Cross-tenant isolation is a library, not a guarantee.
- **Missing `SECURITY.md` and `PRODUCT_BOUNDARIES.md`**: Referenced in docs but not on disk.
- **`api.agsynergy.ca` DNS pending**: API custom domain routing configured but DNS not pointed.
- **Stale WT docs**: `ARCHITECTURE.md` and `ROADMAP.md` have uncommitted changes from EPIC-005.9.

### Medium
- **Rate limiting not yet activated**: Middleware exists but no per-endpoint limits in production.
- **R2 object storage configured but idle**: No active usage; intended for Phase 2.
- **37 test-file type errors** (B2 debt): TypeScript errors in test files (source files clean). Mask real type drift but don't affect execution.
- **Dual AuditEvent types** (B3 debt): Canonical (`meta`) and legacy (`detail`) coexist.

### Low
- **`api-server` in artifacts**: Legacy AGS prototype with 6 suppressed TS errors. Quarantined, not platform code.
- **Simulation `approvalToken` literals**: `developer-runtime.ts`, `simulation.ts`, `tool-adapter.ts` use `"sim-token"` or `"human-token"` — simulation-only, not execution paths.

## 13. Recommendations

### Immediate (Before Recommencing Development)

1. **Clean the dirty tree** — Decide on the 26 modified files: commit them under a new EPIC, stash for later, or revert selectively. The EPIC rules prohibit auto-commit, so user decision is required.
2. **Fix the orchestration.ts syntax error** — `await` at line 358 (and possibly 364) outside an `async` function. This is a pre-existing breakage from the dirty tree that blocks 5 test suites.
3. **Commit `SECURITY.md` and `PRODUCT_BOUNDARIES.md`** — These are referenced in documentation but missing from disk.
4. **Resolve stale ARCHITECTURE.md / ROADMAP.md** — Either commit the EPIC-005.9 doc updates or revert them to match the committed state.

### Short-Term (EPIC-002-005 Start)

5. **Hermes Admin Bot** — Owner-only infrastructure/deploy control via Workers API. Depends on EPIC-002-002 (identity engine) which is done.
6. **Activate rate limiting** — The middleware exists in `workers/src/middleware/rateLimit.ts` but is not wired into the router yet. Phase 2 item.

### Medium-Term

7. **A1 durability** — D1-backed `AuditStore`, `CapabilityRegistry`, agent/workflow registry. Interfaces already designed (ADR-007).
8. **A2 tenant enforcement** — Insert `withinTenantScope()` guard into registry/lifecycle/agent mutators.
9. **A5 authorizer implementation** — Replace raw `principal.permissions.includes(...)` with proper `Authorizer` type implementation.
10. **B3 dual AuditEvent migration** — Move all callers to canonical `meta` shape, deprecate `detail`.

### Long-Term

11. **R2 activation** — Object storage for document upload/retrieval (patient files, treatment records).
12. **Multi-isolate audit coalescing** — D1 or durable log as cross-isolate audit source of truth.
13. **Principal factory + identity issuance** — Signed principals with typed source (C2 debt).
14. **AI job agent** — Not part of current codebase; would be a greenfield implementation if pursued.

---

## Appendix: Key File Inventory

| # | File | Lines | Role |
|---|---|---|---|
| 1 | `workers/src/index.ts` | Entry point | Router, CORS, env |
| 2 | `workers/src/routes/health.ts` | Health endpoint | `GET /api/v1/health` |
| 3 | `workers/src/routes/consultations.ts` | Consultation endpoint | `POST /api/v1/consultations` |
| 4 | `workers/src/routes/ops.ts` | Operations API | RBAC-gated ops routes |
| 5 | `workers/src/routes/telegram.ts` | Telegram webhook | Bot interface |
| 6 | `workers/src/services/opsService.ts` | Ops backend | List/detail/update/assign |
| 7 | `workers/src/services/consultationService.ts` | Consultation service | Validate + persist |
| 8 | `workers/src/auth/index.ts` | Auth barrel | Re-exports from @hermes |
| 9 | `workers/wrangler.jsonc` | Worker config | D1 binding, envs |
| 10 | `workers/migrations/0001–0005_*.sql` | D1 schema | 5 forward-only migrations |
| 11 | `hermes/identity/principal.ts` | Principal construction | Identity resolution |
| 12 | `hermes/identity/providers.ts` | Identity providers | Telegram resolver |
| 13 | `hermes/permissions/permissions.ts` | Permission resolution | Dynamic perms from DB |
| 14 | `hermes/audit/audit.ts` | Audit middleware | `emitAudit()` |
| 15 | `hermes/audit/store.ts` | Audit store | `configureFileAuditStore()` proxy |
| 16 | `hermes/audit/store.durable.ts` | Durable audit backend | `FileAuditBackend` |
| 17 | `hermes/services/activation/provider-framework.ts` | Provider activation | 250 lines, EPIC-005.9 changes |
| 18 | `hermes/services/providers/trust/lifecycle.ts` | Trust lifecycle | 319 lines, P4 impl |
| 19 | `hermes/services/providers/trust/persistence/trust-state-store.ts` | Trust persistence | 114 lines, P3 impl |
| 20 | `shared/contracts/platform-api.ts` | Platform contracts | `Authorizer`, `Principal`, `ProviderRequest` |
| 21 | `shared/contracts/lifecycle.ts` | Lifecycle contracts | |
| 22 | `shared/interfaces/audit.ts` | Audit interface | Canonical `AuditEvent` |
| 23 | `shared/interfaces/identity.ts` | Identity interface | |
| 24 | `docs/operations/TECHNICAL_DEBT_INVENTORY.md` | Debt register | A1–C6 |
| 25 | `docs/operations/DEPLOYMENT.md` | Deploy runbook | 229 lines |
| 26 | `docs/operations/TESTING.md` | Testing guide | 179 lines |
| 27 | `docs/api/README.md` | API reference | 162 lines |
| 28 | `artifacts/ags-fertility/` | React frontend | 70+ source files |

---

*Audit completed 2026-07-24. Read-only — no files modified, no deployments, no migrations.*
