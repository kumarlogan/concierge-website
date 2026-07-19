# EPIC-002-006B — Execution Plan

> **Created:** 2026-07-19 · **Baseline:** `baseline-002-006` (commit `ded1c953`)
> **Mode:** Extraction (NOT rewrite). Production behavior must remain unchanged.
> **Principle:** Every phase reversible; commit after each logical milestone; tests after every phase.

---

## 0. Baseline Evidence (pre-implementation)

| Check | Result | Source |
|---|---|---|
| At baseline tag | ✅ `baseline-002-006` exists; HEAD `493d957` is past it on `main` | `git tag -l`, `git rev-parse` |
| Auth module inventory | 7 files, 795 LOC in `workers/src/auth/` | `wc -l workers/src/auth/*.ts` |
| Consumers of `./auth` | **Only 2 import sites** (`workers/src/index.ts:28`, `workers/src/routes/telegram.ts:24`) — both use `./auth/middleware.js` barrel | `grep` import graph |
| Existing tests | `tests/auth/engine.unit.test.ts` (14 tests) + `engine.integration.test.ts` | `find` |
| **Baseline unit test run** | **14 passed / 0 failed** (3.97s) | `npx vitest run tests/auth/engine.unit.test.ts` |
| Integration tests | Require Workers runtime (`@cloudflare/vitest-pool-workers`); `wrangler d1 migrations apply` fails in sandbox → pre-existing failure, NOT in scope | observed |

**Key constraint discovered:** `workers/src/auth/` is consumed ONLY via the barrel `./auth/middleware.js` (re-exported by `index.ts`). This means extraction can preserve behavior by re-exporting from the new `hermes/` location through the existing barrel — consumers need NOT change import paths immediately.

---

## 1. Extraction Phases

### PHASE 1 — Hermes Platform Foundation (scaffold only)
**Goal:** Create target directory skeleton. No code moves yet.
**Create:**
```
hermes/{identity,permissions,audit,providers,contracts,agents}/
shared/{interfaces,contracts}/
hermes/README.md  (documents the platform boundary)
```
**Files affected:** 6 new dirs + `hermes/README.md` + `shared/README.md`. **Zero** production files touched.
**Validation:** `git status` shows only new empty-tree markers; `tsc --noEmit` unaffected (no source yet).
**Commit:** `EPIC-002-006B P1: scaffold hermes/ and shared/ platform directories`

### PHASE 2 — Extract Identity Capability
**Move (git mv, preserves history):** `workers/src/auth/{providers,principal,types}.ts` → `hermes/identity/`
**Adapter:** `workers/src/auth/identity.ts` re-exports from `../../hermes/identity/*` so the `./auth` barrel still resolves. Consumers unchanged.
**Preserve:** TelegramIdentityResolver behavior, `resolveIdentity`, registry functions, `AuthError`, `Principal`/`IdentityResolution`/`IdentityResolver` types.
**Tests:** Move `engine.unit.test.ts` identity-related cases alongside OR keep test importing via barrel; re-run → 14/14.
**Files affected:** 3 moved (git mv), 1 new adapter (`workers/src/auth/identity.ts`), barrel `index.ts` updated to re-export.
**Commit:** `EPIC-002-006B P2: extract identity capability into hermes/identity (adapter preserved)`

### PHASE 3 — Extract Permission Engine
**Move:** `workers/src/auth/{permissions,middleware}.ts` → `hermes/permissions/`
**Preserve:** OWNER override (`OWNER_ROLE_NAME` short-circuit), role grants, user grants, revocations (deny-wins), audit integration (`writeAuditEvent` call in middleware).
**Adapter:** `workers/src/auth/permissions.ts` re-exports `authorize`/`requirePermission`/`composeSecurityPipeline` from `../../hermes/permissions/middleware.js`. Barrel unchanged.
**Note:** `middleware.ts` imports `buildPrincipal` (now in `hermes/identity`) and `writeAuditEvent` (Phase 4 target). Use relative cross-hermes import `../identity/principal.js` + `../audit/audit.js` (resolved in Phase 4).
**Files affected:** 2 moved, 1 adapter, barrel update.
**Commit:** `EPIC-002-006B P3: extract permission engine + authorization middleware into hermes/permissions`

### PHASE 4 — Extract Audit Capability
**Move:** `workers/src/auth/audit.ts` → `hermes/audit/audit.ts`
**Preserve:** Non-blocking write (`try/catch` + `console.error`, returns `null` on failure), existing `audit_logs` INSERT shape, `AuthorizationDecision` schema from `types.ts` (already in `hermes/identity/types` post-Phase 2 — import from there).
**Adapter:** `workers/src/auth/audit.ts` re-exports `writeAuditEvent` from `../../hermes/audit/audit.js`.
**Files affected:** 1 moved, 1 adapter.
**Commit:** `EPIC-002-006B P4: extract audit capability into hermes/audit`

### PHASE 5 — Provider Boundary (interfaces only)
**Create:** `shared/interfaces/` with TypeScript interface definitions (NO implementation):
- `IdentityProvider.ts`, `PermissionProvider.ts`, `AuditProvider.ts`, `DataStore.ts`, `ObjectStorage.ts`, `Queue.ts`, `NotificationProvider.ts`, `Scheduler.ts`, `SecretProvider.ts`, `LoggingProvider.ts`
**Cloudflare:** NOT replaced. The Cloudflare Workers impl stays; these interfaces are forward-looking contracts. `hermes/providers/` holds the adapter skeleton (empty/stub) referencing these.
**Files affected:** 10 new interface files + `hermes/providers/index.ts` (re-export.
**Commit:** `EPIC-002-006B P5: define provider abstraction interfaces in shared/interfaces`

### PHASE 6 — Convert AGS Fertility into Consumer
**Refactor (gradual, no API change):** The 2 consumers (`index.ts`, `telegram.ts`) currently import `requirePermission` from `./auth/middleware.js`. After Phases 2–4, that barrel re-exports from Hermes. **No consumer change needed for behavior** — but to make the "consumer" relationship explicit, update `workers/src/auth/index.ts` to clearly document that it now delegates to Hermes, and add a thin `workers/src/security.ts` barrel that re-exports the Hermes pipeline for app use.
**Preserve:** exact `authorize`/`requirePermission` signatures + return shapes.
**Files affected:** `workers/src/auth/index.ts` (doc/comment update), optional new `workers/src/security.ts` re-export. NO logic change.
**Commit:** `EPIC-002-006B P6: make AGS Fertility consume Hermes security pipeline (no API change)`

### PHASE 7 — Register First AI Agent
**Create:** `hermes/agents/registry.ts` — minimal in-code agent registry (map of agent id → metadata).
**Register:** `ags-fertility-ops-agent` with state `registered`, `activation: disabled`.
**No autonomous actions:** registry is data-only; no scheduler, no execution.
**Files affected:** `hermes/agents/registry.ts` (new), `hermes/agents/ags-fertility-ops-agent.ts` (metadata def).
**Commit:** `EPIC-002-006B P7: register ags-fertility-ops-agent in Hermes agent registry (disabled)`

---

## 2. Files Affected (consolidated)

| Phase | New | Moved (git mv) | Adapter/Modified |
|---|---|---|---|
| 1 | `hermes/{identity,permissions,audit,providers,contracts,agents}/`, `shared/{interfaces,contracts}/`, 2 README | — | — |
| 2 | — | `workers/src/auth/{providers,principal,types}.ts` → `hermes/identity/` | `workers/src/auth/identity.ts` (re-export) |
| 3 | — | `workers/src/auth/{permissions,middleware}.ts` → `hermes/permissions/` | `workers/src/auth/permissions.ts` (re-export) |
| 4 | — | `workers/src/auth/audit.ts` → `hermes/audit/` | `workers/src/auth/audit.ts` (re-export) |
| 5 | 10 interface files in `shared/interfaces/`, `hermes/providers/index.ts` | — | — |
| 6 | optional `workers/src/security.ts` | — | `workers/src/auth/index.ts` (comment) |
| 7 | `hermes/agents/registry.ts`, `hermes/agents/ags-fertility-ops-agent.ts` | — | — |

**Untouched (must remain):** `workers/src/index.ts`, `workers/src/routes/telegram.ts` (consumer import paths), `migrations/`, `wrangler.jsonc`, `deploy.yml`, D1, secrets, Cloudflare config.

---

## 3. Rollback Strategy

Each phase is a single commit → `git revert <phase-commit>` restores prior state.
- **Full rollback:** `git reset --hard baseline-002-006` (or `git checkout ded1c953`).
- **Per-phase:** `git revert <commit>` (e.g. `git revert <P3-commit>` un-extracts permissions; adapters + barrel revert cleanly).
- **Adapter safety:** Because consumers import ONLY the `./auth` barrel, reverting any phase's move + restoring the adapter returns the exact original file graph. The barrel (`index.ts`) is the single seam.
- **Quarantine:** No deletions; `git mv` preserves history. Nothing enters `~/archive`.

---

## 4. Validation Gates (per phase)

| Gate | Method | Pass criterion |
|---|---|---|
| G1 Code compiles | `cd workers && npx tsc --noEmit` | 0 errors |
| G2 Unit tests pass | `npx vitest run tests/auth/engine.unit.test.ts` | 14/14 (baseline) — must hold |
| G3 Consumers unchanged | `git diff workers/src/index.ts workers/src/routes/telegram.ts` | no behavioral diff (only comments allowed) |
| G4 No infra/secrets/migrations touched | `git diff --stat` review | none of migrations/, wrangler.jsonc, deploy.yml, .env* changed |
| G5 Barrel resolves | import resolution check | `./auth` barrel still exports all 6 symbols |
| G6 Behavior parity | unit test suite green + manual import trace | same `authorize` contract |

**STOP triggers (halt + report):** workers/src behavior change; migration required; prod config change; secret touched; test regression (unit < 14).

---

## 5. Dependency Graph

```
workers/src/auth/index.ts (barrel, SINGLE SEAM)
   ├── re-exports → hermes/identity/*   (types, providers, principal)   [P2]
   ├── re-exports → hermes/permissions/* (permissions, middleware)      [P3]
   ├── re-exports → hermes/audit/*       (audit)                        [P4]
        │
        └── consumers (UNCHANGED):
              workers/src/index.ts:28        → requirePermission
              workers/src/routes/telegram.ts:24 → requirePermission

hermes/permissions/middleware.ts
   ├── imports hermes/identity/principal.js (buildPrincipal)   [cross-hermes]
   ├── imports hermes/audit/audit.js (writeAuditEvent)        [cross-hermes]
   └── imports hermes/identity/types.js (AuthError, Principal)

shared/interfaces/*.ts (P5) → referenced by hermes/providers/ (no impl swap)
hermes/agents/registry.ts (P7) → standalone, no prod dependency
```

**Ordering constraint:** P2 (types) MUST precede P3/P4 because `middleware.ts` and `audit.ts` import `types.js`. P4 (audit) should land before or with P3's final wiring (middleware imports audit). Plan runs P2 → P3 → P4 → P5 → P6 → P7.

---

## 6. Expected Commits

1. `EPIC-002-006B P1: scaffold hermes/ and shared/ platform directories`
2. `EPIC-002-006B P2: extract identity capability into hermes/identity (adapter preserved)`
3. `EPIC-002-006B P3: extract permission engine + authorization middleware into hermes/permissions`
4. `EPIC-002-006B P4: extract audit capability into hermes/audit`
5. `EPIC-002-006B P5: define provider abstraction interfaces in shared/interfaces`
6. `EPIC-002-006B P6: make AGS Fertility consume Hermes security pipeline (no API change)`
7. `EPIC-002-006B P7: register ags-fertility-ops-agent in Hermes agent registry (disabled)`

Plus: `EPIC-002-006B_EXECUTION_PLAN.md` (this file), `EPIC-002-006B_PROGRESS.md`, `EPIC-002-006B_VALIDATION_REPORT.md`.

---

## 7. ADR Impact

- No architectural *decision* changes vs ADR-004/005/006/007 — this execution *implements* the already-ratified extraction strategy (ADR-007).
- If a deviation is forced (e.g. cross-hermes relative import path), it will be noted in `EPIC-002-006B_PROGRESS.md` and ADR-007 appended with an "Implementation Notes" section — not a new ADR.
