/**
 * Wave 8 — Workflow & Automation Engine
 * Core type definitions
 */

// ============================================================================
// Workflow Definition Types
// ============================================================================

export interface WorkflowDefinition {
  id: string;
  name: string;
  version: string;
  definition: WorkflowDefinitionJSON;
  status: 'active' | 'deprecated' | 'archived';
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowDefinitionJSON {
  // BPMN-like structure
  phases: PhaseDefinition[];
  tasks: TaskDefinition[];
  rules: RuleReference[];
  approvalGates: ApprovalGateDefinition[];
  timers: TimerDefinition[];
  transitions: TransitionDefinition[];
}

export interface PhaseDefinition {
  id: string;
  name: string;
  description?: string;
  entryCriteria?: string; // FEEL expression
  exitCriteria?: string;  // FEEL expression
  tasks: string[];        // Task definition IDs
  subPhases?: string[];   // Child phase IDs
}

export interface TaskDefinition {
  id: string;
  name: string;
  type: TaskType;
  assigneeRole: string;
  priority: TaskPriority;
  slaTarget: SLATarget;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  automationRule?: string;     // Rule ID for automated tasks
  approvalGateId?: string;     // For approval tasks
  timerConfig?: TimerConfig;   // For timer tasks
  retryPolicy?: RetryPolicy;
}

export type TaskType = 
  | 'manual'      // Human performs
  | 'automated'   // Rule/API executes
  | 'approval'    // Human-in-the-loop decision
  | 'timer';      // Time-based trigger

export type TaskPriority = 'critical' | 'urgent' | 'high' | 'routine';

export interface SLATarget {
  critical: number;  // milliseconds
  urgent: number;
  high: number;
  routine: number;
}

export interface TimerConfig {
  type: 'delay' | 'recurring' | 'cron';
  delayMs?: number;
  cronExpression?: string;
  timezone?: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number[];
  retryableErrors?: string[];
}

export interface RuleReference {
  id: string;
  name: string;
  dmnFile?: string;        // Reference to DMN XML
  decisionTable?: DecisionTableInline;
}

export interface DecisionTableInline {
  hitPolicy: 'UNIQUE' | 'FIRST' | 'PRIORITY' | 'COLLECT';
  inputs: InputClause[];
  outputs: OutputClause[];
  rules: DecisionRule[];
}

export interface InputClause {
  id: string;
  name: string;
  typeRef: FEELType;
}

export interface OutputClause {
  id: string;
  name: string;
  typeRef: FEELType;
}

export interface DecisionRule {
  id: string;
  inputEntries: (string | FEELExpression)[];
  outputEntries: (string | FEELExpression)[];
  priority?: number;
  description?: string;
}

export type FEELType = 'string' | 'number' | 'boolean' | 'date' | 'duration' | 'list';

export interface FEELExpression {
  feel: string;
  type: 'expression';
}

export interface ApprovalGateDefinition {
  id: string;
  name: string;
  requiredApprovers: number;
  approvalRule?: string;      // FEEL expression for dynamic approvers
  evidencePackTemplate: EvidencePackTemplate;
  timeoutMs: number;
  escalationRule?: string;
}

export interface EvidencePackTemplate {
  sections: EvidenceSection[];
}

export interface EvidenceSection {
  id: string;
  title: string;
  dataPath: string;           // Path in workflow context
  required: boolean;
}

export interface TimerDefinition {
  id: string;
  name: string;
  trigger: TimerTrigger;
  action: TimerAction;
}

export type TimerTrigger = 
  | { type: 'task_created'; taskDefinitionId: string }
  | { type: 'state_entered'; state: string }
  | { type: 'approval_requested'; gateId: string }
  | { type: 'scheduled'; cronExpression: string; timezone?: string };

export interface TimerAction {
  type: 'escalate' | 'notify' | 'transition' | 'create_task' | 'complete_task' | 'evaluate_rules';
  config: Record<string, unknown>;
}

export interface TransitionDefinition {
  from: string;
  to: string;
  condition?: string;         // FEEL expression
  requiredTasks?: string[];   // Task IDs that must be completed
  requiredApprovals?: string[]; // Approval gate IDs
}

// ============================================================================
// Workflow Instance Types
// ============================================================================

export interface WorkflowInstance {
  id: string;
  definitionId: string;
  patientId: string;
  currentState: JourneyState;
  context: WorkflowContext;
  status: WorkflowStatus;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
  pausedAt?: number;
  pauseReason?: string;
}

export type WorkflowStatus = 
  | 'running' 
  | 'paused' 
  | 'completed' 
  | 'failed' 
  | 'cancelled';

export type JourneyState = 
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
  | 'cancelled';

export interface WorkflowContext {
  // Clinical data references (opaque IDs, no PHI)
  patientRef: string;
  cycleNumber: number;
  protocol?: string;
  medications?: MedicationRef[];
  monitoringData?: MonitoringRef[];
  embryoData?: EmbryoRef[];
  // Computed/derived
  currentDay?: number;
  leadFollicleMm?: number;
  estradiolPgml?: number;
  // User preferences
  language?: 'en-CA' | 'fr-CA';
  notificationPreferences?: NotificationPrefs;
  // Custom variables for rules
  variables: Record<string, unknown>;
}

export interface MedicationRef {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  startDate: number;
  endDate?: number;
}

export interface MonitoringRef {
  date: number;
  leadFollicleMm: number;
  estradiolPgml: number;
  cohortCount: number;
  endometrialMm?: number;
  progesterone?: number;
  lh?: number;
}

export interface EmbryoRef {
  id: string;
  day: number;
  grade?: string;
  pgtStatus?: 'euploid' | 'aneuploid' | 'pending' | 'not_tested';
  morphology?: string;
}

export interface NotificationPrefs {
  push: boolean;
  email: boolean;
  sms: boolean;
  categories: string[];
}

// ============================================================================
// Task Instance Types
// ============================================================================

export interface TaskInstance {
  id: string;
  workflowInstanceId: string;
  taskDefinitionId: string;
  name: string;
  type: TaskType;
  assigneeRole: string;
  assigneeId?: string;
  priority: TaskPriority;
  status: TaskState;
  slaDeadline?: number;
  input?: Record<string, unknown>;
  output?: Record<string, unknown>;
  createdAt: number;
  updatedAt: number;
  claimedAt?: number;
  completedAt?: number;
  escalatedAt?: number;
  escalationReason?: string;
  retryCount: number;
  lastError?: string;
}

export type TaskState = 
  | 'draft' 
  | 'requested' 
  | 'received' 
  | 'accepted' 
  | 'claimed'
  | 'in_progress' 
  | 'completed' 
  | 'failed' 
  | 'cancelled' 
  | 'escalated';

// ============================================================================
// Approval Types
// ============================================================================

export interface ApprovalGate {
  id: string;
  taskInstanceId: string;
  requiredApprovers: number;
  approvalRule?: string;
  evidencePack: EvidencePack;
  status: ApprovalStatus;
  decidedAt?: number;
  decidedBy?: string;
  decisionReason?: string;
}

export type ApprovalStatus = 'pending' | 'approved' | 'denied' | 'escalated';

export interface EvidencePack {
  taskSummary: TaskSummary;
  clinicalContext: ClinicalContext;
  ruleEvaluation?: RuleResult;
  patientPreferences?: PatientPreferences;
  riskAssessment: RiskLevel;
  alternatives: Alternative[];
  requiredApprovers: number;
  deadline: number;
}

export interface TaskSummary {
  id: string;
  name: string;
  type: TaskType;
  priority: TaskPriority;
  createdAt: number;
  slaDeadline?: number;
}

export interface ClinicalContext {
  patientRef: string;
  journeyState: JourneyState;
  currentDay?: number;
  keyMetrics: Record<string, unknown>;
  recentEvents: ClinicalEvent[];
}

export interface ClinicalEvent {
  timestamp: number;
  type: string;
  summary: string;
  data?: Record<string, unknown>;
}

export interface RuleResult {
  ruleId: string;
  ruleName: string;
  inputs: Record<string, unknown>;
  outputs: Record<string, unknown>;
  matchedRuleId: string;
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
  reasoning: string;
}

export interface PatientPreferences {
  language: 'en-CA' | 'fr-CA';
  communicationMethod: 'portal' | 'phone' | 'email';
  decisionMakingStyle: 'shared' | 'physician_led' | 'patient_led';
}

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';

export interface Alternative {
  id: string;
  description: string;
  pros: string[];
  cons: string[];
  recommended: boolean;
}

export interface ApprovalDecision {
  id: string;
  approvalGateId: string;
  approverId: string;
  decision: 'approve' | 'deny' | 'escalate';
  reason?: string;
  evidenceReviewed?: Record<string, unknown>;
  createdAt: number;
}

// ============================================================================
// Timer Types
// ============================================================================

export interface WorkflowTimer {
  id: string;
  workflowInstanceId?: string;
  taskInstanceId?: string;
  timerType: TimerType;
  fireAt: number;
  action: TimerAction;
  status: TimerStatus;
  createdAt: number;
  firedAt?: number;
}

export type TimerType = 
  | 'sla_warning' 
  | 'sla_breach' 
  | 'approval_timeout' 
  | 'delayed_action' 
  | 'recurring_monitoring' 
  | 'beta_scheduling' 
  | 'follow_up_series' 
  | 'storage_expiry';

export type TimerStatus = 'scheduled' | 'fired' | 'cancelled' | 'failed';

export interface TimerAction {
  type: 'escalate' | 'notify' | 'transition' | 'create_task' | 'complete_task' | 'evaluate_rules';
  config: Record<string, unknown>;
}

// ============================================================================
// Event Sourcing Types
// ============================================================================

export interface WorkflowEvent {
  id: string;
  workflowInstanceId: string;
  eventType: EventType;
  payload: Record<string, unknown>;
  actor: Actor;
  correlationId: string;
  causationId?: string;
  timestamp: number;
  version: number;
}

export type EventType = 
  | 'workflow.started'
  | 'workflow.state_changed'
  | 'workflow.paused'
  | 'workflow.resumed'
  | 'workflow.completed'
  | 'workflow.cancelled'
  | 'task.created'
  | 'task.claimed'
  | 'task.completed'
  | 'task.failed'
  | 'task.escalated'
  | 'task.reassigned'
  | 'approval.requested'
  | 'approval.decided'
  | 'rule.evaluated'
  | 'timer.fired'
  | 'timer.cancelled'
  | 'manual.override'
  | 'error.occurred';

export interface Actor {
  type: 'system' | 'user' | 'external';
  id: string;
  role?: string;
  name?: string;
}

// ============================================================================
// Queue Message Types
// ============================================================================

export interface TaskExecutionMessage {
  taskId: string;
  action: 'execute' | 'retry';
  attempt: number;
}

export interface SLAMevaluationMessage {
  taskIds?: string[];
  batchSize: number;
}

export interface TimerEvaluationMessage {
  timerIds?: string[];
  batchSize: number;
}

export interface EscalationMessage {
  taskId: string;
  reason: string;
  escalatedBy: Actor;
}

export interface MetricsRollupMessage {
  date: string; // YYYY-MM-DD
}

export interface NotificationDispatchMessage {
  notificationId: string;
  type: string;
  recipientId: string;
  payload: Record<string, unknown>;
}

export interface AuditLogMessage {
  event: WorkflowEvent;
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface StartWorkflowRequest {
  definitionId: string;
  patientId: string;
  initialContext?: Partial<WorkflowContext>;
}

export interface TaskActionRequest {
  action: 'claim' | 'complete' | 'reassign' | 'escalate';
  actor: Actor;
  payload?: Record<string, unknown>;
}

export interface ApprovalDecisionRequest {
  decision: 'approve' | 'deny' | 'escalate';
  approver: Actor;
  reason?: string;
  evidenceReviewed?: Record<string, unknown>;
}

export interface WorkflowSearchRequest {
  patientId?: string;
  status?: WorkflowStatus[];
  definitionId?: string;
  state?: JourneyState[];
  dateFrom?: number;
  dateTo?: number;
  limit?: number;
  offset?: number;
}

export interface TaskSearchRequest {
  assigneeId?: string;
  assigneeRole?: string;
  status?: TaskState[];
  priority?: TaskPriority[];
  workflowInstanceId?: string;
  patientId?: string;
  slaBefore?: number;
  limit?: number;
  offset?: number;
}

export interface DashboardQueueResponse {
  myTasks: TaskQueueItem[];
  teamTasks: TaskQueueItem[];
  escalations: TaskQueueItem[];
  slaAtRisk: TaskQueueItem[];
  stats: QueueStats;
}

export interface TaskQueueItem {
  id: string;
  name: string;
  workflowInstanceId: string;
  patientRef: string;
  priority: TaskPriority;
  status: TaskState;
  slaDeadline?: number;
  timeRemaining?: number;
  assigneeId?: string;
  assigneeName?: string;
  journeyState: JourneyState;
  ruleRecommendation?: RuleResult;
}

export interface QueueStats {
  activeWorkflows: number;
  tasksCompletedToday: number;
  slaCompliance24h: number;
  escalationsOpen: number;
  avgResponseTimeHours: number;
  workloadByCoordinator: CoordinatorWorkload[];
}

export interface CoordinatorWorkload {
  coordinatorId: string;
  coordinatorName: string;
  openTasks: number;
  capacityPct: number;
}

// ============================================================================
// Analytics Types
// ============================================================================

export interface OperationalMetrics {
  date: string;
  workflowsStarted: number;
  workflowsCompleted: number;
  workflowsFailed: number;
  tasksCreated: number;
  tasksCompleted: number;
  tasksEscalated: number;
  slaComplianceRate: number;
  avgTaskDurationMs: Record<TaskPriority, number>;
  queueDepthByPriority: Record<TaskPriority, number>;
}

export interface ClinicalMetrics {
  date: string;
  cyclesStarted: number;
  cyclesCompleted: number;
  cancellations: number;
  cancellationReasons: Record<string, number>;
  protocolDistribution: Record<string, number>;
  pregnancyRates: Record<string, number>;
  timeToTreatmentDays: number;
}

export interface QualityMetrics {
  week: string;
  overrideCount: number;
  overrideReasons: Record<string, number>;
  ruleDeviations: number;
  approvalTurnaroundHours: number;
  communicationResponseHours: number;
  patientSatisfactionScore?: number;
}

// ============================================================================
// Dead Letter Queue
// ============================================================================

export interface DLQEntry {
  id: string;
  originalTaskId: string;
  error: string;
  attempts: number;
  lastAttempt: number;
  payload: Record<string, unknown>;
  createdAt: number;
}

// ============================================================================
// Utility Types
// ============================================================================

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
  meta?: {
    requestId: string;
    timestamp: number;
  };
}