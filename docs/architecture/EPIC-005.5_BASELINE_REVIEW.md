# EPIC-005.5 — Repository Baseline Review
## PHASE 0 · Provider Runtime Guard Implementation

**Date:** 2026-07-20 · **Status:** Complete (read-only inspection)
**Method:** Re-read the actual implementation in `hermes/`. The EPIC-005.4 design
doc was treated as a *proposal only* and verified against real code. Several design
assumptions did NOT match the implementation; this report records the real shape.

---

## 1. Existing Execution Pipeline (as built)

```
caller
  └─ UniversalCapabilityPlatform.execute(providerId, req: ProviderRequest)
       ├─ lookup liveProviders[providerId]            (PROVIDER_UNAVAILABLE if absent)
       ├─ audit EXECUTION_REQUESTED
       ├─ result = await provider.execute(req)        ← provider-neutral call
       └─ audit EXECUTION_SUCCESS | EXECUTION_FAILURE
```

Admission-time trust is enforced separately in `TrustLifecycle.admit()`
(DISCOVERED→VALIDATE→AUTHORIZE→AUTHENTICATED→LOAD→ACTIVE), which is called once
during `bootstrap()`. After a provider is ACTIVE, `execute()` trusts the loaded
instance with **no further runtime checks**. That is the gap EPIC-005.5 closes.

Separately, `ExecutionCoordinator.run()` applies `ExecutionPolicyEvaluator`
(tenant / principal / capability / provider / approval / lifecycle) *before* it
invokes the executor function. That gate is policy-level, not provider-runtime.
The new ProviderRuntimeGuard is the **provider-execution** boundary that sits
between policy admission and the concrete `provider.execute()` call inside the
UniversalCapabilityPlatform — so every capability routed through the platform is
guarded regardless of which caller invoked it.

## 2. Extension Points (real)

| Need | Real seam | Notes |
|------|-----------|-------|
| Trust state at exec time | `TrustLifecycle.getRecord(id): TrustRecord` | states: ACTIVE/LOADED/SUSPENDED/REJECTED/UNLOADED; `rejectedAt?` |
| Manifest data | `ProviderManifestV2` | `transports`, `capabilities[]`, `permissions[]`, `trust.level`, `limits{maxConcurrent,maxDurationMs}`, `trust.sandboxPolicy` |
| Capability authorization | `CapabilityRegistry` (`has(id)` / `ownerOf(id)`) | used by platform `execute()` via `liveProviders` + marketplace |
| Tenant scope | `enforceTenant(principal, tenantId)` (persistence/tenant.ts) | throws `TenantViolationError`; needs a `Principal` object |
| Transport authorization | `TransportRegistry.has(kind)` / `resolve()` | manifest declares `transports: ProviderTransport{kind,endpoint?}` |
| Audit availability | `emitAudit(type, actor, detail, opts)` | never throws; safe to call |
| Live provider | `Map<string,Provider>` in platform | already gated (PROVIDER_UNAVAILABLE) |

## 3. Exact Insertion Point

Inside `UniversalCapabilityPlatform.execute()`, **after** the `liveProviders`
lookup succeeds and **before** `provider.execute(req)`:

```ts
// CURRENT (platform.ts ~L165)
this.audit({ type: "EXECUTION_REQUESTED", ... });
const result = await provider.execute(req);              // ← UNGUARDED

// TARGET
const guard = this.runtimeGuard;                          // ProviderRuntimeGuard
const decision = guard.guard({
  providerId,
  manifest: this.manifests.get(providerId),
  trust: this.lifecycle.getRecord(providerId),
  request: req,
  transports: this.transports,
  capabilities: this.capabilityRegistry,
  now: Date.now(),
});
if (!decision.allow) {
  this.audit({ type: "PROVIDER_RUNTIME_DENIED", providerId, reason: decision.reason, ... });
  return errResult(providerId, decision.code, decision.reason, 0);
}
this.audit({ type: "PROVIDER_RUNTIME_ALLOWED", providerId, capabilityId: req.capabilityId });
const result = await provider.execute(req);
```

The guard is injected via the constructor (optional, default `ProviderRuntimeGuard.DEFAULT`)
so the platform stays provider-neutral and the guard is independently unit-testable.

## 4. Risks

- **Tenant principal source.** `ProviderRequest.context` is `Record<string,unknown>`
  and may not carry a `Principal`. Guard must treat a *missing tenant context* as
  fail-closed (DENY) rather than assume a default — but also never fabricate a
  Principal. Design: require `req.context.tenantId` + `req.context.principalId`;
  if absent → DENY `missing-tenant-context`.
- **Re-entrancy / double audit.** Guard emits its own audit; platform still emits
  EXECUTION_SUCCESS/FAILURE. Keep both (different event types) — no double-count
  of the same semantic.
- **Concurrency limit.** `maxConcurrent` is enforced in-memory per provider via a
  counter in the guard (no external store needed for the platform seam).
- **Timeout.** `req.timeoutMs` is set by the caller; guard asserts it does not
  exceed `manifest.limits.maxDurationMs`. The actual timeout kill is the
  Transport's job (already honored via `envelope.timeoutMs`) — guard only *validates*
  the bound, consistent with EPIC-005.4 "deny if backend cannot enforce".
- **No bypass.** `provider.execute()` is only reachable through `execute()`; the
  guard is the single chokepoint. No public method calls `provider.execute` directly.
- **`enforceTenant` import** pulls in `persistence/tenant.ts` → `admin/access.ts`.
  This is already imported by `policy-evaluator.ts`, so it is a safe, existing edge
  dependency, not a new one.

## 5. Dependency Graph

```
runtime/guard.ts ──▶ manifest-v2 (types only)
                  ──▶ trust/lifecycle (TrustRecord type)
                  ──▶ transport (TransportKind, TransportRegistry)
                  ──▶ sdk (ProviderRequest, Provider, errResult)
                  ──▶ capability (CapabilityRegistry)
                  ──▶ persistence/tenant (enforceTenant)  [existing dep]
                  ──▶ audit/emitter (emitAudit)
runtime/violation-model.ts ──▶ guard.ts (GuardDecision, ViolationClass)
runtime/marketplace-security.ts ──▶ manifest-v2, trust/lifecycle, guard (read-only)
runtime/index.ts ──▶ re-exports the above
platform.ts ──▶ runtime/index (ProviderRuntimeGuard)
```

No new provider-specific, Claude-specific, or AGS-specific imports. All references
are to Hermes-owned types and seams.

## 6. Deviations from EPIC-005.4 design (design adapted to real code)

| EPIC-005.4 assumption | Reality | Adaptation |
|---|---|---|
| Guard integrates in ExecutionCoordinator | Coordinator gates *policy*, platform gates *provider execute* | Guard lives in `UniversalCapabilityPlatform.execute()` (the real provider-execution seam) |
| Separate TransportRegistry gating | Already present as `this.transports` + manifest `transports[]` | Guard checks `transports.has(kind)` against declared kinds |
| `secret.access` capability | No such capability in manifest model; permissions are `capability/scope/grantedBy` | Permission check: capability's `implKey`/declared perms contain the requested scope; `grantedBy:"operator"` surfaced, never auto-granted |
| Hard sandbox isolation | Not wired to a backend in repo | Guard *validates* `sandboxPolicy` is declared & non-`none` for trust ≥ trusted; denies if backend cannot enforce; does not implement isolation itself |
| `emitAudit` with custom event types | `emitAudit(type, actor, detail, opts)` | Uses `provider.runtime.allowed|denied|violation|quarantined` as `type` |
