// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Graceful Degradation                       │
// │ Provides fallback behavior when D1 persistence is           │
// │ unavailable, transiently failing, or returning errors.      │
// │ Ensures the activation lifecycle continues in degraded mode │
// │ while recording the degradation event for observability.   │
// │ Fail-closed by default — degraded state is explicit.        │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import type { WASPersistenceBackend } from "./was-persistence.js";
import { ExecutionStateManager } from "./execution-state-manager.js";

// ══════════════════════════════════════════════════════════════
// Degradation State
// ══════════════════════════════════════════════════════════════

export interface DegradationState {
  /** Whether the system is currently in degraded mode. */
  degraded: boolean;
  /** Timestamp when degradation was first detected (ISO-8601). */
  degradedAt: string | null;
  /** Number of consecutive failures that triggered degradation. */
  failureCount: number;
  /** Whether a fallback backend is available. */
  hasFallback: boolean;
  /** Whether the system was restored from degraded state. */
  restored: boolean;
  /** Timestamp of last restoration (ISO-8601). */
  restoredAt: string | null;
}

// ══════════════════════════════════════════════════════════════
// Config
// ══════════════════════════════════════════════════════════════

export interface DegradationConfig {
  /** Number of consecutive failures before activating degradation. */
  threshold: number;
  /** Whether to enable automatic fallback to memory backend. */
  enableFallback: boolean;
  /** Interval in ms between retry attempts to restore D1. */
  retryIntervalMs: number;
}

const DEFAULT_DEGRADATION_CONFIG: DegradationConfig = {
  threshold: 3,
  enableFallback: true,
  retryIntervalMs: 30_000,
};

// ══════════════════════════════════════════════════════════════
// Graceful Degradation Manager
// ══════════════════════════════════════════════════════════════

export class GracefulDegradationManager {
  private state: DegradationState = {
    degraded: false,
    degradedAt: null,
    failureCount: 0,
    hasFallback: false,
    restored: false,
    restoredAt: null,
  };

  private config: DegradationConfig = { ...DEFAULT_DEGRADATION_CONFIG };
  private primaryBackend: WASPersistenceBackend | null = null;
  private fallbackBackend: WASPersistenceBackend | null = null;
  private stateManager: ExecutionStateManager;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(stateManager?: ExecutionStateManager) {
    this.stateManager = stateManager ?? ExecutionStateManager.getInstance();
  }

  /** Configure degradation parameters. */
  configure(config: Partial<DegradationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get the current degradation state. */
  getState(): Readonly<DegradationState> {
    return { ...this.state };
  }

  /** Check if the system is in degraded mode. */
  isDegraded(): boolean {
    return this.state.degraded;
  }

  /**
   * Register backends for primary and fallback.
   *
   * @param primary — The primary D1-backed backend
   * @param fallback — The memory-backed fallback
   */
  registerBackends(
    primary: WASPersistenceBackend,
    fallback: WASPersistenceBackend,
  ): void {
    this.primaryBackend = primary;
    this.fallbackBackend = fallback;
    this.state.hasFallback = true;
  }

  /**
   * Record a persistence failure.
   * If the failure count exceeds the threshold, activates degraded mode
   * and switches to the fallback backend.
   *
   * @returns Whether degradation was activated
   */
  recordFailure(): boolean {
    this.state.failureCount++;

    if (
      !this.state.degraded &&
      this.state.failureCount >= this.config.threshold
    ) {
      this.activateDegradation();
      return true;
    }

    return false;
  }

  /**
   * Record a success (restores from degraded mode if applicable).
   */
  recordSuccess(): void {
    if (this.state.degraded) {
      this.restore();
    }
    this.state.failureCount = 0;
  }

  // ── Internal ───────────────────────────────────────────────

  private activateDegradation(): void {
    this.state.degraded = true;
    this.state.degradedAt = new Date().toISOString();

    if (this.config.enableFallback && this.fallbackBackend) {
      // Switch state manager to fallback backend
      this.stateManager.setPersistenceBackend(this.fallbackBackend);

      // Start periodic retry of primary backend
      this.scheduleRetry();
    }
  }

  private restore(): void {
    this.state.degraded = false;
    this.state.restored = true;
    this.state.restoredAt = new Date().toISOString();

    // Switch back to primary backend
    if (this.primaryBackend) {
      this.stateManager.setPersistenceBackend(this.primaryBackend);
    }

    // Cancel any pending retry
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  private scheduleRetry(): void {
    if (this.retryTimer) return;

    this.retryTimer = setTimeout(async () => {
      this.retryTimer = null;

      if (!this.state.degraded || !this.primaryBackend) return;

      try {
        // Try a simple operation to test D1 availability
        const testValue = `degradation-test-${Date.now()}`;
        // Attempt to list recoverable (cheapest D1 call)
        await this.primaryBackend.listRecoverable();

        // Success — restore
        this.restore();
      } catch {
        // Still degraded — schedule another retry
        this.scheduleRetry();
      }
    }, this.config.retryIntervalMs);
  }

  /** Reset degradation state. For testing. */
  reset(): void {
    this.state = {
      degraded: false,
      degradedAt: null,
      failureCount: 0,
      hasFallback: false,
      restored: false,
      restoredAt: null,
    };
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }
}