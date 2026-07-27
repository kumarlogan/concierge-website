# PSER — Platform Interface Contracts

> **AI Platform Capability — Interfaces**
> Provider-neutral, deterministic interfaces for the Project State & Execution Registry.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Capability:     Project State & Execution Registry
Document:       PSER Platform Interfaces
Interface Spec: TypeScript
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Interface Overview

PSER exposes three interface groups:

| Group | Direction | Auth Required | Idempotent | Cached |
|-------|-----------|---------------|------------|--------|
| **StateQuery** | Read-only | ✅ `pser:reader` | ✅ Yes | ✅ KV |
| **StateMutate** | Write | ✅ `pser:writer` | ⚠️ Conditional | ❌ No |
| **ExecutionQuery** | Read-only | ✅ `pser:reader` | ✅ Yes | ⚠️ 30s TTL |

All interfaces use structured JSON request/response. No natural language processing at the API layer — NL enters only through the Intent Engine pipeline, which resolves it to structured PSER calls.

---

## 2. Shared Types

```typescript
// ──── State Types ──────────────────────────────────────

type EntityStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "closed"
  | "blocked"
  | "cancelled"
  | "deferred";

type GateStatus =
  | "not_reached"
  | "criteria_pending"
  | "criteria_met"
  | "approved"
  | "denied"
  | "overridden";

type Priority = "p0" | "p1" | "p2" | "p3";

type RiskSeverity = "critical" | "high" | "medium" | "low";

interface AuditMetadata {
  created_at: string;          // ISO 8601
  created_by: string;          // principal:<id>
  updated_at: string;          // ISO 8601
  updated_by: string;          // principal:<id>
  version: number;             // optimistic lock
}

interface ResumePoint {
  id: string;
  entity_type: "phase" | "wave" | "epic" | "sprint" | "story" | "task";
  entity_id: string;
  entity_name: string;
  next_action: string;
  context: Record<string, unknown>;
  set_by: string;              // principal:<id>
  set_at: string;              // ISO 8601
}

interface Blocker {
  id: string;
  summary: string;
  description: string;
  severity: "blocking" | "impediment" | "risk";
  status: "open" | "mitigating" | "resolved" | "accepted";
  raised_by: string;
  raised_at: string;
  resolved_by?: string;
  resolved_at?: string;
  resolution_notes?: string;
}

interface Risk {
  id: string;
  summary: string;
  description: string;
  severity: RiskSeverity;
  likelihood: "high" | "medium" | "low";
  impact: "high" | "medium" | "low";
  mitigation: string;
  owner: string;
  status: "open" | "mitigating" | "accepted" | "resolved";
}

interface Dependency {
  id: string;
  dependency_type: "blocks" | "blocked_by" | "related_to";
  source_entity_type: string;
  source_entity_id: string;
  target_entity_type: string;
  target_entity_id: string;
  status: "pending" | "satisfied" | "broken";
}

// ──── Tenant Context ───────────────────────────────────

interface TenantContext {
  company_id: string;
  platform_id: string;
  product_id?: string;
  roadmap_id?: string;
}
```

---

## 3. ProjectStateService

Read/write the canonical project state hierarchy — companies, platforms, products.

```typescript
interface ProjectStateService {
  // ── Company ──────────────────────────────────────────

  getCompany(companyId: string): Promise<CompanyState>;
  listCompanies(): Promise<CompanyState[]>;
  createCompany(input: CreateCompanyInput): Promise<CompanyState>;
  updateCompany(companyId: string, input: UpdateCompanyInput): Promise<CompanyState>;

  // ── Platform ─────────────────────────────────────────

  getPlatform(companyId: string, platformId: string): Promise<PlatformState>;
  listPlatforms(companyId: string): Promise<PlatformState[]>;
  registerPlatform(input: RegisterPlatformInput): Promise<PlatformState>;
  updatePlatform(platformId: string, input: UpdatePlatformInput): Promise<PlatformState>;

  // ── Product ──────────────────────────────────────────

  getProduct(companyId: string, productId: string): Promise<ProductState>;
  listProducts(companyId: string): Promise<ProductState[]>;
  registerProduct(input: RegisterProductInput): Promise<ProductState>;
  updateProduct(productId: string, input: UpdateProductInput): Promise<ProductState>;
}

// ──── Company State ────────────────────────────────────

interface CompanyState {
  id: string;
  name: string;
  status: "active" | "inactive";
  owner: string;
  metadata: Record<string, unknown>;
  audit: AuditMetadata;
}

// ──── Platform State ───────────────────────────────────

interface PlatformState {
  id: string;
  company_id: string;
  name: string;
  version: string;
  status: "active" | "maintenance" | "frozen";
  owner: string;
  metadata: Record<string, unknown>;
  audit: AuditMetadata;
}

// ──── Product State ────────────────────────────────────

interface ProductState {
  id: string;
  company_id: string;
  name: string;
  brand: string;
  internal_name: string;
  status: "active" | "inactive" | "sunset";
  owner: string;
  current_phase_id?: string;
  current_wave_id?: string;
  current_epic_id?: string;
  current_sprint_id?: string;
  metadata: Record<string, unknown>;
  audit: AuditMetadata;
}
```

---

## 4. RoadmapRegistry

Manage the roadmap hierarchy — phases, waves, epics, sprints, stories, tasks.

```typescript
interface RoadmapRegistry {
  // ── Roadmap ──────────────────────────────────────────

  getRoadmap(productId: string, roadmapId: string): Promise<RoadmapState>;
  listRoadmaps(productId: string): Promise<RoadmapState[]>;
  createRoadmap(input: CreateRoadmapInput): Promise<RoadmapState>;
  updateRoadmap(roadmapId: string, input: UpdateRoadmapInput): Promise<RoadmapState>;

  // ── Phase ────────────────────────────────────────────

  getPhase(roadmapId: string, phaseId: string): Promise<PhaseState>;
  listPhases(roadmapId: string): Promise<PhaseState[]>;
  createPhase(input: CreatePhaseInput): Promise<PhaseState>;
  updatePhase(phaseId: string, input: UpdatePhaseInput): Promise<PhaseState>;
  advancePhase(phaseId: string, newStatus: EntityStatus, approver: string): Promise<PhaseState>;

  // ── Wave ─────────────────────────────────────────────

  getWave(phaseId: string, waveId: string): Promise<WaveState>;
  listWaves(phaseId: string): Promise<WaveState[]>;
  createWave(input: CreateWaveInput): Promise<WaveState>;
  updateWave(waveId: string, input: UpdateWaveInput): Promise<WaveState>;
  advanceWave(waveId: string, newStatus: EntityStatus, approver: string): Promise<WaveState>;

  // ── Epic ─────────────────────────────────────────────

  getEpic(waveId: string, epicId: string): Promise<EpicState>;
  listEpics(waveId?: string, phaseId?: string): Promise<EpicState[]>;
  createEpic(input: CreateEpicInput): Promise<EpicState>;
  updateEpic(epicId: string, input: UpdateEpicInput): Promise<EpicState>;
  advanceEpic(epicId: string, newStatus: EntityStatus, approver: string): Promise<EpicState>;

  // ── Sprint ───────────────────────────────────────────

  getSprint(epicId: string, sprintId: string): Promise<SprintState>;
  listSprints(epicId: string): Promise<SprintState[]>;
  createSprint(input: CreateSprintInput): Promise<SprintState>;
  updateSprint(sprintId: string, input: UpdateSprintInput): Promise<SprintState>;
  advanceSprint(sprintId: string, newStatus: EntityStatus): Promise<SprintState>;

  // ── Story ────────────────────────────────────────────

  getStory(sprintId: string, storyId: string): Promise<StoryState>;
  listStories(sprintId: string): Promise<StoryState[]>;
  createStory(input: CreateStoryInput): Promise<StoryState>;
  updateStory(storyId: string, input: UpdateStoryInput): Promise<StoryState>;

  // ── Task ─────────────────────────────────────────────

  getTask(storyId: string, taskId: string): Promise<TaskState>;
  listTasks(storyId: string): Promise<TaskState[]>;
  createTask(input: CreateTaskInput): Promise<TaskState>;
  updateTask(taskId: string, input: UpdateTaskInput): Promise<TaskState>;
}

// ──── State types ──────────────────────────────────────

interface RoadmapState {
  id: string;
  product_id: string;
  name: string;
  version: string;
  status: EntityStatus;
  owner: string;
  audit: AuditMetadata;
}

interface PhaseState {
  id: string;
  roadmap_id: string;
  name: string;
  order: number;
  status: EntityStatus;
  gate_status: GateStatus;
  owner: string;
  start_date?: string;
  target_date?: string;
  completion_pct: number;
  dependencies: Dependency[];
  risks: Risk[];
  blockers: Blocker[];
  audit: AuditMetadata;
}

interface WaveState {
  id: string;
  phase_id: string;
  name: string;
  order: number;
  status: EntityStatus;
  gate_status: GateStatus;
  owner: string;
  start_date?: string;
  target_date?: string;
  completion_pct: number;
  audit: AuditMetadata;
}

interface EpicState {
  id: string;
  wave_id: string;
  name: string;
  description: string;
  status: EntityStatus;
  priority: Priority;
  owner: string;
  start_date?: string;
  target_date?: string;
  completion_pct: number;
  story_points_total: number;
  story_points_completed: number;
  dependencies: Dependency[];
  risks: Risk[];
  blockers: Blocker[];
  audit: AuditMetadata;
}

interface SprintState {
  id: string;
  epic_id: string;
  name: string;
  duration_days: number;
  status: EntityStatus;
  start_date?: string;
  end_date?: string;
  completion_pct: number;
  audit: AuditMetadata;
}

interface StoryState {
  id: string;
  sprint_id: string;
  name: string;
  description: string;
  status: EntityStatus;
  points: number;
  owner: string;
  assignee?: string;
  acceptance_criteria: string[];
  audit: AuditMetadata;
}

interface TaskState {
  id: string;
  story_id: string;
  name: string;
  description: string;
  status: EntityStatus;
  owner: string;
  assignee?: string;
  resume_point?: ResumePoint;
  completion_pct: number;
  audit: AuditMetadata;
}
```

---

## 5. ExecutionRegistry

Record and query execution history, gate status, and workforce assignments.

```typescript
interface ExecutionRegistry {
  // ── Execution Events ─────────────────────────────────

  recordExecution(event: ExecutionEvent): Promise<void>;
  getExecutionHistory(entityId: string, options?: HistoryQuery): Promise<ExecutionEvent[]>;
  getLatestExecution(entityId: string): Promise<ExecutionEvent | null>;

  // ── Gate Management ──────────────────────────────────

  getGateStatus(entityType: string, entityId: string): Promise<GateState>;
  updateGateCriteria(entityType: string, entityId: string, input: GateCriteriaInput): Promise<void>;
  submitGateApproval(entityType: string, entityId: string, approver: string): Promise<GateState>;
  overrideGate(entityType: string, entityId: string, decision: "approved" | "denied", operator: string): Promise<GateState>;
}

// ──── Execution Event ──────────────────────────────────

interface ExecutionEvent {
  event_id: string;
  session_id: string;
  entity_type: "phase" | "wave" | "epic" | "sprint" | "story" | "task";
  entity_id: string;
  event_type: "started" | "completed" | "blocked" | "resumed" | "cancelled" | "checkpoint";
  performed_by: string;          // principal:<id>
  timestamp: string;             // ISO 8601
  duration_ms?: number;
  summary: string;
  details?: Record<string, unknown>;
  resume_point?: ResumePoint;
  outcome?: "success" | "failure" | "partial" | "unknown";
}

interface HistoryQuery {
  limit?: number;
  offset?: number;
  from_date?: string;
  to_date?: string;
  event_types?: string[];
  performed_by?: string;
}

// ──── Gate State ───────────────────────────────────────

interface GateState {
  entity_type: string;
  entity_id: string;
  status: GateStatus;
  entry_criteria: GateCriteria[];
  exit_criteria: GateCriteria[];
  submitted_by?: string;
  submitted_at?: string;
  approved_by?: string;
  approved_at?: string;
  override_by?: string;
  override_at?: string;
  rejection_reason?: string;
}

interface GateCriteria {
  id: string;
  description: string;
  status: "met" | "unmet" | "waived";
  verified_by?: string;
  verified_at?: string;
  evidence?: string;
}
```

---

## 6. ResumeService

Query and manage resume points — the exact state from which work should continue.

```typescript
interface ResumeService {
  getCurrentResumePoint(productId: string): Promise<ResumePoint>;
  getResumePointForEntity(entityType: string, entityId: string): Promise<ResumePoint | null>;
  setResumePoint(entityType: string, entityId: string, point: ResumePoint): Promise<void>;
  clearResumePoint(entityId: string): Promise<void>;
  getResumeHistory(productId: string, limit?: number): Promise<ResumePoint[]>;
}
```

---

## 7. PhaseService / WaveService / SprintService

Convenience services for advance/rollback operations on each hierarchy layer.

```typescript
interface PhaseService {
  getActivePhase(productId: string): Promise<PhaseState | null>;
  getPhaseHierarchy(productId: string): Promise<PhaseHierarchy>;
  advanceToNextWave(phaseId: string, approver: string): Promise<WaveState>;
  getPhaseMetrics(phaseId: string): Promise<PhaseMetrics>;
}

interface WaveService {
  getActiveWave(productId: string): Promise<WaveState | null>;
  advanceToNextEpic(waveId: string, approver: string): Promise<EpicState>;
  getWaveProgress(waveId: string): Promise<WaveProgress>;
}

interface SprintService {
  getActiveSprint(productId: string): Promise<SprintState | null>;
  getSprintBurndown(sprintId: string): Promise<SprintBurndown>;
  completeSprint(sprintId: string): Promise<SprintState>;
}

// ──── Derived types ────────────────────────────────────

interface PhaseHierarchy {
  phase: PhaseState;
  waves: WaveState[];
  active_wave?: WaveState;
  active_epic?: EpicState;
  active_sprint?: SprintState;
}

interface PhaseMetrics {
  total_waves: number;
  completed_waves: number;
  total_epics: number;
  completed_epics: number;
  total_sprints: number;
  completed_sprints: number;
  total_stories: number;
  completed_stories: number;
  total_tasks: number;
  completed_tasks: number;
  completion_pct: number;
  blockers: number;
  risks: number;
}

interface WaveProgress {
  wave: WaveState;
  epics: EpicState[];
  completed_epics: number;
  total_epics: number;
  completion_pct: number;
}

interface SprintBurndown {
  sprint: SprintState;
  total_stories: number;
  completed_stories: number;
  total_points: number;
  completed_points: number;
  remaining_points: number;
  days_elapsed: number;
  days_remaining: number;
}
```

---

## 8. WorkforceAssignmentService

Track which workforce agents are assigned to which entities.

```typescript
interface WorkforceAssignmentService {
  getCurrentAssignments(workforceId: string): Promise<Assignment[]>;
  assignAgent(workforceId: string, agentId: string, entityType: string, entityId: string, role: string): Promise<Assignment>;
  unassignAgent(assignmentId: string): Promise<void>;
  getAgentHistory(agentId: string, limit?: number): Promise<Assignment[]>;
}

interface Assignment {
  id: string;
  workforce_id: string;
  agent_id: string;
  agent_type: string;
  entity_type: string;
  entity_id: string;
  role: string;                // "developer" | "qa" | "security" | "docs" | "monitor"
  assigned_by: string;         // principal:<id>
  assigned_at: string;
  unassigned_at?: string;
  status: "active" | "completed" | "cancelled";
}
```

---

## 9. ExecutionHistoryService

Long-term, append-only execution history for auditing and analysis.

```typescript
interface ExecutionHistoryService {
  queryHistory(filter: HistoryFilter): Promise<ExecutionEvent[]>;
  getSessionTimeline(sessionId: string): Promise<ExecutionEvent[]>;
  getProductTimeline(productId: string, options?: HistoryQuery): Promise<ExecutionEvent[]>;
  getEntityTimeline(entityType: string, entityId: string, options?: HistoryQuery): Promise<ExecutionEvent[]>;
  getSummary(productId: string): Promise<ExecutionSummary>;
}

interface HistoryFilter {
  entity_type?: string;
  entity_id?: string;
  performed_by?: string;
  event_type?: string;
  from_date?: string;
  to_date?: string;
  outcome?: string;
  limit?: number;
  offset?: number;
}

interface ExecutionSummary {
  total_events: number;
  total_sessions: number;
  successful: number;
  failed: number;
  blocked: number;
  avg_duration_ms: number;
  last_event: ExecutionEvent | null;
  unique_agents: string[];
  date_range: {
    from: string;
    to: string;
  };
}
```

---

## 10. GateService

Dedicated interface for gate evaluation and approval workflow.

```typescript
interface GateService {
  evaluateEntryGate(entityType: string, entityId: string): Promise<GateEvaluation>;
  evaluateExitGate(entityType: string, entityId: string): Promise<GateEvaluation>;
  submitForApproval(entityType: string, entityId: string): Promise<GateState>;
  approve(entityType: string, entityId: string, approver: string): Promise<GateState>;
  deny(entityType: string, entityId: string, reason: string, approver: string): Promise<GateState>;
  override(entityType: string, entityId: string, decision: "approved" | "denied", operator: string): Promise<GateState>;
  getGateTemplate(entityType: string, transitionType: "entry" | "exit"): Promise<GateCriteria[]>;
}

interface GateEvaluation {
  entity_type: string;
  entity_id: string;
  gate_type: "entry" | "exit";
  overall: "pass" | "fail" | "conditional";
  criteria: GateCriteriaResult[];
  summary: string;
}

interface GateCriteriaResult {
  id: string;
  description: string;
  status: "met" | "unmet" | "waived";
  evidence?: string;
  notes?: string;
}
```

---

## 11. ProgressService

Aggregate progress metrics across any hierarchy level for dashboard and reporting.

```typescript
interface ProgressService {
  getCompanyProgress(companyId: string): Promise<CompanyProgress>;
  getProductProgress(productId: string): Promise<ProductProgress>;
  getPhaseProgress(phaseId: string): Promise<PhaseProgress>;
  getActiveExecutionContext(productId: string): Promise<ExecutionContext>;
}

interface ExecutionContext {
  company: { id: string; name: string };
  platform: { id: string; name: string; version: string };
  product: { id: string; name: string; brand: string };
  phase: PhaseState;
  wave?: WaveState;
  epic?: EpicState;
  sprint?: SprintState;
  resume_point?: ResumePoint;
  blockers: Blocker[];
}

interface CompanyProgress {
  company: string;
  products: number;
  active_products: number;
  roadmaps: number;
  total_phases: number;
  completed_phases: number;
  total_epics: number;
  completed_epics: number;
  total_tests: number;
  passing_tests: number;
  blockers: number;
}

interface ProductProgress {
  product: string;
  current_phase: string;
  current_wave: string;
  current_epic: string;
  current_sprint: string;
  phase_completion_pct: number;
  wave_completion_pct: number;
  epic_completion_pct: number;
  sprint_completion_pct: number;
  story_points_total: number;
  story_points_completed: number;
  test_pass_rate: string;
  blockers: number;
  last_execution: string | null;
  resume_point: ResumePoint | null;
}
```

---

## 12. Error Handling

All interfaces return consistent error responses:

```typescript
interface PSERResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    processing_time_ms: number;
    cache_hit: boolean;
    tenant: TenantContext;
  };
}

// Error codes
const PSER_ERRORS = {
  // Authorization
  UNAUTHORIZED:        "pser/unauthorized",
  FORBIDDEN:           "pser/forbidden",
  INSUFFICIENT_ROLE:   "pser/insufficient_role",

  // Entity
  NOT_FOUND:           "pser/not_found",
  ALREADY_EXISTS:      "pser/already_exists",
  INVALID_STATE:       "pser/invalid_state_transition",

  // Gate
  GATE_NOT_READY:      "pser/gate_not_ready",
  GATE_ALREADY_PASSED: "pser/gate_already_passed",

  // Concurrency
  CONFLICT:            "pser/conflict",               // optimistic lock version mismatch

  // Validation
  VALIDATION_ERROR:    "pser/validation_error",
  MISSING_TENANT:      "pser/missing_tenant_context",
} as const;
```

---

## 13. Interface Versioning

| Interface | Version | Stability |
|-----------|---------|-----------|
| ProjectStateService | v1 | Stable |
| RoadmapRegistry | v1 | Stable |
| ExecutionRegistry | v1 | Stable |
| ResumeService | v1 | Stable |
| PhaseService | v1 | Stable |
| WaveService | v1 | Stable |
| SprintService | v1 | Stable |
| WorkforceAssignmentService | v1 | Stable |
| ExecutionHistoryService | v1 | Stable |
| GateService | v1 | Stable |
| ProgressService | v1 | Stable |

All interfaces are provider-neutral. No product-specific or provider-specific contracts. Future versions maintain backward compatibility through interface versioning.

---

*This interface specification is authoritative for PSER v1.0 implementation.*
*All implementations must conform to these contracts.*
*Interface document — AI Platform Capability*
*Last updated: 2026-07-26*