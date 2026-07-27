# Concierge Roadmap

> High-level product direction, completed milestones, phase boundaries, and future capabilities.
> **Last updated:** 2026-07-27
> **Framework:** WEF v1.1

## Governance Header

```
Company:        AGS
Business Unit:  Engineering
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Repository:     concierge-website
Portfolio:      Clinical
Roadmap:        Concierge Roadmap
Phase:          Phase 2 — Wave 9
Current Wave:   Wave 9 — Concierge Launch & Platform Activation
Status:         Phase 2 ✅ Complete
Framework:      WEF v1.1
Overall Progress: Phase 2 complete — All 9 waves delivered. Awaiting Phase 3.
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

## Phase 2 — Patient Workflow Platform ✅ Complete — Phase 2 Delivered

Patient accounts, authentication, personal journey dashboards, secure document upload, direct concierge messaging, appointment management, launch readiness, and business activation.

**All prior waves complete.** Wave 9 is the final execution wave of Phase 2, merging Patient Journey & Care Coordination with Launch Readiness into one comprehensive product activation.

### Waves 1–8 Complete

| Wave | Focus | Status |
|------|-------|--------|
| **Wave 1** | Trust & Identity Foundation — Architecture | ✅ **Complete** |
| **Wave 2** | AI Platform Governance Core — Architecture | ✅ **Complete** |
| **Wave 3** | Patient Identity & Authentication — Implementation | ✅ **Complete** |
| **Wave 4** | Consent & Trust + Policy Engine — Architecture | ✅ **Complete** |
| **Wave 5** | Patient Workspace — Login, Dashboard, Profile, Security, Consent, Notifications, Timeline (EPIC-2.2 / S2.2.1) | ✅ **Complete** |
| **Wave 5.1** | Patient Workspace Activation & UX Polish (S2.2.2) | ✅ **Complete** |
| **Wave 6** | Secure Document Upload & Consent Implementation | ✅ **Complete** |
| **Wave 7** | Appointment Management & Messaging | ✅ **Complete** |
| **Wave 8** | End-to-End Integration & Production Readiness | ✅ **Complete** |
| **Wave 8.1** | Production Hardening & Security Closure (v1.21.0) | ✅ **Complete** |

### Wave 9 — Concierge Launch & Platform Activation ✅ Complete

The final execution wave of Phase 2. All four workstreams delivered. Patient Journey, Clinic Experience, Launch Readiness, and Business Activation — comprehensive product activation complete.

**Rationale:** The platform foundation is mature. Identity Core, Trust Runtime, Consent Runtime, Policy Engine, Document Platform, Appointment Platform, Messaging Platform, Release Management, PSER, WEF, and Security Hardening are all complete. Operational readiness is no longer an isolated engineering effort — it is part of the product launch.

**This is a roadmap refinement only. It is NOT a roadmap expansion.**

#### Workstream A — Patient Journey
- Treatment Journey Timeline
- Care Plan
- Patient Tasks
- Milestones
- Journey Dashboard
- Progress Tracking
- Timeline APIs
- Care Coordination
- Timeline Notifications

#### Workstream B — Clinic Experience
- Clinic Scheduling Integration
- Provider Workflow Improvements
- Appointment Coordination
- Patient Status Tracking
- Clinic Messaging Improvements
- Internal Workflow Polish

#### Workstream C — Launch Readiness
- Production Worker validation
- Cloudflare Pages validation
- DNS validation
- Environment verification
- Secrets verification
- Monitoring & Alerting
- Release Management integration
- Smoke Tests
- Rollback validation
- PSER activation
- WEF operational validation
- **Do NOT deploy production — only prepare**

#### Workstream D — Business Activation
- SEO & Metadata
- Sitemap & Robots
- Marketing pages
- Contact workflow
- Analytics
- Cookie consent
- Privacy Policy & Terms & Conditions
- Accessibility review
- Performance review
- Launch checklist

### Phase 2 Capabilities

| Capability | Status | Notes |
|---|---|---|
| Patient authentication | ✅ Complete | Auth flows, session management, MFA |
| Patient portal | ✅ Complete | Login, registration, dashboard, profile, security, consent, notifications, journey timeline |
| Patient Workspace frontend | ✅ Complete | PatientLayout, AuthProvider, AuthGuard, Login/Register/Dashboard/Profile/Security/Consent/Notifications/Timeline pages |
| Identity Core integration | ✅ Complete | Identity routes, router registration, Env types, /identity proxy |
| Patient API client | ✅ Complete | Auth, profile, consent API client |
| Secure document upload | ✅ Complete | R2-backed, pre-signed URLs |
| Appointment management | ✅ Complete | Scheduling, reminders, status tracking |
| Consent & Trust implementation | ✅ Complete | Consent types, consent collection, trust scoring |
| Policy Engine implementation | ✅ Complete | Policy authoring, evaluation, integration |
| Platform Engineering Standards enforcement | ✅ Complete | Compliance gates for all capabilities |
| Capability Maturity Model enforcement | ✅ Complete | Gates enforced at each wave |
| Workforce Identity implementation | ✅ Complete | Agent registration, credential management, trust scoring |
| Messaging Platform | ✅ Complete | Secure direct messaging between patients and concierges |
| Release Management | ✅ Complete | Standardized preview and production deployment workflows |

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
| Phase 2 Planning | 2026-Q3 | ✅ **Waves 1–8 Complete** |
| Phase 2 Waves 1–8 Complete | 2026-07-27 | ✅ **Complete** |
| Phase 2 Wave 9: Concierge Launch & Platform Activation | 2026-07-27 | ✅ **Complete** |
| Phase 2 Complete | 2026-07-27 | ✅ **Full Phase 2 Delivered** |
| Phase 3 | TBD | 📋 Future |
| Phase 4 | TBD | 📋 Future |

---

*Roadmap synchronized with implementation. All Phase 1 epics verified against running system, test suite, and deployed infrastructure.*

---

## Governance Standards

### Workforce Execution Framework (WEF v1.0)

WEF v1.1 is the AGS Enterprise Execution Framework — the canonical execution framework for all AGS work across all business units. It defines a seven-phase, gate-driven process with mandatory human oversight, observability, auditability, fail-closed safety, and platform-first principles. Engineering is the first adopter. All future implementation work under this roadmap follows WEF v1.1. WEF v1.1 supersedes WEF v1.0 (previously Workforce Development Cycle). See `docs/governance/GOVERNANCE_FREEZE.md` for the governance freeze scope.

*Governance standard — GOV-003 — adopted 2026-07-26*