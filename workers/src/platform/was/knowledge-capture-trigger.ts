// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Knowledge Capture Trigger                 │
// │ Triggers knowledge capture from EPCL's KnowledgeCapturer    │
// │ after successful batch execution and verification.          │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  type KnowledgeEntry,
  KnowledgeType,
  FeatureFlag,
} from "../epcl/types.js";
import { isEnabled as epclIsEnabled } from "../epcl/feature-flags.js";
import { KnowledgeCapturer } from "../epcl/knowledge-capturer.js";
import {
  type VerificationResult,
  type WEFDelegationResult,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
} from "./types.js";
import { WASObservability } from "./was-observability.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class KnowledgeCaptureTriggerError extends Error {
  constructor(message: string) {
    super(`KnowledgeCaptureTriggerError: ${message}`);
    this.name = "KnowledgeCaptureTriggerError";
  }
}

// ══════════════════════════════════════════════════════════════
// Knowledge Capture Trigger
// ══════════════════════════════════════════════════════════════

export class KnowledgeCaptureTrigger {
  private static instance: KnowledgeCaptureTrigger;
  private capturedEntriesCount = 0;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private knowledgeCapturer: KnowledgeCapturer;
  private observability: WASObservability;

  private constructor() {
    this.knowledgeCapturer = KnowledgeCapturer.getInstance();
    this.observability = WASObservability.getInstance();
  }

  static getInstance(): KnowledgeCaptureTrigger {
    if (!KnowledgeCaptureTrigger.instance) {
      KnowledgeCaptureTrigger.instance = new KnowledgeCaptureTrigger();
    }
    return KnowledgeCaptureTrigger.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Knowledge Capture ───────────────────────────────────────

  /**
   * Trigger knowledge capture after a batch completes and passes verification.
   *
   * Captures:
   *   1. Execution evidence — delegation result and verification outcome
   *   2. Reusable knowledge — task patterns, batch structure
   *   3. Capability improvement — suggestions based on execution
   *
   * @param plan — The execution plan
   * @param batch — The batch that was executed
   * @param delegationResult — The WEF delegation result
   * @param verificationResult — The verification result
   * @param activationId — The activation lifecycle ID
   * @returns The number of knowledge entries captured
   */
  trigger(
    plan: ExecutionPlan,
    batch: ExecutionBatch,
    delegationResult: WEFDelegationResult,
    verificationResult: VerificationResult,
    activationId: string,
  ): number {
    if (!this.config.enableKnowledgeCapture) {
      return 0;
    }

    const startTime = Date.now();
    let entries = 0;

    try {
      // 1. Capture execution evidence
      this.captureEvidence(plan, batch, delegationResult, verificationResult);
      entries++;

      // 2. Capture reusable knowledge about batch structure
      if (batch.tasks && batch.tasks.length > 0) {
        this.captureReusableKnowledge(plan, batch);
        entries++;
      }

      // 3. Capture capability improvement if verification passed
      if (verificationResult.ok) {
        this.captureCapabilityImprovement(plan, batch, verificationResult);
        entries++;
      }

      this.capturedEntriesCount += entries;

      this.observability.knowledgeCaptured(plan.id, activationId, entries);

      return entries;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      throw new KnowledgeCaptureTriggerError(
        `Failed to capture knowledge for batch ${batch.id}: ${errorMessage}`
      );
    }
  }

  /**
   * Capture execution evidence.
   */
  private captureEvidence(
    plan: ExecutionPlan,
    batch: ExecutionBatch,
    delegationResult: WEFDelegationResult,
    verificationResult: VerificationResult,
  ): void {
    this.knowledgeCapturer.capture(
      KnowledgeType.EVIDENCE,
      `Execution evidence for batch ${batch.id}`,
      `Batch ${batch.id} from plan ${plan.id} executed via WAS. ` +
      `Delegation: ${delegationResult.ok ? "SUCCESS" : "FAILED"} ` +
      `(ID: ${delegationResult.delegationId}). ` +
      `Verification: ${verificationResult.ok ? "PASSED" : "FAILED"} ` +
      `(${verificationResult.checks.filter((c) => c.passed).length}/${verificationResult.checks.length} checks passed).`,
      "was",
      plan.id,
      String(batch.tasks?.length ?? 0),
      [
        `Delegation ID: ${delegationResult.delegationId}`,
        `Verification ID: ${verificationResult.verificationId}`,
        `Tasks: ${batch.tasks?.map((t) => t.id).join(", ") ?? "none"}`,
      ],
    );
  }

  /**
   * Capture reusable knowledge about batch structure.
   */
  private captureReusableKnowledge(plan: ExecutionPlan, batch: ExecutionBatch): void {
    const taskIds = batch.tasks.map((t) => t.id).join(", ");
    this.knowledgeCapturer.capture(
      KnowledgeType.REUSABLE_KNOWLEDGE,
      `Batch structure: ${batch.id}`,
      `Batch ${batch.id} from plan ${plan.id} contains ${batch.tasks.length} tasks: ${taskIds}`,
      "was",
      plan.id,
      String(batch.tasks.length),
      [`Batch has ${batch.tasks.length} tasks across ${plan.phases.length} phases`],
    );
  }

  /**
   * Capture capability improvement suggestion.
   */
  private captureCapabilityImprovement(
    plan: ExecutionPlan,
    batch: ExecutionBatch,
    verificationResult: VerificationResult,
  ): void {
    this.knowledgeCapturer.capture(
      KnowledgeType.CAPABILITY_IMPROVEMENT,
      `WAS activation capability for batch ${batch.id}`,
      `Batch ${batch.id} from plan ${plan.id} successfully activated through WAS. ` +
      `Verification passed with ${verificationResult.checks.length} checks.`,
      "was",
      plan.id,
      String(verificationResult.checks.length),
      [`Verification checks: ${verificationResult.checks.map((c) => `${c.check}=${c.passed}`).join(", ")}`],
    );
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Get the total number of captured entries.
   */
  getCapturedEntryCount(): number {
    return this.capturedEntriesCount;
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all state. For testing. */
  reset(): void {
    this.capturedEntriesCount = 0;
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}