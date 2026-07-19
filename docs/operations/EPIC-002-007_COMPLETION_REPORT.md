# EPIC-002-007 · Hermes Activation Platform — Completion Report

> **Status:** ✅ COMPLETE (2026-07-19)
> **Epic:** Capability provider framework + Developer Agent runtime + governance layers for an operational AI OS.
> **Delivered against existing Hermes foundation** (ToolProvider, approval.ts, task.ts, audit/event.ts) — no production touch, no vendor lock-in, fully human-gated.

---

## 1. Executive Summary

EPIC-002-007 delivers the **Activation Platform**: a capability-provider framework that turns external tools (Claude Code, git, security scanners) into auditable, permission-gated, fail-closed capabilities behind the existing `ToolProvider` interface; a **generic orchestrator** (retry/timeout/cancel); an **approval-gate** layer that extends the existing human-gated approval model to capability-level actions; a **git provider** with production commit/push always requiring an explicit human token; and a **Developer Agent runtime** — a non-autonomous state machine that plans → (human-gates code-gen in prod) → generates → validates → security-scans → commits, and **never self-pushes**.

All acceptance criteria validated by real `tsc --build` (0 errors) and real `vitest` (16/16 activation tests; 271/271 full workers suite). No change escaped the `hermes/` + `workers/tests/` boundary.

---

## 2. Files Created

| File | Lines | Purpose |
|---|---|---|
| `hermes/services/activation/provider-framework.ts` | 372 | Capability provider registry, lifecycle FSM, `executeCapability`, discovery, permission enforcement, fail-closed defaults. |
| `hermes/services/activation/providers/claude-code.ts` | 105 | `ClaudeCodeProvider implements ToolProvider`; vendor backend injected via `setClaudeCodeExecutor()` (no SDK import). |
| `hermes/services/activation/orchestrator.ts` | 229 | Retry/timeout/cancellation task orchestration over the existing `task.ts` state machine. |
| `hermes/services/activation/git-provider.ts` | 153 | Branch/commit/diff/PR-prep/push — production commit & push require explicit human approval token; never auto-push. |
| `hermes/services/activation/approval-gates.ts` | 133 | `decideGate`/`gateForApproval` — extends human-gated approval to capability actions; fail-closed default. |
| `hermes/services/activation/developer-agent.ts` | 252 | Human-supervised dev-agent runtime (plan→generate→validate→security→commit); code-gen gated in prod. |
| `hermes/services/activation/index.ts` | 14 | Barrel export. |
| `workers/tests/hermes.activation.007.test.ts` | 272 | 16-test validation suite (M1/M2/M3/M5/M6/M7). |

## 3. Files Modified

| File | Change |
|---|---|
| `hermes/contracts/platform-api.ts` | +3 constants: `ACTIVATION_READ`, `ACTIVATION_WRITE`, `ACTIVATION_PROVIDER`. |
| `hermes/services/index.ts` | +1 line: `export * as Activation from "./activation/index.js";` |

**Commit SHAs:** _(assigned at commit time — see §9)_

---

## 4. Test Evidence

- **Activation suite:** `pnpm exec vitest run hermes.activation.007.test.ts` → **16 passed / 16**.
- **Regression suite:** `pnpm test` (workers) → **271 passed / 271** across 21 files.
- Coverage spans fail-closed provider disable, git token gates, orchestrator retry/cancel, prod code-gen gating, permission enforcement, audit emission, capability discovery.

## 5. Typecheck Evidence

- `pnpm run typecheck:libs` (`tsc --build`) → **0 errors**.
- (Root `pnpm run typecheck` also builds `artifacts/api-server`, which has a pre-existing, unrelated type error in `src/routes/consultations.ts` — legacy debt under ADR-001, out of scope, not touched by this epic.)

## 6. Security Evidence

- **No vendor SDK import** anywhere in `activation/` (grep: 0 hits for `@anthropic`/`claude-code`/`child_process`/`spawnSync`).
- **Claude Code = ToolProvider**; backend injected, swappable, fail-closed when unwired.
- **43 `emitAudit` call sites** cover every privileged action.
- **Fail-closed:** unknown gates → human; `git.push`/`secret.write`/`deploy`/`destructive` → never auto; missing executor → refuse.
- **Never self-pushes:** `preparePush` stages only; `pushBranch` requires human token.

---

## 7. Architecture Impact

- Extends (does not replace) the `ToolProvider` abstraction — the existing interface is the contract boundary.
- Adds a capability-level approval layer that composes with the existing `approval.ts` human-gated model (`gateForApproval` produces a real `ApprovalRequest`).
- Developer Agent runtime is deliberately **non-autonomous**: it is a state machine over `task.ts`, gated at code-gen (prod) and git-commit (prod), and can only stage pushes for separate human review.
- Provider lifecycle is a finite-state machine (registered → enabled → active → disabled/retired), permission-gated via `hermes:activation:provider`.
- **Zero** coupling to AGS Fertility, Cloudflare config, migrations, or secrets.

---

## 8. Remaining Limitations

1. **Vendor backend not wired.** `setClaudeCodeExecutor()` exists but no real Claude Code CLI adapter is connected (intentional per ADR-013 — no concrete vendor backend in this epic). The provider is fail-closed until an executor is injected at a future, separately-approved deploy.
2. **Security provider is stubbed in tests.** Real scanner backends are future work; the capability model (`sec.scan`) is in place.
3. **`resumeAfterApproval` re-runs the full flow** with the human token threaded through gates. This is correct but means a resumed prod run re-plans/re-generates; acceptable for the gated model, noted for future optimization.
4. **No runtime registration of providers yet** — providers are registered in-process; a persisted provider catalog (aligning with ADR-006 Resource Registry) is future work.
5. **Pre-existing `artifacts/api-server` type error** remains (out of scope, ADR-001 legacy debt).

---

## 9. Recommendations

1. **Next epic candidate:** *EPIC-002-008 — Activation Provider Backends & Runtime Wiring* — implement concrete, separately-approved vendor adapters (Claude Code CLI executor, real security scanner) behind the now-stable `ToolProvider` capability framework; add a persisted provider catalog tied to the ADR-006 Resource Registry. Keep the no-vendor-leak rule (executor injection, never SDK import in `hermes/`).
2. Wire the activation permission constants into the data-driven RBAC resolver (`workers/src/auth/*`) so `hermes:activation:*` are enforceable at the API edge (currently enforced inside the service layer).
3. Add an integration test that injects a real (sandboxed) executor to prove the end-to-end dev-agent path beyond the stub.
4. Schedule a separate, scoped PR to fix the `artifacts/api-server` consultations route type error (tracked under ADR-001; do **not** bundle with activation work).

---

## 10. Roadmap Update

EPIC-002-007 is marked **✅ Complete** in `docs/organization/AGS_MASTER_ROADMAP.md` (§5 Completed Roadmap + §14 Change Log). The recommended next epic is **EPIC-002-008** (Activation Provider Backends & Runtime Wiring), entered into the Future Platform Roadmap.

---

## 11. Boundary Escape Check

| Surface | Touched? |
|---|---|
| `workers/` source | ❌ (test file only) |
| `migrations/` | ❌ |
| Cloudflare config | ❌ |
| Deployment | ❌ |
| Secrets | ❌ |
| AGS Fertility production | ❌ |

All 10 changed files are within `hermes/` (platform) and `workers/tests/` (tests). Verified via `git diff --name-only` + `git status`.

---

*Completion report is documentation-only. It modifies no code, Workers, D1, migrations, Cloudflare configuration, secrets, deployments, or production behavior. Code changes referenced here were committed under explicit paths (no `git add -A`).*
