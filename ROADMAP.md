# Concierge Roadmap

> High-level product direction, completed milestones, phase boundaries, and future capabilities.
> **Last updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Repository:     concierge-website
Roadmap:        Concierge Roadmap
Phase:          Phase 1 Complete — Phase 2 In Planning
Current Epic:   None (all Phase 1 epics closed)
Sprint:         Phase 1 Sprint Closed
Status:         Phase 1 Complete. Awaiting Phase 2 Planning.
Overall Progress: 16 Phase 1 epics complete (465/465 tests)
```

---

## Phase 0 — Platform Foundation ✅ Complete 2026-07-18

The static marketing website and engineering infrastructure.

| Deliverable | Status |
|---|---|
| Static marketing website (React + Vite + Tailwind) | ✅ |
| Cloudflare Pages deployment | ✅ |
| GitHub repository + CI/CD pipeline | ✅ |
| Telegram/Hermes development workflow | ✅ |
| Automated deployment pipeline (deploy-website skill) | ✅ |
| Project documentation structure (`docs/`) | ✅ |
| PROJECT.md — Project Constitution v1.0 | ✅ |
| AI_OPERATING_MODEL.md — AI Operating Model | ✅ |
| PRODUCT_BOUNDARIES.md — Product Boundaries | ✅ |
| ARCHITECTURE.md — System Architecture | ✅ |
| ADR-001 — Cloudflare Migration Strategy | ✅ |
| Phase 0 completed **2026-07-18** | ✅ |

---

## Phase 1 — Digital Concierge Platform ✅ 100% Complete

Structured backend, RBAC authorization, operations tools, Hermes platform foundation, and frontend–API integration.

### Completed Epics

| Epic | Description | Completed |
|---|---|---|
| **EPIC-001** (10 tasks) | Backend Foundation — Workers project, D1 database, API routing, health endpoint, consultation workflow, testing framework, deployment, documentation | 2026-07-18 |
| **EPIC-002-001** | RBAC Data Foundation — `roles`, `permissions`, `users`, `user_permissions`, `audit_logs` tables | 2026-07-18 |
| **EPIC-002-001.5** | Permission Resolution Foundation — `role_permissions` table, ADR-003 | 2026-07-18 |
| **EPIC-002-002** | Identity & Authorization Engine — provider-agnostic `src/auth/` engine, data-driven RBAC, audit on every decision | 2026-07-18 |
| **EPIC-002-003A** | Operations API Foundation — `/api/v1/ops/*` endpoints, `opsService`, pagination/filter/search | 2026-07-18 |
| **EPIC-002-003** | Telegram Operations Bot — lead management via Telegram webhook | 2026-07-18 |
| **EPIC-002-004** | Operations Bot — Specification & Architecture | 2026-07-18 |
| **EPIC-002-004-IMPL** | Operations Bot — MVP Implementation | 2026-07-18 |
| **EPIC-002-005** | Hermes Admin Bot — Control Plane (read-only platform admin, `/admin/webhook`) | 2026-07-25 |
| **EPIC-002-006** | Frontend ↔ Workers API Integration — Vite proxy, env config, CORS, 465 tests | 2026-07-25 |
| **EPIC-003-001** | Hermes Execution Platform — Work Planner, Workforce Dispatcher, Execution Queue, Review Pipeline, Multi-Agent Coordination | 2026-07-19 |
| **EPIC-003-002** | Hermes Developer Automation Pipeline — Engineering Planner, Claude Code ToolProvider, QA/Security/Docs Pipelines, E2E Simulation | 2026-07-19 |
| **EPIC-003-003** | Hermes Security Automation Platform — Security Agent, Risk Engine, finding aggregation | 2026-07-19 |
| **EPIC-003-004** | Security Provider Integration — OSS scanner adapters (gitleaks/semgrep/osv-scanner/trivy), provider discovery, provider-health platform | 2026-07-20 |
| **EPIC-003-005** | Workforce Orchestration Platform — Coordinator, lifecycle states, human approval gates, notification integration | 2026-07-26 |
| **EPIC-003-006** | Platform Hardening & Boundary Segregation — agent lifecycle, audit persistence, tenant boundaries, provider loader seam | 2026-07-26 |
| **EPIC-004** | Persistent Operations Platform — durable state behind provider-neutral seams | 2026-07-20 |
| **EPIC-004.5** | Execution Durability Alignment — `ExecutionStore`, execution → coordinator refactor, approval durability | 2026-07-20 |

### Phase 1 Validated

- ✅ **465/465 tests pass** across 34 test files
- ✅ TypeScript compilation: clean (libs + workers + artifacts + scripts)
- ✅ Frontend build: zero errors (2221 modules)
- ✅ Secret scan: clean
- ✅ Health endpoint: `GET /api/v1/health` → 200
- ✅ Consultation workflow: `POST /api/v1/consultations` → 201 Created → D1 persistence → duplicate detection
- ✅ RBAC enforcement: `requirePermission()` guards on all protected routes
- ✅ Two Telegram bots operational: Operations Bot + Admin Bot
- ✅ CORS: restricted to known origins
- ✅ Frontend–API integration: live via Vite proxy + env-specific endpoints

---

## Phase 2 — Patient Workflow Platform 🚧 In Planning

Patient accounts, authentication, personal journey dashboards, secure document upload, direct concierge messaging, appointment management.

| Capability | Status | Notes |
|---|---|---|
| Patient authentication | 📋 Planned | Auth flows, session management, `PatientIdentityResolver` |
| Patient portal | 📋 Planned | Journey dashboard, timeline, concierge messaging |
| Secure document upload | 📋 Planned | R2-backed, pre-signed URLs (R2 already configured) |
| Appointment management | 📋 Planned | Scheduling, reminders, status tracking |
| Patient data protection | 📋 Planned | PHI controls, encryption, consent management |

**Not yet planned.** Will be scoped after Phase 2 planning sprint completes.

---

## Phase 3 — Clinic Collaboration Platform 📋 Planned

Clinic accounts and dashboards, shared patient journey views, clinic-side document management, treatment milestone tracking, operational analytics.

**Not yet planned. Will be scoped after Phase 2 completion.**

---

## Phase 4 — Healthcare Technology Ecosystem 📋 Planned

API ecosystem for third-party integration, advanced analytics, AI-assisted operational intelligence, multi-clinic coordination, expanded service offerings.

**Not yet planned. Will be scoped after Phase 3 completion.**

---

## Future Capabilities

Capabilities identified for future consideration but not yet assigned to a phase.

| Capability | Status | Notes |
|---|---|---|
| Content management (D1-backed) | Deferred | Replacing static files with D1 queries — not an MVP blocker |
| Concierge web dashboard | Deferred | Telegram bots cover Phase 1 needs |
| Multi-language i18n | Post-MVP | English-only for Phase 1–2 |
| Mobile application | Post-MVP | Responsive web covers all current phases |
| AI Session Management | Planned | Hermes context monitoring, handoff notes, session restart |
| Payments | Post-MVP | Not in product scope until Phase 4 |

---

## Timeline

| Milestone | Target | Status |
|---|---|---|
| Phase 0 Complete | 2026-07-18 | ✅ Complete |
| Phase 1 Complete | 2026-07-26 | ✅ **Complete** |
| Phase 2 Planning | 2026-Q3 | 🚧 In Planning |
| Phase 2 Complete | TBD | 📋 Not Started |
| Phase 3 | TBD | 📋 Future |
| Phase 4 | TBD | 📋 Future |

---

*Roadmap synchronized with implementation. All Phase 1 epics verified against running system, test suite, and deployed infrastructure.*