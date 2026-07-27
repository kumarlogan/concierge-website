# PSER — Data Model

> **AI Platform Capability — D1 Schema Design**
> Relational data model for the Project State & Execution Registry.
>
> **Base platform:** Cloudflare D1 (SQLite-compatible)
> **Cache:** Cloudflare KV (hot state)
> **Archive:** Cloudflare R2 (historical execution records)
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Project State & Execution Registry
Document:       PSER Data Model
Storage:        D1 (primary) + KV (cache) + R2 (archive)
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Schema Design Principles

| Principle | Implementation |
|-----------|---------------|
| **Normalized hierarchy** | Each level in the canonical hierarchy is a table. Foreign keys enforce parent-child relationships. |
| **Immutable audit** | Execution events and audit records are append-only. No UPDATE, no DELETE. |
| **Optimistic concurrency** | Every entity table has a `version` integer field. Updates check `WHERE version = :expected`. |
| **Tenant isolation** | Every table includes a `company_id` column. All queries scoped by tenant. |
| **Platform-agnostic** | No product-specific or provider-specific columns. Products register via product_id. |
| **JSON for extensibility** | Metadata, criteria, and dynamic fields stored as JSON text columns. |
| **Indexed for query** | Foreign keys, status, timestamps, and tenant columns indexed. |

---

## 2. Table Inventory

| # | Table | Purpose | Type |
|---|-------|---------|------|
| 1 | `pser_companies` | Company registry | Entity |
| 2 | `pser_platforms` | Platform instances | Entity |
| 3 | `pser_capabilities` | Platform capabilities | Entity |
| 4 | `pser_capability_dependencies` | Capability dependency graph | Relation |
| 5 | `pser_capability_consumers` | Capability-to-product mapping | Relation |
| 6 | `pser_workforces` | Workforce definitions | Entity |
| 7 | `pser_agents` | Workforce agent registry | Entity |
| 8 | `pser_agent_assignments` | Agent-to-entity assignments | Entity |
| 9 | `pser_products` | Product registry | Entity |
| 10 | `pser_roadmaps` | Product roadmaps | Entity |
| 11 | `pser_phases` | Roadmap phases | Entity |
| 12 | `pser_waves` | Phase waves | Entity |
| 13 | `pser_epics` | Wave epics | Entity |
| 14 | `pser_sprints` | Epic sprints | Entity |
| 15 | `pser_stories` | Sprint stories | Entity |
| 16 | `pser_tasks` | Story tasks | Entity |
| 17 | `pser_resume_points` | Execution resume points | Entity |
| 18 | `pser_blockers` | Active blockers on any entity | Entity |
| 19 | `pser_risks` | Risk register | Entity |
| 20 | `pser_dependencies` | Entity dependency links | Relation |
| 21 | `pser_gates` | Gate status and criteria | Entity |
| 22 | `pser_gate_criteria` | Individual gate criteria results | Entity |
| 23 | `pser_execution_history` | Append-only execution events | Append |
| 24 | `pser_audit_log` | Immutable state change audit | Append |
| 25 | `pser_approvals` | Approval records | Append |
| 26 | `pser_version_history` | Schema migration tracking | Append |

**Total: 26 tables** (14 entity, 4 relation, 5 append, 3 support)

---

## 3. Entity Tables

### 3.1 pser_companies

```sql
CREATE TABLE pser_companies (
  id             TEXT PRIMARY KEY,      -- uuid
  name           TEXT NOT NULL UNIQUE,  -- e.g. "AGS"
  display_name   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK(status IN ('active', 'inactive')),
  owner          TEXT NOT NULL,          -- human principal ID
  metadata       TEXT DEFAULT '{}',      -- JSON extensible
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1
);
```

### 3.2 pser_platforms

```sql
CREATE TABLE pser_platforms (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES pser_companies(id),
  name           TEXT NOT NULL,          -- e.g. "AI Platform"
  version        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK(status IN ('active', 'maintenance', 'frozen')),
  owner          TEXT NOT NULL,
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(company_id, name)
);
CREATE INDEX idx_platforms_company ON pser_platforms(company_id);
```

### 3.3 pser_products

```sql
CREATE TABLE pser_products (
  id             TEXT PRIMARY KEY,
  company_id     TEXT NOT NULL REFERENCES pser_companies(id),
  name           TEXT NOT NULL,          -- e.g. "Concierge"
  brand          TEXT NOT NULL,          -- e.g. "AG Synergy"
  internal_name  TEXT,                   -- e.g. "concierge-website"
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK(status IN ('active', 'inactive', 'sunset')),
  owner          TEXT NOT NULL,
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(company_id, name)
);
CREATE INDEX idx_products_company ON pser_products(company_id);
```

### 3.4 pser_roadmaps

```sql
CREATE TABLE pser_roadmaps (
  id             TEXT PRIMARY KEY,
  product_id     TEXT NOT NULL REFERENCES pser_products(id),
  name           TEXT NOT NULL,          -- e.g. "Concierge Roadmap"
  version        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK(status IN ('active', 'archived')),
  owner          TEXT NOT NULL,
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(product_id, name)
);
CREATE INDEX idx_roadmaps_product ON pser_roadmaps(product_id);
```

### 3.5 pser_phases

```sql
CREATE TABLE pser_phases (
  id               TEXT PRIMARY KEY,
  roadmap_id       TEXT NOT NULL REFERENCES pser_roadmaps(id),
  name             TEXT NOT NULL,        -- e.g. "Phase 2 — Patient Workflow Platform"
  phase_order      INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'planned'
                   CHECK(status IN ('planned', 'in_progress', 'completed', 'closed', 'blocked', 'cancelled')),
  gate_status      TEXT NOT NULL DEFAULT 'not_reached'
                   CHECK(gate_status IN ('not_reached', 'criteria_pending', 'criteria_met', 'approved', 'denied', 'overridden')),
  owner            TEXT NOT NULL,
  start_date       TEXT,
  target_date      TEXT,
  completion_pct   REAL NOT NULL DEFAULT 0.0
                   CHECK(completion_pct >= 0 AND completion_pct <= 100),
  metadata         TEXT DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE(roadmap_id, phase_order)
);
CREATE INDEX idx_phases_roadmap ON pser_phases(roadmap_id);
CREATE INDEX idx_phases_status ON pser_phases(status);
```

### 3.6 pser_waves

```sql
CREATE TABLE pser_waves (
  id               TEXT PRIMARY KEY,
  phase_id         TEXT NOT NULL REFERENCES pser_phases(id),
  name             TEXT NOT NULL,        -- e.g. "Wave 5 — Patient Portal"
  wave_order       INTEGER NOT NULL,
  status           TEXT NOT NULL DEFAULT 'planned'
                   CHECK(status IN ('planned', 'in_progress', 'completed', 'closed', 'blocked', 'cancelled')),
  gate_status      TEXT NOT NULL DEFAULT 'not_reached'
                   CHECK(gate_status IN ('not_reached', 'criteria_pending', 'criteria_met', 'approved', 'denied', 'overridden')),
  owner            TEXT NOT NULL,
  start_date       TEXT,
  target_date      TEXT,
  completion_pct   REAL NOT NULL DEFAULT 0.0
                   CHECK(completion_pct >= 0 AND completion_pct <= 100),
  metadata         TEXT DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1,
  UNIQUE(phase_id, wave_order)
);
CREATE INDEX idx_waves_phase ON pser_waves(phase_id);
CREATE INDEX idx_waves_status ON pser_waves(status);
```

### 3.7 pser_epics

```sql
CREATE TABLE pser_epics (
  id                    TEXT PRIMARY KEY,
  wave_id               TEXT NOT NULL REFERENCES pser_waves(id),
  name                  TEXT NOT NULL,
  description           TEXT,
  status                TEXT NOT NULL DEFAULT 'planned'
                        CHECK(status IN ('planned', 'in_progress', 'completed', 'closed', 'blocked', 'cancelled', 'deferred')),
  priority              TEXT NOT NULL DEFAULT 'p2'
                        CHECK(priority IN ('p0', 'p1', 'p2', 'p3')),
  owner                 TEXT NOT NULL,
  start_date            TEXT,
  target_date           TEXT,
  completion_pct        REAL NOT NULL DEFAULT 0.0
                        CHECK(completion_pct >= 0 AND completion_pct <= 100),
  story_points_total    INTEGER NOT NULL DEFAULT 0,
  story_points_completed INTEGER NOT NULL DEFAULT 0,
  metadata              TEXT DEFAULT '{}',
  created_at            TEXT NOT NULL DEFAULT (datetime('now')),
  created_by            TEXT NOT NULL,
  updated_at            TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by            TEXT NOT NULL,
  version               INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_epics_wave ON pser_epics(wave_id);
CREATE INDEX idx_epics_status ON pser_epics(status);
CREATE INDEX idx_epics_priority ON pser_epics(priority);
```

### 3.8 pser_sprints

```sql
CREATE TABLE pser_sprints (
  id               TEXT PRIMARY KEY,
  epic_id          TEXT NOT NULL REFERENCES pser_epics(id),
  name             TEXT NOT NULL,        -- e.g. "S2.2.1"
  duration_days    INTEGER NOT NULL DEFAULT 14,
  status           TEXT NOT NULL DEFAULT 'planned'
                   CHECK(status IN ('planned', 'in_progress', 'completed', 'closed', 'blocked', 'cancelled')),
  start_date       TEXT,
  end_date         TEXT,
  completion_pct   REAL NOT NULL DEFAULT 0.0
                   CHECK(completion_pct >= 0 AND completion_pct <= 100),
  metadata         TEXT DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_sprints_epic ON pser_sprints(epic_id);
CREATE INDEX idx_sprints_status ON pser_sprints(status);
```

### 3.9 pser_stories

```sql
CREATE TABLE pser_stories (
  id                 TEXT PRIMARY KEY,
  sprint_id          TEXT NOT NULL REFERENCES pser_sprints(id),
  name               TEXT NOT NULL,
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'planned'
                     CHECK(status IN ('planned', 'in_progress', 'completed', 'blocked', 'cancelled')),
  points             INTEGER NOT NULL DEFAULT 0,
  owner              TEXT NOT NULL,
  assignee           TEXT,
  acceptance_criteria TEXT DEFAULT '[]',   -- JSON array of strings
  metadata           TEXT DEFAULT '{}',
  created_at         TEXT NOT NULL DEFAULT (datetime('now')),
  created_by         TEXT NOT NULL,
  updated_at         TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by         TEXT NOT NULL,
  version            INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_stories_sprint ON pser_stories(sprint_id);
CREATE INDEX idx_stories_assignee ON pser_stories(assignee);
```

### 3.10 pser_tasks

```sql
CREATE TABLE pser_tasks (
  id               TEXT PRIMARY KEY,
  story_id         TEXT NOT NULL REFERENCES pser_stories(id),
  name             TEXT NOT NULL,
  description      TEXT,
  status           TEXT NOT NULL DEFAULT 'planned'
                   CHECK(status IN ('planned', 'in_progress', 'completed', 'blocked', 'cancelled')),
  owner            TEXT NOT NULL,
  assignee         TEXT,
  resume_point_id  TEXT REFERENCES pser_resume_points(id),
  completion_pct   REAL NOT NULL DEFAULT 0.0
                   CHECK(completion_pct >= 0 AND completion_pct <= 100),
  metadata         TEXT DEFAULT '{}',
  created_at       TEXT NOT NULL DEFAULT (datetime('now')),
  created_by       TEXT NOT NULL,
  updated_at       TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by       TEXT NOT NULL,
  version          INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX idx_tasks_story ON pser_tasks(story_id);
CREATE INDEX idx_tasks_assignee ON pser_tasks(assignee);
CREATE INDEX idx_tasks_status ON pser_tasks(status);
```

### 3.11 pser_resume_points

```sql
CREATE TABLE pser_resume_points (
  id             TEXT PRIMARY KEY,
  entity_type    TEXT NOT NULL
                 CHECK(entity_type IN ('phase', 'wave', 'epic', 'sprint', 'story', 'task')),
  entity_id      TEXT NOT NULL,
  next_action    TEXT NOT NULL,
  context        TEXT DEFAULT '{}',       -- JSON: agent-specific context
  set_by         TEXT NOT NULL,            -- principal:<id>
  set_at         TEXT NOT NULL DEFAULT (datetime('now')),
  cleared_at     TEXT,
  cleared_by     TEXT,
  UNIQUE(entity_type, entity_id)
);
CREATE INDEX idx_resume_entity ON pser_resume_points(entity_type, entity_id);
```

### 3.12 pser_blockers

```sql
CREATE TABLE pser_blockers (
  id               TEXT PRIMARY KEY,
  entity_type      TEXT NOT NULL
                   CHECK(entity_type IN ('company', 'platform', 'product', 'phase', 'wave', 'epic', 'sprint', 'story', 'task')),
  entity_id        TEXT NOT NULL,
  summary          TEXT NOT NULL,
  description      TEXT,
  severity         TEXT NOT NULL DEFAULT 'impediment'
                   CHECK(severity IN ('blocking', 'impediment', 'risk')),
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK(status IN ('open', 'mitigating', 'resolved', 'accepted')),
  raised_by        TEXT NOT NULL,
  raised_at        TEXT NOT NULL DEFAULT (datetime('now')),
  resolved_by      TEXT,
  resolved_at      TEXT,
  resolution_notes TEXT,
  UNIQUE(entity_type, entity_id, summary)
);
CREATE INDEX idx_blockers_entity ON pser_blockers(entity_type, entity_id);
CREATE INDEX idx_blockers_status ON pser_blockers(status);
```

### 3.13 pser_risks

```sql
CREATE TABLE pser_risks (
  id               TEXT PRIMARY KEY,
  entity_type      TEXT NOT NULL
                   CHECK(entity_type IN ('company', 'platform', 'product', 'phase', 'wave', 'epic')),
  entity_id        TEXT NOT NULL,
  summary          TEXT NOT NULL,
  description      TEXT,
  severity         TEXT NOT NULL CHECK(severity IN ('critical', 'high', 'medium', 'low')),
  likelihood       TEXT NOT NULL CHECK(likelihood IN ('high', 'medium', 'low')),
  impact           TEXT NOT NULL CHECK(impact IN ('high', 'medium', 'low')),
  mitigation       TEXT,
  owner            TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'open'
                   CHECK(status IN ('open', 'mitigating', 'accepted', 'resolved')),
  UNIQUE(entity_type, entity_id, summary)
);
CREATE INDEX idx_risks_entity ON pser_risks(entity_type, entity_id);
CREATE INDEX idx_risks_severity ON pser_risks(severity);
```

### 3.14 pser_workforces

```sql
CREATE TABLE pser_workforces (
  id             TEXT PRIMARY KEY,
  platform_id    TEXT NOT NULL REFERENCES pser_platforms(id),
  name           TEXT NOT NULL,          -- e.g. "AGS Workforce"
  wef_version    TEXT NOT NULL,          -- e.g. "1.0.0"
  human_principal TEXT NOT NULL,         -- e.g. "principal:human-operator"
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK(status IN ('active', 'inactive')),
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(platform_id, name)
);
CREATE INDEX idx_workforces_platform ON pser_workforces(platform_id);
```

### 3.15 pser_agents

```sql
CREATE TABLE pser_agents (
  id             TEXT PRIMARY KEY,
  workforce_id   TEXT NOT NULL REFERENCES pser_workforces(id),
  agent_type     TEXT NOT NULL,          -- e.g. "developer", "qa", "security", "docs", "monitor"
  status         TEXT NOT NULL DEFAULT 'available'
                 CHECK(status IN ('available', 'assigned', 'busy', 'offline', 'retired')),
  current_entity_type TEXT,
  current_entity_id   TEXT,
  authority      TEXT NOT NULL DEFAULT 'restricted'
                 CHECK(authority IN ('full', 'restricted', 'read_only')),
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(workforce_id, agent_type)
);
CREATE INDEX idx_agents_workforce ON pser_agents(workforce_id);
CREATE INDEX idx_agents_status ON pser_agents(status);
```

### 3.16 pser_agent_assignments

```sql
CREATE TABLE pser_agent_assignments (
  id             TEXT PRIMARY KEY,
  workforce_id   TEXT NOT NULL REFERENCES pser_workforces(id),
  agent_id       TEXT NOT NULL REFERENCES pser_agents(id),
  entity_type    TEXT NOT NULL
                 CHECK(entity_type IN ('phase', 'wave', 'epic', 'sprint', 'story', 'task')),
  entity_id      TEXT NOT NULL,
  role           TEXT NOT NULL,
  assigned_by    TEXT NOT NULL,
  assigned_at    TEXT NOT NULL DEFAULT (datetime('now')),
  unassigned_at  TEXT,
  status         TEXT NOT NULL DEFAULT 'active'
                 CHECK(status IN ('active', 'completed', 'cancelled'))
);
CREATE INDEX idx_assignments_agent ON pser_agent_assignments(agent_id);
CREATE INDEX idx_assignments_entity ON pser_agent_assignments(entity_type, entity_id);
CREATE INDEX idx_assignments_active ON pser_agent_assignments(status) WHERE status = 'active';
```

### 3.17 pser_capabilities

```sql
CREATE TABLE pser_capabilities (
  id             TEXT PRIMARY KEY,
  platform_id    TEXT NOT NULL REFERENCES pser_platforms(id),
  name           TEXT NOT NULL,          -- e.g. "Project State & Execution Registry"
  maturity       TEXT NOT NULL
                 CHECK(maturity IN ('concept', 'architecture', 'prototype', 'development',
                                    'production_ready', 'operational', 'deprecated', 'retired')),
  status         TEXT NOT NULL DEFAULT 'planned'
                 CHECK(status IN ('planned', 'in_progress', 'completed', 'active', 'deprecated')),
  version        TEXT NOT NULL,
  owner          TEXT NOT NULL,
  metadata       TEXT DEFAULT '{}',
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  created_by     TEXT NOT NULL,
  updated_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_by     TEXT NOT NULL,
  version        INTEGER NOT NULL DEFAULT 1,
  UNIQUE(platform_id, name)
);
CREATE INDEX idx_capabilities_platform ON pser_capabilities(platform_id);
```

---

## 4. Relation Tables

### 4.1 pser_dependencies

```sql
CREATE TABLE pser_dependencies (
  id                   TEXT PRIMARY KEY,
  dependency_type      TEXT NOT NULL
                       CHECK(dependency_type IN ('blocks', 'blocked_by', 'related_to')),
  source_entity_type   TEXT NOT NULL,
  source_entity_id     TEXT NOT NULL,
  target_entity_type   TEXT NOT NULL,
  target_entity_id     TEXT NOT NULL,
  status               TEXT NOT NULL DEFAULT 'pending'
                       CHECK(status IN ('pending', 'satisfied', 'broken')),
  notes                TEXT,
  UNIQUE(source_entity_type, source_entity_id, target_entity_type, target_entity_id)
);
CREATE INDEX idx_dep_source ON pser_dependencies(source_entity_type, source_entity_id);
CREATE INDEX idx_dep_target ON pser_dependencies(target_entity_type, target_entity_id);
```

### 4.2 pser_capability_dependencies

```sql
CREATE TABLE pser_capability_dependencies (
  id                    TEXT PRIMARY KEY,
  capability_id         TEXT NOT NULL REFERENCES pser_capabilities(id),
  depends_on_capability_id TEXT NOT NULL REFERENCES pser_capabilities(id),
  dependency_type       TEXT NOT NULL DEFAULT 'requires'
                        CHECK(dependency_type IN ('requires', 'optional', 'conflicts')),
  UNIQUE(capability_id, depends_on_capability_id)
);
```

### 4.3 pser_capability_consumers

```sql
CREATE TABLE pser_capability_consumers (
  id              TEXT PRIMARY KEY,
  capability_id   TEXT NOT NULL REFERENCES pser_capabilities(id),
  consumer_type   TEXT NOT NULL
                  CHECK(consumer_type IN ('product', 'capability', 'workforce')),
  consumer_id     TEXT NOT NULL,
  UNIQUE(capability_id, consumer_type, consumer_id)
);
```

---

## 5. Append-Only Tables

### 5.1 pser_execution_history

```typescript
// Immutable, append-only. No UPDATE, no DELETE.
CREATE TABLE pser_execution_history (
  id              TEXT PRIMARY KEY,
  event_id        TEXT NOT NULL UNIQUE,
  session_id      TEXT NOT NULL,
  entity_type     TEXT NOT NULL
                  CHECK(entity_type IN ('phase', 'wave', 'epic', 'sprint', 'story', 'task',
                                        'platform', 'product')),
  entity_id       TEXT NOT NULL,
  event_type      TEXT NOT NULL
                  CHECK(event_type IN ('started', 'completed', 'blocked', 'resumed',
                                       'cancelled', 'checkpoint', 'gate_advanced',
                                       'approval_submitted', 'approval_granted',
                                       'approval_denied', 'override_performed')),
  performed_by    TEXT NOT NULL,          -- principal:<id>
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  duration_ms     INTEGER,
  summary         TEXT NOT NULL,
  details         TEXT DEFAULT '{}',       -- JSON
  resume_point_id TEXT REFERENCES pser_resume_points(id),
  outcome         TEXT
                  CHECK(outcome IN ('success', 'failure', 'partial', 'unknown'))
);
CREATE INDEX idx_exec_entity ON pser_execution_history(entity_type, entity_id);
CREATE INDEX idx_exec_session ON pser_execution_history(session_id);
CREATE INDEX idx_exec_timestamp ON pser_execution_history(timestamp);
CREATE INDEX idx_exec_performer ON pser_execution_history(performed_by);
CREATE INDEX idx_exec_event_type ON pser_execution_history(event_type);
```

### 5.2 pser_audit_log

```sql
CREATE TABLE pser_audit_log (
  id              TEXT PRIMARY KEY,
  event_type      TEXT NOT NULL,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  from_state      TEXT,
  to_state        TEXT,
  performed_by    TEXT NOT NULL,
  timestamp       TEXT NOT NULL DEFAULT (datetime('now')),
  reason          TEXT,
  authorization   TEXT NOT NULL DEFAULT 'granted'
                  CHECK(authorization IN ('granted', 'denied')),
  metadata        TEXT DEFAULT '{}'
);
CREATE INDEX idx_audit_entity ON pser_audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_timestamp ON pser_audit_log(timestamp);
CREATE INDEX idx_audit_performer ON pser_audit_log(performed_by);
```

### 5.3 pser_approvals

```sql
CREATE TABLE pser_approvals (
  id              TEXT PRIMARY KEY,
  entity_type     TEXT NOT NULL,
  entity_id       TEXT NOT NULL,
  approval_type   TEXT NOT NULL
                  CHECK(approval_type IN ('gate_entry', 'gate_exit', 'override',
                                          'phase_transition', 'wave_transition',
                                          'epic_completion', 'blocker_resolution')),
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK(status IN ('pending', 'approved', 'denied', 'overridden')),
  submitted_by    TEXT NOT NULL,
  submitted_at    TEXT NOT NULL DEFAULT (datetime('now')),
  approved_by     TEXT,
  approved_at     TEXT,
  decision_reason TEXT,
  metadata        TEXT DEFAULT '{}'
);
CREATE INDEX idx_approvals_entity ON pser_approvals(entity_type, entity_id);
CREATE INDEX idx_approvals_status ON pser_approvals(status);
```

### 5.4 pser_gates

```sql
CREATE TABLE pser_gates (
  id              TEXT PRIMARY KEY,
  entity_type     TEXT NOT NULL
                  CHECK(entity_type IN ('phase', 'wave', 'epic')),
  entity_id       TEXT NOT NULL,
  gate_type       TEXT NOT NULL CHECK(gate_type IN ('entry', 'exit')),
  status          TEXT NOT NULL DEFAULT 'not_reached'
                  CHECK(status IN ('not_reached', 'criteria_pending', 'criteria_met',
                                   'approved', 'denied', 'overridden')),
  submitted_by    TEXT,
  submitted_at    TEXT,
  approved_by     TEXT,
  approved_at     TEXT,
  override_by     TEXT,
  override_at     TEXT,
  rejection_reason TEXT,
  UNIQUE(entity_type, entity_id, gate_type)
);
CREATE INDEX idx_gates_entity ON pser_gates(entity_type, entity_id);
```

### 5.5 pser_gate_criteria

```sql
CREATE TABLE pser_gate_criteria (
  id              TEXT PRIMARY KEY,
  gate_id         TEXT NOT NULL REFERENCES pser_gates(id),
  criteria_order  INTEGER NOT NULL,
  description     TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'unmet'
                  CHECK(status IN ('met', 'unmet', 'waived')),
  verified_by     TEXT,
  verified_at     TEXT,
  evidence        TEXT,
  UNIQUE(gate_id, criteria_order)
);
CREATE INDEX idx_criteria_gate ON pser_gate_criteria(gate_id);
```

### 5.6 pser_version_history

```sql
CREATE TABLE pser_version_history (
  id              TEXT PRIMARY KEY,
  schema_version  INTEGER NOT NULL,
  applied_at      TEXT NOT NULL DEFAULT (datetime('now')),
  applied_by      TEXT NOT NULL,
  description     TEXT NOT NULL,
  checksum        TEXT
);
```

---

## 6. Key Indexes Summary

| Index | Table | Columns | Purpose |
|-------|-------|---------|---------|
| `idx_phases_roadmap` | pser_phases | roadmap_id | Phase lookup by roadmap |
| `idx_phases_status` | pser_phases | status | Active phase queries |
| `idx_waves_phase` | pser_waves | phase_id | Wave lookup by phase |
| `idx_epics_wave` | pser_epics | wave_id | Epic lookup by wave |
| `idx_sprints_epic` | pser_sprints | epic_id | Sprint lookup by epic |
| `idx_stories_sprint` | pser_stories | sprint_id | Story lookup by sprint |
| `idx_tasks_story` | pser_tasks | story_id | Task lookup by story |
| `idx_tasks_assignee` | pser_tasks | assignee | "What are my tasks?" |
| `idx_exec_entity` | pser_execution_history | entity_type, entity_id | Execution history by entity |
| `idx_exec_session` | pser_execution_history | session_id | Session timeline |
| `idx_resume_entity` | pser_resume_points | entity_type, entity_id | Resume point lookup |
| `idx_blockers_entity` | pser_blockers | entity_type, entity_id | Active blockers |
| `idx_assignments_active` | pser_agent_assignments | status (partial) | Current assignments |

---

## 7. Migration Strategy

| Migration | Tables Added | Description |
|-----------|-------------|-------------|
| `0003_pser_companies` | pser_companies, pser_platforms, pser_products, pser_roadmaps | Top-level hierarchy |
| `0004_pser_phases_waves` | pser_phases, pser_waves, pser_epics, pser_sprints | Product planning hierarchy |
| `0005_pser_stories_tasks` | pser_stories, pser_tasks, pser_resume_points | Execution unit hierarchy |
| `0006_pser_workforce` | pser_workforces, pser_agents, pser_agent_assignments | Workforce integration |
| `0007_pser_gates` | pser_gates, pser_gate_criteria, pser_approvals, pser_blockers, pser_risks | Gate model |
| `0008_pser_execution` | pser_execution_history, pser_audit_log, pser_dependencies | Immutable execution records |
| `0009_pser_capabilities` | pser_capabilities, pser_capability_dependencies, pser_capability_consumers | Capability mirror |
| `0010_pser_version` | pser_version_history | Schema migration tracking |

---

## 8. KV Cache Schema

Hot state cached in KV for read-heavy workloads:

```
Key Pattern                        │ Value
───────────────────────────────────┼──────────────────────────────────────
pser:product:<id>:context          │ ExecutionContext (full hierarchy, JSON)
pser:product:<id>:metrics          │ ProductProgress (aggregate, JSON)
pser:resume:<product_id>           │ ResumePoint (current, JSON)
pser:blockers:<entity_type>:<id>   │ Blocker[] (active only, JSON)
pser:gate:<entity_type>:<id>       │ GateState (JSON)
pser:workforce:<id>:assignments    │ AgentAssignment[] (active, JSON)
```

Cache TTL: 60 seconds default. Invalidated on write by clearing the specific key.

---

## 9. R2 Archive Schema

Historical execution records older than 90 days archived to R2:

```
pser-history/<YYYY>/<MM>/<DD>/<entity_type>/<entity_id>/<event_id>.json
```

Archival is a background process. Data is queryable via KV index of archived records.

---

*This data model is authoritative for PSER v1.0 implementation.*
*All migrations must conform to this schema design.*
*Schema document — AI Platform Capability*
*Last updated: 2026-07-26*