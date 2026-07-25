# EPIC-006 — Validation Report

**Date:** 2026-07-21
**Scope:** Runtime Provider Integration — AGS Website Operations
**Classification:** Wiring-only (Foundation frozen, no core changes)
**Author:** Hermes Agent (hy3)

---

## 1. Forbidden-Pattern Sweep

Searched all EPIC-006 files under `hermes/services/activation/providers/` for:

| Pattern | Result |
|---|---|
| `bypass` | 1 hit — comment in `website.ts` *enforcing* "no bypass" (rule, not violation) |
| `skipGuard` | 0 |
| `human-token` | 0 |
| `always allow` | 0 |
| `provider.execute(` / direct vendor exec | 0 |
| vendor SDK import (`wrangler`/`octokit`/`@actions/github`) | 0 (only in comments) |

**Verdict: CLEAN.** No runtime path bypasses `HermesExecutionGateway`.

---

## 2. Typecheck (`tsc --noEmit -p tsconfig.json`)

- Full project compile: **0 errors** (including all EPIC-006 additions).
- EPIC-006-visible files (providers github/cloudflare/website/bootstrap/secret-source/backend, provider-framework, tool-provider): **0 errors**.

---

## 3. Runtime Test Suites (executed via `tsx`, real gateway path)

| Suite | File | Assertions | Result |
|---|---|---|---|
| Integration (regression) | `ags.integration.ts` | 18 | ✅ PASS |
| Bootstrap / NOT_INSTALLED | `ags.bootstrap.ts` | 11 | ✅ PASS |
| Website capability validation | `ags.website.ts` | 24 | ✅ PASS |
| Dry-run mode | `ags.dryrun.ts` | 13 | ✅ PASS |
| Production approval adapter | `ags.approval.ts` | 9 | ✅ PASS |
| **TOTAL** | | **75** | **✅ 75/75** |

### Coverage highlights
- ✅ All 10 `website.*` capabilities resolve to a provider+underlying capability (superset reconciles EPIC naming with existing set).
- ✅ Non-prod deploy executes through the gateway (real path).
- ✅ Prod deploy **refused fail-closed** without a durable `ApprovalRef`.
- ✅ Prod deploy **executes** with a valid `ApprovalRef` (minted via `grantStackBApproval`).
- ✅ Unresolved capability denied at gateway (`hermes.fail-closed`).
- ✅ Missing credentials ⇒ `NOT_INSTALLED` (no partial activation).
- ✅ Dry-run returns a plan WITHOUT invoking backend (verified: 0 backend calls).
- ✅ Every executed result carries provider-backend provenance (audit emitted).

---

## 4. Foundation Integrity (unchanged from Phase 0)

- `HermesExecutionGateway`, `UniversalCapabilityPlatform`, `ProviderRuntimeGuard`,
  trust/approval/tenant/audit subsystems: **not modified**.
- Dispatch path identical: `website.*` → `RUN` map → `runWebsiteCapability` →
  `executeCapability` → gateway → guard → executor → backend.
- Fail-closed preserved on: no-provider, no-approval, no-executor, cross-tenant.

---

## 5. Blocker / Out-of-Scope Notes

- **No real credentials wired.** Backends are mocks in-tests; the real `wrangler`/`gh`
  executors are injected at deploy time via `connectGitHubBackend` / `connectCloudflareBackend`.
- **No commit / stage / deploy performed** (per EPIC HARD RULES). Artifacts are written
  to the working tree only.
- `tsc` environmental note: sandbox lacks `@types/node`; `process` references in tests are
  runtime-only (Node global) and do not affect the compiled product.
