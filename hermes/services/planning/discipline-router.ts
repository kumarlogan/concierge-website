// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL DisciplineRouter                          │
// │ ADR-018 · Capability #14 · Work-to-Discipline Routing        │
// │ Maps work items to workforce disciplines deterministically.  │
// └─────────────────────────────────────────────────────────────┘

import type {
  Discipline,
  PlanAtom,
  ExecutionBatch,
  DisciplineAssignment,
  ParallelWorkstream,
} from "../../contracts/planning.js";

// ──── Discipline Routing Rules ───────────────────────────────

interface RoutingRule {
  pattern: string;
  discipline: Discipline;
  priority: number; // Higher = more specific, wins ties
}

/**
 * DisciplineRouter: Routes work items to workforce disciplines
 * and creates discipline-scoped execution batches.
 *
 * Each work item is assigned to exactly one discipline.
 * No cross-discipline ambiguity — atoms are the atomic unit.
 * Multi-discipline work (e.g. API + UI + test) produces multiple atoms.
 *
 * Design decisions:
 * - Rule-based routing (deterministic)
 * - Priority matching for fine-grained control
 * - Map+Reduce pattern: assign → group → batch
 */
export class DisciplineRouter {
  private rules: RoutingRule[] = [
    // Architecture (highest priority)
    { pattern: "architecture", discipline: "architecture", priority: 10 },
    { pattern: "adr", discipline: "architecture", priority: 10 },
    { pattern: "design doc", discipline: "architecture", priority: 10 },
    { pattern: "system design", discipline: "architecture", priority: 10 },
    { pattern: "review", discipline: "architecture", priority: 8 },

    // Frontend
    { pattern: "ui", discipline: "frontend", priority: 9 },
    { pattern: "component", discipline: "frontend", priority: 9 },
    { pattern: "page", discipline: "frontend", priority: 9 },
    { pattern: "form", discipline: "frontend", priority: 9 },
    { pattern: "frontend", discipline: "frontend", priority: 8 },
    { pattern: "react", discipline: "frontend", priority: 8 },
    { pattern: "css", discipline: "frontend", priority: 7 },
    { pattern: "layout", discipline: "frontend", priority: 7 },

    // Backend
    { pattern: "api", discipline: "backend", priority: 9 },
    { pattern: "route", discipline: "backend", priority: 9 },
    { pattern: "service", discipline: "backend", priority: 9 },
    { pattern: "data model", discipline: "backend", priority: 9 },
    { pattern: "migration", discipline: "backend", priority: 9 },
    { pattern: "backend", discipline: "backend", priority: 8 },
    { pattern: "database", discipline: "backend", priority: 8 },
    { pattern: "d1", discipline: "backend", priority: 8 },
    { pattern: "sql", discipline: "backend", priority: 7 },

    // DevOps
    { pattern: "ci/cd", discipline: "devops", priority: 10 },
    { pattern: "deploy", discipline: "devops", priority: 9 },
    { pattern: "infrastructure", discipline: "devops", priority: 9 },
    { pattern: "cloudflare", discipline: "devops", priority: 8 },
    { pattern: "wrangler", discipline: "devops", priority: 8 },
    { pattern: "devops", discipline: "devops", priority: 8 },

    // Security
    { pattern: "security", discipline: "security", priority: 10 },
    { pattern: "threat model", discipline: "security", priority: 10 },
    { pattern: "compliance", discipline: "security", priority: 9 },
    { pattern: "audit", discipline: "security", priority: 9 },
    { pattern: "secret", discipline: "security", priority: 8 },
    { pattern: "trust", discipline: "security", priority: 8 },

    // Testing
    { pattern: "test", discipline: "testing", priority: 9 },
    { pattern: "unit test", discipline: "testing", priority: 9 },
    { pattern: "integration test", discipline: "testing", priority: 9 },
    { pattern: "e2e", discipline: "testing", priority: 8 },
    { pattern: "qa", discipline: "testing", priority: 8 },
    { pattern: "coverage", discipline: "testing", priority: 7 },

    // Documentation
    { pattern: "documentation", discipline: "documentation", priority: 9 },
    { pattern: "readme", discipline: "documentation", priority: 8 },
    { pattern: "runbook", discipline: "documentation", priority: 8 },
    { pattern: "doc", discipline: "documentation", priority: 8 },
    { pattern: "governance", discipline: "documentation", priority: 8 },
    { pattern: "architecture doc", discipline: "documentation", priority: 8 },
  ];

  /**
   * Assign a work item to a discipline deterministically.
   */
  assign(name: string, description: string): DisciplineAssignment {
    const combined = `${name} ${description}`.toLowerCase();
    let bestMatch: RoutingRule | null = null;

    for (const rule of this.rules) {
      if (combined.includes(rule.pattern.toLowerCase())) {
        if (!bestMatch || rule.priority > bestMatch.priority) {
          bestMatch = rule;
        }
      }
    }

    if (bestMatch) {
      return {
        atom_id: "",
        discipline: bestMatch.discipline,
        confidence: 0.8 + (bestMatch.priority / 10) * 0.2,
        reasoning: `Matched pattern "${bestMatch.pattern}" (priority ${bestMatch.priority})`,
      };
    }

    // Default fallback
    return {
      atom_id: "",
      discipline: "backend",
      confidence: 0.5,
      reasoning: "No matching pattern — defaulted to backend",
    };
  }

  /**
   * Assign discipline to all atoms in a plan.
   */
  assignAll(atoms: PlanAtom[]): DisciplineAssignment[] {
    return atoms.map((atom) => {
      const assignment = this.assign(atom.name, atom.description);
      assignment.atom_id = atom.id;
      return assignment;
    });
  }

  /**
   * Create execution batches from atoms, grouped by discipline.
   * Returns ordered batches respecting dependency constraints.
   */
  createBatches(atoms: PlanAtom[]): ExecutionBatch[] {
    const now = new Date().toISOString();
    const disciplineGroups = this.groupByDiscipline(atoms);

    const batches: ExecutionBatch[] = [];
    let dispatchOrder = 0;

    // Determine dispatch order: architecture first, then parallel
    const disciplinePriority: Discipline[] = [
      "architecture",
      "backend",
      "frontend",
      "devops",
      "security",
      "testing",
      "documentation",
    ];

    for (const discipline of disciplinePriority) {
      const groupAtoms = disciplineGroups.get(discipline) || [];
      if (groupAtoms.length === 0) continue;

      // Resolve dependency ordering within the batch
      const orderedAtoms = this.orderAtomsByDependencies(groupAtoms);

      batches.push({
        id: crypto.randomUUID(),
        plan_id: "",
        discipline,
        status: "pending",
        atom_ids: orderedAtoms.map((a) => a.id),
        total_atoms: orderedAtoms.length,
        completed_atoms: 0,
        estimated_tokens: orderedAtoms.reduce(
          (sum, a) => sum + (a.estimated_tokens || 150),
          0,
        ),
        dispatch_order: dispatchOrder++,
        created_at: now,
        dispatched_at: null,
        completed_at: null,
      });
    }

    return batches;
  }

  /**
   * Merge compatible batches (same discipline, adjacent dispatch order).
   */
  mergeBatches(batches: ExecutionBatch[]): ExecutionBatch[] {
    const merged: ExecutionBatch[] = [];
    const now = new Date().toISOString();

    const byDiscipline = this.groupByDisciplineBatches(batches);

    for (const [, batchGroup] of byDiscipline) {
      if (batchGroup.length === 1) {
        merged.push(batchGroup[0]);
        continue;
      }

      // Merge adjacent same-discipline batches
      const mergedAtomIds = batchGroup.flatMap((b) => b.atom_ids);
      merged.push({
        id: crypto.randomUUID(),
        plan_id: batchGroup[0].plan_id,
        discipline: batchGroup[0].discipline,
        status: "pending",
        atom_ids: mergedAtomIds,
        total_atoms: mergedAtomIds.length,
        completed_atoms: 0,
        estimated_tokens: batchGroup.reduce(
          (sum, b) => sum + b.estimated_tokens,
          0,
        ),
        dispatch_order: batchGroup[0].dispatch_order,
        created_at: now,
        dispatched_at: null,
        completed_at: null,
      });
    }

    return merged;
  }

  /**
   * Identify parallelizable workstreams by discipline.
   */
  parallelize(atoms: PlanAtom[]): ParallelWorkstream[] {
    const disciplineGroups = this.groupByDiscipline(atoms);
    const workstreams: ParallelWorkstream[] = [];

    for (const [discipline, groupAtoms] of disciplineGroups) {
      workstreams.push({
        discipline: discipline as Discipline,
        atoms: groupAtoms,
        estimated_tokens: groupAtoms.reduce(
          (sum, a) => sum + (a.estimated_tokens || 150),
          0,
        ),
      });
    }

    return workstreams;
  }

  // ──── Private Helpers ─────────────────────────────────────

  private groupByDiscipline(atoms: PlanAtom[]): Map<string, PlanAtom[]> {
    const groups = new Map<string, PlanAtom[]>();
    const assignments = this.assignAll(atoms);
    const assignmentMap = new Map(assignments.map((a) => [a.atom_id, a.discipline]));

    for (const atom of atoms) {
      const discipline = assignmentMap.get(atom.id) || "backend";
      if (!groups.has(discipline)) groups.set(discipline, []);
      groups.get(discipline)!.push(atom);
    }

    return groups;
  }

  private groupByDisciplineBatches(
    batches: ExecutionBatch[],
  ): Map<string, ExecutionBatch[]> {
    const groups = new Map<string, ExecutionBatch[]>();
    for (const batch of batches) {
      if (!groups.has(batch.discipline)) groups.set(batch.discipline, []);
      groups.get(batch.discipline)!.push(batch);
    }
    return groups;
  }

  private orderAtomsByDependencies(atoms: PlanAtom[]): PlanAtom[] {
    // Simple topological ordering: atoms without deps first
    const depCount = new Map<string, number>();
    const ordered: PlanAtom[] = [];
    const atomMap = new Map(atoms.map((a) => [a.id, a]));
    const remaining = new Set(atoms.map((a) => a.id));

    for (const atom of atoms) {
      const deps = atom.dependencies.filter((d) => remaining.has(d));
      depCount.set(atom.id, deps.length);
    }

    while (remaining.size > 0) {
      let found = false;
      for (const id of remaining) {
        if ((depCount.get(id) || 0) === 0) {
          const atom = atomMap.get(id)!;
          ordered.push(atom);
          remaining.delete(id);
          // Update dependents
          for (const dependentId of atom.dependents) {
            if (remaining.has(dependentId)) {
              depCount.set(dependentId, (depCount.get(dependentId) || 1) - 1);
            }
          }
          found = true;
          break;
        }
      }
      if (!found) break; // Circular dependency
    }

    return ordered;
  }
}