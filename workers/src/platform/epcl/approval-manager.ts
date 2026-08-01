// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Approval Manager                        │
// │ Constitutional approval evaluation — determines which      │
// │ execution batches require human decision, generates        │
// │ structured briefings, and tracks resolution status.        │
// └─────────────────────────────────────────────────────────────┘

import {
  type ApprovalEvaluation,
  type ApprovalBriefing,
  type ApprovalRequest,
  type ExecutionPlan,
  type ExecutionBatch,
  ApprovalType,
  ApprovalRequestStatus,
  PlanStatus,
} from "./types.js";

// ── Error ────────────────────────────────────────────────────

export class ApprovalError extends Error {
  constructor(
    message: string,
    public readonly planId?: string,
    public readonly batchId?: string
  ) {
    super(`ApprovalError: ${message}`);
    this.name = "ApprovalError";
  }
}

// ── Approval Manager ─────────────────────────────────────────

export class ApprovalManager {
  private static instance: ApprovalManager;
  private requests: Map<string, ApprovalRequest> = new Map();
  private requestCounter = 0;

  private constructor() {}

  static getInstance(): ApprovalManager {
    if (!ApprovalManager.instance) {
      ApprovalManager.instance = new ApprovalManager();
    }
    return ApprovalManager.instance;
  }

  // ── Evaluation ─────────────────────────────────────────────

  /**
   * Evaluate whether a batch requires approval.
   * Deterministic: checks batch characteristics against approval rules.
   */
  evaluateBatch(batch: ExecutionBatch, plan: ExecutionPlan): ApprovalEvaluation {
    // Check for deployment operations
    const hasDeployment = batch.capabilities.some(
      (c) => c.includes("deploy") || c.includes("publish") || c.includes("release")
    );
    if (hasDeployment) {
      return {
        required: true,
        type: ApprovalType.DEPLOYMENT,
        reason: `Batch "${batch.name}" contains deployment operations that require approval`,
        briefing: this.generateBriefing(batch, plan, ApprovalType.DEPLOYMENT),
        escalationTo: "product-owner",
      };
    }

    // Check for database operations
    const hasDbOperation = batch.capabilities.some(
      (c) => c.includes("db.") || c.includes("database") || c.includes("migrate")
    );
    if (hasDbOperation) {
      return {
        required: true,
        type: ApprovalType.INFRASTRUCTURE,
        reason: `Batch "${batch.name}" contains database operations that require approval`,
        briefing: this.generateBriefing(batch, plan, ApprovalType.INFRASTRUCTURE),
        escalationTo: "tech-lead",
      };
    }

    // Check for security-sensitive operations
    const hasSecurityRelevance = batch.capabilities.some(
      (c) => c.includes("security") || c.includes("auth") || c.includes("permission")
    );
    if (hasSecurityRelevance) {
      return {
        required: true,
        type: ApprovalType.SECURITY,
        reason: `Batch "${batch.name}" contains security-sensitive operations`,
        briefing: this.generateBriefing(batch, plan, ApprovalType.SECURITY),
        escalationTo: "security-owner",
      };
    }

    // Check for new capabilities (not yet registered)
    const hasNewCapabilities = batch.capabilities.length === 0 ||
      batch.capabilities.every((c) => c.includes("new") || c.includes("unknown"));
    if (hasNewCapabilities) {
      return {
        required: true,
        type: ApprovalType.PRODUCT,
        reason: `Batch "${batch.name}" requires new capabilities that need product approval`,
        briefing: this.generateBriefing(batch, plan, ApprovalType.PRODUCT),
        escalationTo: "product-owner",
      };
    }

    // Check batch size (large batches need approval)
    if (batch.tasks.length > 10) {
      return {
        required: true,
        type: ApprovalType.CONSTITUTIONAL,
        reason: `Batch "${batch.name}" exceeds 10 tasks (${batch.tasks.length}) — requires constitutional review`,
        briefing: this.generateBriefing(batch, plan, ApprovalType.CONSTITUTIONAL),
        escalationTo: "tech-lead",
      };
    }

    // No approval needed
    return {
      required: false,
      type: null,
      reason: `Batch "${batch.name}" is within approved operational parameters`,
      briefing: null,
      escalationTo: null,
    };
  }

  /**
   * Evaluate whether the entire plan requires approval.
   */
  evaluatePlan(plan: ExecutionPlan): ApprovalEvaluation {
    // Plans with more than 30 batches need approval
    if (plan.batches.length > 30) {
      return {
        required: true,
        type: ApprovalType.CONSTITUTIONAL,
        reason: `Plan "${plan.title}" has ${plan.batches.length} batches (exceeds 30 threshold)`,
        briefing: {
          title: `Constitutional Review: ${plan.title}`,
          summary: `This plan contains ${plan.batches.length} execution batches across ${plan.phases.length} phases.`,
          impact: `Executing this plan will consume significant platform resources.`,
          risks: ["Large plans increase coordination overhead", "Multiple dependencies increase failure risk"],
          alternatives: [`Split into ${Math.ceil(plan.batches.length / 10)} smaller plans`],
          decisions: [
            `Approve full plan as-is`,
            `Approve with reduced scope`,
            `Request breakdown into smaller plans`,
          ],
          context: { totalBatches: plan.batches.length, totalPhases: plan.phases.length },
          generatedAt: new Date().toISOString(),
        },
        escalationTo: "product-owner",
      };
    }

    // Plans with deployment operations need approval
    const hasDeployments = plan.batches.some((b) =>
      b.capabilities.some((c) => c.includes("deploy"))
    );
    if (hasDeployments) {
      return {
        required: true,
        type: ApprovalType.DEPLOYMENT,
        reason: `Plan "${plan.title}" includes deployment operations`,
        briefing: this.generateBriefingForPlan(plan, ApprovalType.DEPLOYMENT),
        escalationTo: "product-owner",
      };
    }

    return {
      required: false,
      type: null,
      reason: `Plan "${plan.title}" is within standard operational parameters`,
      briefing: null,
      escalationTo: null,
    };
  }

  // ── Request Management ─────────────────────────────────────

  createRequest(
    type: ApprovalType,
    planId: string,
    batchId: string | undefined,
    briefing: ApprovalBriefing
  ): ApprovalRequest {
    const id = `approval-${this.requestCounter++}-${Date.now()}`;
    const request: ApprovalRequest = {
      id,
      type,
      planId,
      batchId,
      briefing,
      status: ApprovalRequestStatus.PENDING,
      createdAt: new Date().toISOString(),
    };
    this.requests.set(id, request);
    return request;
  }

  resolveRequest(
    id: string,
    decision: string,
    resolvedBy: string,
    notes?: string
  ): ApprovalRequest | undefined {
    const request = this.requests.get(id);
    if (!request) return undefined;

    request.status = decision === "approved"
      ? ApprovalRequestStatus.APPROVED
      : decision === "rejected"
        ? ApprovalRequestStatus.REJECTED
        : ApprovalRequestStatus.DEFERRED;

    request.resolvedAt = new Date().toISOString();
    request.resolvedBy = resolvedBy;
    request.decision = decision;
    request.notes = notes;

    return request;
  }

  getRequest(id: string): ApprovalRequest | undefined {
    return this.requests.get(id);
  }

  getPendingRequests(): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter(
      (r) => r.status === ApprovalRequestStatus.PENDING
    );
  }

  getRequestsForPlan(planId: string): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.planId === planId);
  }

  getRequestsForBatch(batchId: string): ApprovalRequest[] {
    return Array.from(this.requests.values()).filter((r) => r.batchId === batchId);
  }

  // ── Briefing Generation ────────────────────────────────────

  private generateBriefing(
    batch: ExecutionBatch,
    plan: ExecutionPlan,
    type: ApprovalType
  ): ApprovalBriefing {
    return {
      title: `Approval: ${batch.name}`,
      summary: `Batch ${batch.order}/${plan.batches.length} in plan "${plan.title}". ` +
        `Contains ${batch.tasks.length} tasks across ${batch.capabilities.length} capabilities.`,
      impact: batch.capabilities.join(", "),
      risks: this.getRisks(type, batch),
      alternatives: this.getAlternatives(type, batch),
      decisions: [
        `Approve batch "${batch.name}"`,
        `Approve with modifications`,
        `Reject with feedback`,
      ],
      context: {
        planId: plan.id,
        batchId: batch.id,
        discipline: batch.discipline,
        taskCount: batch.tasks.length,
        tokenBudget: batch.tokenBudget,
        estimatedDuration: batch.estimatedDuration,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private generateBriefingForPlan(
    plan: ExecutionPlan,
    type: ApprovalType
  ): ApprovalBriefing {
    const deploymentBatches = plan.batches.filter((b) =>
      b.capabilities.some((c) => c.includes("deploy"))
    );

    return {
      title: `Plan Approval: ${plan.title}`,
      summary: `Plan with ${plan.batches.length} batches, ${plan.phases.length} phases. ` +
        `${deploymentBatches.length} batches require deployment approval.`,
      impact: `Executing all ${plan.batches.length} batches across the platform`,
      risks: [
        "Deployment operations may affect production",
        ...deploymentBatches.map((b) => `Batch "${b.name}" deploys to ${b.capabilities.join(", ")}`),
      ],
      alternatives: [
        "Approve all batches",
        "Approve only non-deployment batches",
        "Request staged deployment plan",
      ],
      decisions: [
        "Approve full plan execution",
        "Approve with deployment hold",
        "Reject plan",
      ],
      context: {
        totalBatches: plan.batches.length,
        deploymentBatches: deploymentBatches.length,
        phases: plan.phases.length,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private getRisks(type: ApprovalType, batch: ExecutionBatch): string[] {
    const risks: string[] = [];
    if (type === ApprovalType.DEPLOYMENT) {
      risks.push("Affects production environment");
      risks.push("Potential downtime during deployment");
    }
    if (type === ApprovalType.INFRASTRUCTURE) {
      risks.push("Database changes may affect data integrity");
      risks.push("Rollback may be required if migration fails");
    }
    if (type === ApprovalType.SECURITY) {
      risks.push("Security-sensitive operations affect access control");
      risks.push("Changes may impact compliance posture");
    }
    if (type === ApprovalType.CONSTITUTIONAL) {
      risks.push("Large batch may exceed resource limits");
      risks.push("Multiple dependencies increase failure surface");
    }
    risks.push(...batch.tasks.map((t) => `Task "${t.name}" requires ${t.capabilityId}`));
    return risks;
  }

  private getAlternatives(type: ApprovalType, batch: ExecutionBatch): string[] {
    const alternatives: string[] = [];
    if (type === ApprovalType.DEPLOYMENT) {
      alternatives.push("Deploy to preview/staging first");
      alternatives.push("Split deployment into smaller steps");
    }
    if (type === ApprovalType.INFRASTRUCTURE) {
      alternatives.push("Run migration on staging first");
      alternatives.push("Create backup before migration");
    }
    if (type === ApprovalType.SECURITY) {
      alternatives.push("Security audit before execution");
      alternatives.push("Limited scope execution");
    }
    alternatives.push("Skip batch and continue with remaining work");
    alternatives.push("Defer to later execution phase");
    return alternatives;
  }

  // ── Reset for testing ──────────────────────────────────────

  reset(): void {
    this.requests.clear();
    this.requestCounter = 0;
  }
}