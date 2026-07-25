# Hermes Foundation v1.0 — Final Acceptance (EPIC-005.10A)

**Re-Audit Type:** Independent, READ-ONLY verification
**Date:** 2026-07-21
**Scope:** EPIC-005.5 → EPIC-005.9 (full Foundation trust chain)
**Architecture Status:** FROZEN (Class B, single execution boundary)
**Method:** Direct source inspection of the implementation under audit. No code, config, or dependencies were modified. No tests were executed (see Audit 9 limitation).

---

## 1. Executive Summary

EPIC-005.7A closed the two remaining acceptance findings (F-1: AUTHENTICATED
was treated as runtime-eligible; F-2: an unauthenticated trust-webhook ingress
could mutate provider trust state). The Foundation now presents a single,
fail-closed execution boundary (`HermesExecutionGateway`) through which **both**
Stack A (system-internal) and Stack B (capability) executions route — passing
the tenant → policy → approval → runtime-guard gates in strict order. There is
no observable bypass path: no direct `provider.execute`, no `skipGuard`, no
alternate execution channel that omits any gate.

Approval is enforced exclusively through the structured `ApprovalRef` model
(EPIC-005.9 P1) — the legacy string-token path is gone. The trust lifecycle
explicitly lists `AUTHENTICATED` (and all pre-active/negative states) as
**non-runtime** and denies them at the guard. Cryptographic integrity uses real
ed25519 signature verification and real SHA-256 checksums, fail-closed. The
trust webhook is protected by HMAC-SHA256 + timestamp freshness + nonce replay
protection and is the *only* verified external ingress for trust-state mutation.
Audit and trust state are both durable and tenant-scoped.

**One environment-level limitation:** the project's `node_modules` is not
installed in this working tree, so the EPIC test suites and a full `tsc`
typecheck could **not** be executed. Static inspection found no code defects;
the only toolchain errors observed were missing `@types/node` globals
(`crypto`, `Buffer`, `BufferEncoding`), which are dependency artifacts, not
implementation bugs.

---

## 2. Final Verdict

### **CONDITIONAL GO**

The Foundation is architecturally and security-complete and is ready to move
beyond hardening **once the CI validation gate is confirmed green in a properly
provisioned environment** (node_modules installed, `tsc` clean, EPIC suites
pass). The conditional is purely an environment/validation gap, not a found
defect in the implementation under audit.

---

## 3. Scores

| Dimension | Score | Basis |
|---|---|---|
| **Architecture** | 9.5 / 10 | Single fail-closed execution boundary; clean provider-neutrality seam; gates enforced in strict order; no bypass found. |
| **Security** | 9.5 / 10 | Structured approval only; AUTHENTICATED denied at runtime; real crypto (ed25519 + SHA-256) fail-closed; webhook fully authenticated + replay-protected; tenant wall enforced. |
| **Production Readiness** | 8.0 / 10 | Durable audit + trust persistence present and tenant-scoped; restart-safety implemented. Docked for: (a) unverified CI gate in this tree, (b) default audit store is in-memory unless `configureFileAuditStore` is wired at prod startup, and (c) `MemoryReplayCache` is single-instance (documented multi-region gap). |

---

## 4. Closed Findings

### F-1 — AUTHENTICATED treated as runtime-eligible  ✅ CLOSED
`ProviderRuntimeGuard` (`services/providers/runtime/guard.ts`) defines an
explicit `NON_RUNTIME_STATES` set that includes `AUTHENTICATED` and documents it
as "proof-of-identity, NOT runtime readiness." `RUNTIME_ACTIVE_STATES` permits
only `ACTIVE | LOADED | RUNNING`. Check 1 (trust-state) denies any state outside
that set. No `return true` / unconditional AUTHENTICATED→eligible transition
exists.

### F-2 — Unauthenticated trust-webhook ingress  ✅ CLOSED
`TrustWebhookAuthHandler.authenticate()` (`services/providers/trust/webhooks/handler.ts`)
is the single verified ingress. It calls `verifyTrustWebhookAuthenticity()`
(HMAC-SHA256 over `timestamp ‖ body`, constant-time compare, freshness window,
nonce replay cache) **before** parsing/validating the command. Any failure
throws `AuthError` and emits a DENY audit — the body is never returned for use.
`TrustLifecycle.authenticateWebhook()` delegates to it; this is the only external
path that yields `VerifiedTrustCommand`.

### EPIC-005.8 findings (cryptographic trust)  ✅ CLOSED
- `RealChecksumVerifier` (`checksum/checksum-verifier.ts`): real `crypto.createHash('sha256')`; missing or mismatched checksum → `ok:false`. No placeholder.
- `RealSignatureVerifier` (`signature/verifier.ts`): real `cryptoVerify` (ed25519) over the canonical manifest body; detached-signature required unless explicitly `allowChecksumOnly`; fail-closed on missing/expired/unknown signer.
- No `return true` / `always allow` / placeholder in crypto modules. (The `return true` at `verifier.ts:195` is the key-`isKeyActive` helper — correct positive path, not a bypass.)

### EPIC-005.9 findings (operational trust hardening)  ✅ CLOSED
- **P1 (Stack B approval):** `executeCapability` now enforces the same structured `ApprovalRef` model; no bare string token; routes through `stackBGateway` (the governed gateway).
- **P2 (durable audit):** `FileAuditBackend` (JSON-lines, append-only, corrupt-line tolerant) + `configureFileAuditStore` swapped in at startup; tenant-scoped reads via `queryScoped` with `enforceTenant`.
- **P3 (durable trust state):** `FileTrustStateStore` persists QUARANTINED/REVOKED across restarts (provider-neutral `FileStateFs` seam).
- **P4 (AUTHENTICATED NON_RUNTIME):** covered by F-1 above.

---

## 5. Remaining Risks

| # | Risk | Severity | Note |
|---|---|---|---|
| R-1 | **Unverified CI gate in this tree** | Medium | `node_modules` absent; EPIC suites + full `tsc` not executed here. Static review clean; must be confirmed green in a provisioned pipeline. |
| R-2 | **Default audit store is in-memory** | Low | `defaultAuditStore` falls back to `MemoryAuditStore` unless `configureFileAuditStore` is called at prod startup (env-gated, deferred init). Production wiring must be verified at deploy. |
| R-3 | **Single-instance replay cache** | Low | `MemoryReplayCache` is per-isolate; multi-region deployments need a distributed store (interface already abstracted). Documented in code. |
| R-4 | **Fail-open on trust-state read corruption** | Low | `FileTrustStateStore.readAll()` returns empty on corrupt file; admission re-validates on next sweep and re-applies containment. Acceptable by design, but a corrupt file silently loses persisted QUARANTINED/REVOKED until next sweep. |
| R-5 | **`allowChecksumOnly` escape hatch** | Low | `RealSignatureVerifier` permits checksum-only authenticity when explicitly opted in. Acceptable (explicit, not default), but must never be enabled in prod without policy sign-off. |
| R-6 | **Tenant passthrough on Stack A** | Informational | Stack A uses `tenantId: providerId` (system-internal, no end-user tenant). The gateway gates still run; cross-tenant user access is not representable here by design. |

---

## 6. Evidence

### Key files inspected (direct source reads)
| Audit | File |
|---|---|
| 1 Execution boundary | `services/execution/gateway/hermes-execution-gateway.ts`, `services/providers/platform.ts` (Stack A `execute`, lines 185–259), `services/activation/provider-framework.ts` (`executeCapability`, lines 486–596) |
| 2 Approval | `services/execution/gateway/approval.ts`, `services/execution/gateway/hermes-execution-gateway.ts` (verifyApprovalRef) |
| 3 Lifecycle | `services/providers/trust/lifecycle.ts`, `services/providers/runtime/guard.ts` (`RUNTIME_ACTIVE_STATES` / `NON_RUNTIME_STATES`) |
| 4 Crypto | `services/providers/trust/checksum/checksum-verifier.ts`, `services/providers/trust/signature/verifier.ts` |
| 5 Webhook | `services/providers/trust/webhooks/verify.ts`, `services/providers/trust/webhooks/handler.ts`, `services/providers/trust/lifecycle.ts` (authenticateWebhook) |
| 6 Persistence | `audit/store.ts`, `audit/store.durable.ts`, `services/providers/trust/persistence/trust-state-store.ts` |
| 7 Neutrality | `services/providers/runtime/guard.ts` (header), `services/providers/platform.ts` (comment), grep of core for vendor branches |
| 8 Multi-tenancy | `persistence/tenant.ts`, `audit/store.ts` + `store.durable.ts` (`queryScoped`), `services/providers/runtime/guard.ts` (`checkTenantScope`) |
| 9 Validation | `tsconfig.epic005.json`, `vitest.config.js`, EPIC test files (inventory below) |

### Bypass / sentinel search results (Audit 1 & 4)
- `provider.execute` — only invoked as the **gateway's** executor callback (`provider.execute(r)` in `platform.ts:242` and `p.executor!(...)` inside the `stackBGateway` callback). No direct external caller.
- `executeCapability` — present in `provider-framework.ts` but routes through `stackBGateway.execute(...)` (governed). Comment "may bypass the guard" is stale/misleading; the code routes through the gateway.
- `dispatch`, `run(`, `bypass`, `skipGuard` — **no matches** that bypass the boundary.
- `return true` / `placeholder` / `always allow` — only legitimate positives (key-active helper; AUTHENTICATED no-op placeholder for token plumbing owned by trust). No unconditional allow in crypto or auth.

### EPIC test inventory (present, not executed)
| Suite | Path | Lines |
|---|---|---|
| EPIC-005.1 | `services/providers/__tests__/epic-005.1.test.ts` | 238 |
| EPIC-005.3 | `services/providers/__tests__/epic-005.3.test.ts` | 242 |
| EPIC-005.5 | `services/providers/__tests__/epic-005.5.test.ts` | 324 |
| EPIC-005.6 | `services/execution/gateway/__tests__/epic-005.6.test.ts` | 458 |
| EPIC-005.7A | `services/providers/__tests__/epic-005.7a.test.ts` | 82 |
| EPIC-005.8 | `services/providers/__tests__/epic-005.8.test.ts` | 183 |
| EPIC-005.9 | `services/providers/__tests__/epic-005.9.test.ts` | 273 |
| EPIC-005.7A webhook | `services/providers/trust/webhooks/__tests__/epic-005.7a-webhook.test.ts` | 88 |
| EPIC-004.6 | `services/execution/epic-004.6.test.ts` | 252 |

### Validation results
- **Typecheck:** Not executed (no `node_modules`). A best-effort `tsc -p tsconfig.epic005.json` produced only `Cannot find name 'crypto' | 'Buffer' | 'BufferEncoding'` — missing `@types/node` globals. These are dependency/toolchain artifacts, **not** code defects. **Limitation — see R-1.**
- **EPIC suites:** Not executed (vitest binary absent; install prohibited by audit rules). **Limitation — see R-1.**

---

## 7. Recommendation — Foundation v1.0 Status

**Hermes Foundation v1.0 is accepted as architecturally and security-complete.**
It may proceed into the **expansion phase** contingent on one gate:

> **Exit condition:** Run `npm ci && npm test` (or the project's CI) in a
> provisioned environment. Confirm `tsc` is clean across the corpus and all
> EPIC-005.1 / 005.3 / 005.5 / 005.6 / 005.7A / 005.8 / 005.9 suites pass.
> Verify production startup wires `configureFileAuditStore` (R-2) and a
> distributed replay cache if multi-region (R-3).

The implementation under audit contains **no blocking defects**. The CONDITIONAL
GO is solely the unexecuted validation gate in this working tree.

### Recommended next EPIC
- **Phase:** Expansion (post-hardening).
- **Suggested focus:** Provider ecosystem breadth (additional vendor plugins
  behind the frozen, provider-neutral boundary) and multi-region audit/replay
  durability (R-3) — neither requires re-opening the FROZEN Foundation trust
  architecture.

---

*Audit performed under READ-ONLY constraints. No source, config, dependencies,
or working tree were modified. No commits, stages, or deploys were made.*
