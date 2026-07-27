# AI Platform Roadmap

> **Separate roadmap for the AI Platform — distinct from the Concierge product roadmap.**
> The AI Platform provides reusable capabilities that serve Concierge and future AGS products.
> **Last Updated:** 2026-07-27
> **Framework:** WEF v1.1
> **Governance Freeze:** Feature Complete (GOV-004)
> **Execution Framework:** WEF v1.1

---

## Governance Header

```
Company:        AGS
Business Unit:  Engineering
Platform:       AI Platform
Product:        Concierge (consumer — first adopter)
Public Brand:   AG Synergy
Repository:     concierge-website
Portfolio:      Clinical
Roadmap:        AI Platform Roadmap
Phase:          Phase 2 — Wave 6
Governance:     FROZEN (feature complete — GOV-004)
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
```

---

## Governance Note

AI Platform roadmap changes after GOV-004 require an engineering, architecture, or compliance justification.
Governance-only changes are no longer permitted.

---

## Phase A — Platform Foundation

### Objectives

Establish the reusable platform infrastructure that all future AI Platform capabilities depend on. Lay the foundation for provider-neutral, product-independent platform services.

### Capabilities

- Execution Platform (Work Planner, Workforce Dispatcher, Execution Queue, Review Pipeline)
- Provider Framework (Capability Registry, Provider Loader, Provider Discovery, Transport Layer)
- Workforce Orchestration (Coordinator, 8 lifecycle states, human approval gates)
- Security Automation (Security Agent, Risk Engine, OSS scanner adapters)
- Persistence Layer (Agent state store, Execution store, Workflow store)

### Dependencies

- Phase 1 infrastructure (Cloudflare Workers, D1, R2, Pages)
- Hermes agent platform

### Completion

| Capability | Status |
|---|---|
| Execution Platform | ✅ Live |
| Provider Framework | ✅ Live |
| Workforce Orchestration | ✅ Live |
| Security Automation | ✅ Live |
| Persistence Layer | ✅ Live |

### Status

**✅ Complete** — All Phase A capabilities are live and operational.

### Future Consumers

All subsequent phases consume these capabilities directly. No further Phase A work planned.

---

## Phase B — Trust & Identity

### Objectives

Provide provider-agnostic identity, authentication, authorization, and trust evaluation as reusable platform capabilities. Separate identity concerns from product logic.

### Capabilities

- Identity Core v1 (16 modules: JWT management with key rotation, MFA, passwordless auth, credential rotation, OAuth providers, session management, rate limiting, Zero Trust hooks, audit & identity events)
- Provider Abstractions (Google, OIDC provider-agnostic interfaces)
- Trust & Identity Architecture (8 architecture documents, ADR-010)
- Threat Model & Security Assessment
- PHI Security Architecture (PHI boundary and encryption)
- Platform Identity Interfaces (12 reusable interface contracts)
- Workforce Identity (AI agent identity lifecycle)

### Dependencies

- Phase A capabilities (Execution Platform, Security Automation, Provider Framework)
- D1 database

### Completion

| Capability | Status |
|---|---|
| Trust & Identity Architecture | ✅ Complete (Wave 1) |
| Identity Core v1 Implementation | ✅ Complete (Wave 3) — 514 tests, 16 modules, D1 migration 0002 |
| PHI Security Architecture | ✅ Complete |
| Platform Identity Interfaces | ✅ Complete |
| Workforce Identity | ✅ Complete (14 agent types) |
| Policy Engine Implementation | 📋 Wave 3+ |
| Consent & Trust Implementation | 📋 Wave 3+ |
| Full D1 persistence backends | 📋 Phase 2+ |

### Status

**Wave 1 Architecture Complete → Wave 3 Implementation Complete (Wave 2 skipped as architecture-only was not needed)**

Wave 4 (Consent Orchestration Implementation) is scoped separately as Phase 2 Wave 4, not an AI Platform wave.

### Future Consumers

- Concierge (Patient Authentication) — Wave 3
- Any future AGS product requiring identity & authentication

---

## Phase C — Governance (Architecture Complete)

### Objectives

Establish the governance framework that ensures all AI Platform and product capabilities meet engineering standards, maturity criteria, and compliance requirements.

### Capabilities

- Policy Engine (deterministic policy evaluation: RBAC + ABAC + Time + Context + Consent + Trust, policy hierarchy, conflict resolution, fail-closed)
- Consent & Trust Management (10 consent types, immutable consent records, consent lifecycle, session-bound snapshots, trust evaluation across 6 dimensions, PIPEDA/PHIPA/CASL compliance)
- Capability Registry (11-capability inventory, dependency map, product mapping, risk register, maintenance schedule)
- Platform Engineering Standards (110 mandatory standards across 19 categories)
- Capability Maturity Model (8 levels: Concept → Architecture → Prototype → Development → Production Ready → Operational → Deprecated → Retired)

### Dependencies

- Phase B capabilities (Trust & Identity)
- ADR-011 (AI Platform Governance Core)

### Completion

| Capability | Status |
|---|---|
| Policy Engine — Architecture | ✅ Architecture Complete (Wave 2) |
| Consent & Trust — Architecture | ✅ Architecture Complete (Wave 2) |
| Capability Registry | ✅ Complete (Wave 2) |
| Engineering Standards | ✅ Complete (Wave 2) — 110 standards, 19 categories |
| Capability Maturity Model | ✅ Complete (Wave 2) — 8 levels |
| Workforce Identity Expansion | ✅ Complete (Wave 2) — 14 agent types |
| Policy Engine — Implementation | 📋 Wave 3+ |
| Consent & Trust — Implementation | 📋 Wave 3+ |
| Workforce Identity — Implementation | 📋 Wave 3+ |

### Status

**✅ Architecture Complete (Wave 2) — All capability designs finalized.**

**Implementation deferred to Wave 3+** alongside Identity Core v1 implementation.

### Future Consumers

All AI Platform capabilities and future consumer products. Governance standards apply universally.

---

## Phase D — Core Runtime

### Objectives

Implement the production-ready core runtime for the AI Platform. Make all architecture-complete capabilities operational with full persistence, monitoring, and operational tooling.

### Capabilities

- Project State & Execution Registry (PSER) — canonical machine-readable source of truth for project state, execution history, workforce assignments, resume points, and governance gates. Architecture complete (11 interfaces, 26-table D1 schema, workforce integration protocol).
- Full D1 persistence backends for all platform capabilities
- Postgres/KV backends for production scale
- Runtime health monitoring for all platform services
- Automated failover and recovery
- Cross-product service mesh

### Dependencies

- Phase A (Foundation) operational
- Phase B (Trust & Identity) implementation complete
- Phase C (Governance) implementation complete

### Completion

| Capability | Status |
|---|---|
| Full D1 persistence backends | 📋 Planned |
| Project State & Execution Registry (PSER) — Architecture | ✅ Architecture Complete |
| Postgres/KV backends | 📋 Future (Phase 3+) |
| Runtime monitoring | 📋 Planned |
| Automated failover | 📋 Planned |
| PSER — Implementation (D1 schema + service layer) | 📋 Wave 1 |
| PSER — Workforce adoption | 📋 Wave 2 |
| PSER — Dashboard auto-generation | 📋 Wave 3 |

### Status

**📋 Planned** — PSER architecture complete. Implementation dependent on Phase B and Phase C completion, then proceeds in 3 implementation waves.

### Future Consumers

All AGS products and platform capabilities.

---

## Phase E — Release Management

### Objectives

Provide standardized, repeatable, and auditable deployment workflows for all AGS products. Eliminate environment ambiguity, deployment inconsistencies, and ad-hoc release practices. Every product consumes the same environment model, promotion process, and rollback architecture.

### Capabilities

- Release Management Architecture (environment model, deployment lifecycle, promotion flow, rollback strategy)
- Environment Strategy (Dev/Preview/Production tier model, config management, secrets isolation)
- Deployment Pipeline (Build → Deploy → Verify → Record pipeline for Workers and Pages)
- Release Metadata Standard (version, commit, deployment ID, environment, timestamp, platform/product version)
- Smoke Test Framework (reusable, product-agnostic health, auth, API, identity, consent, policy tests)
- Rollback Strategy (checkpoint-based, operator-approved, PSER-integrated recovery)
- Preview Promotion Process (gate-driven, criteria-evaluated, operator-approved promotion)
- Platform Interfaces (10 interfaces: ReleaseService, EnvironmentService, DeploymentService, PromotionService, RollbackService, SmokeTestService, ReleaseRegistry, VersionResolver, DeploymentHistory, PromotionGate)

### Dependencies

- Phase D (Core Runtime) — PSER for execution registry and checkpoints
- Phase A (Foundation) — Deployment infrastructure (Workers, Pages, D1, KV, R2)
- Phase C (Governance) — Engineering standards, capability maturity model

### Completion

| Capability | Status |
|------------|--------|
| Release Management Architecture | ✅ Architecture Complete |
| Environment Strategy | ✅ Architecture Complete |
| Deployment Pipeline | ✅ Architecture Complete |
| Release Metadata Standard | ✅ Architecture Complete |
| Smoke Test Framework | ✅ Architecture Complete |
| Rollback Strategy | ✅ Architecture Complete |
| Preview Promotion Process | ✅ Architecture Complete |
| Platform Interfaces (10 interfaces) | ✅ Architecture Complete |
| Implementation — D1 schema + service layer | 📋 Wave 2 |
| Implementation — CI/CD integration | 📋 Wave 3 |
| Implementation — Multi-product adoption | 📋 Wave 4 |

### Status

**✅ Architecture Complete (Wave 1) — All 8 architecture documents, environment model, pipeline design, interface contracts, and rollback strategy designed.**

Implementation deferred to Wave 2+ alongside other platform capabilities.

### Future Consumers

- Concierge (first adopter) — Wave 2
- Any future AGS product requiring standardized deployment

---

## Phase F — Workforce Intelligence

### Objectives

Enhance workforce agent capabilities with intelligent routing, adaptive scheduling, and predictive resource allocation. The AGS Workforce becomes a self-optimizing execution system.

### Capabilities

- Intelligent agent routing and load balancing
- Adaptive scheduling and capacity planning
- Predictive resource allocation based on sprint velocity
- Workforce analytics and trend analysis
- Automated bottleneck detection and escalation

### Dependencies

- Phase D (Core Runtime) operational
- Phase C (Governance) standards enforced
- 514+ tests validating workforce orchestration

### Completion

| Capability | Status |
|---|---|
| Intelligent agent routing | 📋 Planned |
| Adaptive scheduling | 📋 Planned |
| Predictive resource allocation | 📋 Planned |
| Workforce analytics | 📋 Planned |
| Automated bottleneck detection | 📋 Planned |

### Status

**📋 Planned** — Long-term workforce intelligence capabilities.

### Future Consumers

AGS Workforce agents, all product implementations, and cross-product coordination.

---

## Phase G — Memory

### Objectives

Implement persistent, cross-session memory for the AI Platform and workforce agents. Enable continuity of context, learning, and decision-making across execution cycles.

### Capabilities

- Agent memory persistence across sessions
- Cross-workforce learning and pattern recognition
- Decision memory (repeating decisions avoided)
- Context carry-over between sprints and waves
- Long-term capability growth tracking

### Dependencies

- Phase D (Core Runtime) with D1 persistence
- Phase E (Workforce Intelligence) baseline

### Completion

| Capability | Status |
|---|---|
| Agent memory persistence | 📋 Planned |
| Cross-workforce learning | 📋 Planned |
| Decision memory | 📋 Planned |
| Context carry-over | 📋 Planned |
| Capability growth tracking | 📋 Planned |

### Status

**📋 Planned** — Future enhancement for workforce continuity.

### Future Consumers

All AGS workforce agents and products.

---

## Phase H — Autonomous Planning

### Objectives

Enable the AI Platform to autonomously plan and schedule work waves with minimal human oversight while maintaining governance compliance and human-in-the-loop approval gates.

### Capabilities

- Automated wave planning and prioritization
- Self-optimizing sprint scheduling
- Cross-product dependency resolution
- Automatic resource estimation
- Governance gate automation (advisory, not autonomous)

### Dependencies

- Phase E (Workforce Intelligence) operational
- Phase F (Memory) operational
- WEF v1.1 compliance (Human Operator retains final authority)

### Completion

| Capability | Status |
|---|---|
| Automated wave planning | 📋 Planned |
| Self-optimizing sprint scheduling | 📋 Planned |
| Cross-product dependency resolution | 📋 Planned |
| Automatic resource estimation | 📋 Planned |
| Governance gate automation | 📋 Planned |

### Status

**📋 Planned** — Advanced autonomy capabilities subject to WEF human oversight requirements.

### Future Consumers

AGS Workforce, all products, and cross-product coordination.

---

## Phase I — Multi-product Portfolio

### Objectives

Extend the AI Platform to serve multiple AGS products simultaneously. Platform capabilities become product-agnostic and configurable per product needs.

### Capabilities

- Multi-product capability registry extension
- Product-specific configuration profiles
- Cross-product shared services
- Product isolation and tenancy
- Product-specific governance profiles (within platform standards)

### Dependencies

- Phases A–H all substantially complete
- AGS second product identified and scoped
- WEF v1.1 governs all implementation work

### Completion

| Capability | Status |
|---|---|
| Multi-product registry | 📋 Planned |
| Product configuration profiles | 📋 Planned |
| Cross-product shared services | 📋 Planned |
| Product isolation and tenancy | 📋 Planned |
| Product governance profiles | 📋 Planned |

### Status

**📋 Planned** — Requires a second AGS product to justify multi-product architecture.

### Future Consumers

All AGS products beyond Concierge.

---

## Phase J — Marketplace

### Objectives

Create an external provider marketplace for AI capabilities, identity providers, and tooling that extends the AI Platform's provider framework to third-party providers.

### Capabilities

- External provider registration and discovery
- Provider safety and compliance certification
- Capability marketplace with versioning
- Provider rating and trust system
- Marketplace governance and curation

### Dependencies

- Phase D (Core Runtime) with full persistence
- Phase C (Governance) enforced for all marketplace participants
- External provider security standards

### Completion

| Capability | Status |
|---|---|
| External provider registry | 📋 Planned |
| Provider certification | 📋 Planned |
| Capability marketplace | 📋 Planned |
| Provider rating system | 📋 Planned |
| Marketplace governance | 📋 Planned |

### Status

**📋 Planned** — Long-term platform extensibility.

### Future Consumers

Third-party AI providers, external identity providers, tooling vendors.

---

## Phase K — Enterprise Platform

### Objectives

Transform the AI Platform into a full enterprise-grade platform suitable for deployment across large-scale healthcare organizations, multi-tenant environments, and regulated industries.

### Capabilities

- Enterprise multi-tenancy with strict isolation
- Regulatory compliance automation (HIPAA, PHIPA, GDPR)
- Enterprise SSO and identity federation
- Audit trail at enterprise scale
- Enterprise deployment and operations tooling

### Dependencies

- Phases A–J all substantially complete
- Enterprise security standards
- Regulatory compliance framework (PIPEDA/PHIPA/CASL already designed in Phase B)

### Completion

| Capability | Status |
|---|---|
| Enterprise multi-tenancy | 📋 Planned |
| Regulatory compliance automation | 📋 Planned |
| Enterprise SSO / identity federation | 📋 Planned |
| Enterprise audit trail | 📋 Planned |
| Enterprise operations tooling | 📋 Planned |

### Status

**📋 Planned** — Enterprise-grade platform evolution.

### Future Consumers

Healthcare organizations, clinic networks, enterprise customers.

---

## Roadmap Hierarchy Reference

```
Company        AGS
    ↓
Platform       AI Platform
    ↓
Product        Concierge
    ↓
Roadmap        AI Platform Roadmap (this document)
  └─ Phase (A–K)
       └─ Wave
            └─ Epic
                 └─ Sprint
                      └─ Story / Task
```

---

*This roadmap is authoritative. Updates require engineering, architecture, or compliance justification under the governance freeze (GOV-004).*
*Execution framework: WEF v1.1 (Workforce Execution Framework)*
*AGS Workforce executes work. WEF defines how work is executed.*