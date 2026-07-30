// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Plan Consumer                             │
// │ Detects approved plans from EPCL and initiates the          │
// │ activation lifecycle. Prevents duplicate activation.        │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  PlanStatus,
} from "../epcl/types.js";
import {
  ActivationState,
  ActivationStage,
  type ActivationLifecycle,
  type ActivationFailure,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
} from "./types.js";
import { ExecutionStateManager } from "./execution-state-manager.js";
import { WASObservability } from "./was-observability.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class PlanConsumptionError extends Error {
  constructor(message: string) {
    super(`PlanConsumptionError: ${message}`);
    this.name = "PlanConsumptionError";
  }
}

// ══════════════════════════════════════════════════════════════
// Plan Consumer
// ══════════════════════════════════════════════════════════════

export class PlanConsumer {
  private static instance: PlanConsumer;
  private consumedPlans: Set<string> = new Set();
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private stateManager: ExecutionStateManager;
  private observability: WASObservability;

  private constructor() {
    this.stateManager = ExecutionStateManager.getInstance();
    this.observability = WASObservability.getInstance();
  }

  static getInstance(): PlanConsumer {
    if (!PlanConsumer.instance) {
      PlanConsumer.instance = new PlanConsumer();
    }
    return PlanConsumer.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
    this.stateManager.configure(config);
  }

  // ── Plan Consumption ────────────────────────────────────────

  /**
   * Consume an approved EPCL execution plan for activation.
   *
   * Validates:
   *   1. Plan exists and is not null
   *   2. Plan status is APPROVED
   *   3. Plan has batches to activate
   *   4. Plan has not already been consumed (idempotency)
   *   5. Plan is not already activated (active activation exists)
   *
   * @param plan — The EPCL execution plan to consume
   * @returns The activation lifecycle if consumption succeeds
   * @throws {PlanConsumptionError} if consumption fails
   */
  consume(plan: ExecutionPlan): ActivationLifecycle {
    const startTime = Date.now();

    this.validatePlan(plan);

    // Check idempotency — same plan ID cannot be consumed twice
    if (this.consumedPlans.has(plan.id)) {
      // Check if there's already an active activation for this plan
      if (this.stateManager.isPlanActivated(plan.id)) {
        const existing = this.stateManager.getActivationsForPlan(plan.id);
        const active = existing.find((a) => !this.stateManager.isTerminal(a.state));
        if (active) {
          this.observability.emit(
            "was.activation.started" as any,
            plan.id,
            active.id,
            { status: "idempotent_duplicate", existingId: active.id },
          );
          return active;
        }
      }
    }

    // Mark as consumed
    this.consumedPlans.add(plan.id);

    // Create activation lifecycle
    const lifecycle = this.stateManager.createActivation(plan.id);

    // Emit event
    this.observability.activationStarted(plan.id, lifecycle.id, {
      planId: plan.id,
      batchCount: plan.batches.length,
      duration: Date.now() - startTime,
    });

    return lifecycle;
  }

  /**
   * Validate a plan before consumption.
   */
  private validatePlan(plan: ExecutionPlan): void {
    if (!plan) {
      throw new PlanConsumptionError("Plan is null or undefined");
    }

    if (plan.status !== PlanStatus.APPROVED) {
      throw new PlanConsumptionError(
        `Plan ${plan.id} has status ${plan.status}. Expected APPROVED. ` +
        "Only APPROVED plans can be consumed by WAS."
      );
    }

    if (!plan.batches || plan.batches.length === 0) {
      throw new PlanConsumptionError(
        `Plan ${plan.id} has no batches. ` +
        "Cannot activate a plan with no batches."
      );
    }
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Check if a plan has been consumed.
   */
  hasConsumed(planId: string): boolean {
    return this.consumedPlans.has(planId);
  }

  /**
   * Get the set of consumed plan IDs.
   */
  getConsumedPlans(): string[] {
    return Array.from(this.consumedPlans);
  }

  /**
   * Get the count of consumed plans.
   */
  getConsumedCount(): number {
    return this.consumedPlans.size;
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all state. For testing. */
  reset(): void {
    this.consumedPlans.clear();
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}