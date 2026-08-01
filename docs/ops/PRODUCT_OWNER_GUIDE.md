# PRODUCT_OWNER_GUIDE.md

**EPIC-012 — Release Management & Multi-Mode Execution**
**Phase J: Final Certification — Product Owner Guide**
**Date:** 2026-08-01
**Product:** Hermes Platform (reusable by every future Hermes product)
**Wave:** EPIC-012
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

Product Owner Guide provides the decision-making framework for the Product Owner managing Hermes releases. It covers approval workflows, release review procedures, rollback decisions, and governance compliance. This guide ensures the PO has all the information needed to make informed release decisions.

---

## 1. Product Owner Responsibilities

### 1.1 Release Approval

| Responsibility | When | Action |
|---------------|------|--------|
| Review release plan | Before production deploy | Approve or reject release plan |
| Review integrity gate results | Before production deploy | Confirm all gates passed |
| Review health check results | Before production deploy | Confirm all checks healthy |
| Review smoke test results | Before production deploy | Confirm all smoke tests pass |
| Approve production deploy | At production gate | Approve via ApprovalRef |
| Review deployment evidence | After production deploy | Confirm evidence package complete |
| Review release notes | After production deploy | Confirm accuracy and completeness |
| Approve release closure | After all verification | Close release in ReleaseRegistry |

### 1.2 Release Review

| Review Type | Frequency | Scope |
|-------------|-----------|-------|
| Release readiness review | Before each production deploy | Gates, health, smoke tests, evidence |
| Release post-mortem review | After each failed deploy | Root cause, prevention, remediation |
| Release metrics review | Monthly | Success rate, rollback frequency, MTTR |
| Release backlog review | Monthly | Future items, priorities, dependencies |

### 1.3 Rollback Decision

| Scenario | Decision | Criteria |
|----------|----------|----------|
| Post-deploy health check fails | Rollback | Any critical health check fails |
| Smoke test fails | Rollback | Any smoke test fails |
| Production outage | Rollback | Immediate |
| Security vulnerability discovered | Rollback | Immediate |
| Minor feature issue, no outage | Fix forward | Issue is non-critical, no outage |
| Performance degradation | Rollback or fix forward | Depends on severity and user impact |

---

## 2. Release Approval Workflow

### 2.1 Production Deploy Approval

```
1. Release Coordinator submits release plan
   └── PO receives release plan for review

2. PO reviews release plan
   ├── Mode: Production
   ├── Target: agsynergy.ca, api.agsynergy.ca
   ├── Version: From CHANGELOG.md
   ├── Gates: All 4 integrity gates
   ├── Approval: PO approval required
   └── Rollback: Previous release available

3. PO reviews integrity gate results
   ├── Gate 1: Repository Integrity ✅
   ├── Gate 2: Required Files ✅
   ├── Gate 3: Import Resolution ✅
   └── Gate 4: Production Bundle Guard ✅

4. PO reviews health check results
   ├── Pre-deploy health check ✅
   └── All dependencies healthy ✅

5. PO reviews smoke test results
   ├── All smoke tests pass ✅
   └── No regressions detected ✅

6. PO reviews deployment evidence
   ├── Build output ✅
   ├── Test results ✅
   ├── Deploy log ✅
   ├── Integrity results ✅
   ├── Health check results ✅
   ├── Smoke test results ✅
   ├── Release notes ✅
   └── Deployment report ✅

7. PO approves via ApprovalRef
   └── Approval recorded in audit trail

8. CI/CD executes production deploy
   └── PO monitors deploy progress

9. PO reviews post-deploy results
   ├── Health checks pass ✅
   ├── Smoke tests pass ✅
   └── Release notes published ✅

10. PO closes release
    └── Release record: DEPLOYED
```

### 2.2 Approval Gate Details

| Gate | PO Action | Evidence Required |
|------|-----------|-------------------|
| Release plan review | Approve or reject | Release plan with mode, target, gates |
| Integrity gates review | Confirm passed | CI/CD log showing all gates green |
| Health check review | Confirm healthy | DeploymentHealthFramework results |
| Smoke test review | Confirm passed | Smoke Test Framework results |
| Evidence review | Confirm complete | Evidence package (9 types) |
| Final approval | Approve via ApprovalRef | ApprovalRef in audit trail |

---

## 3. Release Review Procedures

### 3.1 Release Readiness Review

| Step | Action | PO Responsibility |
|------|--------|-------------------|
| 1 | Review release plan | Confirm mode, target, version |
| 2 | Review integrity gates | Confirm all gates will pass |
| 3 | Review health checks | Confirm pre-deploy health is green |
| 4 | Review smoke tests | Confirm smoke tests are ready |
| 5 | Review evidence collection | Confirm evidence will be captured |
| 6 | Review rollback plan | Confirm rollback is available |
| 7 | Make approval decision | Approve or reject |

### 3.2 Release Post-Mortem Review (After Failed Deploy)

| Step | Action | PO Responsibility |
|------|--------|-------------------|
| 1 | Review failure report | Understand what went wrong |
| 2 | Review root cause analysis | Confirm root cause identified |
| 3 | Review prevention plan | Confirm prevention measures in place |
| 4 | Review rollback result | Confirm rollback was successful |
| 5 | Review lessons learned | Confirm lessons captured |
| 6 | Approve fix and redeploy | Approve or request additional fixes |

### 3.3 Release Metrics Review (Monthly)

| Metric | Source | PO Action |
|--------|--------|-----------|
| Deploy success rate | ReleaseRegistry | Review trends, identify issues |
| Rollback frequency | RollbackMetadata | Review causes, prevent recurrence |
| Mean time to rollback | RollbackMetadata | Review response time |
| Mean time to recovery | DeploymentHistory | Review recovery time |
| Health check pass rate | DeploymentHealthFramework | Review dependency health |
| Smoke test pass rate | Smoke Test Framework | Review test coverage |
| Integrity gate pass rate | CI/CD pipeline | Review gate effectiveness |

---

## 4. Governance Compliance

### 4.1 PO Governance Responsibilities

| Governance Area | PO Responsibility | Evidence |
|-----------------|-------------------|----------|
| Approval gates | Approve production deploys via ApprovalRef | Audit trail |
| Foundation compliance | Verify no foundation modifications | Release certification |
| Test baseline | Verify tests pass (774/774) | CI/CD test results |
| Build baseline | Verify build clean (0 TS errors) | CI/CD build results |
| EPCL governance | Verify release follows EPCL workflow | EPCL trace |
| WAS governance | Verify WAS state transitions are valid | WAS audit trail |
| WEF governance | Verify WEF delegation is correct | WEF audit trail |
| Audit compliance | Verify audit events are emitted | Audit trail |

### 4.2 PO Decision Log

| Date | Decision | Rationale | Outcome |
|------|----------|-----------|---------|
| 2026-07-30 | Approve v1.1.0 production deploy | All gates passed, health checks green, smoke tests pass | ✅ Deployed successfully |
| 2026-07-30 | Reject v1.1.0 attempt 1 | Integrity gate 3 failed (untracked file) | ❌ Build failed |
| 2026-07-30 | Reject v1.1.0 attempt 2 | Integrity gate 3 failed (untracked file) | ❌ Build failed |

---

## 5. Release Dashboard Interpretation

### 5.1 Dashboard Panels for PO

| Panel | What PO Looks For | Green | Red |
|-------|-------------------|-------|-----|
| Release Status | Latest release status | DEPLOYED | FAILED |
| Deployment History | Recent deploy outcomes | All successful | Any failed |
| Health Checks | All dependencies healthy | All green | Any red |
| Mode Transitions | Transitions completed | All complete | Any failed |
| Integrity Gates | All gates passed | All green | Any red |
| Evidence Collection | All evidence captured | Complete | Any missing |
| Rollback Status | Rollback available | Available | Not available |
| Approval Gates | PO approval status | Approved | Pending |

### 5.2 PO Decision Triggers

| Trigger | PO Action |
|---------|-----------|
| Release Status = FAILED | Review failure, approve fix and redeploy |
| Health Check = Red | Investigate, consider rollback |
| Integrity Gate = Red | Reject release, require fix |
| Evidence Collection = Incomplete | Request evidence before approval |
| Rollback Status = Not Available | Ensure rollback plan before approving |
| Approval Gates = Pending > 24h | Follow up with Release Coordinator |

---

## 6. Phase J Completion Criteria

| # | Deliverable | Status |
|---|------------|--------|
| 1 | Product Owner Guide produced | ✅ Complete |
| 2 | PO responsibilities documented | ✅ Complete |
| 3 | Approval workflow documented | ✅ Complete |
| 4 | Release review procedures documented | ✅ Complete |
| 5 | Rollback decision framework documented | ✅ Complete |
| 6 | Governance compliance documented | ✅ Complete |
| 7 | Dashboard interpretation guide provided | ✅ Complete |

---

*End of PRODUCT_OWNER_GUIDE.md*
