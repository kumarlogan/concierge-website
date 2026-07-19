# EPIC-002-006D — Execution Plan (Night Execution Mode)

> **Mission:** Transform Hermes AI Registry from a catalog of registered agents
> into a *controlled AI workforce management platform* — governance, assignment,
> lifecycle, permission, and task management. **Not** autonomous AI deployment.
>
> **Baseline:** `main` @ `158/158 tests passing`, working tree clean.
> **Pre-state:** EPIC-002-006A (secure baseline), 006B (Identity/Permissions/
> Audit/Providers extracted), 006C (Resource Registry, Discovery, Lifecycle,
> AI Registry Runtime, Provider abstraction, internal platform contracts).

---

## 1. Current Architecture (verified)

| Layer | Module | State |
|---|---|---|
| Agent Registry | `hermes/agents/registry.ts` | 8 agents seeded, all `disabled`/`non-autonomous` |
| Workforce seed | `hermes/agents/seed.ts` | `seedAgentWorkforce()`, `assertWorkforceSafety()` |
| Identity | `hermes/identity/{types,principal,providers}.ts` | `Principal`, `AuthorizationDecision`, `AuthError` |
| Permissions | `hermes/permissions/{permissions,middleware}.ts` | `resolveEffectivePermissions`, `hasPermission` |
| Audit (provider-neutral) | `hermes/audit/event.ts` | `emitAudit`, in-memory buffer + optional sink |
| Audit (D1-backed) | `hermes/audit/audit.ts` | `writeAuditEvent` (auth decisions) |
| Lifecycle | `hermes/services/lifecycle/lifecycle.ts` | `transitionAgent` w/ `authorized` gate |
| Lifecycle contract | `shared/contracts/lifecycle.ts` | `AgentLifecycleState` = registered→assigned→approved→active→paused→retired |
| Registry Service | `hermes/services/registry/registry.ts` | provider-neutral resource inventory |
| Discovery | `hermes/services/discovery/discovery.ts` | queries registry; never hardcodes topology |
| Platform API contracts | `hermes/contracts/platform-api.ts` | `Principal`, `Authorizer`, `PLATFORM_PERMISSIONS` |
| Tests | `workers/tests/hermes.*.test.ts` | 158 passing |

**Key invariant already enforced by 006C:** every agent is registered DISABLED,
NON-AUTONOMOUS; activation requires explicit `authorized` flag; no auto-activation.

---

## 2. Implementation Phases

| # | Deliverable | Module(s) |
|---|---|---|
| 0 | Execution plan + safety baseline | this doc |
| 1 | Agent Assignment Service | `hermes/services/agents/assignment.ts` |
| 2 | Agent Approval Workflow | lifecycle gates in `assignment.ts` + `lifecycle.ts` reuse |
| 3 | Agent Task Framework | `hermes/services/agents/task.ts` |
| 4 | Agent Permission Boundary | `hermes/services/agents/permissions.ts` |
| 5 | Agent Memory Boundary | `hermes/services/agents/memory.ts` |
| 6 | Workforce Events & Audit | `hermes/workforce/events.ts` |
| 7 | Internal Workforce API Contracts | `hermes/contracts/workforce-api.ts` |
| 8 | Admin Platform foundation prep | `EPIC-002-006E_PREPARATION.md` |
| 9 | Validation | `EPIC-002-006D_PROGRESS.md`, `EPIC-002-006D_VALIDATION_REPORT.md` |

All new code is **contract + state-machine + in-memory store only**. No D1
migrations, no Cloudflare/Worker changes, no AGS Fertility behavior changes, no
secrets, no public exposure, no autonomous execution.

---

## 3. Affected Components

- **New files** under `hermes/services/agents/` (`assignment`, `task`,
  `permissions`, `memory`, `index`), `hermes/workforce/events.ts`,
  `hermes/contracts/workforce-api.ts`.
- **Touched (additive only):** `hermes/agents/index.ts` (re-export workforce),
  `hermes/contracts/index.ts` (re-export workforce-api), `hermes/services/index.ts`.
- **No changes** to: `workers/src/**` (AGS runtime), migrations, `wrangler.jsonc`,
  `config/`, any secret, any production code path.

---

## 4. Rollback Strategy

- Every commit is atomic and additive (new files + barrel re-exports).
- No migration or destructive schema change → rollback = `git revert <sha>`.
- In-memory stores have `_clear*` test helpers; nothing persists to D1.
- Each phase independently removable without breaking prior phases.

---

## 5. Validation Gates (must all pass before commit)

1. `pnpm test` → 158 prior tests **still pass** + new tests added.
2. `pnpm typecheck` (workers + libs) → clean.
3. Secret scan (`grep` for tokens / `git secrets`-style check) → clean.
4. `assertWorkforceSafety()` still green → all agents disabled/non-autonomous.
5. No production code path touched (verified by `git diff --stat`).

---

## 6. Execution Principles (non-negotiable)

1. Human-controlled activation. 2. Least privilege. 3. Every action audited.
4. No agent activation without explicit approval. 5. No production actions.
6. No secrets. 7. No app-data ownership by agents. 8. No cross-app access w/o permission.
9. Every phase reversible.

## 7. Stop Conditions (halt immediately)

- production deployment required · secrets required · unapproved migrations
- AGS Fertility behavior changes · autonomous execution introduced
- architecture violates ADR-007/008.

> None of the above are triggered by this plan's scope.
