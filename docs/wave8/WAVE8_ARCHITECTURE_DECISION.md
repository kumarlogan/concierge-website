# Wave 8 — Architecture Decision

**Company:** AGS | **Platform:** AI Platform | **Product:** Concierge Website
**Date:** 2026-08-03 | **Wave:** 8 — Workflow & Automation Engine
**Status:** APPROVED FOR IMPLEMENTATION

---

## 1. Decision Context

**Problem:** AGS Fertility Concierge needs a Workflow & Automation Engine to orchestrate IVF patient journeys, coordinator work queues, clinical protocols, and automation rules — all within Cloudflare Workers, deterministic, auditable, and FHIR-aligned.

**Constraints:**
- Hermes Platform frozen — no Foundation modifications
- Cloudflare Workers runtime (D1, KV, R2, Queues, Durable Objects, Cron)
- Must integrate with existing Wave 7 Notification & Engagement Platform
- Canadian regulatory compliance (PIPEDA, PHIPA, CFAS, provincial)
- Healthcare-grade audit trail and SLA management

---

## 2. Architecture Decision

### 2.1 Core Architecture: Custom Deterministic Workflow Engine

**Decision:** Build a custom workflow engine (not Camunda, Temporal, or Flowable)

**Rationale:**
| Factor | Camunda/Temporal/Flowable | Custom Engine |
|--------|---------------------------|---------------|
| Cloudflare Workers native | ❌ Requires external service | ✅ Native D1/Queues/DO |
| Bundle size | ❌ Heavy (Java/JVM) | ✅ TypeScript, tree-shaken |
| Deterministic execution | ✅ | ✅ (designed for it) |
| FHIR alignment | ⚠️ Adapters needed | ✅ Native FHIR resources |
| Operational complexity | ❌ Cluster management | ✅ Serverless, zero-ops |
| Cost | ❌ Infrastructure + license | ✅ Workers pricing only |
| Healthcare audit trail | ✅ | ✅ (event-sourced) |

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│                    WORKFLOW ENGINE CORE                      │
├─────────────────────────────────────────────────────────────┤
│  WorkflowEngine (orchestration)                              │
│  ├── StateMachine (patient journey + task + approval)       │
│  ├── RuleEngine (DMN/FEEL for clinical protocols)           │
│  ├── TaskOrchestrator (queue-based, priority, SLA)          │
│  ├── ApprovalGate (draft-approve-commit, evidence packs)    │
│  ├── TimerService (delayed actions, escalation timers)      │
│  └── EventStore (event sourcing, audit trail, CQRS)         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │   D1     │   │  Queues  │   │Durable   │
        │(persist) │   │(async)   │   │ Objects  │
        └──────────┘   └──────────┘   └──────────┘
```

---

### 2.2 Data Model (D1 Schema)

**Core Tables:**

```sql
-- Workflow Definitions (templates)
CREATE TABLE workflow_definitions (
  id TEXT PRIMARY KEY,                    -- e.g., "ivf-standard-v1"
  name TEXT NOT NULL,
  version TEXT NOT NULL,
  definition_json TEXT NOT NULL,          -- BPMN-like JSON + DMN rules
  status TEXT NOT NULL DEFAULT 'active',  -- active, deprecated, archived
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Workflow Instances (patient journeys)
CREATE TABLE workflow_instances (
  id TEXT PRIMARY KEY,                    -- UUID
  definition_id TEXT NOT NULL REFERENCES workflow_definitions(id),
  patient_id TEXT NOT NULL,               -- opaque reference
  current_state TEXT NOT NULL,            -- e.g., "stimulation.monitoring"
  context_json TEXT NOT NULL,             -- variables, clinical data refs
  status TEXT NOT NULL DEFAULT 'running', -- running, paused, completed, failed, cancelled
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Task Instances (work items for coordinators)
CREATE TABLE task_instances (
  id TEXT PRIMARY KEY,
  workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  task_definition_id TEXT NOT NULL,       -- references template
  name TEXT NOT NULL,
  type TEXT NOT NULL,                     -- manual, automated, approval, timer
  assignee_role TEXT,                     -- coordinator, nurse, physician, system
  assignee_id TEXT,                       -- specific user when assigned
  priority TEXT NOT NULL DEFAULT 'routine', -- critical, urgent, high, routine
  status TEXT NOT NULL DEFAULT 'pending', -- pending, claimed, in_progress, completed, failed, escalated
  sla_deadline INTEGER,                   -- unix ms
  input_json TEXT,                        -- task input data
  output_json TEXT,                       -- task output/result
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  claimed_at INTEGER,
  completed_at INTEGER
);

-- Approval Gates (human-in-the-loop)
CREATE TABLE approval_gates (
  id TEXT PRIMARY KEY,
  task_instance_id TEXT NOT NULL REFERENCES task_instances(id),
  required_approvers INTEGER NOT NULL DEFAULT 1,
  approval_rule TEXT,                     -- FEEL expression for dynamic approvers
  evidence_pack_json TEXT,                -- structured evidence for reviewer
  status TEXT NOT NULL DEFAULT 'pending', -- pending, approved, denied, escalated
  decided_at INTEGER,
  decided_by TEXT,
  decision_reason TEXT
);

-- Approval Decisions (audit trail)
CREATE TABLE approval_decisions (
  id TEXT PRIMARY KEY,
  approval_gate_id TEXT NOT NULL REFERENCES approval_gates(id),
  approver_id TEXT NOT NULL,
  decision TEXT NOT NULL,                 -- approve, deny, escalate
  reason TEXT,
  evidence_reviewed_json TEXT,
  created_at INTEGER NOT NULL
);

-- Workflow Events (event sourcing)
CREATE TABLE workflow_events (
  id TEXT PRIMARY KEY,                    -- UUID
  workflow_instance_id TEXT NOT NULL REFERENCES workflow_instances(id),
  event_type TEXT NOT NULL,               -- state_transition, task_created, task_completed, approval_decided, timer_fired, rule_evaluated, error
  event_json TEXT NOT NULL,               -- full event payload
  actor_type TEXT NOT NULL,               -- system, user, external
  actor_id TEXT,
  correlation_id TEXT,                    -- for tracing across services
  causation_id TEXT,                      -- event that caused this event
  created_at INTEGER NOT NULL
);

-- Indexes
CREATE INDEX idx_workflow_instances_patient ON workflow_instances(patient_id);
CREATE INDEX idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX idx_task_instances_workflow ON task_instances(workflow_instance_id);
CREATE INDEX idx_task_instances_assignee ON task_instances(assignee_id, status);
CREATE INDEX idx_task_instances_sla ON task_instances(sla_deadline, status);
CREATE INDEX idx_workflow_events_instance ON workflow_events(workflow_instance_id, created_at);
```

---

### 2.3 State Machine Design

**Patient Journey States (Hierarchical):**
```
ivf_journey
├── pre_treatment
│   ├── consultation
│   ├── testing
│   └── authorization
├── stimulation
│   ├── monitoring
│   └── trigger
├── retrieval
├── laboratory
│   ├── fertilization
│   ├── culture
│   └── pgt
├── transfer
│   ├── preparation
│   ├── transfer_day
│   └── luteal_support
├── pregnancy_test
└── follow_up
    ├── early_pregnancy
    └── graduation
```

**Task States (FHIR Task-aligned):**
```
draft → requested → received → accepted → in_progress → completed
                                    ↓
                              failed/cancelled
```

**Approval Gate States:**
```
pending → approved/denied/escalated
```

---

### 2.4 Rule Engine: DMN/FEEL Implementation

**Decision:** Embed a lightweight FEEL evaluator for DMN decision tables

**Why not Drools?** JVM-only, heavy, overkill for Workers

**Implementation Approach:**
- Parse DMN XML → Decision Tables in memory
- FEEL expression evaluation (subset: arithmetic, comparisons, logic, list operations)
- Hit policies: UNIQUE, FIRST, PRIORITY, COLLECT (sum, min, max, count)
- Rules versioned with workflow definitions

**Clinical Protocol Rules (Examples):**
```dmn
# Stimulation Protocol Selection
Input: age, amh, afc, bmi, prior_response
Output: protocol_type, starting_dose, monitoring_frequency

# Trigger Timing
Input: lead_follicle_mm, estradiol_pgml, cohort_count
Output: trigger_type, trigger_timing_hours

# Transfer Strategy
Input: patient_age, embryo_quality, pgt_status, prior_failures
Output: transfer_day, embryo_count, fresh_vs_frozen
```

---

### 2.5 Integration Points

| Integration | Pattern | Wave 8 Scope |
|-------------|---------|--------------|
| **Wave 7 Notifications** | Event-driven (Queue) | Task created → notification; SLA breach → escalation notification |
| **Identity/Consent** | Sync call (D1) | Task claim → consent check; Approval → identity verification |
| **Appointments** | Sync call (D1) | Scheduling tasks → appointment engine; Calendar sync |
| **Messaging** | Event-driven | Task comments → message thread; Patient messages → task updates |
| **Documents** | Sync call | Task completion → document generation; Consent forms |
| **Audit Platform** | Event sink | All workflow_events → audit log |

---

### 2.6 Background Processing Architecture

**Cloudflare Workers Native:**
```
Cron (daily) → Queue: "sla-evaluation" → Consumer Worker
    │
    ├── SLA check: UPDATE tasks SET status='escalated' WHERE sla_deadline < now()
    ├── Escalation: Create escalation tasks, notify via Wave 7
    └── Metrics: Aggregate daily workflow metrics

Cron (hourly) → Queue: "timer-evaluation" → Consumer Worker
    │
    ├── Timer fire: Process delayed actions, timeout approvals
    └── Stalled detection: Workflows/tasks stuck > threshold

Queue: "task-execution" → Consumer Worker (per task type)
    │
    ├── Automated tasks: Execute rule, call API, update state
    ├── Manual tasks: Notify assignee, start SLA timer
    └── Approval tasks: Create approval gate, notify approvers
```

**Durable Objects For:**
- Workflow instance locking (single-threaded state mutations)
- WebSocket connections for real-time dashboard updates
- Coordinator work queue coordination

---

### 2.7 API Design (FHIR-Aligned)

**Endpoints (under `/api/v1/workflows`):**
```
POST   /definitions                    # Create workflow definition
GET    /definitions                    # List definitions
GET    /definitions/:id                # Get definition
PUT    /definitions/:id                # Update definition (new version)

POST   /instances                      # Start workflow instance
GET    /instances                      # List instances (filters: patient, status, date)
GET    /instances/:id                  # Get instance + current state
GET    /instances/:id/history          # Event history (audit trail)
POST   /instances/:id/pause            # Pause workflow
POST   /instances/:id/resume           # Resume workflow
POST   /instances/:id/cancel           # Cancel workflow

GET    /instances/:id/tasks            # List tasks for instance
POST   /tasks/:id/claim                # Claim task (coordinator)
POST   /tasks/:id/complete             # Complete task (with output)
POST   /tasks/:id/reassign             # Reassign task
POST   /tasks/:id/escalate             # Manual escalation

POST   /approval-gates/:id/decide      # Approve/deny/escalate
GET    /approval-gates/:id             # Get approval details + evidence pack

GET    /dashboard/queue                # Coordinator work queue (filtered)
GET    /dashboard/metrics              # Operational metrics
GET    /dashboard/patient/:id          # Patient journey view
```

---

### 2.8 Security & Compliance

| Requirement | Implementation |
|-------------|----------------|
| **PHI Isolation** | Opaque patient references; no PHI in workflow_events |
| **Consent Enforcement** | Consent check on every task claim/complete/approval |
| **Audit Trail** | Immutable workflow_events table; tamper-evident |
| **Access Control** | Role-based: coordinator, nurse, physician, admin, patient |
| **Data Retention** | Configurable per event type; default 7 years clinical |
| **Encryption** | D1 encryption at rest; TLS in transit |
| **Canadian Compliance** | PIPEDA/PHIPA audit fields; provincial consent rules in DMN |

---

### 2.9 Observability

**Metrics (via Wave 7 Analytics + custom):**
- Workflow throughput (started/completed/failed per day)
- Task SLA compliance rate
- Average task duration by type
- Coordinator workload distribution
- Escalation rate and resolution time
- Approval turnaround time

**Logging:**
- Structured JSON logs for all state transitions
- Correlation IDs for cross-service tracing
- Error events with full context

**Alerting (via Wave 7):**
- SLA breach rate > 5%
- Queue depth > threshold
- Workflow failure rate > 1%
- Stalled workflows > 1 hour

---

### 2.10 Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| D1 write contention on hot workflows | Medium | High | Durable Object per instance; batch events |
| FEEL evaluator incompleteness | Low | Medium | Subset sufficient for clinical rules; test heavily |
| Queue consumer scaling | Low | Medium | Workers auto-scales; monitor queue lag |
| Schema evolution | Medium | Medium | Versioned definitions; migration scripts |
| Offline sync complexity | Medium | High | Defer to Wave 9; online-only for Wave 8 |

---

## 3. Approval

**Architecture Review:** ✅ PASSED — All 12 WEF dimensions verified
**Security Review:** ✅ PASSED — Zero Trust, consent enforcement, audit trail
**Product Owner:** ☐ PENDING APPROVAL

---

*Proceeding to Workflow Blueprint upon Product Owner approval.*