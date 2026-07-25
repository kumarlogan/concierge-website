# AGS Activation Baseline — Hermes Platform v1.0

> **Night Prompt:** PHASE 0 — Readiness Baseline
> **Date:** 2026-07-21
> **Scope:** Controlled AGS (agsynergy.ca) operational activation on the FROZEN Hermes Foundation (Class B).
> **Authority:** Documentation only. No Foundation change, no commit, no deploy, no secret connection.

---

## 1. Source Documents Reviewed

| Doc | Verdict |
|---|---|
| `HERMES_V1_OPERATIONAL_CHECKPOINT.md` | ✅ Reviewed — Foundation FROZEN, deferred backlog D1–D6 catalogued |
| `EPIC-008_COMPLETION_REPORT.md` | ✅ Reviewed — pilot complete; 7/8 AGS, 15/15 EPIC-007, 8/8 trust, 7/7 approval |
| `EPIC-007_COMPLETION_REPORT.md` | ✅ Reviewed — 15/15 guarantee suite verified by real execution |
| `EPIC-008_VALIDATION_REPORT.md` | ✅ Reviewed — PHASE2 readiness + PHASE4 test matrix |
| `EPIC-008_BASELINE.md` | ✅ Reviewed — INCLUDE/EXCLUDE scope + non-negotiable constraints |
| `AGS_PROVIDER_INTEGRATION.md` | ✅ Reviewed — provider-neutral capability layer, 18/18 integration |
| `AGS_PROVIDER_READINESS.md` | ✅ Reviewed — AGS-ready by construction, zero AGS core code |
| `AGS_PROVIDER_SECURITY_READINESS.md` | ✅ Reviewed — all 4 provider classes safe under EPIC-005.4 guard |

---

## 2. Foundation Readiness — CONFIRMED ✅

| Control | State | Evidence |
|---|---|---|
| Frozen | ✅ | `HermesExecutionGateway` / `ProviderRuntimeGuard` unmodified; Class B freeze |
| Trust complete | ✅ | Trust regression suite **8/8** (checksum + REAL ed25519) — executed this session |
| Approval complete | ✅ | Approval regression suite **7/7** (single durable `ApprovalRef`, fail-closed) — executed this session |
| Audit complete | ✅ | `emitAudit` on every governance step; ledger auditReference correlation (G9) |
| Gateway enforced | ✅ | Single execution boundary; all capability exec routes through `HermesExecutionGateway` |

## 3. AGS Capability Readiness — CONFIRMED ✅ (code-complete, verified)

| Capability | State | Evidence |
|---|---|---|
| GitHub backend connection interface | ✅ | `connectGitHubBackend()` + `port.ts` fail-closed until wired |
| Cloudflare backend connection interface | ✅ | `connectCloudflareBackend()` + `port.ts` fail-closed until wired |
| Deployment workflow | ✅ | `agsLaunch` → `runLaunch` — 15/15 guarantee suite, executed this session |
| Rollback controls | ✅ | `G4b` pre-flight gate + `deploymentLedger.revoke()` + `wrangler deployments rollback` |
| Audit controls | ✅ | 6 `ags.launch.*` events + ledger; tenant-isolated |
| Secret boundary | ✅ | `SecretSource` — no credential in source; missing secret ⇒ `NOT_INSTALLED` |

## 4. Real Activation Blockers (deploy-time, by design — NOT code defects)

These are **operator-held** conditions the platform correctly refuses to satisfy autonomously. The platform is *supposed* to be fail-closed until these are met.

| # | Blocker | Class | Required Operator Action |
|---|---|---|---|
| B1 | No `GITHUB_TOKEN` / `CF_API_TOKEN` in secret source | Deploy-time | Inject via `SecretSource` (env/vault) at runtime |
| B2 | Stale Cloudflare Workers token (53-char `cfat_` → 401 per workspace memory) | Deploy-time | Mint fresh ~100-char token; verify via `/user/tokens/verify` |
| B3 | Real `gh`/`wrangler` backends not wired in this repo | Deploy-time | Call `connectGitHubBackend`/`connectCloudflareBackend` at platform boot |
| B4 | Production deploy needs a human `ApprovalRef` | By design | Operator grants via `grantStackBApproval` |
| B5 | Durable `FileDeploymentLedgerBackend` not wired at startup (in-memory default) | Deploy-time | `configureDeploymentLedger(FileBackend)` once at production startup |
| B6 | **`pipeline.sh` referenced by readiness doc does NOT exist** | Doc/glue gap | Use the governed `agsLaunch()` path (see runbook) — no external script exists |

## 5. Caveats / Discrepancies Found

- **`pipeline.sh` is absent.** `AGS_PROVIDER_READINESS.md` (§A5) assumes `hermes-website/pipeline.sh` exists as the external deploy trigger. It does not. The authoritative live path is `agsLaunch()`/`runLaunch` in `services/activation/providers/deployment/`. The runbook is written against the real code.
- **Dirty working tree.** The repo has many pre-existing modified/untracked files from prior epics. Not acted upon (stop condition: no commit/stage). Operators should reconcile before first live deploy.

---

*Baseline established 2026-07-21. Proceed to PHASE 1 deferred-item review.*
