# EPIC-005.4 — Test Strategy Design
## PHASE 6 · Operations

> **Design-only.** Defines the test suite that the next epic (implementation)
> must satisfy. These tests validate the **runtime guard + violation model**
> (PHASE 3/4) against the foundation. **No fake-green tests** — every test
> asserts a real, observable behavior (audit event emitted, execution denied,
> provider quarantined, etc.). This document is the acceptance contract.

---

## 1. Test Principles

1. **Real behavior over mocks-of-mocks.** Mock only the *boundaries* Hermes
   owns (transport spawner, audit sink, sandbox backend, operator notifier) —
   exactly as EPIC-005.3 did with `setAuditSink`. Never mock the guard's own
   decision logic.
2. **Assert audit, not just return value.** Every deny/allow must be verifiable
   via the captured `emitAudit` sink (`decision` + `category`).
3. **Fail-closed is the null hypothesis.** A misconfigured test (missing
   permission, unknown tenant) must DENY — if it allows, the test is wrong, not
   the guard.
4. **No provider-specific fixtures.** Use generic `createProvider` stubs; never
   a Claude/GitHub-named fixture. Provider identity is data, not a code branch.
5. **Each violation class has at least one test** (PHASE 4 §2).

---

## 2. Test Catalog

### 2.1 Unauthorized Capability
- **Setup:** provider admitted with `capabilities: ["dev.code.generate"]`,
  manifest `permissions` grant only that capability.
- **Action:** `guard.guard({ capabilityId: "dev.deploy.apply", tenantId } )`.
- **Assert:** `decision.allowed === false`, `category === "denied:capability-not-allowed"`,
  `emitAudit` received `guard.deny` with `decision:"deny"`. `provider.execute`
  was **never** called.

### 2.2 Missing Permission
- **Setup:** capability is in `manifest.capabilities` but **no** `ProviderPermission`
  row exists for it (default-deny, PHASE 1 R1).
- **Action:** `guard.guard({ capabilityId: <advertised-but-not-granted> })`.
- **Assert:** `allowed === false`, `category === "denied:permission-missing"`,
  audit `deny`. Demonstrates default-deny is enforced even for advertised caps.

### 2.3 Tenant Mismatch
- **Setup:** permission row has `scope: "acme"`; request tenant is `globex`.
- **Action:** `guard.guard({ capabilityId, tenantId: "globex" })`.
- **Assert:** `allowed === false`, `category === "denied:tenant-mismatch"`,
  `enforceTenant` path exercised, audit `deny`.

### 2.4 Sandbox Violation
- **Sub-cases:**
  - (a) `network:"none"` declared but resolved transport is `https` →
    `denied:transport-not-approved` (PHASE 2 S2).
  - (b) Active backend can only offer `isolation:"process"` but trust tier
    requires `container` → `denied:sandbox-unavailable` (PHASE 2 S1).
  - (c) `maxDurationMs` / `maxConcurrent` missing or ≤ 0 → `denied:limits-invalid`.
- **Assert:** each DENIES before any `provider.execute()`; audit `deny` with the
  specific category.

### 2.5 Timeout
- **Setup:** fake spawner that never resolves within `maxDurationMs`.
- **Action:** `guard.guard(...)` then `provider.execute()` via guard; advance
  fake timers past `maxDurationMs`.
- **Assert:** guard cancels invocation (`provider.cancel` called), outcome code
  `TIMEOUT`, audit `transport.execute.failed` (decision deny) + `PROVIDER_VIOLATION`
  (class: timeout). **Second** timeout in window → provider `SUSPENDED`
  (QUARANTINE).

### 2.6 Malicious Provider Manifest
- **Sub-cases (all rejected at admission, fail-closed):**
  - (a) `trust.level: "trusted"` but no `trust.signature` → `REJECTED` at
    VALIDATE.
  - (b) `sandbox` tier requests `secret.access` in manifest permissions →
    `REJECTED` (PHASE 1 R4 privilege escalation).
  - (c) capability id contains `":"` (vendor namespacing) → `ManifestValidationError`.
  - (d) `transports: []` (empty) → `validateManifestV2` throws (non-empty required).
- **Assert:** `TrustLifecycle.admit` returns `state: "REJECTED"`; no live
  provider built; `PROVIDER_REJECTED` audit emitted.

### 2.7 Transport Abuse
- **Setup:** provider declared `transports: [{kind:"cli"}]` (local only) but
  the capability request would route through an `https` transport.
- **Action:** guard validates resolved transport kind against declared set.
- **Assert:** `allowed === false`, `category === "denied:transport-not-approved"`,
  audit `deny`. Provider never executes over the undeclared transport.

### 2.8 Audit Failure
- **Setup:** `setAuditSink` sink throws on every call (simulating audit outage).
- **Action:** a legitimate `guard.guard()` that would otherwise ALLOW.
- **Assert:** guard still **DENIES** the execution (Hermes never proceeds
  unaudited — PHASE 4 §2.5), provider **QUARANTINED** (`SUSPENDED`), operator
  notification attempted, local `AUDIT_FAILURE` recorded. This is the critical
  fail-closed path — audit blindness must not enable execution.

### 2.9 Compromise Signal (extension of 2.4/2.8)
- **Setup:** sandbox backend reports network egress when `network:"none"`
  declared (observed-vs-declared drift).
- **Action:** guard `observe()` receives the violation metrics.
- **Assert:** `REVOKE_TRUST` (→ `REJECTED`) + `UNLOAD` + critical operator
  notification; `PROVIDER_COMPROMISE_SIGNAL` audit emitted.

### 2.10 Concurrency Cap (in-process limit)
- **Setup:** `limits.maxConcurrent = 1`.
- **Action:** two `guard.guard()` calls without the first completing.
- **Assert:** first ALLOWED, second `denied:concurrency-exceeded`; audit
  `deny`. After first finishes, a third call ALLOWED.

---

## 3. Test Harness Notes (learned from EPIC-005.3)

- **Mock path depth matters.** `vi.mock` specifiers must match the *executor's*
  import depth. From `services/providers/__tests__/`, the audit emitter is
  `../../../audit/emitter.js` (→ `hermes/audit/emitter.js`), **not**
  `../../audit/emitter.js`. A wrong-depth mock silently loads the real emitter
  and the capture sink records nothing → false failures.
- **Spawner `on` overload.** Fake `SpawnedProcess` must implement `on` with the
  overloaded signature (`on(event, listener)` / `on(event, listener, options)`)
  to satisfy the `Transport` types under `tsc`.
- **Audit assertions** capture via `setAuditSink((ev) => sink.push(ev))` and
  assert `sink.some(e => e.type === "guard.deny" && e.detail.category === …)`.
- **No fake-green:** every "allow" test must also assert the corresponding
  `guard.allow` audit event was emitted, proving the allow path is real, not a
  default-return.

---

## 4. Acceptance Gate (next epic must meet)

| Gate | Target |
|---|---|
| All 10 catalogs green | 10/10 groups passing |
| Audit coverage | every deny/allow asserts a captured `emitAudit` event |
| Fail-closed proven | §2.2, §2.8 specifically prove default-deny + audit-blindness Deny |
| Typecheck | `tsc --noEmit` clean on guard + violation modules |
| No regressions | existing EPIC-003/004/005 suites remain green |

---

*PHASE 6 complete. The test strategy is the acceptance contract for the
implementation epic. Next: PHASE 7 (AGS Readiness).*
