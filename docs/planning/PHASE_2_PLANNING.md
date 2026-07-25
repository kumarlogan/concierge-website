# Phase 2 — Patient Workflow Platform

> **Formal Phase Planning Document.**
> This document defines scope, epics, estimates, resources, and risks for Phase 2.
> Approval from Product Owner is required before implementation begins.

**Company:** AGS
**Platform:** AI Platform
**Product:** Concierge
**Public Brand:** AG Synergy
**Repository:** concierge-website
**Roadmap:** Concierge Roadmap
**Phase:** Phase 2 — Patient Workflow Platform
**Status:** 📋 Planning — Awaiting Approval
**Phase Version:** 1.0
**Last Updated:** 2026-07-25

---

## 1. Phase Metadata

| Field | Value |
|---|---|
| **Phase** | Phase 2 — Patient Workflow Platform |
| **Status** | 📋 Planning (awaiting approval) |
| **Owner** | TBD |
| **Estimated Duration** | 4–6 weeks (initial estimate; refined per epic) |
| **Risk Level** | Medium — PHI handling introduces compliance requirements |
| **Dependencies** | Phase 1 (✅ Complete), GOV-002 (✅ Complete), RBAC Engine (✅ Complete) |
| **Governance** | GOV-002, GOV-001 |

---

## 2. Phase Objective

Establish the patient-facing platform foundation — secure patient authentication, personal portal, document management, appointment scheduling, and direct concierge messaging. This phase transforms Concierge from an internal operations tool into a patient-accessible service.

---

## 3. Scope

### 3.1 In Scope

| Area | Description |
|---|---|
| Patient Identity & Authentication | Registration, login, session management, password recovery, patient-specific RBAC |
| Patient Portal & Dashboard | Journey timeline, consultation history, status tracking |
| Secure Document Upload | R2-backed upload, patient document management, PHI-protected storage |
| Appointment Management | Scheduling, reminders, status tracking, cancellation |
| Concierge Messaging | Direct patient-to-concierge communication, thread management |
| PHI Protection | Encryption, access audit, segregation boundary enforcement |

### 3.2 Out of Scope

| Area | Target Phase |
|---|---|
| Clinic dashboards and accounts | Phase 3 |
| Multi-clinic coordination | Phase 3+ |
| Shared patient journey views | Phase 3 |
| AI-assisted operations | Phase 4 |
| Payments and billing | Phase 4 |
| Multi-language i18n | Post-MVP |
| Mobile application | Responsive web covers Phase 2 |

---

## 4. Epics

### Epic 2.1 — Patient Identity & Authentication

| Field | Value |
|---|---|
| **Priority** | P0 — Foundation for all Phase 2 work |
| **Status** | 📋 Planning — Sprint 2.1.1 defined |
| **Estimated Effort** | 2 sprints (Sprint 2.1.1: Architecture & Data Model, Sprint 2.1.2: Implementation) |
| **Sprints** | Sprint 2.1.1 (design), Sprint 2.1.2 (code + test) |
| **Key Risk** | Authentication provider lock-in, PHI compliance gaps |
| **Dependencies** | RBAC Engine (✅), D1 Database (✅) |

**Key deliverables:**
- Patient account registration and verification
- Authentication flows (login, logout, session management)
- Password reset and recovery
- Patient-specific RBAC (patient role, permissions)
- PHI protection boundary enforcement

### Epic 2.2 — Patient Portal & Dashboard

| Field | Value |
|---|---|
| **Priority** | P1 — Patient-facing UI |
| **Status** | 📋 Future — depends on Epic 2.1 |
| **Estimated Effort** | 1–2 sprints |
| **Key Risk** | Frontend complexity, responsive design |
| **Dependencies** | Epic 2.1 (Patient Identity) |

### Epic 2.3 — Secure Document Upload

| Field | Value |
|---|---|
| **Priority** | P1 — Core patient capability |
| **Status** | 📋 Future — depends on Epic 2.1 |
| **Estimated Effort** | 1 sprint |
| **Key Risk** | R2 configuration, file validation, PHI compliance |
| **Dependencies** | Epic 2.1, R2 (✅ Configured) |

### Epic 2.4 — Appointment Management

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Status** | 📋 Future |
| **Estimated Effort** | 1–2 sprints |
| **Key Risk** | Scheduling complexity, conflict detection |
| **Dependencies** | Epic 2.1 |

### Epic 2.5 — Concierge Messaging

| Field | Value |
|---|---|
| **Priority** | P2 |
| **Status** | 📋 Future |
| **Estimated Effort** | 1–2 sprints |
| **Key Risk** | Real-time notification, message threading |
| **Dependencies** | Epic 2.1 |

---

## 5. Resource Plan

| Role | Headcount | Availability | Notes |
|---|---|---|---|
| Engineering Lead | 1 | Full-time | Architecture + implementation |
| Product Owner | TBD | Part-time | Scope + priority decisions |
| Security Review | On-demand | Per design review | PHI compliance review needed |
| Frontend Engineer | Shared | Phase 2 epics 2.2+ | Not needed for Sprint 2.1.1 |

---

## 6. Estimated Timeline

| Phase 2 Week | Sprint | Epic | Milestone |
|---|---|---|---|
| Week 1–2 | Sprint 2.1.1 | 2.1 | Architecture & Data Model (design complete) |
| Week 3–5 | Sprint 2.1.2 | 2.1 | Patient Identity & Authentication (implemented) |
| Week 5–6 | Sprint 2.2.1 | 2.2 | Patient Portal & Dashboard (MVP) |
| Week 6–7 | Sprint 2.3.1 | 2.3 | Secure Document Upload (MVP) |
| Week 7–8 | Sprint 2.4.1 | 2.4 | Appointment Management (MVP) |
| Week 8–9 | Sprint 2.5.1 | 2.5 | Concierge Messaging (MVP) |

*All estimates are initial and will be refined per epic during execution.*

---

## 7. Risk Assessment

| Risk | Likelihood | Impact | Severity | Mitigation |
|---|---|---|---|---|
| PHI compliance gaps | Medium | High | **High** | Design review with security; encrypt PHI fields; audit all access |
| Authentication provider lock-in | Low | Medium | **Medium** | Provider-neutral `PatientIdentityResolver` seam |
| Session management complexity | Medium | Medium | **Medium** | Evaluate JWT vs cookie sessions early; document trade-offs |
| Data model migration conflicts | Low | Medium | **Medium** | Design with backward compatibility; test against existing 24 tables |
| Resource availability (TBD owner) | High | Medium | **Medium** | Assign owner before Sprint 2.1.1 begins |
| Sprint timeline overruns | Medium | Low | **Low** | Refine estimates at each sprint planning |

---

## 8. Acceptance Criteria

- [ ] Patients can register, log in, and manage their account
- [ ] Patients can view their consultation journey timeline
- [ ] Patients can upload documents securely
- [ ] Patients can schedule and manage appointments
- [ ] Patients can message their concierge
- [ ] All patient data protected by PHI controls
- [ ] No regression in existing Phase 1 functionality
- [ ] All 465+ Phase 1 tests continue to pass

---

## 9. Dependencies

| Dependency | Type | Status |
|---|---|---|
| Phase 1 Complete | Internal | ✅ Complete |
| GOV-002 Governance Framework | Internal | ✅ Complete |
| RBAC Engine (Phase 1) | Internal | ✅ Complete |
| D1 Database | Internal | ✅ Live (24 tables) |
| R2 Object Storage | Internal | ✅ Configured |
| Cloudflare Workers | Internal | ✅ Live |
| Operations Bot token (Phase 1 blocker) | External | ⚠️ Not resolved — does not block Phase 2 technical work |

---

## 10. Sign-off

> Phase 2 may begin only when all Phase Gate entry criteria (EC-1 through EC-9) are verified
> and this document is signed by the Product Owner.

| Role | Name | Signature | Date |
|---|---|---|---|
| **Product Owner** | — | — | — |
| **Engineering Lead** | — | — | — |

*Pending approval.*

---

## 11. Phase Gate Checklist

| # | Criterion | Status | Evidence |
|---|---|---|---|
| EC-1 | Previous phase exit documented | ✅ | PHASE_1_EXIT.md complete |
| EC-2 | Previous blockers resolved or risk-accepted | ⚠️ | Operations Bot token P2 — risk-accepted; does not block Phase 2 |
| EC-3 | Phase planning document approved | ❓ | **This document** — pending Product Owner sign-off |
| EC-4 | Governance dashboards current | ✅ | All three dashboards updated 2026-07-25 |
| EC-5 | Decision Log seeded for Phase 2 | ✅ | D-009 added (Phase 2 scope) |
| EC-6 | CHANGELOG synchronized | ✅ | v1.14.0, SERVICE_VERSION = "1.14.0" |
| EC-7 | Test suite baseline recorded | ✅ | 465/465 tests (34 files) |
| EC-8 | Git state clean | ✅ | Committed 7eecc12, tagged v1.14.0 |
| EC-9 | Phase Gate Checklist signed off | ❓ | Pending EC-3 approval |

**Gate verdict:** ⏳ **Gate held — awaiting Product Owner approval of PHASE_2_PLANNING.md (EC-3).**

---

## 12. Resume Point

```
Current plan:  PHASE_2_PLANNING.md created
Last action:   Phase 2 entry gate assessment complete
                - EC-1 ✅ EC-2 ⚠️ EC-3 ❓ EC-4 ✅ EC-5 ✅ EC-6 ✅ EC-7 ✅ EC-8 ✅ EC-9 ❓
Next action:   PHASE_2_PLANNING.md requires Product Owner sign-off
                → Once approved: verify all gates green
                → Begin Sprint 2.1.1 — Architecture & Data Model
Git commit:    7eecc12 (v1.14.0 — GOV-002)
```

---

*This document is part of the Phase 2 entry gate process.*
*No implementation work begins until sign-off is complete.*
*Governance document — GOV-002*
*Last updated: 2026-07-25*