// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Executive Planning Workflow Tests        │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘
// Run with: npx vitest run tests/platform/epcl-executive-workflow.test.ts

import { describe, it, expect, beforeEach, afterEach, test } from "vitest";
import { ExecutivePlanningWorkflow } from "../../src/platform/epcl/executive-workflow.js";
import { CapabilitySelector } from "../../src/platform/epcl/capability-selector.js";
import { FeatureFlag, PlanStatus, WorkflowStage } from "../../src/platform/epcl/types.js";
import { setFlags, resetForTest } from "../../src/platform/epcl/feature-flags.js";

// ══════════════════════════════════════════════════════════════
// Fixtures
// ══════════════════════════════════════════════════════════════

/** A valid roadmap markdown with safe capabilities (no approval triggers). */
const VALID_ROADMAP = `# Q1 2025 Platform Roadmap

## Phase: Foundation
- description: Core platform infrastructure

### Epic: API Gateway
- description: Implement API gateway
- effort: 3 weeks
- priority: 1
- discipline: engineering_quality
- capability: code.generate

#### Milestone: Gateway Setup
- description: Set up gateway infrastructure
- deliverable: API gateway config
- verify: Gateway responds to health checks

### Epic: Linting
- description: Add linting pipeline
- effort: 2 weeks
- priority: 2
- discipline: engineering_quality
- capability: test.run

#### Milestone: Lint Pipeline
- description: CI linting
- deliverable: Lint config
- verify: Lint passes on all files

## Phase: Growth
- description: Feature expansion

### Epic: Dashboard
- description: User dashboard implementation
- effort: 4 weeks
- priority: 1
- discipline: experience_design
- capability: ui

#### Milestone: UI
- description: Dashboard UI components
- deliverable: Dashboard page
- verify: Page loads under 2s
`;

/** A roadmap with no phases for edge-case testing. */
const EMPTY_ROADMAP = `# Empty Roadmap
- description: This roadmap has no phases
`;

/** Register capabilities that pass all approval checks in the ApprovalManager. */
function registerTestCapabilities(): void {
  const selector = CapabilitySelector.getInstance();
  // Safe capabilities that don't match any approval trigger in ApprovalManager:
  //   - No "deploy", "publish", "release" (deployment check)
  //   - No "db.", "database", "migrate" (database check)
  //   - No "security", "auth", "permission" (security check)
  //   - No "new", "unknown" (new capabilities check)
  selector.register({
    id: "code.generate",
    name: "Code Generation",
    description: "Generate boilerplate code from templates",
    provider: "local",
    healthy: true,
    enabled: true,
    active: true,
    requiresApproval: false,
    estimatedCost: 0,
    fallbackCapabilities: [],
    keywords: ["codegen", "generate", "scaffold", "code"],
    disciplines: ["engineering_quality"],
    registeredAt: new Date().toISOString(),
  });
  selector.register({
    id: "test.run",
    name: "Test Runner",
    description: "Run unit and integration tests",
    provider: "local",
    healthy: true,
    enabled: true,
    active: true,
    requiresApproval: false,
    estimatedCost: 0,
    fallbackCapabilities: [],
    keywords: ["test", "testing", "unit", "integration"],
    disciplines: ["engineering_quality"],
    registeredAt: new Date().toISOString(),
  });
  selector.register({
    id: "ui",
    name: "UI Components",
    description: "Generate UI components",
    provider: "local",
    healthy: true,
    enabled: true,
    active: true,
    requiresApproval: false,
    estimatedCost: 0,
    fallbackCapabilities: [],
    keywords: ["ui", "component", "frontend"],
    disciplines: ["experience_design"],
    registeredAt: new Date().toISOString(),
  });
}

/** Enable all EPCL feature flags for testing. */
function enableAllFlags(): void {
  setFlags({
    [FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW]: true,
    [FeatureFlag.ENABLE_ROADMAP_INGESTION]: true,
    [FeatureFlag.ENABLE_BATCH_GENERATION]: true,
    [FeatureFlag.ENABLE_EXECUTIVE_REPORTING]: true,
    [FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]: true,
    [FeatureFlag.ENABLE_AUTOMATIC_KNOWLEDGE_CAPTURE]: true,
    [FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE]: true,
  });
}

// ══════════════════════════════════════════════════════════════
// Test Suite
// ══════════════════════════════════════════════════════════════

describe("ExecutivePlanningWorkflow", () => {
  let workflow: ExecutivePlanningWorkflow;

  beforeEach(() => {
    enableAllFlags();
    // Reset all singletons to ensure clean state before registering
    ExecutivePlanningWorkflow.getInstance().reset();
    // Register test capabilities AFTER reset (reset clears the registry)
    registerTestCapabilities();
    workflow = ExecutivePlanningWorkflow.getInstance();
  });

  afterEach(() => {
    resetForTest();
    if (workflow) {
      workflow.reset();
    }
  });

  // ── Full Success Path ───────────────────────────────────────

  it("executes the full 12-stage workflow successfully", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");

    expect(result.ok).toBe(true);
    expect(result.plan).toBeDefined();
    expect(result.analysis).toBeDefined();
    expect(result.stages).toHaveLength(12);

    // Verify all 12 stages are present
    const stageNames = result.stages.map((s) => s.stage);
    expect(stageNames).toContain(WorkflowStage.ROADMAP_ANALYSIS);
    expect(stageNames).toContain(WorkflowStage.DEPENDENCY_RESOLUTION);
    expect(stageNames).toContain(WorkflowStage.EXECUTION_PLAN);
    expect(stageNames).toContain(WorkflowStage.CAPABILITY_SELECTION);
    expect(stageNames).toContain(WorkflowStage.DISCIPLINE_SELECTION);
    expect(stageNames).toContain(WorkflowStage.BATCH_GENERATION);
    expect(stageNames).toContain(WorkflowStage.APPROVAL_CHECK);
    expect(stageNames).toContain(WorkflowStage.WEF_DELEGATION);
    expect(stageNames).toContain(WorkflowStage.EXECUTION_MONITORING);
    expect(stageNames).toContain(WorkflowStage.VERIFICATION);
    expect(stageNames).toContain(WorkflowStage.KNOWLEDGE_CAPTURE);
    expect(stageNames).toContain(WorkflowStage.EXECUTIVE_REPORT);

    // Verify all stages succeeded
    for (const stage of result.stages) {
      expect(stage.ok).toBe(true);
    }

    // Verify plan details
    expect(result.plan!.id).toBeTruthy();
    expect(result.plan!.batches.length).toBeGreaterThan(0);
    expect(result.plan!.status).toBe(PlanStatus.APPROVED);

    // Verify analysis details
    expect(result.analysis!.totalEpics).toBeGreaterThan(0);
  });

  it("executes stages in order — monotonically increasing WORKFLOW_STAGE_ORDER", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    // Each stage should appear in ascending order of WORKFLOW_STAGE_ORDER
    const actualOrder = result.stages.map((s) => s.stage);

    // Every actual stage should be in the expected order (monotonically increasing)
    const expectedOrder = Object.values(WorkflowStage).filter(
      (v) => typeof v === "string",
    ) as string[];

    let lastIdx = -1;
    for (const stage of actualOrder) {
      const idx = expectedOrder.indexOf(stage);
      expect(idx).toBeGreaterThan(lastIdx); // monotonically increasing
      lastIdx = idx;
    }
  });

  it("produces plan with correct batch counts", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const plan = result.plan!;
    expect(plan.batches.length).toBeGreaterThan(0);

    // Each batch should have tasks
    for (const batch of plan.batches) {
      expect(batch.tasks.length).toBeGreaterThan(0);
    }
  });

  it("records stage durations", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    for (const stage of result.stages) {
      expect(stage.duration).toBeGreaterThanOrEqual(0);
    }
  });

  // ── Stage-specific Tests ────────────────────────────────────

  it("stage 1: ROADMAP_ANALYSIS returns roadmap metadata", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.ROADMAP_ANALYSIS)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("roadmapId");
    expect(output).toHaveProperty("phases");
    expect(output).toHaveProperty("epics");
    expect(output.phases).toBeGreaterThan(0);
    expect(output.epics).toBeGreaterThan(0);
  });

  it("stage 2: DEPENDENCY_RESOLUTION reports dependency counts", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.DEPENDENCY_RESOLUTION)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("totalDependencies");
    expect(output).toHaveProperty("satisfied");
    expect(output).toHaveProperty("circular");
  });

  it("stage 3: EXECUTION_PLAN creates a plan with phases and batches", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.EXECUTION_PLAN)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("planId");
    expect(output).toHaveProperty("phases");
    expect(output).toHaveProperty("batches");
    expect(output.phases).toBeGreaterThan(0);
    expect(output.batches).toBeGreaterThan(0);
  });

  it("stage 4: CAPABILITY_SELECTION reports registered capabilities", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.CAPABILITY_SELECTION)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("capabilities");
    expect(output.capabilities).toBeGreaterThanOrEqual(0);
  });

  it("stage 5: DISCIPLINE_SELECTION returns discipline summary", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.DISCIPLINE_SELECTION)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("disciplines");
  });

  it("stage 6: BATCH_GENERATION creates snapshots", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.BATCH_GENERATION)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("batches");
    expect(output).toHaveProperty("tasks");
    expect(output.batches).toBeGreaterThan(0);
    expect(output.tasks).toBeGreaterThan(0);
  });

  it("stage 7: APPROVAL_CHECK approves plan and batches", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.APPROVAL_CHECK)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("approved");
    expect(output.approved).toBe(true);
    expect(output).toHaveProperty("batchesApproved");
  });

  it("stages 8-10: reserved stages return reserved status", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const wefStage = result.stages.find((s) => s.stage === WorkflowStage.WEF_DELEGATION)!;
    expect(wefStage).toBeDefined();
    expect(wefStage.ok).toBe(true);
    expect(wefStage.output).toEqual({ status: "reserved" });

    const execStage = result.stages.find((s) => s.stage === WorkflowStage.EXECUTION_MONITORING)!;
    expect(execStage).toBeDefined();
    expect(execStage.ok).toBe(true);
    expect(execStage.output).toEqual({ status: "reserved" });

    const verStage = result.stages.find((s) => s.stage === WorkflowStage.VERIFICATION)!;
    expect(verStage).toBeDefined();
    expect(verStage.ok).toBe(true);
    expect(verStage.output).toEqual({ status: "reserved" });
  });

  it("stage 11: KNOWLEDGE_CAPTURE captures knowledge when flag enabled", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.KNOWLEDGE_CAPTURE)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("captured");
  });

  it("stage 12: EXECUTIVE_REPORT generates report", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const untyped = result.stages.find((s) => s.stage === WorkflowStage.EXECUTIVE_REPORT)!;
    expect(untyped).toBeDefined();
    expect(untyped.ok).toBe(true);
    const output = untyped.output as Record<string, unknown>;
    expect(output).toHaveProperty("reportGenerated");
    expect(output.reportGenerated).toBe(true);
  });

  // ── Query Methods ───────────────────────────────────────────

  it("getPlan returns the active plan after execution", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const plan = workflow.getPlan(result.plan!.id);
    expect(plan).toBeDefined();
    expect(plan!.id).toBe(result.plan!.id);
  });

  it("isActive returns true for active plans", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    expect(workflow.isActive(result.plan!.id)).toBe(true);
    expect(workflow.isActive("nonexistent")).toBe(false);
  });

  it("listActive returns active plan IDs", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    const active = workflow.listActive();
    expect(active).toContain(result.plan!.id);
    expect(active.length).toBeGreaterThanOrEqual(1);
  });

  // ── Error Handling ──────────────────────────────────────────

  it("returns error result for invalid roadmap (no title)", async () => {
    const result = await workflow.execute("no title here", "test");
    expect(result.ok).toBe(false);
    expect(result.plan).toBeUndefined();
    expect(result.error).toBeTruthy();
    expect(result.stages.length).toBeGreaterThanOrEqual(0);
  });

  it("returns error result for empty roadmap input", async () => {
    const result = await workflow.execute("", "test");
    expect(result.ok).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it("handles roadmap with no phases gracefully", async () => {
    const result = await workflow.execute(EMPTY_ROADMAP, "test");
    expect(result).toBeDefined();
  });

  it("reset() clears all active workflows", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);
    expect(workflow.listActive().length).toBeGreaterThan(0);

    workflow.reset();
    expect(workflow.listActive()).toHaveLength(0);
  });

  it("reset() with re-registered capabilities works cleanly", async () => {
    const result = await workflow.execute(VALID_ROADMAP, "test");
    expect(result.ok).toBe(true);

    // Reset should clear all underlying services
    workflow.reset();

    // After reset, re-register capabilities and execute again
    registerTestCapabilities();
    const result2 = await workflow.execute(VALID_ROADMAP, "test");
    expect(result2.ok).toBe(true);
  });

  it("multiple executions produce independent plans", async () => {
    const result1 = await workflow.execute(VALID_ROADMAP, "test");
    const result2 = await workflow.execute(VALID_ROADMAP, "test");

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
    expect(result1.plan!.id).not.toBe(result2.plan!.id);
    expect(workflow.listActive().length).toBeGreaterThanOrEqual(2);
  });
});

// ── Singleton & Instance Management ──────────────────────────

describe("ExecutivePlanningWorkflow (singleton)", () => {
  beforeEach(() => {
    enableAllFlags();
  });

  afterEach(() => {
    resetForTest();
    ExecutivePlanningWorkflow.getInstance().reset();
  });

  it("getInstance() returns the same instance", () => {
    const a = ExecutivePlanningWorkflow.getInstance();
    const b = ExecutivePlanningWorkflow.getInstance();
    expect(a).toBe(b);
  });

  it("getInstance() resets can be called on the same instance", () => {
    const a = ExecutivePlanningWorkflow.getInstance();
    a.reset();
    const b = ExecutivePlanningWorkflow.getInstance();
    expect(a).toBe(b);
  });
});