// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Types & Activation State Machine          │
// │ Workforce Activation Service — activation boundary between  │
// │ EPCL (planning) and WEF (execution). Fail-closed by default.│
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import type { ExecutionPlan, ExecutionBatch, EPCLConfig } from "../epcl/types.js";

// ══════════════════════════════════════════════════════════════
// Activation State Machine
// ══════════════════════════════════════════════════════════════

/**
 * Activation lifecycle states for a plan being activated through WAS.
 *
 * Non-activated plans never reach WEF. All autonomous execution is
 * disabled by default — must be explicitly enabled via feature flags.
 *
 * State transitions (deterministic, fail-closed):
 *   PENDING → VALIDATING → ACTIVATING → ACTIVE → DEACTIVATING → DEACTIVATED
 *   PENDING → FAILED
 *   VALIDATING → FAILED
 *   VALIDATING → REJECTED
 *   ACTIVATING → FAILED
 *   ACTIVE → DEACTIVATING
 *   DEACTIVATING → FAILED
 *   DEACTIVATING → DEACTIVATED
 */
export enum ActivationState {
  /** Plan received but not yet processed. */
  PENDING = "pending",
  /** Plan is undergoing constitutional validation. */
  VALIDATING = "validating",
  /** Validation passed — batches being activated for WEF delegation. */
  ACTIVATING = "activating",
  /** Plan is actively executing through WEF. */
  ACTIVE = "active",
  /** Plan is being deactivated (graceful shutdown / cancellation). */
  DEACTIVATING = "deactivating",
  /** Plan fully deactivated. Terminal state. */
  DEACTIVATED = "deactivated",
  /** Validation or activation failed. Terminal state. */
  FAILED = "failed",
  /** Plan was rejected by constitutional validation. Terminal state. */
  REJECTED = "rejected",
}

// ══════════════════════════════════════════════════════════════
// Activation Lifecycle — immutable record of a plan's activation
// ══════════════════════════════════════════════════════════════

export interface ActivationLifecycle {
  /** Unique activation identifier. */
  id: string;
  /** The EPCL plan this activation is based on. */
  planId: string;
  /** Current activation state. */
  state: ActivationState;
  /** Timestamp when the activation was created (ISO-8601). */
  createdAt: string;
  /** Timestamp of the last state transition (ISO-8601). */
  updatedAt: string;
  /** Timestamp when activation completed or failed (ISO-8601; null if still active). */
  completedAt: string | null;
  /** Idempotency key — prevents duplicate activation of the same plan. */
  idempotencyKey: string;
  /** Constitutional validation result (null until validated). */
  validation: ValidationResult | null;
  /** Batches that have been activated for WEF delegation. */
  activatedBatches: ActivatedBatch[];
  /** Error details if in FAILED state. */
  failure: ActivationFailure | null;
  /** Rejection details if in REJECTED state. */
  rejection: RejectionDetail | null;
}

export interface ActivatedBatch {
  /** The batch ID from the EPCL execution plan. */
  batchId: string;
  /** Activation status of this individual batch. */
  status: BatchActivationStatus;
  /** Timestamp when the batch was activated (ISO-8601). */
  activatedAt: string | null;
  /** WEF delegation reference (set when delegated to WEF). */
  wefDelegationId: string | null;
  /** Timestamp when WEF delegation completed (ISO-8601). */
  completedAt: string | null;
  /** Error details if this batch failed. */
  failure: ActivationFailure | null;
}

export enum BatchActivationStatus {
  PENDING = "pending",
  ACTIVATING = "activating",
  DELEGATED = "delegated",
  COMPLETED = "completed",
  FAILED = "failed",
  SKIPPED = "skipped",
}

// ══════════════════════════════════════════════════════════════
// Validation Types
// ══════════════════════════════════════════════════════════════

export interface ValidationResult {
  /** Whether validation passed. */
  ok: boolean;
  /** Individual validation gate results. */
  gates: ValidationGateResult[];
  /** Summary of failures, if any. */
  summary: string;
}

export interface ValidationGateResult {
  /** Gate name (e.g. "feature_flags", "constitutional", "budget"). */
  gate: string;
  /** Whether this gate passed. */
  passed: boolean;
  /** Human-readable message. */
  message: string;
  /** Severity: "error" blocks activation, "warning" allows it. */
  severity: "error" | "warning";
  /** Optional detail for operators. */
  detail?: string;
}

// ══════════════════════════════════════════════════════════════
// Failure & Rejection Types
// ══════════════════════════════════════════════════════════════

export interface ActivationFailure {
  /** Error code for programmatic handling. */
  code: string;
  /** Human-readable error message. */
  message: string;
  /** Optional detailed stack or context. */
  detail?: string;
  /** Stage at which the failure occurred. */
  stage: ActivationStage;
  /** Timestamp of the failure (ISO-8601). */
  timestamp: string;
}

export interface RejectionDetail {
  /** Reason for rejection. */
  reason: string;
  /** Which gate rejected the activation. */
  gate: string;
  /** Operator action required. */
  resolution: string;
  /** Timestamp of the rejection (ISO-8601). */
  timestamp: string;
}

/** Stages of the activation lifecycle. */
export enum ActivationStage {
  PLAN_CONSUMPTION = "plan_consumption",
  VALIDATION = "validation",
  BATCH_ACTIVATION = "batch_activation",
  WEF_DELEGATION = "wef_delegation",
  EXECUTION_MONITORING = "execution_monitoring",
  VERIFICATION = "verification",
  KNOWLEDGE_CAPTURE = "knowledge_capture",
  STATUS_REPORTING = "status_reporting",
  RECOVERY = "recovery",
}

// ══════════════════════════════════════════════════════════════
// WAS Configuration
// ══════════════════════════════════════════════════════════════

export interface WASConfig {
  /** Maximum number of concurrent activations. */
  maxConcurrentActivations: number;
  /** Whether to auto-resume from recovery snapshots on restart. */
  autoResume: boolean;
  /** Maximum retries for transient failures. */
  maxRetries: number;
  /** Whether to emit detailed observability events. */
  detailedObservability: boolean;
  /** Whether constitutional validation is required. */
  requireConstitutionalValidation: boolean;
  /** Whether feature flag validation is required. */
  requireFeatureFlagValidation: boolean;
  /** Whether to trigger knowledge capture on activation completion. */
  enableKnowledgeCapture: boolean;
  /** Whether to generate executive status reports. */
  enableStatusReporting: boolean;

  // ── Persistence & Recovery (Phase 9+) ──────────────────────
  /** Whether to persist activation lifecycle state to D1 on transitions. */
  enablePersistence: boolean;
  /** Whether to attempt startup recovery from persisted state. */
  enableRecovery: boolean;
  /** Persistence backend type. 'memory' for testing, 'd1' for production. */
  persistenceBackend: "memory" | "d1";
  /** Whether to gracefully degrade to in-memory fallback when D1 is unavailable. */
  enableGracefulDegradation: boolean;
  /** Whether to detect and block duplicate plan activations across restarts. */
  enableDuplicateExecutionProtection: boolean;
}

export const DEFAULT_WAS_CONFIG: WASConfig = {
  maxConcurrentActivations: 1,
  autoResume: false,
  maxRetries: 3,
  detailedObservability: false,
  requireConstitutionalValidation: true,
  requireFeatureFlagValidation: true,
  enableKnowledgeCapture: true,
  enableStatusReporting: true,
  enablePersistence: false,
  enableRecovery: false,
  persistenceBackend: "memory",
  enableGracefulDegradation: true,
  enableDuplicateExecutionProtection: true,
};

// ══════════════════════════════════════════════════════════════
// WAS Feature Flag Constants
// ══════════════════════════════════════════════════════════════

/**
 * WAS-specific feature flag names.
 * These are checked alongside EPCL's FeatureFlag enum.
 * All disabled by default — autonomous execution is opt-in.
 */
export enum WASFeatureFlag {
  ENABLE_AUTONOMOUS_EXECUTION = "ENABLE_AUTONOMOUS_EXECUTION",
  ENABLE_EXECUTIVE_WORKFLOW = "ENABLE_EXECUTIVE_WORKFLOW",
  ENABLE_BATCH_GENERATION = "ENABLE_BATCH_GENERATION",
  ENABLE_EXECUTIVE_REPORTING = "ENABLE_EXECUTIVE_REPORTING",
  ENABLE_PARALLEL_BATCH_DELEGATION = "ENABLE_PARALLEL_BATCH_DELEGATION",
}

export const DEFAULT_WAS_FLAG_STATE: Record<WASFeatureFlag, boolean> = {
  [WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: false,
  [WASFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: false,
  [WASFeatureFlag.ENABLE_BATCH_GENERATION]: false,
  [WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING]: false,
  [WASFeatureFlag.ENABLE_PARALLEL_BATCH_DELEGATION]: false,
};

// ══════════════════════════════════════════════════════════════
// Observability Types
// ══════════════════════════════════════════════════════════════

export enum WASEventType {
  ACTIVATION_STARTED = "was.activation.started",
  ACTIVATION_VALIDATED = "was.activation.validated",
  ACTIVATION_REJECTED = "was.activation.rejected",
  ACTIVATION_FAILED = "was.activation.failed",
  ACTIVATION_COMPLETED = "was.activation.completed",
  BATCH_ACTIVATED = "was.batch.activated",
  BATCH_DELEGATED = "was.batch.delegated",
  BATCH_FAILED = "was.batch.failed",
  BATCH_COMPLETED = "was.batch.completed",
  WEF_DELEGATION_STARTED = "was.wef.delegation.started",
  WEF_DELEGATION_COMPLETED = "was.wef.delegation.completed",
  WEF_DELEGATION_FAILED = "was.wef.delegation.failed",
  VERIFICATION_STARTED = "was.verification.started",
  VERIFICATION_COMPLETED = "was.verification.completed",
  KNOWLEDGE_CAPTURED = "was.knowledge.captured",
  STATUS_REPORTED = "was.status.reported",
  RECOVERY_ATTEMPTED = "was.recovery.attempted",
  RECOVERY_SUCCEEDED = "was.recovery.succeeded",
  RECOVERY_FAILED = "was.recovery.failed",

  // ── Persistence & Recovery Events (Phase 9+) ───────────────
  PERSISTENCE_FAILED = "was.persistence.failed",
  PERSISTENCE_RESTORED = "was.persistence.restored",
  CHECKPOINT_CREATED = "was.checkpoint.created",
  DUPLICATE_DETECTED = "was.duplicate.detected",
  DEGRADATION_ACTIVATED = "was.degradation.activated",
  PERSISTENCE_REJECTED = "was.persistence.rejected",
}

export interface WASEvent {
  id: string;
  type: WASEventType;
  planId: string;
  activationId: string;
  timestamp: string;
  duration: number;
  metadata: Record<string, unknown>;
  error?: string;
}

// ══════════════════════════════════════════════════════════════
// WEF Delegation Types
// ══════════════════════════════════════════════════════════════

export interface WEFDelegationRequest {
  /** The activation this delegation belongs to. */
  activationId: string;
  /** The plan being delegated. */
  planId: string;
  /** The batch being delegated. */
  batch: ExecutionBatch;
  /** Constitutional constraints to pass through to WEF. */
  constraints: DelegationConstraint[];
  /** Timestamp of the delegation request (ISO-8601). */
  timestamp: string;
}

export interface DelegationConstraint {
  /** Constraint type (e.g. "max_tokens", "no_deploy", "require_approval"). */
  type: string;
  /** Constraint value. */
  value: string;
  /** Human-readable description. */
  description: string;
}

export interface WEFDelegationResult {
  /** Whether delegation was successful. */
  ok: boolean;
  /** WEF delegation reference ID. */
  delegationId: string;
  /** Error message if delegation failed. */
  error?: string;
  /** Timestamp of the result (ISO-8601). */
  timestamp: string;
}

// ══════════════════════════════════════════════════════════════
// Execution Monitoring Types
// ══════════════════════════════════════════════════════════════

export interface ExecutionMonitorState {
  /** The activation being monitored. */
  activationId: string;
  /** The plan being executed. */
  planId: string;
  /** Batches currently being monitored. */
  monitoredBatches: MonitoredBatch[];
  /** Overall execution status. */
  status: ExecutionStatus;
  /** Last check timestamp (ISO-8601). */
  lastCheckAt: string;
}

export interface MonitoredBatch {
  batchId: string;
  wefDelegationId: string;
  status: ExecutionStatus;
  lastCheckAt: string;
  checkCount: number;
  error?: string;
}

export enum ExecutionStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  TIMEOUT = "timeout",
  CANCELLED = "cancelled",
}

export const TERMINAL_EXECUTION_STATUSES: ExecutionStatus[] = [
  ExecutionStatus.COMPLETED,
  ExecutionStatus.FAILED,
  ExecutionStatus.TIMEOUT,
  ExecutionStatus.CANCELLED,
];

// ══════════════════════════════════════════════════════════════
// Verification Types
// ══════════════════════════════════════════════════════════════

export interface VerificationRequest {
  planId: string;
  batchId: string;
  delegationId: string;
  activationId: string;
  executionResult: WEFDelegationResult;
  timestamp: string;
}

export interface VerificationResult {
  ok: boolean;
  verificationId: string;
  checks: VerificationCheck[];
  summary: string;
  timestamp: string;
}

export interface VerificationCheck {
  check: string;
  passed: boolean;
  message: string;
  detail?: string;
}

// ══════════════════════════════════════════════════════════════
// Status Report Types
// ══════════════════════════════════════════════════════════════

export interface ActivationStatusReport {
  activationId: string;
  planId: string;
  state: ActivationState;
  startedAt: string;
  duration: number;
  batchesActivated: number;
  batchesDelegated: number;
  batchesCompleted: number;
  batchesFailed: number;
  totalBatches: number;
  progress: number;
  failures: ActivationFailure[];
  validations: ValidationResult | null;
  summary: string;
}