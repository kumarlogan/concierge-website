// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Executive Planning & Control Layer Types      │
// │ EPIC-005 Phase 3 — Executive Planning Workflow              │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘
//
// This file defines all types for the EPCL layer.
// EPCL is a PLANNING layer — it never executes work directly.
// WEF remains the sole execution engine.
// Intent Engine remains the entry point.

// ══════════════════════════════════════════════════════════════
// Feature Flags
// ══════════════════════════════════════════════════════════════

export enum FeatureFlag {
  ENABLE_EXECUTIVE_WORKFLOW = "ENABLE_EXECUTIVE_WORKFLOW",
  ENABLE_ROADMAP_INGESTION = "ENABLE_ROADMAP_INGESTION",
  ENABLE_BATCH_GENERATION = "ENABLE_BATCH_GENERATION",
  ENABLE_EXECUTIVE_REPORTING = "ENABLE_EXECUTIVE_REPORTING",
  ENABLE_AUTONOMOUS_EXECUTION = "ENABLE_AUTONOMOUS_EXECUTION",
  ENABLE_KNOWLEDGE_CAPTURE = "ENABLE_KNOWLEDGE_CAPTURE",
}

export const DEFAULT_FLAG_STATE: Record<FeatureFlag, boolean> = {
  [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: false,
  [FeatureFlag.ENABLE_ROADMAP_INGESTION]: false,
  [FeatureFlag.ENABLE_BATCH_GENERATION]: false,
  [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: false,
  [FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: false,
  [FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE]: false,
};

// ══════════════════════════════════════════════════════════════
// Roadmap Types
// ══════════════════════════════════════════════════════════════

export interface Roadmap {
  id: string;
  title: string;
  description: string;
  phases: RoadmapPhase[];
  dependencies: Dependency[];
  metadata: RoadmapMetadata;
  createdAt: string;
  updatedAt: string;
}

export interface RoadmapPhase {
  id: string;
  name: string;
  description: string;
  order: number;
  epics: RoadmapEpic[];
  status: PhaseStatus;
  startedAt?: string;
  completedAt?: string;
}

export enum PhaseStatus {
  PLANNED = "planned",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  BLOCKED = "blocked",
  CANCELLED = "cancelled",
}

export interface RoadmapEpic {
  id: string;
  name: string;
  description: string;
  milestones: RoadmapMilestone[];
  dependencies: string[];
  parallelizable: boolean;
  estimatedEffort: string; // e.g. "3d", "2w", "1m"
  priority: number;
  status: EpicStatus;
  assignedDisciplines: string[];
  requiredCapabilities: string[];
  acceptanceCriteria: string[];
  blockedBy: string[];
  blocking: string[];
}

export enum EpicStatus {
  BACKLOG = "backlog",
  READY = "ready",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  BLOCKED = "blocked",
  CANCELLED = "cancelled",
}

export interface RoadmapMilestone {
  id: string;
  name: string;
  description: string;
  order: number;
  dueDate?: string;
  status: MilestoneStatus;
  deliverables: string[];
  verificationCriteria: string[];
}

export enum MilestoneStatus {
  PENDING = "pending",
  IN_PROGRESS = "in_progress",
  VERIFIED = "verified",
  FAILED = "failed",
  SKIPPED = "skipped",
}

export interface Dependency {
  id: string;
  sourceId: string;       // The entity that depends on another
  targetId: string;       // The entity that must be completed first
  type: DependencyType;
  description: string;
  satisfied: boolean;
  satisfiedAt?: string;
}

export enum DependencyType {
  BLOCKS = "blocks",             // source cannot start until target is done
  REQUIRES = "requires",         // source requires target's output
  CONSTRAINS = "constrains",     // source is constrained by target's state
  INFORMATIONAL = "informational", // source should be aware of target
}

export interface RoadmapMetadata {
  source: string;               // e.g. "markdown", "yaml", "manual"
  version: string;
  author: string;
  approved: boolean;
  approvedAt?: string;
  approvedBy?: string;
  tags: string[];
  references: string[];
}

// ══════════════════════════════════════════════════════════════
// Execution Plan Types
// ══════════════════════════════════════════════════════════════

export interface ExecutionPlan {
  id: string;
  roadmapId: string;
  title: string;
  description: string;
  phases: PlanPhase[];
  dependencies: ResolvedDependency[];
  batches: ExecutionBatch[];
  status: PlanStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  completedAt?: string;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  approvalRequired: boolean;
  approvalBriefing?: string;
}

export interface PlanPhase {
  id: string;
  roadmapPhaseId: string;
  name: string;
  order: number;
  status: PhaseStatus;
  batches: string[]; // batch IDs
}

export interface ResolvedDependency {
  id: string;
  sourceId: string;
  targetId: string;
  type: DependencyType;
  description: string;
  satisfied: boolean;
  satisfactionCriteria: string;
  satisfiedAt?: string;
}

export enum PlanStatus {
  DRAFT = "draft",
  PENDING_APPROVAL = "pending_approval",
  APPROVED = "approved",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLED = "cancelled",
  PAUSED = "paused",
}

export interface ExecutionBatch {
  id: string;
  planId: string;
  name: string;
  description: string;
  order: number;
  tasks: ExecutionTask[];
  dependencies: string[]; // batch IDs this batch depends on
  status: BatchStatus;
  discipline: string;
  capabilities: string[];
  tokenBudget: number;
  contextBudget: number;
  estimatedDuration: string;
  startedAt?: string;
  completedAt?: string;
  checkpoint: BatchCheckpoint;
  resumeToken: string;
}

export interface ExecutionTask {
  id: string;
  batchId: string;
  name: string;
  description: string;
  type: TaskType;
  capabilityId: string;
  discipline: string;
  input: Record<string, unknown>;
  expectedOutput: string;
  acceptanceCriteria: string[];
  status: TaskStatus;
  dependencies: string[];
  startedAt?: string;
  completedAt?: string;
  result?: TaskResult;
  error?: string;
}

export enum TaskType {
  CAPABILITY = "capability",       // Execute a known capability
  WORKFLOW = "workflow",           // Run a multi-step workflow
  ANALYSIS = "analysis",           // Analyze data or state
  VERIFICATION = "verification",   // Verify output or state
  DECISION = "decision",           // Requires human decision
}

export enum TaskStatus {
  PENDING = "pending",
  READY = "ready",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
  BLOCKED = "blocked",
}

export interface TaskResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  duration: number;
  tokenConsumed: number;
  contextUsed: number;
  evidence: string[];
  completedAt: string;
}

export interface BatchCheckpoint {
  completedTasks: string[];
  failedTasks: string[];
  skippedTasks: string[];
  runningTasks: string[];
  progress: number; // 0.0 – 1.0
  contextBudgetRemaining: number;
  tokenBudgetRemaining: number;
}

export enum BatchStatus {
  PENDING = "pending",
  READY = "ready",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
  BLOCKED = "blocked",
  PAUSED = "paused",
}

// ══════════════════════════════════════════════════════════════
// Capability Selection Types
// ══════════════════════════════════════════════════════════════

export interface CapabilitySelection {
  capabilityId: string;
  selectionReason: SelectionReason;
  source: CapabilitySource;
  provider: string;
  requiresApproval: boolean;
  estimatedCost: number;
  fallbackCapabilities: string[];
}

export enum SelectionReason {
  EXISTING_CAPABILITY = "existing_capability",       // Already exists in registry
  EXISTING_WORKFLOW = "existing_workflow",           // Already part of a workflow
  EXISTING_KNOWLEDGE = "existing_knowledge",         // Knowledge exists for this
  EXISTING_AGENT = "existing_agent",                 // An agent is already configured
  NEW_WORK = "new_work",                             // No existing path — must create
}

export enum CapabilitySource {
  PROVIDER_REGISTRY = "provider_registry",
  APP_ROUTING = "app_routing",
  TOOL_PROVIDER = "tool_provider",
  KNOWLEDGE_BASE = "knowledge_base",
  NEW_REGISTRATION = "new_registration",
}

export interface CapabilityAvailability {
  capabilityId: string;
  available: boolean;
  provider: string | null;
  healthy: boolean;
  enabled: boolean;
  active: boolean;
  approvalRequired: boolean;
  error?: string;
}

// ══════════════════════════════════════════════════════════════
// Discipline Types
// ══════════════════════════════════════════════════════════════

export enum Discipline {
  RESEARCH_INTELLIGENCE = "research_intelligence",
  ARCHITECTURE_STRATEGY = "architecture_strategy",
  EXPERIENCE_DESIGN = "experience_design",
  ENGINEERING_QUALITY = "engineering_quality",
  BUSINESS_GROWTH = "business_growth",
  PLATFORM_INTELLIGENCE = "platform_intelligence",
}

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  [Discipline.RESEARCH_INTELLIGENCE]: "Research Intelligence",
  [Discipline.ARCHITECTURE_STRATEGY]: "Architecture & Strategy",
  [Discipline.EXPERIENCE_DESIGN]: "Experience & Design",
  [Discipline.ENGINEERING_QUALITY]: "Engineering & Quality",
  [Discipline.BUSINESS_GROWTH]: "Business & Growth",
  [Discipline.PLATFORM_INTELLIGENCE]: "Platform Intelligence & Learning",
};

export interface DisciplineSelection {
  discipline: Discipline;
  justification: string;
  requiredCapabilities: string[];
  activationScope: string;
  estimatedLoad: string;
}

export interface DisciplineActivation {
  discipline: Discipline;
  active: boolean;
  activatedAt: string;
  scope: string;
  capabilities: string[];
  batches: string[];
  completedTasks: number;
  failedTasks: number;
  utilization: number; // 0.0 – 1.0
}

// ══════════════════════════════════════════════════════════════
// Approval Types
// ══════════════════════════════════════════════════════════════

export interface ApprovalEvaluation {
  required: boolean;
  type: ApprovalType | null;
  reason: string;
  briefing: ApprovalBriefing | null;
  escalationTo: string | null;
}

export enum ApprovalType {
  CONSTITUTIONAL = "constitutional",
  PRODUCT = "product",
  SECURITY = "security",
  INFRASTRUCTURE = "infrastructure",
  DEPLOYMENT = "deployment",
}

export interface ApprovalBriefing {
  title: string;
  summary: string;
  impact: string;
  risks: string[];
  alternatives: string[];
  decisions: string[];
  context: Record<string, unknown>;
  generatedAt: string;
}

export interface ApprovalRequest {
  id: string;
  type: ApprovalType;
  planId: string;
  batchId?: string;
  briefing: ApprovalBriefing;
  status: ApprovalRequestStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  decision?: string;
  notes?: string;
}

export enum ApprovalRequestStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected",
  DEFERRED = "deferred",
  CANCELLED = "cancelled",
}

// ══════════════════════════════════════════════════════════════
// Budget Types
// ══════════════════════════════════════════════════════════════

export interface TokenBudget {
  total: number;
  consumed: number;
  remaining: number;
  reserved: number;
  batchLimit: number;
  perTaskLimit: number;
  resetStrategy: TokenResetStrategy;
  resetAt: string;
}

export enum TokenResetStrategy {
  DAILY = "daily",
  WEEKLY = "weekly",
  MONTHLY = "monthly",
  PER_PLAN = "per_plan",
}

export interface ContextBudget {
  maxTokens: number;
  currentUsage: number;
  remaining: number;
  batchReservation: number;
  perTaskReservation: number;
  strategy: ContextStrategy;
}

export enum ContextStrategy {
  INCREMENTAL = "incremental",   // Load context as needed
  RESERVED = "reserved",         // Reserve per batch
  DYNAMIC = "dynamic",           // Dynamic allocation
}

export interface BudgetSnapshot {
  tokenBudget: TokenBudget;
  contextBudget: ContextBudget;
  planId: string;
  batchId?: string;
  timestamp: string;
  warnings: string[];
  violations: BudgetViolation[];
}

// ══════════════════════════════════════════════════════════════
// Executive Report Types
// ══════════════════════════════════════════════════════════════

export interface ExecutiveReport {
  id: string;
  planId: string;
  title: string;
  generatedAt: string;
  summary: ReportSummary;
  progress: ProgressReport;
  approvals: ApprovalStatusReport;
  disciplineReport: DisciplineUtilizationReport;
  capabilityReport: CapabilityUtilizationReport;
  budgetReport: BudgetReport;
  knowledgeReport: KnowledgeGrowthReport;
  forecast: ForecastReport;
  recommendations: string[];
}

export interface ReportSummary {
  status: PlanStatus;
  activeBatches: number;
  completedBatches: number;
  totalBatches: number;
  blockers: Blocker[];
  overallProgress: number; // 0.0 – 1.0
  estimatedCompletion: string;
  confidence: number; // 0.0 – 1.0
}

export interface Blocker {
  id: string;
  description: string;
  severity: BlockerSeverity;
  impactedBatches: string[];
  impactedTasks: string[];
  owner: string;
  status: BlockerResolutionStatus;
  createdAt: string;
  resolvedAt?: string;
}

export enum BlockerSeverity {
  LOW = "low",
  MEDIUM = "medium",
  HIGH = "high",
  CRITICAL = "critical",
}

export enum BlockerResolutionStatus {
  OPEN = "open",
  IN_PROGRESS = "in_progress",
  RESOLVED = "resolved",
  WORKAROUND = "workaround",
  ACCEPTED = "accepted",
}

export interface ProgressReport {
  overall: number;
  byPhase: PhaseProgress[];
  byDiscipline: DisciplineProgress[];
  velocity: number;         // batches per day
  velocityTrend: "increasing" | "stable" | "decreasing";
  remainingWork: number;    // estimated remaining batches
  scheduleVariance: number; // days ahead (+) or behind (-)
}

export interface PhaseProgress {
  phaseId: string;
  name: string;
  progress: number;
  batchesCompleted: number;
  batchesTotal: number;
  status: PhaseStatus;
  blockers: string[];
}

export interface DisciplineProgress {
  discipline: Discipline;
  progress: number;
  completedBatches: number;
  totalBatches: number;
  activeBatches: number;
  utilization: number;
}

export interface ApprovalStatusReport {
  pending: number;
  approved: number;
  rejected: number;
  deferred: number;
  averageLatency: string;
  byType: Record<ApprovalType, ApprovalStats>;
}

export interface ApprovalStats {
  pending: number;
  approved: number;
  rejected: number;
  averageLatencyMs: number;
}

export interface DisciplineUtilizationReport {
  byDiscipline: Record<Discipline, DisciplineMetrics>;
  activationFrequency: Record<Discipline, number>;
  underutilized: Discipline[];
  overutilized: Discipline[];
}

export interface DisciplineMetrics {
  activations: number;
  totalBatches: number;
  completedBatches: number;
  failedBatches: number;
  averageDuration: string;
  totalTokenConsumption: number;
  totalContextUsage: number;
  knowledgeCaptured: number;
  utilizationRate: number;
}

export interface CapabilityUtilizationReport {
  byCapability: Record<string, CapabilityMetrics>;
  mostUsed: string[];
  leastUsed: string[];
  recommendations: string[];
}

export interface CapabilityMetrics {
  invocations: number;
  successCount: number;
  failureCount: number;
  averageDuration: number;
  totalTokenConsumption: number;
  approvalRate: number;
  lastInvoked: string;
  provider: string;
}

export interface BudgetReport {
  tokenBudget: TokenBudgetReport;
  contextBudget: ContextBudgetReport;
  violations: BudgetViolation[];
  adherence: number; // 0.0 – 1.0
}

export interface TokenBudgetReport {
  total: number;
  consumed: number;
  remaining: number;
  byDiscipline: Record<Discipline, number>;
  byBatch: Record<string, number>;
  projectedExhaustion: string;
}

export interface ContextBudgetReport {
  maxTokens: number;
  currentUsage: number;
  remaining: number;
  peakUsage: number;
  averageUsage: number;
  byBatch: Record<string, number>;
}

export interface BudgetViolation {
  batchId: string;
  taskId: string;
  type: "token" | "context";
  budget: number;
  actual: number;
  timestamp: string;
  action: "warn" | "pause" | "fail";
}

export interface KnowledgeGrowthReport {
  totalEntries: number;
  entriesThisReport: number;
  byType: Record<string, number>;
  reuseRate: number;
  topContributors: string[];
  growthRate: number; // entries per day
}

export interface ForecastReport {
  estimatedCompletion: string;
  confidence: number;
  remainingBatches: number;
  remainingDuration: string;
  projectedTokenConsumption: number;
  projectedContextUsage: number;
  riskFactors: RiskFactor[];
  recommendedActions: string[];
}

export interface RiskFactor {
  description: string;
  probability: number; // 0.0 – 1.0
  impact: number;      // 0.0 – 1.0
  mitigation: string;
  contingency: string;
}

// ══════════════════════════════════════════════════════════════
// Knowledge Capture Types
// ══════════════════════════════════════════════════════════════

export interface KnowledgeEntry {
  id: string;
  batchId: string;
  planId: string;
  type: KnowledgeType;
  title: string;
  content: string;
  source: string;
  evidence: string[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
  reuseCount: number;
  lastReusedAt: string | null;
}

export enum KnowledgeType {
  DECISION = "decision",
  LESSON_LEARNED = "lesson_learned",
  REUSABLE_KNOWLEDGE = "reusable_knowledge",
  EVIDENCE = "evidence",
  ADR_REFERENCE = "adr_reference",
  STANDARDS_UPDATE = "standards_update",
  CAPABILITY_IMPROVEMENT = "capability_improvement",
}

export enum KnowledgeRelevance {
  LOW = 1,
  MEDIUM = 5,
  HIGH = 10,
}

export interface KnowledgeQuery {
  byType?: KnowledgeType[];
  byTags?: string[];
  byBatch?: string;
  byPlan?: string;
  text?: string;
  limit?: number;
  offset?: number;
}

// ══════════════════════════════════════════════════════════════
// Recovery & Resume Types
// ══════════════════════════════════════════════════════════════

export interface ExecutionState {
  planId: string;
  activeBatch: string | null;
  completedBatches: string[];
  failedBatches: string[];
  pendingBatches: string[];
  blockedBatches: string[];
  pendingApprovals: ApprovalRequest[];
  dependencyGraph: DependencyGraph;
  contextBudget: ContextBudget;
  tokenBudget: TokenBudget;
  checkpoint: ExecutionCheckpoint;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionCheckpoint {
  completedTasks: string[];
  completedBatches: string[];
  failedTasks: string[];
  failedBatches: string[];
  pendingApprovalRequests: string[];
  lastCompletedBatch: string | null;
  lastFailedBatch: string | null;
  progress: number;
  contextBudgetRemaining: number;
  tokenBudgetRemaining: number;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  topologicalOrder: string[];
  cycles: string[][];
}

export interface DependencyNode {
  id: string;
  type: "batch" | "task" | "phase";
  name: string;
  status: string;
  completed: boolean;
}

export interface DependencyEdge {
  sourceId: string;
  targetId: string;
  type: DependencyType;
  satisfied: boolean;
}

// ══════════════════════════════════════════════════════════════
// Observability Types
// ══════════════════════════════════════════════════════════════

export interface WorkflowMetrics {
  workflowId: string;
  workflowName: string;
  startTime: string;
  endTime: string | null;
  duration: number;
  stages: StageMetrics[];
  totalStages: number;
  completedStages: number;
  failedStages: number;
  status: string;
}

export interface StageMetrics {
  name: string;
  duration: number;
  status: string;
  inputSize: number;
  outputSize: number;
  error?: string;
}

export interface ObservabilityEvent {
  id: string;
  type: ObservabilityEventType;
  workflowId: string;
  stage: string;
  timestamp: string;
  duration: number;
  status: string;
  metadata: Record<string, unknown>;
  error?: string;
}

export enum ObservabilityEventType {
  WORKFLOW_START = "workflow.start",
  WORKFLOW_COMPLETE = "workflow.complete",
  WORKFLOW_FAIL = "workflow.fail",
  STAGE_START = "stage.start",
  STAGE_COMPLETE = "stage.complete",
  STAGE_FAIL = "stage.fail",
  BATCH_START = "batch.start",
  BATCH_COMPLETE = "batch.complete",
  BATCH_FAIL = "batch.fail",
  APPROVAL_REQUESTED = "approval.requested",
  APPROVAL_RESOLVED = "approval.resolved",
  RESUME = "resume",
  CHECKPOINT = "checkpoint",
}

// ══════════════════════════════════════════════════════════════
// Workflow Stage Types
// ══════════════════════════════════════════════════════════════

export enum WorkflowStage {
  ROADMAP_ANALYSIS = "roadmap_analysis",
  DEPENDENCY_RESOLUTION = "dependency_resolution",
  EXECUTION_PLAN = "execution_plan",
  CAPABILITY_SELECTION = "capability_selection",
  DISCIPLINE_SELECTION = "discipline_selection",
  BATCH_GENERATION = "batch_generation",
  APPROVAL_CHECK = "approval_check",
  WEF_DELEGATION = "wef_delegation",
  EXECUTION_MONITORING = "execution_monitoring",
  VERIFICATION = "verification",
  KNOWLEDGE_CAPTURE = "knowledge_capture",
  EXECUTIVE_REPORT = "executive_report",
}

export const WORKFLOW_STAGE_ORDER: WorkflowStage[] = [
  WorkflowStage.ROADMAP_ANALYSIS,
  WorkflowStage.DEPENDENCY_RESOLUTION,
  WorkflowStage.EXECUTION_PLAN,
  WorkflowStage.CAPABILITY_SELECTION,
  WorkflowStage.DISCIPLINE_SELECTION,
  WorkflowStage.BATCH_GENERATION,
  WorkflowStage.APPROVAL_CHECK,
  WorkflowStage.WEF_DELEGATION,
  WorkflowStage.EXECUTION_MONITORING,
  WorkflowStage.VERIFICATION,
  WorkflowStage.KNOWLEDGE_CAPTURE,
  WorkflowStage.EXECUTIVE_REPORT,
];

export interface StageResult {
  stage: WorkflowStage;
  ok: boolean;
  output: unknown;
  duration: number;
  error?: string;
  checkpoint?: unknown;
}

// ══════════════════════════════════════════════════════════════
// Recovery Types
// ══════════════════════════════════════════════════════════════

export interface RecoverySnapshot {
  id: string;
  planId: string;
  planStatus: PlanStatus;
  batchSnapshots: BatchRecoverySnapshot[];
  createdAt: string;
  version: number;
  stateHash: string;
}

export interface BatchRecoverySnapshot {
  batchId: string;
  status: BatchStatus;
  checkpoint: BatchCheckpoint;
  resolution?: {
    action: string;
    reason: string;
  };
}

export interface PlanState {
  planId: string;
  status: PlanStatus;
  batches: string[];
  activeBatchId: string | null;
  completedBatches: number;
  failedBatches: number;
  startedAt: string | null;
  completedAt: string | null;
}

// ══════════════════════════════════════════════════════════════
// EPCL Configuration
// ══════════════════════════════════════════════════════════════

export interface EPCLConfig {
  flags: Record<FeatureFlag, boolean>;
  tokenBudget: {
    defaultTotal: number;
    defaultBatchLimit: number;
    defaultPerTaskLimit: number;
    resetStrategy: TokenResetStrategy;
  };
  contextBudget: {
    maxTokens: number;
    batchReservation: number;
    perTaskReservation: number;
    strategy: ContextStrategy;
  };
  execution: {
    maxConcurrentBatches: number;
    approvalTimeout: string;
    batchTimeout: string;
    maxRetries: number;
    checkpointInterval: number;
  };
  reporting: {
    autoReportInterval: string;
    maxReportEntries: number;
    includeBlockers: boolean;
    includeBudget: boolean;
  };
  knowledge: {
    autoCapture: boolean;
    maxEntriesPerBatch: number;
    minReuseScore: number;
  };
  recovery: {
    autoResume: boolean;
    maxResumeAttempts: number;
    stateRetentionDays: number;
  };
}

export const DEFAULT_EPCL_CONFIG: EPCLConfig = {
  flags: { ...DEFAULT_FLAG_STATE },
  tokenBudget: {
    defaultTotal: 100_000,
    defaultBatchLimit: 25_000,
    defaultPerTaskLimit: 5_000,
    resetStrategy: TokenResetStrategy.DAILY,
  },
  contextBudget: {
    maxTokens: 65_000,
    batchReservation: 15_000,
    perTaskReservation: 3_000,
    strategy: ContextStrategy.INCREMENTAL,
  },
  execution: {
    maxConcurrentBatches: 1,
    approvalTimeout: "24h",
    batchTimeout: "2h",
    maxRetries: 3,
    checkpointInterval: 60_000, // every 60s
  },
  reporting: {
    autoReportInterval: "6h",
    maxReportEntries: 100,
    includeBlockers: true,
    includeBudget: true,
  },
  knowledge: {
    autoCapture: false,
    maxEntriesPerBatch: 10,
    minReuseScore: 0.3,
  },
  recovery: {
    autoResume: false,
    maxResumeAttempts: 3,
    stateRetentionDays: 30,
  },
};