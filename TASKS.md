# Tasks

> Living task registry for the Concierge platform.
> All implementation work is tracked here. Tasks flow from Roadmap → Phase → Epic → Sprint → this registry.

## Legend

| Symbol | Meaning |
|---|---|
| 🔴 | Critical — blocks other work; sprint cannot complete without it |
| 🟠 | High — important for sprint goal; should complete in current sprint |
| 🟡 | Medium — valuable but not blocking; can slip to next sprint if needed |
| 🟢 | Low — nice to have; complete when time permits |
| ✅ | Done |
| 🚧 | In Progress |
| ⛔ | Blocked |
| ⬜ | Not Started |

---

## Phase 0: Platform Foundation

| Priority | Task | Status | Notes |
|---|---|---|---|
| 🟠 | Initialize project documentation structure | ✅ | Complete — all docs/ directories created |
| 🟠 | Create PROJECT.md (Project Constitution) | ✅ | Version 1.0 ratified 2026-07-18 |
| 🟠 | Create AI_OPERATING_MODEL.md | ✅ | Version 1.0 ratified 2026-07-18 |
| 🟠 | Create PRODUCT_BOUNDARIES.md | ✅ | Version 1.0 ratified 2026-07-18 |
| 🟠 | Create ARCHITECTURE.md (full) | ✅ | Version 2.0 ratified 2026-07-18 |
| 🟠 | Create ADR-001 (Cloudflare Migration) | ✅ | Accepted 2026-07-18 |
| 🟡 | Create developer onboarding guide | ⬜ | Deferred to Epic 1 |

---

## Epic 1: Backend Foundation

**Status:** ✅ Complete — 10/10 Tasks Complete
**Sprint:** EPIC-001 (completed 2026-07-18)
**Goal:** Working Cloudflare Workers API connected to D1, ready for first production workflow.

### EPIC-001 Task Breakdown

| Task ID | Description | Priority | Status | Dependencies |
|---|---|---|---|---|
| **EPIC-001-001** | **Create Cloudflare Worker project structure**<br>Initialise Workers project with TypeScript; set up directory layout; configure `wrangler.toml`; verify `wrangler dev` works locally. | 🔴 Critical | ✅ Done | None |
| **EPIC-001-002** | **Configure Worker deployment**<br>Set up production and preview environments in `wrangler.toml`; configure secrets (if any); verify `wrangler deploy` to preview; document deploy command. | 🔴 Critical | ✅ Done | EPIC-001-001 |
|| **EPIC-001-003** | **Create API routing foundation**<br>Modular `URLPattern`-based router; `/api/v1/health` → 200; consultations placeholder 501; unknown routes → 404; no external router dependency. | 🔴 Critical | ✅ Done | EPIC-001-001 |
|| **EPIC-001-004** | **Health endpoint hardening**<br>Hardened `/api/v1/health` response shape: `{ status, service, version, environment, timestamp }`. Reads `ENVIRONMENT` from Worker vars. No external deps, no D1. | 🟠 High | ✅ Done | EPIC-001-003 |
| **EPIC-001-005** | **Create D1 database**<br>Create D1 database via `wrangler d1 create`; bind database to Worker in `wrangler.toml`; verify connectivity from Worker dev environment. | 🔴 Critical | ✅ Done | EPIC-001-001 |
|| **EPIC-001-006** | **Create initial database migrations**<br>Write numbered SQL migration files for initial schema: `leads`, `contacts`, `consultations`, `clinics`, `services`, `faqs`; apply migrations via `wrangler d1 migrations apply`; verify schema in D1 dashboard. | 🔴 Critical | ✅ Done | EPIC-001-005 |
| **EPIC-001-007** | **Connect consultation workflow**<br>Implement `POST /api/v1/consultations`; validate request body; insert into D1 `leads` table; return success response; add integration test. | 🟠 High | ✅ Done | EPIC-001-003, EPIC-001-006 |
| **EPIC-001-005.5** | **Frontend Integration & E2E Verification**<br>Verify existing consultation form connects to deployed Worker API; test end-to-end submission (browser → Worker → D1 → success); verify error handling (400/409/500); security review; document results. | 🟠 High | ✅ Done | EPIC-001-007 |
| **EPIC-001-008** | **Add backend testing**<br>Set up test framework (vitest or similar); write unit tests for Worker routes and validation; write integration tests for D1 operations; add test script to `package.json`. | 🟡 Medium | ✅ Done | EPIC-001-004, EPIC-001-007 |
| **EPIC-001-009** | **Update documentation**<br>Create API documentation for implemented endpoints; update `docs/database/` with schema docs; create deployment runbook in `docs/operations/`; update `CHANGELOG.md`; record any new ADRs. | 🟡 Medium | ✅ Done | EPIC-001-002, EPIC-001-006, EPIC-001-007 |

---

## Epic 2: Operations Platform Foundation (RBAC)

**Status:** 🚧 In Progress — 5/5 Core Tasks Complete (EPIC-002-001, EPIC-002-001.5, EPIC-002-002, EPIC-002-003A, EPIC-002-004-IMPL Operations Bot MVP)
**Sprint:** EPIC-002 (started 2026-07-18)
**Goal:** Establish the security and authorization database foundation for multi-agent operations (Hermes Admin + Operations Bot).

### EPIC-002 Task Breakdown

| Task ID | Description | Priority | Status | Dependencies |
|---|---|---|---|---|
| **EPIC-002-001** | **RBAC Data Foundation**<br>Create `users`, `roles`, `permissions`, `user_permissions`, `audit_logs` tables + seed roles (OWNER/ADMIN/OPERATIONS/VIEWER) and 8 permissions; document in RBAC_DESIGN.md. Database foundation ONLY — no auth, no middleware, no bots. | 🔴 Critical | ✅ Done | EPIC-001-006 |
| **EPIC-002-001.5** | **Permission Resolution Foundation**<br>Move role→permission mappings into the DB as data: `role_permissions` table + seed mappings (ADMIN×6, OPERATIONS×4, VIEWER×2; OWNER implicit). Add ADR-003. Middleware resolves perms dynamically — no code constants. | 🔴 Critical | ✅ Done | EPIC-002-001 |
| **EPIC-002-002** | **Identity & Authorization Engine**<br>Provider-agnostic, data-driven enforcement at the Worker edge: `src/auth/` (types, providers, principal, permissions, middleware, audit). Resolves principal, computes effective permissions from `role_permissions` + `user_permissions` (deny-wins, OWNER short-circuit), gates via `authorize()`/`requirePermission()` guards, appends `audit_logs`. Ships `TelegramIdentityResolver` (header `X-Telegram-Chat-Id`). Opt-in — existing Epic 1 routes untouched. 25 new tests; 74 Epic 1 tests green. | 🔴 Critical | ✅ Done | EPIC-002-001.5 |
| **EPIC-002-003A** | **Operations API Foundation**<br>Reusable, RBAC-gated `/api/v1/ops/` backend layer (leads list/detail/update/assign, `/me`, `/dashboard`, operational timeline). Provider-agnostic — foundation for Telegram bot, dashboard, mobile, partner portal. No SQL in routes; thin handlers; service layer; audit on every write. | 🔴 Critical | ✅ Done | EPIC-002-002 |
| **EPIC-002-003** | **Telegram Operations Bot**<br>Lead management interface via Workers API only (consumes EPIC-002-003A endpoints). | 🟠 High | ✅ Done | EPIC-002-003A |
| **EPIC-002-003B** | **Telegram Operations Bot (client of Ops API)**<br>Telegram interface wired to `/api/v1/ops/` endpoints. | 🟠 High | ✅ Done | EPIC-002-003A |
| **EPIC-002-004** | **Operations Telegram Bot — Specification & Architecture**<br>Design-only deliverable: `docs/bots/OPERATIONS_BOT_SPECIFICATION.md` defining purpose, architecture (thin client / single Worker boundary), roles (OWNER/ADMIN/OPERATIONS/VIEWER), full command set, conversation flows, pagination, notifications (spec), error handling, security, future compatibility, out-of-scope. Implemented in 1.5.0. | 🟠 High | ✅ Done (spec + impl) | EPIC-002-003A |
| **EPIC-002-004-IMPL** | **Operations Telegram Bot — Implementation**<br>Build the webhook handler + client per the EPIC-002-004 specification. | 🟠 High | ✅ Done | EPIC-002-004 |
| **EPIC-002-005** | **Hermes Admin Bot**<br>Owner-only infrastructure/deploy control via Workers API only. | 🟡 Medium | ⬜ Not Started | EPIC-002-002 |

> Architecture rule (ADR-002): All interfaces communicate ONLY through the Workers API. D1 remains accessible solely through Worker services. AI agents never touch D1 directly.

---

## Backlog

*Tasks below are identified but not yet scheduled into a sprint.*

| Priority | Task | Notes |
|---|---|---|
|| 🟡 | ~~Migrate consultation form from Express to Workers~~ | ✅ Done in EPIC-001-005.5 |
| 🟡 | Create developer onboarding guide | Was Phase 0 task; deferred |
| 🟢 | Set up staging environment in Cloudflare | Separate preview Worker + preview D1 |
| 🟢 | Add CI/CD status badges to README | After CI pipeline is stable |

---

## Completed

| Task | Completed | Sprint |
|---|---|---|
| Project documentation structure (`/docs/`) | 2026-07-18 | Phase 0 |
| PROJECT.md v1.0 | 2026-07-18 | Phase 0 |
| AI_OPERATING_MODEL.md v1.0 | 2026-07-18 | Phase 0 |
| PRODUCT_BOUNDARIES.md v1.0 | 2026-07-18 | Phase 0 |
| ARCHITECTURE.md v2.0 | 2026-07-18 | Phase 0 |
| ADR-001 (Cloudflare Migration) | 2026-07-18 | Phase 0 |
| CURRENT_SPRINT.md (Epic 1 planning) | 2026-07-18 | Phase 0 |
| ROADMAP.md (Epic 1 + AI Session Mgmt) | 2026-07-18 | Phase 0 |
| TASKS.md (Epic 1 breakdown) | 2026-07-18 | Phase 0 |
| EPIC-001-001 — Worker project structure | 2026-07-18 | Epic 1 |
| EPIC-001-002 — Worker deployment configured | 2026-07-18 | Epic 1 |
| EPIC-001-003 — API routing foundation | 2026-07-18 | Epic 1 |
| EPIC-001-004 — Health endpoint hardening | 2026-07-18 | Epic 1 |
| EPIC-001-005 — D1 database creation | 2026-07-18 | Epic 1 |
| EPIC-001-006 — Initial D1 migrations | 2026-07-18 | Epic 1 |
|| EPIC-001-007 — Consultation workflow | 2026-07-18 | Epic 1 |
|| EPIC-001-005.5 — Frontend Integration & E2E Verification | 2026-07-18 | Epic 1 |
|| EPIC-001-008 — Testing Foundation (74 tests) | 2026-07-18 | Epic 1 |
|| EPIC-001-009 — Documentation Finalization | 2026-07-18 | Epic 1 |
| EPIC-002-001 — RBAC Data Foundation (5 tables, 4 roles, 8 perms) | 2026-07-18 | Epic 2 |
| EPIC-002-001.5 — Permission Resolution Foundation (role_permissions, ADR-003) | 2026-07-18 | Epic 2 |
| EPIC-002-002 — Identity & Authorization Engine (src/auth/, 25 tests) | 2026-07-18 | Epic 2 |
| EPIC-002-003 — Telegram Operations Bot (webhook handler, 21 tests) | 2026-07-18 | Epic 2 |
| EPIC-002-004 — Operations Telegram Bot Spec + Implementation (1.5.0) | 2026-07-18 | Epic 2 |