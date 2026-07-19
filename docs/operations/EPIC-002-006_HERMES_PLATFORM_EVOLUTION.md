# EPIC-002-006 — Hermes Platform Evolution Planning Package

> **Status:** Planning only. No code, migrations, Workers, Cloudflare, secrets,
> or deployments are modified by this document or any document it references.
> All items below are proposals for human approval.
>
> **Author:** Chief Architect (AGS) · **Date:** 2026-07-19
> **Depends on:** Discovery Assessment (CAPABILITY_ASSESSMENT.md), ADR-001..006,
> AI_OPERATING_MODEL.md, docs/organization/*

---

## 0. Executive Summary

AGS has production-quality security infrastructure (identity engine, RBAC
resolver, authorization middleware, provider registry, audit framework, a
Telegram Ops Bot MVP, API specs, shared tooling, CI/CD) — but it currently
lives **inside the AGS Fertility application Worker**. The target architecture
splits the system into three layers:

- **Organization Layer** — governance, identity *model*, owner accounts, AI
  workforce registry, security policy, audit *policy*.
- **Hermes Platform** — the reusable operating platform: identity services,
  permissions, auth providers, audit services, agent registry, agent lifecycle,
  automation, provider adapters, shared interfaces.
- **Applications** — independent business units (AGS Fertility = #1; AGS Cyber,
  Hermes Quant = future) that consume Hermes services via contracts.

This package defines how to extract Hermes from the app Worker **without
breaking AGS Fertility**, in six incremental, reversible phases, with a final
target monorepo, nine Hermes service designs, an AI-workforce activation model,
a Cloud-mobility strategy, a future epic roadmap, and a recommended ADR.

**Design principles (from constraints):**
1. AGS Fertility stays fully operational at every step.
2. No working system is rewritten without cause.
3. Every migration phase is incremental **and reversible**.
4. Cloud-provider independence is preserved by interface + adapter seams.
5. Future OCI / AWS / Azure / local deployment needs only new adapters — never
   app rewrites.
6. Agents are **inactive by default**; they become operational only after
   register → assign → activate.
7. No application depends on another application; cross-boundary calls use APIs.

---

## 1. Hermes Extraction Strategy

### 1.1 Current asset locations (verified)

| Asset | Current path |
|---|---|
| Identity engine (public surface) | `workers/src/auth/index.ts` |
| Identity types | `workers/src/auth/types.ts` |
| Identity provider registry + Telegram resolver | `workers/src/auth/providers.ts` |
| Principal builder | `workers/src/auth/principal.ts` |
| Permission resolver | `workers/src/auth/permissions.ts` |
| Audit writer | `workers/src/auth/audit.ts` |
| Authorization middleware | `workers/src/auth/middleware.ts` |
| Telegram Ops Bot (presentation layer) | `workers/src/routes/telegram.ts` |
| Ops/Consultation services + routes | `workers/src/services/*`, `workers/src/routes/ops.ts`, `workers/src/routes/consultations.ts` |
| RBAC + app migrations | `workers/migrations/0001_initial_schema.sql` … `0004_role_permissions_seed.sql` |
| Shared tooling | `lib/api-zod`, `lib/api-spec`, `lib/api-client-react` |
| CI/CD | `.github/workflows/deploy.yml`, `pipeline.sh`, `deploy*.py` |

### 1.2 What moves → `hermes/`

| Target module | Source | Notes |
|---|---|---|
| `hermes/identity` | `auth/providers.ts`, `auth/principal.ts`, `auth/types.ts` | Provider registry + principal building |
| `hermes/permissions` | `auth/permissions.ts`, `auth/middleware.ts` | Resolver + `requirePermission`/`authorize` |
| `hermes/audit` | `auth/audit.ts` | Audit write (keep tolerant/non-blocking) |
| `hermes/providers` | `auth/providers.ts` (registry contract) + `docs/organization/PROVIDER_ABSTRACTIONS.md` | Provider interface layer; Cloudflare adapter first |
| `hermes/agents` | `routes/telegram.ts` + `AI_OPERATING_MODEL.md` roles | Ops Bot = first registered agent; QA/Security/Docs specs |
| `hermes/registry` | `docs/organization/RESOURCE_REGISTRY.md`, `AI_REGISTRY_V2.md`, `AI_WORKFORCE.md` | **New runtime** (no impl today) |
| `hermes/automation` | `AI Operating Model` workflow + Hermes cron capability | Pattern documented; no AGS-app impl |
| `hermes/memory` | Hermes runtime memory (out-of-repo) | Org memory lives in Hermes, referenced by convention |
| `hermes/interfaces` | `auth/types.ts` (contracts) + `lib/api-zod` | Shared interfaces/contracts |

### 1.3 What stays in AGS Fertility

- `workers/src/routes/ops.ts`, `consultations.ts`, `services/*` (business logic)
- `workers/src/router/index.ts` (route table — imports Hermes services)
- `workers/src/index.ts` (thin Worker entry — calls Hermes `authorize`)
- `workers/migrations/0001` (leads/consultations), `0003` (ops fields)
- Frontend (`artifacts/ags-fertility`), site Worker (`wrangler.jsonc` site)
- App DB tables: leads, consultations, ops_* columns

### 1.4 What is duplicated **temporarily** (during migration)

| Item | Why duplicated | Removed when |
|---|---|---|
| `auth/*` source living in BOTH `workers/src/auth` and `hermes/identity`+`permissions` | Phase 2 publishes Hermes packages; app imports them but old copy stays until Phase 3 cutover verified | End of Phase 3 (old `workers/src/auth` deleted after green CI + canary) |
| RBAC tables in app D1 **and** Hermes D1 | Phase 4 moves ownership; both DBs seeded until dual-write verified | End of Phase 4 (app stops writing RBAC) |

### 1.5 Migration order (high level)

1. Phase 0 — Freeze & baseline
2. Phase 1 — Introduce interfaces (no behavior change)
3. Phase 2 — Extract shared packages (Hermes published as workspace pkgs)
4. Phase 3 — Create Hermes Platform services (deploy Hermes Worker/package)
5. Phase 4 — Move identity/RBAC ownership (dual-write → cutover)
6. Phase 5 — Register first AI agent (Ops Bot)
7. Phase 6 — Separate applications fully (app consumes Hermes service)

### 1.6 Rollback strategy (cross-phase)

- Every phase ships behind a **feature flag / env var** (`HERMES_PLATFORM_MODE`).
- Before cutover, the app imports the **local copy**; after cutover it imports
  the **Hermes package**. A one-line `import` revert + flag flip is the rollback.
- Migrations are **forward-only additive**; rollback uses a compensating
  migration (`0005_rollback_*.sql`) that is authored alongside each Phase-4 step.
- CI keeps the pre-migration Worker deployable from `git tag baseline-002-006`.

---

## 2. Zero-Downtime Migration Plan

### Phase 0 — Freeze & Baseline
- **Objective:** Immutable reference of current production.
- **Affected:** None modified. `git tag baseline-002-006`; capture D1 schema
  dump; snapshot wrangler configs; record passing-test commit SHA.
- **Risk:** Low.
- **Validation:** `pnpm test` green (141/141) on tagged commit; manual
  `/health` + one `leads.read` call succeed on prod.
- **Rollback:** N/A (nothing changed).

### Phase 1 — Introduce Interfaces Without Behavior Change
- **Objective:** Define `hermes/interfaces` contract types; app keeps calling
  local `auth/*` but through a thin re-export shim that matches the future
  Hermes import path.
- **Affected:** New file `workers/src/auth/hermes-shim.ts` (re-exports current
  `authorize`, `requirePermission`, `registerIdentityResolver`). No logic moved.
- **Risk:** Low (additive only).
- **Validation:** Tests still green; shim import resolves identically.
- **Rollback:** Delete shim file; app imports original directly. (No behavior
  difference, so rollback is cosmetic.)

### Phase 2 — Extract Shared Packages
- **Objective:** Publish `hermes/identity`, `hermes/permissions`, `hermes/audit`,
  `hermes/providers` as pnpm workspace packages. App imports them via the shim.
- **Affected:** New `hermes/*` packages (code copied from `auth/*`,
  **unchanged**); `pnpm-workspace.yaml` adds `hermes/*`; `workers` depends on
  `@hermes/identity` etc.
- **Risk:** Medium (import-graph refactor). Mitigated by bit-for-bit copy.
- **Validation:** `pnpm -r build`; `pnpm test` green; canary deploy on
  `workers_dev` returns identical auth behavior (diff-tested with recorded
  requests).
- **Rollback:** Flip `HERMES_PLATFORM_MODE=local`; app imports `workers/src/auth`
  again. Hermes packages left in place but unused.

### Phase 3 — Create Hermes Platform Services
- **Objective:** Hermes runs as its own deployable unit (package + optional
  Worker) exposing `authorize`, `resolveIdentity`, `registerProvider`.
- **Affected:** New `hermes/` deploy target (separate wrangler env or library
  consumed by app). App Worker calls Hermes via in-process import first
  (no network hop) to avoid latency/rollback risk.
- **Risk:** Medium. Mitigated: same-process import = no new failure domain.
- **Validation:** Integration test: app request → Hermes `authorize` → D1 →
  response, byte-identical to Phase 2.
- **Rollback:** Set `HERMES_PLATFORM_MODE=package`; app imports package directly
  (Phase 2 state).

### Phase 4 — Move Identity/RBAC Ownership
- **Objective:** RBAC tables + seed migrate to a Hermes-owned D1 (or clearly
  namespaced schema). App dual-writes during transition.
- **Affected:** New Hermes migration `hermes/migrations/0001_rbac.sql` (copied
  from app 0002+0004); compensating `0002_rollback.sql`. App `permissions.ts`
  call goes to Hermes DB binding.
- **Risk:** High (data ownership move). Mitigated by dual-write + compensating
  migration + canary.
- **Validation:** Row-count parity between app RBAC tables and Hermes RBAC
  tables; `hasPermission` returns identical results for 50 seeded principals.
- **Rollback:** Run `0002_rollback.sql`; flip app `DB` binding back to app D1;
  stop dual-write.

### Phase 5 — Register First AI Agent
- **Objective:** Ops Bot becomes the first **registered + activated** Hermes
  agent. Registry runtime goes live (minimal D1 table `agent_registry`).
- **Affected:** `hermes/registry` runtime (new); `hermes/agents/ops` (moved
  from `routes/telegram.ts`); agent registered with `status=inactive` →
  `assigned` → `activated` via migration/seed rows.
- **Risk:** Medium. Bot is read-only MVP; blast radius small.
- **Validation:** Agent shows `status=operational` in registry; `/dashboard`
  command returns same payload as before; audit logs agent actions.
- **Rollback:** Set agent `status=inactive` in registry (one row update) → bot
  returns "agent inactive" message; no code change needed.

### Phase 6 — Separate Applications Fully
- **Objective:** App Worker consumes Hermes as an external contract; no Hermes
  source lives under `workers/src`. Future apps (AGS Cyber, Hermes Quant) scaffold.
- **Affected:** Delete `workers/src/auth` (now in `hermes/`); app imports only
  `@hermes/*`; add `applications/ags-cyber`, `applications/hermes-quant` stubs.
- **Risk:** Low (cleanup of already-extracted code).
- **Validation:** `workers/src/auth` absent; `pnpm test` green; new app stub
  builds and calls Hermes `authorize` in a test.
- **Rollback:** Restore `workers/src/auth` from `baseline-002-006` tag; re-point
  imports. (Phase 2/3 packages remain, so partial rollback is safe.)

---

## 3. Target Repository Structure

```
organization/                 # Org governance (lives in Hermes repo root or separate)
  docs/
    ADRs/
    operating-model/
  governance/                 # Owner accounts, security policy (specs/data)
applications/
  ags-fertility/              # App #1 (today: workers/ + artifacts/ags-fertility/)
    workers/                  # API Worker — imports @hermes/*
    frontend/                # artifacts/ags-fertility
    migrations/              # app-only tables (leads, consultations)
  ags-cyber/                  # future stub
  hermes-quant/               # future stub
shared/
  lib/api-zod/                # shared contracts
  lib/api-spec/               # OpenAPI + Orval
  lib/api-client-react/       # shared UI client
hermes/
  identity/                   # providers, principal, types
  permissions/                # resolver, middleware
  audit/                      # audit writer
  providers/                  # provider interfaces + cloudflare adapter
  agents/                     # agent runtime + ops agent
  registry/                   # resource + AI registry runtime
  automation/                 # cron/automation framework
  memory/                     # org memory conventions (backed by Hermes runtime)
  interfaces/                 # shared contracts/types
  migrations/                 # hermes-owned RBAC + registry tables
agents/                       # optional standalone agent packages
docs/                         # cross-cutting docs
```

### Dependency rules
- `applications/*` MAY depend on `@hermes/*` and `shared/*`.
- `applications/*` MUST NOT depend on another `applications/*`.
- `hermes/*` MUST NOT depend on any `applications/*`.
- `shared/*` MUST NOT depend on `applications/*` or `hermes/*` (leaf contracts).
- `hermes/registry` is the only module that may reference both identity and
  agents.

### Import rules
- App code imports Hermes only via `@hermes/<module>` public entry (no deep
  imports into `hermes/identity/src/...`).
- Cross-boundary calls (app → Hermes service) use the documented contract
  (TypeScript types in `hermes/interfaces` + OpenAPI in `shared/lib/api-spec`).

### Ownership boundaries
- **Org** owns: who may be an owner, security policy, registry *policy*.
- **Hermes** owns: identity resolution, permission evaluation, audit *storage*,
  agent lifecycle, provider adapters.
- **App** owns: business tables, UI, domain workflows, app-specific migrations.

---

## 4. Hermes Service Design

### 4.1 Identity Service (`hermes/identity`)
- **Purpose:** Resolve a request to a Principal via pluggable providers.
- **Ownership:** Hermes.
- **APIs:** `resolveIdentity(req) → IdentityResolution | null`;
  `buildPrincipal(db, identity) → Principal`; `registerIdentityResolver(r)`.
- **Dependencies:** `hermes/interfaces`, `hermes/permissions` (for principal role).
- **Security:** Resolvers establish *who* only; never read permission tables.

### 4.2 Permission Service (`hermes/permissions`)
- **Purpose:** Evaluate effective permissions = role ∪ user − revoke; OWNER
  short-circuit.
- **Ownership:** Hermes.
- **APIs:** `hasPermission(db, roleId, userId, key) → bool`;
  `resolveEffectivePermissions(...) → Set<string>`.
- **Dependencies:** D1 (or `DataStore` adapter), `hermes/interfaces`.
- **Security:** No hardcoded role→perm maps (ADR-003). Deny wins.

### 4.3 Audit Service (`hermes/audit`)
- **Purpose:** Persist allow/deny decisions + agent actions.
- **Ownership:** Hermes (storage); Org owns retention policy.
- **APIs:** `writeAuditEvent(db, decision) → id | null`.
- **Dependencies:** `DataStore` adapter.
- **Security:** Tolerant writer (failure logs, never blocks request); no PII in
  metadata beyond provider id.

### 4.4 Agent Registry Service (`hermes/registry`)
- **Purpose:** Track agents: registered → assigned → activated → operational;
  store permissions, memory scope, app access.
- **Ownership:** Hermes + Org (policy).
- **APIs:** `registerAgent`, `assignAgent`, `activateAgent`, `getAgentStatus`,
  `listAgents`.
- **Dependencies:** `DataStore`, `hermes/permissions`.
- **Security:** Activation requires human approval (ADR/Operating Model gate);
  inactive agents return 403-style "inactive".

### 4.5 Resource Registry Service (`hermes/registry`)
- **Purpose:** Catalog org resources (DBs, Workers, external APIs) as
  provider-abstracted entries.
- **Ownership:** Hermes.
- **APIs:** `registerResource`, `resolveResource(name, adapter) → endpoint`.
- **Dependencies:** `hermes/providers`.
- **Security:** Read-only to apps; write restricted to Org/Hermes admin.

### 4.6 Notification Service (`hermes/providers` + `hermes/agents`)
- **Purpose:** Deliver messages (Telegram, email, future) via adapters.
- **Ownership:** Hermes.
- **APIs:** `notify(channel, payload)`.
- **Dependencies:** provider adapters.
- **Security:** Channel allowlist per agent; no secret in source.

### 4.7 Scheduler Service (`hermes/automation`)
- **Purpose:** Recurring/triggered automation (cron-like) for agents.
- **Ownership:** Hermes.
- **APIs:** `schedule(job)`, `run(jobId)`.
- **Dependencies:** `hermes/registry` (agent must be operational).
- **Security:** Jobs run as the agent's identity; audited.

### 4.8 Memory Service (`hermes/memory`)
- **Purpose:** Org + per-agent memory scoped by agent id.
- **Ownership:** Hermes (runtime); Org owns retention.
- **APIs:** `recall(agentId, query)`, `remember(agentId, fact)`.
- **Dependencies:** `DataStore` (or Hermes runtime memory).
- **Security:** Strict agent-id scoping; cross-agent reads forbidden.

### 4.9 Provider Adapter Service (`hermes/providers`)
- **Purpose:** Implement `DataStore`, `Identity`, `Notification` interfaces;
  Cloudflare first, OCI/AWS/Azure/local later.
- **Ownership:** Hermes.
- **APIs:** interface contracts in `hermes/interfaces`; `registerAdapter`.
- **Dependencies:** none (leaf).
- **Security:** Adapter selection by config; no app sees adapter internals.

---

## 5. AI Workforce Activation Plan

### 5.1 Lifecycle
```
Registered Agent      (exists in registry, status=inactive, no permissions)
      ↓  assign
Assigned Agent        (granted role/permissions + memory scope + app access)
      ↓  activate (human approval)
Activated Agent       (operational=true; can be invoked)
      ↓  run
Operational Agent     (executing tasks; all actions audited)
```
Inactive-by-default guarantee: registry seed inserts every known agent with
`status='inactive'`. Activation is a single-row update gated by human approval
(see AI Operating Model §3).

### 5.2 Agent examples

| Agent | Permissions | Memory scope | App access | Audit |
|---|---|---|---|---|
| Operations Agent (Ops Bot) | `leads.read` etc (OPERATIONS role) | ops-only | AGS Fertility | every command |
| Security Agent | `audit.read`, `roles.manage` (read) | security-only | all (read) | every scan |
| QA Agent | `leads.read`, `consultations.read` | qa-only | AGS Fertility | test runs |
| Documentation Agent | `audit.read` | docs-only | all (read) | doc changes |
| Research Agent | scoped read | research-only | external APIs | queries |
| Trading Research Agent | scoped read (Hermes Quant) | quant-only | Hermes Quant (future) | queries |
| Monitoring Agent | `audit.read` | monitor-only | all | alerts |

All agents: **inactive until registered+activated**; **no cross-app writes**;
**all actions written to Audit Service**.

---

## 6. AGS Fertility Migration Protection Plan

### 6.1 Stays inside AGS Fertility
- Fertility workflows (consultation intake, lead lifecycle)
- `leads`, `consultations` tables + `ops_*` fields
- Medical / business data (PII handled per existing policy)
- Frontend (`artifacts/ags-fertility`) + customer journeys
- App API route handlers (`ops.ts`, `consultations.ts`) — business logic only

### 6.2 Moves to Hermes
- Identity resolution (`auth/providers`, `principal`)
- Authentication providers (registry)
- Authorization (`permissions`, `middleware`)
- Audit logging (`audit`)
- AI workforce integration (Ops Bot → `hermes/agents/ops`)

### 6.3 Regression guarantees
- Phase 0 baseline + recorded golden requests replayed after every phase.
- `leads.read` / `leads.update` / `leads.assign` behavior must remain
  byte-identical (same JSON shape, same status codes).
- Customer-facing frontend never imports Hermes internals; only calls
  `/api/v1/*` as today.
- Feature flag `HERMES_PLATFORM_MODE` allows instant revert to local auth.

---

## 7. Cloud Mobility Strategy

| Concern | Today (Cloudflare) | Future (OCI/AWS/Azure/Local) |
|---|---|---|
| Compute | Workers | Adapter: any FaaS/container |
| DB | D1 (SQLite) | Adapter: OCI/Postgres/etc via `DataStore` |
| Identity | Telegram resolver | Add resolver (dashboard, OCI IAM) |
| Audit | D1 table | `DataStore` adapter |
| Secrets | Worker bindings | Adapter per provider |

**Rule:** Applications and Hermes services depend ONLY on `hermes/interfaces`
(`DataStore`, `Identity`, `Notification`). Adding a cloud = writing one adapter
in `hermes/providers`. **No application or Hermes service code is rewritten.**

---

## 8. Future Epic Roadmap

| Epic | Title | Value | Risk | Reuse |
|---|---|---|---|---|
| **EPIC-002-006A** | Extract Hermes shared packages (Phases 0–3) | High — unblocks all reuse | Med | auth/* copied verbatim |
| **EPIC-002-006B** | RBAC ownership move + Registry runtime (Phases 4–5) | High — real platform | High | migrations 0002/0004 |
| **EPIC-002-006C** | Full app separation + future app stubs (Phase 6) | Med | Low | none |
| **EPIC-002-006D** | Provider abstraction interfaces + OCI adapter spike | High (mobility) | Med | PROVIDER_ABSTRACTIONS.md |
| **EPIC-002-006E** | Agent workforce expansion (QA/Security/Docs agents) | Med | Low | Operating Model roles |
| **EPIC-002-006F** | Hermes Quant onboarding as App #2 (validates platform) | High (proof) | Med | all of above |

**Priority order:** A → B → C → E → D → F (maximize reuse, lowest risk first).

---

## 9. Final Architecture Decision (ADR recommendation)

> Full ADR text in `docs/decisions/ADR-007_HERMES_PLATFORM_EXTRACTION.md`
> (companion file). Summary:

- **Decision:** Incrementally extract the existing `workers/src/auth/*` engine
  and Ops Bot into a standalone `hermes/` platform package set, owned by the
  Organization Layer, consumed by AGS Fertility via contracts; agents inactive
  by default.
- **Rationale:** Capabilities already exist and are tested; extracting them
  unblocks multiple future apps and satisfies cloud-mobility + AI-workforce
  goals without rewriting working code.
- **Alternatives rejected:**
  - *Big-bang rewrite into microservices* — breaks AGS Fertility, high risk.
  - *Keep auth inside app forever* — blocks reuse, violates target architecture.
  - *Adopt external IdP (Auth0/Okta) now* — premature; current engine is
    sufficient and provider-abstracted already.
- **Risks:** Data-ownership move (Phase 4) is the highest risk; mitigated by
  dual-write + compensating migration + canary.
- **Consequences:** Clean org/app/Hermes boundary; future apps onboard in days;
  cloud migration = adapter work only.

---

*End of EPIC-002-006 planning package. Planning only — no modifications made.*
