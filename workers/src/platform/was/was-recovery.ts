// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Recovery Orchestrator                      │
// │ Handles startup recovery: loads persisted activation state   │
// │ from D1, restores in-memory state, and reports status.      │
// │ Fail-closed by default — no autonomous execution without    │
// │ explicit recovery.                                          │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import { ExecutionStateManager } from "./execution-state-manager.js";
import type { WASPersistenceBackend } from "./was-persistence.js";
import { WASEventType, ActivationState } from "./types.js";
import { WASObservability } from "./was-observability.js";
import type { WASConfig } from "./types.js";

// ══════════════════════════════════════════════════════════════
// Recovery Result
// ══════════════════════════════════════════════════════════════

export interface RecoveryResult {
  /** Total number of persisted activations found. */
  totalFound: number;
  /** Number of activations successfully recovered into memory. */
  recovered: number;
  /** Number of activations that were terminal and skipped. */
  skippedTerminal: number;
  /** Number of activations that failed to recover. */
  failed: number;
  /** Whether recovery completed successfully. */
  ok: boolean;
  /** Recovery duration in milliseconds. */
  durationMs: number;
  /** List of recovered activation IDs. */
  recoveredIds: string[];
  /** Human-readable summary. */
  summary: string;
  /** Timestamp of recovery (ISO-8601). */
  timestamp: string;
}

// ══════════════════════════════════════════════════════════════
// Recovery Error
// ══════════════════════════════════════════════════════════════

export class RecoveryError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(`RecoveryError: ${message}`);
    this.name = "RecoveryError";
  }
}

// ══════════════════════════════════════════════════════════════
// Recovery Orchestrator
// ══════════════════════════════════════════════════════════════

export class WASRecoveryOrchestrator {
  private stateManager: ExecutionStateManager;
  private observability: WASObservability;

  constructor(
    stateManager?: ExecutionStateManager,
    observability?: WASObservability,
  ) {
    this.stateManager = stateManager ?? ExecutionStateManager.getInstance();
    this.observability = observability ?? WASObservability.getInstance();
  }

  /**
   * Run the full startup recovery procedure.
   *
   * 1. Load persisted activations from the backend
   * 2. Restore them into the in-memory state manager
   * 3. Classify each as recoverable, terminal, or failed
   * 4. Emit observability events
   * 5. Return a detailed recovery report
   *
   * @param backend — The persistence backend to recover from
   * @param config — Current WAS configuration
   * @returns A detailed recovery result
   */
  async recover(
    backend: WASPersistenceBackend,
    config: WASConfig,
  ): Promise<RecoveryResult> {
    const startTime = Date.now();
    const timestamp = new Date().toISOString();
    const recoveredIds: string[] = [];

    this.observability.emit(
      WASEventType.RECOVERY_ATTEMPTED,
      "system",
      "system",
      { recoveryStage: "startup", timestamp },
    );

    try {
      // Set the persistence backend on the state manager
      this.stateManager.setPersistenceBackend(backend);

      // Enable persistence and recovery in config
      this.stateManager.configure({
        enablePersistence: true,
        enableRecovery: true,
      });

      // Load all activations from persistence
      const allPersisted = await backend.listRecoverable();

      // Classify each activation
      let recovered = 0;
      let skippedTerminal = 0;
      let failed = 0;

      for (const activation of allPersisted) {
        try {
          const state = activation.state as ActivationState;

          // Skip terminal states
          if (
            state === ActivationState.DEACTIVATED ||
            state === ActivationState.FAILED ||
            state === ActivationState.REJECTED
          ) {
            skippedTerminal++;
            continue;
          }

          recoveredIds.push(activation.id);
          recovered++;
        } catch {
          failed++;
        }
      }

      // Restore into the state manager
      const restoredCount = await this.stateManager.restoreFromPersistence();

      const durationMs = Date.now() - startTime;

      const result: RecoveryResult = {
        totalFound: allPersisted.length,
        recovered: restoredCount,
        skippedTerminal,
        failed,
        ok: failed === 0,
        durationMs,
        recoveredIds,
        summary: buildSummary(restoredCount, allPersisted.length, durationMs),
        timestamp: new Date().toISOString(),
      };

      // Emit success or failure event
      if (result.ok) {
        this.observability.emit(
          WASEventType.RECOVERY_SUCCEEDED,
          "system",
          "system",
          {
            recovered: result.recovered,
            totalFound: result.totalFound,
            recoveredIds: result.recoveredIds,
            durationMs,
          },
        );
      } else {
        this.observability.emit(
          WASEventType.RECOVERY_FAILED,
          "system",
          "system",
          {
            recovered: result.recovered,
            totalFound: result.totalFound,
            failed: result.failed,
            durationMs,
          },
          `${result.failed} activations failed to recover`,
        );
      }

      return result;
    } catch (err) {
      const durationMs = Date.now() - startTime;

      this.observability.emit(
        WASEventType.RECOVERY_FAILED,
        "system",
        "system",
        { recoveryStage: "startup", durationMs },
        `Recovery orchestrator failed: ${err instanceof Error ? err.message : String(err)}`,
      );

      throw new RecoveryError(
        `Recovery orchestrator failed: ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err : undefined,
      );
    }
  }

  /**
   * Attempt to recover a single activation by its ID.
   * Useful for on-demand recovery of a specific activation.
   */
  async recoverOne(
    backend: WASPersistenceBackend,
    activationId: string,
  ): Promise<ActivationState | null> {
    const activation = await backend.get(activationId);
    if (!activation) return null;

    const state = activation.state as ActivationState;
    if (
      state === ActivationState.DEACTIVATED ||
      state === ActivationState.FAILED ||
      state === ActivationState.REJECTED
    ) {
      return null;
    }

    return state;
  }
}

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function buildSummary(
  recovered: number,
  total: number,
  durationMs: number,
): string {
  if (total === 0) {
    return "No persisted activations found — clean startup";
  }
  if (recovered === total) {
    return `All ${total} persisted activations recovered successfully in ${durationMs}ms`;
  }
  return `${recovered} of ${total} activations recovered in ${durationMs}ms`;
}