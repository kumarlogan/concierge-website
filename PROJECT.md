### Documentation Principles

- **Modular** — each document covers one domain, cross-referenced not duplicated
- **Concise** — say what is necessary, nothing more
- **Version controlled** — documentation lives in the repository alongside code
- **Human readable** — clear language, good structure, accessible to new contributors
- **AI readable** — structured, well-formatted, machine-parseable where appropriate

---

## 11. Definition of Done

A task is complete only when all of the following conditions are met:

| Condition | Verification |
|---|---|
| WEF Compliance | Implementation completed per Workforce Execution Framework (WEF v1.0, supersedes WDC v1.0). See [COMPANY_STATUS.md](docs/governance/COMPANY_STATUS.md) for current execution status. |
| Implementation completed | Code is written and committed |
| Testing completed | Unit tests pass; integration tests pass where applicable; manual testing performed where automated testing is not feasible |
| Documentation updated | Affected documentation files are updated in the same pull request |
| Build successful | CI pipeline passes: lint, typecheck, test, build |
| Deployment ready | Change is merged to `main` and deployable; deployment is automated or documented |
| No unresolved critical issues | No known bugs, security vulnerabilities, or broken functionality introduced |
| **Governance dashboards updated** | **Program, AI Platform, and Product dashboards updated to reflect new state** |

Partial completion is not completion. A feature that works but is not documented
is not done. A feature that is documented but not tested is not done. The
definition of done is binary: all conditions are met, or the task is not done.

---

## 12. Future Platform Vision

The platform evolves through distinct phases. Each phase builds on the previous
one and delivers independently useful capabilities.

### AI Platform Roadmap

[AI Platform Roadmap](docs/platform/AI_PLATFORM_ROADMAP.md) — separate roadmap for the AI Platform, distinct from this Concierge product roadmap.

---

### Concierge Roadmap

[Concierge Roadmap](ROADMAP.md) — the product-specific roadmap for Concierge, the first and current AGS product. See also the [AI Platform Roadmap](docs/platform/AI_PLATFORM_ROADMAP.md) for platform-level capabilities.

### Platform Evolution

```
Static Website
  |
  v
Digital Concierge Platform
  |
  v
Patient Management System
  |
  v
Clinic Collaboration Platform
  |
  v
AI-Assisted Operations Platform
```
|---|---|---|
| Phase 0 · Static Website | ✅ Complete | Marketing site with treatment information, clinic profiles, consultation form |
| Phase 1 · Digital Concierge Platform | ✅ **Complete** (2026-07-26) | Structured backend, Workers API, D1 database, RBAC authorization engine, Operations Telegram Bot, Admin Bot, Workforce Orchestration Platform, Execution Gateway, Provider Framework, frontend ↔ API integration |
||| Phase 2 · Patient Workflow Platform | ✅ **Complete** — All 9 waves delivered (v1.22.0-dev) | Waves 1–9 complete. Final Phase 2 wave: Concierge Launch & Platform Activation. |
|| Phase 3 · Clinic Collaboration Platform | 📋 Planned | Clinic dashboards, shared patient journey views, document management, treatment milestone tracking |
|| Phase 4 · AI-Assisted Operations Platform | 📋 Planned | Intelligent automation, predictive insights, operational intelligence, analytics |

### MVP Declaration

| Attribute | Value |
|---|---|
| **Phase 1** | ✅ **Complete** (2026-07-26) |
| **MVP** | ✅ Phase 1 / MVP Foundation engineering complete |
| **Commercial Launch** | ⚠️ **Not declared.** Engineering completion only. |
| **Test Suite** | ✅ 465/465 passing (34 test files) |
| **TypeScript** | ✅ Clean compilation (libs + workers + artifacts + scripts) |
| **Frontend Build** | ✅ Zero errors (2221 modules) |
| **Secret Scan** | ✅ Clean |
| **Infrastructure** | ✅ Live: agsynergy.ca, agsynergy-api Workers, agsynergy-db D1 |
|| **Next Phase** | Phase 3 — AI-Enhanced Patient Experience (TBD) |

Phase 1 engineering is complete. No commercial launch should be inferred from this declaration. The platform is operational but has not been marketed, sold, or offered as a commercial product. This declaration is an engineering milestone only.

Each phase is an independent value delivery. The platform does not need to reach
the final phase to be useful. Each phase solves real problems for real users.

### Governance Dashboard Synchronization (GOV-004)

All governance dashboard files synchronized to reference Company Dashboard, AI Platform Roadmap, Governance Freeze, and WEF v1.0. See GOVERNANCE_FREEZE.md for the governance freeze scope. See CHANGELOG.md for the GOV-004 release entry.

| Dashboard | Path | Purpose |
|---|---|---|
| Program Status | `docs/governance/PROGRAM_STATUS.md` | Executive dashboard — full org view |
| AI Platform Status | `docs/governance/AI_PLATFORM_STATUS.md` | Reusable platform capabilities |
| Product Status | `docs/products/concierge/PRODUCT_STATUS.md` | Concierge product health, MVP checklist, testing, tech debt |
| Phase Exit | `docs/releases/PHASE_1_EXIT.md` | Permanent phase closeout record |
| Production Enablement | `docs/governance/PRODUCTION_ENABLEMENT_REPORT.md` | Production readiness baseline |
| WEF Compliance | `docs/governance/WORKFORCE_DEVELOPMENT_CYCLE.md` (historical) / `docs/governance/GOVERNANCE_FREEZE.md` | Workforce Execution Framework (WEF v1.0, supersedes WDC v1.0) execution framework (GOV-004) |

Every epic completion MUST update:
- The three status dashboards (if the epic affects their metrics)
- `CURRENT_SPRINT.md` (to reflect new completed work)
- `CHANGELOG.md` (to record the release)
- WEF compliance records (when implementation work is executed under WEF v1.0)

---

## Governance

This document may only be amended through a documented decision process. Proposed
changes must be:

1. Documented as an ADR or amendment proposal
2. Reviewed by the project lead
3. Applied consistently across all affected documentation

The current version of this document is the authoritative reference. Previous
versions are preserved in git history.

---

*End of Project Constitution. Version 1.1, ratified 2026-07-26.*