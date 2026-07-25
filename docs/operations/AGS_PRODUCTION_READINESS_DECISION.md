# AGS Production Readiness Decision — Hermes Platform v1.0

> **Night Prompt:** PHASE 5 — Production Activation Decision
> **Classification:** ⚠️ **NOT READY** (for autonomous/one-click production activation)
> **Rationale:** The **platform code is production-grade and verified** (15/15, 8/8, 7/7 suites green by execution). Readiness gaps are exclusively **operator-held deploy-time conditions** the platform is *designed* to refuse until satisfied — not Foundation defects.

---

## 1. Classification

| Dimension | Status |
|---|---|
| Foundation (frozen, trust, approval, audit, gateway) | ✅ READY |
| AGS capability code (github/cloudflare/workflow) | ✅ READY (verified) |
| **Operator deploy readiness** (secrets, tokens, real backends, durable ledger, human approval) | ⛔ NOT READY |

**Overall: NOT READY for production activation** — pending operator actions B1–B5 below.

## 2. Blocking Items (real, deploy-time)

| ID | Blocker | Why it blocks | Owner |
|---|---|---|---|
| B1 | Stale/expired Cloudflare Worker token (53-char `cfat_` → 401) | `CF_API_TOKEN` absent ⇒ Cloudflare `NOT_INSTALLED`, `deploy.*` refused fail-closed | Operator |
| B2 | No `GITHUB_TOKEN` / `CF_API_TOKEN` injected via `SecretSource` | Same fail-closed path; no deploy possible | Operator |
| B3 | Real `gh`/`wrangler` backends not wired in this repo | `connectGitHubBackend`/`connectCloudflareBackend` not called at boot | Operator/Deploy |
| B4 | No durable `FileDeploymentLedgerBackend` configured at production startup | In-memory ledger does not survive restart → rollback audit lost | Deploy |
| B5 | No human `ApprovalRef` minted for first production deploy | `requireProdApproval` denies; no deploy attempted | Authorized approver |
| B6 | `pipeline.sh` referenced by readiness doc is absent | Doc/glue drift; live path is `agsLaunch()` | Doc fix |

## 3. Required Operator Actions (to reach READY)

1. Mint a fresh Cloudflare API token (~100 chars), verify via `/user/tokens/verify`, inject as `CF_API_TOKEN` via `SecretSource`.
2. Inject a valid `GITHUB_TOKEN` via `SecretSource`.
3. Wire real backends at platform boot: `connectGitHubBackend` / `connectCloudflareBackend`.
4. Call `configureDeploymentLedger(FileDeploymentLedgerBackend)` at production startup (persistent, tenant-scoped).
5. Mint a durable `ApprovalRef` (`grantStackBApproval`, authorized approver, `deploy.website`, production) before first prod `agsLaunch`.
6. Confirm `pipeline.sh` gap resolved (use `agsLaunch` path; update README).

## 4. Security Considerations

- ✅ No secrets in source (verified: 0 credential literals).
- ✅ Single execution boundary preserved (`HermesExecutionGateway`); no provider-owned execution.
- ✅ Tenant isolation enforced (G7 / G2c verified).
- ✅ Replay protection verified (G8).
- ✅ Fail-closed on missing credentials / expired approval / no rollback target.
- ⚠️ Real backend trust depends on operator not registering over-broad `https` egress in manifest (per EPIC-005.4 §4.2).
- ⚠️ Compromise-signal latency: guard detects drift post-action; real-time egress blocking needs external sandbox (PHASE 2) — run higher-risk providers at `sandbox` tier where possible.

## 5. Approval Requirements

- **Production deploy:** mandatory durable human `ApprovalRef` (`lead@ags`/`admin@ags`), semantic release tag required (`vX.Y.Z`), AGS-owned domain, verified rollback target, live secret check.
- **Staging deploy:** routine; no human approval required (governance pre-flight only).
- **Foundation changes:** prohibited (FROZEN). Any change request → out of scope, requires re-freeze review.

---

*Decision recorded 2026-07-21. Recommendation: proceed to staging activation (runbook) once B3/B6 addressed; production only after B1/B2/B4/B5 satisfied.*
