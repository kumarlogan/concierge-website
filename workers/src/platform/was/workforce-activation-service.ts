// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Workforce Activation Service                  │
// │ Main lifecycle orchestrator for WAS — the activation        │
// │ boundary between EPCL (planning) and WEF (execution).       │
// │ Fail-closed by default: no autonomous execution without     │
// │ explicit feature flags, validation, and state transitions.  │
// │ Product-agnostic, reusable across all AGS products.         │
// │                                                             │
// │ Architecture:                                               │
// │   EPCL ──plan──→ WAS ──batch──→ WEF                        │
// │                    │                                         │
// │                    ├─ PlanConsumer (detect APPROVED)         │
// │                    ├─ ConstitutionalValidator (gates)       │
// │                    ├─ ExecutionStateManager (state machine) │
// │                    ├─ WEFDelegator (delegate to WEF)        │
// │                    ├─ VerificationRouter (verify results)   │
// │                    ├─ KnowledgeCaptureTrigger (capture)     │
// │                    └─ ExecutiveStatusUpdater (report)       │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  PlanStatus,
  BatchStatus,
} from "../epcl/types.js";
import {
  ActivationState,
  ActivationStage,
  type ActivationLifecycle,
  type ActivationFailure,
  type RejectionDetail,
  type ValidationResult,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
  BatchActivationStatus,
  TERMINAL_EXECUTION_STATUSES,
} from "./types.js";
import { ExecutionStateManager } from "./execution-state-manager.js";
import { WASObservability } from "./was-observability.js";
import { PlanConsumer } from "./plan-consumer.js";
import { ConstitutionalValidator } from "./constitutional-validator.js";
import { WEFDelegator } from "./wef-delegator.js";
import { VerificationRouter } from "./verification-router.js";
import { KnowledgeCaptureTrigger } from "./knowledge-capture-trigger.js";
import { ExecutiveStatusUpdater } from "./executive-status-updater.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class WorkforceActivationError extends Error {
  constructor(message: string) {
    super(`WorkforceActivationError: ${message}`);
    this.name = "WorkforceActivationError";
  }
}

// ══════════════════════════════════════════════════════════════
// Workforce Activation Service
// ══════════════════════════════════════════════════════════════

export class WorkforceActivationService {
  private static instance: WorkforceActivationService;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private stateManager: ExecutionStateManager;
  private observability: WASObservability;
  private planConsumer: PlanConsumer;
  private constitutionalValidator: ConstitutionalValidator;
  private wefDelegator: WEFDelegator;
  private verificationRouter: VerificationRouter;
  private knowledgeCaptureTrigger: KnowledgeCaptureTrigger;
  private executiveStatusUpdater: ExecutiveStatusUpdater;

  private constructor() {
    this.stateManager = ExecutionStateManager.getInstance();
    this.observability = WASObservability.getInstance();
    this.planConsumer = PlanConsumer.getInstance();
    this.constitutionalValidator = ConstitutionalValidator.getInstance();
    this.wefDelegator = WEFDelegator.getInstance();
    this.verificationRouter = VerificationRouter.getInstance();
    this.knowledgeCaptureTrigger = KnowledgeCaptureTrigger.getInstance();
    this.executiveStatusUpdater = ExecutiveStatusUpdater.getInstance();
  }

  static getInstance(): WorkforceActivationService {
    if (!WorkforceActivationService.instance) {
      WorkforceActivationService.instance = new WorkforceActivationService();
    }
    return WorkforceActivationService.instance;
  }

  // ════════════════════════════════════════════════════════════════
  // Configuration
  // ════════════════════════════════════════════════════════════════

  /**
   * Configure WAS and propagate config to all sub-services.
   * Fail-closed by default.
   */
  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
    this.stateManager.configure(this.config);
    this.observability.configure(this.config);
    this.planConsumer.configure(this.config);
    this.constitutionalValidator.configure(this.config);
    this.wefDelegator.configure(this.config);
    this.verificationRouter.configure(this.config);
    this.knowledgeCaptureTrigger.configure(this.config);
    this.executiveStatusUpdater.configure(this.config);
  }

  /** Get current WAS configuration. */
  getConfig(): Readonly<WASConfig> {
    return this.stateManager.getConfig();
  }

  // ════════════════════════════════════════════════════════════════
  // Activate — the main activation pipeline
  // ════════════════════════════════════════════════════════════════

  /**
   * Activate an approved EPCL execution plan.
   *
   * This is the primary entry point into WAS. It orchestrates the full
   * activation lifecycle:
   *
   *   1. CONSUME — Validate plan is APPROVED, check idempotency
   *   2. VALIDATE — Run constitutional validation gates (fail-closed)
   *   3. ACTIVATE — Transition to activating, prepare batches
   *   4. DELEGATE — Delegate each batch to WEF
   *   5. VERIFY — Verify each delegation result
   *   6. CAPTURE — Capture knowledge from successful execution
   *   7. REPORT — Generate activation status report
   *
   * @param plan — The approved EPCL execution plan
   * @returns The activation lifecycle
   * @throws {WorkforceActivationError} if activation fails at any stage
   */
  async activate(plan: ExecutionPlan): Promise<ActivationLifecycle> {
    const startTime = Date.now();

    // ── Stage 1: Consume plan ──────────────────────────────────
    let lifecycle: ActivationLifecycle;
    try {
      lifecycle = this.planConsumer.consume(plan);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new WorkforceActivationError(`Plan consumption failed: ${message}`);
    }

    // ── Stage 2: Validate ──────────────────────────────────────
    try {
      this.stateManager.transitionState(lifecycle.id, ActivationState.VALIDATING);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failActivation(lifecycle.id, {
        code: "STATE_TRANSITION_FAILED",
        message: `Failed to transition to VALIDATING: ${message}`,
        stage: ActivationStage.VALIDATION,
        timestamp: new Date().toISOString(),
      });
      throw new WorkforceActivationError(message);
    }

    const validation: ValidationResult = this.constitutionalValidator.validate(plan);

    this.stateManager.setValidation(lifecycle.id, validation);
    this.observability.activationValidated(
      plan.id,
      lifecycle.id,
      validation.gates.length,
      validation.ok,
    );

    if (!validation.ok) {
      const rejection: RejectionDetail = {
        reason: "Constitutional validation failed",
        gate: validation.gates.find((g) => !g.passed)?.gate ?? "unknown",
        resolution: "Review validation errors, fix flagged issues, and resubmit the plan",
        timestamp: new Date().toISOString(),
      };
      this.stateManager.reject(lifecycle.id, rejection);
      this.observability.activationRejected(plan.id, lifecycle.id, rejection.reason);
      throw new WorkforceActivationError(
        `Plan ${plan.id} rejected: ${validation.summary}`
      );
    }

    // ── Stage 3: Activate batches ─────────────────────────────
    try {
      this.stateManager.transitionState(lifecycle.id, ActivationState.ACTIVATING);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failActivation(lifecycle.id, {
        code: "STATE_TRANSITION_FAILED",
        message: `Failed to transition to ACTIVATING: ${message}`,
        stage: ActivationStage.BATCH_ACTIVATION,
        timestamp: new Date().toISOString(),
      });
      throw new WorkforceActivationError(message);
    }

    // Add all plan batches to activation
    for (const batch of plan.batches) {
      this.stateManager.addBatch(lifecycle.id, batch.id);
      this.stateManager.updateBatchStatus(lifecycle.id, batch.id, BatchActivationStatus.ACTIVATING);
      this.observability.emit(
        "was.batch.activated" as any,
        plan.id,
        lifecycle.id,
        { batchId: batch.id, taskCount: batch.tasks.length },
      );
    }

    // ── Stage 4: Activate state ────────────────────────────────
    try {
      this.stateManager.transitionState(lifecycle.id, ActivationState.ACTIVE);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.failActivation(lifecycle.id, {
        code: "STATE_TRANSITION_FAILED",
        message: `Failed to transition to ACTIVE: ${message}`,
        stage: ActivationStage.BATCH_ACTIVATION,
        timestamp: new Date().toISOString(),
      });
      throw new WorkforceActivationError(message);
    }

    return lifecycle;
  }

  // ════════════════════════════════════════════════════════════════
  // Delegation — per-batch WEF delegation
  // ════════════════════════════════════════════════════════════════

  /**
   * Delegate a single batch to WEF for execution.
   * Can be called independently after activate() for async batch processing.
   *
   * @param plan — The execution plan
   * @param batch — The batch to delegate
   * @param activationId — The activation lifecycle ID
   */
  async delegateBatch(
    plan: ExecutionPlan,
    batch: ExecutionBatch,
    activationId: string,
  ): Promise<void> {
    const startTime = Date.now();
    const lifecycle = this.stateManager.getActivation(activationId);

    if (!lifecycle) {
      throw new WorkforceActivationError(`Activation ${activationId} not found`);
    }

    if (lifecycle.state !== ActivationState.ACTIVE) {
      throw new WorkforceActivationError(
        `Activation ${activationId} is in state ${lifecycle.state}. Expected ACTIVE.`
      );
    }

    // Delegate to WEF
    const delegationResult = await this.wefDelegator.delegate(plan, batch, activationId);

    if (!delegationResult.ok) {
      const failure: ActivationFailure = {
        code: "BATCH_DELEGATION_FAILED",
        message: `Batch ${batch.id} delegation failed: ${delegationResult.error}`,
        stage: ActivationStage.WEF_DELEGATION,
        timestamp: new Date().toISOString(),
      };
      this.stateManager.recordBatchFailure(activationId, batch.id, failure);
      return;
    }

    // Verify
    const verificationResult = this.verificationRouter.verify(
      plan,
      batch,
      delegationResult,
      activationId,
    );

    if (!verificationResult.ok) {
      const failure: ActivationFailure = {
        code: "BATCH_VERIFICATION_FAILED",
        message: `Batch ${batch.id} verification failed: ${verificationResult.summary}`,
        stage: ActivationStage.VERIFICATION,
        timestamp: new Date().toISOString(),
      };
      this.stateManager.recordBatchFailure(activationId, batch.id, failure);
      return;
    }

    // Mark batch as completed
    this.stateManager.updateBatchStatus(activationId, batch.id, BatchActivationStatus.COMPLETED);

    // Capture knowledge
    if (this.config.enableKnowledgeCapture) {
      try {
        this.knowledgeCaptureTrigger.trigger(
          plan,
          batch,
          delegationResult,
          verificationResult,
          activationId,
        );
      } catch (err) {
        // Non-fatal: knowledge capture failure shouldn't break the activation
        this.observability.activationStarted(plan.id, activationId, {
          warning: `Knowledge capture failed for batch ${batch.id}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Complete Activation
  // ════════════════════════════════════════════════════════════════

  /**
   * Complete an activation — transitions to DEACTIVATING, generates
   * the status report, and transitions to DEACTIVATED.
   *
   * @param plan — The execution plan
   * @param activationId — The activation lifecycle ID
   * @param verificationResults — Optional verification results for the report
   * @returns The activation status report
   */
  complete(
    plan: ExecutionPlan,
    activationId: string,
    verificationResults?: Map<string, import("./types.js").VerificationResult>,
  ): import("./types.js").ActivationStatusReport {
    const lifecycle = this.stateManager.getActivation(activationId);

    if (!lifecycle) {
      throw new WorkforceActivationError(`Activation ${activationId} not found`);
    }

    // Transition to deactivating
    try {
      this.stateManager.transitionState(activationId, ActivationState.DEACTIVATING);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new WorkforceActivationError(message);
    }

    // Generate status report
    const report = this.executiveStatusUpdater.report(plan, lifecycle, verificationResults);

    // Transition to deactivated
    try {
      this.stateManager.transitionState(activationId, ActivationState.DEACTIVATED);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new WorkforceActivationError(message);
    }

    // Emit completion event
    this.observability.activationCompleted(plan.id, activationId, {
      duration: report.duration,
      batchesCompleted: report.batchesCompleted,
      batchesFailed: report.batchesFailed,
      progress: report.progress,
    });

    return report;
  }

  // ════════════════════════════════════════════════════════════════
  // Cancel Activation
  // ════════════════════════════════════════════════════════════════

  /**
   * Cancel an activation — transitions to DEACTIVATING then FAILED.
   *
   * @param plan — The execution plan
   * @param activationId — The activation lifecycle ID
   * @param reason — Why the activation was cancelled
   */
  cancel(plan: ExecutionPlan, activationId: string, reason: string = "User requested cancellation"): void {
    const lifecycle = this.stateManager.getActivation(activationId);

    if (!lifecycle) {
      throw new WorkforceActivationError(`Activation ${activationId} not found`);
    }

    // Try to transition to deactivating (may already be there)
    try {
      this.stateManager.transitionState(activationId, ActivationState.DEACTIVATING);
    } catch {
      // If transition fails (e.g., already in a terminal state), just record the failure
    }

    const failure: ActivationFailure = {
      code: "ACTIVATION_CANCELLED",
      message: reason,
      stage: ActivationStage.EXECUTION_MONITORING,
      timestamp: new Date().toISOString(),
    };

    this.stateManager.fail(activationId, failure);
    this.observability.activationFailed(plan.id, activationId, ActivationStage.EXECUTION_MONITORING, reason);
  }

  // ════════════════════════════════════════════════════════════════
  // Recovery
  // ════════════════════════════════════════════════════════════════

  /**
   * Recover all active activations after a restart.
   * Transitions each recovered activation to FAILED (safe default)
   * unless autoResume is enabled.
   */
  recover(): void {
    const recoverable = this.stateManager.getRecoverableActivations();

    if (recoverable.length === 0) {
      return;
    }

    this.observability.emit(
      "was.recovery.attempted" as any,
      "system",
      "system",
      { count: recoverable.length, autoResume: this.config.autoResume },
    );

    for (const activation of recoverable) {
      try {
        if (this.config.autoResume) {
          // Resume the activation — revert to PENDING and re-validate
          // Note: autoResume is experimental and disabled by default.
          this.stateManager.transitionState(activation.id, ActivationState.PENDING);
          this.observability.recoverySucceeded(activation.planId, activation.id);
        } else {
          // Fail-safe: mark all recovered activations as failed
          const failure: ActivationFailure = {
            code: "RECOVERY_FAILED",
            message: `Activation was in-progress during restart. Safe default: marked as FAILED. Set autoResume=true to resume.`,
            stage: ActivationStage.RECOVERY,
            timestamp: new Date().toISOString(),
          };
          this.stateManager.fail(activation.id, failure);
          this.observability.recoveryFailed(activation.planId, activation.id, failure.message);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this.observability.recoveryFailed(activation.planId, activation.id, message);
      }
    }
  }

  // ════════════════════════════════════════════════════════════════
  // Internal Helpers
  // ════════════════════════════════════════════════════════════════

  private failActivation(activationId: string, failure: ActivationFailure): void {
    try {
      this.stateManager.transitionState(activationId, ActivationState.FAILED);
    } catch {
      // Already in failure path
    }
    this.stateManager.fail(activationId, failure);
    this.observability.activationFailed(
      "unknown",
      activationId,
      failure.stage,
      failure.message,
    );
  }

  // ════════════════════════════════════════════════════════════════
  // Query Methods
  // ════════════════════════════════════════════════════════════════

  /** Get an activation lifecycle by ID. */
  getActivation(activationId: string): ActivationLifecycle | undefined {
    return this.stateManager.getActivation(activationId);
  }

  /** Get all active activations. */
  listActive(): ActivationLifecycle[] {
    return this.stateManager.listActive();
  }

  /** Get all activation IDs. */
  listAll(): string[] {
    return this.stateManager.listAll();
  }

  /** Count activations by state. */
  countByState(): Record<ActivationState, number> {
    return this.stateManager.countByState();
  }

  /** Check if a plan has an active activation. */
  isPlanActivated(planId: string): boolean {
    return this.stateManager.isPlanActivated(planId);
  }

  // ════════════════════════════════════════════════════════════════
  // Reset (testing)
  // ════════════════════════════════════════════════════════════════

  /** Reset all state. For testing. */
  reset(): void {
    this.stateManager.reset();
    this.observability.reset();
    this.planConsumer.reset();
    this.wefDelegator.reset();
    this.verificationRouter.reset();
    this.knowledgeCaptureTrigger.reset();
    this.executiveStatusUpdater.reset();
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}