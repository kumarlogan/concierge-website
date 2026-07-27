# PSER — Resume Strategy

> **AI Platform Capability — Session Resume Strategy**
> How PSER enables exact execution continuation between sessions.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Project State & Execution Registry
Document:       PSER Resume Strategy
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Resume Problem

Before PSER, resuming work between sessions required:

1. The human operator describing what was being worked on
2. The agent reading multiple markdown documents to reconstruct context
3. The agent manually identifying the next step from unstructured text
4. Potential for context loss — different interpretations of the same text

PSER solves this with **structured, deterministic resume points**.

---

## 2. Resume Point Model

Every task in the PSER hierarchy can have one active resume point:

```typescript
interface ResumePoint {
  id: string;
  entity_type: "phase" | "wave" | "epic" | "sprint" | "story" | "task";
  entity_id: string;
  next_action: string;              // e.g. "Implement Task 4: Rate Limiter"
  context: {
    completed_steps: string[];
    current_step: string;
    next_step: string;
    branch?: string;
    file_path?: string;
    test_file?: string;
    environment?: string;
    decision_id?: string;
    pending_decisions?: string[];
  };
  set_by: string;                   // principal:<id>
  set_at: string;                   // ISO 8601
  cleared_at?: string;
  cleared_by?: string;
}
```

### Resume Point Lifecycle

```
SET ──→ ACTIVE ──→ CLEARED
                     │
                     └──→ SET (new)  ← task advances
```

- Resume points are per-entity. One active resume point per task.
- Setting a new resume point on an entity clears the previous one.
- Clearing happens automatically when task.completion_pct = 100.
- Workforce agents SET their own resume points at checkpoints.
- Human operators can SET a resume point to redirect execution.

---

## 3. Resume Workflow

### 3.1 New Session — Agent Initialization

```
1. Agent authenticates to PSER (scoped auth token)
2. Agent calls: ProgressService.getActiveExecutionContext(productId)
   → Returns full ExecutionContext JSON

3. Agent calls: ResumeService.getCurrentResumePoint(productId)
   → Returns: { entity_type: "task", entity_id: "task-004",
                next_action: "Implement rate limiter middleware",
                context: { completed_steps: ["JWT Manager", "Key Rotation", "MFA Flow"],
                          current_step: "Rate Limiter", next_step: "Session Management" } }

4. Agent validates context:
   - Is the entity still in "in_progress" status?
   - Are dependencies satisfied?
   - Is the git branch still current?
   - Any new blockers since last session?

5. Agent begins execution from context.current_step
```

### 3.2 Mid-Session Checkpoint

```
1. Agent reaches a logical milestone (e.g., function complete)
2. Agent calls: ExecutionRegistry.recordExecution({
     entity_type: "task",
     entity_id: "task-004",
     event_type: "checkpoint",
     summary: "Rate limiter core logic complete — tests remaining",
     outcome: "partial"
   })
3. Agent calls: ResumeService.setResumePoint({
     entity_type: "task",
     entity_id: "task-004",
     next_action: "Write rate limiter unit tests",
     context: { completed_steps: [...previous + "Rate Limiter Core Logic"],
               current_step: "Rate Limiter Unit Tests",
               next_step: "Integration Tests" }
   })
```

### 3.3 Session Termination (Normal)

```
1. Agent completes current action
2. Agent updates task state and sets resume point to next action
3. Agent records final execution event
4. Session closes
5. Next session resumes from set resume point
```

### 3.4 Session Termination (Abrupt — Agent Crash)

```
1. Agent state lost — no resume point set
2. Next session: PSER returns LAST resume point (stale)
3. Agent detects: resume point context may be stale
4. Agent validates: Check entity status, git state, last execution event
5. If execution_history shows the last event was "started" (not "completed"):
   → Agent resumes from existing resume point
   → Agent validates file state matches context
6. If files/state inconsistent:
   → Agent raises human alert: "Resume point may be stale — manual review recommended"
```

---

## 4. Human Operator Resume Override

The human operator can force a resume point to redirect execution:

```
Operator: "Stop working on Task 4. Start on Task 5 instead."

Operator calls: ResumeService.setResumePoint({
  entity_type: "task",
  entity_id: "task-005",       // ← different task
  next_action: "Implement Session Manager",
  context: { ... }
})

Operator calls: TaskService.updateTask("task-004", { status: "deferred" })
Operator calls: TaskService.updateTask("task-005", { status: "in_progress" })

Next agent session:
  → PSER returns resume point for task-005
  → Agent begins work on Session Manager
```

---

## 5. Multi-Entity Resume

When a workforce agent works across multiple entities in a session, multiple resume points may be set:

```
Agent session:
  - Story 1: Task 4 (rate limiter) — checkpoint every 30min
  - Story 2: Task 2 (forms) — checkpoint on completion
  - Epic level: Checkpoint on achieving 50% completion

Each gets its own resume point, scoped to its entity_id.
Next session: ResumeService.getCurrentResumePoint(productId)
  returns the TOP-LEVEL resume point (closest to current task).
  Other points still in DB, queryable by entity_type+entity_id.
```

---

## 6. Resume Point Query

```
// Current resume point for a product (top-level only)
ResumeService.getCurrentResumePoint("prod-001")
→ { entity_type: "task", entity_id: "task-004", ... }

// Resume point for a specific entity
ResumeService.getResumePointForEntity("task", "task-004")
→ { entity_type: "task", entity_id: "task-004", ... }

// All resume points (for dashboard)
ResumeService.getResumeHistory("prod-001", 5)
→ [ResumePoint, ResumePoint, ...]
```

---

## 7. Resume Across Products

When a workforce agent switches products:

```
1. Agent queries: getActiveExecutionContext("prod-001")  // Concierge
2. Completes work on Concierge Task 4
3. Sets resume point on Concierge Task 5
4. Agent queries: getActiveExecutionContext("prod-002")  // Future Product
5. PSER returns: No active execution context (product not started)
6. Agent begins phase 1 setup for prod-002
```

Resume points are isolated by product_id. Switching products does not affect the other product's resume points.

---

## 8. Resume Point Cleanup

| Trigger | Action |
|---------|--------|
| Task status changes to "completed" | Resume point auto-cleared |
| Task status changes to "cancelled" | Resume point auto-cleared |
| Human operator clears resume point | Resume point cleared, audit logged |
| New resume point set on same entity | Previous point cleared, new one set |
| 90 days since last update | Resume point flagged as stale (operator notified) |
| Entity deleted | Cascade delete all associated resume points |

---

## 9. Resume Strategy for This Session

This session produced 11 PSER design artifacts. The resume point for the next session:

```
ResumePoint: {
  next_action: "PSER Implementation — Wave 1: D1 schema, service layer, interfaces",
  context: {
    completed_steps: [
      "PSER Architecture (PSER_ARCHITECTURE.md)",
      "PSER Interfaces (PSER_INTERFACES.md — 11 contracts)",
      "PSER Data Model (PSER_DATA_MODEL.md — 26 tables)",
      "PSER Execution State Model (PSER_EXECUTION_STATE.md)",
      "PSER Workforce Integration (PSER_WORKFORCE_INTEGRATION.md)",
      "Capability Registry — Registered #12",
      "AI Platform Roadmap — Updated Phase D",
      "ADR-016 — Architecture Decision Record",
      "Governance Index — PSER entries added"
    ],
    current_step: "Architecture Complete",
    next_step: "Implementation Wave 1 — D1 migrations, service layer, interfaces",
    branch: "N/A (architecture-only, no code changes)"
  }
}
```

---

*This resume strategy is authoritative for PSER session continuity.*
*All workforce agents must implement this resume protocol.*
*Resume document — AI Platform Capability*
*Last updated: 2026-07-26*