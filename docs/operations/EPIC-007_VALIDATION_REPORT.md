# EPIC-007 Validation Report — Controlled AGS Launch / Deployment Platform

> **Phase:** 10 (Validation)
> **Date:** 2026-07-21
> **Method:** Real module execution via `tsx` (no mocked internal logic; only the
> vendor `Spawner` is faked — which is the intended provider seam).
> **Result:** **EPIC-007 Guarantee Suite — 15 passed, 0 failed (ALL GUARANTEES VERIFIED)**

---

## 1. Objective (Validation Scope)

Prove, by execution, that the EPIC-007 controlled-launch module enforces every
promised fail-closed, tenant-isolated, idempotent, auditable, and rollback-safe
property for AGS staging and production deployments.

---

## 2. Architecture Impact Assessment (Validation View)

The validation exercises the **real** `runLaunch` pipeline end-to-end against fake
*vendor* spawners, confirming the governance logic (Hermes-owned) is correct while
the provider seam (the only faked part) remains the single swappable boundary:

```
runLaunch(req, deps)
  ├─ pre-flight guardrails (throw ⇒ denied + audit)   [guardrails.ts]
  ├─ idempotency replay check                          [ledger.ts]
  ├─ RLSE: readiness + smoke + rollbackCapable         [rlse.ts / executors.ts]
  ├─ production rollback-target gate                   [ledger.lastSuccessful]
  ├─ dry-run short-circuit                             [ledger record]
  └─ execute: pull → push → deploy → post-smoke       [backends/* via Spawner]
        └─ every branch emits emitAudit + ledger entry [audit/event.ts]
```

No Foundation (EPIC-005) code was modified or re-validated as part of this suite;
EPIC-007 composes it.

---

## 3. Files Changed (Under Validation)

New module: `hermes/services/activation/providers/deployment/` — 14 files / 2,103 lines
(10 EPIC-007-authored + 4 EPIC-006.5 predecessors). The 15-guarantee suite validates
the 9 EPIC-007 source files in `tsconfig.epic007.json` plus their test. See
`EPIC-007_BASELINE.md §3` for the full inventory.

---

## 4. Guarantee Suite Verification Results

**Command:**
`node node_modules/.pnpm/tsx@4.23.1/node_modules/tsx/dist/cli.mjs \
services/activation/providers/deployment/__tests__/epic007.launch.test.ts`

**Raw output (2026-07-21):**

```
EPIC-007 · Controlled AGS Launch — Guarantee Suite
  ✓ G1:  staging launch never writes a production ledger entry
  ✓ G2:  production launch with NO approval is denied fail-closed
  ✓ G2b: production launch with EXPIRED approval is denied
  ✓ G2c: production launch with tenant-mismatched request is denied
  ✓ G2d: production launch with unauthorized approver is denied
  ✓ G3:  successful production launch writes a durable, revocable ledger record
  ✓ G4:  rollback capability is verified via RLSE before any production launch
  ✓ G4b: production launch is DENIED if no rollback target exists (fail-closed)
  ✓ G5:  probeSite is a real fail-closed reachability check (returns a boolean .ok)
  ✓ G6:  real backend maps vendor failure to {ok:false}, never throws
  ✓ G6b: backend without credentials is fail-closed (no CF token)
  ✓ G7:  ledger enforces tenant isolation (cross-tenant query returns nothing)
  ✓ G8:  duplicate idempotencyKey is denied as replay
  ✓ G9:  launch emits audit records and correlates the ledger entry
  ✓ G10: guardrail primitives enforce tenant / approval / stability independently
────────────────────────────────────────────────
EPIC-007 suite: 15 passed, 0 failed
ALL GUARANTEES VERIFIED
```

### Guarantee → Source Mapping

| ID | Guarantee | Enforced by | Source anchor |
|---|---|---|---|
| G1 | Staging never writes prod ledger entry | capability `launch.staging` | `launch.ts:200,247` |
| G2 | Prod w/o approval denied | `requireProdApproval` throws | `guardrails.ts:56` |
| G2b | Prod w/ expired approval denied | `approvalRef.expiresAt` check | `guardrails.ts:61` |
| G2c | Tenant-mismatched request denied | `requireTenant` | `guardrails.ts:49` / `launch.ts:111` |
| G2d | Unauthorized approver denied | `requireProdApproverAuthority` | `guardrails.ts:68` |
| G3 | Success writes durable, revocable record | `recordDeployment` + `markResult` + `revoke` | `ledger.ts:119,167,187` |
| G4 | Rollback verified via RLSE pre-prod | `rlse.rollbackCapable` before deploy | `launch.ts:172,177` |
| G4b | Prod denied if no rollback target | `!rb.canRollback ⇒ deny` | `launch.ts:177` |
| G5 | `probeSite` real fail-closed probe | `fetch` + timeout, `ok:false` on error | `site-identity.ts:113` |
| G6 | Vendor failure → `{ok:false}`, no throw | `spawnResultToTool` non-zero map | `backends/spawner.ts:28` |
| G6b | No creds ⇒ fail-closed | `missingCreds` when token absent | `backends/cloudflare-exec.ts:30` |
| G7 | Ledger tenant isolation | tenant-keyed reads | `ledger.ts:137,143,147` |
| G8 | Duplicate idempotencyKey denied | replay-denied branch | `launch.ts:147` |
| G9 | Audit emitted + ledger correlated | `emitAudit` + `auditReference` | `launch.ts:137,264,269` |
| G10 | Guardrails independent | discrete `require*` functions | `guardrails.ts` (whole) |

---

## 5. Rollback and Audit Capabilities

### Rollback capability
- **Pre-flight gate (fail-closed):** `runLaunch` calls `deps.rlse.rollbackCapable(env)`
  *before* any provider call. If `lastSuccessful(tenant, env)` is undefined, production
  launch is **denied** with `NO_ROLLBACK_TARGET` (G4b). You may only ship to prod if you
  can undo it.
- **Backend rollback ops:** both real backends implement `rollback()`:
  - GitHub → `git revert --no-edit <ref>` (`backends/github-exec.ts:101`)
  - Cloudflare → `wrangler deployments rollback <id>` (`backends/cloudflare-exec.ts:72`)
- **Ledger revocation:** `deploymentLedger.revoke(tenant, deploymentId, reason, by)`
  appends a durable, auditable revocation entry (`ledger.ts:187`).
- **Rollback target surfaced:** a successful launch returns `lastDeploymentId` +
  `lastReference` (the verified prior target) in its outcome.

### Audit capability
- Every launch branch emits a frozen-Foundation `emitAudit` event:
  `ags.launch.denied`, `ags.launch.replay-denied`, `ags.launch.dry-run`,
  `ags.launch.started`, `ags.launch.success`, `ags.launch.failed`.
- Each event carries `deploymentId`, `environment`, `reason`/`code`, and an
  `auditReference`. The corresponding ledger entry stores the **same** `auditReference`
  + `approvalRef` + `idempotencyKey` → full correlation (G9).
- The ledger is **append-only** and tenant-isolated; a `FileDeploymentLedgerBackend`
  (JSON-lines) makes it restart-safe when wired at startup.

---

## 6. Typecheck Status (Scoped)

`tsc --noEmit -p tsconfig.epic007.json` (scopes the 9 EPIC-007 source files):

- **EPIC-007's own 9 files: 0 errors.**
- The config surfaces **13 errors**, all in *transitively-imported frozen-foundation*
  modules (`audit/store.durable.ts`, `services/providers/trust/*`,
  `services/activation/providers/secret-source.ts`), caused by `"types": []` excluding
  `@types/node` (`BufferEncoding` / `process` / `crypto`). These are **pre-existing
  foundation build-config gaps, out of EPIC-007 scope** and do not indicate defects in
  EPIC-007 source.

---

## 7. Cross-Suite Observation (Honest Disclosure)

The sibling **EPIC-006.5 regression suite** (`ags.deployment.ts`) reports
**7 passed / 1 failed**:
- Checks `#1`–`#7` (unknown env, prod-no-approval, wrong tenant, missing GH/CF creds,
  anonymous, expired approval) — **all pass**.
- Check `#8` (`runStagingWorkflow` dry-run) **throws**:
  `TypeError: deploymentLedger.recordFromIdentity is not a function`.

**Root cause:** `workflow.ts:125` calls `deploymentLedger.recordFromIdentity(...)`,
which is **not implemented** on the `DeploymentLedger` class (only `recordDeployment`,
`appendRaw`, etc. exist).

**Impact on EPIC-007:** **none.** `index.ts`/`agsLaunch()` do **not** import
`workflow.ts`. The EPIC-007 guarantee suite (the authoritative acceptance gate) is fully
green and independent of this defect. The defect is a **deferred backlog item** (see
Completion Report §Deferred Backlog), not a blocker for EPIC-007 acceptance.

---

## 8. Production Readiness (Validation Verdict)

| Property | Verified? | By |
|---|---|---|
| Staging routine launch | ✅ | G1 |
| Production fail-closed gating | ✅ | G2 / G2b / G2c / G2d |
| Durable + revocable ledger | ✅ | G3 |
| Rollback pre-flight gate | ✅ | G4 / G4b |
| Real fail-closed backend | ✅ | G6 / G6b |
| Tenant isolation | ✅ | G7 |
| Idempotency / replay defense | ✅ | G8 |
| Audit emission + correlation | ✅ | G9 |
| Independent guardrails | ✅ | G10 |
| Live end-to-end deploy | ⛔ not run | EPIC rule: no deploy performed |

**Conclusion:** EPIC-007's controlled-launch *logic and governance* are **validated and
production-ready**. The live deploy remains a supervised operator action.
