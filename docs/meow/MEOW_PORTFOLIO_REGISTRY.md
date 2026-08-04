# MEOW — Portfolio Registry

> **Document:** MEOW_PORTFOLIO_REGISTRY.md
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

## 1. Portfolio Overview

Hermes manages products. Products own implementations. The Portfolio Registry registers only Executive metadata — not product documentation. Each portfolio entry contains the metadata required for Executive visibility and governance.

---

## 2. Portfolio Entries

### 2.1 Concierge (AG Synergy)

| Field | Value |
|---|---|
| Product | Concierge |
| Repository | kumarlogan/concierge-website |
| Current Version | v1.1.0 (per CHANGELOG.md) |
| Current Wave | Wave 8 |
| Current Release | RC1 (patient portal phase 1) |
| Health | Operational |
| Owner | Hermes Platform |
| Current Initiative | Executive Architecture (MEOW) |
| Current Phase | Executive Architecture Freeze |
| Architecture Status | Frozen |
| Release Status | Active — RC1 in production |
| Certification Status | Certified (WAS, EPCL, PES) |
| Synchronization Status | OCI ↔ GitHub bidirectional |
| Dependencies | Cloudflare Workers, Cloudflare Pages, D1, R2 |
| Last Executive Review | 2026-08-04 |

### 2.2 Hermes Platform (OCI)

| Field | Value |
|---|---|
| Product | Hermes Platform |
| Repository | Hermes OCI (local workspace) |
| Current Version | v1.0 (Foundation) |
| Current Wave | Foundation Complete |
| Current Release | Hermes-Foundation-v1.0 |
| Health | Operational |
| Owner | Hermes Platform |
| Current Initiative | Foundation → Product Execution transition |
| Current Phase | Foundation Freeze |
| Architecture Status | Frozen |
| Release Status | Foundation released, tagged Hermes-Foundation-v1.0 |
| Certification Status | Certified (Foundation, Governance, Security, Operational) |
| Synchronization Status | OCI authoritative for platform; GitHub for product |
| Dependencies | None (Foundation layer) |
| Last Executive Review | 2026-08-04 |

---

## 3. Portfolio Metadata Schema

Each portfolio entry contains exactly these fields:

| Field | Type | Description |
|---|---|---|
| Product | string | Product name |
| Repository | string | Git repository identifier |
| Current Version | string | Semver version |
| Current Wave | string | Active wave identifier |
| Current Release | string | Active release identifier |
| Health | enum | Operational / Degraded / Offline |
| Owner | string | Owning department/platform |
| Current Initiative | string | Active strategic initiative |
| Current Phase | string | Active phase in lifecycle |
| Architecture Status | enum | Frozen / Active / Deprecated |
| Release Status | enum | Active / Staging / Pending / Rolled Back |
| Certification Status | enum | Certified / In Progress / Not Certified |
| Synchronization Status | enum | OCI ↔ GitHub / OCI Only / GitHub Only |
| Dependencies | list | External dependencies |
| Last Executive Review | ISO 8601 | Date of last executive review |

---

## 4. Portfolio Registry — Canonical Owner

| Registry | Owner | Location |
|---|---|---|
| Portfolio Registry | Hermes Platform | docs/meow/MEOW_PORTFOLIO_REGISTRY.md |

No duplicate portfolio registries exist. This is the single authoritative source.

---

## 5. Cross-References

| Reference | Target |
|---|---|
| CHANGELOG.md | Version history for Concierge |
| ROADMAP.md | Strategic roadmap for Hermes |
| PROJECT.md | Product definition |
| ARCHITECTURE.md | Architecture overview |
| CAPABILITY_REGISTRY.md | Registered capabilities |
| EXECUTIVE_COMMAND_CENTER.md | Command center dashboard |
| RELEASE_DASHBOARD.md | Release dashboard |

---

*MEOW Deliverable 2 of 15*
