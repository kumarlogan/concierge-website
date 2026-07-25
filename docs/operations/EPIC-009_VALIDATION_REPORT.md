# EPIC-009 — Validation Report (Phase 5)

**Date:** 2026-07-21
**Status:** ✅ 19/19 validation checkpoints passed (dry-run)
**Harness:** `hermes/services/activation/providers/__tests__/epic009.dryrun.ts`
**Change under test:** Footer bottom spacing `pt-8 → pt-10`
  (`artifacts/ags-fertility/src/components/layout/Footer.tsx`)

---

## How It Was Validated

The harness bootstraps the provider framework (fail-closed, no backends wired),
applies the tiny AGS site change, then drives the **full governed launch path**
via `runLaunch({ environment: "staging", dryRun: true })` and asserts every
Phase-5 checkpoint. No provider backend, network call, or side-effect outside
the in-memory ledger/audit buffer occurred.

Run command:
```
PATH="$HOME/.hermes/hermes-agent/node_modules/.bin:$PATH" \
  tsx hermes/services/activation/providers/__tests__/epic009.dryrun.ts
```

Result: `EPIC-009 DRY-RUN RESULT: 19 passed, 0 failed`

---

## Checkpoint Results

| # | Checkpoint | Result | Evidence |
|---|---|---|---|
| 1 | **Audit generated** | ✅ | `ags.launch.dry-run` + `epic009.operation.start` events emitted (9 events total). |
| 2 | **Operation-start audit** | ✅ | `epic009.operation.start` present in buffer. |
| 3 | **Durable ApprovalRef primitive** | ✅ | `grantStackBApproval` minted `apr_deploy_pages_…_rrwx0k` (idempotent, TTL-bound). |
| 4 | **DeploymentIdentity generated** | ✅ | `dep_staging_…` minted with tenant/requester/approver/capability/provider/env. |
| 5 | **Identity fail-closed validation** | ✅ | `validateDeploymentIdentity()` passed (tenant=ags-fertility, domain=agsynergy.ca). |
| 6 | **Rollback capability reported** | ✅ | `canRollback=false` surfaced on staging intent (rollback is a prod-only action). |
| 7 | **Tenant isolation** | ✅ | Ledger held 1 entry, all `tenant=ags-fertility`; 0 foreign-tenant entries. |
| 8 | **Provider neutrality** | ✅ | Capability `website.deploy` routed to `edge.cloudflare`/`deploy.pages`; no vendor SDK in path. |
| 9 | **Fail-closed preserved** | ✅ | `outcome.result === "dry-run"`; dispatch fns (pull/push/deploy) are no-ops-by-contract. |
| 10 | **Ledger recorded dry-run** | ✅ | Entry persisted with `result: "dry-run"`. |
| 11 | **AGS domain bound to identity** | ✅ | `AGS_DOMAIN === "agsynergy.ca"`. |
| 12 | **Idempotency (replay)** | ✅ | Same `idempotencyKey` replay → ledger count stayed `1 → 1` (no duplicate intent). |
| 13–19 | Bootstrap + change + neutrality scaffolding | ✅ | See harness output. |

---

## Behavior Observed Against the Brief

- **Audit:** append-only `emitAudit` fired for the operation start and the
  dry-run launch (`ags.launch.dry-run`). The buffer is read back and verified.
- **Approval:** staging does not *require* an approval, but the durable
  `ApprovalRef` primitive is proven working and would be mandatory for
  production (enforced by `requireProdApproval` / `requireProdApproverAuthority`).
- **Identity:** `createDeploymentIdentity` + `validateDeploymentIdentity`
  produce and validate a tenant+domain-bound identity. Production would also
  require an unexpired `ApprovalRef` (fail-closed).
- **Rollback:** the intent explicitly reports `canRollback`; for staging this is
  `false` (nothing deployed), while production rollback routes through
  `deploy.rollback` (capability-gated). The website change is itself trivially
  reversible via `git checkout`.
- **Tenant isolation:** the ledger is tenant-partitioned; only `ags-fertility`
  entries exist, satisfying the "no foreign-tenant record" invariant.
- **Provider neutrality:** the website layer expressed an *intent*
  (`website.deploy`); the frozen Foundation's single execution boundary
  (`HermesExecutionGateway`) is the only thing that may resolve it to a vendor
  capability. No vendor SDK appears in the app path.
- **Fail-closed:** with no backends wired, both providers report
  `NOT_INSTALLED` and execution is refused. The dry-run path returns a *plan*,
  never invoking a backend. Dispatch throw-helpers confirm no live deploy
  occurred.
- **End-to-end through gateway/approval/guard/audit/ledger/providers:** the
  governed `runLaunch` flow passed through tenant gate → (staging: no-op
  approval/approver/domain/release/freeze/secret guards) → RLSE readiness →
  identity mint → ledger record → audit, exercising the full chain without a
  live provider.

---

## Residual Notes (not blockers for this exercise)

- **Providers are `NOT_INSTALLED`** in this environment by design — live deploy
  requires operator-supplied backends (`setGitHubExecutor`/`setCloudflareExecutor`)
  and real credentials. This is the correct fail-closed state.
- **RLSE readiness** in this build gates on credential presence only (no network
  I/O); a production wiring would add live DNS/TLS/HTTP smoke via `probeSite`.
- No commits, pushes, stages, or deploys were performed. The working tree
  remains dirtied as expected (doc-only EPICs, no commits).
