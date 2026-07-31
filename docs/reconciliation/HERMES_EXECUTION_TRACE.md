# HERMES Execution Trace

> **EPIC-008 — Phase I**
> Validates every transition between runtime layers. Each transition has type-level input/output types, invariants, failure modes, and recovery paths. Traces the complete lifecycle of a plan from entry to completion.

---

## Transition Validation Framework

Every transition between layers must satisfy:

1. **Type Compatibility**: Output type of source layer is accepted as input type of target layer
2. **State Consistency**: Both layers agree on execution state
3. **Invariant Satisfaction**: Cross-layer invariants hold before and after transition
4. **Failure Handling**: Each transition defines what happens on failure
5. **Recovery Capability**: Snapshot/checkpoint exists for crash recovery

---

## Trace 1: Layer 1 (Executive) → Layer 2 (Planning)

### Transition Type
```
ExecutivePlanningWorkflow → RoadmapEngine
```

### Interface
```typescript
// Source: ExecutivePlanningWorkflow (Stage 1: OBJECTIVE_INTAKE)
const stageResult = await this.runStage(WorkflowStage.OBJECTIVE_INTAKE);

// Target: RoadmapEngine (Stage 2: PLAN_PARSING)
const roadmapAnalysis = RoadmapEngine.getInstance().parse(objective);
```

### Input → Output
| Source Output | Target Input |
|--------------|--------------|
| `objective: string` (Product Owner message) | `objective: string` (markdown roadmap) |

### State Before
- ExecutivePlanningWorkflow is in `PROCESSING` state
- WorkflowStage = `OBJECTIVE_INTAKE`
- Feature flags `ENABLE_EXECUTIVE_WORKFLOW` = true

### State After
- ExecutivePlanningWorkflow is in `PROCESSING` state
- WorkflowStage = `PLAN_PARSING`
- Plan state has `roadmapAnalysis` populated

### Invariants
| # | Invariant | Check |
|---|-----------|-------|
| T1.1 | Objective is non-empty string | `objective.trim().length > 0` |
| T1.2 | Objective is approved by Product Owner | Precondition (Product Owner sent it) |
| T1.3 | Plan state exists | `executionState.plan != null` |

### Failure Mode
| Failure | Error | Resolution |
|---------|-------|-----------|
| Empty objective | `StageResult { ok: false }` | Return to Executive with error; await valid input |
| Objective not parseable | Handled in Stage 2 (RoadmapEngine) | Deferred to Stage 2 error handling |

### Recovery
- Recovery snapshot created before transition (Stage 1→2 boundary)
- On crash, RecoveryManager resumes from `OBJECTIVE_INTAKE` checkpoint

---

## Trace 2: Layer 2 (Planning) → Layer 3 (Activation)

### Transition Type
```
ExecutivePlanningWorkflow → WorkforceActivationService
```

### Interface
```typescript
// Source: ExecutivePlanningWorkflow (Stage 7: APPROVAL_CHECK → Stage 8: WEF_DELEGATION)
const stage8Result = await this.runStage(WorkflowStage.WEF_DELEGATION);

// Target: WAS PlanConsumer
const lifecycle = was.consumePlan(executionState.plan);
```

### Data Flow
```
Planning Layer produces:
  ExecutionPlan {
    id: string,
    status: "APPROVED",
    batches: ExecutionBatch[],
    budget: TokenBudget,
    context: ContextBudget,
    epics: RoadmapEpic[],
    disciplines: DisciplineSelection[],
    capabilities: CapabilitySelection[]
  }

Activation Layer receives:
  → WEFDelegationRequest[] {
    activationId,
    planId,
    batch: ExecutionBatch,
    constraints: DelegationConstraint[],
    timestamp
  }

  → ValidationResult { ... } (from ConstitutionalValidator)
```

### Input → Output
| Source Output | Target Input |
|--------------|--------------|
| `ExecutionPlan { status: APPROVED }` | WAS `consumePlan(plan)` |
| `WEFDelegationRequest[]` (batches) | WAS `delegateBatch(request)` |

### State Before
- ExecutivePlanningWorkflow: `PROCESSING` state
- Planning completed: roadmap parsed, capabilities selected, disciplines selected, batches generated, approval granted
- Plan status = `APPROVED`

### State After
- ExecutivePlanningWorkflow: plan status → `INACTIVE` (EPCL no longer owns it)
- WAS activation lifecycle created: `PENDING`
- Feature flags validated: `ENABLE_AUTONOMOUS_EXECUTION` = enabled (or approval gated)

### Invariants
| # | Invariant | Check |
|---|-----------|-------|
| T2.1 | Plan approved before activation | `executionState.plan.status === PLAN_STATUS.APPROVED` |
| T2.2 | Feature flags enabled | `isEnabled(FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)` |
| T2.3 | No duplicate activation | Idempotency check: `planId` not in active lifecycles |
| T2.4 | Active plan capacity available | `activeActivations.length < maxConcurrentActivations` |
| T2.5 | All batches have unique IDs | `new Set(batches.map(b => b.id)).size === batches.length` |

### Failure Mode
| Failure | Error | Resolution |
|---------|-------|-----------|
| Plan not approved | `PlanNotApprovedError` | Return to Executive; await approval |
| Feature flag disabled | `FeatureFlagDisabledError` | Return to Executive; enable flag or await human approval |
| Duplicate activation | `PlanAlreadyActivatedError` | Return existing activation lifecycle |
| Capacity full | `MaxConcurrentActivationsError` | Queue plan for later activation |

### Recovery
- Recovery snapshot created after planning completes, before activation
- WAS persists activation lifecycle state on every transition
- On crash, WASRecovery restores activations (fail-closed: marks all in-progress as FAILED)

---

## Trace 3: Layer 3 (Activation) → Layer 4 (Execution)

### Transition Type
```
WEFDelegator → WEF (WorkforceExecutionFramework)
```

### Interface
```typescript
// Source: WAS WEFDelegator
const result = await wef.delegate?.(request);

// Target: WEF Hermes Runtime
// (Executes batch via Hermes agent)
```

### Data Flow
```
Activation Layer produces:
  WEFDelegationRequest {
    activationId: string,
    planId: string,
    batch: ExecutionBatch,
    constraints: DelegationConstraint[],
    timestamp: string
  }

Execution Layer receives:
  → WEFDelegationRequest[]
  → Executes each batch
  → Returns WEFDelegationResult[]
```

### Input → Output
| Source Output | Target Input |
|--------------|--------------|
| `WEFDelegationRequest` (per batch) | WEF `dispatch(request)` |
| `DelegationConstraint[]` | WEF `applyConstraints(constraints)` |

### State Before
- Activation lifecycle: `ACTIVE`
- Batch state: `ACTIVATING`
- WAS has delegated batches to WEF

### State After
- **On success**: Batch state → `DELEGATED` (then `COMPLETED` after verification)
- **On failure**: Batch state → `FAILED` (with structured failure detail)
- Execution result: `WEFDelegationResult`

### Invariants
| # | Invariant | Check |
|---|-----------|-------|
| T3.1 | Batch exists in activation | `activatedBatches.some(b => b.batchId === request.batch.id)` |
| T3.2 | Batch in correct state for delegation | `batch.status === BatchActivationStatus.ACTIVATING` |
| T3.3 | Constitutional constraints passed through | `constraints.length === validation gates count` |
| T3.4 | Pre-deployment health check passed | `preDeploymentReport.overallHealth === "green"` |

### Failure Mode
| Failure | Error | Resolution |
|---------|-------|-----------|
| WEF unavailable | Delegation timeout/failure | WAS retries (maxRetries config) |
| Pre-deployment health check fails | `OverallHealth !== green` | Block deployment; report to Executive |
| Batch execution error | Execution error | WAS capture structured error; batch → FAILED |
| Credential resolution fails | Credential error | Report to Deployment Layer; credential remediation |

### Recovery
- WAS monitors delegation via `WASObservability`
- WAS supports retry for transient failures
- On persistent failure, WAS transitions batch → FAILED

---

## Trace 4: Layer 4 (Execution) → Layer 5 (Verification)

### Transition Type
```
WEF → VerificationRouter
```

### Interface
```typescript
// Source: WAS (after WEF returns result)
const verificationResult = await verificationRouter.verify({
  planId,
  batchId,
  delegationId,
  activationId,
  executionResult: wefResult,
  timestamp
});

// Target: VerificationRouter
// Runs verification checks
```

### Data Flow
```
Execution Layer returns:
  WEFDelegationResult {
    ok: boolean,
    delegationId: string,
    error?: string,
    timestamp: string
  }

Verification Layer returns:
  VerificationResult {
    ok: boolean,
    verificationId: string,
    checks: VerificationCheck[],
    summary: string,
    timestamp: string
  }
```

### Input → Output
| Source Output | Target Input |
|--------------|--------------|
| `WEFDelegationResult { delegationId, ok }` | `VerificationRequest { delegationId, executionResult, ... }` |

### State Before
- WEF delegation completed
- Batch state: `DELEGATED`
- Verification pending

### State After
- **On pass**: VerificationResult `{ ok: true }`; batch continues to completion
- **On fail**: VerificationResult `{ ok: false }`; batch → FAILED with structured error

### Invariants
| # | Invariant | Check |
|---|-----------|-------|
| T4.1 | Delegation result exists | `executionResult != null` |
| T4.2 | Delegation ID is valid | `activatedBatches.some(b => b.wefDelegationId === delegationId)` |
| T4.3 | Verification runs for all delegation results | Every result is verified |
| T4.4 | Verification is deterministic | Same result → same verification outcome |

### Failure Mode
| Failure | Error | Resolution |
|---------|-------|-----------|
| Verification fails | `VerificationResult.ok === false` | Batch → FAILED; retry if within maxRetries |
| Constitutional check fails | Gate failure | Batch → FAILED; log compliance issue |
| Output does not meet acceptance criteria | Criteria mismatch | Report which criteria failed; downstream decision |

### Recovery
- Verification is idempotent (same input → same output)
- Failed verification triggers conditional retry path

---

## Trace 5: Layer 3 (Activation) → Layer 6 (Knowledge)

### Transition Type
```
WAS → KnowledgeCaptureTrigger → KnowledgeCapturer
```

### Interface
```typescript
// Source: WAS KnowledgeCaptureTrigger
// Called on batch completion or activation completion
await knowledgeCaptureTrigger.onBatchComplete(batch);

// Target: KnowledgeCapturer
const entries = KnowledgeCapturer.getInstance().capture(plan, stageResults);
```

### Data Flow
```
Activation Layer produces:
  → Batch completion event (batch ID, result, verification result)
  → Activation completion event (plan, all batch results)

Knowledge Layer produces:
  → KnowledgeEntry[] (captured knowledge)
  → Skill definitions (for reusable patterns)
  → Memory entries (for durable facts)
```

### Input → Output
| Source Output | Target Input |
|--------------|--------------|
| `{ plan, batch, results }` | `KnowledgeCapturer.capture(plan, stageResults)` |

### State Before
- Batch completed (or activation completed)
- Execution results available
- Verification passed (knowledge capture only for verified batches)

### State After
- Knowledge entries created
- Skills updated (if reusable patterns found)
- Memory entries saved (if durable facts discovered)

### Invariants
| # | Invariant | Check |
|---|-----------|-------|
| T5.1 | Knowledge capture is non-fatal | Failure logged but execution continues |
| T5.2 | Only verified batches trigger capture | `batch.status === COMPLETED` |
| T5.3 | Knowledge is queryable after capture | Knowledge Store indexes entries |

### Failure Mode
| Failure | Resolution |
|---------|-----------|
| Knowledge capture API fails | Logged as warning; execution continues |
| Skill creation fails | Logged; skill creation deferred to next cycle |
| Memory write fails | Logged; fact retried on next interaction |

---

## Trace 6: Layer 3 (Activation) → Layer 9 (Observability) → Layer 1 (Executive)

### Transition Type
```
WAS → ExecutiveReporter → Product Owner
```

### Interface
```typescript
// Source: ExecutivePlanningWorkflow (Stage 12: REPORTING)
const stage12Result = await this.runStage(WorkflowStage.REPORTING);

// Target: ExecutiveReporter
const report = ExecutiveReporter.getInstance().generate(
  executionState.plan,
  executionState.stageResults
);
```

### Data Flow
```
Observability Layer produces:
  → ActivationStatusReport (from WAS)
  → ExecutiveReport (from EPCL)
  → StageResult[] (from all stages)

Governance Layer receives:
  → Compliance audit event (append-only log)
  → Verification checks evidence

Executive Layer delivers to Product Owner:
  → ExecutiveReport

Activation Layer transitions to:
  → DEACTIVATED (terminal)
```

### Input → Output
| Source Output | Target Input |
|--------------|--------------|
| `PlanState, StageResult[]` | `ExecutiveReporter.generate()` |
| `ExecutiveReport` | Product Owner (via Telegram) |

### State Before
- All batches completed or failed
- Verification completed for all batches
- Knowledge capture completed

### State After
- Executive report delivered
- Compliance audit committed
- Activation lifecycle: `DEACTIVATED`
- Plan execution complete

### Invariants
| # | Invariant | Check |
|---|-----------|-------|
| T6.1 | All batches have terminal state | `all b => b.status ∈ {COMPLETED, FAILED}` |
| T6.2 | Report includes plan summary | `report includes: planId, batches, failures, duration` |
| T6.3 | Report is delivered | Platform delivery confirmed |
| T6.4 | Compliance audit is append-only | Event is committed to audit log |

---

## Full Execution Trace (Time-Ordered)

```
t=0     Layer 1 (Executive):  receiveObjective("Implement X")
t=0.5   Layer 1 (Executive):  validateObjective()
t=1     Layer 1  →  Layer 2:  beginWorkflow()
t=2     Layer 2 (Planning):   RoadmapEngine.parse()
t=3     Layer 2 (Planning):   CapabilitySelector.selectForEpic()
t=3.5   Layer 2 (Planning):   TokenBudgetManager, ContextBudgetManager
t=4     Layer 2 (Planning):   DisciplineSelector.selectForEpic()
t=5     Layer 2 (Planning):   ExecutionPlanner.createBatches()
t=6     Layer 2 (Planning):   ApprovalManager.evaluate()
t=7     Layer 2  →  Layer 3:  Plan status → APPROVED; transition to Activation
t=8     Layer 3 (Activation): PlanConsumer.consume()
t=8.5   Layer 3 (Activation): ConstitutionalValidator.validate()
t=9     Layer 3 (Activation): State → VALIDATING → ACTIVATING → ACTIVE
t=10    Layer 3 (Activation): WEFDelegator.delegateBatch()
t=11    Layer 3  →  Layer 4:  WEFDelegationRequest → WEF
t=12    Layer 4 (Execution):  PreDeploymentReport()
t=13    Layer 4 (Execution):  executeBatch() [code generation, tests, ...]
t=N     Layer 4 (Execution):  return WEFDelegationResult
t=N+1   Layer 4  →  Layer 5:  Delegation result → VerificationRouter
t=N+2   Layer 5 (Verification): runChecks() → VerificationResult
t=N+3   Layer 5  →  Layer 3:  Verification result → Activation
t=N+4   Layer 3 (Activation): recordBatchCompletion() / recordBatchFailure()
t=N+5   Layer 3  →  Layer 6:  Batch complete → KnowledgeCaptureTrigger
t=N+6   Layer 6 (Knowledge):  capture() → KnowledgeEntry[]
t=N+7   Layer 3  →  Layer 9:  Activation complete → ExecutiveStatusUpdater
t=N+8   Layer 2 (Planning):   ExecutiveReporter.generate()
t=N+9   Layer 9 (Observability): Report → Product Owner
t=N+10  Layer 10 (Governance): Compliance audit committed
t=N+11  Layer 3 (Activation): State → DEACTIVATED
t=DONE
```

---

## Transition Validation Summary

| Transition | Source | Target | Pass/Fail | Invariants Held |
|-----------|--------|--------|-----------|-----------------|
| T1 | Executive (1) | Planning (2) | ✅ PASS | T1.1–3 |
| T2 | Planning (2) | Activation (3) | ✅ PASS | T2.1–5 |
| T3 | Activation (3) | Execution (4) | ✅ PASS | T3.1–4 |
| T4 | Execution (4) | Verification (5) | ✅ PASS | T4.1–4 |
| T5 | Activation (3) | Knowledge (6) | ✅ PASS | T5.1–3 |
| T6 | Activation (3) → Observability (9) → Executive (1) | ✅ PASS | T6.1–4 |

**Validation Result**: All transitions pass. The runtime sequence is type-safe, state-consistent, and failure-resilient.

## Unvalidated Transitions (Not Yet Implemented)

| Transition | Source | Target | Status | Reason |
|-----------|--------|--------|--------|--------|
| — | Operations (7) | All layers | ⚠️ NOT VALIDATED | Operations layer provides identity/permissions/memory but these are accessed by all layers. Each layer calls operations services independently — not a sequential transition. |
| — | Deployment (8) | Observability (9) | ⚠️ NOT VALIDATED | Deployment reports health to observability, but this is a side effect of pre-deployment checks, not a formal sequence transition. |
| — | Verification (5) | Knowledge (6) | ⚠️ NOT VALIDATED | Knowledge capture follows verification, but currently triggered by WAS rather than directly from Verification. This is a design choice (WAS orchestrates, not direct layer chaining). |
| — | Knowledge (6) | Operations (7) | ⚠️ NOT VALIDATED | Knowledge persistence to Operations layer store is asynchronous — no blocking transition. |

## Rollback Paths

For each transition where rollback is needed:

| Transition | Rollback Trigger | Rollback Action | Rollback Safety |
|-----------|-----------------|----------------|-----------------|
| T1 (1→2) | Planning error | Return to Executive; objective re-entered | Safe — no side effects before planning |
| T2 (2→3) | Activation failure | Plan not consumed by WAS; return to Executive | Safe — plan unchanged before activation |
| T3 (3→4) | Execution failure | Batch → FAILED; retry or escalate | Fail-closed — failed batch does not contaminate other batches |
| T4 (4→5) | Verification failure | Batch → FAILED; retry if maxRetries > 0 | Safe — batched output can be independently retried |
| T5 (3→6) | Knowledge capture failure | Logged as warning; no rollback needed | Non-fatal — execution continues |
| T6 (3→9) | Report delivery failure | Report queued for retry delivery | Non-fatal — report can be delivered later |