# MEOW — Release Alignment

> **Document:** MEOW_RELEASE_ALIGNMENT.md
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

Review Release Operations and promote reusable release governance into Hermes. Keep product-specific release content in product repositories. No duplication.

---

## 2. Current Release State

### 2.1 Release Pipeline

```
Development → Staging → Preview → Production
     |           |          |          |
  Auto-dep    Gate-03    Gate-04    Gate-04
  (no gate)   (required) (required) (required)
```

### 2.2 Release Modes

| Mode | Description | Owner |
|---|---|---|
| Direct Deploy | Deploy directly to production | Release Orchestrator |
| Staged Rollout | Gradual rollout to production | Release Orchestrator |
| Blue/Green | Deploy alongside existing, switch traffic | Release Orchestrator |
| Canary | Deploy to subset of traffic first | Release Orchestrator |
| Rollback | Revert to previous version | Release Orchestrator |
| Hotfix | Emergency fix bypassing normal pipeline | Release Orchestrator |
| Preview | Deploy to preview environment | Release Orchestrator |
| Dry Run | Execute release pipeline without deploying | Release Orchestrator |

### 2.3 Release Gates

| Gate | Description | Required For |
|---|---|---|
| GATE-01 | Intent Approval | EPCL |
| GATE-02 | Plan Approval | EPCL |
| GATE-03 | Pre-Deploy Approval | Staging |
| GATE-04 | Production Approval | Production |
| GATE-05 | Certification Approval | Certification |
| GATE-06 | Rollback Approval | Rollback |
| GATE-07 | Emergency Approval | Hotfix |
| GATE-08 | PO Review | All releases |
| GATE-09 | Architecture Review | Architecture changes |
| GATE-10 | Security Review | Security-sensitive changes |

---

## 3. Release Governance Promotion

### 3.1 Promoted to Hermes (OCI) — Reusable

| Artifact | Source | Rationale |
|---|---|---|
| Release Operations | docs/ops/RELEASE_OPERATIONS.md | Reusable release process |
| Release Gates | docs/ops/RELEASE_GATES.md | Reusable gate definitions |
| Release Certification | docs/ops/RELEASE_CERTIFICATION.md | Reusable certification framework |
| Release Certification (Final) | docs/ops/RELEASE_CERTIFICATION_FINAL.md | Reusable final certification |
| Release Orchestrator | docs/ops/RELEASE_ORCHESTRATOR.md | Reusable orchestration |
| Release Dashboard | docs/ops/RELEASE_DASHBOARD.md | Reusable dashboard template |
| Release Discovery | docs/ops/RELEASE_DISCOVERY.md | Reusable discovery process |
| Release Reconciliation | docs/ops/RELEASE_RECONCILIATION.md | Reusable reconciliation |
| Release Backlog | docs/ops/RELEASE_BACKLOG.md | Reusable backlog template |
| Release Agent Registry | docs/ops/RELEASE_AGENT_REGISTRY.md | Reusable agent registry |
| Release Runtime Trace | docs/ops/RELEASE_RUNTIME_TRACE.md | Reusable trace |
| Execution Modes | docs/ops/EXECUTION_MODES.md | Reusable execution modes |
| EPCL Release Integration | docs/ops/EPCL_RELEASE_INTEGRATION.md | Reusable integration |

### 3.2 Stays in Product (GitHub) — Product-Specific

| Artifact | Rationale |
|---|---|
| Wave 3 Release Notes | Product-specific |
| Wave 4 Release Notes | Product-specific |
| Wave 5 Release Notes | Product-specific |
| Deployment Evidence | Product-specific |
| Release Closure Reports | Product-specific |
| Phase-specific gate results | Product-specific |
| Product-specific changelog entries | Product-specific |

---

## 4. Release Alignment

### 4.1 Release States

| State | Description | Transitions |
|---|---|---|
| Pending | Release is queued | → In Progress |
| In Progress | Release is executing | → Success, → Failed |
| Success | Release completed successfully | → Healthy |
| Failed | Release failed | → Pending (retry), → Rolled Back |
| Healthy | Release is healthy in production | → Updated |
| Updated | Release updated to new version | → Healthy |
| Rolled Back | Release reverted to previous version | → Pending |

### 4.2 Release Certification Flow

```
Release → Verification → Certification → Approval → Production
  |           |               |              |          |
  ↓           ↓               ↓              ↓          ↓
Deploy    Tests Pass     Cert Pass       PO Review   Live
```

---

## 5. No Duplicate Release Governance

All release governance artifacts are promoted to Hermes (OCI). Product-specific release content remains in product repositories. No duplication.

---

*MEOW Deliverable 10 of 15*
