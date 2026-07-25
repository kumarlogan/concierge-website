# Decision Log

> Append-only executive history of important project decisions.
> Every entry is permanent — do not edit, delete, or reorder.
> Add new entries at the top of the log.

**Company:** AGS
**Platform:** AI Platform
**Product:** Concierge
**Public Brand:** AG Synergy
**Repository:** concierge-website

---

## Decision Entries

### D-009 — Phase 2 Scope & Patient Identity Architecture

**Date:** 2026-07-25
**Status:** 📋 In Planning
**Category:** Product · Scope · Architecture

| Field | Value |
|---|---|
| **Decision ID** | D-009 |
| **Date** | 2026-07-25 |
| **Status** | 📋 In Planning (Phase Gate awaiting approval) |
| **Category** | Product · Scope · Architecture |
| **Summary** | Phase 2 — Patient Workflow Platform scope approved: Patient Identity & Authentication (Epic 2.1), Patient Portal & Dashboard (Epic 2.2), Secure Document Upload (Epic 2.3), Appointment Management (Epic 2.4), Concierge Messaging (Epic 2.5). First deliverable: Sprint 2.1.1 — Architecture & Data Model (design-only, no implementation). |
| **Rationale** | Phase 1 established the operational foundation. Phase 2 transforms Concierge from an internal operations tool into a patient-accessible service. The architecture-first approach (Sprint 2.1.1) ensures PHI compliance, provider-neutral identity boundaries, and backward compatibility before any patient-facing code is written. |
| **Impact** | 5 new epics across Phase 2. New database tables for patient data with PHI segregation. `PatientIdentityResolver` seam in the identity pipeline. Patient-specific RBAC roles and permissions. R2 document storage activated. All Phase 2 work gated by security review. |
| **Related ADRs** | ADR-001 (architecture principles), ADR-003 (data model) |
| **Related Phase** | Phase 2 — Patient Workflow Platform |
| **Related Epic** | Epic 2.1 — Patient Identity & Authentication |
| **Related Sprint** | Sprint 2.1.1 — Architecture & Data Model |

---

### D-008 — Production Enablement & Phase Gate Framework

**Date:** 2026-07-26
**Status:** ✅ Implemented
**Category:** Process · Governance

| Field | Value |
|---|---|
| **Decision ID** | D-008 |
| **Date** | 2026-07-26 |
| **Status** | ✅ Implemented (GOV-002) |
| **Category** | Process · Governance |
| **Summary** | Established mandatory Phase Gate Framework with entry/exit criteria, templates for all work items, and a Decision Log (this document) as the authoritative record of all project decisions. |
| **Rationale** | Phase 1 revealed documentation drift, inconsistent versioning, and no formalized gate process. Without structured phase gates and templates, future phases risk scope creep, missed validation, and loss of institutional knowledge. |
| **Impact** | Every future phase must pass through a defined gate process. All work items (Phase, Epic, Sprint, Story, Retrospective) use standardized templates. Decisions are recorded in this log for traceability. |
| **Related ADRs** | — |
| **Related Phase** | Phase 2 — Patient Workflow Platform |
| **Related Epic** | GOV-002 |
| **Related Sprint** | GOV-002-S001 |

---

### D-007 — Company/Product Naming Migration (GOV-001)

**Date:** 2026-07-26
**Status:** ✅ Implemented
**Category:** Organization · Naming

| Field | Value |
|---|---|
| **Decision ID** | D-007 |
| **Date** | 2026-07-26 |
| **Status** | ✅ Implemented |
| **Category** | Organization · Naming |
| **Summary** | Formalized the AGS organizational naming taxonomy: Company=AGS, Platform=AI Platform, Product=Concierge, Public Brand=AG Synergy, Repository=concierge-website. Migrated all documentation references from "AGS Fertility" and "Hermes Website" to canonical names. |
| **Rationale** | Phase 1 scope expanded beyond a single app. Multiple products (Concierge, future Cyber, etc.) needed a consistent naming taxonomy so dashboards, ADRs, and governance documents refer to the same entities with the same names. |
| **Impact** | 55+ references updated across ~45 files. Repository renamed from `hermes-website` to `concierge-website`. Hermes/ source retains its name as the platform layer; only the organizational layer uses the AI Platform naming. Governance header becomes mandatory in all execution reports. |
| **Related ADRs** | ADR-004, ADR-005 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | GOV-001 |
| **Related Sprint** | GOV-001-S001 |

---

### D-006 — AI Platform Separation

**Date:** 2026-07-19
**Status:** ✅ Implemented
**Category:** Architecture

| Field | Value |
|---|---|
| **Decision ID** | D-006 |
| **Date** | 2026-07-19 |
| **Status** | ✅ Implemented |
| **Category** | Architecture |
| **Summary** | Separated the AI Platform (Hermes execution engine, authorization, workforce, security) from the Concierge product code. Created `hermes/` and `shared/` directories with provider-neutral interfaces. Concierge became a consumer of `@hermes/*` libraries. |
| **Rationale** | The authentication/authorization engine, execution platform, workforce orchestration, and security automation are reusable platform capabilities that should serve multiple AGS products. Embedding them in the Concierge Worker couples platform evolution to product release cycles. |
| **Impact** | 158/158 tests pass with AGS Fertility isolated and protected. Provider seams established (Capability Registry, Provider Loader, Transport Layer). Future products can consume `@hermes/*` without duplicating platform code. Extraction readiness assessed as High/Medium across all seams. |
| **Related ADRs** | ADR-005, ADR-006, ADR-007, ADR-008 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | EPIC-002-006 |
| **Related Sprint** | — |

---

### D-005 — Execution Gateway

**Date:** 2026-07-19
**Status:** ✅ Implemented
**Category:** Architecture · Security

| Field | Value |
|---|---|
| **Decision ID** | D-005 |
| **Date** | 2026-07-19 |
| **Status** | ✅ Implemented |
| **Category** | Architecture · Security |
| **Summary** | Established the Execution Gateway as the single, fail-closed enforcement point for all agent-originated operations. All agent actions pass through `canAgentAct()` (enabled AND active gate), `withinTenantScope()` (cross-org isolation), and `requirePermission()` (RBAC). |
| **Rationale** | Without a centralized execution gate, agent actions would bypass security controls. The gateway ensures deterministic, audit-logged enforcement before any AI action reaches business data. Fail-closed: the default state is denial. |
| **Impact** | All execution paths converge through the gateway. Audit logs record every allow and deny. Provider seam isolates vendor code. Tenant boundaries prevent cross-org data access. Agents disabled by default; human-gated activation. |
| **Related ADRs** | ADR-005, ADR-008 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | EPIC-003-001, EPIC-003-006 |
| **Related Sprint** | — |

---

### D-004 — Workforce Architecture

**Date:** 2026-07-19
**Status:** ✅ Implemented
**Category:** Architecture · Operations

| Field | Value |
|---|---|
| **Decision ID** | D-004 |
| **Date** | 2026-07-19 |
| **Status** | ✅ Implemented |
| **Category** | Architecture · Operations |
| **Summary** | Designed and implemented the AI Workforce as an orchestrated multi-agent system with clear lifecycle states (created→initialized→idle→running→waiting→completed→failed→terminated), human approval gates, and provider-neutral abstractions. Two agent types: Hermes Admin (infra/ops) and Operations Bot (business). |
| **Rationale** | Phase 1 required two distinct AI interfaces with separate authority boundaries. A single undifferentiated agent cannot safely serve both owner-level technical operations and business-operations staff. Workforce orchestration formalizes agent lifecycle, state transitions, and approval workflows. |
| **Impact** | Coordinator pattern manages agent lifecycle. Human approval gates are mandatory for destructive operations. All actions are permission-checked via RBAC. Agent registry provides discovery. Future agents can be added without restructuring the workforce model. |
| **Related ADRs** | ADR-002, ADR-005 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | EPIC-002-005, EPIC-003-005, EPIC-003-006 |
| **Related Sprint** | — |

---

### D-003 — Platform Constitution

**Date:** 2026-07-18
**Status:** ✅ Implemented
**Category:** Governance · Architecture

| Field | Value |
|---|---|
| **Decision ID** | D-003 |
| **Date** | 2026-07-18 |
| **Status** | ✅ Implemented |
| **Category** | Governance · Architecture |
| **Summary** | Established `PROJECT.md` as the project constitution — the highest-authority document governing vision, mission, engineering principles, security philosophy, development workflow, and definition of done. Formalized the docs-as-authority governance model with explicit hierarchy. |
| **Rationale** | Early development lacked a single authoritative reference. Documentation drifted from implementation. A constitution document establishes the permanent principles and governance model that all subsequent work references. |
| **Impact** | Clear documentation hierarchy (PROJECT.md → ROADMAP.md → ARCHITECTURE.md → CHANGELOG.md → CURRENT_SPRINT.md). Definition of Done includes governance dashboard updates. Amendment process via ADRs. All documents synchronized to the same governance model. |
| **Related ADRs** | ADR-001 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | EPIC-001-009 |
| **Related Sprint** | — |

---

### D-002 — Cloudflare-Native Architecture

**Date:** 2026-07-18
**Status:** ✅ Implemented
**Category:** Architecture · Infrastructure

| Field | Value |
|---|---|
| **Decision ID** | D-002 |
| **Date** | 2026-07-18 |
| **Status** | ✅ Implemented |
| **Category** | Architecture · Infrastructure |
| **Summary** | Chose Cloudflare Workers + D1 + R2 + Pages as the permanent infrastructure stack. Rejected the prior Express/PostgreSQL prototype. Zero third-party server dependencies — everything runs on Cloudflare's edge network. |
| **Rationale** | The Express/PostgreSQL prototype had scalability, operational overhead, and cost limitations for an early-stage product. Cloudflare's serverless edge platform provides global distribution, zero cold-start management, integrated D1 database, R2 object storage, and Pages hosting — all within a single operational boundary. |
| **Impact** | Single Worker API backend. D1 SQLite-compatible database with 24 tables. R2 configured for future document storage. Zero server management. Workers.dev preview environment for rapid iteration. Custom domain (api.agsynergy.ca) configured but pending production deploy. |
| **Related ADRs** | ADR-001 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | EPIC-001-001, EPIC-001-002, EPIC-001-005 |
| **Related Sprint** | EPIC-001 |

---

### D-001 — Phase 1 Scope & MVP Foundation

**Date:** 2026-07-18
**Status:** ✅ Implemented
**Category:** Product · Scope

| Field | Value |
|---|---|
| **Decision ID** | D-001 |
| **Date** | 2026-07-18 |
| **Status** | ✅ Implemented |
| **Category** | Product · Scope |
| **Summary** | Defined Phase 1 as the Digital Concierge Platform foundation — consultation intake, RBAC authorization, operations bots, Hermes execution platform, workforce orchestration, and frontend↔API integration. Deliberately excluded patient authentication, PHI handling, clinical features, and document management (deferred to Phase 2+). |
| **Rationale** | Building a patient-facing platform before the operational foundation was mature would introduce security and compliance risks. Phase 1 established the infrastructure, authorization, and operational tooling needed to safely build patient features in Phase 2. |
| **Impact** | 25 epics completed across 9 days. 465/465 tests passing. 24 database tables. Two Telegram bots (Operations + Admin) wire-ready. Hermes execution platform, provider framework, and workforce orchestration all operational. Known gaps documented for Phase 2 handoff. |
| **Related ADRs** | ADR-001, ADR-002, ADR-003 |
| **Related Phase** | Phase 1 — Digital Concierge Platform |
| **Related Epic** | All Phase 1 EPIC-001, EPIC-002, EPIC-003, EPIC-004 series |
| **Related Sprint** | Phase 1 Sprint |

---

## Append-Only Notice

This log is **append-only**. Entries are never deleted or edited after creation.
Corrections or superseding decisions are recorded as new entries referencing the original Decision ID.

No entry below this line.

---
*Last updated: 2026-07-26*
*Governance document — GOV-002*