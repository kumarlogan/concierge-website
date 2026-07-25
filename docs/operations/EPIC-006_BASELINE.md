# EPIC-006 — Runtime Provider Integration · BASELINE (Phase 0)

**Date:** 2026-07-21
**Precondition:** Hermes Platform Foundation v1.0 FROZEN (Classification B). EPIC-005.9 COMPLETE & verified.
**Objective of this doc:** Record the recovery baseline before any EPIC-006 change. Stop if architecture drift is detected.

---

## 1. Drift check — RESULT: NO DRIFT

| Forbidden pattern | Found? | Where | Verdict |
|---|---|---|---|
| `bypass` | 1 (comment) | `provider-framework.ts:536` — "no caller may bypass the guard" (enforces guard) | ✅ safe |
| `skipGuard` | 0 | — | ✅ |
| `human-token` | 0 | — | ✅ |
| `direct provider.execute` / `provider.execute(` | 0 | — | ✅ |
| `always allow` | 0 | — | ✅ |
| vendor SDK import (`wrangler`/`octokit`/`@actions/github`/`gh api`) | 0 in code | only in comments + integration-test mock | ✅ |

**Conclusion:** Foundation is intact. Proceed with EPIC-006 (wiring-only).

---

## 2. Current provider registration state

| Provider | ID | Capabilities | Executor port | Health (unwired) |
|---|---|---|---|---|
| GitHub | `vcs.github` | 6 (`code.vcs.*`) | `github/port.ts` → `connectGitHubBackend()` | `not_installed` |
| Cloudflare | `edge.cloudflare` | 7 (`deploy.*`, `ops.*`) | `cloudflare/port.ts` → `connectCloudflareBackend()` | `not_installed` |

Both are registered via the **same** `registerProvider → enableProvider → setProviderHealth` seam as `claude-code.ts`. Neither is auto-enabled; `registerGitHubProvider`/`registerCloudflareProvider` exist but are **NOT called at startup** (bootstrap gap).

## 3. Current website capability layer

`activation/providers/website.ts` — thin provider-neutral routing over `executeCapability` (→ `HermesExecutionGateway`). Current 7 app capabilities:

```
website.deploy      → edge.cloudflare / deploy.pages
website.preview     → edge.cloudflare / deploy.pages
website.rollback    → edge.cloudflare / deploy.rollback
website.health      → edge.cloudflare / ops.health
website.logs        → edge.cloudflare / ops.logs
website.analytics   → edge.cloudflare / ops.analytics
website.version     → edge.cloudflare / deploy.history
```

⚠️ **Capability-set discrepancy (reconcile in Phase 4):** EPIC-006 Phase 4 names
`website.status`, `website.build`, `website.publish` which are **not** in the current set
(current has `logs`, `analytics`, `version` instead). Plan: add the three named ones as routes
to existing underlying capabilities; keep the extras. Net effect: superset that satisfies both.

## 4. Existing gateway path (verified, unchanged by EPIC-006)

`executeCapability(capabilityId, args, {actor, env, approvalRef?})`:
1. `resolveProviderForCapability` — fail-closed if no **active+enabled+healthy** provider.
2. Approval gate — capabilities with `requiresApprovalIn:["production"]` need a durable `ApprovalRef` (minted only by `grantStackBApproval`, backed by durable `ExecutionApproval`).
3. Executor-present gate — no executor ⇒ refusal (never fabricated).
4. `HermesExecutionGateway.execute(...)` with `StackBGatewayGuard` (lifecycle/health + cross-tenant scope) + `ExecutionPolicyEvaluator` + durable `stackBApprovals` service.
5. Every branch emits an `emitAudit(...)` event.

**Fail-closed guarantees already present:**
- No active provider ⇒ `"No active provider resolves capability: ..."`
- Missing approval ⇒ `"... requires a durable human approval (ApprovalRef) ..."`
- No executor ⇒ `"Provider <id> has no executor wired ..."`
- Cross-tenant ⇒ `"cross-tenant execution denied (A → B)"`

## 5. Existing GitHub / Cloudflare provider files (unchanged by EPIC-006)

```
activation/providers/github/{provider,port}.ts
activation/providers/cloudflare/{provider,port}.ts
activation/providers/website.ts
activation/providers/__tests__/ags.integration.ts   (18/18 passing, real gateway path)
```

## 6. Existing tests (Foundation regression)

- `hermes/services/providers/__tests__/epic-005.9.test.ts` (+ P1 smoke in `workers/`)
- `hermes/services/providers/__tests__/epic-005.{1,3,5,7a,8}.test.ts`
- `hermes/services/execution/gateway/__tests__/epic-005.6.test.ts` (single boundary)
- `hermes/services/activation/providers/__tests__/ags.integration.ts` (EPIC-AGS, 18/18)

Full vitest corpus cannot run in this sandbox (vitest not installed); the AGS integration
test runs via `tsx` (`node_modules` of hermes-agent) against real gateway code.

---

## 7. Gaps to close in EPIC-006 (per phase)

| Phase | Gap vs baseline |
|---|---|
| 1 | No explicit **typed backend contract** for GitHub (commit/push/branch/status) or Cloudflare (build/deploy/status/rollback). Port is generic `CapabilityExecutor`. |
| 2 | **No secret/config layer.** Missing-credential → still wires executor generically; no `NOT_INSTALLED` driven by config absence. |
| 3 | **No bootstrap** module; providers never registered at startup; no manifest/credential validation step. |
| 4 | Website capability set mismatch (see §3). Need validation that every `website.*` routes through gateway with tenant→policy→approval→guard→exec→audit. |
| 5 | **No dry-run** path (`website.deploy.preview`) that resolves the full decision path without executing the backend. |
| 6 | Durable `ApprovalRef` exists, but **no operator-approval adapter** binding tenant/capability/provider/requester/expiry from a Telegram/Hermes operator flow. |
| 7 | Need EPIC-006-specific tests (missing creds, untrusted provider, wrong tenant, dry-run-no-exec, audit produced, rollback via gateway) + full forbidden-pattern sweep. |

---

## 8. Approval to proceed

Baseline is coherent with the frozen Foundation. No redesign required. EPIC-006 may proceed
as a **wiring-only** change on top of the existing seams.
