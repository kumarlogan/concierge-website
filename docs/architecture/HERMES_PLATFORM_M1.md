# Hermes Platform M1 — Architectural Freeze & Inventory

**Date:** 2026-07-20 · **Scope:** Post EPIC-003 → EPIC-005.5
**Status:** Inventory only (read-only). Produced by the M1 independent review board.

This document maps the as-built Hermes architecture from the repository. It is the
evidence base for `HERMES_PLATFORM_M1_REVIEW.md`. Every claim cites a file.

---

## 1. Subsystem Map

```
                         ┌──────────────────────────────┐
                         │   Callers / Agents / Humans   │
                         └───────────────┬──────────────┘
                                         │
            ┌────────────────────────────┴───────────────────────────┐
            │                   TWO EXECUTION STACKS                  │
            │                                                        │
   STACK A (EPIC-005)                          STACK B (EPIC-002-007/003)
   UniversalCapabilityPlatform                ExecutionCoordinator
      │  + ProviderRuntimeGuard (005.5)          │  + ExecutionPolicyEvaluator (004.6)
      │  + Provider.execute()                    │  + executor callback
      ▼                                          ▼
   providers/runtime/guard.ts              activation/provider-framework.ts
   (8 fail-closed checks)                   executeCapability()  ← NO tenant check
                                            (lifecycle/health/approval-token gate)
            │                                        │
            └───────────────┬────────────────────────┘
                            ▼
              providers/transport/*  (cli, mcp-boundary, http?)
                            │
                            ▼
                   Vendor backend (injected port, never imported)
```

**Critical observation:** there are **two independent execution paths** with
**different security models**. EPIC-005.5's `ProviderRuntimeGuard` lives ONLY in
Stack A (`UniversalCapabilityPlatform`). Stack B (`executeCapability`) has its own
lifecycle/health/approval-token gate but **no runtime guard, no tenant check**.

---

## 2. Core Services (file evidence)

| Service | File | Role |
|---------|------|------|
| Execution Coordinator | `services/execution/execution-coordinator.ts` | Durable execution lifecycle owner; single policy gate (`run()`) |
| Policy Evaluator | `services/execution/policy-evaluator.ts` | Tenant/principal/capability/provider/approval/lifecycle decision point |
| Orchestrator | `services/activation/orchestrator.ts` | Retry/timeout/cancel driver (generic) |
| Execution Queue | `services/execution/execution-queue.ts` | Operator visibility surface (delegates to coordinator) |
| Provider Framework | `services/activation/provider-framework.ts` | `executeCapability` — Stack B execution + lifecycle/health |
| Universal Capability Platform | `services/providers/platform.ts` | Stack A orchestrator + guard injection |
| Trust Lifecycle | `services/providers/trust/lifecycle.ts` | Admission-time trust gate (DISCOVER→…→ACTIVE) |
| Provider Runtime Guard | `services/providers/runtime/guard.ts` | 8 runtime checks (Stack A only) |
| Violation Response Engine | `services/providers/runtime/violation-model.ts` | Maps violation → severity + actions |
| Marketplace Security View | `services/providers/runtime/marketplace-security.ts` | Read-only projection |
| Capability Registry | `services/providers/capability.ts`, `activation/provider-framework.ts` | Two registries (see §4) |
| Security Agent | `services/security/security-agent.ts` | Calls `executeCapability` |
| Git Provider | `services/activation/git-provider.ts` | `executeCapability` user |
| Claude Code Provider (×2) | `activation/providers/claude-code.ts`, `providers/claude-code/index.ts` | Two distinct implementations |

---

## 3. Execution Flow

### Stack A (`UniversalCapabilityPlatform.execute`, `platform.ts:159`)
1. `liveProviders.get(providerId)` → `PROVIDER_UNAVAILABLE` if absent
2. `audit(EXECUTION_REQUESTED)`
3. `runtimeGuard.guard({...})` → first failing check DENYs (`PROVIDER_RUNTIME_DENIED` + `errResult`)
4. `await provider.execute(req)` — the ONLY provider call site
5. `audit(EXECUTION_SUCCESS|FAILURE)`

### Stack B (`ExecutionCoordinator.run` → `executor` callback)
1. `policyRequestFromStore` → `ExecutionPolicyEvaluator.evaluate` (tenant/principal/capability/provider/approval/lifecycle)
2. lease acquire
3. **durable approval re-check** (approver match, expiry)
4. `orchestrate(...)` drives caller-supplied `executor(capability, args)`
5. The `executor` callback is supplied by the caller. Evidence: `execution-coordinator.ts:189` takes `executor:` param. If the caller wires `executor` → `executeCapability` (provider-framework), then Stack B runs **without** `ProviderRuntimeGuard`.

### Stack B alt (`executeCapability`, `provider-framework.ts:307`)
- `resolveProviderForCapability` (active+enabled+healthy)
- approval-token presence check (`if (needsApproval && !ctx.approvalToken) deny`)
- `p.executor(capability, args, ctx)` → vendor port
- **No `enforceTenant`. No `ProviderRuntimeGuard`.**

---

## 4. Capability System

**Two capability registries coexist:**
- `services/providers/capability.ts` — `MemoryCapabilityRegistry`, used by `UniversalCapabilityPlatform` (Stack A). Interface: `register/get/list/has/ownerOf`.
- `services/activation/provider-framework.ts` — module-level `REGISTRY` Map of `ManagedProvider`, used by `executeCapability` (Stack B). Dynamic negotiation via `resolveProviderForCapability`.

Capability descriptors carry `requiresApproval` / `requiresApprovalIn: [env]`.
Approval requirement is **declared in the descriptor, not enforced by a verifier** —
`executeCapability` only checks token *presence* (non-empty string).

---

## 5. Provider System

- **Stack A:** `ProviderManifestV2` + `Provider` interface + `TrustLifecycle.admit()` (admission-time gate). `provider-framework` in `activation/` is **separate** from `services/providers/`.
- **Stack B:** `registerProvider` (lifecycle `registered→enabled→active→disabled→retired`), `enableProvider` requires `hermes:activation:provider` permission (good). `resolveProviderForCapability` picks first active+healthy provider advertising the cap.
- **Two Claude Code providers**: `activation/providers/claude-code.ts` (id `dev.claude-code`, Stack B) and `services/providers/claude-code/index.ts` (id `claude-code`, Stack A manifest). **Vendor duplication / divergent stacks.**

---

## 6. Transport System

- `services/providers/transport/cli.ts` — CLI transport (spawner-injected).
- `services/providers/transport/mcp.ts` — `McpTransportBoundary`: **contract-only, fails closed** (`AUTH_REQUIRED` until a real adapter is injected). Good fail-closed design. Auth boundary is `scheme` + `secretRef` string presence only — **no credential resolution/validation**.
- `services/providers/transport.ts` — `Transport` interface, `TransportRegistry`.
- `transport-health.ts` — health reconciliation.

---

## 7. Runtime Security

`ProviderRuntimeGuard` (Stack A only): 8 checks — trust-state, tenant-scope,
capability-authz, permission-scope, transport-authz, runtime-limits,
sandbox-requirements, audit-availability. Fail-closed, crash-safe, non-breaking
(canonical codes preserved). **Coverage gap:** not present in Stack B.

`ViolationResponseEngine`: declarative severity→actions (LOW→audit, MEDIUM→
quarantine+alert, HIGH→revoke+unload+critical-audit). Never continues execution.

---

## 8. Policy Engine

`ExecutionPolicyEvaluator` (Stack A's coordinator path). Categories:
`allowed`, `denied:*` (missing-tenant/principal/capability/approval, expired-approval,
invalid-lifecycle, unknown-provider/capability, tenant-mismatch, unknown-principal).
Fail-closed. Defaults: `verifyApprover = (a) => a.length > 0` (accept ANY non-empty
string) unless overridden.

---

## 9. Identity & Tenant Model

- `Principal` (`contracts/platform-api.ts`): `id`, `permissions[]`, `organizationId?`, `tenantId?`, `scopes?`.
- `enforceTenant(principal, tenantId)` → `withinTenantScope(principal, {organizationId}, {requireScope:true})` (`persistence/tenant.ts`, `admin/access.ts`).
  - Unbound principal (no `organizationId`) → DENY when `requireScope:true`.
  - Cross-organization → always DENY (hard wall).
  - `scopes` narrow grant; with no scopes, own-org allowed.
- **Applied inconsistently:** `ExecutionPolicyEvaluator` and `ProviderRuntimeGuard.checkTenantScope` call `enforceTenant`. `executeCapability` (Stack B) does **not**.

---

## 10. Persistence Model

- `persistence/execution-store.ts` — `ExecutionStore` interface + `createMemoryExecutionStore` (default, in-memory). `recoverable()` lists non-terminal executions; recovery requires re-approval (good, no auto-approve).
- **Durability is in-memory by default.** No D1/SQL adapter found wired as default. Restart loses all execution state.
- `persistence/tenant.ts` — tenant enforcement only (no persistent store of its own).

---

## 11. Audit Model

`emitAudit(type, actor, detail)` (`audit/event.ts`). Evidence of emission:
- Coordinator: `execution.requested/approved/run/policy.denied/cancelled`.
- Guard: `provider.runtime.allowed/denied/violation.critical`.
- Policy evaluator: audit metadata on every decision.
- `executeCapability`: `provider.capability.exec/done/denied/unresolved/executor.missing`.
- MCP boundary: fails closed without silent audit gaps.
Audit is **in-process; no durable/append-only store or tamper-evidence found in scope**.

---

## 12. Approval Model

**Two approval mechanisms:**
1. `ExecutionCoordinator.approve(approver, ...)` + durable `ExecutionApproval` in store. `run()` re-verifies approver match + expiry.
2. `executeCapability` approval **token** (non-empty string presence). No durable record; no approver identity binding.

**Gap:** `verifyApprover` default accepts any non-empty string. `approve()` does not
check `approver` holds `EXECUTION_REVIEW` permission, nor that `approver ≠ principal`
(separation-of-duties). `security-agent.ts:159` passes literal `"human-token"` as the
approval token whenever approval is "required" — self-approval by an agent.

---

## 13. Agent Lifecycle

`services/agents/task.ts` — `createTask/assignTask/approveTask/completeTask/failTask`,
transition table `canTransitionTask`. Used by both coordinator (`run()` creates a
task and self-`approveTask`s it — see review) and orchestrator. `agents/memory.ts`
mentions `security.credentials`, `identity.secrets` categories (memory only).

---

## 14. Marketplace Model

`services/providers/marketplace.ts` + `marketplace-view.ts` — read-only aggregate
over `TrustLifecycle` + transports. `MarketplaceSecurityView.safeExecuteAnswer()`
runs the guard read-only. Rejected providers remain visible (good).

---

## 15. Extension Points

| Extension | Mechanism | File |
|-----------|-----------|------|
| New provider (Stack A) | manifest + factory + `registerProvider` | `providers/platform.ts` |
| New provider (Stack B) | `registerProvider` + `setClaudeCodeExecutor`-style port | `activation/provider-framework.ts` |
| New transport | implement `Transport`, register in `TransportRegistry` | `providers/transport.ts` |
| New capability | descriptor with `requiresApproval` | both registries |
| Vendor backend | `CapabilityExecutor` port (no SDK import) | `activation/provider-framework.ts` |
| MCP adapter | inject `McpClientAdapter` into `McpTransportBoundary.withAdapter` | `providers/transport/mcp.ts` |
| Runtime guard | optional ctor param `runtimeGuard?` | `providers/platform.ts` |
| Policy | `TrustConfig.authorize`, `verifyApprover` | `providers/trust/lifecycle.ts`, `execution/policy-evaluator.ts` |

**Concern:** two parallel extension mechanisms for "provider" and "capability"
means adding a provider requires touching BOTH stacks to be uniformly governed.

---

## 16. Seams vs. Leaks

| Seam (good) | Leak (review target) |
|-------------|----------------------|
| Vendor SDK never imported; backend injected via port | Two provider stacks with divergent security |
| MCP boundary fails closed | MCP `secretRef` never resolved; auth = string presence |
| Trust lifecycle fail-closed | `verifyChecksum` returns `true` (placeholder) |
| Tenant wall centralized in `withinTenantScope` | Not invoked by `executeCapability` |
| Runtime guard crash-safe | Guard absent from Stack B |
| Approval token gate | Token = any non-empty string; agent self-issues `"human-token"` |

---

*End of inventory. See `HERMES_PLATFORM_M1_REVIEW.md` for findings, scores, and the
go/no-go decision.*
