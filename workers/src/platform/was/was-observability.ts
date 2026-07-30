// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Observability Service                     │
// │ Emits structured events for monitoring WAS activation       │
// │ lifecycle, batch delegation, and failure modes.             │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  WASEventType,
  WASEvent,
  ActivationState,
  BatchActivationStatus,
  ActivationStage,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
} from "./types.js";

// ══════════════════════════════════════════════════════════════
// Observability Service
// ══════════════════════════════════════════════════════════════

export class WASObservability {
  private static instance: WASObservability;
  private events: WASEvent[] = [];
  private eventCounter = 0;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };

  private constructor() {}

  static getInstance(): WASObservability {
    if (!WASObservability.instance) {
      WASObservability.instance = new WASObservability();
    }
    return WASObservability.instance;
  }

  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  // ── Event Emission ──────────────────────────────────────────

  /**
   * Emit a WAS observability event.
   * Events are stored in-memory and can be retrieved for diagnostics.
   */
  emit(
    type: WASEventType,
    planId: string,
    activationId: string,
    metadata: Record<string, unknown> = {},
    error?: string,
  ): WASEvent {
    const id = `was-ev-${this.eventCounter++}-${Date.now()}`;
    const event: WASEvent = {
      id,
      type,
      planId,
      activationId,
      timestamp: new Date().toISOString(),
      duration: 0,
      metadata,
      error,
    };
    this.events.push(event);
    return event;
  }

  /**
   * Emit an event with duration tracking.
   */
  emitWithDuration(
    type: WASEventType,
    planId: string,
    activationId: string,
    startTime: number,
    metadata: Record<string, unknown> = {},
    error?: string,
  ): WASEvent {
    const id = `was-ev-${this.eventCounter++}-${Date.now()}`;
    const event: WASEvent = {
      id,
      type,
      planId,
      activationId,
      timestamp: new Date().toISOString(),
      duration: Date.now() - startTime,
      metadata,
      error,
    };
    this.events.push(event);
    return event;
  }

  // ── Convenience Emitters ────────────────────────────────────

  /** Emit activation started event. */
  activationStarted(planId: string, activationId: string, metadata: Record<string, unknown> = {}): WASEvent {
    return this.emit(WASEventType.ACTIVATION_STARTED, planId, activationId, {
      ...metadata,
      state: ActivationState.PENDING,
    });
  }

  /** Emit activation validated event. */
  activationValidated(planId: string, activationId: string, gates: number, passed: boolean): WASEvent {
    return this.emit(WASEventType.ACTIVATION_VALIDATED, planId, activationId, {
      gates,
      passed,
      state: passed ? ActivationState.ACTIVATING : ActivationState.REJECTED,
    });
  }

  /** Emit activation rejected event. */
  activationRejected(planId: string, activationId: string, reason: string): WASEvent {
    return this.emit(WASEventType.ACTIVATION_REJECTED, planId, activationId, {
      reason,
      state: ActivationState.REJECTED,
    });
  }

  /** Emit activation failed event. */
  activationFailed(planId: string, activationId: string, stage: ActivationStage, error: string): WASEvent {
    return this.emit(WASEventType.ACTIVATION_FAILED, planId, activationId, {
      stage,
      state: ActivationState.FAILED,
    }, error);
  }

  /** Emit activation completed event. */
  activationCompleted(planId: string, activationId: string, metadata: Record<string, unknown> = {}): WASEvent {
    return this.emit(WASEventType.ACTIVATION_COMPLETED, planId, activationId, {
      ...metadata,
      state: ActivationState.DEACTIVATED,
    });
  }

  /** Emit batch delegated event. */
  batchDelegated(planId: string, activationId: string, batchId: string, delegationId: string): WASEvent {
    return this.emit(WASEventType.BATCH_DELEGATED, planId, activationId, {
      batchId,
      delegationId,
      status: BatchActivationStatus.DELEGATED,
    });
  }

  /** Emit WEF delegation completed event. */
  wefDelegationCompleted(planId: string, activationId: string, batchId: string, delegationId: string): WASEvent {
    return this.emit(WASEventType.WEF_DELEGATION_COMPLETED, planId, activationId, {
      batchId,
      delegationId,
    });
  }

  /** Emit WEF delegation failed event. */
  wefDelegationFailed(planId: string, activationId: string, batchId: string, error: string): WASEvent {
    return this.emit(WASEventType.WEF_DELEGATION_FAILED, planId, activationId, {
      batchId,
    }, error);
  }

  /** Emit knowledge captured event. */
  knowledgeCaptured(planId: string, activationId: string, entryCount: number): WASEvent {
    return this.emit(WASEventType.KNOWLEDGE_CAPTURED, planId, activationId, {
      entryCount,
    });
  }

  /** Emit status reported event. */
  statusReported(planId: string, activationId: string, reportSummary: string): WASEvent {
    return this.emit(WASEventType.STATUS_REPORTED, planId, activationId, {
      summary: reportSummary,
    });
  }

  /** Emit recovery attempted event. */
  recoveryAttempted(planId: string, activationId: string, reason: string): WASEvent {
    return this.emit(WASEventType.RECOVERY_ATTEMPTED, planId, activationId, {
      reason,
    });
  }

  /** Emit recovery succeeded event. */
  recoverySucceeded(planId: string, activationId: string): WASEvent {
    return this.emit(WASEventType.RECOVERY_SUCCEEDED, planId, activationId);
  }

  /** Emit recovery failed event. */
  recoveryFailed(planId: string, activationId: string, error: string): WASEvent {
    return this.emit(WASEventType.RECOVERY_FAILED, planId, activationId, {}, error);
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Get all events for a specific activation.
   */
  getEventsForActivation(activationId: string): WASEvent[] {
    return this.events.filter((e) => e.activationId === activationId);
  }

  /**
   * Get all events for a specific plan.
   */
  getEventsForPlan(planId: string): WASEvent[] {
    return this.events.filter((e) => e.planId === planId);
  }

  /**
   * Get all events of a specific type.
   */
  getEventsByType(type: WASEventType): WASEvent[] {
    return this.events.filter((e) => e.type === type);
  }

  /**
   * Get the most recent events, up to the given limit.
   */
  getRecentEvents(limit: number = 50): WASEvent[] {
    return this.events.slice(-limit);
  }

  /**
   * Get all events.
   */
  getAllEvents(): WASEvent[] {
    return [...this.events];
  }

  /**
   * Clear all events. For testing.
   */
  clear(): void {
    this.events = [];
    this.eventCounter = 0;
  }

  /** Reset all state. For testing. */
  reset(): void {
    this.clear();
    this.config = { ...DEFAULT_WAS_CONFIG };
  }
}