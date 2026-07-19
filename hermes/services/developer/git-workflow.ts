// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Git Workflow (Simulation)         │
// │ EPIC-003-002 · M8                                            │
// │ Governed git execution model: branch, commit, tag, push,      │
// │ rollback. SIMULATION-ONLY: no real git command ever runs.      │
// │ Every action is recorded as a SimGitEvent and is reversible.   │
// │ Push and production commit ALWAYS require explicit human       │
// │ approval — they can only be "performed" by a separate human    │
// │ action, never by the pipeline.                                 │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import type { DevelopmentWorkRequest } from "./work-request.js";

export type GitAction = "branch" | "commit" | "tag" | "push" | "rollback";

export interface SimGitEvent {
  at: string;
  action: GitAction;
  ref?: string;
  message?: string;
  /** Whether this action required (and had) a human approval token. */
  approvalRequired: boolean;
  approved: boolean;
  /** Always false in simulation — nothing was actually executed. */
  executedForReal: false;
  note: string;
}

export interface SimGitPlan {
  requestId: string;
  applicationId: string;
  branch: string;
  events: SimGitEvent[];
  /** True when at least one privileged action was correctly gated. */
  privilegedGated: number;
}

const SIM_BRANCH_PREFIX = "feat/sim-";

/** Build a governed, simulation-only git plan for a request. */
export function buildSimGitPlan(
  req: DevelopmentWorkRequest,
  opts: { approver?: string; approvedToken?: string },
): SimGitPlan {
  const approver = opts.approver ?? "sim-human";
  const token = opts.approvedToken;
  const events: SimGitEvent[] = [];
  const branch = `${SIM_BRANCH_PREFIX}${req.requestId}`;
  let privilegedGated = 0;

  const now = () => new Date().toISOString();

  // 1) Branch (non-privileged; sim record only).
  events.push({
    at: now(),
    action: "branch",
    ref: branch,
    approvalRequired: false,
    approved: true,
    executedForReal: false,
    note: `SIM branch created: ${branch} (no real git)`,
  });

  // 2) Commit — privileged in production.
  const commitPrivileged = req.env === "production";
  const commitApproved = !commitPrivileged || Boolean(token);
  if (commitPrivileged && !token) privilegedGated += 1;
  events.push({
    at: now(),
    action: "commit",
    ref: branch,
    message: `${req.kind}: ${req.title}`,
    approvalRequired: commitPrivileged,
    approved: commitApproved,
    executedForReal: false,
    note: commitApproved
      ? `SIM commit recorded (env=${req.env})`
      : `BLOCKED: production commit requires human approval token`,
  });

  // 3) Tag (non-privileged; sim record only).
  const tag = `v0-sim-${req.requestId}`;
  events.push({
    at: now(),
    action: "tag",
    ref: tag,
    approvalRequired: false,
    approved: true,
    executedForReal: false,
    note: `SIM tag recorded: ${tag}`,
  });

  // 4) Push — ALWAYS privileged, NEVER automatic.
  privilegedGated += 1; // push is always gated
  events.push({
    at: now(),
    action: "push",
    ref: branch,
    approvalRequired: true,
    approved: false,
    executedForReal: false,
    note: `BLOCKED: push requires explicit human approval (never automatic) — actor=${approver}`,
  });

  emitAudit("dev.git.sim-plan", req.requestedBy, {
    requestId: req.requestId,
    branch,
    privilegedGated,
  });

  return { requestId: req.requestId, applicationId: req.targetApplication, branch, events, privilegedGated };
}

/**
 * Simulate a rollback. In simulation this just records the intent; the real
 * rollback would only ever run after a human-approved decision. Reversible by
 * construction (a sim event is never destructive).
 */
export function simRollback(plan: SimGitPlan, actor: string): SimGitEvent {
  const ev: SimGitEvent = {
    at: new Date().toISOString(),
    action: "rollback",
    ref: plan.branch,
    approvalRequired: true,
    approved: false,
    executedForReal: false,
    note: `SIM rollback recorded for ${plan.branch} (requires human approval to execute for real)`,
  };
  emitAudit("dev.git.sim-rollback", actor, { requestId: plan.requestId, branch: plan.branch });
  return ev;
}

/** Render the sim git plan for operator visibility. */
export function renderSimGitPlan(plan: SimGitPlan): string {
  return [
    `── Sim Git Plan ${plan.requestId} ──`,
    `Branch: ${plan.branch}`,
    ...plan.events.map((e) => `  [${e.action}] ${e.note}`),
    `Privileged actions correctly gated: ${plan.privilegedGated}`,
  ].join("\n");
}
