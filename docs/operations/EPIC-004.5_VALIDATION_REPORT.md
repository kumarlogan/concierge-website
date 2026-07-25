# EPIC-004.5 VALIDATION REPORT — Execution Durability Alignment

**Date:** 2026-07-20
**Depends on:** EPIC-004 (committed), EPIC-003-001 (execution foundations)

## 1. Scope

Move Hermes execution truth from the in-memory `ENTRIES` Map (`execution-queue.ts`)
behind a provider-neutral `ExecutionStore` boundary. Preserve fail-closed
execution, human approval gates, auditability, tenant isolation, provider
neutrality.

## 2. Files Changed (all NEW except one targeted barrel append)

NEW:
- `hermes/persistence/execution-store.ts` — ExecutionStore + ExecutionPersistenceBackend + MemoryExecutionBackend + domain contracts (PHASE 1/2/4)
- `hermes/services/execution/execution-coordinator.ts` — queue-as-coordinator over the store (PHASE 3/4/5)
- `workers/tests/epic-004.5-execution-store.test.ts` — 12 tests (store + approval durability + recovery list)
- `workers/tests/epic-004.5-recovery.test.ts` — 7 tests (restart simulation, fail-closed approval)
- `docs/operations/EPIC-004.5_BASELINE_REVIEW.md`
- `docs/operations/EPIC-004.5_VALIDATION_REPORT.md` (this file)
- `docs/operations/EPIC-004.5_COMPLETION_REPORT.md`

PATCHED (targeted — unrelated prior-cycle lines preserved):
- `hermes/services/execution/index.ts` — appended `export * from "./execution-coordinator.js";` only

EXPLICITLY UNTOUCHED (unrelated working-tree / prior cycle):
- `hermes/admin/console/bff-client.ts`, `session.ts`
- `hermes/services/execution/index.ts`'s other (unrelated) modified lines
- `hermes/services/index.ts`, `workers/tests/globalSetup.ts`
- AGS Fertility artifacts, Cloudflare/D1 config, any secrets

## 3. Test Results

```
EPIC-004.5 tests:
  epic-004.5-execution-store.test.ts   12/12 pass
  epic-004.5-recovery.test.ts           7/7  pass
  -------------------------------------------
  EPIC-004.5 subtotal                  19/19 pass

Full workers suite (vitest run):
  434/434 pass across 33 files   (baseline was 415/415 → +19, 0 regressions)
```

Coverage highlights:
- Missing tenant → rejected (fail-closed)
- Cross-tenant read → TenantViolationError
- Unbound principal (no org) → TenantViolationError
- Illegal lifecycle transition → rejected (reuses canonical task machine)
- Duplicate execution id → rejected
- Approval persists approver/at/scope; expiry recorded
- Recovery: no duplicate exec, approval survives restart, no approval-bypass run
- Recovery: lost approval → DENY; unknown approver → DENY; expired approval → DENY
- Tenant isolation preserved across restart

## 4. Typecheck

`npx tsc --noEmit -p workers/tsconfig.json`:

- EPIC-004.5 source files (`execution-store.ts`, `execution-coordinator.ts`) → **0 errors**
- EPIC-004.5 test files → **0 new errors**
- Pre-existing legacy errors remain (DB not in Env, RegisteredAgent.registeredAt,
  console.render.boundary minRole, globalSetup node: imports, etc.) — UNCHANGED
  from baseline, out of scope, not introduced by this EPIC.

## 5. Secret Scan

Searched EPIC-004.5 files for D1 / account_id / CF token / api key / password /
hardcoded credential patterns → **clean**. No D1 reference, no Cloudflare token,
no secret written to code. `ExecutionPersistenceBackend` names D1/Postgres/KV only
as future-impl documentation — no imports, no coupling.

## 6. Boundary Checks

| Boundary | Result |
|---|---|
| Tenant isolation (store reads/writes) | Enforced via `enforceTenant` on every op |
| Fail-closed approval | Unknown/expired/lost approver → DENY before any run |
| Lifecycle validity | Illegal transitions rejected by reused task machine |
| Provider neutrality | Only `ExecutionPersistenceBackend` interface; Memory ships |
| No autonomous expansion | `run()` requires explicit approver + durable approval; no auto-run |

## 7. Conclusion

EPIC-004.5 closes the execution-runtime durability gap: execution truth is now
Hermes-owned, provider-neutral, tenant-scoped, and restart-safe. All gates
preserved. 0 regressions.
