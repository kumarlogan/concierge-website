# EPIC-005.7 — Implementation Plan

**Companion to:** `docs/architecture/EPIC-005.7_TRUST_ENFORCEMENT_ARCHITECTURE.md`
**Phase:** Planning ONLY (STRICT READ-ONLY — no implementation performed here).
**Goal:** Ordered, independently testable, reversible, non-breaking roadmap to close G-1…G-4 from EPIC-005.6.

---

## Guiding constraints (apply to every milestone)
1. **Provider-neutral.** No vendor/provider-identity branches in trust code. Selection by *type* (`algorithm`, `authModel`, `transport kind`) only.
2. **Fail-closed.** Any verification/auth/revocation uncertainty ⇒ DENY/REJECT. No default-allow.
3. **Reversible.** Each milestone is additive or behind a config flag; rollback = revert the change without data loss.
4. **Non-breaking.** Existing `untrusted` providers and the single-gateway architecture keep working; new gates are staged behind defaults that preserve current admissible set until explicitly tightened.
5. **Hermes-owned secrets.** Verifiers, signer keys, credentials, notifier sinks are injected by the platform — never read from provider manifests.

---

## M1 — Persistent Trust State

**Closes:** G-4 (foundation)
**Files (planned, not edited):** `providers/sdk.ts`, `providers/trust/lifecycle.ts`, `providers/marketplace.ts`

### Work
- Add `QUARANTINED` and `REVOKED` to `ProviderLifecycleState` (sdk.ts:15-25).
- Add `lifecycle.quarantine(id, reason)`, `lifecycle.revoke(id, reason)`, `lifecycle.reinstate(id)`; update `set()` to emit `provider.trust.transition`.
- Persist trust records via a `TrustStateStore` interface (Hermes-owned; D1/SQLite/KV). Mirror in the existing `Map`.
- On restart, preserve `QUARANTINED`/`REVOKED`; refuse silent reactivation.
- Extend `ProviderMarketplace.toEntry` (marketplace.ts:87-112) to surface the two new states with `available:false` + reason.

### Tests (independent)
- State-machine unit: valid transitions pass; illegal transitions rejected.
- Persistence unit: revoke survives a "restart" (reload from store) and blocks re-admit.
- Marketplace unit: `QUARANTINED`/`REVOKED` entries carry `available:false`.

### Reversible
Additive enum + new methods. Rollback = remove enum members + methods; in-memory map behavior unchanged.

### Acceptance
`QUARANTINED`/`REVOKED` exist, transition with audit, persist, and render in marketplace.

---

## M2 — Checksum Verification

**Closes:** G-1
**Files:** `providers/trust/lifecycle.ts` (replace stub at :174-178), new `providers/trust/integrity/checksum.ts`

### Work
- Define `ChecksumVerifier` (architecture Phase 1). Implement canonical byte serialization (stable field order).
- Delete the `return true` stub; call `ChecksumVerifier.verify` for **all** tiers during `VALIDATE`.
- Mismatch ⇒ `reject(id, "VALIDATE", "manifest checksum mismatch")`.

### Tests (independent)
- Unit: known manifest → expected sha256; tampered field → mismatch detected.
- Unit: canonicalization is stable across key ordering.
- Integration: unsigned-but-tampered `untrusted` manifest is rejected at `VALIDATE`.

### Reversible
Swap one method. Rollback = restore stub (with a feature flag to disable checksum if needed during rollout).

### Acceptance
No manifest passes `VALIDATE` with a mismatched checksum, regardless of trust tier.

---

## M3 — Signature Verification + Signer Registry

**Closes:** G-1, G-2
**Files:** `providers/trust/integrity/signature.ts`, `providers/trust/signer-registry.ts`, `providers/manager.ts` (default config :69), `providers/trust/lifecycle.ts`

### Work
- Implement `SignatureVerifier` (ed25519/sha256/sha512) + `SignerRegistry` (get/list/activeAt/rotate/revoke).
- Wire registry + verifier into `TrustLifecycle` (replace the `enforceSignatures` branch at lifecycle.ts:104-114 to use real verifiers).
- Change default `TrustConfig` in `manager.ts:69` to `enforceSignatures: true` with a first-party Hermes signer; external providers require operator-registered signers.
- `trusted`/`privileged` tiers without a resolvable, active, non-revoked signer ⇒ reject.

### Tests (independent)
- Unit: signed manifest (valid key, in-window) ⇒ accepted; wrong key ⇒ rejected; expired key ⇒ rejected; revoked signer ⇒ rejected.
- Unit: `SignerRegistry.rotate` overlap allows both keys during window.
- Config test: default config rejects an unsigned `trusted` provider (fail-closed).

### Reversible
Config flag (`enforceSignatures`) + injectable verifier. Rollback = set flag false + restore stub branch.

### Acceptance
Signatures are cryptographically verified by default; provenance is provable for `trusted`/`privileged`.

---

## M4 — Provider Authentication

**Closes:** G-3
**Files:** new `providers/trust/auth/` (authenticator.ts, registry.ts, models: token/oauth/mtls/ssh/api-key), `providers/trust/lifecycle.ts` (replace no-op at :129-130)

### Work
- Define `Authenticator` + `AuthenticatorRegistry` keyed by `authModel` (manifest-v2.ts:70).
- Replace the unconditional `this.set(id, "AUTHENTICATED")` with a real gate: select authenticator by `manifest.trust.authModel`; on `!ok` ⇒ fail-closed reject (or quarantine after N repeated failures).
- Implement the six models per architecture Phase 2; credentials from `CredentialStore` (Hermes-owned).
- Bind resulting `Principal` into the execution context.

### Tests (independent)
- Per-model unit: valid creds ⇒ `AUTHENTICATED`; expired/revoked/missing ⇒ `AUTH_FAILED`.
- State-machine unit: `AUTH_REQUIRED → AUTHENTICATED | AUTH_FAILED`.
- Negative: a provider declaring `mtls` but presenting no cert is rejected (proves no more no-op).

### Reversible
Additive registry + gate. Rollback = restore no-op transition (feature-flag the gate).

### Acceptance
Declared `authModel` is actually enforced; `none` remains explicit opt-in for `untrusted` dev providers only.

---

## M5 — Revocation Engine + Hook Wiring

**Closes:** G-4
**Files:** new `providers/trust/revocation-engine.ts`, `providers/platform.ts` (wire `setHooks`), `providers/runtime/guard.ts` (hooks already defined :106/411-426), `providers/marketplace.ts`, `notifier` sink

### Work
- Implement `RevocationEngine` consuming `GuardHooks` (`quarantine`/`revoke`/`unload`/`alert`).
- In `UniversalCapabilityPlatform` constructor, call `this.runtimeGuard.setHooks(engine.hooks)` — **this is the missing wiring** (G-4 root cause).
- Engine maps violation classes (violation-model.ts:52/54) → `lifecycle.quarantine/revoke` → `marketplace.updateVisibility` → `Notifier` → `emitAudit`.
- HIGH violation ⇒ `REVOKED` + unload + critical-audit; MEDIUM ⇒ `QUARANTINED` + alert.
- Operator `reinstate` (`QUARANTINED→ACTIVE`) and re-admission (`REVOKED→DISCOVERED`) flows.

### Tests (independent)
- Simulate guard HIGH violation ⇒ provider transitions to `REVOKED`, removed from `liveProviders`, marketplace shows `available:false`, operator notified, audit emitted.
- Simulate MEDIUM violation ⇒ `QUARANTINED`; operator reinstate returns to `ACTIVE`.
- Notifier failure does NOT block revocation (authoritative state wins).

### Reversible
Additive engine + one constructor call. Rollback = remove `setHooks` call (hooks become no-ops again, current behavior).

### Acceptance
Violations now cause persistent, visible, audited containment — not just a single-call deny.

---

## M6 — End-to-End Integration & Neutrality Regression

**Closes:** all (verification)
**Files:** `providers/__tests__/`, `runtime/__tests__/`

### Work
- E2E: full path `discover → admit (VALIDATE+AUTH) → execute via gateway → guard → (violation) → revoke → marketplace → notify → audit`.
- Provider-neutrality grep regression: assert zero vendor/provider-identity branches in `providers/trust/**`, `providers/runtime/**`, `providers/platform.ts`.
- Re-run existing 108-test suite to confirm no regression (Stack B gate intact).

### Tests (independent)
- E2E suites per milestone composition.
- Neutrality static assertion in CI.

### Reversible
Tests only; no production behavior change beyond prior milestones.

### Acceptance
Chain proven end-to-end; neutrality preserved; existing suite green.

---

## M7 — Fail-Closed Defaults Hardening & Rollout

**Closes:** all (hardening)
**Files:** `providers/manager.ts`, config docs, rollout runbook

### Work
- Finalize default `TrustConfig` (signatures on, first-party signer, authorize hook).
- Document operator procedure for registering external signers + credentials.
- Staged rollout: (1) M1–M4 behind flags in non-prod; (2) enable enforcement; (3) M5 containment; (4) M6 verification; (5) prod with audit-only soft-fail fallback window then hard fail-closed.
- Update architecture + operations docs.

### Tests (independent)
- Config-matrix tests: every (tier × enforcement × signer) combination behaves fail-closed.

### Reversible
Config-only. Rollback = relax defaults via `withTrustConfig`.

### Acceptance
Production defaults fail closed; rollout runbook exists; docs current.

---

## Dependency order (DAG)
```
M1 ──▶ M2 ──▶ M3
M1 ──▶ M4
M1 ──▶ M5 (needs M2/M3/M4 for meaningful violations; M5 itself only needs M1)
M2,M3,M4,M5 ──▶ M6 ──▶ M7
```
M1 is the foundation; M2/M3/M4 can proceed in parallel after M1; M5 can land once M1 exists but is most meaningful after M2–M4; M6 integrates; M7 hardens.

## Risk / rollback summary
- Every milestone is additive or flag-gated ⇒ rollback is localized and non-destructive.
- No milestone edits AGS/Cloudflare/Worker code or creates secrets (secrets are referenced via injected Hermes-owned stores, configured out-of-band by operators).
- Provider-neutral invariant is asserted in M6 CI gate, preventing regression of the architecture.

---

## STOP CONDITION
Plan only. No implementation. No commits. No deployment. Deliverables:
- `docs/architecture/EPIC-005.7_TRUST_ENFORCEMENT_ARCHITECTURE.md`
- `docs/operations/EPIC-005.7_IMPLEMENTATION_PLAN.md`
