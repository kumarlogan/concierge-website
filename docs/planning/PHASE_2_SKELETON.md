# Phase 2 — Patient Workflow Platform

> **Initial planning skeleton.**
> Planning only — no implementation work has begun.

**Company:** AGS
**Platform:** AI Platform
**Product:** Concierge
**Public Brand:** AG Synergy
**Repository:** concierge-website
**Roadmap:** Concierge Roadmap
**Phase:** Phase 2 — In Planning
**Status:** 📋 Planning Skeleton
**Last Updated:** 2026-07-26
**Governance:** GOV-002

---

## Phase Metadata

| Field | Value |
|---|---|
| **Phase** | Phase 2 — Patient Workflow Platform |
| **Status** | 📋 Planning Skeleton (no implementation) |
| **Owner** | TBD |
| **Dependencies** | Phase 1 (complete), GOV-002 (in progress) |
| **Risk Level** | Medium — PHI handling introduces compliance requirements |

---

## 1. Objectives

Establish the patient-facing platform foundation — secure patient authentication, personal portal, document management, appointment scheduling, and direct concierge messaging. This phase transforms the Concierge from an internal operations tool into a patient-accessible service.

## 2. Scope

### In Scope

- Patient identity and authentication (Epic 2.1)
- Patient portal and journey dashboard
- Secure document upload (R2-backed)
- Appointment management (scheduling, reminders, status)
- Patient data protection and PHI compliance

### Out of Scope

- Clinic accounts and dashboards (Phase 3)
- Multi-clinic coordination (Phase 3+)
- AI-assisted operations (Phase 4)
- Mobile application (responsive web covers Phase 2)
- Payments/billing (Phase 4)
- Multi-language i18n (post-MVP)

---

## 3. Epics

### Epic 2.1 — Patient Identity & Authentication

**Status:** 📋 Planning Skeleton

Secure patient identity management with registration, authentication, session management, and password recovery. Introduces `PatientIdentityResolver` and patient-specific RBAC roles.

**Key deliverables:**
- Patient account registration and verification
- Authentication flows (login, logout, session management)
- Password reset and recovery
- Patient-specific RBAC (patient role, permissions)
- PHI protection boundary enforcement

**Sprints:**
- Sprint 2.1.1 — Architecture & Data Model (planning skeleton below)
- Sprint 2.1.2 — Implementation (future)

### Epic 2.2 — Patient Portal & Dashboard

**Status:** 📋 Future (not yet planned)

### Epic 2.3 — Secure Document Upload

**Status:** 📋 Future (not yet planned)

### Epic 2.4 — Appointment Management

**Status:** 📋 Future (not yet planned)

### Epic 2.5 — Concierge Messaging

**Status:** 📋 Future (not yet planned)

---

## 4. Sprint 2.1.1 — Architecture & Data Model

> **Initial planning skeleton only.**
> First sprint of Epic 2.1.

**Sprint ID:** Sprint 2.1.1
**Status:** 📋 Planning Skeleton
**Owner:** TBD

### Sprint Objective

Design and document the patient identity architecture, authentication flows, data model, and PHI protection strategy. Approved by security review before any implementation.

### Deliverables

1. Architecture document — Patient Identity & Authentication design (`docs/architecture/PATIENT_IDENTITY.md`)
2. ADR for patient authentication approach (JWT vs session vs OAuth)
3. Patient data model — new D1 tables with PHI segregation design
4. PHI protection and compliance design document
5. Sprint 2.1.2 implementation plan

### Acceptance Criteria

- [ ] Patient authentication architecture documented and approved
- [ ] ADR written and accepted
- [ ] Patient data model designed with PHI segregation
- [ ] PHI compliance documented (encryption, access, audit)
- [ ] Sprint 2.1.2 implementation plan completed

### Definition of Done

- [ ] All architecture documents reviewed and approved
- [ ] ADR accepted
- [ ] Data model migration plan ready
- [ ] Security review passed
- [ ] Phase gate entry criteria met for Sprint 2.1.2

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| PHI compliance gaps | Medium | High | Design review with security; encrypt PHI fields; audit all access |
| Authentication provider lock-in | Low | Medium | Provider-neutral interface; `PatientIdentityResolver` seam |
| Session management complexity | Medium | Medium | Evaluate JWT vs cookie sessions early; document trade-offs |
| Data model migration conflicts | Low | Medium | Design with backward compatibility; test against existing 24 tables |

---

## 5. Phase 2 Out of Scope (Explicit)

The following are explicitly excluded from Phase 2:

- **Clinic dashboards and accounts** — Phase 3
- **Shared patient journey views** — Phase 3
- **Clinic-side document upload** — Phase 3
- **Treatment milestone tracking** — Phase 3
- **Operational analytics** — Phase 3
- **Third-party API ecosystem** — Phase 4
- **AI-assisted operational intelligence** — Phase 4
- **Multi-clinic coordination** — Phase 4
- **Payments and billing** — Phase 4

---

## 6. Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 1 Complete | Internal | ✅ Complete |
| GOV-002 Governance Framework | Internal | 🚧 In Progress |
| RBAC Engine (Phase 1) | Internal | ✅ Complete |
| D1 Database | Internal | ✅ Live (24 tables) |
| R2 Object Storage (configured) | Internal | ✅ Configured |
| Cloudflare Workers (deployed) | Internal | ✅ Live |

---

## 7. Acceptance Criteria

- [ ] Patients can register, log in, and manage their account
- [ ] Patients can view their consultation journey timeline
- [ ] Patients can upload documents securely
- [ ] Patients can schedule and manage appointments
- [ ] Patients can message their concierge
- [ ] All patient data protected by PHI controls
- [ ] No regression in existing Phase 1 functionality
- [ ] All 465+ Phase 1 tests continue to pass

---

## 8. Definition of Done

All conditions from `PHASE_GATES.md` must be met. Additionally:

- [ ] Phase 2 exit report published
- [ ] All Phase 2 epics documented and closed
- [ ] Patient data protection verified
- [ ] Phase 3 handoff prepared

---

## 9. Resume Point

```
Phase file created: /home/ubuntu/concierge-website/docs/planning/PHASE_2_SKELETON.md
Last action:   Phase 2 planning skeleton created (GOV-002)
Next action:   Begin Epic 2.1 — Patient Identity & Authentication
               Sprint 2.1.1: Architecture & Data Model
               1. Read existing ADRs (ADR-001–008, 012–013)
               2. Design patient authentication approach
               3. Write ADR for patient auth decision
               4. Design patient data model with PHI segregation
Git commit:    (pending GOV-002 close)
```

---

*Planning skeleton only — no implementation work has begun.*
*Governance document — GOV-002*
*Last updated: 2026-07-26*