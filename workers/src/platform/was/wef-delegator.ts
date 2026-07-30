// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS WEF Delegator                             │
// │ Delegates activated batches to the Workforce Execution      │
// │ Framework (WEF) for execution. Tracks delegation state      │
// │ and monitors execution progress. Fail-closed.               │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  PlanStatus,
  BatchStatus,
} from "../epcl/types.js";
import {
  type WEFDelegationRequest,
  type WEFDelegationResult,
  type DelegationConstraint,
  type ActivationFailure,
  ActivationStage,
  BatchActivationStatus,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
} from "./types.js";
import { ExecutionStateManager } from "./execution-state-manager.js";
import { WASObservability } from "./was-observability.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class WEFDelegationError extends Error {
  constructor(message: string) {
    super(`WEFDelegationError: ${message}`);
    this.name = "WEFDelegationError";
  }
}

// ══════════════════════════════════════════════════════════════
// WEF Delegator
// ══════════════════════════════════════════════════════════════

export class WEFDelegator {
  private static instance: WEFDelegator;
  private delegations: Map<string, WEFDelegationResult> = new Map();
  private delegationCounter = 0;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private stateManager: ExecutionStateManager;
  private observability: WASObservability;

  private constructor() {
    this.stateManager = ExecutionStateManager.getInstance();
    this.observability = WASObservability.getInstance();
  }

  static getInstance(): WEFDelegator {
    if (!WEFDelegator.instance) {
      WEFDelegator.instance = new WEFDelegator();
    }
    return WEFDelegator.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Delegation ──────────────────────────────────────────────

  /**
   * Delegate an activated batch to WEF for execution.
   *
   * @param plan — The execution plan containing the batch
   * @param batch — The batch to delegate
   * @param activationId — The activation lifecycle ID
   * @returns The delegation result
   * @throws {WEFDelegationError} if delegation fails
   */
  async delegate(
    plan: ExecutionPlan,
    batch: ExecutionBatch,
    activationId: string,
  ): Promise<WEFDelegationResult> {
    const startTime = Date.now();
    const delegationId = `wef-${this.delegationCounter++}-${Date.now()}`;

    try {
      // Build delegation request
      const request: WEFDelegationRequest = {
        activationId,
        planId: plan.id,
        batch,
        constraints: this.buildConstraints(plan, batch),
        timestamp: new Date().toISOString(),
      };

      // Emit delegation started event
      this.observability.emit(
        "was.wef.delegation.started" as any,
        plan.id,
        activationId,
        {
          batchId: batch.id,
          delegationId,
          taskCount: batch.tasks.length,
        },
      );

      // Update batch status in state manager
      this.stateManager.updateBatchStatus(
        activationId,
        batch.id,
        BatchActivationStatus.ACTIVATING,
      );

      // NOTE: Actual WEF delegation would happen here.
      // Currently, WEF integration is a reserved capability.
      // This implementation:
      //   1. Validates the delegation request
      //   2. Records the delegation
      //   3. Simulates a successful delegation for testing
      //
      // TODO: Replace with actual WEF delegation when WEF integration is available.
      // The WEF delegation would:
      //   1. Call WEF's executeBatch(batch, constraints) method
      //   2. Receive a WEF execution ID
      //   3. Set up monitoring for that execution
      //   4. Return the delegation result

      this.validateDelegationRequest(request);

      // Record successful delegation
      const result: WEFDelegationResult = {
        ok: true,
        delegationId,
        timestamp: new Date().toISOString(),
      };

      this.delegations.set(delegationId, result);

      // Update state manager with delegation ID
      this.stateManager.setBatchDelegation(activationId, batch.id, delegationId);

      // Emit events
      this.observability.batchDelegated(plan.id, activationId, batch.id, delegationId);
      this.observability.wefDelegationCompleted(
        plan.id,
        activationId,
        batch.id,
        delegationId,
      );

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);

      // Record failure in state manager
      const failure: ActivationFailure = {
        code: "WEF_DELEGATION_FAILED",
        message: errorMessage,
        detail: `Failed to delegate batch ${batch.id} to WEF`,
        stage: ActivationStage.WEF_DELEGATION,
        timestamp: new Date().toISOString(),
      };
      this.stateManager.recordBatchFailure(activationId, batch.id, failure);

      // Emit failure event
      this.observability.wefDelegationFailed(plan.id, activationId, batch.id, errorMessage);

      return {
        ok: false,
        delegationId: "",
        error: errorMessage,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Build delegation constraints from the plan and batch.
   */
  private buildConstraints(plan: ExecutionPlan, batch: ExecutionBatch): DelegationConstraint[] {
    const constraints: DelegationConstraint[] = [];

    // Base constraint: batch must be PENDING
    constraints.push({
      type: "batch_status",
      value: BatchStatus.PENDING,
      description: "Batch must be PENDING before delegation",
    });

    // Base constraint: plan must be APPROVED
    constraints.push({
      type: "plan_status",
      value: PlanStatus.APPROVED,
      description: "Plan must be APPROVED before delegation",
    });

    // Task count constraint
    constraints.push({
      type: "task_count",
      value: String(batch.tasks.length),
      description: `Batch has ${batch.tasks.length} tasks to execute`,
    });

    return constraints;
  }

  /**
   * Validate a delegation request before sending to WEF.
   */
  private validateDelegationRequest(request: WEFDelegationRequest): void {
    if (!request.batch) {
      throw new WEFDelegationError("Batch is null or undefined");
    }

    if (!request.batch.id) {
      throw new WEFDelegationError("Batch has no ID");
    }

    if (!request.batch.tasks || request.batch.tasks.length === 0) {
      throw new WEFDelegationError(
        `Batch ${request.batch.id} has no tasks to delegate`
      );
    }

    if (!request.activationId) {
      throw new WEFDelegationError("Activation ID is required");
    }

    if (!request.planId) {
      throw new WEFDelegationError("Plan ID is required");
    }
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Get a delegation result by ID.
   */
  getDelegation(delegationId: string): WEFDelegationResult | undefined {
    return this.delegations.get(delegationId);
  }

  /**
   * Get all delegations for a plan.
   */
  getDelegationsForPlan(planId: string): WEFDelegationResult[] {
    return Array.from(this.delegations.values()).filter((d) =>
      d.delegationId.startsWith("wef-")
    );
  }

  /**
   * Get the count of successful delegations.
   */
  getSuccessfulCount(): number {
    return Array.from(this.delegations.values()).filter((d) => d.ok).length;
  }

  /**
   * Get the count of failed delegations.
   */
  getFailedCount(): number {
    return Array.from(this.delegations.values()).filter((d) => !d.ok).length;
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all state. For testing. */
  reset(): void {
    this.delegations.clear();
    this.delegationCounter = 0;
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}