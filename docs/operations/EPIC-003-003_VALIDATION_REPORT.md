# EPIC-003-003 · Hermes Security Automation Platform — Validation Report

> **Status:** ✅ COMPLETE — validated 2026-07-19
> **Scope:** Hermes Security Automation Platform — M1 (Security Work Model) through
> M9 (Docs), built on existing EPIC-003-001 foundations (Identity, Authorization,
> Audit, Workforce, Activation Platform) without touching production.
> **Authoritative validation:** real `tsc --noEmit` (in-scope) + real `vitest`.
> No simulated output.

---

## 1. Validation Summary

| Gate | Command | Result |
|---|---|---|
| Security-automation test suite | `npx vitest run workers/tests/hermes.security.003.test.ts` | ✅ **28/28 pass** |
| In-scope typecheck | `npx tsc --noEmit` (filtered to `hermes/services/security/**` + `hermes/admin/index.ts`) | ✅ 0 errors |
| Full-project typecheck | `npx tsc --noEmit` | ✅ 0 errors (whole repo) |
| Secret scan | grep for `akia…` / `ghp_…` / `sk-…` / `cfr_` / `cfat_` / `api_key=` in `hermes/services/security/**` | ✅ 0 matches |
| Boundary check (Hermes-only) | `git status --short` | ✅ only `hermes/services/security/**` + `hermes/admin/index.ts` + new test/doc files for this epic |

**Note on the full `vitest` run:** a small number of OTHER suite files fail at the vitest
config level because `hermes/identity/principal.ts` imports an unresolved `@hermes/permissions`
package alias. This is **pre-existing, unrelated debt** (it fails identically before
EPIC-003-003 and is outside `hermes/services/security`). The authoritative check is the
isolated security suite (`28/28`) plus the full-project `tsc --noEmit` (0 errors).

---

## 2. Test Evidence — `hermes.security.003.test.ts` (28 tests)

**M1 · Security Work Model**
- ✅ `normalizeScanRequest` fills defaults (reporter, env, minSeverity, scope)
- ✅ `defaultChecks` differs by environment (production adds supply-chain + container)

**M2 · Security Agent Runtime**
- ✅ inactive agent cannot execute (fail-closed, `executed:false`)
- ✅ active agent executes an authorized capability (`executed:true`, no real scanner)
- ✅ framework refuses an unadvertised capability (fail-closed)
- ✅ `disableSecurityAgent` stops execution

**M3 · Security Provider Framework**
- ✅ registers the security provider with all capabilities (`sec.secret-scan`, `sec.dep-scan`, `sec.sast-scan`, `sec.container-scan`, `sec.supply-chain-scan`)
- ✅ `resolveProviderForCapability` returns undefined while inactive (fail-closed)
- ✅ security capabilities are NOT gated at capability level (approval is request-governed)
- ✅ `getSecurityProvider` / `validateScanRequest` exported and usable

**M4 · OSS Compatibility Layer**
- ✅ `makeSimulatedSecurityExecutor` produces deterministic findings
- ✅ `OSS_ADAPTERS` documents the gitleaks/semgrep/osv-scanner/trivy port mapping

**M5 · Developer → Security Integration**
- ✅ creates a security review request from a dev request
- ✅ production dev request sets `approvalRequirement.required=true`
- ✅ runs a full security review for a completed dev task (agent active) → package with findings + risk + recommendation
- ✅ no active provider → scan reports unresolved, does not throw

**M6 · Risk Engine**
- ✅ `aggregateRisk` + `scoreRisk` compute numeric severity bands
- ✅ no findings → LOW (non-prod)
- ✅ critical finding → CRITICAL
- ✅ fails closed on corrupted input → CRITICAL
- ✅ `scoreRisk` returns numeric detail

**M7 · Admin Visibility**
- ✅ `buildSecurityAdminView` aggregates reviews
- ✅ `adminViewSecurity` requires human principal with security read (`hermes:admin:read`)
- ✅ `adminViewSecurity` returns view for authorized principal
- ✅ emits `sec.*` audit events on scan

**M8 · Test Suite / Ring Buffer**
- ✅ security reviews stored in the dedicated ring buffer (`security-store.ts`)
- ✅ list endpoint returns aggregated reviews

---

## 3. Security / Boundary Validation

| Check | Result |
|---|---|
| No production code modified | ✅ (only new `security/` modules + `admin/index.ts` facade + new test/doc files) |
| No secrets / Cloudflare / Worker mutation | ✅ (none in scope; secret scan clean; no deploy performed) |
| Human approval mandatory | ✅ (`enableProvider` + agent approve/activate enforced; tests assert denial for unauthorized) |
| Simulation-only scanner | ✅ (scanner backend is an injectable simulated executor; real vendor CLIs are a documented follow-up) |
| Scanner backend replaceable | ✅ (resolved via capability id; executor injectable via `setSecurityExecutor`) |
| Fail-closed on missing executor / unresolved capability / inactive agent | ✅ (asserted across M2/M3) |
| No autonomous remediation | ✅ (agent collects findings + produces a package; never remediates or auto-blocks beyond governed `blocksAutonomous`) |
| Audit trail | ✅ (`sec.*` events emitted on transition, scan, and review; asserted in tests) |

---

## 4. Commands to Reproduce

```bash
cd /home/ubuntu/concierge-website/workers
npx vitest run tests/hermes.security.003.test.ts   # 28/28
cd /home/ubuntu/concierge-website
npx tsc --noEmit                                    # 0 errors (whole repo)
npx tsc --noEmit 2>&1 | grep "services/security"    # 0 errors (in-scope)
```
