// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Recovery Manager                        │
// │ Manages interruption recovery — saves checkpoints,         │
// │ resumes interrupted batches, handles failures.             │
// └─────────────────────────────────────────────────────────────┘

import {
  type RecoverySnapshot,
  type ExecutionPlan,
  type ExecutionBatch,
  type BatchCheckpoint,
  type PlanState,
  PlanStatus,
  BatchStatus,
  TaskStatus,
  FeatureFlag,
} from "./types.js";
import { isEnabled, getConfig } from "./feature-flags.js";

// ── Error ────────────────────────────────────────────────────

export class RecoveryError extends Error {
  constructor(message: string) {
    super(`RecoveryError: ${message}`);
    this.name = "RecoveryError";
  }
}

// ── Recovery Manager ─────────────────────────────────────────

export class RecoveryManager {
  private static instance: RecoveryManager;
  private snapshots: Map<string, RecoverySnapshot> = new Map();
  private snapshotCounter = 0;

  private constructor() {}

  static getInstance(): RecoveryManager {
    if (!RecoveryManager.instance) {
      RecoveryManager.instance = new RecoveryManager();
    }
    return RecoveryManager.instance;
  }

  // ── Snapshot Management ─────────────────────────────────────

  /**
   * Create a recovery snapshot for a plan.
   */
  createSnapshot(plan: ExecutionPlan): RecoverySnapshot {
    const id = `snapshot-${this.snapshotCounter++}-${Date.now()}`;
    const snapshot: RecoverySnapshot = {
      id,
      planId: plan.id,
      planStatus: plan.status,
      batchSnapshots: plan.batches.map((b) => ({
        batchId: b.id,
        status: b.status,
        checkpoint: { ...b.checkpoint },
        resolution: undefined,
      })),
      createdAt: new Date().toISOString(),
      version: 1,
      stateHash: this.computeStateHash(plan),
    };

    this.snapshots.set(id, snapshot);
    return snapshot;
  }

  /**
   * Get the latest snapshot for a plan.
   */
  getLatestSnapshot(planId: string): RecoverySnapshot | undefined {
    const planSnapshots = Array.from(this.snapshots.values())
      .filter((s) => s.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return planSnapshots[0];
  }

  /**
   * Get all snapshots for a plan.
   */
  getSnapshots(planId: string): RecoverySnapshot[] {
    return Array.from(this.snapshots.values())
      .filter((s) => s.planId === planId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ── Recovery ───────────────────────────────────────────────

  /**
   * Attempt to resume a plan from its latest snapshot.
   * Returns the list of batches that need to be resumed.
   */
  resumePlan(plan: ExecutionPlan): {
    needsResume: ExecutionBatch[];
    needsRestart: ExecutionBatch[];
    canResume: boolean;
  } {
    const snapshot = this.getLatestSnapshot(plan.id);
    if (!snapshot) {
      return {
        needsResume: [],
        needsRestart: plan.batches,
        canResume: false,
      };
    }

    // Check if state is intact
    const currentHash = this.computeStateHash(plan);
    if (currentHash !== snapshot.stateHash) {
      return {
        needsResume: [],
        needsRestart: plan.batches,
        canResume: false,
      };
    }

    const needsResume: ExecutionBatch[] = [];
    const needsRestart: ExecutionBatch[] = [];

    for (const batch of plan.batches) {
      const batchSnapshot = snapshot.batchSnapshots.find((bs) => bs.batchId === batch.id);
      if (!batchSnapshot) {
        needsRestart.push(batch);
        continue;
      }

      switch (batchSnapshot.status) {
        case BatchStatus.COMPLETED:
          // Already done, skip
          break;
        case BatchStatus.RUNNING:
        case BatchStatus.PENDING:
          // Can be resumed
          if (batchSnapshot.checkpoint.progress > 0) {
            needsResume.push(batch);
          } else {
            needsRestart.push(batch);
          }
          break;
        case BatchStatus.FAILED:
          if (getConfig().recovery.maxResumeAttempts > 0) {
            needsResume.push(batch);
          } else {
            needsRestart.push(batch);
          }
          break;
        case BatchStatus.SKIPPED:
          // Explicitly skipped, respect that
          break;
      }
    }

    return {
      needsResume,
      needsRestart,
      canResume: needsResume.length > 0 || needsRestart.length > 0,
    };
  }

  /**
   * Resume a single batch from its checkpoint.
   */
  resumeBatch(
    batch: ExecutionBatch,
    checkpoint: BatchCheckpoint
  ): ResumeInstruction[] {
    const instructions: ResumeInstruction[] = [];

    // Tasks already completed
    const completedIds = new Set(checkpoint.completedTasks);

    for (const task of batch.tasks) {
      if (completedIds.has(task.id)) {
        instructions.push({
          taskId: task.id,
          action: "skip",
          reason: "Already completed",
        });
        continue;
      }

      // Check if task dependencies are satisfied
      const depsSatisfied = task.dependencies.every((depId) =>
        completedIds.has(depId)
      );

      if (!depsSatisfied) {
        instructions.push({
          taskId: task.id,
          action: "wait",
          reason: `Dependency not satisfied: ${task.dependencies.filter(
            (d) => !completedIds.has(d)
          ).join(", ")}`,
        });
        continue;
      }

      instructions.push({
        taskId: task.id,
        action: "continue",
        reason: "Ready to execute",
      });
    }

    return instructions;
  }

  /**
   * Handle a batch failure and determine the appropriate recovery action.
   */
  handleFailure(
    batch: ExecutionBatch,
    error: string
  ): FailureResolution {
    const config = getConfig();
    const failedTaskCount = batch.checkpoint.failedTasks.length;

    // Determine if we can retry
    const retriesRemaining = config.recovery.maxResumeAttempts - failedTaskCount;
    if (retriesRemaining > 0) {
      return {
        action: "retry",
        retriesRemaining,
        message: `Batch "${batch.name}" failed with ${failedTaskCount} failed tasks. ${retriesRemaining} retries remaining.`,
        checkpoint: batch.checkpoint,
      };
    }

    // Check if we can skip failed tasks
    const completedTasks = batch.checkpoint.completedTasks.length;
    const totalTasks = batch.tasks.length;
    if (completedTasks / totalTasks > 0.7) {
      return {
        action: "skip_failed",
        retriesRemaining: 0,
        message: `Batch "${batch.name}" is ${Math.round(completedTasks / totalTasks * 100)}% complete. Skipping failed tasks (${failedTaskCount}).`,
        checkpoint: batch.checkpoint,
      };
    }

    // Must restart the batch
    return {
      action: "restart",
      retriesRemaining: 0,
      message: `Batch "${batch.name}" has too many failures (${failedTaskCount}). Restarting.`,
      checkpoint: batch.checkpoint,
    };
  }

  /**
   * Mark a failure permanently (not recoverable).
   */
  markPermanentFailure(batchId: string, error: string): void {
    const snapshot = Array.from(this.snapshots.values())
      .find((s) => s.batchSnapshots.some((bs) => bs.batchId === batchId));

    if (snapshot) {
      const batchSnapshot = snapshot.batchSnapshots.find(
        (bs) => bs.batchId === batchId
      );
      if (batchSnapshot) {
        batchSnapshot.resolution = {
          action: "permanent_failure",
          reason: error,
        };
      }
    }
  }

  // ── State Management ───────────────────────────────────────

  /**
   * Save current plan state as a recovery point.
   */
  checkpoint(plan: ExecutionPlan): void {
    this.createSnapshot(plan);

    // Cleanup old snapshots beyond retention
    const config = getConfig();
    const retentionMs = config.recovery.stateRetentionDays * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - retentionMs;

    for (const [id, snapshot] of this.snapshots) {
      if (new Date(snapshot.createdAt).getTime() < cutoff) {
        this.snapshots.delete(id);
      }
    }
  }

  /**
   * Clear all snapshots for a completed plan.
   */
  finalizePlan(planId: string): void {
    for (const [id, snapshot] of this.snapshots) {
      if (snapshot.planId === planId) {
        this.snapshots.delete(id);
      }
    }
  }

  // ── Private ────────────────────────────────────────────────

  private computeStateHash(plan: ExecutionPlan): string {
    // Simple deterministic hash of plan state
    const state = plan.batches.map((b) =>
      `${b.id}:${b.status}:${b.checkpoint.progress}`
    ).join("|");
    return this.simpleHash(state);
  }

  private simpleHash(s: string): string {
    let hash = 0;
    for (let i = 0; i < s.length; i++) {
      const char = s.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.snapshots.clear();
    this.snapshotCounter = 0;
  }
}

// ── Supporting Types ─────────────────────────────────────────

export interface ResumeInstruction {
  taskId: string;
  action: "continue" | "skip" | "wait";
  reason: string;
}

export interface FailureResolution {
  action: "retry" | "skip_failed" | "restart";
  retriesRemaining: number;
  message: string;
  checkpoint: BatchCheckpoint;
}