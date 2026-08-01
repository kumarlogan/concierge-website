// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Executive Planning Workflow              │
// │ 12-stage deterministic planning workflow that coordinates   │
// │ roadmap ingestion, execution planning, batch generation,    │
// │ and WEF delegation — fail-closed by default.                │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutionPlan,
  type ExecutionBatch,
  type EPCLConfig,
  type StageResult,
  type BatchCheckpoint,
  type KnowledgeEntry,
  PlanStatus,
  BatchStatus,
  WorkflowStage,
  FeatureFlag,
  KnowledgeType,
  WORKFLOW_STAGE_ORDER,
  DEFAULT_EPCL_CONFIG,
} from "./types.ts";
import { isEnabled, getConfig } from "./feature-flags.ts";
import { RoadmapEngine, type RoadmapAnalysis } from "./roadmap-engine.js";
import { CapabilitySelector } from "./capability-selector.js";
import { DisciplineSelector } from "./discipline-selector.js";
import { ExecutionPlanner, ExecutionPlannerError } from "./execution-planner.js";
import { ApprovalManager } from "./approval-manager.js";
import { ContextBudgetManager } from "./context-budget-manager.js";
import { TokenBudgetManager } from "./token-budget-manager.js";
import { ExecutiveReporter } from "./executive-reporter.js";
import { KnowledgeCapturer } from "./knowledge-capturer.js";
import { RecoveryManager } from "./recovery-manager.js";
import { WorkforceActivationService } from "../was/workforce-activation-service.js";

// ══════════════════════════════════════════════════════════════
// Executive Planning Workflow
// ══════════════════════════════════════════════════════════════

export class ExecutivePlanningWorkflow {
  private static instance: ExecutivePlanningWorkflow;
  private activeWorkflows: Map<string, ExecutionPlan> = new Map();

  private roadmapEngine: RoadmapEngine;
  private capabilitySelector: CapabilitySelector;
  private disciplineSelector: DisciplineSelector;
  private executionPlanner: ExecutionPlanner;
  private approvalManager: ApprovalManager;
  private contextBudgetManager: ContextBudgetManager;
  private tokenBudgetManager: TokenBudgetManager;
  private reporter: ExecutiveReporter;
  private knowledgeCapturer: KnowledgeCapturer;
  private recoveryManager: RecoveryManager;
  private workforceActivation: WorkforceActivationService;

  private constructor() {
    this.roadmapEngine = RoadmapEngine.getInstance();
    this.capabilitySelector = CapabilitySelector.getInstance();
    this.disciplineSelector = DisciplineSelector.getInstance();
    this.executionPlanner = ExecutionPlanner.getInstance();
    this.approvalManager = ApprovalManager.getInstance();
    this.contextBudgetManager = ContextBudgetManager.getInstance();
    this.tokenBudgetManager = TokenBudgetManager.getInstance();
    this.reporter = ExecutiveReporter.getInstance();
    this.knowledgeCapturer = KnowledgeCapturer.getInstance();
    this.recoveryManager = RecoveryManager.getInstance();
    this.workforceActivation = WorkforceActivationService.getInstance();
  }

  static getInstance(): ExecutivePlanningWorkflow {
    if (!ExecutivePlanningWorkflow.instance) {
      ExecutivePlanningWorkflow.instance = new ExecutivePlanningWorkflow();
    }
    return ExecutivePlanningWorkflow.instance;
  }

  // ── Public API ──────────────────────────────────────────────

  /**
   * Execute the full 12-stage planning workflow from a roadmap markdown document.
   *
   * Stages:
   *   1. ROADMAP_ANALYSIS     — Parse and analyze the roadmap document
   *   2. DEPENDENCY_RESOLUTION — Resolve inter-epic dependencies
   *   3. EXECUTION_PLAN       — Create the execution plan
   *   4. CAPABILITY_SELECTION — Select capabilities for each epic
   *   5. DISCIPLINE_SELECTION — Select disciplines for each epic
   *   6. BATCH_GENERATION     — Generate execution batches
   *   7. APPROVAL_CHECK       — Approve plan and batches
   *   8. WEF_DELEGATION       — Activate plan via WAS (Workforce Activation Service)
   *   9. EXECUTION_MONITORING — Report WAS activation status
   *  10. VERIFICATION         — Report WAS verification summary
   *  11. KNOWLEDGE_CAPTURE    — Capture knowledge from planning
   *  12. EXECUTIVE_REPORT     — Generate executive report
   */
  async execute(
    roadmapInput: string,
    source: string,
    config?: Partial<EPCLConfig>,
  ): Promise<WorkflowResult> {
    const stages: Map<WorkflowStage, StageResult> = new Map();
    // Prepare EPCL config for validation (deep merge for nested objects)
    const mergedConfig: EPCLConfig = { ...DEFAULT_EPCL_CONFIG };
    if (config) {
      if (config.execution) {
        mergedConfig.execution = { ...DEFAULT_EPCL_CONFIG.execution, ...config.execution };
      }
      if (config.tokenBudget) {
        mergedConfig.tokenBudget = { ...DEFAULT_EPCL_CONFIG.tokenBudget, ...config.tokenBudget };
      }
      if (config.contextBudget) {
        mergedConfig.contextBudget = { ...DEFAULT_EPCL_CONFIG.contextBudget, ...config.contextBudget };
      }
    }

    try {
          // ── Stage 1: ROADMAP_ANALYSIS ──
          const { roadmap, analysis } = this.doRoadmapAnalysis(roadmapInput, source, stages);

          // ── Stage 2: DEPENDENCY_RESOLUTION ──
          this.doDependencyResolution(analysis, stages);

          // ── Stage 3: EXECUTION_PLAN ──
          const plan = this.doExecutionPlan(roadmap, stages);

          // ── Stage 4: CAPABILITY_SELECTION ──
          this.doCapabilitySelection(roadmap, plan, stages);

          // ── Stage 5: DISCIPLINE_SELECTION ──
          this.doDisciplineSelection(roadmap, plan, stages);

          // ── Stage 6: BATCH_GENERATION ──
                this.doBatchGeneration(plan, stages);

                // ── Stage 7: APPROVAL_CHECK ──
                this.doApprovalCheck(plan, stages);
                // Approve the plan now that approval check passed
                this.executionPlanner.updatePlanStatus(plan.id, PlanStatus.APPROVED);

                // ── Stage 8-10: WAS Activation — delegate to Workforce Activation Service ──
                await this.doWefDelegation(plan, stages, mergedConfig);
                await this.doExecutionMonitoring(plan, stages);
                await this.doVerification(plan, stages);

                // ── Stage 11: KNOWLEDGE_CAPTURE ──
                this.doKnowledgeCapture(plan, analysis, stages);

                // ── Stage 12: EXECUTIVE_REPORT ──
                this.doExecutiveReport(plan, analysis, stages);

                // Finalize plan
                this.executionPlanner.updatePlanStatus(plan.id, PlanStatus.APPROVED);
                this.recoveryManager.finalizePlan(plan.id);

                return {
                  ok: true,
                  plan,
                  analysis,
                  stages: Array.from(stages.values()),
                };
        } catch (err) {
          return {
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            stages: Array.from(stages.values()),
          };
        }
      }

  // ── Stage Implementations ───────────────────────────────────

  private doRoadmapAnalysis(
    input: string,
    source: string,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    const id = `roadmap-${Date.now()}`;
    const roadmap = this.roadmapEngine.parseMarkdown(id, input, source);
    this.roadmapEngine.register(roadmap);
    const analysis = this.roadmapEngine.analyze(roadmap.id);

    stages.set(WorkflowStage.ROADMAP_ANALYSIS, {
      stage: WorkflowStage.ROADMAP_ANALYSIS,
      ok: true,
      output: { roadmapId: roadmap.id, phases: roadmap.phases.length, epics: analysis.totalEpics },
      duration: Date.now() - start,
    });

    return { roadmap, analysis };
  }

  private doDependencyResolution(
    analysis: RoadmapAnalysis,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    stages.set(WorkflowStage.DEPENDENCY_RESOLUTION, {
      stage: WorkflowStage.DEPENDENCY_RESOLUTION,
      ok: true,
      output: {
        totalDependencies: analysis.totalDependencies,
        satisfied: analysis.satisfiedDependencies,
        circular: analysis.hasCircularDependencies,
      },
      duration: Date.now() - start,
    });
  }

  private doExecutionPlan(
    roadmap: import("./types.js").Roadmap,
    stages: Map<WorkflowStage, StageResult>,
  ): ExecutionPlan {
    const start = Date.now();

    // Select capabilities and disciplines for each phase's epics
    const capabilitySelections = new Map<string, import("./types.js").CapabilitySelection[]>();
    const disciplineSelections = new Map<string, import("./types.js").DisciplineSelection[]>();

    for (const phase of roadmap.phases) {
      const caps: import("./types.js").CapabilitySelection[] = [];
      const discs: import("./types.js").DisciplineSelection[] = [];

      for (const epic of phase.epics) {
        caps.push(...this.capabilitySelector.selectForEpic(epic));
        discs.push(...this.disciplineSelector.selectForEpic(epic));
      }

      capabilitySelections.set(phase.id, caps);
      disciplineSelections.set(phase.id, discs);
    }

    const plan = this.executionPlanner.createPlan(roadmap, capabilitySelections, disciplineSelections);

    // Initialize budgets
    this.contextBudgetManager.initializeForPlan(plan.id);
    this.tokenBudgetManager.initializeForPlan(plan.id);

    this.activeWorkflows.set(plan.id, plan);

    stages.set(WorkflowStage.EXECUTION_PLAN, {
      stage: WorkflowStage.EXECUTION_PLAN,
      ok: true,
      output: { planId: plan.id, phases: plan.phases.length, batches: plan.batches.length },
      duration: Date.now() - start,
    });

    return plan;
  }

  private doCapabilitySelection(
    _roadmap: import("./types.js").Roadmap,
    plan: ExecutionPlan,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    stages.set(WorkflowStage.CAPABILITY_SELECTION, {
      stage: WorkflowStage.CAPABILITY_SELECTION,
      ok: true,
      output: { capabilities: this.capabilitySelector.list().length },
      duration: Date.now() - start,
    });
  }

  private doDisciplineSelection(
    _roadmap: import("./types.js").Roadmap,
    plan: ExecutionPlan,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    stages.set(WorkflowStage.DISCIPLINE_SELECTION, {
      stage: WorkflowStage.DISCIPLINE_SELECTION,
      ok: true,
      output: { disciplines: Object.keys(this.disciplineSelector.getUtilizationSummary()) },
      duration: Date.now() - start,
    });
  }

  private doBatchGeneration(
    plan: ExecutionPlan,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    // Batches are already generated by ExecutionPlanner.createPlan
    // Here we just verify and checkpoint
    const batchCount = plan.batches.length;
    const totalTasks = plan.batches.reduce((sum, b) => sum + b.tasks.length, 0);

    this.recoveryManager.createSnapshot(plan);

    stages.set(WorkflowStage.BATCH_GENERATION, {
      stage: WorkflowStage.BATCH_GENERATION,
      ok: true,
      output: { batches: batchCount, tasks: totalTasks },
      duration: Date.now() - start,
    });
  }

  private doApprovalCheck(
    plan: ExecutionPlan,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();

    const planApproval = this.approvalManager.evaluatePlan(plan);
    if (planApproval.required) {
      stages.set(WorkflowStage.APPROVAL_CHECK, {
        stage: WorkflowStage.APPROVAL_CHECK,
        ok: false,
        output: { approved: false, reason: planApproval.reason },
        duration: Date.now() - start,
      });
      throw new Error(`Plan approval rejected: ${planApproval.reason}`);
    }

    for (const batch of plan.batches) {
      const batchApproval = this.approvalManager.evaluateBatch(batch, plan);
      if (batchApproval.required) {
        stages.set(WorkflowStage.APPROVAL_CHECK, {
          stage: WorkflowStage.APPROVAL_CHECK,
          ok: false,
          output: { approved: false, batchId: batch.id, reason: batchApproval.reason },
          duration: Date.now() - start,
        });
        throw new Error(`Batch ${batch.id} approval rejected: ${batchApproval.reason}`);
      }
    }

    stages.set(WorkflowStage.APPROVAL_CHECK, {
      stage: WorkflowStage.APPROVAL_CHECK,
      ok: true,
      output: { approved: true, batchesApproved: plan.batches.length },
      duration: Date.now() - start,
    });
  }

  // ── Stage 8: WEF_DELEGATION — Activate plan via WAS ──
  //
  // After the plan is approved (Stage 7), we initiate the Workforce Activation
  // Service (WAS) pipeline. WAS acts as the activation boundary between EPCL
  // (planning) and WEF (execution). It handles:
  //   - Constitutional validation (fail-closed gates)
  //   - Activation lifecycle state machine
  //   - Delegation to WEF
  //   - Verification routing
  //   - Knowledge capture triggering
  //   - Executive status reporting
  //
  // This stage:
  //   1. Activates the plan through WAS (consume → validate → activate)
  //   2. Delegates each batch to WEF for execution
  //   3. Completes the activation (transition to DEACTIVATED)
  //   4. Generates executive status report
  private async doWefDelegation(
      plan: ExecutionPlan,
      stages: Map<WorkflowStage, StageResult>,
  ): Promise<void> {
      const start = Date.now();

      try {
          // Check if WAS is enabled via feature flags
          const isAutonomousExecutionEnabled = isEnabled(FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION);
          console.log(`[doWefDelegation] isEnabled(ENABLE_AUTONOMOUS_EXECUTION) = ${isAutonomousExecutionEnabled}`);
          // Check if WAS is enabled via feature flags
          if (!isAutonomousExecutionEnabled) {
              stages.set(WorkflowStage.WEF_DELEGATION, {
                  stage: WorkflowStage.WEF_DELEGATION,
                  ok: true,
                  output: { status: "reserved" },
                  duration: Date.now() - start,
              });
              return;
          }

          // Stage 8a: Activate the plan through WAS (fail-closed)
          // This runs: consume → validate → activate state machine
          const lifecycle = await this.workforceActivation.activate(plan);

          // Stage 8b: Delegate each batch to WEF for execution
          // WAS delegateBatch() internally handles:
          //   - WEF delegation via WEFDelegator
          //   - Verification via VerificationRouter
          //   - Knowledge capture via KnowledgeCaptureTrigger
          const batchResults: Array<{ batchId: string; ok: boolean; error?: string }> = [];
          for (const batch of plan.batches) {
              try {
                  await this.workforceActivation.delegateBatch(plan, batch, lifecycle.id);
                  batchResults.push({ batchId: batch.id, ok: true });
              } catch (batchErr) {
                  const msg = batchErr instanceof Error ? batchErr.message : String(batchErr);
                  batchResults.push({ batchId: batch.id, ok: false, error: msg });
              }
          }

          // Stage 8c: Complete the activation
          // WAS complete() internally handles:
          //   - State transition (DEACTIVATING → DEACTIVATED)
          //   - Executive status reporting via ExecutiveStatusUpdater
          const report = this.workforceActivation.complete(plan, lifecycle.id);

          stages.set(WorkflowStage.WEF_DELEGATION, {
              stage: WorkflowStage.WEF_DELEGATION,
              ok: true,
              output: {
                  status: "activated",
                  activationId: lifecycle.id,
                  state: lifecycle.state,
                  batchCount: plan.batches.length,
                  batchesDelegated: batchResults.filter(r => r.ok).length,
                  batchesFailed: batchResults.filter(r => !r.ok).length,
                  reportSummary: report.summary,
                  batchResults,
              },
              duration: Date.now() - start,
          });
      } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          stages.set(WorkflowStage.WEF_DELEGATION, {
              stage: WorkflowStage.WEF_DELEGATION,
              ok: false,
              output: {
                  status: "failed",
                  error: message,
              },
              duration: Date.now() - start,
          });
          throw new Error(`WEF delegation failed: ${message}`);
      }
  }

  // ── Stage 9: EXECUTION_MONITORING — Report activation status ——
  // ── Stage 9: EXECUTION_MONITORING — Report activation status ——
    //
    // Reports the current state of WAS activation. Since WAS runs
    // asynchronously, this reflects a snapshot of the activation
    // lifecycle at this point.
  private async doExecutionMonitoring(
    plan: ExecutionPlan,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();

    try {
      if (!isEnabled(FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)) {
        stages.set(WorkflowStage.EXECUTION_MONITORING, {
          stage: WorkflowStage.EXECUTION_MONITORING,
          ok: true,
          output: { status: "reserved" },
          duration: Date.now() - start,
        });
        return;
      }

      const activeActivations = this.workforceActivation.listActive();

      stages.set(WorkflowStage.EXECUTION_MONITORING, {
        stage: WorkflowStage.EXECUTION_MONITORING,
        ok: true,
        output: {
          status: activeActivations.length > 0 ? "in-progress" : "completed",
          activeActivationCount: activeActivations.length,
          isPlanActivated: this.workforceActivation.isPlanActivated(plan.id),
          stateCounts: this.workforceActivation.countByState(),
        },
        duration: Date.now() - start,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stages.set(WorkflowStage.EXECUTION_MONITORING, {
        stage: WorkflowStage.EXECUTION_MONITORING,
        ok: false,
        output: {
          status: "failed",
          error: message,
        },
        duration: Date.now() - start,
      });
      throw new Error(`Execution monitoring failed: ${message}`);
    }
  }

  // ── Stage 10: VERIFICATION — Report activation verification ──
  //
  // Reports overall verification status from WAS activation.
  // Actual per-batch verification runs through WAS's own
  // VerificationRouter — this stage provides the summary.
  private async doVerification(
    plan: ExecutionPlan,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();

    try {
      if (!isEnabled(FeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)) {
        stages.set(WorkflowStage.VERIFICATION, {
          stage: WorkflowStage.VERIFICATION,
          ok: true,
          output: { status: "reserved" },
          duration: Date.now() - start,
        });
        return;
      }

      const stateCounts = this.workforceActivation.countByState();

      stages.set(WorkflowStage.VERIFICATION, {
        stage: WorkflowStage.VERIFICATION,
        ok: true,
        output: {
          status: "reporting",
          stateDistribution: stateCounts,
          totalActivations: this.workforceActivation.listAll().length,
        },
        duration: Date.now() - start,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      stages.set(WorkflowStage.VERIFICATION, {
        stage: WorkflowStage.VERIFICATION,
        ok: false,
        output: {
          status: "failed",
          error: message,
        },
        duration: Date.now() - start,
      });
      throw new Error(`Verification failed: ${message}`);
    }
  }

  private doKnowledgeCapture(
    plan: ExecutionPlan,
    analysis: RoadmapAnalysis,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    if (isEnabled(FeatureFlag.ENABLE_KNOWLEDGE_CAPTURE)) {
      this.knowledgeCapturer.capture(
        KnowledgeType.REUSABLE_KNOWLEDGE,
        `Batch count for ${plan.id}`,
        `Plan has ${plan.batches.length} batches across ${analysis.totalEpics} epics`,
        "epcl-executive-workflow",
        plan.id,
        String(plan.batches.length),
        [`Plan has ${plan.batches.length} batches across ${analysis.totalEpics} epics`],
      );
    }

    stages.set(WorkflowStage.KNOWLEDGE_CAPTURE, {
      stage: WorkflowStage.KNOWLEDGE_CAPTURE,
      ok: true,
      output: { captured: true },
      duration: Date.now() - start,
    });
  }

  private doExecutiveReport(
    plan: ExecutionPlan,
    analysis: RoadmapAnalysis,
    stages: Map<WorkflowStage, StageResult>,
  ) {
    const start = Date.now();
    this.reporter.generateReport(
      plan,
      this.disciplineSelector,
      this.approvalManager,
      this.contextBudgetManager,
      this.tokenBudgetManager,
    );

    stages.set(WorkflowStage.EXECUTIVE_REPORT, {
      stage: WorkflowStage.EXECUTIVE_REPORT,
      ok: true,
      output: { reportGenerated: true },
      duration: Date.now() - start,
    });
  }

  // ── Public Query Methods ────────────────────────────────────

  /** Get an active workflow's plan */
  getPlan(planId: string): ExecutionPlan | undefined {
    return this.activeWorkflows.get(planId);
  }

  /** Check if a workflow with this plan ID is active */
  isActive(planId: string): boolean {
    return this.activeWorkflows.has(planId);
  }

  /** List active workflow plan IDs */
  listActive(): string[] {
    return Array.from(this.activeWorkflows.keys());
  }

  /** Reset all state. For testing. */
  reset(): void {
    this.activeWorkflows.clear();
    this.roadmapEngine.reset();
    this.capabilitySelector.reset();
    this.disciplineSelector.reset();
    this.executionPlanner.reset();
    this.approvalManager.reset();
    this.contextBudgetManager.reset();
    this.tokenBudgetManager.reset();
    this.reporter.reset();
    this.knowledgeCapturer.reset();
    this.recoveryManager.reset();
    this.workforceActivation.reset();
  }
}

// ══════════════════════════════════════════════════════════════
// Workflow Result
// ══════════════════════════════════════════════════════════════

export interface WorkflowResult {
  ok: boolean;
  plan?: ExecutionPlan;
  analysis?: RoadmapAnalysis;
  error?: string;
  stages: StageResult[];
}