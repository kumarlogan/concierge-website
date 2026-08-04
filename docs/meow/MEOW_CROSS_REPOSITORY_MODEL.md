# MEOW — Cross-Repository Model

> **Document:** MEOW_CROSS_REPOSITORY_MODEL.md
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

Define the cross-repository model: Hermes (OCI) owns the Executive Platform; GitHub owns Product Implementation. Synchronize metadata only — do not mirror documentation.

---

## 2. Repository Roles

### 2.1 Hermes OCI — Executive Platform

| Domain | Ownership | Contents |
|---|---|---|
| Executive Office | Hermes | Command center, dashboards, executive reports |
| Runtime | Hermes | WAS, EPCL, PES, execution engine |
| Governance | Hermes | Phase gates, decision log, certification |
| Capabilities | Hermes | Capability Registry, execution registry |
| Portfolio Registry | Hermes | Portfolio metadata |
| Executive Memory | Hermes | Memory schema, knowledge graph |
| Platform Architecture | Hermes | ARCHITECTURE.md, ROADMAP.md, AUTOMATIONS.md |
| Foundation | Hermes | Foundation certification, freeze docs |

### 2.2 GitHub (Concierge) — Product Implementation

| Domain | Ownership | Contents |
|---|---|---|
| Product Docs | GitHub | PROJECT.md, ARCHITECTURE.md, SECURITY.md |
| Product Releases | GitHub | CHANGELOG.md, release notes |
| Product UX | GitHub | Frontend, user-facing documentation |
| Product Code | GitHub | Workers, frontend source code |
| Product Governance | GitHub | PROGRAM_STATUS.md, CURRENT_SPRINT.md |
| Product Certifications | GitHub | Product-specific certifications |
| Product Roadmap | GitHub | Product-specific roadmap |

---

## 3. Synchronization Model

### 3.1 Sync Direction

```
Hermes OCI (authoritative for platform)
    ↓ (metadata sync)
GitHub (authoritative for product)
```

### 3.2 What Syncs

| Item | Source | Target | Frequency |
|---|---|---|---|
| ROADMAP.md | OCI → GitHub | Per roadmap update |
| ARCHITECTURE.md | OCI → GitHub | Per architecture change |
| PROJECT.md | OCI → GitHub | Per project change |
| GOVERNANCE_INDEX.md | OCI → GitHub | Per governance update |
| Portfolio metadata | OCI → GitHub | Per portfolio change |
| Capability metadata | OCI → GitHub | Per capability change |
| Execution metadata | OCI → GitHub | Per execution change |

### 3.3 What Does NOT Sync

| Item | Rationale |
|---|---|
| Documentation content | GitHub owns product docs |
| Test results | Product-specific |
| Deployment evidence | Product-specific |
| Release notes | Product-specific |
| Source code | Product-specific |
| Configuration files | Product-specific |

---

## 4. Cross-Repository Dependencies

```
Hermes OCI                    GitHub
    │                            │
    ├── Platform Architecture ──→ Product Architecture
    ├── Capability Registry ────→ Product Capabilities
    ├── Execution Registry ─────→ Product Execution
    ├── Provider Registry ──────→ Product Providers
    ├── Tool Registry ──────────→ Product Tools
    ├── Portfolio Registry ─────→ Product Portfolio
    ├── Executive Memory ───────→ Product Memory
    ├── Governance Framework ───→ Product Governance
    └── Release Framework ──────→ Product Releases
```

---

## 5. No Documentation Mirroring

Hermes OCI does not mirror GitHub documentation. GitHub does not mirror Hermes OCI documentation. Only metadata synchronizes.

---

## 6. Conflict Resolution

| Conflict Type | Resolution |
|---|---|
| Platform vs Product docs | Platform docs (OCI) are authoritative for platform; Product docs (GitHub) are authoritative for product |
| Version conflicts | OCI version is authoritative for platform; GitHub version is authoritative for product |
| Architecture conflicts | OCI architecture is authoritative |
| Governance conflicts | OCI governance is authoritative |

---

*MEOW Deliverable 11 of 15*
