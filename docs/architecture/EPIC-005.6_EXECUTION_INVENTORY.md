# EPIC-005.6 — Execution Path Inventory (PHASE 1)

**Purpose:** Enumerate every location that can trigger provider / capability / tool / agent
execution, map it against the **mandated chain**, and mark every bypass.

**Mandated chain (single trust boundary):**
```
Identity → Tenant → Capability Resolution → Policy → Verifiable Approval
        → Runtime Guard → Transport Selection → Provider Execution → Audit Persistence
```

Legend: ✅ enforced · ⚠️ partial · ❌ missing · n/a not applicable.

---

## Inventory Table

| Path | Entry point | Capability lookup | Policy | Approval | Runtime Guard | Provider call | Audit |
|------|-------------|-------------------|--------|----------|---------------|---------------|-------|
| **A** | `providers/platform.ts:159` `UCP.execute` | `capabilityRegistry` (guard) | n/a in execute* | n/a in execute* | ✅ `runtimeGuard.guard` (`:181`) | ✅ `provider.execute` (`:204`) | ✅ `audit` (`:175,:205`) |
| **B** | `activation/provider-framework.ts:307` `executeCapability` | `resolveProviderForCapability` (`:312`) | ❌ | ⚠️ token presence only (`:328`) | ❌ | ✅ `p.executor` (`:356`) | ✅ via port |
| **C** | `execution/execution-coordinator.ts:186` `run` | store-backed `policyRequestFromStore` | ✅ `policy.evaluate` (`:210`) | ✅ durable `ExecutionApproval` (`:230-241`) | ❌ (not in coordinator) | ⚠️ caller `executor` cb (`:264`) | ✅ `emitAudit` |
| **D** | `activation/git-provider.ts` `commitChanges`/`pushBranch` | `BACKEND` port | ❌ | ⚠️ token presence | ❌ | ✅ `BACKEND.commit/push` | ✅ via port |
| **E** | `tools/tool-capabilities.ts` `ToolProvider.run` | `ToolProvider` registry | ❌ | ⚠️ `requiresApproval` flag | ❌ | ✅ `port(...)` | ✅ via emitAudit |
| **F** | `agents/task.ts` `approveTask`/`completeTask` | n/a (task state) | ❌ | ❌ arbitrary approver | n/a | n/a (substrate) | ✅ `emitAudit` |

\* Path A's `execute()` assumes the caller already performed tenant + approval + policy.
The guard (`runtimeGuard.guard`) enforces **tenant (if asserted) + transport + capability +
provider-state + health + rate-limit + signature**, but **not** human-approval verification
(that lives in Stack C). So even the "good" path requires the coordinator in front of it to
be the real approval authority.

---

## Every Bypass (explicit)

1. **Bypass #1 — Stack B skips Runtime Guard (CRITICAL).**
   `executeCapability` (`provider-framework.ts:307`) never imports or calls `ProviderRuntimeGuard`.
   → Any capability invoked through Stack B evades transport/capability/provider-state/health/rate-limit/signature checks.

2. **Bypass #2 — Stack B skips Tenant enforcement (HIGH).**
   `executeCapability` has no `tenantId` on its `ctx` and never calls `enforceTenant`.
   → One tenant's capability can be executed with no tenant scoping.

3. **Bypass #3 — Self-approval via `"human-token"` (CRITICAL).**
   `security-agent.ts:159` passes `approvalToken: "human-token"` for required approvals.
   Stack B accepts any non-empty token. → The executing agent authorizes its own privileged action.

4. **Bypass #4 — Approval token unverifiable (CRITICAL).**
   `provider-framework.ts:328` only checks `!ctx.approvalToken`. No issuer, tenant, capability, or expiry binding.

5. **Bypass #5 — Coordinator executor callback can re-enter Stack B (HIGH).**
   `execution-coordinator.ts:264` `executor` is caller-supplied. If wired to `executeCapability`,
   the durable/tenant/approval-checked path ends in an unguarded, tenant-less execution.

6. **Bypass #6 — Unsafe `verifyApprover` default (HIGH).**
   `execution-coordinator.ts:91` default `(a)=>a.length>0` accepts any string as a valid approver.

7. **Bypass #7 — `approveTask` arbitrary approver (MEDIUM).**
   `agents/task.ts` `approveTask(id, approver)` performs no permission check; Stack C's `run`
   self-approves this secondary task (`:256-257`). The *authoritative* approval is the durable
   `ExecutionApproval`, but the secondary task's loose approval is a confusing/abusable artifact.

8. **Bypass #8 — Tool primitive outside the chain (HIGH).**
   `ToolProvider` (`tools/tool-capabilities.ts`) is a parallel execution primitive with no tenant,
   no guard, no unified approval model. Any `ToolProvider.run` is outside the single boundary.

9. **Bypass #9 — Placeholder signature verification (HIGH).**
   `trust/lifecycle.ts:174` `verifyChecksum` returns `true`. Signature presence is checked but
   integrity is not. → A tampered manifest with a "trusted" signer id passes.

10. **Bypass #10 — No-op provider authentication (HIGH).**
    `trust/lifecycle.ts:129-130` `AUTHENTICATED` step is a no-op; `transport/mcp.ts:105` `secretRef`
    never resolved. → Provider identity/auth is not actually enforced at trust admission.

---

## Call-graph of bypasses (who reaches Stack B)

```
security-agent.runSecurityScan ──▶ executeCapability ──▶ [Bypass 1,2,3,4]
git-provider.commitChanges/pushBranch ──▶ BACKEND port ──▶ executeCapability ──▶ [Bypass 1,2,4]
ToolProvider.run ──▶ [Bypass 8]
coordinator.run(executor=executeCapability) ──▶ [Bypass 1,2,4,5]
```

**Conclusion:** There are exactly **two real execution engines** (Stack A `UCP.execute` guarded;
Stack B `executeCapability` unguarded). Every other path either (a) calls one of these two, or
(b) is a parallel primitive (ToolProvider / task substrate) outside the boundary. Unifying
requires: route **all** callers through one `HermesExecutionGateway`, make Stack B a private
implementation detail (or delete it), and fold the `ToolProvider` primitive into the same gateway.

*End of PHASE 1 inventory. No source modified.*
