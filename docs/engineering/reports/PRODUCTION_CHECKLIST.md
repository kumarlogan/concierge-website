# Concierge Production Launch Checklist
**Repo:** `kumarlogan/concierge-website` | **HEAD at assessment:** `0b5e0c3` | **Assessed:** 2026-08-04
**Bar:** GA launch with real patients at scale — fertility clinic handling PHI (Canada, PIPEDA)
**Out of scope:** Hermes AI platform (EPCL/WAS/WEF)

> **Re-run instructions:** Re-check every `[ ] FAIL` item after remediation. Re-run before every release.
> Evidence tags: `[OBSERVED]` = read from source | `[INFERRED]` = structural reasoning | `[UNKNOWN]` = not determinable

---

## Summary Scoreboard

| Gate | Name | Pass | Total | Status |
|------|------|------|-------|--------|
| **0** | Launch blockers | **0** | **10** | 🔴 BLOCKED |
| **1** | Security & compliance | **3** | **17** | 🔴 BLOCKED |
| **2** | Data integrity | **2** | **8** | 🔴 BLOCKED |
| **3** | Reliability & operations | **1** | **11** | 🔴 BLOCKED |
| **4** | Quality assurance | **0** | **7** | 🔴 BLOCKED |
| **5** | Product completeness | **3** | **15** | 🔴 BLOCKED |
| **6** | Documentation & handover | **0** | **4** | 🔴 BLOCKED |
| | **TOTAL** | **9** | **72** | **🔴 NOT READY (12.5%)** |

**GA readiness score (weighted): 33.8% / 100%**
**Verdict: DO NOT LAUNCH.** All 10 Gate 0 blockers are failing. Launch with real patients today guarantees PHI exposure, data loss, and broken core workflows.

---

## How to Use This Document

- Work gates in order (0 → 6). Gate 0 must be 10/10 before any other gate matters.
- Each item: checkbox, current state, verification command/action, and failure evidence.
- `[x] PASS` = confirmed safe at HEAD `0b5e0c3`. `[ ] FAIL` = confirmed broken at HEAD.
- Recheck date column: fill in the date when you verify a FAIL has been remediated.
- Do not mark PASS based on code review alone — run the stated verification.

| Symbol | Meaning |
|--------|---------|
| `[ ] FAIL` | Confirmed broken — do not launch |
| `[x] PASS` | Confirmed working at HEAD |
| `[?] UNKNOWN` | Cannot confirm without runtime access |

---

## Gate 0 — Launch Blockers

> ALL 10 must pass. No exceptions. These are conditions under which real patients will lose data, be locked out, or have their PHI exposed.

---

### G0-01 — Patient Data Isolation: No IDOR on Appointments

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `GET /api/v1/appointments/:id` — handler `_getAppointmentById` in `workers/src/routes/wave7.ts` ignores the `_request` parameter; `getIdentityId()` is never called. Any authenticated patient retrieves any other patient's appointment by guessing a UUID.
- `PATCH /api/v1/appointments/:id` — `_updateAppointment` in `wave7.ts` calls no identity check. Any authenticated patient mutates any appointment.
- `GET /api/v1/appointments?patientId=X` — `patientId` query param is accepted as-is; not validated against JWT `sub`. Lists any patient's full appointment history.
- **Evidence:** `workers/src/routes/wave7.ts` — `_getAppointmentById`, `_updateAppointment`, `_getAppointments` handlers. In a fertility clinic, appointment records (type, stage, timing) constitute PHI.

**How to verify:**
1. Authenticate as Patient A. Note appointment ID.
2. Authenticate as Patient B. `GET /api/v1/appointments/<patient-A-id>` — must return 403, not 200.
3. `GET /api/v1/appointments?patientId=<patient-A-uuid>` as Patient B — must return 403.
4. `PATCH /api/v1/appointments/<patient-A-id>` as Patient B — must return 403.

**Fix required:** Add `getIdentityId(request)` call and ownership check to all three handlers before returning data.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-02 — Patient Data Isolation: No IDOR on Messages

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `GET /api/v1/messages/threads/:threadId` — handler `_getThreadMessages` in `wave7.ts` has `_request` unused; no thread-membership check. Any authenticated user reads any patient's clinical message thread.
- `GET /api/v1/messages/threads?participantId=X` — same override pattern as appointments. Pass another patient's UUID to enumerate their threads.
- `POST /api/v1/clinic/messages/send` — hardcodes `senderId: "clinic"`. A patient calling this endpoint can send messages impersonating the clinic to any recipient.
- **Evidence:** `workers/src/routes/wave7.ts` — `_getThreadMessages`, `_getThreads`; `workers/src/routes/clinic-messages.ts` — `_sendClinicMessage`.

**How to verify:**
1. Authenticate as Patient A; create a message thread. Note `threadId`.
2. Authenticate as Patient B. `GET /api/v1/messages/threads/<thread-A-id>` — must return 403.
3. `GET /api/v1/messages/threads?participantId=<patient-A-uuid>` as Patient B — must return 403.
4. `POST /api/v1/clinic/messages/send` as Patient B — sender must be bound to JWT identity, not hardcoded "clinic".

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-03 — Patient Data Isolation: No IDOR on Workflows and Tasks (D1-backed)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `GET /api/v1/workflows/:id`, `GET /api/v1/workflows/:id/history`, `GET /api/v1/workflows/:id/audit`, `GET /api/v1/workflows/:id/approvals` — no ownership check in any handler. Workflow engine is D1-backed, so this is a live cross-patient data exposure.
- `GET /api/v1/workflows/search` — returns all workflow instances across all patients with no identity filter; `_searchWorkflows` passes `{ status, limit: 50, offset: 0 }` to `engine.searchInstances()` with no caller binding.
- `GET /api/v1/tasks/search` — same; no identity filter.
- IVF workflow state (current stage, clinical decisions, approval gate results) is PHI.
- **Evidence:** `workers/src/routes/wave7.ts` — `_getWorkflow`, `_getWorkflowHistory`, `_getWorkflowAudit`, `_getApprovals`, `_searchWorkflows`, `_searchTasks`.

**How to verify:**
1. Start a workflow as Patient A. Note `workflowId`.
2. Authenticate as Patient B. `GET /api/v1/workflows/<patient-A-workflow-id>` — must return 403.
3. `GET /api/v1/workflows/search` as Patient B — must return only Patient B's workflows, not all patients'.
4. `GET /api/v1/tasks/search` — must be scoped to caller's identity.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-04 — Clinic Route Auth Guard Merged and Active

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- All 6 `/clinic/*` frontend routes in `artifacts/ags-fertility/src/App.tsx` use `<ClinicLayout>` with **no `<AuthGuard>` wrapper**. Any unauthenticated visitor can browse to `/clinic/dashboard`, `/clinic/patients`, `/clinic/search`, `/clinic/patient-status`, `/clinic/messages`, `/clinic/schedule` and interact with the UI.
- The backend clinic API routes (`clinic.ts`, `clinic-messages.ts`) are JWT-gated but have no role check — any patient JWT holder can call `GET /api/v1/clinic/patients` and `PATCH /api/v1/clinic/appointments/:id/confirm`.
- PR #3 (`fix/clinic-route-auth-guard`) exists but is **unmerged at HEAD `0b5e0c3`**.
- **Evidence:** `artifacts/ags-fertility/src/App.tsx` (all clinic routes), `workers/src/routes/clinic.ts` (no `identity_type` check), `KNOWN_GAPS.yaml GAP-003`.

**How to verify:**
1. Without logging in, navigate to `/clinic/dashboard` in a browser — must redirect to login, not render.
2. Authenticate as a patient (not staff). `GET /api/v1/clinic/patients` — must return 403.
3. Check `App.tsx`: every clinic route must be wrapped in `<AuthGuard requiredRole="staff">` or equivalent.
4. Check `clinic.ts` and `clinic-messages.ts`: handlers must verify `identity_type === "staff"` or `"provider"` from the JWT.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-05 — Patient Data Persistence: Appointments, Messages, Timeline in D1

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `InMemoryAppointmentEngine` — stored on `globalThis`; evaporates on Cloudflare isolate restart (~30s idle, or on any new deploy). Patients book appointments that disappear.
- `InMemoryMessageEngine` — same; no D1 `messages` table exists in any migration. Clinical provider-patient communication is unrecoverably lost on cold start.
- `InMemoryTimelineEngine` — instantiated `new InMemoryTimelineEngine()` **per request** in `workers/src/routes/timeline.ts:getEngine()`. Every write (stage advancement, milestone achievement) is discarded at end of that HTTP call. A patient's entire IVF journey resets to baseline on the next page load.
- **Evidence:** `workers/src/routes/timeline.ts` — comment: "In production this would be backed by D1/KV"; `B_worker_api_layer.md §8.2`; `KNOWN_GAPS.yaml GAP-006`.

**How to verify:**
1. Book an appointment as a test patient. Record the appointment ID.
2. Wait 60 seconds (or trigger a Worker redeploy). Reload.
3. `GET /api/v1/appointments` — appointment must still be present. FAIL if empty.
4. Send a message. Wait / redeploy. Reload — message must persist.
5. Advance IVF stage. Reload immediately (`GET /api/v1/timeline`) — stage must match the advanced state.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-06 — Consent Grants Persist in D1

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `ConsentEngine` is a module-level in-memory `Map<string, Consent[]>` singleton. The D1 `consents` table exists but the engine never reads from or writes to it. Consent grants evaporate on Worker cold start.
- Appointment booking and messaging both gate on `verifyAppointmentConsent()` — on a cold start, the engine returns DENY (fail-closed) because the in-memory store is empty. Patients who previously consented are blocked from services after any isolate restart.
- Additionally, `0006_trust_runtime.sql` and `0008_consent_engine.sql` both define `CREATE TABLE IF NOT EXISTS consents` with different schemas; the 0008 columns (`patient_identity_id`, `status`, `resource_type`, `resource_id`) are absent from the live table if 0006 ran first. Any D1-backed consent write would produce a column-mismatch error.
- **Evidence:** `KNOWN_GAPS.yaml GAP-006`; `workers/src/platform/trust/consent-engine.ts` (in-memory Map); `E_data_layer.md` — schema conflict section; `workers/migrations/0006_trust_runtime.sql` vs `0008_consent_engine.sql`.

**How to verify:**
1. Grant consent as a test patient. Note grant ID.
2. Trigger a Worker cold start (redeploy or wait for isolate eviction).
3. `GET /api/v1/consent/history?identityId=<test-patient-id>` — grant must still appear.
4. Run: `wrangler d1 execute agsynergy-db --command "SELECT * FROM consents WHERE patient_identity_id IS NOT NULL LIMIT 5;"` — must return rows, not a column-not-found error.
5. Check migration state: confirm `consents` table has `patient_identity_id` column (0008 schema wins).

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-07 — D1 Backup and Point-in-Time Restore Demonstrated

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- No backup scripts, no export procedures, no `wrangler d1 backup` call, no PITR configuration evidence anywhere in the repository.
- If `agsynergy-db` is corrupted or deleted: schema can be reconstructed from migrations (minus the `consents` conflict), but **all patient records are unrecoverable**.
- R2 bucket has no versioning, no lifecycle rules, no cross-region replication. If `agsynergy-documents` is deleted, patient medical records are permanently lost.
- The `consents` schema conflict means even schema-only restore from migrations is unreliable.
- **Evidence:** `workers/wrangler.jsonc` (no backup keys); `.github/workflows/deploy.yml` (no backup step); `E_data_layer.md` — "No backup or PITR for patient data"; search across `scripts/` — zero backup-related files found.

**How to verify:**
1. Confirm Cloudflare account has D1 PITR enabled: log into Cloudflare dashboard → D1 → `agsynergy-db` → check "Point-in-Time Recovery" status.
2. Run a test restore: `wrangler d1 export agsynergy-db --output backup-$(date +%Y%m%d).sql` — must complete without error.
3. Create a new scratch D1 database, apply the export, confirm row counts match.
4. Confirm R2 bucket has versioning or a backup bucket configured.
5. Document restore procedure in `scripts/restore-procedure.md` with timed runbook.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-08 — Notification Delivery Actually Reaches Patients

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `DeliveryEngine.deliverToChannel()` in `workers/src/platform/notifications/delivery-engine.ts` contains `// Simulate delivery` comment and unconditionally sets `status = SENT` without calling FCM, SES, or Twilio. Zero real notifications are ever delivered.
- `NOTIFICATIONS` D1 binding has `database_id: ""` in `workers/wrangler.jsonc` across all environments (dev, production, preview). The `if (!db) return` guard silently swallows failures — deliveries appear to succeed but are never stored. The wrangler.jsonc also has a **duplicate `d1_databases` key** at the top level and in `env.production`; JSONC behavior with duplicate keys is implementation-defined.
- SSE stream (`_streamNotifications` in `wave7.ts`) emits one `event: connected` message then stalls; no subsequent events are ever pushed.
- **Evidence:** `workers/src/platform/notifications/delivery-engine.ts` — simulation stub; `workers/wrangler.jsonc` — `"database_id": ""`; `B_worker_api_layer.md §8.6` — SSE stub; `KNOWN_GAPS.yaml GAP-008`.

**How to verify:**
1. `grep -r "Simulate delivery\|simulation" workers/src/platform/notifications/` — must return zero results.
2. `cat workers/wrangler.jsonc | grep -A3 "NOTIFICATIONS"` — `database_id` must be a non-empty UUID string.
3. Trigger a notification event (e.g., consultation submission). Check patient email/SMS — must receive it within 2 minutes.
4. `wrangler d1 execute agsynergy-notifications --command "SELECT COUNT(*) FROM notifications;"` — must return > 0.
5. Fix duplicate `d1_databases` key in `wrangler.jsonc` and confirm no JSONC parse warnings.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-09 — Patient Registration and Email Verification Work End-to-End

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `RegisterPage.tsx` (lines ~95–102) calls `requestEmailVerification()` then **immediately** calls `completeEmailVerification(verifyResult.token)` — the user never clicks an email link. Code comment: "dev mode — in production the user would click a link from their email." This is in production today.
- No `/patient/verify-email` route exists in `artifacts/ags-fertility/src/App.tsx`. Even if the auto-verify bug were fixed, the email link would land on a 404.
- Patients register without confirmed email ownership — a healthcare identity integrity requirement.
- **Evidence:** `artifacts/ags-fertility/src/pages/patient/RegisterPage.tsx` lines ~95–102; `artifacts/ags-fertility/src/App.tsx` — no `/patient/verify-email` route.

**How to verify:**
1. Register a new patient account with a fresh email address.
2. Check inbox — must receive a verification email before registration completes.
3. Do NOT click the link. Attempt to log in — must be blocked with "unverified email" message.
4. Click the email link — must land on `/patient/verify-email?token=<token>` (not a 404).
5. After clicking, log in successfully.

| Recheck date | Verified by |
|---|---|
| | |

---

### G0-10 — MFA-Enrolled Patients Can Log In

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- After credential entry, if `mfaRequired: true` is returned from the identity service, `LoginPage.tsx` (line ~82) calls `navigate("/patient/mfa")`.
- `/patient/mfa` is **not registered** in `artifacts/ags-fertility/src/App.tsx`. The patient hits a 404.
- Any patient who has enabled MFA cannot log in. They are locked out of all their PHI.
- **Evidence:** `artifacts/ags-fertility/src/pages/patient/LoginPage.tsx` line ~82 — `navigate("/patient/mfa")`; `artifacts/ags-fertility/src/App.tsx` — no `/patient/mfa` route in route list.

**How to verify:**
1. Register a test patient. Enable MFA (TOTP) via security settings.
2. Log out. Enter credentials on `/patient/login`.
3. Must be redirected to `/patient/mfa` (not a 404).
4. Enter TOTP code. Must complete login and reach `/patient/dashboard`.

| Recheck date | Verified by |
|---|---|
| | |

---

## Gate 1 — Security and Compliance

> All items must pass before GA. Items marked FAIL cite the specific code evidence.

---

### G1-01 — Account Lockout After Failed Login Attempts

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `identity-service.ts` records a `login.failed` event to D1 on bad password, but no code reads accumulated failures and locks the account. `IdentityStatus.LOCKED` is not an automatic transition. The per-isolate rate limiter (60 req/60s) provides no global protection — requests distributed across IPs bypass it trivially.

**How to verify:**
1. Submit 10 failed login attempts for the same account from different IPs (or disable rate limiting in test).
2. Account must be locked — further attempts must return "account locked" regardless of correct password.
3. Verify lock record persists in D1 (survives Worker restart): `wrangler d1 execute agsynergy-db --command "SELECT status FROM identities WHERE email='test@example.com';"` — must show `locked`.
4. Verify unlock flow (admin unlock or timed unlock) works.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-02 — MFA Enforced for All Patient PHI Endpoints

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** MFA is optional (`mfa_enabled: false` default on registration). No route handler or middleware checks `mfa_level` from the JWT. A patient with `mfa_level: 0` (single-factor) can access all patient data endpoints including documents, timeline, appointments. `identity-service.ts` — `mfa_enabled` default.

**How to verify:**
1. Register a patient without enabling MFA.
2. Authenticate. Extract JWT — decode it and confirm `mfa_level: 0`.
3. Attempt `GET /api/v1/documents` with this token — must return 403 or redirect to MFA enrollment, not 200.
4. Alternatively: confirm that MFA enrollment is required before any PHI endpoint responds.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-03 — JWT Tokens Stored in HttpOnly Cookies, Not localStorage

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `artifacts/ags-fertility/src/lib/patient-api.ts` stores `ags_patient_access_token` and `ags_patient_refresh_token` in `localStorage`. Any XSS vulnerability in the SPA yields full token theft, enabling impersonation until token expiry (1 hour). This is elevated risk for a PHI platform. `KNOWN_GAPS.yaml GAP-009`.

**How to verify:**
1. Log in as a test patient.
2. Open browser devtools → Application → localStorage.
3. Must find zero entries matching `ags_patient_*_token` — tokens must not be in localStorage.
4. Confirm tokens are in `HttpOnly; Secure; SameSite=Strict` cookies instead.
5. Confirm JavaScript cannot read the auth token: `document.cookie` must not expose token.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-04 — Global Rate Limiting (Not Per-Isolate)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/middleware/rateLimit.ts` uses an in-process `Map<string, Bucket>` — per-isolate only. Code comment: "This means the limiter is APPROXIMATE…does not provide a hard global cap across all isolates." At Cloudflare Workers scale, requests distribute across isolates; an attacker can send 60 req/window per isolate simultaneously, providing no effective brute-force protection at all.

**How to verify:**
1. Confirm `wrangler.jsonc` declares a KV namespace or Durable Object for rate limiting.
2. Send 60 login attempts concurrently from a single IP (using `k6` or `wrk`). After 60 requests, must return 429 regardless of which isolate handles subsequent requests.
3. Verify the rate limit state survives Worker restarts (KV-backed, not in-memory).

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-05 — Turnstile Bot Protection Active on Consultation and Login

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:**
- `workers/wrangler.jsonc` — `TURNSTILE_SECRET_KEY: ""` in all environments. Turnstile verification is silently skipped when the key is absent: `workers/src/middleware/turnstile.ts`.
- Turnstile is applied only to `POST /api/v1/consultations` — not to `POST /identity/login` or `POST /identity/magic-link`. The login endpoint (highest-value bot target) has no bot protection.
- **Evidence:** `workers/wrangler.jsonc`; `workers/src/middleware/turnstile.ts`; `workers/src/routes/consultations.ts`.

**How to verify:**
1. `wrangler secret list` — confirm `TURNSTILE_SECRET_KEY` is set (non-empty) in the production Worker.
2. Submit the consultation form without a valid Turnstile token — must receive 400/403, not 201.
3. Attempt login via `curl` without a browser/Turnstile token — must be challenged.
4. Confirm skip-on-absent behavior is removed: `grep -n "if (!configuredKey)" workers/src/middleware/turnstile.ts` — must find fail-closed logic (reject, not skip).

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-06 — Request Body Validation (Zod) on All PHI-Handling Routes

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** Worker route handlers use `body as SomeType` TypeScript casts and manual field presence checks instead of schema validation. Trust Runtime, document, and Wave7 handlers perform minimal or no input validation. Malformed inputs propagate directly to engine methods. A `lib/api-zod` package already exists but is used only in the frontend. `workers/src/routes/wave7.ts`, `workers/src/routes/trustRuntime.ts` — `body as X` casts throughout.

**How to verify:**
1. Send a malformed JSON body to `POST /api/v1/consent/grant` with missing required fields — must return 400 with validation error, not 500.
2. Send a malformed body to `POST /api/v1/appointments` — must return 400.
3. Check `workers/src/routes/wave7.ts` — every handler that reads `request.json()` must validate the result against a Zod schema before passing to engine methods.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-07 — Document Audit Trail Persists to D1 (HIPAA Requirement)

**Current state:** `[ ] FAIL` [INFERRED]

**Why it fails:** `DocumentService` is constructed with `InMemoryAuditStorage` in `workers/src/platform/documents/index.ts`. The `document_access_log` D1 table exists, but audit events for document access (who viewed, downloaded, or shared a medical record) are stored in-memory and lost on isolate restart. Prior discovery notes "InMemoryAuditStorage (fallback)." `C_platform_subsystems.md §7`.

**How to verify:**
1. Download a patient document. Note timestamp.
2. Trigger Worker cold start (redeploy).
3. `wrangler d1 execute agsynergy-db --command "SELECT * FROM document_access_log ORDER BY accessed_at DESC LIMIT 5;"` — the download event must appear and survive the restart.
4. Confirm `DocumentService` constructor in `workers/src/index.ts` (or wherever constructed) passes `env.DB` as the audit storage, not `InMemoryAuditStorage`.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-08 — PHI Documents in Separate R2 Bucket from Non-PHI

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/platform/documents/document-storage.ts` calls `this.storage.resolveBucket(isPhi)` which returns a bucket name string ("phi-documents" vs "non-documents") but only **one R2 binding** (`DOCUMENT_STORAGE`) is configured in `wrangler.jsonc`. All files — PHI and non-PHI — go to the same R2 bucket; PHI boundary is maintained only in metadata, not at the storage layer. `ARCHITECTURE.yaml`; `workers/wrangler.jsonc` — single `DOCUMENT_STORAGE` binding.

**How to verify:**
1. `cat workers/wrangler.jsonc | grep -A5 "r2_buckets"` — must show at least two R2 bucket bindings (one for PHI, one for non-PHI).
2. Upload a document classified as PHI. Confirm it lands in the PHI bucket, not the general bucket (check R2 object key prefix or bucket via Cloudflare dashboard).
3. Confirm IAM / bucket ACL prevents cross-bucket access.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-09 — No Virus Scanning on Document Upload

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/platform/documents/document-service.ts:uploadDocument()` has no antivirus check anywhere in the upload path. Patient-uploaded files are stored to R2 and can be re-served to clinic staff or other patients without scanning. `C_platform_subsystems.md §4` — "No AV hook."

**How to verify:**
1. Upload an EICAR test file (`X5O!P%@AP[4\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*`) as a patient document.
2. Upload must be rejected with a meaningful error message, not accepted.
3. Confirm the EICAR file is not retrievable via `GET /api/v1/documents/:id/download`.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-10 — Lead Status Changes Written to audit_logs

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/services/opsService.ts:updateLead()` updates lead status/priority/notes in D1 but writes no record to `audit_logs`. On a healthcare platform, the ability to reconstruct who changed a consultation record and when is a compliance requirement. `workers/src/services/opsService.ts` — no `INSERT INTO audit_logs` in `updateLead`.

**How to verify:**
1. Update a lead's status via `PATCH /api/v1/ops/leads/:id`.
2. `wrangler d1 execute agsynergy-db --command "SELECT * FROM audit_logs WHERE resource_id='<lead-id>' ORDER BY created_at DESC LIMIT 5;"` — must return at least one row for the update event.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-11 — Consent History IDOR Fixed

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `GET /api/v1/consent/history?identityId=X` in `workers/src/routes/trustRuntime.ts` — `identityId` is taken from query string without comparing it to the authenticated JWT `sub`. Any authenticated user can request the consent history (treatment types, data sharing consents, research participation) of any other patient.

**How to verify:**
1. Authenticate as Patient A. Note their `identityId`.
2. Authenticate as Patient B. `GET /api/v1/consent/history?identityId=<patient-A-id>` — must return 403, not Patient A's consent records.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-12 — Document Share Revoke Ownership Check

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `routes/documents.ts` calls `env.DOCUMENT_SERVICE.revokeShare(documentId, shareId, identityId, body.reason)` but `document-service.ts:revokeShare(documentId, shareId)` only accepts two positional parameters — `identityId` and `reason` are silently dropped. No ownership check is performed. Any authenticated patient who guesses a `shareId` UUID can revoke another patient's document share.

**How to verify:**
1. Patient A shares a document with Patient C. Note the `shareId`.
2. Authenticate as Patient B. `POST /api/v1/documents/<doc-id>/shares/<share-id>/revoke` — must return 403.
3. Confirm the share is still active from Patient A's perspective.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-13 — AUTHORIZATION_ENGINE Wired or Broken Endpoints Removed

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/index.ts` comment: "NOTE: AUTHORIZATION_ENGINE is intentionally NOT wired here." `workers/src/types/env.ts` declares `AUTHORIZATION_ENGINE: any`. `workers/src/routes/trustRuntime.ts` calls `env.AUTHORIZATION_ENGINE.check(body)` and `env.AUTHORIZATION_ENGINE.listPermissions(...)`. Both endpoints throw `TypeError: Cannot read properties of undefined (reading 'check')` on every invocation. Error message is exposed to clients. `KNOWN_GAPS.yaml GAP-001`.

**How to verify:**
1. `POST /api/v1/authorization/check` with a valid JWT — must return a structured authorization result, not a 500.
2. `GET /api/v1/permissions` with a valid JWT — must return permission list, not a 500.
3. If these endpoints are removed instead: confirm no client code calls them.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-14 — Secrets Management: All Production Secrets Confirmed Configured

**Current state:** `[?] UNKNOWN` [INFERRED]

**Why it's unknown:** `deploy.yml` injects `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KID`, `PLATFORM_JWT_PUBLIC_KEY`, `TURNSTILE_SECRET_KEY` from GitHub Secrets. `TELEGRAM_BOT_TOKEN` and `ADMIN_BOT_TOKEN` are not declared in `workers/src/types/env.ts` (cast via `(env as { TELEGRAM_BOT_TOKEN?: string })`). If bot tokens are absent, bots accept unauthenticated requests. `wrangler.jsonc` has `TURNSTILE_SECRET_KEY: ""` at the config level.

**How to verify:**
1. `wrangler secret list --env production` — confirm all of the following are present:
   - `JWT_PRIVATE_KEY`, `JWT_PUBLIC_KEY`, `JWT_KID`
   - `PLATFORM_JWT_PUBLIC_KEY`
   - `TURNSTILE_SECRET_KEY` (non-empty)
   - `TELEGRAM_BOT_TOKEN`, `ADMIN_BOT_TOKEN`
2. Add a startup assertion in `workers/src/index.ts`: if `PLATFORM_JWT_PUBLIC_KEY` is absent, return 503 on all requests (not silent failure).
3. Verify no secrets appear in `wrangler.jsonc` in plaintext.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-15 — Security Headers Verified in Production

**Current state:** `[x] PASS` [OBSERVED]

`workers/src/middleware/security-headers.ts` applies HSTS, CSP (`default-src 'self'`, `frame-ancestors 'none'`), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Permissions-Policy`, `Cache-Control: no-store`, removes `Server` and `X-Powered-By`. Applied globally to every response.

**How to verify:**
```bash
curl -sI https://api.agsynergy.ca/api/v1/health | grep -E "strict-transport|content-security|x-frame|x-content-type|referrer-policy|permissions-policy"
```
All headers must appear. Run `securityheaders.com` scan — must achieve A or A+.

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-16 — Dependency Scanning Active (Dependabot or Equivalent)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No `dependabot.yml` in the repository. No automated dependency vulnerability scanning is configured. A fertility clinic platform holding PHI must be able to detect and patch vulnerable dependencies. `A_build_cicd_testing.md` — "Dependabot: Missing."

**How to verify:**
1. Confirm `.github/dependabot.yml` exists with `package-ecosystem: npm` for all package directories.
2. Alternatively: confirm `pnpm audit --prod` or `npm audit --omit=dev` runs in CI and fails on high/critical CVEs.
3. Run `pnpm audit` locally — must produce zero high/critical vulnerabilities (or all must be triaged with documented acceptance).

| Recheck date | Verified by |
|---|---|
| | |

---

### G1-17 — Gitleaks Secret Scanning Active with Cloudflare Token Rule

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `.github/workflows/deploy.yml` sets `GITLEAKS_CONFIG: ""` — this overrides `.gitleaks.toml` and disables the custom Cloudflare token pattern rule. Cloudflare API tokens accidentally committed to the repo would not be detected. `A_build_cicd_testing.md` — "Gitleaks custom config inactive."

**How to verify:**
1. `cat .github/workflows/deploy.yml | grep GITLEAKS_CONFIG` — must not be empty string, or line must be absent.
2. Confirm `.gitleaks.toml` custom Cloudflare token rule is active by running `gitleaks detect --config=.gitleaks.toml` locally.
3. Create a test branch with a fake Cloudflare token pattern in a comment — CI must catch it and fail the build.

| Recheck date | Verified by |
|---|---|
| | |

---

## Gate 2 — Data Integrity

---

### G2-01 — consents Table Schema Conflict Resolved

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/migrations/0006_trust_runtime.sql` and `workers/migrations/0008_consent_engine.sql` both execute `CREATE TABLE IF NOT EXISTS consents` with different schemas. The second `CREATE TABLE IF NOT EXISTS` is silently ignored by SQLite — the 0008 columns (`patient_identity_id`, `status`, `resource_type`, `resource_id`) are absent from the live table if 0006 ran first. `ConsentEngine` code expects the 0008 schema. `KNOWN_GAPS.yaml GAP-002`; `E_data_layer.md`.

**How to verify:**
```bash
wrangler d1 execute agsynergy-db --command "PRAGMA table_info(consents);"
```
Output must include `patient_identity_id`, `status`, `resource_type`, `resource_id` columns (the 0008 schema). If these are absent, the schema conflict is live. A forward migration must reconcile the schemas before any code writes consent data to D1.

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-02 — Duplicate 0002_* Migration Prefix Resolved

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** Two migration files share the `0002_*` prefix. Wrangler applies migrations in filename order — the application order of these two is undefined or implementation-dependent. `E_data_layer.md` — "duplicate 0002_* prefix."

**How to verify:**
```bash
ls workers/migrations/0002_* | wc -l
```
Must return `1`. If `> 1`, rename one migration (e.g., to `0002b_`) and ensure migration tracking state in D1 (`d1_migrations` table) is consistent after the rename.

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-03 — Timestamp Type Consistency (INTEGER vs TEXT)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/migrations/0010_workflow_engine.sql` uses `INTEGER` (Unix epoch ms) for all timestamps. All other migrations use `TEXT` ISO-8601. Cross-table audit queries and ORDER BY comparisons between workflow and non-workflow tables will produce incorrect ordering. `E_data_layer.md` — "timestamp type inconsistency."

**How to verify:**
1. `wrangler d1 execute agsynergy-db --command "PRAGMA table_info(workflow_events);"` — check `created_at` type.
2. Run a cross-table join query that orders by `created_at` across `workflow_events` and `audit_logs` — confirm results are in chronologically correct order.
3. A new migration must convert 0010 timestamps to TEXT ISO-8601 or update comparison logic uniformly.

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-04 — No In-Memory Stores Holding PHI Patient State

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** At HEAD, the following engines hold patient state in-memory only (documented throughout assessments):
- `ConsentEngine` — module-level Map singleton
- `DelegationEngine` — module-level Map singleton  
- `InMemoryMessageEngine` — `globalThis.__messageEngine`
- `InMemoryAppointmentEngine` — `globalThis.__appointmentEngine`
- `InMemoryTimelineEngine` — new instance per request

All lose data on Cloudflare isolate eviction (~30s idle) or any redeployment. This overlaps with G0-05 and G0-06 but is separately tracked here as a data integrity requirement.

**How to verify:**
```bash
grep -rn "InMemory\|globalThis\.__\|new Map()" workers/src/platform/ workers/src/routes/ \
  | grep -v "test\|\.test\." | grep -v ".md"
```
Must return zero results for production code paths that hold patient state (appointments, messages, timeline, consents, delegations).

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-05 — workflow_instances Table Populated on Workflow Start

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `WorkflowEngine.startWorkflow()` in `workers/src/platform/workflow/engine/workflow-engine.ts` emits a `workflow.started` event to EventStore but **never inserts a row into `workflow_instances`**. `TaskOrchestrator.getDashboardQueue()` joins `task_instances` to `workflow_instances` — this JOIN always returns NULL for `patient_id` and `current_state`. The coordinator dashboard is structurally broken; all workload and SLA-at-risk data is absent. `workers/src/platform/workflow/engine/workflow-engine.ts:startWorkflow()`.

**How to verify:**
1. Start a workflow via `POST /api/v1/workflows`.
2. `wrangler d1 execute agsynergy-db --command "SELECT * FROM workflow_instances ORDER BY created_at DESC LIMIT 5;"` — must return the new workflow row.
3. `GET /api/v1/workflows/queue/dashboard` — must return non-null `patient_id` and `current_state` for active workflows.

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-06 — Migrations Applied Atomically Before Code Deploy

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No `wrangler d1 migrations apply` step in `.github/workflows/deploy.yml`. Migrations are assumed to be run manually. Deploying code that depends on a new migration without running it first causes immediate runtime errors on patient-facing routes. `A_build_cicd_testing.md` — "No migration CI/CD step."

**How to verify:**
1. `cat .github/workflows/deploy.yml | grep -A3 "d1 migrations"` — must show a migration apply step before the `wrangler deploy` step.
2. The step must be environment-gated (staging first, then production).
3. Confirm the step fails the workflow if migration returns an error (non-zero exit).

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-07 — Missing Indexes Added (leads.assigned_to, leads.priority)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `leads.assigned_to` has no index — the `scope=mine` and `scope=unassigned` queries perform full table scans. `leads.priority` has no index — `WHERE priority = 'urgent'` dashboard query is a full table scan. At 10,000+ leads (weeks after GA at clinic scale), response times will degrade significantly. `workers/migrations/0001_initial_schema.sql`.

**How to verify:**
```bash
wrangler d1 execute agsynergy-db --command "
  SELECT name FROM sqlite_master 
  WHERE type='index' AND tbl_name='leads' 
  AND (name LIKE '%assigned_to%' OR name LIKE '%priority%');"
```
Must return at least two index rows. Add a migration if absent:
```sql
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_priority ON leads(priority);
```

| Recheck date | Verified by |
|---|---|
| | |

---

### G2-08 — Referential Integrity: Foreign Keys Enforced

**Current state:** `[x] PASS` [OBSERVED]

Worker sets `PRAGMA foreign_keys = ON` per connection. Most FK relationships are defined in migrations. Some FKs on `agent_audit_events` and `workforce_metrics` are commented out (Hermes — out of scope).

**How to verify:**
```bash
wrangler d1 execute agsynergy-db --command "PRAGMA foreign_keys;"
```
Must return `1`. Attempt to insert an orphaned record (e.g., `document` with non-existent `identity_id`) — must be rejected with FK constraint error.

| Recheck date | Verified by |
|---|---|
| | |

---

## Gate 3 — Reliability and Operations

---

### G3-01 — Structured Logs Ship to Persistent Store (Logpush)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `wrangler.jsonc` has `"observability": { "enabled": true }` which activates Cloudflare dashboard tail logs, but these are ephemeral. No Logpush rule is declared in the repository. Logs are not shipped to Datadog, S3, Elasticsearch, or any queryable persistent store. An incident at 3am requires the on-call to have `wrangler tail` open in advance or be unable to diagnose root cause. `workers/wrangler.jsonc` — no `logpush` key.

**How to verify:**
1. `cat workers/wrangler.jsonc | grep logpush` — must return a configured Logpush destination.
2. Alternatively: confirm Cloudflare Logpush is configured in the Cloudflare dashboard for the production Worker with destination verified.
3. Trigger a test 500 error. Confirm the log appears in the persistent store within 60 seconds and is queryable after 10 minutes.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-02 — Error Tracking Active (Sentry or Equivalent)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** Searching the codebase for `sentry`, `datadog`, `honeybadger`, `bugsnag` returns zero results. The router catch block returns a 500 response but does NOT call `error(...)` to emit a structured log — exceptions are swallowed for observability. There is no alerting channel for unhandled errors. `workers/src/router/index.ts` — catch block; `T1_observability_errors_perf_testing.md §1.3`.

**How to verify:**
1. Check `package.json` and `wrangler.jsonc` for Sentry DSN or equivalent.
2. Trigger a known error (e.g., call `POST /api/v1/authorization/check` which currently throws TypeError).
3. Confirm the exception appears in Sentry (or equivalent) with stack trace and request context within 30 seconds.
4. Confirm the same error appears in the SPA's frontend error tracker when a React component crashes.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-03 — Request Correlation ID on Every Request

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No middleware generates a `requestId` / trace ID per request. `request.start` and `request.complete` log events cannot be correlated to each other or to specific errors in route handlers. A patient who reports "something went wrong at 3:47pm" cannot be matched to a specific Worker invocation. `workers/src/index.ts` — `request.start` log event has no `requestId` field; `T1_observability_errors_perf_testing.md §1.5`.

**How to verify:**
1. Make any API call.
2. `wrangler tail` — the `request.start` and `request.complete` log events must both include the same `requestId` UUID.
3. The `X-Request-ID` response header must match the logged `requestId`.
4. Any 500 error log must include the same `requestId`.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-04 — Uptime Monitoring and On-Call Alerting Configured

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No uptime monitoring configuration exists anywhere in the repository. No PagerDuty, Checkly, Better Uptime, or Cloudflare Health Check alert policy is configured. The health endpoint `GET /api/v1/health` is suitable for external probes but nothing calls it. There is no documented on-call rotation. `T1_observability_errors_perf_testing.md §1.6`.

**How to verify:**
1. Confirm an external uptime monitor is configured to probe `GET https://api.agsynergy.ca/api/v1/health` at least every 60 seconds.
2. Confirm an alert fires to an on-call channel (PagerDuty, Slack, SMS) within 5 minutes of a 503 response.
3. Confirm at least one named on-call person is assigned for the launch period.
4. Test: temporarily return 503 from the health endpoint and confirm alert fires.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-05 — Health Check Covers Real Dependencies (Not Just Primary DB)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/routes/health.ts` checks only the primary D1 binding (`env.DB`). It does NOT check:
- R2 bucket (`DOCUMENT_STORAGE`) — an R2 outage is invisible; health reports "healthy"
- `NOTIFICATIONS` D1 binding (which has `database_id: ""`) — would return 503 if the binding were checked but it is not
- `PLATFORM_JWT_PUBLIC_KEY` presence — absent key makes all auth routes 401 while health reports "healthy"

**How to verify:**
1. Temporarily set `NOTIFICATIONS` binding to a non-existent database.
2. `GET /api/v1/health` — must return 503, not 200.
3. Temporarily remove `PLATFORM_JWT_PUBLIC_KEY`.
4. `GET /api/v1/health` — must return 503.
5. `GET /api/v1/health` in production with valid config — must return 200 with each dependency's status.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-06 — React Error Boundaries Present in SPA

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** Searching `artifacts/ags-fertility/` for `ErrorBoundary`, `componentDidCatch` returns zero results. Any unhandled React exception crashes the entire SPA — patient sees a blank white screen with no error message or recovery path. The Replit dev error overlay does not activate in production builds. `T1_observability_errors_perf_testing.md §2.5`.

**How to verify:**
1. `grep -r "ErrorBoundary\|componentDidCatch" artifacts/ags-fertility/src/` — must return at least 3 boundaries (root, patient workspace, auth).
2. Trigger an intentional throw in a child component — must show a user-friendly error UI with a "try again" option, not a blank screen.
3. Confirm the error is reported to the frontend error tracker (see G3-02).

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-07 — Rollback Procedure Documented and Tested

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No rollback procedure document exists in the repository. Worker code rollback is mechanically possible via `wrangler rollback <deployment_id>` but is not scripted, not documented, and not tested. D1 data rollback is impossible without PITR (status unknown — see G0-07). `T2_platform_data_pipeline.md GAP-DEP-002`.

**How to verify:**
1. Confirm `scripts/rollback.sh` (or equivalent) exists and is executable.
2. The script must: (a) identify the previous deployment ID, (b) execute `wrangler rollback`, (c) verify health endpoint returns 200 post-rollback.
3. Execute a dry-run rollback in staging. Measure time from decision to healthy state — must be < 10 minutes.
4. Document the procedure in a runbook accessible to all on-call engineers.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-08 — Staging Environment Isolated from Production Data

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/wrangler.jsonc` `env.preview` — has no `route` defined and shares the same `agsynergy-db` `database_id` as production. It is not a staging environment. Running integration tests or pre-release validation against "staging" modifies production patient data. `T2_platform_data_pipeline.md GAP-CF-001`.

**How to verify:**
1. `cat workers/wrangler.jsonc | grep -A30 '"staging"'` — staging environment must exist with its own D1 database ID, R2 bucket, and route.
2. Confirm staging D1 ID ≠ production D1 ID.
3. Deploy a test build to staging. Verify it does not modify production data.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-09 — Incident Runbook Exists and is Accessible

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No incident runbook, no `docs/runbooks/` directory, no on-call guide found anywhere in the repository. `T2_platform_data_pipeline.md` — "no rollback procedure documented."

**How to verify:**
1. Confirm `docs/runbooks/incident-response.md` (or equivalent) exists and covers:
   - High error rate: how to identify, how to rollback
   - D1 outage: detect, escalate, workaround
   - JWT key rotation: step-by-step with zero-downtime procedure
   - Data breach: first response, Cloudflare contact, PIPEDA notification timeline
   - Notification delivery failure: detect, bypass, patient communication
2. Runbook must be accessible without production credentials (e.g., in a Wiki or repo).

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-10 — Cron Triggers Wired for Timer Service

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/platform/workflow/timers/cron-scheduler.ts` exists (6.6 KB) but no `triggers.crons` key is declared in `workers/wrangler.jsonc`. Timers scheduled in D1 (`timer_schedules` table) will never fire — SLA escalations, beta HCG reminders, and follow-up sequences are permanently disabled. `workers/wrangler.jsonc` — no `scheduled` export or cron triggers.

**How to verify:**
1. `cat workers/wrangler.jsonc | grep -A5 "triggers"` — must show at least one cron trigger entry.
2. `wrangler tail` — after a cron interval, must show a log entry from the scheduled handler.
3. Create a timer with a due time 2 minutes in the future. Wait. Confirm timer fired event appears in `workflow_events`.

| Recheck date | Verified by |
|---|---|
| | |

---

### G3-11 — Exception Message Not Leaked to API Clients

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/router/index.ts` catch block: `return new Response(JSON.stringify({ error: "Internal Server Error", message }), { status: 500 })` where `message = err.message`. For the known `AUTHORIZATION_ENGINE` defect, this exposes `"Cannot read properties of undefined (reading 'check')"` — revealing internal code structure. D1 error messages may expose table/column names. `T1_observability_errors_perf_testing.md §2.2`.

**How to verify:**
1. Trigger a 500: `POST /api/v1/authorization/check` with a valid JWT.
2. Response body must NOT contain internal error details — must return a generic `{ "error": "Internal Server Error", "requestId": "<id>" }` with no stack or exception message.
3. The actual exception must be logged internally (to error tracker and log store) with full detail.

| Recheck date | Verified by |
|---|---|
| | |

---

## Gate 4 — Quality Assurance

---

### G4-01 — CI Test Gate Blocks Deploy on Test Failure

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `.github/workflows/deploy.yml` has no `vitest` step. 68 test files containing 375+ tests are never run in CI. Any breaking change — a broken auth middleware, a crashed route handler — deploys to production patients within seconds of a commit. `KNOWN_GAPS.yaml GAP-004`; `A_build_cicd_testing.md`.

**How to verify:**
1. `cat .github/workflows/deploy.yml` — must contain a step running `pnpm vitest run` or `pnpm test` before any `wrangler deploy` step.
2. Introduce a deliberate test failure (e.g., break a unit test assertion). Push to a branch. The CI pipeline must fail and block deploy.
3. Fix the test. CI must pass and deploy proceed.

| Recheck date | Verified by |
|---|---|
| | |

---

### G4-02 — CI TypeScript Typecheck Gate Blocks Deploy

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No `tsc` step in `.github/workflows/deploy.yml`. Wrangler/esbuild type-strips at build time — the Worker deploys successfully despite 218 known TypeScript compile errors. The error count can grow silently. New PRs add errors with no detection. `T2_platform_data_pipeline.md GAP-CI-001`.

**How to verify:**
1. `cat .github/workflows/deploy.yml` — must contain `pnpm run typecheck` or `tsc --noEmit` step before deploy.
2. The 218 existing errors must be resolved (or a baseline established with zero new errors allowed per PR).
3. Introduce a new type error in a PR branch. CI must catch and block.

| Recheck date | Verified by |
|---|---|
| | |

---

### G4-03 — Frontend Has Tests (Unit + Integration)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** Zero test files exist in `artifacts/ags-fertility/`. Patient-facing registration, login, document upload, appointment booking, and dashboard components have no automated verification. Any regression ships silently. `D_frontend.md §7` — confirmed zero test files.

**How to verify:**
```bash
find artifacts/ags-fertility -name "*.test.*" -o -name "*.spec.*" | wc -l
```
Must return `> 0`. At minimum, tests must cover:
- Patient registration form validation
- Login flow (success, error, MFA redirect)
- Document upload flow
- Auth guard redirect behavior for unauthenticated users

| Recheck date | Verified by |
|---|---|
| | |

---

### G4-04 — Critical Path E2E Tests Cover Patient Journey

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/tests/launch/smoke-tests.test.ts` exists but requires a live `SMOKE_TEST_URL` and is excluded from CI. No Playwright or Cypress E2E test suite exists. No automated test exercises the full patient journey end-to-end. `T1_observability_errors_perf_testing.md §4.2` — "E2E: Missing."

**How to verify:**
1. `find . -name "playwright.config.*" -o -name "cypress.config.*" | head -5` — must return at least one config file.
2. Run the E2E suite against staging. The following flows must pass:
   - Register → verify email → login → view dashboard
   - Upload a document → download it → verify audit log
   - Book an appointment → cancel it
   - Send a message → confirm clinic receives it
3. E2E suite must run in CI against staging before production deploy.

| Recheck date | Verified by |
|---|---|
| | |

---

### G4-05 — Clinic and Timeline Routes Have Test Coverage

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No test files found for `/api/v1/clinic/*`, `/api/v1/clinic/messages/*`, `/api/v1/coordination/*`, or `/api/v1/timeline/*` route handlers. These are patient-facing and clinic-facing routes with no automated regression detection. `T1_observability_errors_perf_testing.md §4.2`.

**How to verify:**
```bash
ls workers/tests/clinic/ workers/tests/timeline/ 2>/dev/null | wc -l
```
Must return `> 0`. Tests must cover at minimum: auth guard enforcement, ownership checks, expected data shapes.

| Recheck date | Verified by |
|---|---|
| | |

---

### G4-06 — Load Testing Completed at Target Patient Volume

**Current state:** `[ ] FAIL` [UNKNOWN]

**Why it fails:** No load test configuration (`k6`, `artillery`, `locust`) exists in the repository. No performance baseline has been established. The known risks at load are: in-memory state loss under isolate churn, `leads.*` full table scans, D1 query latency under concurrent access, and the 50 subrequest/Worker limit. [UNKNOWN] whether the system meets latency SLAs under expected patient volume. `T1_observability_errors_perf_testing.md §3.8`.

**How to verify:**
1. Define target: expected concurrent users at launch (e.g., 100 concurrent patients).
2. Run `k6 run --vus 100 --duration 10m scripts/load-test.js` against staging.
3. P99 latency for `GET /api/v1/appointments` must be < 2000ms.
4. P99 latency for `POST /identity/login` must be < 1500ms.
5. Error rate must be < 0.1% at target load.
6. No 50x errors from D1 subrequest limit exhaustion.

| Recheck date | Verified by |
|---|---|
| | |

---

### G4-07 — TypeScript Error Baseline at Zero New Errors

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** 218 pre-existing TypeScript compile errors exist across `trust/`, `documents/`, `timeline/`, `credentials/`, `epcl/`, `hermes/*`. These are documented in `TECHNICAL_DEBT_INVENTORY.md` and `EPIC-015_BACKLOG.md` as deferred. No CI gate prevents new errors from being added. The count can silently increase. `T2_platform_data_pipeline.md §1`.

**How to verify:**
```bash
cd workers && pnpm exec tsc --noEmit 2>&1 | tail -3
```
The launch standard is: either (a) zero errors, or (b) errors are frozen at a documented baseline and no new errors are introduced. Confirm CI enforces the baseline using `tsc --noEmit` with error count comparison.

| Recheck date | Verified by |
|---|---|
| | |

---

## Gate 5 — Product Completeness for GA

> Items marked PASS here represent functional capabilities confirmed at HEAD. FAIL items represent broken or missing capabilities that prevent clinic staff or patients from doing their jobs.

---

### G5-01 — Consultation Form Submission Works End-to-End

**Current state:** `[x] PASS` [OBSERVED]

`ConsultationForm.tsx` validates with Zod, calls `POST /api/v1/consultations`, backend validates, deduplicates, and writes to D1 `leads` table. Returns `{ success: true, lead_id }`.

**How to verify:**
```bash
curl -X POST https://api.agsynergy.ca/api/v1/consultations \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Patient","email":"test@example.com","phone":"5551234567","treatment_interest":"IVF"}'
```
Must return 201 with `lead_id`. Re-submit same email — must return 409 (duplicate). `wrangler d1 execute agsynergy-db --command "SELECT COUNT(*) FROM leads;"` — must increment.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-02 — Lead Management Ops API Works with Real Data

**Current state:** `[x] PASS` [OBSERVED]

`GET /api/v1/ops/leads`, `PATCH /api/v1/ops/leads/:id`, `POST /api/v1/ops/leads/:id/assign`, `GET /api/v1/ops/dashboard` all use real D1 reads with RBAC enforcement.

**How to verify:**
1. Submit a consultation. Retrieve it via `GET /api/v1/ops/leads` (with ops JWT).
2. Update status: `PATCH /api/v1/ops/leads/:id` with `{ "status": "contacted" }` — confirm change persists after Worker restart.
3. `GET /api/v1/ops/dashboard` — confirm lead counts match `SELECT status, COUNT(*) FROM leads GROUP BY status;`.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-03 — Patient Dashboard Loads for Existing Patient

**Current state:** `[x] PASS` (partial) [OBSERVED]

Dashboard `DashboardPage.tsx` handles empty timeline gracefully with "Getting Started" card. Auth guard on patient routes is present and functional. Dashboard makes API calls and handles errors with amber banners.

**How to verify:**
1. Log in as a test patient. Navigate to `/patient/dashboard`.
2. Must load without blank screen or unhandled error.
3. "Getting Started" card must be visible with correct steps listed.
4. No 404 or 500 responses in the browser network tab.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-04 — Document Upload Actually Uploads Files to R2

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `UploadDialog.handleUpload` in `artifacts/ags-fertility/src/pages/patient/DocumentsPage.tsx` calls `fetchDocuments()` instead of `initiateUpload()`. A TODO comment in the code confirms this. Patients cannot upload medical records. The R2 bucket `agsynergy-documents` is provisioned. `KNOWN_GAPS.yaml` (document upload); `P1_website_journey_portal.md §2.3 J-06`.

**How to verify:**
1. Log in as a test patient. Navigate to `/patient/documents`.
2. Click "Upload document". Select a PDF file. Submit.
3. `wrangler r2 object list agsynergy-documents` — the uploaded file must appear.
4. `wrangler d1 execute agsynergy-db --command "SELECT COUNT(*) FROM documents WHERE identity_id='<test-patient-id>';"` — must increment.
5. Download the document — must retrieve the original file content.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-05 — Care Plan Page Loads (backend routes exist)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `CarePlanPage.tsx` calls `GET /api/v1/timeline/phases`. This route does not exist in the backend route table. The page always returns 404. `B_worker_api_layer.md §2.10`; `P1_website_journey_portal.md §3.2 P-02`.

**How to verify:**
```bash
curl -H "Authorization: Bearer <patient-jwt>" https://api.agsynergy.ca/api/v1/timeline/phases
```
Must return 200 with phase data, not 404.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-06 — Tasks Page Loads (backend route exists)

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `TasksPage.tsx` calls `GET /api/v1/timeline/tasks`. Route does not exist. Page always 404s. `B_worker_api_layer.md §2.10`; `P1_website_journey_portal.md §3.2 P-03`.

**How to verify:**
```bash
curl -H "Authorization: Bearer <patient-jwt>" https://api.agsynergy.ca/api/v1/timeline/tasks
```
Must return 200 with task data, not 404.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-07 — Clinic Portal Shows Real Patient Data

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/routes/clinic.ts` returns `_mockPatients` — 8 hardcoded patient records. Clinic staff see fake data, not real patients. `B_worker_api_layer.md §8.3`; `P2_clinic_crm_consultation_admin.md §1.3`.

**How to verify:**
1. Authenticate as a clinic staff member. Navigate to `/clinic/patients`.
2. Patient list must show real patient records from D1, not "Alice Johnson", "Bob Smith", etc.
3. `GET /api/v1/clinic/patients` — response must not contain the hardcoded mock patient IDs.
4. `wrangler d1 execute agsynergy-db --command "SELECT id FROM identities WHERE type='patient' LIMIT 3;"` — these IDs must match what the clinic portal returns.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-08 — Clinic Message Triage Shows Real Messages

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/routes/clinic-messages.ts` returns `_mockTriageQueue` (3 hardcoded items). Patient conversations endpoint returns a projection of the same mock data. `_flagThread` always returns `{ flagged: true }` regardless of state. `P2_clinic_crm_consultation_admin.md §1.3`.

**How to verify:**
1. Patient sends a message as a test. Clinic staff authenticates and navigates to `/clinic/messages`.
2. The patient's message must appear in the triage queue.
3. `GET /api/v1/clinic/messages/triage` — must not contain hardcoded mock sender IDs.
4. Flag a thread. Unflag it. State must toggle and persist.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-09 — Consultation Lead Notification Fires on Submission

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `workers/src/services/consultationService.ts` writes the lead to D1 and returns success with no further action. No email, SMS, or Telegram alert fires to notify the ops team of a new lead. Ops team discovers leads only by polling the Telegram bot or API. `P2_clinic_crm_consultation_admin.md §3.1 Break 3`.

**How to verify:**
1. Submit a consultation form.
2. Within 2 minutes, the ops team channel (email or Telegram) must receive a new lead notification.
3. The patient must receive a confirmation email acknowledging receipt of their inquiry.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-10 — Patient Onboarding Flow Exists

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** After first login, patients land directly on the dashboard with no consent agreement, no intake form, and no profile completion gate. No onboarding wizard page or route exists in `App.tsx`. For a healthcare platform, skipping consent collection at onboarding is a regulatory gap (PIPEDA). `P1_website_journey_portal.md §2.1 Step 6`.

**How to verify:**
1. Complete registration and first login as a new patient.
2. Must be redirected to an onboarding wizard, NOT directly to the dashboard.
3. Onboarding must include: (a) consent agreement, (b) profile completion, (c) intake questionnaire.
4. Dashboard must not be accessible until onboarding is complete.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-11 — Workflow Templates Seeded for IVF Protocol

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `TaskOrchestrator.generateTasksForState()` queries `SELECT definition FROM workflow_templates WHERE id = ?`. No migration seeds any rows in `workflow_templates`. A new workflow starts with zero tasks. The IVF protocol (stimulation, retrieval, transfer stages with associated clinical tasks) is not defined in the system. `P3_workflow_timeline_notif_files_reporting.md §1`.

**How to verify:**
```bash
wrangler d1 execute agsynergy-db --command "SELECT COUNT(*) FROM workflow_templates;"
```
Must return `> 0`. Start an IVF workflow. `GET /api/v1/workflows/:id/tasks` — must return the protocol-defined task list for the current stage.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-12 — Reporting: Operational Dashboard Exists for Clinic Management

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No clinical reporting capability exists. `ProjectionEngine.buildOperationalMetrics()`, `buildClinicalMetrics()`, `buildQualityMetrics()` return hardcoded zero structs. `workflow_analytics_daily` and `notification_analytics` tables are never populated. No route exposes these metrics. There is no web admin console at all — administration is Telegram-only. `P3_workflow_timeline_notif_files_reporting.md §5`.

**How to verify:**
1. Navigate to the admin/ops web dashboard (must exist as a web UI, not just Telegram bot).
2. Dashboard must show: active patient count, workflows by stage, SLA breach alerts, lead pipeline status.
3. `GET /api/v1/workflows/analytics` (or equivalent) — must return non-zero metrics for a system with active workflows.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-13 — Password Reset Flow Delivers Email

**Current state:** `[ ] FAIL` [UNKNOWN]

**Why it's unknown:** `ForgotPasswordPage.tsx` exists and calls `POST /identity/password/reset`. Whether email delivery is implemented or stubbed is not confirmed. Given that the notification delivery engine is a simulation stub, password reset emails likely follow the same path and are never sent. `P1_website_journey_portal.md §2.3`.

**How to verify:**
1. Click "Forgot password" on the login page. Enter a registered email.
2. Check the inbox — must receive a password reset email within 2 minutes.
3. Click the reset link — must land on a password reset form (not a 404).
4. Set a new password. Log in with the new password.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-14 — Session Management Works (List and Revoke)

**Current state:** `[x] PASS` [OBSERVED]

`GET /identity/sessions` lists active sessions. `DELETE /identity/sessions/:id` revokes a specific session. `IdentityService` revokes all sessions on password change. Session lifetimes are correctly differentiated by role (`browser_patient: 24h`, `browser_staff: 8h`).

**How to verify:**
1. Log in from two devices as a test patient.
2. `GET /identity/sessions` — must show two active sessions.
3. Revoke one session. The revoked session's JWT must return 401 on subsequent requests.
4. Change password — all sessions except current must be revoked.

| Recheck date | Verified by |
|---|---|
| | |

---

### G5-15 — Telegram Ops Bot Accessible and Returns Real Lead Data

**Current state:** `[x] PASS` [OBSERVED]

`routes/telegram.ts` — `/dashboard`, `/leads`, `/lead <id>` commands read from D1 with RBAC. Real data confirmed. Bot RBAC enforcement confirmed.

**How to verify:**
1. Send `/leads` to the ops Telegram bot.
2. Must return real lead records matching `SELECT * FROM leads ORDER BY created_at DESC LIMIT 10`.
3. Send `/dashboard` — counts must match `SELECT status, COUNT(*) FROM leads GROUP BY status`.
4. Confirm bot rejects requests from unauthorized users.

| Recheck date | Verified by |
|---|---|
| | |

---

## Gate 6 — Documentation and Handover

---

### G6-01 — OpenAPI Spec Covers All Patient-Facing Endpoints

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `lib/api-spec/openapi.yaml` version `0.1.0` covers exactly 3 endpoints: `GET /health`, `POST /consultations`, `GET /consultations/count`. The actual API has approximately 110+ endpoints. All Wave 3–8 endpoints (appointments, documents, messages, timeline, notifications, workflows, tasks, trust, consent, clinic) have no spec coverage and no generated client hooks. `T2_platform_data_pipeline.md GAP-API-001`.

**How to verify:**
```bash
cat lib/api-spec/openapi.yaml | grep "^\s*/" | wc -l
```
Must return approximately the same count as actual route handlers. Run spec validation: `npx @redocly/cli lint lib/api-spec/openapi.yaml` — must pass with no errors. Regenerate client: `pnpm run generate` — generated hooks must cover all patient portal API calls.

| Recheck date | Verified by |
|---|---|
| | |

---

### G6-02 — Runbooks Exist for All P0 Scenarios

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** No runbooks directory exists. No incident response guide, no JWT rotation procedure, no D1 restore procedure, no breach notification procedure exists in the repository. `T2_platform_data_pipeline.md GAP-DEP-002`.

**How to verify:**
1. `ls docs/runbooks/` — must exist and contain at minimum:
   - `incident-response.md`
   - `jwt-key-rotation.md`
   - `d1-restore.md`
   - `breach-notification.md`
   - `worker-rollback.md`
2. Each runbook must have a "last tested" date within 30 days.
3. A non-author must be able to execute the runbook without clarification.

| Recheck date | Verified by |
|---|---|
| | |

---

### G6-03 — KNOWN_GAPS.yaml / Context Layer Current

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** `KNOWN_GAPS.yaml` documents GAP-001 through GAP-009. This checklist identified additional gaps not yet catalogued (IDOR on workflows/tasks, document upload TODO, consents schema conflict, migration ordering). The context layer must be updated to reflect current state so future engineers have accurate gap tracking.

**How to verify:**
1. Every FAIL item in this checklist must have a corresponding entry in `KNOWN_GAPS.yaml` or an equivalent tracking system.
2. Each entry must have: description, severity, status, owner, and target resolution date.
3. `KNOWN_GAPS.yaml` must be reviewed and confirmed current at the start of each sprint.

| Recheck date | Verified by |
|---|---|
| | |

---

### G6-04 — Env Var Naming Consistent Across All API Clients

**Current state:** `[ ] FAIL` [OBSERVED]

**Why it fails:** Three different fallback patterns observed across SPA API clients:
- `patient-api.ts`: `VITE_API_BASE || 'https://api.agsynergy.ca'`
- `document-api.ts`: hardcoded `/api/v1` (no env var)
- `appointment-api.ts`: `VITE_API_BASE ?? ''`

Inconsistent fallbacks mean document and appointment API calls may hit different hosts in staging/production. `T2_platform_data_pipeline.md §1 — Env var handling consistency`.

**How to verify:**
```bash
grep -rn "VITE_API_BASE\|api\.agsynergy\.ca\|\/api\/v1" \
  artifacts/ags-fertility/src/lib/ | grep -v ".test."
```
Every API client must use the same `VITE_API_BASE` env var with the same fallback strategy. No hardcoded host strings in API client files.

| Recheck date | Verified by |
|---|---|
| | |

---

## Launch-Day Smoke Test Script

> Run this immediately post-deploy, in order, against the production URL. Each step must pass before proceeding to the next. Two people should run this in parallel — one as patient, one monitoring logs.

```
PRODUCTION URL: https://agsynergy.ca
API URL:        https://api.agsynergy.ca
TEST EMAIL:     smoketest-launch@agsynergy.ca (dedicate this email to smoke tests)
```

| # | Step | Expected Result | Actual Result | Status |
|---|------|----------------|---------------|--------|
| 1 | `GET https://api.agsynergy.ca/api/v1/health` | HTTP 200, `{"status":"healthy"}`, all dependency checks pass | | |
| 2 | Navigate to `https://agsynergy.ca` | Home page renders in < 3 seconds, no JS errors in console | | |
| 3 | Submit consultation form (`/contact`) with test data | 201 response, success toast shown; `wrangler d1 execute agsynergy-db --command "SELECT COUNT(*) FROM leads WHERE email='smoketest-launch@agsynergy.ca';"` returns 1 | | |
| 4 | Navigate to `/patient/register` and register with `smoketest-launch@agsynergy.ca` | Email verification email received within 2 minutes | | |
| 5 | Click verification link in email | Lands on `/patient/verify-email`, shows "email verified" message | | |
| 6 | Log in at `/patient/login` | Redirected to `/patient/dashboard`, no 404 or 500 | | |
| 7 | Enable MFA in security settings | QR code displayed, TOTP app adds account | | |
| 8 | Log out and log in again with MFA | Redirected to `/patient/mfa` (not 404), TOTP code accepted, lands on dashboard | | |
| 9 | Upload a PDF to `/patient/documents` | File appears in document list; `wrangler r2 object list agsynergy-documents` shows the new object | | |
| 10 | Download the uploaded document | Correct file content received; `wrangler d1 execute agsynergy-db --command "SELECT * FROM document_access_log ORDER BY accessed_at DESC LIMIT 3;"` shows download event | | |
| 11 | Navigate to `/patient/appointments` and book a test appointment | Appointment appears in list; wait 60 seconds, reload — appointment still present (persistence check) | | |
| 12 | Send a message via `/patient/messages` | Message appears in thread; reload — message persists | | |
| 13 | Log in as a clinic staff test account; navigate to `/clinic/messages` | Patient's message appears in triage queue (real data, not mock) | | |
| 14 | Check ops Telegram bot: `/leads` | Smoke test consultation lead from step 3 appears | | |
| 15 | Check ops Telegram bot: `/dashboard` | Counts match D1: `SELECT status, COUNT(*) FROM leads GROUP BY status;` | | |
| 16 | Navigate to `/clinic/dashboard` without logging in | Redirected to login page (auth guard working) | | |
| 17 | Trigger deliberate 500: `curl -X POST https://api.agsynergy.ca/api/v1/authorization/check -H "Authorization: Bearer <valid-jwt>"` | Error appears in Sentry/error tracker within 30 seconds | | |
| 18 | Check log store (Datadog/S3) | Structured JSON logs for all steps 1-17 are queryable, with `requestId` correlation | | |
| 19 | `GET https://api.agsynergy.ca/api/v1/health` again | Still HTTP 200 healthy after all smoke test traffic | | |
| **Total** | | | | **__/19** |

**Smoke test pass threshold: 19/19. Any FAIL is a rollback trigger.**

---

## Rollback Trigger List

Initiate immediate rollback (`wrangler rollback <previous_deployment_id>`) if ANY of the following are observed post-deploy. Decision must be made within 5 minutes of observing the condition.

| # | Condition | Observable Signal | Rollback Command |
|---|-----------|-------------------|-----------------|
| 1 | Error rate > 1% across any 5-minute window | Sentry error volume spike; `request.complete` log showing >1% status=5xx | `wrangler rollback --env production` |
| 2 | Any patient reports "appointment disappeared" or "message gone" | Patient support report; or GET /api/v1/appointments returns empty for a patient who booked | Rollback + incident report; data may require manual restore from PITR |
| 3 | Clinic portal accessible without login | Anonymous browser GET /clinic/dashboard returns 200 with clinic data | Rollback immediately — PHI exposure |
| 4 | Any IDOR confirmed: Patient B reads Patient A's data | API response contains another patient's PHI (names, appointment types, messages, documents) | Rollback immediately; notify PIPEDA officer; begin breach assessment |
| 5 | Health endpoint returns 503 for > 2 consecutive checks | Uptime monitor fires P0 alert | Rollback; check D1 connectivity |
| 6 | Notification delivery failure rate > 5% | Delivery logs show simulated delivery still (no real SES/Twilio calls); patient reports no email received | Rollback if root cause is deployment regression |
| 7 | Patient registration succeeds but no verification email sent | Smoke test step 4 fails; registration auto-completes without email | Rollback immediately — identity integrity broken |
| 8 | MFA-enrolled patient hits 404 on login | Patient reports "page not found" after entering credentials; `/patient/mfa` route missing | Rollback immediately — patients locked out |
| 9 | `wrangler d1 execute agsynergy-db --command "SELECT COUNT(*) FROM consents;"` decreases after deploy | Row count drops — schema migration may have wiped data | Rollback; invoke PITR; do not re-deploy until root cause confirmed |
| 10 | Any unhandled TypeErrors in production logs referencing `AUTHORIZATION_ENGINE` or `undefined` | Sentry shows TypeError from trustRuntime.ts; or router returns 500 with engine message | Rollback if these endpoints were previously working |
| 11 | JWT validation failing for all users (mass 401) | Sentry spike of `VERIFICATION_FAILED`; all authenticated endpoints return 401 | Rollback; check `PLATFORM_JWT_PUBLIC_KEY` secret injection |
| 12 | Document upload to R2 succeeds (201) but file not retrievable | Download returns 404 or corrupted content | Rollback; check R2 binding and presigned URL generation |

---

## Appendix: Gap Cross-Reference

| Assessment ID | Description | Gate | Item |
|---|---|---|---|
| GAP-001 / KNOWN_GAPS | AUTHORIZATION_ENGINE not wired | G1 | G1-13 |
| GAP-002 / KNOWN_GAPS | `consents` table schema conflict | G2 | G2-01 |
| GAP-003 / KNOWN_GAPS | Clinic frontend auth guard missing | G0 | G0-04 |
| GAP-004 / KNOWN_GAPS | No CI test gate | G4 | G4-01 |
| GAP-006 / KNOWN_GAPS | In-memory engines / consent persistence | G0 | G0-05, G0-06 |
| GAP-008 / KNOWN_GAPS | NOTIFICATIONS D1 unprovisioned | G0 | G0-08 |
| GAP-009 / KNOWN_GAPS | localStorage token storage | G1 | G1-03 |
| J-01 / P1 | Registration auto-verifies email | G0 | G0-09 |
| J-03 / P1 | No /patient/mfa route | G0 | G0-10 |
| J-04 / P1 | Timeline engine in-memory | G0 | G0-05 |
| J-05 / P1 | /timeline/phases and /timeline/tasks 404 | G5 | G5-05, G5-06 |
| J-06 / P1 | Document upload calls wrong function | G5 | G5-04 |
| G-02 / P2 | Clinic mock patient data | G5 | G5-07 |
| G-17 / P2 | Lead status changes unaudited | G1 | G1-10 |
| P4 IDOR / P4 | Cross-patient appointment/message/workflow access | G0 | G0-01, G0-02, G0-03 |
| T1-G01 / T1 | No request correlation ID | G3 | G3-03 |
| T1-G02 / T1 | Logs not shipped (no Logpush) | G3 | G3-01 |
| T1-G03 / T1 | No error tracking | G3 | G3-02 |
| T2-GAP-DR-001 | No D1/R2 backup or DR | G0 | G0-07 |
| T2-GAP-DB-001 | `consents` schema conflict | G2 | G2-01 |
| T2-GAP-CI-001 | No typecheck gate | G4 | G4-02 |
| T2-GAP-CI-002 | No test gate in CI | G4 | G4-01 |
| T2-GAP-CF-001 | No staging environment | G3 | G3-08 |
| T2-GAP-API-001 | OpenAPI spec covers 3 of 110 endpoints | G6 | G6-01 |

---

*Document generated: 2026-08-04 from assessments at HEAD `0b5e0c3`. Re-run all verification steps after each remediation commit. Do not mark PASS from code review alone.*
