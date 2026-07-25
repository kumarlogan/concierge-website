# EPIC-009 — Baseline (Phase 0 · Recovery)

**Date:** 2026-07-21
**Objective:** Hermes' first real application operation — a controlled, end-to-end
AGS website *change workflow* executed entirely through the provider framework,
with the frozen Foundation untouched. This is an operational exercise, NOT a
deployment EPIC.

---

## 1. Prior AGS Integration Work Reviewed

| Artifact | Source | Status at baseline |
|---|---|---|
| `docs/operations/AGS_PROVIDER_INTEGRATION.md` | prior milestone | Describes GitHub + Cloudflare providers wired as **Stack B** providers through the activation seam. |
| `docs/operations/AGS_ACTIVATION_*.md` (×6) | prior milestone | Provider registration, readiness, security, and the "first staging run" were exercised. All conclude: **providers code-complete but NOT_INSTALLED in this environment** (no operator backends/creds wired). |
| `hermes/services/activation/providers/` | code | The full governed path exists: `bootstrap`, `secret-source`, `website` (capability router), `deployment/launch` (`runLaunch`), `deployment/ledger`, `deployment/identity` + `guardrails` + `rlse`, and `audit/`. |

**Conclusion:** The AGS integration is *designed and code-complete*. What is
missing is the **operator-supplied runtime** (real GitHub/Cloudflare backends
and credentials), which is intentionally out of band. In this environment every
provider therefore reports `not_installed` and is **fail-closed** — which is the
correct, safe state for an operational exercise.

---

## 2. GitHub Provider Status

- **ID / capability contract:** `vcs.github` → `code.vcs.repo`,
  `code.vcs.pull-request`, `code.vcs.branch`, `code.vcs.commit-history`,
  `code.vcs.tag`, `code.vcs.rollback` (production-gated).
- **Registration:** implemented in
  `hermes/services/activation/providers/github/provider.ts`.
- **Backend wiring:** `setGitHubExecutor()` is the only thing that makes the
  provider executable. **Not wired in this environment.**
- **Health at baseline:** `not_installed` (fail-closed). Capabilities are
  advertised but all execution is refused until a backend + valid secrets
  (`GITHUB_TOKEN`, `AGS_GITHUB_REPOSITORY`) are supplied by the deployer.
- **Config validation:** `validateGitHubConfig()` gates activation.

## 3. Cloudflare Provider Status

- **ID / capability contract:** `edge.cloudflare` → `deploy.build`,
  `deploy.pages` (production-gated), `deploy.worker` (production-gated),
  `deploy.history`, `deploy.rollback` (production-gated), `ops.health`,
  `ops.logs`, `ops.analytics`.
- **Registration:** implemented in
  `hermes/services/activation/providers/cloudflare/provider.ts`.
- **Backend wiring:** `setCloudflareExecutor()`. **Not wired here.**
- **Health at baseline:** `not_installed` (fail-closed). Activation requires
  `CLOUDFLARE_API_TOKEN`, `AGS_CLOUDFLARE_ACCOUNT`, `AGS_CLOUDFLARE_PROJECT`.
- **AGS project binding:** Pages project `agsynergy` → `agsynergy.ca`.

## 4. Website Capability Status

- **App-layer router:** `hermes/services/activation/providers/website.ts`
  maps human/intent capabilities (`website.deploy`, `website.preview`,
  `website.status`, `website.rollback`, `website.logs`, `website.analytics`,
  `website.version`) to the underlying provider+capability, e.g.
  `website.deploy` → `edge.cloudflare` / `deploy.pages`.
- **Provider neutrality preserved:** the website layer never names a vendor SDK;
  it resolves through `executeCapability`, so the frozen Foundation's single
  execution boundary (`HermesExecutionGateway`) is always the only thing that
  may invoke a provider.
- **Dry-run mode:** `website.ts` supports `ctx.dryRun` — returns a *plan*
  (capability, provider, underlying, env, `wouldRequireApproval`) **without**
  invoking the gateway or any backend. This is the exact mechanism EPIC-009 uses
  for Phase 4.

## 5. Deployment Readiness

| Control | Implemented? | State at baseline |
|---|---|---|
| Provider registration (fail-closed) | ✅ | Registered, not activated (no backend) |
| Secret source (operator-owned) | ✅ | `EnvSecretSource` default; no live creds here |
| Tenant isolation (`ags-fertility` only) | ✅ | Enforced in `identity.ts` + `guardrails.ts` |
| Production governance (approval, approver authority, domain, release tag, change-freeze, secret validity) | ✅ | Enforced in `launch.ts` + `guardrails.ts` |
| Deployment ledger (tenant-isolated, append-only, idempotent) | ✅ | `MemoryDeploymentLedgerBackend` default; file backend optional via `DEPLOYMENT_LEDGER_FILE` |
| Deployment identity + audit | ✅ | `identity.ts` + `audit/event.ts` |
| RLSE (readiness + live smoke + rollback-capable) | ✅ | `rlse.ts` (readiness checks creds only; no network I/O in this build) |
| **Live execution path** | ⚠️ | Blocked by fail-closed: no backends/creds → `not_installed` |

**Readiness verdict:** The governance and operational surface are complete and
fail-closed. *Production deployment* is **NOT ready** in this environment
because (a) no operator backends/credentials are wired, and (b) this EPIC
forbids deploy/publish/push/stage/commit. EPIC-009 therefore exercises the
**full workflow in dry-run**, verifying every checkpoint without touching a
live provider.

---

## 6. Operational State Confirmed

- Foundation (HermesExecutionGateway, ProviderRuntimeGuard,
  UniversalCapabilityPlatform, TrustLifecycle) — **FROZEN, untouched**.
- AGS website source: `artifacts/ags-fertility/` (React + Vite + Tailwind SPA),
  builds to `dist/`, deploys to Cloudflare Pages `agsynergy` (`agsynergy.ca`).
- This EPIC will perform **one tiny, reversible** website copy/spacing change and
  route its deployment through the governed dry-run path.
- No commits, pushes, stages, or deploys will occur.
