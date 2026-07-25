# EPIC-005.6 — s6 Trust Hardening Verification

**Mode:** READ-ONLY verification (no source changes, no fixes, no commits, no deploy)
**Scope:** Provider trust enforcement after gateway unification
**Date:** 2026-07-20
**Verifier:** Hermes (autonomous, read-only)

---

## 0. Verification Method

All findings below are derived from static reading of source under
`hermes/services/providers/`, `hermes/services/activation/`, and
`hermes/services/execution/gateway/`. No code was executed, modified, or
deployed. Line citations point at the exact evidence.

Files inspected in full:
- `providers/trust/lifecycle.ts` — trust lifecycle driver
- `providers/manifest-v2.ts` — manifest schema + structural validation
- `providers/manager.ts` — dynamic provider admission orchestration
- `providers/platform.ts` — UniversalCapabilityPlatform (admission + gateway)
- `providers/runtime/guard.ts` — 8-dimension ProviderRuntimeGuard
- `providers/runtime/violation-model.ts` — violation → response mapping
- `providers/runtime/marketplace-security.ts` — read-only safety projection
- `providers/marketplace.ts` — marketplace visibility
- `providers/sdk.ts` — lifecycle/trust type definitions
- `activation/provider-framework.ts` (lines 300–399) — Stack B guard
- `execution/gateway/hermes-execution-gateway.ts` — single execution boundary
- `security/providers/security-providers.ts` — security provider activation

---

## Phase 1 — Provider Trust Lifecycle Review

### Lifecycle states (sdk.ts:15–25)
```
DISCOVERED | VALIDATED | AUTHORIZED | AUTHENTICATED
LOADED | ACTIVE | SUSPENDED | RUNNING | REJECTED | UNLOADED
```
The requested chain `DISCOVERED ↓ VALIDATED ↓ AUTHORIZED ↓ ACTIVE ↓ REVOKED/REJECTED`
is **partially** matched: `AUTHENTICATED` is interposed; `REJECTED` exists as the
terminal failure state; **`REVOKED` and `QUARANTINED` are NOT lifecycle states.**
Revocation/quarantine exist only as guard *side-effects* (see Phase 5).

### Admission flow (`TrustLifecycle.admit`, lifecycle.ts:78–140)
1. DISCOVERED — manifest validated structurally
2. VALIDATE — signature/checksum (only if `enforceSignatures`, see Phase 2)
3. VALIDATED
4. AUTHORIZE — `config.authorize(manifest)`; fail-closed on false/throw
5. AUTHORIZED
6. AUTHENTICATED — **no-op** (see Phase 3)
7. LOAD — factory builds provider
8. LOADED → `activate()` → ACTIVE

### Single admission path (manager.ts:128–137)
> "Trust admission (PHASE 4: the ONLY path)"

All providers enter via `platform.bootstrap(id)` → `lifecycle.admit()`. No
alternate admission route found.

### Questions

| Question | Answer | Evidence |
|---|---|---|
| Can an **untrusted** provider execute? | **Allowed by design** — trust tier `untrusted` is a *tier*, not a lifecycle block. RuntimeGuard gate 1 checks lifecycle STATE, not trust LEVEL. An untrusted-tier provider that passes `authorize()` reaches ACTIVE and executes. | guard.ts:81–85 (RUNNABLE_STATES), guard.ts:196–212 |
| Can a **revoked/REJECTED** provider execute? | **No.** REJECTED ∉ RUNNABLE_STATES → gate 1 DENY. | guard.ts:196–202, 81–85 |
| Can a **SUSPENDED** provider execute? | **No.** SUSPENDED ∉ RUNNABLE_STATES. | guard.ts:81–85, lifecycle.ts:168 |
| Can an **unknown** provider execute? | **No.** `trust === undefined` → DENY; platform only executes from `liveProviders` map. | guard.ts:196–202, platform.ts:195–205 |
| Can a provider **bypass admission**? | **No.** Single path via `bootstrap`→`admit`. | manager.ts:128–137 |

**Phase 1 verdict: PASS** (lifecycle enforced, no bypass). Caveat: `REVOKED`/`QUARANTINED`
are not first-class states — see Phase 5 gap.

---

## Phase 2 — Signature Verification Review

### Where verification happens (lifecycle.ts:104–114)
```ts
if (this.config.enforceSignatures && m.trust.level !== "untrusted") {
  const sig = m.trust.signature;
  if (!sig || !this.config.trustedSigners.includes(sig.signer)) {
    return { record: this.reject(id, "VALIDATE", "signature missing or untrusted signer") };
  }
  if (!this.verifyChecksum(m)) {
    return { record: this.reject(id, "VALIDATE", "manifest checksum mismatch") };
  }
}
```

### Findings

| Check | Status | Evidence |
|---|---|---|
| Signature enforcement active by default? | **OFF.** `enforceSignatures` defaults to `false` in production manager (manager.ts:69). Branch skipped entirely unless explicitly enabled. | manager.ts:69 |
| Signer identity validated? | Only when enabled: `trustedSigners.includes(sig.signer)` — a string set-membership check (good design) but `trustedSigners` defaults to `[]`. | lifecycle.ts:107, manager.ts:69 |
| **Checksum actually verified?** | **NO — `verifyChecksum` is a placeholder.** | lifecycle.ts:174–178 |
| Manifest requires signature for tier ≥ sandbox? | Structural validation requires a `signature` object for `trusted`/`privileged` tiers (manifest-v2.ts:164–165) — but the signature is never cryptographically verified. | manifest-v2.ts:164–165 |

### `return true` in trust/security verification paths
- **`lifecycle.ts:177` — `verifyChecksum(_m): boolean { return true; }`** ← security gap.
  Comment claims "actual crypto is injected by the platform" but **no injection point
  exists**; the function is never overridden. This is the supply-chain integrity check.

### Classification (per spec)
| Path | Class |
|---|---|
| `verifyChecksum` always-true | **C — Security gap** |
| Signature branch (design) | **B — Design seam only** (correct structure, disabled by default, no real crypto) |
| Structural `trust.signature` requirement | **A — Real (structural only)** |

**Phase 2 verdict: FAIL (C)** — signature verification is a seam; checksum is a
`return true` placeholder; enforcement is off by default.

---

## Phase 3 — Provider Authentication Review

### Manifest auth models (manifest-v2.ts:70)
`none | token | oauth | mtls | ssh-key`

### What actually happens (lifecycle.ts:129–130)
```ts
// AUTHENTICATED — no-op placeholder for token/oauth/mtls/ssh; trust owns it.
this.set(id, "AUTHENTICATED");
```
The `AUTHENTICATED` transition is performed **unconditionally** for every provider,
regardless of declared `authModel`. No token exchange, no mTLS handshake, no SSH
key check, no OAuth flow is ever performed.

| Auth mode | Implemented? | State transition validated? | Missing-auth denied? |
|---|---|---|---|
| `none` | N/A | — | — |
| `token` | **NOT IMPLEMENTED** | No (auto-ACTIVE) | No |
| `oauth` | **NOT IMPLEMENTED** | No (auto-ACTIVE) | No |
| `mtls` | **NOT IMPLEMENTED** | No (auto-ACTIVE) | No |
| `ssh-key` | **NOT IMPLEMENTED** | No (auto-ACTIVE) | No |

**Phase 3 verdict: FAIL (C)** — for every non-`none` auth mode, authentication is a
no-op placeholder. The `authModel` string is declared but never enforced; a provider
saying `mtls` runs identically to one saying `none`.

---

## Phase 4 — Runtime Guard Trust Integration

### ProviderRuntimeGuard 8-dimension check (guard.ts:190–338)
1. `trust-state` — record must exist + lifecycle ∈ RUNNABLE_STATES ✓
2. `tenant-scope` — cross-tenant target denied ✓
3. `capability-authz` — capability must be declared in manifest ✓
4. `permission-scope` — capability must carry a granted permission ✓
5. `transport-authz` — transport kinds must be platform-known ✓
6. `runtime-limits` — timeout + concurrency ceilings ✓
7. `sandbox-requirements` — tier ≥ trusted requires non-`none` isolation ✓
8. `audit-availability` — audit sink must be a function ✓

### Execution path cannot skip the guard
- `UniversalCapabilityPlatform.execute` → `gateway.execute(...)`
  (platform.ts:191–266), no direct `provider.execute` outside the executor callback.
- Gateway gate 4 calls `this.guard.guard(guardCtx)` unconditionally
  (hermes-execution-gateway.ts:261) with **no skip/bypass branch**; dispatch to the
  real executor only happens after `guardDecision.allow` (line 272).
- Stack B `StackBGatewayGuard` (provider-framework.ts:325–347) enforces the same
  fail-closed trust (active + enabled + healthy) + tenant scope.
- Default guard instance `ProviderRuntimeGuard.DEFAULT` is used when none injected
  (guard.ts:444, platform.ts:67), so no "no-guard" configuration is reachable.

**Phase 4 verdict: PASS** — all 8 dimensions present; no execution path skips the
guard. (Pre-existing s5 note: `ToolProvider`/MCP and git `BACKEND` direct calls are
non-gateway surfaces — accepted risk, outside this phase's trust-code scope.)

---

## Phase 5 — Revocation Behavior

### What works
| Expected | Status | Evidence |
|---|---|---|
| Execution denied on REJECTED/SUSPENDED | ✅ | guard.ts:81–85, 196–212 |
| Audit emitted on denial | ✅ | guard.ts:120–127 (`provider.runtime.denied`) |
| Marketplace visibility updated | ✅ | marketplace.ts:100 (REJECTED → `untrusted`, reason shown) |
| No silent fallback | ✅ | gateway returns `deny(...)`, never proceeds | 

### Gap — revocation/quarantine side-effects are unwired
`ViolationResponseEngine` maps violations to side-effects:
- `trust-state` HIGH → `revoke` + `unload` + `critical-audit` (violation-model.ts:52)
- `sandbox-requirements` MEDIUM → `quarantine` + `alert` (violation-model.ts:54)

These are dispatched via `GuardHooks` (guard.ts:411–426). **But `setHooks` is never
called in production code** — grep confirms `setHooks(` appears only in `guard.ts`
(definition) and is never invoked outside test files. Therefore:
- A runtime violation DENIES the *current* execution (good) but the provider remains
  `ACTIVE` and can retry on the next request.
- `REVOKED` / `QUARANTINED` are never actually applied to the lifecycle record.
- The "revoke/unload/quarantine" actions are computed but have no effect.

### State-name mismatch
The spec expects `REVOKED` / `QUARANTINED` / `FAILED TRUST CHECK` as lifecycle states.
Only `REJECTED` (admission failure) and `SUSPENDED` (health) exist as blocking states.
Persistent revocation depends on the unwired hooks above.

**Phase 5 verdict: PARTIAL** — denial + audit + visibility work for REJECTED/SUSPENDED,
but the persistent revoke/quarantine side-effects are designed yet unwired.

---

## Phase 6 — Provider Neutrality

Grep for vendor/provider-specific branches in trust code:
`claude|anthropic|openai|vendor ===|providerId ===|fertility` in
`providers/trust/` → **0 matches**.

- `platform.ts:7` — "never about Claude"
- `guard.ts:13` — "No Claude-specific, AGS-specific, or provider-specific logic"
- `violation-model.ts:15` — "No provider-specific logic"
- Runtime checks are keyed by violation *dimension*, never by provider identity.
- Severity in `violation-model.ts:50–62` is derived solely from the violation class.

The `providers/claude-code/` directory is a separate vendor adapter — it is NOT part of
the trust/verification path and does not introduce branches into trust code.

**Phase 6 verdict: PASS** — trust code is provider-neutral; no vendor-specific branches.

---

## Consolidated Findings & Risk Rating

| Phase | Verdict | Class |
|---|---|---|
| 1 — Lifecycle | PASS | — |
| 2 — Signature/Checksum | **FAIL** | C (gap) |
| 3 — Authentication | **FAIL** | C (gap) |
| 4 — Runtime Guard | PASS | — |
| 5 — Revocation | PARTIAL | C (gap, unwired hooks) |
| 6 — Neutrality | PASS | — |

### Security gaps identified
1. **G-1 (HIGH):** `verifyChecksum` is a `return true` placeholder (lifecycle.ts:174–178).
   Supply-chain integrity is not cryptographically verified even when signatures are
   enabled.
2. **G-2 (HIGH):** Signature verification disabled by default (`enforceSignatures:false`,
   `trustedSigners:[]` in manager.ts:69). No provider is signature-checked in the
   default production wiring.
3. **G-3 (HIGH):** Provider authentication is a no-op for all modes (lifecycle.ts:129–130).
   `token`/`oauth`/`mtls`/`ssh-key` are declared but never enforced.
4. **G-4 (MEDIUM):** Revoke/quarantine side-effects are unwired — `setHooks` never called
   outside tests (guard.ts:106 vs. no production caller). Violations deny the single
   execution but do not persistently revoke.

### Overall Risk Rating: **HIGH**
The lifecycle, runtime guard, and neutrality controls are sound and fail-closed.
However, three of the four core trust pillars — signature/checksum verification,
authentication, and persistent revocation — are either placeholders, disabled by
default, or unwired. Current exposure is mitigated by: (a) no admission bypass,
(b) fail-closed lifecycle + runtime guard, (c) marketplace visibility of rejections.
But under any deployment that loads non-`untrusted` providers, the integrity and
auth guarantees are not actually enforced.

---

## STOP CONDITION
Verification only. No source modified, no fixes applied, no commit, no deploy.
s8 not started.

**Summary: FAIL** (Phases 2, 3 fail; Phase 5 partial). Awaiting your approval to
proceed to remediation (s8) or next steps.
