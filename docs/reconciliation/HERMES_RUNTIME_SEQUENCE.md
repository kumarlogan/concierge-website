# HERMES Runtime Sequence

> **EPIC-008 — Phase I**
> End-to-end execution sequence tracing a Product Owner approved objective through all 10 runtime layers. Every step has a layer owner, input, output, and invariant.

---

## Purpose

This document defines the **canonical execution path** for a Product Owner objective through the Hermes Platform runtime. Every component executes in sequence. No component executes out of order. Every transition between components has a defined invariant.

---

## Pre-Flight Checks

Before any execution begins:

1. **Feature flags verified**: `ENABLE_EXECUTIVE_WORKFLOW` = enabled
2. **Agent capability checked**: `canAgentAct(HermesRuntime)` = true
3. **Constitutional validation**: Runtime configured per platform constitution
4. **WAS configuration**: `maxConcurrentActivations` capacity available

---

## Execution Sequence Diagram

```
OBJECTIVE APPROVED
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 1: EXECUTIVE — ENTRY & ORCHESTRATION (Layer 1 → Layer 2)         │
│                                                                          │
│  1.1  ExecutiveLayer.receiveObjective(objective)                         │
│  1.2  ExecutiveLayer.validateObjective(objective)                        │
│  1.3  ExecutiveLayer.checkFeatureFlags()                                 │
│  1.4  ExecutiveLayer.beginWorkflow → ExecutivePlanningWorkflow.run()     │
│  1.5  Stage 1: OBJECTIVE_INTAKE                                          │
│       Executive → Planning: objective text                               │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 2: PLANNING — ANALYSIS & ROUTING (Layer 2 → Layer 3)             │
│                                                                          │
│  2.1  Stage 2: PLAN_PARSING                                              │
│       RoadmapEngine.parse(objective) → RoadmapAnalysis                   │
│  2.2  Stage 3: CAPABILITY_SELECTION                                      │
│       CapabilitySelector.selectForEpic() → CapabilitySelection[]         │
│  2.3  Stage 4: RESOURCE_ESTIMATION                                       │
│       TokenBudgetManager.estimate() + ContextBudgetManager.estimate()    │
│  2.4  Stage 5: DISCIPLINE_SELECTION                                      │
│       DisciplineSelector.selectForEpic() → DisciplineSelection[]         │
│  2.5  Stage 6: BATCH_GENERATION                                          │
│       ExecutionPlanner.createBatches() → ExecutionPlan                   │
│  2.6  Stage 7: APPROVAL_CHECK                                            │
│       ApprovalManager.evaluate(plan) → ApprovalEvaluation                │
│                                                                          │
│  → Executive → Activation: ExecutionPlan (status: APPROVED)              │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 3: ACTIVATION — CONSTITUTIONAL VALIDATION (Layer 2 → Layer 3)    │
│                                                                          │
│  3.1  WAS.PlanConsumer.consume(plan)                                     │
│       → Validates plan status is APPROVED                                │
│       → Checks idempotency (no duplicate activation)                     │
│       → Creates ActivationLifecycle (state: PENDING)                     │
│  3.2  WAS.ConstitutionalValidator.validate(plan)                         │
│       → Checks feature flag gates                                        │
│       → Checks constitutional rules                                      │
│       → Checks budget constraints                                        │
│       → ValidationResult { ok, gates[], summary }                        │
│  3.3  IF validation fails → lifecycle → REJECTED (terminal)              │
│  3.4  WAS state transition → VALIDATING → ACTIVATING                    │
│  3.5  WAS deactivates plan in EPCL → set to INACTIVE                    │
│  3.6  WAS creates batches → ActivatedBatch[]                             │
│       → WAS assigns batch IDs                                            │
│       → WAS captures batch metadata                                      │
│       → WAS transitions each batch → ACTIVATING                          │
│  3.7  WAS state transition → ACTIVE                                      │
│                                                                          │
│  → Activation → Execution: WEFDelegationRequest[]                        │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 4: EXECUTION — WEF DELEGATION (Layer 3 → Layer 4 → Layer 5)     │
│                                                                          │
│  4.1  WEF.WeakDelegator.dispatch(request)                                │
│       → Routes to Hermes Runtime Agent                                   │
│       → Executes each batch according to plan                            │
│  4.2  WEF.PreDeploymentHealthCheck(batch)                                │
│       → WEFOperationalIntelligence.preDeploymentReport()                 │
│       → Checks credential health (CredentialResolver)                     │
│       → Checks provider health (ProviderRegistry)                        │
│       → Checks deployment environment (DeploymentResolutionEngine)       │
│       → Returns WefOperationalReport { overallHealth }                   │
│  4.3  IF deployable → executes batch                                     │
│       → Generates code / runs tests / deploys per capability             │
│  4.4  Returns WEFDelegationResult { ok, delegationId }                   │
│                                                                          │
│  → Execution → Activation: WEFDelegationResult                           │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 5: VERIFICATION (Layer 3 → Layer 5 → Layer 3)                    │
│                                                                          │
│  5.1  WAS.VerificationRouter.verify(delegationResult)                    │
│       → Validates output against acceptance criteria                     │
│       → Runs constitutional compliance checks                            │
│       → Runs capability-specific verifiers                               │
│  5.2  VerificationResult { ok: true/false, checks[], summary }           │
│  5.3  IF verification fails →                                            │
│       → Batch failure structured error                                   │
│       → WAS records failure                                              │
│       → WAS may retry (configurable maxRetries)                          │
│       → On max retries → batch → FAILED                                  │
│  5.4  IF verification passes → batch → COMPLETED                         │
│                                                                          │
│  → Verification → Activation: completion notification                    │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 6: KNOWLEDGE CAPTURE (Layer 3 → Layer 6 → Layer 7)              │
│                                                                          │
│  6.1  WAS.KnowledgeCaptureTrigger.onBatchComplete(batch)                 │
│       → Captures execution results as knowledge entries                  │
│       → Captures patterns as reusable skills (if applicable)             │
│  6.2  EPCL.KnowledgeCapturer.capture(plan, results)                      │
│       → Stage 11: KNOWLEDGE_CAPTURE                                      │
│  6.3  Knowledge stored → Knowledge Store / Skill Store / Memory          │
│  6.4  IF knowledge capture fails → logged as warning (non-fatal)         │
│                                                                          │
│  → Knowledge → Operations: persisted knowledge entries                   │
└──────────────────────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────────────────┐
│  PHASE 7: EXECUTIVE REPORTING (Layer 3 → Layer 9 → Layer 10)            │
│                                                                          │
│  7.1  WAS.ExecutiveStatusUpdater.generate(activation)                    │
│       → ActivationStatusReport                                           │
│  7.2  EPCL.ExecutiveReporter.generate(plan, results)                     │
│       → Stage 12: REPORTING                                              │
│       → ExecutiveReport                                                  │
│  7.3  Executive report delivered to Product Owner                        │
│  7.4  WAS lifecycle → COMPLETED                                         │
│  7.5  Governance Layer logs compliance audit                             │
│                                                                          │
│  → Observability → Governance: compliance audit event                    │
│  → Executive → Product Owner: executive report                           │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Sequence Table

| Step | Phase | Layer(s) | Service | Action | Invariant |
|------|-------|---------|---------|--------|-----------|
| 1 | 1 | 1 | ExecutiveLayer | receiveObjective(objective) | Invariant 1: Objective is approved by Product Owner |
| 2 | 1 | 1, 10 | ExecutiveLayer | validateObjective(objective) | Invariant 2: Objective conforms to constitutional rules |
| 3 | 1 | 1, 10 | ExecutiveLayer | checkFeatureFlags() | Invariant 3: All required feature flags are enabled |
| 4 | 1 | 1, 2 | ExecutivePlanningWorkflow | beginWorkflow() | Invariant 4: No active workflow conflicts exist |
| 5 | 2 | 2 | RoadmapEngine | parse(objective) | Invariant 5: Roadmap has at least 1 phase with ≥1 epic |
| 6 | 2 | 2 | CapabilitySelector | selectForEpic(epic) | Invariant 6: Every required capability resolves to a known capability or NEW_WORK |
| 7 | 2 | 2 | TokenBudgetManager | estimate(plan) | Invariant 7: Token budget is not exceeded |
| 8 | 2 | 2 | ContextBudgetManager | estimate(plan) | Invariant 8: Context budget is not exceeded |
| 9 | 2 | 2 | DisciplineSelector | selectForEpic(epic) | Invariant 9: At least 1 discipline is selected per epic |
| 10 | 2 | 2 | ExecutionPlanner | createBatches(epics, disciplines, caps) | Invariant 10: Every epic has ≥1 batch |
| 11 | 2 | 2, 10 | ApprovalManager | evaluate(plan) | Invariant 11: Approval is not required, or approval is granted |
| 12 | 3 | 3, 10 | PlanConsumer | consume(plan) | Invariant 12: Plan status is APPROVED |
| 13 | 3 | 3, 10 | ConstitutionalValidator | validate(plan) | Invariant 13: All validation gates pass |
| 14 | 3 | 3 | WAS state machine | PENDING → VALIDATING → ACTIVATING → ACTIVE | Invariant 14: State transitions are canonical (enforced by canTransition) |
| 15 | 3 | 3 | WAS | deactivatePlan(planId) | Invariant 15: EPCL plan transitions to INACTIVE |
| 16 | 3 | 3 | WAS | createBatches(plan) | Invariant 16: All batches are created with unique batch IDs |
| 17 | 3 | 3 | WEFDelegator | delegateBatch(batch) | Invariant 17: Batch is in ACTIVATING state before delegation |
| 18 | 4 | 4 | WEF | dispatch(request) | Invariant 18: WEF accepts delegation |
| 19 | 4 | 4, 8 | WEFOperationalIntelligence | preDeploymentReport() | Invariant 19: Overall health is green before deployment |
| 20 | 4 | 4 | Hermes Runtime | executeBatch(batch) | Invariant 20: Execution produces artifacts matching plan |
| 21 | 4 | 4 | WEF | returnDelegationResult(result) | Invariant 21: Result includes delegationId and ok status |
| 22 | 5 | 5 | VerificationRouter | verify(delegationResult) | Invariant 22: Acceptance criteria are defined for the batch |
| 23 | 5 | 5 | VerificationRouter | runChecks(result) | Invariant 23: Verification checks are deterministic |
| 24 | 5 | 5 | WAS | recordBatchCompletion(batchId) | Invariant 24: Batch transitions to COMPLETED or FAILED |
| 25 | 6 | 6 | KnowledgeCaptureTrigger | onBatchComplete(batch) | Invariant 25: Knowledge capture is non-fatal on failure |
| 26 | 6 | 6 | KnowledgeCapturer | capture(plan, results) | Invariant 26: Knowledge entries are queryable |
| 27 | 7 | 3, 9 | ExecutiveStatusUpdater | generate(activation) | Invariant 27: Status report includes all batch results |
| 28 | 7 | 2, 9 | ExecutiveReporter | generate(plan, results) | Invariant 28: Report includes plan summary, key numbers, duration |
| 29 | 7 | 1 | ExecutiveLayer | deliverReport(productOwner) | Invariant 29: Report is delivered to the Product Owner |
| 30 | 7 | 10 | Governance Layer | logComplianceAudit() | Invariant 30: Compliance audit is append-only |

---

## Execution Phases Detail

### Phase 1: Executive Entry (Layer 1 → Layer 2)

**Input**: `ApprovedObjective` (from Product Owner via Telegram or Hermes CLI)

```
1. ExecutiveLayer.receiveObjective("Implement patient dashboard v2")
2. Feature flags checked:
   ✓ ENABLE_EXECUTIVE_WORKFLOW = true
   ✓ ENABLE_AUTONOMOUS_EXECUTION = false (human approval required)
3. ExecutivePlanningWorkflow.run(objective) begins 12-stage workflow
4. Stage 1: OBJECTIVE_INTAKE
   - Objective text captured
   - Plan state initialized
   - Recovery snapshot created (Stage 1 → 2 boundary)
```

**Output to Layer 2**: Objective text for RoadmapEngine parsing.

**Recovery Point**: Recovery snapshot created before planning begins. If the system crashes during planning, recovery resumes from this point.

---

### Phase 2: Planning & Routing (Layer 2 → Layer 3)

**Input**: Objective text from Executive Layer

```
1. Stage 2: PLAN_PARSING
   RoadmapEngine.parse(markdown) →
   RoadmapAnalysis {
     phases: [{ id, name, epics }],
     dependencies: [{ from, to }],
     metadata: { totalPhases, totalMilestones }
   }

2. Stage 3: CAPABILITY_SELECTION
   CapabilitySelector.selectForEpic(roadmapEpic) →
   CapabilitySelection[] {
     capabilityId: "code.generate",
     selectionReason: EXISTING_CAPABILITY,
     source: PROVIDER_REGISTRY,
     provider: "hermes",
     requiresApproval: false,
     estimatedCost: 10
   }
   - Tries exact match → keyword match → discipline match → NEW_WORK

3. Stage 4: RESOURCE_ESTIMATION
   TokenBudgetManager.estimate(plan) → TokenBudget
   ContextBudgetManager.estimate(plan) → ContextBudget
   - Allocates per-batch budgets
   - Validates against plan-level caps

4. Stage 5: DISCIPLINE_SELECTION
   DisciplineSelector.selectForEpic(roadmapEpic) →
   DisciplineSelection[] {
     discipline: "engineering_quality",
     justification: "Epic requires code generation",
     requiredCapabilities: ["code.generate", "test.run"],
     activationScope: epic.id,
     estimatedLoad: "medium"
   }

5. Stage 6: BATCH_GENERATION
   ExecutionPlanner.createBatches(epics, disciplines, capabilities) →
   ExecutionPlan {
     id: "plan-uuid",
     status: PLAN_STATUS.APPROVED,
     batches: [
       { id: "batch-1", discipline, capability, tasks },
       { id: "batch-2", discipline, capability, tasks }
     ]
   }

6. Stage 7: APPROVAL_CHECK
   ApprovalManager.evaluate(plan) →
   ApprovalEvaluation { requiresApproval: true/false }
   - If approval required → gates until human approval
```

**Output to Layer 3**: `ExecutionPlan` (status: APPROVED).

**Recovery Point**: Plan is snapshotted before activation. Recovery snapshot contains the full PlanState with batches.

---

### Phase 3: Activation & Validation (Layer 3 → Layer 4)

**Input**: `ExecutionPlan` from Planning Layer

```
1. WAS.PlanConsumer.consume(plan)
   → Validates plan.status === APPROVED
   → Checks idempotency (not already activated)
   → Creates ActivationLifecycle {
       id: "activation-uuid",
       planId: plan.id,
       state: ActivationState.PENDING,
       createdAt: ISO timestamp
     }

2. WAS.ConstitutionalValidator.validate(plan)
   → Runs validation gates:
     [✓] feature_flags — ENABLE_AUTONOMOUS_EXECUTION
     [✓] constitutional — rules from PLATFORM_CONSTITUTION.md
     [✓] budget — token/context limits not exceeded
   → Returns ValidationResult { ok: true, gates: [...], summary: "..." }

3. WAS state machine transitions:
   PENDING → VALIDATING (validation started)
   VALIDATING → ACTIVATING (validation passed)
   ← VALIDATING → REJECTED (if validation fails — terminal)

4. WAS deactivates plan in EPCL:
   → plan.status = INACTIVE (EPCL no longer owns execution)

5. WAS creates batches:
   → ActivatedBatch[] from ExecutionPlan batches
   → Each batch gets unique batch ID
   → WAS transitions state → ACTIVE

6. WAS delegates batches to WEF:
   → WEFDelegationRequest[] created per batch
   → DelegationConstraint[] passed through (constitutional rules)
```

**Output to Layer 4**: `WEFDelegationRequest[]`.

**Recovery Point**: Activation lifecycle persisted. If crash occurs during delegation, WASRecovery restores in-progress activations.

---

### Phase 4: Execution via WEF (Layer 4 → Layer 8 → Layer 4 → Layer 3)

**Input**: `WEFDelegationRequest` from Activation Layer

```
1. WEFDelegator.dispatch(request)
   → Routes to Hermes Runtime Agent
   → Picks correct execution path per capability

2. For deployment capabilities:
   WEFOperationalIntelligence.preDeploymentReport(batch) →
   WefOperationalReport {
     overallHealth: "green",
     dependencies: [{ name: "wrangler", status: "healthy" }]
   }
   → CredentialResolver checks credentials
   → ProviderRegistry verifies providers

3. Hermes Runtime executes batch:
   → Runs code generation, tests, etc.
   → Each execution follows capability-specific workflow

4. Returns WEFDelegationResult { ok: true, delegationId, timestamp }
```

**Output to Layer 3**: `WEFDelegationResult`.

---

### Phase 5: Verification (Layer 3 → Layer 5 → Layer 3)

**Input**: `WEFDelegationResult` from Execution Layer

```
1. WAS.VerificationRouter.verify(result)
   → Validates delegation result
   → Checks constitutional compliance
   → Runs capability-specific checks

2. VerificationResult {
     ok: true,
     verificationId: "verification-uuid",
     checks: [
       { check: "code_typecheck", passed: true, message: "TypeScript compiles" },
       { check: "test_pass", passed: true, message: "All tests green" }
     ],
     summary: "All verification checks passed"
   }

3. On verification pass:
   → WAS.recordBatchCompletion(batchId)
   → Batch status → COMPLETED

4. On verification fail:
   → WAS.recordBatchFailure(batchId)
   → WAS may retry (if within maxRetries)
   → Batch status → FAILED
```

**Output**: Verification result back to Activation Layer.

---

### Phase 6: Knowledge Capture (Layer 3 → Layer 6 → Layer 7)

**Input**: Completed batch notification from Activation Layer

```
1. WAS.KnowledgeCaptureTrigger.onBatchComplete(batch)
   → Fires knowledge capture for the completed batch

2. KnowledgeCapturer.capture(plan, batch, results)
   → Captures:
     - Implementation patterns as reusable procedures
     - Architecture decisions as ADRs
     - Debugging lessons as knowledge entries
     - Key metrics (duration, cost, errors)
   → If reusable pattern identified:
     - Creates/updates skill via skill_manage
     - Saves durable facts via memory

3. Knowledge stored in Knowledge Store / Skill Store / Memory Store

4. If capture fails:
   → Logged as warning
   → Execution continues (non-fatal)
```

**Output**: Knowledge entries persisted in Operations Layer.

---

### Phase 7: Executive Reporting (Layer 3 → Layer 9 → Layer 10 → Layer 1)

**Input**: Activation completion from Activation Layer

```
1. WAS.ExecutiveStatusUpdater.generate(activation)
   → ActivationStatusReport {
       activationId, planId, state,
       batchesActivated, batchesDelegated,
       batchesCompleted, batchesFailed,
       totalBatches, progress, summary
     }

2. EPCL.ExecutiveReporter.generate(plan, stageResults)
   → Stage 12: REPORTING
   → ExecutiveReport {
       planId, objective,
       totalBatches, completed, failed,
       totalTokens, totalCost,
       duration, keyDifficulties,
       knowledgeCollected
     }

3. Report delivered to Product Owner
   → Via Telegram (primary channel)
   → Includes: what changed, key numbers, duration

4. WAS lifecycle → COMPLETED (terminal state)
   → ActivationLifecycle state → DEACTIVATING → DEACTIVATED

5. Governance Layer:
   → Compliance audit log updated
   → Append-only event records committed
```

**Output**: Executive report delivered to Product Owner. Governance audit committed.

---

## Layer Invariants (Cross-Cutting)

| # | Invariant | Description | Enforced By |
|---|-----------|-------------|-------------|
| 1 | Fail-closed | No capability defaults to active | registry.ts: registerAgent() forces disabled |
| 2 | Deterministic selection | Capability/discipline selection is pure registry lookup with no LLM calls | CapabilitySelector, DisciplineSelector |
| 3 | Singleton services | All major services use getInstance() singleton | Each service constructor (private) |
| 4 | Feature-flag-first | Every gated operation checks flags before acting | feature-flags.ts: isEnabled() |
| 5 | Verification mandatory | Every batch must be verified before acceptance | WAS VerificationRouter |
| 6 | Knowledge capture mandatory | Every execution cycle produces knowledge | WAS KnowledgeCaptureTrigger |
| 7 | Executive reporting automatic | Every cycle produces a structured report | ExecutiveReporter |
| 8 | Safety invariant | All agents registered disabled + non-autonomous | seed.ts: assertWorkforceSafety() |
| 9 | Recovery checkpoints | Snapshots created before each state transition | RecoveryManager, WASRecovery |
| 10 | Concurrent activation limit | Max 1 concurrent activation (default) | WASConfig.maxConcurrentActivations |

---

## Execution Time Estimates

| Phase | Typical Duration | Fastest | Slowest |
|-------|-----------------|---------|---------|
| 1. Executive Entry | 1-2 sec | 1 sec | 5 sec |
| 2. Planning & Routing | 2-10 sec | 2 sec | 30 sec |
| 3. Activation & Validation | 1-3 sec | 1 sec | 10 sec |
| 4. Execution via WEF | 30-300 sec | 10 sec | 600 sec |
| 5. Verification | 5-30 sec | 3 sec | 60 sec |
| 6. Knowledge Capture | 2-10 sec | 1 sec | 30 sec |
| 7. Executive Reporting | 1-3 sec | 1 sec | 5 sec |
| **Total** | **40-360 sec** | **~20 sec** | **~740 sec** |

> Note: Execution (Phase 4) dominates — actual code generation, testing, and deployment. Other phases are overhead.