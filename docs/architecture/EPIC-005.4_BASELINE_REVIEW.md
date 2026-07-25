# EPIC-005.4 — Provider Runtime Security & Isolation
## PHASE 0 · Baseline Review

> **Scope of this document:** read-only review of the EPIC-003 / EPIC-004 /
> EPIC-005 foundation. **No source changes were made.** It establishes the
> current provider loading flow, the trust boundary that already exists, the
> **missing** runtime isolation controls EPIC-005.4 must add, and the existing
> security controls that can be **reused verbatim** so we build *on top* of the
> foundation rather than redesigning it.
>
> **Design stance:** *"Hermes never belongs to a provider. Providers belong to
> Hermes."* The platform admits, scopes, executes-through, and audits every
> provider. Providers receive only approved, normalized requests and return
> normalized outcomes.

---

## 1. Current Provider Loading Flow

Inspected source: `services/providers/loader.ts`, `manifest-v2.ts`,
`trust/lifecycle.ts`, `platform.ts`, `marketplace.ts`.

```
Provider manifest (data only, NEVER code)
   │
   ▼  registerProvider(wiring{ manifest, factory })
UniversalCapabilityPlatform
   │
   ▼  bootstrap(providerId)
TrustLifecycle.admit(manifest)            ← fail-closed admission
   ├─ VALIDATE  validateManifestV2()       (structural + semantic)
   ├─ VALIDATE  signature/checksum         (if trust.level >= sandbox)
   ├─ AUTHORIZE config.authorize(manifest) (policy evaluator hook)
   ├─ AUTHENTICATED  (token/oauth/mtls/ssh placeholder)
   └─ LOAD        wiring.factory(manifest)  (data map → live Provider)
   │
   ▼  activate(providerId)  → state ACTIVE
capabilityRegistry.register(caps)
   │
   ▼  execute(providerId, req)
provider.execute(req)  → ProviderOutcome   (provider owns ONLY execution)
   │
   ▼  audit(EXECUTION_REQUESTED / _SUCCESS / _FAILURE)
```

**Key facts (verified in source):**

- The **only** coupling to a provider is its standardized contract export
  (`ProviderPackageContract.createProvider`) — `loader.ts` loads the entry
  module generically via an injected `loadModule` and calls `createProvider`.
  No central factory map, no vendor switch.
- `ProviderLoader.load()` resolves transports from the Hermes-owned
  `TransportRegistry` and records `missingTransports` — it does **not** reject
  on missing transport (see gap §3.5).
- `UniversalCapabilityPlatform.execute()` calls `provider.execute(req)`
  **directly**. The platform's own `emitAudit` runs *around* the call but the
  **runtime guard seam** (permission check, sandbox enforcement, resource
  limits, tenant re-validation at execution time) does **not** yet exist between
  `execute()` entry and `provider.execute()`.

---

## 2. Current Trust Boundary (what already exists)

| Control | Where | Status | Notes |
|---|---|---|---|
| Manifest schema validation | `validateManifestV2` (`manifest-v2.ts`) | ✅ | Fail-closed; throws `ManifestValidationError` on any gap. |
| Vendor-free capability ids | `validateManifestV2` | ✅ | Rejects `c.id.includes(":")` (no vendor namespacing). |
| Signature / supply-chain integrity | `TrustLifecycle.admit` | ✅ | `trust.level >= sandbox` requires `trust.signature`; signer must be in `trustedSigners`. |
| Policy authorization gate | `TrustLifecycle.admit` → `config.authorize(manifest)` | ✅ | Fail-closed: any throw or `false` → REJECTED. |
| Trust lifecycle states | `sdk.ts` `ProviderLifecycleState` | ✅ | DISCOVERED→VALIDATED→AUTHORIZED→AUTHENTICATED→LOADED→ACTIVE; SUSPENDED on 3× unhealthy; REJECTED on any gate fail. |
| Effective trust in marketplace | `marketplace.ts` `toEntry` | ✅ | REJECTED providers report `trustLevel: "untrusted"` (never their aspirational declared level). |
| Permission schema (data) | `manifest-v2.ts` `ProviderPermission { capability, scope, grantedBy }` | ✅ (data only) | Declared in manifest but **not yet evaluated** at admission or execution. |
| Sandbox policy schema (data) | `manifest-v2.ts` `SandboxPolicy { isolation, filesystem, network, seccomp? }` | ✅ (data only) | Declared but **not yet enforced**. |
| Resource limits schema (data) | `manifest-v2.ts` `limits { maxConcurrent, maxDurationMs, memoryMb?, networkEgress? }` | ✅ (data only) | Declared but **not yet enforced** at runtime. |
| Execution policy evaluator | `execution/policy-evaluator.ts` | ✅ | EPIC-004.6. Single decision point: tenant, principal, capability, provider-known, approval, lifecycle. **This is the model EPIC-005.4 reuses for provider-scoped checks.** |
| Audit emitter seam | `audit/emitter.ts` `emitAudit(type, actor, detail, opts)` | ✅ | Module-level `setAuditSink` so tests/edge workers capture events. Non-throwing (never breaks the action it observes). |
| Transport abstraction | `transport.ts`, `transport/cli.ts`, `transport/mcp.ts` | ✅ | Hermes-owned resolution; `executeOverTransport` (EPIC-005.3) emits `transport.execute.*` audit events. |

**Conclusion:** the *admission* boundary is strong and fail-closed. What is
missing is the *runtime execution boundary* — a guard that, at every
`execute()`, re-validates permission, tenant scope, transport approval, and
resource/sandbox limits **through Hermes-owned logic**, independent of what the
provider's manifest *claims*.

---

## 3. Current Missing Isolation Controls (the gap EPIC-005.4 closes)

### 3.1 No permission evaluation at execution time
`manifest-v2.ts` defines `ProviderPermission[]` (capability + scope +
grantedBy) but **nothing reads it**. A provider admitted with
`permissions: [{ capability: "x", scope: "*" }]` can be asked to serve
capability `"y"` and the platform will not stop it. EPIC-005.4 adds a
`ProviderPermissionSet` evaluator (default-deny) keyed by capability + tenant
scope.

### 3.2 No sandbox enforcement
`SandboxPolicy` (isolation/filesystem/network/seccomp) is declared in the
manifest but **no code reads or applies it**. CLI/HTTP/MCP providers currently
run with whatever privileges the host process has. EPIC-005.4 defines the
**contract** (PHASE 2) — the boundary Hermes requires every provider type to
honor — without implementing a particular sandbox backend yet.

### 3.3 No resource-limit enforcement at runtime
`limits.maxConcurrent / maxDurationMs / memoryMb / networkEgress` are declared
but **not enforced** between `execute()` and `provider.execute()`. Timeout and
concurrency are the two controls a guard can apply *within the host process*
today; memory/CPU require an external sandbox (PHASE 2 contract).

### 3.4 No execution-time tenant re-validation
`ExecutionPolicyEvaluator` validates tenant at the *durable execution* layer
(EPIC-004). But `UniversalCapabilityPlatform.execute()` hands the request
straight to `provider.execute()` with **no re-check** that the live provider is
still in a valid trust state, still scoped to the tenant, and still approved for
that capability. A provider whose trust was downgraded (SUSPENDED) after
admission can still receive calls until the next health probe.

### 3.5 Missing transport = recorded, not rejected
`ProviderLoader.resolveTransports` only *pushes to `missingTransports`*; it does
not block construction. EPIC-005.3 added the fail-closed `UNKNOWN_TRANSPORT`
gate at execution, but the **admission-time** transport-availability check is
still advisory.

### 3.6 No violation handling model
There is no defined response when a provider **violates** its declared
permissions/sandbox/limits at runtime (e.g. times out, exhausts memory,
returns a malformed response, fails to emit expected audit). States exist
(REJECTED/SUSPENDED/UNLOADED) but the *transition triggers and operator
notifications* for runtime violation are undefined. EPIC-005.4 PHASE 4 defines
them.

### 3.7 No provider compromise signal path
Nothing watches for anomalous provider behavior (e.g. unexpected network
egress, file writes outside declared scope, response shape drift) and raises a
"possible compromise" signal to operators. PHASE 4 defines the signal + response.

---

## 4. Existing Security Controls That Can Be Reused

| Reusable control | Source | How EPIC-005.4 reuses it |
|---|---|---|
| `validateManifestV2` | `manifest-v2.ts` | Reuse as the *first* gate of admission; extend (not fork) with permission/sandbox schema checks. |
| `TrustLifecycle.admit` fail-closed flow | `trust/lifecycle.ts` | The guard's DENY paths map onto the same REJECTED/SUSPENDED states. No new lifecycle invented. |
| `config.authorize(manifest)` hook | `trust/lifecycle.ts` | The `ProviderRuntimeGuard` is wired as **another** authorize hook at execution time (provider-scoped policy). |
| `ExecutionPolicyEvaluator` | `execution/policy-evaluator.ts` | Reuse its decision shape (`{ allowed, reason, category, audit }`) and `deny()`/`allow()` helpers as the template for `ProviderRuntimeGuard.evaluate()`. |
| `emitAudit` seam | `audit/emitter.ts` | Every guard decision emits through `emitAudit` with `decision: "allow" \| "deny"` — identical to EPIC-005.3's transport events. |
| `ProviderPermission` / `SandboxPolicy` / `limits` schemas | `manifest-v2.ts` | The **data model already exists**. EPIC-005.4 defines *evaluation + enforcement* around the existing types. |
| `TransportRegistry` / `executeOverTransport` | `transport.ts`, EPIC-005.3 | Guard validates the resolved transport `kind` is in the provider's approved `transports[]` before invoking. |
| `ProviderMarketplace` read-only view | `marketplace.ts` | PHASE 5 extends `MarketplaceEntry` with security fields (trust state, permissions, sandbox profile, transport risk, last violations) — **read-only, no execution**. |
| `TenantViolationError` / `enforceTenant` | `persistence/tenant.ts` | Reuse for execution-time tenant re-validation inside the guard. |

**Net:** EPIC-005.4 adds a **provider-runtime guard layer** (PHASE 3) and the
**violation model** (PHASE 4) on top of controls that already exist. No
foundation file is redesigned; schemas are extended, not replaced.

---

## 5. Constraints Re-affirmed (no changes)

- No AGS Fertility code changes.
- No Cloudflare configuration changes.
- No deployment or secret creation.
- No provider-specific shortcuts or Claude-specific core logic.
- No `git add -A`; no automatic commits.
- Existing EPIC-003/004/005 tests must remain green.
- EPIC-005.4 is **architecture + documentation only** — no runtime code is
  written in this epic. PHASE 3/4 define the guard *design*; implementation is
  the recommended next epic (see FINAL report).

---

## 6. EPIC-005.4 Build Targets (derived from the gap)

1. **PHASE 0 — Baseline Review.** *(this document)* Map current flow, trust
   boundary, missing controls, reusable controls.
2. **PHASE 1 — Provider Permission Model.** Hermes-owned `ProviderPermissionSet`
   evaluator: default-deny, explicit-allow, capability-scoped, tenant-aware,
   auditable.
3. **PHASE 2 — Provider Sandbox Contract.** Architecture-only boundary every
   provider type (CLI/HTTP/MCP/remote) must honor: timeout, memory, CPU,
   network, filesystem, process restrictions.
4. **PHASE 3 — Runtime Guard Layer (`ProviderRuntimeGuard`).** Pre-execution
   validation (trusted / capability-allowed / permissions-granted /
   tenant-scope-valid / transport-approved / resource-limits-valid) + post-
   execution capture (duration / resource usage / failures / violations). All
   decisions emit audit.
5. **PHASE 4 — Provider Violation Model.** Define fail-closed responses: deny,
   quarantine, unload, revoke-trust, operator-notification for 7 violation
   classes.
6. **PHASE 5 — Marketplace Security View.** Extend `MarketplaceEntry` (read-
   only) so the marketplace answers *"Can this provider safely execute this
   capability?"* — trust, permissions, sandbox profile, transport risk, last
   violations, health.
7. **PHASE 6 — Test Strategy Design.** Define (no fake-green) tests for
   unauthorized capability, missing permission, tenant mismatch, sandbox
   violation, timeout, malicious manifest, transport abuse, audit failure.
8. **PHASE 7 — AGS Readiness Review.** Can AGS safely use local / MCP / remote
   / third-party providers **without AGS-specific code**?
9. **PHASE 8 — Final Foundation Report.** Completed design, security guarantees,
   remaining gaps, implementation roadmap.

---

*Baseline captured before any EPIC-005.4 source change. Next: PHASE 1
(Provider Permission Model).*
