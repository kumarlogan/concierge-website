# Workforce Development Cycle (WDC) v1.0

> ⚠️ **SUPERSEDED — This document is preserved for historical/audit purposes only.**
> The Workforce Development Cycle (WDC) v1.0 has been renamed to the **Workforce Execution Framework (WEF) v1.0** as of GOV-004 (2026-07-26).
> See [ADR-015](../../docs/adr/ADR-015-governance-freeze-wef.md) for the governance freeze and framework transition.
> See **WEF v1.0** for the active execution framework — this document is retained solely for historical references in ADR-014, CHANGELOG.md, and audit trail.
>
> **Status:** 🔴 Superseded — WEF v1.0 is the canonical execution framework
> **Category:** Process · Execution Framework
> **Version:** 1.0.0 (Superseded as of 2026-07-26)
> **Adopted:** 2026-07-26 via GOV-003
> **Superseded by:** WEF v1.0 (Workforce Execution Framework) via GOV-004

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       Workforce Development Cycle (WDC) v1.0
Status:         Mandatory — canary-governed execution framework
```

---

## Purpose

The Workforce Development Cycle (WDC) is the canonical execution framework
that governs all AGS engineering implementation work. It defines a
seven-phase, gate-driven process with explicit human oversight, five
collaborative workforce agents, and mandatory governance synchronization
at every stage.

WDC is not a temporary artifact — it is a permanent AGS governance
standard that becomes the operational execution model for all future
engineering work.

---

## Scope

WDC applies to:

- All feature development (Phase 2 Waves 3–8 and beyond)
- All platform capability implementation
- All product capability implementation
- All shared infrastructure changes
- All governance and architecture updates that involve implementation

WDC does **not** apply to:

- Purely architectural decisions (use ADR process)
- Governance-only updates (update dashboards and index directly)
- Emergency production fixes (use rapid remediation process)
- Routine operations and monitoring

---

## Hierarchy

The AGS work hierarchy is strictly ordered. No level may be skipped.

```
Company        AGS
    ↓
Platform       AI Platform
    ↓
Product        Concierge
    ↓
Roadmap        Concierge Roadmap
    ↓
Phase          (Phase 0–4)
    ↓
Wave           (Wave N)
    ↓
Epic           (EPIC-X.Y.Z)
    ↓
Sprint         (P{X}-W{Y}-S{Z})
    ↓
Story
    ↓
Task
```

---

## Workforce Agents

Five specialized agents collaborate on every execution cycle. All actions
are observable, auditable, and reproducible.

| Agent | Responsibility |
|---|---|
| **Developer Agent** | Implementation plans, code, architecture impact, reusable abstractions |
| **QA Agent** | Acceptance criteria, regression strategy, test execution, coverage |
| **Security Agent** | Vulnerability review, PHI boundary, trust boundary, permission audit |
| **Documentation Agent** | Docs updates, governance sync, ADR impact, roadmap sync |
| **Monitoring Agent** | Observability plan, metrics, health verification, runtime validation |

---

## Platform First Decision

Before any implementation work begins, classify the work:

| Classification | Rule |
|---|---|
| **AI Platform capability** | Implement once. Expose reusable contracts. Product consumes capability. |
| **Product capability** | Remain inside Product. Do not leak business logic into the Platform. |
| **Shared Infrastructure** | Serve both Platform and Product. Provider-neutral design mandatory. |
| **Future Product** | Scoped for unknown consumers. Maximum abstraction, zero product coupling. |

---

## Phases

### Phase 0 — Preparation

Verify before any execution begins.

- [ ] Agent health
- [ ] Workforce persistence
- [ ] Workforce registry
- [ ] Workforce metrics
- [ ] Observability
- [ ] Audit logging
- [ ] Execution Gateway
- [ ] Approval workflow
- [ ] Governance dashboards
- [ ] Version synchronization
- [ ] Git state (clean tree)

**If any verification fails → STOP.** Do not proceed.

### Phase 1 — Roadmap Validation

1. Identify current execution location (Company → Platform → Product → Roadmap → Phase → Wave → Epic → Sprint → Story → Task).
2. Report location hierarchy.
3. Review roadmap status.
4. Confirm: approved, in scope, no blockers, no roadmap drift, dependencies satisfied.
5. Recommend only the highest-priority approved work item.
6. **Wait for Human Operator approval.**

### Phase 2 — Engineering Execution Plan

Each agent produces its plan. All plans must be approved before Phase 3.

**Developer Agent:**
- Implementation plan
- Architecture impact assessment
- Reusable abstractions identification
- Files expected to change
- Implementation complexity estimate
- Implementation risks

**QA Agent:**
- Acceptance criteria
- Regression strategy
- Testing strategy

**Security Agent:**
- Security review
- PHI review
- Zero Trust review
- Permission review
- Dependency review

**Documentation Agent:**
- Documentation updates
- Governance updates
- ADR impact assessment
- Roadmap impact assessment
- Dashboard impact assessment

**Monitoring Agent:**
- Observability plan
- Metrics definition
- Health verification strategy
- Runtime validation plan

**Wait for Human Operator approval before proceeding.**

### Phase 3 — Implementation

Developer Agent executes against the approved plan.

**Mandatory rules:**
- Platform Constitution
- Platform First
- Roadmap Lock (no scope expansion)
- Deterministic Before AI
- Zero Trust
- Fail Closed
- No speculative features
- Small reviewable commits
- Provider abstraction
- Capability-first design

### Phase 4 — Quality Gates

All gates must pass before Phase 5.

**QA Agent:**
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Regression tests pass
- [ ] Acceptance criteria validated

**Security Agent:**
- [ ] Vulnerability scan clean
- [ ] No secrets exposed
- [ ] Permissions correct
- [ ] PHI boundary intact
- [ ] Identity boundary intact
- [ ] Trust boundary intact

**Documentation Agent:**
- [ ] PROJECT.md updated (if applicable)
- [ ] ROADMAP.md updated (if applicable)
- [ ] CURRENT_SPRINT.md updated
- [ ] CHANGELOG.md updated
- [ ] PROGRAM_STATUS.md updated (if applicable)
- [ ] AI_PLATFORM_STATUS.md updated (if applicable)
- [ ] PRODUCT_STATUS.md updated (if applicable)
- [ ] Architecture docs updated (if applicable)
- [ ] ADRs updated (if applicable)
- [ ] Decision Log updated (if applicable)

**Monitoring Agent:**
- [ ] Platform health verified
- [ ] Runtime metrics collected
- [ ] Observability verified
- [ ] Audit integrity confirmed
- [ ] No regressions introduced

### Phase 5 — Architecture Review

Each agent answers the following:

- Does implementation violate Platform First?
- Does implementation violate Roadmap Lock?
- Does implementation introduce technical debt?
- Does implementation introduce product coupling?
- Does implementation reduce future workforce capability?

**If ANY answer is YES:**
- Explain the violation
- Require Human Operator approval before proceeding

### Phase 6 — Organizational Learning

- [ ] Capture reusable capabilities
- [ ] Capture new abstractions
- [ ] Capture engineering patterns
- [ ] Record architecture decisions
- [ ] Capture lessons learned
- [ ] Update future backlog
- [ ] Record technical debt
- [ ] Update platform maturity assessment
- [ ] Update capability maturity assessment
- [ ] Update workforce maturity assessment
- [ ] Update governance dashboards
- [ ] Synchronize documentation

### Phase 7 — Workforce Review

Produce one consolidated report containing:

| Section | Content |
|---|---|
| **Developer** | Work completed, files changed, architecture changes |
| **QA** | Tests executed, coverage %, regression status |
| **Security** | Findings, severity, compliance status |
| **Documentation** | Files updated, governance synchronization status |
| **Monitoring** | Platform health, operational status, observability |
| **Engineering Metrics** | Test count, build status, version, git commit |
| **Current Position** | Phase, Wave, Epic, Sprint, Story, Task |
| **Overall Risk** | LOW / MEDIUM / HIGH |
| **Recommendation** | READY FOR MERGE / READY FOR NEXT WAVE / CHANGES REQUIRED |

---

## Workforce Rules

1. **Human Operator is final authority** — no autonomous deployment, merge, roadmap changes, or scope expansion.
2. **No agent self-activation** — agents execute only within a WDC phase cycle.
3. **No bypassing governance** — every phase gate must be passed.
4. **Everything is auditable** — all actions produce traceable records.
5. **Everything is observable** — all execution paths are instrumented.
6. **Everything is reproducible** — given the same inputs, the same process produces the same outputs.

---

## Success Criteria

Execution is complete only when ALL of the following are satisfied:

- [ ] Code complete
- [ ] Tests passing
- [ ] Security reviewed
- [ ] Documentation synchronized
- [ ] Governance synchronized
- [ ] Dashboards synchronized
- [ ] ADRs updated (if applicable)
- [ ] Decision Log updated (if applicable)
- [ ] Roadmap updated (if applicable)
- [ ] Resume point documented
- [ ] Organizational learning captured
- [ ] Workforce report produced

Only then may the next Wave begin.

---

## Version History

| Version | Date | Change |
|---|---|---|
| 1.0.0 | 2026-07-26 | Initial adoption as permanent AGS governance standard (GOV-003) |

---

*WDC v1.0 — adopted as canary-grained execution framework. Governance document — GOV-003.*
*Last updated: 2026-07-26*