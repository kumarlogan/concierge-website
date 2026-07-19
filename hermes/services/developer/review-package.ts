// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Review Package                    │
// │ EPIC-003-002 · M7                                            │
// │ Aggregates every agent result into a unified review package.   │
// │ Includes: summary, changed files, test results, security,      │
// │ risks, recommendation, approval requirements.                  │
// │ Reads/aggregates ONLY. Never commits. Never pushes.            │
// └─────────────────────────────────────────────────────────────┘

import { aggregateReview, reviewSummary, type AgentContribution, type ReviewPackage } from "../execution/review-pipeline.js";
import type { DevelopmentWorkRequest } from "./work-request.js";
import type { QaResult } from "./qa-pipeline.js";
import type { SecurityResult } from "./security-pipeline.js";
import type { DocRecommendation } from "./docs-pipeline.js";
import type { DeveloperRuntimeResult } from "./developer-runtime.js";
import { emitAudit } from "../../audit/event.js";

export interface DeveloperReviewPackage {
  requestId: string;
  base: ReviewPackage;
  /** Human-readable executive summary. */
  summary: string;
  /** Files the developer agent proposed to change (from sim/diff metadata). */
  changedFiles: string[];
  /** QA roll-up. */
  testResults: { passed: number; failed: number; suites: number; ok: boolean };
  /** Security roll-up. */
  security: { checks: number; failed: number; findings: string[]; ok: boolean };
  /** Risk assessment carried from the request + pipeline outcomes. */
  risks: { estimated: DevelopmentWorkRequest["estimatedRisk"]; openFindings: number };
  /** Whether to proceed (false if any gate/security blocks). */
  recommendation: "approve" | "changes-requested" | "blocked";
  /** What human approval is required before git ops (commit/push). */
  approvalRequirements: string[];
}

export interface ReviewInputs {
  req: DevelopmentWorkRequest;
  developer: DeveloperRuntimeResult[];
  qa: QaResult[];
  security: SecurityResult[];
  docs: DocRecommendation[];
}

/**
 * Build the developer review package. Composes the existing aggregateReview
 * (which performs conflict detection + human-gate creation) and layers the
 * pipeline-specific roll-up on top. FAIL-CLOSED: any security failure or any
 * unresolved conflict forces recommendation = "blocked".
 */
export function buildDeveloperReview(input: ReviewInputs): DeveloperReviewPackage {
  const { req, developer, qa, security, docs } = input;

  // Compose agent contributions from each pipeline.
  const contributions: AgentContribution[] = [];

  for (const d of developer) {
    contributions.push({
      agentId: d.providerId ?? "developer-agent",
      domain: "development",
      capability: d.capability,
      artifact: {
        targetFile: `sim/${d.capability.replace(/\./g, "_")}.ts`,
        diffRef: (d.generated as Record<string, unknown>)?.diffRef,
        approvalToken: "sim-token",
      },
      privileged: false,
      notes: d.state === "failed" ? `developer task failed: ${d.error}` : `developer ${d.capability} ${d.state}`,
    });
  }
  for (const q of qa) {
    contributions.push({
      agentId: "qa-agent",
      domain: "quality",
      capability: q.capability,
      artifact: { qaKind: q.kind, passed: q.passed, failed: q.failed, targetFile: `sim/qa_${q.kind}.ts`, approvalToken: "sim-token" },
      privileged: false,
      notes: q.detail,
    });
  }
  for (const s of security) {
    contributions.push({
      agentId: "security-agent",
      domain: "security",
      capability: s.capability,
      artifact: { checkKind: s.kind, findings: s.findings, targetFile: `sim/sec_${s.kind}.ts`, approvalToken: "sim-token" },
      privileged: false,
      notes: s.ok ? `security ${s.kind} passed` : `security ${s.kind} found ${s.findings.length} issue(s)`,
    });
  }
  for (const doc of docs) {
    contributions.push({
      agentId: "documentation-agent",
      domain: "docs",
      capability: doc.capability,
      artifact: { docKind: doc.kind, justified: doc.justified, targetFile: `docs/sim_${doc.kind}.md`, approvalToken: "sim-token" },
      privileged: false,
      notes: doc.justified ? `doc: ${doc.title}` : `doc skipped: ${doc.title}`,
    });
  }

  const base = aggregateReview({
    goalId: `goal_${req.requestId}`,
    applicationId: req.targetApplication,
    contributions,
    requestedBy: req.requestedBy,
    env: req.env,
  });

  // Roll-ups.
  const qaPassed = qa.reduce((a, q) => a + q.passed, 0);
  const qaFailed = qa.reduce((a, q) => a + q.failed, 0);
  const qaOk = qaFailed === 0 && qa.every((q) => q.ok);

  const secFailed = security.filter((s) => !s.ok).length;
  const secFindings = security.flatMap((s) => s.findings);
  const secOk = secFailed === 0;

  const changedFiles = developer
    .map((d) => (d.generated as Record<string, unknown>)?.filesTouched)
    .filter(Array.isArray)
    .flat() as string[];
  if (changedFiles.length === 0) changedFiles.push("src/handlers/sim.ts");

  const openFindings = secFindings.length + (qaOk ? 0 : qaFailed);

  let recommendation: DeveloperReviewPackage["recommendation"] = "approve";
  if (!secOk || base.conflicts.some((c) => c.severity === "high") || !qaOk) {
    recommendation = "blocked";
  } else if (base.conflicts.length > 0 || base.requiresHumanApproval) {
    recommendation = "changes-requested";
  }

  const approvalRequirements = buildApprovalRequirements(req, recommendation);

  const pkg: DeveloperReviewPackage = {
    requestId: req.requestId,
    base,
    summary: [
      reviewSummary(base),
      `Changed files: ${changedFiles.length}`,
      `Tests: ${qaPassed} passed / ${qaFailed} failed`,
      `Security: ${security.length - secFailed}/${security.length} checks passed`,
      `Recommendation: ${recommendation}`,
    ].join("\n"),
    changedFiles,
    testResults: { passed: qaPassed, failed: qaFailed, suites: qa.length, ok: qaOk },
    security: { checks: security.length, failed: secFailed, findings: secFindings, ok: secOk },
    risks: { estimated: req.estimatedRisk, openFindings },
    recommendation,
    approvalRequirements,
  };

  emitAudit("dev.review.built", req.requestedBy, {
    requestId: req.requestId,
    recommendation,
    conflicts: base.conflicts.length,
    secFailed,
  });

  return pkg;
}

function buildApprovalRequirements(req: DevelopmentWorkRequest, rec: DeveloperReviewPackage["recommendation"]): string[] {
  const reqs: string[] = [];
  if (req.env === "production") reqs.push("git.commit requires human approval token (production)");
  if (req.env === "staging" || req.env === "production") reqs.push("dev.code.generate requires human approval token");
  reqs.push("git.push requires explicit human approval (never automatic)");
  if (rec === "blocked") reqs.push("BLOCKED: resolve security/QA/conflict findings before any git operation");
  return reqs;
}

/** Render the package for operator visibility (Telegram-safe text). */
export function renderDeveloperReview(pkg: DeveloperReviewPackage): string {
  return [
    `── Developer Review ${pkg.requestId} ──`,
    pkg.summary,
    pkg.approvalRequirements.length ? `\nApproval required:\n${pkg.approvalRequirements.map((a) => `  • ${a}`).join("\n")}` : "\nNo approval required (simulation).",
  ].join("\n");
}
