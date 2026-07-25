# EPIC-007 Baseline — Controlled AGS Launch / Deployment Platform

> **Phase:** 10 (Documentation & Acceptance Baseline)
> **Date:** 2026-07-21
> **Status:** Delivered — 15/15 guarantee suite green (validated by real execution)
> **Scope:** Documentation only. No source edits, no commits, no deploy.
> **Module:** `hermes/services/activation/providers/deployment/` (new, untracked)

---

## 1. Objective

EPIC-007 delivers the **single, governed execution path that takes AGS from a GitHub
release to a live, verified deployment on `agsynergy.ca`** — and makes the
**staging ↔ production governance asymmetry explicit and auditable**.

- **Staging** → routine, no human approval, standard RLSE (readiness + live smoke + rollback-capability) gate.
- **Production** → **fail-closed gated**: blocked unless *all* of the following hold —
  a durable `ApprovalRef` + authorized approver + AGS-owned domain + semantic GitHub
  release tag + change-freeze guard + live secret validity + a verified rollback target.

The platform owns **policy, sequencing, idempotency, and audit wiring**. Providers
(`gh`/`wrangler`/git) own **execution only**. No Foundation (EPIC-005) rewrite.

---

## 2. Architecture Impact Assessment

| Dimension | Baseline (pre-EPIC-007) | Post-EPIC-007 |
|---|---|---|
| Deployment entry point | None governed; ad-hoc `deploy-website` skill | `agsLaunch()` → `runLaunch()` single audited path |
| Staging vs Prod | Undifferentiated | Explicit governance fork in one function |
| Production approval | Manual / out-of-band | Durable `ApprovalRef` + `PROD_APPROVERS` authority check |
| Idempotency | None (replay risk) | `idempotencyKey` → fail-closed double-execution prevention |
| Rollback safety | Manual | Pre-flight `rollbackCapable()` deny if no target (G4b) |
| Audit correlation | Partial | Every launch emits `ags.launch.*` + ledger `auditReference` (G9) |
| Tenant isolation | Frozen `enforceTenant` | Re-enforced at ledger + site-identity + guardrail layers |

**What EPIC-007 composes (does NOT re-author):**
- Frozen Foundation (EPIC-005): `provider-framework.ts` (`ApprovalRef`, `executeCapability`),
  `audit/event.ts` (`emitAudit`), `secret-source.ts` (`resolveSecret`), `contracts/platform-api.ts`.
- EPIC-006.5 predecessor scaffolding in the same directory: `identity.ts`,
  `executors.ts`, `workflow.ts` (the latter is **not** on the EPIC-007 launch path).

**Boundary preserved:** One execution boundary remains Hermes-owned (per EPIC-005
Foundation freeze). EPIC-007 adds a *second, AGS-specific* control plane on top of it;
providers never decide approval, tenancy, domain, or trust.

---

## 3. Files Changed

The entire `deployment/` directory is **new and untracked** (14 files, 2,103 lines).
Broken into EPIC-007-authored vs EPIC-006.5 predecessor artifacts:

### EPIC-007 deliverable (10 files)
| File | Lines | Role |
|---|---|---|
| `index.ts` | 106 | Single entry `agsLaunch()`; wires GitHub + Cloudflare backends via `Spawner` |
| `launch.ts` | 296 | `runLaunch()`: pre-flight governance → idempotency → RLSE → dry-run → execute |
| `ledger.ts` | 208 | Tenant-isolated, append-only deployment ledger; memory + file backends; idempotency; revoke |
| `guardrails.ts` | 131 | Fail-closed production gate set (tenant, approval, approver, domain, tag, freeze, secret) |
| `rlse.ts` | 87 | Readiness + live smoke + rollback-capability executor (pre/post-flight reality check) |
| `site-identity.ts` | 150 | AGS site identity (tenant `ags-fertility`, domain `agsynergy.ca`) + `probeSite()` |
| `backends/spawner.ts` | 41 | Provider-neutral process-spawn seam + `spawnResultToTool` (fail-closed mapping) |
| `backends/github-exec.ts` | 109 | Real `gh`/`git` backend via Spawner |
| `backends/cloudflare-exec.ts` | 107 | Real `wrangler` backend via Spawner |
| `__tests__/epic007.launch.test.ts` | 338 | 15-guarantee verification suite (real modules, fake vendor spawner) |

### EPIC-006.5 predecessor artifacts (composed, not authored by EPIC-007)
| File | Lines | Role | On EPIC-007 path? |
|---|---|---|---|
| `identity.ts` | 159 | `DeploymentIdentity` validation/minting | No (used by `workflow.ts`) |
| `executors.ts` | 90 | Readiness executors (GitHub/Cloudflare) | **Yes** (via `rlse.ts`) |
| `workflow.ts` | 143 | Dry-run staging workflow (`runStagingWorkflow`) | No |
| `__tests__/ags.deployment.ts` | 138 | EPIC-006.5 regression suite (10 checks) | No |

---

## 4. Tests Executed

| Suite | File | Result | Notes |
|---|---|---|---|
| EPIC-007 Guarantee Suite | `epic007.launch.test.ts` | **15 passed, 0 failed** | Real `launch`/`ledger`/`guardrails`/`rlse`/`backends`; only the **vendor spawner is faked** (correct — that is the provider seam) |
| EPIC-006.5 Regression Suite | `ags.deployment.ts` | **7 passed, 1 failed** | Check `#8` (`runStagingWorkflow` dry-run) throws: `deploymentLedger.recordFromIdentity is not a function` — see §7 |

The EPIC-007 suite is the authoritative acceptance gate for this epic and is **fully green**.

---

## 5. Guardrails Verified

Production launch is refused (fail-closed) unless every guard passes. Each guard
**throws `LaunchError`** — no silent allow:

| Guard | Function | Denies when |
|---|---|---|
| Tenant lock | `requireTenant` | tenant ≠ `ags-fertility` |
| Approval presence | `requireProdApproval` | no `ApprovalRef` / `id` missing |
| Approval expiry | `requireProdApproval` | `expiresAt` < now |
| Approver authority | `requireProdApproverAuthority` | approver ∉ `PROD_APPROVERS` (`lead@ags`, `admin@ags`) |
| Domain ownership | `requireDomainOwnership` | domain ≠ `agsynergy.ca` |
| Release tag | `requireGithubReleaseTag` | ref ∉ `^v\d+\.\d+\.\d+$` |
| Change-freeze | `enforceProdChangeFreezeGuard` | last prod success < `PROD_CHANGE_FREEZE_GUARD_HOURS` (24h) |
| Live secret | `checkSecretExpiry` | `CF_API_TOKEN` absent from secret source |

Staging bypasses all production-only guards (guards early-return for non-prod).

---

## 6. Security Properties Preserved

- **Fail-closed by default:** any guard throw aborts *before* any provider call and is
  recorded as a `denied` ledger entry + `ags.launch.denied` audit event.
- **No credential leakage:** backends resolve tokens from the operator-owned
  `SecretSource` at call time (`resolveSecret`); never hardcoded; absent token ⇒
  `{ ok:false }` fail-closed.
- **No fabricated success:** vendor failure maps to `{ ok:false, error }` — backends
  never throw across the platform boundary or invent a result.
- **Tenant isolation:** ledger reads/writes are keyed by tenant; cross-tenant query
  returns nothing (G7).
- **Audit immutability:** `emitAudit` is the frozen Foundation primitive; every launch
  outcome is correlated to its ledger entry via `auditReference` (G9).
- **Idempotency / replay defense:** same `(tenant, idempotencyKey)` never double-executes (G8).

---

## 7. Remaining Risks

1. **`workflow.ts` defect (EPIC-006.5, not EPIC-007):** `runStagingWorkflow` calls
   `deploymentLedger.recordFromIdentity()`, a method that does not exist on the
   `DeploymentLedger` class. This breaks EPIC-006.5 regression check `#8`. **Impact on
   EPIC-007: none** — `index.ts`/`agsLaunch` do not import `workflow.ts`. Tracked as
   deferred backlog (§9).
2. **Scoped typecheck surfaced 13 errors in frozen-foundation modules**
   (`audit/store.durable.ts`, `trust/*`, `secret-source.ts`) under `tsconfig.epic007.json`,
   all caused by `"types": []` excluding `@types/node` (`BufferEncoding`/`process`/`crypto`).
   **Zero errors in EPIC-007's own 9 files.** Pre-existing foundation build-config gap,
   out of EPIC-007 scope.
3. **File ledger backend is opt-in:** production durability requires
   `configureDeploymentLedger(new FileDeploymentLedgerBackend(...))` at startup; default
   is in-memory (lost on restart). Not yet wired to D1/KV.
4. **`deployToCloudflare` env selection** is encoded in project/alias wiring, not the
   `env` arg (carried only as provenance) — environment routing must be finalized in
   the real Cloudflare project config.

---

## 8. Production Readiness Assessment

| Capability | Ready? | Evidence |
|---|---|---|
| Staging launch (routine) | ✅ | G1, G-series green |
| Production launch (gated) | ✅ (logic) | G2/G2b/G2c/G2d/G3/G4/G4b green |
| Rollback pre-flight gate | ✅ | G4b green |
| Audit correlation | ✅ | G9 green |
| Real backend fail-closed | ✅ | G6/G6b green |
| Durable cross-restart ledger | ⚠️ | File backend exists; startup wiring pending |
| End-to-end live deploy | ⛔ | Not executed (EPIC rules: no deploy); requires real CF/GH tokens + human approval |

**Verdict:** EPIC-007's *governance and control logic* is production-ready and verified.
The *live end-to-end deploy* is intentionally not performed under EPIC rules and remains
a supervised operator action.

---

## 9. Updated Hermes Roadmap Position

EPIC-007 is the **capstone of the AGS Deployment track**, sitting directly atop:

```
EPIC-005  Foundation (FROZEN, Class B)  — identity / authorization / audit / trust / tenant
   └─ EPIC-006.5 Operational Readiness   — identity.ts / executors.ts / workflow.ts (predecessor scaffolding)
        └─ EPIC-007 Controlled Launch     — governed staging+prod deploy (THIS EPIC)
```

It converts the frozen Foundation + EPIC-006.5 primitives into an **actually governed
AGS production deployment capability**. Recommended roadmap entry (to be added to
`ROADMAP.md` by the operator):

> **EPIC-007 — Controlled AGS Launch/Deployment Platform** ✅ Complete (2026-07-21)
> 15/15 guarantee suite green. Single audited launch path; staging routine, production
> fail-closed gated; idempotent; rollback-safe; tenant-isolated; audit-correlated.

**Next milestone recommendation:** EPIC-008 — *Live Cutover & Observability*: wire the
`FileDeploymentLedgerBackend` to D1/KV at startup, close the `workflow.ts` defect, and
add post-deploy synthetic monitoring + alerting on `agsynergy.ca`. (See Completion Report §Deferred Backlog.)
