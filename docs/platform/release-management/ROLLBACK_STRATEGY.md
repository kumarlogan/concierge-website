# Release Management — Rollback Strategy

> **AI Platform Capability — Rollback Strategy Design**
> Standardized rollback architecture for all AGS products.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-27

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Release Management Platform
Document:       Rollback Strategy
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Purpose

The rollback strategy provides a standardized, auditable, and operator-approved recovery mechanism for all AGS products. Every deployment creates a rollback checkpoint that can be restored if the deployment causes issues.

### 1.1 Design Principles

| Principle | Description |
|-----------|-------------|
| **Always Reversible** | Every deployment must be revertible to the previous known-good state |
| **Checkpoint Before Deployment** | Rollback metadata is captured before the new deployment begins |
| **Operator Approved** | Rollbacks require explicit operator approval |
| **Auditable** | Every rollback is recorded in PSER with reason and outcome |
| **Fast** | Rollback should complete in under 5 minutes |

---

## 2. Rollback Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        ROLLBACK ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────┐     ┌──────────────────┐     ┌──────────────┐ │
│  │  CHECKPOINT      │────▶│  ROLLBACK GATE   │────▶│  RECOVERY    │ │
│  │  ─────────────── │     │  ──────────────── │     │  ─────────── │ │
│  │  Capture pre-    │     │  Operator review  │     │  Re-deploy   │ │
│  │  deploy state   │     │  Reason required  │     │  previous    │ │
│  │  Save rollback   │     │  PSER event       │     │  version     │ │
│  │  metadata        │     │                   │     │  Verify      │ │
│  └──────────────────┘     └──────────────────┘     └──────────────┘ │
│                                  │                                    │
│                                  ▼                                    │
│                          ┌──────────────┐                            │
│                          │  POST-       │                            │
│                          │  RECOVERY    │                            │
│                          │  ─────────── │                            │
│                          │  Smoke tests │                            │
│                          │  Health check│                            │
│                          │  PSER record │                            │
│                          └──────────────┘                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Rollback Checkpoints

### 3.1 Checkpoint Capture

A rollback checkpoint is captured **before every production deployment**:

```typescript
interface RollbackCheckpoint {
  checkpoint_id: string;        // UUID
  deployment_id: string;        // The deployment this checkpoint protects
  captured_at: string;          // ISO 8601 — before deployment begins

  // ── Current State ──
  current_version: string;      // Currently deployed version
  current_git_commit: string;   // Currently deployed commit
  current_worker_deployment: string;  // Workers deployment ID
  current_pages_deployment: string;   // Pages deployment ID
  current_d1_migrations: number;      // Applied migrations count

  // ── Artifacts ──
  worker_source: string;        // Git ref for Workers
  pages_source: string;         // Git ref for Pages
  d1_backup: boolean;           // Was D1 state captured?

  // ── Metadata ──
  product: string;
  environment: string;
  captured_by: string;          // principal:<id>
  reason: string;               // "Pre-deployment checkpoint"
}
```

### 3.2 Checkpoint Storage

Checkpoints are stored in:

1. **PSER** — execution registry (primary)
2. **KV** — fast retrieval for rollback decisions
3. **D1** — durable persistence

### 3.3 Checkpoint Lifecycle

```
CAPTURE (pre-deploy) ──▶ ACTIVE ──▶ CONSUMED (rollback) or EXPIRED (next deploy)
```

---

## 4. PSER Checkpoints

### 4.1 Checkpoint Events

| Event | Trigger | Data |
|-------|---------|------|
| `rollback.checkpoint.created` | Pre-deployment | Current version, commit, deployment IDs |
| `rollback.checkpoint.used` | Rollback initiated | Checkpoint ID, target version |
| `rollback.requested` | Operator requests rollback | Reason, operator ID |
| `rollback.started` | Rollback begins | Target version, target commit |
| `rollback.completed` | Rollback finished | Resolved version, health check |
| `rollback.failed` | Rollback encountered error | Error details |

### 4.2 Checkpoint Retrieval

```typescript
// PSER query pattern
const checkpoint = await RollbackService.getLatestCheckpoint(productId, "production");
// Returns: RollbackCheckpoint | null
```

---

## 5. Failure Detection

### 5.1 Automated Detection

| Symptom | Detection Method | Threshold |
|---------|-----------------|-----------|
| Health endpoint down | HTTP request timeout | 5 seconds |
| Health endpoint error | Non-200 response | Any |
| Smoke test failure | Runtime assertion | Any failure |
| Error rate spike | Worker observability | >5% increase |

### 5.2 Rollback Triggers

| Trigger | Source | Automatic? |
|---------|--------|------------|
| Health check fails | Pipeline verification | No — requires operator approval |
| Smoke test fails | Pipeline verification | No — blocks promotion (not rollback) |
| Error rate spike | Monitoring system | No — alerts operator |
| Operator judgement | Human observation | Manual |

---

## 6. Recovery Workflow

### 6.1 Operator-Initiated Rollback

```
1. DETECT
   - Operator detects issue (alert, monitoring, report)

2. DECIDE
   - Operator evaluates severity
   - Operator decides rollback is needed
   - Operator prepares rollback reason

3. APPROVE
   - Operator initiates rollback gate
   - Operator provides:
     a. Rollback reason
     b. Target version (default: previous stable)
     c. Verification plan

4. EXECUTE
   - System retrieves rollback checkpoint
   - System validates target version exists
   - Pipeline deploys previous version
   - System runs smoke tests

5. VERIFY
   - Health check on restored version
   - Smoke tests pass
   - PSER records completion

6. POST-RECOVERY
   - PSER records rollback event
   - Resume point set: "Root cause analysis"
   - Original deployment version archived for investigation
```

### 6.2 Rollback Decision Matrix

| Scenario | Action | Priority |
|----------|--------|----------|
| Health endpoint down | Rollback | P0 |
| Critical API broken | Rollback | P0 |
| Auth flow broken | Rollback | P0 |
| Non-critical page broken | Fix forward | P2 |
| Cosmetic issue | Fix forward | P3 |
| Performance regression | Investigate first | P1 |

---

## 7. Rollback Metadata

Every rollback is recorded with structured metadata:

```typescript
interface RollbackRecord {
  rollback_id: string;
  checkpoint_id: string;
  original_version: string;
  original_git_commit: string;
  target_version: string;
  target_git_commit: string;

  // ── Timing ──
  requested_at: string;
  started_at: string;
  completed_at: string;

  // ── Authorization ──
  requested_by: string;          // principal:<id>
  approved_by: string;
  reason: string;

  // ── Outcome ──
  status: "success" | "failed" | "partial";
  health_check_passed: boolean;
  smoke_tests_passed: boolean;
  resolved_version: string;      // What's actually deployed after

  // ── PSER ──
  execution_event_ids: string[];
  resume_point_id: string;
}
```

---

## 8. Recovery Verification

After a rollback completes, the system verifies:

| Check | Method | Success Condition |
|-------|--------|-------------------|
| Health | `curl <url>/api/v1/health` | 200 + correct version |
| Smoke Tests | Run smoke test suite | All passing |
| Identity | Auth endpoint responds | Endpoint reachable |
| Metadata | Verify rollback metadata | Version matches target |

---

## 9. PSER Integration

Rollbacks are fully integrated with PSER:

| PSER Entity | Usage |
|-------------|-------|
| **ExecutionRegistry** | Records every rollback event |
| **ResumeService** | Sets resume point after recovery |
| **GateService** | Evaluates rollback gate criteria |
| **ProgressService** | Reports rollback in execution context |

---

## 10. Design Constraints

| Constraint | Rationale |
|------------|-----------|
| No automatic rollback | Human judgement required for recovery decisions |
| Checkpoint before every deploy | Ensures rollback target exists for every deployment |
| D1 migration rollback is manual | Migration rollback requires schema analysis |
| Rollback is version-based | Deploy previous known-good commit |
| Operator approval required | Prevents accidental rollback loops |

---

*Release Management Platform — AI Platform Capability*
*Rollback Strategy — v1.0.0*
*Last updated: 2026-07-27*