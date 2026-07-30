// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Executive Status Updater                   │
// │ Generates activation status reports and feeds them back     │
// │ into EPCL's executive reporting pipeline.                   │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  PlanStatus,
  BatchStatus,
} from "../epcl/types.js";
import { ExecutiveReporter } from "../epcl/executive-reporter.js";
import {
  ActivationState,
  type ActivationLifecycle,
  type ActivationStatusReport,
  type ActivationFailure,
  type ValidationResult,
  type VerificationResult,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
  BatchActivationStatus,
} from "./types.js";
import { ExecutionStateManager } from "./execution-state-manager.js";
import { WASObservability } from "./was-observability.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class StatusUpdateError extends Error {
  constructor(message: string) {
    super(`StatusUpdateError: ${message}`);
    this.name = "StatusUpdateError";
  }
}

// ══════════════════════════════════════════════════════════════
// Executive Status Updater
// ══════════════════════════════════════════════════════════════

export class ExecutiveStatusUpdater {
  private static instance: ExecutiveStatusUpdater;
  private reports: ActivationStatusReport[] = [];
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private stateManager: ExecutionStateManager;
  private executiveReporter: ExecutiveReporter;
  private observability: WASObservability;

  private constructor() {
    this.stateManager = ExecutionStateManager.getInstance();
    this.executiveReporter = ExecutiveReporter.getInstance();
    this.observability = WASObservability.getInstance();
  }

  static getInstance(): ExecutiveStatusUpdater {
    if (!ExecutiveStatusUpdater.instance) {
      ExecutiveStatusUpdater.instance = new ExecutiveStatusUpdater();
    }
    return ExecutiveStatusUpdater.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Status Reporting ────────────────────────────────────────

  /**
   * Generate an activation status report for a completed activation lifecycle.
   *
   * @param plan — The EPCL execution plan
   * @param activation — The activation lifecycle
   * @param verificationResults — Optional verification results for batches
   * @returns The activation status report
   */
  report(
    plan: ExecutionPlan,
    activation: ActivationLifecycle,
    verificationResults?: Map<string, VerificationResult>,
  ): ActivationStatusReport {
    const startTime = Date.now();
    const startedAt = new Date(activation.createdAt).getTime();
    const now = Date.now();
    const duration = activation.completedAt
      ? new Date(activation.completedAt).getTime() - startedAt
      : now - startedAt;

    // Calculate batch statistics
    const batchesActivated = activation.activatedBatches.filter(
      (b) => b.status !== BatchActivationStatus.PENDING,
    ).length;
    const batchesDelegated = activation.activatedBatches.filter(
      (b) => b.status === BatchActivationStatus.DELEGATED ||
             b.status === BatchActivationStatus.COMPLETED,
    ).length;
    const batchesCompleted = activation.activatedBatches.filter(
      (b) => b.status === BatchActivationStatus.COMPLETED,
    ).length;
    const batchesFailed = activation.activatedBatches.filter(
      (b) => b.status === BatchActivationStatus.FAILED,
    ).length;
    const totalBatches = plan.batches.length;

    // Calculate progress percentage
    const progress = totalBatches > 0
      ? Math.round((batchesCompleted / totalBatches) * 100)
      : 0;

    // Collect failures
    const failures: ActivationFailure[] = [];
    for (const batch of activation.activatedBatches) {
      if (batch.failure) {
        failures.push(batch.failure);
      }
    }
    if (activation.failure) {
      failures.push(activation.failure);
    }

    // Build summary
    const summary = this.buildSummary(
      activation,
      batchesActivated,
      batchesDelegated,
      batchesCompleted,
      batchesFailed,
      totalBatches,
      verificationResults,
    );

    const report: ActivationStatusReport = {
      activationId: activation.id,
      planId: activation.planId,
      state: activation.state,
      startedAt: activation.createdAt,
      duration,
      batchesActivated,
      batchesDelegated,
      batchesCompleted,
      batchesFailed,
      totalBatches,
      progress,
      failures,
      validations: activation.validation,
      summary,
    };

    this.reports.push(report);

    // Emit to EPCL's executive reporter (if enabled)
    if (this.config.enableStatusReporting) {
      try {
        // The EPCL ExecutiveReporter.generateReport is designed for EPCL plans.
        // WAS feeds status back through its own report channel.
        // In future, this could be extended to feed into EPCL's reporting pipeline.
        this.observability.statusReported(plan.id, activation.id, summary);
      } catch (err) {
        // Non-fatal: status reporting failure shouldn't break the activation
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.observability.emit(
          "was.status.reported" as any,
          plan.id,
          activation.id,
          { error: errorMessage },
        );
      }
    }

    return report;
  }

  /**
   * Build a human-readable summary of the activation.
   */
  private buildSummary(
    activation: ActivationLifecycle,
    batchesActivated: number,
    batchesDelegated: number,
    batchesCompleted: number,
    batchesFailed: number,
    totalBatches: number,
    verificationResults?: Map<string, VerificationResult>,
  ): string {
    const parts: string[] = [];

    switch (activation.state) {
      case ActivationState.PENDING:
        parts.push(`Activation ${activation.id} is pending processing`);
        break;
      case ActivationState.VALIDATING:
        parts.push(`Activation ${activation.id} is undergoing validation`);
        break;
      case ActivationState.ACTIVATING:
        parts.push(`Activation ${activation.id} is activating batches`);
        break;
      case ActivationState.ACTIVE:
        parts.push(`Activation ${activation.id} is active`);
        break;
      case ActivationState.DEACTIVATING:
        parts.push(`Activation ${activation.id} is deactivating`);
        break;
      case ActivationState.DEACTIVATED:
        parts.push(`Activation ${activation.id} completed successfully`);
        break;
      case ActivationState.FAILED:
        parts.push(`Activation ${activation.id} failed`);
        if (activation.failure) {
          parts.push(`Error: ${activation.failure.message}`);
        }
        break;
      case ActivationState.REJECTED:
        parts.push(`Activation ${activation.id} was rejected`);
        if (activation.rejection) {
          parts.push(`Reason: ${activation.rejection.reason}`);
        }
        break;
    }

    parts.push(`Batches: ${batchesActivated}/${totalBatches} activated, ${batchesDelegated} delegated, ${batchesCompleted} completed, ${batchesFailed} failed`);

    if (verificationResults && verificationResults.size > 0) {
      const verified = Array.from(verificationResults.values()).filter((v) => v.ok).length;
      const total = verificationResults.size;
      parts.push(`Verification: ${verified}/${total} passed`);
    }

    if (activation.validation && !activation.validation.ok) {
      const failedGates = activation.validation.gates.filter((g) => !g.passed);
      parts.push(`Validation gates failed: ${failedGates.map((g) => g.gate).join(", ")}`);
    }

    return parts.join(" · ");
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Get all activation status reports.
   */
  getReports(): ActivationStatusReport[] {
    return [...this.reports];
  }

  /**
   * Get the most recent report for an activation.
   */
  getReportForActivation(activationId: string): ActivationStatusReport | undefined {
    return this.reports.find((r) => r.activationId === activationId);
  }

  /**
   * Get the most recent report for a plan.
   */
  getReportForPlan(planId: string): ActivationStatusReport | undefined {
    return this.reports.find((r) => r.planId === planId);
  }

  /**
   * Get the last N reports.
   */
  getRecentReports(limit: number = 10): ActivationStatusReport[] {
    return this.reports.slice(-limit);
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all state. For testing. */
  reset(): void {
    this.reports = [];
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}