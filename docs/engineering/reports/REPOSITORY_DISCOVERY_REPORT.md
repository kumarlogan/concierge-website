# Repository Discovery Report
## `kumarlogan/concierge-website` — Phase 1 Discovery
**Date:** 2026-08-04 | **Branch:** `main` (HEAD `35a665e`) | **Status:** Read-only — no code modified

---

## 1. Purpose and Method

### What Was Done
A read-only structural discovery of the `kumarlogan/concierge-website` repository was conducted on 2026-08-04. Nine parallel sub-agents each covered a distinct scope (Build/CI/CD, API Worker, Platform Subsystems, Frontend, Data Layer, Shared Libraries, Root Docs, Docs Tree, Repository Activity). All source material was obtained by reading individual files via the GitHub API. No repository clone was performed.

### What Was NOT Done
- No code was modified, no commits were made, no branches were created.
- No product redesign, platform architecture change, or process recommendation was produced here.
- No exhaustive import scan was performed across all 222+ `hermes/` TypeScript files; coverage of that directory is based on directory listings, index files, and targeted reads.

### Reproducibility
To repeat this discovery: (1) enumerate all top-level directories via the GitHub Trees API; (2) read `package.json`, `pnpm-workspace.yaml`, `tsconfig.json`, `.github/workflows/*.yml`, and `wrangler.jsonc` / `workers/wrangler.jsonc`; (3) read all SQL files under `workers/migrations/`; (4) search for `*.test.ts` and `*.tsx` files via GitHub Code Search; (5) read all `*.md` files at the repo root; (6) list `docs/` subdirectories via the Trees API and read representative files; (7) fetch the commit log (`/repos/{owner}/{repo}/commits`) for 150+ entries. The complete file-read log is traceable through source reports A–I (see Section 12).

---

## 2. Repository at a Glance

| Fact | Value |
|---|---|
| Repository | `kumarlogan/concierge-website` (formerly `hermes-website`) |
| Primary branch | `main` |
| Discovery HEAD | `35a665e` (2026-08-04) |
| Monorepo manager | pnpm 11.13.1 (`packageManager` field) |
| Node version pin | `.node-version` = 22; `.replit` = nodejs-24 [OBSERVED — mismatch] |
| Deployed units | 2 Cloudflare Workers: `hermes-website` (SPA) + `agsynergy-api` (API) |
| Production domains | `agsynergy.ca`, `www.agsynergy.ca` (SPA) · `api.agsynergy.ca` (API) |
| D1 databases (declared) | `agsynergy-db` (primary, bound as `DB`) · `agsynergy-notifications` (bound as `NOTIFICATIONS`, database_id = "" — unprovisioned) |
| R2 buckets | `agsynergy-documents` (prod) · `agsynergy-documents-preview` |
| D1 migration files | 12 (migrations 0001–0010 + 011; two files share prefix `0002_`) |
| D1 tables | 68 distinct tables [OBSERVED] |
| API endpoint count | ~110 HTTP endpoints (excluding Identity sub-paths) [OBSERVED from B] |
| Test files | 68 `.test.ts` files [OBSERVED from A] |
| Root markdown docs | 47 files [OBSERVED from G] |
| `docs/` markdown files | 467 files across 26 subdirectories [OBSERVED from H] |
| Worker service version | `1.1.0` (`workers/src/version.ts`) — stale vs CHANGELOG latest `1.6.0` [OBSERVED from I] |
| Commit range covered | 2026-07-07 through 2026-08-04 (150-commit sample) |
| Primary author | `kumarlogan` (147/150 sampled commits) |
| Fix-churn rate | ~26% of commits carry `fix:` / `fix(scope):` prefix [OBSERVED from I] |

---

## 3. Repository Structure

```
concierge-website/
├── artifacts/                  ← Deployable sub-packages (SPA + legacy server + sandbox)
│   ├── ags-fertility/          ← PRODUCTION SPA (React/Vite; built and deployed)
│   ├── api-server/             ← Legacy Express prototype (NOT deployed; deprecated)
│   └── mockup-sandbox/         ← Design sandbox (NOT deployed; duplicate UI components)
├── hermes/                     ← AI workforce control plane (222+ TS files; NOT a pnpm package)
├── hermes-website/             ← MISLEADING NAME: backend test scripts only, no frontend code
│   ├── test-activation-workflow.sh
│   └── test-workforce-integration.ts
├── lib/                        ← Shared TypeScript libraries (pnpm workspace packages)
│   ├── api-client-react/       ← ACTIVE: React Query API client consumed by SPA
│   ├── api-spec/               ← Orval codegen config + openapi.yaml (dev tooling only)
│   ├── api-zod/                ← DEPRECATED: Zod schemas for legacy Express server
│   └── db/                     ← DEPRECATED: Drizzle/PostgreSQL schema for legacy server
├── scripts/                    ← CI/dev helper scripts (pnpm package)
├── shared/                     ← Provider-neutral contracts and interfaces (NOT a pnpm package)
├── workers/                    ← Cloudflare Worker API backend (pnpm package)
│   ├── migrations/             ← D1 SQL migration files
│   ├── src/                    ← Worker source (index.ts entrypoint)
│   │   ├── platform/           ← 130+ TS files: 15 platform subsystems
│   │   ├── routes/             ← 13 route files
│   │   ├── middleware/         ← 5 middleware files
│   │   └── services/           ← 2 service files
│   ├── tests/                  ← Vitest test suite (68 test files total across repo)
│   └── vitest.config.ts
├── .github/workflows/          ← 3 GitHub Actions workflows
├── .hermes/                    ← AI agent planning artifacts (2 markdown files; not code)
├── attached_assets/            ← 4 Replit paste artifacts (build logs + spec doc; not runtime)
├── docs/                       ← 467 markdown files across 26 subdirectories
├── .gitleaks.toml
├── .node-version               ← "22"
├── .replit                     ← Replit config (nodejs-24, autoscale deployment)
├── package.json                ← Root workspace (name: "workspace")
├── pnpm-workspace.yaml
├── tsconfig.json               ← Project references: lib/db, lib/api-client-react, lib/api-zod
├── vitest.config.ts            ← Root vitest config
└── wrangler.jsonc              ← Root Cloudflare Worker config (deploys `hermes-website` SPA)
```

### Two Misleading Names

**`hermes-website/`** is not a frontend. It contains `test-activation-workflow.sh` and `test-workforce-integration.ts` — backend integration test scripts. The directory has no `package.json`, no HTML, and no React code. [OBSERVED from D]

**`artifacts/`** is not a build-output directory in the conventional sense. It is a live set of actively-maintained pnpm workspace sub-packages. `artifacts/ags-fertility/` is the production SPA that is built and deployed. The naming reflects Replit's "managed artifact workflow" pattern. [OBSERVED from D; INFERRED naming origin from vite.config.ts comment]

---

## 4. Backend: The API Worker

### Identity
- Package: `@workspace/workers` at `workers/`
- Cloudflare Worker name: `agsynergy-api`
- Version: `1.1.0` (`workers/src/version.ts`) [OBSERVED]
- Entrypoint: `workers/src/index.ts`

### Request Lifecycle
Every inbound request passes through this fixed chain [OBSERVED from B]:

```
fetch(request, env)
 1. createSafeD1(env.DB) — undefined → null coercion proxy
 2. wirePlatformEngines(safeEnv) — injects 8 platform engine singletons into env
 3. Structured log: request.start
 4. rateLimit (per-IP sliding window, in-process Map — per-isolate only)
 5. CORS preflight (OPTIONS → 204)
 6. router.fetch(request, safeEnv) — URLPattern first-match dispatch
 7. Append CORS response headers
 8. Append X-RateLimit-* headers
 9. applySecurityHeaders (HSTS, CSP, X-Frame-Options, X-Content-Type-Options, etc.)
10. Structured log: request.complete
11. Return finalResponse
```

### Endpoint Inventory (by Route File)

Full per-endpoint detail is in report B. Summary by file:

| Route File | Endpoint Count | Auth Method | Domain |
|---|---|---|---|
| `routes/health.ts` | 1 | None | Liveness probe |
| `routes/consultations.ts` | 1 | None + Turnstile + honeypot | Lead submission |
| `routes/contact.ts` | 1 | None | Contact form |
| `routes/ops.ts` | 7 | RBAC (`requirePermission`) | Operations lead management |
| `routes/telegram.ts` | 1 | Optional secret token | Ops bot webhook |
| `routes/adminBot.ts` | 1 | Optional secret token | Admin bot webhook |
| `routes/trustRuntime.ts` | 11 | JWT (RS256) | Trust/consent/policy/delegation |
| `routes/documents.ts` | 16 | JWT | Document storage + caregiver |
| `routes/wave7.ts` | 51 | JWT | Appointments, messaging, notifications, workflows, tasks, queue |
| `routes/timeline.ts` | 10 | JWT | IVF journey timeline |
| `routes/clinic.ts` | 5 | JWT | Clinic patient/schedule (mock data) |
| `routes/clinic-messages.ts` | 6 | JWT | Clinic messaging (mock data) |
| `routes/coordination.ts` | 4 | JWT | Multi-provider coordination |
| `/identity/*` (catch-all) | 2 registrations (GET + POST) | Identity platform self-wired | Auth, OAuth, MFA, sessions |

Total: approximately 110 HTTP endpoints (Identity sub-paths not enumerated — handled internally by `IdentityRouter`). [OBSERVED from B]

### Three Coexisting Auth Paths

**A. JWT Bearer (RS256)** — all Wave 3+ protected routes via `withJwtAuth()` in `middleware/jwt-auth.ts`. Token extracted from `Authorization: Bearer <token>`. Verified against `env.PLATFORM_JWT_PUBLIC_KEY`. Claims extracted to `x-authenticated-*` headers. Valid issuers: `ai-platform:identity-core`, `ai-platform:concierge`. [OBSERVED from B]

**B. Data-driven RBAC** — Operations API and Telegram bots via `requirePermission(db, request, permission)` from `@hermes/permissions/middleware`. Resolves identity from `X-Telegram-Chat-Id` / `X-Telegram-Display-Name` headers (bots) or JWT (HTTP). Permissions stored in D1 `role_permissions` table. [OBSERVED from B]

**C. Identity platform self-wired** — `/identity/*` paths dispatched to `IdentityRouter` which self-constructs `IdentityService`, `SessionManager`, `JwtManager`, `MagicLinkManager`, `OAuthService`, `MFAManager`. Handles registration, login, magic-link, OAuth/OIDC/SAML, MFA, token refresh. [OBSERVED from B, C]

---

## 5. Platform Subsystems

Full maturity evidence is in report C. The table below is reproduced from that source.

| Subsystem | Purpose | Maturity | HTTP Exposed | Persistence | Key Evidence |
|---|---|---|---|---|---|
| **EPCL** | Roadmap → deterministic execution plan; delegates via WAS | Partial — all 6 feature flags default `false`; unreachable in production | No live route | In-memory only | `DEFAULT_FLAG_STATE` all `false`; `requireExecutiveWorkflow()` throws if off |
| **WAS** | Activation boundary between EPCL and WEF; 7-state machine | Partial — WEF delegation is an explicit TODO stub | No live route | In-memory (D1 schema exists but `enablePersistence: false`) | `wef-delegator.ts`: "TODO: Replace with actual WEF delegation" |
| **WEF** | Pre-deployment health reporting; operational intelligence | Minimal — scaffolding only, no execution engine | No live route | N/A | Only `wef-operational-intelligence.ts` exists |
| **Trust** | Multi-engine authorization: trust score, consent, policy, delegation, risk, decision | Fully implemented; 11 live routes | Yes | In-memory singletons (D1 tables exist but engines use Maps) | Singletons wired in `index.ts`; `/api/v1/trust/*` registered |
| **Identity** | Full-stack auth: JWT, OAuth/OIDC/SAML, MFA, magic links, sessions | Fully implemented; self-wiring router | Yes (`/identity/*`) | D1-backed (`IdentityRepository` uses `env.DB`) | `IdentityRouter` constructed with all 8 service dependencies |
| **Workflow** | IVF patient journey state machine; D1-backed event sourcing; tasks; approval gates; timers | Substantially implemented; 30+ routes | Yes | D1-backed (EventStore, TaskOrchestrator, etc.) | `buildWorkflowEngine()` wires D1; Wave 8 delivery |
| **Documents** | PHI/non-PHI document storage; AES encryption; consent gating; D1 audit | Fully implemented; singleton | Yes | D1 (metadata) + R2 (files); audit via `InMemoryAuditStorage` fallback | DocumentService singleton + R2 binding in `wrangler.jsonc` |
| **Notifications** | Multi-channel delivery; escalation; analytics; D1 store | Partial — delivery is simulated ("Simulate delivery" comment) | Yes (7+ routes) | D1 (`D1NotificationStore`) + in-memory coexist | `delivery-engine.ts`: no real FCM/SES/Twilio calls |
| **Appointments** | Appointment CRUD; slot checking; consent gating | Partial — no D1 persistence | Yes (6 routes) | `InMemoryAppointmentEngine` via `globalThis` | `getAppointmentEngine()` returns in-memory only |
| **Messaging** | Threaded messaging; consent gating | Partial — no D1 persistence | Yes (3 routes) | `InMemoryMessageEngine` via `globalThis` | No `messages` table in any migration |
| **Timeline** | IVF stage/milestone tracking; expected dates | Partial — no D1 persistence | Yes (10 routes) | `InMemoryTimelineEngine` per-request | Comment: "In production this would be backed by D1/KV" |
| **Providers** | Registry of external provider integrations | Partial — in-memory registry | No direct route | `InMemoryProviderRegistry` singleton | Used internally by WEF health reporting |
| **Credentials** | Credential registry; rotation; health checks; audit | Partial — in-memory only | No direct route | `InMemoryCredentialRegistry` singleton | All in-memory Maps |
| **Release** | Release registry; env resolution; deployment services; rollback | Partial — in-memory only | No direct route | `InMemoryReleaseRegistry` | No Cloudflare API calls |
| **d1.ts** | D1 safe wrapper: `undefined` → `null` coercion proxy | Fully implemented — P0 production fix | Yes (every request) | N/A | `createSafeD1` wraps `env.DB` at request boundary |

**Known defect [OBSERVED]:** `env.AUTHORIZATION_ENGINE` is declared in `workers/src/types/env.ts` and called by `POST /api/v1/authorization/check` and `GET /api/v1/permissions`, but is never injected in `wirePlatformEngines()`. Both endpoints will throw a runtime `TypeError` at invocation. This is explicitly documented in a code comment in `workers/src/index.ts`.

---

## 6. Frontend

### Stack [OBSERVED from D]

| Layer | Technology |
|---|---|
| Framework | React 18 |
| Build tool | Vite (config at `artifacts/ags-fertility/vite.config.ts`) |
| Language | TypeScript (.tsx throughout) |
| Styling | Tailwind CSS v4 via `@tailwindcss/vite` (no config file) |
| Component library | shadcn/ui pattern — 40+ Radix UI primitives in `src/components/ui/` |
| Routing | Wouter v3 |
| Server state | TanStack React Query |
| Auth state | Custom `AuthProvider` context (`src/lib/auth-context.tsx`) |
| Forms | react-hook-form + Zod |
| Animation | framer-motion |
| Charts | recharts |
| Icons | lucide-react, react-icons |

Build output: `artifacts/ags-fertility/dist/public/`. API base URL: `VITE_API_BASE` env var (injected at build from GitHub Secret; falls back to `https://api.agsynergy.ca`).

### Page Inventory (from `artifacts/ags-fertility/src/App.tsx`) [OBSERVED from D]

| Area | Route Count | Auth Guard |
|---|---|---|
| Public marketing pages | 12 | None |
| Legal pages | 2 | None |
| Placeholder shell pages | 3 (`GenericShellPage`) | None |
| Patient auth pages (login, register, forgot-password) | 3 | `GuestGuard` |
| Patient workspace pages | 17 | `AuthGuard` + `PatientLayout` |
| Clinic workspace pages | 6 | `ClinicLayout` — **no AuthGuard** [OBSERVED] |

**Total routes:** 43. The clinic workspace has no frontend authentication guard.

### Auth Handling [OBSERVED from D]

Tokens stored in `localStorage` as `ags_patient_access_token` / `ags_patient_refresh_token` via `TokenStore` class in `src/lib/patient-api.ts`. All authenticated requests attach `Authorization: Bearer <token>`. Refresh triggered on 401 via `tryRefreshToken()` in `auth-context.tsx`.

### API Integration [OBSERVED from D]

Three separate API client modules coexist:
- `src/lib/patient-api.ts` — identity/auth endpoints; uses `VITE_API_BASE || "https://api.agsynergy.ca"`
- `src/lib/document-api.ts` — document endpoints; uses hardcoded relative `/api/v1`
- `src/lib/appointment-api.ts` — appointments; uses `VITE_API_BASE ?? ""` (empty fallback = relative)
- `lib/api-client-react/` — generated React Query hooks from OpenAPI spec (covers `/health`, `/consultations`, `/consultations/count` only)

The three base-URL strategies are inconsistent. [OBSERVED from D]

### Testing [OBSERVED from D]

Zero test files in `artifacts/ags-fertility/`. No `vitest.config.ts` in the SPA directory. No component tests, no integration tests.

---

## 7. Data Layer

### Migration Mechanism [OBSERVED from E]

Forward-only SQL files in `workers/migrations/`. Applied via `wrangler d1 migrations apply`. No rollback migrations by design. No custom migration runner. Two naming anomalies: two files share the `0002_` prefix (`0002_identity_core.sql` and `0002_rbac_foundation.sql`); migration `011_notifications.sql` is missing the leading zero in the naming scheme. No CI/CD migration pipeline was found.

### Table Groups [OBSERVED from E]

| Group | Migration(s) | Table Count | Notes |
|---|---|---|---|
| Operations core | 0001, 0003 | 6 | leads, contacts, clinics, consultations, services, faqs |
| Identity core | 0002_identity_core | 12 | identities, sessions, credentials, refresh_tokens, email_verifications, password_resets, oauth_accounts, events, audit, trust/consent snapshots |
| RBAC | 0002_rbac_foundation, 0004 | 6 | roles, permissions, users, user_permissions, role_permissions, audit_logs |
| Workforce/workflow (Hermes) | 0005 | 9 | workforce_agents, agent_activation_requests, agent_audit_events, workforce_metrics, workflows, workflow_tasks, workflow_approvals, workflow_granted_approvals, workforce_workflow_metrics |
| Trust runtime | 0006 | 13 | policies, policy_versions, consents*, consent_versions, trust_scores, trust_history, delegations, authorization_decisions, decision_audit, risk_events, policy_registry, consent_registry, trust_registry |
| Documents | 0007 | 5 | documents, document_shares, document_access_log, document_encryption_keys, caregiver_authorizations |
| Consent engine | 0008 | 1 new (consents* conflict) | consent_history + `consents` redefinition conflict |
| WAS state | 0009 | 1 | was_activation_state |
| Workflow engine | 0010 | 11 | workflow_instances, task_instances, approval_gates, workflow_timers, workflow_events, task_queue, workflow_dlq, workflow_templates, analytics_daily/weekly, workflow_overrides |
| Notifications | 011 | 5 | notifications, notification_delivery, notification_escalation, notification_analytics, notification_preferences |
| **Total** | — | **68** | |

**Critical schema conflict [OBSERVED]:** `0006_trust_runtime.sql` and `0008_consent_engine.sql` both issue `CREATE TABLE IF NOT EXISTS consents (...)` with different schemas. The 0008 schema adds `patient_identity_id`, `status`, `resource_type`, `resource_id`, `revoked_by`, `revoke_reason`, `updated_at`. Because of `IF NOT EXISTS`, whichever migration runs first wins; the other is silently skipped. The live `consents` table may lack columns that the `ConsentEngine` code expects.

**Timestamp inconsistency [OBSERVED]:** Migration 0010 uses `INTEGER` (Unix epoch ms) for timestamps; all other migrations use `TEXT` (ISO-8601). This is an internal schema inconsistency.

### D1 Access Layer [OBSERVED from E]

`workers/src/platform/d1.ts` — `createSafeD1(database: D1Database)` wraps the raw D1 binding with a Proxy that coerces `undefined` → `null` on all `.bind()` calls. Applied at request boundary in `index.ts`. All queries use D1's prepared-statement API (`env.DB.prepare(sql).bind(...).all()`). No transaction abstraction (D1 `batch()` is the closest available primitive). This wrapper was introduced as a P0 production fix.

### R2 Usage [OBSERVED from E]

Single R2 binding: `DOCUMENT_STORAGE` → bucket `agsynergy-documents`. Used by `workers/src/platform/documents/document-storage.ts` (`DocumentStorage` class) for PHI and non-PHI document files. PHI/non-PHI routing by bucket name is a metadata convention only — there is a single physical R2 bucket binding. Pre-signed URLs (1h default, 24h max) are generated for download.

### In-Memory Stores That Stand In for Persistence [OBSERVED from E]

| Store | Module | Data Lost On | Severity |
|---|---|---|---|
| `consentEngine` (singleton) | `platform/trust/consent-engine.ts` | Isolate restart | CRITICAL — consented grants evaporate |
| `delegationEngine` (singleton) | `platform/trust/delegation-engine.ts` | Isolate restart | CRITICAL — delegations evaporate |
| `InMemoryMessageEngine` | `platform/messaging/in-memory-message-engine.ts` | Isolate restart | HIGH — all messages lost |
| `InMemoryAppointmentEngine` | (via `globalThis`) | Isolate restart | HIGH — all appointments lost |
| `InMemoryTimelineEngine` | `routes/timeline.ts` | Per-request (new instance each call) | HIGH — no persistence at all |
| `notificationStore` (in-memory fallback) | `platform/notifications/in-memory-notification-store.ts` | Isolate restart | HIGH (if active vs D1 store) |
| `MemoryAgentBackend` | `hermes/persistence/agent-state-store.ts` | Isolate restart | HIGH |
| `MemoryWorkflowBackend` | `hermes/persistence/workflow-store.ts` | Isolate restart | MEDIUM |
| `MemoryExecutionBackend` | `hermes/persistence/execution-store.ts` | Isolate restart | MEDIUM |
| Rate limiter Map | `middleware/rateLimit.ts` | Isolate restart | LOW (expected behavior) |

Despite D1 tables existing for trust/consent/delegation data, the runtime engines are in-memory singletons. [OBSERVED from E, C]

---

## 8. Shared Code

### `hermes/` — AI Workforce Control Plane [OBSERVED from F]

Not a pnpm package. 222+ TypeScript files across ~15 subdirectories. Resolved via `@hermes/*` path alias (TypeScript: `workers/tsconfig.json`; Wrangler bundler: `workers/wrangler.jsonc` alias map). The Wrangler alias map uses explicit `.js` → `.ts` remapping to satisfy ESM import conventions at bundle time.

Key sub-directories: `identity/`, `permissions/`, `audit/`, `agents/`, `contracts/`, `services/` (12+ sub-services including registry, lifecycle, scheduler, activation, execution, security, workforce, tools, mcp, developer), `admin/`, `workforce/`, `persistence/`, `providers/`.

`hermes/` was extracted from `workers/src/auth/` during EPIC-002-006B. `workers/src/auth/` now contains re-export adapter files that forward to `@hermes/*`.

Dependency direction: `workers/` → `hermes/` (one-way). [INFERRED] A potential circular dependency was identified in `hermes/EPIC-007-plan.md` which states that `hermes/services/execution/` depends on `workers/src/platform/epcl/` — this would create `hermes/ → workers/` alongside `workers/ → hermes/`, yielding a circular import. Whether this was implemented as described is [UNKNOWN from file reads alone].

`hermes/permissions/` has its own `package.json` (name: `@hermes/permissions`) with explicit `exports` for `permissions.js` and `middleware.js`. `hermes/services/activation/` has its own `package.json`. These two sub-packages are the only explicitly declared sub-packages within `hermes/`.

### `lib/` — Four Workspace Libraries [OBSERVED from F]

| Package | Name | Status | Consumer |
|---|---|---|---|
| `lib/api-spec/` | `@workspace/api-spec` | Active (dev tooling only) | Generates into `lib/api-client-react/src/generated/` and `lib/api-zod/src/generated/` via Orval v8 |
| `lib/api-client-react/` | `@workspace/api-client-react` | **ACTIVE production** | `artifacts/ags-fertility` |
| `lib/api-zod/` | `@workspace/api-zod` | **DEPRECATED** (self-declared) | `artifacts/api-server` (not deployed) |
| `lib/db/` | `@workspace/db` | **DEPRECATED** (self-declared) | `artifacts/api-server` (not deployed) |

The `openapi.yaml` in `lib/api-spec/` describes only 3 paths (`GET /health`, `POST /consultations`, `GET /consultations/count`) — a small subset of the ~110 API endpoints actually implemented. [OBSERVED from F]

### `shared/` — Provider-Neutral Contracts [OBSERVED from F]

Not a pnpm package. Resolved via `@shared/*` alias. Two sub-directories: `contracts/` (resource/agent/lifecycle types and transition tables) and `interfaces/` (10 abstract provider interfaces: identity, permission, audit, datastore, object-storage, queue, notification, scheduler, secret, logging).

`hermes/` imports from `shared/` via relative paths (`../../shared/contracts/...`), not via the `@shared/` alias. Active usage in `hermes/contracts/platform-api.ts` and `hermes/agents/registry.ts`. Only one test file in `workers/` references `shared/interfaces` directly.

### `.hermes/` — AI Agent Working State [OBSERVED from F]

Two markdown files: `epic-002-005-plan.md` (unimplemented EPIC plan for Admin Bot) and `reconciliation-report.md` (repository reconciliation exercise classifying ~160 untracked files). Not imported by any code. Functions as the AI coding agent's persistent session-state store.

### Path Aliases [OBSERVED from F]

| Context | Alias | Resolves To |
|---|---|---|
| `workers/tsconfig.json` | `@hermes/*` | `../hermes/*` |
| `workers/tsconfig.json` | `@shared/*` | `../shared/*` |
| `workers/wrangler.jsonc` | `@hermes` | `../hermes` (directory) |
| `workers/wrangler.jsonc` | `@hermes/identity/principal.js` | `../hermes/identity/principal.ts` |
| `workers/wrangler.jsonc` | `@hermes/permissions/permissions.js` | `../hermes/permissions/permissions.ts` |
| `workers/wrangler.jsonc` | (9 more explicit `.js→.ts` remappings) | See report F |
| `artifacts/ags-fertility` Vite | `@` | `src/` |

**Gap [OBSERVED]:** `@hermes/permissions/middleware.js` is not listed in the Wrangler alias map, but is imported by `workers/src/auth/permissions.ts`. This may cause a bundler resolution failure unless the `@hermes` directory alias covers it.

### Dependency Direction

```
artifacts/ags-fertility  → @workspace/api-client-react  (live)
artifacts/api-server     → @workspace/api-zod, @workspace/db  (not deployed, deprecated)
workers/src/             → @hermes/*, @shared/*  (via aliases)
hermes/                  → shared/ (via relative imports)
lib/api-spec/            → [generates into lib/api-client-react/, lib/api-zod/]
```

---

## 9. Build, CI/CD, Deployment, Testing

### Build [OBSERVED from A]

Root `build` script: `pnpm run typecheck && pnpm --filter @workspace/ags-fertility run build`. TypeScript project-references (`tsconfig.json`) cover `lib/db`, `lib/api-client-react`, `lib/api-zod`. Workers and artifacts have their own `tsconfig.json` invocations.

SPA build output: `artifacts/ags-fertility/dist/public/`.

### GitHub Actions Workflows (`.github/workflows/`) [OBSERVED from A]

Three workflows:

**`deploy.yml`** — Triggers on `push` to `main` or `workflow_dispatch`. Runs: checkout → pnpm install → 3 integrity gates (repo integrity, required files, Python import-integrity check) → SPA build → bundle guard (verifies API base URL present, no dev hostnames) → inject JWT/Turnstile secrets into `workers/wrangler.jsonc` in-place → deploy `agsynergy-api --env production` → deploy `hermes-website` → (on `workflow_dispatch` only) deploy API preview.

- [OBSERVED] **No test step.** Tests are not run as part of deploy.
- [OBSERVED] **No typecheck step.** TypeScript errors do not block deployment.
- [OBSERVED] **No lint step.** No ESLint or Prettier enforcement.
- [OBSERVED] Deployment is automatic on every `main` push. No manual approval gate.

**`security.yml`** — Triggers on `push` to `main` or PR targeting `main`. Runs gitleaks on full history. `GITLEAKS_CONFIG: ""` is set, which overrides `.gitleaks.toml` — the custom Cloudflare API token regex rule in `.gitleaks.toml` is NOT active in CI. [OBSERVED]

**`secure-access.yml`** — Manual (`workflow_dispatch`) only. Configures Cloudflare Zero Trust Access for `agsynergy.ca` (allow `kumarlogan@gmail.com`, block everyone else). One-shot setup workflow. [OBSERVED]

### What the Pipeline Does NOT Check [OBSERVED from A]

- Unit or integration tests
- TypeScript type errors
- ESLint/formatting
- Dependency freshness (no Dependabot)
- Custom gitleaks rules (`.gitleaks.toml` not loaded in CI)

### Testing [OBSERVED from A]

Framework: Vitest. Three configurations:
- `vitest.config.ts` (root) — node environment; covers broad `**/*.test.ts` glob; excludes 4 custom-runner tests and 4 CF-pool-incompatible tests.
- `workers/vitest.config.ts` — uses `@cloudflare/vitest-pool-workers` (Miniflare); applies D1 migrations in `globalSetup.ts` before any test.
- `workers/vitest.epic005.config.ts` — pure Node threads; covers `hermes/` service and execution tests.

68 total test files [OBSERVED]. Key excluded tests:
- `workers/tests/auth/engine.integration.test.ts` — excluded from CF pool
- `workers/tests/integration/api.test.ts` — excluded from CF pool
- `workers/tests/launch/smoke-tests.test.ts` — requires live URL (`SMOKE_TEST_URL`)
- `hermes/services/workforce/d1-backend.test.ts` — custom runner

Zero test files exist in `artifacts/ags-fertility/` (frontend). [OBSERVED]

Coverage thresholds: none configured. `test:coverage` script exists but is opt-in and not enforced anywhere.

### Replit [OBSERVED from A]

`.replit` configures `nodejs-24` (differs from CI's Node 22), `deploymentTarget = "autoscale"`, `postMerge` hook runs `pnpm install --frozen-lockfile && pnpm --filter db push`. Replit's deployment is a separate path from Cloudflare deployment. `pnpm-workspace.yaml` includes platform overrides for `linux-x64` (Replit's runtime).

---

## 10. Documentation Corpus

### Scale
- **47 markdown files** at repository root [OBSERVED from G]
- **467 markdown files** in `docs/` across 26 subdirectories [OBSERVED from H]
- **Total: ~514 markdown files**

### Root-Level Authority Split [OBSERVED from G]

| Classification | Count |
|---|---|
| AUTHORITATIVE (living reference) | 17 |
| HISTORICAL (point-in-time record) | 23 |
| SUPERSEDED | 2 (`SECURITY-REVIEW.md`, `replit.md`) |
| UNCERTAIN (stale or incomplete) | 3 (`DECISIONS.md`, `SECURITY.md`, `TASKS.md`) |

Key living documents: `ARCHITECTURE.md` (v2.2, 52 KB), `CHANGELOG.md` (~90 KB, latest v1.6.0), `ROADMAP.md`, `PROJECT.md` (v1.1), `FOUNDATION_FREEZE.md`, `OPERATING_MODEL_v1.md`, `SECURITY-REVIEW-v2.md`, `MVP_SECURITY_BASELINE.md`.

### `docs/` Directory Map [OBSERVED from H]

| Directory | File Count | Purpose |
|---|---|---|
| `docs/adr/` | 6 | Platform ADRs ADR-012 through ADR-018 |
| `docs/decisions/` | 13 | ADRs ADR-001 through ADR-016 (overlap with adr/) |
| `docs/architecture/` | ~45 | Hermes platform architecture; EPIC reviews; WEF V2 analysis |
| `docs/operations/` | 124 | Per-epic completion/validation/baseline records (largest dir) |
| `docs/ops/` | 74 | Per-wave scorecards; operator guide; skill/agent/dept registries |
| `docs/platform/` | ~50 | Canonical platform capability architecture (most authoritative technical dir) |
| `docs/governance/` | 11 | Living dashboards; decision log; GOVERNANCE_INDEX.md (closest to global TOC) |
| `docs/reconciliation/` | 21 | Runtime reconciliation snapshots |
| `docs/releases/` | ~30 | Structured per-version release packages |
| `docs/organization/` | 19 | Three-layer org architecture; dependency rules |
| `docs/certification/` | 19 | Formal certification records (security, accessibility, UX, ops, perf, WAS) |
| `docs/company/` | 4 | Enterprise operating model (added by ADR-017, 2026-07-27) |
| `docs/mission/` | 4 | Hermes 10-layer model; org blueprint |
| `docs/wave7/`, `docs/wave8/` | 4, 5 | Wave completion records |
| Other (smaller dirs) | various | planning, sprints, templates, reviews, phases, roadmaps, database, security, api, products |

### ADR Numbering Collision [OBSERVED from H]

ADR-016 appears in both `docs/decisions/ADR-016-communication-centre.md` (Communication Centre) and `docs/adr/ADR-016-project-state-execution-registry.md` (PSER) — two different decisions occupying the same number. ADR-009 is absent from both directories.

### No Global Index [OBSERVED from H]

No `docs/README.md` or global docs table of contents exists. `docs/governance/GOVERNANCE_INDEX.md` (20,569 bytes) is the closest approximation, but covers governance documents only.

### Test Count Discrepancy Across Docs [OBSERVED from G]

Multiple authoritative documents state different test totals: 558 (2026-07-25 baseline), 614 (post-stabilization combined), 750 (gross workers/ discovery count). `FOUNDATION_RECONCILIATION.md` explicitly addresses this: 614 is the current authoritative combined count (workers + hermes core). Older docs citing 558 without caveat remain in place.

---

## 11. Repository Activity and Process

### Commit Cadence [OBSERVED from I]

~150 commits sampled over 2026-07-07 to 2026-08-04 (~16 active days). Peak: 14 commits in a single day (2026-07-20), 13 commits on 2026-08-01. Sustained rate: 7–15 commits per active day during sprint delivery.

### Authorship [OBSERVED from I]

`kumarlogan`: 147/150 commits. `Hermes Agent`: 2 commits (direct author identity). 3 commits carry `Co-Authored-By` trailers (Nous Research AI, `Hermes Agent`, self). The proportion of AI-assisted work is [INFERRED] significantly higher than the 3% explicit marker rate — the project is described as an AI-automated delivery system built on Telegram-based operations.

### Work-Item Scheme [OBSERVED from I]

| Identifier Type | Format | Meaning |
|---|---|---|
| EPICs | `EPIC-00X-00Y`, `EPIC-00X`, `EPIC-005.9` | Two-tier deliverables (epic.sub-epic) |
| Waves | `Wave N`, `waveN:` | Product delivery waves (AGS Fertility app) |
| Governance | `GOV-00X` | Governance framework items |
| Milestones | `M1`–`M9` | Milestones within an EPIC |
| MVP tracks | `MVP-XXX`, `AGS-XXX` | MVP feature and AGS product items |

EPICs observed in commit history: EPIC-002-005 through EPIC-015. Wave cadence: Waves 3–8.1.

### Branching and Review Reality [OBSERVED from I]

Primarily trunk-based development. Two non-main branches exist: `fix/clinic-route-auth-guard` (open PR #3, security fix, unmerged as of 2026-08-04) and `cloudflare/workers-autoconfig` (open bot PR #1, open since 2026-07-15, unactioned). Day-to-day work flows directly to `main` without PRs. No evidence of external code review. PR #2 (only merged PR) was self-merged within 2 minutes of opening.

### Open Pull Requests [OBSERVED from I]

| # | Title | Author | Age |
|---|---|---|---|
| 3 | `fix(security): require clinic identity for all /clinic/* routes` | kumarlogan | ~1 day |
| 1 | `Add Cloudflare Workers configuration` | cloudflare-workers-and-pages[bot] | ~20 days |

### Versioning [OBSERVED from I]

Git tags: 10 total (`v1.0.0`, `v1.0.0-rc1`, `v1.1.0`, `v1.4.0`, `v1.5.0-preview`, `v1.6.0`, `v1.14.0`, `wave-6-rc1`, `baseline-002-006`, `Hermes-Foundation-v1.0`). No GitHub Releases. CHANGELOG tracks 35 versions (`0.1.0` through `1.21.0`); many CHANGELOG entries have no corresponding git tag. `workers/src/version.ts` reports `1.1.0` — stale by at least 5 CHANGELOG versions vs the current `1.6.0` latest entry.

### P0 Incident Cluster [OBSERVED from I]

Three P0/hotfix commits landed on 2026-07-28, shortly after v1.0.0 production deployment: `hotfix: reduce PBKDF2 iterations to 100k for Cloudflare Workers compat`, `fix(api): P0 harden D1 inserts — coerce undefined bind values to null`, `fix(api): P0 — email verification transitions identity to VERIFIED`. PR #2 (`fix: remove orphaned consentEngine.initialize() causing Error 1101`) was opened and self-merged the same day (2026-07-29).

---

## 12. Evidence Appendix

| Report | File | Scope Covered | Key Observations Sourced |
|---|---|---|---|
| A | `A_build_cicd_testing.md` | Monorepo layout, npm scripts, Cloudflare wrangler configs (both), GitHub Actions workflows, Vitest test inventory (68 files), secret management, Replit config, Node/pnpm version pinning, helper scripts | CI pipeline steps and gates; test file enumeration; wrangler bindings; Replit/CI Node version mismatch; deploy-without-tests gap |
| B | `B_worker_api_layer.md` | `workers/src/` entrypoint, router, all 13 route files, 5 middleware files, auth model (3 paths), Telegram integration, error/logging/security headers, env/bindings contract, stubbed/in-memory code | Complete ~110 endpoint table; request lifecycle chain; AUTHORIZATION_ENGINE gap; in-memory engine usage; mock data in clinic routes |
| C | `C_platform_subsystems.md` | `workers/src/platform/` — 15 subsystems (EPCL, WAS, WEF, Trust, Identity, Workflow, Documents, Notifications, Appointments, Messaging, Timeline, Providers, Credentials, Release, d1.ts) | Maturity table; feature flag defaults (all false for EPCL/WAS); WEF delegation stub; D1 vs in-memory split by subsystem |
| D | `D_frontend.md` | `artifacts/ags-fertility/` SPA — framework/stack, page inventory, auth handling, API integration, styling, state management; `hermes-website/` clarification; `artifacts/` directory classification | No frontend tests; clinic routes unguarded; inconsistent API base URL handling; `hermes-website/` is backend scripts |
| E | `E_data_layer.md` | `workers/migrations/` (all 12 files); 68 D1 tables full schema; D1 access layer (`platform/d1.ts`); R2 usage; in-memory store inventory; dead/missing schema analysis | `consents` table conflict (0006 vs 0008); dead tables (`faqs`, `services`); NOTIFICATIONS binding empty database_id; consent/delegation engines still in-memory despite D1 tables |
| F | `F_shared_libraries.md` | `lib/` (4 packages), `hermes/` (222+ files), `shared/`, `.hermes/`, `scripts/`, TypeScript and Wrangler path aliases, internal dependency graph, code duplication, dead code | `@hermes/permissions/middleware.js` not in wrangler alias map (gap); `lib/api-zod` and `lib/db` deprecated; `.hermes/` is AI agent state store; potential circular dep in EPIC-007 plan |
| G | `G_root_docs_catalogue.md` | All 47 root-level markdown files — authority classification, conflicts/drift analysis, product/platform naming | 8 documented conflicts between docs; DECISIONS.md incomplete; SECURITY.md stale; naming hierarchy (AGS/AI Platform/Concierge/AG Synergy/Hermes) |
| H | `H_docs_tree_catalogue.md` | `docs/` tree — 467 files across 26 directories; full ADR list; overlaps and duplication; orphans/stubs; contradictions | ADR-016 number collision; `docs/adr/` vs `docs/decisions/` split; no global index; `docs/operations/` (124 files) vs `docs/ops/` (74 files) overlap |
| I | `I_repo_activity.md` | 150-commit sample (2026-07-07–2026-08-04); branch list; open PRs; tags/versioning; commit conventions and work-item scheme; process signals | Trunk-based development; 26% fix-churn; P0 cluster on 2026-07-28; version.ts stale; no peer review; Hermes Agent as direct commit author |

---

*End of Phase 1 Repository Discovery Report.*
*All claims tagged [OBSERVED] are directly evidenced by source file reads. Claims tagged [INFERRED] are logical conclusions from observed data. Claims tagged [UNKNOWN] lack sufficient evidence from the read scope.*
