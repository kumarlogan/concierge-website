// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Developer → Security Integration   │
// │ EPIC-003-003 · M5                                            │
// │ After developer execution completes, automatically create a     │
// │ security review task. The review is ALWAYS approval-controlled  │
// │ and never auto-remediates or auto-blocks beyond governed policy.│
// │                                                             │
// │ Flow:                                                        │
// │   developer.complete → security.review.request → security.agent │
// │                    → SecurityReviewPackage                    │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  normalizeScanRequest,
  defaultChecks,
  type SecurityScanRequest,
  type SecurityReviewPackage,
  type ApprovalRequirement,
} from "./security-work-model.js";
import { runSecurityReview } from "./security-agent.js";
import type { DevelopmentWorkRequest } from "../developer/work-request.js";

/**
 * Build a security scan request from a completed development request.
 * Approval is REQUIRED for production; otherwise governed by the dev request's
 * own constraint set. This is the single hand-off point — it never executes.
 */
export function createSecurityReviewRequest(
  devReq: DevelopmentWorkRequest,
  devRunSummary: { requestId: string; recommendation: string },
): SecurityScanRequest {
  const requiresApproval = devReq.env === "production";
  const approvalRequirement: ApprovalRequirement = {
    required: requiresApproval,
    reason: requiresApproval
      ? "Production-targeted change requires human approval before security review progression"
      : "Development change security review (approval-gated for remediation/deploy only)",
    appliesIn: ["production", "staging"],
  };

  emitAudit("sec.review.request", devReq.requestedBy, {
    sourceRequestId: devReq.requestId,
    devRecommendation: devRunSummary.recommendation,
    env: devReq.env,
    approvalRequired: requiresApproval,
  });

  return normalizeScanRequest({
    sourceRequestId: devReq.requestId,
    title: `Security review for ${devReq.title}`,
    targetApplication: devReq.targetApplication,
    targetScope: devReq.kind,
    env: devReq.env,
    severityPolicy: devReq.env === "production" ? "medium" : "high",
    requiredChecks: defaultChecks(devReq.env),
    approvalRequirement,
    constraints: (devReq.constraints ?? []).map((c) => c.description),
    requestedBy: devReq.requestedBy,
  });
}

/**
 * Run the security review for a completed developer task. Returns the review
 * package. The caller (orchestrator) decides whether to block autonomous
 * progression — this function only produces the governed assessment.
 */
export async function runSecurityForDeveloperTask(
  agentId: string,
  devReq: DevelopmentWorkRequest,
  devRunSummary: { requestId: string; recommendation: string },
): Promise<SecurityReviewPackage> {
  const scanReq = createSecurityReviewRequest(devReq, devRunSummary);
  const pkg = await runSecurityReview(agentId, scanReq);
  emitAudit("sec.review.delivered", agentId, {
    requestId: scanReq.requestId,
    sourceRequestId: devReq.requestId,
    riskLevel: pkg.riskLevel,
    blocksAutonomous: pkg.blocksAutonomous,
  });
  return pkg;
}
