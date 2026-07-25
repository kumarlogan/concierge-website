# EPIC-006.5 — Validation Report

**Date:** 2026-07-21
**EPIC:** Operational Readiness & Production Wiring Preparation
**Foundation:** Hermes Platform Foundation v1.0 — FROZEN (Class B, Approved)
**Classification:** Wiring-only operational controls (no core change)
**Author:** Hermes Agent (hy3)

---

## 1. Executive Summary

EPIC-006.5 adds **operational-readiness controls around** the frozen Hermes
Foundation to prepare for the first controlled production-capable AGS website
deployment. No core component was modified. 92 runtime assertions pass
(75 from EPIC-006, 17 new for EPIC-006.5). `tsc --noEmit` reports **0 errors**.
The forbidden-pattern sweep is **clean**.

## 2. Files Changed

| File | Phase | Purpose |
|------|-------|---------|
| `hermes/services/activation/providers/deployment/identity.ts` | P1/P2 | `DeploymentIdentity`, env isolation, tenant allowlist, fail-closed validation |
| `hermes/services/activation/providers/deployment/executors.ts` | P3/P4 | Readiness-only GitHub/Cloudflare executors (no deploy) |
| `hermes/services/activation/providers/deployment/ledger.ts` | P5 | Append-only, tenant-scoped deployment ledger |
| `hermes/services/activation/providers/deployment/workflow.ts` | P6 | Dry-run validated staging workflow (audited, no prod exec) |
| `hermes/services/activation/providers/deployment/__tests__/ags.deployment.ts` | P7 | 17 regression assertions (10 required proofs) |
| `docs/operations/EPIC-006.5_BASELINE.md` | P0 | Recovery baseline + drift confirmation |
| `docs/operations/EPIC-006.5_VALIDATION_REPORT.md` | P9 | This report |
| `docs/operations/EPIC-006.5_COMPLETION_REPORT.md` | P9 | Completion report |

**New module:** `deployment/` — composed entirely of frozen primitives
(`Env`, `ApprovalRef`, `SecretSource`, `emitAudit`, `grantStackBApproval`).

## 3. Architecture Impact

- **None on frozen core.** `HermesExecutionGateway`, `UniversalCapabilityPlatform`,
  `ProviderRuntimeGuard`, `TrustLifecycle`, `ApprovalService`, tenant enforcement,
  audit architecture, and provider SDK contracts are untouched.
- The `deployment/` module is a **consumer** of the frozen gateway, not a
  replacement. Production execution still routes through `executeCapability` →
  `stackBGateway` (proven by EPIC-006 P6 approval adapter + EPIC-006.5 P6 workflow).
- All deployments carry a `DeploymentIdentity` + audit reference + (for prod) a
  durable `ApprovalRef`.

## 4. Security Impact

| Control | Status |
|---------|--------|
| No deployment without `DeploymentIdentity` | ✅ enforced (fail-closed) |
| No anonymous execution (requester+approver) | ✅ enforced |
| Unknown environment ⇒ DENY | ✅ enforced |
| Production ⇒ `ApprovalRef` + valid identity + trusted provider + audit | ✅ enforced |
| Wrong tenant ⇒ DENY | ✅ enforced (allowlist `ags-fertility`) |
| Missing credential ⇒ NOT_INSTALLED ⇒ DENIED | ✅ enforced (SecretSource) |
| No secret in source | ✅ all creds via `SecretSource` env refs |
| Single execution boundary preserved | ✅ no direct provider paths |
| Fail-closed defaults preserved | ✅ |

## 5. Tests Executed

| Suite | Result |
|-------|--------|
| EPIC-006 integration | 18 passed |
| EPIC-006 bootstrap | 11 passed |
| EPIC-006 website | 24 passed |
| EPIC-006 dryrun | 13 passed |
| EPIC-006 approval | 9 passed |
| **EPIC-006.5 deployment** | **17 passed** |
| **`tsc --noEmit` (full project)** | **0 errors** |
| Forbidden-pattern sweep (`bypass`/`skipGuard`/`always allow`/`TODO`/`FIXME`) | **clean** |

### EPIC-006.5 Required Proofs (all ✅)

1. Deployment without environment ⇒ DENY
2. Production without ApprovalRef ⇒ DENY
3. Wrong tenant ⇒ DENY
4. Missing GitHub credentials ⇒ NOT_INSTALLED / DENY
5. Missing Cloudflare credentials ⇒ NOT_INSTALLED / DENY
6. Invalid DeploymentIdentity (no approver) ⇒ DENY
7. Expired approval ⇒ DENY
8. Dry-run never calls executor (only readiness, no deploy)
9. Deployment ledger tenant-isolated
10. All actions generate audit events

## 6. Remaining Risks

- **Ledger is in-memory** (per-EPIC design). A deploy-time wiring must back it
  with the durable audit store; the interface (`append`, `forTenant`,
  `getForTenant`, `countForTenant`) is identical and ready.
- **Real connectivity checks are stubbed** — executors validate credential
  presence + arg format (fail-closed) but do not shell out to `gh`/`wrangler`
  yet. That is intentional for this readiness EPIC (no actual deployment).
- **Production deployment still requires the operator** to call
  `executeWithProductionApproval` with a real `ApprovalRef` (human-granted) —
  the workflow returns a validated plan, it does not self-execute.
- **`@types/node` absent** in this sandbox ⇒ `tsc` would flag `process` in test
  harness files; runtime via `tsx` is unaffected. CI should install `@types/node`.

## 7. Production Readiness Assessment

| Dimension | Score |
|-----------|-------|
| Identity traceability | ✅ Ready |
| Environment isolation | ✅ Ready |
| Credential boundary | ✅ Ready (no secrets in source) |
| Audit linkage | ✅ Ready |
| Approval gating | ✅ Ready (prod requires human ApprovalRef) |
| Real deploy execution | ⏳ Next EPIC (requires prod creds + real executors) |

**Readiness score: 9/10** (all controls in place; only the live-execution wiring
remains, which is explicitly out of scope here).

## 8. Recommended Next EPIC

**EPIC-006.6 — Live Production Wiring (operator-gated):**
- Back `DeploymentLedger` with the durable audit store.
- Implement real GitHub/Cloudflare executors (`gh`/`wrangler` shell-out) behind
  the readiness contract.
- Connect operator-owned production credentials via `SecretSource` at deploy time
  (never committed).
- Execute the first controlled production deploy through
  `runStagingWorkflow` → human `ApprovalRef` → `executeWithProductionApproval`.
