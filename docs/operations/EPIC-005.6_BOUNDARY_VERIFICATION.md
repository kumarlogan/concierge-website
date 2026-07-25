# EPIC-005.6 — s5 Single Boundary Verification

**Phase:** s5 (READ-ONLY architecture verification)
**Scope:** Confirm `HermesExecutionGateway` is the single execution boundary for provider/capability execution.
**Mode:** Verification only. No source changes, no fixes, no commits, no deploy.

---

## 1. Execution Path Inventory

Every provider/capability execution entry point found in `hermes/services` (and the
`workers` runtime) is listed below. Tests (`*.test.ts`) are excluded from the inventory
but were used to confirm wiring.

| # | File / Function | Line | Caller chain | Through Gateway? | Class |
|---|---|---|---|---|---|
| 1 | `providers/platform.ts` — `UniversalCapabilityPlatform.execute()` | 191 | external → `platform.execute` | ✅ `this.gateway.execute` (239) | **A** |
| 2 | `activation/provider-framework.ts` — `executeCapability()` | 419 | `developer-agent`, `security-agent`, `git-provider` | ✅ `stackBGateway.execute` (502) | **A** |
| 3 | `execution/execution-coordinator.ts` — `ExecutionCoordinator.run()` | 186 | — (no prod instantiation found) | ❌ own policy+approval+lease, executor injected | **B / latent D** |
| 4 | `execution/execution-queue.ts` — `approveAndRun()` / `retryEntry()` | 179 / 241 | `workforce/orchestration.ts:340` | ❌ `orchestrate()` + injected executor | **B** |
| 5 | `workforce/orchestration.ts` — `runTask()` | 316 | workflow engine | ❌ via `approveAndRun` | **B** |
| 6 | `mcp/adapter.ts` — `handleMcpToolCall()` | 76 | MCP client | ❌ `provider.run(toolCall)` (91) | **C** |
| 7 | `tools/tool-provider.ts` — `ToolProvider.run()` | 46 | `mcp/adapter`, `dev/security/docs/research/monitoring-tools` | ❌ separate tool boundary | **B / C** |
| 8a | `activation/git-provider.ts` — `git.*` capability executor | 54 | via `executeCapability` | ✅ (registered ManagedProvider → gateway) | **A** |
| 8b | `activation/git-provider.ts` — `commitChanges()` / `pushBranch()` | 111 / 148 | `developer-agent`, human approval flow | ❌ direct `BACKEND` call (own token gate) | **C** |
| 9a | `activation/providers/claude-code.ts` — `claudeCodeFactory` executor | 67 | via `executeCapability("dev.code.*")` | ✅ (ManagedProvider → gateway) | **A** |
| 9b | `activation/providers/claude-code.ts` — `claudeCodeToolProvider` | 88 | legacy ToolProvider | ❌ tool boundary | **C** |
| 10 | `security/providers/security-providers.ts` — executor | 68 | via `executeCapability("sec.*")` | ✅ (ManagedProvider → gateway) | **A** |
| 11 | `activation/developer-agent.ts` — `planTask/generateCode/securityReview` | 78 / 98 / 125 | `runDeveloperAgent` | ✅ (call `executeCapability`) | **A** |
| 12 | `security/security-agent.ts` — `runSecurityScan` | 159 | `runSecurityReview` | ✅ (calls `executeCapability`) | **A** |
| 13 | `developer/developer-runtime.ts` — `makeSimulatedClaudeCodeExecutor` | 41 | demo/sim only | n/a (sim) | **D** |
| 14 | `workers/src` (runtime) | — | — | — | **none** (0 refs to gateway/executeCapability) |

**Classification legend:**
- **A** — Approved gateway execution path (routes through `HermesExecutionGateway`)
- **B** — Internal adapter/helper (orchestration substrate; executor injected, not a live second boundary)
- **C** — Potential bypass (second execution boundary not through the gateway)
- **D** — Dead/legacy/simulation code

**Key finding:** Every *capability* execution (Stack A `UniversalCapabilityPlatform.execute`,
Stack B `executeCapability`, and all callers — developer-agent, security-agent, git capability,
claude-code, security providers) now passes through `HermesExecutionGateway`. The gateway is the
single boundary for the capability execution domain.

---

## 2. Gateway Enforcement Proof

`HermesExecutionGateway.execute()` (`execution/gateway/hermes-execution-gateway.ts:157-285`)
runs, in strict order, every required gate, then dispatches through one injected executor:

```
Request (GatewayRequest)
  ↓
(1) TENANT ENFORCEMENT        enforceTenant(principal, tenantId)        [line 185]
      → stamps principal/tenantId into providerRequest.context         [195-202]
  ↓
(2) POLICY EVALUATION         ExecutionPolicyEvaluator.evaluate(preq)    [219]
      (EPIC-004.6 single decision point)
  ↓
(3) APPROVAL VERIFICATION     approvals.verify(approvalRef, ...)         [239]
      (structured ApprovalRef, fail-closed)
  ↓
(4) RUNTIME GUARD             ProviderRuntimeGuard.guard(guardCtx)       [261]
      (EPIC-005.5, 8 dimensions)
  ↓
(5) DISPATCH                  await executor(capabilityId, request)      [272]
      (only reached after ALL gates pass)
  ↓
AUDIT EMISSION                emitAudit(allow|deny)                       [178 / 273]
```

The executor that actually runs the provider is injected by the caller and invoked **only**
at step (5), after every gate has passed. The provider-side call
(`provider.execute` / `p.executor`) lives *inside* that injected callback and therefore
cannot run until the gateway has cleared tenant → policy → approval → guard.

Both live stacks construct the gateway:
- Stack A: `new HermesExecutionGateway({...})` — `platform.ts:78`
- Stack B: `new HermesExecutionGateway({ guard: new StackBGatewayGuard(), ... })`
  — `provider-framework.ts:385`

**Conclusion:** The gateway is responsible for (and proven to enforce) tenant validation,
policy evaluation, approval verification, runtime-guard checks, provider dispatch, and audit
emission.

---

## 3. Stack A Verification — `UniversalCapabilityPlatform.execute()`

| Requirement | Result | Evidence |
|---|---|---|
| Routes through `HermesExecutionGateway` | ✅ PASS | `platform.ts:239` `this.gateway.execute(gwReq, providerCtx, ...)` |
| Does NOT directly call `provider.execute()` outside gateway | ✅ PASS | only `provider.execute(r)` is at `platform.ts:240`, inside the gateway executor callback |
| `ProviderResult` contract unchanged | ✅ PASS | returns `gwRes.outcome` (mapped `ProviderOutcome`); external return type unchanged (`platform.ts:194`) |
| No bypass exists | ✅ PASS | no other execution call site in `platform.ts` |

**Stack A: PASS**

---

## 4. Stack B Verification — `executeCapability()`

| Requirement | Result | Evidence |
|---|---|---|
| Routes through `HermesExecutionGateway` | ✅ PASS | `provider-framework.ts:502` `stackBGateway.execute(gwReq, providerCtx, ...)` |
| No direct provider executor invocation outside gateway | ✅ PASS | only `p.executor!(...)` at `provider-framework.ts:503`, inside the gateway executor callback |
| `StackBGatewayGuard` remains active | ✅ PASS | `stackBGateway = new HermesExecutionGateway({ guard: new StackBGatewayGuard() })` (`provider-framework.ts:385,390`); `StackBGatewayGuard extends ProviderRuntimeGuard` (`:325`) |
| Tenant enforcement preserved | ✅ PASS | gateway stamps principal/tenantId (`:195-202`); `StackBGatewayGuard` runs cross-tenant check (`:342-344`) |

> Note: Stack B still retains its upstream token-presence approval gate
> (`provider-framework.ts:436-451`) ahead of the gateway. That is a supplementary
> fail-closed check, not a bypass; the gateway remains the single governed dispatch boundary.

**Stack B: PASS**

---

## 5. Legacy Path Detection (classify only — nothing removed)

| Path | File | Classification | Rationale |
|---|---|---|---|
| `ExecutionCoordinator` | `execution/execution-coordinator.ts` | **DEPRECATE** | Parallel gate set (policy+approval+lease) NOT via `HermesExecutionGateway`. Not instantiated in production today (no `new ExecutionCoordinator` outside tests) — latent second boundary. If ever reactivated, must route executor through the gateway. |
| `execution-queue` (`approveAndRun`/`retryEntry`) | `execution/execution-queue.ts` | **DEPRECATE** | Orchestration substrate; injected executor bypasses gateway. Same latent risk as Coordinator. |
| `workforce/orchestration.runTask` | `workforce/orchestration.ts` | **DEPRECATE** | Uses execution-queue; same latent risk. |
| `ToolProvider` abstraction + `mcp/adapter` | `tools/tool-provider.ts`, `mcp/adapter.ts` | **MIGRATE** | Tools are a distinct, intentionally-scoped execution surface (docs/shell helpers) with their own approval-token contract. Should be explicitly reconciled as a sanctioned second boundary OR re-routed through the gateway. |
| `claudeCodeToolProvider` | `activation/providers/claude-code.ts:88` | **DEPRECATE** | Legacy ToolProvider variant parallel to the capability path. |
| `git-provider` direct `BACKEND` calls (`commitChanges`/`pushBranch`) | `activation/git-provider.ts:111/148` | **KEEP** | Human-gated (fail-closed token). Not on the capability gateway path; acceptable as an explicitly human-scoped operation, but is a second execution surface. |
| Simulated Claude Code executor | `developer/developer-runtime.ts:41` | **REMOVE LATER** | Simulation-only; never used in production orchestration. |

---

## 6. Provider Neutrality Check

Search for `providerId ===`, `vendor ===`, `=== "claude"`, `=== "anthropic"`,
`=== "ags"`, `=== "fertility"`, and vendor `switch` statements in all execution paths.

**Result: PASS — no vendor/provider/AGS/fertility conditional branches in any execution path.**

Real (non-test) references to these keywords:

| Ref | File | Nature | Verdict |
|---|---|---|---|
| `agentId === "ags-fertility-ops-agent"` | `agents/approval.ts:256` | Safety guard that *permanently disables* a known dangerous agent | Benign — not an execution-dispatch branch |
| `"ags-fertility-ops-agent": [...]` | `agents/permissions.ts:52` | Permission map keyed by agent id | Benign — not execution dispatch |
| `vendor: "anthropic"` | `claude-code/index.ts:20` | Manifest metadata field | Not a runtime branch |
| `endpoint: "claude"` | `claude-code/index.ts:50` | Transport config | Not a runtime branch |
| `require(typeof obj.vendor === "string")` | `providers/manifest-v2.ts:146` | Schema validation | Not a runtime branch |
| `switch (capability)` | `git-provider.ts`, `developer-runtime.ts` | Keyed by **capability id**, not vendor | Provider-neutral |

No `providerId`-或 `vendor`-keyed `switch`/`if` changes execution behavior. The gateway and
both stacks are provider-neutral.

---

## 7. Deliverable Contents

- Execution path inventory (§1) — 14 entries classified A/B/C/D
- Gateway proof (§2) — ordered gate chain with line refs
- Stack A result (§3) — **PASS**
- Stack B result (§4) — **PASS**
- Remaining bypasses (§5 / below)
- Migration recommendations (§8)
- Risk assessment (§9)

---

## 8. Migration Recommendations

1. **Reconcile the `ToolProvider`/MCP boundary.** Either (a) explicitly document it as a
   sanctioned, separately-governed execution surface with its own fail-closed approval
   contract, or (b) route `ToolProvider.run` through `HermesExecutionGateway` as well. Today
   it is an ungoverned-by-gateway second boundary (Class C).
2. **Retire `ExecutionCoordinator` / `execution-queue` / `workforce/orchestration` as live
   execution boundaries** (or re-route their injected executor through the gateway). They are
   currently dormant in production but represent a latent second trust boundary (Class B/D).
3. **Keep `git-provider` human-gated ops** (`commitChanges`/`pushBranch`) but document them as
   an explicit human-only execution surface outside the capability gateway.
4. **Remove the simulated executor** (`developer-runtime.ts`) when its demo use ends.

---

## 9. Risk Assessment

| Risk | Severity | Status | Note |
|---|---|---|---|
| Capability execution bypasses the gateway | — | **Resolved** | All capability paths (Stack A + B + callers) verified through gateway |
| Vendor/provider-specific execution branch | — | **Resolved** | No such branch exists |
| `ToolProvider`/MCP second boundary not via gateway | MEDIUM | **Open** | Tools are scoped (docs/shell) + token-gated, but not gateway-governed |
| `git-provider` direct BACKEND calls | LOW | **Open (accepted)** | Human-gated fail-closed; not on capability path |
| Latent `ExecutionCoordinator`/`queue` second boundary | MEDIUM | **Open (dormant)** | Not instantiated in prod; would bypass guard if reactivated |
| Stack B `ctx.actor` used as `tenantId` | LOW | **Accepted** | Gateway still enforces `enforceTenant` on it; no cross-tenant leak demonstrated |

### PASS / FAIL Summary

| Check | Result |
|---|---|
| Stack A routes through gateway | ✅ PASS |
| Stack B routes through gateway | ✅ PASS |
| No direct provider executor outside gateway (both stacks) | ✅ PASS |
| Gateway enforces tenant/policy/approval/guard/audit | ✅ PASS |
| Provider neutrality (no vendor branches) | ✅ PASS |
| Single boundary for *capability* execution | ✅ PASS |
| Single boundary for *all* execution (incl. tools/git/coordinator) | ⚠️ PARTIAL — tool/MCP + git BACKEND + dormant coordinator are separate surfaces |

**Overall: PASS for the capability-execution domain (the EPIC-005.6 boundary target).**
Remaining non-gateway surfaces are scoped/accepted but tracked as open risks.

---

## Files Inspected

- `hermes/services/execution/gateway/hermes-execution-gateway.ts` (full)
- `hermes/services/providers/platform.ts` (full)
- `hermes/services/activation/provider-framework.ts` (full, lines 1-551)
- `hermes/services/execution/execution-coordinator.ts` (full)
- `hermes/services/execution/execution-queue.ts` (lines 170-259)
- `hermes/services/workforce/orchestration.ts` (lines 300-359)
- `hermes/services/activation/developer-agent.ts` (full)
- `hermes/services/security/security-agent.ts` (full)
- `hermes/services/activation/git-provider.ts` (full)
- `hermes/services/activation/providers/claude-code.ts` (lines 1-90)
- `hermes/services/security/providers/security-providers.ts` (line 68)
- `hermes/services/mcp/adapter.ts` (full)
- `hermes/services/tools/tool-provider.ts` (full)
- `hermes/services/developer/developer-runtime.ts` (lines 1-61)
- `hermes/services/agents/approval.ts` (line 256), `agents/permissions.ts` (line 52)
- `hermes/services/providers/manifest-v2.ts` (line 146), `providers/claude-code/index.ts` (lines 18-50)
- `workers/src` (grep — 0 execution-boundary references)
- Reference: `docs/architecture/EPIC-005.6_EXECUTION_INVENTORY.md`, `EPIC-005.6_BASELINE_REVIEW.md` (pre-migration baseline)
