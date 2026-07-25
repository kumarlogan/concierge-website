# EPIC-004.6 — Platform Trust Hardening · Baseline Review

**Date:** 2026-07-20
**Author:** Hermes (night execution cycle)
**Scope:** Hermes Agent TypeScript platform (`/home/ubuntu/concierge-website/hermes`)
**Depends on:** EPIC-004 (foundations) + EPIC-004.5 (execution durability)

---

## 0. Working-tree status (pre-flight gate)

Git `git status` on `/home/ubuntu/concierge-website` (branch `main`, 30 commits ahead of origin):

**Modified (tracked):**
- `ROADMAP.md`
- `hermes/admin/console/bff-client.ts`
- `hermes/admin/console/session.ts`
- `hermes/services/execution/index.ts`
- `hermes/services/index.ts`
- `workers/tests/globalSetup.ts`

**Untracked (new, from EPIC-004.5):**
- `docs/architecture/EPIC-004_PROPOSAL.md`
- `docs/operations/EPIC-004.5_BASELINE_REVIEW.md`
- `docs/operations/EPIC-004.5_COMPLETION_REPORT.md`
- `docs/operations/EPIC-004.5_VALIDATION_REPORT.md`
- `docs/operations/HERMES_V1_FOUNDATION_REVIEW.md`
- `docs/operations/TECHNICAL_DEBT_INVENTORY.md`
- `hermes/persistence/execution-store.ts`  ← **EPIC-004.5 durable execution boundary**
- `hermes/services/execution/execution-coordinator.ts`  ← **EPIC-004.5 coordinator**
- `workers/tests/epic-004.5-execution-store.test.ts`
- `workers/tests/epic-004.5-recovery.test.ts`

**Ownership conflict check:** NONE.
The overlapping files (`execution/index.ts`, `execution-coordinator.ts`, `execution-store.ts`) are EPIC-004.5 foundations that EPIC-004.6 is explicitly mandated to extend (PHASE 5 integration). They are NOT unrelated to this epic. Strict rules honored:
- No unrelated files modified.
- No `git add -A`.
- No commit, push, or deploy.
- No AGS Fertility code, Cloudflare/D1 config, secrets, or external providers touched.

---

## 1. Current trust gates (as found)

| # | Gate | Location | Enforced | Fail-closed? |
|---|------|----------|----------|--------------|
| G1 | Tenant boundary | `persistence/tenant.ts` → `enforceTenant` → `withinTenantScope` | ✅ every store read/write | ✅ throws `TenantViolationError` |
| G2 | Missing tenant on create | `persistence/execution-store.ts` `create()` | ✅ throws `ExecutionError("Missing tenant")` | ✅ |
| G3 | Duplicate execution id | `persistence/execution-store.ts` `create()` | ✅ throws `ExecutionError("already exists")` | ✅ |
| G4 | Lifecycle state machine | `persistence/execution-store.ts` `canTransitionExecution` | ✅ illegal transition throws | ✅ |
| G5 | Approval present (run) | `execution-coordinator.ts` `run()` | ✅ throws if `!ex.approval` | ✅ |
| G6 | Approver identity match | `execution-coordinator.ts` `run()` | ✅ `approver !== ex.approval.approver` | ✅ |
| G7 | Approver known (verifier) | `execution-coordinator.ts` `run()`/`approve()` | ✅ `verifyApprover` | ✅ |
| G8 | Approval expiry | `execution-coordinator.ts` `run()` | ✅ cancels + throws if `expiresAt < now` | ✅ |
| G9 | Approval durability | `persistence/execution-store.ts` `recordApproval` | ✅ persisted to store | ✅ |
| G10 | Human approval gates (ops) | `services/activation/approval-gates.ts` `decideGate` | ✅ fail-closed to "human" | ✅ |
| G11 | Capability registry | `services/providers/capability.ts` `MemoryCapabilityRegistry` | ⚠️ lookup only — NOT checked on execution path | ❌ not wired |
| G12 | Audit emission | `audit/event.ts` `emitAudit` | ✅ non-throwing best-effort | ⚠️ non-blocking |

---

## 2. Duplicated policy checks (smell)

- **Tenant enforcement** is centralized (good) in `enforceTenant`, but the
  *missing tenant* check is re-implemented inline in `ExecutionStore.create`
  (`if (!tenant) throw`) instead of being expressed as a policy decision.
- **Approval verification** logic (G5–G8) is duplicated inside
  `ExecutionCoordinator.run` as a hard-coded sequence. It cannot be reused by
  any other entry point (e.g. a future MCP adapter, a scheduled re-drive) without
  copy-paste.
- **Provider / capability knownness** (G11) is checked nowhere on the execution
  path — an unknown `backend`/`capability` flows straight to the orchestrator.

---

## 3. Missing central decision point

There is **no single `execute(input) -> decision` boundary**. Today the
authorization sequence is *implicitly* assembled inside
`ExecutionCoordinator.run` (approve-check → verifier → expiry → lifecycle
transition). Any new caller (PHASE 5 integration, EPIC-005 MCP adapter) must
re-derive that sequence by hand. This is the core gap EPIC-004.6 PHASE 1 closes
with `ExecutionPolicyEvaluator`.

---

## 4. Execution safety gaps

| Gap | Risk | EPIC-004.6 response |
|-----|------|---------------------|
| No idempotency key on requests | Retry / double-submit → duplicate external actions | PHASE 2 `ExecutionRequestIdentity` |
| No lease concept | Future distributed workers could double-execute | PHASE 3 `ExecutionLease` contract |
| No provider-neutral metrics | Can't observe execution health without external telemetry | PHASE 4 `ExecutionMetrics` boundary |
| Capability/provider unknownness unchecked | Unknown provider reaches orchestrator | PHASE 1 `DENY unknown provider` |
| Tenant mismatch at request boundary (not just store read) | Cross-tenant request accepted then rejected late | PHASE 1 `DENY tenant mismatch` |
| No auditable "why allowed" receipt | Decisions not provable post-hoc | PHASE 1 `ExecutionPolicyDecision.reason` + PHASE 5 audit |

---

## 5. Expected file ownership (post-EPIC-004.6)

| File | Owner | Status |
|------|-------|--------|
| `hermes/persistence/execution-store.ts` | EPIC-004.5 | unchanged (read-only here) |
| `hermes/services/execution/execution-coordinator.ts` | EPIC-004.5 + 004.6 PHASE 5 | **extended** (policy hook) |
| `hermes/services/execution/policy-evaluator.ts` | EPIC-004.6 PHASE 1 | **new** |
| `hermes/services/execution/idempotency.ts` | EPIC-004.6 PHASE 2 | **new** |
| `hermes/services/execution/lease.ts` | EPIC-004.6 PHASE 3 | **new** |
| `hermes/services/execution/metrics.ts` | EPIC-004.6 PHASE 4 | **new** |
| `hermes/services/execution/index.ts` | EPIC-004.5 | **extended** (re-export new modules) |
| `workers/tests/epic-004.6-policy.test.ts` | EPIC-004.6 PHASE 6 | **new** |
| `docs/operations/EPIC-004.6_BASELINE_REVIEW.md` | this doc | **new** |
| `docs/operations/EPIC-004.6_VALIDATION_REPORT.md` | PHASE 7 | **new** |
| `docs/operations/EPIC-004.6_COMPLETION_REPORT.md` | PHASE 7 | **new** |
| `ROADMAP.md` | shared | **extended** (EPIC-005 gate) |

All new files are additive. The only existing file with a behavioral edit is
`execution-coordinator.ts`, and that edit is a *wrapping* of the existing
approval checks behind the new `ExecutionPolicyEvaluator` — it does not remove
or weaken any existing gate.

---

## 6. Baseline verdict

✅ **No ownership conflicts. Proceed.**
✅ Foundations (tenant, capability registry, approval flow, audit, execution
store) are present and fail-closed.
⚠️ The single gap is *architectural*: trust decisions are correct but
**scattered and non-reusable**. EPIC-004.6 collapses them into one decision
point and adds the idempotency / lease / metrics seams required before
external (EPIC-005 MCP) capability expansion.

---

## 7. EPIC-004.6 — Completion Report (2026-07-20)

### Delivered modules (`services/execution/`)

| Phase | Module | Status |
|-------|--------|--------|
| P1 | `policy-evaluator.ts` — `ExecutionPolicyEvaluator`, `ExecutionPolicyRequest`, `ExecutionPolicyDecision`, `policyRequestFromStore()` | ✅ |
| P2 | `idempotency.ts` — `ExecutionIdempotencyTracker`, `ExecutionRequestIdentity` | ✅ |
| P3 | `lease.ts` — `ExecutionLease`, `ExecutionLeaseManager`, `MemoryExecutionLeaseManager`, `LeaseAcquireResult` | ✅ |
| P4 | `metrics.ts` — `ExecutionMetrics`, `MemoryExecutionMetrics` | ✅ |
| P5 | `execution-coordinator.ts` — policy gate + lease acquire/release + metrics recording wired into `run()` | ✅ |
| — | `index.ts` — exports the four new seams | ✅ |
| Tests | `epic-004.6.test.ts` — 20 tests (8 denial + idempotency + lease + metrics) | ✅ |

### Single Decision Point (fail-closed)

`run()` now calls `policyRequestFromStore(store, tenant, id, principal, capability, backend, approvalRequired)` → `policy.evaluate(preq)`. Any DENY throws `PolicyDeniedError` and emits `execution.policy.denied` audit before any approval/lifecycle handling. Categories: `denied:missing-principal`, `denied:unknown-principal`, `denied:missing-tenant`, `denied:tenant-mismatch`, `denied:missing-capability`, `denied:unknown-capability`, `denied:unknown-provider`, `denied:missing-approval`, `denied:expired-approval`, `denied:invalid-lifecycle`.

### Lease contract (EPIC-005 seam)

`acquire()` returns `{ ok:true, lease }` / `{ ok:false, reason }`. Steal-forbidden, expired-recoverable, unknown-worker-denied — verified by tests.

### Validation results

| Gate | Result |
|------|--------|
| **EPIC-004.6 tests** (`vitest run epic-004.6.test.ts`) | **20 passed / 20** |
| **Typecheck — my 6 source files** (`tsc --noEmit`) | **0 errors** |
| **Typecheck — whole `hermes/` tree** | Only pre-existing baseline `@cloudflare/workers-types` / `@hermes/*` module-resolution errors in files I did **not** touch (`audit.ts`, `authn.ts`, `principal.ts`, `permissions.ts`, `middleware.ts`). Environmental (no path-alias / workers-types config in standalone `hermes/`), unrelated to EPIC-004.6. |
| **Secret scan** (new files) | Clean — no keys/tokens. |

### Notes for owner

- `hermes/` has no `package.json` / tsconfig paths / `@cloudflare/workers-types` in this checkout, so standalone `tsc` over the whole tree emits module-resolution errors that are NOT regressions. The real build (monorepo alias config) resolves these. EPIC-004.6 code typechecks clean in isolation and passes runtime tests.
- `epic-004.6.test.ts` shows one `tsc` error (`Cannot find module 'vitest'`) only because `hermes/` has no `node_modules`; vitest itself runs it green.
- Integration tests driving the full `run()` end-to-end (real `ExecutionStore` + `PolicyEvaluatorDeps`) are recommended next, behind monorepo alias resolution being wired up.