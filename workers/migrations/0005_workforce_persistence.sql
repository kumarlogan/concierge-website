-- ============================================================================
-- Hermes Platform — Workforce Persistence
-- ============================================================================
-- Migration: 0005_workforce_persistence.sql
-- Phase: 5 — Workforce Persistence v1
-- Created: 2026-07-22
-- Database: Cloudflare D1 (agsynergy-db)
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: workforce_agents
-- ============================================================================
-- Stores workforce-specific state for agents (enabled, autonomous, domain).
-- This extends the agent state stored in the agent-state-store.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workforce_agents (
    agent_id          TEXT PRIMARY KEY,          -- References agent.id from agent-state-store
    lifecycle_state   TEXT NOT NULL,             -- AgentLifecycleState (registered, assigned, etc.)
    enabled           INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
    autonomous        INTEGER NOT NULL DEFAULT 0, -- 0 = false, 1 = true
    domain            TEXT,                      -- Free-text domain (e.g., 'fertility', 'scheduling')
    created_at        TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at        TEXT NOT NULL              -- ISO 8601 UTC
);

-- ============================================================================
-- TABLE: agent_activation_requests
-- ============================================================================
-- Tracks requests to activate an agent for a specific task (workflow item).
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_activation_requests (
    request_id        TEXT PRIMARY KEY,          -- UUID v4
    agent_id          TEXT NOT NULL,             -- References workforce_agents.agent_id
    requested_by      TEXT NOT NULL,             -- Principal who requested activation
    approved_by       TEXT,                      -- Principal who approved (null if pending)
    approval_reference TEXT NOT NULL,            -- Format: `${workflowId}:${itemId}`
    status            TEXT NOT NULL,             -- 'pending' | 'approved' | 'denied'
    created_at        TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at        TEXT NOT NULL,             -- ISO 8601 UTC
    FOREIGN KEY (agent_id) REFERENCES workforce_agents(agent_id)
);

-- ============================================================================
-- TABLE: agent_audit_events
-- ============================================================================
-- Audit events for workforce agent lifecycle and activation requests.
-- ============================================================================
CREATE TABLE IF NOT EXISTS agent_audit_events (
    event_id          TEXT PRIMARY KEY,          -- UUID v4
    agent_id          TEXT NOT NULL,             -- References workforce_agents.agent_id
    event_type        TEXT NOT NULL,             -- e.g., 'agent.enabled', 'activation.requested'
    actor             TEXT NOT NULL,             -- Principal who triggered the event
    metadata          TEXT,                      -- JSON string of additional data
    timestamp         TEXT NOT NULL              -- ISO 8601 UTC
    -- FOREIGN KEY (agent_id) REFERENCES workforce_agents(agent_id)
);

-- ============================================================================
-- TABLE: workforce_metrics
-- ============================================================================
-- Operational metrics for workforce observability.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workforce_metrics (
    metric_id         TEXT PRIMARY KEY,          -- UUID v4
    agent_id          TEXT NOT NULL,             -- References workforce_agents.agent_id
    metric_type       TEXT NOT NULL,             -- Type of metric (e.g., 'agent.execution.failure')
    value             REAL NOT NULL,             -- Numeric value (default 1.0 for counts)
    metadata          TEXT,                      -- JSON string of additional data
    timestamp         TEXT NOT NULL              -- ISO 8601 UTC
    -- FOREIGN KEY (agent_id) REFERENCES workforce_agents(agent_id)
);

-- ============================================================================
-- TABLE: workflows
-- ============================================================================
-- Core workflow state machine. Each row is an active or completed workflow.
-- plan_json stores the serialized WorkPlan; timeline_json stores the
-- WorkflowTimelineEvent[] as a JSON array.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflows (
    workflow_id        TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    application_id     TEXT NOT NULL,
    requested_by       TEXT NOT NULL,
    env                TEXT NOT NULL DEFAULT 'development',
    state              TEXT NOT NULL DEFAULT 'queued',
    plan_json          TEXT,
    failure_count      INTEGER NOT NULL DEFAULT 0,
    retry_count        INTEGER NOT NULL DEFAULT 0,
    note               TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    timeline_json      TEXT NOT NULL DEFAULT '[]'
);

-- ============================================================================
-- TABLE: workflow_tasks
-- ============================================================================
-- Each work-item within a workflow. FK to the parent workflow.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_tasks (
    task_id            TEXT PRIMARY KEY,
    workflow_id        TEXT NOT NULL,
    item_id            TEXT NOT NULL,
    queue_id           TEXT NOT NULL DEFAULT '',
    capability         TEXT NOT NULL,
    wave               INTEGER NOT NULL DEFAULT 0,
    dispatch_json      TEXT NOT NULL,
    requires_approval  INTEGER NOT NULL DEFAULT 0,
    created_at         TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: workflow_approvals
-- ============================================================================
-- Approval requests within a workflow. Keyed by queue_id per workflow.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_approvals (
    approval_id        TEXT PRIMARY KEY,
    workflow_id        TEXT NOT NULL,
    queue_id           TEXT NOT NULL,
    agent_id           TEXT NOT NULL,
    application_id     TEXT NOT NULL,
    env                TEXT NOT NULL,
    permission         TEXT NOT NULL,
    capability         TEXT NOT NULL,
    expires_at         TEXT,
    state              TEXT NOT NULL DEFAULT 'pending',
    approved_by        TEXT,
    rejected_by        TEXT,
    created_at         TEXT NOT NULL,
    updated_at         TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: workflow_granted_approvals
-- ============================================================================
-- Tracks queue_ids whose execution has been explicitly granted by a human.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workflow_granted_approvals (
    workflow_id        TEXT NOT NULL,
    queue_id           TEXT NOT NULL,
    granted_by         TEXT NOT NULL,
    granted_at         TEXT NOT NULL,
    PRIMARY KEY (workflow_id, queue_id),
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

-- ============================================================================
-- TABLE: workforce_workflow_metrics
-- ============================================================================
-- Workflow-level metrics stored through the existing observability service.
-- ============================================================================
CREATE TABLE IF NOT EXISTS workforce_workflow_metrics (
    metric_id          TEXT PRIMARY KEY,
    workflow_id        TEXT NOT NULL,
    metric_type        TEXT NOT NULL,
    value              REAL NOT NULL DEFAULT 1.0,
    metadata           TEXT,
    timestamp          TEXT NOT NULL,
    FOREIGN KEY (workflow_id) REFERENCES workflows(workflow_id) ON DELETE CASCADE
);

-- ============================================================================
-- Indexes for common query patterns
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_agent_activation_requests_agent_id ON agent_activation_requests(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_activation_requests_status ON agent_activation_requests(status);
CREATE INDEX IF NOT EXISTS idx_agent_activation_requests_approval_reference ON agent_activation_requests(approval_reference);
CREATE INDEX IF NOT EXISTS idx_agent_audit_events_agent_id ON agent_audit_events(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_audit_events_timestamp ON agent_audit_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_workforce_metrics_agent_id ON workforce_metrics(agent_id);
CREATE INDEX IF NOT EXISTS idx_workforce_metrics_metric_type ON workforce_metrics(metric_type);
CREATE INDEX IF NOT EXISTS idx_workforce_metrics_timestamp ON workforce_metrics(timestamp);

-- Workflow indexes
CREATE INDEX IF NOT EXISTS idx_workflows_state ON workflows(state);
CREATE INDEX IF NOT EXISTS idx_workflows_env ON workflows(env);
CREATE INDEX IF NOT EXISTS idx_workflows_created_at ON workflows(created_at);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_workflow_id ON workflow_tasks(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_tasks_queue_id ON workflow_tasks(queue_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_workflow_id ON workflow_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_queue_id ON workflow_approvals(queue_id);
CREATE INDEX IF NOT EXISTS idx_workflow_approvals_state ON workflow_approvals(state);
CREATE INDEX IF NOT EXISTS idx_workflow_granted_approvals_workflow ON workflow_granted_approvals(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workforce_workflow_metrics_workflow ON workforce_workflow_metrics(workflow_id);