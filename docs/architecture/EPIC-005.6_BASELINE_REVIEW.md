# EPIC-005.6 — Baseline Review (PHASE 0)

**Date:** 2026-07-20 · **Status:** Read-only baseline, pre-design.
**Scope:** Every execution entry point that can trigger provider / capability / tool / agent execution.
**Rules honored:** No code changes, no commits, no deploys, no AGS/Cloudflare/secret changes.

This document is the evidence base for the EPIC-005.6 design (PHASES 1–5) and the
implementation gate (PHASE 6). Every claim cites a file:line.

---

## 1. Current Execution Paths

### Path A — Universal Capability Platform (Stack A, guarded)
**Entry:** `services/providers/platform.ts:159` `UniversalCapabilityPlatform.execute(providerId, req)`
**Instantiated at:** `services/providers/manager.ts:68` (and tests only).
**Chain observed in code:**
1. `liveProviders.get(providerId)` → `PROVIDER_UNAVAILABLE` if absent (`platform.ts:163`).
2. `audit(EXECUTION_REQUESTED)` (`platform.ts:175`).
3. `runtimeGuard.guard({...})` (`platform.ts:181`) — **EPIC-005.5, 8 checks, fail-closed**.
4. `provider.execute(req)` (`platform.ts:204`) — the ONLY provider call site in Stack A.
5. `audit(EXECUTION_SUCCESS|FAILURE)` (`platform.ts:205`).

**Tenant enforcement:** Via `ProviderRuntimeGuard.checkTenantScope` → `enforceTenant(principal, targetTenantId)` **only when the request asserts `targetTenantId`** (confirmed in guard; tenant-id is a field on `ProviderRequest`).
**Approval enforcement:** NOT inside `execute()`. The platform trusts the caller already vetted approval. (Approval lives in Stack A's *coordinator* path — see Path C.)

### Path B — Provider Framework `executeCapability` (Stack B, UNGUARDED)
**Entry:** `services/activation/provider-framework.ts:307` `executeCapability(capabilityId, args, ctx)`
**Callers:**
- `services/security/security-agent.ts:159` `runSecurityScan` → passes `approvalToken: req.approvalRequirement.required ? "human-token" : undefined`.
- (any activation-scoped capability user)

**Chain observed in code:**
1. `resolveProviderForCapability` (active+enabled+healthy) (`provider-framework.ts:312`).
2. Approval **token presence** check only: `if (needsApproval && !ctx.approvalToken) deny` (`provider-framework.ts:328`). Token is **any non-empty string**.
3. `if (!p.executor) deny` (`provider-framework.ts:341`).
4. `p.executor(capabilityId, args, ctx)` → vendor port (`provider-framework.ts:356`).
5. `audit(provider.capability.exec/done/denied/...)`.

**Tenant enforcement:** **NONE.** `executeCapability` never calls `enforceTenant`. There is no `tenantId` on its `ctx`.
**Runtime guard:** **NONE.** `ProviderRuntimeGuard` is not imported or invoked here.
**Auth:** `provider-framework` does not authenticate the principal; `ctx.actor` is a free-form string.

### Path C — Execution Coordinator (durable, Stack A-side policy)
**Entry:** `services/execution/execution-coordinator.ts:186` `ExecutionCoordinator.run(id, approver, executor, args, principal, opts)`
**Chain observed:**
1. `policyRequestFromStore` → `ExecutionPolicyEvaluator.evaluate` (`execution-coordinator.ts:201-210`) — tenant/principal/capability/provider/approval/lifecycle, fail-closed.
2. Lease acquire (`execution-coordinator.ts:224`).
3. Durable approval re-check: `ex.approval` must exist, `ex.approval.approver === approver`, `verifyApprover(approver)`, not expired (`execution-coordinator.ts:230-241`).
4. `createTask` + `assignTask` + `approveTask` — **this is a SECONDARY AgentTask for the orchestration substrate, not the authoritative execution approval** (the authoritative approval is the durable `ExecutionApproval` recorded earlier via `coordinator.approve()` (`execution-coordinator.ts:162`)).
5. `orchestrate(task.id, () => executor(capability, args))` (`execution-coordinator.ts:261-271`).
6. `executor` is a **caller-supplied callback**. If the caller wires `executor` → `executeCapability` (Stack B), then this durable, tenant-checked, approval-checked path **ends in an unguarded, tenant-less execution**. That is the central bypass.

**Approval model (Stack C):** durable `ExecutionApproval { approver, at, capability, scope, expiresAt? }` (`persistence/execution-store.ts`). Verified by `verifyApprover` (default `(a)=>a.length>0` — **unsafe default**, `execution-coordinator.ts:91`).

### Path D — Git Provider typed ops (Stack B typed API)
**Entry:** `services/activation/git-provider.ts` `commitChanges`/`pushBranch` (require approval token), via `BACKEND` port. These are higher-level functions that themselves gate on `approvalToken` presence (same non-empty-string weakness). `pushBranch` is the only push path.

### Path E — Tool capability execution (legacy/parallel)
**Entry:** `services/tools/tool-capabilities.ts`, `dev-tools.ts`, `security-tools.ts` — `ToolProvider.run(call)` with `requiresApproval`/`requiresApprovalIn`. Separate `ToolProvider` primitive from `provider-framework`. No tenant context, no runtime guard, approval = token presence in some callers.

### Path F — Agent task substrate
`services/agents/task.ts` `createTask/assignTask/approveTask/completeTask/failTask` — a *task state machine* used by both the coordinator (secondary) and the orchestrator. `approveTask` takes an arbitrary `approver` string and performs no permission check (confirmed in earlier review).

---

## 2. Duplicate Systems

| Concept | Stack A | Stack B |
|---------|---------|---------|
| Provider registry | `services/providers/capability.ts` `MemoryCapabilityRegistry` | `services/activation/provider-framework.ts` module `REGISTRY` (`ManagedProvider`) |
| Capability resolution | `capabilityRegistry.get/ownerOf` (used by guard) | `resolveProviderForCapability` (active+healthy) |
| Execution engine | `UniversalCapabilityPlatform.execute` (+ guard) | `executeCapability` (no guard) |
| Approval | durable `ExecutionApproval` (Stack C) | opaque non-empty string token (Stack B) |
| Claude Code provider | `services/providers/claude-code/index.ts` (id `claude-code`, manifest V2) | `services/activation/providers/claude-code.ts` (id `dev.claude-code`, `CapabilityExecutor` port) |
| Runtime guard | `ProviderRuntimeGuard` (only called in Stack A) | absent |
| Tenant enforcement | `enforceTenant` in guard + policy evaluator | absent in `executeCapability` |
| Tool primitive | `ToolProvider` (`services/tools`) | `CapabilityExecutor` (`activation/provider-framework`) |

**Two capability registries, two Claude Code providers, two approval models, two
execution engines.** Governance is not uniform.

---

## 3. Trust Gaps (evidence-cited)

| # | Gap | Severity | Evidence |
|---|-----|----------|----------|
| G1 | Runtime guard absent on Stack B (`executeCapability`) | CRITICAL | `provider-framework.ts:307` (no `runtimeGuard` import/call) |
| G2 | Agents self-issue approval token `"human-token"` | CRITICAL | `security-agent.ts:159` |
| G3 | Approval token = any non-empty string (no verification) | CRITICAL | `provider-framework.ts:328` |
| G4 | `verifyApprover` default accepts any non-empty string | HIGH | `execution-coordinator.ts:91` |
| G5 | No tenant enforcement in `executeCapability` | HIGH | `provider-framework.ts:307` (no `enforceTenant`) |
| G6 | Provider signature verification is placeholder `return true` | HIGH | `trust/lifecycle.ts:174` `verifyChecksum` |
| G7 | `AUTHENTICATED` lifecycle step is a no-op | HIGH | `trust/lifecycle.ts:129-130` |
| G8 | `approveTask` accepts arbitrary approver, no permission check | MEDIUM | `agents/task.ts` |
| G9 | Durability defaults to in-memory | MEDIUM | `persistence/execution-store.ts:309` `createMemoryExecutionStore` (default) |
| G10 | MCP `secretRef` never resolved (auth = string presence) | LOW | `transport/mcp.ts:105` |
| G11 | Two execution engines → divergent governance | HIGH | §2 above |
| G12 | ExecutionStore default memory → recovery claim weak | MEDIUM | `execution-coordinator.ts:90` |

---

## 4. Migration Risks

1. **Call-site churn.** `security-agent.ts`, `git-provider.ts`, `dev-tools`, `security-tools`, and any `ToolProvider` caller currently call `executeCapability` / `ToolProvider.run` directly. Routing all of them through one gateway is a wide but mechanical change. Risk: regressions in callers that omit `tenantId`/`principal` today (Stack B has none). Mitigation: gateway must *require* `Principal` + `tenantId`; callers must be upgraded to supply them (fail-closed at compile/runtime).
2. **Approval re-modeling.** Stack B's string token must be replaced by the durable `ExecutionApproval` (Stack C) model before the gateway can verify approvals uniformly. Risk: existing tests that pass `"human-token"` must be rewritten to issue verifiable approvals. Mitigation: new `ApprovalService` with a test issuer.
3. **Two Claude Code providers.** Consolidation to one (Stack A manifest) risks breaking Stack B callers (`dev.claude-code`). Mitigation: keep id alias during migration; deprecate `dev.claude-code` after cutover.
4. **Performance / latency.** Adding tenant + guard + approval verification to every call is cheap (in-memory) but must not serialize on slow stores. Mitigation: gateway checks are synchronous except approval verification (injectable).
5. **Test preservation.** EPIC-005.1 / 005.3 / 005.5 suites must stay green. The gateway must be provider-neutral and Claude-neutral; no branch on vendor. Mitigation: gateway takes ports/interfaces, not concrete vendors.
6. **Fail-closed regressions.** Any new path that "falls back" to a vendor on guard denial would weaken fail-closed. Mitigation: gateway returns `errResult` on any denial; no fallback.
7. **Audit duplication.** Stack A and Stack B both emit audit today; unifying must not double-emit or drop events. Mitigation: gateway owns the canonical audit emission; sub-systems stop emitting execution-decision audits.

---

## 5. Summary

The platform has **one strong but partially-applied trust boundary** (Stack A +
`ProviderRuntimeGuard`) and **one large unguarded path** (Stack B `executeCapability`
+ activation providers + tool primitives) that bypasses tenant isolation, runtime
guard, and verifiable approval. EPIC-005.6's mission — *exactly one execution trust
boundary* — requires collapsing Stack A/B (+ tool primitive) into a single
`HermesExecutionGateway` that unconditionally enforces:

Identity → Tenant → Capability Resolution → Policy → Verifiable Approval →
Runtime Guard → Transport Selection → Provider Execution → Audit Persistence.

No execution may bypass this chain. The design (PHASES 1–5) and the implementation
gate (PHASE 6) follow.

*End of PHASE 0 baseline. No source modified.*
