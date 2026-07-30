// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Barrel Export                            │
// │ Single entry point for all EPCL modules.                    │
// │ Usage: import { ExecutivePlanningWorkflow } from "./epcl";  │
// └─────────────────────────────────────────────────────────────┘

// ── Types ────────────────────────────────────────────────────

export {
  FeatureFlag,
  PlanStatus,
  BatchStatus,
  TaskStatus,
  ContextStrategy,
  TokenResetStrategy,
  WorkflowStage,
  KnowledgeType,
  KnowledgeRelevance,
  WORKFLOW_STAGE_ORDER,
  DEFAULT_FLAG_STATE,
  DEFAULT_EPCL_CONFIG,
} from "./types.js";

export type {
  Roadmap,
  RoadmapPhase,
  Dependency,
  RoadmapMetadata,
  ExecutionPlan,
  ExecutionBatch,
  ExecutionTask,
  BatchCheckpoint,
  ApprovalRequest,
  StageResult,
  KnowledgeEntry,
  KnowledgeQuery,
  EPCLConfig,
  PlanState,
  RecoverySnapshot,
  BatchRecoverySnapshot,
  ExecutionState,
  ExecutionCheckpoint,
  DependencyGraph,
  ContextBudget,
  TokenBudget,
} from "./types.js";

// ── Feature Flags ────────────────────────────────────────────

export {
  initializeFlags,
  isEnabled,
  enableFlag,
  disableFlag,
  setFlags,
  getFlags,
  getConfig,
  resetFlags,
  requireExecutiveWorkflow,
  withFlag,
  withFlagOr,
} from "./feature-flags.js";

// ── Core Services ────────────────────────────────────────────

export {
  RoadmapEngine,
  RoadmapParseError,
  RoadmapValidationError,
  type RoadmapAnalysis,
  type PhaseAnalysis,
} from "./roadmap-engine.js";
export {
  CapabilitySelector,
  CapabilitySelectionError,
} from "./capability-selector.js";
export {
  DisciplineSelector,
  DisciplineSelectionError,
} from "./discipline-selector.js";
export {
  ExecutionPlanner,
  ExecutionPlannerError,
} from "./execution-planner.js";
export {
  ApprovalManager,
  ApprovalError,
} from "./approval-manager.js";
export {
  ContextBudgetManager,
} from "./context-budget-manager.js";
export {
  TokenBudgetManager,
} from "./token-budget-manager.js";
export {
  ExecutiveReporter,
} from "./executive-reporter.js";
export {
  KnowledgeCapturer,
  KnowledgeCaptureError,
} from "./knowledge-capturer.js";
export {
  RecoveryManager,
  RecoveryError,
  type ResumeInstruction,
  type FailureResolution,
} from "./recovery-manager.js";

// ── Workflow ─────────────────────────────────────────────────

export {
  ExecutivePlanningWorkflow,
  type WorkflowResult,
} from "./executive-workflow.js";
