# Release Management — Preview Promotion Process

> **AI Platform Capability — Preview to Production Promotion Design**
> Standardized promotion process for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Preview Promotion Process
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Purpose

The Preview → Production promotion process ensures that every production deployment is validated, auditable, and operator-approved. No code reaches production without passing through the Preview environment and the promotion gate.

---

## 2. Promotion Flow

```
           ┌──────────────────────┐
           │  Preview Environment │
           │  (auto-deployed on   │
           │   push to main)      │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  1. VERIFY PREVIEW   │
           │  ──────────────────  │
           │  Health check        │
           │  Smoke tests         │
           │  Release metadata    │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  2. PROMOTION GATE   │
           │  ──────────────────  │
           │  Gate criteria eval  │
           │  PSER checkpoint     │
           │  Rollback checkpoint │
           └──────────┬───────────┘
                      │
                      ▼
           ┌──────────────────────┐
           │  3. OPERATOR REVIEW  │
           │  ──────────────────  │
           │  Review preview      │
           │  Approve / Deny      │
           │  Provide reason      │
           └──────────┬───────────┘
                      │
           ┌──────────┴──────────┐
           ▼                     ▼
    ┌──────────────┐    ┌──────────────┐
    │  APPROVED    │    │   DENIED     │
    │              │    │              │
    │ Deploy to    │    │ Return to    │
    │ Production   │    │ development  │
    │              │    │              │
    └──────────────┘    └──────────────┘
```

---

## 3. Promotion Gate Criteria

### 3.1 Gate Evaluation

```typescript
interface PromotionGateEvaluation {
  gate_id: string;
  deployment_id: string;
  preview_environment: string;
  production_environment: string;
  criteria: PromotionGateCriterion[];
  overall: "pass" | "fail" | "pending_approval";
  evaluated_at: string;
}

interface PromotionGateCriterion {
  id: string;
  description: string;
  status: "met" | "unmet" | "waived";
  evidence?: string;
  verified_by?: string;
  verified_at?: string;
}
```

### 3.2 Gate Criteria Table

| # | Criterion | Verification | Required? |
|---|-----------|-------------|-----------|
| 1 | Preview health endpoint returns 200 | `curl <preview-url>/api/v1/health` | Required |
| 2 | Preview release metadata valid | Version, commit, environment match | Required |
| 3 | All smoke tests pass on Preview | Smoke test suite | Required |
| 4 | Build artifacts match | Same commit deployed to Preview | Required |
| 5 | D1 migrations applied | `wrangler d1 migrations list <db> --remote` | Required |
| 6 | Security scan clean | No leaked credentials | Required |
| 7 | Rollback checkpoint created | Checkpoint exists in PSER | Required |
| 8 | PSER checkpoint recorded | `deployment.promotion.started` event | Required |
| 9 | Operator approval | Manual approval | Required |
| 10 | No unresolved blockers | PSER blocker list empty | Required |

### 3.3 Gate Workflow

```
1. Operator requests promotion
2. System evaluates all gate criteria
3. If ALL criteria met:
   a. status = "criteria_met"
   b. Submit for operator approval
   c. Operator approves or denies
   d. If approved: proceed to production deploy
   e. If denied: return to development
4. If ANY criterion unmet:
   a. status = "criteria_pending"
   b. Return failed criteria list
   c. Developer addresses gaps
   d. Re-evaluate gate
```

---

## 4. Promotion Approval

### 4.1 Approval Request

When all gate criteria are met, the system submits an approval request:

```typescript
interface PromotionApprovalRequest {
  request_id: string;
  deployment_id: string;
  product: string;
  from_environment: string;     // "preview"
  to_environment: string;       // "production"
  version: string;
  git_commit: string;
  preview_url: string;
  smoke_test_summary: string;   // "7/7 passed (1.2s)"
  gate_evaluation_id: string;
  requested_by: string;         // principal:<id>
  requested_at: string;
  expires_at: string;           // 24 hours
}
```

### 4.2 Approval Notification

The operator receives:
- **Platform**: Notification via configured channel (Telegram, etc.)
- **Content**: Promotion approval request with:
  - Product name
  - Version and commit
  - Preview URL
  - Smoke test summary
  - Gate evaluation ID
  - Expiry time (24 hours)

### 4.3 Approval Decision

| Decision | Action |
|----------|--------|
| **Approve** | Promotion proceeds: Production deploy pipeline starts |
| **Deny** | Promotion blocked: Reason recorded in PSER, developer notified |
| **Expire** | (24h timeout) Promotion cancelled: Requires fresh gate evaluation |

---

## 5. Promotion Failure Handling

| Failure | Impact | Recovery |
|---------|--------|----------|
| Preview health check fails | Promotion blocked | Fix Preview, re-promote |
| Smoke tests fail | Promotion blocked | Fix code, re-deploy to Preview, re-promote |
| Gate criteria not met | Promotion blocked | Address gaps, re-evaluate gate |
| Operator denies | Promotion cancelled | Address reason, re-submit |
| Production deploy fails | Promotion failed | Roll back to previous version (if partially deployed) |

---

## 6. PSER Integration

### 6.1 Promotion Events

| Event | Trigger |
|-------|---------|
| `deployment.promotion.started` | Promotion gate evaluation begins |
| `deployment.promotion.gate_passed` | All gate criteria met |
| `deployment.promotion.gate_failed` | Gate criteria unmet |
| `deployment.promotion.approved` | Operator approves |
| `deployment.promotion.denied` | Operator denies |
| `deployment.promotion.expired` | 24h timeout |
| `deployment.production.started` | Production deploy begins |
| `deployment.production.completed` | Production deploy completes |
| `deployment.production.failed` | Production deploy fails |

### 6.2 Resume Points

| After | Resume Point |
|-------|-------------|
| Preview deploy | "Promotion gate ready — operator review needed" |
| Promotion approved | "Production deploy in progress" |
| Production deploy complete | "Monitor for 15 minutes" |
| Production deploy failed | "Rollback initiated — operator attention" |

---

## 7. Emergency Promotion

For hotfixes and critical security patches:

| Deviation | Rationale |
|-----------|-----------|
| Reduced gate criteria | Critical fix may waive smoke tests (documented) |
| Fast-track approval | Single operator approval (not committee) |
| Documented bypass | PSER records the emergency reason |

**Rules:**
- Emergency promotions require a documented reason
- Reduced criteria are waived, not skipped — gap is tracked
- Full gate evaluation is re-run within 24 hours
- Emergency promotion is recorded in PSER with reason

---

## 8. Product Configuration

Products configure promotion behaviour in their `release.yaml`:

```yaml
# release.yaml — Promotion configuration
promotion:
  require_operator_approval: true
  require_smoke_tests: true
  require_health_check: true
  require_security_scan: true
  approval_expiry_hours: 24
  emergency:
    allow_reduced_criteria: true
    require_documented_reason: true
    follow_up_gate_hours: 24
```

---

*Release Management Platform — AI Platform Capability*
*Preview Promotion Process — v1.0.0*
*Last updated: 2026-07-27*