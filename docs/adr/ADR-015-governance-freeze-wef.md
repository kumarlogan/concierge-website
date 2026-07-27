# ADR-015 — Governance Freeze & Workforce Execution Framework

> **Status:** ✅ Accepted
> **Date:** 2026-07-26
> **Phase:** Phase 2 — Wave 5 (GOV-004)
> **Category:** Process · Governance · Framework Transition

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Repository:     concierge-website
ADR:            ADR-015 — Governance Freeze & Workforce Execution Framework
Status:         ✅ Accepted
Author:         AI Platform Governance
```

---

## Context

Phase 2 Wave 2 completed the AI Platform Governance Core (ADR-011), establishing Engineering Standards (110 mandatory standards), Capability Maturity Model (8 levels), Capability Registry (11 capabilities), Policy Engine architecture, Consent & Trust architecture, Workforce Identity expansion (14 agent types), and a full governance framework.

GOV-003 established the Workforce Development Cycle (WDC) v1.0 as the official AGS execution model. GOV-003 is now superseded by GOV-004, which:

1. Declares governance feature complete and freezes further governance expansion
2. Renames WDC v1.0 to WEF v1.0 (Workforce Execution Framework)
3. Formally documents the AGS Workforce (who executes) vs. WEF (how work is executed) distinction
4. Establishes the AGS Company Command Center (COMPANY_STATUS.md)
5. Separates the AI Platform Roadmap from the Concierge Roadmap (AI_PLATFORM_ROADMAP.md)
6. Synchronizes all governance dashboards

---

## Decision

### Governance Freeze

Governance is hereby declared **Feature Complete**. Future governance changes occur ONLY when required by:

- **Engineering** — new engineering patterns, standards, or frameworks
- **Architecture** — architecture decisions affecting governance structure
- **Compliance** — regulatory or legal requirements

No standalone governance waves after GOV-004.

### WEF Adoption

The Workforce Development Cycle (WDC) v1.0 is officially renamed to the Workforce Execution Framework (WEF) v1.0. WEF v1.0 is the direct successor to WDC v1.0 and becomes the single canonical execution framework for all AGS engineering work.

### AGS Workforce and WEF Relationship

- **AGS Workforce** = **Who** executes work — the human operator plus five workforce agents (Developer, QA, Security, Documentation, Monitoring)
- **WEF** = **How** work is executed — the execution framework governing process, phases, gates, and responsibilities

The AGS Workforce uses WEF to execute work. WEF does not replace the AGS Workforce — it structures it.

### Human Operator Authority

The Human Operator retains final authority over all execution decisions. WEF gates are advisory; human approval is required at each gate. No autonomous deployment, merge, roadmap changes, or scope expansion.

### Company → Platform → Product Relationship

```
Company (AGS) — the legal entity, the who
  ↓
Platform (AI Platform) — organizational layer, reusable capabilities
  ↓
Product (Concierge) — the first and current product
  ↓
Roadmap (AI Platform Roadmap / Concierge Roadmap) — directional
  ↓
Phase → Wave → Epic → Sprint → Story → Task — execution hierarchy
```

The AI Platform provides reusable capabilities; Concierge is the first consumer. Future AGS products will consume the same platform capabilities.

---

## Consequences

### Positive

1. **Clear governance boundary** — governance expansion is complete; engineering focus returns to implementation
2. **Framework naming accuracy** — "Execution Framework" correctly reflects that WEF governs HOW work is executed, not a development lifecycle
3. **Workforce clarity** — the who (AGS Workforce) vs. how (WEF) distinction removes ambiguity about agent roles and framework scope
4. **Reduced governance overhead** — no more governance waves to plan, track, and synchronize
5. **Audit trail integrity** — WDC v1.0 references preserved in ADRs and changelog for historical accuracy
6. **Dashboard synchronization** — all dashboards now reference COMPANY_STATUS.md, AI_PLATFORM_ROADMAP.md, governance freeze, and WEF v1.0 consistently

### Negative

1. **Terminology migration effort** — all WDC references must be updated to WEF across 9+ files
2. **Historical reference preservation** — changelog and audit trail must retain WDC terminology where historically accurate
3. **Framework rigidity** — governance freeze means governance can only evolve via engineering/architecture/compliance needs, not governance-only expansion

### Risks

|| Risk | Likelihood | Impact | Mitigation |
||---|---|---|---|
| WEF terminology confusion during transition | Medium | Low | GOVERNANCE_FREEZE.md documents the relationship; WDC preserved historically |
| Governance changes attempted under false pretext | Medium | Medium | Freeze enforcement relies on Human Operator judgment; all changes require engineering/architecture/compliance justification |
| Dashboard desynchronization during WEF migration | Low | Medium | WEF migration is a find-and-replace across known files; validation step confirms consistency |

---

## Related Documents

|| Document | Path |
||---|---|---|
| GOVERNANCE_FREEZE.md | `docs/governance/GOVERNANCE_FREEZE.md` | Governance freeze documentation |
| COMPANY_STATUS.md | `docs/governance/COMPANY_STATUS.md` | Company Command Center dashboard |
| AI_PLATFORM_ROADMAP.md | `docs/platform/AI_PLATFORM_ROADMAP.md` | Separate AI Platform roadmap |
| ADR-014 | `docs/decisions/ADR-014-workforce-development-cycle.md` | WDC v1.0 adoption (superseded by ADR-015) |
| ADR-011 | `docs/decisions/ADR-011-ai-platform-governance-core.md` | AI Platform Governance Core |
| WORKFORCE_DEVELOPMENT_CYCLE.md | `docs/governance/WORKFORCE_DEVELOPMENT_CYCLE.md` | Preserved with historical note (superseded by WEF) |
| GOVERNANCE_INDEX.md | `docs/governance/GOVERNANCE_INDEX.md` | Updated with ADR-015 registration |
| DECISION_LOG.md | `docs/governance/DECISION_LOG.md` | D-014 and D-015 entries |
| PROJECT.md | `PROJECT.md` | WDC → WEF references updated |
| ROADMAP.md | `ROADMAP.md` | WDC → WEF references updated |
| ARCHITECTURE.md | `ARCHITECTURE.md` | WDC → WEF references updated |
| PROGRAM_STATUS.md | `docs/governance/PROGRAM_STATUS.md` | Updated with WEF and governance freeze |
| CURRENT_SPRINT.md | `docs/planning/CURRENT_SPRINT.md` | GOV-004 closed, next sprint set |
| NAMING_STANDARDS.md | `NAMING_STANDARDS.md` | AGS Workforce → WEF hierarchy documented |
| AI_PLATFORM_STATUS.md | `docs/governance/AI_PLATFORM_STATUS.md` | WEF references updated, governance freeze referenced |
| PRODUCT_STATUS.md | `docs/products/concierge/PRODUCT_STATUS.md` | WEF references updated |

---

## Related ADRs

|| ADR | Relationship |
||---|---|
| ADR-014 | Superseded by ADR-015 (WDC v1.0 → WEF v1.0 rename) |
| ADR-011 | Related — AI Platform Governance Core |
| ADR-010 | Related — Trust & Identity Platform Capability |

---

## Version History

|| Version | Date | Change |
||---|---|---|---|
| 1.0.0 | 2026-07-26 | Initial adoption — GOV-004 (Governance Freeze & WEF adoption) |

---

*ADR accepted 2026-07-26. This record is append-only — corrections via new ADR referencing ADR-015.*