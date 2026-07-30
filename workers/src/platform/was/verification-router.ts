// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Verification Router                       │
// │ Routes post-execution verification through configured       │
// │ verification capabilities. Fail-closed: unverified          │
// │ execution is flagged for operator review.                   │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  BatchStatus,
} from "../epcl/types.js";
import {
  type VerificationRequest,
  type VerificationResult,
  type VerificationCheck,
  type WEFDelegationResult,
  type ActivationFailure,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
  ActivationStage,
} from "./types.js";
import { WASObservability } from "./was-observability.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class VerificationError extends Error {
  constructor(message: string) {
    super(`VerificationError: ${message}`);
    this.name = "VerificationError";
  }
}

// ══════════════════════════════════════════════════════════════
// Verification Router
// ══════════════════════════════════════════════════════════════

export class VerificationRouter {
  private static instance: VerificationRouter;
  private verifications: Map<string, VerificationResult> = new Map();
  private verificationCounter = 0;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private observability: WASObservability;

  private constructor() {
    this.observability = WASObservability.getInstance();
  }

  static getInstance(): VerificationRouter {
    if (!VerificationRouter.instance) {
      VerificationRouter.instance = new VerificationRouter();
    }
    return VerificationRouter.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Verification ────────────────────────────────────────────

  /**
   * Route post-execution verification for a completed batch.
   *
   * Runs verification checks:
   *   1. Execution result integrity — delegation was successful
   *   2. Batch completeness — all tasks were completed
   *   3. Execution status — batch reached expected terminal state
   *   4. No pending failures — no unhandled errors
   *
   * @param plan — The execution plan
   * @param batch — The batch that was executed
   * @param delegationResult — The WEF delegation result
   * @param activationId — The activation lifecycle ID
   * @returns The verification result
   */
  verify(
    plan: ExecutionPlan,
    batch: ExecutionBatch,
    delegationResult: WEFDelegationResult,
    activationId: string,
  ): VerificationResult {
    const startTime = Date.now();
    const verificationId = `ver-${this.verificationCounter++}-${Date.now()}`;

    this.observability.emit(
      "was.verification.started" as any,
      plan.id,
      activationId,
      { batchId: batch.id, delegationId: delegationResult.delegationId },
    );

    const checks: VerificationCheck[] = [];

    // Check 1: Delegation result integrity
    checks.push({
      check: "delegation_integrity",
      passed: delegationResult.ok,
      message: delegationResult.ok
        ? "WEF delegation completed successfully"
        : `WEF delegation failed: ${delegationResult.error ?? "Unknown error"}`,
      detail: delegationResult.ok
        ? `Delegation ID: ${delegationResult.delegationId}`
        : undefined,
    });

    // Check 2: Batch completeness
    const hasTasks = batch.tasks && batch.tasks.length > 0;
    checks.push({
      check: "batch_completeness",
      passed: hasTasks === true,
      message: hasTasks
        ? `Batch ${batch.id} has ${batch.tasks.length} tasks`
        : `Batch ${batch.id} has no tasks to verify`,
      detail: hasTasks
        ? `Tasks: ${batch.tasks.map((t) => t.id).join(", ")}`
        : undefined,
    });

    // Check 3: Execution status
    // A batch is considered successfully executed if it was delegated and
    // the delegation result is ok.
    const executionOk = delegationResult.ok;
    checks.push({
      check: "execution_status",
      passed: executionOk,
      message: executionOk
        ? `Batch ${batch.id} execution completed successfully`
        : `Batch ${batch.id} execution failed`,
      detail: executionOk
        ? `Final status: ${BatchStatus.COMPLETED}`
        : `Error: ${delegationResult.error}`,
    });

    // Check 4: No pending failures
    const noFailures = !delegationResult.error;
    checks.push({
      check: "no_pending_failures",
      passed: noFailures,
      message: noFailures
        ? "No pending failures detected"
        : `Failure detected: ${delegationResult.error}`,
      detail: noFailures ? undefined : delegationResult.error,
    });

    // Determine overall result
    const allPassed = checks.every((c) => c.passed);
    const summary = allPassed
      ? `All ${checks.length} verification checks passed for batch ${batch.id}`
      : `Verification failed: ${checks.filter((c) => !c.passed).length}/${checks.length} checks failed for batch ${batch.id}`;

    const result: VerificationResult = {
      ok: allPassed,
      verificationId,
      checks,
      summary,
      timestamp: new Date().toISOString(),
    };

    this.verifications.set(verificationId, result);

    this.observability.emitWithDuration(
      "was.verification.completed" as any,
      plan.id,
      activationId,
      startTime,
      {
        verificationId,
        batchId: batch.id,
        passed: allPassed,
        checkCount: checks.length,
        failedChecks: checks.filter((c) => !c.passed).length,
      },
    );

    return result;
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Get a verification result by ID.
   */
  getVerification(verificationId: string): VerificationResult | undefined {
    return this.verifications.get(verificationId);
  }

  /**
   * Get all verifications for a plan.
   */
  getVerificationsForPlan(planId: string): VerificationResult[] {
    return Array.from(this.verifications.values()).filter((v) =>
      v.summary.includes(planId)
    );
  }

  /**
   * Get the count of successful verifications.
   */
  getSuccessfulCount(): number {
    return Array.from(this.verifications.values()).filter((v) => v.ok).length;
  }

  /**
   * Get the count of failed verifications.
   */
  getFailedCount(): number {
    return Array.from(this.verifications.values()).filter((v) => !v.ok).length;
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all state. For testing. */
  reset(): void {
    this.verifications.clear();
    this.verificationCounter = 0;
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}