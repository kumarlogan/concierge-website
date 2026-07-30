// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL ExecutiveDashboard                       │
// │ ADR-018 · Capability #14 · Status Reporting                 │
// │ Provides structured status reports for human operators.     │
// └─────────────────────────────────────────────────────────────┘

import type {
  Plan,
  PlanAtom,
  ExecutionBatch,
  PlanCheckpoint,
  PlanSummary,
  BatchStatusReport as BatchStatus,
  DisciplineReport,
  BlockerReport,
  BlockerItem,
  TokenReport,
  OperatorBriefing,
  Discipline,
} from "../../contracts/planning.js";

/**
 * ExecutiveDashboard: Provides structured status reports for
 * human operators.
 *
 * All reports are deterministic — computed from plan state,
 * never inferred by LLM.
 *
 * Design decisions:
 * - Every metric is derived from the data model
 * - Reports are JSON-serializable for easy embedding
 * - Briefing format is optimized for human reading
 * - All reports include governance header metadata
 */
export class ExecutiveDashboard {
  /**
   * High-level plan summary for operator review.
   */
  planSummary(plan: Plan): PlanSummary {
    const totalAtoms = plan.atoms.length;
    const completedAtoms = plan.atoms.filter(
      (a) => a.status === "completed",
    ).length;
    const blockedAtoms = plan.atoms.filter(
      (a) => a.status === "blocked",
    ).length;
    const disciplines = new Set(plan.atoms.map((a) => a.discipline));
    const activeDisciplines = new Set(
      plan.atoms
        .filter((a) => a.status === "in_progress")
        .map((a) => a.discipline),
    );

    return {
      plan_id: plan.id,
      version: plan.version,
      status: plan.status,
      objective: plan.objective,
      total_atoms: totalAtoms,
      completed_atoms: completedAtoms,
      blocked_atoms: blockedAtoms,
      total_disciplines: disciplines.size,
      active_disciplines: activeDisciplines.size,
      total_batches: plan.batches.length,
      active_batches: plan.batches.filter(
        (b) => b.status === "executing" || b.status === "dispatched",
      ).length,
      completed_batches: plan.batches.filter(
        (b) => b.status === "completed",
      ).length,
      estimated_tokens_total: plan.total_tokens_estimated,
      estimated_tokens_remaining: this.calculateRemainingTokens(plan),
      progress_pct:
        totalAtoms > 0
          ? Math.round((completedAtoms / totalAtoms) * 100)
          : 0,
    };
  }

  /**
   * Status of a single execution batch.
   */
  batchStatus(batch: ExecutionBatch, atoms: PlanAtom[]): BatchStatus {
    const batchAtoms = batch.atom_ids
      .map((id) => atoms.find((a) => a.id === id))
      .filter((a): a is PlanAtom => a !== undefined);

    const completedAtoms = batchAtoms.filter(
      (a) => a.status === "completed",
    ).length;
    const blockedAtoms = batchAtoms.filter(
      (a) => a.status === "blocked",
    ).length;

    return {
      batch_id: batch.id,
      plan_id: batch.plan_id,
      discipline: batch.discipline,
      status: batch.status,
      total_atoms: batch.total_atoms,
      completed_atoms: completedAtoms,
      blocked_atoms: blockedAtoms,
      estimated_tokens: batch.estimated_tokens,
      completed_atom_ids: batchAtoms
        .filter((a) => a.status === "completed")
        .map((a) => a.id),
      next_atom_id: batchAtoms.find((a) => a.status === "planned")?.id || null,
    };
  }

  /**
   * Per-discipline work status report.
   */
  disciplineReport(plan: Plan, discipline: Discipline): DisciplineReport {
    const disciplineAtoms = plan.atoms.filter(
      (a) => a.discipline === discipline,
    );

    return {
      discipline,
      total_atoms: disciplineAtoms.length,
      completed_atoms: disciplineAtoms.filter(
        (a) => a.status === "completed",
      ).length,
      in_progress_atoms: disciplineAtoms.filter(
        (a) => a.status === "in_progress",
      ).length,
      blocked_atoms: disciplineAtoms.filter(
        (a) => a.status === "blocked",
      ).length,
      estimated_tokens: disciplineAtoms.reduce(
        (sum, a) => sum + (a.estimated_tokens || 0),
        0,
      ),
      atoms: disciplineAtoms,
    };
  }

  /**
   * Compressed token consumption report.
   */
  tokenReport(plan: Plan): TokenReport {
    const usedTokens = plan.checkpoints.reduce(
      (sum, c) => sum + c.token_used,
      0,
    );
    const totalEstimated = plan.total_tokens_estimated;
    const overBudget = usedTokens > totalEstimated;

    const byDiscipline = {} as Record<Discipline, number>;
    for (const atom of plan.atoms) {
      byDiscipline[atom.discipline] =
        (byDiscipline[atom.discipline] || 0) +
        (atom.estimated_tokens || 0);
    }

    return {
      total_estimated: totalEstimated,
      total_used: usedTokens,
      total_remaining: Math.max(0, totalEstimated - usedTokens),
      budget_limit: totalEstimated,
      over_budget: overBudget,
      overage_pct: overBudget
        ? Math.round(((usedTokens - totalEstimated) / totalEstimated) * 100)
        : 0,
      by_discipline: byDiscipline,
    };
  }

  /**
   * Active blockers and risks report.
   */
  blockerReport(plan: Plan): BlockerReport {
    const blockedAtoms = plan.atoms.filter(
      (a) => a.status === "blocked",
    );

    const blockers: BlockerItem[] = blockedAtoms.map((atom) => {
      // Infer blocker type from dependencies
      const blockerType =
        atom.dependencies.length > 0
          ? `Blocked by: ${atom.dependencies.join(", ")}`
          : "Unknown blocker";

      return {
        atom_id: atom.id,
        atom_name: atom.name,
        discipline: atom.discipline,
        blocker_type: blockerType,
        description: atom.description,
      };
    });

    return {
      total_blockers: blockers.length,
      blockers,
    };
  }

  /**
   * Compressed operator briefing — the primary interface
   * for human operators to understand plan status at a glance.
   */
  operatorBriefing(plan: Plan): OperatorBriefing {
    const summary = this.planSummary(plan);
    const activeBatch = plan.batches.find(
      (b) => b.status === "executing" || b.status === "dispatched",
    );
    const activeDisciplines = [
      ...new Set(
        plan.atoms
          .filter((a) => a.status === "in_progress")
          .map((a) => a.discipline),
      ),
    ];

    const decisionsNeeded: string[] = [];
    if (plan.status === "draft") {
      decisionsNeeded.push("Approve plan for execution");
    }
    if (summary.blocked_atoms > 0) {
      decisionsNeeded.push("Resolve blockers");
    }
    if (activeBatch && activeBatch.status === "pending") {
      decisionsNeeded.push("Dispatch next batch");
    }

    const nextAction = this.determineNextAction(plan);

    return {
      plan_summary: `${plan.objective} (v${plan.version}) — ${summary.progress_pct}% complete`,
      current_batch: activeBatch
        ? `${activeBatch.discipline} batch (${activeBatch.completed_atoms}/${activeBatch.total_atoms})`
        : null,
      active_disciplines: activeDisciplines,
      blockers: summary.blocked_atoms,
      progress_pct: summary.progress_pct,
      tokens_remaining: summary.estimated_tokens_remaining,
      estimated_sessions: plan.budget?.sessions_required || 1,
      key_decisions_needed: decisionsNeeded,
      next_action: nextAction,
    };
  }

  // ──── Private Helpers ─────────────────────────────────────

  private calculateRemainingTokens(plan: Plan): number {
    const completedTokens = plan.atoms
      .filter((a) => a.status === "completed")
      .reduce((sum, a) => sum + (a.estimated_tokens || 0), 0);
    return Math.max(0, plan.total_tokens_estimated - completedTokens);
  }

  private determineNextAction(plan: Plan): string {
    if (plan.status === "draft" || plan.status === "pending_approval") {
      return "Review and approve plan";
    }

    const nextBatch = plan.batches.find(
      (b) => b.status === "pending",
    );
    if (nextBatch) {
      return `Dispatch ${nextBatch.discipline} batch (${nextBatch.total_atoms} atoms)`;
    }

    const activeBatch = plan.batches.find(
      (b) => b.status === "executing" || b.status === "dispatched",
    );
    if (activeBatch) {
      return `Monitor ${activeBatch.discipline} batch execution`;
    }

    if (this.isPlanComplete(plan.batches)) {
      return "Plan complete. Review final report.";
    }

    return "Check plan status";
  }

  private isPlanComplete(batches: ExecutionBatch[]): boolean {
    return batches.every(
      (b) => b.status === "completed" || b.status === "cancelled",
    );
  }
}