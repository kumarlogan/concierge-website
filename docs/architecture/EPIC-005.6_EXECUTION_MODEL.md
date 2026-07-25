# EPIC-005.6 — Execution Model & Single Chokepoint (PHASE 2)

**Deliverable:** Design for `HermesExecutionGateway` — the one execution trust boundary.

---

## 1. Design Principle

> Every capability/provider/tool/agent execution MUST pass through
> `HermesExecutionGateway.execute(req)`. There is no other public execution API.

The gateway is **provider-neutral** and **Claude-neutral**: it depends only on interfaces
(`CapabilityRegistry`, `ProviderRuntimeGuard`, `ApprovalService`, `TenantEnforcer`,
`TransportRegistry`, `AuditSink`, `ExecutionStore`). No concrete vendor type appears in it.

---

## 2. Canonical Chain (the only path)

```
HermesExecutionGateway.execute(req: ExecutionRequest)
  │
  ├─ 1. IDENTITY        verify(req.principal: Principal)  // must carry id, tenantId, scopes
  ├─ 2. TENANT          enforceTenant(principal, req.tenantId)  // fail-closed
  ├─ 3. RESOLVE         cap = capabilityRegistry.resolve(req.capabilityId, req.tenantId)
  ├─ 4. POLICY          decision = policyEvaluator.evaluate({...})  // tenant/principal/cap/provider
  │                       if !allowed → DENY (audit) ; no fallback
  ├─ 5. APPROVAL        approval = approvalService.verify(principal, cap, req.approvalRef)
  │                       if required && !valid → DENY (audit)
  ├─ 6. RUNTIME GUARD   g = runtimeGuard.guard({providerId, manifest, trust, request, ...})
  │                       if !g.allow → DENY (audit) ; runtimeGuard.release
  ├─ 7. TRANSPORT       transport = transportRegistry.resolve(manifest.transports)
  ├─ 8. EXECUTE         result = await provider.execute(req)  // single call site
  └─ 9. AUDIT           auditStore.persist({decision, result, tenant, principal, ...})
```

Steps 1–5 and 8–9 are **synchronous** except where an injected verifier is async (approval).
The guard (6) is the existing `ProviderRuntimeGuard` (EPIC-005.5) — now invoked on **every** path.

---

## 3. `HermesExecutionGateway` Responsibilities (per EPIC-005.6 §PHASE 2)

| # | Responsibility | How |
|---|----------------|-----|
| 1 | Enforce tenant | `enforceTenant(principal, tenantId)` (existing `admin/access.ts`) |
| 2 | Validate identity | `req.principal` is a valid `Principal` (non-empty id + tenantId + scopes) |
| 3 | Resolve capability | `capabilityRegistry.resolve(capabilityId, tenantId)` |
| 4 | Validate provider | registry owner must be LOADED + ACTIVE + trust-state OK (via guard) |
| 5 | Require verified approval | `approvalService.verify()` — never a raw token |
| 6 | Invoke runtime guard | `ProviderRuntimeGuard.guard()` (same instance EPIC-005.5 uses) |
| 7 | Select transport | `transportRegistry.resolve(manifest.transports)` |
| 8 | Execute provider | `provider.execute(req)` — the ONLY provider call site |
| 9 | Emit audit | `auditStore.persist()` — canonical, single emission |

---

## 4. Interface Contract (provider-neutral)

```ts
// services/execution/gateway.ts  (DESIGN — not yet implemented)
export interface ExecutionRequest {
  principal: Principal;          // caller identity (required)
  tenantId: string;              // explicit; must equal principal.tenantId
  capabilityId: string;
  args: unknown;
  approvalRef?: ApprovalRef;     // opaque, verifiable reference (NOT a raw token)
  targetTenantId?: string;       // for cross-tenant admin actions (still enforced)
}

export interface ExecutionResponse {
  ok: boolean; data?: unknown; error?: string;
  backend: string; code?: string; durationMs: number;
}

export class HermesExecutionGateway {
  constructor(deps: {
    capabilities: CapabilityRegistry;
    policy: ExecutionPolicyEvaluator;
    approvals: ApprovalService;
    guard: ProviderRuntimeGuard;
    transports: TransportRegistry;
    platforms: Map<string, UniversalCapabilityPlatform>; // per backend/provider
    audit: AuditSink;
    recoverableStore: ExecutionStore;
  }) {}
  async execute(req: ExecutionRequest): Promise<ExecutionResponse>;
}
```

**Key:** the gateway does **not** know how to run a provider itself — it delegates to the
existing `UniversalCapabilityPlatform.execute` (Stack A) as the *implementation* of step 8,
but **only after** it has run steps 1–7. This reuses the guarded engine and avoids a second
execution implementation. Stack B (`executeCapability`) is demoted to an internal adapter or
removed (see PHASE 6).

---

## 5. Routing All Paths to the Gateway

| Former path | New routing |
|-------------|-------------|
| `security-agent.runSecurityScan` | → `gateway.execute({principal, tenantId, capabilityId, approvalRef})` |
| `git-provider` commit/push | → `gateway.execute(...)` with `approvalRef` from a human approval |
| `ToolProvider.run` | → `gateway.execute(...)` (tool becomes a capability in the registry) |
| `coordinator.run(executor=...)` | → `gateway.execute(...)`; coordinator keeps durable store + recovery, delegates execution to gateway |
| `UniversalCapabilityPlatform.execute` | becomes **internal** (called only by the gateway) — not a public API |

The gateway is the **only** function in the codebase that calls `provider.execute`. Searches
for `\.execute\(` and `executeCapability(` after migration must resolve to exactly one public
entry: `HermesExecutionGateway.execute`.

---

## 6. Fail-Closed Guarantees (must hold)

- Any missing/invalid `principal` → DENY.
- Tenant mismatch or unknown tenant → DENY.
- Capability not found / not owned by a LOADED provider → DENY.
- Policy `!allowed` → DENY; **no fallback** to direct execution.
- Required approval missing/invalid/expired/wrong-bound → DENY.
- Guard `!allow` → DENY; `runtimeGuard.release` always called.
- Provider throws → caught, audited as `EXECUTION_FAILURE`, returned as `ok:false`.
- **No path may bypass steps 1–9.** A greppable invariant: only `gateway.ts` imports `provider.execute`.

---

## 7. Tenant Context Requirement

No execution may occur without tenant context (per §PHASE 4). `ExecutionRequest.tenantId`
is **mandatory** and must equal `principal.tenantId`. The gateway rejects `undefined` tenant
before any lookup (covers Bypass #2).

*End of PHASE 2. Design only — no implementation.*
