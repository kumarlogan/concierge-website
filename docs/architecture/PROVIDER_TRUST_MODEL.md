# EPIC-005 — Provider Trust Model

**Phase:** 4 — Provider lifecycle, integrity, isolation, audit
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Principle

> Providers own only execution. **Hermes owns trust.**
> A provider is untrusted until it proves its integrity, declares its permissions, and accepts its sandbox.

The Baseline Review (TB3) showed the current `knownProviders()` is a bare allow-list with **no provenance**. This phase defines the trust lifecycle that turns a raw provider id into a verified, sandboxed, audited execution backend.

---

## 2. Provider Lifecycle States

```
        ┌─────────────┐
        │ DISCOVERED  │  manifest found (file / registry)
        └──────┬──────┘
               │ validate (schema + signature)
               ▼
        ┌─────────────┐
        │ VALIDATED   │  checksum + signature verified
        └──────┬──────┘
               │ authorize (trust level + permission grants vs policy)
               ▼
        ┌─────────────┐
        │ AUTHORIZED  │  trust decision recorded (fail-closed if denied)
        └──────┬──────┘
               │ authenticate (token/oauth/mtls/ssh)
               ▼
        ┌─────────────┐
        │ AUTHENTICATED│
        └──────┬──────┘
               │ load (Loader maps implKeys → live impls)
               ▼
        ┌─────────────┐
        │ LOADED      │  capabilities registered; NOT yet active
        └──────┬──────┘
       ┌───────┴────────┐
       ▼                ▼
 ┌──────────┐    ┌──────────┐
 │ ACTIVE   │    │ SUSPENDED│  (operator or policy)
 └────┬─────┘    └────┬─────┘
      │                │
      │ resume         │ unload
      ▼                ▼
 ┌──────────┐    ┌──────────┐
 │ RUNNING  │───▶│ UNLOADED │
 └──────────┘    └──────────┘
      │
      │ reject (any integrity/policy failure)
      ▼
 ┌──────────┐
 │ REJECTED │  (terminal; requires re-validation to re-enter)
 └──────────┘
```

Any transition may move to **REJECTED** if integrity or policy fails. Rejected is terminal until re-discovery + re-validation.

---

## 3. Integrity: Signature Verification & Checksums

Every provider manifest carrying `trust.level >= trusted` MUST include a detached signature:

```
manifest.yaml  ──sha512──▶  checksum
                                │
                     signer private key
                                ▼
                          manifest.sig (ed25519 / cosign)
```

Verification steps (Hermes-owned, provider-blind):
1. Compute `sha512(manifest)` → compare to `manifest.trust.signature.checksum`.
2. Verify `manifest.sig` against the **trusted signer public key** (pinned in Hermes config, never in the provider).
3. Confirm `signer` ∈ `TRUSTED_SIGNERS`.
4. On mismatch → transition to **REJECTED**, emit `provider.rejected` audit (category `denied:signature`).

No provider may self-attest. Signer keys live in Hermes, not the manifest.

---

## 4. Permission Declarations

The manifest's `permissions[]` array declares what the provider *asks* for. Hermes decides what it *gets*:

| Manifest grant | Hermes decision |
|----------------|-----------------|
| `grantedBy: "manifest"` | Auto-denied unless policy explicitly allows (fail-closed) |
| `grantedBy: "operator"` | Requires human operator affirmation at load time |
| `grantedBy: "runtime"` | Resolved per-invocation against the policy evaluator |

The policy evaluator (already the single decision point) consumes these at execution time. A provider requesting `scope: "repo:write"` for `git.push` is checked against the caller's principal + tenant + approval state — exactly as today.

---

## 5. Sandbox Boundaries

Derived from `manifest.trust.sandboxPolicy` + `trust.level`:

| Trust level | Default isolation | Network | Filesystem |
|-------------|-------------------|---------|------------|
| `untrusted` | `vm` | `none` | `ephemeral` |
| `sandbox` | `container` | `egress-only` | `ro` (or `ephemeral`) |
| `trusted` | `container` | `full` (if declared) | `rw` (scoped) |
| `privileged` | `none` (host) | `full` | `rw` — operator-affirmed only |

Hermes **enforces** these at the transport/process boundary — the provider cannot relax them. A `cli` transport spawning a binary applies the sandbox before `exec`.

---

## 6. Failure Isolation

| Failure | Behavior |
|---------|----------|
| Provider crash / OOM | Transport reports failure; coordinator retries per orchestration config; provider moves to `SUSPENDED` after N consecutive failures |
| Provider hangs | Transport `timeoutMs` fires → coordinator fails-closed; lease released |
| Signature rot / key revoke | Immediate `REJECTED` + audit |
| Health probe fails | Marketplace marks `unhealthy`; Selection Engine deprioritizes/excludes |
| Permission escape attempt | Policy evaluator DENIES; audit `denied:permission`; provider `SUSPENDED` |

A failing provider **never** takes down Hermes core — isolation is structural (separate process/transport), not cooperative.

---

## 7. Audit Hooks

Every lifecycle transition emits an audit event (reusing `emitAudit`):

| Transition | Audit type | Category |
|------------|-----------|----------|
| discovered | `provider.discovered` | `provider.lifecycle` |
| validated (ok/fail) | `provider.validated` | `allow` / `denied:signature` |
| authorized | `provider.authorized` | `allow` / `denied:policy` |
| authenticated | `provider.authenticated` | `allow` / `denied:auth` |
| loaded | `provider.loaded` | `provider.lifecycle` |
| active / suspended / resumed | `provider.state` | `provider.lifecycle` |
| rejected | `provider.rejected` | `denied:*` |
| unloaded | `provider.unloaded` | `provider.lifecycle` |

All carry `providerId`, `vendor`, `trustLevel`, `signer` in `detail`. This makes the trust lifecycle fully auditable and reversible (operator can `UNLOAD` / `REJECT` at any time).

---

## 8. Rules

- Trust is **Hermes-owned**: signer keys, trust tiers, and sandbox policy live in Hermes config.
- A provider is **untrusted by default**; it must ascend the lifecycle to execute.
- Any integrity or policy failure → **REJECTED** (fail-closed), never silently降级.
- Sandbox limits are **enforced by Hermes**, not declared-and-forgotten.
- Every transition is audited; the lifecycle is fully reversible by an operator.
- No provider-specific trust code in core — trust is driven entirely by manifest data + Hermes config.
