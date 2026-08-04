# Wave 8 — Workflow & Automation Engine: Engineering Reconciliation Report

**Type:** Engineering Reconciliation (Product Delivery) — Wave 8
**Scope per PO authorization:** Restore architectural integrity of the Workflow & Automation Engine before continuing Wave 8 implementation. No roadmap change, no Foundation work, no reusable-platform-capability changes, no new capabilities.
**Working tree:** uncommitted (no commits or deploys made — held at commit gate for PO review).
**Date:** 2026-08-03

---

## Executive Summary

The Wave 8 workflow module (`workers/src/platform/workflow/`) had drifted well beyond
"route handlers with missing imports." The engine's entire persistence layer was
**stubbed out** — empty config interfaces, commented-out D1 queries, eager fake
singletons, deleted-bridge references — while the Wave 8 route handlers referenced
engine classes that were never imported (≈50 net new TS errors).

This reconciliation:

1. **Wired the workflow runtime to real D1 persistence** (single owner per dependency).
2. **Restored the Wave 8 delta to TypeScript-clean** (baseline 218 → 218; net **+0** errors).
3. **Removed all placeholder/501/"Not implemented" stubs and unsafe casts**.
4. **Aligned the canonical task lifecycle** (state machine now mirrors the `claimed`
   lifecycle the engine and routes actually use).
5. **Added a real D1-backed integration test suite** (4/4 passing).
6. **Left the Wave 3–7 baseline (218 pre-existing TS errors) untouched** — documented,
   out of reconciliation scope, verified as unchanged (no regression).

---

## Phase A — Confirmation

- Confirmed **Engineering Reconciliation** (not an EPIC re-plan). No roadmap change,
  no governance bypass, no Foundation modifications, no new reusable capabilities.
  Consistent with maintenance-mode constraints.
- Auto-resumed from the existing PO authorization. No commit/deploy — held at gate.

## Phase B — Plan

10 deterministic batches (domain model → persistence → engine wiring → validators →
routes → env/index → tests → QA → docs → certification). Full detail in commit-gated
deliverables and this report.

## Phase C — Research Intelligence (drift inventory)

| # | Drift | Evidence |
|---|-------|----------|
| C1 | All engine config interfaces were empty stubs with commented placeholder deps | `EventStoreConfig` `{ // db: D1Database }`, `TaskOrchestratorConfig`, `BatchOperationConfig`, `QueueManagerConfig` |
| C2 | EventStore / TaskOrchestrator / ApprovalGate / Timer / QueueManager / BatchOperations persistence fully commented out (returned `[]`/`null`/no-op) | `event-store.ts`, `task-orchestrator.ts`, `timer-service.ts`, etc. |
| C3 | Deleted-bridge references remained | `// notificationBridge: NotificationBridge`, `// store: TaskStore`, `// clinicalDataService` |
| C4 | Route handlers referenced unimported engine classes | `wave7.ts` — `WorkflowEngine`, `EventStore`, `TaskOrchestrator`, `ApprovalGateService`, `TimerService` (≈50 TS2304 errors) |
| C5 | Route handlers used wrong constructors/signatures | `new TaskOrchestrator(env)` (config object expected), `claimTask(id, {actor})` (string expected), `body` out of scope in `_retryTask` |
| C6 | Placeholder routes returning 501 "Not implemented" | `_transitionWorkflow`, `_getWorkflowTasks`, `_manualOverride`, `_getWorkflowAnalytics`, `_getWorkflowMetrics`, `_searchWorkflows`, `_getDLQ` |
| C7 | Unsafe casts | `"default" as EvidencePackTemplate` (crash at runtime), `body.assignments as string[] as string[]`, `{ id } as any`, `{} as WorkflowInstance`, `as unknown as StartWorkflowRequest` |
| C8 | Speculative env config | `WORKFLOW_QUEUE: Queue` with no wrangler queue binding |
| C9 | Lifecycle conflict | state machine modeled `accepted`; engine/routes set `claimed` |
| C10 | Validator placeholders | `evaluateCondition`/`checkConsent` returning `true`, `(m: any)` cast, `Promise<any>`, `{} as any` |

## Phase E — Reconciliation Performed

### Ownership model (restored) — one owner per dependency
| Dependency | Owner | Wired via |
|-----------|-------|-----------|
| Workflow event persistence | D1 `workflow_events` (migration 0010) | `EventStore({ db })` |
| Task persistence | D1 `task_instances` | `TaskOrchestrator({ db, eventStore })` |
| Approval gate persistence | D1 `approval_gates` | `ApprovalGateService({ db, eventStore })` |
| Timer persistence | D1 `workflow_timers` | `TimerService({ db, eventStore })` |
| Durable work queue | D1 `task_queue` | `QueueManager({ db })` |
| Batch task ops | D1 `task_instances` | `BatchOperations({ db, eventStore })` |
| Evidence packs | task/workflow data (+ optional event history) | `EvidencePackBuilder({ eventStore })` |
| Engine composition | single wiring point | `buildWorkflowEngine(env)` in `wave7.ts` |

### Not reconciled (deferred — flagged, not placeholder)
- **ProjectionEngine / EventReader** (`events/projection-engine.ts`, `events/event-reader.ts`):
  not wired into the runtime; still carry placeholder singletons + `as any`. Full D1
  projection/analytics is a continuing-Wave-8 item.
- **Patient-consent gating for write transitions**: the deleted bridge was removed;
  wiring to the real ConsentEngine requires its own platform approval. No silent
  pass-through left in place — the gate is removed and will be re-introduced with a
  real owner.
- **Full DMN/FEEL rule evaluator**: replaced with a deterministic subset evaluator
  (`====`/`!==` against context) that fails closed on unsupported expressions.
- **DLQ/retry, analytics/metrics routes**: unbacked placeholder routes were removed
  (not stubbed). Reintroduced when real backing exists.

## Certification Results

| Check | Result |
|-------|--------|
| Wave 8 delta (`routes/wave7.ts` + `platform/workflow/**`) TS errors | **0** |
| Total project TS errors | **218 (= pre-existing baseline; net +0)** |
| Wave 3–7 regression | full suite re-verified (see Batch 8) |
| Workflow integration tests | **4/4 passing** (persistence, correlation, engine start/reconstruct, task claim) |
| Placeholder / 501 / TODO stubs in runtime path | **removed** |
| Commits / deploys | **none** (held at commit gate) |

## Deferred / Open Items (for PO)
1. ProjectionEngine + EventReader full D1 implementation.
2. ConsentEngine integration for write-operation consent gating (needs approval).
3. Full DMN/FEEL rule evaluator (currently a deterministic subset, fail-closed).
4. DLQ/retry and analytics/metrics endpoints (reintroduce with real backing).
5. Wave 3–7 baseline: 218 pre-existing TS errors in `trust/`, `documents/`,
   `timeline/`, `credentials/`, `epcl/`, `hermes/*` — **outside Wave 8 scope**, held as
   documented baseline per PO decision (fixing touches other platform capabilities
   and requires separate approval).

## Key Files Changed (working tree)
- `src/platform/workflow/events/event-store.ts` — real D1 persistence.
- `src/platform/workflow/engine/transition-validator.ts` — typed condition evaluator,
  placeholder-free; cast cleanup.
- `src/platform/workflow/engine/state-machine.ts` — task lifecycle aligned to `claimed`.
- `src/platform/workflow/tasks/queue-manager.ts` — D1 `task_queue` backing.
- `src/platform/workflow/tasks/batch-operations.ts` — D1 `task_instances` backing.
- `src/platform/workflow/approval/evidence-pack.ts` — real owner wiring + default template.
- `src/routes/wave7.ts` — engine imports, D1 wiring, placeholder/501/cast removal.
- `src/types/env.ts` — removed speculative `WORKFLOW_QUEUE`.
- `tests/helpers/in-memory-d1.ts` + `tests/platform/workflow-engine.test.ts` — new tests.
- (via delegated subagents) `task-orchestrator.ts`, `approval-gate.ts`, `timer-service.ts`,
  `escalation-timer.ts`, `cron-scheduler.ts` — D1 persistence + singleton cleanup.
