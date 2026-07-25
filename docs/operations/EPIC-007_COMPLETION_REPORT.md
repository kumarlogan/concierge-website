# EPIC-007 Completion Report — Controlled AGS Launch / Deployment Platform

> **Phase:** 10 (Completion & Acceptance)
> **Date:** 2026-07-21
> **Status:** ✅ COMPLETE — 15/15 guarantee suite verified by real execution
> **Deliverable:** Documentation only (3 reports). No source edits, no commits, no deploy.

---

## 1. Objective

Deliver a single, governed AGS launch path where **staging is routine** and
**production is fail-closed gated** (approval + authority + domain + release tag +
change-freeze + live secret + verified rollback target), with idempotency, tenant
isolation, audit correlation, and rollback safety — composed on the frozen EPIC-005
Foundation without modifying it.

**Achieved:** Yes. The `agsLaunch()` → `runLaunch()` pipeline implements exactly this.

---

## 2. Architecture Impact Assessment

- Introduced a **second, AGS-specific control plane** on top of the frozen Foundation.
  The Foundation's single execution boundary (EPIC-005) is preserved; EPIC-007 owns
  AGS deployment *policy, sequencing, idempotency, and audit wiring*.
- Providers (`gh`/`git`/`wrangler`) are reached exclusively through the **provider-neutral
  `Spawner` seam** — the only faked component in tests, confirming clean separation.
- No Foundation file was edited. EPIC-007 adds 9 new source files + 1 test in
  `hermes/services/activation/providers/deployment/`.

---

## 3. Files Changed (Inventory)

**14 new files / 2,103 lines** (entire `deployment/` directory, untracked per EPIC rules).

**EPIC-007-authored (10):**
| File | Lines |
|---|---|
| `index.ts` | 106 |
| `launch.ts` | 296 |
| `ledger.ts` | 208 |
| `guardrails.ts` | 131 |
| `rlse.ts` | 87 |
| `site-identity.ts` | 150 |
| `backends/spawner.ts` | 41 |
| `backends/github-exec.ts` | 109 |
| `backends/cloudflare-exec.ts` | 107 |
| `__tests__/epic007.launch.test.ts` | 338 |

**EPIC-006.5 predecessors (4, composed not authored):** `identity.ts` (159),
`executors.ts` (90, **used by EPIC-007 via `rlse.ts`**), `workflow.ts` (143, not on
EPIC-007 path), `__tests__/ags.deployment.ts` (138).

---

## 4. Guarantee Suite Verification Results

**15 passed, 0 failed — ALL GUARANTEES VERIFIED** (real execution, 2026-07-21).

G1 staging isolation · G2/G2b/G2c/G2d production denial · G3 durable+revocable ledger ·
G4/G4b rollback pre-flight gate · G5 `probeSite` fail-closed · G6/G6b backend fail-closed ·
G7 tenant isolation · G8 idempotency replay-denied · G9 audit correlation · G10
independent guardrails.

Full matrix → `EPIC-007_VALIDATION_REPORT.md §4`.

---

## 5. Rollback and Audit Capabilities

### Rollback
- **Pre-flight fail-closed gate:** production launch denied (`NO_ROLLBACK_TARGET`) if no
  prior successful deployment exists (`launch.ts:177`, G4b).
- **Backend ops:** GitHub `git revert` + Cloudflare `wrangler deployments rollback <id>`.
- **Ledger revoke:** `revoke(tenant, id, reason, by)` appends a durable revocation entry.
- **Target surfaced:** successful outcome returns `lastDeploymentId` + `lastReference`.

### Audit
- Six `ags.launch.*` events via frozen `emitAudit`, each with `auditReference`.
- Ledger entry stores the **same** `auditReference` + `approvalRef` + `idempotencyKey`
  → full correlation (G9).
- Append-only, tenant-isolated; `FileDeploymentLedgerBackend` (JSON-lines) provides
  restart-safe durability when wired at startup.

---

## 6. Security Properties Preserved

Fail-closed default · no credential leakage (operator-owned `SecretSource`) · no
fabricated success (vendor failure → `{ok:false}`) · tenant isolation (G7) · immutable
audit (G9) · replay defense (G8). The frozen Foundation trust/tenant boundary is
re-enforced, not relaxed.

---

## 7. Remaining Risks

1. **`workflow.ts` defect (EPIC-006.5):** `runStagingWorkflow` calls non-existent
   `deploymentLedger.recordFromIdentity()` → breaks EPIC-006.5 regression `#8`. **No
   EPIC-007 impact** (not imported by `agsLaunch`). Deferred.
2. **Scoped typecheck:** 13 errors in frozen-foundation modules under
   `tsconfig.epic007.json` (missing `@types/node` via `"types": []`). 0 in EPIC-007 files.
   Pre-existing, out of scope.
3. **Durable ledger not yet wired at startup** (default in-memory; survives restart only
   when `configureDeploymentLedger(FileBackend)` is called).
4. **CF environment routing:** `deployToCloudflare` env is provenance-only; real
   staging/prod routing lives in Cloudflare project/alias config (to finalize at cutover).

---

## 8. Production Readiness Assessment

**Governance & control logic: PRODUCTION-READY ✅** (15/15 verified).
**Live end-to-end deploy: not executed** (EPIC rule — supervised operator action).
**Durable cross-restart ledger: pending startup wiring.**

Verdict: EPIC-007 is accepted as **complete** on its stated scope. Outstanding items are
operational wiring / predecessor defects, tracked below.

---

## 9. Updated Hermes Roadmap Position

EPIC-007 caps the AGS Deployment track:

```
EPIC-005  Foundation (FROZEN, Class B)
   └─ EPIC-006.5 Operational Readiness (predecessor scaffolding)
        └─ EPIC-007 Controlled Launch  ✅ COMPLETE (2026-07-21)
```

Recommended `ROADMAP.md` entry (operator to add):
> **EPIC-007 — Controlled AGS Launch/Deployment Platform** ✅ Complete (2026-07-21)
> 15/15 guarantee suite green. Single audited launch path; staging routine, prod
> fail-closed gated; idempotent; rollback-safe; tenant-isolated; audit-correlated.

---

## 10. Post-Completion: Platform Maturity Assessment

The Hermes Platform has reached **operational-governance maturity for AGS deployment**:

- **Foundation (EPIC-005):** frozen, Class B, single execution boundary. Stable.
- **Automation layers (EPIC-003.x):** execution, developer, security pipelines — all
  green, simulation-safe.
- **Deployment track (EPIC-006.5 → EPIC-007):** now provides a *governed, auditable,
  fail-closed* path from GitHub release to live `agsynergy.ca`.

**Maturity level:** *Controlled* — the system will refuse unsafe production actions by
design and leaves an immutable audit trail. It is **not yet self-operating**: the final
live deploy + durable ledger wiring + monitoring remain supervised operator tasks.

---

## 11. Recommended Next Milestone

**EPIC-008 — Live Cutover & Observability**
1. Wire `FileDeploymentLedgerBackend` (D1/KV) at production startup for durable audit.
2. Close the `workflow.ts` `recordFromIdentity` defect (or retire `runStagingWorkflow`
   if superseded by `runLaunch`).
3. Finalize Cloudflare staging/prod environment routing in project/alias config.
4. Add post-deploy synthetic monitoring + alerting on `agsynergy.ca` (probeSite-based).
5. Perform the **first supervised live production deploy** under the EPIC-007 gate.

---

## 12. Deferred Backlog Items

| ID | Item | Owner epic | Blocker? |
|---|---|---|---|
| B1 | Fix `workflow.ts` `recordFromIdentity is not a function` | EPIC-006.5 | No (off EPIC-007 path) |
| B2 | Wire durable ledger backend at startup (D1/KV) | EPIC-008 | No |
| B3 | Resolve scoped typecheck `@types/node` gap in foundation tsconfigs | EPIC-005.x | No |
| B4 | Finalize CF staging/prod routing | EPIC-008 | No |
| B5 | Post-deploy monitoring/alerting | EPIC-008 | No |
| B6 | First supervised live prod deploy | EPIC-008 | No (operator action) |

---

*Reports: `EPIC-007_BASELINE.md`, `EPIC-007_VALIDATION_REPORT.md`,
`EPIC-007_COMPLETION_REPORT.md` — all under `docs/operations/`.*
