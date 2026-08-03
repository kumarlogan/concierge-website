-- Wave 8: Workflow & Automation Engine — D1 Migration
-- Migration: 0010_workflow_engine.sql
-- Target: agsynergy-db (D1)
-- Description: Creates tables for workflow engine, task management, approval gates, timers, event store, and analytics.

-- ── Workflow Instances ──
CREATE TABLE IF NOT EXISTS workflow_instances (
    id                          TEXT PRIMARY KEY,
    definition_id               TEXT NOT NULL,
    patient_id                  TEXT NOT NULL,
    current_state               TEXT NOT NULL DEFAULT 'pre_treatment.consultation',
    status                      TEXT NOT NULL DEFAULT 'running',
    context                     TEXT NOT NULL DEFAULT '{}',
    started_at                  INTEGER NOT NULL,
    completed_at                INTEGER,
    paused_at                   INTEGER,
    pause_reason                TEXT,
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_workflow_instances_patient ON workflow_instances(patient_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_state ON workflow_instances(current_state);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON workflow_instances(status);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_definition ON workflow_instances(definition_id);

-- ── Task Instances ──
CREATE TABLE IF NOT EXISTS task_instances (
    id                          TEXT PRIMARY KEY,
    workflow_instance_id        TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    task_definition_id          TEXT NOT NULL,
    name                        TEXT NOT NULL,
    type                        TEXT NOT NULL,
    priority                    TEXT NOT NULL DEFAULT 'routine',
    state                       TEXT NOT NULL DEFAULT 'draft',
    assignee_id                 TEXT,
    assignee_role               TEXT,
    claimed_by                  TEXT,
    claimed_at                  INTEGER,
    started_at                  INTEGER,
    completed_at                INTEGER,
    failed_at                   INTEGER,
    failure_reason              TEXT,
    escalation_level            INTEGER DEFAULT 0,
    sla_deadline                INTEGER,
    sla_breached                INTEGER DEFAULT 0,
    context                     TEXT NOT NULL DEFAULT '{}',
    outcome                     TEXT,
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_task_instances_workflow ON task_instances(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_state ON task_instances(state);
CREATE INDEX IF NOT EXISTS idx_task_instances_priority ON task_instances(priority);
CREATE INDEX IF NOT EXISTS idx_task_instances_assignee ON task_instances(assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_instances_sla ON task_instances(sla_deadline);
CREATE INDEX IF NOT EXISTS idx_task_instances_type ON task_instances(type);

-- ── Approval Gates ──
CREATE TABLE IF NOT EXISTS approval_gates (
    id                          TEXT PRIMARY KEY,
    workflow_instance_id        TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    task_instance_id            TEXT REFERENCES task_instances(id) ON DELETE CASCADE,
    gate_definition_id          TEXT NOT NULL,
    status                      TEXT NOT NULL DEFAULT 'pending',
    required_approvers          INTEGER NOT NULL DEFAULT 1,
    approved_by                 TEXT DEFAULT '[]',
    denied_by                   TEXT DEFAULT '[]',
    evidence_pack               TEXT DEFAULT '{}',
    decision                    TEXT,
    decision_reason             TEXT,
    decided_at                  INTEGER,
    decided_by                  TEXT,
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_approval_gates_workflow ON approval_gates(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_task ON approval_gates(task_instance_id);
CREATE INDEX IF NOT EXISTS idx_approval_gates_status ON approval_gates(status);

-- ── Workflow Timers ──
CREATE TABLE IF NOT EXISTS workflow_timers (
    id                          TEXT PRIMARY KEY,
    workflow_instance_id        TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    task_instance_id            TEXT REFERENCES task_instances(id) ON DELETE CASCADE,
    timer_type                  TEXT NOT NULL,
    fire_at                     INTEGER NOT NULL,
    action                      TEXT NOT NULL DEFAULT '{}',
    status                      TEXT NOT NULL DEFAULT 'scheduled',
    fired_at                    INTEGER,
    cancelled_at                INTEGER,
    created_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_timers_fire_at ON workflow_timers(fire_at);
CREATE INDEX IF NOT EXISTS idx_timers_status ON workflow_timers(status);
CREATE INDEX IF NOT EXISTS idx_timers_workflow ON workflow_timers(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_timers_task ON workflow_timers(task_instance_id);

-- ── Event Store (CQRS Write Path) ──
CREATE TABLE IF NOT EXISTS workflow_events (
    id                          TEXT PRIMARY KEY,
    workflow_instance_id        TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    task_instance_id            TEXT REFERENCES task_instances(id) ON DELETE CASCADE,
    event_type                  TEXT NOT NULL,
    event_json                  TEXT NOT NULL DEFAULT '{}',
    actor_type                  TEXT NOT NULL,
    actor_id                    TEXT NOT NULL,
    correlation_id              TEXT,
    causation_id                TEXT,
    version                     INTEGER NOT NULL DEFAULT 1,
    created_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_workflow ON workflow_events(workflow_instance_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_type ON workflow_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_correlation ON workflow_events(correlation_id);
CREATE INDEX IF NOT EXISTS idx_events_actor ON workflow_events(actor_id, created_at);
CREATE INDEX IF NOT EXISTS idx_events_time ON workflow_events(created_at);

-- ── Task Queue (Coordinator Dashboard) ──
CREATE TABLE IF NOT EXISTS task_queue (
    id                          TEXT PRIMARY KEY,
    task_instance_id            TEXT NOT NULL REFERENCES task_instances(id) ON DELETE CASCADE,
    queue_type                  TEXT NOT NULL DEFAULT 'general',
    priority_score              INTEGER NOT NULL DEFAULT 0,
    due_at                      INTEGER,
    assigned_at                 INTEGER,
    claimed_at                  INTEGER,
    completed_at                INTEGER,
    created_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_queue_priority ON task_queue(priority_score, due_at);
CREATE INDEX IF NOT EXISTS idx_queue_type ON task_queue(queue_type);
CREATE INDEX IF NOT EXISTS idx_queue_task ON task_queue(task_instance_id);

-- ── Dead Letter Queue ──
CREATE TABLE IF NOT EXISTS workflow_dlq (
    id                          TEXT PRIMARY KEY,
    workflow_instance_id        TEXT REFERENCES workflow_instances(id),
    task_instance_id            TEXT REFERENCES task_instances(id),
    failed_action               TEXT NOT NULL,
    error_message               TEXT NOT NULL,
    error_code                  TEXT,
    retry_count                 INTEGER NOT NULL DEFAULT 0,
    max_retries                 INTEGER NOT NULL DEFAULT 3,
    next_retry_at               INTEGER,
    payload                     TEXT DEFAULT '{}',
    created_at                  INTEGER NOT NULL,
    last_retry_at               INTEGER
);

CREATE INDEX IF NOT EXISTS idx_dlq_next_retry ON workflow_dlq(next_retry_at);
CREATE INDEX IF NOT EXISTS idx_dlq_status ON workflow_dlq(retry_count, max_retries);

-- ── Workflow Templates ──
CREATE TABLE IF NOT EXISTS workflow_templates (
    id                          TEXT PRIMARY KEY,
    name                        TEXT NOT NULL,
    description                 TEXT,
    definition                  TEXT NOT NULL DEFAULT '{}',
    version                     INTEGER NOT NULL DEFAULT 1,
    is_active                   INTEGER NOT NULL DEFAULT 1,
    created_at                  INTEGER NOT NULL,
    updated_at                  INTEGER NOT NULL
);

-- ── Workflow Analytics (Rollup Tables) ──
CREATE TABLE IF NOT EXISTS workflow_analytics_daily (
    date                        TEXT PRIMARY KEY,
    workflows_started           INTEGER NOT NULL DEFAULT 0,
    workflows_completed         INTEGER NOT NULL DEFAULT 0,
    workflows_failed            INTEGER NOT NULL DEFAULT 0,
    workflows_cancelled         INTEGER NOT NULL DEFAULT 0,
    tasks_created               INTEGER NOT NULL DEFAULT 0,
    tasks_completed             INTEGER NOT NULL DEFAULT 0,
    tasks_escalated             INTEGER NOT NULL DEFAULT 0,
    tasks_overdue               INTEGER NOT NULL DEFAULT 0,
    sla_compliance_rate         REAL NOT NULL DEFAULT 100.0,
    avg_task_duration_ms        TEXT DEFAULT '{}',
    queue_depth_by_priority     TEXT DEFAULT '{}',
    created_at                  INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS workflow_analytics_weekly (
    week                        TEXT PRIMARY KEY,
    workflows_started           INTEGER NOT NULL DEFAULT 0,
    workflows_completed         INTEGER NOT NULL DEFAULT 0,
    workflows_failed            INTEGER NOT NULL DEFAULT 0,
    tasks_created               INTEGER NOT NULL DEFAULT 0,
    tasks_completed             INTEGER NOT NULL DEFAULT 0,
    tasks_escalated             INTEGER NOT NULL DEFAULT 0,
    override_count              INTEGER NOT NULL DEFAULT 0,
    approval_turnaround_hours   REAL NOT NULL DEFAULT 0,
    communication_response_hours REAL NOT NULL DEFAULT 0,
    created_at                  INTEGER NOT NULL
);

-- ── Manual Override Log ──
CREATE TABLE IF NOT EXISTS workflow_overrides (
    id                          TEXT PRIMARY KEY,
    workflow_instance_id        TEXT NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
    task_instance_id            TEXT REFERENCES task_instances(id) ON DELETE CASCADE,
    action                      TEXT NOT NULL,
    reason                      TEXT NOT NULL,
    performed_by                TEXT NOT NULL,
    performed_at                INTEGER NOT NULL,
    previous_state              TEXT,
    new_state                   TEXT,
    created_at                  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_overrides_workflow ON workflow_overrides(workflow_instance_id);
CREATE INDEX IF NOT EXISTS idx_overrides_performer ON workflow_overrides(performed_by);
CREATE INDEX IF NOT EXISTS idx_overrides_time ON workflow_overrides(performed_at);