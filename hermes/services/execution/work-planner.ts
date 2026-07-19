// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Work Planner                       │
// │ EPIC-003-001 · DELIVERABLE 1                                   │
// │ Converts a goal into an executable, dependency-ordered work    │
// │ plan. Produces tasks with explicit dependencies and priorities.│
// │ SAFETY: pure planning — never executes, never touches providers│
// │ or agents. Honors the identity → authorization → planning chain│
// │ (planning is the third stage, after identity + authorization). │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";

/** A single unit of work inside a plan. */
export interface WorkItem {
  /** Stable, plan-unique id (not a task id yet — that is created at dispatch). */
  id: string;
  /** Human-readable title. */
  title: string;
  /** The capability namespace this work requires (e.g. "dev.code.generate"). */
  capability: string;
  /** Domain the work belongs to (maps to a workforce role). Defaults to "development". */
  domain?: "development" | "quality" | "security" | "docs" | "research" | "ops";
  /** Work items that MUST complete before this one starts. Defaults to []. */
  dependsOn?: string[];
  /** 1 (low) … 5 (critical). Used for tie-breaking in topological order. */
  priority: number;
  /** Whether the item can run in parallel with siblings (no data dependency on them). Defaults to false. */
  parallelizable?: boolean;
  /** Arbitrary plan-level metadata (e.g. prompt, target file). */
  context?: Record<string, unknown>;
}

/** A goal presented to the planner. */
export interface GoalSpec {
  /** Stable goal id supplied by the caller (used for audit correlation). */
  goalId: string;
  /** Human-readable objective. */
  title: string;
  /** The application the work targets. */
  applicationId: string;
  /** Principal requesting the plan (must be authorized upstream). */
  requestedBy: string;
  /** Candidate work items. The planner orders them; it does not invent new ones. */
  items: WorkItem[];
}

/** The planner output: a topologically-ordered, priority-tie-broken plan. */
export interface WorkPlan {
  goalId: string;
  applicationId: string;
  requestedBy: string;
  createdAt: string;
  /** Items in execution order (dependencies always precede dependents). */
  ordered: WorkItem[];
  /** Items grouped by execution wave (wave N runs only after wave N-1 completes). */
  waves: WorkItem[][];
  /** Items that can run in parallel within their wave. */
  estimatedParallelism: number;
}

export class WorkPlannerError extends Error {}

/**
 * Topologically sort work items honoring dependencies, then break ties by
 * priority (higher first) and stable id order. Detects dependency cycles.
 */
export function planWork(spec: GoalSpec): WorkPlan {
  const byId = new Map<string, WorkItem>();
  for (const it of spec.items) {
    if (byId.has(it.id)) {
      throw new WorkPlannerError(`Duplicate work item id: ${it.id}`);
    }
    byId.set(it.id, it);
  }

  // Validate dependency references.
  for (const it of spec.items) {
    for (const dep of it.dependsOn ?? []) {
      if (!byId.has(dep)) {
        throw new WorkPlannerError(
          `Work item ${it.id} depends on unknown item ${dep}`,
        );
      }
    }
  }

  const ordered = topoSort(byId);
  const waves = buildWaves(ordered, byId);
  const estimatedParallelism = waves.reduce(
    (max, wave) =>
      Math.max(max, wave.filter((i) => i.parallelizable).length || 1),
    1,
  );

  const plan: WorkPlan = {
    goalId: spec.goalId,
    applicationId: spec.applicationId,
    requestedBy: spec.requestedBy,
    createdAt: new Date().toISOString(),
    ordered,
    waves,
    estimatedParallelism,
  };

  emitAudit("execution.plan.created", spec.requestedBy, {
    goalId: spec.goalId,
    applicationId: spec.applicationId,
    items: ordered.length,
    waves: waves.length,
  });

  return plan;
}

/** Kahn topological sort with priority tie-breaking. */
function topoSort(byId: Map<string, WorkItem>): WorkItem[] {
  const deps = (it: WorkItem) => it.dependsOn ?? [];
  const indegree = new Map<string, number>();
  for (const [id, it] of byId) {
    indegree.set(id, deps(it).length);
  }

  const ready = [...byId.values()]
    .filter((it) => deps(it).length === 0)
    .sort(prioritySort);

  const result: WorkItem[] = [];
  const done = new Set<string>();

  while (ready.length > 0) {
    // Pick highest-priority ready item (stable by id on tie).
    ready.sort(prioritySort);
    const cur = ready.shift()!;
    result.push(cur);
    done.add(cur.id);

    // Release dependents whose deps are now satisfied.
    for (const [id, it] of byId) {
      if (done.has(id)) continue;
      if (deps(it).every((d) => done.has(d)) && !result.includes(it) && !ready.includes(it)) {
        indegree.set(id, 0);
        ready.push(it);
      }
    }
  }

  if (result.length !== byId.size) {
    const stuck = [...byId.keys()].filter((id) => !done.has(id));
    throw new WorkPlannerError(
      `Dependency cycle detected among items: ${stuck.join(", ")}`,
    );
  }

  return result;
}

/** Group ordered items into execution waves (a wave = items whose deps are all done). */
function buildWaves(ordered: WorkItem[], byId: Map<string, WorkItem>): WorkItem[][] {
  const waves: WorkItem[][] = [];
  const completed = new Set<string>();

  for (const it of ordered) {
    const waveIdx = waves.length;
    // Place item into the earliest wave where all deps are completed.
    let target = 0;
    for (const dep of it.dependsOn ?? []) {
      const depIdx = ordered.findIndex((o) => o.id === dep);
      target = Math.max(target, depIdx + 1);
    }
    // Ensure waves up to target exist.
    while (waves.length <= target) waves.push([]);
    waves[target].push(it);
    completed.add(it.id);
  }

  return waves.filter((w) => w.length > 0);
}

function prioritySort(a: WorkItem, b: WorkItem): number {
  if (b.priority !== a.priority) return b.priority - a.priority;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Test/reset helper — no-op placeholder for parity with other modules. */
export function _clearPlans(): void {
  // The planner is stateless (pure function over input). Nothing to clear.
}
