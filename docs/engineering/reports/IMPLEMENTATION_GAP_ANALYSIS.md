# Implementation Gap Analysis
## Concierge Website — Production Readiness Assessment
**Repository:** `kumarlogan/concierge-website` | **Branch:** `main` | **HEAD:** `0b5e0c3`
**Assessment Date:** 2026-08-04 | **Register Version:** 1.0
**Compiled from:** P1, P2, P3, P4, T1, T2 assessments + KNOWN_GAPS.yaml (GAP-001..GAP-020)

---

## 1. Purpose, Scope, and Method

### 1.1 Purpose

This register consolidates the findings of six independent production-readiness assessments into a single, deduplicated, sequenced gap register. It is the authoritative source of record for prioritising pre-GA engineering work on the `kumarlogan/concierge-website` platform.

### 1.2 GA Bar

The bar is **general availability launch with real patients at scale for a Canadian fertility clinic (agsynergy.ca) handling patient health data.** This means:

- Real personal health information (PHI) is written, read, and transmitted.
- Patients include individuals undergoing IVF, a medically and emotionally sensitive context.
- Applicable privacy law includes PIPEDA and provincial health privacy legislation.
- Data loss, data exposure, and broken patient-facing flows are not acceptable incidents; they are compliance failures.
- Clinic staff rely on the system as an operational tool. Missing or mocked data is not a prototype limitation; it is a broken production system.

**Out of scope:** The Hermes AI platform (EPCL/WAS/WEF autonomous pipeline). GAP-005 from KNOWN_GAPS.yaml confirms this track is unreachable behind all-false feature flags and is noted here only where it affects in-scope surfaces.

### 1.3 Classification Scheme

| Status | Meaning |
|---|---|
| `Complete` | Works end-to-end with D1/R2 persistence; acceptable UX; no critical defect |
| `Partially Complete` | UI or API exists but a key sub-capability is missing, or data does not persist durably |
| `Missing` | Route, capability, or infrastructure element is entirely absent |
| `Broken` | Code exists but will fail at runtime in a way a real patient or operator would observe |
| `Technical Debt` | Works today but carries elevated risk that must be addressed before scale |

### 1.4 Severity Scheme

| Severity | Meaning at GA Bar |
|---|---|
| **Critical** | Will cause data loss, PHI exposure, patient lockout, or regulatory violation in production. Must be resolved before any patient data is loaded. |
| **High** | Materially degrades platform reliability, security, or operator capability. Must be resolved before GA launch. |
| **Medium** | Degrades quality, maintainability, or a secondary capability. Should be resolved in the first post-launch sprint. |
| **Low** | Hygiene, documentation, or minor consistency issue. Acceptable to defer. |

### 1.5 Evidence Tags

- `[OBSERVED]` — finding derives from directly reading source files
- `[INFERRED]` — finding is a logical conclusion from observed evidence
- `[UNKNOWN]` — cannot be determined from repository evidence alone

### 1.6 Effort Caveat

Effort figures are engineering-day ranges inferred from repository evidence only. They assume engineers already familiar with the codebase and Cloudflare Workers architecture. They exclude: product design, UX review, compliance officer sign-off, QA cycles, coordination overhead, and external vendor onboarding (SES, Twilio, FCM). Ranges are expressed as `low–high`.

---

## 2. Summary Statistics

### 2.1 Overall

| Metric | Value |
|---|---|
| Total gaps in register | 52 |
| Critical severity | 22 |
| High severity | 20 |
| Medium severity | 8 |
| Low severity | 2 |

### 2.2 By Classification

| Classification | Count |
|---|---|
| Broken | 19 |
| Missing | 17 |
| Partially Complete | 9 |
| Technical Debt | 7 |

### 2.3 By Area

| Area | Gap Count | Critical | High |
|---|---|---|---|
| Patient Journey / Portal | 10 | 7 | 3 |
| Authorization / IDOR | 9 | 7 | 2 |
| Platform Engines (in-memory) | 6 | 5 | 1 |
| Clinic Portal | 5 | 4 | 1 |
| Notifications / SSE | 4 | 1 | 3 |
| CI/CD / Testing | 4 | 2 | 2 |
| Security Posture | 4 | 0 | 4 |
| Observability | 4 | 0 | 4 |
| Consultation Workflow | 3 | 2 | 1 |
| Disaster Recovery | 2 | 2 | 0 |
| Database / Schema | 2 | 2 | 0 |
| File Management | 3 | 1 | 2 |
| Deployment | 3 | 0 | 3 |
| CRM | 2 | 1 | 1 |
| Admin Functions | 2 | 0 | 2 |
| Website | 2 | 0 | 2 |
| API Contract | 1 | 0 | 1 |

### 2.4 By Domain

| Domain | Gap Count | Critical | High |
|---|---|---|---|
| Product | 32 | 17 | 10 |
| Platform | 20 | 5 | 10 |

### 2.5 GA Readiness Score (from SCORING_TABLE.txt)

Weighted score: **92 / 272 = 33.8%**. Product: 33.1%. Platform: 34.6%. Area classification counts: 1 Complete-untested, 14 Broken, 11 Partially Complete, 2 Missing.

---

## 3. Master Gap Register

Stable identifiers are `PRG-001` onward. Items are grouped by severity tier, Critical first. Within each tier, items are ordered by execution sequence.

Cross-references to KNOWN_GAPS.yaml use `[GAP-0NN]` notation.

---

### 3.1 Critical Severity

---

**PRG-001**
| Field | Value |
|---|---|
| **Title** | Clinic console routes have no authentication guard |
| **Area** | Clinic Portal / Authorization |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 1 |
| **Cross-ref** | GAP-003 |

**Description:** All six `/clinic/*` frontend routes render `ClinicLayout` without any `AuthGuard` HOC. Any unauthenticated browser can visit `/clinic/dashboard`, `/clinic/patients`, `/clinic/search`, `/clinic/patient-status`, `/clinic/messages`, and `/clinic/patients` without credentials. Additionally, backend clinic API routes (`clinic.ts`, `clinic-messages.ts`) apply `withJwtAuth` but perform no `identity_type` role check — any patient-authenticated user can call clinic endpoints. PR #3 (branch `fix/clinic-route-auth-guard`) exists but is unmerged at HEAD `0b5e0c3`. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/App.tsx` — all six clinic routes lack `<AuthGuard>` wrapper [OBSERVED]
- `workers/src/routes/clinic.ts` — `withJwtAuth` only, no role check [OBSERVED]
- `workers/src/routes/clinic-messages.ts` — same pattern [OBSERVED]
- KNOWN_GAPS.yaml `GAP-003` [OBSERVED]

**Consequence at GA:** Any unauthenticated member of the public can reach the clinic workspace in the browser. When mock data is replaced with real patient records (required for GA — see PRG-009), this becomes a direct PHI exposure without requiring any authentication.

**Dependencies:** None (prerequisite for PRG-009, PRG-010, PRG-031).

**Effort:** 0.5–1 day (merge PR #3; add role check to backend clinic routes).

---

**PRG-002**
| Field | Value |
|---|---|
| **Title** | No CI test or typecheck gate — broken code auto-deploys to production |
| **Area** | CI/CD |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 2 |
| **Cross-ref** | GAP-004 |

**Description:** `.github/workflows/deploy.yml` fires on every push to `main` and deploys both workers without running the 68-file test suite or executing `tsc`. The deploy pipeline runs three integrity checks (repo cleanliness, required files, import graph) and a production-bundle hostname guard — but no automated tests and no typecheck. 218 known TypeScript compile errors exist across the codebase (`trust/`, `documents/`, `timeline/`, `credentials/`, `epcl/`, `hermes/*`) and are documented in `EPIC-015_BACKLOG.md` as deliberately deferred. Wrangler/esbuild type-strips at build time so the Worker deploys successfully despite 218 compile errors. [OBSERVED]

**Repository Evidence:**
- `.github/workflows/deploy.yml` — no vitest step, no tsc step [OBSERVED]
- `workers/vitest.config.ts`, root `vitest.config.ts` — 68 test files never invoked in CI [OBSERVED]
- `EPIC-015_BACKLOG.md` — 218 TS errors documented as deferred baseline [OBSERVED]
- KNOWN_GAPS.yaml `GAP-004` [OBSERVED]

**Consequence at GA:** Any engineer's commit — including a regression in patient authentication, data persistence, or authorization — reaches production automatically. A patient submitting a consultation request or logging in may encounter a 500 error caused by a code change that was never tested.

**Dependencies:** None (foundation for all subsequent quality gates).

**Effort:** 1–2 days (add `pnpm vitest run` + `pnpm tsc --noEmit` as required CI steps; add migration step).

---

**PRG-003**
| Field | Value |
|---|---|
| **Title** | Patient registration auto-verifies email without the patient clicking a link |
| **Area** | Patient Journey — Registration |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 6 |
| **Cross-ref** | — |

**Description:** `RegisterPage.tsx` calls `requestEmailVerification(identityId, email)` and then immediately calls `completeEmailVerification(verifyResult.token)` in the same registration handler. A code comment explicitly acknowledges this: "dev mode — in production the user would click a link from their email." In production today, registration succeeds and the email is marked verified before any email is sent or any link is clicked. No patient ever proves ownership of their email address. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/pages/patient/RegisterPage.tsx` lines ~95–102 [OBSERVED]

**Consequence at GA:** Patients register without proving email ownership. On a platform handling fertility health data under Canadian privacy law, identity verification is a baseline requirement. An attacker could register accounts under email addresses they do not control.

**Dependencies:** PRG-004 (landing page must exist before the real flow can work).

**Effort:** 2–3 days (remove auto-verify; implement send-and-wait; build verification landing page as PRG-004).

---

**PRG-004**
| Field | Value |
|---|---|
| **Title** | No email verification landing page route exists |
| **Area** | Patient Journey — Registration |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 7 |
| **Cross-ref** | — |

**Description:** Once PRG-003 is fixed and patients receive a verification email with a link, there is no route in the SPA for them to land on. `App.tsx` does not register `/patient/verify-email` or any equivalent path. `ForgotPasswordPage.tsx` exists but no email-click landing page does. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/App.tsx` — complete route list, no `/patient/verify-email` [OBSERVED]

**Consequence at GA:** Patients click the verification link in their email and reach a 404. Registration is permanently blocked for new patients.

**Dependencies:** PRG-003.

**Effort:** 1–2 days.

---

**PRG-005**
| Field | Value |
|---|---|
| **Title** | MFA-enrolled patients hit a 404 after login — no `/patient/mfa` route |
| **Area** | Patient Journey — Authentication |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 5 |
| **Cross-ref** | — |

**Description:** When `login()` returns `mfaRequired: true`, `auth-context.tsx` throws `"MFA_REQUIRED"`. `LoginPage.tsx` catches this and calls `navigate("/patient/mfa")`. That route is not registered in `App.tsx`. Any patient who has enrolled MFA is immediately redirected to a 404 after entering valid credentials. They cannot log in at all. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/pages/patient/LoginPage.tsx` line ~82: `navigate("/patient/mfa")` [OBSERVED]
- `artifacts/ags-fertility/src/App.tsx` — no `/patient/mfa` route registered [OBSERVED]

**Consequence at GA:** Any patient who enables MFA (a security best practice) is permanently locked out of their account.

**Dependencies:** None.

**Effort:** 2–3 days (implement MFA challenge page; wire TOTP verification; handle success/failure).

---

**PRG-006**
| Field | Value |
|---|---|
| **Title** | Timeline engine is in-memory per-request — IVF journey data evaporates on every call |
| **Area** | Patient Journey / Portal — Timeline |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 14 |
| **Cross-ref** | GAP-006 (partial) |

**Description:** `routes/timeline.ts` function `getEngine()` returns `new InMemoryTimelineEngine()` on every HTTP request. Every call to `PATCH /api/v1/timeline/stages/:stage/advance` updates an in-memory object that is discarded when the response is returned. No D1 migration for any `timeline_*` table exists across all 12 migrations (0001–0011). The `InMemoryTimelineEngine` is pre-seeded with IVF demo stages and returns them fresh for every patient on every request. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/timeline.ts:getEngine()` — comment: "In production this would be backed by D1/KV" [OBSERVED]
- All 12 migrations — zero `timeline_*` tables [OBSERVED]
- `workers/src/platform/timeline/InMemoryTimelineEngine` — 14 KB in-memory implementation [OBSERVED]
- P1 assessment §2.1 Step 7; P3 §2 [OBSERVED]

**Consequence at GA:** An IVF patient's entire journey record — current stage, phase, date projections — is reset to demo data on every page load. A real patient would be told they are at "Day 1 Baseline" regardless of how far they have progressed. Clinicians relying on this data would have no valid record.

**Dependencies:** None (schema migration first; then D1 engine implementation).

**Effort:** 1 day (schema migration) + 5–8 days (D1 implementation of `TimelineEngine` interface) = 6–9 days total.

---

**PRG-007**
| Field | Value |
|---|---|
| **Title** | Care Plan and Tasks pages always 404 — backend routes do not exist |
| **Area** | Patient Portal — Care Plan / Tasks |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 8 |
| **Cross-ref** | — |

**Description:** `CarePlanPage.tsx` calls `GET /api/v1/timeline/phases`. `TasksPage.tsx` calls `GET /api/v1/timeline/tasks`. Neither route is registered in the backend route table. Both pages return a 404 error response on every load for every patient. The Milestones page (`GET /api/v1/timeline/milestones`) does exist. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/pages/patient/CarePlanPage.tsx` — calls `/api/v1/timeline/phases` [OBSERVED]
- `artifacts/ags-fertility/src/pages/patient/TasksPage.tsx` — calls `/api/v1/timeline/tasks` [OBSERVED]
- `B_worker_api_layer.md §2.10` — these routes are absent from the route table [OBSERVED]

**Consequence at GA:** Two key patient-facing portal pages — the care plan view and the task list — fail to load for every patient. Patients cannot see their IVF care plan or assigned tasks.

**Dependencies:** PRG-006 (timeline D1 backing for meaningful data).

**Effort:** 1–2 days (implement routes; map to existing or new engine methods).

---

**PRG-008**
| Field | Value |
|---|---|
| **Title** | Document upload calls the wrong function — patients cannot upload medical records |
| **Area** | Patient Portal — Documents |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 9 |
| **Cross-ref** | — |

**Description:** `UploadDialog.handleUpload` in `DocumentsPage.tsx` calls `fetchDocuments()` instead of `initiateUpload()`. A TODO comment in the code acknowledges this. The R2 bucket (`agsynergy-documents`) is provisioned and the upload API route exists, but the frontend never invokes it. No file is ever transmitted. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/pages/patient/DocumentsPage.tsx` — `UploadDialog.handleUpload` [OBSERVED]
- `workers/wrangler.jsonc` — `DOCUMENT_STORAGE` R2 binding is configured [OBSERVED]
- P1 assessment §2.1 Step 9; §3.2 Documents row [OBSERVED]

**Consequence at GA:** Patients cannot upload medical records, prior treatment history, or diagnostic images. A fertility clinic that cannot receive patient documents cannot operate a care coordination workflow.

**Dependencies:** None.

**Effort:** 1–2 days (fix call to `initiateUpload`; wire presigned PUT flow end-to-end).

---

**PRG-009**
| Field | Value |
|---|---|
| **Title** | Clinic portal returns 8 hardcoded mock patients — clinic staff see fake data |
| **Area** | Clinic Portal — Patient List / Detail |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 18 |
| **Cross-ref** | — |

**Description:** `routes/clinic.ts` defines `_mockPatients` — an array of 8 hardcoded patient objects. `GET /api/v1/clinic/patients`, `GET /api/v1/clinic/patients/:id`, and the provider dashboard all return from this array. No D1 read is performed. Filtering is a local array filter on the mock data. A clinic staff member logging in sees 8 fictional patients, not real consultation records. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/clinic.ts` — `_mockPatients` array [OBSERVED]
- P2 assessment §1.3 [OBSERVED]
- `B_worker_api_layer.md §8.3` [OBSERVED]

**Consequence at GA:** Clinic staff have no visibility into real patients. Clinical care coordination using the platform is impossible. Data shown to staff is invented.

**Dependencies:** PRG-001 (auth guard must exist before wiring real data), PRG-023 (appointments must be D1-backed to be joinable).

**Effort:** 10–20 days (requires patient data model, D1 linkage between identity platform and clinic views, real queries).

---

**PRG-010**
| Field | Value |
|---|---|
| **Title** | Triage queue and patient conversation endpoints return hardcoded mock data |
| **Area** | Clinic Portal — Messaging |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 19 |
| **Cross-ref** | — |

**Description:** `routes/clinic-messages.ts` defines `_mockTriageQueue` (3 hardcoded items) and `_getPatientConversations()` which projects from the mock queue. `GET /api/v1/clinic/messages/triage` always returns these 3 items. `GET /api/v1/clinic/messages/patients` returns a projection of mock data with comment "In production this would aggregate all patient conversations." `PATCH /api/v1/clinic/messages/threads/:threadId/flag` always returns `{flagged: true}` with comment "In production this would update a DB record." [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/clinic-messages.ts` — `_mockTriageQueue`, `_getPatientConversations`, `_flagThread` [OBSERVED]
- P2 assessment §1.3 [OBSERVED]
- `B_worker_api_layer.md §8.4, §8.7` [OBSERVED]

**Consequence at GA:** Clinic staff cannot see real patient messages. The message triage workflow is non-functional. Flagging a message thread is a no-op.

**Dependencies:** PRG-001 (auth guard), PRG-027 (message persistence).

**Effort:** 5–10 days (real message aggregation queries; flag persistence; D1-backed triage logic).

---

**PRG-011**
| Field | Value |
|---|---|
| **Title** | Consent grants are in-memory — evaporate on Worker cold start |
| **Area** | Patient Journey / Platform — Consent |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 13 |
| **Cross-ref** | GAP-006 |

**Description:** `ConsentEngine` is a module-level in-memory singleton backed by `Map<string, Consent[]>`. The D1 `consents` table exists but is not wired to the engine. All consent grants and revocations are written to the in-memory Map and evaporate when the Worker isolate is recycled (Cloudflare evicts idle isolates after ~30 seconds of inactivity). The `consents` table schema also has a critical conflict (see PRG-014). Downstream features that depend on consent — appointments, messaging, document access, workflow start — all rely on the consent engine returning correct state. The engine fails closed on error (returns DENY), so cold-start grant loss produces spurious 403 errors. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/trust/consent-engine.ts` — `Map<string, Consent[]>` singleton [OBSERVED]
- `workers/migrations/0008_consent_engine.sql` — D1 table exists, not wired [OBSERVED]
- P3 §7 cross-cutting observation [OBSERVED]
- `E_data_layer.md §11` [OBSERVED]
- KNOWN_GAPS.yaml `GAP-006` [OBSERVED]

**Consequence at GA:** A patient grants consent for appointment scheduling. On the next page load (new isolate), the consent is absent. The appointment booking fails with "Consent not granted." A clinical platform that loses compliance records on routine runtime events is not suitable for real patients.

**Dependencies:** PRG-014 (schema conflict must be resolved before D1 wiring).

**Effort:** 5–8 days (wire engine to D1; implement D1 read/write for grant, revoke, history).

---

**PRG-012**
| Field | Value |
|---|---|
| **Title** | No disaster recovery — no backup or restore procedure for patient data |
| **Area** | Platform — Disaster Recovery |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 3 |
| **Cross-ref** | — |

**Description:** No backup tooling, no backup schedule, no export script, and no restore procedure exist anywhere in the repository. Cloudflare D1 offers Point-in-Time Recovery (PITR) on paid plans, but there is no evidence PITR is enabled or tested. R2 has no lifecycle rules, no versioning, no cross-region replication, and no backup procedure. If the `agsynergy-db` D1 database is corrupted or deleted, re-applying migration SQL files restores schema only — all patient data is permanently lost. If the R2 bucket is deleted, all patient documents are unrecoverable. [OBSERVED]

**Repository Evidence:**
- `.github/workflows/deploy.yml`, `scripts/` — no backup step [OBSERVED]
- `workers/wrangler.jsonc` — R2 binding has no `lifecycle_rules` [OBSERVED]
- T2 assessment §2 (Headline Finding 2) [OBSERVED]
- T2 assessment §9 (Disaster Recovery area) [OBSERVED]

**Consequence at GA:** A database corruption event, accidental deletion, or migration mistake results in permanent loss of all patient records, consent grants, consultation leads, and medical documents. For a clinical platform, this is unacceptable at any scale.

**Dependencies:** None (should be addressed in parallel with all other work).

**Effort:** 5–10 days (automated D1 export, R2 snapshot procedure, PITR verification, restore runbook).

---

**PRG-013**
| Field | Value |
|---|---|
| **Title** | AUTHORIZATION_ENGINE never constructed — two endpoints throw TypeError at runtime |
| **Area** | Authorization / Platform |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 10 |
| **Cross-ref** | GAP-001 |

**Description:** `workers/src/types/env.ts` declares `AUTHORIZATION_ENGINE: any`. `routes/trustRuntime.ts` calls `env.AUTHORIZATION_ENGINE.check(body)` and `env.AUTHORIZATION_ENGINE.listPermissions(...)`. `workers/src/index.ts` contains the comment: "NOTE: AUTHORIZATION_ENGINE is intentionally NOT wired here." `wirePlatformEngines()` never sets this property. Every call to `POST /api/v1/authorization/check` or `GET /api/v1/permissions` throws `TypeError: Cannot read properties of undefined (reading 'check')`. The router's catch block returns a 500 and exposes the TypeError message to the API caller. [OBSERVED]

**Repository Evidence:**
- `workers/src/types/env.ts` — `AUTHORIZATION_ENGINE: any` declared [OBSERVED]
- `workers/src/routes/trustRuntime.ts` — two handlers call `.check()` and `.listPermissions()` [OBSERVED]
- `workers/src/index.ts` — explicit comment that engine is not wired [OBSERVED]
- KNOWN_GAPS.yaml `GAP-001` [OBSERVED]

**Consequence at GA:** Any patient or system that calls the authorization check endpoint receives a 500 error with an internal TypeError message exposed in the response body. Internal code structure is leaked to API callers.

**Dependencies:** None.

**Effort:** 3–5 days (implement `AuthorizationEngine.check()` and `.listPermissions()` wrapping existing policy/consent/trust engines; wire into `wirePlatformEngines()`).

---

**PRG-014**
| Field | Value |
|---|---|
| **Title** | `consents` D1 table defined twice with incompatible schemas — live table missing columns |
| **Area** | Database / Schema |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 4 |
| **Cross-ref** | GAP-002 |

**Description:** `0006_trust_runtime.sql` creates `consents` with one schema. `0008_consent_engine.sql` creates `consents` again with a wider schema including `patient_identity_id`, `status`, `resource_type`, `resource_id`, `revoked_by`, `updated_at`. Both use `CREATE TABLE IF NOT EXISTS`. The first migration to run wins; the second is silently ignored. The ConsentEngine code expects the 0008 schema. The live table has the 0006 schema. Any attempt to wire ConsentEngine to D1 (PRG-011) will produce column-mismatch errors. [OBSERVED]

**Repository Evidence:**
- `workers/migrations/0006_trust_runtime.sql` — first `consents` definition [OBSERVED]
- `workers/migrations/0008_consent_engine.sql` — second, wider definition [OBSERVED]
- P3 §7 "consents table schema conflict" [OBSERVED]
- T2 assessment `GAP-DB-001` [OBSERVED]
- KNOWN_GAPS.yaml `GAP-002` [OBSERVED]

**Consequence at GA:** PRG-011 (consent D1 wiring) cannot be completed until this schema conflict is resolved. Without consent persistence, appointment booking, messaging, and document access control are all unreliable at scale.

**Dependencies:** None (prerequisite for PRG-011).

**Effort:** 2–3 days (inspect live D1 schema; write forward migration; verify ConsentEngine code against reconciled schema).

---

**PRG-015**
| Field | Value |
|---|---|
| **Title** | IDOR: Appointment GET by ID has no ownership check — any patient reads any appointment |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `_getAppointmentById` in `routes/wave7.ts` accepts `params.id` and returns the appointment without checking that the authenticated caller owns it. The `_request` parameter is explicitly prefixed `_` (unused). `getIdentityId` is never called. Any authenticated user who knows an appointment UUID can retrieve any other patient's appointment, including patientId, providerId, appointment type, IVF stage, status, notes, and timing. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_getAppointmentById`, `_request` unused, no `getIdentityId` call [OBSERVED]
- P4 assessment §2.2.2 [OBSERVED]

**Consequence at GA:** Cross-patient PHI exposure. In a fertility clinic, the existence of an appointment and its type (e.g., "egg retrieval") constitutes sensitive health information. Any authenticated patient can enumerate other patients' treatment schedules.

**Dependencies:** None.

**Effort:** 0.5 day.

---

**PRG-016**
| Field | Value |
|---|---|
| **Title** | IDOR: Appointment PATCH has no ownership check — any patient modifies any appointment |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `_updateAppointment` in `routes/wave7.ts` does not call `getIdentityId`. Any authenticated user can modify any appointment record by ID. The cancel endpoint (`_cancelAppointment`) correctly checks `appointment.patientId !== identityId`, but the general update handler does not. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_updateAppointment`, no `getIdentityId` call [OBSERVED]
- P4 assessment §2.2.2 [OBSERVED]

**Consequence at GA:** Any authenticated patient can alter another patient's appointment record — rescheduling, cancelling, or modifying treatment details.

**Dependencies:** None.

**Effort:** 0.5 day (add ownership check, same pattern as `_cancelAppointment`).

---

**PRG-017**
| Field | Value |
|---|---|
| **Title** | IDOR: Message thread GET has no ownership check — any patient reads any thread |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `_getThreadMessages` in `routes/wave7.ts` accepts `params.threadId` and returns all messages without verifying the caller is a thread participant. `_request` is unused. Any authenticated user who knows a thread UUID can read clinical communication between a patient and their care team. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_getThreadMessages`, `_request` unused [OBSERVED]
- P4 assessment §2.2.3 [OBSERVED]

**Consequence at GA:** Cross-patient message exposure. Clinical communications — medication instructions, cycle monitoring results, embryo update messages — are readable by any authenticated user.

**Dependencies:** None.

**Effort:** 0.5 day.

---

**PRG-018**
| Field | Value |
|---|---|
| **Title** | IDOR: Workflow search and task search have no identity filter — returns all patients' data |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `_searchWorkflows` calls `engine.searchInstances({ status, limit: 50, offset: 0 })` with no identity filter. `_searchTasks` calls `orchestrator.searchTasks({ limit: 50, offset: 0 })` with no identity filter. Both the workflow event store and task instances are D1-backed. Any authenticated user can enumerate all workflow instances and tasks across all patients. Individual workflow GET handlers (`_getWorkflow`, `_pauseWorkflow`, `_getWorkflowTasks`, `_getTask`, `_getWorkflowHistory`, `_getWorkflowAudit`, `_getApprovals`) also lack ownership checks. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_searchWorkflows`, `_searchTasks` [OBSERVED]
- P4 assessment §2.2.6 [OBSERVED]

**Consequence at GA:** Any authenticated patient can enumerate all IVF workflows, tasks, and approval gates across the entire patient population. Workflows contain IVF journey state (current stage, completed steps, clinical decisions) which is PHI. This is D1-backed, so it is a live concern.

**Dependencies:** None.

**Effort:** 2–3 days (add `patientId` filter to all workflow/task search and get routes).

---

**PRG-019**
| Field | Value |
|---|---|
| **Title** | IDOR: Clinic messaging role-less plus clinic sender impersonation |
| **Area** | Authorization / IDOR — Clinic Messaging |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 12 |
| **Cross-ref** | — |

**Description:** `_getPatientThreads` in `clinic-messages.ts` accepts `?patientId=<any-uuid>` and returns that patient's threads without any role or ownership check. `_sendClinicMessage` hardcodes `senderId: "clinic"` rather than binding to the JWT identity — any authenticated patient can send a message that appears to come from the clinic to any recipient. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/clinic-messages.ts` — `_getPatientThreads`, `_sendClinicMessage` [OBSERVED]
- P4 assessment §2.2.8 [OBSERVED]

**Consequence at GA:** Any authenticated user can read any patient's message threads with clinic staff. Any patient can send a message that appears to come from the clinic — impersonating clinical advice.

**Dependencies:** PRG-001 (auth guard).

**Effort:** 1–2 days.

---

**PRG-020**
| Field | Value |
|---|---|
| **Title** | No consultation submission notification to ops team or patient |
| **Area** | Consultation Workflow |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 16 |
| **Cross-ref** | — |

**Description:** `consultationService.ts` writes the lead to D1 and returns success. No notification of any kind fires — no email to the patient confirming receipt, no email/SMS/Telegram alert to the operations team. The ops team discovers new leads only by polling the Telegram bot (`/leads`) or the HTTP API. No event is published to `EventBus`. [OBSERVED]

**Repository Evidence:**
- `workers/src/services/consultationService.ts` — no notification call after lead insert [OBSERVED]
- P2 assessment §3.1 Step 3 [OBSERVED]

**Consequence at GA:** A prospective patient submits a consultation request and receives only a JSON `{ success: true }`. They have no confirmation that their request was received. The ops team has no push alert — leads can sit unattended indefinitely.

**Dependencies:** PRG-040 (notification delivery must be real, not simulated).

**Effort:** 3–6 days (patient confirmation email; ops push notification; EventBus hook).

---

**PRG-021**
| Field | Value |
|---|---|
| **Title** | Lead status changes are unaudited — no audit log entries written |
| **Area** | Consultation Workflow |
| **Classification** | `Missing` |
| **Severity** | Critical |
| **Execution Order** | 17 |
| **Cross-ref** | — |

**Description:** `opsService.ts:updateLead()` updates the lead's status, priority, and notes in D1 but writes no entry to `audit_logs`. The `audit_logs` table exists. Any status change (new → contacted → qualified → disqualified) is untracked — there is no record of who changed the status or when. The compliance requirement to reconstruct a complete audit trail for patient data handling is violated. [OBSERVED]

**Repository Evidence:**
- `workers/src/services/opsService.ts` — `updateLead()`, no `INSERT INTO audit_logs` [OBSERVED]
- `workers/migrations/` — `audit_logs` table exists [OBSERVED]
- P2 assessment §3.1 Step 5 [OBSERVED]

**Consequence at GA:** A fertility clinic handling patient health data cannot demonstrate who made what decision and when. This is a compliance requirement under PIPEDA and clinical governance standards.

**Dependencies:** None.

**Effort:** 1–2 days.

---

**PRG-022**
| Field | Value |
|---|---|
| **Title** | Workflow engine dashboard JOIN always returns NULL — `workflow_instances` never populated |
| **Area** | Platform — Workflow Engine |
| **Classification** | `Broken` |
| **Severity** | Critical |
| **Execution Order** | 20 |
| **Cross-ref** | — |

**Description:** `WorkflowEngine.startWorkflow()` persists by emitting a `workflow.started` event to `workflow_events` (D1) but never INSERTs a row into `workflow_instances`. `TaskOrchestrator.getDashboardQueue()` issues a LEFT JOIN between `task_instances` and `workflow_instances`. Because `workflow_instances` is never populated, `patient_id` and `current_state` are always NULL in the dashboard result. SLA-at-risk lists and workload data are structurally broken. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/workflow/engine/workflow-engine.ts:startWorkflow()` — no INSERT into `workflow_instances` [OBSERVED]
- `workers/src/platform/workflow/tasks/task-orchestrator.ts:getDashboardQueue()` — JOIN on `workflow_instances` [OBSERVED]
- P3 §1 "Critical gap: workflow_instances table vs event sourcing" [OBSERVED]

**Consequence at GA:** The coordinator dashboard shows no patient identity or current state for any workflow. Clinical coordinators have no operational view.

**Dependencies:** None.

**Effort:** 1–2 days.

---

### 3.2 High Severity

---

**PRG-023**
| Field | Value |
|---|---|
| **Title** | Appointment data stored in-memory (globalThis) — lost on isolate cold start |
| **Area** | Patient Portal / Clinic Portal — Appointments |
| **Classification** | `Broken` |
| **Severity** | High |
| **Execution Order** | 15 |
| **Cross-ref** | GAP-006 |

**Description:** `InMemoryAppointmentEngine` is stored on `globalThis.__appointmentEngine`. Data persists within a single Cloudflare Worker isolate's lifetime but evaporates on cold start. Cloudflare evicts idle isolates after ~30 seconds. Under normal load with multiple isolates, Patient A creates an appointment in isolate A and reads it from isolate B — it does not exist. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `getAppointmentEngine(env)` via `globalThis` [OBSERVED]
- `B_worker_api_layer.md §8.2` [OBSERVED]
- KNOWN_GAPS.yaml `GAP-006` [OBSERVED]

**Consequence at GA:** Patients book appointments that disappear. Clinic staff see inconsistent schedules. A critical feature of clinical operations is non-functional.

**Dependencies:** None.

**Effort:** 5–8 days (D1 migration + D1-backed appointment engine).

---

**PRG-024**
| Field | Value |
|---|---|
| **Title** | Message data stored in-memory — lost on isolate cold start |
| **Area** | Patient Portal / Clinic Portal — Messaging |
| **Classification** | `Broken` |
| **Severity** | High |
| **Execution Order** | 15 |
| **Cross-ref** | GAP-006 |

**Description:** `InMemoryMessageEngine` is stored on `globalThis.__messageEngine`. Messages between patients and clinic staff evaporate on isolate restart. No `messages` or `message_threads` table exists in any D1 migration. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/messaging/message-engine.ts` — in-memory Map [OBSERVED]
- All 12 migrations — no `messages` table [OBSERVED]
- `B_worker_api_layer.md §8.2` [OBSERVED]
- KNOWN_GAPS.yaml `GAP-006` [OBSERVED]

**Consequence at GA:** Patient–provider communications disappear on cold start. A care coordination message from a nurse to a patient about their IVF cycle is lost.

**Dependencies:** None.

**Effort:** 5–8 days (D1 migration + D1-backed message engine).

---

**PRG-025**
| Field | Value |
|---|---|
| **Title** | NOTIFICATIONS D1 binding unprovisioned — notification centre crashes at runtime |
| **Area** | Notifications |
| **Classification** | `Broken` |
| **Severity** | High |
| **Execution Order** | 4 |
| **Cross-ref** | GAP-008 |

**Description:** `workers/wrangler.jsonc` declares the `NOTIFICATIONS` D1 binding with `database_id: ""` across all three environments (top-level, production, preview). The database was never provisioned in Cloudflare. The `DeliveryEngine` guards with `if (!db) return` — silently swallowing failures so deliveries appear to succeed (status = SENT) but are never stored. Additionally, `wrangler.jsonc` declares `d1_databases` twice at the top level — a JSONC duplicate key. Wrangler's behavior with duplicate keys is implementation-defined; this is a deployment reliability defect. [OBSERVED]

**Repository Evidence:**
- `workers/wrangler.jsonc` — `"database_id": ""` for NOTIFICATIONS binding in all envs [OBSERVED]
- `workers/src/platform/notifications/delivery-engine.ts` — `if (!db) return` guard [OBSERVED]
- Duplicate `d1_databases` key confirmed [OBSERVED]
- KNOWN_GAPS.yaml `GAP-008` [OBSERVED]

**Consequence at GA:** All notification delivery records are silently discarded. The notification centre page for patients returns errors. `GET /api/v1/notifications/analytics` always returns empty.

**Dependencies:** None (prerequisite for PRG-040).

**Effort:** 0.5 day (provision D1; set `database_id`; fix duplicate JSON key).

---

**PRG-026**
| Field | Value |
|---|---|
| **Title** | Notification delivery is a simulation — no real email, SMS, or push sent to patients |
| **Area** | Notifications |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 22 |
| **Cross-ref** | — |

**Description:** `DeliveryEngine.deliverToChannel()` contains "Simulate delivery" for all three channels (FCM/push, SES/email, Twilio/SMS). It sets `status = SENT` and records the delivery without calling any external API. No AWS SES credentials, no Twilio credentials, and no FCM service account are configured. No real notification reaches any patient at any time. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/notifications/delivery-engine.ts:deliverToChannel()` — simulation comment [OBSERVED]
- P3 §3 [OBSERVED]

**Consequence at GA:** Patients receive no email or SMS confirmations, appointment reminders, medication alerts, or care updates. A fertility clinic that cannot communicate with patients during an IVF cycle cannot safely operate the platform.

**Dependencies:** PRG-025 (D1 binding must exist first).

**Effort:** 7–11 days (SES email: 2–3 days; Twilio SMS: 2–3 days; FCM push: 3–5 days; HIPAA BAA with vendors prerequisite).

---

**PRG-027**
| Field | Value |
|---|---|
| **Title** | No web admin or ops console — Telegram-only administration not viable at GA scale |
| **Area** | Admin Functions |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 25 |
| **Cross-ref** | — |

**Description:** No web admin UI or operations console exists anywhere in the SPA (`artifacts/ags-fertility/src/App.tsx` has no `/admin` or `/ops` routes). The only operational surfaces are two Telegram bots — both read-only for the ops bot's mutation operations. Operators cannot update lead status, assign leads, or add notes from Telegram. There is no bulk operations capability, no audit trail view in the bot, and no operator self-service provisioning. New operators must be inserted directly into the `users` D1 table. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/App.tsx` — no `/admin` or `/ops` routes [OBSERVED]
- `workers/src/routes/telegram.ts` — read-only commands only [OBSERVED]
- P2 assessment §4 [OBSERVED]

**Consequence at GA:** Clinic managers, compliance officers, and supervisors have no dashboard. Write operations (lead assignment, status update) require raw HTTP API calls. Not viable at GA scale.

**Dependencies:** PRG-009 (real patient data required for a real ops console to be useful).

**Effort:** 20–40 days (full ops dashboard with real data, mutation capabilities, audit view).

---

**PRG-028**
| Field | Value |
|---|---|
| **Title** | JWTs stored in localStorage — XSS yields full token theft on a PHI platform |
| **Area** | Security Posture |
| **Classification** | `Technical Debt` |
| **Severity** | High |
| **Execution Order** | 24 |
| **Cross-ref** | GAP-009 |

**Description:** `artifacts/ags-fertility/src/lib/patient-api.ts` stores access and refresh tokens as `ags_patient_access_token` / `ags_patient_refresh_token` in `localStorage`. Any JavaScript executing on the page (via XSS) can read these tokens. Given the fertility clinic context and Canadian patient health data, this is an elevated risk compared to a typical SPA. [OBSERVED]

**Repository Evidence:**
- `artifacts/ags-fertility/src/lib/patient-api.ts` — localStorage token storage [OBSERVED]
- KNOWN_GAPS.yaml `GAP-009` [OBSERVED]
- P4 assessment §4.9 [OBSERVED]

**Consequence at GA:** An XSS vulnerability in any React component yields full account takeover. An attacker with a patient's token can read all their health records, messages, and documents.

**Dependencies:** None.

**Effort:** 3–5 days (backend `Set-Cookie` issuance on login; remove localStorage storage; coordinate SPA + Worker change).

---

**PRG-029**
| Field | Value |
|---|---|
| **Title** | No account lockout after failed login attempts — credential stuffing viable |
| **Area** | Security Posture — Authentication |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 23 |
| **Cross-ref** | — |

**Description:** The identity service records a `login.failed` event to D1 on bad password, but no code reads accumulated failed events and locks the account. `IdentityStatus.LOCKED` is not an automatic transition. The rate limiter (60 req/60s per IP) is per-isolate only — at production scale with multiple Cloudflare Worker isolates, an attacker distributing requests across isolates bypasses it. Turnstile is not applied to the login endpoint. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/identity/identity-service.ts` — `login.failed` event; no lockout logic [OBSERVED]
- `workers/src/middleware/rateLimit.ts` — per-isolate Map [OBSERVED]
- P4 assessment §1.7 [OBSERVED]

**Consequence at GA:** Automated credential stuffing attacks against patient accounts face no effective global defence. Combined with PRG-028 (localStorage tokens), a successful attack yields persistent access.

**Dependencies:** None.

**Effort:** 3–5 days (D1-backed failed-attempt counter; automatic lockout after N failures; unlock flow; apply Turnstile to login endpoint).

---

**PRG-030**
| Field | Value |
|---|---|
| **Title** | Per-isolate rate limiting provides no global brute-force protection |
| **Area** | Security Posture — Rate Limiting |
| **Classification** | `Technical Debt` |
| **Severity** | High |
| **Execution Order** | 23 |
| **Cross-ref** | — |

**Description:** `middleware/rateLimit.ts` uses an in-process `Map<string, Bucket>`. The code comment explicitly acknowledges: "This means the limiter is APPROXIMATE: under scale-out it throttles aggressively within a single isolate but does not provide a hard global cap across all isolates." At production scale on Cloudflare Workers, requests are distributed across many isolates. N isolates × 60 requests/minute = N×60 effective rate limit. [OBSERVED]

**Repository Evidence:**
- `workers/src/middleware/rateLimit.ts` — in-process Map, documented limitation [OBSERVED]
- P4 assessment §4.2 [OBSERVED]
- T1 assessment §3.8 [OBSERVED]

**Consequence at GA:** No effective global rate limiting on any endpoint. Combined with PRG-029, the login endpoint is unprotected against distributed automated attacks.

**Dependencies:** None.

**Effort:** 3–5 days (KV-backed distributed rate limiter; per-endpoint configuration).

---

**PRG-031**
| Field | Value |
|---|---|
| **Title** | IDOR: `GET /api/v1/appointments?patientId=` allows caller to list any patient's appointments |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `_getAppointments` in `routes/wave7.ts`: `const patientId = url.searchParams.get("patientId") || identityId;`. If a caller supplies `?patientId=<other-patient-uuid>`, the endpoint lists that patient's appointments without any ownership check. The code comment reads "Use authenticated identity as patientId (cryptographic binding)" — but the binding only applies when the query parameter is absent. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_getAppointments` [OBSERVED]
- P4 assessment §2.2.2 [OBSERVED]

**Consequence at GA:** Any authenticated patient can enumerate any other patient's full appointment history.

**Dependencies:** None.

**Effort:** 0.5 day (validate `patientId` parameter against JWT `sub`).

---

**PRG-032**
| Field | Value |
|---|---|
| **Title** | IDOR: `GET /api/v1/messages/threads?participantId=` allows listing any patient's threads |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** Same pattern as PRG-031. `_getThreads` uses `url.searchParams.get("participantId") || identityId` without validating the supplied `participantId` against the JWT identity. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_getThreads` [OBSERVED]
- P4 assessment §2.2.3 [OBSERVED]

**Consequence at GA:** Any authenticated patient can enumerate the message threads of any other patient.

**Dependencies:** None.

**Effort:** 0.5 day.

---

**PRG-033**
| Field | Value |
|---|---|
| **Title** | IDOR: Consent history endpoint accepts arbitrary `identityId` from query |
| **Area** | Authorization / IDOR |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `consentHistory` handler in `routes/trustRuntime.ts` reads `identityId` from the query string and calls `env.CONSENT_ENGINE.getHistory({ identityId })` without comparing it to the authenticated caller's JWT `sub`. Any authenticated user can request the consent history of any other identity. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/trustRuntime.ts` — `consentHistory` handler [OBSERVED]
- P4 assessment §2.2.9 [OBSERVED]

**Consequence at GA:** Consent records reveal what categories of consent a patient has granted (treatment, data sharing, research participation). These are PHI-adjacent.

**Dependencies:** None.

**Effort:** 0.5 day.

---

**PRG-034**
| Field | Value |
|---|---|
| **Title** | Document share revocation has no ownership check — any user can revoke any share |
| **Area** | Authorization / IDOR |
| **Classification** | `Broken` |
| **Severity** | High |
| **Execution Order** | 11 |
| **Cross-ref** | — |

**Description:** `routes/documents.ts` calls `env.DOCUMENT_SERVICE.revokeShare(documentId, shareId, identityId, body.reason)`. The service method signature is `async revokeShare(documentId: string, shareId: string): Promise<void>` — it accepts only two parameters. The `identityId` and `reason` arguments are silently dropped. No ownership check is performed. Any authenticated user who knows a `shareId` UUID can revoke a document share they do not own. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/documents.ts` — call with 4 args [OBSERVED]
- `workers/src/platform/documents/document-service.ts` — `revokeShare(documentId, shareId)` 2-arg signature [OBSERVED]
- P4 assessment §2.2.1 [OBSERVED]

**Consequence at GA:** A patient's shared access to a medical record can be silently revoked by another authenticated user.

**Dependencies:** None.

**Effort:** 0.5 day (fix service method signature; add ownership check before revoke).

---

**PRG-035**
| Field | Value |
|---|---|
| **Title** | MFA is optional and not enforced — single-factor access to all patient PHI |
| **Area** | Authentication |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 21 |
| **Cross-ref** | — |

**Description:** `identity-service.ts` defaults new registrations to `mfa_enabled: false`. No middleware checks `mfa_level` on any endpoint. Any patient can authenticate with password only (single factor) and receive full access to all patient-sensitive endpoints. The `mfa_level: 0` JWT claim is never validated by any route handler. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/identity/identity-service.ts` — `mfa_enabled: false` default [OBSERVED]
- `workers/src/routes/wave7.ts` — no `mfa_level` check in any handler [OBSERVED]
- P4 assessment §1.3 [OBSERVED]

**Consequence at GA:** Every patient account without MFA has a single point of credential compromise. For a fertility clinic handling PHI under PIPEDA, MFA for patient access is a reasonable baseline security requirement.

**Dependencies:** None.

**Effort:** 2–3 days (add `requireMfa()` middleware; apply to patient-sensitive endpoints).

---

**PRG-036**
| Field | Value |
|---|---|
| **Title** | No observability infrastructure — no error tracking, no alerting, no persistent logs |
| **Area** | Observability |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 3 |
| **Cross-ref** | — |

**Description:** (a) No Sentry, Datadog, Honeybadger, or equivalent error-tracking integration exists — errors that cause 500 responses are captured only as a `status: 500` in the `request.complete` log. (b) Logs flow through `console.*` to Cloudflare's Workers tail only — no Logpush rule ships logs to a persistent store. Cloudflare tail logs are available in the dashboard but ephemeral; there is no queryable log history. (c) No uptime monitoring is configured (`/api/v1/health` is suitable for probes but nothing calls it). (d) No alerting of any kind exists. (e) The router's catch block does not call `error(...)` — exceptions are swallowed for observability purposes while returning 500. (f) No request correlation ID is generated — individual requests cannot be traced through logs. [OBSERVED]

**Repository Evidence:**
- Search: zero results for `sentry`, `datadog`, `logpush` [OBSERVED]
- `workers/wrangler.jsonc` — no `logpush` configuration key [OBSERVED]
- `workers/src/router/index.ts` — catch block does not emit error log [OBSERVED]
- `workers/src/index.ts` — no correlation ID middleware [OBSERVED]
- T1 assessment §1 [OBSERVED]

**Consequence at GA:** An operator cannot detect or diagnose a production incident without a patient reporting it. A 3am outage would require scrolling through live Cloudflare tail — if the operator is watching. There is no on-call notification mechanism.

**Dependencies:** None.

**Effort:** 4–6 days (Sentry in Worker + SPA: 2–3 days; Logpush to persistent store: 1 day; uptime monitoring + alerting: 1 day; correlation ID middleware: 1 day).

---

**PRG-037**
| Field | Value |
|---|---|
| **Title** | No React error boundaries in the SPA — component crash produces blank white screen |
| **Area** | Frontend — Error Handling |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 3 |
| **Cross-ref** | — |

**Description:** Zero `ErrorBoundary` components, `componentDidCatch` implementations, or `error boundary` patterns exist anywhere in `artifacts/ags-fertility/`. Any unhandled exception in any React component tree propagates to the root and crashes the entire SPA. The patient sees a blank white screen with no error message. `@replit/vite-plugin-runtime-error-modal` shows an overlay in development but is inactive in production builds. [OBSERVED]

**Repository Evidence:**
- Search across `artifacts/ags-fertility/` — zero `ErrorBoundary` results [OBSERVED]
- T1 assessment §2.5 [OBSERVED]

**Consequence at GA:** Any runtime component error — including errors triggered by the many broken API calls documented in this register — produces a blank white screen. Patients have no recovery path other than refreshing.

**Dependencies:** None.

**Effort:** 1–2 days.

---

**PRG-038**
| Field | Value |
|---|---|
| **Title** | PHI/non-PHI document segregation is metadata-only — single R2 bucket for all files |
| **Area** | File Management — Storage |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 25 |
| **Cross-ref** | — |

**Description:** `document-storage.ts:resolveBucket(isPhi)` returns a bucket name string ("phi-documents" vs "non-documents") but only one R2 binding (`DOCUMENT_STORAGE`, `bucket_name: "agsynergy-documents"`) is configured. All files — PHI and non-PHI — are written to the same R2 bucket regardless of PHI classification. The PHI boundary exists only in metadata. [OBSERVED]

**Repository Evidence:**
- `workers/wrangler.jsonc` — single `DOCUMENT_STORAGE` R2 binding [OBSERVED]
- `workers/src/platform/documents/document-storage.ts:resolveBucket()` [OBSERVED]
- `E_data_layer.md §7` [OBSERVED]
- T2 assessment `GAP-R2-001` [OBSERVED]

**Consequence at GA:** PHI documents and non-PHI documents share a single storage bucket. Physical segregation of patient health data is a regulatory expectation for clinical platforms.

**Dependencies:** None.

**Effort:** 2–3 days (provision second R2 bucket; add binding; route PHI/non-PHI writes correctly; migration path for existing objects).

---

**PRG-039**
| Field | Value |
|---|---|
| **Title** | No virus scanning on patient document upload — malicious files stored and re-served |
| **Area** | File Management — Security |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 26 |
| **Cross-ref** | — |

**Description:** `document-service.ts:uploadDocument()` writes directly to R2 with no antivirus or malware check anywhere in the upload path. Patient-uploaded files (intended to be medical records) could be executables, malware, or exploit payloads. These files are stored and can be re-served to clinic staff or other patients via presigned URLs. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/documents/document-service.ts:uploadDocument()` — no AV hook [OBSERVED]
- P3 assessment §4 [OBSERVED]

**Consequence at GA:** A malicious actor with a patient account can upload malware that is stored in the same R2 bucket as legitimate medical records and re-served to clinical staff via download links.

**Dependencies:** PRG-008 (upload must work before scanning matters).

**Effort:** 3–5 days (external AV API integration or R2 post-upload hook; MIME type and file size enforcement).

---

**PRG-040**
| Field | Value |
|---|---|
| **Title** | No staging environment — preview shares production D1 database |
| **Area** | Platform — Deployment |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 2 |
| **Cross-ref** | — |

**Description:** `wrangler.jsonc` defines a `preview` environment but it has no route defined and shares the same `database_id` as the production D1 database (`agsynergy-db`). Preview is not an isolated staging environment — it is a misconfigured alias to production storage. No true staging environment with isolated D1 and R2 exists. [OBSERVED]

**Repository Evidence:**
- `workers/wrangler.jsonc` — `preview` env, no route, same D1 `database_id` [OBSERVED]
- T2 assessment `GAP-CF-001` [OBSERVED]

**Consequence at GA:** There is no environment to validate changes against before they reach production. Every deploy goes directly to the same database that holds real patient data.

**Dependencies:** PRG-002 (CI gates must exist before staging is meaningful).

**Effort:** 3–5 days.

---

**PRG-041**
| Field | Value |
|---|---|
| **Title** | Database migrations are not applied in CI — code that requires a new migration can break prod |
| **Area** | Platform — Deployment / CI |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 2 |
| **Cross-ref** | — |

**Description:** `deploy.yml` has no `wrangler d1 migrations apply` step. Migration application is assumed to be manual. A deploy that introduces code depending on a new migration — without first running the migration — will produce column-not-found or table-not-found errors in production. [OBSERVED]

**Repository Evidence:**
- `.github/workflows/deploy.yml` — no migration step [OBSERVED]
- T2 assessment `GAP-DEP-003` [OBSERVED]

**Consequence at GA:** A developer adds a new D1 table, merges the code, the deploy pipeline pushes the new code, but the migration was not run — production crashes on first access to the new table.

**Dependencies:** PRG-002.

**Effort:** 2–3 days (add `wrangler d1 migrations apply` step with environment-specific gate and rollback guard).

---

**PRG-042**
| Field | Value |
|---|---|
| **Title** | No rollback procedure documented or scripted for production deployments |
| **Area** | Platform — Deployment |
| **Classification** | `Missing` |
| **Severity** | High |
| **Execution Order** | 3 |
| **Cross-ref** | — |

**Description:** Cloudflare Workers supports `wrangler rollback <deployment_id>` for Worker code rollback. However, no documented rollback procedure exists in the repository. D1 schema and data cannot be rolled back (forward-only migrations, no snapshots). Every push to `main` immediately deploys to production with no human approval gate or canary. [OBSERVED]

**Repository Evidence:**
- `.github/workflows/deploy.yml` — instant deploy on every `main` push [OBSERVED]
- No `scripts/rollback-procedure.md` or equivalent [OBSERVED]
- T2 assessment `GAP-DEP-002`, `GAP-DEP-004` [OBSERVED]

**Consequence at GA:** A bad deploy reaches production in seconds. Without a documented rollback procedure, recovery under incident conditions relies on an engineer remembering the Cloudflare dashboard workflow while under pressure.

**Dependencies:** None.

**Effort:** 1–2 days (document rollback; add optional `workflow_dispatch` approval gate).

---

### 3.3 Medium Severity

---

**PRG-043**
| Field | Value |
|---|---|
| **Title** | EventReader D1 queries all commented out — workflow history and audit endpoints return empty arrays |
| **Area** | Platform — Workflow Engine |
| **Classification** | `Broken` |
| **Severity** | Medium |
| **Execution Order** | 28 |
| **Cross-ref** | — |

**Description:** `workers/src/platform/workflow/events/event-reader.ts` lines 33–77: all D1 query code is commented out. `query()` returns `[]` unconditionally. `getWorkflowTimeline()`, `getTaskAuditTrail()`, `getCoordinatorActivity()`, `getRuleEvaluations()`, `getSLABreaches()`, `getOverrides()` all return `[]`. Deferred explicitly in commit `8175ddd` commit message. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/workflow/events/event-reader.ts` lines 33–77 [OBSERVED]
- P3 §1 [OBSERVED]

**Consequence at GA:** `/api/v1/workflows/:id/history` and `/api/v1/tasks/:id/audit` return empty arrays for all patients. Clinical audit trails are non-functional.

**Effort:** 2–3 days.

---

**PRG-044**
| Field | Value |
|---|---|
| **Title** | ProjectionEngine stub — all operational and clinical metrics return hardcoded zeroes |
| **Area** | Platform — Workflow Engine / Reporting |
| **Classification** | `Broken` |
| **Severity** | Medium |
| **Execution Order** | 29 |
| **Cross-ref** | — |

**Description:** `workers/src/platform/workflow/events/projection-engine.ts` has `db` parameter commented out in the constructor. `buildOperationalMetrics()`, `buildClinicalMetrics()`, `buildQualityMetrics()`, and `buildTaskQueueView()` all return hardcoded zero or empty structures. The `workflow_analytics_daily` and `workflow_analytics_weekly` tables in migration 0010 are never populated by any TypeScript code. [OBSERVED]

**Repository Evidence:**
- `workers/src/platform/workflow/events/projection-engine.ts` — constructor, all `build*` methods [OBSERVED]
- `workers/migrations/0010_workflow_engine.sql` — analytics tables exist; no TS writer [OBSERVED]
- P3 §1, §5 [OBSERVED]

**Consequence at GA:** Clinical operations are blind to cycle outcomes, SLA compliance, and coordinator performance at scale.

**Effort:** 3–5 days (implement `db` parameter; wire D1 aggregate queries; populate analytics tables via cron).

---

**PRG-045**
| Field | Value |
|---|---|
| **Title** | CronScheduler not wired to Cloudflare cron trigger — scheduled timers never fire |
| **Area** | Platform — Workflow Engine / Timers |
| **Classification** | `Missing` |
| **Severity** | Medium |
| **Execution Order** | 27 |
| **Cross-ref** | — |

**Description:** `workers/src/platform/workflow/timers/cron-scheduler.ts` (6.6 KB) exists but is not wired to any Cloudflare cron trigger. `wrangler.jsonc` has no `triggers.crons` key and no `scheduled` export. Timer actions also have a secondary defect: `executeTimerAction()` in `timer-service.ts` handles all action types (notify, escalate, transition, create_task, complete_task, evaluate_rules) by calling only `emitTimerFired()` — no actual escalation, task creation, or notification fires. [OBSERVED]

**Repository Evidence:**
- `workers/wrangler.jsonc` — no `scheduled` export, no cron triggers [OBSERVED]
- `workers/src/platform/workflow/timers/timer-service.ts:executeTimerAction()` — all cases emit event only [OBSERVED]
- P3 §1 [OBSERVED]

**Consequence at GA:** SLA breach reminders, beta HCG follow-up series, medication reminders, and protocol escalations never execute. IVF protocol automation is entirely non-functional.

**Effort:** 1–2 days (wrangler cron config) + 3–5 days (implement actual timer actions).

---

**PRG-046**
| Field | Value |
|---|---|
| **Title** | Turnstile bot protection configured with empty secret — consultation form unprotected |
| **Area** | Website — Security |
| **Classification** | `Broken` |
| **Severity** | Medium |
| **Execution Order** | 30 |
| **Cross-ref** | — |

**Description:** `TURNSTILE_SECRET_KEY` is an empty string in all `wrangler.jsonc` environments. The Turnstile verification middleware silently skips verification when the key is absent. The honeypot (`fax` field) is the only active bot protection on the consultation form. Turnstile is also not applied to the login endpoint or magic-link-request endpoint. [OBSERVED]

**Note:** P1 and P2 assessments rate this High; given that the honeypot provides some residual protection and the form stores to D1 (not in-memory), this register classifies it Medium. If spam volume is expected to be high at launch, treat as High.

**Repository Evidence:**
- `workers/wrangler.jsonc` — empty `TURNSTILE_SECRET_KEY` [OBSERVED]
- `workers/src/middleware/turnstile.ts` — skip-if-absent logic [OBSERVED]
- P1 assessment W-01; P2 assessment G-13 [OBSERVED]

**Consequence at GA:** The consultation form is reachable by bots. Spam leads pollute the CRM. At GA scale, manual lead qualification cost increases substantially.

**Effort:** 0.5 day (register Cloudflare Turnstile site; set secret; apply to login and magic-link-request endpoints).

---

**PRG-047**
| Field | Value |
|---|---|
| **Title** | No frontend tests — any regression ships silently |
| **Area** | Testing — Frontend |
| **Classification** | `Missing` |
| **Severity** | Medium |
| **Execution Order** | 31 |
| **Cross-ref** | GAP-010 |

**Description:** Zero test files exist in `artifacts/ags-fertility/`. A 35-page patient-facing SPA — including the registration flow, authentication, and all portal pages — has no automated verification. Combined with PRG-002 (no CI test gate), any regression in patient-facing code ships to production without detection. [OBSERVED]

**Repository Evidence:**
- Search across `artifacts/ags-fertility/` — zero test files [OBSERVED]
- KNOWN_GAPS.yaml `GAP-010` [OBSERVED]
- T1 assessment §4 [OBSERVED]

**Consequence at GA:** A broken registration page, a crashed dashboard component, or a broken appointment form ships to production and is discovered by a real patient.

**Effort:** 10–20 days (establish baseline with Playwright E2E + Vitest component tests; minimum: smoke tests for registration, login, dashboard, document upload).

---

**PRG-048**
| Field | Value |
|---|---|
| **Title** | SSE notification stream stalls after one `connected` event |
| **Area** | Notifications |
| **Classification** | `Broken` |
| **Severity** | Medium |
| **Execution Order** | 32 |
| **Cross-ref** | — |

**Description:** `routes/wave7.ts:_streamNotifications()` creates a `ReadableStream` and in the `start` callback enqueues a single `event: connected` message. The stream controller never enqueues further events. Patients who open the notification stream receive a `connected` event and then receive nothing. Real-time push to patients requires Cloudflare Durable Objects or an external pub/sub system, which would be needed to maintain state across isolate boundaries. [OBSERVED]

**Repository Evidence:**
- `workers/src/routes/wave7.ts` — `_streamNotifications` [OBSERVED]
- `B_worker_api_layer.md §8.6` [OBSERVED]
- P3 §3 [OBSERVED]

**Consequence at GA:** Patients receive no real-time push notifications. Appointment reminders, cycle updates, and care messages arrive only when the patient manually refreshes.

**Effort:** 5–10 days (requires Durable Objects or Cloudflare Queues for cross-isolate pub/sub).

---

**PRG-049**
| Field | Value |
|---|---|
| **Title** | OpenAPI spec covers 3 of ~110 endpoints — no generated client for patient features |
| **Area** | Platform — API Contract |
| **Classification** | `Technical Debt` |
| **Severity** | Medium |
| **Execution Order** | 33 |
| **Cross-ref** | — |

**Description:** `lib/api-spec/openapi.yaml` is at version `0.1.0` and documents exactly 3 endpoints: `GET /health`, `POST /consultations`, `GET /consultations/count`. The actual API surface has ~110 endpoints. The generated client (`lib/api-client-react`) matches the spec but covers only the 3 Phase-1 endpoints. Patient-facing features (appointments, documents, timeline, notifications, identity) have no spec coverage and no generated client hooks — the frontend uses ad-hoc fetch wrappers. [OBSERVED]

**Repository Evidence:**
- `lib/api-spec/openapi.yaml` — 3 endpoints, version 0.1.0 [OBSERVED]
- `B_worker_api_layer.md` — ~110 endpoints confirmed [OBSERVED]
- T2 assessment `GAP-API-001` [OBSERVED]

**Consequence at GA:** Any partner integration, external consumer, or compliance audit requiring API documentation finds a spec that covers 3% of the actual API. Type drift between frontend and backend is undetectable without a generated client.

**Effort:** 10–20 days.

---

**PRG-050**
| Field | Value |
|---|---|
| **Title** | Gitleaks custom config inactive in CI — Cloudflare token pattern not scanned |
| **Area** | CI/CD — Security |
| **Classification** | `Broken` |
| **Severity** | Medium |
| **Execution Order** | 2 |
| **Cross-ref** | GAP-018 |

**Description:** `.github/workflows/security.yml` runs gitleaks with `GITLEAKS_CONFIG: ""`, which overrides and ignores the repository's `.gitleaks.toml`. The custom Cloudflare token detection rule in `.gitleaks.toml` never applies in CI. [OBSERVED]

**Repository Evidence:**
- `.github/workflows/security.yml` — `GITLEAKS_CONFIG: ""` [OBSERVED]
- `.gitleaks.toml` — custom Cloudflare token rule [OBSERVED]
- KNOWN_GAPS.yaml `GAP-018` [OBSERVED]

**Consequence at GA:** Cloudflare API tokens committed to the repository are not detected by CI. A secret accidentally committed would not be caught by the automated scan.

**Effort:** 0.5 day (remove `GITLEAKS_CONFIG: ""` override; point workflow at `.gitleaks.toml`).

---

### 3.4 Low Severity

---

**PRG-051**
| Field | Value |
|---|---|
| **Title** | Migration numbering broken — two files share `0002_` prefix; `011_` missing leading zero |
| **Area** | Database — Schema Hygiene |
| **Classification** | `Technical Debt` |
| **Severity** | Low |
| **Execution Order** | 34 |
| **Cross-ref** | GAP-017 |

**Description:** `0002_identity_core.sql` and `0002_rbac_foundation.sql` share a prefix, making application order ambiguous under lexical sort. `011_notifications.sql` is missing the leading zero used by all other migrations (`0NNN_`), causing it to sort incorrectly. [OBSERVED]

**Repository Evidence:**
- `workers/migrations/` — file listing [OBSERVED]
- KNOWN_GAPS.yaml `GAP-017` [OBSERVED]

**Consequence at GA:** New engineers adding migrations may follow the broken convention. Automated migration tooling relying on lexical sort may misorder `011_`. The ambiguity in the `0002_` pair could cause incorrect application order on a fresh database provisioning.

**Effort:** 0.5 day (document correct convention; do not renumber applied migrations; fix going forward).

---

**PRG-052**
| Field | Value |
|---|---|
| **Title** | Deployed version constant is stale — `version.ts` reports 1.1.0, CHANGELOG at 1.6.0 |
| **Area** | Platform — Hygiene |
| **Classification** | `Technical Debt` |
| **Severity** | Low |
| **Execution Order** | 35 |
| **Cross-ref** | GAP-016 |

**Description:** `workers/src/version.ts` reports version `1.1.0`. `CHANGELOG.md` is at `1.6.0`. The version extraction script is not being run. Deployed builds misreport their version. [OBSERVED]

**Repository Evidence:**
- `workers/src/version.ts` [OBSERVED]
- `CHANGELOG.md` [OBSERVED]
- KNOWN_GAPS.yaml `GAP-016` [OBSERVED]

**Consequence at GA:** Incident triage using the version endpoint (`GET /api/v1/health`) returns incorrect version information, complicating correlation between reported issues and deployed code.

**Effort:** 0.5 day (run version extraction script in CI).

---

## 4. Dependency Graph

### 4.1 Hard Dependencies (must land before downstream work is meaningful)

```
PRG-014 (consents schema conflict)
  └─► PRG-011 (consent D1 wiring)
        └─► PRG-023 (appointments D1 — consent gate required)
        └─► PRG-024 (messages D1 — consent gate required)
        └─► PRG-007 (care plan / tasks routes — meaningful only with persisted consent)

PRG-006 (timeline D1 backing)
  └─► PRG-007 (care plan / tasks routes — meaningful data requires timeline persistence)

PRG-003 (fix registration auto-verify)
  └─► PRG-004 (email verification landing page)

PRG-025 (provision NOTIFICATIONS D1)
  └─► PRG-026 (implement real notification delivery)
        └─► PRG-020 (consultation submission notification)

PRG-001 (clinic auth guard)
  └─► PRG-009 (real patient data in clinic portal)
  └─► PRG-010 (real clinic messaging)
  └─► PRG-019 (clinic messaging IDOR fixes)

PRG-002 (CI test gate)
  └─► PRG-040 (staging environment — only meaningful with a working CI)
  └─► PRG-041 (migration CI step)

PRG-008 (fix document upload)
  └─► PRG-039 (virus scanning — upload must work before AV matters)
```

### 4.2 Which Gaps Unblock the Most Downstream Work

| PRG | Title | Downstream PRGs Unblocked |
|---|---|---|
| PRG-001 | Clinic auth guard | PRG-009, PRG-010, PRG-019 |
| PRG-002 | CI test gate | PRG-040, PRG-041 |
| PRG-014 | Consents schema conflict | PRG-011, and transitively PRG-023, PRG-024, PRG-007 |
| PRG-025 | NOTIFICATIONS D1 provision | PRG-026, PRG-020 |
| PRG-006 | Timeline D1 backing | PRG-007 |
| PRG-008 | Document upload fix | PRG-039 |

### 4.3 Critical Path (minimum work to open platform to real patients)

**Narrative:** The minimum path to any real-patient onboarding begins with foundational safety work (auth guard, CI gates, schema fix, DR) and then proceeds through identity flows (registration, MFA, verification) before any patient data operations can be trusted.

**Critical path sequence:**

```
Step 1 (parallel, ~3 days):
  PRG-001  Clinic auth guard (merge PR #3)           0.5 d
  PRG-002  Add CI test + typecheck + migration gates  1.5 d
  PRG-012  DR procedure (begin; long-running)         parallel
  PRG-036  Observability baseline (Sentry + logging)  parallel
  PRG-037  React error boundaries                     parallel
  PRG-025  Provision NOTIFICATIONS D1                 0.5 d
  PRG-014  Fix consents schema conflict               2–3 d

Step 2 (~5 days):
  PRG-005  MFA login page                            2–3 d
  PRG-003  Fix registration auto-verify              2–3 d
  PRG-013  Wire AUTHORIZATION_ENGINE                 3–5 d
  PRG-021  Add audit log to lead status changes      1–2 d

Step 3 (~5 days):
  PRG-004  Email verification landing page           1–2 d
  PRG-008  Fix document upload                       1–2 d
  PRG-007  Add missing timeline routes               1–2 d
  Fix IDOR batch (PRG-015 through PRG-034 — 7 days)

Step 4 (~15 days):
  PRG-011  Wire ConsentEngine to D1                  5–8 d
  PRG-006  Timeline D1 backing                       6–9 d
  PRG-023  Appointments D1 backing                   5–8 d
  PRG-024  Messages D1 backing                       5–8 d

Step 5 (~15 days):
  PRG-026  Implement real notification delivery      7–11 d
  PRG-009  Wire clinic portal to real patient data   10–20 d
  PRG-010  Wire clinic messaging                     5–10 d
  PRG-029  Account lockout                           3–5 d
  PRG-035  MFA enforcement                           2–3 d
  PRG-028  Migrate tokens to HttpOnly cookies        3–5 d
```

**Minimum critical-path estimate: 55–90 engineering days** before the first real patient should be onboarded. This does not include PRG-027 (web admin console, 20–40 days) which is required for operational viability at scale.

---

## 5. Effort Roll-Up

### 5.1 By Severity Tier

| Severity | PRG IDs | Low (days) | High (days) |
|---|---|---|---|
| **Critical** (22 items) | PRG-001–PRG-022 | 74 | 131 |
| **High** (20 items) | PRG-023–PRG-042 | 81 | 163 |
| **Medium** (8 items) | PRG-043–PRG-050 | 26 | 51 |
| **Low** (2 items) | PRG-051–PRG-052 | 1 | 1 |
| **Total** | 52 items | **182** | **346** |

### 5.2 By Area

| Area | Low (days) | High (days) |
|---|---|---|
| Patient Journey / Portal | 20 | 38 |
| Authorization / IDOR (9 items) | 8 | 14 |
| Platform Engines (in-memory → D1) | 22 | 41 |
| Clinic Portal | 22 | 42 |
| Notifications / SSE | 14 | 24 |
| CI/CD / Testing | 13 | 24 |
| Security Posture | 12 | 20 |
| Observability | 5 | 9 |
| Disaster Recovery | 8 | 15 |
| Database / Schema | 3 | 5 |
| File Management | 7 | 13 |
| Deployment | 6 | 10 |
| Consultation Workflow | 5 | 10 |
| Admin Functions | 21 | 42 |
| API Contract | 10 | 20 |
| Other (website, notification seeding, hygiene) | 6 | 11 |

**Caveat:** These ranges exclude coordination overhead, product design, UX review, compliance officer review, QA cycles, external vendor procurement (SES BAA, Twilio HIPAA, FCM), and engineer onboarding to the codebase. The high end of the range should be treated as a planning baseline for a team already familiar with the codebase; external teams should add 30–50% for ramp-up.

---

## 6. Themes — Recurring Root Causes

The 52 gaps in this register reduce to 6 recurring root causes. Addressing these themes — rather than individual gaps — is what makes the register actionable.

---

### Theme 1: In-Memory Stores Standing In for D1 Persistence

**PRGs:** PRG-006, PRG-011, PRG-023, PRG-024, and partially PRG-043, PRG-044

All critical patient-journey state — IVF timeline progress, consent grants, caregiver delegations, appointments, messages — is held in in-memory Maps, globalThis singletons, or per-request `new InMemoryEngine()` instances. D1 tables were created for most of these (consents, delegations, appointments are implied by the schema) but the engines were never wired to them. Cloudflare Worker isolates are evicted after ~30 seconds of inactivity. Under realistic production load with multiple isolates, a patient who writes data in one request reads back nothing in the next.

**Why this matters at the GA bar:** A fertility clinic's operational continuity depends on patient journey data persisting across sessions. Appointments, consent records, and clinical communications that evaporate on isolate restart are not a performance issue — they are a clinical safety issue. An IVF patient who advances to "Stimulation Phase" and returns the next day to see "Day 1 Baseline" has received incorrect clinical information.

**Root cause:** Engine interfaces were built correctly (TimelineEngine, ConsentEngine, etc.) with in-memory reference implementations. The D1-backed production implementations were deferred but the code was shipped with the in-memory implementations still in place for live routes. The commit message for Wave 8 (`8175ddd`) explicitly lists multiple items as deferred. There is no CI gate preventing deferred items from shipping.

---

### Theme 2: Authorization Enforced in Middleware but Not in Handlers

**PRGs:** PRG-015, PRG-016, PRG-017, PRG-018, PRG-019, PRG-031, PRG-032, PRG-033, PRG-034, PRG-013

JWT authentication is enforced at the route level by `withJwtAuth()`. However, the identity extracted by that middleware is not consistently threaded through to the service layer to verify resource ownership. In at least 9 confirmed endpoint handlers, the `_request` parameter is named with a leading underscore (marking it unused) and `getIdentityId(request)` is never called. Any authenticated user — with any valid token — can retrieve, modify, or enumerate the resources of any other user by supplying their UUID.

**Why this matters at the GA bar:** This is a textbook BOLA/IDOR vulnerability class. On a fertility platform, cross-patient data exposure is not an abstract risk — it is a PIPEDA violation. Appointment records, clinical workflow state, and patient message threads are PHI. The D1-backed workflow event store means this is a live data exposure concern, not a theoretical one.

**Root cause:** The pattern of passing `identityId` from route handlers to service-layer ownership checks was not established consistently at architecture time. The document service (`verifyDocumentAccess()`) implements multi-layer ownership checks correctly — demonstrating the pattern is understood. It was not applied uniformly to appointments, messages, workflow, and consent APIs.

---

### Theme 3: Absence of CI Gates Permitting Silent Drift

**PRGs:** PRG-002, PRG-041, PRG-050, PRG-047

`.github/workflows/deploy.yml` deploys on every push to `main` with no test execution, no typecheck, and no migration application. This configuration does not represent an intentional tradeoff — it is missing steps that were planned but not implemented. The consequences are cascading: 218 TypeScript compile errors have accumulated without detection, test coverage for entire areas (clinic, timeline, coordination routes) is zero without visibility, and migrations must be applied manually (creating a window where code and schema are out of sync in production).

**Why this matters at the GA bar:** Every other gap in this register — broken routes, IDOR vulnerabilities, stub implementations — can only be reliably fixed if the CI pipeline can detect regressions. Without test gates, a fix for PRG-008 (document upload) that accidentally breaks PRG-007 (timeline routes) would ship to production undetected.

**Root cause:** The deploy pipeline was built for rapid iteration during development. The required steps (tests, typecheck, migrations) were not added as the project matured. KNOWN_GAPS.yaml `GAP-004` identifies this as the "single highest-leverage engineering change available in this repository" — a characterisation this register agrees with.

---

### Theme 4: Mock and Stub Data Left in Shipped Routes

**PRGs:** PRG-009, PRG-010, PRG-022, PRG-043, PRG-044

Multiple shipped route handlers return hardcoded mock data (`_mockPatients`, `_mockTriageQueue`), hardcoded success responses (`_flagThread` always returns `{flagged: true}`), or stub implementations with TODO comments. The workflow ProjectionEngine returns hardcoded zero metrics. The EventReader returns empty arrays unconditionally. These are development scaffolds that were never replaced with real implementations before the routes were deployed.

**Why this matters at the GA bar:** Clinic staff using the platform with real patients would see 8 fictional patients in the patient list. Message triage would show 3 fictional queue entries. No amount of real patient data loaded into D1 would be visible in the clinic portal — it would show the hardcoded mock data instead. The platform cannot be used for clinical operations in this state.

**Root cause:** Routes were stood up quickly with mock data to enable frontend development. The intention was always to replace them with real D1 queries. Without a CI test that asserts mock data is absent from production routes, and without a review checklist item for this, the mocks shipped alongside real implementations.

---

### Theme 5: No Backup, DR, or Operational Observability for Patient Data

**PRGs:** PRG-012, PRG-036, PRG-037, PRG-042

There is no backup procedure, no PITR confirmation, and no restore runbook for either D1 or R2. There is no persistent error tracking (no Sentry), no persistent log store (no Logpush), no uptime monitoring, no alerting, and no request correlation ID. The React SPA has no error boundaries. The router's catch block does not log exceptions.

**Why this matters at the GA bar:** A clinical platform that cannot recover from data loss, cannot detect incidents without patient reports, and cannot diagnose errors without live console access is not ready for real patients. PIPEDA requires demonstrable data stewardship. A 3am database corruption event on `agsynergy-db` with no backup and no on-call alert is a catastrophic scenario.

**Root cause:** Observability and DR are cross-cutting infrastructure concerns that typically require deliberate planning and dedicated sprint time. They were not treated as prerequisites for patient data onboarding. The health endpoint and structured logging exist and are well-designed — the gap is in the operational wiring (Logpush destination, Sentry DSN, backup schedule, runbook).

---

### Theme 6: Consultation and Patient Lifecycle Have No End-to-End Closure

**PRGs:** PRG-020, PRG-021, PRG-003, PRG-004, PRG-005, and GAP-006 from KNOWN_GAPS.yaml (lead → patient conversion gap, not separately listed as a PRG but cross-referenced in PRG-009's dependencies)

The patient lifecycle — from consultation request to registered account to active IVF journey — has multiple broken links. Lead status changes are unaudited. The consultation form sends no confirmation to the patient. There is no automated trigger from a qualified lead to an account invitation. Registration does not verify email. MFA login navigates to a 404. There is no formal consultation record (the `consultations` D1 table is schema-only; `consultationService.ts` only writes to `leads`).

**Why this matters at the GA bar:** A fertility clinic's operational process requires a clear, audited, and reliable pathway from initial inquiry to active patient. Each break in this chain represents a point where a real patient could be lost, a record could be untracked, or a compliance obligation could be missed.

**Root cause:** The consultation and patient onboarding flows were built incrementally across multiple development waves. Each wave delivered a piece (consultation form, identity platform, ops API) without a full end-to-end integration test covering the entire journey. The breaks at handoff points between waves were not detected because there are no E2E tests and no CI gates.

---

## Appendix: KNOWN_GAPS.yaml Cross-Reference

| KNOWN_GAPS ID | Title | PRG ID(s) | Disposition |
|---|---|---|---|
| GAP-001 | AUTHORIZATION_ENGINE never constructed | PRG-013 | Consolidated |
| GAP-002 | `consents` table defined twice | PRG-014 | Consolidated |
| GAP-003 | Clinic console routes lack auth guard | PRG-001 | Consolidated |
| GAP-004 | No test or typecheck gate in CI | PRG-002 | Consolidated |
| GAP-005 | EPCL/WAS/WEF pipeline unreachable | — | Out of scope (Hermes AI platform excluded per brief) |
| GAP-006 | In-memory singletons shadow D1 tables | PRG-006, PRG-011, PRG-023, PRG-024 | Split across 4 PRGs by capability |
| GAP-007 | Dual execution stack (Stack B bypasses guards) | — | Out of scope (Hermes platform) |
| GAP-008 | NOTIFICATIONS D1 binding unprovisioned | PRG-025 | Consolidated |
| GAP-009 | Frontend stores JWTs in localStorage | PRG-028 | Consolidated |
| GAP-010 | Frontend has zero tests | PRG-047 | Consolidated |
| GAP-011 | ADR-016 used twice | — | Documentation; out of scope for engineering register |
| GAP-012 | Root DECISIONS.md indexes only ADR-001 | — | Documentation; out of scope |
| GAP-013 | TASKS.md frozen at Phase 1 | — | Documentation; out of scope |
| GAP-014 | SECURITY.md stale | — | Documentation; out of scope |
| GAP-015 | Overlapping documentation directories | — | Documentation; out of scope |
| GAP-016 | Version constant stale | PRG-052 | Consolidated |
| GAP-017 | Migration numbering broken | PRG-051 | Consolidated |
| GAP-018 | CI overrides gitleaks config | PRG-050 | Consolidated |
| GAP-019 | Node version mismatch dev vs CI | — | Low; noted in T2; not separately registered (resolves with PRG-002 CI work) |
| GAP-020 | Duplicate type definitions + latent circular dep | — | Medium technical debt; not a patient-safety item; deferred to post-GA |

---

*End of Implementation Gap Analysis.*
*Compiled: 2026-08-04. All findings carry [OBSERVED], [INFERRED], or [UNKNOWN] tags as documented in the source assessments. Effort figures are engineering-day ranges from repository evidence only. No changes were made to the application codebase in the preparation of this document.*
