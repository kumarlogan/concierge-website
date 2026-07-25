# EPIC-005.6 — Provider Trust Hardening (PHASE 5)

**Requirement:** Replace placeholder trust assumptions with real signature verification and
defined provider authentication enforcement (OAuth / mTLS / SSH / local).

---

## 1. Signature Verification (fixes Bypass #9)

Today `trust/lifecycle.ts:174` `verifyChecksum` is `return true` (placeholder). The manifest
`trust.signature` is checked for *presence* + *signer membership* only (`lifecycle.ts:105-113`).
A tampered manifest signed by a "trusted" signer id (no real crypto) passes.

### Target

```ts
// services/providers/trust/signature.ts  (DESIGN)
export interface SignatureVerifier {
  // Returns true iff checksum(manifest.body) is signed by `signer` and `signer` is trusted.
  verify(manifest: ProviderManifestV2): { ok: boolean; reason?: string };
}
```

- **Signer identity:** `manifest.trust.signature.signer` must be a key id in `trustedSigners`
  AND map to a known public key in a Hermes-owned keyring.
- **Checksum verification:** canonicalize the manifest body (excluding the signature field),
  hash it (SHA-256), and verify the signature over that hash using the signer's public key.
  `verifyChecksum` becomes a real verification, not `true`.
- **Trust chain:** support a small chain — manifest signed by vendor key, vendor key signed by
  Hermes root. Verification walks root → vendor → manifest; any broken link → REJECTED.
- **Revocation:** a revocation list (Hermes-owned, e.g. `revokedSigners: string[]` in
  `TrustConfig`) checked before acceptance. Revoked signer → REJECTED (fail-closed).

`enforceSignatures: true` becomes the **default for any `trust.level >= sandbox`** (already the
toggle at `lifecycle.ts:105`); the placeholder path is removed.

---

## 2. Provider Authentication (fixes Bypass #10)

Today `trust/lifecycle.ts:129-130` `AUTHENTICATED` is a **no-op**, and `transport/mcp.ts:105`
`secretRef` is never resolved — auth is "string presence" only.

### Defined enforcement matrix

| authModel | Enforcement at ADMIT | Enforcement at EXECUTE |
|-----------|----------------------|------------------------|
| `none` (local CLI, trusted) | allowed only if `trust.level === sandbox` AND host-local | n/a (process spawn, no auth) |
| `oauth` | verify token via Hermes-owned OAuth introspection endpoint; reject if expired/invalid | refresh/validate token per call |
| `mtls` | require client cert; verify against Hermes CA; reject unknown CN | per-call cert re-validation |
| `ssh` | verify host key + user key against Hermes-known keys | per-call key re-validation |
| `apikey` | resolve `secretRef` via Hermes secret manager (NOT a literal) | inject resolved secret at call |

`AUTHENTICATED` is no longer a no-op: it dispatches on `manifest.trust.authModel` and performs
the corresponding verification. Failure → REJECTED (fail-closed).

### Secret handling (no secret access in EPIC-005.6)

The gateway/trust layer references secrets **by reference** (`secretRef`) resolved through a
Hermes-owned secret manager abstraction. EPIC-005.6 does **not** read or rotate real secrets;
it only requires that `secretRef` resolution is *wired and fail-closed* (missing/unknown ref →
REJECTED). Actual secret material stays in the secret manager (out of scope per EPIC rules).

---

## 3. Hardening the Runtime Guard (already strong — preserve)

`ProviderRuntimeGuard` (EPIC-005.5) already enforces: transport allowlist, capability ownership,
provider-state (LOADED/ACTIVE), health gating, rate-limit, and signature presence. EPIC-005.6
preserves all of it and **extends** it to:
- require tenant-id on every request (step 2 of the gateway feeds `targetTenantId`),
- require a verifiable `ApprovalRef` when the capability requires approval (step 5).

The guard remains provider-neutral and Claude-neutral (no vendor branch).

---

## 4. Migration

1. Implement `SignatureVerifier` (real crypto) and wire into `TrustLifecycle.admit`
   (replace `verifyChecksum` at `lifecycle.ts:174`).
2. Implement the `AUTHENTICATED` dispatch matrix; remove the no-op at `lifecycle.ts:129-130`.
3. Resolve `secretRef` in `transport/mcp.ts:105` via the secret-manager abstraction (fail-closed).
4. Add `revokedSigners` to `TrustConfig`; check in `admit`.
5. Keep all fail-closed behavior; add revocation + chain checks without weakening existing gates.

*End of PHASE 5. Design only — no secrets accessed, no code changed.*
