# Phase Gate Framework

> **Mandatory entry and exit criteria for every project phase.**
> No phase begins without meeting entry criteria. No phase ends without meeting exit criteria.
> This framework applies to every future phase without exception.

**Company:** AGS
**Platform:** AI Platform
**Product:** Concierge
**Public Brand:** AG Synergy
**Repository:** concierge-website
**Last Updated:** 2026-07-26
**Governance Version:** 1.0

---

## 1. Purpose

Phase gates ensure that every phase of the Concierge platform:

- Begins with a clear, documented baseline
- Maintains traceable progress throughout execution
- Validates all deliverables against acceptance criteria
- Produces a complete closeout record for future phases
- Captures lessons learned for continuous improvement
- Preserves an exact resume point for any interruption

---

## 2. Phase Lifecycle

```
Entry Gate → Execution → Validation Gate → Exit Gate → Lessons → Sign-off → Resume Point
     │                                                                              │
     └─────────────────────────── Next Phase ───────────────────────────────────────┘
```

---

## 3. Entry Criteria

Before a phase may begin, ALL of the following must be satisfied:

| # | Criterion | Verification | Evidence |
|---|---|---|---|
| EC-1 | Previous phase exit documented | PHASE_N_EXIT.md exists and is complete | File exists with all sections populated |
| EC-2 | All blockers from previous phase resolved or risk-accepted | Blockers table in PROGRAM_STATUS.md has no P0 items | Blockers reviewed and signed off |
| EC-3 | Phase planning document approved | PHASE_N_PLANNING.md exists with scope, epics, estimates | Document signed by Product Owner |
| EC-4 | Governance dashboards current | PROGRAM_STATUS.md, AI_PLATFORM_STATUS.md, PRODUCT_STATUS.md reflect latest state | Last updated date within current week |
| EC-5 | Decision Log seeded with phase-level decisions | DECISION_LOG.md has at least one entry for the new phase | Decision ID assigned |
| EC-6 | CHANGELOG synchronized | Latest version matches health endpoint version | `SERVICE_VERSION` === CHANGELOG latest |
| EC-7 | Test suite baseline recorded | Full test run executed, count documented | `vitest run` output in CURRENT_SPRINT.md |
| EC-8 | Git state clean | No uncommitted changes at phase start | `git status --short` empty |
| EC-9 | Phase Gate Checklist signed off | All criteria above verified and acknowledged | Sign-off section below completed |

---

## 4. Execution Criteria

During phase execution, these standards must be maintained:

| # | Criterion | Standard |
|---|---|---|
| XC-1 | All commits must reference EPIC/Story ID | `EPIC-NNN: description` or `GOV-NNN: description` |
| XC-2 | Tests must pass before merge | Pre-merge: full `vitest run` green |
| XC-3 | Documentation updated with code | Every PR includes doc changes or explicit "docs not needed" |
| XC-4 | Decision Log entries for scope changes | Any new decision gets a D-NNN entry |
| XC-5 | Governance dashboards updated per epic | Each epic completion updates PROGRAM_STATUS.md, AI_PLATFORM_STATUS.md, PRODUCT_STATUS.md |
| XC-6 | Blockers tracked in PROGRAM_STATUS.md | New blockers added immediately with severity |
| XC-7 | No hardcoded versions | Version sourced from CHANGELOG.md via `scripts/extract-version.sh` |

---

## 5. Validation Criteria

Before exit, all deliverables must be validated:

| # | Criterion | Method |
|---|---|---|
| VC-1 | All epics meet Definition of Done | Per-epic DoD checklist signed off |
| VC-2 | Test suite passes at stated count | `vitest run` — all tests green, count >= baseline |
| VC-3 | TypeScript compilation clean | `tsc --noEmit` — zero errors |
| VC-4 | Frontend build clean (if applicable) | `vite build` — zero errors |
| VC-5 | Health endpoint responds correctly | `curl <url>/api/v1/health` — 200, correct version |
| VC-6 | Version synchronization verified | `SERVICE_VERSION` === CHANGELOG latest === health endpoint version |
| VC-7 | Live infrastructure verified | All deployed components return expected status codes |
| VC-8 | Documentation inventory complete | GOVERNANCE_INDEX.md lists all documents, links resolve |
| VC-9 | Decision Log up to date | All phase decisions recorded |
| VC-10 | Secret scan clean | Repository-wide scan for leaked credentials |

---

## 6. Exit Criteria

A phase is complete only when ALL of the following are satisfied:

| # | Criterion | Artifact |
|---|---|---|
| EX-1 | Phase Exit Report published | `docs/releases/PHASE_N_EXIT.md` — complete closeout |
| EX-2 | Epic inventory finalized | All epics listed with status, dates, test counts |
| EX-3 | Delivery checklist complete | Objectives vs actual delivery table |
| EX-4 | Known gaps documented | Gaps with severity, phase assignment, remediation plan |
| EX-5 | Infrastructure state documented | All components with status, URLs, versions |
| EX-6 | Phase N+1 handoff prepared | Strategic, architectural, and documentation handoff |
| EX-7 | Blocked/unblocked items catalogued | External dependencies and ready-now work |
| EX-8 | Program dashboards updated | PROGRAM_STATUS.md, AI_PLATFORM_STATUS.md, PRODUCT_STATUS.md |
| EX-9 | All dashboards reference same version, commit, test count | Cross-dashboard consistency verified |
| EX-10 | Git tag created | `v<major>.<minor>.<patch>` tag on closing commit |
| EX-11 | CHANGELOG entry finalized | New version entry at top of CHANGELOG.md |
| EX-12 | Resume point documented | Exact next action, directory, and command |

---

## 7. Lessons Learned

Every phase must capture:

| # | Item | Description |
|---|---|---|
| LL-1 | What went well | Practices to continue |
| LL-2 | What went wrong | Practices to improve |
| LL-3 | Surprises | Unexpected discoveries |
| LL-4 | Metrics | Duration, commits, tests, incidents, rework |
| LL-5 | Action items | Concrete improvements for next phase |

Format: Add a Lessons Learned section to the Phase Exit Report.

---

## 8. Sign-off

Every phase exit requires sign-off from:

| Role | Responsibility |
|---|---|
| **Product Owner** | Approves scope delivery and business value |
| **Engineering Lead** | Approves technical quality and completeness |
| **Security Lead** | Approves security posture and compliance |

Sign-off is recorded in the Phase Exit Report with date, name, and signature (or equivalent).

---

## 9. Resume Point

Every phase document and exit report must end with an exact resume point:

```
## Resume Point

Current directory: `<absolute-path>`
Last action: `<what was done immediately before interruption>`
Next action: `<exact command or step to resume>`
Git commit: `<commit-hash>`
Pending items: `<list of uncompleted work>`
```

This ensures zero context loss on session interruption.

---

## Gate Waiver Process

Any criterion may be waived only by explicit Product Owner approval with documented rationale:

```
Waiver: EX-3 (Delivery checklist incomplete)
Rationale: Final epic merged after documentation cutoff; checklist will be completed in first week of next phase
Approved by: [Name]
Date: YYYY-MM-DD
```

Waivers are recorded in the Phase Exit Report and carried as action items to the next phase.

---

*This framework is mandatory for all future phases. No phase begins or ends without satisfying these gates.*
*Governance document — GOV-002*
*Last updated: 2026-07-26*