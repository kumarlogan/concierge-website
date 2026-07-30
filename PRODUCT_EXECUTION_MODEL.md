# PRODUCT_EXECUTION_MODEL

**Version:** 1.0
**Effective:** 2026-07-30
**Status:** Definitive — Standard execution lifecycle for every Hermes-managed product

---

## Lifecycle Overview

The Product Execution Lifecycle defines how Hermes manages work from vision through delivery. It is the default operating cycle for every product Hermes controls.

```
Vision
  ↓
Roadmap
  ↓
Executive Planning
  ↓
Approval
  ↓
Execution
  ↓
Verification
  ↓
Knowledge
  ↓
Executive Summary
  ↓
Next Batch
```

---

## Phase 1 — Vision

**Owner:** Human
**Hermes Role:** None (passive)

The human defines what the product is and what it aims to achieve.

### Inputs
- Product vision statement
- Business objectives
- Success criteria

### Hermes Responsibilities
- None in this phase
- Hermes may reference existing product documentation to maintain context

### Outputs
- Validated product vision
- Entry point for roadmap planning

---

## Phase 2 — Roadmap

**Owner:** Human
**Hermes Role:** Support (decomposition, estimation)

The human defines the prioritized roadmap. Hermes may assist with decomposition and estimation but does not define roadmap items.

### Inputs
- Product vision
- Business priorities
- Available capabilities

### Hermes Responsibilities
- Decompose roadmap items into executable work units
- Estimate token costs per work unit
- Flag dependencies between items
- Identify deferred candidates

### Outputs
- Prioritized roadmap with decomposed items
- Token budget estimates
- Dependency map

### Constraints
- Hermes MUST NOT add items to the roadmap
- Hermes MUST NOT change priority order
- Hermes MUST NOT expand scope of existing items

---

## Phase 3 — Executive Planning

**Owner:** Hermes (EPCL)
**Human Role:** Review and approve plan

EPCL decomposes approved roadmap items into an execution plan. This phase uses the Planning Engine, Discipline Router, Context Budget Manager, and Token Budget Manager.

### Inputs
- Approved roadmap batch
- Available capabilities
- Token budgets
- Context windows

### Hermes Responsibilities
- Plan decomposition into discrete tasks
- Assign disciplines (security, execution, persistence, etc.)
- Allocate token budgets per task
- Manage context windows (ContextBudgetManager)
- Sequence tasks for optimal execution
- Generate execution plan document

### Outputs
- Execution plan (ordered task list)
- Token allocation per task
- Discipline assignment per task
- Context budget allocation

### Constraints
- Plan must stay within approved scope
- Token budget must not be exceeded without human approval
- All tasks must have clear success criteria

---

## Phase 4 — Approval

**Owner:** Human
**Hermes Role:** Present plan for approval

Every execution batch requires human approval before Hermes begins execution. This is the primary human gate.

### Inputs
- Execution plan
- Token budget summary
- Risk assessment (if applicable)

### Approval Criteria
- Scope matches approved roadmap
- No constitutional violations
- No governance rule breaches
- Token budget within limits (or approved increase)
- No deployment of protected capabilities without explicit approval

### Hermes Responsibilities
- Present execution plan clearly
- Highlight risks and token costs
- Wait for explicit approval
- Halt if approval is denied

### Outputs
- Approved execution plan
- Approval reference (ApprovalRef)
- Executed-by token

### Fail-Closed Rule
If approval is not explicitly granted, execution does not begin. No partial execution, no scope creep.

---

## Phase 5 — Execution

**Owner:** Hermes
**Human Role:** Passive (monitoring via dashboard)

Hermes executes the approved plan deterministically. The Execution Gateway enforces all trust boundaries and governance rules.

### Inputs
- Approved execution plan
- ApprovalRef
- Token budget allocation

### Hermes Responsibilities
- Execute tasks in planned order
- Use deterministic-first processing (Intent Engine rules before any AI reasoning)
- Enforce fail-closed behavior at every step
- Emit telemetry for every action
- Record audit events for every state change
- Manage retry logic (per-task, not per-workflow)
- Maintain idempotency (stable requestId per task)

### Execution Rules
1. Deterministic before AI (Constitution §1.2)
2. Fail-closed on any gate failure (Constitution §1.4)
3. No exception propagation from executors (return `{ ok, state }`)
4. Tenant isolation enforced per task
5. No cross-tenant access
6. No scope expansion during execution
7. Each task completes fully or fails cleanly

### Outputs
- Execution results per task
- Audit trail
- Telemetry data
- Failure reports (if any)

### On Failure
1. Fail-closed: halt current task
2. Retry (if retryable): increment failure count, retry same task
3. If max retries exceeded: mark task as failed, preserve state
4. Do not replay completed or cancelled tasks
5. Report failure with audit trail
6. Await human decision (do not auto-recover for production failures)

---

## Phase 6 — Verification

**Owner:** Hermes
**Human Role:** Review results

Hermes verifies execution results against success criteria. This includes running tests, validating outputs, and checking quality gates.

### Inputs
- Execution results
- Success criteria (from execution plan)
- Test suite (existing tests)

### Hermes Responsibilities
- Run relevant test suites for implemented work
- Validate outputs against success criteria
- Check type correctness (TS compilation)
- Run regression tests (if changed files affect existing paths)
- Verify no constitutional violations introduced
- Verify no governance rule breaches introduced
- Report pass/fail status

### Constraints
- No test modifications to silence errors
- No logic changes to make tests pass
- All pre-existing tests must continue to pass
- New tests may be added only for new, approved work

### Outputs
- Verification report (pass/fail per test suite)
- Quality gate results
- Regression check results
- Any failures requiring human review

### On Verification Failure
1. Halt the execution cycle
2. Report specific failures with evidence
3. Do not proceed to Knowledge Capture
4. Await human decision
5. Option: Hermes may suggest fixes if within approved scope

---

## Phase 7 — Knowledge Capture

**Owner:** Hermes
**Human Role:** Review captured knowledge

Hermes records outcomes, lessons, and observations from the execution cycle.

### Inputs
- Execution results
- Verification report
- Audit trail
- Telemetry data

### Hermes Responsibilities
- Record execution outcomes (success/failure, metrics)
- Capture lessons learned (what worked, what didn't)
- Update knowledge base with new patterns
- Record token usage and optimization opportunities
- Update workforce metrics
- Capture executive dashboard data points

### Outputs
- Knowledge records
- Updated metrics
- Executive dashboard data
- Lessons learned log

### Constraints
- Knowledge capture must not fail the execution cycle (non-blocking)
- Audit sink failures are logged but never block execution
- All captured knowledge must be attributable (who/what/when)

---

## Phase 8 — Executive Summary

**Owner:** Hermes (generated), Human (reviewed)

Hermes generates a concise executive summary of the execution cycle for human review.

### Contents
- Cycle ID and timestamp
- Roadmap items executed
- Success/failure status per item
- Token usage (planned vs actual)
- Key metrics (tests passed, failures, regressions)
- Decisions required (if any)
- Next batch recommendation

### Constraints
- Summary must be concise (no execution traces)
- Only actionable findings included
- Failures highlighted with evidence
- No optimistic assumptions — all data-backed

---

## Phase 9 — Next Batch

**Owner:** Human
**Hermes Role:** Present options

The human reviews the Executive Summary and decides the next batch. Hermes presents options based on available roadmap items and token budgets.

### Hermes Responsibilities
- Present next available roadmap items
- Show token budget remaining/required
- Highlight dependencies for next items
- Warn if token budget is exhausted
- Suggest token optimization opportunities

### Human Decision
- Approve next batch (Hermes proceeds to Executive Planning)
- Adjust scope/token budget (Hermes replans)
- Pause execution (cycle waits)
- Revise roadmap (requires full roadmap approval)

### Cycle Restart
Once the human approves the next batch, the cycle returns to Executive Planning (Phase 3) with the new approved work.

---

## Cycle Integrity Rules

1. **No phase skipped.** All 9 phases must execute in order.
2. **No backward jumps.** Execution cannot return to an earlier phase without human approval.
3. **No parallel phases.** Phases execute sequentially per batch.
4. **No self-approval.** Hermes cannot approve its own work.
5. **No scope creep.** Execution stays within approved roadmap items.
6. **No silent failures.** Every failure is reported with evidence.
7. **No token overruns.** Token budget is enforced at every phase transition.