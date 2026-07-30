# WAS — Operator Guide

> **Workforce Activation Service — Operator Guide**
> How to supervise, control, and monitor autonomous execution through WAS.
>
> **Assumes no implementation knowledge.** Every procedure is step-by-step.
>
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       WAS Operator Guide
Capability:     Workforce Activation Service
Capability #:   17
```

---

## 1. Before You Start

### 1.1 What WAS Does

WAS is a **safety gate** between planning and execution. Before a plan can be executed autonomously, WAS checks:

- Are the right feature flags enabled?
- Is the plan structurally valid?
- Are constitutional constraints satisfied?

If all checks pass, WAS delegates the plan to the execution layer (WEF). If any check fails, the plan is rejected with a clear explanation.

### 1.2 What You Need to Know

- **Feature flags** control what WAS can do. All autonomous behavior is **disabled by default**.
- **Activation** is the lifecycle of a single plan being prepared for execution.
- **Batches** are groups of tasks within a plan. WAS delegates batches one at a time (or in parallel, if enabled).
- **The operator's role** is to supervise, approve, and intervene when needed — not to micromanage execution.

---

## 2. Starting Autonomous Execution

### Step 1: Enable Feature Flags

Autonomous execution requires these flags to be `true`:

| Flag | Where | Purpose |
|------|-------|---------|
| `ENABLE_AUTONOMOUS_EXECUTION` | WAS | Master switch for WAS |
| `ENABLE_BATCH_GENERATION` | WAS | Allows batch activation |
| `ENABLE_AUTONOMOUS_EXECUTION` | EPCL | Master switch for EPCL |
| `ENABLE_EXECUTIVE_WORKFLOW` | EPCL | Enables the planning workflow |

All flags are `false` by default. To enable them:

```typescript
import { enableWASFlag, WASFeatureFlag } from "./was/index.js";
import { setFlags, FeatureFlag } from "./epcl/types.js";

// Enable WAS flags
enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
enableWASFlag(WASFeatureFlag.ENABLE_BATCH_GENERATION);

// Enable EPCL flags
setFlags({
  ENABLE_AUTONOMOUS_EXECUTION: true,
  ENABLE_EXECUTIVE_WORKFLOW: true,
});
```

### Step 2: Verify Flags Are Active

```typescript
import { getWASFlags } from "./was/index.js";

const flags = getWASFlags();
console.log(flags);
// Expected: { ENABLE_AUTONOMOUS_EXECUTION: true, ENABLE_BATCH_GENERATION: true, ... }
```

### Step 3: Activate a Plan

```typescript
import { WorkforceActivationService } from "./was/index.js";

const was = WorkforceActivationService.getInstance();
const lifecycle = await was.activate(approvedPlan);
```

If activation succeeds, the lifecycle will be in `ACTIVE` state. If it fails, check the error message and the validation gates.

### Step 4: Delegate Batches

```typescript
for (const batch of approvedPlan.batches) {
  await was.delegateBatch(approvedPlan, batch, lifecycle.id);
}
```

### Step 5: Complete Activation

```typescript
const report = was.complete(approvedPlan, lifecycle.id);
console.log(report);
// Shows: batches completed, failed, progress percentage, summary
```

---

## 3. Reading Activation Status

### Check a Single Activation

```typescript
const lifecycle = was.getActivation(activationId);
console.log(lifecycle.state);        // Current state
console.log(lifecycle.activatedBatches); // Batch breakdown
console.log(lifecycle.validation);   // Validation results
```

### List All Active Activations

```typescript
const active = was.listActive();
console.log(active.length);          // Number of active activations
```

### Get Activation Counts by State

```typescript
const counts = was.countByState();
console.log(counts);
// { pending: 0, validating: 0, activating: 0, active: 1, ... }
```

### List All Activation IDs

```typescript
const allIds = was.listAll();
```

---

## 4. Monitoring Execution

### Observability Events

WAS emits events throughout the activation lifecycle. Subscribe to events to monitor execution:

| Event | Triggered When |
|-------|---------------|
| `was.activation.started` | Activation created (PENDING) |
| `was.activation.validated` | Validation complete |
| `was.activation.rejected` | Plan rejected by validation |
| `was.activation.failed` | Activation failed |
| `was.activation.completed` | Activation completed (DEACTIVATED) |
| `was.batch.activated` | Batch added to activation |
| `was.batch.delegated` | Batch delegated to WEF |
| `was.batch.failed` | Batch delegation or verification failed |
| `was.batch.completed` | Batch completed successfully |
| `was.wef.delegation.started` | WEF delegation initiated |
| `was.wef.delegation.completed` | WEF delegation succeeded |
| `was.wef.delegation.failed` | WEF delegation failed |
| `was.verification.started` | Verification check initiated |
| `was.verification.completed` | Verification passed |
| `was.knowledge.captured` | Knowledge captured from batch |
| `was.status.reported` | Executive status report generated |
| `was.recovery.attempted` | Recovery attempted after restart |
| `was.recovery.succeeded` | Recovery succeeded |
| `was.recovery.failed` | Recovery failed |

### Monitoring Event Counts

```typescript
const lifecycle = was.getActivation(activationId);
const { batchesActivated, batchesDelegated, batchesCompleted, batchesFailed, progress } = report;
```

The `progress` field is a ratio (0.0–1.0) of completed batches to total batches.

---

## 5. Reviewing Executive Reports

After completing an activation, WAS generates a status report:

```typescript
const report = was.complete(plan, activationId);
```

The report contains:

| Field | Type | Description |
|-------|------|-------------|
| `activationId` | string | Unique activation identifier |
| `planId` | string | Source plan identifier |
| `state` | ActivationState | Final state (DEACTIVATED) |
| `startedAt` | string | ISO-8601 timestamp |
| `duration` | number | Milliseconds from start to completion |
| `batchesActivated` | number | Total batches activated |
| `batchesDelegated` | number | Batches sent to WEF |
| `batchesCompleted` | number | Batches completed successfully |
| `batchesFailed` | number | Batches that failed |
| `totalBatches` | number | Total batches in the plan |
| `progress` | number | Ratio (0.0–1.0) |
| `failures` | ActivationFailure[] | Detailed failure records |
| `validations` | ValidationResult | Validation gate results |
| `summary` | string | Human-readable summary |

---

## 6. Pausing Execution

There is no explicit "pause" state in the WAS state machine. To pause:

1. **Stop delegating new batches.** Do not call `delegateBatch()` for remaining batches.
2. **Let in-flight batches complete.** WEF will complete already-delegated batches.
3. **Record the checkpoint.** Note which batch index was last delegated.

**To resume later:** Continue calling `delegateBatch()` from the checkpoint.

---

## 7. Resuming Execution

### After a Planned Pause

1. Verify the activation is still in `ACTIVE` state.
2. Check which batches are `COMPLETED` vs `PENDING`.
3. Call `delegateBatch()` for pending batches.

### After a Restart (Recovery)

By default, all in-progress activations are marked as `FAILED` on restart. This is the safe default.

**To auto-resume:** Set `autoResume: true` in WAS configuration before restart:

```typescript
was.configure({ autoResume: true });
```

When auto-resume is enabled, recovered activations revert to `PENDING` state and must be re-activated.

---

## 8. Manual Intervention

### Override a Failed Batch

If a batch fails delegation or verification, you can investigate and retry:

```typescript
// Check the failure details
const lifecycle = was.getActivation(activationId);
const failedBatches = lifecycle.activatedBatches.filter(b => b.status === "failed");
console.log(failedBatches.map(b => b.failure));

// Retry by calling delegateBatch again
await was.delegateBatch(plan, batch, activationId);
```

### Cancel an Activation

```typescript
was.cancel(plan, activationId, "Operator: manual intervention required");
```

Cancellation transitions the activation through `DEACTIVATING` → `FAILED` with a record of the cancellation reason.

---

## 9. Approval Workflow

WAS itself does not require operator approval for individual batches. Approval is handled by EPCL's `ApprovalManager` during the planning phase. WAS validates that:

1. The plan has `PlanStatus.APPROVED` (EPCL-level approval is complete).
2. Feature flags enable autonomous execution.

If your deployment requires operator approval per batch, implement it at the EPCL planning stage, not in WAS.

---

## 10. Recovery After Failure

### Single Batch Failure

If a batch fails during delegation or verification:

1. The batch is marked `FAILED` in the activation lifecycle.
2. Other batches continue unaffected.
3. The operator investigates the failure details via `lifecycle.activatedBatches[].failure`.
4. The operator may retry the batch by calling `delegateBatch()` again.

### Full Activation Failure

If the activation itself fails (e.g., validation failure):

1. The activation enters `FAILED` or `REJECTED` state.
2. A detailed failure record is available via `lifecycle.failure` or `lifecycle.rejection`.
3. The operator fixes the underlying issue (flags, plan integrity, constraints).
4. The operator re-activates with a new plan or corrected flags.

### Worker Restart

1. All in-memory activation state is lost.
2. `WAS.recover()` is called automatically (or manually) on restart.
3. By default: all in-progress activations → `FAILED`.
4. With `autoResume: true`: activations → `PENDING` for re-activation.

---

## 11. Emergency Stop

### Immediate Halt

To stop all autonomous execution immediately:

```typescript
// Disable the master switch
disableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
// Also disable at EPCL level
setFlags({ ENABLE_AUTONOMOUS_EXECUTION: false });
```

This prevents any new activations. In-flight batches already delegated to WEF will still complete.

### Cancel All Active Activations

```typescript
const active = was.listActive();
for (const a of active) {
  was.cancel(aPlan, a.id, "Emergency stop by operator");
}
```

### Reset Entire System

```typescript
import { resetAllFlagsForTest } from "./was/index.js";

// Reset all WAS and EPCL flags to defaults (all disabled)
resetAllFlagsForTest();
```

---

## 12. Configuration Reference

| Config Option | Default | Description |
|--------------|---------|-------------|
| `maxConcurrentActivations` | `1` | Maximum simultaneous activations |
| `autoResume` | `false` | Auto-resume on restart (experimental) |
| `maxRetries` | `3` | Max retries for transient failures |
| `detailedObservability` | `false` | Emit detailed observability events |
| `requireConstitutionalValidation` | `true` | Require validation gates |
| `requireFeatureFlagValidation` | `true` | Require feature flag checks |
| `enableKnowledgeCapture` | `true` | Capture execution knowledge |
| `enableStatusReporting` | `true` | Generate executive status reports |

---

## 13. Quick Reference

### Common Tasks

| Task | Command |
|------|---------|
| Get WAS instance | `WorkforceActivationService.getInstance()` |
| Configure | `was.configure({ ... })` |
| Activate plan | `await was.activate(plan)` |
| Delegate batch | `await was.delegateBatch(plan, batch, activationId)` |
| Complete activation | `was.complete(plan, activationId)` |
| Cancel activation | `was.cancel(plan, activationId, reason)` |
| Get activation | `was.getActivation(id)` |
| List active | `was.listActive()` |
| Count by state | `was.countByState()` |
| Enable flag | `enableWASFlag(WASFeatureFlag.X)` |
| Disable flag | `disableWASFlag(WASFeatureFlag.X)` |
| Get flags | `getWASFlags()` |
| Reset flags | `resetAllFlagsForTest()` |
| Validate flags | `validateFeatureFlags()` |
| Recover | `was.recover()` |

### State Transitions

| Start | End | Cause |
|-------|-----|-------|
| PENDING | VALIDATING | `activate()` begins validation |
| VALIDATING | REJECTED | Validation gate fails |
| VALIDATING | FAILED | State transition error |
| VALIDATING | ACTIVATING | Validation passes |
| ACTIVATING | ACTIVE | Batches added |
| ACTIVE | DEACTIVATING | `complete()` called |
| DEACTIVATING | DEACTIVATED | `complete()` finishes |
| Any | FAILED | Error or cancellation |
| Any (recovery) | PENDING | Auto-resume (experimental) |