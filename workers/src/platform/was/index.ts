// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Barrel Export                             │
// │ Central export point for all WAS types and services.        │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

// ── Types ────────────────────────────────────────────────────
export {
  ActivationState,
  ActivationStage,
  BatchActivationStatus,
  ExecutionStatus,
  WASFeatureFlag,
  WASEventType,
  DEFAULT_WAS_CONFIG,
  DEFAULT_WAS_FLAG_STATE,
  TERMINAL_EXECUTION_STATUSES,
} from "./types.js";

export type {
  ActivationLifecycle,
  ActivatedBatch,
  ActivationFailure,
  RejectionDetail,
  ValidationResult,
  ValidationGateResult,
  WASConfig,
  WASEvent,
  WEFDelegationRequest,
  WEFDelegationResult,
  DelegationConstraint,
  ExecutionMonitorState,
  MonitoredBatch,
  VerificationRequest,
  VerificationResult,
  VerificationCheck,
  ActivationStatusReport,
} from "./types.js";

// ── Feature Flags ────────────────────────────────────────────
export {
  initializeWASFlags,
  isWASEnabled,
  enableWASFlag,
  disableWASFlag,
  getWASFlags,
  resetWASFlags,
  syncWASFlagsFromEPCL,
  resetAllFlagsForTest,
  validateFeatureFlags,
  validateReportingFlag,
} from "./was-feature-flags.js";

// ── Services ─────────────────────────────────────────────────
export { ExecutionStateManager, ExecutionStateError, StateTransitionError } from "./execution-state-manager.js";
export { WASObservability } from "./was-observability.js";
export { PlanConsumer, PlanConsumptionError } from "./plan-consumer.js";
export { ConstitutionalValidator } from "./constitutional-validator.js";
export { WEFDelegator, WEFDelegationError } from "./wef-delegator.js";
export { VerificationRouter, VerificationError } from "./verification-router.js";
export { KnowledgeCaptureTrigger, KnowledgeCaptureTriggerError } from "./knowledge-capture-trigger.js";
export { ExecutiveStatusUpdater, StatusUpdateError } from "./executive-status-updater.js";

// ── Orchestrator ─────────────────────────────────────────────
export { WorkforceActivationService, WorkforceActivationError } from "./workforce-activation-service.js";

// ── Foundation Persistence & Recovery (Phase 9+) ────────────
export { WASRecoveryOrchestrator, RecoveryError } from "./was-recovery.js";
export type { RecoveryResult } from "./was-recovery.js";
export { GracefulDegradationManager } from "./was-graceful-degradation.js";
export type { DegradationState, DegradationConfig } from "./was-graceful-degradation.js";
export { DuplicateExecutionProtection } from "./was-duplicate-protection.js";
export type { DuplicateCheckResult } from "./was-duplicate-protection.js";
export type { WASPersistenceBackend, PersistenceCheckpoint } from "./was-persistence.js";