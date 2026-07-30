// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Execution Planner                       │
// │ Creates execution plans, batches, and dependency graphs    │
// │ from roadmap analysis + capability selection.              │
// └─────────────────────────────────────────────────────────────┘

import {
  FeatureFlag,
  type ExecutionPlan,
  type PlanPhase,
  type ExecutionBatch,
  type ExecutionTask,
  type BatchCheckpoint,
  type DependencyGraph,
  type DependencyNode,
  type DependencyEdge,
  type Roadmap,
  type RoadmapPhase,
  type RoadmapEpic,
  type CapabilitySelection,
  type DisciplineSelection,
  type ResolvedDependency,
  DependencyType,
  PlanStatus,
  BatchStatus,
  TaskStatus,
  TaskType,
} from "./types.js";
import { isEnabled, getConfig } from "./feature-flags.js";

// ── Error ────────────────────────────────────────────────────

export class ExecutionPlannerError extends Error {
  constructor(message: string) {
    super(`ExecutionPlannerError: ${message}`);
    this.name = "ExecutionPlannerError";
  }
}

// ── Execution Planner ────────────────────────────────────────

export class ExecutionPlanner {
  private static instance: ExecutionPlanner;
  private plans: Map<string, ExecutionPlan> = new Map();
  private batchCounter = 0;
  private taskCounter = 0;

  private constructor() {}

  static getInstance(): ExecutionPlanner {
    if (!ExecutionPlanner.instance) {
      ExecutionPlanner.instance = new ExecutionPlanner();
    }
    return ExecutionPlanner.instance;
  }

  // ── Plan Creation ──────────────────────────────────────────

  /**
   * Create an execution plan from a roadmap, capability selections, and discipline selections.
   * This is the main entry point for plan generation.
   */
  createPlan(
    roadmap: Roadmap,
    capabilitySelections: Map<string, CapabilitySelection[]>,
    disciplineSelections: Map<string, DisciplineSelection[]>
  ): ExecutionPlan {
    if (!isEnabled(FeatureFlag.ENABLE_BATCH_GENERATION)) {
      throw new ExecutionPlannerError(
        "Batch generation is disabled. Enable FeatureFlag.ENABLE_BATCH_GENERATION."
      );
    }

    const config = getConfig();
    const planId = `plan-${roadmap.id}-${Date.now()}`;
    const phases: PlanPhase[] = [];
    const batches: ExecutionBatch[] = [];
    const dependencyEdges: DependencyEdge[] = [];

    // Create phases
    for (const phase of roadmap.phases) {
      const phaseId = `phase-${planId}-${phase.order}`;
      const phaseBatches = this.createBatchesForPhase(
        phase,
        phaseId,
        planId,
        capabilitySelections,
        disciplineSelections,
        config
      );
      batches.push(...phaseBatches);

      phases.push({
        id: phaseId,
        roadmapPhaseId: phase.id,
        name: phase.name,
        order: phase.order,
        status: roadmap.phases[0] === phase ? "in_progress" : "planned" as any,
        batches: phaseBatches.map((b) => b.id),
      });
    }

    // Build dependency edges
    for (const dep of roadmap.dependencies) {
      const sourceBatch = batches.find((b) =>
        b.tasks.some((t) => t.capabilityId === dep.sourceId)
      );
      const targetBatch = batches.find((b) =>
        b.tasks.some((t) => t.capabilityId === dep.targetId)
      );
      if (sourceBatch && targetBatch) {
        dependencyEdges.push({
          sourceId: sourceBatch.id,
          targetId: targetBatch.id,
          type: dep.type,
          satisfied: dep.satisfied,
        });
      }
    }

    // Resolve batch-level dependencies
    this.resolveBatchDependencies(batches, roadmap);

    // Build dependency graph
    const nodes = this.buildDependencyNodes(batches, phases);
    const graph: DependencyGraph = {
      nodes,
      edges: dependencyEdges,
      topologicalOrder: this.topologicalSort(batches.map((b) => b.id), dependencyEdges),
      cycles: [],
    };

    // Check for cycles
    graph.cycles = this.findCycles(batches, dependencyEdges);

    // Determine approval requirement
    const approvalRequired = batches.some((b) => b.capabilities.some((c) => {
      // Check if any capability requires approval
      return true; // Simplified — in practice, check against registry
    }));

    const plan: ExecutionPlan = {
      id: planId,
      roadmapId: roadmap.id,
      title: roadmap.title,
      description: roadmap.description,
      phases,
      dependencies: roadmap.dependencies.map((d) => ({
        ...d,
        satisfactionCriteria: `Dependency ${d.type} from ${d.sourceId} to ${d.targetId}`,
      })),
      batches,
      status: PlanStatus.DRAFT,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      totalBatches: batches.length,
      completedBatches: 0,
      failedBatches: 0,
      approvalRequired,
      approvalBriefing: approvalRequired
        ? this.generateApprovalBriefing(planId, roadmap, batches)
        : undefined,
    };

    this.plans.set(planId, plan);
    return plan;
  }

  // ── Batch Generation ───────────────────────────────────────

  private createBatchesForPhase(
    phase: RoadmapPhase,
    phaseId: string,
    planId: string,
    capabilitySelections: Map<string, CapabilitySelection[]>,
    disciplineSelections: Map<string, DisciplineSelection[]>,
    config: ReturnType<typeof getConfig>
  ): ExecutionBatch[] {
    const batches: ExecutionBatch[] = [];
    let batchOrder = 0;

    for (const epic of phase.epics) {
      const caps = capabilitySelections.get(phase.id) || [];
      const discs = disciplineSelections.get(phase.id) || [];

      // Group by discipline for batch organization
      const disciplineGroups = this.groupByDiscipline(caps, discs);

      for (const [discipline, items] of Object.entries(disciplineGroups)) {
        const batchId = `batch-${planId}-${phase.order}-${batchOrder}`;
        const tasks: ExecutionTask[] = [];

        for (const item of items) {
          const taskId = `task-${batchId}-${tasks.length}`;
          tasks.push({
            id: taskId,
            batchId,
            name: `Execute ${item.capabilityId}`,
            description: `Run ${item.capabilityId} for epic "${epic.name}"`,
            type: TaskType.CAPABILITY,
            capabilityId: item.capabilityId,
            discipline: item.discipline,
            input: {
              epicId: epic.id,
              epicName: epic.name,
              phaseId: phase.id,
              phaseName: phase.name,
            },
            expectedOutput: `Completed ${item.capabilityId}`,
            acceptanceCriteria: epic.acceptanceCriteria.length > 0
              ? epic.acceptanceCriteria
              : [`${item.capabilityId} completes successfully`],
            status: TaskStatus.PENDING,
            dependencies: [],
          });
        }

        batches.push({
          id: batchId,
          planId,
          name: `Phase ${phase.order}: ${phase.name} — ${discipline}`,
          description: `Execute ${items.length} capabilities for ${epic.name} via ${discipline}`,
          order: batchOrder++,
          tasks,
          dependencies: [],
          status: BatchStatus.PENDING,
          discipline,
          capabilities: items.map((i) => i.capabilityId),
          tokenBudget: config.tokenBudget.defaultBatchLimit,
          contextBudget: config.contextBudget.batchReservation,
          estimatedDuration: this.estimateBatchDuration(tasks),
          checkpoint: {
            completedTasks: [],
            failedTasks: [],
            skippedTasks: [],
            runningTasks: [],
            progress: 0,
            contextBudgetRemaining: config.contextBudget.batchReservation,
            tokenBudgetRemaining: config.tokenBudget.defaultBatchLimit,
          },
          resumeToken: `resume-${batchId}`,
        });
      }
    }

    return batches;
  }

  private groupByDiscipline(
    caps: CapabilitySelection[],
    discs: DisciplineSelection[]
  ): Record<string, Array<{ capabilityId: string; discipline: string }>> {
    const groups: Record<string, Array<{ capabilityId: string; discipline: string }>> = {};

    // Add capabilities grouped by discipline
    for (const cap of caps) {
      // Find which discipline this capability belongs to
      for (const disc of discs) {
        if (disc.requiredCapabilities.includes(cap.capabilityId)) {
          const key = disc.discipline;
          if (!groups[key]) groups[key] = [];
          groups[key].push({ capabilityId: cap.capabilityId, discipline: key });
          break;
        }
      }
    }

    // If no groupings found, put all capabilities in a default group
    if (Object.keys(groups).length === 0) {
      const defaultDiscipline = discs.length > 0 ? discs[0].discipline : "engineering_quality";
      groups[defaultDiscipline] = caps.map((c) => ({
        capabilityId: c.capabilityId,
        discipline: defaultDiscipline,
      }));
    }

    return groups;
  }

  // ── Dependency Resolution ──────────────────────────────────

  private resolveBatchDependencies(batches: ExecutionBatch[], roadmap: Roadmap): void {
    // Map each batch to its phase/epic context
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];

      // Check roadmap dependencies
      for (const dep of roadmap.dependencies) {
        const sourceBatch = batches.find((b) =>
          b.tasks.some((t) => t.capabilityId === dep.sourceId)
        );
        if (sourceBatch && sourceBatch.id !== batch.id) {
          if (!batch.dependencies.includes(sourceBatch.id)) {
            batch.dependencies.push(sourceBatch.id);
          }
        }
      }

      // Add sequential dependency (previous batch in same phase)
      if (i > 0) {
        const prevBatch = batches[i - 1];
        const samePhase = prevBatch.id.startsWith(batch.id.substring(0, batch.id.lastIndexOf("-") - 1));
        if (samePhase && !batch.dependencies.includes(prevBatch.id)) {
          batch.dependencies.push(prevBatch.id);
        }
      }
    }
  }

  private buildDependencyNodes(
    batches: ExecutionBatch[],
    phases: PlanPhase[]
  ): DependencyNode[] {
    const nodes: DependencyNode[] = [];

    for (const phase of phases) {
      nodes.push({
        id: phase.id,
        type: "phase",
        name: phase.name,
        status: phase.status,
        completed: phase.status === "completed",
      });
    }

    for (const batch of batches) {
      nodes.push({
        id: batch.id,
        type: "batch",
        name: batch.name,
        status: batch.status,
        completed: batch.status === BatchStatus.COMPLETED,
      });
    }

    return nodes;
  }

  private topologicalSort(
    batchIds: string[],
    edges: DependencyEdge[]
  ): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const id of batchIds) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const edge of edges) {
      const deps = adjacency.get(edge.targetId) || [];
      deps.push(edge.sourceId);
      adjacency.set(edge.targetId, deps);
      inDegree.set(edge.sourceId, (inDegree.get(edge.sourceId) || 0) + 1);
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      const neighbors = adjacency.get(node) || [];
      for (const neighbor of neighbors) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return result;
  }

  private findCycles(
    batches: ExecutionBatch[],
    edges: DependencyEdge[]
  ): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const inStack = new Set<string>();

    const dfs = (nodeId: string, path: string[]): void => {
      if (inStack.has(nodeId)) {
        const cycleStart = path.indexOf(nodeId);
        if (cycleStart >= 0) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }
      if (visited.has(nodeId)) return;

      visited.add(nodeId);
      inStack.add(nodeId);
      path.push(nodeId);

      const outgoing = edges.filter((e) => e.sourceId === nodeId);
      for (const edge of outgoing) {
        dfs(edge.targetId, [...path]);
      }

      inStack.delete(nodeId);
    };

    for (const batch of batches) {
      dfs(batch.id, []);
    }

    return cycles;
  }

  // ── Plan Management ────────────────────────────────────────

  getPlan(id: string): ExecutionPlan | undefined {
    return this.plans.get(id);
  }

  listPlans(): ExecutionPlan[] {
    return Array.from(this.plans.values());
  }

  updatePlanStatus(planId: string, status: PlanStatus): void {
    const plan = this.plans.get(planId);
    if (plan) {
      plan.status = status;
      plan.updatedAt = new Date().toISOString();
      if (status === PlanStatus.IN_PROGRESS) {
        plan.startedAt = plan.startedAt || new Date().toISOString();
      }
      if (status === PlanStatus.COMPLETED || status === PlanStatus.FAILED) {
        plan.completedAt = new Date().toISOString();
      }
    }
  }

  updateBatchStatus(planId: string, batchId: string, status: BatchStatus): void {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const batch = plan.batches.find((b) => b.id === batchId);
    if (!batch) return;

    batch.status = status;
    if (status === BatchStatus.RUNNING) {
      batch.startedAt = batch.startedAt || new Date().toISOString();
    }
    if (status === BatchStatus.COMPLETED) {
      batch.completedAt = new Date().toISOString();
      plan.completedBatches++;
    }
    if (status === BatchStatus.FAILED) {
      batch.completedAt = new Date().toISOString();
      plan.failedBatches++;
    }

    plan.updatedAt = new Date().toISOString();

    // Update phase status
    this.updatePhaseStatus(plan);
  }

  updateTaskStatus(
    planId: string,
    batchId: string,
    taskId: string,
    status: TaskStatus
  ): void {
    const plan = this.plans.get(planId);
    if (!plan) return;

    const batch = plan.batches.find((b) => b.id === batchId);
    if (!batch) return;

    const task = batch.tasks.find((t) => t.id === taskId);
    if (!task) return;

    task.status = status;
    if (status === TaskStatus.RUNNING) {
      task.startedAt = new Date().toISOString();
    }
    if (status === TaskStatus.COMPLETED) {
      task.completedAt = new Date().toISOString();
      batch.checkpoint.completedTasks.push(taskId);
    }
    if (status === TaskStatus.FAILED) {
      task.completedAt = new Date().toISOString();
      batch.checkpoint.failedTasks.push(taskId);
    }

    this.updateCheckpoint(batch);
    plan.updatedAt = new Date().toISOString();
  }

  // ── Checkpoint Management ──────────────────────────────────

  getCheckpoint(planId: string, batchId: string): BatchCheckpoint | undefined {
    const plan = this.plans.get(planId);
    if (!plan) return undefined;
    const batch = plan.batches.find((b) => b.id === batchId);
    return batch?.checkpoint;
  }

  saveCheckpoint(planId: string, batchId: string): void {
    const plan = this.plans.get(planId);
    if (!plan) return;
    const batch = plan.batches.find((b) => b.id === batchId);
    if (!batch) return;
    this.updateCheckpoint(batch);
  }

  // ── Private Helpers ────────────────────────────────────────

  private updateCheckpoint(batch: ExecutionBatch): void {
    const completed = batch.tasks.filter((t) => t.status === TaskStatus.COMPLETED).length;
    const failed = batch.tasks.filter((t) => t.status === TaskStatus.FAILED).length;
    const skipped = batch.tasks.filter((t) => t.status === TaskStatus.SKIPPED).length;
    const running = batch.tasks.filter((t) => t.status === TaskStatus.RUNNING).length;
    const total = batch.tasks.length;

    batch.checkpoint = {
      completedTasks: batch.tasks.filter((t) => t.status === TaskStatus.COMPLETED).map((t) => t.id),
      failedTasks: batch.tasks.filter((t) => t.status === TaskStatus.FAILED).map((t) => t.id),
      skippedTasks: batch.tasks.filter((t) => t.status === TaskStatus.SKIPPED).map((t) => t.id),
      runningTasks: batch.tasks.filter((t) => t.status === TaskStatus.RUNNING).map((t) => t.id),
      progress: total > 0 ? (completed + failed) / total : 0,
      contextBudgetRemaining: batch.contextBudget - (completed * 100),
      tokenBudgetRemaining: batch.tokenBudget - (completed * 500),
    };
  }

  private updatePhaseStatus(plan: ExecutionPlan): void {
    for (const phase of plan.phases) {
      const phaseBatches = plan.batches.filter((b) => phase.batches.includes(b.id));
      const allCompleted = phaseBatches.every(
        (b) => b.status === BatchStatus.COMPLETED || b.status === BatchStatus.SKIPPED
      );
      const anyFailed = phaseBatches.some((b) => b.status === BatchStatus.FAILED);
      const anyRunning = phaseBatches.some((b) => b.status === BatchStatus.RUNNING);

      if (allCompleted) {
        phase.status = "completed" as any;
      } else if (anyFailed) {
        phase.status = "blocked" as any;
      } else if (anyRunning) {
        phase.status = "in_progress" as any;
      }
    }
  }

  private estimateBatchDuration(tasks: ExecutionTask[]): string {
    const totalMinutes = tasks.length * 5; // ~5 min per task
    if (totalMinutes >= 60) {
      return `${Math.ceil(totalMinutes / 60)}h`;
    }
    return `${totalMinutes}m`;
  }

  private generateApprovalBriefing(
    planId: string,
    roadmap: Roadmap,
    batches: ExecutionBatch[]
  ): string {
    return [
      `## Approval Briefing: ${roadmap.title}`,
      ``,
      `**Plan ID:** ${planId}`,
      `**Total Batches:** ${batches.length}`,
      `**Phases:** ${roadmap.phases.length}`,
      `**Batches Requiring Approval:** ${batches.filter((b) => b.capabilities.length > 0).length}`,
      ``,
      `This plan requires approval before execution can begin.`,
      `Review the batch list and confirm readiness.`,
    ].join("\n");
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.plans.clear();
    this.batchCounter = 0;
    this.taskCounter = 0;
  }
}