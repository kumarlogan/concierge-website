# RUNTIME_ACTIVATION.md

**EPIC-010 — Organizational Runtime Activation**
**Phase G: Runtime Activation**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform

---

## Target Runtime Execution Path

```
Roadmap
↓
Executive Office
↓
EPCL
↓
Departments
↓
Agents
↓
Skills
↓
Capabilities
↓
Verification
↓
Knowledge Capture
↓
Executive Reporting
↓
WAIT
```

## Reused Components (No Redesign)

| Component | Source | Status |
|-----------|--------|--------|
| EPCL | `hermes/services/planning/` | Reused — 8 services, TypeScript contracts |
| WAS | `workers/src/platform/` | Reused — 8-state activation machine |
| WEF | `hermes/services/execution/` | Reused — Workforce Execution Framework |
| Existing contracts | `hermes/contracts/` | Reused — all existing contracts preserved |
| Existing runtime | Hermes Agent | Reused — all existing tools and capabilities preserved |
| Foundation governance | `docs/governance/` | Reused — all governance docs preserved |
| Capability registry | `docs/platform/capability-registry/` | Reused — 13 capabilities preserved |
| Feature flags | `hermes/services/planning/FeatureFlags` | Reused — 10 flags preserved |

## New Components (Evidence-Based)

| Component | Purpose | Evidence |
|-----------|---------|----------|
| Department Registry | Canonical department definitions | Phase C — 11 departments defined |
| Agent Registry | Agent-to-department ownership | Phase D — 22 agents defined |
| Skill Registry | Skill-to-agent ownership | Phase E — all skills mapped |
| Artifact Contracts | Explicit producer/consumer/schema/lifecycle | Phase F — 15 artifact types defined |
| Executive Command Center | Runtime observability | Phase H — defined |

## Runtime Wiring

### 1. Roadmap → Executive Office
- **Input:** Wave objective, roadmap metadata
- **Output:** Approval decision, budget allocation
- **Evidence:** EPCL execution plan generated after approval
- **Failure mode:** Objective not approved → halt
- **Automation:** Auto-route to EPCL on approval

### 2. Executive Office → EPCL
- **Input:** Approved objective, budget
- **Output:** Execution plan with departments, batches, dependencies
- **Evidence:** EPCL contracts generated (8 services)
- **Failure mode:** EPCL generation fails → halt
- **Automation:** Auto-generate from roadmap metadata

### 3. EPCL → Departments
- **Input:** Execution plan
- **Output:** Department activation signals
- **Evidence:** WAS state machine transitions
- **Failure mode:** Department activation fails → retry once, then halt
- **Automation:** Auto-route based on EPCL phase

### 4. Departments → Agents
- **Input:** Department activation signal
- **Output:** Agent spawning with department context
- **Evidence:** Agent execution traces
- **Failure mode:** Agent spawn fails → retry once, then halt
- **Automation:** Parallel agent dispatch for non-conflicting tasks

### 5. Agents → Skills
- **Input:** Agent task definition
- **Output:** Skill loading with agent context
- **Evidence:** Skill view calls
- **Failure mode:** Skill not found → skip agent, report gap
- **Automation:** Pre-load likely skills based on department

### 6. Skills → Capabilities
- **Input:** Skill context
- **Output:** Capability selection and execution
- **Evidence:** Capability registry lookup
- **Failure mode:** Capability missing → report gap, skip
- **Automation:** Auto-map skills to capabilities

### 7. Capabilities → WAS
- **Input:** Capability execution result
- **Output:** Department state transition
- **Evidence:** WAS state machine log
- **Failure mode:** State transition fails → rollback, report
- **Automation:** Auto-activate based on capability completion

### 8. WAS → WEF
- **Input:** WAS activation state
- **Output:** Execution coordination, task delegation
- **Evidence:** WEF delegation log
- **Failure mode:** Delegation fails → retry, report
- **Automation:** Auto-delegate based on WAS state

### 9. WEF → Execution
- **Input:** Delegation task
- **Output:** Implementation (code, docs, tests)
- **Evidence:** Git commits, file writes
- **Failure mode:** Implementation fails → debug, retry
- **Automation:** Auto-detect integration issues

### 10. Execution → QA
- **Input:** Implementation artifacts
- **Output:** Test evidence (build, typecheck, test results)
- **Evidence:** Test runner output
- **Failure mode:** Tests fail → report, retry
- **Automation:** Auto-trigger QA on build completion

### 11. QA → Verification
- **Input:** QA evidence
- **Output:** Verification certification
- **Evidence:** Verification report
- **Failure mode:** Verification fails → report, retry
- **Automation:** Auto-verify on QA pass

### 12. Verification → Documentation
- **Input:** Verification certification
- **Output:** Updated documentation
- **Evidence:** Doc file writes
- **Failure mode:** Doc update fails → report, retry
- **Automation:** Auto-update affected docs

### 13. Documentation → Knowledge Capture
- **Input:** Documentation artifacts
- **Output:** Knowledge capture report
- **Evidence:** Knowledge capture file
- **Failure mode:** Capture fails → report, retry
- **Automation:** Auto-capture patterns from trace

### 14. Knowledge Capture → Executive Reporting
- **Input:** Knowledge capture report
- **Output:** Executive report (15-section PO report)
- **Evidence:** PO report file
- **Failure mode:** Report fails → report, retry
- **Automation:** Auto-generate from trace

### 15. Executive Reporting → WAIT
- **Input:** Executive report
- **Output:** PO decision (Approve / Approve with Follow-up / Needs Revision / Hold)
- **Evidence:** PO decision recorded
- **Failure mode:** No decision → escalate
- **Automation:** Auto-transition to WAIT on report completion

---

## Runtime Preservation

- ✅ EPCL preserved — no redesign
- ✅ WAS preserved — no redesign
- ✅ WEF preserved — no redesign
- ✅ Foundation governance preserved — no redesign
- ✅ Platform Constitution preserved — no redesign
- ✅ Existing contracts preserved — no redesign
- ✅ Existing execution runtime preserved — no redesign
- ✅ Fail Closed preserved
- ✅ Governance preserved
- ✅ Product Agnostic design preserved
- ✅ Foundation Freeze preserved
- ✅ Roadmap Lock preserved
- ✅ Evidence First preserved
- ✅ Incremental execution preserved

---

*End of Runtime Activation*
