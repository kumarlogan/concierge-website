# EPIC-002-007 · Hermes Activation Platform — Validation Report

> **Status:** ✅ COMPLETE — validated 2026-07-19
> **Scope:** Capability provider framework, Developer Agent runtime, and governance layers for an operational AI OS, built on existing Hermes foundations (ToolProvider, approval.ts, task.ts) without touching production.
> **Authoritative validation:** real `tsc --build` + real `vitest` execution. No simulated output.

---

## 1. Validation Summary

| Gate | Command | Result |
|---|---|---|
| Library typecheck (all `hermes/**`) | `pnpm run typecheck:libs` (`tsc --build`) | ✅ 0 errors |
| Activation test suite | `pnpm exec vitest run hermes.activation.007.test.ts` | ✅ **16/16 pass** |
| Full workers suite (regression) | `pnpm test` (from `workers/`) | ✅ **271/271 pass** (21 files, 0 regressions) |
| Boundary check (Hermes-only) | `git diff --name-only` | ✅ only `hermes/` + `workers/tests/` changed |

**Note on full-project `pnpm run typecheck`:** the root script also builds `artifacts/api-server`, which has a **pre-existing, unrelated** type error in `src/routes/consultations.ts` (field-name mismatch vs. Drizzle insert type). This is legacy technical debt already tracked under **ADR-001** and explicitly out of scope for this epic. My changes do not touch `artifacts/api-server`. The authoritative check for the Activation Platform is `typecheck:libs`, which is green.

---

## 2. Test Evidence — `hermes.activation.007.test.ts` (16 tests)

**M1 · Capability Provider Framework (fail-closed)**
- ✅ refuses capability execution when no active provider exists
- ✅ executes only when provider is active + enabled + healthy
- ✅ disables stop execution (fail-closed)

**M2 · Git Provider (approval gates)**
- ✅ pushBranch refuses without an approval token
- ✅ commit in production requires an approval token
- ✅ createBranch works and preparePush does NOT push
- ✅ push / deploy / destructive / secret NEVER auto-approve
- ✅ git.commit is human-gated only in production

**M3 · Orchestrator (retry / timeout / cancel)**
- ✅ retries on recoverable failure then succeeds
- ✅ marks terminal failure without retry
- ✅ honors cancellation

**M5 · Developer Agent Runtime (human-supervised)**
- ✅ gates code generation behind human approval in production
- ✅ resumeAfterApproval commits (with token) and prepares push but never pushes
- ✅ enforces activation permission (no token → denied)
- ✅ does NOT import any vendor SDK and exposes `dev.code.*` capabilities

**M6 · Audit Emission**
- ✅ emits audit events for privileged actions (provider lifecycle, capability exec, git ops, gates, orchestration, dev-agent)

**M7 · Capability Discovery + Permission**
- ✅ discovers capabilities and enforces `hermes:activation:provider` permission

**Full workers regression:** 271/271 passing across 21 test files — confirms no collateral breakage to existing Hermes/Admin/Auth/Console suites.

---

## 3. Typecheck Evidence

```
$ pnpm run typecheck:libs
$ tsc --build
# exit 0 — 0 errors across all hermes/ packages including the new activation module
```

The activation module compiles cleanly against the existing `ToolProvider`, `approval.ts`, `task.ts`, and `audit/event.ts` contracts. Resolved during validation:
- `decideGate` originally threw on unknown gate actions (`dev.code.generate`) → fixed to **fail-closed** (returns `human` for missing/unknown policy).
- `gateActionToToolAction` widened from `GateAction` to `string` with `dev.code.* → "write"` so capability-level approvals route correctly.
- Module resolution paths normalized to `../agents/*.js` from `services/activation/`.

---

## 4. Security Evidence

| Control | Evidence | Status |
|---|---|---|
| No vendor SDK leak | `claude-code.ts` has **0** imports of `@anthropic`, `claude-code`, `child_process`, `spawnSync`. Vendor backend injected via `setClaudeCodeExecutor()` (fail-closed: "not wired" error with no executor). | ✅ |
| Claude Code = ToolProvider | `class ClaudeCodeProvider implements ToolProvider`; backend swappable. | ✅ |
| Human approval enforced | `dev.code.generate` gated in `production`; `git.commit`/`git.push`/`secret.write`/`deploy`/`destructive` NEVER auto-approve (gate policy `human: [all envs]`). | ✅ |
| Audit for all privileged actions | 43 `emitAudit` call sites: provider lifecycle, capability exec, git ops, gates, orchestration, dev-agent. | ✅ |
| Fail-closed default | `decideGate` unknown → `human`; `capabilityApprovalRequirement` missing desc → `human`; executor missing → refuse. | ✅ |
| No direct agent ops | All privileged work flows through Hermes services (provider-framework, git-provider, orchestrator, approval-gates), never raw shell/agent bypass. | ✅ |
| Agent autonomy constrained | Dev agent is a state machine (`created → approved → running`); never self-pushes; `preparePush` only stages, `pushBranch` requires explicit human token. | ✅ |
| Permission-gated provider mgmt | `enable/disable/retireProvider` require `hermes:activation:provider`; missing → denied + audited. | ✅ |
| No production deploy path | 0 `wrangler deploy` / migration / secret writes in activation code. | ✅ |

---

## 5. Architecture Verification (M10 §5)

| Check | Result |
|---|---|
| Provider abstraction preserved | ✅ `ToolProvider` interface unchanged; new `CapabilityProvider` extends it; concrete backends injected, not imported. |
| Claude Code remains a ToolProvider | ✅ implements `ToolProvider`; neutral `dev.code.*` capability ids. |
| No vendor lock-in introduced | ✅ no vendor package in `package.json` deps; executor injected at init; swappable. |
| Human approval enforced | ✅ see §4. |
| Audit emitted for all privileged actions | ✅ 43 sites, see §4. |
| Provider lifecycle validated | ✅ registered → enabled → active → disabled/retired finite-state machine, permission-gated. |
| Fail-closed behavior maintained | ✅ see §4. |
| Agent autonomy constraints preserved | ✅ task-state machine + human-gated git gates; never auto-push. |
| Import boundaries maintained | ✅ activation imports only `../agents/*.js`, `../../audit/event.js`, `../../contracts/*`; no app/platform-internal leaks. |
| No production deployment path introduced | ✅ see §4. |

---

## 6. Boundary Escape Check (M10 §8)

Explicit verification that no change escaped Hermes boundaries:

| Surface | Touched? | Evidence |
|---|---|---|
| `workers/` (source) | ❌ only `workers/tests/` | test file added; no `workers/src` change |
| `migrations/` | ❌ | `git status` clean for migrations |
| Cloudflare config | ❌ | no `wrangler.toml`/`.tf`/`.json` change |
| Deployment | ❌ | no `wrangler deploy`/pipeline invocation |
| Secrets | ❌ | no `.env`/secret file change; 0 secrets in diff |
| AGS Fertility production | ❌ | `artifacts/`, `applications/`, `src/routes/consult*` untouched |

---

## 7. Files Changed

**Created (8):**
- `hermes/services/activation/provider-framework.ts` (372 lines)
- `hermes/services/activation/providers/claude-code.ts` (105 lines)
- `hermes/services/activation/orchestrator.ts` (229 lines)
- `hermes/services/activation/git-provider.ts` (153 lines)
- `hermes/services/activation/approval-gates.ts` (133 lines)
- `hermes/services/activation/developer-agent.ts` (252 lines)
- `hermes/services/activation/index.ts` (14 lines)
- `workers/tests/hermes.activation.007.test.ts` (272 lines)

**Modified (2):**
- `hermes/contracts/platform-api.ts` — +3 activation permission constants (`ACTIVATION_READ/WRITE/PROVIDER`)
- `hermes/services/index.ts` — +1 barrel export (`export * as Activation`)

Total: **+1,535 lines**, 10 files, 0 deletions to existing logic.

---

## 8. ADR Determination

**No new ADR created.** The architecture implemented in EPIC-002-007 was already ratified by:
- **ADR-008** (Hermes Platform Core Services) — Provider Adapter boundary.
- **ADR-013** (Admin BFF & AI Workforce Foundations) — explicitly ratified the neutral capability model (`dev.code.*` vendor-neutral ids), the `ToolProvider` interface as the boundary, and rejected wiring concrete vendor backends ("Wire a concrete vendor tool backend now: **rejected**").
- **ADR-002** (Multi-Agent Ops) — human-gated autonomy.

EPIC-002-007 *implements* those decisions (a `ToolProvider`-based capability framework + human-supervised dev-agent runtime). The one design choice made — injecting the vendor executor via `setClaudeCodeExecutor()` so the SDK is never imported into Hermes — is exactly the "drop-in by implementing `ToolProvider`" path ADR-013 anticipated and is consistent with its no-vendor-leak rule. A new ADR would be redundant.

---

*Validation report is documentation-only. It modifies no code, Workers, D1, migrations, Cloudflare configuration, secrets, deployments, or production behavior.*
