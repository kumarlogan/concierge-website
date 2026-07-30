// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL PlanAtomService                           │
// │ ADR-018 · Capability #14 · Atom Lifecycle Management         │
// │ Creates Plan-Atoms, manages dependency graphs, checkpoints.  │
// └─────────────────────────────────────────────────────────────┘

import type {
  PlanAtom,
  ExecutionBatch,
  PlanCheckpoint,
  DependencyGraph,
} from "../../contracts/planning.js";
import { DisciplineRouter } from "./discipline-router.js";

/**
 * PlanAtomService: Creates and manages Plan-Atom lifecycle.
 *
 * Atoms are the minimum executable work units in EPCL. Every atom is:
 * - Self-contained (one executor can complete it independently)
 * - Discipline-assigned (exactly one workforce discipline)
 * - Dependency-tracked (blockers and dependents listed)
 * - Checkpointable (independently completable and resumable)
 *
 * Design decisions:
 * - Atom creation is always from decomposed work items
 * - Dependency graph is a DAG (directed acyclic graph)
 * - Checkpoints are written before execution (pre-checkpoint)
 * - Resumption reads the last checkpoint, not the full plan
 */
export class PlanAtomService {
  private disciplineRouter: DisciplineRouter;

  constructor() {
    this.disciplineRouter = new DisciplineRouter();
  }

  /**
   * Create a PlanAtom from a work item definition.
   */
  createAtom(
    planId: string,
    item: {
      id: string;
      parent_id?: string;
      atom_type: "epic" | "story" | "task";
      name: string;
      description: string;
      acceptance_criteria?: string[];
      file_refs?: string[];
    },
  ): PlanAtom {
    const discipline = this.disciplineRouter.assign(
      item.name,
      item.description,
    );

    return {
      id: item.id,
      plan_id: planId,
      parent_id: item.parent_id || null,
      atom_type: item.atom_type,
      name: item.name,
      description: item.description,
      discipline: discipline.discipline,
      priority: "p2",
      status: "planned",
      acceptance_criteria: item.acceptance_criteria || [],
      dependencies: [],
      dependents: [],
      estimated_tokens: this.estimateAtomTokens(item),
      batch_id: null,
      checkpoint_data: null,
      version: 1,
    };
  }

  /**
   * Build a dependency graph from a set of atoms.
   * Returns a DAG with topological layers for parallel execution.
   */
  resolveDependencyGraph(atoms: PlanAtom[]): DependencyGraph {
    const nodes = [...atoms];
    const edges = [];
    const nodeMap = new Map(atoms.map((a) => [a.id, a]));

    // Build edges from explicit dependencies
    for (const atom of atoms) {
      for (const depId of atom.dependencies) {
        if (nodeMap.has(depId)) {
          edges.push({
            from_id: depId,
            to_id: atom.id,
            type: "blocks" as const,
          });
        }
      }

      // Parent-child edges (epic → story → task)
      if (atom.parent_id && nodeMap.has(atom.parent_id)) {
        edges.push({
          from_id: atom.parent_id,
          to_id: atom.id,
          type: "related_to" as const,
        });
      }
    }

    // Build topological layers
    const layers = this.buildTopologicalLayers(atoms, edges);

    return { nodes, edges, layers };
  }

  /**
   * Create execution batches from atoms, grouped by dependency layers.
   */
  createBatches(atoms: PlanAtom[], planId: string): ExecutionBatch[] {
    const now = new Date().toISOString();
    const graph = this.resolveDependencyGraph(atoms);
    const batches: ExecutionBatch[] = [];
    let dispatchOrder = 0;

    // Each topological layer becomes a parallel execution stage
    for (const layer of graph.layers) {
      const layerAtoms = layer
        .map((id) => atoms.find((a) => a.id === id))
        .filter((a): a is PlanAtom => a !== undefined);

      // If layer has multiple disciplines, create per-discipline batches
      const disciplines = new Set(layerAtoms.map((a) => a.discipline));
      for (const discipline of disciplines) {
        const disciplineAtoms = layerAtoms.filter(
          (a) => a.discipline === discipline,
        );

        batches.push({
          id: crypto.randomUUID(),
          plan_id: planId,
          discipline,
          status: "pending",
          atom_ids: disciplineAtoms.map((a) => a.id),
          total_atoms: disciplineAtoms.length,
          completed_atoms: 0,
          estimated_tokens: disciplineAtoms.reduce(
            (sum, a) => sum + (a.estimated_tokens || 150),
            0,
          ),
          dispatch_order: dispatchOrder++,
          created_at: now,
          dispatched_at: null,
          completed_at: null,
        });
      }
    }

    return batches;
  }

  /**
   * Record a checkpoint — the last completed atom and the next to execute.
   * Checkpoints are written before each batch dispatch (pre-checkpoint).
   */
  setCheckpoint(
    atoms: PlanAtom[],
    batch: ExecutionBatch,
  ): PlanCheckpoint {
    const completedAtoms = batch.atom_ids.slice(0, batch.completed_atoms);
    const lastCompletedId = completedAtoms[completedAtoms.length - 1] || null;
    const nextAtomId = batch.atom_ids[batch.completed_atoms];

    return {
      id: crypto.randomUUID(),
      plan_id: batch.plan_id,
      batch_id: batch.id,
      last_completed_atom_id: lastCompletedId,
      next_atom_id: nextAtomId || batch.atom_ids[0],
      completed_atom_ids: completedAtoms,
      status: "active",
      token_used: atoms
        .filter((a) => completedAtoms.includes(a.id))
        .reduce((sum, a) => sum + (a.estimated_tokens || 0), 0),
      context_summary: this.buildContextSummary(atoms, batch),
      created_at: new Date().toISOString(),
      superseded_at: null,
    };
  }

  /**
   * Read the last checkpoint for a plan.
   * Returns the active (not superseded) checkpoint, if any.
   */
  getResumePoint(checkpoints: PlanCheckpoint[]): PlanCheckpoint | null {
    return (
      checkpoints
        .filter((c) => c.status === "active")
        .sort(
          (a, b) =>
            new Date(b.created_at).getTime() -
            new Date(a.created_at).getTime(),
        )[0] || null
    );
  }

  /**
   * Advance a batch — mark it complete and return the next batch.
   */
  advanceBatch(
    batchId: string,
    allBatches: ExecutionBatch[],
  ): ExecutionBatch | null {
    const batchIndex = allBatches.findIndex((b) => b.id === batchId);
    if (batchIndex === -1) return null;

    // Return the next batch in dispatch order
    const nextBatch = allBatches
      .filter((b) => b.dispatch_order > allBatches[batchIndex].dispatch_order)
      .sort((a, b) => a.dispatch_order - b.dispatch_order)[0];

    return nextBatch || null;
  }

  /**
   * Check if a plan is complete (all batches finished).
   */
  isPlanComplete(batches: ExecutionBatch[]): boolean {
    return batches.every((b) => b.status === "completed" || b.status === "cancelled");
  }

  // ──── Private Helpers ─────────────────────────────────────

  private estimateAtomTokens(item: {
    atom_type: string;
    name: string;
    description: string;
    acceptance_criteria?: string[];
  }): number {
    const baseTable: Record<string, number> = {
      epic: 500,
      story: 200,
      task: 100,
    };
    return baseTable[item.atom_type] || 150;
  }

  /**
   * Build topological layers from atoms and dependency edges.
   * Layer 0 = no dependencies, Layer N = depends on Layer N-1.
   */
  private buildTopologicalLayers(
    atoms: PlanAtom[],
    edges: Array<{ from_id: string; to_id: string }>,
  ): string[][] {
    const layers: string[][] = [];
    const remaining = new Set(atoms.map((a) => a.id));
    const depsOf = new Map<string, Set<string>>();

    // Build dependency map
    for (const atom of atoms) {
      const deps = new Set(
        edges
          .filter((e) => e.to_id === atom.id)
          .map((e) => e.from_id)
          .filter((d) => remaining.has(d)),
      );
      depsOf.set(atom.id, deps);
    }

    while (remaining.size > 0) {
      const layer: string[] = [];

      for (const id of remaining) {
        const deps = depsOf.get(id);
        if (!deps || deps.size === 0) {
          layer.push(id);
        }
      }

      if (layer.length === 0) break; // Circular dependency

      layers.push(layer);
      for (const id of layer) {
        remaining.delete(id);
        // Remove this node from dependency sets
        for (const [, deps] of depsOf) {
          deps.delete(id);
        }
      }
    }

    return layers;
  }

  private buildContextSummary(atoms: PlanAtom[], batch: ExecutionBatch): string {
    const discipline = batch.discipline;
    const total = batch.total_atoms;
    const completed = batch.completed_atoms;
    const lastCompleted = batch.completed_atoms > 0
      ? atoms.find((a) => a.id === batch.atom_ids[batch.completed_atoms - 1])?.name
      : null;

    return `Batch ${batch.dispatch_order + 1}: ${discipline} [${completed}/${total}]
${lastCompleted ? `Last completed: ${lastCompleted}` : "No atoms completed yet"}`;
  }
}