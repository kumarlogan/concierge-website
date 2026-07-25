# EPIC-005.6 — Stack B Close-Out Validation

**Date:** 2026-07-20
**Status:** ✅ CLOSE-OUT COMPLETE — Stack B fully green (108/108)
**Scope:** No new features. Debug removal + async-executor verification + Stack B validation re-run + regression verification only.

---

## 1. Files Touched (this close-out)

| File | Change | Why |
|------|--------|-----|
| `hermes/services/activation/provider-framework.ts` | Removed 3 temporary debug blocks (6 lines) | Diagnostic statements added during EPIC-005.6 troubleshooting (see §2) |

No other source files modified in this close-out. The Stack B gateway wiring
(`stackBGateway`, `StackBGatewayGuard`, `toolResultToOutcome`, `outcomeToToolResult`)
was introduced in the EPIC-005.6 implementation phase and is **not** part of this
close-out's diff — only the debug statements it temporarily carried were removed.

---

## 2. Temporary Debug Removal

Three `DEBUG-REMOVE`-tagged diagnostic blocks were stripped from
`executeCapability` in `provider-framework.ts`:

| Lines (before) | Removed code | Rationale |
|----------------|--------------|-----------|
| 507–508 | `// DEBUG-REMOVE` + `console.error("[stackB gwRes]", …)` | Traced raw gateway result after `await stackBGateway.execute`. Not part of the shipped contract. |
| 510–511 | `// DEBUG-REMOVE` + `console.error("[stackB deny]", …)` | Traced denial reason/code/audit. Diagnostic only. |
| 521–522 | `// DEBUG-REMOVE` + `console.error("[stackB returning]", …)` | Traced outgoing `ToolResult` shape. Diagnostic only. |

Post-removal verification:
- `grep -rn "DEBUG-REMOVE\|\[stackB" hermes/` → **CLEAN** (no matches).
- All three removals were inside the `try` block of `executeCapability`; no
  control-flow, return statement, or audit call was altered.

---

## 3. Async Executor Fix — Verification

**Location:** `hermes/services/activation/provider-framework.ts`, `executeCapability`.

**The fix (already present from implementation phase, re-verified here):**

```ts
const gwRes = await stackBGateway.execute(gwReq, providerCtx, async (_cap, req) => {
  const raw = await p.executor!(capabilityId, req.args ?? {}, ctx); // ✅ AWAITED
  const out = toolResultToOutcome(p.id, raw);                        // raw is always ToolResult
  return out;
});
```

**Verification points:**

1. `CapabilityExecutor` return type is `Promise<ToolResult> | ToolResult`
   (`provider-framework.ts:124`).
2. The executor invocation is wrapped in `await` at the call site
   (`provider-framework.ts:503`). Because the callback is `async`, `raw` is
   fully resolved **before** it is passed to `toolResultToOutcome`.
3. `toolResultToOutcome(providerId, res: ToolResult)` (`provider-framework.ts:395`)
   receives a concrete `ToolResult`, never an unresolved `Promise`.
4. The gateway's `HermesExecutionGateway.execute` returns `ProviderOutcome`
   (which is `ProviderResult | ProviderError` from `providers/sdk.ts:74`);
   `gwRes.outcome` is then mapped back via `outcomeToToolResult`.

**Conclusion:** No unresolved `Promise` can reach `toolResultToOutcome()` or the
`ProviderOutcome` contract. The intermittent "returns a pending promise / undefined
data" class of bug from the troubleshooting window is structurally eliminated.

---

## 4. Stack B Validation — Re-run Results

**Command:**
```
cd workers && npx vitest run \
  tests/hermes.security.003.test.ts \
  tests/hermes.security.004.test.ts \
  tests/hermes.activation.007.test.ts \
  tests/hermes.developer.003.test.ts \
  tests/hermes.execution.003.test.ts
```

**Result: 108 passed / 108 (5 files) ✅**

| Suite | Tests | Result | Duration |
|-------|-------|--------|----------|
| `hermes.security.003.test.ts` | 28 | ✅ pass | 24ms |
| `hermes.security.004.test.ts` | 19 | ✅ pass | 25ms |
| `hermes.activation.007.test.ts` | 16 | ✅ pass | 2023ms |
| `hermes.developer.003.test.ts` | 17 | ✅ pass | 22ms |
| `hermes.execution.003.test.ts` | 28 | ✅ pass | 3028ms |
| **Total** | **108** | **✅ 108/108** | **7.55s** |

Target was **108/108** — achieved.

---

## 5. Regression Verification

| Check | Status | Evidence |
|-------|--------|----------|
| **No execution-path regression** | ✅ PASS | All 5 suites green; the single boundary `executeCapability → stackBGateway → executor` is intact and still the only call into the vendor port. |
| **No `ProviderResult` contract change** | ✅ PASS | `toolResultToOutcome` still uses `okResult`/`errResult` (`providers/sdk.ts:115,125`) with unchanged signatures; `ProviderOutcome = ProviderResult \| ProviderError` (`sdk.ts:74`) untouched. |
| **No runtime guard bypass** | ✅ PASS | `StackBGatewayGuard extends ProviderRuntimeGuard` (`provider-framework.ts:325`) is wired as `guard:` on `stackBGateway` (`:390`). It enforces active+enabled+healthy + cross-tenant scope (`RUNTIME_TENANT`, `:343`). The guard is the only thing that invokes the executor. |
| **No tenant regression** | ✅ PASS | `StackBGatewayGuard.guard` performs the cross-tenant scope check (`:337–344`); requests bind `principal`, `tenantId`, and `targetTenantId` all to `ctx.actor` (`provider-framework.ts:466–488`), so same-tenant is preserved and cross-tenant is denied fail-closed. |

---

## 6. Root Cause (of the bug this close-out validated)

**Symptom during EPIC-005.6 implementation:** Stack B capability execution
occasionally produced a pending `Promise` or `undefined` data in the returned
`ToolResult`, and the in-process executor path had no runtime guard.

**Root cause:**
1. The original `executeCapability` called `p.executor!(...)` and passed the
   result straight into `toolResultToOutcome` **without awaiting**, so when the
   executor returned a `Promise<ToolResult>` (its legal union return), an
   unresolved promise flowed into the `ProviderOutcome` mapping.
2. Stack B bypassed `ProviderRuntimeGuard` entirely (tenant + health + state
   checks absent), violating the single-trust-boundary mandate.

**Permanent fix (applied in implementation phase, verified in this close-out):**
- `await` the executor result inside the async gateway callback
  (`provider-framework.ts:503`) so `ToolResult` is always concrete before mapping.
- Route every Stack B execution through `HermesExecutionGateway` with
  `StackBGatewayGuard` (tenant + lifecycle/health gating), expressing Stack B's
  in-process trust model as gate 4 of the unified boundary rather than fabricating
  a manifest. Approval remains upstream via Stack B's own token gate.

---

## 7. Remaining Work

- Stack B is **green and closeable**. The broader EPIC-005.6 mission (collapse
  Stack A + Stack B + `ToolProvider` into a single `HermesExecutionGateway` with
  uniform verifiable approval) proceeds in later phases (s5–s9) — **not** started
  here per close-out rules.
- The following EPIC-005.6 trust gaps from the baseline review remain **outside**
  this close-out's scope and are tracked for subsequent phases:
  - G2/G3: Stack B approval-token is still a non-empty-string presence check
    (`security-agent.ts` self-issues `"human-token"`). A durable `ExecutionApproval`
    verification is deferred to the approval-modeling phase.
  - G8: `approveTask` arbitrary-approver weakness (Stack C task substrate).
  - G9/G12: ExecutionStore durability defaults to in-memory.
- No commits, no deploys, no new implementation performed in this close-out.

---

*End of EPIC-005.6 Stack B Close-Out Validation. Stack B is completely green —
the EPIC may proceed to s5–s9.*
