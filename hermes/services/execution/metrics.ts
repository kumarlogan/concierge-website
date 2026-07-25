// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution Metrics Boundary                   │
// │ EPIC-004.6 PHASE 4 · provider-neutral metrics interface.       │
// │                                                            \
// │ Memory implementation only. NO external telemetry, NO         │
// │ dashboards. Just an in-process counter surface other layers   │
// │ can read. Future: a Prometheus/OTel sink can implement the    │
// │ same interface without touching call sites.                   │
// └─────────────────────────────────────────────────────────────┘

/** Provider-neutral execution metrics surface. */
export interface ExecutionMetrics {
  executionsStarted(): number;
  executionsCompleted(): number;
  executionsFailed(): number;
  executionsCancelled(): number;
  retries(): number;
  averageDurationMs(): number;
  providerFailures(): number;

  /** Record lifecycle events (the only mutators). */
  recordStart(): void;
  recordCompleted(durationMs: number): void;
  recordFailed(durationMs: number): void;
  recordCancelled(): void;
  recordRetry(): void;
  recordProviderFailure(providerId: string): void;

  /** Snapshot for introspection / tests. */
  snapshot(): ExecutionMetricsSnapshot;
}

export interface ExecutionMetricsSnapshot {
  started: number;
  completed: number;
  failed: number;
  cancelled: number;
  retries: number;
  averageDurationMs: number;
  providerFailures: number;
  providerFailureBreakdown: Record<string, number>;
}

/**
 * In-memory metrics collector. Pure counters — safe to call from any path,
 * zero external dependencies.
 */
export class MemoryExecutionMetrics implements ExecutionMetrics {
  private started = 0;
  private completed = 0;
  private failed = 0;
  private cancelled = 0;
  private retryCount = 0;
  private durations: number[] = [];
  private providerFailureCount = 0;
  private readonly failureByProvider = new Map<string, number>();

  executionsStarted(): number { return this.started; }
  executionsCompleted(): number { return this.completed; }
  executionsFailed(): number { return this.failed; }
  executionsCancelled(): number { return this.cancelled; }
  retries(): number { return this.retryCount; }
  providerFailures(): number { return this.providerFailureCount; }

  averageDurationMs(): number {
    if (this.durations.length === 0) return 0;
    const sum = this.durations.reduce((a, b) => a + b, 0);
    return sum / this.durations.length;
  }

  recordStart(): void { this.started += 1; }
  recordCompleted(durationMs: number): void {
    this.completed += 1;
    this.durations.push(durationMs);
  }
  recordFailed(durationMs: number): void {
    this.failed += 1;
    this.durations.push(durationMs);
  }
  recordCancelled(): void { this.cancelled += 1; }
  recordRetry(): void { this.retryCount += 1; }
  recordProviderFailure(providerId: string): void {
    this.providerFailureCount += 1;
    this.failureByProvider.set(providerId, (this.failureByProvider.get(providerId) ?? 0) + 1);
  }

  snapshot(): ExecutionMetricsSnapshot {
    return {
      started: this.started,
      completed: this.completed,
      failed: this.failed,
      cancelled: this.cancelled,
      retries: this.retryCount,
      averageDurationMs: this.averageDurationMs(),
      providerFailures: this.providerFailureCount,
      providerFailureBreakdown: Object.fromEntries(this.failureByProvider),
    };
  }

  /** Clear all counters (restart / test isolation). */
  reset(): void {
    this.started = 0;
    this.completed = 0;
    this.failed = 0;
    this.cancelled = 0;
    this.retryCount = 0;
    this.durations = [];
    this.providerFailureCount = 0;
    this.failureByProvider.clear();
  }
}
