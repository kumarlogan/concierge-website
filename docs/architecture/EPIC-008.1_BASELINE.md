# EPIC-008.1 — Hermes Platform Foundation v1.0 Consolidation (Baseline)

**Status:** IN PROGRESS (consolidation-only, no core redesign)
**Author:** Hermes Agent (hy3)
**Date:** 2026-07-21
**Scope:** Resolve documented Foundation v1.0 defects without altering frozen core abstractions.

---

## Relationship to EPIC-008

The `EPIC-008_*` family (`EPIC-008_BASELINE.md`, `EPIC-008_DECLARATION.md`,
`EPIC-008_INDEX.md`) tracks a **separate** "Controlled AGS Operations Pilot" —
the operational runbook for live AGS deployments. This EPIC-008.1 is a
**codebase consolidation** of the Foundation v1.0 artifacts under
`hermes/services/activation/providers/`. The two do not overlap: EPIC-008.1
touches source + types; the pilot docs are operational guidance and are treated
as read-only reference.

---

## Defects Addressed

| ID | Area | Symptom | Resolution |
|----|------|---------|------------|
| **B1** | Token naming | Cloudflare token referenced as both `CLOUDFLARE_API_TOKEN` (canonical, 213 refs) and legacy `CF_API_TOKEN` (157 refs). Dual names risk misconfig at deploy. | Single documented name `CLOUDFLARE_API_TOKEN`; `CF_API_TOKEN` retained as legacy fallback (read, never written). |
| **D1** | workflow.ts duplication | `workflow.ts` called `deploymentLedger.recordFromIdentity(...)` — a method that does **not exist** on `DeploymentLedger` (real API: `recordDeployment`). Caused a runtime `TypeError` at staging-plan time; blocked EPIC-006.5 regression #8. Also re-implemented launch logic already owned by `launch.ts` (`agsLaunch` → `runLaunch`). | Replaced call with `recordDeployment(undefined, {...})`; introduced `stage-deploy.ts` wrapper that composes `runStagingWorkflow` (plan) + `runLaunch` (execute) instead of duplicating. |
| **Phase 3** | Ledger durability | `FileDeploymentLedgerBackend` existed but was never wired at startup; ledger reset on every restart (lost production deployment history). | Auto-wire in `bootstrapProviders` via `resolveLedgerBackend()` → `configureDeploymentLedger()`. `DEPLOYMENT_LEDGER_FILE` env selects file backend; absent → in-memory; construction failure → fail-closed in-memory + audit event. |

---

## Files Touched (this session)

Production:
- `hermes/services/activation/providers/deployment/backends/cloudflare-exec.ts` — B1 canonical token + legacy fallback.
- `hermes/services/activation/providers/deployment/guardrails.ts` — B1 default secret ref canonical.
- `hermes/services/activation/providers/deployment/workflow.ts` — D1 `recordDeployment` fix.
- `hermes/services/activation/providers/bootstrap.ts` — Phase 3 ledger auto-wire.
- `hermes/services/activation/providers/deployment/stage-deploy.ts` — NEW D1 wrapper (plan + execute composition).

Tests (contract-corrected, not relaxed):
- `hermes/services/activation/providers/deployment/__tests__/epic007.launch.test.ts` — G6b token name, G8 outcome shape.

Tooling (validation only, not source):
- `hermes/tsconfig.epic008.json` — scoped typecheck config (node types, excludes tests+audit which need `@cloudflare/workers-types`).

---

## Validation Harness

- **Typecheck:** `tsc --noEmit -p hermes/tsconfig.epic008.json` → 0 errors (production scope).
- **Regression suites (real runtime via `tsx`):**
  - `ags.deployment.ts` (EPIC-006.5) — 17/17
  - `epic007.launch.test.ts` (EPIC-007) — 15/15
  - `ags.bootstrap.ts` — 11/11
  - `ags.dryrun.ts` — 13/13 · `ags.approval.ts` — 9/9 · `ags.website.ts` — 24/24
  - `ags.integration.ts` — 18/18 · `ags.safe-validation.ts` — 21/21
  - **Total: 128 assertions, 0 failures.**
- **Forbidden-pattern scan:** `recordFromIdentity` — 0 live calls (only a doc comment). `CF_API_TOKEN` — 0 in production runtime paths (legacy read + doc comments only).

---

## Out of Scope (preserved)

- No new core abstractions; the Foundation's frozen signatures (tenant enforcement,
  production gating, execution boundary) are untouched.
- `audit/` module excluded from the EPIC-008.1 typecheck (requires
  `@cloudflare/workers-types` + `@hermes/*` path aliases — pre-existing, not part
  of these defects).
- Test-file strict-mode type quirks (pre-existing, runtime-passing) are noted but
  not expanded beyond the two G6b/G8 contract corrections required by Phase 1/2.
