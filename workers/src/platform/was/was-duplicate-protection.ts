// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Duplicate Execution Protection             │
// │ Prevents duplicate activation of the same plan across       │
// │ restarts by checking both in-memory state AND persisted     │
// │ state before allowing a new activation.                    │
// │ Fail-closed by default — duplicate protection is always on │
// │ when the feature flag is enabled.                          │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import { ExecutionStateManager } from "./execution-state-manager.js";
import type { WASPersistenceBackend } from "./was-persistence.js";

// ══════════════════════════════════════════════════════════════
// Duplicate Protection Result
// ══════════════════════════════════════════════════════════════

export interface DuplicateCheckResult {
  /** Whether the plan can be safely activated. */
  canActivate: boolean;
  /** The existing activation ID if a duplicate was found. */
  existingActivationId: string | null;
  /** The existing activation state if a duplicate was found. */
  existingState: string | null;
  /** Whether the duplicate was found in persistent storage. */
  foundInPersistence: boolean;
  /** Human-readable reason. */
  reason: string;
}

// ══════════════════════════════════════════════════════════════
// Duplicate Execution Protection
// ══════════════════════════════════════════════════════════════

export class DuplicateExecutionProtection {
  private stateManager: ExecutionStateManager;
  private persistenceBackend: WASPersistenceBackend | null = null;

  constructor(stateManager?: ExecutionStateManager) {
    this.stateManager = stateManager ?? ExecutionStateManager.getInstance();
  }

  /** Set the persistence backend for cross-restart duplicate checks. */
  setPersistenceBackend(backend: WASPersistenceBackend | null): void {
    this.persistenceBackend = backend;
  }

  /**
   * Check if a plan can be activated without creating a duplicate.
   *
   * Checks TWO layers:
   * 1. In-memory state (for same-process duplicate detection)
   * 2. Persisted state (for cross-restart duplicate detection)
   *
   * @param planId — The EPCL plan ID to check
   * @returns Result indicating whether activation is safe
   */
  async canActivate(planId: string): Promise<DuplicateCheckResult> {
    // 1. Check in-memory state (fast path)
    const inMemoryActive = this.stateManager.isPlanActivated(planId);
    if (inMemoryActive) {
      // Find the existing activation
      const activations = this.stateManager.getActivationsForPlan(planId);
      const activeActivation = activations.find(
        (a) => !this.stateManager.isTerminal(a.state),
      );

      return {
        canActivate: false,
        existingActivationId: activeActivation?.id ?? null,
        existingState: activeActivation?.state ?? null,
        foundInPersistence: false,
        reason: activeActivation
          ? `Plan ${planId} already has active activation (${activeActivation.id}) in state ${activeActivation.state}`
          : `Plan ${planId} already has an active activation in memory`,
      };
    }

    // 2. Check persisted state (for cross-restart detection)
    if (this.persistenceBackend) {
      try {
        const persistedActivations =
          await this.persistenceBackend.listByPlan(planId);

        // Find any non-terminal persisted activation
        const activePersisted = persistedActivations.find((a) => {
          const terminalStates = new Set([
            "deactivated",
            "failed",
            "rejected",
          ]);
          return !terminalStates.has(a.state);
        });

        if (activePersisted) {
          return {
            canActivate: false,
            existingActivationId: activePersisted.id,
            existingState: activePersisted.state,
            foundInPersistence: true,
            reason: `Plan ${planId} already has persisted activation (${activePersisted.id}) in state ${activePersisted.state} from a previous session`,
          };
        }
      } catch {
        // If persistence check fails, allow activation (fail-open for safety)
        // but record the failure
        return {
          canActivate: true,
          existingActivationId: null,
          existingState: null,
          foundInPersistence: false,
          reason: "Persistence check failed — allowing activation as a safety measure",
        };
      }
    }

    // No duplicate found
    return {
      canActivate: true,
      existingActivationId: null,
      existingState: null,
      foundInPersistence: false,
      reason: "No duplicate activation found for this plan",
    };
  }

  /**
   * Get all in-flight activations from persistence that should block
   * new activations for their respective plans.
   *
   * @returns Map of planId → existing activation ID for in-flight activations
   */
  async getInFlightPlans(): Promise<Map<string, string>> {
    const inFlight = new Map<string, string>();

    if (!this.persistenceBackend) return inFlight;

    try {
      const recoverable =
        await this.persistenceBackend.listRecoverable();
      for (const activation of recoverable) {
        inFlight.set(activation.planId, activation.id);
      }
    } catch {
      // Fail open if persistence is unavailable
    }

    return inFlight;
  }
}