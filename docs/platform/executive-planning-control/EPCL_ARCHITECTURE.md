# EPCL — Executive Planning & Control Layer

> **AI Platform Capability — Architecture**
> Reusable, deterministic, platform-level strategic planning layer that decomposes high-level objectives into executable work items.
>
> **Version:** 1.1.0 — Architecture (Updated)
> **Status:** Implementation Complete
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       EPCL Architecture
Capability:     Executive Planning & Control Layer
Capability #:   14
Phase:          Phase E — Executive Planning & Control (Delivery)
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
ADR:            ADR-018
```

---

## 1. Purpose

The Executive Planning & Control Layer (EPCL) is the **canonical planning layer** that sits between human operator intent and WEF execution. EPCL answers four questions:

| Question | EPCL Component |
|----------|---------------|
| **What to build?** | RoadmapEngine — parses roadmap markdown into structured hierarchy |
| **How to build it?** | ExecutivePlanningWorkflow — 12-stage orchestrator that creates execution plans |
| **Who builds it?** | DisciplineSelector — maps work to workforce disciplines |
| **How much can we do?** | ContextBudgetManager + TokenBudgetManager — monitor window limits |

**Execution remains WEF's responsibility.** EPCL plans. WEF executes. PSER tracks.

---

## 2. Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Platform First** | EPCL is a reusable AI Platform capability. No product-specific logic. Concierge is Consumer #1. |
| **Deterministic** | All planning logic produces deterministic output. No LLM inference of plan structure. |
| **Planning Only** | EPCL never executes work directly. All execution goes through the Execution Gateway → WEF. |
| **Fail-Closed** | Every planning decision defaults to DENY if dependencies, budgets, or constraints cannot be determined. |
| **Checkpoint-Based** | Interruptions produce checkpoints. Resumption reads the last completed atom. |
| **Human Authority** | Plans are presented for review and approval. Human operators approve, reject, or request changes. |
| **Token-Conscious** | Proactive context and token budgeting prevents window overflow before planning begins. |
| **Discipline-Routed** | Every work item is assigned to exactly one workforce discipline. No cross-discipline ambiguity. |
| **Feature-Gated** | Every workflow stage is behind a feature flag. Stages are disabled by default. |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────────────┐
│                   ExecutivePlanningWorkflow (12 stages)               │
│                                                                      │
│  roadmap markdown                                                    │
│       │                                                              │
│  ┌────▼──────────────────────────────────────────────────────────┐   │
│  │  Stage 1: ROADMAP_ANALYSIS    ← RoadmapEngine.parseMarkdown() │   │
│  │  Stage 2: DEPENDENCY_RESOLUTION ← RoadmapEngine.analyze()     │   │
│  │  Stage 3: EXECUTION_PLAN      ← ExecutionPlanner.createPlan() │   │
│  │  Stage 4: CAPABILITY_SELECTION  ← CapabilitySelector.list()   │   │
│  │  Stage 5: DISCIPLINE_SELECTION  ← DisciplineSelector          │   │
│  │  Stage 6: BATCH_GENERATION    ← RecoveryManager.createSnapshot│   │
│  │  Stage 7: APPROVAL_CHECK      ← ApprovalManager.evaluateBatch │   │
│  │  Stage 8-10: (Reserved — WEF delegation, monitoring, verify)  │   │
│  │  Stage 11: KNOWLEDGE_CAPTURE  ← KnowledgeCapturer.capture()   │   │
│  │  Stage 12: EXECUTIVE_REPORT   ← ExecutiveReporter.generateReport│  │
│  └────────────────────────────────────────────────────────────────┘   │
│                                                                      │
│  Result: { ok, plan?, error?, stages[] }                             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 4. Service Architecture

### 4.1 Service Layer

```
┌────────────────────────────────────────────────────────────────────────┐
│                           EPCL Services                                │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │  RoadmapEngine  │  │ CapabilitySelector│  │  DisciplineSelector  │   │
│  │                 │  │                 │  │                      │   │
│  │  parseMarkdown()│  │  register()     │  │  selectForEpic()     │   │
│  │  analyze()      │  │  selectForEpic()│  │  getUtilization()    │   │
│  │  register()     │  │  list()         │  │                      │   │
│  │  list()         │  │  reset()        │  │  reset()             │   │
│  │  reset()        │  └─────────────────┘  └──────────────────────┘   │
│  └─────────────────┘                                                  │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ ExecutionPlanner│  │  ApprovalManager│  │  RecoveryManager     │   │
│  │                 │  │                 │  │                      │   │
│  │  createPlan()   │  │  evaluatePlan() │  │  createSnapshot()    │   │
│  │  updatePlan()   │  │  evaluateBatch()│  │  getCheckpoint()     │   │
│  │  updateBatch()  │  │  reset()        │  │  finalizePlan()      │   │
│  │  reset()        │  └─────────────────┘  │  reset()             │   │
│  └─────────────────┘                       └──────────────────────┘   │
│                                                                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────────────┐   │
│  │ ContextBudget   │  │  TokenBudget    │  │  KnowledgeCapturer   │   │
│  │ Manager         │  │  Manager        │  │                      │   │
│  │                 │  │                 │  │  capture()           │   │
│  │  getBudget()    │  │  getBudget()    │  │  list()              │   │
│  │  updateBudget() │  │  updateBudget() │  │  reset()             │   │
│  │  reset()        │  │  reset()        │  └──────────────────────┘   │
│  └─────────────────┘  └─────────────────┘                             │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  ExecutiveReporter                                               │   │
│  │  generateReport(plan, selector, approval, context, token)        │   │
│  │  reset()                                                         │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │  FeatureFlags                                                    │   │
│  │  isEnabled(flag): boolean                                        │   │
│  │  setFlags(partial): void                                         │   │
│  │  getConfig(): EPCLConfig                                         │   │
│  │  resetForTest(): void                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Singleton Pattern

All services use the singleton pattern:

```typescript
const workflow = ExecutivePlanningWorkflow.getInstance();
const engine = RoadmapEngine.getInstance();
const selector = CapabilitySelector.getInstance();
```

The `reset()` method on `ExecutivePlanningWorkflow` clears all service singletons, making it safe for test isolation.

---

## 5. Data Model

### 5.1 Core Types

All types are defined in `types.ts`.

#### Roadmap (from markdown parsing)

```typescript
interface Roadmap {
  id: string;
  title: string;
  description: string;
  phases: RoadmapPhase[];
  dependencies: RoadmapDependency[];
  createdAt: string;
}

interface RoadmapPhase {
  id: string;
  name: string;
  order: number;
  epics: RoadmapEpic[];
}

interface RoadmapEpic {
  id: string;
  name: string;
  description: string;
  requiredCapabilities: string[];
  assignedDisciplines: string[];
  milestones: Milestone[];
  dependencies: string[];
}
```

#### Execution Plan (from planning)

```typescript
interface ExecutionPlan {
  id: string;
  roadmapId: string;
  title: string;
  description: string;
  phases: PlanPhase[];
  dependencies: ResolvedDependency[];
  batches: ExecutionBatch[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  approvalRequired: boolean;
  approvalBriefing?: string;
}

interface ExecutionBatch {
  id: string;
  planId: string;
  name: string;
  discipline: string;
  capabilities: string[];
  tasks: ExecutionTask[];
  status: BatchStatus;
  order: number;
  phaseOrder: number;
  estimatedTokens: number;
  createdAt: string;
  updatedAt: string;
}

interface ExecutionTask {
  id: string;
  batchId: string;
  name: string;
  description: string;
  type: TaskType;
  status: TaskStatus;
  priority: number;
  estimatedTokens: number;
  assignedCapability: string;
  assignedDiscipline: string;
  createdAt: string;
}
```

### 5.2 Key Enums

| Enum | Values | Description |
|------|--------|-------------|
| `PlanStatus` | `DRAFT`, `PENDING_APPROVAL`, `APPROVED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED` | Plan lifecycle |
| `BatchStatus` | `DRAFT`, `PENDING`, `DISPATCHED`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `CANCELLED` | Batch lifecycle |
| `TaskStatus` | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `FAILED`, `BLOCKED`, `SKIPPED` | Task lifecycle |
| `TaskType` | `EXECUTION`, `VERIFICATION`, `DEPLOYMENT`, `REVIEW`, `DOCUMENTATION` | Task type |
| `WorkflowStage` | 12 stages from `ROADMAP_ANALYSIS` to `EXECUTIVE_REPORT` | Stage identifiers |
| `FeatureFlag` | 10 flags covering all services | Feature gating |
| `Discipline` | `research_intelligence`, `architecture_strategy`, `experience_design`, `engineering_quality`, `business_growth`, `platform_intelligence` | Workforce disciplines |
| `ApprovalType` | `CONSTITUTIONAL`, `SECURITY`, `DATABASE`, `DEPLOYMENT`, `PRODUCT` | Approval categories |
| `KnowledgeType` | `REUSABLE_KNOWLEDGE`, `PLANNING_INSIGHT`, `EXECUTION_LEARNINGS` | Knowledge categories |

---

## 6. Workflow Execution Flow

### 6.1 Plan Creation

```
Operator provides roadmap markdown
  │
  ▼
Stage 1: ROADMAP_ANALYSIS
  RoadmapEngine.parseMarkdown(markdown, source)
  RoadmapEngine.register(roadmap)
  RoadmapEngine.analyze(roadmap.id)
  → Roadmap, RoadmapAnalysis
  │
  ▼
Stage 2: DEPENDENCY_RESOLUTION
  Reports totalDependencies, satisfied, circular check
  → Stage result
  │
  ▼
Stage 3: EXECUTION_PLAN
  For each phase:
    For each epic:
      CapabilitySelector.selectForEpic(epic)
      DisciplineSelector.selectForEpic(epic)
  ExecutionPlanner.createPlan(roadmap, caps, discs)
  → ExecutionPlan (with batches)
  │
  ▼
Stage 4: CAPABILITY_SELECTION
  Reports registered capability count
  → { capabilities: N }
  │
  ▼
Stage 5: DISCIPLINE_SELECTION
  Reports discipline utilization summary
  → { disciplines: [...] }
  │
  ▼
Stage 6: BATCH_GENERATION
  RecoveryManager.createSnapshot(plan)
  → { batches: N, tasks: N }
  │
  ▼
Stage 7: APPROVAL_CHECK
  ApprovalManager.evaluatePlan(plan) — fails if >20 batches
  For each batch:
    ApprovalManager.evaluateBatch(batch, plan) — fails on security/db/deploy/new caps
  → { approved: true, batchesApproved: N }
  │
  ▼
Stages 8-10: Reserved
  Placeholder for WEF delegation, monitoring, verification
  │
  ▼
Stage 11: KNOWLEDGE_CAPTURE
  KnowledgeCapturer.capture(REUSABLE_KNOWLEDGE, ...)
  → { captured: true }
  │
  ▼
Stage 12: EXECUTIVE_REPORT
  ExecutiveReporter.generateReport(plan, ...)
  → { reportGenerated: true }
  │
  ▼
Plan finalized: status → APPROVED
Recovery finalizes plan
```

### 6.2 Interruption Handling

```
Session 1:
  - Workflow executes, plan created
  - Batch 1 generated, approval passes
  - INTERRUPTION (context limit / user ends session)
  - RecoveryManager snapshot available

Session 2 (resume):
  - RecoveryManager.getCheckpoint(planId)
  - Continue from last checkpoint
```

---

## 7. Approval Rules

### 7.1 Batch Approval Logic

```
evaluateBatch(batch, plan):
  1. if batch.tasks.length === 0 → reject (empty)
  2. if any capability contains "deploy"|"publish"|"release" → reject (deployment)
  3. if any capability contains "db."|"database"|"migrate" → reject (database)
  4. if any capability contains "security"|"auth"|"permission" → reject (security)
  5. if capabilities.length === 0 OR all contain "new"|"unknown" → reject (product)
  6. if tasks.length > 10 → reject (constitutional)
  7. otherwise → approve
```

### 7.2 Plan Approval Logic

```
evaluatePlan(plan):
  if plan.batches.length > 20 → reject (constitutional)
  otherwise → approve
```

---

## 8. Module Reference

### 8.1 Source Files

| File | Lines | Classes/Exports | Description |
|------|-------|-----------------|-------------|
| `executive-workflow.ts` | 450 | `ExecutivePlanningWorkflow` | 12-stage orchestrator |
| `roadmap-engine.ts` | 350+ | `RoadmapEngine`, `RoadmapAnalysis` | Markdown parsing and analysis |
| `capability-selector.ts` | 426 | `CapabilitySelector` | Capability registry and matching |
| `discipline-selector.ts` | ~120 | `DisciplineSelector` | Discipline resolution |
| `execution-planner.ts` | 585 | `ExecutionPlanner`, `ExecutionPlannerError` | Plan and batch creation |
| `approval-manager.ts` | 358 | `ApprovalManager` | Approval evaluation |
| `context-budget-manager.ts` | ~100 | `ContextBudgetManager` | Context window tracking |
| `token-budget-manager.ts` | ~100 | `TokenBudgetManager` | Token consumption tracking |
| `executive-reporter.ts` | ~100 | `ExecutiveReporter` | Report generation |
| `knowledge-capturer.ts` | ~100 | `KnowledgeCapturer` | Knowledge capture |
| `recovery-manager.ts` | ~100 | `RecoveryManager` | Checkpoint and recovery |
| `feature-flags.ts` | ~100 | `isEnabled`, `setFlags`, `getConfig`, `resetForTest` | Feature gating |
| `types.ts` | ~400 | All interfaces, enums, type definitions | Shared types |

### 8.2 Test File

| File | Tests | Description |
|------|-------|-------------|
| `epcl-executive-workflow.test.ts` | 25 | Full workflow, error cases, singleton isolation, edge cases |

---

## 9. Configuration

See [EPCL_CONFIGURATION.md](./EPCL_CONFIGURATION.md) for:
- Feature flag reference
- Roadmap markdown format
- Capability registration
- Testing setup
- Error handling
- Extension points

---

## 10. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-29 | Initial architecture document (original design) |
| 1.1.0 | 2026-07-30 | Updated to reflect implemented 12-stage workflow, actual service interfaces, approval rules, and data model |