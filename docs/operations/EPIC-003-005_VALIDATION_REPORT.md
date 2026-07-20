# EPIC-003-005 — Workforce Orchestration Platform · Validation Report

**Date:** 2026-07-20
**Status:** ✅ Passed (in-scope)
**Suite:** `workers/tests/hermes.workforce.orchestration.test.ts` + full workers run

---

## 1. Test results

| Scope | Command | Result |
|---|---|---|
| Orchestration suite (003-005) | `npx vitest run hermes.workforce.orchestration.test.ts` | **12/12 pass** |
| Full workers suite | `npx vitest run` | **375/375 pass** (26 files, no regressions) |
| In-scope typecheck | `npx tsc --noEmit` (grep `workforce\|orchestration`) | **0 errors** |

## 2. What the 12 orchestration tests prove

| # | Test | Gate validated |
|---|---|---|
| 1 | creates a workflow and plans dependency-ordered waves | M1 planning (pure, topological) |
| 2 | dispatches each capability dynamically (registry → workforce-agent) | M3 no hardcoding |
| 3 | marks unresolved capabilities for human triage (fail-closed) | M3 fail-closed path |
| 4 | blocks on unresolved capability — no autonomous run | M3/M4 fail-closed |
| 5 | assigns planned tasks, then requires human approval before any run | M4 env-driven gate (production) |
| 6 | grants approval, then runs only the granted task | M4 grant enforcement |
| 7 | waits for approval — `waiting` state until grant | M4 wait state |
| 8 | retries a failed task and recovers after transient failures | M2 retry (queue `maxAttempts`) |
| 9 | surfaces a genuine final failure when all attempts are exhausted | M2 failure recovery |
| 10 | cancels the whole workflow (all entries) | M2 cancel |
| 11 | pauses and resumes without autonomous execution; preserves assignment | M5 resumable |
| 12 | audits every orchestration event (created/state/approval/assigned/completed) | M6 audit coverage |

## 3. Typecheck isolation (critical finding)

`tsc --noEmit` reports **16 errors repo-wide**, but **none** are in
`services/workforce/` or any 003-005 file. All 8 error-bearing files belong to
parallel work:

| Error file | Owning EPIC | Nature |
|---|---|---|
| `hermes/admin/console/bff-client.ts` | admin-console (parallel) | contract literal drift |
| `hermes/admin/ui-contracts.ts` | admin-console (parallel) | literal mismatch |
| `hermes/agents/seed.ts` | agents (parallel) | missing `activation` field |
| `hermes/services/activation/git-provider.ts` | 003-004 (parallel) | `CapabilityExecutor` mismatch |
| `hermes/services/security/providers/local-tool-detection.ts` | 003-004 (parallel) | `node:child_process` types |
| `hermes/services/security/providers/oss-adapters.ts` | 003-004 (parallel) | `ToolHealth` mismatch |
| `hermes/services/security/providers/real-adapters.ts` | 003-004 (parallel) | `SecurityExecutorResult` mismatch |
| `hermes/services/security/security-agent.ts` | 003-004 (parallel) | `ToolHealth` mismatch |

**Root cause:** `provider-framework.ts` was extended (parallel 003-004) with
`"offline" | "not_installed"` health states, breaking downstream security/git
adapters that still use the old `ToolHealth` shape. 003-005 does **not** import
any of those types, so it is unaffected.

## 4. Commit scope (audited)

Staged files — 003-005 only:

```
hermes/services/workforce/                         (new dir: orchestration.ts, index.ts)
hermes/admin/workflow-view.ts                      (new)
workers/tests/hermes.workforce.orchestration.test.ts (new)
hermes/admin/index.ts                              (modified — adminViewWorkflows hunk only)
```

Explicitly **excluded** (parallel EPICs — not touched, not staged):

```
hermes/services/activation/provider-framework.ts
hermes/services/execution/index.ts
hermes/services/index.ts
hermes/contracts/platform-api.ts
hermes/services/security/**  (all)
hermes/agents/seed.ts
hermes/services/activation/git-provider.ts
hermes/admin/console/**
workers/tests/globalSetup.ts
workers/tests/hermes.security.004.test.ts
```

## 5. Reversibility

The commit adds new files and one additive hunk; no existing 003-005 behaviour
is removed. `git revert <sha>` cleanly undoes it without disturbing parallel
EPIC working trees (those files remain unstaged).

## 6. Remaining parallel work (informational only — NOT repaired)

- **EPIC-003-004**: `provider-framework.ts` health-type expansion +
  security-provider adapters (`oss-adapters`, `real-adapters`,
  `local-tool-detection`, `security-agent`, `security-providers`,
  `finding-aggregator`, `provider-health`, `security/index`) + `git-provider.ts`
  + `globalSetup.ts` (D1 seed idempotency) + `hermes.security.004.test.ts`.
  These carry the repo's 16 `tsc` errors and must be closed out in their own
  EPIC, on their own commit.
- **admin-console**: `bff-client.ts` / `ui-contracts.ts` literal drift.
- **agents**: `seed.ts` missing `activation` field.

None of the above were modified, absorbed, or repaired by this closeout.
