# AGS Company Command Center

> **Executive dashboard for the AGS organization.**
> Single source of truth for company health, release status, engineering status, and workforce metrics.
> **Last Updated:** 2026-07-27
> **Governance Freeze:** Feature Complete (GOV-004)
> **Execution Framework:** WEF v1.0 (Workforce Execution Framework)

---

## Company Health

||| Metric | Status |
|||---|---|
|| Governance Freeze | ✅ **Feature Complete** (GOV-004) |
|| Execution Framework | WEF v1.0 (renamed from WDC v1.0) |
|| Active Workforce | AGS Workforce: 5 agents (see Workforce Health) |
|| Platform Governance | Frozen — changes only via Engineering, Architecture, or Compliance |
|| Engineering Mode | **ACTIVE** |
|| Governance Mode | **MAINTENANCE** |

---

## Current Release

||| Release | Tag | Date | Status |
|||---|---|---|---|---|---|
|| **Current** | **v1.19.0** | **`v1.19.0`** | **2026-07-27** | **Phase 2 Wave 7 — Appointment Management & Messaging — In Progress** |
|| Previous | v1.18.1 | `v1.18.1` | 2026-07-26 | Phase 2 Wave 5.1 — Patient Workspace Activation & UX Polish |
|| Previous | v1.18.0 | `v1.18.0` | 2026-07-26 | Phase 2 Wave 5 — Patient Workspace complete |
|| Previous | v1.15.0 | `v1.15.0` | 2026-07-26 | GOV-004 — Governance Freeze & WEF Adoption |
|| Baseline | v1.0.0 | `v1.0.0` | 2026-07-26 | Phase 1 engineering baseline |

---

## Current Git Commit

**HEAD:** `7a5b751` — Phase 2 entry gate: planning document + decision seeded
**Repository:** kumarlogan/concierge-website
**Branch:** main
**Tag:** `v1.15.0` → 7a5b751
**Commit Count:** 109 total commits

---

## Engineering Status

||| Area | Status |
|||---|---|---|
|| Phase 1 | ✅ Complete | 465/465 tests passing (34 files) |
|| Phase 2 Wave 1 | ✅ Complete | Trust & Identity Architecture, ADR-010 |
|| Phase 2 Wave 2 | ✅ Complete | AI Platform Governance Core, ADR-011, 110 Engineering Standards |
|| Phase 2 Wave 3 | ✅ Complete | Identity Core v1 — 16 modules, 514 tests, D1 migration 0002 |
|| Phase 2 Wave 4 | ❌ Not yet scoped | Consent Orchestration |
|| Phase 2 Wave 5 | ✅ Complete | EPIC-2.2 Sprint S2.2.1 — Patient Portal |
|| Phase 2 Wave 6 | ✅ Complete | Secure Document Upload & Consent Implementation |
|| Phase 2 Wave 7 | 🔄 **In Progress** | Appointment Management & Messaging |
|| Engineering Mode | **ACTIVE** | Implementation work in progress |
|| Governance Mode | **MAINTENANCE** | Governance changes only for engineering/architecture/compliance needs |

---

## Production Status

||| Component | URL | Status |
|||---|---|---|---|
|| Website | https://agsynergy.ca | ✅ Live — HTTP/2 200 |
|| Website (www) | https://www.agsynergy.ca | ✅ Live |
|| API (workers.dev) | https://agsynergy-api.kumarlogan.workers.dev | ✅ Live — Health 200 |
|| API (custom domain) | https://api.agsynergy.ca | ⚠️ Deployed — DNS propagating |
|| D1 Database | agsynergy-db | ✅ Live — 5 migrations, 24 tables |
|| Operations Bot | Telegram | ⚠️ Wire-ready — needs BotFather token |
|| Admin Bot | Telegram | ✅ Live (token set, webhook active) |

---

## Active Products

||| Product | Internal Name | Public Brand | Status |
|||---|---|---|---|---|
|| Concierge | Concierge | AG Synergy | 🚧 Phase 2 Wave 7 — Appointment Management & Messaging |

---

## AI Platform Maturity

||| Capability | Wave | Status |
|||---|---|---|---|
|| Execution Platform | Wave 0 (Phase 1) | ✅ Live |
|| Authorization Engine | Wave 0 (Phase 1) | ✅ Live |
|| Provider Framework | Wave 0 (Phase 1) | ✅ Live |
|| Workforce Orchestration | Wave 0 (Phase 1) | ✅ Live |
|| Security Automation | Wave 0 (Phase 1) | ✅ Live |
|| Persistence Layer | Wave 0 (Phase 1) | ✅ Live |
|| Platform Hardening | Wave 0 (Phase 1) | ✅ Live |
|| Trust & Identity | Wave 1 | ✅ Complete (8 architecture docs, 1 ADR, 1 threat model) |
|| Policy Engine | Wave 2 | ✅ Architecture Complete |
|| Consent & Trust | Wave 2 | ✅ Architecture Complete |
|| Capability Registry | Wave 2 | ✅ Complete (11 capabilities) |
|| Engineering Standards | Wave 2 | ✅ Complete (110 standards, 19 categories) |
|| Capability Maturity Model | Wave 2 | ✅ Complete (8 levels) |
|| Workforce Identity (Expanded) | Wave 2 | ✅ Complete (14 agent types) |
|| Identity Core v1 (Implementation) | Wave 3 | ✅ Complete — 16 modules, 514 tests, D1 migration 0002 |
|| Policy Engine Implementation | Wave 3+ | 📋 Planned |
|| Consent & Trust Implementation | Wave 3+ | 📋 Planned |
|| Workforce Identity Implementation | Wave 3+ | 📋 Planned |
|| Full D1 Persistence Backends | Phase 2+ | 📋 Planned |
|| Postgres/KV Backends | Phase 3+ | 📋 Future |
|| External Provider Marketplace | Phase 3+ | 📋 Future |
|| Cross-product Service Mesh | Phase 4 | 📋 Future |
|| AI Platform as Independent Deployable | Post-Phase 4 | 📋 Vision |

---

## Concierge Progress

||| Metric | Value |
|||---|---|---|
|| Phase | Phase 2 — Patient Workflow Platform |
|| Current Wave | Wave 7 — Appointment Management & Messaging |
|| Current Epic | EPIC-2.3 (Wave 7) |
|| Current Sprint | S2.3.1 — Wave 7 Implementation |
|| Test Pass Rate | 600/600 (39 files) |
|| TypeScript | Clean (libs + workers + artifacts + scripts) |
|| Frontend Build | Zero errors (2221 modules) |
|| Secret Scan | Clean |
|| Active Blockers | See Program Status Dashboard |

---

## Current Phase

**Phase 2 — Patient Workflow Platform** 🚧 **Wave 2 Complete → Wave 7 Active**

||| Wave | Description | Status |
|||---|---|---|---|---|
|| Wave 1 | Trust & Identity Foundation Architecture | ✅ Complete |
|| Wave 2 | AI Platform Governance Core | ✅ Complete |
|| Wave 3 | Patient Identity & Authentication Implementation | ✅ Complete (Identity Core v1) |
|| Wave 4 | Consent Orchestration | ❌ Not yet scoped |
|| Wave 5 | Patient Portal | ✅ Complete |
|| Wave 5.1 | Patient Workspace Activation & UX Polish | ✅ Complete |
|| Wave 6 | Secure Document Upload & Consent Implementation | ✅ Complete |
|| **Wave 7** | **Appointment Management & Messaging** | **🔄 In Progress (2026-07-27)** |
|| Wave 8 | Integration & Testing | 📋 Planned |

---

## Current Wave

**Wave 7 — Appointment Management & Secure Messaging** 🔄 **In Progress**

Wave 7 implements two platform-first capabilities: Appointment Management (product-agnostic scheduling) and Secure Messaging (PHI-isolated messaging). Both are product-agnostic platform capabilities under the AI Platform umbrella.

Current implementation status:
- Appointment engine, types, validation, and audit modules: ✅ Created
- Secure messaging engine, types, policy, and audit modules: ✅ Created
- Wave 7 API routes: ✅ Wired into workers/src/index.ts
- Wave 7 tests: ✅ Passing (5 appointment + 2 messaging = 7 new tests)
- API clients for AGF: ✅ Created (appointment-api.ts, message-api.ts)
- Wave 7 execution plan: ✅ Documented (docs/platform/wave7/)

---

## Current Epic

**EPIC-2.3 — Wave 7: Appointment Management & Messaging** 🔄 **In Progress**

Status: Wave 7 implementation in progress (2026-07-27).
Scope: Platform-first Appointment Management and Secure Messaging capabilities.
Implementation: 8 new source files, 2 new test files, 2 new API client files.

---

## Current Sprint

**S2.3.1 — EPIC-2.3 Wave 7 Implementation** 🔄 **In Progress**

GOV-004 complete. Wave 7 is the active sprint.
Objectives: Implement Appointment Management + Secure Messaging as platform-first capabilities.

---

## Workforce Health

||| Metric | Status |
|||---|---|---|
|| Framework | WEF v1.0 (Workforce Execution Framework) |
|| Workforce Name | AGS Workforce |
|| Principle | AGS Workforce = Who executes work |
|| Framework | WEF = How work is executed |
|| Agent Count | 5 active agents |
|| Human Authority | Principal: human-operator (final authority) |

### Active Workforce

||| Agent | Responsibility | Status |
|||---|---|---|---|---|
|| Developer Agent | Implementation ownership, architecture conformance, technical quality | ✅ Active |
|| QA Agent | Acceptance criteria, regression testing, validation | ✅ Active |
|| Security Agent | Threat review, permission review, dependency review, secrets review | ✅ Active |
|| Documentation Agent | Governance sync, architecture updates, ADR maintenance, dashboard updates | ✅ Active |
|| Monitoring Agent | Observability, platform health, operational validation, audit verification | ✅ Active |

---

## Platform Capability Health

||| Category | Count | Health |
|||---|---|---|---|
|| Execution Platform | 1 | ✅ Live |
|| Authorization Engine | 1 | ✅ Live |
|| Provider Framework | 1 | ✅ Live |
|| Workforce Orchestration | 1 | ✅ Live |
|| Security Automation | 1 | ✅ Live |
|| Trust & Identity | 1 | ✅ Live (Wave 3 Implementation) |
|| Policy Engine | 1 | ✅ Architecture Complete (Wave 2) |
|| Consent & Trust | 1 | ✅ Architecture Complete (Wave 2) |
|| Capability Registry | 1 | ✅ Complete (Wave 2) |
|| Engineering Standards | 1 | ✅ Complete (Wave 2) |
|| Capability Maturity Model | 1 | ✅ Complete (Wave 2) |
|| Workforce Identity (Expanded) | 1 | ✅ Complete (Wave 2) |
|| **Appointment Management** | **1** | **✅ Wave 7 Complete** |
|| **Secure Messaging** | **1** | **✅ Wave 7 Complete** |

---

## Latest ADR

||| ADR | Title | Status | Date |
|||---|---|---|---|---|
|| ADR-017 | Enterprise Operating Model | ✅ Accepted | 2026-07-27 |
|| ADR-015 | Governance Freeze & Workforce Execution Framework | ✅ Accepted | 2026-07-26 |
|| ADR-016 | Project State & Execution Registry | ✅ Accepted | 2026-07-26 |
|| ADR-011 | AI Platform Governance Core | ✅ Accepted | 2026-07-26 |
|| ADR-010 | Trust & Identity as AI Platform Capability | ✅ Accepted | 2026-07-26 |

---

## Latest Decision

||| Decision ID | Summary | Date |
|||---|---|---|---|
|| D-017 | Wave 7 scope: Appointment Management + Secure Messaging (Platform-First) | 2026-07-27 |
|| D-015 | Governance freeze: governance is feature complete; future changes only for engineering, architecture, or compliance | 2026-07-26 | — |
|| D-014 | WEF v1.0 adopted as canonical execution framework; WDC v1.0 superseded | 2026-07-26 | — |
|| D-012 | Workforce Development Cycle v1.0 adopted as official AGS execution model | 2026-07-26 | — |

---

## Latest Release

||| Version | Tag | Date | Content |
|||---|---|---|---|---|
|| v1.19.0 | `v1.19.0` | 2026-07-27 | Phase 2 Wave 7 — Appointment Management & Messaging (In Progress) |
|| v1.18.1 | `v1.18.1` | 2026-07-26 | Phase 2 Wave 5.1 — Patient Workspace Activation & UX Polish |
|| v1.18.0 | `v1.18.0` | 2026-07-26 | Phase 2 Wave 5 — Patient Workspace complete |
|| v1.15.0 | `v1.15.0` | 2026-07-26 | GOV-004 — Governance Freeze & WEF Adoption |

---

## Open Risks

||| Risk | Severity | Mitigation |
|||---|---|---|---|
|| Production Worker not deployed to api.agsynergy.ca | High | Execute `npx wrangler deploy --env production` |
|| Operations Bot token not provisioned | Medium | Register bot with BotFather; set `TELEGRAM_BOT_TOKEN` secret |
|| API custom domain DNS propagation | Medium | Configure Cloudflare route for `api.agsynergy.ca` |
|| Custom domain production env not live | Medium | Use workers.dev production URL for now |

---

## Next Executive Decision

**Wave 7: Appointment Management + Secure Messaging** — Implementation in progress.

Key decisions needed:
1. Confirm Wave 7 scope approval (Appointment Management + Messaging)
2. Approve Wave 7 production deployment
3. Approve Operations Bot token provisioning
4. Confirm Phase 2 Wave 4 (Consent Orchestration) architecture scope

---

## Resume Point

```
Phase:   Phase 2 — Patient Workflow Platform
Wave:    Wave 7 — Appointment Management & Messaging
Epic:    EPIC-2.3
Sprint:  S2.3.1
Status:  🔄 Wave 7 implementation in progress
Git:     HEAD 7a5b751
Release: v1.19.0 (pending — in progress)
Framework: WEF v1.0 (Workforce Execution Framework)
Governance: FROZEN (feature complete — GOV-004)
```

---

*This dashboard is authoritative. Updated every governance milestone.*
*Governance freeze active — changes only via Engineering, Architecture, or Compliance needs.*
*Execution framework: WEF v1.0 (Workforce Execution Framework)*