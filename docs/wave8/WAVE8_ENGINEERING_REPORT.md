# Wave 8 — Engineering Report

**Company:** AGS | **Platform:** AI Platform | **Product:** Concierge Website
**Date:** 2026-08-03 | **Wave:** 8 — Workflow & Automation Engine
**Status:** DRAFT FOR REVIEW

---

## 1. Implementation Overview

### 1.1 Scope
Build a complete Workflow & Automation Engine for IVF patient journey orchestration, coordinator work queues, clinical protocol automation, and human-in-the-loop approval gates — all running natively on Cloudflare Workers with D1 persistence.

### 1.2 Module Structure (New Files)

```
workers/src/platform/workflow/
├── index.ts                      # Public exports
├── types.ts                      # Core type definitions
├── engine/
│   ├── workflow-engine.ts        # Main orchestration engine
│   ├── state-machine.ts          # Patient journey + task state machines
│   ├── transition-validator.ts   # Deterministic transition guards
│   └── context-manager.ts        # Workflow context/variables
├── rules/
│   ├── rule-engine.ts            # DMN/FEEL evaluator
│   ├── decision-table.ts         # Decision table parser/executor
│   ├── feel-evaluator.ts         # FEEL expression language subset
│   └── rule-loader.ts            # DMN XML → internal format
├── tasks/
│   ├── task-orchestrator.ts      # Task lifecycle management
│   ├── task-generator.ts         # Task creation from templates
│   ├── assignment-engine.ts      # Coordinator/clinician assignment
│   ├── queue-manager.ts          # Work queue operations
│   └── batch-operations.ts       # Multi-task operations
├── approval/
│   ├── approval-gate.ts          # Approval gate logic
│   ├── evidence-pack.ts          # Evidence pack builder
│   └── decision-processor.ts     # Approve/deny/escalate handling
├── timers/
│   ├── timer-service.ts          # Delayed actions, SLA timers
│   ├── escalation-timer.ts       # SLA-based escalation
│   └── cron-scheduler.ts         # Scheduled workflow actions
├── events/
│   ├── event-store.ts            # Event sourcing (write)
│   ├── event-reader.ts           # Event queries (read/CQRS)
│   └── projection-engine.ts      # Read model projections
├── persistence/
│   ├── d1-workflow-store.ts      # D1 implementation
│   ├── migrations/
│   │   └── 0001_workflow_schema.sql
│   └── repository.ts             # Repository pattern
├── analytics/
│   ├── metrics-collector.ts      # Operational metrics
│   ├── dashboard-queries.ts      # Dashboard data queries
│   └── rollup-jobs.ts            # Daily/weekly aggregations
└── integration/
    ├── notification-bridge.ts    # Wave 7 notification integration
    ├── appointment-bridge.ts     # Appointment platform integration
    ├── messaging-bridge.ts       # Messaging platform integration
    └── audit-bridge.ts           # Audit platform integration
```

### 1.3 Route Extensions (wave7.ts → wave8.ts)

```typescript
// New routes under /api/v1/workflows
POST   /definitions
GET    /definitions
GET    /definitions/:id
PUT    /definitions/:id

POST   /instances
GET    /instances
GET    /instances/:id
GET    /instances/:id/history
POST   /instances/:id/pause
POST   /instances/:id/resume
POST   /instances/:id/cancel

GET    /instances/:id/tasks
POST   /tasks/:id/claim
POST   /tasks/:id/complete
POST   /tasks/:id/reassign
POST   /tasks/:id/escalate

POST   /approval-gates/:id/decide
GET    /approval-gates/:id

GET    /dashboard/queue
GET    /dashboard/metrics
GET    /dashboard/patient/:id
GET    /search/workflows
GET    /search/tasks
GET    /search/events
```

---

## 2. Core Module Specifications

### 2.1 workflow-engine.ts

**Responsibilities:**
- Workflow instance lifecycle (start, pause, resume, cancel, complete)
- State machine delegation
- Event emission
- Cross-module coordination

**Key Functions:**
```typescript
class WorkflowEngine {
  async start(definitionId: string, patientId: string, initialContext: Context): Promise<WorkflowInstance>
  async getInstance(id: string): Promise<WorkflowInstance>
  async pause(id: string, reason: string, actor: Actor): Promise<void>
  async resume(id: string, actor: Actor): Promise<void>
  async cancel(id: string, reason: string, actor: Actor): Promise<void>
  async evaluateTransitions(instance: WorkflowInstance): Promise<Transition[]>
  async processTaskCompletion(taskId: string, output: TaskOutput): Promise<void>
}
```

### 2.2 state-machine.ts

**Patient Journey States (Hierarchical):**
```typescript
type JourneyState = 
  | 'pre_treatment.consultation'
  | 'pre_treatment.testing'
  | 'pre_treatment.authorization'
  | 'stimulation.monitoring'
  | 'stimulation.trigger'
  | 'retrieval'
  | 'laboratory.fertilization'
  | 'laboratory.culture'
  | 'laboratory.pgt'
  | 'transfer.preparation'
  | 'transfer.transfer_day'
  | 'transfer.luteal_support'
  | 'pregnancy_test'
  | 'follow_up.early_pregnancy'
  | 'follow_up.graduation'
  | 'completed'
  | 'cancelled'
```

**Task States (FHIR-aligned):**
```typescript
type TaskState = 
  | 'draft' 
  | 'requested' 
  | 'received' 
  | 'accepted' 
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled'
```

**Transition Validation:**
- Explicit allowed transitions (no wildcards)
- Guard conditions (rules, approvals, completions)
- Atomic state + event persistence

### 2.3 rule-engine.ts (DMN/FEEL)

**FEEL Subset Supported:**
- Arithmetic: `+ - * / ^ %`
- Comparisons: `= != < > <= >=`
- Logic: `and or not`
- Lists: `list contains item`, `count(list)`, `sum(list)`, `min(list)`, `max(list)`
- Conditionals: `if condition then result else result`
- Context access: `context.variable`

**Decision Table Execution:**
```typescript
interface DecisionTable {
  id: string
  hitPolicy: 'UNIQUE' | 'FIRST' | 'PRIORITY' | 'COLLECT'
  inputs: InputClause[]
  outputs: OutputClause[]
  rules: DecisionRule[]
}

interface DecisionRule {
  id: string
  inputEntries: (string | FEELExpression)[]
  outputEntries: (string | FEELExpression)[]
  priority?: number
  description?: string
}
```

**Evaluation Algorithm:**
1. Parse DMN XML → DecisionTable[]
2. For each table, evaluate rules in order (per hit policy)
3. FEEL expressions evaluated against input context
4. Return output values + matched rule metadata

### 2.4 task-orchestrator.ts

**Task Lifecycle:**
```
CREATE → [claim] → IN_PROGRESS → [complete] → COMPLETED
              ↓
         [reassign] → IN_PROGRESS
              ↓
         [escalate] → ESCALATED → [reassign] → IN_PROGRESS
              ↓
         [fail] → FAILED
```

**Priority Queue Implementation:**
- D1 index on `(priority, sla_deadline, created_at)`
- Priority order: critical > urgent > high > routine
- Within priority: earliest SLA first (FIFO for ties)

### 2.5 assignment-engine.ts

**Assignment Algorithm:**
```typescript
async function assignTask(task: TaskInstance): Promise<string | null> {
  // 1. Filter by role
  const candidates = await getUsersByRole(task.assignee_role)
  
  // 2. Filter by specialty
  const specialists = candidates.filter(u => matchesSpecialty(u, task))
  
  // 3. Filter by availability
  const available = specialists.filter(u => isAvailable(u))
  
  // 4. Sticky assignment (continuity)
  const sticky = available.find(u => hasPatientHistory(u, task.patientId))
  if (sticky) return sticky.id
  
  // 5. Workload balance (least open tasks)
  return available.reduce((min, u) => 
    getOpenTaskCount(u) < getOpenTaskCount(min) ? u : min
  )?.id ?? null
}
```

### 2.6 approval-gate.ts

**Approval Flow:**
```
PENDING → [approve] → APPROVED → [commit] → EXECUTED
    ↓
[deny] → DENIED → [workflow handles]
    ↓
[escalate] → ESCALATED → [backup approver] → APPROVED/DENIED
```

**Evidence Pack Structure:**
```typescript
interface EvidencePack {
  task: TaskSummary
  clinicalContext: ClinicalData
  ruleEvaluation: RuleResult
  patientPreferences: Preferences
  riskAssessment: RiskLevel
  alternatives: Alternative[]
  requiredApprovers: number
  deadline: Timestamp
}
```

### 2.7 timer-service.ts

**Timer Types:**
| Timer | Trigger | Action |
|-------|---------|--------|
| SLA Warning | 50% elapsed | Notify assignee + lead |
| SLA Breach | 100% elapsed | Escalate + notify |
| Approval Timeout | 75% elapsed | Escalate to backup |
| Delayed Action | Scheduled time | Execute action (transition, task creation) |
| Recurring | Cron pattern | Monitoring reminders, beta scheduling |

**Implementation:**
- Cloudflare Cron Triggers → Queue "timer-evaluation"
- Consumer evaluates due timers, executes actions
- Durable Object for timer coordination (prevent duplicates)

### 2.8 event-store.ts (Event Sourcing)

**Event Schema:**
```typescript
interface WorkflowEvent {
  id: string                    // UUID v7 (time-ordered)
  workflowInstanceId: string
  eventType: EventType
  payload: Record<string, unknown>
  actor: Actor
  correlationId: string
  causationId: string
  timestamp: number             // Unix ms
  version: number               // Schema version
}
```

**Projections (CQRS Read Models):**
- `WorkflowInstanceView` — Current state + context
- `TaskQueueView` — Coordinator queue (filtered, sorted)
- `PatientJourneyView` — Timeline for patient portal
- `MetricsView` — Aggregated operational metrics
- `AuditView` — Compliance audit trail

---

## 3. Database Schema (D1)

### 3.1 Migration: `0001_workflow_schema.sql`

```sql
-- Workflow Definitions
CREATE TABLE workflow_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  definition_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Workflow Instances
CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY,
  definition_id TEXT NOT NULL REFERENCES workflow_definitions(id),
  patient_id TEXT NOT NULL,
  current_state TEXT NOT NULL,
  context_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER,
  paused_at INTEGER,
  pause_reason TEXT
);

CREATE INDEX idx_wf_instances_patient ON workflow_instances(patient_id);
CREATE INDEX idx_wf_instances_status ON workflow_instances(status);
CREATE INDEX idx_wf_instances_definition ON workflow_instances(definition_id);

-- Task Instances
CREATE TABLE task_instances (
  id TEXT PRIMARY KEY,
  workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  task_definition_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  assignee_role TEXT,
  assignee_id TEXT,
  priority TEXT NOT NULL DEFAULT 'routine',
  status TEXT NOT NULL DEFAULT 'pending',
  sla_deadline INTEGER,
  input_json TEXT,
  output_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  claimed_at INTEGER,
  completed_at INTEGER,
  escalated_at INTEGER,
  escalation_reason TEXT
);

CREATE INDEX idx_tasks_workflow ON task_instances(workflow_instance_id);
CREATE INDEX idx_tasks_assignee_status ON task_instances(assignee_id, status);
CREATE INDEX idx_tasks_sla ON task_instances(sla_deadline, status);
CREATE INDEX idx_tasks_priority_sla ON task_instances(priority, sla_deadline);

-- Approval Gates
CREATE TABLE approval_gates (
  id TEXT PRIMARY KEY,
  task_instance_id TEXT NOT NULL REFERENCES task_instances(id),
  required_approvers INTEGER NOT NULL DEFAULT 1,
  approval_rule TEXT,
  evidence_pack_json TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  decided_at INTEGER,
  decided_by TEXT,
  decision_reason TEXT
);

-- Approval Decisions
CREATE TABLE approval_decisions (
  id TEXT PRIMARY KEY,
  approval_gate_id TEXT NOT NULL REFERENCES approval_gates(id),
  approver_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  reason TEXT,
  evidence_reviewed_json TEXT,
  created_at INTEGER NOT NULL
);

-- Workflow Events (Event Store)
CREATE TABLE workflow_events (
  id TEXT PRIMARY KEY,
  workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  event_type TEXT NOT NULL,
  event_json TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  correlation_id TEXT,
  causation_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_events_instance_time ON workflow_events(workflow_instance_id, created_at);
CREATE INDEX idx_events_correlation ON workflow_events(correlation_id);
CREATE INDEX idx_events_type ON workflow_events(event_type);

-- Dead Letter Queue
CREATE TABLE workflow_dlq (
  id TEXT PRIMARY KEY,
  original_task_id TEXT NOT NULL,
  error TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt INTEGER NOT NULL,
  payload_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- Timer Registry
CREATE TABLE workflow_timers (
  id TEXT PRIMARY KEY,
  workflow_instance_id TEXT REFERENCES workflow_instances(id),
  task_instance_id TEXT REFERENCES task_instances(id),
  timer_type TEXT NOT NULL,
  fire_at INTEGER NOT NULL,
  action_json TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  created_at INTEGER NOT NULL,
  fired_at INTEGER
);

CREATE INDEX idx_timers_fire_at ON workflow_timers(fire_at, status);
```

---

## 4. Integration Specifications

### 4.1 Wave 7 Notification Bridge

```typescript
// events → notifications
interface NotificationBridge {
  onTaskCreated(task: TaskInstance): Promise<void>
  onTaskAssigned(task: TaskInstance, assignee: User): Promise<void>
  onSLABreach(task: TaskInstance): Promise<void>
  onApprovalRequested(gate: ApprovalGate): Promise<void>
  onWorkflowStateChange(instance: WorkflowInstance, from: State, to: State): Promise<void>
}
```

**Notification Templates:**
- Task assigned → Push + In-app
- SLA breach → Push + Email + In-app (critical)
- Approval needed → Push + In-app
- Patient milestone → In-app + Email (patient preference)

### 4.2 Appointment Bridge

```typescript
interface AppointmentBridge {
  scheduleMonitoring(patientId: string, protocol: Protocol): Promise<Appointment[]>
  scheduleRetrieval(patientId: string, triggerTime: Date): Promise<Appointment>
  scheduleTransfer(patientId: string, transferDay: Date): Promise<Appointment>
  scheduleBeta(patientId: string, transferDate: Date): Promise<Appointment>
  getUpcoming(patientId: string): Promise<Appointment[]>
}
```

### 4.3 Messaging Bridge

```typescript
interface MessagingBridge {
  createTaskThread(taskId: string): Promise<ThreadId>
  postTaskComment(taskId: string, author: User, content: string): Promise<Message>
  linkPatientMessage(messageId: string, taskId: string): Promise<void>
}
```

### 4.4 Audit Bridge

```typescript
interface AuditBridge {
  logWorkflowEvent(event: WorkflowEvent): Promise<void>
  logAccess(userId: string, resource: string, action: string): Promise<void>
  logConsentCheck(patientId: string, operation: string, granted: boolean): Promise<void>
}
```

---

## 5. Background Workers (Cloudflare Queues)

### 5.1 Queue Definitions

| Queue | Consumer | Batch Size | Retry | DLQ |
|-------|----------|------------|-------|-----|
| `task-execution` | Automated task runner | 10 | 3x exp | ✅ |
| `sla-evaluation` | SLA checker | 50 | 2x | ✅ |
| `timer-evaluation` | Timer fire | 20 | 3x | ✅ |
| `escalation-processing` | Escalation handler | 10 | 3x | ✅ |
| `metrics-rollup` | Daily aggregator | 1 | 1x | ✅ |
| `notification-dispatch` | Wave 7 bridge | 20 | 5x | ✅ |
| `audit-logging` | Audit bridge | 50 | 2x | ✅ |

### 5.2 Cron Triggers

```toml
# wrangler.jsonc
[triggers]
crons = [
  "0 * * * *",      # Hourly: SLA evaluation, timer fire
  "0 6 * * *",      # Daily 6am: Metrics rollup, queue refresh
  "0 2 * * 0",      # Weekly Sun 2am: Quality metrics, override review
  "0 3 1 * *"       # Monthly 1st 3am: Storage expiry, disposition
]
```

---

## 6. TypeScript Types (env.ts Extensions)

```typescript
// workers/src/types/env.ts additions
interface Env {
  // ... existing
  WORKFLOW_DB: D1Database
  WORKFLOW_QUEUE_TASK_EXECUTION: Queue
  WORKFLOW_QUEUE_SLA_EVALUATION: Queue
  WORKFLOW_QUEUE_TIMER_EVALUATION: Queue
  WORKFLOW_QUEUE_ESCALATION: Queue
  WORKFLOW_QUEUE_METRICS: Queue
  WORKFLOW_QUEUE_NOTIFICATIONS: Queue
  WORKFLOW_QUEUE_AUDIT: Queue
  WORKFLOW_DO: DurableObjectNamespace
}

interface WorkflowDefinition {
  id: string
  name: string
  version: string
  definition: WorkflowDefinitionJSON
  status: 'active' | 'deprecated' | 'archived'
}

interface WorkflowInstance {
  id: string
  definitionId: string
  patientId: string
  currentState: JourneyState
  context: WorkflowContext
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
}

interface TaskInstance {
  id: string
  workflowInstanceId: string
  taskDefinitionId: string
  name: string
  type: 'manual' | 'automated' | 'approval' | 'timer'
  assigneeRole: string
  assigneeId?: string
  priority: 'critical' | 'urgent' | 'high' | 'routine'
  status: TaskState
  slaDeadline?: number
  input?: Record<string, unknown>
  output?: Record<string, unknown>
}

type JourneyState = 
  | 'pre_treatment.consultation'
  | 'pre_treatment.testing'
  | 'pre_treatment.authorization'
  | 'stimulation.monitoring'
  | 'stimulation.trigger'
  | 'retrieval'
  | 'laboratory.fertilization'
  | 'laboratory.culture'
  | 'laboratory.pgt'
  | 'transfer.preparation'
  | 'transfer.transfer_day'
  | 'transfer.luteal_support'
  | 'pregnancy_test'
  | 'follow_up.early_pregnancy'
  | 'follow_up.graduation'
  | 'completed'
  | 'cancelled'

type TaskState = 
  | 'draft' | 'requested' | 'received' | 'accepted' 
  | 'in_progress' | 'completed' | 'failed' | 'cancelled' | 'escalated'
```

---

## 7. Frontend Implementation Plan

### 7.1 New Pages (Patient Workspace)
```
artifacts/ags-fertility/src/pages/patient/
├── JourneyPage.tsx              # Timeline + progress
├── JourneyDetailPage.tsx        # Stage detail + tasks
├── TaskDetailPage.tsx           # Task view (patient-facing)
└── WorkflowNotifications.tsx    # Notification preferences
```

### 7.2 New Pages (Clinical Workspace)
```
artifacts/ags-fertility/src/pages/clinical/
├── ClinicalDashboard.tsx        # Main dashboard
├── QueuePage.tsx                # Work queue with filters
├── TaskDetailPage.tsx           # Task detail + actions
├── ApprovalPage.tsx             # Approval gate interface
├── WorkflowListPage.tsx         # Active workflows
├── WorkflowDetailPage.tsx       # Workflow instance view
├── WorkflowDiagramPage.tsx      # Visual diagram
├── DefinitionsPage.tsx          # Admin: workflow definitions
├── DefinitionBuilderPage.tsx    # Admin: visual builder
├── AnalyticsPage.tsx            # Operational/clinical/quality
├── RulesPage.tsx                # Admin: DMN rule editor
└── SettingsPage.tsx             # Admin: users, templates
```

### 7.3 New Components
```
artifacts/ags-fertility/src/components/workflow/
├── TaskCard.tsx
├── PriorityBadge.tsx
├── SLAIndicator.tsx
├── RuleRecommendation.tsx
├── JourneyTimeline.tsx
├── WorkflowDiagram.tsx
├── ApprovalGate.tsx
├── QueueFilters.tsx
├── BatchActions.tsx
├── WorkflowStateBadge.tsx
├── EvidencePackViewer.tsx
└── OverrideDialog.tsx
```

### 7.4 API Client Extensions
```
artifacts/ags-fertility/src/lib/
├── workflow-api.ts              # Workflow engine API client
├── clinical-api.ts              # Clinical workspace API client
```

---

## 8. Testing Strategy

### 8.1 Unit Tests (Vitest)

| Module | Test Focus | Target Coverage |
|--------|------------|-----------------|
| `state-machine.ts` | Transition validation, guards | 100% |
| `rule-engine.ts` | DMN parsing, FEEL evaluation, hit policies | 95% |
| `task-orchestrator.ts` | Lifecycle, priority queue, assignment | 90% |
| `approval-gate.ts` | Evidence pack, decision flow, timeouts | 95% |
| `timer-service.ts` | Timer scheduling, firing, recurrence | 90% |
| `event-store.ts` | Event append, projections, queries | 95% |
| `assignment-engine.ts` | Specialty, workload, continuity | 85% |

### 8.2 Integration Tests

| Scenario | Description |
|----------|-------------|
| Full IVF Cycle | Start → complete all phases → graduation |
| SLA Escalation | Task created → SLA breach → escalation → resolution |
| Approval Flow | Task → approval gate → approve → commit |
| Pause/Resume | Workflow paused → timers suspended → resumed |
| Override | Rule recommendation → physician override → audit |
| Multi-task Batch | Coordinator claims 5 tasks → completes all |
| Rule Versioning | Definition v1 → v2 → running instances unaffected |

### 8.3 E2E Tests (Playwright)

- Coordinator dashboard workflow
- Physician approval workflow
- Patient journey view
- Mobile responsive behavior
- Accessibility audit (axe-core)

---

## 9. Deployment Checklist

### 9.1 Pre-Deploy
- [ ] D1 migration applied to all environments
- [ ] wrangler.jsonc updated with queues, D1 binding, DO namespace
- [ ] env.ts types updated
- [ ] Wave 7 notification bridge tested
- [ ] Appointment/messaging/audit bridges tested
- [ ] All unit tests passing
- [ ] Integration tests passing
- [ ] TypeScript strict mode clean

### 9.2 Deploy Steps
1. `wrangler deploy` (workers) — preview environment
2. Verify health endpoints
3. Run smoke tests against preview
4. Deploy frontend to Cloudflare Pages (preview)
5. UAT with clinical team
6. `wrangler deploy --env production` (workers)
7. Deploy frontend to production

### 9.3 Post-Deploy Verification
- [ ] Workflow start → completion smoke test
- [ ] SLA timer fires correctly
- [ ] Notifications delivered via Wave 7
- [ ] Dashboard metrics populate
- [ ] Audit events recorded
- [ ] Mobile PWA installs and works offline (shell)

---

## 10. Rollback Plan

| Failure Mode | Rollback Action |
|--------------|-----------------|
| D1 migration fails | `wrangler d1 execute --command="DROP TABLE ..."` (reverse migration) |
| Queue consumers crash | Pause queues, revert worker code, resume |
| TypeScript errors | Revert to previous commit, redeploy |
| Performance regression | Feature flag off workflow routes, investigate |
| Data corruption | Point-in-time D1 restore (if enabled), replay events |

---

## 11. Monitoring & Alerting (Wave 7 Integration)

### 11.1 Key Metrics to Alert
| Metric | Warning | Critical |
|--------|---------|----------|
| Queue lag (task-execution) | > 100 | > 500 |
| SLA breach rate (24h) | > 5% | > 10% |
| Workflow failure rate | > 1% | > 5% |
| Approval timeout rate | > 10% | > 25% |
| D1 write latency p99 | > 500ms | > 1s |
| DLQ depth | > 10 | > 50 |

### 11.2 Dashboards (Wave 7 Analytics)
- Operational: Queue depth, throughput, latency
- Clinical: Cycle funnel, protocol distribution, outcomes
- Quality: Override rate, rule deviation, approval turnaround

---

## 12. Effort Estimation

| Phase | Modules | Estimated Days |
|-------|---------|----------------|
| Core Engine (engine/, state-machine, persistence) | 5 | 5 |
| Rule Engine (rules/) | 4 | 4 |
| Tasks & Assignment (tasks/, approval/) | 6 | 5 |
| Timers & Events (timers/, events/) | 4 | 3 |
| Background Workers (queues, cron) | 7 queues | 3 |
| Integrations (bridges) | 4 | 2 |
| API Routes | 20 endpoints | 3 |
| Frontend Pages | 15 pages | 5 |
| Components | 12 components | 3 |
| Tests | Unit + Integration + E2E | 4 |
| Documentation | 5 docs | 1 |
| **Total** | | **38 days** |

---

## 13. Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| FEEL evaluator gaps | Medium | High | Scope to clinical rule subset; extensive test cases |
| D1 contention on hot instances | Low | High | Durable Object per instance; batch event writes |
| Queue consumer scaling | Low | Medium | Workers auto-scales; monitor queue lag metrics |
| Schema evolution | Medium | Medium | Versioned definitions; migration scripts per version |
| Offline sync complexity | High | High | Defer full offline to Wave 9; online-only Wave 8 |
| Clinical rule validation | Medium | High | Clinical review of all DMN tables before deploy |

---

*End of Engineering Report. Ready for implementation phase upon approval.*