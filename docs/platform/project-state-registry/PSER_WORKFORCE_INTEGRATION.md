# PSER — Workforce Integration

> **AI Platform Capability — Workforce Integration Pattern**
> How AGS Workforce agents discover, query, and record state through PSER.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Framework:** WEF v1.0 (Workforce Execution Framework)
> **Last Updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Project State & Execution Registry
Document:       PSER Workforce Integration
Workforce:      AGS Workforce (WEF v1.0)
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Integration Principle

> **Before PSER:**
> Workforce agents read COMPANY_STATUS.md, ROADMAP.md, CURRENT_SPRINT.md to determine context.
> Context was reconstructed from text every session — slow, fragile, non-deterministic.

> **After PSER:**
> Workforce agents call one API to get the full execution context.
> Context is deterministic, structured, and always current.
> Documentation is a derived view of PSER state.

---

## 2. WEF Phase 0 — PSER-Aware Execution

The WEF v1.0 Phase 0 preparation step ("Validate Roadmap / Read Context") is now PSER-aware:

### Before (Markdown-Only Flow)

```
Phase 0 — Validation:
  1. Read COMPANY_STATUS.md
  2. Read ROADMAP.md
  3. Read CURRENT_SPRINT.md
  4. Read PROGRAM_STATUS.md
  5. Synthesize context from text
  6. Begin execution
```

### After (PSER-First Flow)

```
Phase 0 — Validation:
  1. Query PSER: ProgressService.getActiveExecutionContext(productId)
  2. PSER returns: structured ExecutionContext JSON
  3. Agent validates: Does the context match known reality? (git state, deployment status)
  4. Agent confirms: "I have context. Beginning execution."
  5. PSER records: execution_event(agent, "started", entity_type="sprint", entity_id=current_sprint.id)
  6. Begin execution from resume point
```

---

## 3. Agent Query Protocol

Every workforce agent follows the same start-of-work protocol:

### 3.1 Agent Initialization

```
┌─────────────────────────────────────────────────────────────┐
│  AGENT INITIALIZATION                                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  1. Auth → Obtain PSER-scoped credentials                     │
│     (agent identity + role: pser:reader, pser:writer)         │
│                                                               │
│  2. Context → GetActiveExecutionContext(product_id)           │
│     Returns: full ExecutionContext JSON                       │
│                                                               │
│  3. Assignments → GetCurrentAssignments(workforce_id)         │
│     Filter: agent_id = self                                  │
│     Returns: active entity assignments                       │
│                                                               │
│  4. Resume → GetCurrentResumePoint(product_id)                │
│     Returns: exact next_action + context                     │
│                                                               │
│  5. Blockers → GetBlockers(current_entity_type, entity_id)    │
│     Returns: active blockers (if any)                         │
│                                                               │
│  6. Validate → Are dependencies satisfied?                    │
│     Query pser_dependencies for current entity                │
│                                                               │
│  7. Begin → RecordExecution({ event_type: "started" })        │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 Heartbeat Protocol

During long-running tasks, agents send periodic checkpoints:

```
Every N minutes OR at logical milestones:

→ RecordExecution({
    entity_type: "task",
    entity_id: current_task.id,
    event_type: "checkpoint",
    summary: "Progress: 45% — Grid layout complete, starting form validation"
  })

→ ResumeService.setResumePoint({
    entity_type: "task",
    entity_id: current_task.id,
    next_action: "Implement form validation",
    context: { completed_steps: [...], current_step: "Form Validation" }
  })
```

### 3.3 Completion Protocol

```
When task is complete:

→ TaskService.updateTask(task_id, {
    status: "completed",
    completion_pct: 100
  })

→ RecordExecution({
    entity_type: "task",
    entity_id: task_id,
    event_type: "completed",
    outcome: "success",
    duration_ms: <actual_duration>,
    summary: "Task summary"
  })

→ ResumeService.clearResumePoint(task_id)

PSER evaluates:
  - Story all complete? → advance story
  - Sprint all complete? → advance sprint
  - Gate criteria met? → submit for approval
```

---

## 4. Agent Type Mapping

| Agent | PSER Role | Queries | Writes |
|-------|-----------|---------|--------|
| **Developer Agent** | pser:reader, pser:writer | Context, assignments, resume point, blockers | Execution events, task updates, resume points, blockers |
| **QA Agent** | pser:reader, pser:writer | Stories in progress, test status, blockers | Test status updates, blocker reports |
| **Security Agent** | pser:reader, pser:writer | Phase/wave gate status, blockers | Security findings as blockers, risk entries |
| **Documentation Agent** | pser:reader | Full context for doc generation | (Read-only for PSER. Documentation is a derived view.) |
| **Monitoring Agent** | pser:reader | Execution history, metrics, gate status | (Read-only for PSER.) |
| **Human Operator** | pser:admin, pser:approver, pser:operator | Full read + approval queue | Gates, approvals, overrides, state transitions |

---

## 5. Concierge Registration — Product #1

Concierge is registered as PSER's first product. The registration populates:

### 5.1 Initial State

```json
{
  "company": {
    "id": "comp-001",
    "name": "AGS"
  },
  "platform": {
    "id": "plat-001",
    "name": "AI Platform",
    "version": "1.15.0",
    "status": "active"
  },
  "product": {
    "id": "prod-001",
    "name": "Concierge",
    "brand": "AG Synergy",
    "status": "active"
  },
  "current_phase": {
    "id": "phase-002",
    "name": "Phase 2 — Patient Workflow Platform",
    "order": 2,
    "status": "in_progress",
    "gate_status": "approved",
    "completion_pct": 45.0
  },
  "current_wave": {
    "id": "wave-005",
    "name": "Wave 5 — Patient Portal",
    "order": 5,
    "status": "in_progress",
    "gate_status": "approved",
    "completion_pct": 30.0
  },
  "current_epic": {
    "id": "epic-2.2",
    "name": "EPIC-2.2 — Patient Portal & Dashboard",
    "status": "in_progress",
    "priority": "p0",
    "completion_pct": 38.0,
    "story_points_total": 21,
    "story_points_completed": 8
  },
  "current_sprint": {
    "id": "s2.2.1",
    "name": "S2.2.1",
    "duration_days": 14,
    "status": "in_progress",
    "completion_pct": 35.0,
    "start_date": "2026-07-26",
    "end_date": "2026-08-09"
  }
}
```

### 5.2 Seeding Rules

The initial state is seeded from the governance documents:

| PSER Field | Source Document |
|-----------|-----------------|
| Company | COMPANY_STATUS.md → Company Health |
| Platform | AI_PLATFORM_STATUS.md → Platform Capability Health |
| Product | PRODUCT_STATUS.md → Product Health |
| Phase | ROADMAP.md → Phase 2 section |
| Wave | ROADMAP.md → Wave 5 section |
| Epic | ROADMAP.md → EPIC-2.2 |
| Sprint | CURRENT_SPRINT.md → Sprint header |
| Blockers | PROGRAM_STATUS.md → Blockers section |
| Resume point | GOVERNANCE_FREEZE.md / CURRENT_SPRINT.md → Resume point |

**One-time seed, then live.** After seeding, all state changes go through PSER only. Documents are regenerated from PSER state.

---

## 6. Future Product Registration

When a new AGS product is created, registration is a simple insert:

```
1. ProductService.registerProduct({
    company_id: "comp-001",
    name: "NewProductName",
    brand: "PublicBrand",
    status: "active"
  })

2. RoadmapRegistry.createRoadmap({
    product_id: <new_product_id>,
    name: "NewProductName Roadmap"
  })

3. PhaseService.createPhase({ roadmap_id: ..., name: "Phase 1", ... })

4. PSER begins tracking. Zero code changes required.
```

---

## 7. WEF Integration Points

PSER integrates with the WEF v1.0 framework at six points:

| WEF Phase | Before (Markdown) | After (PSER) |
|-----------|-------------------|--------------|
| **Phase 0 — Validation** | Read ROADMAP.md, CURRENT_SPRINT.md | `ProgressService.getActiveExecutionContext()` |
| **Phase 1 — Planning** | Synthesize context from multiple docs | `ResumeService.getCurrentResumePoint()` |
| **Phase 2 — Execution** | Track progress in CURRENT_SPRINT.md | `TaskService.updateTask()` + `RecordExecution()` |
| **Phase 3 — Quality** | Refer to docs for acceptance criteria | `StoryService.getStory()` + gate criteria for gate |
| **Phase 4 — Gate** | Read phase gate criteria from PHASE_GATES.md | `GateService.evaluateExitGate()` |
| **Phase 5 — Closeout** | Write closeout to documents | `ExecutionHistoryService.getSessionTimeline()` |

---

## 8. Human Operator Interface

The human operator interacts with PSER through:

| Action | PSER Interface | Auth Required |
|--------|---------------|---------------|
| View full execution context | ProgressService.getActiveExecutionContext() | pser:reader |
| View approval queue | GateService.getPendingApprovals() | pser:reader |
| Approve gate transition | GateService.approve() | pser:approver |
| Deny gate transition | GateService.deny() | pser:approver |
| Override state | GateService.override() | pser:operator |
| Set resume point | ResumeService.setResumePoint() | pser:operator |
| Raise blocker | BlockerService.createBlocker() | pser:writer |
| Override blocker | BlockerService.resolveBlocker() | pser:operator |
| View execution history | ExecutionHistoryService.queryHistory() | pser:reader |

---

## 9. Integration Verification

Before declaring PSER workforce-ready:

- [ ] Agent can query `getActiveExecutionContext()` and receive valid JSON
- [ ] Agent can update `TaskService.updateTask()` with state change reflected immediately
- [ ] Agent can record execution events (started → checkpoint → completed)
- [ ] Agent can set and clear resume points
- [ ] Agent can raise and query blockers
- [ ] Gate evaluation returns correct pass/fail per known state
- [ ] Approval workflow submits to human operator
- [ ] Human operator can approve/deny/override
- [ ] Optimistic locking prevents concurrent write conflicts
- [ ] KV cache invalidation works on write
- [ ] R2 archival runs for records > 90 days
- [ ] All 5 agent types can execute their PSER role queries

---

*This integration pattern is authoritative for PSER workforce adoption.*
*All workforce agents must conform to this protocol.*
*Integration document — AI Platform Capability*
*Last updated: 2026-07-26*