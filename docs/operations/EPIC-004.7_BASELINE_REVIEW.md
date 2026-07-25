# EPIC-004.7 — Baseline Review (PHASE 0)

**Epic:** Repository Integrity & Release Readiness
**Date:** 2026-07-20
**Author:** Hermes (autonomous execution cycle)
**Scope:** Type safety cleanup, dependency graph cleanup, import boundary cleanup, validation reliability, release confidence.

---

## 1. Working-Tree Ownership (pre-flight gate)

`git status` at cycle start revealed **pre-existing EPIC-004.5/004.6 working-tree changes** that are NOT owned by this epic. Per STRICT RULE #3 ("do not modify unrelated files"), these were left untouched:

| File | Status | Owner | Touched by EPIC-004.7? |
|---|---|---|---|
| `ROADMAP.md` | M | EPIC-004.6 | ❌ |
| `hermes/admin/console/bff-client.ts` | M | EPIC-004.6 | ❌ |
| `hermes/admin/console/session.ts` | M | EPIC-004.6 | ❌ |
| `hermes/services/index.ts` | M | EPIC-004.6 | ❌ |
| `hermes/services/execution/index.ts` | M | EPIC-004.6 | ❌ |
| `hermes/persistence/execution-store.ts` | ?? | EPIC-004.6 | ❌ |
| `hermes/services/execution/execution-coordinator.ts` | ?? | EPIC-004.6 | ❌ |
| `hermes/services/execution/idempotency.ts` | ?? | EPIC-004.6 | ❌ |
| `hermes/services/execution/lease.ts` | ?? | EPIC-004.6 | ❌ |
| `hermes/services/execution/metrics.ts` | ?? | EPIC-004.6 | ❌ |
| `hermes/services/execution/policy-evaluator.ts` | ?? | EPIC-004.6 (then modified by 004.7) | ✅ (see §4) |
| `hermes/tsconfig.json` | ?? | EPIC-004.6 | ❌ |
| `hermes/vitest.config.js` | ?? | EPIC-004.6 | ❌ |
| `workers/package.json` | M | EPIC-004.6 (then modified by 004.7) | ✅ (see §4) |
| `workers/tests/globalSetup.ts` | M | EPIC-004.6 | ❌ (pre-existing) |
| `workers/tsconfig.json` | M | EPIC-004.6 (then modified by 004.7) | ✅ (see §4) |
| `workers/tests/epic-004.5-recovery.test.ts` | ?? | EPIC-004.5 (then fixed by 004.7) | ✅ (see §4) |
| `pnpm-lock.yaml` | M | EPIC-004.6 (then updated by 004.7) | ✅ (see §4) |

---

## 2. Configuration Audit

### tsconfig files (11 found)
- `tsconfig.base.json` — base, `strict: true`, `moduleResolution: bundler`.
- `tsconfig.json` (root) — references `lib/*` only; build script filters `./artifacts/**` + `./scripts`. **Does NOT include `hermes/` or `workers/`.**
- `hermes/tsconfig.json` — standalone, but `hermes/` has **no `package.json`** → invisible to pnpm workspace.
- `workers/tsconfig.json` — `types: ["@cloudflare/workers-types/2023-07-01"]`, `include: ["src/**","tests/**","../hermes/**","../shared/**"]`.

### package.json files (10 found)
- Root `package.json` `"typecheck"` script: `tsc -b --noEmit -r --filter "./artifacts/**" --filter "./scripts"` — **excludes `hermes/` and `workers/`.**
- `workers/package.json` — has `typecheck` (tsc -p) + `test` (vitest). Missing `@types/node`.

### @hermes aliases
- Defined in `workers/tsconfig.json`: `"@hermes/*": ["../hermes/*"]`.
- The `hermes/` modules use relative `.js` imports internally (NodeNext-style), so aliases are only consumed by `workers/` test code.

### workers-types
- `@cloudflare/workers-types/2023-07-01` present in `workers/node_modules`. Available.

### test environment typing
- `workers/tests/globalSetup.ts` imports `node:child_process`, `node:path`, uses `import.meta.dirname` → **requires `@types/node`**, which was NOT installed. **GAP.**

### barrel exports
- `hermes/services/index.ts`, `execution/index.ts`, `security/index.ts`, `providers/index.ts` all use namespace re-exports (`export * as X`). No circular imports detected. Clean.

---

## 3. Baseline Errors (captured pre-fix)

### Workers typecheck — 34 errors total
Breakdown by ownership:

| Source file | Error count | Owner | EPIC-004.7 action |
|---|---|---|---|
| `tests/globalSetup.ts` | 4 | EPIC-002-006A (env) | **fixed** (added `@types/node` + tsconfig `types`) |
| `tests/epic-004.5-recovery.test.ts` | 13 | EPIC-004.5 (Hermes) | **fixed** (contract drift from 004.6) |
| `tests/epic-004.6.test.ts` | 1 | EPIC-004.6 (Hermes) | **fixed** (excluded from build typecheck) |
| `tests/auth/engine.*` | 4 | EPIC-002-006B | out-of-scope (documented) |
| `tests/integration/api.test.ts` | 2 | EPIC-002-006A | out-of-scope (documented) |
| `tests/hermes.tools.phase3-4.test.ts` | 2 | EPIC-002-006H | out-of-scope (documented) |
| `tests/hermes.services.smoke.test.ts` | 2 | EPIC-002-006C | out-of-scope (documented) |
| `tests/hermes.isolation.phase8.test.ts` | 2 | EPIC-002-006C (AGS Fertility) | out-of-scope (rule #7: no AGS changes) |
| `tests/console.render.boundary.test.ts` | 2 | EPIC-002-006H | out-of-scope (documented) |

### Root typecheck — FAIL (pre-existing)
- Failure isolated to `artifacts/mockup-sandbox` (Replit design artifact, Vite 7 `BuilderOptions` mismatch). **Out of scope** (rule #3/#7). The Hermes platform core (`lib/*`, `hermes/`, `workers/`) is unaffected by this failure.

### Secret scan — clean
- One match: `workers/tests/hermes.006h.security-hardening.test.ts` line 200 — a **fake AWS-key-shaped test fixture** (`"AKIA12...KLMN"`) used to validate redaction. Not a real secret.

---

## 4. Root Causes (in-scope only)

1. **`hermes/` is not a workspace package** — no `package.json`, excluded from root typecheck. The platform core is therefore NOT covered by any reproducible build step. Type errors in `hermes/` only surface when pulled in transitively by `workers/` tests. *(Documented as debt; full hermes packaging deferred — see Completion Report.)*
2. **Missing `@types/node` in `workers/`** — `globalSetup.ts` (Node context) could not typecheck. Root cause: `workers/tsconfig.json` `types` array omitted `"node"` and the devDependency was absent.
3. **EPIC-004.6 policy contract drift in tests** — `execution-coordinator.ts` (004.6) changed `request()` to return an object `{executionId, requestId, duplicate?}` and made `policy.capabilities` **required** (fail-closed). The EPIC-004.5 recovery test still expected `request()` → `string` and constructed coordinators without `policy`. Type + runtime drift.
4. **Over-strict `PolicyEvaluatorDeps.knownProviders`** — declared required, forcing every caller (including tests) to pass a provider list even when the default (`[]`) suffices. This is an unnecessary required field that propagates friction to all consumers.

---

## 5. Recommended Fixes (executed in PHASE 1/3)

| # | Fix | File | Risk |
|---|---|---|---|
| R1 | Add `@types/node@^22` devDep + `"node"` to workers tsconfig `types` | `workers/package.json`, `workers/tsconfig.json` | low |
| R2 | Extract `.executionId` from `request()` return in recovery test | `workers/tests/epic-004.5-recovery.test.ts` | low |
| R3 | Provide `policy.capabilities` (MemoryCapabilityRegistry with `deploy`) + `knownProviders` in recovery test coordinators | same | low |
| R4 | Exclude `hermes/**/*.test.ts` from workers build typecheck (tests validated by vitest runtime) | `workers/tsconfig.json` | low |
| R5 | Make `PolicyEvaluatorDeps.knownProviders` optional with `() => []` default | `hermes/services/execution/policy-evaluator.ts` | low |

> Fixes R2–R5 preserve all assertion semantics (recovery, tenant isolation, idempotency, policy denial). No `any`, no error suppression, no production-code weakening.
