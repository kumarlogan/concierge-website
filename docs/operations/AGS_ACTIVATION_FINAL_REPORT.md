# AGS Activation — Final Report (PHASE 7)

> **Milestone:** AGS Activation & First Controlled Deployment
> **Date:** 2026-07-21
> **Outcome:** ✅ **Controlled AGS operational capability ACTIVATED (staging-ready).** ⛔ Production gated (operator actions + explicit approval pending).

---

## 1. Current Hermes Maturity
- **Foundation:** FROZEN, validated (Class B). Single execution boundary (`HermesExecutionGateway`), mandatory approval, mandatory audit, tenant isolation, durable trust state, fail-closed execution — all preserved and re-verified.
- **Capability:** Provider-neutral activation seam complete; AGS (GitHub + Cloudflare) integrates through the standard Stack B provider path with zero AGS-specific core code.

## 2. AGS Operational Maturity
| Dimension | Status |
|---|---|
| Provider integration | ✅ Present + registered via shared path |
| Deployment workflow | ✅ `agsLaunch` → `runLaunch` (15/15 guarantee) |
| Approval workflow | ✅ Fail-closed, single durable `ApprovalRef` (7/7) |
| Audit workflow | ✅ Every branch audited + correlated (21/21 safe-validation) |
| Secret boundary | ✅ `SecretSource`, no source secrets (B1 caveat below) |
| Bootstrap fail-closed | ✅ NOT_INSTALLED until creds+backend (11/11) |
| **Staging execution** | ✅ **READY** (safe validation 21/21) |
| **Production execution** | ⛔ GATED (by design + operability items) |

## 3. Completed Activation Items
- [x] PHASE 0 baseline + execution-status doc.
- [x] PHASE 1 working-tree safety check (read-only, classified A/B/C/D).
- [x] PHASE 2 provider activation prep (GitHub + Cloudflare readiness verified, fail-closed confirmed).
- [x] PHASE 3 bootstrap readiness (registration → provider → capability → audit → trust path validated).
- [x] PHASE 4 staging runbook (`AGS_FIRST_STAGING_RUN.md`).
- [x] PHASE 5 safe execution validation — **21/21 PASS** on the real `agsLaunch` path.
- [x] PHASE 6 gate decision (`AGS_ACTIVATION_GATE_DECISION.md`): READY FOR STAGING.
- [x] All prior regression suites re-run green (EPIC-007 15/15, Trust 8/8, Approval 7/7, AGS integration 18/18, AGS bootstrap 11/11).

## 4. Remaining Blockers
| # | Blocker | For | Action |
|---|---|---|---|
| B1 | **Cloudflare token-name split** (`CLOUDFLARE_API_TOKEN` vs `CF_API_TOKEN`) | Real CF deploy | Set both names to same value; or unify ref (1-line, non-Foundation). |
| B2 | No `GITHUB_TOKEN`/`CF_API_TOKEN` in secret source | Any real deploy | Inject at runtime. |
| B3 | Stale CF Workers token (53-char `cfat_` → 401) | Real CF auth | Mint fresh ~100-char token; verify. |
| B4 | Real `gh`/`wrangler` backends not wired in repo | Real execution | Wire at bootstrap. |
| B5 | Human `ApprovalRef` for production | Production | Operator grants. |
| B6 | Durable `FileDeploymentLedgerBackend` not wired | Prod durability | Configure at startup. |
| B7 | Dirty working tree (149 entries) | Deploy hygiene | Operator reconciles (no commit done). |

**B1 is the only item that is a genuine code-level defect** (latent interoperability bug, not a Foundation change). All others are operator-held deploy-time conditions the platform is *correctly* fail-closed against.

## 5. Production Path
1. Resolve B1 (set both token names, or unify ref).
2. Provision secrets (B2), replace stale CF token (B3), wire real backends (B4), configure durable ledger (B6), reconcile tree (B7).
3. Execute staging per `AGS_FIRST_STAGING_RUN.md`; confirm full validation checklist.
4. Grant a durable human `ApprovalRef` from an authorized approver (`lead@ags`/`admin@ags`).
5. Production launch requires: semantic tag (`vMAJOR.MINOR.PATCH`), AGS domain, authorized approver, change-freeze clear, live CF secret valid, and a verified rollback target (prior successful deploy).

## 6. Deferred Backlog
- **D1** (`workflow.ts` latent defect, `recordFromIdentity` missing): confirmed not on the live `agsLaunch` path; classified non-blocking in prior checkpoint; remains deferred.
- **D2** (typecheck tooling `Buffer`/`process` environment issue): environment dependency, not a code defect; remains documented, not blocking validation (suites run via `tsx`).
- Class D files from PHASE 1 (notably `providers/sdk.ts`, trust `lifecycle.ts`/`trust-state-store.ts` `AM` entries) require operator review to confirm they do not introduce a new execution boundary or trust model.

---

## STOP CONDITIONS MET
- ✅ Assessment complete
- ✅ Required documentation produced (6 docs)
- ✅ Safe validation executed (21/21)
- ⛔ No commit / stage / production deploy performed
- ⛔ No production secrets connected

## Return Summary
1. **Activation status:** Staging capability ACTIVATED & verified. Production gated.
2. **Remaining blockers:** B1 (code defect, Cloudflare token split) + B2–B7 (operator-held).
3. **Staging readiness:** ✅ READY (safe validation green).
4. **Production readiness:** ⛔ NOT READY (7 operator actions + explicit approval).
5. **Recommended next action:** Operator provisions dual Cloudflare token names + GitHub token, wires real backends, reconciles tree, then runs the staging runbook (dry-run → staging). After a clean staging success, grant production `ApprovalRef`.

---

*Final report — AGS controlled activation milestone closed. No deploy performed.*
