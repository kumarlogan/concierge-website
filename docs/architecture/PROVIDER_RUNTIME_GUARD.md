# Provider Runtime Guard Layer
## EPIC-005.4 · PHASE 3

> **Architecture-only.** This document designs `ProviderRuntimeGuard` — the
> Hermes-owned seam that sits between `UniversalCapabilityPlatform.execute()`
> and `provider.execute()`. It reuses the decision shape of
> `ExecutionPolicyEvaluator` (EPIC-004.6) and the `emitAudit` seam
> (EPIC-005.3). **No runtime code is written in this epic.**

---

## 1. Position in the Flow

```
UniversalCapabilityPlatform.execute(providerId, req)
        │
        ▼
ProviderRuntimeGuard.guard(execCtx)   ← NEW seam (this design)
        ├─ PRE-EXECUTION validation (all fail-closed)
        │     • provider trusted (state == ACTIVE, not SUSPENDED/REJECTED)
        │     • capability allowed (in manifest.capabilities)
        │     • permissions granted (ProviderPermissionSet, PHASE 1)
        │     • tenant scope valid (enforceTenant, PHASE 1 R3)
        │     • transport approved (kind ∈ declared transports[], matches SandboxPolicy.network)
        │     • resource limits valid (maxDurationMs, maxConcurrent, isolation achievable)
        │
        │   ANY failure → emitAudit(decision:"deny") + return GuardDenied
        │
        ▼  (only if all pass)
provider.execute(req)   ← provider owns ONLY execution
        │
        ▼
ProviderRuntimeGuard.observe(outcome, metrics)  ← POST-EXECUTION capture
        ├─ duration, resource usage, failures, violations
        └─ emitAudit(decision:"allow" / "deny")
```

The guard is **composed around** the existing `execute()` — it does not replace
the `ExecutionPolicyEvaluator` (which governs the durable execution layer) but
adds the **provider-scoped** checks the evaluator does not cover.

---

## 2. Guard Decision Type (mirrors `ExecutionPolicyDecision`)

```ts
type GuardDecisionCategory =
  | "allowed"
  | "denied:provider-not-active"
  | "denied:capability-not-allowed"
  | "denied:permission-missing"
  | "denied:tenant-mismatch"
  | "denied:transport-not-approved"
  | "denied:sandbox-unavailable"
  | "denied:limits-invalid"
  | "denied:concurrency-exceeded";

interface GuardDecision {
  allowed: boolean;
  reason: string;
  category: GuardDecisionCategory;
  audit: Record<string, unknown>;   // { providerId, capabilityId, tenantId,
                                      //   invocationId, decision, category, ... }
}
```

The `deny()` / `allow()` helpers from `ExecutionPolicyEvaluator` are the
template — same shape, same audit contract.

---

## 3. Pre-Execution Validation (the 6 checks)

| # | Check | Source of truth | Fail category |
|---|---|---|---|
| 1 | **Provider trusted** | `TrustLifecycle.getRecord(providerId).state === "ACTIVE"` | `denied:provider-not-active` |
| 2 | **Capability allowed** | `manifest.capabilities[].id` contains `req.capabilityId` | `denied:capability-not-allowed` |
| 3 | **Permissions granted** | `ProviderPermissionSet.effective(provider, cap, tenant)` (PHASE 1) | `denied:permission-missing` |
| 4 | **Tenant scope valid** | `enforceTenant(principal, tenantId)` (reuse `persistence/tenant.ts`) | `denied:tenant-mismatch` |
| 5 | **Transport approved** | resolved `TransportKind ∈ manifest.transports[]` AND `SandboxPolicy.network` permits its egress (PHASE 2 S2) | `denied:transport-not-approved` |
| 6 | **Resource limits valid** | `maxDurationMs>0`, `maxConcurrent>0`, `isolation` achievable by active backend (PHASE 2 S1/S4/S6) | `denied:limits-invalid` or `denied:sandbox-unavailable` |

**Concurrency** is enforced *across* executions: a per-provider semaphore
incremented before `provider.execute()` and decremented after. If
`active >= maxConcurrent` → `denied:concurrency-exceeded` (no execution
starts). This is the one in-process limit the guard fully owns.

---

## 4. Post-Execution Capture

After `provider.execute()` returns (or throws), the guard captures:

| Field | Source | Purpose |
|---|---|---|
| `durationMs` | wall-clock around `provider.execute()` | vs `maxDurationMs` (timeout detection) |
| `resourceUsage` | sandbox backend report (memoryMb peak, cpuMs) if available; else `{}` | violation evidence for PHASE 4 |
| `failure` | `outcome.ok === false` → `outcome.code` | maps to violation class |
| `violations` | observed-vs-declared drift (e.g. attempted network when `network:"none"`, write outside scratch root) | **compromise signal** (PHASE 4 §7) |
| `auditDecision` | `"allow"` on success, `"deny"` on guard-detected failure | feeds `emitAudit` |

The guard **never swallows** a provider error — it records it, emits
`decision:"deny"` with the provider's `code`, and returns the normalized
`ProviderOutcome` unchanged to the caller.

---

## 5. Audit Contract (every decision is visible)

```
emitAudit(
  type: "guard.allow" | "guard.deny",
  actor: "hermes:runtime-guard",
  detail: { providerId, capabilityId, tenantId, invocationId, category, reason },
  opts: { decision: "allow" | "deny", category, tenant: tenantId }
)
```

Non-throwing (mirrors `audit/emitter.ts`): audit failure must **not** break the
guarded action, but a *guard audit failure* is itself a violation signal
(PHASE 4 §5 — "audit failure" class).

---

## 6. Interface Sketch (for the next epic — NOT implemented here)

```ts
interface RuntimeGuardDeps {
  lifecycle: TrustLifecycle;
  manifests: ReadonlyMap<string, ProviderManifestV2>;
  permissions: ProviderPermissionSet;     // PHASE 1 evaluator
  sandbox: SandboxBackend;               // PHASE 2 contract (validates isolation)
  transports: TransportRegistry;
  emit: typeof emitAudit;
  enforceTenant: typeof import(".../tenant").enforceTenant;
}

class ProviderRuntimeGuard {
  async guard(ctx: GuardExecContext): Promise<GuardDecision>;
  observe(providerId: string, outcome: ProviderOutcome, metrics: GuardMetrics): void;
}
```

The guard is **provider-neutral** — it references only `ProviderManifestV2`,
`TrustRecord`, `TransportKind`, and the `Provider` SDK. No Claude-specific or
vendor-specific branch.

---

## 7. Relationship to Existing Controls (no duplication)

| Existing control | Guard relationship |
|---|---|
| `ExecutionPolicyEvaluator` (EPIC-004.6) | Governs the *durable execution* (tenant/principal/approval/lifecycle). Guard adds *provider-scoped* checks on top. Both emit the same decision shape. |
| `TrustLifecycle.admit` | Admission gate (before load). Guard is the *execution-time* re-validation (after load, every call). |
| `emitAudit` (EPIC-005.3) | Guard's audit sink — reused verbatim. |
| `executeOverTransport` (EPIC-005.3) | Guard validates the transport *before* this is called; the transport layer still owns the actual I/O + its own `transport.execute.*` events. |
| `manifest-v2` schemas | Guard *reads* `permissions`, `SandboxPolicy`, `limits`, `transports` — never mutates them. |

---

*PHASE 3 complete. `ProviderRuntimeGuard` is fully designed on top of existing
controls. Next: PHASE 4 (Provider Violation Model).*
