# EPIC-008.1 — Completion Report (Phase 6)

**Date:** 2026-07-21 · **Owner:** Hermes Agent (hy3)
**Verdict:** ✅ ALL PHASES COMPLETE · 0 regressions · tree left dirty per EPIC rules (no commits).

---

## Phase Summary

| Phase | Objective | Result |
|-------|-----------|--------|
| **0** | Recover state + baseline doc | ✅ `EPIC-008.1_BASELINE.md` written |
| **1** | Standardize CF token name | ✅ `CLOUDFLARE_API_TOKEN` canonical; `CF_API_TOKEN` legacy-read-only fallback |
| **2** | Resolve workflow.ts duplication (D1) | ✅ `recordDeployment` fix + `stage-deploy.ts` composition wrapper |
| **3** | Auto-wire FileDeploymentLedgerBackend | ✅ `bootstrapProviders` wires file backend, fail-closed fallback |
| **4** | Working-tree assessment | ✅ `EPIC-008.1_WORKING_TREE_ASSESSMENT.md` (no deletes) |
| **5** | Typecheck + regression + scan | ✅ 0 type errors (prod scope); 128/128 runtime assertions; forbidden-pattern clean |
| **6** | Validation + reports | ✅ this report |

---

## Defect Resolution Evidence

### B1 — Cloudflare token naming
- `cloudflare-exec.ts`: `CF_TOKEN_REFS = ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"]` — canonical first, legacy fallback. `getToken()` reads canonical, falls back to legacy; **no write** of legacy.
- `guardrails.ts`: default secret reference changed to `CLOUDFLARE_API_TOKEN`.
- Scan: 0 production writes of `CF_API_TOKEN`.

### D1 — workflow.ts / launch duplication
- **Before:** `deploymentLedger.recordFromIdentity(identity, {...})` → `TypeError: recordFromIdentity is not a function` at staging-plan time (blocked EPIC-006.5 #8).
- **After:** `deploymentLedger.recordDeployment(undefined, { reference, result: "dry-run", auditReference })` — matches the real `DeploymentLedger` API.
- **Duplication removed:** `stage-deploy.ts` now composes `runStagingWorkflow()` (plan) + `runLaunch()` (execute). No re-implementation of launch logic.
- Test contract corrected: G6b (`CLOUDFLARE_API_TOKEN absent`), G8 (fail-closed `result:"denied"` + `auditReference`, not `r.error`).

### Phase 3 — Ledger durability
- `bootstrap.ts`: `wireDeploymentLedger(process.env)` → resolves `DEPLOYMENT_LEDGER_FILE` → `FileDeploymentLedgerBackend` → `configureDeploymentLedger()`.
- Fail-closed: missing/invalid path → in-memory fallback + `deployment.ledger.fallback` audit event. No silent data loss.

---

## Validation Harness (real execution)

| Suite | Command | Result |
|-------|---------|--------|
| EPIC-006.5 regression | `tsx .../ags.deployment.ts` | **17/17** |
| EPIC-007 launch | `tsx .../epic007.launch.test.ts` | **15/15** |
| Bootstrap | `tsx .../ags.bootstrap.ts` | **11/11** |
| Dry-run | `tsx .../ags.dryrun.ts` | **13/13** |
| Approval | `tsx .../ags.approval.ts` | **9/9** |
| Website | `tsx .../ags.website.ts` | **24/24** |
| Integration | `tsx .../ags.integration.ts` | **18/18** |
| Safe-validation | `tsx .../ags.safe-validation.ts` | **21/21** |
| **Production typecheck** | `tsc --noEmit -p tsconfig.epic008.json` | **0 errors** |

**Total: 128 assertions, 0 failures.**

---

## Forbidden-Pattern Scan

| Pattern | Live production calls | Note |
|---------|----------------------|------|
| `recordFromIdentity` | **0** | only a doc comment in `workflow.ts` |
| `CF_API_TOKEN` (write) | **0** | legacy-read + doc comments only |

---

## Files Delivered (8)

```
hermes/services/activation/providers/deployment/backends/cloudflare-exec.ts   (B1)
hermes/services/activation/providers/deployment/guardrails.ts                 (B1)
hermes/services/activation/providers/deployment/workflow.ts                   (D1)
hermes/services/activation/providers/bootstrap.ts                             (P3)
hermes/services/activation/providers/deployment/stage-deploy.ts              (D1, new)
hermes/services/activation/providers/deployment/__tests__/epic007.launch.test.ts (G6b/G8)
hermes/tsconfig.epic008.json                                                 (tooling, new)
docs/architecture/EPIC-008.1_BASELINE.md                                     (doc, new)
docs/architecture/EPIC-008.1_WORKING_TREE_ASSESSMENT.md                      (doc, new)
```

---

## Next Steps (awaiting user)

1. **Review the 8-file EPIC-008.1 diff** and the two assessment docs.
2. **Decide staging strategy** for the broader 155-path dirty tree (see
   `EPIC-008.1_WORKING_TREE_ASSESSMENT.md` — do NOT bundle into one commit).
3. **No deploy** of token/Worker/Cloudflare changes performed (per EPIC rules).
   Live rollout of `CLOUDFLARE_API_TOKEN` requires a fresh Workers token + a
   separate deploy approval.
4. Optional follow-ups (out of scope): resolve the remaining pre-existing
   strict-mode test type quirks; add `@cloudflare/workers-types` +
   `@hermes/*` aliases repo-wide so `audit/` joins the typecheck gate.

**EPIC-008.1 is functionally complete and verified. Halted per milestone rules
(no commit/stash/deploy). Awaiting user direction.**
