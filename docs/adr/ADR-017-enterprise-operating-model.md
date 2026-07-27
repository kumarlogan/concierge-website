# ADR-017 — Enterprise Operating Model

> **Status:** ✅ Accepted
> **Date:** 2026-07-27
> **Phase:** Enterprise Governance
> **Category:** Architecture · Governance · Enterprise · Operating Model

---

## Governance Header

```
Company:        AGS
Business Unit:  Executive Office
Document:       ADR-017 — Enterprise Operating Model
Status:         ✅ Accepted
Author:         Enterprise Architecture
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
```

---

## Context

AGS has operated as an engineering-centric organization. The hierarchy has been:

```
Company → Platform → Product → Roadmap → Phase → Epic → Sprint → Story → Task
```

This model has three fundamental problems:

1. **No business unit layer.** Engineering is implicitly the only business unit.
   Future business units (Marketing, Sales, Operations, Finance, Legal, etc.)
   have no defined slot in the hierarchy.

2. **WEF is engineering-only.** The Workforce Execution Framework is described
   as an engineering framework. Future workforces cannot adopt it without
   restructuring.

3. **PSER is engineering-only.** The Project State & Execution Registry tracks
   engineering state. Future business units have no execution tracking.

4. **Platform/Product relationship is ambiguous.** The platform model states
   "platforms never own products" but the hierarchy doesn't reflect this
   separation.

5. **No portfolio layer.** Products may have multiple portfolios (clinical,
   operational, commercial) but there is no hierarchy level for them.

6. **No wave layer.** The hierarchy jumps from Phase directly to Epic, but
   the actual execution model uses Waves as intermediate units.

---

## Decision

### 1. New Enterprise Hierarchy

Adopt the following permanent enterprise hierarchy:

```
Company
  │
  ├── Business Unit
  │     ├── Platform
  │     │     ├── Product
  │     │     │     ├── Portfolio
  │     │     │     │     ├── Roadmap
  │     │     │     │     │     ├── Phase
  │     │     │     │     │     │     ├── Wave
  │     │     │     │     │     │     │     ├── Epic
  │     │     │     │     │     │     │     │     ├── Sprint
  │     │     │     │     │     │     │     │     │     ├── Story
  │     │     │     │     │     │     │     │     │     │     ├── Task
```

### 2. WEF v1.1 — Enterprise Execution Framework

WEF becomes the **AGS Enterprise Execution Framework** — not just engineering.
All workforces follow the same WEF phases, gates, and principles.

| Change | From | To |
|--------|------|----|
| Scope | Engineering | All business units |
| Version | WEF v1.0 | WEF v1.1 |
| Workforce | Engineering Workforce (5 agents) | All enterprise workforces |
| Gates | Engineering-specific | Universal (human approval, observability, auditability, fail closed, platform first) |

### 3. PSER — Enterprise Scope

PSER expands to track the full enterprise hierarchy:

| PSER Field | Previous | New |
|------------|----------|-----|
| Company | AGS | AGS (unchanged) |
| Business Unit | — (implicit) | Explicit field |
| Platform | AI Platform | AI Platform (unchanged) |
| Product | Concierge | Concierge (unchanged) |
| Portfolio | — (implicit) | Explicit field |
| Roadmap | Concierge Roadmap | Unchanged |
| Phase | Phase 2 | Unchanged |
| Wave | — (implicit) | Explicit field |
| Epic | EPIC-2.2 | Unchanged |
| Sprint | S2.2.2 | Unchanged |
| Story | — | New field |
| Task | — | New field |

### 4. Platform Model

Platforms never own products. The AI Platform is one enterprise platform.
Future platforms include Marketing Platform, Operations Platform, Finance
Platform, Knowledge Platform, Analytics Platform, and Automation Platform.

### 5. Business Units

11 business units defined: Executive Office, Engineering, Marketing, Sales,
Operations, Customer Success, Finance, Legal, Partnerships, Analytics, HR/People.

### 6. Workforce Model

11 workforce categories, each with defined responsibilities, approval authority,
WEF compatibility, PSER compatibility, and future capability mapping.

---

## Consequences

### Positive

- **Future-proof.** New business units, platforms, and products slot into the
  hierarchy without restructuring.
- **Consistent governance.** All workforces follow the same WEF phases, gates,
  and principles.
- **Full traceability.** PSER tracks the complete hierarchy from Company down to
  Task.
- **Clear accountability.** Approval authority is defined at every level.
- **Platform independence.** Platforms serve products; products never depend on
  platform ownership.
- **Portfolio clarity.** Products can have multiple portfolios with independent
  roadmaps.

### Negative

- **Documentation migration.** 11 governance documents must be updated to
  reflect the new hierarchy.
- **Transition period.** Current execution (Phase 2 Wave 6) uses the old
  hierarchy. All documents must be updated before Wave 6 begins.
- **WEF version bump.** Existing WEF v1.0 documentation must be updated to
  v1.1 references.
- **PSER schema change.** PSER fields must be expanded to include Business Unit,
  Portfolio, Wave, Story, and Task.

### Neutral

- **Engineering remains first adopter.** Engineering is the most mature workforce
  and continues to validate the expanded framework.
- **Future business units are architecture-only.** No implementation until each
  business unit is activated through an ADR.
- **All existing work continues.** The new hierarchy is additive — existing
  execution paths are preserved.

---

## Related Documents

| Document | Location | Change |
|----------|----------|--------|
| Enterprise Operating Model | `docs/company/AGS_ENTERPRISE_OPERATING_MODEL.md` | New |
| Business Unit Model | `docs/company/BUSINESS_UNIT_MODEL.md` | New |
| Enterprise Workforce Model | `docs/company/ENTERPRISE_WORKFORCE_MODEL.md` | New |
| Enterprise Platform Model | `docs/company/ENTERPRISE_PLATFORM_MODEL.md` | New |
| NAMING_STANDARDS.md | `./NAMING_STANDARDS.md` | Update hierarchy |
| PROGRAM_STATUS.md | `docs/governance/PROGRAM_STATUS.md` | Update hierarchy |
| AI_PLATFORM_STATUS.md | `docs/governance/AI_PLATFORM_STATUS.md` | Update hierarchy |
| PRODUCT_STATUS.md | `docs/products/concierge/PRODUCT_STATUS.md` | Update hierarchy |
| CURRENT_SPRINT.md | `docs/governance/CURRENT_SPRINT.md` | Update hierarchy |
| PROJECT.md | `./PROJECT.md` | Update hierarchy |
| ROADMAP.md | `./ROADMAP.md` | Update hierarchy |
| ARCHITECTURE.md | `./ARCHITECTURE.md` | Update governance header |
| AI_PLATFORM_ROADMAP.md | `docs/platform/AI_PLATFORM_ROADMAP.md` | Update hierarchy |
| DECISION_LOG.md | `docs/governance/DECISION_LOG.md` | Add D-017 |
| GOVERNANCE_INDEX.md | `docs/governance/GOVERNANCE_INDEX.md` | Add company docs |

---

*ADR-017 — Enterprise Operating Model*
*Accepted: 2026-07-27*
*Framework: WEF v1.1*