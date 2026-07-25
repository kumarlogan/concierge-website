# EPIC-004.5 COMPLETION REPORT — Execution Durability Alignment

**Date:** 2026-07-20
**Depends on:** EPIC-004 (Persistent Operations Platform), EPIC-003-001 (Execution foundations)
**Status:** ✅ Complete — all 7 phases delivered, 19/19 EPIC tests pass, 434/434 full suite, 0 regressions.

---

## What This EPIC Delivered

Before EPIC-004.5, the execution queue (`hermes/services/execution/execution-queue.ts`)
held the authoritative execution record — lifecycle state, approvals, attempts,
results — inside a volatile in-memory `ENTRIES` Map. A process restart lost all
execution truth, and the human-approval gate was not persisted. EPIC-004.5 moves
that truth behind a provider-neutral `ExecutionStore` boundary and refactors the
queue into a coordinator.

### Deliverables

| Phase | Deliverable | Result |
|---|---|---|
| 1 | Execution domain contracts (`ExecutionTask`, `ExecutionAttempt`, `ExecutionApproval`, `ExecutionResult`, transition table) | ✅ in `execution-store.ts` |
| 2 | `ExecutionStore` boundary + `MemoryExecutionBackend` (no DB impl; D1/Postgres/KV are seams only) | ✅ |
| 3 | Execution queue → coordinator: queue is now a thin orchestration surface; state lives in the store | ✅ `execution-coordinator.ts` |
| 4 | Approval durability: approver/at/scope/expiry persisted; lost/expired/unknown approver → DENY (fail-closed) | ✅ |
| 5 | Recovery model: restart simulation — no duplicate execution, no approval bypass, audit + tenant preserved | ✅ |
| 6 | Integration validation: tests + typecheck + secret scan + ROADMAP | ✅ |
| 7 | Architecture review (7 questions) | ✅ below |

### Files

NEW:
- `hermes/persistence/execution-store.ts` — store boundary, backend interface, memory impl, domain contracts
- `hermes/services/execution/execution-coordinator.ts` — durable coordinator
- `workers/tests/epic-004.5-execution-store.test.ts`
- `workers/tests/epic-004.5-recovery.test.ts`
- `docs/operations/EPIC-004.5_BASELINE_REVIEW.md`
- `docs/operations/EPIC-004.5_VALIDATION_REPORT.md`
- `docs/operations/EPIC-004.5_COMPLETION_REPORT.md`

PATCHED (targeted — unrelated prior-cycle lines preserved):
- `hermes/services/execution/index.ts` — appended `export * from "./execution-coordinator.js";`

UNTOUCHED (per firebreak): AGS artifacts, Cloudflare/D1 config, secrets, unrelated
modified files from prior cycles.

---

## PHASE 7 — Architecture Review (7 Questions)

**Q1. Where does execution truth live now, and why is that safe?**
In `ExecutionStore` (backed by `MemoryExecutionBackend` today), behind a
provider-neutral `ExecutionPersistenceBackend` interface. It is safe because the
store is the single writer — the coordinator never mutates execution state
directly; every transition/approval/result goes through `store.*` which enforces
tenant scope (`enforceTenant`), the canonical lifecycle, and append-only audit.
The old `ENTRIES` Map is no longer the authority.

**Q2. Did we duplicate the task state machine?**
No. `EXECUTION_TRANSITIONS` is declared locally in the persistence layer to avoid
a layering inversion (persistence must not import from services/agents), but it
carries the SAME legal set as `task.ts` (`created→assigned→approved→running→
completed|failed|paused|canceled|timeout`). The coordinator's `run()` also drives a
backing `AgentTask` through `createTask/assignTask/approveTask` so the existing
orchestration gate (`task.state === "approved"`) stays satisfied. One behavior,
two faithful surfaces — no conflicting rules.

**Q3. How is the human approval gate made durable and fail-closed?**
`recordApproval(id, approval, principal)` persists `{approver, at, capability,
scope, expiresAt?}`. `run()` calls `verifyApproval(id)` before any execution: it
returns DENY when approval is missing, when `approver` is not in the known
approver set, or when `expiresAt` is in the past. DENY is the default — absence of
a valid approval never degrades into a run.

**Q4. What happens on restart / crash mid-execution?**
`recover(backend)` re-instantiates the coordinator over the SAME backend. It lists
`listRecoverable()` (non-terminal states) and re-checks approval for each. Because
state is on the backend, not in memory, recovery resumes from the real state — it
never re-runs an already-terminal execution and never runs one whose approval was
lost. A `recovery` audit event is emitted.

**Q5. Is tenant isolation preserved end-to-end?**
Yes. Every store operation passes the `Principal` and calls `enforceTenant`, which
rejects unbound principals and cross-tenant access with `TenantViolationError`.
Recovery re-applies the same checks. The recovery test asserts a tenant-B recovery
sees only tenant-B executions.

**Q6. What about provider neutrality / future D1?**
`ExecutionPersistenceBackend` is the seam. Its methods match the store's needs
(`load`, `save`, `appendAudit`, `listByTenant`, `listNonTerminal`). Today only
`MemoryExecutionBackend` implements it. D1/Postgres/KV are documented as future
impls — named only in comments/interface docs, never imported. No Cloudflare
change, no vendor lock-in, no DB coupling.

**Q7. Did this regress or expand autonomous behavior?**
No. `run()` requires an explicit `approver` argument and a durable, valid approval.
Nothing auto-approves or auto-runs. The EPIC-003-001 fail-closed execution model
and the production approval gate are preserved. Test suite grew from 415 → 434
with 0 regressions.

---

## Validation Summary

- EPIC-004.5 tests: **19/19 pass**
- Full workers suite: **434/434 pass** (baseline 415/415 → +19, 0 regressions)
- EPIC-004.5 sources: type-clean (0 errors)
- Secret scan: clean (no D1/CF token/credential in EPIC-004.5 files)

See `EPIC-004.5_VALIDATION_REPORT.md` for the detailed test/typecheck/secret matrix.
