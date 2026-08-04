# Engineering Assessment Report
## Repository: `kumarlogan/concierge-website`
**Assessment date:** 2026-08-04
**Branch assessed:** `main` (HEAD `35a665e`)
**Prepared by:** Phase 2 engineering assessment subagent

---

## 1. Scope and Method

### What was assessed

This assessment covers the full monorepo at `main` as of 2026-08-04. The evidence base is nine discovery reports produced in Phase 1 (A through I), the 20-item gap register (`KNOWN_GAPS.yaml`), and the project state snapshot (`PROJECT_STATE.yaml`). No changes were made to the repository. No runtime environment was instrumented; all findings derive from static reading of source, configuration, migration files, CI workflow definitions, and the 514-file documentation corpus.

### Classification discipline

Every claim in this report is tagged with one of three labels:

- **[OBSERVED]** — the conclusion follows directly from reading a specific file. The file path is cited.
- **[INFERRED]** — the conclusion follows from multiple observed facts combined with reasoning. The reasoning is stated.
- **[RECOMMENDED]** — an action not yet taken, proposed on the basis of observed evidence.
- **[UNKNOWN]** — the available evidence is insufficient to determine the fact. What evidence would resolve it is stated.

Where a finding appears in `KNOWN_GAPS.yaml`, the relevant GAP id is cross-referenced. Findings in that register are not restated in full; this report adds interpretive context around the raw gap entries.

---

## 2. Capability Assessment

### 2.1 Implemented Capabilities

The following capabilities are coded, have live HTTP routes, and are backed by durable storage where the subsystem requires it.

| Capability | Evidence | Confidence |
|---|---|---|
| Identity and authentication (registration, login, JWT/RS256, magic link, OAuth/OIDC, SAML, MFA, password reset, session rotation) | `workers/src/platform/identity/`; `workers/migrations/0002_identity_core.sql`; `/identity/*` catch-all in `workers/src/index.ts` | OBSERVED |
| Trust runtime — consent, policy (RBAC/ABAC/ReBAC), delegation, risk, decision engines, wired to 11 JWT-gated routes | `workers/src/platform/trust/`; `workers/src/routes/trustRuntime.ts`; `workers/migrations/0006_trust_runtime.sql` | OBSERVED |
| Workflow engine — D1-backed event-sourcing, task orchestration, approval gates, timers, 30+ live routes | `workers/src/platform/workflow/`; `workers/migrations/0010_workflow_engine.sql`; `workers/src/routes/wave7.ts` | OBSERVED |
| Document management — R2 storage, AES encryption, consent and policy integration, 16-endpoint surface | `workers/src/platform/documents/`; `workers/migrations/0007_document_upload.sql`; `workers/src/routes/documents.ts` | OBSERVED |
| Operations lead management — 7-endpoint RBAC-gated surface, D1-backed | `workers/src/routes/ops.ts`; `workers/migrations/0001_initial_schema.sql`, `0003_ops_lead_fields.sql`, `0004_role_permissions_seed.sql` | OBSERVED |
| Patient portal SPA — 35+ pages, patient and clinic workspaces, Tailwind/Radix UI stack, React Query, JWT auth flow, deployed to agsynergy.ca | `artifacts/ags-fertility/`; `wrangler.jsonc` (root) | OBSERVED |
| Telegram operations and admin bot — `POST /telegram/webhook`, `POST /admin/webhook`, RBAC-gated command dispatch | `workers/src/routes/telegram.ts`; `workers/src/routes/adminBot.ts` | OBSERVED |
| Structured request pipeline — CORS, rate limiting, security headers, JWT middleware, Turnstile on public submission endpoint | `workers/src/index.ts`; `workers/src/middleware/` | OBSERVED |
| OpenAPI-to-generated-client pipeline — Orval generates typed React Query hooks from `lib/api-spec/openapi.yaml` into `lib/api-client-react/` | `lib/api-spec/orval.config.ts`; `lib/api-client-react/src/generated/` | OBSERVED |
| Pre-deploy integrity gates — repo cleanliness, required-files, import-graph resolution, production-bundle endpoint guard | `.github/workflows/deploy.yml` steps 5–9 | OBSERVED |

### 2.2 Partially Implemented Capabilities

| Capability | What Works | What Does Not | Evidence |
|---|---|---|---|
| Notifications | D1 delivery-record schema exists; analytics, escalation engine, audit, 11 live routes | Actual multi-channel delivery is simulated (`// Simulate delivery — in production this calls FCM/APNs, SES, Twilio`); SSE stream emits one `connected` event and stalls; NOTIFICATIONS D1 binding has empty `database_id` in all environments | `workers/src/platform/notifications/delivery-engine.ts`; `workers/wrangler.jsonc` (GAP-008) |
| Appointments | 6 live routes, consent gating via real ConsentEngine, conflict checking | Backed by `InMemoryAppointmentEngine` on `globalThis`; data evaporates on Worker cold start; no D1 `appointments` table in any migration | `workers/src/platform/appointments/`; `workers/src/routes/wave7.ts` |
| Messaging | 3 live routes, consent gating | `InMemoryMessageEngine` on `globalThis`; no messages table exists in any migration | `workers/src/platform/messaging/`; `workers/src/routes/wave7.ts` |
| Trust engines — consent and delegation | Engines wired to routes; ConsentEngine and DelegationEngine implement full grant/revoke logic | Both engines are in-process singletons backed by Map objects; existing D1 `consents` and `delegations` tables are not read from or written to; data does not persist across Worker isolates | `workers/src/platform/trust/consent-engine.ts`; `workers/migrations/0006_trust_runtime.sql` (GAP-006) |
| Trust engine — trust scoring | Engine instantiated, 11 routes registered | All 10 trust factor `scoreFn` return hardcoded `0.5`; trust level is always `MEDIUM` regardless of user context | `workers/src/platform/trust/trust-engine.ts` |
| Clinic console | 10 live routes (patients, schedule, messaging, coordination) | Multiple endpoints return hardcoded mock patient arrays; `PATCH /clinic/messages/threads/:id/flag` always returns `{ flagged: true }` without writing; clinic routes lack authentication guard (open PR #3 unmerged) | `workers/src/routes/clinic.ts`; `workers/src/routes/clinic-messages.ts` (GAP-003) |
| IVF journey timeline | 10 live routes, stage and milestone logic implemented | `InMemoryTimelineEngine` only; each request constructs a new engine instance with empty state; explicitly commented as not D1-backed | `workers/src/routes/timeline.ts`; `workers/src/platform/timeline/` |
| Document metadata persistence | Document service is a module-level singleton; cross-request visibility within one isolate | Metadata lives in an in-process Map, not D1; documents created in one isolate are invisible to others on cold start | `workers/src/index.ts` comment; `workers/src/platform/documents/` |
| Authorization check and permissions-list endpoints | Declared in type definitions and registered as routes | `AUTHORIZATION_ENGINE` is never constructed; `POST /api/v1/authorization/check` and `GET /api/v1/permissions` will throw `TypeError: Cannot read properties of undefined (reading 'check')` at runtime | `workers/src/types/env.ts`; `workers/src/routes/trustRuntime.ts` (GAP-001) |
| WAS activation state | D1 schema in migration 0009 exists; state machine, observability, duplicate-execution protection all coded | `enablePersistence: false` in `DEFAULT_WAS_CONFIG`; no HTTP route reaches the service; all 5 WAS feature flags default to `false` | `workers/src/platform/was/`; `workers/migrations/0009_was_activation_state_persistence.sql` |

### 2.3 Missing Capabilities

| Capability | Evidence of Absence |
|---|---|
| Automated quality gate in CI (tests, typecheck) | `deploy.yml` has no `vitest` or `tsc` step; deploy fires on every push to main; [OBSERVED] `.github/workflows/deploy.yml` (GAP-004) |
| Frontend automated testing | Zero `.test.ts` or `.spec.ts` files under `artifacts/ags-fertility/`; no vitest config in the SPA package (GAP-010) |
| Global (cross-isolate) rate limiting | `workers/src/middleware/rateLimit.ts` explicitly documents per-isolate state; no KV or Durable Object backing |
| Database migration rollback | Forward-only SQL migrations; no down-migration files; no CI step applies migrations |
| Persistent credential and provider registry | `InMemoryCredentialRegistry` and `InMemoryProviderRegistry`; no D1 tables for either subsystem |
| WEF execution engine | Only `WefOperationalIntelligence` exists; `WEFDelegator.delegate()` returns simulated success with an explicit TODO; no executor, no task runner |
| EPCL autonomous execution | All 6 EPCL feature flags default to `false`; no HTTP route reaches `ExecutivePlanningWorkflow.execute()` (GAP-005) |

---

## 3. The Central Finding: The Documentation–Capability Gap

### What the repository says it is

The documentation corpus — 514 markdown files, 18+ ADRs, 8 capability maturity levels, 110 mandatory engineering standards, and a named AI platform hierarchy (EPCL → WAS → WEF) — describes an autonomous AI engineering platform. `OPERATING_MODEL_v1.md`, `HERMES_PLATFORM_CERTIFICATION.md`, `GOVERNANCE_CERTIFICATION.md`, and `EXECUTION_READINESS.md` all declare the platform certified, ready, and operational. EPIC-007's certification document reports 748/750 tests passing against the 12-stage EPCL workflow.

### What the repository runs

**[OBSERVED]** The EPCL → WAS → WEF pipeline does not execute. Quantified:

- **Feature flags:** 11 boolean flags across EPCL and WAS, all defaulting to `false`. `requireExecutiveWorkflow()` throws if `ENABLE_EXECUTIVE_WORKFLOW` is off. No runtime mechanism enables any of them; the flags are module-level constants.
- **Route wiring:** Zero HTTP routes in `workers/src/routes/` import or call `ExecutivePlanningWorkflow.execute()`, `WorkforceActivationService.activate()`, or `WefOperationalIntelligence.preDeploymentReport()`.
- **WEF implementation:** `WEFDelegator.delegate()` contains the comment `"TODO: Replace with actual WEF delegation when WEF integration is available"` and returns a simulated success. No WEF execution runtime exists in the codebase.
- **Independent corroboration:** `WAVE2_AUDIT_REPORT.md` [OBSERVED], dated 2026-07-30, states explicitly: "Wave 2 did not execute through the certified Hermes Foundation architecture. The certified execution path was never invoked. Runtime behavior is that of a traditional coding agent." This audit was produced internally and is contemporaneous with the certification documents that claim otherwise.

**[INFERRED]** The EPIC-007 certification tests that report 748/750 passing likely test the EPCL types and services as unit tests in isolation — confirming the logic is internally consistent — but do not confirm that the pipeline is reachable, configured, or integrated with the product.

### Quantified summary

| Dimension | Platform documentation claims | Observed reality |
|---|---|---|
| Feature flags enabling the pipeline | (asserted operational) | 11/11 default false |
| HTTP routes reaching EPCL or WAS | (asserted integrated) | 0 |
| WEF execution engine | (asserted certified) | Not implemented |
| Independent audit verdict | (not surfaced in CURRENT_SPRINT.md quality gates) | "certified orchestration path was never invoked" (WAVE2_AUDIT_REPORT.md) |

### Why it likely happened

**[INFERRED]** This pattern is characteristic of documentation-driven AI development at scale. The project is built with heavy AI authorship (commit history shows AI persona commits; `.replit` configures expert-mode AI agent; Telegram bot-driven operations). In this workflow:

1. Design artifacts — ADRs, platform capability documents, EPIC plans, operating models — are cheap to produce and are produced first to establish a shared context for subsequent AI sessions.
2. Code implementation follows the design documents and produces internally consistent, well-typed subsystem code.
3. Integration — wiring subsystems to routes, provisioning databases, enabling flags — is the hardest step and the one most likely to be deferred when velocity pressure is high.
4. The certification documents are produced against the code as it stands (tests pass, types check), without verifying that the pipeline is reachable end-to-end in production.

The result is a documentation corpus that accurately describes a design intent and an implementation, but where the gap between implementation and *capability* is not surfaced.

### What it costs going forward

**[OBSERVED/INFERRED]** Two costs are concrete:

1. **Context pollution.** Any AI session that reads `OPERATING_MODEL_v1.md`, `HERMES_PLATFORM_CERTIFICATION.md`, or `CURRENT_SPRINT.md` before reading the code will believe the autonomous platform is operational and will make decisions based on that belief. `WAVE2_AUDIT_REPORT.md` records that this already happened in Wave 2.

2. **Decision paralysis on dormancy.** Without an explicit decision about whether the platform track is active or parked, every future sprint begins by reopening the question. The 11 flags do not document why they are off or what condition would flip them.

---

## 4. Technical Debt Register

Gaps are grouped thematically. Full detail is in `KNOWN_GAPS.yaml`. GAP ids are cited; this section adds analytical context.

### Persistence gaps

**GAP-006 (high):** Consent and delegation engines are in-process singletons with no D1 wiring. The `consents` and `delegations` tables exist (migrations 0006, 0008) and were clearly intended to back these engines, but the wiring was never completed. In a healthcare application where consent revocation has compliance significance, this is the highest-consequence data-loss risk. Appointments and messaging share the same problem but carry lower compliance weight. The `InMemoryTimelineEngine` is explicitly self-documented as a reference implementation, not a production implementation.

**GAP-002 (critical):** The `consents` table is defined in two incompatible migrations. Migration 0008 extends it with `patient_identity_id`, `status`, `resource_type`, `revoked_by`, and `updated_at`. Because both use `CREATE TABLE IF NOT EXISTS`, the first migration wins and the second schema's columns are silently absent. Code in the consent engine written against the 0008 schema will fail against the live table. [UNKNOWN] which migration ran first in the production D1 instance — this can only be resolved by inspecting the live schema.

### Security exposures

**GAP-003 (critical):** Six clinic console routes have no authentication guard at the router level. PR #3 adds a `ClinicGuard` and was opened 2026-08-03 but remains unmerged. This is the highest-priority unresolved item in the repository.

**GAP-001 (critical):** `AUTHORIZATION_ENGINE` is declared in the `Env` type and called by `POST /api/v1/authorization/check` and `GET /api/v1/permissions`. It is never constructed or injected. Both endpoints throw a runtime `TypeError` when called. The fact that the Worker does not crash on startup (the engine is called inside route handlers, not at module load) means this defect is silent until those specific paths are exercised.

**GAP-009 (high):** JWT access and refresh tokens are stored in `localStorage` via a custom `TokenStore` class. The keys are `ags_patient_access_token` and `ags_patient_refresh_token`. Any XSS in the SPA yields full token exfiltration. The security certification (SECURITY_CERTIFICATION_REPORT.md) records this as an accepted residual risk (R1-R9 list), but the explicit acceptance decision is not surfaced in the engineering code or the SPA.

**GAP-007 (high):** Two execution stack paths coexist in the Hermes platform. Stack A applies `ProviderRuntimeGuard` with eight fail-closed checks including tenant isolation. Stack B, entered via `executeCapability`, bypasses all guards. This was identified in `docs/architecture/HERMES_PLATFORM_M1.md`. The security posture of the platform runtime depends entirely on which code path a caller takes.

**GAP-018 (medium):** `security.yml` runs gitleaks with `GITLEAKS_CONFIG: ""`, overriding the `.gitleaks.toml` file and deactivating the custom Cloudflare API token detection rule. The custom rule is the most relevant rule in the repository and is precisely the one not enforced in CI.

### CI/CD gaps

**GAP-004 (critical):** The deploy pipeline (`deploy.yml`) deploys both Cloudflare Workers on every push to `main` with no test run and no typecheck. The only quality gate between a bad commit and production is the author's review of their own work. Three integrity checks (repo cleanliness, required files, import graph) and the production-bundle endpoint guard run successfully, but they cannot catch logic errors or type regressions.

**GAP-019 (medium):** Replit development runs Node 24; CI runs Node 22; `.node-version` pins to 22. All three should agree. The discrepancy creates a class of platform-behaviour differences that are reproducible locally but not in CI, and vice versa.

### Type duplication

**GAP-020 (medium):** `AgentCapability`, `AgentState`, `ActivationState`, and `AgentRecord` are independently defined in both `shared/contracts/agent.ts` and `hermes/agents/registry.ts`. Two distinct `Principal` interfaces coexist in `hermes/identity/types.ts` and `hermes/contracts/platform-api.ts`. The EPIC-007 plan describes `hermes/services/execution/` depending on `workers/src/platform/{epcl,was}/`, which would invert the established `workers → hermes` direction and create a build-breaking circular dependency if implemented as written.

### Schema and migration hygiene

**GAP-017 (medium):** Two migrations share the `0002_` prefix (`0002_identity_core.sql` and `0002_rbac_foundation.sql`). Migration `011_` lacks the leading zero used by all other migrations, causing incorrect lexical ordering. Neither problem has corrupted the live database but both indicate the migration-naming convention broke during rapid delivery and has not been enforced since.

**GAP-016 (medium):** `workers/src/version.ts` reports `SERVICE_VERSION = "1.1.0"` while `CHANGELOG.md` is at `1.6.0`. The `extract-version.sh` script that regenerates the constant is called in the deploy script but the constant in the repo does not reflect current reality. Deployed builds misreport their own version, which complicates incident triage against Cloudflare logs.

### Dead code

**[OBSERVED]** `lib/api-zod` and `lib/db` are self-declared deprecated, appear in root `tsconfig.json` project references, and are consumed only by `artifacts/api-server` — an Express prototype that is never deployed. They add compilation weight to every `typecheck:libs` invocation and will confuse a new contributor into thinking a PostgreSQL database is still in use.

**[OBSERVED]** `hermes/services/application/types.ts` is explicitly marked as a stub with no consumers in `.hermes/reconciliation-report.md`. Three test files that require custom runners are excluded from both vitest configs and cannot be run in the standard test pipeline.

---

## 5. Documentation Health

### Quantified

| Metric | Count |
|---|---|
| Total markdown files | 514 (47 root + 467 in `docs/`) |
| Catalogued documentation conflicts | 7 |
| Overlapping directory sets | 6 |
| ADR directories with number collision at ADR-016 | 2 |
| Documents classified AUTHORITATIVE in root | 17 |
| Documents classified HISTORICAL in root | 23 |
| Documents classified UNCERTAIN or SUPERSEDED | 5 |
| Global docs index or README at docs/ root | 0 |
| ADRs indexed in root DECISIONS.md | 1 (of 19 total) |

The seven catalogued conflicts (detailed in `G_root_docs_catalogue.md`) are not all equal. The most operationally dangerous are:

- **Conflict 5:** `CURRENT_SPRINT.md` reports all quality gates passed; `WAVE2_AUDIT_REPORT.md` documents that the certified orchestration path was never invoked. A session reading only `CURRENT_SPRINT.md` will incorrectly believe the platform autonomy was exercised and verified.
- **ADR-016 collision (GAP-011):** Two completely different architectural decisions share the number ADR-016. Citing "ADR-016" in a new document is ambiguous.
- **`DECISIONS.md` as an index (GAP-012):** The file that should be an ADR index contains exactly one entry out of nineteen.

### The mechanism of drift

**[INFERRED]** The documentation problems share a single root cause: **work is tracked in markdown rather than in a structured issue tracker, with no authority convention and no index discipline**. The specific failure modes that follow from this root cause are:

1. **Point-in-time reports are named like current-state documents.** Files like `PLATFORM_BASELINE_v1.md` (61 KB, frozen at 2026-07-25), `COMPLETION_REPORT.md`, and `OPERATIONAL_READINESS_REPORT.md` are titled with terms that imply current validity. They are not current. Without a reader knowing the date and the project timeline, these documents actively mislead.

2. **No authority convention.** There is no rule that establishes which document wins when two documents conflict. `CURRENT_SPRINT.md` and `WAVE2_AUDIT_REPORT.md` contradict each other on a material fact; neither document references the other.

3. **ADRs split across two directories mid-project.** The split at ADR-012 (when `docs/adr/` was created alongside the existing `docs/decisions/`) was not accompanied by a redirect or index update. The result is an ADR-016 number collision.

4. **`docs/operations/` and `docs/ops/` serve the same purpose.** Neither directory is named to distinguish its scope. With 124 and 74 files respectively, a reader cannot determine which is authoritative without reading both. The total 198 files represent the majority of the operational record.

5. **No prior index.** Before this assessment's context layer, no `docs/README.md` existed, `docs/governance/GOVERNANCE_INDEX.md` covered only governance documents, and `docs/architecture/README.md` listed a single ADR written at project inception. A new reader had no entry point.

---

## 6. Engineering Process Assessment

### What the evidence shows

**[OBSERVED]** The repository operates trunk-based development with approximately 98% of commits flowing directly to `main`. Only 3 pull requests exist in the repository's history: 1 bot PR (open, unactioned since 2026-07-15), 1 production-incident fix (self-merged within 2 minutes of opening), and 1 security fix (open, unmerged after 24 hours). There is no external code review. The repository has 0 GitHub Issues; work is tracked in markdown documents.

Commit authorship shows heavy AI involvement. The project is explicitly built around Replit's AI agent infrastructure (`agent.stack = "PNPM_WORKSPACE"`, `expertMode = true`). Two commits are authored directly as `Hermes Agent`. The project operating model (`AI_OPERATING_MODEL.md`) describes AI-authored delivery with human approval gating.

### The 2026-07-28 incident

**[OBSERVED]** Three P0 commits cluster on 2026-07-28, shortly after the v1.0.0 production release:

- `59dd51c` — PBKDF2 iterations reduced from the initial value for Cloudflare Workers compatibility (a platform constraint that differs from a local Node.js environment)
- `516f61f` — D1 insert hardening: coerce `undefined` bind values to `null` (the `createSafeD1` wrapper)
- PR #2 (merged same day) — `consentEngine.initialize()` producing Error 1101 in production

The D1 `undefined`-to-`null` issue is the most instructive. The local Miniflare test environment does not enforce D1's strict null requirement, so all tests passed, but production D1 rejected the requests. Without a CI step that runs tests against a real or realistic D1 environment, this class of defect is invisible until production. The bundle guard added to `deploy.yml` step 9 (failing if the built JavaScript does not contain the `VITE_API_BASE` host) is the immediate operational response to the wrong-endpoint incident — evidence of operational learning but also evidence of the failure mode: a condition that would have been caught by a typecheck or integration test was instead caught by a production incident and a retroactive guard.

### What this velocity buys

**[INFERRED]** A single developer with AI assistance shipped nine waves of patient-facing functionality, an identity platform, a trust runtime, a document management system, a workflow engine with approval gates, and two Telegram bots in approximately six weeks. The CHANGELOG records 35 version entries from `0.1.0` to `1.21.0` in that window. The public-facing site is live, the API is deployed, and real infrastructure is in place. That is a genuinely remarkable output rate for a solo project.

### What it costs

**[INFERRED]** Three costs are visible in the evidence:

1. **Undetected regressions reach production.** With no test or typecheck gate in the deploy pipeline, every push to `main` is a production deployment of unverified code. The 26% fix-commit rate (26 of 100 commits carry a `fix:` prefix) is consistent with this — regressions are caught in production and fixed there rather than blocked before merge.

2. **Security work is deferred.** PR #3 (clinic route auth guard) was opened 2026-08-03 and has not been merged as of this report date. The fix exists; the process that would merge it (human review, automated gate, or enforced branch protection) does not.

3. **Technical decisions are made under time pressure without a record.** The `AUTHORIZATION_ENGINE` gap, the in-memory trust engines, and the unprovisioned NOTIFICATIONS database are all decisions or deferrals that were not recorded as ADRs. They are now implicit constraints that a future session must discover by reading the code, not by reading the decisions.

---

## 7. Strengths

This section is not a courtesy. The following are genuine engineering assets that should be preserved and extended rather than replaced.

**Platform subsystem code quality.** The code in `workers/src/platform/` is well-structured TypeScript with clean interface boundaries, explicit error types, and clear separation of concerns between engines. The trust runtime in particular — six engines with typed request and response contracts, a decision pipeline that composes trust, consent, policy, and risk — represents substantive engineering work, not scaffolding. The fact that some engines are not yet wired to D1 does not diminish the quality of what is there.

**Identity and session management.** The `IdentityRouter` with its full suite of auth flows (registration, login, OAuth/OIDC/SAML, TOTP MFA, magic link, email verification, password reset, refresh token rotation) is a production-grade identity stack. It is D1-backed, it covers the key flows a patient portal needs, and the credential rotation mechanism goes beyond what most solo projects implement.

**The OpenAPI-to-generated-client pipeline.** `lib/api-spec/openapi.yaml` → Orval → `lib/api-client-react/src/generated/` is a real engineering asset. A type-safe API client generated from the spec means the frontend cannot silently diverge from the API contract. The generated output is current relative to the spec. This should be extended to cover the full API surface (currently it covers only health and consultation endpoints).

**The pre-deploy integrity checks.** The four-gate pipeline (`scripts/repo-integrity-check.sh`, `scripts/required-files-check.sh`, `scripts/import-integrity-check.py`, and the bundle endpoint guard) catches a genuine class of deployment error. The import integrity check in particular — a 500-line Python script that resolves the full import graph including `@hermes/*` and Wrangler aliases — is sophisticated tooling that prevents broken imports from reaching production. The post-incident bundle guard is evidence of operational learning being codified into the pipeline.

**The ADR practice.** Eighteen ADRs exist, and the later ones (ADR-012 through ADR-018 in `docs/adr/`) are substantive records of meaningful decisions. ADR-001 (Cloudflare migration), ADR-015 (governance freeze), and ADR-018 (EPCL architecture) are particularly complete. The practice exists and produces value; it needs an index and a single authoritative home directory, not a replacement.

**Provider-neutral interfaces in `shared/`.** Ten provider abstractions (`IdentityProvider`, `PermissionProvider`, `AuditProvider`, `DataStore`, `ObjectStorage`, `Queue`, `NotificationProvider`, `Scheduler`, `SecretProvider`, `LoggingProvider`) with the dependency rule enforced by convention are a genuinely good abstraction layer. They create the conditions under which storage backends, notification providers, and identity providers can be swapped without touching business logic. The fact that most implementations are currently in-memory makes the abstraction more valuable, not less.

**The WAS state machine and constitutional validator.** Even with all flags off, the `WorkforceActivationService` state machine (PENDING → VALIDATING → ACTIVATING → ACTIVE → DEACTIVATING → DEACTIVATED, with FAILED and REJECTED terminal states), its duplicate-execution protection, and its recovery orchestrator represent careful design. If the platform track is ever activated, this is a solid foundation.

---

## 8. Prioritised Recommendations

All items are `[RECOMMENDED]`. Items already completed are not listed; no item here should be read as something that has already been done.

| Priority | Recommendation | Rationale | Effort | Related GAPs |
|---|---|---|---|---|
| 1 | **[RECOMMENDED]** Merge PR #3 (`fix/clinic-route-auth-guard`) | Six clinic routes are currently reachable without authentication. The fix is written and reviewed. Every day it remains unmerged is a live security exposure. | S | GAP-003 |
| 2 | **[RECOMMENDED]** Add `typecheck` and `vitest run` as required pre-deploy steps in `deploy.yml`, blocking deployment on failure | This single change prevents the entire class of production incident documented on 2026-07-28. The test suite (68 files, workers vitest config with Miniflare) already exists and runs correctly when invoked. | S | GAP-004 |
| 3 | **[RECOMMENDED]** Resolve the `consents` schema conflict by inspecting the live D1 schema and writing a reconciliation migration | Code written against the 0008 schema fails against the live table created by 0006. Until this is resolved, the consent system's durability is unpredictable. This must be fixed before attempting to wire the ConsentEngine to D1. | M | GAP-002 |
| 4 | **[RECOMMENDED]** Wire `ConsentEngine` and `DelegationEngine` to their D1-backed tables | Consent revocation in a healthcare context must be durable. The tables exist. The engines have the right shape. This is an integration step, not a design step. | M | GAP-006 |
| 5 | **[RECOMMENDED]** Construct and wire `AUTHORIZATION_ENGINE`, or remove the two broken endpoints and the Env type declaration | `POST /api/v1/authorization/check` and `GET /api/v1/permissions` currently throw at runtime. The declared-but-absent binding is a gap that cannot be left in the type. | S | GAP-001 |
| 6 | **[RECOMMENDED]** Make an explicit, recorded decision about the dormant platform track (EPCL → WAS → WEF) | The 11 defaulted-false flags and the zero HTTP routes mean the platform track is effectively parked. The cost of not deciding is repeated context pollution in every AI session that reads the certification documents. The decision should be an ADR: either "this track is active with a defined enablement path" or "this track is parked pending [condition]". | S | GAP-005 |
| 7 | **[RECOMMENDED]** Provision the `agsynergy-notifications` D1 database and populate `database_id` in `wrangler.jsonc`, or remove the binding | The binding is declared in all environments. Any code path reaching this binding fails at runtime. | S | GAP-008 |
| 8 | **[RECOMMENDED]** Fix the `security.yml` gitleaks configuration to load `.gitleaks.toml` | The custom Cloudflare API token detection rule is not active in CI. Setting `GITLEAKS_CONFIG` to the path of the repository config file is a one-line fix. | S | GAP-018 |
| 9 | **[RECOMMENDED]** Pin development and CI to the same Node.js major version | `.node-version` and `deploy.yml` both pin to 22; `.replit` uses 24. One of these must move to match the others. | S | GAP-019 |
| 10 | **[RECOMMENDED]** Extend the OpenAPI spec and Orval codegen to cover the full JWT-gated API surface, replacing the handwritten clients in `artifacts/ags-fertility/src/lib/` | The current spec covers only 3 of 110+ endpoints. The codegen infrastructure is already in place and working. Inconsistent `API_BASE` handling across `patient-api.ts`, `document-api.ts`, and `appointment-api.ts` is the direct descendant of handwritten clients not sharing a single base configuration. | L | (no single GAP; relates to frontend API integration hygiene) |

---

## 9. What This Assessment Could Not Determine

The following are `[UNKNOWN]` items that the repository alone cannot resolve.

| Unknown | Evidence that would resolve it |
|---|---|
| Live D1 schema ground truth — specifically: which definition of `consents` table exists in `agsynergy-db`, and whether every migration in `workers/migrations/` has been applied | Output of `wrangler d1 execute agsynergy-db --command "SELECT * FROM sqlite_master WHERE type='table'"` and `wrangler d1 execute agsynergy-db --env production --command "PRAGMA migration_version"` |
| Whether the dormant feature flags (`ENABLE_EXECUTIVE_WORKFLOW`, `ENABLE_AUTONOMOUS_EXECUTION`, etc.) are off by deliberate policy or by neglect | An ADR or decision document explicitly addressing the platform track status; alternatively, a comment in `epcl/feature-flags.ts` explaining the condition under which they would be enabled |
| Actual production traffic and error rates — whether `POST /api/v1/authorization/check` is being called and how often it is failing with `TypeError` | Cloudflare Workers Tail logs or Logpush data for `agsynergy-api` |
| Runtime behaviour of the Cloudflare Access setup (whether `agsynergy.ca` is currently gated behind Zero Trust authentication and therefore not publicly accessible) | The `secure-access.yml` workflow was written but it is only triggered manually (`workflow_dispatch`); whether it has ever been run is not determinable from the repository |
| Whether the clinic console authentication gap (GAP-003) has been exploited — i.e., whether unauthenticated requests to `/api/v1/clinic/*` routes have been made in production | Cloudflare Workers request logs filtered to the `/api/v1/clinic/` path |
| The state of the `NOTIFICATIONS` D1 binding in production — whether the empty `database_id` in `wrangler.jsonc` causes silent failure or an immediate startup error | Cloudflare Workers binding introspection; Tail logs from `agsynergy-api` startup events |
| Whether the PBKDF2 100,000-iteration reduction (`hotfix: reduce PBKDF2 iterations to 100k`, 2026-07-28) is within an acceptable security threshold for the patient credential security model | An explicit security analysis of the hash work factor relative to NIST SP 800-132 guidance; this was not documented as an ADR at the time of the hotfix |
| Coverage of the hermes/ service layer — what percentage of the 222+ TypeScript files in `hermes/` is exercised by the test suite | A coverage report from `vitest.epic005.config.ts` with a threshold enforced; currently coverage is opt-in and no threshold is configured |
| Whether the `lib/api-client-react/src/generated/` output is byte-identical to what `pnpm codegen` would produce today | Running `pnpm codegen` and comparing output; the schema content appears current but byte-level freshness is not determinable without execution |

---

*End of engineering assessment.*
