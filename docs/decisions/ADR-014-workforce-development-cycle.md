# ADR-014 — Workforce Development Cycle v1.0 as Official AGS Engineering Execution Model

> **Status:** ✅ Accepted
> **Date:** 2026-07-26
> **Phase:** Phase 2 — Wave 2 (Governance)
> **Category:** Process · Governance

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Repository:     concierge-website
ADR:            ADR-014 — Workforce Development Cycle v1.0
Status:         ✅ Accepted
Author:         AI Platform Governance
```

---

## Context

Phase 2 Wave 2 completed the AI Platform Governance Core, establishing
Engineering Standards (110 mandatory standards), Capability Maturity Model
(8 levels), and a full governance framework. However, there was no
canonical execution framework governing how implementation work proceeds
from roadmap validation through delivery and review.

Existing process documentation (PHASE_GATES.md, templates) covers
planning and phase transitions but does not define a comprehensive,
executable workflow that coordinates the five workforce agents (Developer,
QA, Security, Documentation, Monitoring) through a structured, gate-driven
cycle with mandatory human oversight.

Without a standardized execution model, engineering work risks:
- Inconsistent process across teams and waves
- Missing governance synchronization at delivery
- Unclear agent responsibilities during implementation
- No formal gate for architecture compliance before merge

---

## Decision

Adopt the **Workforce Development Cycle (WDC) v1.0** as the official AGS
engineering execution model. WDC defines a seven-phase, gate-driven
process with explicit human oversight that governs all AGS implementation
work.

### Key Design Decisions

1. **WDC is a permanent governance standard** — not a temporary artifact
   or workflow template. It is part of the AGS engineering operating model.

2. **WDC is canary-grained** — the framework is authoritative and its
   process steps are mandatory, but future refinements can be made through
   the standard ADR/decision process without breaking the canary contract.

3. **Human Operator retains final authority** — no autonomous deployment,
   merge, roadmap changes, or scope expansion. WDC gates are advisory until
   human approval is given.

4. **Five workforce agents are the standard collaboration model** — Developer,
   QA, Security, Documentation, Monitoring. Each has defined responsibilities
   per phase.

5. **Platform First is enforced by WDC** — Phase 2 includes a classification
   gate that ensures work is correctly scoped (Platform capability vs. Product
   capability vs. Shared Infrastructure vs. Future Product).

6. **WDC does not replace the Platform Constitution** — it complements it.
   The Constitution defines principles; WDC defines the executable process
   that applies those principles to implementation work.

---

## Consequences

### Positive

1. **Consistent execution** — every wave of implementation follows the same
   structured process, regardless of team or scope.
2. **Mandatory governance sync** — documentation, dashboards, and ADRs are
   updated by default at Phase 4 and Phase 6 gates.
3. **Human oversight preserved** — every phase requires explicit operator
   approval before proceeding.
4. **Observability by design** — all agent actions are traceable through the
   phase gate structure and workforce report.
5. **Reversible governance** — WDC itself can be amended via the standard
   ADR process without destabilizing the execution model.

### Negative

1. **Process overhead** — seven phases with multiple gates add overhead to
   every implementation cycle. Mitigated by the fact that governance sync
   saves rework and drift.
2. **Learning curve** — team members must learn the WDC process. Mitigated
   by the structured templates and clear phase definitions.
3. **Potential for gate paralysis** — if a gate fails and is refused, work
   stalls. Mitigated by explicit approval paths and the Human Operator as
   final authority.

### Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Process overhead slows delivery | Medium | Medium | WDC phases can run in parallel where gates are independent; gates are fast for experienced teams |
| New team members unfamiliar with WDC | High | Low | WDC document is indexed in GOVERNANCE_INDEX.md; onboarding includes WDC overview |
| Gate failures cause stalls | Low | High | Human Operator can approve exceptions; each gate has explicit remediation steps |

---

## Related Documents

| Document | Path |
|---|---|
| WDC v1.0 (this framework) | `docs/governance/WORKFORCE_DEVELOPMENT_CYCLE.md` |
| Project Constitution | `PROJECT.md` |
| Platform Constitution | `workers/docs/platform/PLATFORM_CONSTITUTION.md` |
| Engineering Standards | `docs/platform/engineering-standards/ENGINEERING_STANDARDS.md` |
| Capability Maturity Model | `docs/platform/maturity-model/CAPABILITY_MATURITY_MODEL.md` |
| Phase Gates | `docs/governance/PHASE_GATES.md` |
| Decision Log (prior) | `DECISION_LOG.md` (D-011, D-010) |
| ADR-013 | `docs/adr/ADR-013-admin-bff-workforce-foundations.md` |
| ADR-011 | `docs/decisions/ADR-011-ai-platform-governance-core.md` |

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-07-26 | Initial adoption of WDC v1.0 as official execution model |

---

*ADR accepted 2026-07-26. This record is append-only — corrections via new ADR referencing ADR-014.*