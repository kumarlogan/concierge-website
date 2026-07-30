// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Interface Contracts                      │
// │ ADR-018 · Capability #14                                    │
// │ Provider-neutral planning layer interfaces.                  │
// └─────────────────────────────────────────────────────────────┘

// ──── Shared Types ───────────────────────────────────────────

export type Discipline =
  | "architecture"
  | "frontend"
  | "backend"
  | "devops"
  | "security"
  | "testing"
  | "documentation";

export type Priority = "p0" | "p1" | "p2" | "p3";

export type PlanStatus =
  | "draft"
  | "pending_approval"
  | "approved"
  | "executing"
  | "completed"
  | "failed";

export type AtomStatus =
  | "planned"
  | "in_progress"
  | "completed"
  | "blocked"
  | "failed";

export type BatchStatusValue =
  | "pending"
  | "dispatched"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

export type PlanDepth = "full" | "phases_only" | "waves_only" | "epics_only";

// ──── Roadmap Hierarchy ──────────────────────────────────────

export interface RoadmapHierarchy {
  phases: PhaseDef[];
  waves: WaveDef[];
  epics: EpicDef[];
}

export interface PhaseDef {
  id: string;
  name: string;
  order: number;
  description: string;
}

export interface WaveDef {
  id: string;
  phase_id: string;
  name: string;
  order: number;
  description: string;
}

export interface EpicDef {
  id: string;
  wave_id: string;
  name: string;
  description: string;
  priority: Priority;
  estimated_stories: number;
}

export interface StoryDef {
  id: string;
  epic_id: string;
  name: string;
  description: string;
  discipline: Discipline;
  acceptance_criteria: string[];
  estimated_tasks: number;
}

export interface TaskDef {
  id: string;
  story_id: string;
  name: string;
  description: string;
  discipline: Discipline;
  file_refs: string[];
  acceptance_criteria: string[];
}

// ──── Plan Data Model ────────────────────────────────────────

export interface Plan {
  id: string;
  product_id: string;
  version: number;
  objective: string;
  status: PlanStatus;
  depth: PlanDepth;
  atoms: PlanAtom[];
  batches: ExecutionBatch[];
  checkpoints: PlanCheckpoint[];
  budget: ContextBudget;
  total_tokens_estimated: number;
  created_at: string;
  created_by: string;
  approved_at?: string;
  approved_by?: string;
}

export interface PlanAtom {
  id: string;
  plan_id: string;
  parent_id: string | null;
  atom_type: "epic" | "story" | "task";
  name: string;
  description: string;
  discipline: Discipline;
  priority: Priority;
  status: AtomStatus;
  acceptance_criteria: string[];
  dependencies: string[];         // atom IDs this depends on
  dependents: string[];           // atom IDs that depend on this
  estimated_tokens: number;
  batch_id: string | null;
  checkpoint_data: Record<string, unknown> | null;
  version: number;
}

export interface ExecutionBatch {
  id: string;
  plan_id: string;
  discipline: Discipline;
  status: BatchStatusValue;
  atom_ids: string[];
  total_atoms: number;
  completed_atoms: number;
  estimated_tokens: number;
  dispatch_order: number;
  created_at: string;
  dispatched_at: string | null;
  completed_at: string | null;
}

export interface PlanCheckpoint {
  id: string;
  plan_id: string;
  batch_id: string;
  last_completed_atom_id: string | null;
  next_atom_id: string;
  completed_atom_ids: string[];
  status: "active" | "superseded" | "closed";
  token_used: number;
  context_summary: string;
  created_at: string;
  superseded_at: string | null;
}

// ──── Budgeting ──────────────────────────────────────────────

export interface ContextBudget {
  total_estimated_tokens: number;
  roadmap_tokens: number;
  planning_overhead_tokens: number;
  execution_reserve_tokens: number;
  fits_in_window: boolean;
  remaining_tokens: number;
  sessions_required: number;
}

export interface TokenEstimate {
  item_id: string;
  item_type: string;
  estimated_tokens: number;
  breakdown: TokenBreakdown;
}

export interface TokenBreakdown {
  description_cost: number;
  acceptance_criteria_cost: number;
  file_refs_cost: number;
  dependency_cost: number;
  overhead: number;
}

// ──── Dependency Management ──────────────────────────────────

export interface DependencyMap {
  edges: DependencyEdge[];
  graph: Record<string, string[]>;  // node ID → dependent node IDs
  topo_order: string[];             // topological sort
  critical_path: string[];          // longest dependency chain
}

export interface DependencyEdge {
  from_id: string;
  to_id: string;
  type: "blocks" | "blocked_by" | "related_to";
}

export interface DependencyGraph {
  nodes: PlanAtom[];
  edges: DependencyEdge[];
  layers: string[][];               // parallel execution layers
}

// ──── Discipline Routing ─────────────────────────────────────

export interface DisciplineAssignment {
  atom_id: string;
  discipline: Discipline;
  confidence: number;               // 0.0 - 1.0
  reasoning: string;
}

export interface ParallelWorkstream {
  discipline: Discipline;
  atoms: PlanAtom[];
  estimated_tokens: number;
}

// ──── Dashboard / Reporting ──────────────────────────────────

export interface PlanSummary {
  plan_id: string;
  version: number;
  status: PlanStatus;
  objective: string;
  total_atoms: number;
  completed_atoms: number;
  blocked_atoms: number;
  total_disciplines: number;
  active_disciplines: number;
  total_batches: number;
  active_batches: number;
  completed_batches: number;
  estimated_tokens_total: number;
  estimated_tokens_remaining: number;
  progress_pct: number;
}

export interface BatchStatusReport {
  batch_id: string;
  plan_id: string;
  discipline: Discipline;
  status: BatchStatusValue;
  total_atoms: number;
  completed_atoms: number;
  blocked_atoms: number;
  estimated_tokens: number;
  completed_atom_ids: string[];
  next_atom_id: string | null;
}

export interface DisciplineReport {
  discipline: Discipline;
  total_atoms: number;
  completed_atoms: number;
  in_progress_atoms: number;
  blocked_atoms: number;
  estimated_tokens: number;
  atoms: PlanAtom[];
}

export interface BlockerReport {
  total_blockers: number;
  blockers: BlockerItem[];
}

export interface BlockerItem {
  atom_id: string;
  atom_name: string;
  discipline: Discipline;
  blocker_type: string;
  description: string;
}

export interface TokenReport {
  total_estimated: number;
  total_used: number;
  total_remaining: number;
  budget_limit: number;
  over_budget: boolean;
  overage_pct: number;
  by_discipline: Record<Discipline, number>;
}

export interface OperatorBriefing {
  plan_summary: string;
  current_batch: string | null;
  active_disciplines: string[];
  blockers: number;
  progress_pct: number;
  tokens_remaining: number;
  estimated_sessions: number;
  key_decisions_needed: string[];
  next_action: string;
}

// ──── Session Plan (cross-session decomposition) ─────────────

export interface SessionPlan {
  session_number: number;
  total_sessions: number;
  atoms: PlanAtom[];
  estimated_tokens: number;
  context_budget: ContextBudget;
  resume_from_session: boolean;
  checkpoint_atom_id: string | null;
}

// ──── Configuration ──────────────────────────────────────────

export interface EpclConfig {
  enabled: boolean;
  max_plan_tokens: number;
  max_depth: PlanDepth;
  default_discipline: Discipline;
  parallelism: boolean;
  auto_approve: boolean;
  disciplines: Discipline[];
}