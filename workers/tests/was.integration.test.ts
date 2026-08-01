// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Integration Tests                          │
// │ Tests the Workforce Activation Service end-to-end:          │
// │ activation lifecycle, state machine, validation gates,     │
// │ WEF delegation, verification, knowledge capture, reporting. │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";

// ── WAS types & services ──────────────────────────────────────
import {
  ActivationState,
  ActivationStage,
  BatchActivationStatus,
  WASFeatureFlag,
  DEFAULT_WAS_CONFIG,
  DEFAULT_WAS_FLAG_STATE,
  ExecutionStateManager,
  ExecutionStateError,
  StateTransitionError,
  PlanConsumer,
  PlanConsumptionError,
  ConstitutionalValidator,
  WEFDelegator,
  WEFDelegationError,
  VerificationRouter,
  KnowledgeCaptureTrigger,
  ExecutiveStatusUpdater,
  WorkforceActivationService,
  WorkforceActivationError,
  initializeWASFlags,
  isWASEnabled,
  enableWASFlag,
  disableWASFlag,
  getWASFlags,
  resetWASFlags,
  syncWASFlagsFromEPCL,
  resetAllFlagsForTest,
  validateFeatureFlags,
  validateReportingFlag,
} from "../src/platform/was/index.js";

// ── EPCL types & flags (for flag gating) ──────────────────────
import {
  FeatureFlag as EPCLFeatureFlag,
  PlanStatus,
  BatchStatus,
  type ExecutionPlan,
  type ExecutionBatch,
} from "../src/platform/epcl/types.js";
import {
  enableFlag as epclEnableFlag,
  disableAllFlags,
  resetFlags as epclResetFlags,
} from "../src/platform/epcl/feature-flags.js";

// ══════════════════════════════════════════════════════════════
// Helpers
// ══════════════════════════════════════════════════════════════

let planCounter = 0;

/** Reset all singletons, flags, and state before every test. */
function resetAll(): void {
  resetAllFlagsForTest();
  epclResetFlags();
}

/** Create a minimal valid EPCL ExecutionPlan for testing. */
function createTestPlan(
  overrides: Partial<ExecutionPlan> = {},
): ExecutionPlan {
  const idx = planCounter++;
  const planId = overrides.id ?? `test-plan-${idx}`;
  return {
    id: planId,
    roadmapId: "test-roadmap",
    title: `Test Plan ${idx}`,
    description: "Integration test plan",
    phases: [
      {
        id: `phase-${idx}-1`,
        roadmapPhaseId: "roadmap-phase-1",
        name: "Test Phase",
        order: 1,
        status: "pending" as any,
        batches: [`batch-${idx}-1`],
      },
    ],
    dependencies: [],
    batches: [
      {
        id: `batch-${idx}-1`,
        planId,
        name: "Test Batch 1",
        description: "First test batch",
        order: 1,
        tasks: [
          {
            id: `task-${idx}-1`,
            batchId: `batch-${idx}-1`,
            name: "Test Task",
            description: "A test task",
            type: "capability" as any,
            capabilityId: "test.capability",
            discipline: "general",
            input: {},
            expectedOutput: "ok",
            acceptanceCriteria: ["passes"],
            status: "pending" as any,
            dependencies: [],
          },
        ],
        dependencies: [],
        status: BatchStatus.PENDING,
        discipline: "general",
        capabilities: ["test.capability"],
        tokenBudget: 1000,
        contextBudget: 8000,
        estimatedDuration: "5m",
        checkpoint: null as any,
        resumeToken: "",
      },
    ],
    status: PlanStatus.APPROVED,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    totalBatches: 1,
    completedBatches: 0,
    failedBatches: 0,
    approvalRequired: false,
    ...overrides,
  };
}

/** Enable all flags needed for a full activation to succeed. */
function enableActivationFlags(): void {
  // EPCL layer flags
  epclEnableFlag(EPCLFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW);
  epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
  epclEnableFlag(EPCLFeatureFlag.ENABLE_KNOWLEDGE_CAPTURE);

  // WAS layer flags
  enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
  enableWASFlag(WASFeatureFlag.ENABLE_BATCH_GENERATION);
}

// ══════════════════════════════════════════════════════════════
// Test Suite
// ══════════════════════════════════════════════════════════════

beforeEach(() => {
  resetAll();
});

// ── Section 1: Types & ActiviationState ──────────────────────

describe("ActivationStateMachine", () => {
  it("has expected states (no QUEUED — starts at PENDING)", () => {
    expect(ActivationState.PENDING).toBe("pending");
    expect(ActivationState.VALIDATING).toBe("validating");
    expect(ActivationState.ACTIVATING).toBe("activating");
    expect(ActivationState.ACTIVE).toBe("active");
    expect(ActivationState.DEACTIVATING).toBe("deactivating");
    expect(ActivationState.DEACTIVATED).toBe("deactivated");
    expect(ActivationState.FAILED).toBe("failed");
    expect(ActivationState.REJECTED).toBe("rejected");
    // No QUEUED — confirmed
    expect((ActivationState as any).QUEUED).toBeUndefined();
  });

  it("has expected activation stages", () => {
    expect(ActivationStage.PLAN_CONSUMPTION).toBe("plan_consumption");
    expect(ActivationStage.VALIDATION).toBe("validation");
    expect(ActivationStage.BATCH_ACTIVATION).toBe("batch_activation");
    expect(ActivationStage.WEF_DELEGATION).toBe("wef_delegation");
    expect(ActivationStage.EXECUTION_MONITORING).toBe("execution_monitoring");
    expect(ActivationStage.VERIFICATION).toBe("verification");
    expect(ActivationStage.KNOWLEDGE_CAPTURE).toBe("knowledge_capture");
    expect(ActivationStage.STATUS_REPORTING).toBe("status_reporting");
    expect(ActivationStage.RECOVERY).toBe("recovery");
  });

  it("has batch activation statuses", () => {
    expect(BatchActivationStatus.PENDING).toBe("pending");
    expect(BatchActivationStatus.ACTIVATING).toBe("activating");
    expect(BatchActivationStatus.DELEGATED).toBe("delegated");
    expect(BatchActivationStatus.COMPLETED).toBe("completed");
    expect(BatchActivationStatus.FAILED).toBe("failed");
  });
});

// ── Section 2: Default Configuration ─────────────────────────

describe("DefaultConfiguration", () => {
  it("DEFAULT_WAS_CONFIG has expected fail-closed defaults", () => {
    expect(DEFAULT_WAS_CONFIG.maxConcurrentActivations).toBe(1);
    expect(DEFAULT_WAS_CONFIG.autoResume).toBe(false);
    expect(DEFAULT_WAS_CONFIG.maxRetries).toBe(3);
    expect(DEFAULT_WAS_CONFIG.detailedObservability).toBe(false);
    expect(DEFAULT_WAS_CONFIG.requireConstitutionalValidation).toBe(true);
    expect(DEFAULT_WAS_CONFIG.requireFeatureFlagValidation).toBe(true);
    expect(DEFAULT_WAS_CONFIG.enableKnowledgeCapture).toBe(true);
    expect(DEFAULT_WAS_CONFIG.enableStatusReporting).toBe(true);
  });

  it("DEFAULT_WAS_FLAG_STATE has all flags disabled by default", () => {
    expect(DEFAULT_WAS_FLAG_STATE[WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]).toBe(false);
    expect(DEFAULT_WAS_FLAG_STATE[WASFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]).toBe(false);
    expect(DEFAULT_WAS_FLAG_STATE[WASFeatureFlag.ENABLE_BATCH_GENERATION]).toBe(false);
    expect(DEFAULT_WAS_FLAG_STATE[WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING]).toBe(false);
    expect(DEFAULT_WAS_FLAG_STATE[WASFeatureFlag.ENABLE_PARALLEL_BATCH_DELEGATION]).toBe(false);
  });
});

// ── Section 3: Feature Flag Validator ────────────────────────

describe("WASFeatureFlags", () => {
  it("starts with all autonomous execution disabled", () => {
    const flags = getWASFlags();
    expect(flags[WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]).toBe(false);
  });

  it("isWASEnabled requires a flag argument", () => {
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });

  it("enableWASFlag enables a single flag", () => {
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(true);
  });

  it("disableWASFlag disables a flag", () => {
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    disableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });

  it("resetWASFlags restores defaults", () => {
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    resetWASFlags();
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });

  it("syncWASFlagsFromEPCL disables WAS execution when EPCL flag is off", () => {
    // EPCL's ENABLE_AUTONOMOUS_EXECUTION starts disabled
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    syncWASFlagsFromEPCL();
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });

  it("syncWASFlagsFromEPCL preserves WAS execution when EPCL flag is on", () => {
    epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    syncWASFlagsFromEPCL();
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(true);
  });

  it("getWASFlags returns a snapshot (immutable)", () => {
    const snap = getWASFlags();
    (snap as any)[WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION] = true;
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });

  it("initializeWASFlags merges over defaults", () => {
    initializeWASFlags({ [WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: true });
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(true);
    // Defaults preserved
    expect(isWASEnabled(WASFeatureFlag.ENABLE_PARALLEL_BATCH_DELEGATION)).toBe(false);
  });
});

// ── Section 4: Feature Flag Validation Gate ──────────────────

describe("validateFeatureFlags", () => {
  it("returns a ValidationGateResult", () => {
    const gate = validateFeatureFlags();
    expect(gate).toHaveProperty("gate", "feature_flags");
    expect(gate).toHaveProperty("passed");
    expect(gate).toHaveProperty("message");
    expect(gate).toHaveProperty("severity");
  });

  it("blocks activation when autonomous execution is disabled (default)", () => {
    const gate = validateFeatureFlags();
    expect(gate.passed).toBe(false);
    expect(gate.severity).toBe("error");
  });

  it("blocks activation when EPCL executive workflow is disabled", () => {
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    const gate = validateFeatureFlags();
    expect(gate.passed).toBe(false);
    expect(gate.severity).toBe("error");
  });

  it("passes when all required flags are enabled", () => {
    epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    epclEnableFlag(EPCLFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW);
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    enableWASFlag(WASFeatureFlag.ENABLE_BATCH_GENERATION);
    const gate = validateFeatureFlags();
    expect(gate.passed).toBe(true);
    expect(gate.severity).toBe("warning");
  });

  it("skips flag validation when requireFeatureFlagValidation is false", () => {
    const gate = validateFeatureFlags({ requireFeatureFlagValidation: false });
    expect(gate.passed).toBe(true);
    expect(gate.severity).toBe("warning");
  });
});

// ── Section 5: Reporting Flag Validation Gate ────────────────

describe("validateReportingFlag", () => {
  it("returns a warning gate when reporting is disabled (default)", () => {
    const gate = validateReportingFlag();
    expect(gate.gate).toBe("executive_reporting");
    expect(gate.passed).toBe(false);
    expect(gate.severity).toBe("warning");
  });

  it("passes when reporting is enabled", () => {
    enableWASFlag(WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING);
    const gate = validateReportingFlag();
    expect(gate.passed).toBe(true);
  });
});

// ── Section 6: ExecutionStateManager ─────────────────────────

describe("ExecutionStateManager", () => {
  it("is a singleton", () => {
    const a = ExecutionStateManager.getInstance();
    const b = ExecutionStateManager.getInstance();
    expect(a).toBe(b);
  });

  it("createActivation returns a lifecycle in PENDING state", () => {
    const esm = ExecutionStateManager.getInstance();
    const lifecycle = esm.createActivation("plan-1");
    expect(lifecycle.planId).toBe("plan-1");
    expect(lifecycle.state).toBe(ActivationState.PENDING);
    expect(lifecycle.validation).toBeNull();
    expect(lifecycle.failure).toBeNull();
    expect(lifecycle.rejection).toBeNull();
  });

  it("createActivation throws on duplicate active activation", () => {
    const esm = ExecutionStateManager.getInstance();
    esm.createActivation("plan-dupe");
    expect(() => esm.createActivation("plan-dupe")).toThrow(ExecutionStateError);
  });

  it("transitionState enforces valid transitions", () => {
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation("plan-trans");
    esm.transitionState(lc.id, ActivationState.VALIDATING);
    expect(esm.getActivation(lc.id).state).toBe(ActivationState.VALIDATING);
  });

  it("transitionState throws on invalid transition", () => {
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation("plan-bad-trans");
    // PENDING -> ACTIVE is invalid
    expect(() =>
      esm.transitionState(lc.id, ActivationState.ACTIVE),
    ).toThrow(StateTransitionError);
  });

  it("transitionState throws on unknown activation", () => {
    const esm = ExecutionStateManager.getInstance();
    expect(() =>
      esm.transitionState("nonexistent", ActivationState.ACTIVE),
    ).toThrow(ExecutionStateError);
  });

  it("full happy-path state transitions", () => {
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation("plan-full");

    esm.transitionState(lc.id, ActivationState.VALIDATING);
    expect(esm.getActivation(lc.id).state).toBe(ActivationState.VALIDATING);

    esm.transitionState(lc.id, ActivationState.ACTIVATING);
    expect(esm.getActivation(lc.id).state).toBe(ActivationState.ACTIVATING);

    esm.transitionState(lc.id, ActivationState.ACTIVE);
    expect(esm.getActivation(lc.id).state).toBe(ActivationState.ACTIVE);

    esm.transitionState(lc.id, ActivationState.DEACTIVATING);
    expect(esm.getActivation(lc.id).state).toBe(ActivationState.DEACTIVATING);

    esm.transitionState(lc.id, ActivationState.DEACTIVATED);
    expect(esm.getActivation(lc.id).state).toBe(ActivationState.DEACTIVATED);
  });

  it("isTerminal returns true for terminal states", () => {
    const esm = ExecutionStateManager.getInstance();
    expect(esm.isTerminal(ActivationState.DEACTIVATED)).toBe(true);
    expect(esm.isTerminal(ActivationState.FAILED)).toBe(true);
    expect(esm.isTerminal(ActivationState.REJECTED)).toBe(true);
    expect(esm.isTerminal(ActivationState.PENDING)).toBe(false);
  });

  it("isFailedState returns true for FAILED and REJECTED", () => {
    const esm = ExecutionStateManager.getInstance();
    expect(esm.isFailedState(ActivationState.FAILED)).toBe(true);
    expect(esm.isFailedState(ActivationState.REJECTED)).toBe(true);
    expect(esm.isFailedState(ActivationState.PENDING)).toBe(false);
  });

  it("sets completedAt on terminal transitions", () => {
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation("plan-complete");

    esm.transitionState(lc.id, ActivationState.VALIDATING);
    esm.transitionState(lc.id, ActivationState.REJECTED);

    const after = esm.getActivation(lc.id);
    expect(after.completedAt).not.toBeNull();
  });

  it("adds and updates batches", () => {
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation("plan-batch");
    const batch = esm.addBatch(lc.id, "batch-a");
    expect(batch.batchId).toBe("batch-a");
    expect(batch.status).toBe(BatchActivationStatus.PENDING);

    esm.updateBatchStatus(lc.id, "batch-a", BatchActivationStatus.DELEGATED);
    const updated = esm.getActivation(lc.id);
    const updatedBatch = updated.activatedBatches.find((b) => b.batchId === "batch-a");
    expect(updatedBatch?.status).toBe(BatchActivationStatus.DELEGATED);
  });

  it("configure updates WAS config", () => {
    const esm = ExecutionStateManager.getInstance();
    esm.configure({ maxConcurrentActivations: 5 });
    expect(esm.getConfig().maxConcurrentActivations).toBe(5);
  });

  it("isPlanActivated returns correct state", () => {
    const esm = ExecutionStateManager.getInstance();
    expect(esm.isPlanActivated("plan-check")).toBe(false);
    esm.createActivation("plan-check");
    expect(esm.isPlanActivated("plan-check")).toBe(true);
  });

  it("getActivationsForPlan lists activations for a plan", () => {
    const esm = ExecutionStateManager.getInstance();
    esm.createActivation("plan-list");
    const activations = esm.getActivationsForPlan("plan-list");
    expect(activations.length).toBeGreaterThanOrEqual(1);
  });
});

// ── Section 7: PlanConsumer ──────────────────────────────────

describe("PlanConsumer", () => {
  it("is a singleton", () => {
    expect(PlanConsumer.getInstance()).toBe(PlanConsumer.getInstance());
  });

  it("consumes an approved plan and returns ActivationLifecycle", () => {
    const plan = createTestPlan();
    const consumer = PlanConsumer.getInstance();
    const lifecycle = consumer.consume(plan);
    expect(lifecycle).toBeDefined();
    expect(lifecycle.planId).toBe(plan.id);
    expect(lifecycle.state).toBe(ActivationState.PENDING);
  });

  it("throws PlanConsumptionError on non-approved plan", () => {
    const plan = createTestPlan({ status: PlanStatus.DRAFT });
    const consumer = PlanConsumer.getInstance();
    expect(() => consumer.consume(plan)).toThrow(PlanConsumptionError);
  });

  it("throws PlanConsumptionError on null plan", () => {
    const consumer = PlanConsumer.getInstance();
    expect(() => consumer.consume(null as any)).toThrow(PlanConsumptionError);
  });

  it("throws PlanConsumptionError on plan with no batches", () => {
    const plan = createTestPlan({ batches: [] });
    const consumer = PlanConsumer.getInstance();
    expect(() => consumer.consume(plan)).toThrow(PlanConsumptionError);
  });

  it("returns existing activation on duplicate consume (idempotent)", () => {
    const plan = createTestPlan();
    const consumer = PlanConsumer.getInstance();
    const first = consumer.consume(plan);
    const second = consumer.consume(plan);
    expect(second.id).toBe(first.id);
  });
});

// ── Section 8: ConstitutionalValidator ───────────────────────

describe("ConstitutionalValidator", () => {
  it("is a singleton", () => {
    expect(ConstitutionalValidator.getInstance()).toBe(ConstitutionalValidator.getInstance());
  });

  it("fails validation by default (all flags disabled)", () => {
    const plan = createTestPlan();
    const validator = ConstitutionalValidator.getInstance();
    const result = validator.validate(plan);
    expect(result.ok).toBe(false);
    expect(result.gates.length).toBeGreaterThan(0);
    expect(result.summary).toBeTruthy();
  });

  it("passes validation when all required flags are enabled", () => {
    const plan = createTestPlan();
    const validator = ConstitutionalValidator.getInstance();

    enableActivationFlags();
    epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);

    const result = validator.validate(plan);
    expect(result.ok).toBe(true);
  });

  it("returns gates with feature_flags gate", () => {
    const plan = createTestPlan();
    const validator = ConstitutionalValidator.getInstance();
    const result = validator.validate(plan);
    const ffGate = result.gates.find((g) => g.gate === "feature_flags");
    expect(ffGate).toBeDefined();
    expect(ffGate!.passed).toBe(false);
    expect(ffGate!.severity).toBe("error");
  });

  it("returns an executive_reporting gate", () => {
    const plan = createTestPlan();
    const validator = ConstitutionalValidator.getInstance();
    const result = validator.validate(plan);
    const erGate = result.gates.find((g) => g.gate === "executive_reporting");
    expect(erGate).toBeDefined();
  });
});

// ── Section 9: WEFDelegator ──────────────────────────────────

describe("WEFDelegator", () => {
  it("is a singleton", () => {
    expect(WEFDelegator.getInstance()).toBe(WEFDelegator.getInstance());
  });

  it("delegates a batch and returns a successful result", async () => {
    enableActivationFlags();
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation(plan.id);
    esm.transitionState(lc.id, ActivationState.VALIDATING);
    esm.transitionState(lc.id, ActivationState.ACTIVATING);
    esm.addBatch(lc.id, batch.id);

    const delegator = WEFDelegator.getInstance();
    const result = await delegator.delegate(plan, batch, lc.id);
    expect(result.ok).toBe(true);
    expect(result.delegationId).toContain("wef-");
  });

  it("throws WEFDelegationError when activation is not found", async () => {
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const delegator = WEFDelegator.getInstance();
    // The WEF delegator's validateDelegationRequest or createActivation will fail
    await expect(
      delegator.delegate(plan, batch, "nonexistent"),
    ).rejects.toThrow();
  });
});

// ── Section 10: VerificationRouter ────────────────────────────

describe("VerificationRouter", () => {
  it("is a singleton", () => {
    expect(VerificationRouter.getInstance()).toBe(VerificationRouter.getInstance());
  });

  it("verifies a successful delegation", () => {
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const delegationResult = {
      ok: true,
      delegationId: "wef-test-1",
      timestamp: new Date().toISOString(),
    };
    const router = VerificationRouter.getInstance();
    const result = router.verify(plan, batch, delegationResult, "activation-1");
    expect(result.ok).toBe(true);
    expect(result.checks.length).toBeGreaterThan(0);
  });

  it("fails verification when delegation failed", () => {
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const delegationResult = {
      ok: false,
      delegationId: "wef-test-2",
      error: "Delegation failed",
      timestamp: new Date().toISOString(),
    };
    const router = VerificationRouter.getInstance();
    const result = router.verify(plan, batch, delegationResult, "activation-2");
    expect(result.ok).toBe(false);
    expect(result.checks.some((c) => !c.passed)).toBe(true);
  });

  it("returns a delegation_integrity check", () => {
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const delegationResult = {
      ok: true,
      delegationId: "wef-test-3",
      timestamp: new Date().toISOString(),
    };
    const router = VerificationRouter.getInstance();
    const result = router.verify(plan, batch, delegationResult, "activation-3");
    const integrityCheck = result.checks.find((c) => c.check === "delegation_integrity");
    expect(integrityCheck).toBeDefined();
    expect(integrityCheck!.passed).toBe(true);
  });
});

// ── Section 11: KnowledgeCaptureTrigger ───────────────────────

describe("KnowledgeCaptureTrigger", () => {
  it("returns 0 entries when knowledge capture is disabled via config", () => {
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const delegationResult = {
      ok: true,
      delegationId: "wef-kc-1",
      timestamp: new Date().toISOString(),
    };
    const verificationResult = {
      ok: true,
      verificationId: "ver-kc-1",
      checks: [],
      summary: "Passed",
    };
    const trigger = KnowledgeCaptureTrigger.getInstance();
    // Disable via WAS config instead of flag
    trigger.configure({ enableKnowledgeCapture: false });
    const count = trigger.trigger(plan, batch, delegationResult, verificationResult as any, "activation-kc");
    expect(count).toBe(0);
  });

  it("captures entries for a successful execution", () => {
    enableActivationFlags();
    epclEnableFlag(EPCLFeatureFlag.ENABLE_KNOWLEDGE_CAPTURE);
    KnowledgeCaptureTrigger.getInstance().reset();
    const plan = createTestPlan();
    const batch = plan.batches[0];
    const delegationResult = {
      ok: true,
      delegationId: "wef-kc-2",
      timestamp: new Date().toISOString(),
    };
    const verificationResult = {
      ok: true,
      verificationId: "ver-kc-2",
      checks: [],
      summary: "Passed",
    };
    const trigger = KnowledgeCaptureTrigger.getInstance();
    const count = trigger.trigger(plan, batch, delegationResult, verificationResult as any, "activation-kc");
    expect(count).toBeGreaterThan(0);
  });
});

// ── Section 12: ExecutiveStatusUpdater ────────────────────────

describe("ExecutiveStatusUpdater", () => {
  it("generates a report for a completed activation", () => {
    const plan = createTestPlan();
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation(plan.id);

    const updater = ExecutiveStatusUpdater.getInstance();
    updater.reset();
    const report = updater.report(plan, lc);
    expect(report).toBeDefined();
    expect(report.activationId).toBe(lc.id);
    expect(report.planId).toBe(plan.id);
    expect(report.state).toBe(ActivationState.PENDING);
    expect(report.summary).toContain(lc.id);
  });

  it("includes batch statistics in report", () => {
    const plan = createTestPlan();
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation(plan.id);
    esm.addBatch(lc.id, plan.batches[0].id);

    const updater = ExecutiveStatusUpdater.getInstance();
    updater.reset();
    const report = updater.report(plan, lc);
    expect(report.totalBatches).toBe(1);
    expect(report.batchesActivated).toBe(0);
  });

  it("stores reports and can retrieve them", () => {
    const plan = createTestPlan();
    const esm = ExecutionStateManager.getInstance();
    const lc = esm.createActivation(plan.id);

    const updater = ExecutiveStatusUpdater.getInstance();
    updater.reset();
    updater.report(plan, lc);

    const reports = updater.getReports();
    expect(reports.length).toBe(1);
    expect(updater.getReportForActivation(lc.id)).toBeDefined();
    expect(updater.getReportForPlan(plan.id)).toBeDefined();
  });
});

// ── Section 13: WorkforceActivationService (end-to-end) ─────

describe("WorkforceActivationService", () => {
  it("is a singleton", () => {
    expect(WorkforceActivationService.getInstance()).toBe(
      WorkforceActivationService.getInstance(),
    );
  });

  it("rejects activation when all flags are disabled (fail-closed)", async () => {
    const plan = createTestPlan();
    const was = WorkforceActivationService.getInstance();
    await expect(was.activate(plan)).rejects.toThrow(WorkforceActivationError);
  });

  it("activates a plan successfully when flags are enabled", async () => {
    enableActivationFlags();
    epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    const plan = createTestPlan();
    const was = WorkforceActivationService.getInstance();
    const lifecycle = await was.activate(plan);
    expect(lifecycle).toBeDefined();
    // After successful activation the lifecycle should be in a terminal or active state
    expect(lifecycle.planId).toBe(plan.id);
  });

  it("rejects activation when EPCL flags are disabled", async () => {
    // Enable WAS flags but not EPCL flags
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    enableWASFlag(WASFeatureFlag.ENABLE_BATCH_GENERATION);
    // EPCL's ENABLE_EXECUTIVE_WORKFLOW remains false

    const plan = createTestPlan();
    const was = WorkforceActivationService.getInstance();
    await expect(was.activate(plan)).rejects.toThrow(WorkforceActivationError);
  });

  it("supports configure and getConfig", () => {
    const was = WorkforceActivationService.getInstance();
    was.configure({ maxConcurrentActivations: 3, detailedObservability: true });
    const config = was.getConfig();
    expect(config.maxConcurrentActivations).toBe(3);
    expect(config.detailedObservability).toBe(true);
  });

  it("propagates configure to underlying services", () => {
    const was = WorkforceActivationService.getInstance();
    was.configure({ maxConcurrentActivations: 10, maxRetries: 5 });

    const esm = ExecutionStateManager.getInstance();
    expect(esm.getConfig().maxConcurrentActivations).toBe(10);
    expect(esm.getConfig().maxRetries).toBe(5);
  });
});

// ── Section 14: EPCL Integration ─────────────────────────────

describe("EPCLIntegration", () => {
  it("WAS sync respects EPCL master switch", () => {
    // EPCL ENABLE_AUTONOMOUS_EXECUTION starts disabled
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    syncWASFlagsFromEPCL();
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });

  it("WAS respects EPCL ENABLE_EXECUTIVE_WORKFLOW", () => {
    epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    syncWASFlagsFromEPCL();
    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(true);
  });

  it("validateFeatureFlags checks both EPCL and WAS flags", () => {
    // EPCL enable both
    epclEnableFlag(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    epclEnableFlag(EPCLFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW);
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    enableWASFlag(WASFeatureFlag.ENABLE_BATCH_GENERATION);

    const gate = validateFeatureFlags();
    expect(gate.passed).toBe(true);
  });

  it("resetAllFlagsForTest resets both WAS and EPCL flags", () => {
    enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
    epclEnableFlag(EPCLFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW);

    resetAllFlagsForTest();

    expect(isWASEnabled(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)).toBe(false);
  });
});