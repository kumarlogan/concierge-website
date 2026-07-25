# Marketplace Security View
## EPIC-005.4 · PHASE 5

> **Architecture-only.** Extends the read-only `ProviderMarketplace` so operators
> and the Selection Engine can answer *"Can this provider safely execute this
> capability?"* **No provider execution. No mutation.** Reuses
> `marketplace.ts` `MarketplaceEntry` — adds security fields derived from the
> trust record, manifest permissions, sandbox policy, and violation log.

---

## 1. Principle

The Marketplace is **derived, read-only state**. It never calls `provider.*`,
never invokes the guard, never executes. It is the *observability surface* that
lets a human or the Selection Engine decide **before** any `execute()` is
attempted.

EPIC-005.4 adds a **security projection** of each entry so the question above
is answerable from data Hermes already owns — no new runtime path.

---

## 2. Extended `MarketplaceEntry` (additive fields)

```ts
interface MarketplaceSecurityView extends MarketplaceEntry {
  // ── Trust state ──
  effectiveTrust: TrustLevel;          // = REJECTED ? "untrusted" : trustLevel
  trustCeiling: TrustLevel;            // max tier Hermes will permit (from policy)

  // ── Permissions (PHASE 1) ──
  permissions: ProviderPermission[];   // echoed from manifest (read-only)
  grantedCapabilities: string[];        // capabilities with an explicit allow
  deniedCapabilities: string[];         // advertised but NOT granted

  // ── Sandbox profile (PHASE 2) ──
  sandbox: {
    isolation: "none" | "process" | "container" | "vm";
    filesystem: "ro" | "rw" | "ephemeral";
    network: "none" | "egress-only" | "full";
    seccomp?: "default" | "strict";
    memoryMb?: number;
    cpuLimit?: string;                  // declared CPU cap (external enforce)
    achievable: boolean;                // can active backend satisfy isolation?
  };

  // ── Transport risk (PHASE 3 §3.5) ──
  transportRisk: "none" | "local" | "network-egress" | "remote";
  declaredTransports: TransportKind[];  // from manifest.transports

  // ── Last violations (PHASE 4) ──
  lastViolation?: {
    class: ViolationClass;              // permission | timeout | resource |
                                         // invalid-response | audit | trust | compromise
    at: string;
    action: "deny" | "quarantine" | "unload" | "revoke-trust";
    cleared: boolean;
  };
  violationCount: number;

  // ── Health state (existing, surfaced for the safety question) ──
  health: HealthStatus;
  failureCount: number;
}
```

---

## 3. The "Safe to Execute?" Query

A new read-only helper on the marketplace:

```ts
interface SafeExecuteQuery {
  providerId: string;
  capabilityId: string;
  tenantId: string;
}

interface SafeExecuteAnswer {
  safe: boolean;
  reason: string;                 // human-readable, also the audit "why"
  blockingFactors: string[];       // e.g. ["trust:REJECTED", "permission:missing",
                                    //        "sandbox:unachievable", "violation:active"]
}
```

**Derived purely from the security view** (no execution):

| Factor | Condition → `safe:false` |
|---|---|
| Trust | `effectiveTrust === "untrusted"` OR `lifecycle ∈ {REJECTED, SUSPENDED, UNLOADED}` |
| Permission | `capabilityId ∉ grantedCapabilities` (for `tenantId`) |
| Tenant | `tenantId` not in provider's admitted tenant set |
| Sandbox | `sandbox.achievable === false` (backend can't honor isolation) |
| Transport | resolved transport risk > tenant/trust policy allows |
| Violation | `lastViolation && !cleared` with action ≥ quarantine |

If **all** pass → `safe: true` with the effective trust + sandbox summary.

---

## 4. Reuse (no new machinery)

| Existing | Reused for |
|---|---|
| `ProviderMarketplace.list()/.get()` | The projection is computed inside `toEntry()` — no new class. |
| `TrustRecord` (state, trustLevel, failureCount, rejectedAt) | Trust + violation + health fields. |
| `ProviderManifestV2` (permissions, transports, trust, limits, SandboxPolicy) | Permission + sandbox + transport-risk fields. |
| `manifest-v2.ts` `SandboxPolicy` / `limits` | Sandbox sub-object (verbatim). |
| PHASE 4 violation log (extension of `TrustRecord`) | `lastViolation` / `violationCount`. |

The Selection Engine, when it picks a provider for a capability, **must** consult
`SafeExecuteAnswer` before calling `execute()`. This keeps the safety decision in
the read-only layer, never inside the execution path.

---

## 5. What the Marketplace MUST NOT Do

- ❌ Call `provider.execute()` / `provider.health()` / `provider.capabilities()`.
- ❌ Mutate trust state, permissions, or the violation log.
- ❌ Store secrets or grant permissions.
- ❌ Make admission decisions (that is `TrustLifecycle.admit`).

It is a **view**. The guard (PHASE 3) is the enforcer; the marketplace is the
**dashboard** that tells you what the enforcer will do.

---

*PHASE 5 complete. The marketplace security view is defined as a read-only
projection of data Hermes already owns. Next: PHASE 6 (Test Strategy).*
