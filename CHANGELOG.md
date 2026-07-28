# Changelog

> Release history for the Concierge platform.
> Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
> Versioning: [Semantic Versioning](https://semver.org/)

---

## [1.0.1] — 2026-07-28 — WEF Phase 0: Golden-Path Stabilization (P0)

**Date:** 2026-07-28
**Status:** ✅ PRODUCTION LIVE (deploy `188ef61` → `d22f918`)
**Phase:** WEF Phase 0 — Concierge MVP Operational Readiness
**Wave:** Wave 8.1 follow-up
**Sprint:** Register→Login golden-path repair

> Four layered, production-blocking defects were found and fixed in the live
> Patient Identity API (`api.agsynergy.ca`). Each was a *different* root cause;
> the golden path now returns 200 end-to-end (register → email verify →
> login → token round-trip → appointments → consent → clinic messaging →
> logout/re-login).

### Fixed (P0)
- **PBKDF2 Web Crypto limit** (`password-manager.ts`): `600_000` → `100_000` iterations (hotfix `59dd51c`, previously committed but never deployed — pipeline only shipped the frontend worker).
- **D1 `undefined` bindings** (`platform/d1.ts`): added `safeBind()` coercion (`undefined` → `null`) wrapped at the request boundary in `index.ts`. Resolves `D1_TYPE_ERROR` on all DB writes (register, sessions, refresh tokens, audit). Commit `516f61f`.
- **Email verification status transition** (`platform/identity/email-verification.ts`): `email/verify/complete` now flips `status` `REGISTERED → VERIFIED` (previously only set `email_verified`, leaving login's `ACTIVE||VERIFIED` guard permanently unmet). Commit `ec82f91`.
- **JWT signing key not registered** (`index.ts` + `.github/workflows/deploy.yml`): `JwtManager` was created with no keypair, so `login` threw `No active signing key registered`. Signing keypair is now provisioned via GitHub secrets (`JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY`/`JWT_KID`) injected into `wrangler.jsonc` `vars.production` at deploy time (private key **never committed**). Commits `188ef61`, `d22f918`.

### Deployment
- CI hardened: pipeline now deploys **both** workers (`agsynergy-api` → `api.agsynergy.ca` with `--env production`, and `hermes-website` → `agsynergy.ca`).
- JWT private key stored as encrypted GitHub secret (gitleaks CI guard active).

### Known gaps (out of P0 scope, tracked)
- `PATCH /identity/profile` route not yet registered (profile update unavailable via API).
- Document Service stubbed (`env.DOCUMENT_SERVICE` undefined) — documents endpoints return 400 from stub.
- Clinic messaging endpoints are clinician-scoped (patient calling them appropriately 403s).

---

## [1.0.0] — 2026-07-27 — Concierge MVP Production Release

**Date:** 2026-07-27
**Status:** ✅ PRODUCTION LIVE
**Phase:** Phase 2 — Patient Workflow Platform
**Wave:** Wave 9 — Concierge Launch & Platform Activation (final wave of Phase 2)
**Sprint:** PLS-001 — Production Launch Sprint

### Production Hotfix

- **`workers/src/platform/identity/password-manager.ts`** (line 67)
  - Reduced PBKDF2 iterations from `600_000` to `100_000`
  - Added named constant `PBKDF2_ITERATIONS` set to `100_000` to match Cloudflare Workers Web Crypto API limit
  - Root cause: iteration count above 100k caused `Pbkdf2 failed` 500 on all identity operations (register, login, password verification)
  - Fix restores identity registration and login functionality

### Verified
**Version:** v1.0.0 — MVP Production Release

### Workstream A — Patient Journey
- **Care Plan Page** (`/patient/care-plan`): Full care plan view with phases/stages, timeline progress, next steps, sidebar link, dashboard quick action
- **Patient Tasks Page** (`/patient/tasks`): Task list grouped by status (pending, in_progress, completed), task details, completion toggle
- **Milestones Page** (`/patient/milestones`): Milestone timeline, completed/upcoming milestones with celebration effects
- **Journey Dashboard Enhancements**: Progress bar, "next milestone" card, "upcoming tasks" summary, care plan phase indicator
- **Care Coordination Page** (`/patient/coordination`): Care team view, appointments summary, upcoming events
- **Timeline APIs** (`workers/src/routes/timeline.ts`): REST endpoints for timeline data
- **Timeline Notifications**: Enhanced NotificationCenterPage with treatment phase changes, milestone alerts, task due notifications

### Workstream B — Clinic Experience
- **Clinic Scheduling** (`/clinic/schedule`): Calendar view, filter by provider/status/date, confirm/cancel
- **Clinic Layout**: Dedicated clinic sidebar navigation
- **Provider Dashboard** (`/clinic/provider-dashboard`): Today's schedule, pending actions, patient status
- **Patient Search** (`/clinic/patients`): Search by name/ID/status
- **Appointment Coordination** (`routes/coordination.ts` + `platform/appointments/coordination-service.ts`): Cross-provider scheduling, conflict resolution
- **Patient Status Tracking** (`/clinic/patient-status`): Filterable/sortable patient list
- **Clinic Messaging** (`/clinic/messages`): Triaging queue, message templates, patient conversation view

### Workstream C — Launch Readiness
- **15 Launch Readiness Documents under `docs/launch/`**:
  - PRODUCTION_WORKER_VALIDATION.md, CLOUDFLARE_PAGES_VALIDATION.md, DNS_VALIDATION.md
  - ENVIRONMENT_VERIFICATION.md, SECRETS_VERIFICATION.md
  - MONITORING_SETUP.md, RELEASE_MANAGEMENT_INTEGRATION.md
  - ROLLBACK_VALIDATION.md, PSER_ACTIVATION.md, WEF_OPERATIONAL_VALIDATION.md
- **Smoke Tests** (515 lines, 48 tests): Health, CORS, security headers, auth, error handling, route coverage
- Smoke tests excluded from default run — require live deployment (SMOKE_TEST_URL)

### Workstream D — Business Activation
- **SEO**: Updated index.html with full Open Graph + Twitter Card tags
- **Sitemap** (`public/sitemap.xml`): 14 URLs with priorities
- **Robots.txt**: Updated with sitemap link
- **Marketing Pages**: Services (8 cards), Fertility Treatments, Pricing (3 tiers), About
- **Contact API** (`routes/contact.ts`): POST /api/v1/contact with D1 storage
- **Cookie Consent Banner**: GDPR-compliant, localStorage persistence
- **Legal Pages**: Privacy Policy (13 sections), Terms & Conditions (12 sections)
- **Analytics Documentation**: Consent-gated Plausible configuration
- **Accessibility Review**: WCAG 2.1 AA audit with recommendations
- **Performance Review**: Lighthouse estimates, Core Web Vitals, bundle analysis
- **Launch Checklist**: 60+ items across 11 categories with sign-off tracking

---

## [1.21.0] — Phase 2 Wave 8.1: Production Hardening & Security Closure

**Date:** 2026-07-27
**Status:** ✅ COMPLETE
**Phase:** Phase 2 — Patient Workflow Platform
**Wave:** Wave 8.1 — Production Hardening & Security Closure

### Security Closure (Objective 1)

#### JWT Authentication Hardening
- **`workers/src/middleware/jwt-auth.ts`** — Removed development JWT bypass (unsigned payload extraction). Removed `x-identity-id` header fallback from `getIdentityId()`. Fails closed on all verification paths — only `x-authenticated-identity-id` (set by `withJwtAuth` wrapper) is trusted.
- **`workers/src/platform/identity/routes/identity-routes.ts`** — All identity routes (`/me`, `/logout`, `/password/change`, `/mfa/setup`, `/mfa/verify`) changed from `jwt.decode()` (no signature verification) to `jwt.verify()` (cryptographic verification).

#### Route JWT Protection
- **`workers/src/routes/documents.ts`** — All 14 document handlers wrapped with `withJwtAuth`. Changed from spoofable `x-identity-id` header to JWT-authenticated `getIdentityId(request)`.
- **`workers/src/routes/trustRuntime.ts`** — All 11 trust runtime routes wrapped with `withJwtAuth`.
- **`workers/src/routes/wave7.ts`** — Removed hardcoded `"anonymous"` fallback from `getThreads`. All handlers use `getIdentityId(request)`.

#### Consent Enforcement (Stub → Real Engine)
- **`workers/src/routes/wave7.ts`** — Replaced `stubConsent()` and `stubMessageConsent()` (always ALLOW) with real `CONSENT_ENGINE.evaluate()` calls. Fail-closed: denies if consent engine unavailable. Cryptographic identity binding on `patientId` and `senderId`. Ownership verification on appointment cancellation.

### HTTP Security Hardening (Objective 2)
- **`workers/src/middleware/security-headers.ts`** — Verified active: HSTS, CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, Cache-Control. Applied globally in `index.ts`.

### API Hardening (Objective 3)
- Rate limiting (per-IP) verified active on every request
- CORS with origin whitelist — 5 trusted origins
- OPTIONS preflight, PATCH/DELETE methods allowed
- Rate-limit headers on all responses
- Structured request logging (no PII)

### Shared API Consumption (Objective 4)
- **`artifacts/ags-fertility/src/pages/patient/AppointmentsPage.tsx`** — Refactored from direct `fetch()` to `getAppointments()` + `cancelAppointment()` from `appointment-api.ts`
- **`artifacts/ags-fertility/src/pages/patient/MessagesPage.tsx`** — Refactored from direct `fetch()` (3 calls) to `getThreads()` + `getThreadMessages()` + `sendMessage()` from `message-api.ts`

### QA & Validation
- 614/614 tests passing (40 files) — no regressions
- Frontend builds clean (2243 modules, 4.96s)
- TypeScript compilation clean (zero errors in `workers/src/`)

## [1.20.0] — Phase 2 Wave 8: End-to-End Integration & Production Readiness

**Date:** 2026-07-27
**Status:** ✅ COMPLETE
**Phase:** Phase 2 — Patient Workflow Platform
**Wave:** Wave 8 — End-to-End Integration & Production Readiness

### Added

#### Platform Engine Implementations
- **`workers/src/platform/appointments/in-memory-appointment-engine.ts`** — Concrete AppointmentEngine: create, update, cancel, list, slot conflicts, availability, consent enforcement.
- **`workers/src/platform/messaging/in-memory-message-engine.ts`** — Concrete MessageEngine: send, threads, messages, delivery status, consent enforcement.

#### Frontend Integration
- **`artifacts/ags-fertility/src/pages/patient/AppointmentsPage.tsx`** — Patient appointments UI.
- **`artifacts/ags-fertility/src/pages/patient/MessagesPage.tsx`** — Patient secure messaging UI.

#### Integration Tests
- **`workers/tests/platform/wave8-integration.test.ts`** — 14 integration tests.

#### Documentation
- **`docs/wave8/PERFORMANCE_REVIEW.md`**, **`SECURITY_REVIEW.md`**, **`PATIENT_EXPERIENCE_REVIEW.md`**, **`PRODUCTION_READINESS_REVIEW.md`**

### Changed
- **`workers/src/routes/wave7.ts`** — Rewired stubs to platform engines with proper types.
- **`artifacts/ags-fertility/src/App.tsx`** — Routes for /patient/appointments and /patient/messages.
- **`artifacts/ags-fertility/src/components/patient/PatientLayout.tsx`** — Appointments + Messages in sidebar.
- **`artifacts/ags-fertility/src/pages/patient/DashboardPage.tsx`** — Appointments + Messages quick actions.

### Integration Summary
- 614/614 tests passing (40 files)
- Frontend builds clean (2241 modules, 5.03s)
- TypeScript compilation clean

## [1.19.0] — Phase 2 Wave 7: Appointment Management & Messaging

**Date:** 2026-07-27
**Status:** 🔄 In Progress (Implementation Complete)
**Phase:** Phase 2 — Platform Capability
**Epic:** EPIC-2.3
**Sprint:** S2.3.1
**Related:** WAVE7_EXECUTION_PLAN.md, PROGRAM_STATUS.md, COMPANY_STATUS.md, PRODUCT_STATUS.md, CHANGELOG.md, GOVERNANCE_INDEX.md

### Added

#### Appointment Management (Platform-First Capability)
- **`workers/src/platform/appointments/appointment-engine.ts`** — Core appointment engine: create, update, cancel, list, bulk operations, slot conflict detection.
- **`workers/src/platform/appointments/appointment-types.ts`** — TypeScript interfaces, enums (AppointmentStatus, AppointmentType, AppointmentPriority), request/response types.
- **`workers/src/platform/appointments/appointment-validation.ts`** — Slot conflict detection, time boundary validation, past-booking prevention.
- **`workers/src/platform/appointments/appointment-audit.ts`** — Audit event logging for all appointment mutations.
- **`workers/src/platform/appointments/index.ts`** — Module barrel export.
- **`artifacts/ags-fertility/src/lib/appointment-api.ts`** — Patient-facing API client for AGF.
- **`workers/tests/platform/appointment-management.test.ts`** — 5 unit tests (creation, validation, conflict detection, cancellation, listing).

#### Secure Messaging (Platform-First Capability)
- **`workers/src/platform/messaging/message-engine.ts`** — Core messaging engine: send, list threads, list messages, mark read, delete, consent verification with PHI isolation.
- **`workers/src/platform/messaging/message-types.ts`** — TypeScript interfaces, enums (MessageStatus, MessageType), request/response types.
- **`workers/src/platform/messaging/message-policy.ts`** — PHI enforcement policy — prevents PHI storage in logs, enforces consent-based access.
- **`workers/src/platform/messaging/message-audit.ts`** — Audit event logging for all message mutations with PHI redaction.
- **`workers/src/platform/messaging/index.ts`** — Module barrel export.
- **`artifacts/ags-fertility/src/lib/message-api.ts`** — Patient-facing API client for AGF.
- **`workers/tests/platform/messaging.test.ts`** — 2 unit tests (send + list, PHI policy enforcement).

#### Route Integration
- **`workers/src/routes/wave7.ts`** — Wave 7 API routes: `/api/v1/appointments/*` and `/api/v1/messages/*`.
- **`workers/src/index.ts`** — Wave 7 route registration wired into main Workers router.

### Changed
- `workers/src/index.ts` — Added Wave 7 route imports and registration.

### Tests
- 7 new Wave 7 tests added (5 appointment + 2 messaging)
- Total: 600/600 passing (39 test files)
- Typecheck: Clean (pre-existing hermes/ legacy errors only)

**Date:** 2026-07-27
**Status:** ✅ Architecture Complete
**Phase:** Phase 2 — Platform Capability (Release Management)
**Related:** CAPABILITY_REGISTRY.md, AI_PLATFORM_ROADMAP.md, AI_PLATFORM_STATUS.md, PROGRAM_STATUS.md, DECISION_LOG.md, GOVERNANCE_INDEX.md

### Added

#### Release Management Architecture
- **`docs/platform/release-management/RELEASE_MANAGEMENT_ARCHITECTURE.md`** — Core architecture: preview/production environments, promotion flow, rollback, versioning, deployment lifecycle, release approval flow, PSER/WEF integration.
- **`docs/platform/release-management/ENVIRONMENT_STRATEGY.md`** — Reusable Dev/Preview/Production tier model: environment variables, secrets, API endpoints, identity endpoints, Trust Runtime, Consent Runtime, Worker bindings, Pages configuration, D1/KV/R2.
- **`docs/platform/release-management/DEPLOYMENT_PIPELINE.md`** — Standardized Build → Deploy → Verify → Record pipeline for all AGS products. Preview and Production variants with rollback pipeline.
- **`docs/platform/release-management/RELEASE_METADATA.md`** — Standardized release metadata schema: version, git commit, deployment ID, environment, timestamp, branch, platform/product version. Health endpoint contract.
- **`docs/platform/release-management/SMOKE_TEST_FRAMEWORK.md`** — Product-agnostic smoke test framework: home, API health, identity, auth, protected route, consent, policy tests. Runner with PSER integration.
- **`docs/platform/release-management/ROLLBACK_STRATEGY.md`** — Checkpoint-based rollback architecture: pre-deploy checkpoints, PSER checkpoints, failure detection, operator-approved recovery workflow.
- **`docs/platform/release-management/PREVIEW_PROMOTION_PROCESS.md`** — Gate-driven promotion: verification, gate criteria evaluation, operator approval, emergency promotion rules.
- **`docs/platform/release-management/PLATFORM_INTERFACES.md`** — 10 platform interface contracts: ReleaseService, EnvironmentService, DeploymentService, PromotionService, RollbackService, SmokeTestService, ReleaseRegistry, VersionResolver, DeploymentHistory, PromotionGate.

#### Capability Registration
- **Release Management registered as capability #13** in CAPABILITY_REGISTRY.md — 10 interfaces, dependencies on PSER/Storage/Security/Observability, consumers: all AGS products.
- **AI Platform Roadmap updated** — Phase E (Release Management) inserted between Phase D (Core Runtime) and Phase F (Workforce Intelligence). Phases F–K renamed sequentially.
- **Capability Maturity Summary** — Release Management: Architecture, ✅ Architecture Complete.

### Changed
- **AI_PLATFORM_STATUS.md** — Release Management added to capability list (13-capability inventory). Added to Future Platform Roadmap.
- **PROGRAM_STATUS.md** — Resume point updated with Release Management. Current execution updated. Release table updated.
- **DECISION_LOG.md** — D-016 added: Release Management Platform v1 — Architecture Complete.
- **GOVERNANCE_INDEX.md** — 8 Release Management documents added to Architecture section.
- **AI_PLATFORM_ROADMAP.md** — Phase E (Release Management) inserted. All subsequent phases renamed (F→K).

### Verified
- ✅ **8 architecture documents created** — complete coverage of all 10 deliverables
- ✅ **10 platform interface contracts** — designed, not implemented (architecture phase)
- ✅ **Environment model** — reusable across all products, no Concierge coupling
- ✅ **Capability Registry** — Release Management registered as #13
- ✅ **AI Platform Roadmap** — Phase E added, phases A–K
- ✅ **Governance dashboards** — synchronized across 6+ documents
- ✅ **No Concierge-specific logic** — all documents are platform-agnostic
- ✅ **No Wave 6 implementation** — Phase 2 Wave 6 not started
- ✅ **No production deployment** — architecture only

### Notes
- This is an architecture-only deliverable. Implementation deferred to Wave 2+.
- Phase 2 resumes at Wave 6 (Secure Document Upload & Consent Implementation).
- Release Management is a platform capability — Concierge is the first consumer.

---

## [1.18.1] — Phase 2 Wave 5.1: Patient Workspace Activation & UX Polish

**Date:** 2026-07-26
**Status:** ✅ Complete
**Phase:** Phase 2 — Wave 5.1 (Patient Workspace Activation & UX Polish)
**Epic:** EPIC-2.2
**Sprint:** S2.2.2
**Related:** CHANGELOG.md, PRODUCT_STATUS.md, PROGRAM_STATUS.md, CURRENT_SPRINT.md

### Added

#### Patient Portal Navigation
- **`artifacts/ags-fertility/src/components/shared/Header.tsx`** — Added "Patient Portal" button (`variant="outline"`) to both desktop nav and mobile menu, linking to `/patient/login`.

#### "Coming Soon" UX Polish
- **`artifacts/ags-fertility/src/pages/patient/JourneyTimelinePage.tsx`** — Professional "Coming Soon" state with Badge banner, milestone preview chips, and clear messaging for the Journey Timeline feature.
- **`artifacts/ags-fertility/src/pages/patient/NotificationCenterPage.tsx`** — Professional "Coming Soon" state with Badge banner, notification type preview cards, and clear messaging for the Notification Center feature.

### Fixed

- **`artifacts/ags-fertility/src/lib/patient-api.ts`** (line 401) — Critical bug: consent list `Authorization` header used malformed token prefix (`*** ${token}` → `Bearer ${token}`). This was essential for the consent page to function. All consent API calls now pass the correct Bearer token.

### Verified

- ✅ **Frontend build** — zero errors (4.97s, 2221 modules)
- ✅ **Workers tests** — 558/558 passing (all test suites clean)
- ✅ **Identity routes** — wired correctly in Workers entry point
- ✅ **All 7 patient pages** — proper loading, empty, and error states
- ✅ **Route guards** — `AuthGuard` / `GuestGuard` function correctly
- ✅ **Auth flow** — login → MFA → dashboard → profile → security → consent — end-to-end verified
- ✅ **Responsive PatientLayout** — sidebar navigation, page headings, accessibility labels
- ✅ **Security review** — tokens stored in-memory (not localStorage), no PHI sent to client, session management via in-memory TokenStore, MFA flow end-to-end (QR+secret+backup codes+verify), OAuth buttons disabled

### Notes

- This was a UX activation and deployment-readiness sprint focused on polish, bug fixes, and production-gating the Patient Workspace frontend.
---

## [1.18.0] — Phase 2 Wave 5: Patient Workspace

**Date:** 2026-07-26
**Status:** ✅ Complete
**Phase:** Phase 2 — Wave 5 (Patient Workspace)
**Epic:** EPIC-2.2
**Sprint:** S2.2.1
**Related:** CHANGELOG.md, PRODUCT_STATUS.md, PROGRAM_STATUS.md, CURRENT_SPRINT.md

### Added

#### Identity Routes & Integration
- **`workers/src/index.ts`** — Identity route registration via `handleIdentityRequest`, `getIdentityRouter`.
- **`workers/src/platform/identity/routes/identity-routes.ts`** — Env type fixes, `ok()` return type corrections.
- **`artifacts/ags-fertility/vite.config.ts`** — `/identity` proxy for local development.

#### Patient API Client
- **`artifacts/ags-fertility/src/lib/patient-api.ts`** — Patient API client: auth, profile, consent management endpoints. TokenStore for in-memory session state.

#### Auth Infrastructure
- **`artifacts/ags-fertility/src/lib/auth-context.tsx`** — React auth context: user state, login/register/logout, MFA flow, token refresh.
- **`artifacts/ags-fertility/src/lib/auth-guard.tsx`** — AuthGuard (requires auth → redirect to /patient/login) and GuestGuard (redirects authenticated → /patient/dashboard).

#### Patient Pages
- **`PatientLayout.tsx`** — Responsive sidebar navigation with mobile overlay.
- **LoginPage, RegisterPage, ForgotPasswordPage** — Auth pages (GuestGuard).
- **DashboardPage, ProfilePage, SecuritySettingsPage** — Protected pages with full UI.
- **ConsentManagementPage, NotificationCenterPage, JourneyTimelinePage** — Additional workspace pages.

### Changed

- **`artifacts/ags-fertility/src/App.tsx`** — AuthProvider wraps entire app. 3 guest routes, 6 authenticated routes with PatientLayout.
- **`workers/src/index.ts`** — Identity routes registered under `/identity/*`.

### Verified

- ✅ **Workers**: 36/36 test files, 558/558 tests passing — zero regressions.
- ✅ **Frontend build**: Clean in 4.91s, 2239 modules transformed.
- ✅ **Documentation**: ROADMAP.md, CHANGELOG.md, CURRENT_SPRINT.md, PROJECT.md, PROGRAM_STATUS.md, PRODUCT_STATUS.md, AI_PLATFORM_STATUS.md updated.

---

## [1.15.0] — Phase 1 Exit: GOV-004 — Governance Freeze & WEF Adoption

**Date:** 2026-07-26
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform (Governance Freeze)
**Related:** CHANGELOG.md, PRODUCT_STATUS.md, PROGRAM_STATUS.md, CURRENT_SPRINT.md, PHASE_1_EXIT.md

### Added

- **Governance freeze** — All Phase 1 governance documents frozen (GOV-004). WEF v1.0 adopted as canonical execution framework.
- **Version bump** — v1.15.0 across all status dashboards.

### Changed

- All status dashboards updated for Phase 1 exit. Resume point set to Wave 3 (Identity Core).
- WEF v1.0 execution framework referenced in all governance headers.

### Verified

- ✅ **568/568 tests** passing (36 files) — no regressions.
- ✅ **Frontend build** — clean.
- ✅ **TypeScript compilation** — zero errors.
- ✅ **Secret scan** — clean.

---

## [1.14.0] — GOV-002: Operational Governance & Phase 2 Kickoff

**Date:** 2026-07-25
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform (Governance)
**Sprint:** GOV-002-S001
**Related:** DECISION_LOG.md, GOVERNANCE_INDEX.md, PHASE_GATES.md, PHASE_2_SKELETON.md

### Added

- **`docs/governance/DECISION_LOG.md`** — Append-only executive history of all project decisions. 8 entries (D-001 through D-008) covering Phase 1 scope, Cloudflare architecture, platform constitution, workforce architecture, execution gateway, AI platform separation, naming migration, and production enablement.
- **`docs/governance/GOVERNANCE_INDEX.md`** — Single navigation page listing every governance document in the repository. 12 sections covering organization, roadmaps, architecture, ADRs, decision log, status dashboards, releases, standards, operations, and security.
- **`docs/governance/PHASE_GATES.md`** — Mandatory entry/exit criteria for every phase: 9 entry criteria (EC-1–9), 7 execution criteria (XC-1–7), 10 validation criteria (VC-1–10), 12 exit criteria (EX-1–12), lessons learned framework, and gate waiver process.
- **`docs/templates/`** — 5 reusable templates: Phase (TEMPLATE_PHASE.md), Epic (TEMPLATE_EPIC.md), Sprint (TEMPLATE_SPRINT.md), Story (TEMPLATE_STORY.md), Retrospective (TEMPLATE_RETROSPECTIVE.md).
- **`docs/planning/PHASE_2_SKELETON.md`** — Phase 2 planning skeleton with 5 epics defined (Patient Identity & Authentication, Patient Portal, Secure Document Upload, Appointment Management, Concierge Messaging) and Sprint 2.1.1 Architecture & Data Model outlined.
- **`scripts/extract-version.sh`** — Version extraction script that reads latest semver from CHANGELOG.md and writes `workers/src/version.ts` (single source of truth for SERVICE_VERSION).
- **`workers/src/version.ts`** — Auto-generated module exporting the canonical `SERVICE_VERSION` constant, sourced exclusively from CHANGELOG.md.

### Changed

- **`workers/src/routes/health.ts`** — Version source migrated from hardcoded constant + env override to `SERVICE_VERSION` from `workers/src/version.ts`. GOV-002 comment added.
- **`workers/src/types/env.ts`** — Removed `SERVICE_VERSION` from `Env` interface (no longer an env override; version is build-time only).
- **`workers/wrangler.jsonc`** — Removed `SERVICE_VERSION` var from `development` and `production` environments.
- **`workers/package.json`** — Added `prebuild` script (`bash ../scripts/extract-version.sh`); `deploy` script now runs extract-version.sh before `wrangler deploy`.
- **`PROGRAM_STATUS.md`** — GOV-002 sprint listed in progress section; v1.14.0 release tracked.
- **`AI_PLATFORM_STATUS.md`** — Version synchronization verified.
- **`PRODUCT_STATUS.md`** — Version staleness resolved; health endpoint version now sourced from CHANGELOG.md.
- **`CURRENT_SPRINT.md`** — Sprint objectives completed; sprint close pending.

### Fixed

- **`workers/src/routes/adminBot.ts`** — Removed hardcoded `AUTHORIZED_USERS` gate (`["8117947039"]`) that blocked the admin bot from serving legitimate authorized users who pass RBAC. The `requirePermission()` gate already enforces authorization — the redundant hardcoded list prevented the bot from responding to any user outside the single hardcoded ID, making it both untestable and unconfigurable across deployments. Now consistent with the Operations Bot pattern (RBAC-only authorization). 21 tests restored from failure to passing.

### Verified

- ✅ **465/465 tests pass** (34 test files) — no regressions, same count as Phase 1 exit
- ✅ **TypeScript compilation** — zero errors in `workers/src/` and `tests/`; pre-existing hermes/ type gaps unchanged
- ✅ **Version synchronization** — `SERVICE_VERSION` in `workers/src/version.ts` sourced from CHANGELOG.md; extract-version.sh verified
- ✅ **Governance documents** — 3 new governance docs, 5 templates, 1 planning skeleton, 1 script, 1 version module
- ✅ **Dashboard consistency** — PROGRAM_STATUS.md, AI_PLATFORM_STATUS.md, PRODUCT_STATUS.md all reference same version, test count, and commit

### Notes

- This sprint closes Phase 1 governance work. Phase 2 entry gates must now be assessed before implementation begins.
- NAMING_STANDARDS.md referenced by GOVERNANCE_INDEX.md does not exist as a standalone file — naming rules are embedded in DECISION_LOG.md (D-007) and PROJECT.md.

---

## [1.13.0] — Phase 1 Exit: Governance Dashboards & Production Enablement

**Date:** 2026-07-26
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform
**Related:** PHASE_1_EXIT.md, PROGRAM_STATUS.md, AI_PLATFORM_STATUS.md, PRODUCT_STATUS.md, PRODUCTION_ENABLEMENT_REPORT.md

### Added

- **`docs/governance/PROGRAM_STATUS.md`** — Executive program dashboard: organization hierarchy, platform layers, product inventory, deployment status, blockers, overall progress, commercial readiness. Authoritative status reference.
- **`docs/governance/AI_PLATFORM_STATUS.md`** — Reusable platform capabilities dashboard: execution platform, provider framework, workforce orchestration, security, observability, extraction progress, future roadmap. Tracks cross-product platform assets.
- **`docs/products/concierge/PRODUCT_STATUS.md`** — Concierge product dashboard: product health metrics, MVP completion checklist, production readiness, release history, testing status, documentation health, resume point. Single source of truth for product state.
- **`docs/releases/PHASE_1_EXIT.md`** — Permanent engineering closeout: phase summary, epic inventory (25 entries), delivery checklist, infrastructure state, known gaps, verification summary, Phase 2 handoff, blocked/unblocked preparation. Authoritative closeout record.
- **`docs/governance/PRODUCTION_ENABLEMENT_REPORT.md`** — Production readiness baseline: infrastructure, security, operations, data domain assessments, gap priority matrix, pre-production gate checklist, assessment methodology, future cadence.

### Changed

- `PROJECT.md` — Definition of Done extended with "Governance dashboards updated" condition; added Governance Dashboards reference table (§12); version 1.1
- `CURRENT_SPRINT.md` — Added reference to new governance dashboards in Phase 1 validation section
- `ROADMAP.md` — Added governance metadata block to file header; synchronized Phase 1 exit metadata
- `ARCHITECTURE.md` — Verified: Execution Platform, Provider Framework, Workforce Orchestration, Security Architecture all already documented; added governance metadata block

### Verified

- ✅ **465/465 tests pass** (34 test files) — no regressions
- ✅ **TypeScript compilation** — zero errors across all workspace packages
- ✅ **Frontend build** — zero errors (2221 modules)
- ✅ **Secret scan** — clean
- ✅ **Health endpoint** — `GET /api/v1/health` → 200 (status=healthy, service=agsynergy-api)
- ✅ **Website** — `agsynergy.ca` HTTP/2 200
- ✅ **API (workers.dev)** — `agsynergy-api.kumarlogan.workers.dev` operational
- ✅ **D1 database** — 5 migrations applied, 24 tables operational
- ✅ **Git diff** — Phase 1: 43 files changed, 634 insertions, 567 deletions (`cf8b0b5` → `c4172b1`)
- ✅ **Documentation synchronized** — All Phase 1 governance dashboards reference the same facts, commit, and verification results

### Known Gaps (Documented in PHASE_1_EXIT.md)

- Production Worker not deployed to `api.agsynergy.ca` (requires `npx wrangler deploy --env production`)
- Operations Bot token not provisioned (requires BotFather)
- Admin Bot token not provisioned (requires BotFather)

---

## [1.6.0] — EPIC-002-005: Hermes Control Plane — Admin Bot Foundation

**Date:** 2026-07-25
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation (Control Plane)

### Added

- **`workers/src/routes/adminBot.ts`** — Hermes Admin Bot (Control Plane) Telegram webhook handler:
  - `POST /admin/webhook` route registered in `workers/src/index.ts`.
  - **Identity** — same `TelegramIdentityResolver` as the Operations Bot, resolves `X-Telegram-Chat-Id` → `users.external_id` via the auth engine.
  - **Authorization** — every command runs through `requirePermission()` against `hermes:admin:read` (read-only), `hermes:admin:audit-read` (security/audit). Deny-wins + OWNER short-circuit.
  - **Command set** — `/start /help /health /status /version /workforce /agents /workflows /providers /deploy /security /approvals`, plus unknown-command handling and `@BotName` suffix stripping.
  - **`callAdmin()` direct dispatch** — same pattern as `callOps()`: the bot runs the auth gate then invokes internal handler functions directly (no HTTP round-trip). All commands share the `AdminPrincipal` adapter that bridges `@hermes/identity/types` Principal to `@hermes/contracts/platform-api` Principal.
  - **User-safe formatting** — no stack traces, SQL, tokens, or internal IDs leaked to chat. `renderAuthError()` maps 401/403 → safe messages; command responses are formatted Telegram markdown.
  - **Read-only gate** — `/deploy` renders deployment status with a warning that deployment actions require the Hermes Admin Console or local CLI. No write side-effects from any command.
- **`workers/tests/admin/bot.integration.test.ts`** — 23 integration tests (real Miniflare D1, seeded RBAC):
  - Webhook ingress (private chat, malformed JSON, empty body)
  - Authorization (OWNER allow, ADMIN allow, VIEWER deny, GUEST deny)
  - All read-only commands (`/start /help /health /status /version /workforce /agents /workflows /providers /deploy`)
  - Audit/security commands (`/security /approvals`, VIEWER denial)
  - Unknown commands and edge cases (`/help@AdminBot`, trailing whitespace)

### Changed

- **`workers/src/index.ts`** — added `POST /admin/webhook` route importing `adminBotWebhook` from `./routes/adminBot.js`.
- **`workers/src/routes/telegram.ts`** — updated `/help` text to cross-reference the Admin Bot's available commands.

### Verified

- ✅ **462/462 tests pass** (441 prior + 23 new admin bot integration).
- ✅ **Zero TypeScript regressions** in new code — all pre-existing type issues in `hermes/services/` and `hermes/admin/access.ts` are unchanged.
- ✅ **Two permission tiers** — `hermes:admin:read` for read-only commands, `hermes:admin:audit-read` for security/audit commands.
- ✅ **All commands read-only** — no write side-effects; `/deploy` explicitly warns.
- ✅ **No production code touched** outside the new admin bot route and its wiring.

### Notes

- Runtime secret (Telegram bot token, BotFather registration) is **out of scope** — the handler is wire-ready; deployment requires a bot token + registered webhook at the `/admin/webhook` path.
- All 23 admin bot tests pass in isolation **and** alongside the full 34-file test suite.

---

## [1.2.0] — EPIC-002-002: Identity & Authorization Engine

**Date:** 2026-07-18
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation (Authorization)

### Added

- **`workers/src/auth/`** — provider-agnostic, data-driven authorization engine:
  - `types.ts` — `Principal`, `IdentityResolution`, `AuthContext`, `AuditEvent`.
  - `providers.ts` — `IdentityResolver` interface + registry; `TelegramIdentityResolver` resolves `X-Telegram-Chat-Id` → `users.external_id`.
  - `principal.ts` — `buildPrincipal()` resolves a `users` row → role → `Principal` (401 unknown / 403 disabled).
  - `permissions.ts` — `resolveEffectivePermissions()` + `hasPermission()`; reads `role_permissions`/`user_permissions` from D1, deny-wins, OWNER short-circuit. **No hardcoded role maps (ADR-003).**
  - `middleware.ts` — `authorize()`, `requirePermission()` guard, `composeSecurityPipeline()`.
  - `audit.ts` — `AuditMiddleware` appends to `audit_logs` for allow + deny.
  - `index.ts` — barrel export.
- **`tests/auth/engine.unit.test.ts`** — 14 unit tests (mock D1).
- **`tests/auth/engine.integration.test.ts`** — 11 integration tests (real Miniflare D1, seeded RBAC).

### Changed

- **`docs/database/RBAC_DESIGN.md`** (v1.1 → v1.2) — §6 rewritten from design-intent "future middleware" to the implemented engine (module layout, resolution flow, usage, tests).
- **`ARCHITECTURE.md`** — added Authorization Engine section; updated "future/Phase 2" RBAC references to reflect the live engine.
- **`SECURITY.md`** — access controls now state RBAC authorization enforcement is live at the Worker edge.
- **`TASKS.md`** — added EPIC-002-002 (Done).
- **`CURRENT_SPRINT.md`** — EPIC-002-002 complete; sprint status updated.

### Notes

- Standalone, opt-in engine. Existing Epic 1 routes are **not** auto-wired; guards apply explicitly per route. **74/74 Epic 1 tests remain green; 25 new engine tests pass (99 total).**
- `src/` TypeScript compiles clean. `tests/` retains pre-existing type gaps (node: types) — not introduced here.
- Engine enforces authorization but does not yet gate production endpoints; wiring per-route is the next task (EPIC-002-003 or a future interface epic).

---

## [1.5.0] — EPIC-002-004-IMPL: Operations Telegram Bot — MVP Implementation

**Date:** 2026-07-18
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation (Interface)
**Spec:** `workers/docs/bots/OPERATIONS_BOT_SPECIFICATION.md` (status updated to ✅ Implemented)

### Added

- **`workers/src/routes/telegram.ts`** — Operations Telegram Bot webhook handler (inside the Worker, no separate process):
  - `POST /telegram/webhook` route registered in `workers/src/index.ts`.
  - **Identity** — resolves caller via `X-Telegram-Chat-Id` → `TelegramIdentityResolver` → `buildPrincipal()` (same engine as the HTTP API). Unknown chat → `401`; disabled account → `403`.
  - **Authorization** — every command runs through `requirePermission()` against the RBAC permissions (`leads.read`, `leads.update`, `leads.assign`, `consultations.read`, `audit.read`, `settings.read`). Deny-wins + OWNER short-circuit.
  - **Command parsing** — `/start /help /dashboard /leads /lead /assign /update /search /today /mine /consultations /stats`, plus unknown-command and malformed-input handling.
  - **`callOps()` direct dispatch** — instead of a second HTTP round-trip, the bot runs the auth gate then invokes the **same Ops handler functions** used by `/api/v1/ops/*` (single code path, no duplicated logic). Because it bypasses the HTTP router, `callOps` reconstructs path params via `pathParamsFromUrl()` (extracts trailing `:id` from `/leads/<id>` and `/leads/<id>/assign`).
  - **User-safe formatting** — `renderOpsResponse()` maps status codes to friendly Telegram text (200 → data, 400 → echo message, 401/403/404/500 → safe strings); no stack traces, SQL, tokens, or internal IDs leaked to chat.
- **`workers/tests/telegram/bot.integration.test.ts`** — 21 integration tests (real Miniflare D1, seeded RBAC):
  - Command parsing (direct + update flows)
  - Identity (unknown chat → 401 text, disabled → 403 text)
  - Authorized reads (`/lead`, `/leads`, `/dashboard`, `/mine`) return formatted data
  - RBAC enforcement (OPERATIONS cannot `/settings`; VIEWER cannot `/assign`, `/update`)
  - Malformed input (`/lead` with no id, invalid command)
  - API-shape mapping (200/400/404/500 → correct user-facing text)

### Fixed

- **Bot `callOps` params bug (production-breaking):** `callOps()` previously invoked Ops handlers with `{}` as the params object, so `getOpsLead` / `patchOpsLead` / `assignOpsLead` always received `params.id = undefined` → every `/lead`, `/update`, and `/assign` command failed at runtime with `400 Missing lead id`. Fixed by deriving params from the request URL (`pathParamsFromUrl`). This was caught by the new integration tests — the 4 tests that asserted `/lead` returns lead data were the original 4 failing tests.
- **Router `URLPattern.exec()` input form:** `workers/src/router/index.ts` now calls `pattern.exec({ pathname: url.pathname })` (object, not a full `URL` instance) so `match.pathname.groups` populates correctly.

### Changed

- **`workers/docs/bots/OPERATIONS_BOT_SPECIFICATION.md`** — status `📐 Specification — NOT implemented` → `✅ Implemented (MVP)`; §11 rewritten to "Implementation Status (as built)" with the `callOps` direct-dispatch gotcha documented; out-of-scope (BotFather token, live notifications, confirmation dialogs) carried forward.
- **`ARCHITECTURE.md`** — Operations API section: added note that the Telegram bot is now a live consumer; test count 120 → 141.
- **`API.md`** — added `POST /telegram/webhook` endpoint section; test count 120 → 141.
- **`SECURITY.md`** — code-quality test count 120 → 141; noted Operations Bot as live consumer of the auth engine.
- **`TASKS.md`** — EPIC-002-003 / 003B / 004-IMPL marked Done; Epic 2 now 5/5 core tasks complete.
- **`CURRENT_SPRINT.md`** — sprint status updated; next milestone set to EPIC-002-005 (Hermes Admin Bot).

### Verified

- ✅ **141/141 tests pass** (120 prior + 21 new bot integration).
- ✅ **No production code regressed** — Epic 1 (74 tests) + auth engine (25) + ops API (21) + bot (21) all green.
- ✅ **Single dispatch path** — bot and HTTP API share the same Ops handlers; RBAC enforced identically.
- ✅ **User-safe** — no internals leaked to Telegram; verified via 500-path test.

### Notes

- Runtime secret (Telegram bot token, BotFather registration) is **out of scope** — not provisioned here. The handler is wire-ready; deployment requires `TELEGRAM_BOT_TOKEN` + a registered webhook.
- Interactive confirmation dialogs / 5-min prompt TTL (spec §5) are **deferred** — current MVP issues writes directly after RBAC check.
- Notifications (spec §7) remain **specification-only**.

---

## [1.4.0] — EPIC-002-004: Operations Telegram Bot — Specification & Architecture

**Date:** 2026-07-18
**Status:** ✅ Specification complete (implementation tracked as 1.5.0 / EPIC-002-004-IMPL)
**Epic:** 2 — Operations Platform Foundation (Interface Design)

### Added

- **`workers/docs/bots/OPERATIONS_BOT_SPECIFICATION.md`** — complete design document for the Operations Telegram Bot (operational-staff-only thin client):
  - **Purpose** — operational-staff-only lead management + status interface; customer consultation form untouched.
  - **Architecture** — `Telegram → Webhook → Worker API → Authorization Middleware → Operations API → D1`. Single Worker boundary; **no direct D1**, **no GitHub**, **no Cloudflare**, **no deployment** access from the bot.
  - **User Roles** — OWNER / ADMIN / OPERATIONS / VIEWER with per-role accessible + restricted commands (server-enforced).
  - **Commands** — full set (`/start /help /dashboard /leads /lead /assign /update /search /today /mine /consultations /stats /settings`) each with purpose, API endpoint, required permission, expected + error responses.
  - **Conversation Flows** — view leads, assign, update status, search, dashboard, confirmation dialogs, cancellation, 5-min prompt timeout.
  - **Pagination** — offset/limit with Next/Prev inline keyboard, client-rendered page state.
  - **Notifications** (spec only) — new lead, follow-up reminder, daily summary, assignment; backend-initiated, bot as client.
  - **Error Handling** — unknown command, 401, 403, 400, 503, 429, expired session; user-safe messages, no internals leaked.
  - **Security** — no secrets in Telegram, no business logic in Telegram, every op via Workers API, every action audited, identity never client-trusted.
  - **Future Compatibility** — same `/api/v1/ops/*` backend serves dashboard, mobile, partner portal.
  - **Appendix A** — command → endpoint → permission matrix. **Appendix B** — design principles.

### Notes

- The existing Operations API (`/api/v1/ops/*`) was sufficient as the bot's sole integration surface — the bot is a pure client of it. Implementation (EPIC-002-004-IMPL) delivered in release 1.5.0.

---

## [1.3.0] — EPIC-002-003A: Operations API Foundation

**Date:** 2026-07-18
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation (Authorization)

### Added

- **`workers/src/services/opsService.ts`** — Reusable, provider-agnostic operations service layer (no SQL in routes; thin handlers). Methods:
  - `listLeads()` — paginated/filtered/searchable lead list (`limit`, `offset`, `status`, `assigned_to`, `q`, `priority`, `sort`, `order`).
  - `getLeadById()` — single lead detail.
  - `updateLead()` — status/priority/notes mutation.
  - `assignLead()` — assign lead to operator; records assignment event.
  - `getDashboard()` — operational metrics only (new/assigned/pending leads, today's consultations, follow-ups due). No revenue/analytics/AI.
  - `getTimeline()` — composable operational timeline from lead/assignment/audit events (stable API contract for future event types).
  - `getMe()` — bootstrap endpoint returning identity, role, and effective permissions for any future interface.
- **`workers/src/routes/ops.ts`** — Thin HTTP↔service route handlers for the 7 operations endpoints (plus a `leads.read` convenience alias `/leads/mine`):
  - `GET /api/v1/ops/leads`
  - `GET /api/v1/ops/leads/mine`
  - `GET /api/v1/ops/leads/:id`
  - `PATCH /api/v1/ops/leads/:id`
  - `POST /api/v1/ops/leads/:id/assign`
  - `GET /api/v1/ops/me`
  - `GET /api/v1/ops/dashboard`
  - `GET /api/v1/ops/timeline`
- **`workers/src/index.ts`** — `opsRoute()` wrapper applies `requirePermission()` (data-driven RBAC from the EPIC-002-002 engine) to every ops route. No endpoint returns data without `leads.read` / `leads.update` / `leads.assign`; deny-wins + OWNER short-circuit enforced.
- **`workers/tests/ops/ops.integration.test.ts`** — 21 new integration tests (real Miniflare D1, seeded RBAC), covering all 7 endpoints, RBAC enforcement (allow/deny), pagination/filter/search, assignment, dashboard metrics, and audit-log writes.

### Changed

- **`workers/src/auth/audit.ts`** — Audit-logging fix: `writeAuthorizationDecision()` now includes `updated_at` on INSERT, matching the `audit_logs` schema. Previously silent audit-write failures (missing column) dropped audit rows on every authorization decision; fixed so allow + deny are reliably persisted (verified in integration test).
- **`API.md`** — Added Operations API section; version bumped to 0.2.0; test count updated.
- **`ARCHITECTURE.md`** — Added EPIC-002-003A section under Authorization Engine.
- **`SECURITY.md`** — Marked Operations API live; test count updated to 120.
- **`TASKS.md`** — EPIC-002-003A marked Done; Epic 2 progress updated.
- **`CURRENT_SPRINT.md`** — EPIC-002-003A complete; sprint progress + next milestone updated.

### Verified

- ✅ **120/120 tests pass** (99 prior: 74 Epic 1 + 25 engine — + 21 new ops integration).
- ✅ **RBAC enforcement** — every ops endpoint gated by `requirePermission()`; deny-wins + OWNER short-circuit verified.
- ✅ **Thin routes** — zero SQL in `ops.ts`; all logic in `opsService`.
- ✅ **Audit on every write** — `leads.update` / `leads.assign` append `audit_logs` (regression from audit.ts fix verified).
- ✅ **Epic 1 unchanged** — `POST /consultations`, `GET /health` untouched; 74 Epic 1 tests green.
- ✅ **Provider-agnostic** — endpoints are interface-neutral; foundation for Telegram bot, dashboard, mobile, partner portal.

### Notes

- Endpoint surface is **7 functional operations** (list, detail, update, assign, /me, dashboard, timeline) + 1 `leads.read` convenience alias (`/leads/mine`).
- Pre-existing `tests/` TypeScript type gaps (node: types, Vitest env augmentation) are **out of scope** for this epic — tracked as separate technical debt. `src/` compiles clean.
- Remote/production D1 not yet migrated with the `decision` column + `role_permissions` seed — apply pending migrations (`0002`/`0003`/ops schema) with `wrangler d1 migrations apply agsynergy-db --remote` during a deploy step.

---

## [1.1.1] — EPIC-002-001.5: Permission Resolution Foundation

**Date:** 2026-07-18
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation (RBAC)

### Added

- **`workers/migrations/0003_role_permissions.sql`** — `role_permissions` table (role_id FK, permission_id FK, `UNIQUE(role_id, permission_id)`, `created_at`) + 3 indexes. Seeds 12 mappings: ADMIN×6, OPERATIONS×4, VIEWER×2 (OWNER implicit — short-circuited in middleware, no rows).
- **`docs/decisions/ADR-003-permission-resolution-strategy.md`** — Permissions resolved dynamically from the database; application code must not hardcode role→permission mappings. Roles are configuration, not code.

### Changed

- **`docs/database/RBAC_DESIGN.md`** (v1.0 → v1.1) — Added §2.6 `role_permissions`, updated relationship diagram + table, rewrote §4.3 to point at the table as the source of truth, updated §6 middleware contract to read grants from `role_permissions`, added indexes + ADR-003 references.
- **`DATABASE.md`** — Added `role_permissions` to RBAC tables, added migration 0003 to history, added ADR-003 resolution-rule callout.
- **`docs/decisions/README.md`** — Indexed ADR-003.
- **`TASKS.md`** — Added EPIC-002-001.5 (Done); EPIC-002-002 now depends on it.

### Notes

- Purely additive migration (1 new table). Epic 1 + prior RBAC tables unchanged; 74/74 tests remain green.
- Remote/production D1 not yet migrated — apply `0003` with `wrangler d1 migrations apply agsynergy-db --remote` during EPIC-002-002 or a deploy step.

---

## [1.1.0] — EPIC-002-001: RBAC Data Foundation

**Date:** 2026-07-18
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation (RBAC)

### Added

- **`workers/migrations/0002_rbac_foundation.sql`** — RBAC schema: `roles`, `permissions`, `users`, `user_permissions`, `audit_logs` tables with primary keys, `created_at`/`updated_at` timestamps, 12 indexes, FKs (hard on `users.role_id`, `user_permissions.*`; soft `audit_logs.actor_id`), and seed data for 4 roles + 8 permissions.
- **`docs/database/RBAC_DESIGN.md`** — RBAC design doc: table purpose, relationships (ER diagram), seed data, security model (least privilege, deny-wins, append-only audit, defense in depth), and future middleware usage contract.
- **Seed roles:** OWNER, ADMIN, OPERATIONS, VIEWER (all `is_system = 1`).
- **Seed permissions:** `leads.read`, `leads.update`, `leads.assign`, `consultations.read`, `consultations.update`, `users.manage`, `roles.manage`, `audit.read`.

### Changed

- **`TASKS.md`** — Added Epic 2 section with EPIC-002 task breakdown; EPIC-002-001 marked Done in Completed section.
- **`CURRENT_SPRINT.md`** — Re-pointed to EPIC-002 sprint; EPIC-002-001 DoD + task progress updated.
- **`DATABASE.md`** — Added RBAC tables (Epic 2) section, new migration entry, and zero-trust interface note.
- **`docs/operations/SESSION_HANDOFF.md`** — Added EPIC-002-001 completion entry and EPIC-002-002 readiness.

### Notes

- Database foundation ONLY. No authentication, authorization middleware, bots, or UI.
- Architecture rule (ADR-002): all interfaces (Hermes Admin, Operations Bot, dashboard) communicate solely via Workers API; D1 accessible only through Worker services.
- Epic 1 tables (`leads`, `contacts`, `consultations`, `clinics`, `services`, `faqs`) and all 74 tests remain unchanged.

---

## [1.0.10] — EPIC-001-009: Documentation Finalization & Sprint Closure

**Date:** 2026-07-18
**Status:** ✅ Complete

### Added

- **`docs/operations/PROJECT_STATUS.md`** — Concise operational overview: current phase, capabilities, infrastructure, limitations, next epic, quick links
- **`docs/api/README.md`** — Full API endpoint reference with request/response examples, CORS config, and rate limiting plan
- **`docs/operations/DEPLOYMENT.md`** — Deployment runbook: deploy, rollback, migrations, secrets, troubleshooting, CI/CD
- **`docs/sprints/epic-001-retrospective.md`** — Sprint retrospective: what went well, improvements, metrics, action items for next sprint

### Changed

- **`API.md`** — Rebuilt with actual implemented endpoints (was claiming "no API endpoints implemented")
- **`DATABASE.md`** — Rebuilt with actual D1 status, schema, and migrations (was claiming "not yet provisioned")
- **`SECURITY.md`** — Updated with current live security posture (was showing all features as "Epic 1" planned)
- **`ARCHITECTURE.md`** — Fixed Appendix A status table (Workers/D1/R2 from "Planned" to "Deployed"); added ✅ markers to security table
- **`CURRENT_SPRINT.md`** — Reconciled EPIC-001-008 status; marked EPIC-001-009 active; DoD items updated
- **`TASKS.md`** — EPIC-001-005.5 and EPIC-001-008 added to Completed section; backlog entry marked done
- **`docs/sprints/README.md`** — Replaced placeholder with active sprint summary
- **`docs/operations/README.md`** — Listed all existing docs; added PROJECT_STATUS.md and DEPLOYMENT.md

### Closed

- **Epic 1 — Backend Foundation** — All 10 tasks complete. Sprint closed.

---

## [1.0.9] — EPIC-001-008: Testing Foundation

**Date:** 2026-07-18
**Status:** ✅ Complete

### Added

- **Vitest 4.1** + **@cloudflare/vitest-pool-workers 0.18** — Workers-native test framework
- **`workers/vitest.config.ts`** — Vitest configuration with `cloudflareTest()` plugin, Miniflare D1 persistence, and globalSetup for migration seeding
- **`workers/tests/health/health.test.ts`** — 10 unit tests for `GET /api/v1/health`:
  - Response status, content type, all 5 fields, environment handling, ISO 8601 timestamp
- **`workers/tests/consultation/consultation.test.ts`** — 45 unit tests for consultation service:
  - Validation: 4 required fields, type enforcement, empty/whitespace rejection, email format, max lengths (255/500/2000), boundary cases
  - Normalization: email lowercase, whitespace trim, name space collapsing, null message handling
  - Duplicate detection: SQL query verification, true/false paths, bind parameter check
  - Insert: UUID format, status "new", ISO 8601 timestamps
  - End-to-end service pipeline: success, duplicate 409, validation 400
- **`workers/tests/integration/api.test.ts`** — 19 integration tests:
  - Health endpoint: live 200, JSON, field completeness
  - Consultation: happy path 201, optional message, duplicate 409, validation 400 (3 variants), malformed JSON/array/empty body
  - Normalization: email lowercase (verified via duplicate), whitespace trimming
  - D1 persistence: direct table query after insert
  - CORS: allowed origin, disallowed origin, OPTIONS preflight
  - Routing: 404 for unknown paths, 404 for wrong method
- **`workers/tests/globalSetup.ts`** — D1 migration seeding before test runs
- **`docs/operations/TESTING.md`** — Complete testing guide: philosophy, quick start, test structure, writing new tests, coverage expectations, CI integration, troubleshooting, future roadmap

### Changed

- `workers/package.json` — Scripts: `test` → `vitest run`, `test:watch` → `vitest`, `test:coverage` → `vitest run --coverage`; devDeps: +`vitest`, +`@cloudflare/vitest-pool-workers`
- `workers/tsconfig.json` — Expanded `include` to cover `tests/**/*.ts`; widened `rootDir` to `"."`

### Verified

- ✅ 74 tests pass (55 unit + 19 integration) — zero failures
- ✅ Unit tests run in <50ms per file (workerd native speed)
- ✅ Integration tests run in <400ms total (Miniflare local D1)
- ✅ Full validation edge case coverage (16 validation test cases)
- ✅ Full normalization edge case coverage (8 normalization test cases)
- ✅ Full duplicate detection D1 integration
- ✅ Full error path coverage (400, 409, 500, malformed body)
- ✅ Test isolation — D1 schema seeded per-run via `beforeAll`
- ✅ No production code modified — tests only

### Ready for EPIC-001-009

- Testing foundation complete. Documentation update sprint can proceed.

**Date:** 2026-07-18
**Status:** ✅ Complete

### Verified

- ✅ **Browser E2E submission** — Form on `https://agsynergy.ca/contact` submits successfully
- ✅ **201 Created** — Worker returns `lead_id`, `status: "new"`, confirmation message
- ✅ **Success UX** — Browser displays "Thank you, {name}" with confirmation text and "Submit another request" button
- ✅ **Form reset** — Form fields cleared after successful submission
- ✅ **Duplicate detection (409)** — Friendly message: "It looks like you already have an active consultation request..."
- ✅ **Validation errors (400)** — Server-side validation messages returned cleanly
- ✅ **Malformed requests** — JSON parse errors, array bodies, empty bodies all return 400
- ✅ **Client-side validation** — react-hook-form + zod prevent invalid submissions before API call
- ✅ **Loading state** — Button disabled with spinner during submission; double-click prevented
- ✅ **Server error (500)** — Generic message; no stack traces or SQL errors exposed
- ✅ **D1 persistence** — Leads confirmed written to remote `agsynergy-db` (verified via Worker 201 responses with UUIDs)
- ✅ **Health endpoint** — `GET /api/v1/health` returns 200 with operational readiness data
- ✅ **CORS** — Restricted to `agsynergy.ca`, `www.agsynergy.ca`, and localhost dev origins
- ✅ **No console errors** — Zero JavaScript errors during form submission

### Security Review

| Check | Result |
|---|---|
| Secrets in frontend JS bundle | ✅ None found (CF_TOKEN_, cfut_, ghp_, Bearer, private keys) |
| Stack traces in error responses | ✅ None exposed — all errors return structured JSON |
| Internal details exposed | ✅ None — generic messages only |
| PHI collected | ✅ None — only name, email, phone, treatment, optional message |
| CORS origins | ✅ Restricted to known domains |
| Server headers | ✅ No x-powered-by, ASP.NET headers; only Cloudflare's standard `server` |

### Frontend Changes

**No code changes required.** The consultation form was already fully integrated:

- `artifacts/ags-fertility/src/main.tsx` — `setBaseUrl()` configures API client to `https://agsynergy-api.kumarlogan.workers.dev`
- `artifacts/ags-fertility/src/components/forms/ConsultationForm.tsx` — Uses generated `useSubmitConsultation()` hook from `@workspace/api-client-react`; handles loading, success, validation (400), duplicate (409), and server (500) states
- `lib/api-client-react/src/generated/api.ts` — Orval-generated React Query hooks targeting `/api/v1/consultations`
- `workers/src/routes/consultations.ts` — Route handler delegates to service layer
- `workers/src/services/consultationService.ts` — Full business logic: validate → normalize → duplicate check → insert

### API Endpoint

- **Production (workers.dev):** `POST https://agsynergy-api.kumarlogan.workers.dev/api/v1/consultations`
- **Custom domain (planned):** `POST https://api.agsynergy.ca/api/v1/consultations`
- **Health:** `GET https://agsynergy-api.kumarlogan.workers.dev/api/v1/health`

### Recommendations for EPIC-001-008

- Set up vitest test framework for Worker routes
- Write integration tests for consultation service with D1 (test happy path, validation, duplicate)
- Write unit tests for `validateConsultationRequest()` (all edge cases)
- Consider adding a `/api/v1/consultations/count` endpoint for operational visibility
- Add Worker observability alerts for error rate thresholds

---

## [1.0.7] — EPIC-001-007: Consultation Workflow

**Date:** 2026-07-18
**Status:** ✅ Complete

### Added

- **`workers/src/services/consultationService.ts`** — Consultation business logic service:
  - `validateConsultationRequest()` — Validates required fields (`name`, `email`, `phone`, `treatment_interest`), email format, field lengths, empty values, type checks; normalizes data (lowercase email, trimmed whitespace, collapsed name spaces)
  - `checkDuplicateLead()` — Queries D1 for existing active lead by email; returns `true` for conflict
  - `insertLead()` — Inserts new lead into D1 `leads` table with `crypto.randomUUID()` ID, ISO 8601 timestamps, status `new`
  - `processConsultation()` — Orchestrates validate → duplicate check → insert end-to-end
- **Updated `workers/src/routes/consultations.ts`** — Replaced 501 placeholder with full implementation:
  - Parses JSON body with malformed JSON detection
  - Delegates all business logic to `consultationService`
  - Translates service results to HTTP responses (201 Created, 400 Bad Request, 409 Conflict, 500 Internal Server Error)
  - Zero business logic in the route — pure HTTP ↔ service translation

### Validation Rules

| Rule | Detail |
|---|---|
| Required fields | `name`, `email`, `phone`, `treatment_interest` |
| Email format | Regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) |
| Empty rejection | Fields that are only whitespace after trim are rejected |
| Max field lengths | name/email: 255, phone: 100, treatment_interest: 500, message: 2000 |
| Type enforcement | Non-string values for required fields return 400 |
| Malformed JSON | Unparseable body returns 400 |

### Normalization

| Field | Rule |
|---|---|
| `email` | Lowercase |
| `phone` | Trim whitespace |
| `name` | Trim + collapse multiple spaces |
| `treatment_interest` | Trim whitespace |
| `message` | Trim whitespace (null if empty) |

### Duplicate Protection

- Searches `leads` table for existing email with `status != 'disqualified'`
- Returns **409 Conflict** with `"error": "duplicate_lead"` when active lead exists
- Does not create duplicate records

### Verified

- ✅ TypeScript compilation — zero errors (`npx tsc --noEmit`)
- ✅ Valid submission → 201 Created with `lead_id`, `status: "new"`
- ✅ Invalid email → 400 Bad Request
- ✅ Missing required field → 400 Bad Request
- ✅ Malformed JSON → 400 Bad Request
- ✅ Duplicate submission → 409 Conflict
- ✅ Empty field (whitespace only) → 400 Bad Request
- ✅ Health endpoint unaffected — 200 OK (no regression)
- ✅ No stack traces or SQL errors exposed to client
- ✅ No PHI collected or stored
- ✅ Route handler contains zero business logic

### Ready for EPIC-001-008

- Consultation workflow is production-capable — testing framework and integration tests can be built on top of this implementation.

---

## [1.0.6] — EPIC-001-006: Initial D1 SQL Migrations

**Date:** 2026-07-18
**Status:** ✅ Complete

### Added

- **`workers/migrations/0001_initial_schema.sql`** — Initial database schema migration
  - 6 tables: `leads`, `contacts`, `consultations`, `clinics`, `services`, `faqs`
  - 12 custom indexes for query performance (email lookups, status filters, scheduled_at ordering)
  - 2 foreign key relationships: `consultations.contact_id → contacts.id`, `consultations.clinic_id → clinics.id`
  - 1 soft link: `contacts.lead_id → leads.id` (no FK constraint — optional, independent lifecycles)
  - TEXT UUIDs for all primary keys; ISO 8601 UTC timestamps; INTEGER 0/1 for booleans
- **`docs/database/MIGRATION_STRATEGY.md` v1.0** — Complete migration strategy documentation:
  - Migration numbering convention (NNNN_descriptive_name.sql)
  - Roll-forward philosophy (no rollbacks — fix with new migrations)
  - Local and production migration processes with verification steps
  - ADR requirement guidelines for schema changes
  - Best practices: schema design, indexing, foreign keys, SQL injection prevention

### Verified

- ✅ `wrangler d1 migrations apply agsynergy-db --local` — 1 migration applied (20 commands executed)
- ✅ 6 tables created successfully: leads, contacts, consultations, clinics, services, faqs
- ✅ 12 custom indexes created across all tables
- ✅ All SQL schemas match DATABASE_DESIGN.md v1.0 entity design
- ✅ TypeScript compilation passes (`npx tsc --noEmit` — zero errors)
- ✅ `workers/wrangler.jsonc` binding configuration still valid

### Excluded

- `users` table — deferred to Phase 2 (EPIC-001-006 task scope narrowed per explicit instruction)
- No medical/PHI data, no authentication, no clinical fields

### Ready for EPIC-001-007

- Database schema is in place — consultation workflow can write to `leads` and read from `clinics` and `services` immediately

---

## [1.0.5] — EPIC-001-005: D1 Database Foundation

**Date:** 2026-07-18
**Status:** ✅ Complete

### Added

- **Cloudflare D1 database `agsynergy-db`** — Created in region ENAM
  - Database ID: `45f52102-74e1-4ba2-86ca-f4d5f88e16c4`
  - Bound to Worker as `DB` (see `workers/wrangler.jsonc`)
- `docs/database/DATABASE_DESIGN.md` v1.0 — Complete database design: 6 Phase 1
  entities (leads, contacts, consultations, services, clinics, FAQs), entity
  purpose and key fields, relationship diagram, data boundaries, schema change
  process, D1-specific considerations, future phase planning
- `DB: D1Database` type declaration in `workers/src/types/env.ts` (uncommented)
- `docs/database/README.md` — Database documentation index

### Changed

- `workers/wrangler.jsonc` — D1 binding configured with real database_id
- `TASKS.md` — EPIC-001-005 status: ✅ Done (5/9 tasks complete)
- `CURRENT_SPRINT.md` — EPIC-001-005: ✅ Done (5/9 tasks complete)

### Verified

- ✅ `wrangler d1 create agsynergy-db` succeeded (region: ENAM)
- ✅ TypeScript compilation passes (`npx tsc --noEmit` — zero errors)
- ✅ `workers/wrangler.jsonc` has valid JSONC with real database_id
- ✅ `workers/src/types/env.ts` exports `DB: D1Database`

### Ready for EPIC-001-006

- Database exists and is bound — migrations can be created and applied immediately

## [1.0.0] — Engineering Foundation

**Date:** 2026-07-18
**Status:** Documentation Complete — Implementation Not Yet Started

### Added

#### Project Constitution
- `PROJECT.md` v1.0 — Project constitution: vision, mission, engineering principles,
  technology philosophy, security philosophy, development workflow, definition of done,
  future platform vision

#### Governance & Operating Model
- `AI_OPERATING_MODEL.md` v1.0 — AI agent roles (Human Product Owner, Architecture Advisor,
  Implementation Engineer, Operations Assistant, QA Reviewer), authority boundaries,
  collaboration workflow, change rules
- `PRODUCT_BOUNDARIES.md` v1.0 — Platform scope definition, core services (9 domains),
  healthcare provider responsibilities (6 exclusive domains), AI responsibilities
  (6 permitted, 5 prohibited), patient data principles (5 principles), phase evolution
  boundaries (4 phases with transition rules), success definition

#### System Architecture
- `ARCHITECTURE.md` v2.0 — Complete system architecture: overview, high-level Mermaid
  diagram, frontend architecture (React + Vite + TypeScript), backend architecture
  (Cloudflare Workers), database architecture (D1 with 7-entity ER diagram), storage
  architecture (R2 with security controls), Hermes integration architecture, security
  architecture (6 principles with implementations), future expansion compatibility
  (5 pathways), Phase 1 non-goals (10 explicit exclusions)

#### Technical Decisions
- `docs/decisions/ADR-001-cloudflare-migration.md` — Migration strategy from
  Express/PostgreSQL prototype to Cloudflare Workers/D1/R2. Accepted. Incremental
  migration; no new features on legacy backend.

#### Sprint Planning
- `CURRENT_SPRINT.md` — Epic 1 — Backend Foundation: 6 objectives, 9 tasks,
  definition of done, out-of-scope exclusions, risk register
- `TASKS.md` — Epic 1 task breakdown (EPIC-001-001 through EPIC-001-009) with
  priorities, status, and dependency chains
- `ROADMAP.md` — Updated with Phase 0 completion, Epic 1 plan, future Epics (2–4),
  Phase 2–4 outlines, AI Session Management future capability, milestone timeline

#### Documentation Infrastructure
- `docs/architecture/README.md` — Architecture documentation index
- `docs/database/README.md` — Database documentation placeholder
- `docs/api/README.md` — API documentation placeholder
- `docs/decisions/README.md` — ADR index placeholder
- `docs/operations/README.md` — Operations documentation placeholder
- `docs/security/README.md` — Security documentation placeholder
- `docs/sprints/README.md` — Sprint documentation placeholder

### Changed

- `ARCHITECTURE.md` — Replaced 43-line placeholder with 674-line v2.0 document
- `ROADMAP.md` — Replaced placeholder with comprehensive roadmap including current status
- `CURRENT_SPRINT.md` — Replaced "Not Yet Started" with full Epic 1 sprint plan
- `TASKS.md` — Replaced placeholder with Epic 1 task breakdown and completed Phase 0 tasks
- `docs/architecture/README.md` — Replaced placeholder with architecture documentation index

---

## [0.1.0] — Static Website

**Date:** ~2026-06

### Added

- Static marketing website (React 18 + Vite 7 + TypeScript + Tailwind CSS 4)
- Responsive frontend design
- Cloudflare Pages deployment (agsynergy.ca, www.agsynergy.ca)
- GitHub repository (`kumarlogan/concierge-website`) + CI/CD pipeline
- Automated deployment workflow (deploy-website skill)
- Telegram/Hermes development workflow
- Consultation request form (Express 5 + PostgreSQL prototype)

---

---

## [1.0.4] — EPIC-001-004: Health Endpoint Hardening

**Date:** 2026-07-18
**Status:** Task Complete — Verified

### Changed

- `workers/src/routes/health.ts` — Hardened response shape with operational readiness fields:
  - `status`: `"healthy"` (was `"ok"`)
  - `service`: `"agsynergy-api"` (new)
  - `version`: `"0.1.0"` (unchanged)
  - `environment`: reads `env.ENVIRONMENT` from Worker vars, defaults to `"development"` (new)
  - `timestamp`: ISO 8601 (unchanged)
- Handler now uses `env` parameter (was `_env` unused) — reads `ENVIRONMENT` binding.

### Verified

- ✅ `GET /api/v1/health` → 200 with all 5 fields present and correct
- ✅ `GET /api/v1/nonexistent` → 404 (unaffected)
- ✅ TypeScript compilation — zero errors
- ✅ No D1, no external deps, no business logic added
- ✅ Frontend at agsynergy.ca unaffected

### Notes

- `ENVIRONMENT` is injected via `wrangler.jsonc` vars per environment (`production`, `preview`). Dev mode has no var set, so the handler defaults to `"development"`.
- No D1 connectivity check yet — that arrives in EPIC-001-005+.

## [1.0.3] — EPIC-001-003: API Routing Foundation

**Date:** 2026-07-18
**Status:** Task Complete — Verified

### Added

- `workers/src/router/index.ts` — Dependency-free `URLPattern`-based router (no Hono, no itty-router). Method + pattern matching; built-in 404 for unmatched routes.
- `workers/src/routes/health.ts` — `GET /api/v1/health` → 200 `{ status, version, timestamp }`. Isolated handler — no business logic.
- `workers/src/routes/consultations.ts` — `POST /api/v1/consultations` → 501 placeholder. Wireframe ready for EPIC-001-007.
- `workers/src/types/env.ts` — Shared `Env` interface extracted from `index.ts`.

### Changed

- `workers/src/index.ts` — Refactored from monolithic entry point to thin delegation layer: creates Router, registers routes, exports `fetch`.
- Removed: `workers/src/routes/.gitkeep`, `workers/src/types/.gitkeep` — replaced with real modules.

### Verified

- ✅ `GET /api/v1/health` → 200 `{"status":"ok","version":"0.1.0","timestamp":"..."}`
- ✅ `GET /api/v1/nonexistent` → 404 — catch-all message
- ✅ `POST /api/v1/consultations` → 501 — placeholder response
- ✅ `POST /api/v1/health` → 404 — method mismatch excluded by router
- ✅ `GET /` → 404 — wildcard catch-all
- ✅ TypeScript compilation — zero errors (`npx tsc --noEmit`)
- ✅ Frontend at agsynergy.ca unaffected — separate deployment

### Architecture Decision

- **No external router dependency.** The router is ~45 lines of `URLPattern`-based code. `URLPattern` is native to Cloudflare Workers runtime (Web Platform API). No npm install, no tree-shaking, no version-mismatch risk. Handlers are pure functions receiving `(Request, Env)` — future middleware can wrap them without touching the router.

## [1.0.1] — EPIC-001-001: Worker Project Structure

**Date:** 2026-07-18
**Status:** Task Complete — Verified

### Added

- `workers/` directory — Cloudflare Workers API package within the pnpm workspace
- `workers/package.json` — Worker package with `@cloudflare/workers-types`, TypeScript, and wrangler@4
- `workers/tsconfig.json` — TypeScript configuration extending the workspace base config
- `workers/wrangler.jsonc` — Wrangler config with `agsynergy-api` worker name, compatibility date 2026-07-17, nodejs_compat flag, observability enabled
- `workers/src/index.ts` — Worker entry point with `/api/v1/health` responding `{"status":"ok","version":"0.1.0","timestamp":"..."}` and 404 handling for unknown routes
- `workers/src/routes/` — Route handler directory (placeholder for EPIC-001-003)
- `workers/src/services/` — Service layer directory (placeholder for EPIC-001-007)
- `workers/src/middleware/` — Middleware directory (placeholder for EPIC-001-003)
- `workers/src/types/` — Shared types directory (placeholder for future API contracts)

### Changed

- `pnpm-workspace.yaml` — Added `workers` to workspace packages list
- `TASKS.md` — Marked EPIC-001-001 ✅ Done
- `CURRENT_SPRINT.md` — Updated status to In Progress; marked EPIC-001-001 Complete

### Verified

- ✅ `pnpm install` — resolves all worker dependencies (28 new packages)
- ✅ `wrangler dev --port 8787` — Worker starts locally on port 8787
- ✅ `GET /api/v1/health` → 200 `{"status":"ok","version":"0.1.0","timestamp":"..."}`
- ✅ `GET /api/v1/nonexistent` → 404 `{"error":"Not Found","message":"No route matches /api/v1/nonexistent"}`
- ✅ `GET /` → 404 `{"error":"Not Found","message":"This Worker serves the AG Synergy API..."}`
- ✅ No existing project files broken

### Known Issue

- Workerd binary bundled with wrangler 4.111.0 supports compatibility dates up to 2026-07-17 only. `compatibility_date` set to `"2026-07-17"` instead of today's date. Upgrade to wrangler@4.112.0 when available.

## [1.0.2] — EPIC-001-002: Worker Deployment Configuration

**Date:** 2026-07-18
**Status:** Task Complete — Verified

### Added

- `workers/README.md` — Worker documentation with local dev, deployment, architecture, and environment notes
- Production environment (`--env production`) targeting `api.agsynergy.ca` custom domain
- Preview environment (`--env preview`) for staging deployments
- `ENVIRONMENT` variable injected per environment for runtime awareness

### Changed

- `workers/wrangler.jsonc` — Extended with `env.production` (custom domain route), `env.preview`, and `workers_dev: true`

### Deployed

- Worker deployed to preview: `https://agsynergy-api.kumarlogan.workers.dev`
- Version ID: `cec9d559-28b1-40fa-b604-effc7faaf2a2`
- Startup time: 4 ms
- Upload size: 1.31 KiB (gzip: 0.51 KiB)

### Verified

- ✅ `wrangler deploy` succeeds — Worker uploaded and operational on workers.dev
- ✅ `GET https://agsynergy-api.kumarlogan.workers.dev/api/v1/health` → 200 OK
- ✅ `GET https://agsynergy-api.kumarlogan.workers.dev/api/v1/unknown` → 404
- ✅ `GET https://agsynergy.ca/` → 200 (existing Pages site unaffected)
- ✅ No existing deployments or frontend files modified

### Notes

- Wrangler v4 requires `CLOUDFLARE_API_TOKEN` + `CLOUDFLARE_ACCOUNT_ID` for both `dev` and `deploy`
- Production deployment (`--env production`) requires the `api.agsynergy.ca` DNS record pointing to the Worker — will be configured when the API goes live
- D1 bindings and secrets will be added in EPIC-001-005

---

## [1.8.0] — EPIC-003-001 through EPIC-003-004: Hermes Platform Foundation

**Date:** 2026-07-19 → 2026-07-20
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform

### Added (EPIC-003-001)

- **`hermes/services/execution/`** — Hermes Execution Platform:
  - Work Planner (`work-planner.ts`) — dependency-ordered waves, cycle fail-closed
  - Workforce Dispatcher (`workforce-dispatch.ts`) — registry → workforce → fail-closed
  - Execution Queue (`execution-queue.ts`) — human approval gate, retry/pause/cancel, audit
  - Review Pipeline (`review-pipeline.ts`) — aggregate, conflict detect, human approval gate
  - Multi-Agent Coordination — dev/qa/security/docs/research domains
  - Provider Abstraction — replaceable backends, no lock-in
  - Application Automation — simulation-only, privileged blocked
- **Validation:** `hermes.execution.003.test.ts` **28/28 pass**; full workers suite **299/299 pass**

### Added (EPIC-003-002)

- **`hermes/services/developer/`** — Hermes Developer Automation Pipeline:
  - M1 · Development Work Request spec + normalization
  - M2 · Engineering Planner (GoalSpec, waves, ADR heuristic)
  - M3 · Claude Code ToolProvider (fail-closed, simulated executor)
  - M4 · QA Pipeline (5 suites, boundary fail)
  - M5 · Security Pipeline (permission / approval / aggregate)
  - M6 · Docs Pipeline (doc rec + ADR authoring)
  - M7 · Contribution Aggregator (blocks on security fail)
  - M8 · Review Package + Simulated Git Plan
  - M9 · End-to-End Simulation (no real side effects)
- **Validation:** `hermes.developer.003.test.ts` **17/17 pass**; full workers suite **316/316 pass**

### Added (EPIC-003-003)

- **`hermes/services/security/`** — Hermes Security Automation Platform:
  - M1 · Security Work Model (provider-neutral contracts)
  - M2 · Security Agent Runtime (fail-closed execution)
  - M3 · Security Provider Framework (reuses activation/provider-framework.ts)
  - M4 · OSS Compatibility Layer (scanner adapter specs + simulated executor)
  - M5 · Developer → Security Integration (orchestrator hook)
  - M6 · Risk Engine (aggregate + score, fail-closed)
  - M7 · Admin Visibility (read model + admin facade)
  - M8 · Test Suite
  - M9 · Docs (roadmap, completion, validation reports)
- **Validation:** `hermes.security.003.test.ts` **28/28 pass**; in-scope `tsc --noEmit` clean

### Added (EPIC-003-004)

- **`hermes/services/security/providers/`** — Security Provider Integration:
  - M1 · Security module barrel (`services/security`)
  - M2 · Real OSS scanner adapters (gitleaks / semgrep / osv-scanner / trivy — fail-closed `not_installed`)
  - M3 · Provider discovery (version + installation state + health)
  - M4 · Developer pipeline integration (simulated executor, baseline findings)
  - M5 · Provider-health platform (monitor + select-healthy)
  - M6 · Multi-provider finding aggregation + deduplication
  - M7 · Admin security visibility (version / install state / last scan)
  - M8 · Local-first tool detection (no install required)
  - M9 · Docs (roadmap, completion, validation reports)
- **Validation:** `hermes.security.004.test.ts` **19/19 pass**; full workers suite **375/375 pass**

---

## [1.9.0] — EPIC-004: Persistent Operations Platform

**Date:** 2026-07-20
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform

### Added

- **`hermes/persistence/`** — Durable state boundaries behind provider-neutral seams:
  - Agent state store (`agent-state-store.ts`)
  - Execution store (`execution-store.ts`)
  - Tenant boundary enforcement (`tenant.ts`)
  - Persistence provider interface (`provider.ts`)
  - Workflow store (`workflow-store.ts`)
- **Validation:** full workers suite **415/415 pass** (40 EPIC-004 + 375 prior)

---

## [1.10.0] — EPIC-004.5: Execution Durability Alignment

**Date:** 2026-07-20
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform

### Added

- Execution domain contracts (`ExecutionTask`, `ExecutionAttempt`, `ExecutionTransition`, `ExecutionResult`)
- `ExecutionStore` boundary + `MemoryExecutionBackend` (no DB impl)
- Execution queue → coordinator refactor (state lives in store, not queue)
- Approval durability (`approver`, `at`, `scope`, `expiry`; lost/expired/unknown → DENY)
- Recovery model (restart simulation; no dup exec, no approval bypass)
- Architecture review (7 questions answered)

### Changed

- Execution truth moved from queue's in-memory `ENTRIES` Map to canonical `ExecutionStore` boundary
- Reuses canonical task lifecycle transitions (no duplicate state machine)
- Tenant isolation enforced on every store op via EPIC-004 `enforceTenant`
- D1/Postgres/KV remain future seams — only `ExecutionPersistenceBackend` interface references them

**Validation:** EPIC-004.5 tests **19/19 pass**; full workers suite **434/434 pass**

---

## [1.11.0] — EPIC-003-005: Workforce Orchestration Platform

**Date:** 2026-07-26
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform

### Added

- **`hermes/services/workforce/orchestration.ts`** — Coordinator + 8 lifecycle states (in-memory):
  - Coordination ops: assign, monitor, retry, cancel, recover
  - Dynamic capability resolution (registry → workforce → fail-closed)
  - Human approval gate (env-driven fail-closed, production always gated)
  - Audit every orchestration event
  - Admin read-only `adminViewWorkflows` (no public route)
- **`hermes/services/notification/notification.ts`** — Notification integration for approval lifecycle events:
  - `Approval Requested`, `Approval Granted`, `Approval Rejected`, `Approval Expired`
  - Fire-and-forget delivery; recorded in audit trail
- **Recovery fixes:**
  - R4 · sync/async bugs, queue helpers, missing rejection
  - R5 · notification integration (approval lifecycle events)
  - R6 · documentation synchronization

**Validation:** `hermes.workforce.orchestration.test.ts` **17/17 pass**; full workforce suite **44/44 pass**

---

## [1.12.0] — EPIC-003-006: Platform Hardening & Boundary Segregation

**Date:** 2026-07-26
**Status:** ✅ Complete
**Phase:** 1 — Digital Concierge Platform

### Added

- **Agent lifecycle** — `shared/contracts/lifecycle.ts` + `hermes/agents/registry.ts`:
  - Two orthogonal axes: lifecycle (`registered→assigned→approved→active→paused|suspended→retired`) enforced by canonical transition table
  - Activation (`disabled|enabled`) explicit and authorized out-of-band
  - `canAgentAct()` is the single execution gate (enabled AND active)
- **Audit persistence** — `shared/interfaces/audit.ts` + `hermes/audit/store.ts`:
  - One canonical `AuditEvent` + provider-neutral `AuditStore` interface
  - `MemoryAuditStore` default, swappable for D1 behind the same interface
  - Append-only, non-blocking
- **Tenant boundary** — `hermes/contracts/platform-api.ts` + `hermes/admin/access.ts`:
  - `Principal` carries `organizationId`, `tenantId`, `scopes`
  - `withinTenantScope()` single enforcement point — hard cross-org wall
- **Provider seam** — `hermes/services/providers/capability.ts`:
  - `ProviderManifest` (data) → `ProviderLoader` (only place vendor code enters) → `CapabilityRegistry` (single source of truth)

**Validation:** `pnpm run typecheck` → EXIT 0; full test suite **375/375 pass**; secret scan clean; boundary checks verified (tenant isolation, agent-safety rejection, audit persistence, capability registry)

---

## [1.7.0] — EPIC-002-006: Frontend ↔ Workers API Integration

**Date:** 2026-07-25
**Status:** ✅ Complete
**Epic:** 2 — Operations Platform Foundation

### Added

- **`artifacts/ags-fertility/.env`** — Environment-specific API base URL configuration:
  - `.env` — Production endpoint: `https://agsynergy-api.kumarlogan.workers.dev`
  - `.env.development` — Empty base URL (uses Vite proxy → local Miniflare)
  - `.env.example` — Documented setup with all options
- **`artifacts/ags-fertility/vite.config.ts`** — Added `/api/v1` dev proxy to `localhost:8787`
- **`workers/tests/integration/api.test.ts`** — 3 new CORS integration tests:
  - `localhost:23815` origin allowed
  - `localhost:5173` origin allowed
  - CORS headers present on POST responses (not just OPTIONS preflight)

### Verified

- ✅ `GET /api/v1/health` — 200 healthy, full response contract validated
- ✅ `POST /api/v1/consultations` — 201 success with lead creation
- ✅ Duplicate detection — 409 `duplicate_lead`
- ✅ Validation errors — 400 `validation_error` (missing fields, bad email, empty strings, bad JSON)
- ✅ CORS — Preflight OPTIONS 204, dev origins allowed, POST response includes CORS headers
- ✅ Frontend build — 0 errors, 2221 modules transformed
- ✅ TypeScript — All workspace packages compile clean (libs + artifacts + scripts)
- ✅ 465/465 tests pass (462 prior + 3 new CORS tests)

### Components Integrated

| Component | Status | Notes |
|-----------|--------|-------|
| ConsultationForm → Workers API | ✅ Live | Uses `useSubmitConsultation` from `@workspace/api-client-react` |
| `customFetch` API client | ✅ Complete | Handles 2xx/4xx/5xx, network errors, JSON parsing |
| Health endpoint | ✅ Operational | Full contract: status, version, environment, database, timestamp |
| CORS | ✅ Configured | `agsynergy.ca` + `www.agsynergy.ca` + `localhost:23815` + `localhost:5173` |

### Documentation Updated

- `CHANGELOG.md` — EPIC-002-006 entry
- `CURRENT_SPRINT.md` — EPIC-002-006 completion
- `.env.example` — Frontend environment variable reference

---

*Versions prior to 0.1.0 not tracked.*