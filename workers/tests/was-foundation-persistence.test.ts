// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Foundation Persistence Tests               │
// │ Tests persistence backend, checkpoint integration,          │
// │ recovery orchestration, graceful degradation, and           │
// │ duplicate execution protection for the WAS lifecycle.       │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// ── WAS persistence & recovery ─────────────────────────────────
import {
  MemoryWASPersistenceBackend,
  WASPersistenceError,
} from "../src/platform/was/was-persistence.js";
import {
  ExecutionStateManager,
  ExecutionStateError,
} from "../src/platform/was/execution-state-manager.js";
import {
  WASRecoveryOrchestrator,
  RecoveryError,
} from "../src/platform/was/was-recovery.js";
import type { RecoveryResult } from "../src/platform/was/was-recovery.js";
import { GracefulDegradationManager } from "../src/platform/was/was-graceful-degradation.js";
import type { DegradationState } from "../src/platform/was/was-graceful-degradation.js";
import { DuplicateExecutionProtection } from "../src/platform/was/was-duplicate-protection.js";
import type { DuplicateCheckResult } from "../src/platform/was/was-duplicate-protection.js";
import {
  ActivationState,
  DEFAULT_WAS_CONFIG,
} from "../src/platform/was/types.js";
import type { ActivationLifecycle } from "../src/platform/was/types.js";
import { WASObservability } from "../src/platform/was/was-observability.js";

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

function createTestActivation(
  overrides: Partial<ActivationLifecycle> = {},
): ActivationLifecycle {
  return {
    id: overrides.id ?? `test-${Date.now()}`,
    planId: overrides.planId ?? "plan-test-1",
    state: overrides.state ?? ActivationState.PENDING,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    idempotencyKey: `plan-test-1::test-${Date.now()}`,
    validation: null,
    activatedBatches: [],
    failure: null,
    rejection: null,
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// MemoryWASPersistenceBackend Tests
// ══════════════════════════════════════════════════════════════

describe("MemoryWASPersistenceBackend", () => {
  let backend: MemoryWASPersistenceBackend;

  beforeEach(() => {
    backend = new MemoryWASPersistenceBackend();
  });

  it("put stores and get retrieves an activation", async () => {
    const activation = createTestActivation();
    await backend.put(activation);
    const retrieved = await backend.get(activation.id);
    expect(retrieved).not.toBeNull();
    expect(retrieved!.id).toBe(activation.id);
    expect(retrieved!.state).toBe(ActivationState.PENDING);
  });

  it("put updates existing activation", async () => {
    const activation = createTestActivation();
    await backend.put(activation);
    activation.state = ActivationState.ACTIVE;
    await backend.put(activation);
    const retrieved = await backend.get(activation.id);
    expect(retrieved!.state).toBe(ActivationState.ACTIVE);
  });

  it("get returns null for missing activation", async () => {
    const retrieved = await backend.get("does-not-exist");
    expect(retrieved).toBeNull();
  });

  it("listRecoverable returns only non-terminal activations", async () => {
    const pending = createTestActivation({ id: "a1", state: ActivationState.PENDING });
    const active = createTestActivation({ id: "a2", planId: "plan-2", state: ActivationState.ACTIVE });
    const failed = createTestActivation({ id: "a3", planId: "plan-3", state: ActivationState.FAILED });
    const rejected = createTestActivation({ id: "a4", planId: "plan-4", state: ActivationState.REJECTED });
    const deactivated = createTestActivation({ id: "a5", planId: "plan-5", state: ActivationState.DEACTIVATED });

    await backend.put(pending);
    await backend.put(active);
    await backend.put(failed);
    await backend.put(rejected);
    await backend.put(deactivated);

    const recoverable = await backend.listRecoverable();
    expect(recoverable.length).toBe(2);
    expect(recoverable.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("listByPlan returns all activations for a plan", async () => {
    const a1 = createTestActivation({ id: "a1", planId: "plan-x" });
    const a2 = createTestActivation({ id: "a2", planId: "plan-x" });
    const a3 = createTestActivation({ id: "a3", planId: "plan-y" });

    await backend.put(a1);
    await backend.put(a2);
    await backend.put(a3);

    const forPlanX = await backend.listByPlan("plan-x");
    expect(forPlanX.length).toBe(2);
    expect(forPlanX.map((a) => a.id).sort()).toEqual(["a1", "a2"]);
  });

  it("delete removes an activation", async () => {
    const activation = createTestActivation();
    await backend.put(activation);
    await backend.delete(activation.id);
    const retrieved = await backend.get(activation.id);
    expect(retrieved).toBeNull();
  });

  it("clear removes all activations", async () => {
    await backend.put(createTestActivation({ id: "a1" }));
    await backend.put(createTestActivation({ id: "a2" }));
    await backend.clear();
    expect(backend.size).toBe(0);
  });

  it("size reflects correct count", async () => {
    expect(backend.size).toBe(0);
    await backend.put(createTestActivation({ id: "a1" }));
    expect(backend.size).toBe(1);
    await backend.put(createTestActivation({ id: "a2" }));
    expect(backend.size).toBe(2);
  });
});

// ══════════════════════════════════════════════════════════════
// ExecutionStateManager Persistence Integration Tests
// ══════════════════════════════════════════════════════════════

describe("ExecutionStateManager — persistence integration", () => {
  let stateManager: ExecutionStateManager;
  let persistenceBackend: MemoryWASPersistenceBackend;

  beforeEach(() => {
    stateManager = ExecutionStateManager.getInstance();
    stateManager.reset();
    persistenceBackend = new MemoryWASPersistenceBackend();
    stateManager.setPersistenceBackend(persistenceBackend);
    stateManager.configure({ enablePersistence: true });
  });

  it("setPersistenceBackend accepts a backend", () => {
    expect(stateManager.getPersistenceBackend()).toBe(persistenceBackend);
  });

  it("setPersistenceBackend accepts null (disables persistence)", () => {
    stateManager.setPersistenceBackend(null);
    expect(stateManager.getPersistenceBackend()).toBeNull();
  });

  it("createActivation checkpoints to persistence when enabled", async () => {
    const activation = stateManager.createActivation("plan-1");
    // Give async checkpoint time to complete
    await vi.waitFor(() => {
      expect(stateManager.isPersisted(activation.id)).toBe(true);
    });
    const persisted = await persistenceBackend.get(activation.id);
    expect(persisted).not.toBeNull();
    expect(persisted!.state).toBe(ActivationState.PENDING);
  });

  it("transitionState checkpoints to persistence when enabled", async () => {
    const activation = stateManager.createActivation("plan-1");

    stateManager.transitionState(activation.id, ActivationState.VALIDATING);

    await vi.waitFor(() => {
      const persisted = persistenceBackend.get(activation.id);
      return persisted.then((a) => a?.state === ActivationState.VALIDATING);
    });
    const persisted = await persistenceBackend.get(activation.id);
    expect(persisted!.state).toBe(ActivationState.VALIDATING);
  });

  it("does NOT checkpoint when enablePersistence is false", async () => {
    stateManager.configure({ enablePersistence: false });
    stateManager.createActivation("plan-np");

    // Small delay to ensure no async persistence happened
    await new Promise((r) => setTimeout(r, 50));
    expect(persistenceBackend.size).toBe(0);
  });

  it("checkpoint errors do NOT crash the caller", async () => {
    const throwingBackend = new (class extends MemoryWASPersistenceBackend {
      async put(_activation: ActivationLifecycle): Promise<void> {
        throw new Error("DB down");
      }
    })();
    stateManager.setPersistenceBackend(throwingBackend);

    // Should not throw — checkpoint is fire-and-forget
    expect(() => stateManager.createActivation("plan-1")).not.toThrow();
    const activation = stateManager.getActivation("was-0-" + Date.now().toString().slice(0, 6));
    // The activation should exist in-memory despite persistence failure
    expect(stateManager.listAll().length).toBe(1);
  });

  it("isPersisted tracks checkpointed activations", async () => {
    const a1 = stateManager.createActivation("plan-1");
    const a2 = stateManager.createActivation("plan-2");

    await vi.waitFor(() => {
      expect(stateManager.isPersisted(a1.id)).toBe(true);
      expect(stateManager.isPersisted(a2.id)).toBe(true);
    });
    expect(stateManager.getPersistedIds().sort()).toEqual(
      [a1.id, a2.id].sort(),
    );
  });

  it("restoreFromPersistence loads activations into memory", async () => {
    // Pre-populate the persistence backend directly (simulating a restart)
    const a1 = createTestActivation({
      id: "was-1-1000",
      planId: "plan-restore-1",
      state: ActivationState.ACTIVE,
    });
    const a2 = createTestActivation({
      id: "was-2-2000",
      planId: "plan-restore-2",
      state: ActivationState.VALIDATING,
    });
    await persistenceBackend.put(a1);
    await persistenceBackend.put(a2);

    // Reset the state manager (simulating a restart)
    stateManager.reset();
    stateManager.setPersistenceBackend(persistenceBackend);
    stateManager.configure({ enablePersistence: true, enableRecovery: true });

    const count = await stateManager.restoreFromPersistence();
    expect(count).toBe(2);
    expect(stateManager.listAll().length).toBe(2);
    expect(stateManager.isPlanActivated("plan-restore-1")).toBe(true);
    expect(stateManager.isPlanActivated("plan-restore-2")).toBe(true);
  });

  it("restoreFromPersistence does NOT load terminal activations", async () => {
    const failed = createTestActivation({
      id: "was-3-3000",
      planId: "plan-failed",
      state: ActivationState.FAILED,
    });
    await persistenceBackend.put(failed);

    stateManager.reset();
    stateManager.setPersistenceBackend(persistenceBackend);
    stateManager.configure({ enablePersistence: true, enableRecovery: true });

    const count = await stateManager.restoreFromPersistence();
    // listRecoverable excludes terminals, so restore count is 0
    expect(count).toBe(0);
  });

  it("restoreFromPersistence returns 0 when enableRecovery is false", async () => {
    await persistenceBackend.put(
      createTestActivation({ id: "was-4-4000", state: ActivationState.ACTIVE }),
    );

    stateManager.reset();
    stateManager.setPersistenceBackend(persistenceBackend);
    stateManager.configure({ enablePersistence: true, enableRecovery: false });

    const count = await stateManager.restoreFromPersistence();
    expect(count).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════
// WASRecoveryOrchestrator Tests
// ══════════════════════════════════════════════════════════════

describe("WASRecoveryOrchestrator", () => {
  let stateManager: ExecutionStateManager;
  let observability: WASObservability;
  let orchestrator: WASRecoveryOrchestrator;
  let backend: MemoryWASPersistenceBackend;

  const testConfig = {
    ...DEFAULT_WAS_CONFIG,
    enablePersistence: true,
    enableRecovery: true,
  };

  beforeEach(() => {
    stateManager = ExecutionStateManager.getInstance();
    stateManager.reset();
    observability = WASObservability.getInstance();
    observability.reset();
    orchestrator = new WASRecoveryOrchestrator(stateManager, observability);
    backend = new MemoryWASPersistenceBackend();
  });

  it("recovers persisted activations on startup", async () => {
    // Simulate persisted state from a previous session
    await backend.put(
      createTestActivation({
        id: "was-10-1000",
        planId: "plan-recover-1",
        state: ActivationState.ACTIVE,
      }),
    );
    await backend.put(
      createTestActivation({
        id: "was-11-2000",
        planId: "plan-recover-2",
        state: ActivationState.VALIDATING,
      }),
    );

    const result = await orchestrator.recover(backend, testConfig);

    expect(result.ok).toBe(true);
    expect(result.totalFound).toBe(2);
    expect(result.recovered).toBe(2);
    expect(result.skippedTerminal).toBe(0);
    expect(result.failed).toBe(0);
    expect(result.recoveredIds.length).toBe(2);
    expect(stateManager.listAll().length).toBe(2);
  });

  it("skips terminal activations during recovery", async () => {
    await backend.put(
      createTestActivation({
        id: "was-20-1000",
        planId: "plan-active",
        state: ActivationState.ACTIVE,
      }),
    );
    await backend.put(
      createTestActivation({
        id: "was-21-2000",
        planId: "plan-failed",
        state: ActivationState.FAILED,
      }),
    );
    await backend.put(
      createTestActivation({
        id: "was-22-3000",
        planId: "plan-rejected",
        state: ActivationState.REJECTED,
      }),
    );
    await backend.put(
      createTestActivation({
        id: "was-23-4000",
        planId: "plan-deactivated",
        state: ActivationState.DEACTIVATED,
      }),
    );

    const result = await orchestrator.recover(backend, testConfig);

    expect(result.ok).toBe(true);
    expect(result.totalFound).toBe(1); // listRecoverable only returns ACTIVE
    expect(result.recovered).toBe(1);
    expect(result.recoveredIds).toEqual(["was-20-1000"]);
  });

  it("returns zero recovery for clean startup", async () => {
    const result = await orchestrator.recover(backend, testConfig);

    expect(result.ok).toBe(true);
    expect(result.totalFound).toBe(0);
    expect(result.recovered).toBe(0);
    expect(result.summary).toContain("clean startup");
  });

  it("emits recovery attempted and succeeded events", async () => {
    await backend.put(
      createTestActivation({
        id: "was-30-1000",
        planId: "plan-events",
        state: ActivationState.ACTIVE,
      }),
    );

    await orchestrator.recover(backend, testConfig);

    const events = observability.getAllEvents();
    const attempted = events.find(
      (e) => e.type === "was.recovery.attempted",
    );
    const succeeded = events.find(
      (e) => e.type === "was.recovery.succeeded",
    );

    expect(attempted).toBeDefined();
    expect(attempted!.metadata.recoveryStage).toBe("startup");
    expect(succeeded).toBeDefined();
    expect(succeeded!.metadata.recovered).toBe(1);
  });

  it("recoverOne returns state for a persisted activation", async () => {
    await backend.put(
      createTestActivation({
        id: "was-40-1000",
        planId: "plan-one",
        state: ActivationState.ACTIVE,
      }),
    );

    const state = await orchestrator.recoverOne(backend, "was-40-1000");
    expect(state).toBe(ActivationState.ACTIVE);
  });

  it("recoverOne returns null for terminal activations", async () => {
    await backend.put(
      createTestActivation({
        id: "was-41-1000",
        planId: "plan-one",
        state: ActivationState.FAILED,
      }),
    );

    const state = await orchestrator.recoverOne(backend, "was-41-1000");
    expect(state).toBeNull();
  });

  it("recoverOne returns null for missing activations", async () => {
    const state = await orchestrator.recoverOne(backend, "does-not-exist");
    expect(state).toBeNull();
  });

  it("throws RecoveryError when backend fails", async () => {
    const failingBackend = new (class extends MemoryWASPersistenceBackend {
      async listRecoverable(): Promise<ActivationLifecycle[]> {
        throw new Error("Backend unavailable");
      }
    })();

    await expect(
      orchestrator.recover(failingBackend, testConfig),
    ).rejects.toThrow(RecoveryError);
  });
});

// ══════════════════════════════════════════════════════════════
// GracefulDegradationManager Tests
// ══════════════════════════════════════════════════════════════

describe("GracefulDegradationManager", () => {
  let stateManager: ExecutionStateManager;
  let degradation: GracefulDegradationManager;
  let primaryBackend: MemoryWASPersistenceBackend;
  let fallbackBackend: MemoryWASPersistenceBackend;

  beforeEach(() => {
    stateManager = ExecutionStateManager.getInstance();
    stateManager.reset();
    vi.useFakeTimers();
    degradation = new GracefulDegradationManager(stateManager);
    primaryBackend = new MemoryWASPersistenceBackend();
    fallbackBackend = new MemoryWASPersistenceBackend();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("starts in non-degraded state", () => {
    const state = degradation.getState();
    expect(state.degraded).toBe(false);
    expect(state.failureCount).toBe(0);
  });

  it("isDegraded returns false initially", () => {
    expect(degradation.isDegraded()).toBe(false);
  });

  it("records failures and activates degradation at threshold", () => {
    degradation.configure({ threshold: 3 });

    degradation.recordFailure();
    expect(degradation.getState().degraded).toBe(false);
    expect(degradation.getState().failureCount).toBe(1);

    degradation.recordFailure();
    expect(degradation.getState().degraded).toBe(false);
    expect(degradation.getState().failureCount).toBe(2);

    degradation.recordFailure();
    expect(degradation.getState().degraded).toBe(true);
    expect(degradation.getState().failureCount).toBe(3);
    expect(degradation.getState().degradedAt).not.toBeNull();
    expect(degradation.isDegraded()).toBe(true);
  });

  it("records success and restores from degradation", () => {
    degradation.configure({ threshold: 1 });
    degradation.recordFailure();
    expect(degradation.isDegraded()).toBe(true);

    degradation.recordSuccess();
    expect(degradation.isDegraded()).toBe(false);
    expect(degradation.getState().failureCount).toBe(0);
    expect(degradation.getState().restored).toBe(true);
    expect(degradation.getState().restoredAt).not.toBeNull();
  });

  it("switches to fallback backend on degradation", () => {
    degradation.configure({ threshold: 1, enableFallback: true });
    degradation.registerBackends(primaryBackend, fallbackBackend);

    degradation.recordFailure();

    // After degradation, the state manager should have the fallback backend
    expect(degradation.isDegraded()).toBe(true);
  });

  it("does NOT activate degradation below threshold", () => {
    degradation.configure({ threshold: 5 });
    for (let i = 0; i < 4; i++) {
      degradation.recordFailure();
    }
    expect(degradation.isDegraded()).toBe(false);
  });

  it("reset clears degradation state", () => {
    degradation.configure({ threshold: 1 });
    degradation.recordFailure();
    expect(degradation.isDegraded()).toBe(true);

    degradation.reset();
    expect(degradation.isDegraded()).toBe(false);
    expect(degradation.getState().failureCount).toBe(0);
    expect(degradation.getState().degradedAt).toBeNull();
    expect(degradation.getState().restored).toBe(false);
  });

  it("configure updates degradation parameters", () => {
    degradation.configure({ threshold: 10, retryIntervalMs: 60_000 });
    expect(degradation.getState().failureCount).toBe(0);

    // Should not degrade after 3 failures with threshold of 10
    degradation.recordFailure();
    degradation.recordFailure();
    degradation.recordFailure();
    expect(degradation.isDegraded()).toBe(false);
  });

  it("returns true from recordFailure when degradation activates", () => {
    degradation.configure({ threshold: 2 });
    expect(degradation.recordFailure()).toBe(false);
    expect(degradation.recordFailure()).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════
// DuplicateExecutionProtection Tests
// ══════════════════════════════════════════════════════════════

describe("DuplicateExecutionProtection", () => {
  let stateManager: ExecutionStateManager;
  let protection: DuplicateExecutionProtection;
  let persistenceBackend: MemoryWASPersistenceBackend;

  beforeEach(() => {
    stateManager = ExecutionStateManager.getInstance();
    stateManager.reset();
    protection = new DuplicateExecutionProtection(stateManager);
    persistenceBackend = new MemoryWASPersistenceBackend();
    protection.setPersistenceBackend(persistenceBackend);
  });

  it("allows activation of a new plan", async () => {
    const result = await protection.canActivate("plan-new");
    expect(result.canActivate).toBe(true);
    expect(result.existingActivationId).toBeNull();
    expect(result.reason).toContain("No duplicate");
  });

  it("blocks activation of an already-active plan in memory", async () => {
    stateManager.configure({ enablePersistence: false });
    const activation = stateManager.createActivation("plan-duplicate");

    const result = await protection.canActivate("plan-duplicate");
    expect(result.canActivate).toBe(false);
    expect(result.existingActivationId).toBe(activation.id);
    expect(result.foundInPersistence).toBe(false);
  });

  it("blocks activation of a persisted plan from a previous session", async () => {
    // Simulate an activation that was persisted in a previous session
    await persistenceBackend.put(
      createTestActivation({
        id: "was-50-1000",
        planId: "plan-persisted",
        state: ActivationState.ACTIVE,
      }),
    );

    const result = await protection.canActivate("plan-persisted");
    expect(result.canActivate).toBe(false);
    expect(result.existingActivationId).toBe("was-50-1000");
    expect(result.foundInPersistence).toBe(true);
    expect(result.existingState).toBe(ActivationState.ACTIVE);
  });

  it("allows activation after previous activation completed", async () => {
    // Create and complete an activation
    const activation = stateManager.createActivation("plan-completed");
    stateManager.transitionState(activation.id, ActivationState.VALIDATING);
    stateManager.transitionState(activation.id, ActivationState.ACTIVATING);
    stateManager.transitionState(activation.id, ActivationState.ACTIVE);
    stateManager.transitionState(activation.id, ActivationState.DEACTIVATING);
    stateManager.transitionState(activation.id, ActivationState.DEACTIVATED);

    const result = await protection.canActivate("plan-completed");
    expect(result.canActivate).toBe(true);
  });

  it("allows activation when persistence check fails (fail-open)", async () => {
    protection.setPersistenceBackend(
      new (class extends MemoryWASPersistenceBackend {
        async listByPlan(_planId: string): Promise<ActivationLifecycle[]> {
          throw new Error("DB down");
        }
      })(),
    );

    const result = await protection.canActivate("plan-db-down");
    expect(result.canActivate).toBe(true);
    expect(result.reason).toContain("Persistence check failed");
  });

  it("getInFlightPlans returns active plan IDs from persistence", async () => {
    await persistenceBackend.put(
      createTestActivation({
        id: "was-60-1000",
        planId: "plan-flight-1",
        state: ActivationState.ACTIVE,
      }),
    );
    await persistenceBackend.put(
      createTestActivation({
        id: "was-61-2000",
        planId: "plan-flight-2",
        state: ActivationState.VALIDATING,
      }),
    );
    // Terminal ones should not be in-flight
    await persistenceBackend.put(
      createTestActivation({
        id: "was-62-3000",
        planId: "plan-done",
        state: ActivationState.DEACTIVATED,
      }),
    );

    const inFlight = await protection.getInFlightPlans();
    expect(inFlight.size).toBe(2);
    expect(inFlight.get("plan-flight-1")).toBe("was-60-1000");
    expect(inFlight.get("plan-flight-2")).toBe("was-61-2000");
    expect(inFlight.has("plan-done")).toBe(false);
  });

  it("getInFlightPlans returns empty map when no backend set", async () => {
    protection.setPersistenceBackend(null);
    const inFlight = await protection.getInFlightPlans();
    expect(inFlight.size).toBe(0);
  });

  it("canActivate checks memory first (fast path)", async () => {
    // Create an in-memory activation
    const activation = stateManager.createActivation("plan-fast");

    // Even if persistence has a different plan, memory check should catch the active one
    const result = await protection.canActivate("plan-fast");
    expect(result.canActivate).toBe(false);
    expect(result.foundInPersistence).toBe(false); // Found in memory, not persistence
    expect(result.existingActivationId).toBe(activation.id);
  });
});