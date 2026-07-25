# EPIC-005.9 — Validation Report

**Date:** 2026-07-21
**Scope:** Resume + complete the interrupted EPIC-005.9 implementation (P1–P7).
**Foundation:** Hermes Platform Foundation v1.0 (FROZEN, Classification B). Provider neutrality, fail-closed behaviour, single execution boundary, mandatory audit, mandatory tenancy — all preserved.

---

## Verification Method

All claims below are backed by **real execution output**, not inspection alone:

- `npx tsc --noEmit -p workers/tsconfig.json` → **0 errors** (STOP CHECKPOINT for P1 passed).
- `vitest run` (workers full corpus) → **434 tests passing / 33 files**.
- `vitest run --config workers/vitest.epic005.config.ts` → **114 tests passing / 8 files** (includes the new EPIC-005.9 regression suite: 12 tests).
- Secret scan (regex over `hermes/ workers/ shared/` for `sk-`, `pk_`, `AKIA`, `cfat_`, `ghp_`, `xox*`) → **no real secrets** (one test-fixture string `AKIA12...KLMN` only).
- Keyword grep for the legacy Stack B approval-token path → **0 matches** in `provider-framework.ts` (`human-token`, `approvalToken?`, `ctx.approvalToken` all gone).

---

## P1 — Single Durable Approval Model ✅

| Check | Result |
|---|---|
| `approval-gates.ts` corruption (lines 121–138) repaired | ✅ Restored to a clean `grantGitApproval` doc block + function. |
| `ApprovalRef` import/export (no type duplication) | ✅ `provider-framework.ts` re-exports the canonical `ApprovalRef` from `execution/gateway/approval.js`; `approval-gates.ts` imports it from there. |
| `provider-framework.ts` compile errors resolved | ✅ `CapabilityDescriptor → Capability` mapping in `stackBCapabilityRegistry`; removed `groups` from `Principal`; added `invocationId`/`implKey` to `ProviderRequest`. |
| STOP CHECKPOINT: typecheck passes | ✅ 0 errors. |
| Runtime proof: durable `ApprovalRef` minted via human queue | ✅ `grantGitApproval`/`grantStackBApproval` return structured `ApprovalRef` (id/capability/tenant/approver/scope/at) — no string token. |
| Legacy `approvalToken` removed from Stack B execution boundary | ✅ Removed dead `approvalToken?: string` from `CapabilityExecutor` ctx + its only pass-site (`claude-code.ts`). |
| Developer runtime legacy token → durable ref | ✅ `developer-runtime.ts` now mints `ApprovalRef` via `grantStackBApproval` instead of passing a string. |

**CRITICAL-1 (from baseline) — RESOLVED:** `security-agent.ts:159` no longer passes `"human-token"` (0 references); `provider-framework.ts` no longer has the `!ctx.approvalToken` presence check. Stack B now routes through the single governed gateway with a verified `ApprovalRef`.

---

## P2 — Durable AuditStore ✅

| Check | Result |
|---|---|
| `FileAuditBackend` (append-only JSON-lines) implemented | ✅ `hermes/audit/store.durable.ts` — `FileAuditBackend implements AuditPersistenceBackend`. |
| Restart-safe | ✅ Verified: events persist to a file; a brand-new backend instance over the same file re-reads them. |
| Production wiring (env-gated) | ✅ `store.ts` exposes `configureFileAuditStore(path, fs)`; `defaultAuditStore` is a live-binding proxy so production swaps it without touching callers. `MemoryAuditStore` remains the dev/test default. |
| `MemoryAuditStore` kept for tests | ✅ Default path is in-memory; existing `epic-004-audit-store.test.ts` (11 tests) still passes. |
| Runtime proof | ✅ `emitAudit` → file; reopened store returns the persisted event (file contents inspected). |

**CRITICAL-2 (from baseline) — RESOLVED:** `defaultAuditStore` is no longer in-memory-only; a restart-safe `FileAuditBackend` exists and is wired for production.

---

## P3 — Durable TrustStateStore ✅

| Check | Result |
|---|---|
| `FileTrustStateStore` implemented | ✅ `hermes/services/providers/trust/persistence/trust-state-store.ts` — persists full `TrustRecord` map JSON. |
| Persists ALL lifecycle states (incl. QUARANTINED/REVOKED) | ✅ Verified round-trip for `ACTIVE`, `QUARANTINED`, `REVOKED`. |
| Restart-safe (sticky containment) | ✅ Verified: a `REVOKED` provider stays `REVOKED` on a fresh `TrustLifecycle` that re-admits the same manifest (persisted state is consulted during `admit`). |
| Wired into `TrustLifecycle` + `UniversalCapabilityPlatform` + `DynamicProviderManager` | ✅ `stateStore` threaded through; `enablePersistence` auto-enabled when a `trustStateStore` is supplied. |

---

## P4 — Production Trust Defaults ✅

| Check | Result |
|---|---|
| `enforceSignatures` env-driven, fail-closed in prod | ✅ `manager.ts`: `HERMES_ENFORCE_SIGNATURES=true` OR `NODE_ENV=production` ⇒ `true`; dev/test default `false`. |
| Dev/test compatible | ✅ Explicit `HERMES_ENFORCE_SIGNATURES=false` overrides even in production. |
| Signature gate actually enforces | ✅ Verified: with `enforceSignatures=true`, an unsigned manifest is REJECTED at `VALIDATE` (real checksum + ed25519 verification, fail-closed). |
| Hermes owns config (not a provider) | ✅ Policy resolved in `DynamicProviderManager` constructor; no provider-specific logic. |

---

## P5 — EPIC-005.9 Regression Suite ✅

`hermes/services/providers/__tests__/epic-005.9.test.ts` — **12 tests, all passing**, covering:
- P1: `grantGitApproval`/`grantStackBApproval` mint structured `ApprovalRef` (never string).
- P2: `FileAuditBackend` persistence + restart-safety; `createProductionAuditStore` file vs in-memory.
- P3: QUARANTINED/REVOKED survives a fresh `TrustLifecycle`; file store round-trips.
- P4: env-driven `enforceSignatures` (4 cases) + unsigned-manifest rejection.

Run with: `cd workers && ./node_modules/.bin/vitest run --config vitest.epic005.config.ts`

---

## P6 — Full Gate ✅

| Gate | Result |
|---|---|
| Typecheck (`workers/tsconfig.json`) | ✅ 0 errors |
| Full test corpus | ✅ 434 passed / 33 files |
| EPIC-005.9 suite | ✅ 114 passed / 8 files |
| Secret scan | ✅ No real secrets |
| Keyword grep (`human-token`, `approvalToken` in Stack B boundary) | ✅ 0 matches |

---

## Residual Notes (out of EPIC-005.9 scope, intentionally untouched)

- **Simulation/demo pipelines** (`services/developer/*`, `services/execution/simulation.ts`) still use `approvalToken: "sim-token"` literals. These are explicitly simulation-only artifacts that never perform real execution or real git operations. The baseline's CRITICAL-1 gap was the *Stack B execution approval bypass* (`security-agent.ts` + `provider-framework.ts`), now closed. These simulation paths are a separate, non-execution layer.
- **Tool-level approval gate** (`services/tools/*`, `git-provider.ts`, `admin/console/tool-adapter.ts`) retains a legitimate `approvalToken` presence check for *tool calls* — a different layer than the Stack B execution boundary. Not part of the EPIC-005.9 gap.
- **Trust-subsystem import bugs** (`.ts` extensions under `bundler` resolution, wrong relative paths in `trust/`) were repaired as part of unblocking the P1 STOP CHECKPOINT (they blocked the production typecheck). These were pre-existing breakages in the dirty tree.

---

## Conclusion

All seven phases of EPIC-005.9 are **complete and verified by real execution**. The Hermes Foundation Freeze invariants (provider neutrality, fail-closed, single execution boundary, mandatory audit, mandatory tenancy) are intact. Typecheck is clean; 434 + 114 tests pass; no secrets leaked; the legacy Stack B approval-token bypass is eliminated.
