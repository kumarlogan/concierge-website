# Implementation Inventory

> Canonical inventory of every subsystem in the Concierge repository.
> Each subsystem is classified as:
>
> - **AI Platform Assets** — Provider-neutral platform services owned by the AI Platform layer
> - **Reusable Platform Assets** — Generic, extractable infrastructure components
> - **Concierge Assets** — Product-specific to the Concierge product
> - **Business-specific Assets** — Domain logic tied to fertility concierge
> - **Shared Infrastructure** — Cross-cutting deployment and configuration
>
> This is the reference document for post-MVP extraction planning.
> Last updated: 2026-07-26

---

## AI Platform Assets

Provider-neutral, extractable platform services owned by the AI Platform layer.

### A1. Execution Platform

| Property | Value |
|---|---|
| **Path** | `hermes/services/execution/` |
| **Files** | 14+ files: work-planner, workforce-dispatch, execution-queue, review-pipeline, simulation, lease, metrics, idempotency, policy-evaluator, coordinator |
| **Tests** | `hermes.execution.003.test.ts` (28 tests) |
| **Status** | ✅ Deployed (EPIC-003-001) |
| **Extraction** | ✅ Ready — fully abstracted behind provider-neutral contracts |
| **Dependencies** | `@hermes/contracts/*`, `@hermes/identity/*` |

### A2. Provider Framework

| Property | Value |
|---|---|
| **Path** | `hermes/services/providers/` |
| **Files** | 20+ files: capability, discovery, executor, loader, manager, manifest-v2, marketplace, package, platform, sdk, transport, trust, runtime |
| **Tests** | EPIC-005 series tests |
| **Status** | ✅ Deployed (EPIC-003-004) |
| **Extraction** | ✅ Ready — designed for extraction, vendor code enters only through `ProviderLoader` seam |
| **Dependencies** | `@hermes/contracts/*`, `@hermes/identity/*` |

### A3. Security Platform

| Property | Value |
|---|---|
| **Path** | `hermes/services/security/` |
| **Files** | 16+ files: security-agent, risk-engine, finding-aggregator, provider-health, admin-view, OSS adapters, provider-discovery, local-tool-detection |
| **Tests** | `hermes.security.003.test.ts` (28 tests), `hermes.security.004.test.ts` (19 tests) |
| **Status** | ✅ Deployed (EPIC-003-003/004) |
| **Extraction** | ✅ Ready — fail-closed, simulation-default, real scanners are drop-in |
| **Dependencies** | `@hermes/activation`, `@hermes/providers` |

### A4. Workforce Orchestration

| Property | Value |
|---|---|
| **Path** | `hermes/services/workforce/` |
| **Files** | 12+ files: orchestration, activation-workflow, persistence, repository, workflow-repository, workflow-store, d1-backend, observability, metrics |
| **Tests** | `hermes.workforce.orchestration.test.ts` (17 tests); workforce suite (44 tests) |
| **Status** | ✅ Deployed (EPIC-003-005) |
| **Extraction** | ✅ Ready — in-memory by default, D1 as drop-in backend |
| **Dependencies** | `@hermes/execution`, `@hermes/providers`, `@hermes/notification` |

### A5. Agent Registry

| Property | Value |
|---|---|
| **Path** | `hermes/agents/` |
| **Files** | `registry.ts`, `seed.ts`, `tool-contracts.ts`, `index.ts` |
| **Tests** | Covered by integration tests |
| **Status** | ✅ Deployed (EPIC-003-006) |
| **Extraction** | ✅ Ready — lifecycle states, activation, registration all generic |
| **Dependencies** | `@hermes/contracts/*` |

### A6. Audit System

| Property | Value |
|---|---|
| **Path** | `hermes/audit/` |
| **Files** | `audit.ts`, `emitter.ts`, `event.ts`, `store.ts`, `store.durable.ts` |
| **Tests** | EPIC-004/004.5 test suite |
| **Status** | ✅ Deployed (EPIC-004) |
| **Extraction** | ✅ Ready — `AuditStore` interface with `MemoryAuditStore` default |
| **Dependencies** | `@hermes/contracts/*` |

### A7. Notification Service

| Property | Value |
|---|---|
| **Path** | `hermes/services/notification/` |
| **Files** | `notification.ts`, `index.ts` |
| **Tests** | Covered by workforce orchestration tests |
| **Status** | ✅ Deployed (EPIC-003-005) |
| **Extraction** | ✅ Ready — `NotificationProvider` interface, fire-and-forget |
| **Dependencies** | `@hermes/audit` |

### A8. Developer Automation Pipeline

| Property | Value |
|---|---|
| **Path** | `hermes/services/developer/` |
| **Files** | 11 files: developer-runtime, docs-pipeline, e2e-simulation, engineering-planner, git-workflow, qa-pipeline, review-package, security-pipeline, work-request, orchestrator, index |
| **Tests** | `hermes.developer.003.test.ts` (17 tests) |
| **Status** | ✅ Deployed (EPIC-003-002, simulation-only) |
| **Extraction** | ✅ Ready — all executors are simulated by default |
| **Dependencies** | `@hermes/execution`, `@hermes/security` |

---

## Reusable Platform Assets

Generic, extractable infrastructure components usable across any product.

### R1. Auth Engine

| Property | Value |
|---|---|
| **Path** | `workers/src/auth/` |
| **Files** | `types.ts`, `providers.ts`, `principal.ts`, `permissions.ts`, `middleware.ts`, `audit.ts`, `index.ts` |
| **Tests** | 14 unit + 11 integration (Miniflare D1) |
| **Status** | ✅ Deployed (EPIC-002-002) |
| **Extraction** | 🟡 Light refactor — parameterize `TelegramIdentityResolver` pattern; keep registry pattern |
| **Dependencies** | `@cloudflare/workers-types` (Workers D1), `@hermes/identity/types` |

### R2. Router

| Property | Value |
|---|---|
| **Path** | `workers/src/router/index.ts` |
| **Files** | 1 file (~45 lines) |
| **Tests** | Covered by integration tests |
| **Status** | ✅ Deployed (EPIC-001-003) |
| **Extraction** | ✅ Ready — zero external deps, pure `URLPattern`-based routing |
| **Dependencies** | None (Web Platform API: `URLPattern`) |

### R3. Admin Facade

| Property | Value |
|---|---|
| **Path** | `hermes/admin/` |
| **Files** | 16+ files: access, bff, governance, observability, service-status, visibility, workflow-view, workforce-view, console/app/... |
| **Tests** | Console render boundary, session, tool-adapter tests |
| **Status** | ✅ Deployed (EPIC-003 series) |
| **Extraction** | 🟡 Moderate refactor — some AG-specific view models |
| **Dependencies** | `@hermes/contracts/*`, `@hermes/execution` |

### R4. Persistence Layer

| Property | Value |
|---|---|
| **Path** | `hermes/persistence/` |
| **Files** | `agent-state-store.ts`, `execution-store.ts`, `provider.ts`, `tenant.ts`, `workflow-store.ts` |
| **Tests** | EPIC-004/004.5 test suite |
| **Status** | ✅ Deployed (EPIC-004) |
| **Extraction** | 🟡 Light refactor — interface-bound, but `enforceTenant` is AG-specific; parameterize |
| **Dependencies** | `@hermes/contracts/*` |

### R5. Shared Contracts

| Property | Value |
|---|---|
| **Path** | `shared/contracts/`, `shared/interfaces/` |
| **Files** | Agent, lifecycle, resource contracts; audit, datastore, identity, logging, notification, object-storage, permission, queue, scheduler, secret interfaces |
| **Tests** | Covered across all Hermes test suites |
| **Status** | ✅ Deployed |
| **Extraction** | ✅ Ready — zero business logic, pure type definitions |
| **Dependencies** | None |

---

## Concierge Assets

Product-specific components for the Concierge product.

### C1. Frontend Application

| Property | Value |
|---|---|
| **Path** | `artifacts/ags-fertility/src/` |
| **Files** | 80+ files: pages (8), sections (10), forms (1), layout (4), UI components (70+), hooks (2), data files (4), lib |
| **Structure** | `pages/`, `components/`, `data/`, `hooks/`, `lib/` |
| **Status** | ✅ Deployed (agsynergy.ca) |
| **Notes** | 70+ shadcn/ui components are generic; pages, sections, and data files are Concierge-specific |

### C2. API Client Libraries

| Property | Value |
|---|---|
| **Path** | `lib/api-client-react/`, `lib/api-zod/`, `lib/db/` |
| **Files** | Orval-generated React Query hooks, Zod schemas, Drizzle ORM schema |
| **Status** | ✅ Deployed |
| **Extraction** | 🟡 Template extraction — specific to Concierge API contract; Orval re-runs generate fresh clients |

### C3. Website Content Data

| Property | Value |
|---|---|
| **Path** | `artifacts/ags-fertility/src/data/` |
| **Files** | `treatments.ts`, `hospitals.ts`, `faq.ts`, `testimonials.ts` |
| **Status** | ✅ Deployed (static TypeScript, not mock APIs) |
| **Notes** | Intentional static content — replacement via D1-backed CMS is Epic 4 (deferred) |

---

## Business-specific Assets

Domain logic tied to fertility concierge business operations.

### B1. Consultation Service

| Property | Value |
|---|---|
| **Path** | `workers/src/services/consultationService.ts` |
| **Files** | 1 file |
| **Tests** | 45 unit tests (EPIC-001-007/008) |
| **Status** | ✅ Deployed |
| **Notes** | Business logic: validate → normalize → duplicate check → insert. AG-specific data model (`leads`, `consultations`) |

### B2. Consultation Route

| Property | Value |
|---|---|
| **Path** | `workers/src/routes/consultations.ts` |
| **Files** | 1 file |
| **Tests** | Covered by integration tests |
| **Status** | ✅ Deployed |
| **Notes** | Thin HTTP ↔ service translation; delegates to `consultationService` |

### B3. Ops Service

| Property | Value |
|---|---|
| **Path** | `workers/src/services/opsService.ts` |
| **Files** | 1 file |
| **Tests** | 21 integration tests |
| **Status** | ✅ Deployed |
| **Extraction** | 🟡 Refactor needed — generic CRUD pattern but tied to AG schema (leads, consultations) |

### B4. Ops API Routes

| Property | Value |
|---|---|
| **Path** | `workers/src/routes/ops.ts` |
| **Files** | 1 file |
| **Tests** | Covered by Ops integration tests |
| **Status** | ✅ Deployed |
| **Notes** | 7 endpoints: list, detail, update, assign, /me, dashboard, timeline |

### B5. Operations Bot

| Property | Value |
|---|---|
| **Path** | `workers/src/routes/telegram.ts` |
| **Files** | 1 file |
| **Tests** | 21 integration tests |
| **Status** | ✅ Deployed (EPIC-002-004-IMPL) |
| **Notes** | Lead management commands; reuses `callOps()` direct dispatch pattern |

### B6. Admin Bot

| Property | Value |
|---|---|
| **Path** | `workers/src/routes/adminBot.ts` |
| **Files** | 1 file |
| **Tests** | 23 integration tests |
| **Status** | ✅ Deployed (EPIC-002-005) |
| **Notes** | Read-only platform admin; reuses `callAdmin()` direct dispatch pattern |

### B7. Database Schema & Migrations

| Property | Value |
|---|---|
| **Path** | `workers/migrations/` |
| **Files** | 0001–0005 migration SQL files |
| **Status** | ✅ Applied (local + remote D1) |
| **Notes** | Concierge-specific schema: leads, contacts, consultations, clinics, services, faqs, users, roles, permissions, audit_logs, role_permissions |

### B8. Middleware

| Property | Value |
|---|---|
| **Path** | `workers/src/middleware/` |
| **Files** | `logger.ts`, `rateLimit.ts` |
| **Status** | ✅ Deployed |
| **Notes** | Middleware is generic but thin; logger is Cloudflare-specific, rate limiter is pattern-agnostic |

---

## Shared Infrastructure

### S1. Deployment Pipeline

| Property | Value |
|---|---|
| **Path** | `~/concierge-website/deploy.sh` |
| **Files** | 1 script |
| **Status** | ✅ Active |
| **Notes** | wrangler@4 based; `wrl` wrapper for token redaction bypass |

### S2. Wrangler Configuration

| Property | Value |
|---|---|
| **Path** | `workers/wrangler.jsonc` |
| **Status** | ✅ Configured |
| **Notes** | Production + preview environments; D1 binding; Worker secrets |

### S3. Frontend Configuration

| Property | Value |
|---|---|
| **Path** | `artifacts/ags-fertility/vite.config.ts`, `.env`, `.env.development`, `.env.example` |
| **Status** | ✅ Configured |
| **Notes** | Vite proxy (`localhost:8787`), env-specific API endpoints |

### S4. D1 Database (Instance)

| Property | Value |
|---|---|
| **Name** | `agsynergy-db` |
| **ID** | `45f52102-74e1-4ba2-86ca-f4d5f88e16c4` |
| **Region** | ENAM |
| **Status** | ✅ Live |
| **Migrations Applied** | 5 (0001 → 0005) |

---

*This inventory is the canonical reference for extraction planning. Update it when any subsystem is added, removed, or significantly refactored.*