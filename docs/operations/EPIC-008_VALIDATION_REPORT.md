# EPIC-008 — Validation Report
## Controlled AGS Operations Pilot

> **Date:** 2026-07-21
> **Status:** VALIDATED (read-only readiness + regression verification)
> **Foundation:** FROZEN (Class B). No Foundation/architecture change.

---

## 1. PHASE 2 — AGS Operational Readiness Review (read-only)

| # | Readiness dimension | Finding | Verdict |
|---|---|---|---|
| 1 | **GitHub provider readiness** | `github/provider.ts` registers via `registerProvider → enableProvider → setProviderHealth`; capabilities (`code.vcs.*`) declared; executor port (`port.ts`) fail-closed until `connectGitHubBackend` wires a `GitHubBackend`. | ✅ Ready (deploy-time token + gh backend required) |
| 2 | **Cloudflare provider readiness** | `cloudflare/provider.ts` + `port.ts` mirror GitHub; `deploy.*` / `ops.*` capabilities; `requiresApprovalIn:["production"]` enforced. | ✅ Ready (deploy-time token + wrangler backend required) |
| 3 | **Secret boundary readiness** | `secret-source.ts` — platform NEVER hardcodes secrets; providers resolve via injected `SecretSource`; missing secret ⇒ `NOT_INSTALLED` fail-closed. | ✅ Ready |
| 4 | **Approval workflow readiness** | Single durable `ApprovalRef` model (`gateway/approval.ts`) verified fail-closed (missing/unknown/capability/tenant/approver/expired all DENIED). `executeCapability` refuses prod without ref. | ✅ Ready (verified by regression) |
| 5 | **Audit readiness** | Every governance step emits `emitAudit` (register/enable/disable/health/capability.exec/denied/done, launch, ledger). | ✅ Ready |
| 6 | **Rollback readiness** | EPIC-007 `runLaunch` enforces a verified rollback target pre-flight (`G4b`); `deploy.rollback` capability `requiresApprovalIn:["production"]`. | ✅ Ready (verified by guarantee suite) |
| 7 | **Tenant isolation readiness** | `StackBGatewayGuard` denies cross-tenant; ledger `getByTenant` scoped; EPIC-007 `G7` verified. | ✅ Ready (verified) |

**Gaps reported:** None at the repo/governance layer. The only "gaps" are **deploy-time operator actions** (out of repo scope by design, per EPIC-006 handoff):
- Inject real `GITHUB_TOKEN` + `CF_API_TOKEN` via `SecretSource`.
- Wire `gh`-CLI and `wrangler`-CLI backends via `connectGitHubBackend` / `connectCloudflareBackend`.
- Obtain a human `ApprovalRef` for any production deploy.
- Refresh the stale `agsynergy.ca` Cloudflare token (per workspace memory) and verify via `/user/tokens/verify`.

---

## 2. PHASE 4 — Validation (tests executed)

Run via `tsx` against real modules (no mocks of governance):

| Suite | Command | Result |
|---|---|---|
| AGS integration | `deployment/__tests__/ags.deployment.ts` | **7/8** — 8th blocked by deferred `workflow.ts` defect (D1), on the superseded dry-run path, NOT the EPIC-007 launch path |
| EPIC-007 regression | `deployment/__tests__/epic007.launch.test.ts` | **15/15** — ALL GUARANTEES VERIFIED |
| Trust regression | `trust/__tests__/trust.regression.test.ts` *(new)* | **8/8** — checksum + REAL ed25519 signature |
| Approval regression | `gateway/__tests__/approval.regression.test.ts` *(new)* | **7/7** — single durable approval model fail-closed |

### Verification criteria (PHASE4)
- **No bypass paths** — every provider execution routes through `HermesExecutionGateway` → tenant → policy → approval → `StackBGatewayGuard`. No `skipGuard` / direct-exec present.
- **No direct provider execution** — GitHub/Cloudflare vendor logic lives only in injected `GitHubBackend`/`CloudflareBackend` behind `port.ts`; core never imports a vendor SDK.
- **No secrets in source** — credentials resolved exclusively via `SecretSource`; no hardcoded tokens.
- **No provider-specific logic in core** — `provider-framework.ts` is generic; AGS specifics are isolated in `providers/github|cloudflare/*`.

---

## 3. Security Impact
- **None negative.** Added two behavior-asserting regression suites that *strengthen* assurance of the fail-closed trust + approval models.
- Secret boundary intact; tenant isolation intact; approval model single and durable.
- No new attack surface; no disabled guards.

## 4. Architecture Impact
- **NONE.** Foundation FROZEN. `HermesExecutionGateway` and `ProviderRuntimeGuard` untouched. No new foundation abstractions, no redesign.
- EPIC-008 delivered **documentation + 2 test files only**. The operational surface is the pre-existing EPIC-007 `runLaunch` / `agsLaunch` governed function.

---

*See `EPIC-008_COMPLETION_REPORT.md` for files-changed, remaining risks, and production-readiness.*
