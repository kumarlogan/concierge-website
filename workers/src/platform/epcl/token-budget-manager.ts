// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Token Budget Manager                    │
// │ Platform-wide token budgeting across disciplines,          │
// │ batches, and tasks.                                        │
// └─────────────────────────────────────────────────────────────┘

import {
  type TokenBudget,
  TokenResetStrategy,
  type BudgetViolation,
  type BudgetSnapshot,
  type Discipline,
  ContextStrategy,
} from "./types.js";
import { getConfig } from "./feature-flags.js";

// ── Error ────────────────────────────────────────────────────

export class TokenBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly consumed: number,
    public readonly total: number
  ) {
    super(`TokenBudgetExceededError: ${message} (${consumed}/${total})`);
    this.name = "TokenBudgetExceededError";
  }
}

// ── Token Budget Manager ─────────────────────────────────────

export class TokenBudgetManager {
  private static instance: TokenBudgetManager;
  private budgets: Map<string, TokenBudget> = new Map();
  private disciplineUsage: Map<string, Map<Discipline, number>> = new Map();
  private batchUsage: Map<string, Map<string, number>> = new Map();
  private violations: BudgetViolation[] = [];

  private constructor() {}

  static getInstance(): TokenBudgetManager {
    if (!TokenBudgetManager.instance) {
      TokenBudgetManager.instance = new TokenBudgetManager();
    }
    return TokenBudgetManager.instance;
  }

  // ── Initialization ─────────────────────────────────────────

  /**
   * Initialize a fresh token budget for a plan.
   */
  initializeForPlan(planId: string, total?: number): TokenBudget {
    const config = getConfig();
    const budget: TokenBudget = {
      total: total || config.tokenBudget.defaultTotal,
      consumed: 0,
      remaining: total || config.tokenBudget.defaultTotal,
      reserved: 0,
      batchLimit: config.tokenBudget.defaultBatchLimit,
      perTaskLimit: config.tokenBudget.defaultPerTaskLimit,
      resetStrategy: config.tokenBudget.resetStrategy,
      resetAt: this.calculateResetAt(config.tokenBudget.resetStrategy),
    };

    this.budgets.set(planId, budget);
    this.disciplineUsage.set(planId, new Map());
    this.batchUsage.set(planId, new Map());
    return budget;
  }

  // ── Consumption ────────────────────────────────────────────

  /**
   * Consume tokens for a batch execution.
   */
  consumeForBatch(planId: string, batchId: string, tokens: number): boolean {
    const budget = this.budgets.get(planId);
    if (!budget) return false;

    if (budget.remaining < tokens) {
      this.violations.push({
        batchId,
        taskId: "",
        type: "token",
        budget: budget.remaining,
        actual: tokens,
        timestamp: new Date().toISOString(),
        action: "fail",
      });
      return false;
    }

    budget.consumed += tokens;
    budget.remaining -= tokens;

    // Track batch-level usage
    const batchMap = this.batchUsage.get(planId) || new Map();
    batchMap.set(batchId, (batchMap.get(batchId) || 0) + tokens);
    this.batchUsage.set(planId, batchMap);

    return true;
  }

  /**
   * Consume tokens for a specific task.
   */
  consumeForTask(
    planId: string,
    batchId: string,
    taskId: string,
    tokens: number,
    discipline?: Discipline
  ): boolean {
    const budget = this.budgets.get(planId);
    if (!budget) return false;

    // Check per-task limit
    if (tokens > budget.perTaskLimit) {
      this.violations.push({
        batchId,
        taskId,
        type: "token",
        budget: budget.perTaskLimit,
        actual: tokens,
        timestamp: new Date().toISOString(),
        action: tokens > budget.perTaskLimit * 2 ? "fail" : "warn",
      });
      return false;
    }

    // Check remaining budget
    if (budget.remaining < tokens) {
      this.violations.push({
        batchId,
        taskId,
        type: "token",
        budget: budget.remaining,
        actual: tokens,
        timestamp: new Date().toISOString(),
        action: "fail",
      });
      return false;
    }

    budget.consumed += tokens;
    budget.remaining -= tokens;

    // Track discipline-level usage
    if (discipline) {
      const discMap = this.disciplineUsage.get(planId) || new Map();
      discMap.set(discipline, (discMap.get(discipline) || 0) + tokens);
      this.disciplineUsage.set(planId, discMap);
    }

    // Track batch-level usage
    const batchMap = this.batchUsage.get(planId) || new Map();
    batchMap.set(batchId, (batchMap.get(batchId) || 0) + tokens);
    this.batchUsage.set(planId, batchMap);

    return true;
  }

  /**
   * Reserve tokens for a batch (holds them so other operations can't consume them).
   */
  reserveForBatch(planId: string, tokens: number): boolean {
    const budget = this.budgets.get(planId);
    if (!budget) return false;

    if (budget.remaining < tokens) {
      return false;
    }

    budget.reserved += tokens;
    budget.remaining -= tokens;
    return true;
  }

  /**
   * Release reserved tokens (if batch is cancelled or resized).
   */
  releaseReservation(planId: string, tokens: number): void {
    const budget = this.budgets.get(planId);
    if (!budget) return;

    budget.reserved = Math.max(0, budget.reserved - tokens);
    budget.remaining = Math.min(budget.total - budget.consumed, budget.remaining + tokens);
  }

  // ── Queries ────────────────────────────────────────────────

  /**
   * Get the current budget for a plan.
   */
  getBudget(planId: string): TokenBudget | undefined {
    return this.budgets.get(planId);
  }

  /**
   * Get token consumption by discipline for a plan.
   */
  getDisciplineUsage(planId: string): Map<Discipline, number> {
    return this.disciplineUsage.get(planId) || new Map();
  }

  /**
   * Get token consumption by batch for a plan.
   */
  getBatchUsage(planId: string): Map<string, number> {
    return this.batchUsage.get(planId) || new Map();
  }

  /**
   * Get all violations.
   */
  getViolations(): BudgetViolation[] {
    return [...this.violations];
  }

  /**
   * Get violations for a specific plan.
   */
  getViolationsForPlan(planId: string): BudgetViolation[] {
    return this.violations.filter((v) => {
      const batchMap = this.batchUsage.get(planId);
      return batchMap?.has(v.batchId);
    });
  }

  /**
   * Check if we have enough budget remaining.
   */
  hasBudget(planId: string, tokens: number): boolean {
    const budget = this.budgets.get(planId);
    return budget ? budget.remaining >= tokens : false;
  }

  /**
   * Get the remaining budget as a percentage.
   */
  getRemainingPercent(planId: string): number {
    const budget = this.budgets.get(planId);
    if (!budget || budget.total === 0) return 0;
    return (budget.remaining / budget.total) * 100;
  }

  /**
   * Get projected exhaustion time.
   */
  getProjectedExhaustion(planId: string): string | null {
    const budget = this.budgets.get(planId);
    if (!budget || budget.consumed === 0) return null;

    const rate = budget.consumed / (Date.now() - new Date(budget.resetAt).getTime() + 1);
    if (rate <= 0) return null;

    const remainingMs = budget.remaining / rate;
    const exhaustionDate = new Date(Date.now() + remainingMs);
    return exhaustionDate.toISOString();
  }

  /**
   * Get a full snapshot of the budget state.
   */
  getSnapshot(planId: string, batchId?: string): BudgetSnapshot {
    const budget = this.budgets.get(planId);
    const warnings: string[] = [];

    if (!budget) {
      return {
        tokenBudget: { total: 0, consumed: 0, remaining: 0, reserved: 0, batchLimit: 0, perTaskLimit: 0, resetStrategy: TokenResetStrategy.PER_PLAN, resetAt: new Date().toISOString() },
        contextBudget: { maxTokens: 0, currentUsage: 0, remaining: 0, batchReservation: 0, perTaskReservation: 0, strategy: ContextStrategy.INCREMENTAL },
        planId,
        batchId,
        timestamp: new Date().toISOString(),
        warnings: ["No token budget initialized for plan"],
        violations: [],
      };
    }

    const remainingPercent = (budget.remaining / budget.total) * 100;
    if (remainingPercent < 10) {
      warnings.push(`Token budget critically low: ${budget.remaining}/${budget.total} remaining (${remainingPercent.toFixed(1)}%)`);
    } else if (remainingPercent < 25) {
      warnings.push(`Token budget low: ${budget.remaining}/${budget.total} remaining (${remainingPercent.toFixed(1)}%)`);
    }

    const planViolations = this.violations.filter((v) => !batchId || v.batchId === batchId);

    return {
      tokenBudget: { ...budget },
      contextBudget: { maxTokens: 0, currentUsage: 0, remaining: 0, batchReservation: 0, perTaskReservation: 0, strategy: ContextStrategy.INCREMENTAL },
      planId,
      batchId,
      timestamp: new Date().toISOString(),
      warnings,
      violations: planViolations,
    };
  }

  /**
   * Reset the budget for a plan (e.g., at end of day/week).
   */
  resetBudget(planId: string): void {
    const budget = this.budgets.get(planId);
    if (!budget) return;

    budget.consumed = 0;
    budget.remaining = budget.total;
    budget.reserved = 0;
    budget.resetAt = this.calculateResetAt(budget.resetStrategy);

    this.disciplineUsage.set(planId, new Map());
    this.batchUsage.set(planId, new Map());
  }

  // ── Private ────────────────────────────────────────────────

  private calculateResetAt(strategy: TokenResetStrategy): string {
    const now = new Date();
    switch (strategy) {
      case TokenResetStrategy.DAILY: {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        return tomorrow.toISOString();
      }
      case TokenResetStrategy.WEEKLY: {
        const nextWeek = new Date(now);
        nextWeek.setDate(nextWeek.getDate() + (7 - nextWeek.getDay()));
        nextWeek.setHours(0, 0, 0, 0);
        return nextWeek.toISOString();
      }
      case TokenResetStrategy.MONTHLY: {
        const nextMonth = new Date(now);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        nextMonth.setDate(1);
        nextMonth.setHours(0, 0, 0, 0);
        return nextMonth.toISOString();
      }
      case TokenResetStrategy.PER_PLAN: {
        // Never auto-resets — must be called explicitly
        return new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
      }
    }
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.budgets.clear();
    this.disciplineUsage.clear();
    this.batchUsage.clear();
    this.violations = [];
  }
}