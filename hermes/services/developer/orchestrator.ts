// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Pipeline Orchestrator             │
// │ EPIC-003-002 · TIES M1–M8                                     │
// │ Hermes orchestrates the complete engineering workflow. Agents  │
// │ specialize; providers execute; Claude Code is one provider.    │
// │ Human approval + audit + RBAC + workforce lifecycle preserved. │
// │ No production changes; git is simulation-only.                 │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import { planEngineering } from "./engineering-planner.js";
import {
  runDeveloperTask,
  type DeveloperRuntimeResult,
} from "./developer-runtime.js";
import { runQa, type QaResult } from "./qa-pipeline.js";
import { runSecurity, type SecurityResult } from "./security-pipeline.js";
import { recommendDocs, type DocRecommendation } from "./docs-pipeline.js";
import { buildDeveloperReview, renderDeveloperReview, type DeveloperReviewPackage } from "./review-package.js";
import { buildSimGitPlan, renderSimGitPlan, type SimGitPlan } from "./git-workflow.js";
import type { DevelopmentWorkRequest } from "./work-request.js";

export interface DeveloperPipelineRun {
  requestId: string;
  goal: ReturnType<typeof planEngineering>["goal"];
  developer: DeveloperRuntimeResult[];
  qa: QaResult[];
  security: SecurityResult[];
  docs: DocRecommendation[];
  review: DeveloperReviewPackage;
  git: SimGitPlan;
  /** Executive summary for the human. */
  report: string;
}

export interface OrchestratorOptions {
  actor: string;
  /** Human approval token (required for staging/prod generation + prod commit). */
  approvalToken?: string;
  /** Whether approval gates were enforced upstream (for security verification). */
  approvalsEnforced?: boolean;
  approver?: string;
}

/**
 * Run the full Developer Automation pipeline for one request.
 *
 * Flow: Feature Request → Planner → Task Graph → Developer → QA → Security →
 * Documentation → Review Package → (human approval) → Git Simulation.
 *
 * The function returns the aggregated result and a git *simulation* plan. It
 * NEVER commits or pushes for real. If a privileged action lacks approval, the
 * developer stage returns awaiting_approval and the run still completes its
 * read-only aggregation so the human sees the full picture.
 */
export async function runDeveloperPipeline(
  req: DevelopmentWorkRequest,
  opts: OrchestratorOptions,
): Promise<DeveloperPipelineRun> {
  const approvalsEnforced = opts.approvalsEnforced ?? true;

  // 1) Planner → Task Graph
  const { goal, tasks } = planEngineering(req);

  // 2) Developer Agent runtime (Claude Code provider via capability negotiation)
  const implTask = tasks.find((t) => t.stage === "implement")!;
  const planTask = tasks.find((t) => t.stage === "plan")!;
  const developer: DeveloperRuntimeResult[] = [];
  developer.push(await runDeveloperTask(planTask, req, opts));
  developer.push(await runDeveloperTask(implTask, req, opts));

  // 3) QA Pipeline
  const qa = runQa(req);

  // 4) Security Pipeline
  const security = runSecurity(req, { approvalsEnforced });

  // 5) Documentation Pipeline
  const docs = recommendDocs(req);

  // 6) Review Package (aggregates all contributions)
  const review = buildDeveloperReview({ req, developer, qa, security, docs });

  // 7) Git Workflow (simulation only)
  const git = buildSimGitPlan(req, { approver: opts.approver ?? "sim-human", approvedToken: opts.approvalToken });

  const report = [
    `══ Developer Automation Pipeline — ${req.kind}: ${req.title} ══`,
    `Request: ${req.requestId} · App: ${req.targetApplication} · Env: ${req.env}`,
    `Tasks planned: ${tasks.length} (waves derived by Execution Platform planner)`,
    `Developer: ${developer.map((d) => `${d.capability}=${d.state}`).join(", ")}`,
    `QA: ${qa.filter((q) => q.ok).length}/${qa.length} suites passed`,
    `Security: ${security.filter((s) => s.ok).length}/${security.length} checks passed`,
    `Docs recommended: ${docs.map((d) => d.kind).join(", ") || "none"}`,
    `Review recommendation: ${review.recommendation}`,
    `Git: simulation-only (${git.privilegedGated} privileged actions gated)`,
    "",
    renderDeveloperReview(review),
    "",
    renderSimGitPlan(git),
  ].join("\n");

  emitAudit("dev.pipeline.complete", opts.actor, {
    requestId: req.requestId,
    recommendation: review.recommendation,
    tasks: tasks.length,
  });

  return { requestId: req.requestId, goal, developer, qa, security, docs, review, git, report };
}
