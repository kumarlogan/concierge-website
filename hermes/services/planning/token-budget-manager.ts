// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL TokenBudgetManager                        │
// │ ADR-018 · Capability #14 · Token Consumption Management      │
// │ Estimates and tracks token consumption per atom and batch.   │
// └─────────────────────────────────────────────────────────────┘

import type {
  PlanAtom,
  TokenEstimate,
  TokenBreakdown,
} from "../../contracts/planning.js";

export interface TokenBudgetConfig {
  max_tokens_per_atom: number;
  max_tokens_per_batch: number;
  max_tokens_per_session: number;
  overhead_pct: number;
}

const DEFAULT_CONFIG: TokenBudgetConfig = {
  max_tokens_per_atom: 500,
  max_tokens_per_batch: 15000,
  max_tokens_per_session: 45000,
  overhead_pct: 0.15,
};

/**
 * TokenBudgetManager: Estimates and tracks token consumption
 * per atom, batch, and session.
 *
 * Uses conservative (upper-bound) estimation to prevent
 * context overflow. Estimates include overhead for system
 * prompts, tool definitions, and response tokens.
 *
 * Design decisions:
 * - Per-atom estimation for fine-grained budgeting
 * - Configurable limits per atom/batch/session
 * - Overhead percentage for system-level costs
 * - Grouping suggestions for optimal budget allocation
 */
export class TokenBudgetManager {
  private config: TokenBudgetConfig;

  constructor(config?: Partial<TokenBudgetConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Estimate token consumption for a single work item.
   */
  estimateAtom(atom: PlanAtom): TokenEstimate {
    const breakdown = this.calculateBreakdown(atom);
    const total = Object.values(breakdown).reduce((s, v) => s + v, 0);
    const withOverhead = Math.round(total * (1 + this.config.overhead_pct));

    return {
      item_id: atom.id,
      item_type: atom.atom_type,
      estimated_tokens: withOverhead,
      breakdown,
    };
  }

  /**
   * Estimate token consumption for multiple atoms.
   */
  estimateBatch(atoms: PlanAtom[]): number {
    const estimates = atoms.map((a) => this.estimateAtom(a));
    return estimates.reduce((sum, e) => sum + e.estimated_tokens, 0);
  }

  /**
   * Check if an atom fits within the configured budget.
   */
  checkAtomBudget(estimate: TokenEstimate): boolean {
    return estimate.estimated_tokens <= this.config.max_tokens_per_atom;
  }

  /**
   * Check if a batch fits within the configured budget.
   */
  checkBatchBudget(totalTokens: number): boolean {
    return totalTokens <= this.config.max_tokens_per_batch;
  }

  /**
   * Suggest how to split atoms across budget groups.
   */
  suggestBudgetSplit(atoms: PlanAtom[]): PlanAtom[][] {
    const groups: PlanAtom[][] = [];
    let currentGroup: PlanAtom[] = [];
    let currentTokens = 0;

    for (const atom of atoms) {
      const estimate = this.estimateAtom(atom);

      if (
        currentTokens + estimate.estimated_tokens >
        this.config.max_tokens_per_batch
      ) {
        if (currentGroup.length > 0) {
          groups.push(currentGroup);
        }
        currentGroup = [atom];
        currentTokens = estimate.estimated_tokens;
      } else {
        currentGroup.push(atom);
        currentTokens += estimate.estimated_tokens;
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    return groups;
  }

  // ──── Private Helpers ─────────────────────────────────────

  private calculateBreakdown(atom: PlanAtom): TokenBreakdown {
    // Estimate based on content length
    const charsPerToken = 4; // Rough: ~4 chars per token
    const descriptionTokens = Math.ceil(
      (atom.description?.length || 0) / charsPerToken,
    );
    const acceptanceTokens =
      (atom.acceptance_criteria || []).reduce(
        (s, c) => s + Math.ceil(c.length / charsPerToken),
        0,
      );
    const fileRefsTokens = 0; // File refs don't add content tokens
    const dependencyTokens = (atom.dependencies?.length || 0) * 15; // ~15 tokens per dep
    const overheadTokens = 50; // Base overhead per atom

    return {
      description_cost: descriptionTokens,
      acceptance_criteria_cost: acceptanceTokens,
      file_refs_cost: fileRefsTokens,
      dependency_cost: dependencyTokens,
      overhead: overheadTokens,
    };
  }
}