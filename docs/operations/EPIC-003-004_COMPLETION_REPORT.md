# EPIC-003-004 — Security Provider Integration · Completion Report

**Status:** ✅ Complete (2026-07-20)
**Parent epics:** EPIC-003-001 (Execution Platform), EPIC-003-003 (Security Automation)
**Scope discipline:** EPIC-003-005 (Workforce) is CLOSED at commit `97cf0e4` and was
not reopened, modified, or restaged. EPIC-003-002 (Developer), EPIC-003-001 (Execution),
AGS Fertility, Cloudflare, deployments, migrations, and secrets were not touched.

---

## 1. Objective

Complete the security provider surface that EPIC-003-003 left as *simulated-only*:
wire real OSS scanner adapters, automatic provider discovery, a provider-health
platform, multi-provider finding aggregation, admin security visibility, and
local-first tool detection — all **provider-neutral**, **fail-closed**, and
**simulation-default** (no production side effects).

---

## 2. Deliverables (Milestones)

| Milestone | What it delivers | Key files |
|---|---|---|
| **M1** · Module barrel | `services/security` re-export surface | `hermes/services/security/index.ts` |
| **M2** · Real OSS adapters | gitleaks / semgrep / osv-scanner / trivy adapters that probe for a real backend and **fail closed** with `NOT_INSTALLED` when the binary is absent; `forcedState` for safe dry-run/synthesis | `hermes/services/security/providers/real-adapters.ts` |
| **M3** · Provider discovery | `discoverSecurityProviders()` reads the platform registry + adapter probes → version, installation state, health; surfaces adapters not yet wired to a `ManagedProvider` | `hermes/services/security/providers/provider-discovery.ts` |
| **M4** · Dev-pipeline integration | Simulated executor (per-capability routers) + baseline synthetic findings; `security-providers.ts` registers the `sec.suite` `ManagedProvider` idempotently | `hermes/services/security/providers/oss-adapters.ts`, `hermes/services/security/providers/security-providers.ts` |
| **M5** · Provider-health platform | `monitorSecurityProviderHealth()` + `selectHealthyProvider()` (fail-closed → `undefined` when no healthy provider serves a capability); health state persisted in-memory | `hermes/services/security/provider-health.ts` |
| **M6** · Finding aggregation | `aggregateFindings()` merges multi-provider findings, deduplicates by fingerprint, keeps the most severe/confident signal; `categoryOf()` buckets check kinds | `hermes/services/security/finding-aggregator.ts` |
| **M7** · Admin visibility | `buildSecurityAdminView()` exposes version + installation state + last scan per provider (read model; consumed only via the internal admin facade) | `hermes/services/security/admin-view.ts` |
| **M8** · Local tool detection | `detectLocalTool()` probes PATH via `command -v`; degrades gracefully (fail closed) in Worker/edge runtimes where `child_process` is unavailable | `hermes/services/security/providers/local-tool-detection.ts` |
| **M9** · Docs | This report, the validation report, and ROADMAP update | `docs/operations/EPIC-003-004_*.md`, `ROADMAP.md` |

---

## 3. Provider-Neutral Design (no lock-in)

- **No vendor logic in discovery/health/aggregation.** `provider-discovery.ts`,
  `provider-health.ts`, and `finding-aggregator.ts` operate purely on the platform
  provider registry and the `SecurityToolAdapter` contract (`tool`, `label`,
  `capabilities`, `installationState()`, `version()`, `health()`, `execute()`).
- **Backend is injected, not imported.** Scanners run through an injectable
  `CapabilityExecutor` port. The simulated suite is the default; gitleaks/semgrep/
  osv-scanner/trivy are drop-in adapter backends that are *optional* (fail closed when
  absent).
- **`provider-framework.ts` extension only.** `ProviderHealth` gained `offline` and
  `not_installed` values; `ToolHealth` already carried `unknown`. No signature change
  to `CapabilityExecutor` — existing providers (git, dev) remain compatible.

---

## 4. Fail-Closed Behavior (verified by tests)

- Missing binary → `execute()` returns `ok:false`, `error` contains `NOT_INSTALLED`,
  `health: "not_installed"`, `installationState(): "not_installed"`.
- `selectHealthyProvider(capability)` returns `undefined` when no healthy provider
  serves the capability (caller must block, not proceed).
- `buildSecurityAdminView` with empty scans → `overallRisk: "LOW"`, empty findings
  summary (no false-positive "clear").
- A `critical` boundary-validation finding forces `recommendation: "block"`.
- Local detection never throws — an unavailable `child_process` (Worker sandbox)
  resolves to `available:false` rather than crashing the scan.

---

## 5. Files Changed (this commit)

**New (untracked → added):**
- `hermes/services/security/index.ts`
- `hermes/services/security/finding-aggregator.ts`
- `hermes/services/security/provider-health.ts`
- `hermes/services/security/providers/local-tool-detection.ts`
- `hermes/services/security/providers/provider-discovery.ts`
- `hermes/services/security/providers/real-adapters.ts`
- `workers/tests/hermes.security.004.test.ts`

**Modified (tracked, in-scope 003-004):**
- `hermes/services/activation/provider-framework.ts` — `ProviderHealth` extended
  (`offline`, `not_installed`).
- `hermes/services/security/admin-view.ts` — wired to `discoverSecurityProviders`.
- `hermes/services/security/providers/oss-adapters.ts` — simulated executor
  `ctx.env` tightened to the `ToolCall["env"]` union.
- `hermes/services/security/providers/security-providers.ts` — idempotent bootstrap.
- `hermes/services/security/security-agent.ts` — `sourceRequestId` fallback
  (`req.sourceRequestId ?? req.requestId`) to satisfy the `SecurityReviewPackage`
  contract (this is an EPIC-003-003 file, corrected because it is in the allowed
  list and the security-agent is the 003-004 executor path).
- `hermes/services/activation/git-provider.ts` — **pre-existing tsc defect corrected
  in passing**: the capability executor spread a `Promise` (which exposed a `then`
  and broke the `ToolResult` contract). Made the executor `async` and `await`ed each
  backend call. git-provider is in the allowed list (activation layer, same
  `provider-framework` dependency).
- `ROADMAP.md` — EPIC-003-004 section added.

**Deliberately NOT included (other epics / out of scope, left untouched in working tree):**
- `hermes/contracts/platform-api.ts` (EPIC-003-001 EXECUTION permissions)
- `hermes/services/execution/index.ts` (EPIC-003-001 barrel)
- `hermes/services/index.ts` (Execution/Workforce/Security barrels — only the Security
  barrel relates to 003-004 and is already covered by the untracked `security/index.ts`;
  the other two barrels are EPIC-003-001/003-005 and were excluded to keep this commit
  pure)
- `workers/tests/globalSetup.ts` (EPIC-003-001 D1 seeding idempotency)

---

## 6. Validation Summary

| Check | Result |
|---|---|
| EPIC-003-004 security suite (`hermes.security.004.test.ts`) | **19/19 pass** |
| Full workers suite | **375/375 pass** (no regressions vs 003-005 baseline) |
| In-scope `tsc --noEmit` (all EPIC-003-004 files) | **clean — 0 errors** |
| Provider discovery | ✅ M3 tests |
| Provider health | ✅ M5 tests |
| OSS adapters (fail-closed) | ✅ M2 tests |
| Admin security visibility | ✅ M7 tests |
| Fail-closed behavior | ✅ M2/M4/M5 tests |
| Provider neutrality | ✅ no vendor logic in discovery/health/aggregation |

See `EPIC-003-004_VALIDATION_REPORT.md` for the full validation detail.

---

## 7. Remaining Technical Debt

1. **Pre-existing tsc errors in unrelated modules** (NOT introduced by 003-004, left
   untouched per scope discipline): `admin/console/bff-client.ts`,
   `admin/ui-contracts.ts`, `agents/seed.ts` (missing `activation`),
   `tests/auth/engine.integration.test.ts` + `tests/integration/api.test.ts`
   (`Env.DB` not on the worker `Env` type), `tests/globalSetup.ts`
   (`node:child_process`/`node:path` without `@types/node` — this is the uncommitted
   EPIC-003-001 file), and several other-epic test files
   (`console.render.boundary`, `hermes.isolation.phase8`, `hermes.services.smoke`,
   `hermes.tools.phase3-4`). These predate this epic and are out of scope.
2. **No `services.Security` barrel wiring.** The new `security/index.ts` is a
   self-contained module barrel imported directly by the test suite. Wiring
   `export * as Security from "./security/index.js"` into the top-level
   `hermes/services/index.ts` was intentionally deferred (that file also carries
   EPIC-003-001/003-005 barrels and is out of this epic's scope).
3. **No persistent storage.** Provider health + discovered state are in-memory only,
   consistent with EPIC-003-001/003-005 (no database persistence).

---

*Commit: see `EPIC-003-004_VALIDATION_REPORT.md` §Commit for the SHA and staged file list.*
