# AGS Activation — Execution Status (PHASE 0)

> **Milestone:** AGS Activation & First Controlled Deployment
> **Date:** 2026-07-21
> **Authority:** Documentation + safe (non-production) validation ONLY.
> No Foundation change, no commit, no stage, no production deploy, no secret connection.

---

## 1. Foundation — CONFIRMED ✅

| Control | State | Evidence (re-verified this session) |
|---|---|---|
| Frozen | ✅ | `HermesExecutionGateway` / `ProviderRuntimeGuard` unmodified; Class B freeze intact. |
| Validated | ✅ | EPIC-004/005/006/007/008 completion reports reviewed; suites re-run green (see §3). |

## 2. AGS Capability — CONFIRMED ✅ (code-complete, re-verified by execution)

| Capability | State | Evidence |
|---|---|---|
| Provider integration exists | ✅ | `github/provider.ts` (`vcs.github`), `cloudflare/provider.ts` (`edge.cloudflare`) register via the shared `registerProvider → enableProvider → setProviderHealth` path. |
| Deployment workflow exists | ✅ | `agsLaunch()` → `runLaunch()` (single governed entry). **15/15** EPIC-007 guarantee suite re-run green. |
| Approval workflow exists | ✅ | `approval-gates.ts` + `requireProdApproval`/`requireProdApproverAuthority`. **7/7** approval regression green. |
| Audit workflow exists | ✅ | `emitAudit` on every governance branch; ledger `auditReference` correlation. **21/21** safe-validation audit assertions green. |

## 3. Re-run Evidence (this session)

| Suite | Result |
|---|---|
| EPIC-007 Controlled Launch Guarantee | **15 passed, 0 failed** |
| Trust Regression (checksum + ed25519) | **8 passed, 0 failed** |
| Approval Regression | **7 passed, 0 failed** |
| AGS Integration | **18 passed, 0 failed** |
| AGS Bootstrap (fail-closed) | **11 passed, 0 failed** |
| **PHASE 5 Safe Validation (new)** | **21 passed, 0 failed** |

## 4. Remaining Activation Blockers (only deploy-time / operability items)

| # | Blocker | Class | Required Operator Action |
|---|---|---|---|
| B1 | Cloudflare **token-name split** across the live path (defect, see below) | **CODE + OPERABILITY** | Fix ref consistency OR set **both** `CLOUDFLARE_API_TOKEN` (readiness) and `CF_API_TOKEN` (deploy) to the same value at deploy time. |
| B2 | No `GITHUB_TOKEN` / `CF_API_TOKEN` in secret source | Deploy-time | Inject via `SecretSource` at runtime. |
| B3 | Stale CF Workers token (53-char `cfat_` → 401 per workspace memory) | Deploy-time | Mint fresh ~100-char token; verify via `/user/tokens/verify`. |
| B4 | Real `gh`/`wrangler` backends not wired in this repo | Deploy-time | Call `connectGitHubBackend`/`connectCloudflareBackend` at platform boot (bootstrap). |
| B5 | Production deploy needs a human `ApprovalRef` | By design | Operator grants via durable approval. |
| B6 | Durable `FileDeploymentLedgerBackend` not wired at startup (in-memory default) | Deploy-time | `configureDeploymentLedger(FileBackend)` once at production startup. |
| B7 | Working tree dirty (149 entries from prior epics); not reconciled | Hygiene | Operator reconciles before first live deploy (no commit/stage done here). |

## 5. Critical Code-Level Finding — Cloudflare Token-Name Split (B1)

The Cloudflare credential reference is **inconsistent across the live path**:

| Code location | Secret ref checked |
|---|---|
| `deployment/executors.ts` (RLSE readiness) | `CLOUDFLARE_API_TOKEN` |
| `cloudflare/config.ts` (`validateCloudflareConfig`) | `CLOUDFLARE_API_TOKEN` |
| `deployment/backends/cloudflare-exec.ts` (actual deploy) | `CF_API_TOKEN` |
| `deployment/guardrails.ts` (`checkSecretExpiry`) | `CF_API_TOKEN` (default) |

GitHub is consistent (`GITHUB_TOKEN` everywhere). **Effect:** a real Cloudflare deploy cannot pass both the readiness gate and the execution gate unless the operator sets the *same* token under **two different environment names**. The PHASE 5 harness confirms a staging real-exec only succeeds when both `CLOUDFLARE_API_TOKEN` and `CF_API_TOKEN` are present (§5 of that run). This is a latent interoperability defect, not a Foundation change — but it is an **activation blocker** because it forces fragile dual-secret provisioning and will cause opaque "readiness OK / deploy fails" mismatches.

Recommended operator action: set both names to the same value until the ref is unified (a one-line change in `cloudflare-exec.ts` and `checkSecretExpiry` to read `CLOUDFLARE_API_TOKEN`). This does not weaken fail-closed behavior.

---

*Execution status established 2026-07-21. Proceed to PHASE 1 working-tree safety check.*
