# MEOW — Executive Memory

> **Document:** MEOW_EXECUTIVE_MEMORY.md
> **Version:** 1.0.0
> **Date:** 2026-08-04
> **Status:** Draft — Awaiting Product Owner Approval
> **Owner:** Hermes Platform
> **Repository:** concierge-website (GitHub) + Hermes OCI
> **Audit Type:** READ-ONLY — no code changes, no commits, no deployments

---

## Governance Header

```
Company:        AGS
Platform:       Hermes AI Platform
Product:        Concierge (AG Synergy)
Public Brand:   AG Synergy
Repository:     concierge-website
Roadmap:        Hermes Strategic Roadmap
Phase:          Executive Architecture — MEOW
```

---

## 1. Purpose

Executive Memory connects decisions, releases, capabilities, portfolio, knowledge, roadmap, execution, and certification. All links are explicit — nothing is orphaned.

---

## 2. Memory Domains

### 2.1 Decisions

| Domain | File | Links To |
|---|---|---|
| Decision Log | docs/governance/DECISION_LOG.md | Roadmap, Capabilities, Releases |
| ADR-012 | docs/adr/ADR-012-admin-platform-facade.md | Architecture, Governance |
| ADR-013 | docs/adr/ADR-013-admin-bff-workforce-foundations.md | Workforce, Architecture |
| ADR-015 | docs/adr/ADR-015-governance-freeze-wef.md | Governance, Roadmap |
| ADR-016 | docs/adr/ADR-016-project-state-execution-registry.md | PSER, Execution |
| ADR-017 | docs/adr/ADR-017-enterprise-operating-model.md | Architecture, Governance |
| ADR-018 | docs/adr/ADR-018-executive-planning-control-layer.md | EPCL, Execution |

### 2.2 Releases

| Domain | File | Links To |
|---|---|---|
| CHANGELOG.md | CHANGELOG.md | Portfolio, Roadmap |
| RELEASE_OPERATIONS.md | docs/ops/RELEASE_OPERATIONS.md | Gates, Certification |
| RELEASE_GATES.md | docs/ops/RELEASE_GATES.md | Execution Registry |
| RELEASE_CERTIFICATION.md | docs/ops/RELEASE_CERTIFICATION.md | Certification |
| RELEASE_CERTIFICATION_FINAL.md | docs/ops/RELEASE_CERTIFICATION_FINAL.md | Certification |
| WAVE4_RELEASE_NOTES.md | docs/ops/WAVE4_RELEASE_NOTES.md | Roadmap |
| WAVE5_RELEASE_NOTES.md | docs/ops/WAVE5_RELEASE_NOTES.md | Roadmap |

### 2.3 Capabilities

| Domain | File | Links To |
|---|---|---|
| CAPABILITY_REGISTRY.md | docs/platform/capability-registry/CAPABILITY_REGISTRY.md | All capabilities |
| EPCL_ARCHITECTURE.md | docs/platform/executive-planning-control/EPCL_ARCHITECTURE.md | Execution Registry |
| WAS_ARCHITECTURE.md | docs/platform/workforce-activation/WAS_ARCHITECTURE.md | Execution Registry |
| PSER_ARCHITECTURE.md | docs/platform/project-state-registry/PSER_ARCHITECTURE.md | Execution Registry |

### 2.4 Portfolio

| Domain | File | Links To |
|---|---|---|
| Portfolio Registry | docs/meow/MEOW_PORTFOLIO_REGISTRY.md | All products |
| PRODUCT_STATUS.md | docs/products/concierge/PRODUCT_STATUS.md | Releases, Roadmap |
| PROJECT.md | PROJECT.md | Roadmap, Architecture |

### 2.5 Knowledge

| Domain | File | Links To |
|---|---|---|
| KNOWLEDGE_GRAPH.md | docs/KNOWLEDGE_GRAPH.md (OCI) | Memory Schema, Self Improvement |
| MEMORY_SCHEMA.md | docs/MEMORY_SCHEMA.md (OCI) | Knowledge Graph |
| SELF_IMPROVEMENT_ENGINE.md | docs/SELF_IMPROVEMENT_ENGINE.md (OCI) | Knowledge Graph |
| SKILLS.md | docs/SKILLS.md (OCI) | Skills Index |

### 2.6 Roadmap

| Domain | File | Links To |
|---|---|---|
| MEOW_ROADMAP.md | docs/meow/MEOW_ROADMAP.md | All domains |
| ROADMAP.md | docs/ROADMAP.md | Portfolio, Releases |
| WEF_V2_ARCHITECTURE_REVIEW.md | docs/architecture/WEF_V2_ARCHITECTURE_REVIEW.md | Architecture, Roadmap |

### 2.7 Execution

| Domain | File | Links To |
|---|---|---|
| MEOW_EXECUTION_REGISTRY.md | docs/meow/MEOW_EXECUTION_REGISTRY.md | All execution states |
| EXECUTION_MODES.md | docs/ops/EXECUTION_MODES.md | Execution Registry |
| EXECUTION_GUIDE.md | docs/ops/EXECUTION_GUIDE.md | Execution Registry |

### 2.8 Certification

| Domain | File | Links To |
|---|---|---|
| FOUNDATION_CERTIFICATION.md | docs/certification/FOUNDATION_CERTIFICATION.md | All certifications |
| GOVERNANCE_CERTIFICATION.md | docs/certification/GOVERNANCE_CERTIFICATION.md | Governance |
| SECURITY_CERTIFICATION.md | docs/certification/SECURITY_CERTIFICATION.md | Security |
| WAVE4_CERTIFICATION.md | docs/ops/WAVE4_CERTIFICATION.md | Runtime |
| ORGANIZATION_CERTIFICATION.md | docs/ops/ORGANIZATION_CERTIFICATION.md | Organization |

---

## 3. Duplication Removal

| Duplicate | Primary | Resolution |
|---|---|---|
| Decision Log (governance) vs ADRs | ADRs are authoritative | Governance log references ADRs |
| Knowledge docs (OCI vs GitHub) | OCI is authoritative for platform docs | GitHub has sync copies |
| Memory schema (OCI vs GitHub) | OCI is authoritative | GitHub has sync copies |

---

## 4. Connection Map

```
Decisions ──→ Releases ──→ Capabilities ──→ Portfolio
    │              │               │                │
    ↓              ↓               ↓                ↓
Knowledge ──→ Roadmap ──→ Execution ──→ Certification
```

Every domain links to every other domain. No orphaned memory.

---

*MEOW Deliverable 8 of 15*
