# MEOW — Execution Registry

> **Document:** MEOW_EXECUTION_REGISTRY.md
> **Version:** 1.0.0
> **Date:** 2026-08-04
> **Status:** Draft — Awaiting Product Owner Approval
> **Owner:** Hermes Platform
> **Repository:** concierge-website (GitHub) + Hermes OCI
> **Audit Type:** READ-ONLY — no code changes, no commits, no deployments

---

## Governance Header

```
Company:        AGS
Platform:       Hermes AI Platform
Product:        Concierge (AG Synergy)
Public Brand:   AG Synergy
Repository:     concierge-website
Roadmap:        Hermes Strategic Roadmap
Phase:          Executive Architecture — MEOW
```

---

## 1. Purpose

The Execution Registry catalogs all execution modes, release modes, approval gates, promotion flows, runtime states, deployment states, verification states, and certification states. Everything in the registry must become queryable.

---

## 2. Execution Modes

| Mode | Name | Description | Owner |
|---|---|---|---|
| EXEC-01 | Sequential | Execute tasks in order, one at a time | EPCL |
| EXEC-02 | Parallel | Execute independent tasks concurrently | EPCL |
| EXEC-03 | Batch | Group tasks into batches for efficiency | EPCL |
| EXEC-04 | Triggered | Execute on event/trigger | EPCL |
| EXEC-05 | Scheduled | Execute on cron schedule | EPCL |
| EXEC-06 | Manual | Execute on human command | EPCL |
| EXEC-07 | Approval-Gated | Execute only after human approval | EPCL |
| EXEC-08 | Fail-Closed | Abort on any failure | EPCL |
| EXEC-09 | Idempotent | Safe to retry without side effects | EPCL |
| EXEC-10 | Rollback-Capable | Can revert to previous state | EPCL |

---

## 3. Release Modes

| Mode | Name | Description | Owner |
|---|---|---|---|
| REL-01 | Direct Deploy | Deploy directly to production | Release Orchestrator |
| REL-02 | Staged Rollout | Gradual rollout to production | Release Orchestrator |
| REL-03 | Blue/Green | Deploy alongside existing, switch traffic | Release Orchestrator |
| REL-04 | Canary | Deploy to subset of traffic first | Release Orchestrator |
| REL-05 | Rollback | Revert to previous version | Release Orchestrator |
| REL-06 | Hotfix | Emergency fix bypassing normal pipeline | Release Orchestrator |
| REL-07 | Preview | Deploy to preview environment | Release Orchestrator |
| REL-08 | Dry Run | Execute release pipeline without deploying | Release Orchestrator |

---

## 4. Approval Gates

| Gate | Name | Description | Required For |
|---|---|---|---|
| GATE-01 | Intent Approval | Approve initiative intent before execution | EPCL |
| GATE-02 | Plan Approval | Approve execution plan before running | EPCL |
| GATE-03 | Pre-Deploy Approval | Approve deployment to staging | Release Orchestrator |
| GATE-04 | Production Approval | Approve deployment to production | Release Orchestrator |
| GATE-05 | Certification Approval | Approve certification completion | Certification |
| GATE-06 | Rollback Approval | Approve rollback action | Release Orchestrator |
| GATE-07 | Emergency Approval | Approve emergency/hotfix deployment | Release Orchestrator |
| GATE-08 | PO Review | Product Owner review and sign-off | All releases |
| GATE-09 | Architecture Review | Architecture review for changes | Architecture changes |
| GATE-10 | Security Review | Security review for changes | Security-sensitive changes |

---

## 5. Promotion Flow

```
Development → Staging → Preview → Production
     |           |          |          |
  Auto-dep    Gate-03    Gate-04    Gate-04
  (no gate)   (required) (required) (required)
```

| Stage | Deployment State | Verification State | Certification State |
|---|---|---|---|
| Development | Deployed | Unit tests pass | Not certified |
| Staging | Deployed | Integration tests pass | In progress |
| Preview | Deployed | E2E tests pass | In progress |
| Production | Deployed | Health checks pass | Certified |

---

## 6. Runtime States

| State | Name | Description | Transitions |
|---|---|---|---|
| RT-01 | Idle | Runtime is running but no task active | → Active |
| RT-02 | Active | Runtime is executing a task | → Idle, → Paused, → Error |
| RT-03 | Paused | Runtime is paused by operator | → Active, → Idle |
| RT-04 | Error | Runtime encountered an error | → Idle (after resolution) |
| RT-05 | Degraded | Runtime operating with reduced capacity | → Active, → Idle |
| RT-06 | Offline | Runtime is not available | → Idle (after restart) |

---

## 7. Deployment States

| State | Name | Description | Transitions |
|---|---|---|---|
| DEP-01 | Pending | Deployment is queued | → In Progress |
| DEP-02 | In Progress | Deployment is executing | → Success, → Failed |
| DEP-03 | Success | Deployment completed successfully | → Healthy |
| DEP-04 | Failed | Deployment failed | → Pending (retry), → Rolled Back |
| DEP-05 | Healthy | Deployment is healthy in production | → Updated |
| DEP-06 | Updated | Deployment updated to new version | → Healthy |
| DEP-07 | Rolled Back | Deployment reverted to previous version | → Pending |

---

## 8. Verification States

| State | Name | Description | Transitions |
|---|---|---|---|
| VER-01 | Not Verified | Verification has not been run | → In Progress |
| VER-02 | In Progress | Verification is running | → Passed, → Failed |
| VER-03 | Passed | Verification passed | → Certified |
| VER-04 | Failed | Verification failed | → In Progress (fix), → Not Verified (retry) |
| VER-05 | Certified | Verification certified | → Released |

---

## 9. Certification States

| State | Name | Description | Transitions |
|---|---|---|---|
| CERT-01 | Not Certified | No certification attempt | → In Progress |
| CERT-02 | In Progress | Certification is running | → Passed, → Failed |
| CERT-03 | Passed | Certification passed | → Certified |
| CERT-04 | Failed | Certification failed | → In Progress (remediate) |
| CERT-05 | Certified | Certification complete | → Released |

---

## 10. Queryability

All registry entries are structured and queryable:

| Registry | Query Interface | Format |
|---|---|---|
| Execution Modes | Registry lookup by mode ID | Table (Section 2) |
| Release Modes | Registry lookup by mode ID | Table (Section 3) |
| Approval Gates | Registry lookup by gate ID | Table (Section 4) |
| Promotion Flow | State transition diagram | ASCII (Section 5) |
| Runtime States | Registry lookup by state ID | Table (Section 6) |
| Deployment States | Registry lookup by state ID | Table (Section 7) |
| Verification States | Registry lookup by state ID | Table (Section 8) |
| Certification States | Registry lookup by state ID | Table (Section 9) |

---

*MEOW Deliverable 4 of 15*
