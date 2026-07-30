// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Executive Reporter                      │
// │ Generates executive-level reports on execution progress,   │
// │ discipline utilization, budget health, and forecasts.      │
// └─────────────────────────────────────────────────────────────┘

import {
  type ExecutiveReport,
  type ReportSummary,
  type ProgressReport,
  type ApprovalStatusReport,
  type DisciplineUtilizationReport,
  type CapabilityUtilizationReport,
  type BudgetReport,
  type KnowledgeGrowthReport,
  type ForecastReport,
  type ExecutionPlan,
  type ExecutionBatch,
  type Blocker,
  type DisciplineMetrics,
  type CapabilityMetrics,
  type RiskFactor,
  type PhaseProgress,
  type DisciplineProgress,
  type ApprovalStats,
  ApprovalType,
  Discipline,
  PlanStatus,
  BatchStatus,
  BlockerSeverity,
  BlockerResolutionStatus,
  FeatureFlag,
} from "./types.js";
import { isEnabled } from "./feature-flags.js";
import { ApprovalManager } from "./approval-manager.js";
import { ContextBudgetManager } from "./context-budget-manager.js";
import { TokenBudgetManager } from "./token-budget-manager.js";
import { DisciplineSelector } from "./discipline-selector.js";

// ── Error ────────────────────────────────────────────────────

export class ReportGenerationError extends Error {
  constructor(message: string) {
    super(`ReportGenerationError: ${message}`);
    this.name = "ReportGenerationError";
  }
}

// ── Executive Reporter ───────────────────────────────────────

export class ExecutiveReporter {
  private static instance: ExecutiveReporter;
  private reports: Map<string, ExecutiveReport> = new Map();
  private reportCounter = 0;
  private blockers: Blocker[] = [];

  private constructor() {}

  static getInstance(): ExecutiveReporter {
    if (!ExecutiveReporter.instance) {
      ExecutiveReporter.instance = new ExecutiveReporter();
    }
    return ExecutiveReporter.instance;
  }

  // ── Report Generation ──────────────────────────────────────

  /**
   * Generate a comprehensive executive report for a plan.
   */
  generateReport(
    plan: ExecutionPlan,
    disciplineSelector: DisciplineSelector,
    approvalManager: ApprovalManager,
    contextManager: ContextBudgetManager,
    tokenManager: TokenBudgetManager
  ): ExecutiveReport {
    if (!isEnabled(FeatureFlag.ENABLE_EXECUTIVE_REPORTING)) {
      throw new ReportGenerationError(
        "Executive reporting is disabled. Enable FeatureFlag.ENABLE_EXECUTIVE_REPORTING."
      );
    }

    const reportId = `report-${this.reportCounter++}-${Date.now()}`;
    const now = new Date().toISOString();

    const summary = this.generateSummary(plan);
    const progress = this.generateProgress(plan);
    const approvals = this.generateApprovalStatus(approvalManager, plan);
    const disciplineReport = this.generateDisciplineReport(disciplineSelector, plan);
    const capabilityReport = this.generateCapabilityReport(plan);
    const budgetReport = this.generateBudgetReport(plan, contextManager, tokenManager);
    const knowledgeReport = this.generateKnowledgeReport();
    const forecast = this.generateForecast(plan, summary, progress);

    const report: ExecutiveReport = {
      id: reportId,
      planId: plan.id,
      title: `Executive Report: ${plan.title}`,
      generatedAt: now,
      summary,
      progress,
      approvals,
      disciplineReport,
      capabilityReport,
      budgetReport,
      knowledgeReport,
      forecast,
      recommendations: this.generateRecommendations(summary, progress, budgetReport, forecast),
    };

    this.reports.set(reportId, report);
    return report;
  }

  /**
   * Get a previously generated report by ID.
   */
  getReport(id: string): ExecutiveReport | undefined {
    return this.reports.get(id);
  }

  /**
   * List all generated reports.
   */
  listReports(): ExecutiveReport[] {
    return Array.from(this.reports.values());
  }

  // ── Summary ────────────────────────────────────────────────

  private generateSummary(plan: ExecutionPlan): ReportSummary {
    const activeBatches = plan.batches.filter((b) => b.status === BatchStatus.RUNNING).length;
    const completedBatches = plan.batches.filter((b) => b.status === BatchStatus.COMPLETED).length;
    const totalBatches = plan.batches.length;
    const overallProgress = totalBatches > 0 ? completedBatches / totalBatches : 0;

    return {
      status: plan.status,
      activeBatches,
      completedBatches,
      totalBatches,
      blockers: this.getActiveBlockers(),
      overallProgress,
      estimatedCompletion: this.estimateCompletion(plan, completedBatches, totalBatches),
      confidence: this.calculateConfidence(plan, completedBatches, totalBatches),
    };
  }

  // ── Progress ───────────────────────────────────────────────

  private generateProgress(plan: ExecutionPlan): ProgressReport {
    const totalBatches = plan.batches.length;
    const completedBatches = plan.batches.filter((b) => b.status === BatchStatus.COMPLETED).length;
    const overall = totalBatches > 0 ? completedBatches / totalBatches : 0;

    const byPhase: PhaseProgress[] = plan.phases.map((phase) => {
      const phaseBatches = plan.batches.filter((b) => phase.batches.includes(b.id));
      const completed = phaseBatches.filter((b) => b.status === BatchStatus.COMPLETED).length;
      return {
        phaseId: phase.id,
        name: phase.name,
        progress: phaseBatches.length > 0 ? completed / phaseBatches.length : 0,
        batchesCompleted: completed,
        batchesTotal: phaseBatches.length,
        status: phase.status,
        blockers: this.blockers
          .filter((b) => b.impactedBatches.some((ib) => phase.batches.includes(ib)))
          .map((b) => b.id),
      };
    });

    const byDiscipline: DisciplineProgress[] = this.groupByDiscipline(plan);

    // Calculate velocity (batches per day since start)
    const velocity = this.calculateVelocity(plan, completedBatches);

    return {
      overall,
      byPhase,
      byDiscipline,
      velocity,
      velocityTrend: velocity > 0 ? "stable" as const : "stable" as const,
      remainingWork: totalBatches - completedBatches,
      scheduleVariance: 0,
    };
  }

  private groupByDiscipline(plan: ExecutionPlan): DisciplineProgress[] {
    const disciplineMap = new Map<string, { completed: number; total: number; active: number }>();

    for (const batch of plan.batches) {
      const entry = disciplineMap.get(batch.discipline) || { completed: 0, total: 0, active: 0 };
      entry.total++;
      if (batch.status === BatchStatus.COMPLETED) entry.completed++;
      if (batch.status === BatchStatus.RUNNING) entry.active++;
      disciplineMap.set(batch.discipline, entry);
    }

    return Array.from(disciplineMap.entries()).map(([discipline, stats]) => ({
      discipline: discipline as Discipline,
      progress: stats.total > 0 ? stats.completed / stats.total : 0,
      completedBatches: stats.completed,
      totalBatches: stats.total,
      activeBatches: stats.active,
      utilization: stats.total > 0 ? (stats.completed + stats.active) / stats.total : 0,
    }));
  }

  private calculateVelocity(plan: ExecutionPlan, completedBatches: number): number {
    if (!plan.startedAt || completedBatches === 0) return 0;
    const startTime = new Date(plan.startedAt).getTime();
    const elapsedDays = (Date.now() - startTime) / (1000 * 60 * 60 * 24);
    return elapsedDays > 0 ? completedBatches / elapsedDays : 0;
  }

  // ── Approvals ──────────────────────────────────────────────

  private generateApprovalStatus(
    approvalManager: ApprovalManager,
    plan: ExecutionPlan
  ): ApprovalStatusReport {
    const requests = approvalManager.getRequestsForPlan(plan.id);
    const pending = requests.filter((r) => r.status === "pending" as any).length;
    const approved = requests.filter((r) => r.status === "approved" as any).length;
    const rejected = requests.filter((r) => r.status === "rejected" as any).length;
    const deferred = requests.filter((r) => r.status === "deferred" as any).length;

    // Calculate average latency
    const resolvedRequests = requests.filter((r) => r.resolvedAt && r.createdAt);
    const totalLatency = resolvedRequests.reduce((sum, r) => {
      return sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime());
    }, 0);
    const avgLatencyMs = resolvedRequests.length > 0 ? totalLatency / resolvedRequests.length : 0;

    // Build by-type stats
    const byType: Record<string, ApprovalStats> = {};
    for (const type of ["constitutional", "product", "security", "infrastructure", "deployment"] as ApprovalType[]) {
      const typeRequests = requests.filter((r) => r.type === type);
      const typeResolved = typeRequests.filter((r) => r.resolvedAt);
      const typeLatency = typeResolved.reduce((sum, r) => {
        return sum + (new Date(r.resolvedAt!).getTime() - new Date(r.createdAt).getTime());
      }, 0);
      byType[type] = {
        pending: typeRequests.filter((r) => r.status === "pending" as any).length,
        approved: typeRequests.filter((r) => r.status === "approved" as any).length,
        rejected: typeRequests.filter((r) => r.status === "rejected" as any).length,
        averageLatencyMs: typeResolved.length > 0 ? typeLatency / typeResolved.length : 0,
      };
    }

    return {
      pending,
      approved,
      rejected,
      deferred,
      averageLatency: this.formatDuration(avgLatencyMs),
      byType: byType as Record<ApprovalType, ApprovalStats>,
    };
  }

  // ── Discipline Report ──────────────────────────────────────

  private generateDisciplineReport(
    disciplineSelector: DisciplineSelector,
    plan: ExecutionPlan
  ): DisciplineUtilizationReport {
    const byDiscipline: Record<string, DisciplineMetrics> = {};
    const activationFrequency: Record<string, number> = {};
    const underutilized: Discipline[] = [];
    const overutilized: Discipline[] = [];

    for (const discipline of Object.values(Discipline)) {
      const activation = disciplineSelector.getActivation(discipline);
      const disciplineBatches = plan.batches.filter((b) => b.discipline === discipline);
      const completedBatches = disciplineBatches.filter((b) => b.status === BatchStatus.COMPLETED).length;
      const failedBatches = disciplineBatches.filter((b) => b.status === BatchStatus.FAILED).length;

      const metrics: DisciplineMetrics = {
        activations: activation ? 1 : 0,
        totalBatches: disciplineBatches.length,
        completedBatches,
        failedBatches,
        averageDuration: "0m",
        totalTokenConsumption: 0,
        totalContextUsage: 0,
        knowledgeCaptured: 0,
        utilizationRate: disciplineBatches.length > 0
          ? (completedBatches + (activation?.completedTasks || 0)) / (disciplineBatches.length + (activation?.completedTasks || 0) + (activation?.failedTasks || 0))
          : 0,
      };

      byDiscipline[discipline] = metrics;
      activationFrequency[discipline] = activation ? 1 : 0;

      if (metrics.utilizationRate < 0.3 && disciplineBatches.length > 0) {
        underutilized.push(discipline);
      }
      if (metrics.utilizationRate > 0.95 && disciplineBatches.length > 0) {
        overutilized.push(discipline);
      }
    }

    return {
      byDiscipline: byDiscipline as Record<Discipline, DisciplineMetrics>,
      activationFrequency: activationFrequency as Record<Discipline, number>,
      underutilized,
      overutilized,
    };
  }

  // ── Capability Report ──────────────────────────────────────

  private generateCapabilityReport(plan: ExecutionPlan): CapabilityUtilizationReport {
    const byCapability: Record<string, CapabilityMetrics> = {};
    const usageCount: Map<string, number> = new Map();

    for (const batch of plan.batches) {
      for (const cap of batch.capabilities) {
        usageCount.set(cap, (usageCount.get(cap) || 0) + 1);
        if (!byCapability[cap]) {
          byCapability[cap] = {
            invocations: 0,
            successCount: 0,
            failureCount: 0,
            averageDuration: 0,
            totalTokenConsumption: 0,
            approvalRate: 1,
            lastInvoked: batch.startedAt || batch.completedAt || "",
            provider: "unknown",
          };
        }
        byCapability[cap].invocations++;
        if (batch.status === BatchStatus.COMPLETED) byCapability[cap].successCount++;
        if (batch.status === BatchStatus.FAILED) byCapability[cap].failureCount++;
      }
    }

    const sorted = [...usageCount.entries()].sort((a, b) => b[1] - a[1]);
    const mostUsed = sorted.slice(0, 5).map(([cap]) => cap);
    const leastUsed = sorted.slice(-3).filter(([, count]) => count === 1).map(([cap]) => cap);

    return {
      byCapability,
      mostUsed,
      leastUsed,
      recommendations: this.generateCapabilityRecommendations(byCapability, mostUsed),
    };
  }

  private generateCapabilityRecommendations(
    capabilities: Record<string, CapabilityMetrics>,
    mostUsed: string[]
  ): string[] {
    const recommendations: string[] = [];
    const highFailure = Object.entries(capabilities).filter(([, m]) => m.failureCount > m.successCount);
    if (highFailure.length > 0) {
      recommendations.push(`Capabilities with high failure rate: ${highFailure.map(([id]) => id).join(", ")}`);
    }
    if (mostUsed.length > 0) {
      recommendations.push(`Most used capabilities: ${mostUsed.join(", ")} — consider optimizing`);
    }
    return recommendations;
  }

  // ── Budget Report ──────────────────────────────────────────

  private generateBudgetReport(
    plan: ExecutionPlan,
    contextManager: ContextBudgetManager,
    tokenManager: TokenBudgetManager
  ): BudgetReport {
    const tokenBudget = tokenManager.getBudget(plan.id);
    const contextBudget = contextManager.getBudget(plan.id);
    const violations = tokenManager.getViolationsForPlan(plan.id);

    const tokenReport = {
      total: tokenBudget?.total || 0,
      consumed: tokenBudget?.consumed || 0,
      remaining: tokenBudget?.remaining || 0,
      byDiscipline: {} as Record<Discipline, number>,
      byBatch: {} as Record<string, number>,
      projectedExhaustion: tokenManager.getProjectedExhaustion(plan.id) || "",
    };

    const contextReport = {
      maxTokens: contextBudget?.maxTokens || 0,
      currentUsage: contextBudget?.currentUsage || 0,
      remaining: contextBudget?.remaining || 0,
      peakUsage: contextManager.getPeakUsage(),
      averageUsage: contextManager.getAverageUsage(),
      byBatch: {} as Record<string, number>,
    };

    const tokenAdherence = tokenBudget && tokenBudget.total > 0
      ? tokenBudget.consumed / tokenBudget.total
      : 0;
    const contextAdherence = contextBudget && contextBudget.maxTokens > 0
      ? contextBudget.currentUsage / contextBudget.maxTokens
      : 0;
    const adherence = Math.min(1, 1 - (tokenAdherence + contextAdherence) / 2);

    return {
      tokenBudget: tokenReport,
      contextBudget: contextReport,
      violations,
      adherence,
    };
  }

  // ── Knowledge Report ────────────────────────────────────────

  private generateKnowledgeReport(): KnowledgeGrowthReport {
    return {
      totalEntries: 0,
      entriesThisReport: 0,
      byType: {},
      reuseRate: 0,
      topContributors: [],
      growthRate: 0,
    };
  }

  // ── Forecast ────────────────────────────────────────────────

  private generateForecast(
    plan: ExecutionPlan,
    summary: ReportSummary,
    progress: ProgressReport
  ): ForecastReport {
    const remainingBatches = summary.totalBatches - summary.completedBatches;
    const remainingDuration = remainingBatches > 0 && progress.velocity > 0
      ? `${Math.ceil(remainingBatches / progress.velocity)}d`
      : "unknown";

    const riskFactors: RiskFactor[] = [];
    if (summary.blockers.length > 0) {
      riskFactors.push({
        description: `${summary.blockers.length} active blockers`,
        probability: 0.7,
        impact: 0.8,
        mitigation: "Resolve blockers before continuing",
        contingency: "Escalate to tech lead",
      });
    }
    if (summary.confidence < 0.5) {
      riskFactors.push({
        description: "Low completion confidence",
        probability: 0.6,
        impact: 0.6,
        mitigation: "Increase batch granularity",
        contingency: "Re-plan remaining work",
      });
    }

    return {
      estimatedCompletion: summary.estimatedCompletion,
      confidence: summary.confidence,
      remainingBatches,
      remainingDuration,
      projectedTokenConsumption: remainingBatches * 5000,
      projectedContextUsage: remainingBatches * 1000,
      riskFactors,
      recommendedActions: this.generateForecastRecommendations(riskFactors),
    };
  }

  private generateForecastRecommendations(riskFactors: RiskFactor[]): string[] {
    const recommendations: string[] = [];
    for (const risk of riskFactors) {
      if (risk.probability > 0.5 && risk.impact > 0.5) {
        recommendations.push(risk.mitigation);
      }
    }
    if (recommendations.length === 0) {
      recommendations.push("Continue with current execution plan");
    }
    return recommendations;
  }

  // ── Recommendations ────────────────────────────────────────

  private generateRecommendations(
    summary: ReportSummary,
    progress: ProgressReport,
    budgetReport: BudgetReport,
    forecast: ForecastReport
  ): string[] {
    const recommendations: string[] = [];

    if (summary.blockers.length > 0) {
      recommendations.push(`Resolve ${summary.blockers.length} active blockers before proceeding`);
    }

    if (progress.velocity < 0.5 && summary.totalBatches > 5) {
      recommendations.push("Consider increasing batch granularity to improve velocity");
    }

    if (budgetReport.adherence > 0.8) {
      recommendations.push("Budget consumption is high — consider increasing allocation");
    }

    if (forecast.confidence < 0.5) {
      recommendations.push("Low confidence in forecast — consider re-planning remaining work");
    }

    recommendations.push(...forecast.recommendedActions);

    if (recommendations.length === 0) {
      recommendations.push("Execution is on track — no interventions needed");
    }

    return recommendations;
  }

  // ── Blockers ────────────────────────────────────────────────

  addBlocker(blocker: Blocker): void {
    this.blockers.push(blocker);
  }

  resolveBlocker(id: string): void {
    const blocker = this.blockers.find((b) => b.id === id);
    if (blocker) {
      blocker.status = BlockerResolutionStatus.RESOLVED;
      blocker.resolvedAt = new Date().toISOString();
    }
  }

  getActiveBlockers(): Blocker[] {
    return this.blockers.filter((b) => b.status !== BlockerResolutionStatus.RESOLVED);
  }

  // ── Private Helpers ────────────────────────────────────────

  private estimateCompletion(
    plan: ExecutionPlan,
    completedBatches: number,
    totalBatches: number
  ): string {
    if (completedBatches === 0) return "unknown";
    if (!plan.startedAt) return "unknown";

    const startTime = new Date(plan.startedAt).getTime();
    const elapsedMs = Date.now() - startTime;
    const rate = elapsedMs / completedBatches;
    const remainingMs = rate * (totalBatches - completedBatches);
    const completionDate = new Date(Date.now() + remainingMs);
    return completionDate.toISOString();
  }

  private calculateConfidence(
    plan: ExecutionPlan,
    completedBatches: number,
    totalBatches: number
  ): number {
    if (totalBatches === 0) return 0.5;
    const completionRatio = completedBatches / totalBatches;
    const blockerPenalty = this.blockers.length * 0.1;
    const failedPenalty = plan.failedBatches * 0.05;
    return Math.max(0, Math.min(1, completionRatio + 0.5 - blockerPenalty - failedPenalty));
  }

  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${Math.round(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
    return `${Math.round(ms / 3600000)}h`;
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.reports.clear();
    this.reportCounter = 0;
    this.blockers = [];
  }
}