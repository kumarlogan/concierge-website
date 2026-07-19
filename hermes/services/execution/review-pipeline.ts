// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Review Pipeline                     │
// │ EPIC-003-001 · DELIVERABLE 4                                   │
// │ Aggregates multi-agent outputs, detects conflicts, produces a  │
// │ unified review package, and requires explicit human approval   │
// │ before any privileged action (deploy/git.push/secret/destructive).│
// │ SAFETY: read-only aggregation + a human gate. Never performs a  │
// │ privileged action itself.                                      │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import { gateForApproval } from "../activation/approval-gates.js";

/** A single agent's contribution to a review. */
export interface AgentContribution {
  agentId: string;
  domain: "development" | "quality" | "security" | "docs" | "research" | "ops";
  capability: string;
  /** The artifact the agent produced (free-form; never executed here). */
  artifact: unknown;
  /** Whether the contribution touches a privileged surface. */
  privileged: boolean;
  /** Free-form notes from the agent. */
  notes?: string;
}

/** A detected conflict between two contributions. */
export interface Conflict {
  kind: "file-overlap" | "schema-overlap" | "policy-violation" | "capability-clash";
  between: [string, string]; // agent ids
  detail: string;
  severity: "low" | "medium" | "high";
}

/** The unified review package. */
export interface ReviewPackage {
  reviewId: string;
  goalId: string;
  applicationId: string;
  createdAt: string;
  contributions: AgentContribution[];
  conflicts: Conflict[];
  /** Whether any privileged action is implied by the package. */
  requiresHumanApproval: boolean;
  /** The human approval request (if privileged). */
  approvalRequest?: ReturnType<typeof gateForApproval>;
  /** Summary line for operator visibility. */
  summary: string;
}

export class ReviewError extends Error {}

let reviewSeq = 0;
function genReviewId(): string {
  reviewSeq += 1;
  return `review_${reviewSeq}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Aggregate agent contributions into a unified review package.
 *
 * Conflict detection (lightweight, deterministic):
 *  - file-overlap: two contributions reference the same `targetFile`.
 *  - schema-overlap: two contributions reference the same `targetSchema`.
 *  - policy-violation: a contribution asserts a privileged action without a
 *    prior human gate.
 *  - capability-clash: two agents claimed the same capability for the same item.
 *
 * If any contribution is privileged (or a policy violation is found), a human
 * approval request is created via the existing approval-gate layer (fail-closed).
 */
export function aggregateReview(input: {
  goalId: string;
  applicationId: string;
  contributions: AgentContribution[];
  requestedBy: string;
  env: "development" | "staging" | "production";
}): ReviewPackage {
  const conflicts = detectConflicts(input.contributions);
  const hasPrivileged = input.contributions.some((c) => c.privileged);
  const policyViolation = conflicts.some((c) => c.kind === "policy-violation");
  const requiresHumanApproval = hasPrivileged || policyViolation;

  const pkg: ReviewPackage = {
    reviewId: genReviewId(),
    goalId: input.goalId,
    applicationId: input.applicationId,
    createdAt: new Date().toISOString(),
    contributions: input.contributions,
    conflicts,
    requiresHumanApproval,
    summary: buildSummary(input.contributions, conflicts, requiresHumanApproval),
  };

  if (requiresHumanApproval) {
    // Use the existing human-gated approval layer — fail-closed by construction.
    pkg.approvalRequest = gateForApproval(
      input.requestedBy,
      input.applicationId,
      hasPrivileged ? "git.push" : "deploy",
      input.env,
    );
  }

  emitAudit("execution.review.aggregated", input.requestedBy, {
    reviewId: pkg.reviewId,
    goalId: input.goalId,
    contributions: input.contributions.length,
    conflicts: conflicts.length,
    requiresHumanApproval,
  });

  return pkg;
}

/** Deterministic conflict detection over contributions. */
export function detectConflicts(contributions: AgentContribution[]): Conflict[] {
  const conflicts: Conflict[] = [];

  // file-overlap / schema-overlap via artifact metadata.
  const byFile = new Map<string, string[]>();
  const bySchema = new Map<string, string[]>();
  const byCapability = new Map<string, string[]>();

  for (const c of contributions) {
    const meta = (c.artifact && typeof c.artifact === "object"
      ? (c.artifact as Record<string, unknown>)
      : {}) as Record<string, unknown>;
    if (typeof meta.targetFile === "string") {
      byFile.set(meta.targetFile, [...(byFile.get(meta.targetFile) ?? []), c.agentId]);
    }
    if (typeof meta.targetSchema === "string") {
      bySchema.set(meta.targetSchema, [...(bySchema.get(meta.targetSchema) ?? []), c.agentId]);
    }
    byCapability.set(c.capability, [...(byCapability.get(c.capability) ?? []), c.agentId]);

    // policy-violation: privileged contribution must carry an approval token ref.
    if (c.privileged && typeof meta.approvalToken !== "string") {
      conflicts.push({
        kind: "policy-violation",
        between: [c.agentId, c.agentId],
        detail: `Privileged contribution from ${c.agentId} (${c.capability}) has no human approval token`,
        severity: "high",
      });
    }
  }

  for (const [file, agents] of byFile) {
    if (agents.length > 1) {
      conflicts.push({
        kind: "file-overlap",
        between: [agents[0], agents[1]],
        detail: `Multiple agents modify ${file}: ${agents.join(", ")}`,
        severity: "medium",
      });
    }
  }
  for (const [schema, agents] of bySchema) {
    if (agents.length > 1) {
      conflicts.push({
        kind: "schema-overlap",
        between: [agents[0], agents[1]],
        detail: `Multiple agents modify schema ${schema}: ${agents.join(", ")}`,
        severity: "high",
      });
    }
  }
  for (const [cap, agents] of byCapability) {
    if (agents.length > 1) {
      conflicts.push({
        kind: "capability-clash",
        between: [agents[0], agents[1]],
        detail: `Agents ${agents.join(", ")} both claimed capability ${cap}`,
        severity: "low",
      });
    }
  }

  return conflicts;
}

function buildSummary(
  contributions: AgentContribution[],
  conflicts: Conflict[],
  requiresApproval: boolean,
): string {
  const domains = [...new Set(contributions.map((c) => c.domain))].join(", ");
  const high = conflicts.filter((c) => c.severity === "high").length;
  return [
    `Contributions: ${contributions.length} (${domains})`,
    `Conflicts: ${conflicts.length} (${high} high)`,
    requiresApproval ? "Human approval REQUIRED before privileged action" : "No privileged action implied",
  ].join(" · ");
}

/**
 * Produce a human-facing review summary (operator visibility). Pure read.
 */
export function reviewSummary(pkg: ReviewPackage): string {
  return [
    `Review ${pkg.reviewId} · Goal ${pkg.goalId} · App ${pkg.applicationId}`,
    pkg.summary,
    pkg.conflicts.length
      ? `Conflicts:\n${pkg.conflicts.map((c) => `  - [${c.severity}] ${c.kind}: ${c.detail}`).join("\n")}`
      : "No conflicts detected.",
    pkg.approvalRequest
      ? `Approval: ${pkg.approvalRequest.state} (${pkg.approvalRequest.action}) — human must resolve before privileged action`
      : "No approval requested.",
  ].join("\n");
}

/** Test/reset helper. */
export function _clearReviews(): void {
  reviewSeq = 0;
}
