// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Execution State Manager                   │
// │ Manages the activation state machine, transitions,          │
// │ persistence, and recovery for all WAS activations.          │
// │ Fail-closed by default — no autonomous activation without   │
// │ explicit state transitions through this manager.            │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  ActivationState,
  ActivationStage,
  ActivationLifecycle,
  ActivationFailure,
  BatchActivationStatus,
  ActivatedBatch,
  RejectionDetail,
  ValidationResult,
  type WASConfig,
  DEFAULT_WAS_CONFIG,
} from "./types.js";

import type { WASPersistenceBackend } from "./was-persistence.js";

// ══════════════════════════════════════════════════════════════
// Error
// ══════════════════════════════════════════════════════════════

export class ExecutionStateError extends Error {
  constructor(message: string) {
    super(`ExecutionStateError: ${message}`);
    this.name = "ExecutionStateError";
  }
}

export class StateTransitionError extends ExecutionStateError {
  constructor(from: ActivationState, to: ActivationState, reason: string) {
    super(`Cannot transition from ${from} to ${to}: ${reason}`);
    this.name = "StateTransitionError";
  }
}

// ══════════════════════════════════════════════════════════════
// Valid State Transitions
// ══════════════════════════════════════════════════════════════

/**
 * Valid state transitions for the activation lifecycle.
 * Key: current state, Value: set of allowed next states.
 */
const VALID_TRANSITIONS: Record<ActivationState, Set<ActivationState>> = {
  [ActivationState.PENDING]: new Set([
    ActivationState.VALIDATING,
    ActivationState.FAILED,
  ]),
  [ActivationState.VALIDATING]: new Set([
    ActivationState.ACTIVATING,
    ActivationState.FAILED,
    ActivationState.REJECTED,
  ]),
  [ActivationState.ACTIVATING]: new Set([
    ActivationState.ACTIVE,
    ActivationState.FAILED,
  ]),
  [ActivationState.ACTIVE]: new Set([
    ActivationState.DEACTIVATING,
  ]),
  [ActivationState.DEACTIVATING]: new Set([
    ActivationState.DEACTIVATED,
    ActivationState.FAILED,
  ]),
  [ActivationState.DEACTIVATED]: new Set([]),
  [ActivationState.FAILED]: new Set([]),
  [ActivationState.REJECTED]: new Set([]),
};

// ══════════════════════════════════════════════════════════════
// Execution State Manager
// ══════════════════════════════════════════════════════════════

export class ExecutionStateManager {
  private static instance: ExecutionStateManager;
  private activations: Map<string, ActivationLifecycle> = new Map();
  private activationCounter = 0;
  private config: WASConfig = { ...DEFAULT_WAS_CONFIG };
  private persistenceBackend: WASPersistenceBackend | null = null;
  private persistedIds: Set<string> = new Set();

  private constructor() {}

  static getInstance(): ExecutionStateManager {
    if (!ExecutionStateManager.instance) {
      ExecutionStateManager.instance = new ExecutionStateManager();
    }
    return ExecutionStateManager.instance;
  }

  // ── Persistence Integration ─────────────────────────────────

  /**
   * Set the persistence backend for checkpointing activation state.
   * When set, every mutation is automatically persisted.
   */
  setPersistenceBackend(backend: WASPersistenceBackend | null): void {
    this.persistenceBackend = backend;
  }

  /**
   * Get the current persistence backend.
   */
  getPersistenceBackend(): WASPersistenceBackend | null {
    return this.persistenceBackend;
  }

  /**
   * Checkpoint a single activation lifecycle to the persistence backend.
   * Fire-and-forget — does not block the caller.
   * Errors are silently caught (persistence is best-effort for now).
   */
  private async checkpoint(activation: ActivationLifecycle): Promise<void> {
    if (!this.persistenceBackend || !this.config.enablePersistence) return;

    try {
      await this.persistenceBackend.put(activation);
      this.persistedIds.add(activation.id);
    } catch {
      // Persistence is best-effort — do not crash the main path
    }
  }

  /**
   * Restore state from the persistence backend on startup.
   * Loads all non-terminal activations into memory.
   * @returns The number of recovered activations
   */
  async restoreFromPersistence(): Promise<number> {
    if (!this.persistenceBackend || !this.config.enableRecovery) return 0;

    try {
      const recoverable = await this.persistenceBackend.listRecoverable();
      for (const activation of recoverable) {
        // Track the activation counter to avoid ID collisions
        const match = activation.id.match(/^was-(\d+)-/);
        if (match) {
          const counter = parseInt(match[1], 10);
          if (counter >= this.activationCounter) {
            this.activationCounter = counter + 1;
          }
        }
        this.activations.set(activation.id, activation);
        this.persistedIds.add(activation.id);
      }
      return recoverable.length;
    } catch {
      return 0;
    }
  }

  /**
   * Check if an activation has been persisted.
   */
  isPersisted(activationId: string): boolean {
    return this.persistedIds.has(activationId);
  }

  /**
   * Get the list of activation IDs that have been persisted.
   */
  getPersistedIds(): string[] {
    return Array.from(this.persistedIds);
  }

  // ── Configuration ──────────────────────────────────────────

  /** Update the WAS configuration. */
  configure(config: Partial<WASConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Get current WAS configuration. */
  getConfig(): Readonly<WASConfig> {
    return { ...this.config };
  }

  // ── Activation Lifecycle Management ─────────────────────────

  /**
   * Create a new activation lifecycle record for a plan.
   * Generates a unique activation ID and idempotency key.
   *
   * @param planId — The EPCL execution plan ID
   * @returns The newly created activation lifecycle
   * @throws {ExecutionStateError} if the plan is already activated
   */
  createActivation(planId: string): ActivationLifecycle {
    // Check for duplicate activation
    for (const activation of this.activations.values()) {
      if (activation.planId === planId && !this.isTerminal(activation.state)) {
        throw new ExecutionStateError(
          `Plan ${planId} already has an active activation (${activation.id}). ` +
          "Deactivate or wait for the existing activation to complete before reactivating."
        );
      }
    }

    const id = `was-${this.activationCounter++}-${Date.now()}`;
    const now = new Date().toISOString();

    const lifecycle: ActivationLifecycle = {
      id,
      planId,
      state: ActivationState.PENDING,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      idempotencyKey: `${planId}::${id}`,
      validation: null,
      activatedBatches: [],
      failure: null,
      rejection: null,
    };

    this.activations.set(id, lifecycle);
    // Persist the new activation
    this.checkpoint(lifecycle);
    return lifecycle;
  }

  /**
   * Transition an activation to a new state.
   * Validates the transition against the state machine.
   *
   * @param activationId — The activation to transition
   * @param toState — The target state
   * @returns The updated activation lifecycle
   * @throws {StateTransitionError} if the transition is invalid
   * @throws {ExecutionStateError} if the activation is not found
   */
  transitionState(activationId: string, toState: ActivationState): ActivationLifecycle {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    const fromState = lifecycle.state;
    const allowed = VALID_TRANSITIONS[fromState];

    if (!allowed.has(toState)) {
      throw new StateTransitionError(
        fromState,
        toState,
        `Transition not allowed. Allowed transitions from ${fromState}: ${Array.from(allowed).join(", ")}`
      );
    }

    const now = new Date().toISOString();
    lifecycle.state = toState;
    lifecycle.updatedAt = now;

    // Set completedAt for terminal states
    if (this.isTerminal(toState)) {
      lifecycle.completedAt = now;
    }

    // Persist the state transition
    this.checkpoint(lifecycle);

    return lifecycle;
  }

  /**
   * Check if a state is terminal (no further transitions allowed).
   */
  isTerminal(state: ActivationState): boolean {
    return VALID_TRANSITIONS[state].size === 0;
  }

  /**
   * Check if a state is a failure/error terminal.
   */
  isFailedState(state: ActivationState): boolean {
    return state === ActivationState.FAILED || state === ActivationState.REJECTED;
  }

  // ── Batch Management ───────────────────────────────────────

  /**
   * Add an activated batch to an activation lifecycle.
   */
  addBatch(activationId: string, batchId: string): ActivatedBatch {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    const activatedBatch: ActivatedBatch = {
      batchId,
      status: BatchActivationStatus.PENDING,
      activatedAt: null,
      wefDelegationId: null,
      completedAt: null,
      failure: null,
    };

    lifecycle.activatedBatches.push(activatedBatch);
    lifecycle.updatedAt = new Date().toISOString();
    return activatedBatch;
  }

  /**
   * Update a batch's activation status.
   */
  updateBatchStatus(
    activationId: string,
    batchId: string,
    status: BatchActivationStatus,
  ): ActivatedBatch {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    const batch = lifecycle.activatedBatches.find((b) => b.batchId === batchId);
    if (!batch) {
      throw new ExecutionStateError(
        `Batch ${batchId} not found in activation ${activationId}`
      );
    }

    const now = new Date().toISOString();
    batch.status = status;
    batch.activatedAt = status === BatchActivationStatus.ACTIVATING ? now : batch.activatedAt;
    batch.completedAt = this.isBatchTerminal(status) ? now : batch.completedAt;
    lifecycle.updatedAt = now;

    return batch;
  }

  /**
   * Set WEF delegation ID for a batch.
   */
  setBatchDelegation(activationId: string, batchId: string, wefDelegationId: string): void {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    const batch = lifecycle.activatedBatches.find((b) => b.batchId === batchId);
    if (!batch) {
      throw new ExecutionStateError(
        `Batch ${batchId} not found in activation ${activationId}`
      );
    }

    batch.wefDelegationId = wefDelegationId;
    batch.status = BatchActivationStatus.DELEGATED;
    lifecycle.updatedAt = new Date().toISOString();
  }

  /**
   * Record a batch failure.
   */
  recordBatchFailure(activationId: string, batchId: string, failure: ActivationFailure): void {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    const batch = lifecycle.activatedBatches.find((b) => b.batchId === batchId);
    if (!batch) {
      throw new ExecutionStateError(
        `Batch ${batchId} not found in activation ${activationId}`
      );
    }

    batch.status = BatchActivationStatus.FAILED;
    batch.failure = failure;
    batch.completedAt = new Date().toISOString();
    lifecycle.updatedAt = new Date().toISOString();
  }

  private isBatchTerminal(status: BatchActivationStatus): boolean {
    return [
      BatchActivationStatus.COMPLETED,
      BatchActivationStatus.FAILED,
      BatchActivationStatus.SKIPPED,
    ].includes(status);
  }

  // ── Validation & Rejection ──────────────────────────────────

  /**
   * Set validation result for an activation.
   */
  setValidation(activationId: string, validation: ValidationResult): void {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    lifecycle.validation = validation;
    lifecycle.updatedAt = new Date().toISOString();
  }

  /**
   * Reject an activation with details.
   */
  reject(activationId: string, rejection: RejectionDetail): void {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    lifecycle.rejection = rejection;
    lifecycle.state = ActivationState.REJECTED;
    lifecycle.updatedAt = new Date().toISOString();
    lifecycle.completedAt = new Date().toISOString();

    // Persist the rejection
    this.checkpoint(lifecycle);
  }

  /**
   * Record an activation failure.
   */
  fail(activationId: string, failure: ActivationFailure): void {
    const lifecycle = this.activations.get(activationId);
    if (!lifecycle) {
      throw new ExecutionStateError(`Activation ${activationId} not found`);
    }

    lifecycle.failure = failure;
    lifecycle.state = ActivationState.FAILED;
    lifecycle.updatedAt = new Date().toISOString();
    lifecycle.completedAt = new Date().toISOString();

    // Persist the failure
    this.checkpoint(lifecycle);
  }

  // ── Query Methods ───────────────────────────────────────────

  /**
   * Get an activation lifecycle by ID.
   */
  getActivation(activationId: string): ActivationLifecycle | undefined {
    return this.activations.get(activationId);
  }

  /**
   * Get all activations for a plan.
   */
  getActivationsForPlan(planId: string): ActivationLifecycle[] {
    return Array.from(this.activations.values()).filter(
      (a) => a.planId === planId
    );
  }

  /**
   * Get all activations in a specific state.
   */
  getActivationsByState(state: ActivationState): ActivationLifecycle[] {
    return Array.from(this.activations.values()).filter(
      (a) => a.state === state
    );
  }

  /**
   * List all active (non-terminal) activations.
   */
  listActive(): ActivationLifecycle[] {
    return Array.from(this.activations.values()).filter(
      (a) => !this.isTerminal(a.state)
    );
  }

  /**
   * List all activation IDs.
   */
  listAll(): string[] {
    return Array.from(this.activations.keys());
  }

  /**
   * Count activations in each state.
   */
  countByState(): Record<ActivationState, number> {
    const counts: Record<string, number> = {};
    for (const state of Object.values(ActivationState)) {
      counts[state] = 0;
    }
    for (const activation of this.activations.values()) {
      counts[activation.state] = (counts[activation.state] ?? 0) + 1;
    }
    return counts as Record<ActivationState, number>;
  }

  /**
   * Check if an activation exists for a plan and is active.
   */
  isPlanActivated(planId: string): boolean {
    for (const activation of this.activations.values()) {
      if (activation.planId === planId && !this.isTerminal(activation.state)) {
        return true;
      }
    }
    return false;
  }

  // ── Recovery ────────────────────────────────────────────────

  /**
   * Get all activations that could be recovered (non-terminal, non-rejected).
   */
  getRecoverableActivations(): ActivationLifecycle[] {
    return Array.from(this.activations.values()).filter(
      (a) =>
        !this.isTerminal(a.state) &&
        a.state !== ActivationState.REJECTED
    );
  }

  /**
   * Get a recovery snapshot of the current state.
   */
  getRecoverySnapshot(): Record<string, ActivationLifecycle> {
    const snapshot: Record<string, ActivationLifecycle> = {};
    for (const [id, lifecycle] of this.activations.entries()) {
      snapshot[id] = { ...lifecycle, activatedBatches: [...lifecycle.activatedBatches] };
    }
    return snapshot;
  }

  /**
   * Restore from a recovery snapshot.
   */
  restoreFromSnapshot(snapshot: Record<string, ActivationLifecycle>): void {
    this.activations.clear();
    for (const [id, lifecycle] of Object.entries(snapshot)) {
      this.activations.set(id, {
        ...lifecycle,
        activatedBatches: [...lifecycle.activatedBatches],
      });
    }
  }

  // ── Reset ───────────────────────────────────────────────────

  /** Reset all state. For testing. */
  reset(): void {
    this.activations.clear();
    this.activationCounter = 0;
    this.config = { ...DEFAULT_WAS_CONFIG };
    this.persistedIds.clear();
    this.persistenceBackend = null;
  }
}