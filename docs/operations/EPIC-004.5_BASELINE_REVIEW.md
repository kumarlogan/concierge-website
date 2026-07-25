# EPIC-004.5 BASELINE REVIEW — Execution Durability Alignment

**Date:** 2026-07-20
**Depends on:** EPIC-004 (committed, 6 commits, 415/415 tests green)

## 1. Current Execution Lifecycle

```
Request execution
  └─ enqueue()  → creates AgentTask (task.ts, state: created) + QueueEntry (ENTRIES Map)
       ↓
approveAndRun(queueId, approver, executor)
  ├─ assignTask + approveTask (human gate, fail-closed: no approver = no run)
  ├─ orchestrate() → retries/timeout/cancel against injected executor
  ├─ QueueEntry.status updated to completed|failed|cancelled
  └─ emitAudit("execution.queue.run", ...)
retryEntry() → re-runs approveAndRun on failed entries
pauseEntry / resumeEntry / cancelEntry → operator-visible state changes
```

## 2. Current In-Memory Assumptions (the gap)

| Concern | Where | Problem |
|---|---|---|
| Execution truth | `ENTRIES: Map<string, QueueEntry>` in `execution-queue.ts` | Lost on process restart — no recovery |
| Approval decisions | NOT persisted — `approveAndRun` only calls `approveTask` in task audit trail | Restart loses the approval; re-approval needed (correct) but no durable record to *verify* |
| Task lifecycle | `STORE: Map` in `task.ts` | Also in-memory, but task.ts is shared foundation; EPIC-004.5 persists the *execution* boundary, not the task registry |
| Queue = state authority | `execution-queue.ts` owns both `QueueEntry` AND drives task transitions | Couples coordinator with state — violates "Hermes owns execution state behind a persistence boundary" |
| Tenant on execution | `QueueEntry` has no tenant field | Execution truth is not tenant-scoped at rest |

## 3. Persistence Gaps

- No `ExecutionStore` — execution state lives only in the `ENTRIES` Map.
- No durable approval record with approver identity + timestamp + scope + expiry.
- No recovery path: a crash mid-run loses in-flight executions and their approvals.
- Provider neutrality absent at the execution layer (the queue is the concrete authority).

## 4. Migration Risks

| Risk | Mitigation |
|---|---|
| Breaking the existing `enqueue`/`approveAndRun` callers | Keep `execution-queue.ts` API stable; add `ExecutionStore` as the durable backing, queue becomes coordinator over it |
| Duplicating the task state machine | REUSE `canTransitionTask` from `task.ts` — `ExecutionStore` validates against the same legal transitions, never redefines them |
| Losing fail-closed approval | Approval must be explicit + durable; unknown/expired approver or lost approval after restart → DENY |
| Tenant leakage | Every `ExecutionStore` op enforces `enforceTenant` (reuse EPIC-004 `tenant.ts`) |
| Clobbering unrelated working-tree changes | Only NEW files created + targeted patch to `index.ts` barrel (append export only); the 5 unrelated modified files are untouched |
| Vendor lock-in | `ExecutionPersistenceBackend` interface only; `MemoryExecutionBackend` ships; D1/Postgres/KV are future seams (no imports) |

## 5. Files Expected to Change

NEW (EPIC-004.5 owned):
- `hermes/persistence/execution-store.ts` — ExecutionStore + ExecutionPersistenceBackend + MemoryExecutionBackend
- `hermes/services/execution/execution-coordinator.ts` — queue-as-coordinator over ExecutionStore
- `workers/tests/epic-004.5-execution-store.test.ts` — store + approval durability tests
- `workers/tests/epic-004.5-recovery.test.ts` — restart simulation test
- `docs/operations/EPIC-004.5_*.md` — baseline/validation/completion reports

PATCHED (targeted, preserves existing unrelated edits):
- `hermes/services/execution/index.ts` — append `export * from "./execution-coordinator.js";` only

EXPLICITLY NOT CHANGED (unrelated prior-cycle working tree):
- `hermes/admin/console/bff-client.ts`, `session.ts`
- `hermes/services/execution/index.ts`'s OTHER (unrelated) lines — preserved
- `hermes/services/index.ts`, `workers/tests/globalSetup.ts`
- AGS Fertility artifacts, Cloudflare/D1 config, any secrets

## 6. Ownership Conflicts

None. EPIC-004.5 files are all new or additively patched. The unrelated modified
files are excluded from staging and remain in the working tree untouched.
