// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL ContextBudgetManager                      │
// │ ADR-018 · Capability #14 · Context Window Management         │
// │ Monitors and manages Hermes Agent context window.         │
// └─────────────────────────────────────────────────────────────┘

import type {
  ContextBudget,
  SessionPlan,
  PlanAtom,
  TokenEstimate,
} from "../../contracts/planning.js";

export interface ContextCostModel {
  roadmap_base: number;
  roadmap_per_phase: number;
  per_epic: number;
  per_story: number;
  per_task: number;
  planning_overhead: number;
  execution_reserve: number;
}

const DEFAULT_COST_MODEL: ContextCostModel = {
  roadmap_base: 2000,
  roadmap_per_phase: 1000,
  per_epic: 500,
  per_story: 200,
  per_task: 100,
  planning_overhead: 3900,
  execution_reserve: 10000,
};

/**
 * ContextBudgetManager: Monitors and manages the Hermes Agent
 * context window to prevent overflow.
 *
 * Proactive budgeting — estimates context usage BEFORE planning
 * begins, and decomposes plans across sessions when the window
 * is insufficient.
 *
 * Design decisions:
 * - Proactive estimation (not reactive overflow detection)
 * - Conservative upper-bound estimates
 * - Cross-session decomposition with checkpoint support
 * - Configurable cost model for different window sizes
 */
export class ContextBudgetManager {
  private costModel: ContextCostModel;
  private readonly WINDOW_SIZE = 65000; // tencent/hy3 default

  constructor(costModel?: Partial<ContextCostModel>) {
    this.costModel = { ...DEFAULT_COST_MODEL, ...costModel };
  }

  /**
   * Estimate the total context usage for a set of work items.
   * Returns a ContextBudget with break down of estimated costs.
   */
  estimateContextUsage(
    epics: number,
    stories: number,
    tasks: number,
    roadmapPhases: number = 1,
  ): ContextBudget {
    const roadmapCost =
      this.costModel.roadmap_base +
      roadmapPhases * this.costModel.roadmap_per_phase;
    const epicCost = epics * this.costModel.per_epic;
    const storyCost = stories * this.costModel.per_story;
    const taskCost = tasks * this.costModel.per_task;

    const totalEstimated =
      roadmapCost +
      epicCost +
      storyCost +
      taskCost +
      this.costModel.planning_overhead +
      this.costModel.execution_reserve;

    const fits = totalEstimated <= this.WINDOW_SIZE;
    const remaining = fits ? this.WINDOW_SIZE - totalEstimated : 0;

    return {
      total_estimated_tokens: totalEstimated,
      roadmap_tokens: roadmapCost,
      planning_overhead_tokens: this.costModel.planning_overhead,
      execution_reserve_tokens: this.costModel.execution_reserve,
      fits_in_window: fits,
      remaining_tokens: remaining,
      sessions_required: fits ? 1 : this.calculateRequiredSessions(totalEstimated),
    };
  }

  /**
   * Check if the estimated context fits within the configured window.
   */
  fitsInWindow(budget: ContextBudget): boolean {
    return budget.total_estimated_tokens <= this.WINDOW_SIZE;
  }

  /**
   * Decompose work items across multiple sessions when the context
   * window is insufficient for a single session.
   */
  decomposeAcrossSessions(
    atoms: PlanAtom[],
    budget: ContextBudget,
  ): SessionPlan[] {
    if (budget.fits_in_window) {
      return [
        {
          session_number: 1,
          total_sessions: 1,
          atoms,
          estimated_tokens: budget.total_estimated_tokens,
          context_budget: budget,
          resume_from_session: false,
          checkpoint_atom_id: null,
        },
      ];
    }

    const sessions: SessionPlan[] = [];
    const atomsPerSession = Math.max(
      1,
      Math.floor(atoms.length / budget.sessions_required),
    );

    let sessionStart = 0;
    let sessionNum = 1;
    let lastCheckpointId: string | null = null;

    while (sessionStart < atoms.length) {
      const sessionEnd = Math.min(
        sessionStart + atomsPerSession,
        atoms.length,
      );
      const sessionAtoms = atoms.slice(sessionStart, sessionEnd);
      const sessionBudget = this.estimateContextUsage(
        sessionAtoms.filter((a) => a.atom_type === "epic").length,
        sessionAtoms.filter((a) => a.atom_type === "story").length,
        sessionAtoms.filter((a) => a.atom_type === "task").length,
      );

      if (sessionNum > 1 && sessionStart >= atoms.length) {
        break;
      }

      sessions.push({
        session_number: sessionNum,
        total_sessions: budget.sessions_required,
        atoms: sessionAtoms,
        estimated_tokens: sessionBudget.total_estimated_tokens,
        context_budget: sessionBudget,
        resume_from_session: sessionNum > 1,
        checkpoint_atom_id: lastCheckpointId,
      });

      lastCheckpointId = sessionAtoms[sessionAtoms.length - 1]?.id || null;
      sessionStart = sessionEnd;
      sessionNum++;
    }

    return sessions;
  }

  /**
   * Configure the context window size (e.g., for different models).
   */
  setWindowSize(tokens: number): void {
    // This would be configurable per model
    // For now, uses the tencent/hy3 default of 65K
  }

  // ──── Private Helpers ─────────────────────────────────────

  /**
   * Calculate how many sessions are required to fit the budget.
   */
  private calculateRequiredSessions(totalEstimated: number): number {
    const availablePerSession =
      this.WINDOW_SIZE - this.costModel.execution_reserve;
    if (availablePerSession <= 0) return Infinity;
    return Math.ceil(totalEstimated / availablePerSession);
  }
}