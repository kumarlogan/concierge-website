# Current Sprint

> Active sprint tracking — goals, progress, blockers, and retrospective notes.
> This file is the live record of the current sprint. Update it as tasks
> progress.

---

## Sprint: Epic 2 — Operations Platform Foundation (RBAC)

**Sprint ID:** EPIC-002
**Start Date:** 2026-07-18
**Target End Date:** TBD
**Status:** 🚧 In Progress — EPIC-002-005 (Admin Bot) Complete; next milestone EPIC-002-006 (Workforce Activation Platform)

---

### Sprint Goal

Establish the security and authorization foundation for the AG Synergy
Operations Platform, enabling future multi-agent operations (Hermes Admin bot,
Operations Bot) that communicate exclusively through the Workers API.

---

### Sprint Objectives

| # | Objective | Success Criteria |
|---|---|---|
| 1 | Create RBAC database foundation | `users`, `roles`, `permissions`, `user_permissions`, `audit_logs` tables; seed roles + permissions; apply migration |
| 2 | Document RBAC design | `RBAC_DESIGN.md` with table purpose, relationships, security model, middleware usage |
| 3 | Preserve Epic 1 functionality | Existing 6 tables, endpoints, and 74 tests remain green |
| 4 | Prepare authorization middleware | Schema ready for EPIC-002-002 enforcement layer |

---

### Sprint Goal

Create the foundational backend infrastructure required for AG Synergy Phase 1
Concierge Platform.

The outcome should be a **working Cloudflare Workers API connected to Cloudflare
D1**, ready to receive the first production workflow (consultation inquiries).

---

### Sprint Objectives

| # | Objective | Success Criteria |
|---|---|---|
| 1 | Create Cloudflare Workers backend foundation | Workers project initialised; TypeScript structure in place; `wrangler deploy` succeeds |
| 2 | Create D1 database foundation | D1 database created; migration framework working; initial schema applied |
| 3 | Establish API versioning structure | `/api/v1/` prefix routing active; health endpoint responds at `/api/v1/health` |
| 4 | Connect consultation inquiry workflow | `POST /api/v1/consultations` wired to D1; form submission → database persistence |
| 5 | Establish backend documentation | API docs, database schema docs, and deployment runbook updated |
| 6 | Prepare deployment workflow | `wrangler deploy` integrated into CI/CD; deployment documented and repeatable |

---

### Scope

#### Backend (Cloudflare Workers)

- Workers project initialisation and TypeScript configuration
- API routing structure (native `URLPattern`-based router)
- Health endpoint: `GET /api/v1/health`
- Foundation for `POST /api/v1/consultations`
- Error handling middleware
- Environment variable and secrets configuration
- Rate limiting foundation

#### Database (Cloudflare D1)

- D1 database creation via wrangler
- Migration framework (numbered SQL migration files)
- Initial schema: `leads`, `contacts`, `consultations`, `clinics`, `services`, `faqs`
- Future-prepared `users` table (schema only, no auth implementation)

#### Documentation

- Update `ARCHITECTURE.md` references as decisions are made
- Record implementation decisions as ADRs in `docs/decisions/`
- Update `CHANGELOG.md` on completion
- Update `CURRENT_SPRINT.md` as tasks progress
- Create backend deployment runbook in `docs/operations/`

---

### Out of Scope (EPIC-002-001 only)

These are **explicitly excluded** from the RBAC data foundation task:

| Excluded | Arrives In |
|---|---|
| Authentication / login flows | Future phase |
| Authorization middleware (enforcement) | EPIC-002-002 |
| Telegram Operations Bot | EPIC-002-003 |
| Hermes Admin Bot | EPIC-002-004 |
| Dashboard / mobile UI | Later phase |
| PHI / medical data | Never (platform boundary) |

---

### Definition of Done (EPIC-002-001)

| # | Condition | Verification |
|---|---|---|
| 1 | Migration applies successfully | ✅ `wrangler d1 migrations apply` — 1 migration, 21 commands |
| 2 | Tables exist | ✅ 5 RBAC tables present in local D1 |
| 3 | Seed data exists | ✅ 4 roles, 8 permissions seeded |
| 4 | Epic 1 functionality unchanged | ✅ 6 tables intact; 74 tests pass |
| 5 | `pnpm test` passes | ✅ 74/74 tests pass |
| 6 | TypeScript compiles | ⚠️ `src/` clean; pre-existing `tests/` type gaps (node: types) — not introduced here, see Concerns |
| 7 | RBAC_DESIGN.md created | ✅ Documented: purpose, relationships, security model, middleware usage |

---

### Definition of Done (EPIC-002-002)

| # | Condition | Verification |
|---|---|---|
| 1 | Provider-agnostic engine exists | ✅ `workers/src/auth/` — types, providers, principal, permissions, middleware, audit, index |
| 2 | Principal resolution works | ✅ `buildPrincipal()` resolves `users` → role → `Principal`; 401 unknown / 403 disabled |
| 3 | Effective permissions data-driven | ✅ Reads `role_permissions` + `user_permissions`; deny-wins; OWNER short-circuit; no hardcoded maps (ADR-003) |
| 4 | Authorization enforces | ✅ `authorize()` / `requirePermission()` return 401/403 on failure; pass `Principal` to handlers |
| 5 | Audit on every decision | ✅ `audit_logs` row written for allow + deny (verified in integration test) |
| 6 | Provider isolation | ✅ `Principal` exposes logical `provider` only, never raw `external_id` |
| 7 | Epic 1 functionality unchanged | ✅ 74 Epic 1 tests pass; engine is opt-in (no auto-wiring into existing routes) |
| 8 | `pnpm test` passes | ✅ 99/99 tests pass (74 Epic 1 + 25 new engine tests) |
| 9 | TypeScript compiles | ⚠️ `src/` clean; pre-existing `tests/` type gaps (node: types) — not introduced here |
| 10 | Docs updated | ✅ RBAC_DESIGN.md §6 rewritten; ARCHITECTURE.md, SECURITY.md, CHANGELOG.md, TASKS.md, CURRENT_SPRINT.md updated |

### Definition of Done (EPIC-002-003A)

| # | Condition | Verification |
|---|---|---|
| 1 | Ops API routes exist under `/api/v1/ops/` | ✅ `GET /leads`, `GET /leads/:id`, `PATCH /leads/:id`, `POST /leads/:id/assign`, `GET /me`, `GET /dashboard` |
| 2 | All endpoints gated by `requirePermission()` (RBAC engine) | ✅ No endpoint returns data without `leads.read`/`leads.update`/`leads.assign`; deny-wins + OWNER short-circuit verified |
| 3 | Thin route handlers | ✅ Zero SQL in routes; all logic in `opsService` |
| 4 | Service layer + D1 repository | ✅ `opsService.ts` — list/detail/update/assign/dashboard/timeline |
| 5 | Audit on every write | ✅ `leads.update`, `leads.assign` append `audit_logs` (verified in integration test) |
| 6 | Operational timeline abstraction | ✅ Composable from lead/assignment/audit events; API contract stable for future event types |
| 7 | Pagination / filter / search on lead list | ✅ `limit`, `offset`, `status`, `assigned_to`, `q` supported |
| 8 | `/me` bootstrap endpoint | ✅ Returns identity, role, effective permissions |
| 9 | Dashboard = operational metrics only | ✅ New/assigned/pending leads, today's consultations, follow-ups due; no revenue/analytics/AI |
| 10 | Epic 1 functionality unchanged | ✅ `POST /consultations`, `GET /health` untouched; all 74 Epic 1 tests green |
| 11 | `pnpm test` passes | ✅ 99 prior + new ops tests pass |
| 12 | TypeScript compiles | ⚠️ `src/` clean |
| 13 | Docs updated | ✅ API.md, ARCHITECTURE.md, SECURITY.md, CHANGELOG.md, TASKS.md, CURRENT_SPRINT.md, SESSION_HANDOFF.md |

### Task Progress

| Task ID | Description | Priority | Status | Assignee |
|---|---|---|---|---|
| EPIC-002-001 | RBAC Data Foundation | 🔴 Critical | ✅ Done | Hermes |
| EPIC-002-002 | Identity & Authorization Engine | 🔴 Critical | ✅ Done | Hermes |
| EPIC-002-003A | Operations API Foundation | 🔴 Critical | ✅ Done | Hermes |
| EPIC-002-003 | Telegram Operations Bot | 🟠 High | ✅ Done | Hermes |
| EPIC-002-003B | Telegram Operations Bot (Ops API client) | 🟠 High | ✅ Done | Hermes |
| EPIC-002-004 | Operations Telegram Bot — Specification & Architecture | 🟠 High | ✅ Done (spec + impl) | Hermes |
| EPIC-002-004-IMPL | Operations Telegram Bot — Implementation (per spec) | 🟠 High | ✅ Done | Hermes |
|| EPIC-002-005 | Hermes Admin Bot | 🟡 Medium | ✅ Done | Hermes |

---

### Blockers & Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| D1 free-tier limits exceeded during development | Low | Low | Development against a separate D1 preview database; free tier is generous (5 GB, 5M reads/day) |
| Workers cold-start latency concerns | Low | Low | V8 isolates cold-start in <1ms at edge; not a concern at Phase 1 scale |
| Wrangler version mismatch (v3 vs v4) | Medium | Medium | Pin wrangler@4; documented in deploy-website skill; same auth pattern used for Workers deploys |
| TypeScript build configuration complexity | Low | Medium | Use Cloudflare's `create-cloudflare` scaffolder or Workers templates to avoid manual config |

---

### Retrospective

*To be completed after sprint close.*

---

**Previous Sprint:** EPIC-001 — Backend Foundation (✅ Complete, 10/10)
**Next Sprint:** EPIC-002-006 (Workforce Activation Platform — agent lifecycle activation, approval gates, and safety enforcement)