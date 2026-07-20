# EPIC-003-004 — Security Provider Integration · Validation Report

**Date:** 2026-07-20
**Commit:** _(set after commit — see §Commit)_
**Scope:** EPIC-003-004 only. EPIC-003-005 CLOSED at `97cf0e4` (untouched).

---

## 1. Type-Check (`tsc --noEmit`)

Full-project `tsc` was run from `workers/`. **All EPIC-003-004 files compile with 0
errors.** The only remaining tsc errors are pre-existing and live in modules outside
this epic's scope (see §6). No new error was introduced by 003-004.

Specifically verified clean:
- `hermes/services/activation/provider-framework.ts`
- `hermes/services/activation/git-provider.ts` (pre-existing promise-spread defect fixed)
- `hermes/services/security/admin-view.ts`
- `hermes/services/security/security-agent.ts` (sourceRequestId fallback)
- `hermes/services/security/providers/oss-adapters.ts`
- `hermes/services/security/providers/security-providers.ts`
- `hermes/services/security/providers/real-adapters.ts`
- `hermes/services/security/providers/local-tool-detection.ts` (node:child_process
  handled without `@types/node` via a runtime `require` probe + graceful fallback)
- `hermes/services/security/providers/provider-discovery.ts`
- `hermes/services/security/provider-health.ts`
- `hermes/services/security/finding-aggregator.ts`
- `hermes/services/security/index.ts`

---

## 2. Test Suite — EPIC-003-004 (`hermes.security.004.test.ts`)

```
 RUN v4.1.10
 ✓ tests/hermes.security.004.test.ts (19 tests) 22ms
 Test Files  1 passed (1)
     Tests  19 passed (19)
```

Coverage by milestone:

| Describe block | Milestone | Assertions |
|---|---|---|
| M8 — local tool detection | M8 | missing binary → `available:false`, `executable:false`, health `not_installed`; `detectLocalTool` never throws |
| M2 — real provider adapters | M2 | gitleaks → `NOT_INSTALLED` when absent; semgrep/osv/trivy fail closed; dry-run safe + `healthy`; synthesizes finding only when `forcedState:"installed"`; `allRealAdapters()` exposes 4 tools with correct capabilities |
| M3 — provider discovery | M3 | simulated `sec.suite` discovered available+enabled with capabilities; every discovered provider exposes `installationState` + `healthy` from the allowed unions |
| M5 — provider health | M5 | simulated provider maps to `healthy`/`degraded` + selectable; adapters missing binary → `not_installed` + not selectable; `selectHealthyProvider` resolves to a defined id when simulated is active |
| M6 — aggregation | M6 | combines + dedupes overlapping findings (2 unique from 3 raw, 1 duplicate removed, 2 providers merged); keeps most severe signal; `categoryOf` buckets correctly |
| M7 — admin visibility | M7 | admin view exposes version + installationState + capabilities per provider; records `lastScan` from a completed review |
| M4 — dev integration + fail-closed | M4 | `runSecurityForDeveloperTask` produces a full package (5 checks); a `critical` boundary-validation finding forces `recommendation: "block"` |

---

## 3. Full Workers Suite

```
 Test Files  26 passed (26)
     Tests  375 passed (375)
 Duration  16.12s
```

Identical count to the EPIC-003-005 baseline (375/375) — **no regressions** introduced
by 003-004.

---

## 4. Provider-Neutrality Verification

- `provider-discovery.ts`, `provider-health.ts`, `finding-aggregator.ts` contain **no
  vendor-specific literals** — they read the platform registry and the generic
  `SecurityToolAdapter` contract.
- `real-adapters.ts` isolates all vendor concepts (gitleaks/semgrep/osv-scanner/trivy)
  behind the `SecurityToolAdapter` interface; each is optional and fails closed.
- `oss-adapters.ts` simulated executor is the default backend and is fully portable.

---

## 5. Fail-Closed Verification

| Scenario | Expected | Test |
|---|---|---|
| Scanner binary absent | `ok:false`, `NOT_INSTALLED`, `health:"not_installed"` | M2 |
| No healthy provider for capability | `selectHealthyProvider` → `undefined` | M5 |
| Empty scan history | `overallRisk:"LOW"`, empty findings | M7 |
| `critical` boundary finding | `recommendation:"block"` | M4 |
| `child_process` unavailable (edge) | `detectLocalTool` → `available:false`, no throw | M8 |

---

## 6. Residual tsc Errors (pre-existing, OUT OF SCOPE)

These errors existed before 003-004 and are NOT in this epic's files. Listed for
transparency; deliberately not fixed (scope discipline):

- `hermes/admin/console/bff-client.ts`, `hermes/admin/ui-contracts.ts`
- `hermes/agents/seed.ts` (`activation` property missing on `RegisteredAgent`)
- `tests/auth/engine.integration.test.ts`, `tests/integration/api.test.ts`
  (`Env.DB` not on worker `Env` type)
- `tests/globalSetup.ts` (`node:child_process` / `node:path` / `import.meta.dirname`
  without `@types/node` — this is the uncommitted EPIC-003-001 file, not committed here)
- `tests/console.render.boundary.test.ts`, `tests/hermes.isolation.phase8.test.ts`,
  `tests/hermes.services.smoke.test.ts`, `tests/hermes.tools.phase3-4.test.ts`,
  `tests/auth/engine.unit.test.ts` (other-epic / unrelated test type errors)

All are test-only or other-epic modules and do not affect the 003-004 runtime surface
or the 375/375 passing suite.

---

## 7. Commit

- **Strategy:** one logical, reversible commit containing **only** EPIC-003-004 paths
  (no `git add -A`; other epics' uncommitted changes left in the working tree).
- **Staged file list:**
  - `hermes/services/activation/provider-framework.ts`
  - `hermes/services/activation/git-provider.ts`
  - `hermes/services/security/admin-view.ts`
  - `hermes/services/security/security-agent.ts`
  - `hermes/services/security/providers/oss-adapters.ts`
  - `hermes/services/security/providers/security-providers.ts`
  - `hermes/services/security/index.ts` (new)
  - `hermes/services/security/finding-aggregator.ts` (new)
  - `hermes/services/security/provider-health.ts` (new)
  - `hermes/services/security/providers/local-tool-detection.ts` (new)
  - `hermes/services/security/providers/provider-discovery.ts` (new)
  - `hermes/services/security/providers/real-adapters.ts` (new)
  - `workers/tests/hermes.security.004.test.ts` (new)
  - `ROADMAP.md`
- **SHA:** _(recorded after `git commit`)_

---

## 8. Conclusion

EPIC-003-004 is complete: the security provider surface is integrated, provider-neutral,
and fail-closed; the new validation suite (19/19) and the full workers suite (375/375)
pass; all in-scope code type-checks. The epic is reversible via a single commit and
introduced no regressions.
