# PSER — Execution State Model

> **AI Platform Capability — Execution State Design**
> Runtime execution context model for the Project State & Execution Registry.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Business Unit:  Engineering
Platform:       AI Platform
Product:        Concierge (consumer)
Portfolio:      Clinical
Capability:     Project State & Execution Registry
Document:       PSER Execution State Model
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
```

---

## 1. Execution Context

The execution context is the **complete runtime snapshot** of what is currently happening in a product's lifecycle. Workforce agents retrieve this context at the start of every execution cycle instead of inferring it from documents.

### 1.1 Execution Context Shape

```typescript
interface ExecutionContext {
  // ── Identity ─────────────────────────────────────────
  company: {
    id: string;
    name: string;                   // "AGS"
  };

  business_unit: {
    id: string;
    name: string;                   // "Engineering"
  };

  platform: {
    id: string;
    name: string;                   // "AI Platform"
    version: string;
    status: "active" | "maintenance" | "frozen";
  };

  product: {
    id: string;
    name: string;                   // "Concierge"
    brand: string;                  // "AG Synergy"
    portfolio: string;              // "Clinical"
    status: "active" | "inactive" | "sunset";
  };

  // ── Current State ────────────────────────────────────
  current_phase: {
    id: string;
    name: string;                   // "Phase 2 — Patient Workflow Platform"
    order: number;                  // 2
    status: EntityStatus;
    gate_status: GateStatus;
    completion_pct: number;         // 45.5
  };

  current_wave: {
    id: string;
    name: string;                   // "Wave 5 — Patient Portal"
    order: number;                  // 5
    status: EntityStatus;
    gate_status: GateStatus;
    completion_pct: number;
  };

  current_epic: {
    id: string;
    name: string;                   // "EPIC-2.2 — Patient Portal & Dashboard"
    status: EntityStatus;
    priority: Priority;
    completion_pct: number;
    story_points_total: number;
    story_points_completed: number;
  };

  current_sprint: {
    id: string;                     // "S2.2.1"
    name: string;
    duration_days: number;          // 14
    status: EntityStatus;
    completion_pct: number;
    start_date: string;
    end_date: string;
  };

  // ── Active Work ──────────────────────────────────────
  assigned_stories: StoryState[];
  current_task: TaskState | null;
  resume_point: ResumePoint | null;

  // ── Health ───────────────────────────────────────────
  blockers: Blocker[];
  active_risks: Risk[];
  open_approvals: Approval[];

  // ── Metrics ──────────────────────────────────────────
  metrics: {
    phase_completion_pct: number;
    wave_completion_pct: number;
    epic_completion_pct: number;
    sprint_completion_pct: number;
    tests_total: number;
    tests_passing: number;
    test_pass_rate: string;         // "98.3%"
    story_points_total: number;
    story_points_completed: number;
    active_blockers: number;
    open_risks: number;
    pending_approvals: number;
  };

  // ── Execution State ──────────────────────────────────
  execution_state: {
    last_execution_event: ExecutionEvent | null;
    last_validated: string | null;  // ISO 8601
    last_successful_execution: string | null;
    version: string;                // current release version
    git_commit: string;             // HEAD commit hash
    current_release_tag: string;
    test_status_last_run: string | null;
    build_status: "passing" | "failing" | "unknown";
  };
}
```

### 1.2 Context Retrieval Flow

```
Agent (or operator) calls: ProgressService.getActiveExecutionContext(productId)

PSER resolves:
  1. Company from product.company_id
  2. Platform associated with company
  3. Product record
  4. Current phase (status = 'in_progress', highest phase_order)
  5. Current wave (status = 'in_progress', highest wave_order)
  6. Current epic (status = 'in_progress', highest priority)
  7. Current sprint (status = 'in_progress')
  8. Active stories (sprint_id matches, status != 'completed')
  9. Current task (status = 'in_progress')
  10. Resume point (entity_type='task', entity_id=current_task.id)
  11. Active blockers for current entities
  12. Open risks for phase/wave/epic
  13. Pending approvals
  14. Latest execution events

Returns: structured ExecutionContext JSON
```

---

## 2. State Machine — Entity Lifecycle

Every entity in the PSER hierarchy follows a governed state machine.

### 2.1 Top-Level State Machine

```
                        ┌─────────────────┐
                        │    PLANNED      │
                        └────────┬────────┘
                                 │ criteria met + approval
                                 ▼
                     ┌───────────────────────┐
                     │     IN_PROGRESS       │ ◄────────────────┐
                     └──┬─────────┬──────────┘                  │
                        │         │                             │
                   child tasks  blocker                        │
                   complete     raised                         │
                        │         │                             │
                        ▼         ▼                             │
                ┌──────────┐  ┌────────┐                       │
                │COMPLETED │  │BLOCKED │──mitigated──►──────────┘
                └─────┬────┘  └────────┘
                      │ gate approved
                      ▼
                ┌──────────┐
                │  CLOSED  │
                └──────────┘
```

### 2.2 Valid State Transitions

| From | To | Condition |
|------|----|-----------|
| PLANNED | IN_PROGRESS | Entry criteria met + gate approved (human) |
| IN_PROGRESS | COMPLETED | All child entities complete. Auto-evaluated. |
| COMPLETED | CLOSED | Exit criteria met + gate approved (human) |
| IN_PROGRESS | BLOCKED | Blocker raised. Auto-evaluated. |
| BLOCKED | IN_PROGRESS | Blocker resolved + resume point set. |
| BLOCKED | CANCELLED | Human operator overrides. |
| PLANNED | CANCELLED | Human operator de-scopes. |
| IN_PROGRESS | CANCELLED | Human operator terminates. |
| COMPLETED | (none) | Terminal state for exit gate. |
| CLOSED | (none) | Terminal state. |

### 2.3 Automatic State Transitions

Some transitions are automatic — evaluated by PSER's service layer without human intervention:

| Transition | Trigger | Evaluator |
|-----------|---------|-----------|
| Task → COMPLETED | `completion_pct = 100` | PSER TaskService |
| Story → COMPLETED | All tasks COMPLETED | PSER StoryService |
| Sprint → COMPLETED | All stories COMPLETED | PSER SprintService |
| IN_PROGRESS → BLOCKED | Active blocker raised on entity | PSER GateService (auto-flag) |
| BLOCKED → IN_PROGRESS | Blocker resolved, resume point set | PSER ResumeService |

### 2.4 Gate-Governed Transitions (Human Required)

| Transition | Human Role | Evidence Required |
|-----------|------------|-------------------|
| Phase PLANNED → IN_PROGRESS | Approver | Entry criteria checklist |
| Wave PLANNED → IN_PROGRESS | Approver | Wave plan approved |
| Epic PLANNED → IN_PROGRESS | Approver | Epic scope validated |
| Phase COMPLETED → CLOSED | Approver | Exit criteria + closeout review |
| Wave COMPLETED → CLOSED | Approver | Exit criteria + handoff prepared |
| Epic COMPLETED → CLOSED | Approver | Epic retrospective approved |

---

## 3. Resume Point Model

The resume point is the **exact coordinate** from which execution should continue. Every task can have one active resume point.

### 3.1 Resume Point Fields

```typescript
interface ResumePoint {
  id: string;
  entity_type: "phase" | "wave" | "epic" | "sprint" | "story" | "task";
  entity_id: string;
  next_action: string;              // Human-readable: "Implement Task 4: Identity Core — Rate Limiter"
  context: {                         // Agent-specific context to restore
    completed_steps: string[];       // ["Task 1: JWT Manager", "Task 2: Key Rotation", "Task 3: MFA Flow"]
    current_step: string;            // "Task 4: Rate Limiter"
    next_step: string;               // "Task 5: Session Management"
    branch?: string;                 // git branch if applicable
    file_path?: string;              // last file being edited
    test_file?: string;              // last test being written
    environment?: string;            // "development" | "staging"
    decision_id?: string;            // last decision made
    pending_decisions?: string[];    // decisions awaiting human input
  };
  set_by: string;                    // principal:<id>
  set_at: string;                    // ISO 8601
  cleared_at?: string;
  cleared_by?: string;
}
```

### 3.2 Resume Point Lifecycle

```
SET ──→ ACTIVE ──→ CLEARED
                     │
                     └──→ SET (new)  ← task advances to next step
```

- Resume points are per-entity. A task has one active resume point.
- Setting a new resume point on an entity clears the previous one.
- Clearing happens automatically when a task completes (completion_pct = 100).
- A workforce agent can SET its own resume point at any checkpoint.
- The human operator can SET a resume point to redirect execution.

### 3.3 Resume Workflow

```
1. Agent queries:        ResumeService.getCurrentResumePoint(productId)
2. PSER returns:         { entity_type: "task", entity_id: "task-004",
                           next_action: "Implement rate limiter middleware",
                           context: { completed_steps: [...], current_step: "Rate Limiter" } }
3. Agent validates:      Is the context still valid? (check file state, branch, dependencies)
4. Agent executes:       Resume from context.current_step
5. Agent completes:      Updates task.completion_pct
6. Agent calls:          ExecutionRegistry.recordExecution({ entity: "task-004", event: "checkpoint" })
7. Agent calls:          ResumeService.setResumePoint(..., { next_action: "Implement Session Manager" })
```

---

## 4. Gate State Model

Gates govern transitions between states. There are two gate types per entity layer:

| Gate Type | When Evaluated | Purpose |
|-----------|---------------|---------|
| Entry Gate | PLANNED → IN_PROGRESS | Verify readiness to begin |
| Exit Gate | COMPLETED → CLOSED | Verify completeness to close |

### 4.1 Gate Evaluation

```typescript
interface GateEvaluation {
  entity_type: string;
  entity_id: string;
  gate_type: "entry" | "exit";
  overall: "pass" | "fail" | "conditional";
  criteria: Array<{
    id: string;
    description: string;
    status: "met" | "unmet" | "waived";
    evidence?: string;
    verified_by?: string;
    verified_at?: string;
  }>;
  summary: string;
}
```

### 4.2 Gate Workflow

```
1. Agent completes all entity work
2. Agent notifies: PSER -> GateService.evaluateExitGate(entity)
3. PSER evaluates: All criteria met? →
     YES → status = "criteria_met"
             Submit for human approval
             GateService.submitForApproval(entity)
             Notifications API → human operator
     NO  → status = "criteria_pending"
             Return failed criteria list → agent addresses gaps
4. Human operator: Approves or denies
     Approves → status = "approved"
                Entity transitions COMPLETED → CLOSED
     Denies   → status = "denied"
                Entity remains COMPLETED (not closed)
                Reason returned to agent
```

---

## 5. Active Execution Model

When a workforce agent begins execution, PSER provides a **scoped execution environment**:

```typescript
interface ActiveExecutionScope {
  context: ExecutionContext;          // Full context (read-only for agent)
  assignments: Assignment[];          // Agent's current assignments
  authorized_actions: string[];       // ["read", "write", "advance", "block"]
  session_token: string;              // Scoped auth token for this session
  expires_at: string;                 // Session expiry
}

interface ActiveExecutionState {
  // ── What the agent should work on ──
  assigned_entity_type: string;       // "task"
  assigned_entity_id: string;         // "task-004"
  resume_point: ResumePoint;

  // ── What the agent can do ──
  can_update_task: boolean;           // true (agent is assignee)
  can_raise_blocker: boolean;         // true
  can_advance_story: boolean;         // false (only on all tasks complete)

  // ── Constraints ──
  blocked: boolean;                   // false
  dependencies_satisfied: boolean;    // true
  pending_decisions: string[];        // []

  // ── Session ──
  session_id: string;                 // "ses_<uuid>"
  started_at: string;
  last_heartbeat: string;
}
```

---

## 6. Workforce Query Protocol

The standard query pattern for any workforce agent beginning work:

### 6.1 "What is the current state?"

```
Query:    ProgressService.getActiveExecutionContext(productId)
Returns:  ExecutionContext (complete hierarchy, blockers, resume point, metrics)
```

### 6.2 "What should I work on?"

```
Query:    WorkforceAssignmentService.getCurrentAssignments(workforceId)
           + filter: agent_id = <self>
Returns:  Active assignments for this agent
```

### 6.3 "Where do I resume?"

```
Query:    ResumeService.getCurrentResumePoint(productId)
Returns:  ResumePoint (entity, next_action, context)
```

### 6.4 "Is anything blocking me?"

```
Query:    BlockerService.getBlockers(entityType, entityId)
           + traverse: parent entities up to product
Returns:  Blocker[] (active only)
```

### 6.5 "Record my progress."

```
Command:  ExecutionRegistry.recordExecution(event)
           + TaskService.updateTask(taskId, { completion_pct, status })
           + ResumeService.setResumePoint(...)  (optional checkpoint)
Returns:  Updated TaskState
```

---

## 7. Example: Agent Start-of-Work Query

```
Agent: Hermes Developer Agent (developer-001)

┌─────────────────────────────────────────────────────────┐
│ Agent calls ProgressService.getActiveExecutionContext() │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────┐
│ PSER Returns:                                             │
│                                                           │
│ Company:      AGS                                         │
│ Business Unit: Engineering                                 │
│ Platform:     AI Platform v1.15.0                         │
│ Product:      Concierge (AG Synergy)                      │
│ Portfolio:    Clinical                                     │
│ Phase:        Phase 2 — Patient Workflow Platform         │
│               Gate: ENTRY APPROVED                        │
│               Completion: 45%                             │
│ Wave:         Wave 6 — Secure Document Upload             │
│               Gate: PENDING (Enterprise Governance)       │
│               Completion: 0%                              │
│ Epic:         EPIC-2.2 — Patient Workspace                │
│               Priority: P0                                │
│               Points: 0/21 (0%)                           │
│ Sprint:       S2.2.2                                      │
│               Day 5 of 14 (35%)                           │
│ Assigned:     Story: Patient Dashboard Layout             │
│               Task: Implement responsive grid layout      │
│ Resume:       Task 4 — Complete grid component tests      │
│ Blockers:     None                                        │
│ Deps met:     Yes (Identity Core API available)           │
└─────────────────────────────────────────────────────────┘
                              │
                              ▼
Agent: "I understand the context. I will complete Task 4:
        Implement responsive grid layout tests for the
        Patient Dashboard. Starting from: complete grid
        component tests."

Execution begins. No markdown reading required.
```

---

## 8. Example: Agent Recording Completion

```
Agent completes Task 4

Agent calls:
  ExecutionRegistry.recordExecution({
    entity_type: "task",
    entity_id: "task-004",
    event_type: "completed",
    outcome: "success",
    summary: "Completed responsive grid layout tests — 12/12 passing",
    duration_ms: 840000
  })

  TaskService.updateTask("task-004", { status: "completed", completion_pct: 100 })

PSER evaluates:
  Story all tasks complete?  →  Yes (5/5 tasks done)
  Story auto-advances        →  Story status = "completed"
  Sprint all stories done?   →  No (3/8 stories remain)
  Agent notified:            →  Next assigned task: "task-005"

Agent receives:
  Updated active state
  Next resume point: Story 5 — "Implement consultation form"
```

---

*This execution state model is authoritative for PSER v1.0.*
*All workforce integration must conform to this protocol.*
*Execution model — AI Platform Capability*
*Last updated: 2026-07-26*