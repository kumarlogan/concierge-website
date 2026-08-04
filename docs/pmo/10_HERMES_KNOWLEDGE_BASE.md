# Volume 10: Hermes Knowledge Base

> **Version:** 1.0 | **Date:** 2026-08-03
> **Authority:** PMO — Complete encyclopedia of the AG Synergy & Hermes Platform
> **Status:** ⚡ RATIFIED — Comprehensive reference

---

## 1. Platform Overview

| Attribute | Value |
|-----------|-------|
| **Product** | AG Synergy — Fertility Concierge Platform |
| **Platform** | Hermes — AI Execution & Operations Platform |
| **Repository** | `github.com/kumarlogan/concierge-website` |
| **Hosting** | Cloudflare (Workers, D1, R2, Pages, DNS) |
| **Language** | TypeScript (100%) |
| **Package Manager** | pnpm 11.13.1 |
| **Frontend** | React + Vite + Tailwind CSS 4 |
| **Backend** | Cloudflare Workers (wrangler 3.90+) |
| **Database** | Cloudflare D1 (SQLite) |
| **Storage** | Cloudflare R2 |
| **Testing** | Vitest |
| **CI/CD** | GitHub Actions |
| **AI Ops** | Hermes Agent (Nous Research) |
| **Status** | ✅ Production (Phases 0-2 complete) |

---

## 2. Architecture Modules

### 2.1 Hermes Platform Modules (`hermes/`)

| Module | Path | Description | Key Exports |
|--------|------|-------------|-------------|
| **Agents** | `hermes/agents/` | Agent registry, seed agents, tool contracts | `Agent`, `AgentRegistry`, `ToolContract` |
| **Admin** | `hermes/admin/` | Admin facade, console UI, governance view | `AdminFacade`, `ConsoleView` |
| **Audit** | `hermes/audit/` | Audit event framework | `AuditEvent`, `AuditEmitter`, `DurableAuditStore` |
| **Contracts** | `hermes/contracts/` | Platform API, dispatcher, planning contracts | `PlatformAPI`, `Dispatcher`, `Contract` |
| **Identity** | `hermes/identity/` | Authentication & principal management | `IdentityProvider`, `Principal`, `Types` |
| **Permissions** | `hermes/permissions/` | Authorization middleware | `PermissionMiddleware`, `PermissionResolver` |
| **Persistence** | `hermes/persistence/` | State stores for agents, execution, workflows | `AgentStateStore`, `ExecutionStore`, `WorkflowStore` |
| **Workforce** | `hermes/workforce/` | Workforce API and event management | `WorkforceAPI`, `WorkforceEvent` |

### 2.2 Hermes Services (`hermes/services/`)

| Service | Description | Status |
|---------|-------------|--------|
| **Activation** | Approval gates, developer agent, git operations, provider orchestration | ✅ Production |
| **Execution** | Execution gateway planner, dispatcher, queue, review | ✅ Production |
| **Planning (EPCL)** | Roadmap engine, discipline router, context/token budgeting | ✅ Production |
| **Providers** | Provider discovery, loading, runtime, marketplace | ✅ Production (marketplace deferred) |
| **Registry** | Capability registry service | ✅ Production |
| **Scheduler** | Cron job scheduler | ✅ Production |
| **Security** | Security agent, risk engine, OSS scanner adapters | ✅ Production |
| **Tools** | Dev tools, docs tools, monitoring, research, security | ✅ Production |
| **Workforce** | Agent activation, orchestration, persistence, observability | ✅ Production |

### 2.3 Workers Modules (`workers/src/`)

| Module | Path | Description | Status |
|--------|------|-------------|--------|
| **Auth** | `workers/src/auth/` | RBAC — identity, permission resolution, audit | ✅ Production |
| **Middleware** | `workers/src/middleware/` | JWT, logging, rate limit, security, Turnstile | ✅ Production |
| **Routes** | `workers/src/routes/` | All API route handlers | ✅ Production |
| **Services** | `workers/src/services/` | Business logic services | ✅ Production |
| **Platform** | `workers/src/platform/` | Platform capabilities (identity, trust, documents, etc.) | ✅ Production |

---

## 3. API Catalogue

### 3.1 Public Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/v1/health` | GET | None | Health check |
| `/api/v1/consultations` | POST | Turnstile | Request consultation |
| `/api/v1/clinics` | GET | None | List clinics |
| `/api/v1/faqs` | GET | None | List FAQs |
| `/api/v1/services` | GET | None | List services |
| `/api/v1/contact` | POST | None | Contact form |

### 3.2 Authenticated Endpoints

| Route | Method | Auth | Purpose |
|-------|--------|------|---------|
| `/api/v1/leads` | GET | RBAC | List leads |
| `/api/v1/leads/mine` | GET | RBAC | My leads |
| `/api/v1/leads/:id` | GET | RBAC | Lead detail |
| `/api/v1/leads/:id` | PATCH | RBAC | Update lead |
| `/api/v1/leads/:id/assign` | POST | RBAC | Assign lead |
| `/api/v1/dashboard` | GET | RBAC | Dashboard data |
| `/api/v1/timeline` | GET | RBAC | Timeline data |
| `/api/v1/ops/*` | Various | RBAC | Operations API |
| `/api/v1/identity/*` | Various | JWT | Identity management |
| `/api/v1/consultations/*` | Various | JWT | Consultation CRUD |
| `/api/v1/clinic-messages/*` | Various | JWT | Clinic messaging |
| `/api/v1/documents/*` | Various | JWT | Document management |
| `/api/v1/coordination/*` | Various | JWT | Care coordination |
| `/api/v1/trust/*` | Various | JWT | Trust runtime |
| `/api/v1/timeline/*` | Various | JWT | Timeline management |
| `/api/v1/wave7/*` | Various | JWT | Wave 7 (notifications) |
| `/telegram/webhook` | POST | JWT | Ops Bot webhook |
| `/admin/webhook` | POST | JWT | Admin Bot webhook |
| `/admin/approvals` | POST | JWT | Approval endpoint |
| `/admin/console` | POST | JWT | Admin console |

---

## 4. Database Catalogue

### 4.1 All Tables

| Table | Migration | Purpose | PHI Zone |
|-------|-----------|---------|----------|
| `leads` | 0001 | Consultation inquiries | ✅ Yes |
| `contacts` | 0001 | Qualified contacts | ✅ Yes |
| `clinics` | 0001 | Partner clinics | No |
| `consultations` | 0001 | Appointment scheduling | ✅ Yes |
| `services` | 0001 | Service catalog | No |
| `faqs` | 0001 | FAQ content | No |
| `roles` | 0002_rbac | Role definitions | No |
| `permissions` | 0002_rbac | Permission definitions | No |
| `users` | 0002_rbac | Staff accounts | ✅ Yes |
| `user_permissions` | 0002_rbac | Per-user permission overrides | No |
| `audit_logs` | 0002_rbac | Security audit trail | No |
| `role_permissions` | 0004 | Role-to-permission mapping | No |
| Identity tables | 0002_identity | AuthN data | ✅ Yes |
| Trust tables | 0006 | Trust policies, scores | ✅ Yes |
| Document tables | 0007 | Document metadata | ✅ Yes |
| Consent tables | 0008 | Patient consent records | ✅ Yes |
| Workforce tables | 0005 | Agent state, activation requests | No |
| Workflow tables | 0010 | Workflow engine state | No |
| Notification tables | 011 | Notification state | ✅ Yes |

---

## 5. Environment Variables

Reference: Volume 08, Section 4 (Environment Variables) + `docs/certification/DEPLOYMENT_SECRET_INVENTORY.md`

Key variables:
- `CLOUDFLARE_API_TOKEN` — ⚠️ Stale (53-char), needs 100-char token
- `JWT_SECRET` — For auth middleware
- `TELEGRAM_*_TOKEN` — Bot tokens
- `TURNSTILE_*` — CAPTCHA keys
- `ENVIRONMENT` — Runtime environment
- `CORS_ORIGIN` — CORS allowed origin

---

## 6. Secrets Inventory

Reference: `docs/certification/DEPLOYMENT_SECRET_INVENTORY.md`

| Secret | Type | Storage | Rotated |
|--------|------|---------|---------|
| All secrets | Tokens + keys | GitHub Secrets + Worker secrets | Varies |

---

## 7. Dependencies

### 7.1 Runtime Dependencies

| Dependency | Version | Purpose |
|-----------|---------|---------|
| Cloudflare Workers | — | Serverless compute |
| Cloudflare D1 | — | SQLite database |
| Cloudflare R2 | — | Object storage |
| Cloudflare Pages | — | Frontend hosting |
| Cloudflare Turnstile | — | CAPTCHA |
| Cloudflare Email | — | Email routing |
| Telegram Bot API | — | Bot webhooks |
| GitHub Actions | — | CI/CD |
| Hermes Agent | — | AI operations |

### 7.2 NPM Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@cloudflare/workers-types` | — | Worker type definitions |
| `wrangler` | ^3.90.0 | Worker deployment |
| `vitest` | — | Testing framework |
| `typescript` | ~5.9.3 | Language |
| `prettier` | ^3.9.5 | Code formatting |
| `lightningcss` | ^1.32.0 | CSS processing |
| React + Vite | — | Frontend framework |
| Tailwind CSS | ^4.3.2 | CSS framework |

---

## 8. Migrations

Reference: Volume 02, Section 5 (Database)

All 12 migrations are forward-only, applied via `wrangler d1 migrations apply`.

| # | Name | Tables Added |
|---|------|-------------|
| 0001 | Initial Schema | 6 tables (leads, contacts, clinics, etc.) |
| 0002_identity | Identity Core | Identity tables |
| 0002_rbac | RBAC Foundation | 4 RBAC tables |
| 0003 | Ops Lead Fields | Lead field additions |
| 0004 | Role Permissions Seed | role_permissions + seed data |
| 0005 | Workforce Persistence | 5 workforce tables |
| 0006 | Trust Runtime | Trust tables |
| 0007 | Document Upload | Document tables |
| 0008 | Consent Engine | Consent tables |
| 0009 | WAS Activation State | WAS state tables |
| 0010 | Workflow Engine | Workflow engine tables |
| 011 | Notifications | Notification tables |

---

## 9. ADRs (Architecture Decision Records)

Reference: `docs/decisions/` directory

| ADR | Title | Status | Phase |
|-----|-------|--------|-------|
| ADR-001 | Cloudflare Migration | Accepted | Phase 0 |
| ADR-002 | Multi-Agent Operations Architecture | Accepted | Phase 1 |
| ADR-003 | Permission Resolution | Accepted | Phase 1 |
| ADR-004+ | Various | Accepted | Phase 2 |

All ADRs are located in `docs/decisions/`. Reference them for any architecture decisions.

---

## 10. Glossary

| Term | Definition |
|------|------------|
| **AG Synergy** | Fertility concierge platform product |
| **Hermes Platform** | AI execution & operations backbone |
| **PMO** | Program Management Office |
| **EPCL** | Executive Planning & Control Layer |
| **WAS** | Workforce Activation Service — 8-state activation machine |
| **RBAC** | Role-Based Access Control |
| **D1** | Cloudflare SQLite database |
| **R2** | Cloudflare object storage |
| **Workers** | Cloudflare serverless functions |
| **PHI** | Protected Health Information |
| **ADR** | Architecture Decision Record |
| **WEF** | Workflow Execution Framework |
| **Turnstile** | Cloudflare CAPTCHA alternative |
| **Miniflare** | Local Worker test environment |
| **wrangler** | Cloudflare Workers CLI |

---

## 11. Deferred Backlog

| Capability | Status | Notes |
|-----------|--------|-------|
| Content management (D1-backed) | Deferred | Static files currently used |
| Concierge web dashboard | Deferred | Telegram bots cover current needs |
| Multi-language i18n | Post-MVP | English-only |
| Mobile application | Post-MVP | Responsive web covers current phases |
| Provider Marketplace | Deferred | Architecture exists, implementation deferred |
| Provider Manifest V2 | Deferred | No adopting providers |
| Memory Service (full) | Deferred | Stub, knowledge capture via audit |
| D1 Backend activation | Deferred | Schema exists, not wired |
| Provider Runtime Guard wiring | Deferred | Code exists, not wired |
| Provider Violation Model | Deferred | Code exists, not wired |

---

## 12. Future Enhancements

| Capability | Phase | Description |
|-----------|-------|-------------|
| Clinic Portal | Phase 3 | Clinic-side dashboards and workflows |
| Shared Patient Journeys | Phase 3 | Multi-stakeholder journey views |
| Clinic Document Management | Phase 3 | Clinic-side document operations |
| Operational Analytics | Phase 3 | Advanced analytics and reporting |
| API Ecosystem | Phase 4 | Third-party integrations |
| Advanced Analytics | Phase 4 | ML-driven insights |
| AI-assisted Operations | Phase 4 | Hermes intelligence |
| Multi-Clinic Coordination | Phase 4 | Cross-clinic workflows |

---

## 13. Quick Reference Links

| Resource | Path |
|----------|------|
| Project Constitution | `PROJECT.md` |
| Roadmap | `ROADMAP.md` |
| Architecture v2.2 | `ARCHITECTURE.md` |
| Product Boundaries | `PRODUCT_BOUNDARIES.md` |
| AI Operating Model | `AI_OPERATING_MODEL.md` |
| API Documentation | `API.md` |
| Governance Index | `docs/governance/GOVERNANCE_INDEX.md` |
| Engineering Standards | `docs/platform/engineering-standards/` |
| Capability Registry | `docs/platform/capability-registry/` |
| Security Posture | `SECURITY.md` |
| Deployment Secrets | `docs/certification/DEPLOYMENT_SECRET_INVENTORY.md` |
| ADRs | `docs/decisions/` |
| Release Notes | `FOUNDATION_v1_RELEASE_NOTES.md` |

---

*End of Volume 10*