# EPIC-005.9 — Execution Gateway & Unified Approval Framework

## 1. Purpose

EPIC-005.9 delivers a governed execution pipeline that every capability
execution **must** pass through. Before this change, capability execution
relied on ad-hoc string tokens for approval and distributed gate logic.
The new architecture centralizes enforcement into a single, auditable,
fail-closed gateway with a unified approval model.

**Motivation:** Platform trust hardening. Every capability execution —
whether from the developer agent, security scanner, or workforce
orchestrator — must be verified against policy, approval state, runtime
health, and trust records before any external side effect occurs.

---

## 2. Previous Architecture

```
[Caller] → executeCapability(args) ──→ [Provider Backend]
                │
                └── approvalToken?: string (ad-hoc, no structure)
```

- Approval was a bare string token passed through `ctx.approvalToken`.
- No centralized gate — each caller could bypass policy checks.
- No structured approval lifecycle (tenant, capability, approver, expiry).
- Audit events were emitted but not routed through a standard pipeline.
- Audit store was initialized at import time (no runtime swap).

---

## 3. New Architecture

```
[Caller] → executeCapability() ──→ HermesExecutionGateway
                                        │
                                    ┌───┴───┐
                                    │ Gate 1 │  Tenant verification
                                    │ Gate 2 │  Policy evaluation
                                    │ Gate 3 │  Approval verification
                                    │ Gate 4 │  Runtime guard
                                    │ Gate 5 │  Capability check
                                    │ Gate 6 │  Executor dispatch
                                    └───┬───┘
                                        │
                                    GatewayResult
                                   (Allowed | Denied)
```

The gateway is instantiated by the provider framework and wired into
`executeCapability()`. Every call runs all 6 gates in order. Any gate
failure returns a structured `GatewayDenied` result. A `GatewayAllowed`
result includes the normalized provider outcome.

```
services/index.ts ──→ Execution.* namespace
                    → Security.* namespace
                    → Workforce.* namespace
```

The services barrel exports these as structured namespaces so consumers
import by subsystem, not by individual file path.

---

## 4. ApprovalRef Lifecycle

```
┌──────────────┐       ┌───────────────────────┐       ┌───────────────────────┐
│ grantGit     │       │ createApprovalService │       │ approvalRefFromRecord │
│ Approval()   │──────→│   (mint & verify)     │←──────│   (from durable store)│
│ grantStackB  │       │                       │       │                       │
│ Approval()   │       │ ApprovalRef {         │       │ Audit store /         │
└──────────────┘       │   id, tenant,         │       │ Execution store       │
                       │   capability,         │       └───────────────────────┘
                       │   approver, scope,    │
                       │   expiresAt           │
                       │ }                     │
                       └───────────────────────┘
```

**Lifecycle states:**
1. **Mint** — `grantGitApproval()` or `grantStackBApproval()` creates a
   structured `ApprovalRef` and persists it through the durable execution
   store (ephemeral queue → async consumer commits to durable storage).
2. **Verify** — Gateway gate 3 calls `createApprovalService().verify(ref)`
   which checks: ref exists in store, ref is not expired, approver is known,
   capability matches, tenant matches. Any mismatch → fail-closed.
3. **Expire** — The ref has an `expiresAt` timestamp. No renewal mechanism;
   the caller must obtain a fresh ref.

**Key property:** There is exactly one approval model. No bare string tokens
are accepted. The `ApprovalRef` is the only way to prove approval.

---

## 5. Gateway Pipeline

The `HermesExecutionGateway.execute()` method runs exactly 6 gates in order:

| Gate | Component | Enforces | Fail condition |
|------|-----------|----------|----------------|
| 1 | Tenant gate | `enforceTenant()` | Principal from different org |
| 2 | Policy evaluator | `ExecutionPolicyEvaluator` | Missing/expired approval, unknown capability, unknown provider, invalid lifecycle |
| 3 | Approval gate | `createApprovalService().verify()` | Missing ref, expired ref, unknown approver, capability mismatch, tenant mismatch |
| 4 | Runtime guard | `ProviderRuntimeGuard` | Provider not in runnable state, trust record missing, manifest invalid, undeclared capability, signature violation |
| 5 | Capability check | `capabilityRegistry.ownerOf()` | Capability not registered |
| 6 | Executor dispatch | Injected executor | Executor throws or returns error |

If any gate fails, the gateway returns `GatewayDenied` with:
- `code`: machine-readable denial reason (e.g. `"approval.expired"`)
- `message`: human-readable explanation
- `gate`: which gate closed
- `audit`: audit event payload

On success, returns `GatewayAllowed` with:
- `result`: executor's normalized `ProviderOutcome`
- `audit`: audit event payload

---

## 6. Runtime Policy Model

The `ExecutionPolicyEvaluator` implements 11 evaluation scenarios:

- **9 DENY scenarios:** missing tenant, missing approval, expired approval,
  unknown provider, tenant mismatch, missing principal, missing capability,
  invalid lifecycle state, unknown approver
- **2 ALLOW scenarios:** successful approved execution, non-approval
  capability (no approval required)

The policy evaluator takes:
- `ExecutionPolicyRequest` — execution context (tenant, principal, capability,
  provider, approval ref, lifecycle state)
- `PolicyEvaluatorDeps` — registries (capability, approval, tenant, lifecycle)

Policy decisions are cached per execution ID (idempotency) so duplicate
requests return the same decision without re-evaluation.

---

## 7. Audit Flow

```
Notification → event.ts → emitter.ts → store.ts → store.durable.ts
                    │
                    └──→ registerAuditStore(store)
```

The audit subsystem was refactored into four layers:

1. **`emitter.ts`** — Standalone module (zero imports). Exports `emitAudit()`,
   `setAuditSink()`, `registerAuditStore()`. No framework dependency.
2. **`event.ts`** — Wraps emitter with pre-configured defaults. Re-exports
   `emitAudit` and `setAuditSink` as consts, wires the default store.
3. **`store.ts`** — Uses Proxy pattern for deferred initialization. The
   `defaultAuditStore` starts as a proxy that lazily initializes the
   underlying `MemoryAuditStore`. `configureFileAuditStore()` allows
   runtime swap to a durable file-backed store.
4. **`store.durable.ts`** — Defines `AuditPersistenceBackend` interface
   and `DurableAuditStore` class. `createProductionAuditStore()` factory
   returns file-backed store when filePath + fs are provided, else falls
   back to in-memory.

The gateway emits audit events for every decision:
- `execution.gateway.denied` — on any gate closure
- `execution.gateway.allowed` — on successful execution

---

## 8. Provider Integration

The provider framework (`provider-framework.ts`) integrates with the gateway:

```typescript
const stackBGateway = new HermesExecutionGateway({
  policy: new ExecutionPolicyEvaluator({
    capabilityRegistry,
    approvalService,
    tenantResolver,
    lifecycleRegistry,
  }),
  runtimeGuard: new ProviderRuntimeGuard(),
  approvalService,
  capabilityRegistry,
});
```

`executeCapability()` now:
1. Resolves the provider + capability from the registry
2. Constructs a `GatewayRequest` from the capability args + context
3. Calls `stackBGateway.execute(request)`
4. Returns `GatewayAllowed.result` or `GatewayDenied` as `ToolResult`

`grantStackBApproval()` mints a structured `ApprovalRef` by:
1. Creating the ref struct with id/tenant/capability/approver/scope/expiresAt
2. Persisting through the human approval queue
3. Returning the ref (never a string token)

`StackBGatewayGuard` extends `ProviderRuntimeGuard` with Stack-B-specific
enforcement (provider state, capability authorization, transport health).

---

## 9. Security Model

| Principle | Enforcement |
|-----------|-------------|
| **Fail-closed** | Every gate defaults to DENY. No gate can be skipped. Missing config → DENY. |
| **No bare tokens** | ApprovalRef is the only accepted proof. `createApprovalService()` validates every ref against durable state. |
| **Tenant isolation** | Gate 1: `enforceTenant()`. Principal can only execute within their tenant. |
| **Capability ownership** | Gate 5: `capabilityRegistry.ownerOf()`. Only registered capabilities execute. |
| **Runtime verification** | Gate 4: `ProviderRuntimeGuard` checks provider lifecycle, trust records, manifest integrity, and signature validity. |
| **Audit trail** | Every gateway decision emits a structured audit event with gate, reason, and context. |
| **No fabricate** | Gateway never invents executor output. No executor injected → refusal. |

---

## 10. Deferred Work

The following were identified during the validation phase and explicitly
excluded from EPIC-005.9:

1. **Workforce Persistence** — D1-backed activation workflow, repository,
   observability, and migration 0005. These extend the committed workforce
   orchestration with real storage.
2. **Provider Manifest V2 full adoption** — All providers should migrate
   to the V2 manifest format. Currently only the stack B providers use V2.
3. **Provider Marketplace** — Dynamic loading, discovery, marketplace view,
   and package management (EPIC-005.3 deferred).
4. **D1-backed AuditStore** — The `AuditPersistenceBackend` interface
   exists; a D1 implementation is pending.
5. **Trust Webhooks** — EPIC-005.7A webhook handler and verification
   (trust ingress for third-party providers).
6. **Deployment Providers** — EPIC-007 deployment gate, launch controller,
   and cloudflare/github executors.

---

## 11. Future Workforce Integration

The committed workforce orchestration (EPIC-003-005 recovery commit)
currently uses the legacy execution path (`work-planner.ts`,
`workforce-dispatch.ts`, `execution-queue.ts`). A future phase should:

1. Wire the workforce orchestrator to use `HermesExecutionGateway` for
   capability execution, replacing the direct dispatch.
2. Route workforce approval requests through the unified `ApprovalRef`
   model instead of the workflow-level approval gate.
3. Use the `ExecutionCoordinator` for multi-step workforce workflows,
   leveraging idempotency, lease management, and metrics.

The gateway is designed for this integration — its interfaces
(`GatewayRequest`, `GatewayProviderContext`, `GatewayResult`) are
provider-neutral and workforce-agnostic.