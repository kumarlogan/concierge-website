# EPIC-005.7 — Trust Enforcement Architecture

**Phase:** Architecture & Planning ONLY (STRICT READ-ONLY — no source changes, no commits, no deploy)
**Objective:** Design the implementation required to close every trust gap identified in EPIC-005.6.
**Inputs:** `docs/operations/EPIC-005.6_TRUST_VERIFICATION.md`, current trust lifecycle, runtime guard, HermesExecutionGateway, provider manifests, marketplace security view.
**Date:** 2026-07-20

---

## Phase 0 — Gap Validation

Confirmed against source. Each gap below cites the exact line(s) that evidence it.

### G-1 — Signature / checksum placeholder

- **Current behavior:** `providers/trust/lifecycle.ts:174-178`
  ```ts
  private verifyChecksum(_m: ProviderManifestV2): boolean {
    // Hermes-owned integrity check. The actual crypto is injected by the
    // platform; default pass when signatures are not enforced (test/dev).
    return true;
  }
  ```
  Called only inside the `enforceSignatures` branch (lifecycle.ts:104-114). There is **no injection point** — the "injected by the platform" claim is unimplemented. The function is never overridden.
- **Security impact:** Supply-chain integrity is never crypthetically verified. A tampered manifest (altered `capabilities`/`permissions`/`trust` block) for any tier passes silently. Even if `enforceSignatures` were enabled, the checksum would still pass.
- **Desired behavior:** A real `ChecksumVerifier` computes and compares a hash over the canonical manifest bytes; any mismatch → `reject(id, "VALIDATE", "manifest checksum mismatch")`. Checksum verification is performed for **all** tiers (cheap, no key material required), independent of whether signatures are enforced.
- **Dependencies:** Signature verifier (Phase 1), canonical-manifest serialization, audit events, trusted signer registry (Phase 1).

### G-2 — Signature enforcement disabled

- **Current behavior:** `providers/manager.ts:69` — the production default trust config is
  ```ts
  { trustedSigners: [], enforceSignatures: false, authorize }
  ```
  `withTrustConfig` (manager.ts:82-85) lets a caller override, but the default wiring disables enforcement and ships an empty signer set.
- **Security impact:** No provider is ever signature-checked. `trusted`/`privileged` tiers, which structurally *require* a `signature` object (manifest-v2.ts:164-165), are admitted on self-asserted metadata with zero cryptographic proof of provenance. Any package can declare itself `trusted`.
- **Desired behavior:** A Hermes-owned `TrustConfig` with explicit `trustedSigners` and `enforceSignatures`. Bootstrap fails closed when a `trusted`/`privileged` provider presents an unverifiable or unsigned manifest. First-party (Hermes) providers carry a platform signer; external providers require operator-registered signers before admission. Structural requirement and cryptographic enforcement are decoupled but both enforced.
- **Dependencies:** G-1 verifier, signer registry (Phase 1).

### G-3 — Authentication no-op

- **Current behavior:** `providers/trust/lifecycle.ts:129-130` performs an unconditional transition:
  ```ts
  // AUTHENTICATED — no-op placeholder for token/oauth/mtls/ssh; trust owns it.
  this.set(id, "AUTHENTICATED");
  ```
  The manifest's declared `authModel` (`none | token | oauth | mtls | ssh-key`, manifest-v2.ts:70) is **never read or enforced**. The runtime guard gate 5 (guard.ts:248-278) only checks that a transport *kind* is platform-known — it does not confirm that auth was actually negotiated.
- **Security impact:** A provider declaring `mtls` or `oauth` executes identically to one declaring `none`. There is no binding between the declared auth model and the live transport; an impersonating or spoofed backend is trusted without challenge.
- **Desired behavior:** `AUTHENTICATED` becomes a real gate. An `Authenticator` selected by `authModel` performs the actual challenge and fails closed on missing/invalid/expired/revoked credentials. State machine in Phase 2.
- **Dependencies:** Credential store (Hermes-owned), authenticator registry (Phase 2), audit.

### G-4 — Revocation hooks not wired

- **Current behavior:**
  - `guard.ts:106` defines `setHooks(hooks)`; `guard.ts:411-426` dispatches `quarantine`/`revoke`/`unload` to `this.hooks?.<action>`.
  - `setHooks` is **never invoked in production code** (grep: only the definition + test usages). Therefore the side-effects are dead.
  - The violation→response mapping exists (violation-model.ts:52 trust-state→`revoke`+`unload`+`critical-audit`; :54 sandbox→`quarantine`+`alert`), but with no hooks, nothing happens.
  - `REVOKED` and `QUARANTINED` are **not** `ProviderLifecycleState`s (sdk.ts:15-25 enumerates `REJECTED`/`UNLOADED` but no persistent revoke/quarantine state).
- **Security impact:** A runtime violation DENIES the single execution (good) but the provider stays `ACTIVE` and can retry on the next request. There is no persistent containment; the marketplace keeps advertising the provider as active.
- **Desired behavior:** Wire `GuardHooks` in the platform; add `REVOKED`/`QUARANTINED` as first-class states; the engine transitions them; marketplace reflects; operator notified; audit trail. Re-admission flow defined.
- **Dependencies:** Persistent trust state (Phase 3), revocation engine (Phase 4), marketplace update, operator notify channel.

| Gap | Class (from 005.6) | Confirmed |
|---|---|---|
| G-1 checksum stub | C | ✅ lifecycle.ts:174-178 |
| G-2 enforcement off | C | ✅ manager.ts:69 |
| G-3 auth no-op | C | ✅ lifecycle.ts:129-130 |
| G-4 hooks unwired | C | ✅ guard.ts:106 vs no caller; sdk.ts:15-25 |

---

## Phase 1 — Signature Verification Design

**Principles:** Provider-neutral. Fail-closed (any verification error ⇒ reject at `VALIDATE`). No provider-specific exceptions in the verifier paths.

### SignatureVerifier interface
```ts
export type SignatureAlgorithm = "sha256" | "sha512" | "ed25519";

export interface SignatureBlock {
  algorithm: SignatureAlgorithm;
  checksum: string;       // hex of the manifest digest
  signer: string;         // signer id, resolved via SignerRegistry
  certificate?: string;   // optional x509/PEM for ed25519/x509 paths
}

export interface VerifyResult {
  ok: boolean;
  reason?: string;
  code?: string;          // e.g. "SIG_UNKNOWN_SIGNER", "SIG_BAD", "SIG_EXPIRED"
}

export interface SignatureVerifier {
  readonly supported: ReadonlySet<SignatureAlgorithm>;
  verify(manifest: ProviderManifestV2, sig: SignatureBlock, key: SigningKey): Promise<VerifyResult>;
}
```

### ChecksumVerifier interface
```ts
export interface ChecksumVerifier {
  readonly algorithm: "sha256" | "sha512";
  /** Deterministically serialize manifest → bytes (Hermes-owned canonical form). */
  canonicalize(m: ProviderManifestV2): Uint8Array;
  compute(m: ProviderManifestV2): string;                       // hex digest
  verify(m: ProviderManifestV2, expected: string): boolean;     // constant-time compare
}
```
- Checksum is computed over the canonical byte form (field-ordered, stable) so a semantically-equal manifest produces a stable digest. Performed for **every** tier (including `untrusted`) — it requires no key material and catches tampering cheaply.

### Trusted signer registry
```ts
export interface SigningKey {
  id: string;                 // signer id referenced by SignatureBlock.signer
  algorithm: SignatureAlgorithm;
  publicKey: Uint8Array;      // never the private key
  validFrom: string;          // ISO
  validUntil?: string;        // ISO; undefined = no expiry
  revokedAt?: string;         // ISO; presence ⇒ permanently invalid
}

export interface SignerRegistry {
  get(signerId: string): SigningKey | undefined;
  list(): SigningKey[];
  /** Multiple active keys per signer allowed for rotation overlap. */
  activeAt(signerId: string, at: string | Date): SigningKey | undefined;
  rotate(signerId: string, next: SigningKey): void;
  revoke(signerId: string, at: string): void;
}
```
- **Sourced from Hermes-owned config only** — signer keys are never read from the provider manifest. An `untrusted` provider may still carry a signature, but admission does not require one; a `trusted`/`privileged` provider MUST resolve to an active, non-revoked signer.

### Key rotation
- Each `SigningKey` carries `validFrom`/`validUntil`. A signature is valid if the signer's key was active **at `manifest.issuedAt`** (or at current time when `issuedAt` is absent). The registry may hold several keys per signer to permit overlap windows. Rotation = register `next` with a forward `validFrom`; old key retained until `validUntil` for verification of in-flight manifests, then `revoke`.

### Failure handling (fail-closed)
- Missing `signature` on `trusted`/`privileged` ⇒ `reject(id, "VALIDATE", "signature required for trust tier")`.
- `signer` not in registry / key revoked / expired ⇒ `reject(id, "VALIDATE", "untrusted signer")`.
- `verify()` throws or returns `!ok` ⇒ `reject(id, "VALIDATE", "signature invalid")`.
- Checksum mismatch ⇒ `reject(id, "VALIDATE", "manifest checksum mismatch")`.
- **No default-allow path.** `verifyChecksum` placeholder is deleted.

### Audit events
| Event | Fields |
|---|---|
| `provider.signature.verified` | providerId, signer, algorithm |
| `provider.signature.rejected` | providerId, code, reason |
| `provider.checksum.mismatch` | providerId, expected, actual |
| `provider.signer.unknown` | providerId, signer |
| `provider.signer.rotated` | signerId, actor |
| `provider.signer.revoked` | signerId, actor |

---

## Phase 2 — Authentication Design

**Principles:** Provider-neutral. The manifest declares an `authModel`; the platform supplies the matching `Authenticator`. No auth logic lives in provider code. Fail-closed.

### Authenticator interface
```ts
export type AuthModel = "none" | "token" | "oauth" | "mtls" | "ssh-key" | "api-key";

export interface AuthContext {
  manifest: ProviderManifestV2;
  transport: TransportKind;
  presented: unknown;          // credentials presented at connection time
  peer?: { cert?: Uint8Array; hostKey?: string; remoteAddr?: string };
}

export interface AuthOutcome {
  ok: boolean;
  principal?: Principal;       // bound into the execution context
  reason?: string;
  code?: string;               // AUTH_INVALID | AUTH_EXPIRED | AUTH_REVOKED | AUTH_MISSING
}

export interface Authenticator {
  readonly model: AuthModel;
  authenticate(ctx: AuthContext): Promise<AuthOutcome>;
}
```

### Authentication state machine (per provider, during `AUTHENTICATED`)
```
AUTH_REQUIRED ──▶ AUTH_IN_PROGRESS ──▶ AUTHENTICATED
                       │
                       └──▶ AUTH_FAILED ──▶ (reject at AUTHORIZE | quarantine)
```
- `none` ⇒ `AUTHENTICATED` immediately (no challenge).
- Any other model ⇒ invoke `AuthenticatorRegistry.get(model).authenticate(ctx)`; `!ok` ⇒ `AUTH_FAILED` ⇒ fail-closed reject (or quarantine on repeated failure).

### Per-model design
| Model | Mechanism | Failure modes |
|---|---|---|
| `token` | Verify presented bearer/JWT against platform issuer (JWKS or opaque introspection); assert `aud`/`exp`/`iss`. | missing, expired, bad signature, wrong issuer |
| `oauth` | Token introspection against declared `auth.issuer`; map `sub`/`scope` to `Principal`. | introspection failure, scope mismatch, expired |
| `mtls` | Validate peer cert chain against platform CA; pin `subject`/SAN to manifest-declared endpoint identity. | broken chain, CN mismatch, expired cert, self-signed |
| `ssh-key` | Host-key verification (known_hosts) or user pubkey assertion; reject on mismatch. | host key changed, key not registered, algorithm disabled |
| `api-key` | Constant-time HMAC over request with secret from credential store; or shared-secret compare. | missing, revoked, rotated, mismatch |
| `none` | No challenge (explicit opt-in only for `untrusted` dev providers). | — |

### Credential lifecycle
- Credentials stored in a **Hermes-owned** secret store (never in the manifest). `CredentialStore` supports `get(id)`, `rotate(id, secret)`, `revoke(id)`, `expiry(id)`.
- Rotation: re-issue secret, retain old until `validUntil` for in-flight requests, then `revoke`.
- Revocation: `revoke(id)` ⇒ any subsequent auth attempt returns `AUTH_REVOKED`.

### Failure modes (global)
- `AUTH_MISSING` (no creds presented) ⇒ reject.
- `AUTH_EXPIRED` / `AUTH_REVOKED` ⇒ reject + audit.
- `AUTH_INVALID` (bad signature/key) ⇒ reject + audit; N repeated ⇒ quarantine (see Phase 4).
- Transient auth infra error ⇒ fail-closed **deny** (never allow on uncertainty).

---

## Phase 3 — Persistent Trust State

### Add first-class states
Extend `ProviderLifecycleState` (sdk.ts:15-25) with `QUARANTINED` and `REVOKED`:
```
DISCOVERED | VALIDATED | AUTHORIZED | AUTHENTICATED
LOADED | ACTIVE | SUSPENDED | QUARANTINED | REVOKED
REJECTED | UNLOADED
```

### State transitions
```
DISCOVERED → VALIDATED → AUTHORIZED → AUTHENTICATED → LOADED → ACTIVE
ACTIVE      → SUSPENDED                (health, lifecycle.ts:161-172)
ACTIVE/…    → QUARANTINED              (guard MEDIUM violation / repeated auth fail)
ACTIVE/…    → REVOKED                  (guard HIGH violation / signer revoke / operator)
QUARANTINED → ACTIVE                   (operator reinstate after remediation)
REVOKED     → DISCOVERED               (re-admission: fresh bootstrap + admit)
*           → UNLOADED                 (runtime teardown)
```
- `RUNNABLE_STATES` (guard.ts:81-85) = `{LOADED, ACTIVE, RUNNING}`; `QUARANTINED`/`REVOKED`/`SUSPENDED`/`REJECTED` are non-runnable ⇒ gate 1 DENY.

### Persistence boundaries
- Trust records are persisted in a Hermes-owned store (D1/SQLite/KV). The in-memory `Map` is a mirror.
- On restart: `QUARANTINED`/`REVOKED` states **persist** — providers do NOT auto-reactivate. `ACTIVE`/`SUSPENDED` re-derived from health probe.
- `bootstrap()` must refuse to re-admit a `REVOKED` provider without explicit re-admission (fresh `DISCOVERED` path).

### Audit requirements
Every transition emits `provider.trust.transition` with `{ providerId, from, to, reason, actor, at }`. Transitions are append-only in the audit log.

### Recovery flow
- **Quarantine → Active:** operator-driven `lifecycle.reinstate(id)` after remediation; requires re-running `VALIDATE` (signature/checksum) to confirm integrity.
- **Revoked → Admitted:** only via full re-discovery + re-admission (`bootstrap` from `DISCOVERED`), never a silent restore.

---

## Phase 4 — Revocation Engine

### Flow
```
Violation (guard) ─▶ Quarantine ─▶ Revocation ─▶ Marketplace update
                                               └▶ Operator notification
                                               └▶ Audit trail
```

### Trigger conditions
| Source | Maps to | Action |
|---|---|---|
| Guard `trust-state` (HIGH, violation-model.ts:52) | REVOKE + UNLOAD + critical-audit | `lifecycle.revoke()` |
| Guard `sandbox-requirements` (MEDIUM, :54) | QUARANTINE + alert | `lifecycle.quarantine()` |
| Repeated `AUTH_FAILED` (Phase 2) | QUARANTINE | `lifecycle.quarantine()` |
| Signer revoked in `SignerRegistry` | REVOKE | `lifecycle.revoke()` |
| Operator action | QUARANTINE or REVOKE | `lifecycle.quarantine()/revoke()` |

### Persistence
- Engine calls `lifecycle.quarantine(id)` / `lifecycle.revoke(id)` (new methods, Phase 3). State persisted (Phase 3). The platform's `liveProviders` map is cleared on revoke/unload so no further execution is possible.

### Marketplace update
- `ProviderMarketplace.toEntry` (marketplace.ts:87-112) already maps `REJECTED → untrusted`; extend to surface `QUARANTINED`/`REVOKED` with `rejectionReason`/`quarantineReason` and an explicit `available: false` flag. `MarketplaceSecurityView` (marketplace-security.ts) already reads trust records read-only — no behavioral change needed, only new states reflected.

### Operator notification
- A `Notifier` interface (Hermes-owned sink; e.g., Telegram/email/webhook) receives `provider.revoked` / `provider.quarantined` with reason + actor. Failure of the notifier MUST NOT block the revocation (revoke is authoritative; notify is best-effort with audit fallback).

### Audit trail
- `provider.revoked`, `provider.quarantined`, `provider.reinstated`, each with `violationClass`/`code`/`reason`/`actor`. Critical-audit event fired for HIGH.

### Recovery & re-admission
- Quarantine: operator `reinstate` → `QUARANTINED → ACTIVE` after re-validation.
- Revoke: only re-admission via full `bootstrap` from `DISCOVERED`; the engine records the revocation so re-admission requires a fresh, verified manifest + auth.

---

## Phase 5 — Integration Architecture

### Component map & ownership
| Component | Role | Owns | Consumes |
|---|---|---|---|
| **HermesExecutionGateway** (gateway.ts) | Single execution boundary: tenant→policy→approval→guard | Dispatch orchestration | `ProviderRuntimeGuard`, `ApprovalService`, policy |
| **ProviderRuntimeGuard** (guard.ts) | 8-dimension fail-closed enforcement | Verdict only | `GuardHooks` (wired by platform) |
| **ViolationResponseEngine** (violation-model.ts) | Maps violation→side-effects | Response policy (data) | `GuardHooks` via guard |
| **TrustLifecycle** (lifecycle.ts) | Trust state machine + admission | State transitions, `quarantine()`/`revoke()`/`reinstate()` | `SignatureVerifier`, `ChecksumVerifier`, `Authenticator`s, `SignerRegistry` |
| **UniversalCapabilityPlatform** (platform.ts) | Composes subsystems; wires `GuardHooks` | Wiring, `execute()` → gateway | lifecycle, marketplace, gateway, guard |
| **MarketplaceSecurityView** (marketplace-security.ts) | Read-only safety projection | Projection (no state) | guard `evaluate()` |
| **ProviderMarketplace** (marketplace.ts) | Visibility | Entries | trust records |
| **Audit system** (`emitAudit`) | Immutable event log | Events | all of the above |
| **RevocationEngine** (new) | Violation→containment pipeline | Quarantine/revoke orchestration | lifecycle, marketplace, Notifier, audit |

### Required interfaces & ownership boundaries
1. **`GuardHooks` (guard.ts:448-452)** — currently defined, never wired. **Owner: platform** must call `setHooks` in its constructor, passing `RevocationEngine` callbacks (`quarantine`/`revoke`/`unload`/`alert`).
2. **`SignatureVerifier` / `ChecksumVerifier` (Phase 1)** — Hermes-owned, injected into `TrustLifecycle` (replacing the `verifyChecksum` stub). Never provider-supplied.
3. **`SignerRegistry` (Phase 1)** — Hermes-owned config source.
4. **`Authenticator` + `AuthenticatorRegistry` (Phase 2)** — Hermes-owned, keyed by `authModel`.
5. **`CredentialStore` (Phase 2)** — Hermes-owned secret store.
6. **`Notifier` (Phase 4)** — Hermes-owned operator sink.
7. **`TrustStateStore` (Phase 3)** — Hermes-owned persistence for trust records.

### Integration notes
- The **gateway remains execution-only**. After `guard.guard()` returns DENY with a `violationClass`, the gateway returns `deny(...)`; the *side-effect* (quarantine/revoke) is fired by the guard through the now-wired `GuardHooks` → `RevocationEngine`. The gateway does not itself mutate trust state (keeps the boundary single and clean).
- `UniversalCapabilityPlatform` constructor gains `RevocationEngine` wiring: `this.runtimeGuard.setHooks(this.revocationEngine.hooks)`.
- `TrustLifecycle.admit` gains real `VALIDATE` (verifiers) and `AUTHENTICATED` (authenticator) gates between the existing steps.
- `MarketplaceSecurityView` is unaffected behaviorally; it already consumes trust records. `ProviderMarketplace.toEntry` only needs the two new states reflected.
- **Provider-neutrality preserved:** every new interface operates on manifest/trust/transport *data*; no vendor string branch is introduced. Verifiers/authenticators are selected by *type* (`algorithm`, `authModel`), not by provider identity.

---

## Phase 6 — Implementation Plan

> Ordered roadmap. Each milestone is independently testable, reversible (additive / feature-flagged), and non-breaking to the existing provider-neutral architecture.
> Full milestone detail (tests, rollback, acceptance) is in `docs/operations/EPIC-005.7_IMPLEMENTATION_PLAN.md`.

| # | Milestone | Closes | Testable in isolation | Reversible |
|---|---|---|---|---|
| M1 | Persistent trust state: add `QUARANTINED`/`REVOKED`; `quarantine()`/`revoke()`/`reinstate()`; transition audit + persistence | G-4 (base) | ✅ state-machine unit tests | ✅ additive enum |
| M2 | `ChecksumVerifier` + canonicalization; replace `verifyChecksum` stub; verify all tiers | G-1 | ✅ real sha256 unit tests | ✅ swap impl |
| M3 | `SignatureVerifier` + `SignerRegistry`; wire `enforceSignatures`/`trustedSigners` default-on w/ first-party signer | G-1, G-2 | ✅ signed/unsigned manifest tests | ✅ config flag |
| M4 | `Authenticator` + registry + real `AUTHENTICATED` gate for token/oauth/mtls/ssh/api-key | G-3 | ✅ per-mode positive/negative | ✅ additive |
| M5 | `RevocationEngine` + wire `setHooks` in platform; quarantine/revoke → marketplace → notify → audit | G-4 | ✅ simulate HIGH/MED violation → REVOKED | ✅ additive |
| M6 | End-to-end integration tests: gateway→guard→lifecycle→marketplace; provider-neutrality regression | all | ✅ e2e suites | ✅ tests only |
| M7 | Fail-closed defaults hardening, docs, staged rollout | all | ✅ config-matrix tests | ✅ config |

**Ordering rationale:** M1–M2 establish the state + integrity substrate; M3 adds provenance; M4 adds auth; M5 connects violations to persistent containment; M6 proves the chain; M7 hardens defaults so the system fails closed by default in production.

---

## STOP CONDITION
Architecture & plan only. No source modified, no secrets created, no Cloudflare/AGS changes, no feature implemented, no commit, no deploy. Two deliverables written:
- `docs/architecture/EPIC-005.7_TRUST_ENFORCEMENT_ARCHITECTURE.md` (this file)
- `docs/operations/EPIC-005.7_IMPLEMENTATION_PLAN.md`
