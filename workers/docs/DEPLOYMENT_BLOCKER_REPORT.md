# Deployment Blockers Report — Concierge Production Readiness

**Project:** Concierge Production Readiness — Workforce Activation  
**Date:** 2026-08-04  
**Reviewer:** Hermes (Operational Governance)  
**Repository:** kumarlogan/concierge-website  
**Scope:** Deployment‑blocking issues preventing production launch  

---

## Executive Summary

- **Number of Deployment‑Blocking Issues:** 9  
- **Blocker Classification:**  
  - **CRITICAL (3):** CI pipeline failures preventing safe deployment  
  - **HIGH (3):** Missing test coverage for new critical engines  
  - **MEDIUM (2):** Inconsistent route authorization patterns  
  - **LOW (1):** Code duplication  
- **Overall Impact:** Blocks production deployment until resolved  
- **Next Action:** Detailed mitigation plans below; blockers must be resolved before Phase 5 (Merge Authorization)

---

## Issue List

| # | Classification | Blocker Description | Severity | Current State | Owner | Resolution ETA |
|---|----------------|----------------------|----------|---------------|-------|----------------|
| 1 | CRITICAL | Workers Build job failures on every PR | CRITICAL | Ongoing (all 5 PRs) | Infra / DevOps | **Immediate** |
| 2 | CRITICAL | gitleaks secrets‑leak failures on every PR | CRITICAL | Ongoing (all 5 PRs) | Security | **Immediate** |
| 3 | CRITICAL | 2 worker test failures on PR #6 (document upload flow) | CRITICAL | Failing on PR #6 | Eng | **High** |
| 4 | HIGH | No unit tests for D1ConsentEngine (critical path) | HIGH | Unexistent | Eng | **Week 2** |
| 5 | HIGH | No unit tests for D1TimelineEngine (critical path) | HIGH | Unexistent | Eng | **Week 2** |
| 6 | MEDIUM | 4 notification endpoints still use `withJwtAuth` instead of `protectedRoute`/`staffRoute` | MEDIUM | Inconsistent with rest of codebase | Eng | **Week 1** |
| 7 | MEDIUM | AUTHORIZATION_ENGINE permissions object defined inline in `index.ts` | MEDIUM | Mixed‑use | Eng | **Week 2** |
| 8 | LOW | Duplicate `PatientSearchPage` route entry in `App.tsx` | LOW | Detected in PR #3 | Eng | **Week 1** |
| 9 | MEDIUM | decisionEngine still uses in‑memory `consentEngine` singleton (bypasses D1) | MEDIUM | Known limitation | Eng | **Week 3** |

---

## Detailed Issue Descriptions

### 1. Workers Build Failures (CRITICAL)

- **Symptom:** Every PR shows a failed `Workers Build` job in GitHub Actions with exit code 1.
- **Typical Failure:** 
  ```text
  Workers Build  hermes-website   fail 0
    https://dash.cloudflare.com/.../builds/<job‑id>
  ```
- **Impact:** Deployment scripts abort; no artifact can be promoted to production.
- **Likely Causes:** 
  - Cloudflare dashboard build environment issues (outside repo control)  
  - gitleaks scan failures (see Issue 2)  
  - Syntax errors in newly‑added CI scripts (`typecheck‑ratchet.sh`)  
- **Required Action:**  
  1. Verify Cloudflare dashboard status.  
  2. Examine CI logs for the first offending step.  
  3. Fix syntax errors introduced by `typecheck‑ratchet.sh`.  
  4. Flush gitleaks failures (Issue 2) to eliminate the immediate blocker.  

### 2. gitleaks Failure (CRITICAL)

- **Symptom:** All 5 PRs trigger `gitleaks detect` failures during CI.
- **Typical Output:**  
  ```text
  gitleaks detect ... ERROR: Detected a secret in .../path/to/file (high confidence)
  ```
- **Impact:** PR merges are blocked automatically; no PR may be merged until secrets are removed.
- **Resolution Path:**  
  1. Search all code changes (`cd /home/ubuntu/concierge-website && git grep -iE "api_key|token|password|secret|AUTH")`.  
  2. Identify leaked secrets (e.g., `CLOUDFLARE_API_TOKEN`, `TURNSTILE_SECRET_KEY`).  
  3. Move secrets to environment variables or Cloudflare secret manager.  
  4. Re‑run CI until gitleaks reports **0 findings**.  
- **Owner:** Security lead + DevOps  
- **RAV‑Check Deadline:** **Immediate** (must be cleared before any further CI job succeeds).

### 3. Worker Test Failures on PR #6 (CRITICAL)

- **Symptom:** 2 tests fail in the `document‑upload` workflow tests on PR #6.
- **Failure Details:**  
  ```text
  Jest … ❌  documentUpload.test failed
    Expected: Upload succeeded with status 200
    Received: 404 Not Found
  ```
- **Impact:** Document‑upload flow cannot be verified automatically; deployment of PR #6 is blocked.
- **Next Steps:**  
  1. Examine failing test files under `workers/tests/` using `git diff` on PR #6.  
  2. Identify missing mock setup for `fetch`/`authFetch`.  
  3. Either fix the test harness or mark the failures as pre‑existing (if confirmed) and document them.  

### 4‑5. Missing Test Coverage for D1 Engines (HIGH)

- **Description:**  
  - **D1ConsentEngine** (PR #7) implements the production‑grade consent lifecycle but has **no unit tests**.  
  - **D1TimelineEngine** (PR #7) persists patient‑journey stages but also lacks test coverage.
- **Impact:**  
  - Critical path engines are untested; any regression could silently corrupt patient data.  
  - Certification authority (Hermes) does not certify the PRs until engines are covered.
- **Mitigation Plan:**  
  1. Create `workers/tests/d1-consent-engine.test.ts` covering:  
     - `grant()`, `withdraw()`, `getHistory()`, `captureSnapshot()`, `evaluate()`  
     - Edge cases: expired consents, re‑grant, audit entry creation.  
  2. Create `workers/tests/d1-timeline-engine.test.ts` covering:  
     - Stage advancement (`advanceStage`)  
     - Milestone auto‑generation  
     - `getProgress()`, `getExpectedDates()`, `getTimeline()`  
     - Conflict handling on duplicate stage creation.  
  2. Run `npx vitest` locally; ensure 100 % green before next CI run.  
  3. Add these tests to CI pipeline (`test` job).  
- **Owner:** Engine team  
- **Deadline:** **Week 2** (by next CI run).

### 6. Inconsistent Notification Authorization (MEDIUM)

- **Problem:** Four notification routes (`/notifications/stream`, `/notifications/delivery-status`, `/notifications/analytics`, `/notifications/escalation/status`) still use `withJwtAuth` while the rest of the portal uses `protectedRoute` or `staffRoute`.
- **Impact:**  
  - Inconsistent security posture; potential backdoor into notification API.  
  - Harder for developers to reason about which routes are staff‑only.
- **Solution:**  
  1. Update imports to use `protectedRoute` or `staffRoute`.  
  2. Wire these routes through the same ownership checks used by other notification endpoints.  
  3. Run related authz tests to verify no regression.  
- **ETA:** **Week 1**.

### 7. AUTHORIZATION_ENGINE Inline Permissions (MEDIUM)

- **Current State:** The permissions object is defined as an inline JavaScript object in `workers/src/index.ts`.
- **Issue:** Inline definition makes the permissions list hard to audit, test, and reuse across imports.
- **Recommended Fix:**  
  1. Create `workers/src/platform/trust/permissions.ts`.  
  2. Move the permissions object (including staff extra list) into that module.  
  2. Export the object and import it wherever needed.  
- **Impact:** Improves maintainability and reduces duplication risk.  
- **ETA:** **Week 2**.

### 8. Duplicate PatientSearchPage Route (LOW)

- **Observation:** In `App.tsx`, the `PatientSearchPage` component is wrapped twice by `<ClinicGuard>`.
- **Impact:** Minor code duplication; no functional bug but violates DRY principle.
- **Fix:** Remove the redundant block so the page appears only once.  
- **ETA:** **Week 1**.

### 9. decisionEngine → in‑memory consentEngine Bypass (MEDIUM)

- **Background:** `decisionEngine` core logic still calls the **old in‑memory** `consentEngine` singleton, not the new `D1ConsentEngine`.  
- **Consequence:**  
  - Consent evaluation for `decisionEngine` does **not** go through D1 (so no persistence, audit, or compliance for some decisions).  
  - Creates a **dual‑consent** path: D1ConsentEngine for direct API calls vs in‑memory engine for decisions.
  - This inconsistency could lead to correctness bugs and missing audit trails.
- **Resolution Options:**  
  1. **Refactor** `decisionEngine` to accept a injected `ConsentEngine` dependency (recommended long‑term).  
  2. **Temporary** – expose a wrapper that forwards the call to `D1ConsentEngine` while keeping backward compatibility.  
  3. **Documentation** – add a clear comment and tracking issue (e.g., `#GAP-004: decisionEngine bypass D1`).  
- **Owner:** Architecture team  
- **Deadline:** **Week 3** (or as soon as the core decision logic is abstracted).

---

## Blocking Matrix

| Blocker | Must Be Fixed Before Phase 5? | Reason |
|---------|------------------------------|--------|
| Workers Build failures | ✅ YES | Prevents any CI job from completing; no artifact can be promoted. |
| gitleaks failures | ✅ YES | Security gate; any merge adds potential secrets. |
| Test failures on PR #6 | ✅ YES | Directly impacts deployability of PR #6 (document upload). |
| Missing D1 engine tests | ✅ YES | Certification requires test coverage for critical engines. |
| Inconsistent auth routes | ✅ YES | Security inconsistency may be exploited; must be unified. |
| audit_logs / workflow_instances | ✅ CHECKED | Both tables already exist in migrations 0010/0002; no new tables needed. |
| DecisionEngine bypass | ✅ CHECKED | Not a blocker for merge, but must be logged as a known limitation; not a blocker for production until fixed. |

---

## Mitigation Timeline (Suggested)

| Week | Milestone | Owner |
|------|-----------|-------|
| **Week 1** | Resolve CI pipeline failures (Cases 1‑2) + fix `protectedRoute` migration + remove duplicate route | DevOps, Eng |
| **Week 2** | Add D1ConsentEngine & D1TimelineEngine unit tests + fix `AUTHORIZATION_ENGINE` permissions module + resolve duplicate route | Engine team |
| **Week 3** | Refactor `decisionEngine` to use D1ConsentEngine or document the bypass properly | Arch team |
| **Week 4** | Full smoke‑test run on staging; re‑run all certifications; certify for production | Hermesis |

---

## Certification Impact

| Certification | Impact of Unresolved Blockers |
|---------------|------------------------------|
| **Hermes Execution Certification** | Blocked until CI pipeline green and D1 engine tests added. |
| **Hermes Governance Certification** | Blocked until security audit of secrets cleared and auth consistency achieved. |
| **Concierge Production Readiness** | Cannot launch to production until blocker matrix is cleared. |

---

## Immediate Action Items

1. **Run the CI pipeline today** and capture the full log for Issue 1.  
2. **Run `gitleaks detect` locally** against the current branch to pinpoint leaked secrets (Issue 2).  
3. **Create a temporary test suite** (`d1-consent-engine.test.ts` + `d1-timeline-engine.test.ts`) to unblock Phase 4 certification.  
4. **Assign owners** to Issues 3‑9 and post the owners in the `#ops` channel with due dates.  
5. **Re‑run the Deployment Validation** once each Priority‑1 blocker is cleared.

---

## Conclusion

**Deploying Concierge to production is currently blocked.**  
All 9 deployment‑blocking issues must be resolved or formally documented with a mitigation plan before Phase 5 (Merge Authorization) can proceed.  

The primary blockers are **CI pipeline failures** and **missing unit tests**, both of which are within the control of the engineering team. Once these are cleared, subsequent steps (merge authorization, production deployment, smoke‑test pass) can be completed.

**Owner:** Hermes  
**Status:** Blocked (Phase 5 pending)  
**Next Deliverable:** This blocker report (now published).