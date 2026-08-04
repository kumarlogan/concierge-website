-- ┌─────────────────────────────────────────────────────────────┐
-- │ Migration 0013 — IVF Timeline Engine D1 Tables              │
-- │ Wave 3 — Patient Journey Timeline                           │
-- └─────────────────────────────────────────────────────────────┘

-- patient_stages: one row per (identity_id, stage)
CREATE TABLE IF NOT EXISTS patient_stages (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    stage TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    entered_at TEXT,
    completed_at TEXT,
    expected_duration_days INTEGER NOT NULL DEFAULT 0,
    expected_completion_date TEXT,
    actual_duration_days INTEGER,
    notes TEXT DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE(identity_id, stage)
);
CREATE INDEX IF NOT EXISTS idx_patient_stages_identity ON patient_stages(identity_id);
CREATE INDEX IF NOT EXISTS idx_patient_stages_status ON patient_stages(status);

-- patient_milestones
CREATE TABLE IF NOT EXISTS patient_milestones (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    stage TEXT,
    date TEXT NOT NULL,
    achieved INTEGER NOT NULL DEFAULT 0,
    achieved_at TEXT,
    expected_date TEXT,
    auto_generated INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_milestones_identity ON patient_milestones(identity_id);
CREATE INDEX IF NOT EXISTS idx_patient_milestones_stage ON patient_milestones(stage);
CREATE INDEX IF NOT EXISTS idx_patient_milestones_type ON patient_milestones(identity_id, type);

-- patient_timeline_events
CREATE TABLE IF NOT EXISTS patient_timeline_events (
    id TEXT PRIMARY KEY,
    identity_id TEXT NOT NULL,
    category TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    ref_id TEXT,
    ref_type TEXT,
    occurred_at TEXT NOT NULL,
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_events_identity ON patient_timeline_events(identity_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_patient_timeline_events_category ON patient_timeline_events(category);
