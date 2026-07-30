// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL PlanningEngine                            │
// │ ADR-018 · Capability #14 · Decomposition & Prioritization    │
// │ Decomposes roadmap objectives into epics, stories, tasks.    │
// └─────────────────────────────────────────────────────────────┘

import type {
  Plan,
  PlanAtom,
  PlanStatus,
  PlanDepth,
  EpicDef,
  StoryDef,
  TaskDef,
  DependencyMap,
  DependencyEdge,
  ContextBudget,
  ExecutionBatch,
} from "../../contracts/planning.js";
import { DisciplineRouter } from "./discipline-router.js";
import { ContextBudgetManager } from "./context-budget-manager.js";

export interface DecompositionInput {
  objective: string;
  epics: EpicDef[];
  depth: PlanDepth;
  budget: ContextBudget;
}

export interface DecompositionResult {
  epics: EpicDef[];
  stories: StoryDef[];
  tasks: TaskDef[];
  depth_reached: PlanDepth;
  truncated: boolean;
}

export interface PriorityMap {
  items: Array<{ id: string; priority: string }>;
}

/**
 * PlanningEngine: Decomposes roadmap objectives into structured
 * work items with dependency resolution and prioritization.
 *
 * This is the core planning intelligence — it takes a high-level
 * roadmap objective and produces a complete, ordered, executable plan.
 *
 * Design decisions:
 * - Deterministic decomposition based on structured input
 * - Dependency resolution produces a DAG of work items
 * - Critical path analysis for scheduling
 * - Integration with ContextBudgetManager to prevent overflow
 */
export class PlanningEngine {
  private disciplineRouter: DisciplineRouter;
  private budgetManager: ContextBudgetManager;

  constructor() {
    this.disciplineRouter = new DisciplineRouter();
    this.budgetManager = new ContextBudgetManager();
  }

  /**
   * Decompose a roadmap objective into epics, stories, and tasks.
   * Depth controls how far to decompose (phases_only → full).
   */
  decompose(input: DecompositionInput): DecompositionResult {
    const { objective, epics, depth } = input;

    // Decompose based on depth
    let stories: StoryDef[] = [];
    let tasks: TaskDef[] = [];

    if (depth === "phases_only" || depth === "waves_only") {
      // Stop at epic level — no further decomposition
      return {
        epics,
        stories: [],
        tasks: [],
        depth_reached: depth,
        truncated: false,
      };
    }

    // Decompose each epic into stories
    for (const epic of epics) {
      const epicStories = this.decomposeEpic(epic);
      stories.push(...epicStories);
    }

    if (depth === "epics_only") {
      return {
        epics,
        stories,
        tasks: [],
        depth_reached: depth,
        truncated: false,
      };
    }

    // Decompose each story into tasks
    for (const story of stories) {
      const storyTasks = this.decomposeStory(story);
      tasks.push(...storyTasks);
    }

    // Check if we exceed budget and need to truncate
    const totalItems = epics.length + stories.length + tasks.length;
    const truncated = this.shouldTruncate(totalItems, input.budget);

    return {
      epics,
      stories,
      tasks,
      depth_reached: "full",
      truncated,
    };
  }

  /**
   * Resolve dependencies between work items.
   * Returns a dependency map with topological ordering.
   */
  resolveDeps(items: Array<EpicDef | StoryDef | TaskDef>): DependencyMap {
    const edges: DependencyEdge[] = [];
    const graph: Record<string, string[]> = {};
    const ids = new Set(items.map((i) => i.id));

    // Build dependency graph based on item relationships
    for (const item of items) {
      // Epics depend on infrastructure/architecture first
      if ("wave_id" in item) {
        const relatedEpics = items.filter(
          (i) => "wave_id" in i && i.id !== item.id && i.id < item.id,
        );
        // In v1.0, dependency inference is explicit
        // Dependencies are declared in the input, not inferred
      }

      // Track dependents
      graph[item.id] = graph[item.id] || [];
    }

    // Topological sort (Kahn's algorithm)
    const topoOrder = this.topoSort(edges, ids);

    // Determine critical path (longest dependency chain)
    const criticalPath = this.findCriticalPath(edges, ids);

    return { edges, graph, topo_order: topoOrder, critical_path: criticalPath };
  }

  /**
   * Assign priority to work items based on critical path and dependencies.
   */
  prioritize(items: Array<EpicDef | StoryDef | TaskDef>, deps: DependencyMap): PriorityMap {
    const priorityMap: Record<string, string> = {};

    // Items on the critical path get P0
    for (const id of deps.critical_path) {
      priorityMap[id] = "p0";
    }

    // Items that block many others get P1
    for (const [id, dependents] of Object.entries(deps.graph)) {
      if (!priorityMap[id] && dependents.length > 2) {
        priorityMap[id] = "p1";
      }
    }

    // Remaining items get P2
    for (const item of items) {
      if (!priorityMap[item.id]) {
        priorityMap[item.id] = "p2";
      }
    }

    return {
      items: items.map((i) => ({ id: i.id, priority: priorityMap[i.id] || "p2" })),
    };
  }

  /**
   * Create a versioned plan from decomposed items.
   */
  createPlan(
    input: DecompositionInput,
    result: DecompositionResult,
    depMap: DependencyMap,
    priorities: PriorityMap,
  ): Plan {
    const planId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Create atoms from decomposed items
    const atoms: PlanAtom[] = [];
    const priorityLookup = new Map(priorities.items.map((i) => [i.id, i.priority]));

    for (const epic of result.epics) {
      atoms.push(this.createAtomFromEpic(planId, epic, depMap, priorityLookup));
    }
    for (const story of result.stories) {
      atoms.push(this.createAtomFromStory(planId, story, depMap, priorityLookup));
    }
    for (const task of result.tasks) {
      atoms.push(this.createAtomFromTask(planId, task, depMap, priorityLookup));
    }

    // Create execution batches via discipline router
    const batches = this.disciplineRouter.createBatches(atoms);

    return {
      id: planId,
      product_id: "concierge",
      version: 1,
      objective: input.objective,
      status: "draft",
      depth: input.depth,
      atoms,
      batches,
      checkpoints: [],
      budget: input.budget,
      total_tokens_estimated: input.budget.total_estimated_tokens,
      created_at: timestamp,
      created_by: "epcl:planner",
    };
  }

  /**
   * Decompose an epic into stories.
   * In v1.0, this is a structured placeholder — decomposition
   * details come from the Hermes skill's NL understanding.
   */
  private decomposeEpic(epic: EpicDef): StoryDef[] {
    const stories: StoryDef[] = [];

    for (let i = 0; i < Math.max(1, epic.estimated_stories || 1); i++) {
      const id = `${epic.id}-S${i + 1}`;
      stories.push({
        id,
        epic_id: epic.id,
        name: `${epic.name} — Story ${i + 1}`,
        description: `Story ${i + 1} for epic ${epic.name}`,
        discipline: "backend",
        acceptance_criteria: [],
        estimated_tasks: 2,
      });
    }

    return stories;
  }

  /**
   * Decompose a story into tasks.
   */
  private decomposeStory(story: StoryDef): TaskDef[] {
    const tasks: TaskDef[] = [];

    for (let i = 0; i < Math.max(1, story.estimated_tasks || 1); i++) {
      const id = `${story.id}-T${i + 1}`;
      tasks.push({
        id,
        story_id: story.id,
        name: `${story.name} — Task ${i + 1}`,
        description: `Task ${i + 1} for story ${story.name}`,
        discipline: story.discipline,
        file_refs: [],
        acceptance_criteria: [],
      });
    }

    return tasks;
  }

  /**
   * Create a PlanAtom from an EpicDef.
   */
  private createAtomFromEpic(
    planId: string,
    epic: EpicDef,
    depMap: DependencyMap,
    priorities: Map<string, string>,
  ): PlanAtom {
    const epicDeps = depMap.edges
      .filter((e) => e.from_id === epic.id)
      .map((e) => e.to_id);

    return {
      id: epic.id,
      plan_id: planId,
      parent_id: null,
      atom_type: "epic",
      name: epic.name,
      description: epic.description,
      discipline: "architecture",
      priority: (priorities.get(epic.id) as PlanAtom["priority"]) || "p2",
      status: "planned",
      acceptance_criteria: [],
      dependencies: epicDeps,
      dependents: depMap.graph[epic.id] || [],
      estimated_tokens: 500,
      batch_id: null,
      checkpoint_data: null,
      version: 1,
    };
  }

  /**
   * Create a PlanAtom from a StoryDef.
   */
  private createAtomFromStory(
    planId: string,
    story: StoryDef,
    depMap: DependencyMap,
    priorities: Map<string, string>,
  ): PlanAtom {
    const storyDeps = depMap.edges
      .filter((e) => e.from_id === story.id)
      .map((e) => e.to_id);

    return {
      id: story.id,
      plan_id: planId,
      parent_id: story.epic_id,
      atom_type: "story",
      name: story.name,
      description: story.description,
      discipline: story.discipline,
      priority: (priorities.get(story.id) as PlanAtom["priority"]) || "p2",
      status: "planned",
      acceptance_criteria: story.acceptance_criteria,
      dependencies: storyDeps,
      dependents: depMap.graph[story.id] || [],
      estimated_tokens: 300,
      batch_id: null,
      checkpoint_data: null,
      version: 1,
    };
  }

  /**
   * Create a PlanAtom from a TaskDef.
   */
  private createAtomFromTask(
    planId: string,
    task: TaskDef,
    depMap: DependencyMap,
    priorities: Map<string, string>,
  ): PlanAtom {
    const taskDeps = depMap.edges
      .filter((e) => e.from_id === task.id)
      .map((e) => e.to_id);

    return {
      id: task.id,
      plan_id: planId,
      parent_id: task.story_id,
      atom_type: "task",
      name: task.name,
      description: task.description,
      discipline: task.discipline,
      priority: (priorities.get(task.id) as PlanAtom["priority"]) || "p2",
      status: "planned",
      acceptance_criteria: task.acceptance_criteria,
      dependencies: taskDeps,
      dependents: depMap.graph[task.id] || [],
      estimated_tokens: 150,
      batch_id: null,
      checkpoint_data: null,
      version: 1,
    };
  }

  /**
   * Topological sort using Kahn's algorithm.
   */
  private topoSort(edges: DependencyEdge[], ids: Set<string>): string[] {
    const inDegree = new Map<string, number>();
    const adjacency = new Map<string, string[]>();

    for (const id of ids) {
      inDegree.set(id, 0);
      adjacency.set(id, []);
    }

    for (const edge of edges) {
      if (edge.type === "blocks") {
        adjacency.get(edge.from_id)?.push(edge.to_id);
        inDegree.set(edge.to_id, (inDegree.get(edge.to_id) || 0) + 1);
      }
    }

    const queue: string[] = [];
    for (const [id, degree] of inDegree) {
      if (degree === 0) queue.push(id);
    }

    const result: string[] = [];
    while (queue.length > 0) {
      const node = queue.shift()!;
      result.push(node);
      for (const neighbor of adjacency.get(node) || []) {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        if (newDegree === 0) queue.push(neighbor);
      }
    }

    return result;
  }

  /**
   * Find the critical path (longest dependency chain).
   */
  private findCriticalPath(edges: DependencyEdge[], ids: Set<string>): string[] {
    // In v1.0, return topological order as critical path approximation
    return this.topoSort(edges, ids);
  }

  /**
   * Determine if decomposition should be truncated based on budget.
   */
  private shouldTruncate(itemCount: number, budget: ContextBudget): boolean {
    if (!budget.fits_in_window) return true;
    // Rough heuristic: each item takes ~200 tokens
    return itemCount * 200 > budget.remaining_tokens;
  }
}