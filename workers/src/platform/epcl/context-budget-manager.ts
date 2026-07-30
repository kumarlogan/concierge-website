// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Context Budget Manager                  │
// │ Incremental context loading — tracks and manages the       │
// │ context window across execution batches and tasks.         │
// └─────────────────────────────────────────────────────────────┘

import {
  type ContextBudget,
  ContextStrategy,
  type BudgetSnapshot,
  type BudgetViolation,
  FeatureFlag,
} from "./types.js";
import { getConfig } from "./feature-flags.js";

// ── Error ────────────────────────────────────────────────────

export class ContextBudgetExceededError extends Error {
  constructor(
    message: string,
    public readonly currentUsage: number,
    public readonly maxTokens: number
  ) {
    super(`ContextBudgetExceededError: ${message} (${currentUsage}/${maxTokens})`);
    this.name = "ContextBudgetExceededError";
  }
}

// ── Context Budget Manager ───────────────────────────────────

export class ContextBudgetManager {
  private static instance: ContextBudgetManager;
  private budgets: Map<string, ContextBudget> = new Map();
  private violations: BudgetViolation[] = [];
  private peakUsage = 0;
  private totalUsage = 0;
  private usageCount = 0;

  private constructor() {}

  static getInstance(): ContextBudgetManager {
    if (!ContextBudgetManager.instance) {
      ContextBudgetManager.instance = new ContextBudgetManager();
    }
    return ContextBudgetManager.instance;
  }

  // ── Budget Management ──────────────────────────────────────

  /**
   * Initialize a fresh context budget for a plan.
   */
  initializeForPlan(planId: string, maxTokens?: number): ContextBudget {
    const config = getConfig();
    const budget: ContextBudget = {
      maxTokens: maxTokens || config.contextBudget.maxTokens,
      currentUsage: 0,
      remaining: maxTokens || config.contextBudget.maxTokens,
      batchReservation: config.contextBudget.batchReservation,
      perTaskReservation: config.contextBudget.perTaskReservation,
      strategy: config.contextBudget.strategy,
    };

    this.budgets.set(planId, budget);
    return budget;
  }

  /**
   * Get the current budget for a plan.
   */
  getBudget(planId: string): ContextBudget | undefined {
    return this.budgets.get(planId);
  }

  /**
   * Reserve context for a batch execution.
   * Ensures the batch can fit within the remaining budget.
   */
  reserveForBatch(planId: string, batchId: string, tokens: number): boolean {
    const budget = this.budgets.get(planId);
    if (!budget) return false;

    if (budget.remaining < tokens) {
      this.violations.push({
        batchId,
        taskId: "",
        type: "context",
        budget: budget.remaining,
        actual: tokens,
        timestamp: new Date().toISOString(),
        action: "fail",
      });
      return false;
    }

    budget.currentUsage += tokens;
    budget.remaining -= tokens;
    budget.batchReservation = tokens;
    this.updatePeakUsage(budget.currentUsage);
    return true;
  }

  /**
   * Reserve context for a specific task within a batch.
   */
  reserveForTask(planId: string, batchId: string, taskId: string, tokens: number): boolean {
    const budget = this.budgets.get(planId);
    if (!budget) return false;

    if (budget.remaining < tokens) {
      this.violations.push({
        batchId,
        taskId,
        type: "context",
        budget: budget.remaining,
        actual: tokens,
        timestamp: new Date().toISOString(),
        action: tokens > budget.remaining + budget.batchReservation * 2 ? "fail" : "warn",
      });
      return false;
    }

    budget.currentUsage += tokens;
    budget.remaining -= tokens;
    this.updatePeakUsage(budget.currentUsage);
    return true;
  }

  /**
   * Release context budget after task completion.
   */
  releaseForTask(planId: string, _taskId: string, tokens: number): void {
    const budget = this.budgets.get(planId);
    if (!budget) return;

    budget.currentUsage = Math.max(0, budget.currentUsage - tokens);
    budget.remaining = Math.min(budget.maxTokens, budget.remaining + tokens);
  }

  /**
   * Release context budget after batch completion.
   */
  releaseForBatch(planId: string, _batchId: string, tokens: number): void {
    const budget = this.budgets.get(planId);
    if (!budget) return;

    budget.currentUsage = Math.max(0, budget.currentUsage - tokens);
    budget.remaining = Math.min(budget.maxTokens, budget.remaining + tokens);
    budget.batchReservation = 0;
  }

  // ── Usage Tracking ─────────────────────────────────────────

  /**
   * Record context usage for a task.
   */
  recordUsage(planId: string, tokens: number): void {
    const budget = this.budgets.get(planId);
    if (!budget) return;

    budget.currentUsage += tokens;
    budget.remaining = Math.max(0, budget.maxTokens - budget.currentUsage);
    this.updatePeakUsage(budget.currentUsage);
    this.totalUsage += tokens;
    this.usageCount++;
  }

  /**
   * Get average usage per task.
   */
  getAverageUsage(): number {
    return this.usageCount > 0 ? this.totalUsage / this.usageCount : 0;
  }

  /**
   * Get peak usage across all plans.
   */
  getPeakUsage(): number {
    return this.peakUsage;
  }

  /**
   * Get current usage snapshot for a plan.
   */
  getSnapshot(planId: string, batchId?: string): BudgetSnapshot {
    const budget = this.budgets.get(planId);
    const warnings: string[] = [];
    const violations: BudgetViolation[] = [];

    if (!budget) {
      return {
        tokenBudget: { total: 0, consumed: 0, remaining: 0, reserved: 0, batchLimit: 0, perTaskLimit: 0, resetStrategy: "per_plan" as any, resetAt: new Date().toISOString() },
        contextBudget: { maxTokens: 0, currentUsage: 0, remaining: 0, batchReservation: 0, perTaskReservation: 0, strategy: ContextStrategy.INCREMENTAL },
        planId,
        batchId,
        timestamp: new Date().toISOString(),
        warnings: ["No budget initialized for plan"],
        violations: [],
      };
    }

    if (budget.remaining < budget.maxTokens * 0.1) {
      warnings.push(`Context budget critically low: ${budget.remaining}/${budget.maxTokens} remaining`);
    } else if (budget.remaining < budget.maxTokens * 0.25) {
      warnings.push(`Context budget low: ${budget.remaining}/${budget.maxTokens} remaining`);
    }

    const planViolations = this.violations.filter((v) => !batchId || v.batchId === batchId);
    violations.push(...planViolations);

    return {
      tokenBudget: {
        total: 0, consumed: 0, remaining: 0, reserved: 0,
        batchLimit: 0, perTaskLimit: 0, resetStrategy: "per_plan" as any,
        resetAt: new Date().toISOString(),
      },
      contextBudget: { ...budget },
      planId,
      batchId,
      timestamp: new Date().toISOString(),
      warnings,
      violations,
    };
  }

  /**
   * Check if there's enough context budget remaining.
   */
  hasBudget(planId: string, tokens: number): boolean {
    const budget = this.budgets.get(planId);
    return budget ? budget.remaining >= tokens : false;
  }

  /**
   * Get the recommended batch size based on remaining budget.
   */
  getRecommendedBatchSize(planId: string): number {
    const budget = this.budgets.get(planId);
    if (!budget) return 0;

    // Use a fraction of remaining budget per batch
    const available = Math.floor(budget.remaining / 3);
    return Math.min(available, budget.batchReservation);
  }

  /**
   * Check if we should switch to strict mode (low on budget).
   */
  isStrictMode(planId: string): boolean {
    const budget = this.budgets.get(planId);
    return budget ? budget.remaining < budget.maxTokens * 0.15 : false;
  }

  // ── Private ────────────────────────────────────────────────

  private updatePeakUsage(usage: number): void {
    if (usage > this.peakUsage) {
      this.peakUsage = usage;
    }
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.budgets.clear();
    this.violations = [];
    this.peakUsage = 0;
    this.totalUsage = 0;
    this.usageCount = 0;
  }
}