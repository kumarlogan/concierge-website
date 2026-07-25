# Hermes Foundation v1.0 — EPIC-005.9 Operational Trust Hardening · Baseline

**Date:** 2026-07-21
**Author:** Hermes Agent (autonomous, under freeze-classification B)
**Depends on:** EPIC-005.8A execution-integrity review + EPIC-005.8A security & trust assessment
**Freeze status:** Hermes Platform Foundation v1.0 architecture is FROZEN (Classification B, approved 2026-07-21). This epic is **implementation-only hardening** — no redesign of any frozen component. Every change must preserve provider neutrality, the single execution boundary, and fail-closed behavior.

---

## 0. Purpose

EPIC-005.8A confirmed the *architecture* is sound (single `HermesExecutionGateway`, provider-neutral, fail-closed gates, tenant isolation) but flagged **2 CRITICAL + 2 HIGH** *durability / control* gaps that the passing test corpus does not exercise. EPIC-005.9 closes those four gaps. It does **not** alter the frozen interfaces, the execution-boundary shape, or the trust-lifecycle state machine.

The four gaps (verbatim severities from `docs/architecture/review/EPIC-005.8A-security-trust-assessment.md`):

| ID | Severity | File(s) | Gap |
|----|----------|---------|-----|
| CRITICAL-1 | CRITICAL | `services/security/security-agent.ts:159`, `services/activation/provider-framework.ts:419-488` | Stack B approval control is a non-empty-string presence check; the gateway's real approval gate is disabled on Stack B. |
| CRITICAL-2 | CRITICAL | `hermes/audit/store.ts` (whole file) | Audit trail is in-memory only; no durable store behind `defaultAuditStore`. Lost on every restart. |
| HIGH-1 | HIGH | `services/providers/manager.ts:69` | `enforceSignatures: false` by default → unsigned providers admitted. |
| HIGH-2 | HIGH | `services/providers/trust/persistence/trust-state-store.ts` | Trust state (incl. REVOKED/QUARANTINED) is in-memory only; reset on restart. |

MEDIUM-1 (within-tenant default-allow) and MEDIUM-2 (non-expiring keys) are **documentation/policy notes**, not code changes in scope.

---

## 1. Source of truth (what I actually verified)

I read the following files directly (line numbers cited are from the current tree):

**Frozen core (MUST NOT be redesigned):**
- `hermes/services/execution/gateway/hermes-execution-gateway.ts` — the single boundary (tenant → policy → approval → guard → executor).
- `hermes/services/execution/gateway/approval.ts` — `ApprovalService` interface; `verify()` is fail-closed (throws on missing/ghost/expired/mismatched approval).
- `hermes/services/providers/platform.ts` — Stack A (`UniversalCapabilityPlatform`). Routes every execution through `this.gateway.execute(...)`.
- `hermes/services/activation/provider-framework.ts` — Stack B (`executeCapability` + `stackBGateway`).
- `hermes/services/providers/trust/lifecycle.ts` — `TrustLifecycle` state machine (writes go to `stateStore`).
- `hermes/services/providers/trust/persistence/trust-state-store.ts` — `TrustStateStore` interface + `InMemoryTrustStateStore` (Map).
- `hermes/services/providers/manager.ts:69` — default trust config `{ trustedSigners: [], enforceSignatures: false, authorize }`.
- `hermes/services/security/security-agent.ts:159` — hardcoded `approvalToken: req.approvalRequirement.required ? "human-token" : undefined`.
- `shared/interfaces/audit.ts` — canonical `AuditEvent` / `AuditStore` / `AuditQuery`.
- `hermes/audit/store.ts` — `MemoryAuditStore` + `defaultAuditStore` (in-memory; the ACTIVE persistence boundary).
- `hermes/audit/event.ts` — emits through `defaultAuditStore` (imported from `./store.js`).
- `hermes/audit/store.durable.ts` — `AuditPersistenceBackend` + `DurableAuditStore` seam (generic over a backend). **Exists but NOT wired into the emit path.**
- `hermes/services/execution/execution-coordinator.ts` — durable execution lifecycle (reference for how real approval verification is done; Stack B should mirror this shape).
- `hermes/services/providers/trust/signature/verifier.ts` — real ed25519 + checksum verification (gates fire only when `enforceSignatures` is true).

**Assessment docs (authoritative on severity + fix direction):**
- `docs/architecture/review/EPIC-005.8A-security-trust-assessment.md`
- `docs/architecture/review/EPIC-005.8A-execution-integrity-review.md`
- `docs/architecture/review/EPIC-005.8A-verification-report.md`

---

## 2. Component inventory — what exists vs. what is durable

### 2.1 Execution boundary (frozen, correct)
- `HermesExecutionGateway` — single instance per stack. Gate order: `tenant (401) → policy (402) → approval (403) → runtime-guard (404) → executor`. Every gate returns `{ok:false}` and **no executor runs** on any deny (proven: 005.6 asserts `calls.length === 0` on 9 deny paths).
- No `skipGuard`/`bypass`/`forceExecute`/`disableGuard` toggle exists anywhere (`grep` in 005.8A returned 0 matches). **Invariant to preserve.**

### 2.2 Stack A vs Stack B — the actual difference (CORRECTED)

| Aspect | Stack A (`platform.ts`) | Stack B (`provider-framework.ts`) |
|--------|--------------------------|------------------------------------|
| Entry | `UniversalCapabilityPlatform.execute()` | `executeCapability()` |
| Gateway instance | `this.gateway` (constructed in ctor) | `stackBGateway` (module-singleton, line 385) |
| Tenant / policy / guard gates | ✅ run | ✅ run (policy via `stackBCapabilityRegistry`, guard via `StackBGatewayGuard` = active+enabled+healthy+cross-tenant) |
| **Approval gate** | Provider-neutral `failClosedApprovals()` that **throws** `verify()` — but Stack A sets `approvalRequired:false` + `lifecycleState:"approved"`, so it is never exercised | `failClosedApprovals()` that **throws** `verify()` + `approvalRequired:false` + `lifecycleState:"approved"` → gateway approval **never runs** |
| Approval enforcement that DOES exist | none (system-internal) | **separate upstream token check** at `provider-framework.ts:440`: `if (needsApproval && !ctx.approvalToken) refuse` — a non-empty-string presence check |
| Token source | n/a | `security-agent.ts:159` manufactures literal `"human-token"` when `req.approvalRequirement.required` |
| **Verified against durable store?** | n/a | **No.** The `"human-token"` literal is never checked against an `ApprovalService`/`ApprovalRef`. Any non-empty string passes. |

**Why the current tests pass but the gap is real:** `epic-005.6.test.ts` proves the *gateway's* approval gate works (ghost approver / missing record / expiry / capability mismatch all DENY). But Stack B sets `approvalRequired:false`, so that gate is bypassed, and the only thing standing in its place is the `!ctx.approvalToken` presence check — which the literal `"human-token"` always satisfies. **CRITICAL-1 = Stack B routes *around* the gateway approval gate.**

### 2.3 Audit persistence (CRITICAL-2)
- `hermes/audit/store.ts` → `MemoryAuditStore` + `defaultAuditStore`. **In-memory array.** The active emit path (`event.ts:9,31`) imports `defaultAuditStore` from `./store.js`.
- `hermes/audit/store.durable.ts` defines `AuditPersistenceBackend` (provider-neutral: `append`/`query`/`clear`), `createDurableAuditStore(backend)`, `MemoryAuditBackend`, and `createMemoryDurableAuditStore()`. It is a **correct seam** but is **not referenced by `event.ts` or `store.ts`** — confirmed by search: the only importers of `store.durable` are `persistence/provider.ts`.
- Read-side tenant isolation (`queryScoped`) is sound in BOTH stores (fail-closed `enforceTenant`). Only **write durability** is missing.
- **Fix direction:** build a file-backed `AuditPersistenceBackend` (JSON-lines append) and wire `defaultAuditStore` to a `DurableAuditStore` over it in production; keep `MemoryAuditStore` for tests/dev. Optionally keep the optional sink seam.

### 2.4 Trust persistence (HIGH-2)
- `TrustStateStore` interface: `load` / `save` / `delete` / `list` / `close?`.
- Only implementation: `InMemoryTrustStateStore` (Map). `lifecycle.ts` calls `this.stateStore.save(record)` on every transition + on `quarantine`/`revoke`/`reject`/`set`, but the in-memory store does not persist. After restart, a REVOKED/QUARANTINED provider can be re-admitted by discovery (icebox reset).
- `lifecycle.reinstate()` already reads from `stateStore.load()` — so a durable store immediately makes revocation/quarantine **sticky across restart** with no logic change.
- **Fix direction:** build a file-backed `TrustStateStore` (JSON or JSON-lines keyed by providerId) and default the platform manager to use it (behind `enablePersistence` which already exists in `TrustConfig`).

### 2.5 Signature enforcement (HIGH-1)
- `manager.ts:69`: `{ trustedSigners: [], enforceSignatures: false, authorize }`.
- `lifecycle.admit()` (line 145): signature + checksum + ed25519 verification only runs `if (this.config.enforceSignatures && m.trust.level !== "untrusted")`. With the default `false`, **unsigned providers are admitted**. `epic-005.1` SCENARIO 10 proves enforcement works *when enabled*.
- **Fix direction:** default `enforceSignatures: true` in production config (keep `false` for dev/test where tests inject unsigned fixtures). Empty `trustedSigners` must remain a hard DENY when enabled (so enabling without configuration fails closed, not open). **No fail-open.**

### 2.6 Provider neutrality — CONFIRMED ✅
Vendor-keyword scan in 005.8A: 13 hits, all confined to `services/providers/claude-code/` (manifest/index/factory + fixtures). `provider-framework.ts`, `platform.ts`, `hermes-execution-gateway.ts`, `policy-evaluator.ts`, `guard.ts` import **no** vendor SDK. The `CapabilityExecutor` port is the only extension point. **This invariant is non-negotiable and must survive EPIC-005.9.**

---

## 3. Architecture invariants that MUST be preserved

1. **Exactly one execution boundary** = `HermesExecutionGateway`. No new bypass toggle. (No `skipGuard`/`bypass`/`forceExecute`/`disableGuard`/`ignoreGuard`/`noCheck` — grep stays 0.)
2. **Provider neutrality.** No Claude/OpenAI/Anthropic branch in core. Stack B continues to express its trust model via the `guard` slot (`StackBGatewayGuard`), never by importing a vendor SDK.
3. **Fail-closed on every gate** (tenant, policy, approval, runtime-guard). Deny ⇒ no executor runs. Stack B's real approval must go through the SAME `ApprovalService` the gateway uses (or an equivalent verifiable `ApprovalRef`), not a string literal.
4. **Frozen interfaces unchanged:** `ApprovalService`, `AuditStore`, `AuditEvent`, `TrustStateStore`, `TrustRecord`, `TrustLifecycle` public surface. New durable implementations sit *behind* these interfaces.
5. **Existing tests stay green.** EPIC-005.1/3/5/6/8 plus `dynamic.test.ts` and `epic-004.6.test.ts` must continue to pass. Where a test injects an unsigned provider, it must set `enforceSignatures:false` explicitly (the test harness already supports per-config overrides via `withTrustConfig`).

---

## 4. Implementation plan (8 phases)

> Guardrails: no commits / no deploys / no secret changes (per standing EPIC workflow). Output is code + docs; the user approves before any push.

- **P0 — Baseline (this doc).** ✅ in progress.
- **P1 — Stack B approval enforcement (CRITICAL-1).** Route Stack B through a real `ApprovalService`. Remove the `"human-token"` literal from `security-agent.ts:159`; require a verifiable `ApprovalRef` (or reuse the coordinator's approval verification pattern). Set `approvalRequired` truthfully based on `cap.requiresApproval`/`requiresApprovalIn`. `stackBGateway.approvals` must be the real service (not the throwing stub). Add Stack B rejection matrix to tests.
- **P2 — Durable AuditStore (CRITICAL-2).** Add `FileAuditBackend` (append-only JSON-lines) implementing `AuditPersistenceBackend`; wire `defaultAuditStore` to `createDurableAuditStore(new FileAuditBackend(path))` in production (env-gated; keep `MemoryAuditStore` default when no path). Keep `queryScoped` tenant isolation intact.
- **P3 — Durable TrustStateStore (HIGH-2).** Add `FileTrustStateStore` (JSON keyed by providerId, atomic write). Default `DynamicProviderManager` to construct it and pass into `TrustLifecycle` with `enablePersistence:true`. `reinstate()` already works once the store is durable.
- **P4 — Signature enforcement hardening (HIGH-1).** Production trust config defaults to `enforceSignatures:true` with empty `trustedSigners` ⇒ hard DENY (never silently admit). Dev/test path keeps `false`. No fail-open.
- **P5 — Regression tests.** (a) Stack B rejection matrix: missing ApprovalRef, ghost approver, expired, capability mismatch all DENY; (b) audit restart: events survive a store re-init; (c) revocation restart: REVOKED provider stays REVOKED after `reinstate()`-free restart; (d) quarantine restart; (e) both stacks exercise the real `ApprovalService`.
- **P6 — Validation.** `tsc --noEmit` (workers workspace). Run corpus: `epic-005.1/3/5/6/8.test.ts`, `dynamic.test.ts`, `epic-004.6.test.ts`, plus new `epic-005.9.test.ts`. Secret scan (`grep -rn` for tokens). Keyword grep for bypass toggles (must remain 0).
- **P7 — Acceptance docs.** `EPIC-005.9_VALIDATION_REPORT.md` (evidence per gap) + `EPIC-005.9_COMPLETION_REPORT.md` (exec summary + suggested commit grouping, no auto-commit).

---

## 5. How the test corpus is run (for P6)

- Tests live in `hermes/services/**/__tests__/*.test.ts` and `hermes/services/execution/epic-004.6.test.ts`.
- The `hermes/` package has **no own `node_modules`**; the corpus is executed with `vitest@4` from the `workers/` workspace (per 005.8A verification note). Command to confirm in P6: run vitest against the `hermes/` test globs from `workers/` and capture the pass/fail matrix. (Exact invocation to be re-confirmed at P6 — do not assume; verify it actually resolves `hermes/` imports.)

---

## 6. Explicitly OUT of scope (frozen)

- No change to `HermesExecutionGateway` gate order or shape.
- No change to `ApprovalService` / `AuditStore` / `TrustStateStore` *interface* contracts.
- No provider-specific code in core (neutrality preserved).
- No redesign of the trust-state machine states (DISCOVERED→…→REVOKED). New states are NOT added.
- MEDIUM-1 / MEDIUM-2 are doc/policy notes only, not code in this epic.
- No Cloudflare/Worker deploy, no git commit, no secret rotation (per standing EPIC rules — output only, user decides publish).

---

## 7. Blockers / risks

- **None blocking.** All four gaps have a clear, in-tree fix direction and existing seams (`store.durable.ts`, `TrustStateStore` interface, `reinstate()`) that minimize risk.
- **Risk:** P2/P3 file I/O must be non-blocking / best-effort to honor the `AuditStore` contract ("log, don't leak" — a store failure MUST NOT break the emitting request). Mitigation: wrap backend writes in try/catch; never `await` in the emit hot path; fail-closed only on *read*/verification, fail-open (drop) on *write* error.
- **Risk:** Enabling `enforceSignatures:true` by default could break existing dev/test providers. Mitigation: tests that need unsigned providers set `enforceSignatures:false` via `withTrustConfig`; production config opts in explicitly.
- **Risk:** Stack B approval routing could regress the happy path if `ApprovalRef` plumbing is wrong. Mitigation: P5 rejection matrix + the existing 005.6 deny assertions; keep `approvalRequired` derived from capability metadata exactly as today's token gate did.
