# AGS Activation Gate Decision (PHASE 6)

> **Classification:** ✅ **READY FOR STAGING** — ⛔ **NOT READY FOR PRODUCTION**
> **Date:** 2026-07-21
> **Basis:** Code review of the live activation seam + re-execution of all regression/safe suites.

## 1. Evidence (re-verified this session)
| Area | Result |
|---|---|
| Foundation frozen | ✅ No gateway/guard modification. |
| EPIC-007 launch guarantee | 15/15 pass |
| Trust (checksum + ed25519) | 8/8 pass |
| Approval (single durable ref) | 7/7 pass |
| AGS integration (gateway routing) | 18/18 pass |
| AGS bootstrap (fail-closed) | 11/11 pass |
| **PHASE 5 safe validation** | **21/21 pass** (dry-run, missing-secret, missing-approval, invalid-tenant, audit, identity, rollback/replay) |

## 2. Staging Readiness Verdict — READY
- The governed `agsLaunch` path executes staging end-to-end with all gates met (PHASE 5 §[5] succeeded with fake spawner; no real network).
- Fail-closed behavior confirmed for: missing secrets, missing approval (prod), invalid tenant, replay.
- Bootstrap correctly leaves providers `NOT_INSTALLED` without creds/backend, and refuses capability execution until wired.

## 3. Production Readiness Verdict — NOT READY (by design + operability items)
Production is intentionally gated behind a human `ApprovalRef`, an authorized approver, AGS domain ownership, a semantic release tag, a change-freeze guard, and live secret validity. Those gates are **implemented and verified** — but 7 operator-held conditions remain before a *real* production deployment can be attempted:

## 4. Blockers
| # | Blocker | Blocker for | Action |
|---|---|---|---|
| B1 | Cloudflare token-name split (`CLOUDFLARE_API_TOKEN` vs `CF_API_TOKEN`) | Real Cloudflare deploy (staging **and** prod) | Set both names to same value; or unify ref (1-line, non-Foundation). |
| B2 | No `GITHUB_TOKEN` / `CF_API_TOKEN` in secret source | Any real deploy | Inject at runtime. |
| B3 | Stale CF Workers token (53-char `cfat_` → 401) | Real CF auth | Mint fresh ~100-char token; verify `/user/tokens/verify`. |
| B4 | Real `gh`/`wrangler` backends not wired in this repo | Real execution | `connectGitHubBackend`/`connectCloudflareBackend` at boot. |
| B5 | Human `ApprovalRef` for production | Production only | Operator grants durable approval. |
| B6 | Durable `FileDeploymentLedgerBackend` not wired | Production durability | `configureDeploymentLedger(FileBackend)` at startup. |
| B7 | Dirty working tree (149 entries) | Any real deploy hygiene | Operator reconciles; no commit done here. |

## 5. Operator Actions Required (to reach staging-ready-to-execute)
1. Reconcile working tree (B7).
2. Provision `SecretSource` with `GITHUB_TOKEN`, and `CLOUDFLARE_API_TOKEN` **+** `CF_API_TOKEN` (same value) (B1, B2).
3. Replace stale CF token (B3).
4. Wire real backends at bootstrap (B4).
5. Run the dry-run (PHASE 4 §4); confirm `dry-run` + 0 calls.
6. Run the staging execution (PHASE 4 §5); confirm `success` + validation checklist.

## 6. Security Assessment
- **Provider neutrality preserved:** AGS uses the same `registerProvider` path as any Stack B provider; no AGS-specific core code.
- **Single execution boundary preserved:** all capability execution routes through `HermesExecutionGateway`.
- **Fail-closed preserved:** every guard throws; denials are ledger-recorded + audited; no fabricated success.
- **Tenant isolation preserved:** ledger reads/writes are tenant-scoped; cross-tenant queries return nothing (G7).
- **Secret hygiene:** no credential in source; `SecretSource` resolves at runtime; bootstrap logs no secrets.
- **Residual risk (non-blocking for staging):** the token-name split (B1) creates fragile dual-secret provisioning and an opaque "readiness OK / deploy fails" failure mode if only one name is set. Must be set correctly for the real deploy to succeed.

---

*Gate decision: STAGING READY (code + controls). PRODUCTION gated on B1–B6 operator actions and an explicit human approval.*
