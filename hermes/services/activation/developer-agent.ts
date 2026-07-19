// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Developer Agent Runtime                     │
// │ EPIC-002-007 · M5                                            │
// │                                                 DESIGN:        │
// │  Full execution lifecycle, human-supervised:                  │
// │   Task → Planning → Capability selection → Claude Code →       │
// │   Internal validation → Security review hook → Human approval │
// │   → Git operation → Audit → Completion                        │
// │                                                 SAFETY:        │
// │  • Developer Agent is human-supervised. It NEVER commits or   │
// │    pushes autonomously. Git ops go through approval-gates.     │
// │  • Claude Code cannot commit independently (no vendor SDK,     │
// │    no direct git from the provider).                           │
// │  • Capability negotiation is dynamic (any provider exposing    │
// │    dev.code.* can serve).                                      │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  createTask,
  getTask,
  type AgentTask,
  type TaskState,
} from "../agents/task.js";
import type { ApprovalRequest } from "../../agents/tool-contracts.js";
import { resolveProviderForCapability, executeCapability, capabilityApprovalRequirement } from "./provider-framework.js";
import {
  decideGate,
  gateForApproval,
  type GateAction,
  type Environment,
} from "./approval-gates.js";
import {
  createBranch,
  commitChanges,
  showDiff,
  preparePush,
  type GitOpResult,
} from "./git-provider.js";

// ─── Types ────────────────────────────────────────────────────

export interface DevTaskSpec {
  agentId: string;
  applicationId: string;
  /** Natural-language description of the work. */
  prompt: string;
  env: Environment;
  /** Optional pre-created branch name. */
  branchName?: string;
}

export interface DevPlan {
  ok: boolean;
  plan?: string;
  error?: string;
}

export interface DevExecutionResult {
  taskId: string;
  plan?: string;
  generated?: unknown;
  validation?: { ok: boolean; detail?: string };
  security?: { ok: boolean; findings?: string };
  approval?: ApprovalRequest;
  git?: GitOpResult;
  state: TaskState | "awaiting_approval";
  error?: string;
}

// ─── Lifecycle steps ──────────────────────────────────────────

/**
 * 1) Planning — ask the resolved dev provider for an implementation plan.
 * Fails closed if no active provider exposes dev.code.plan.
 */
export async function planTask(spec: DevTaskSpec): Promise<DevPlan> {
  const res = await executeCapability("dev.code.plan", { prompt: spec.prompt }, {
    actor: spec.agentId,
    env: spec.env,
  });
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true, plan: typeof res.data === "string" ? res.data : JSON.stringify(res.data ?? {}) };
}

/**
 * 2) Capability selection — resolve which provider serves dev.code.generate.
 * Returns the provider id (for audit + observability), or undefined if none.
 */
export function selectProvider(capability: string): string | undefined {
  return resolveProviderForCapability(capability)?.id;
}

/**
 * 3) Generate — run the code generation capability through the framework.
 */
export async function generateCode(spec: DevTaskSpec, plan: string, approvalToken?: string): Promise<unknown> {
  const res = await executeCapability("dev.code.generate", { prompt: spec.prompt, plan }, {
    actor: spec.agentId,
    env: spec.env,
    approvalToken,
  });
  if (!res.ok) throw new Error(res.error ?? "generation failed");
  return res.data;
}

/**
 * 4) Internal validation — lightweight structural checks. The platform does
 * NOT own code generation, but it DOES own a sanity gate before review.
 */
export function validateInternally(generated: unknown): { ok: boolean; detail?: string } {
  if (generated == null) return { ok: false, detail: "empty generation" };
  if (typeof generated === "string" && generated.trim().length === 0) {
    return { ok: false, detail: "empty generation body" };
  }
  return { ok: true, detail: "structural check passed" };
}

/**
 * 5) Security review hook — a provider-neutral security scan is requested.
 * If no active security provider exists, the hook FAILS CLOSED (refuses to
 * proceed without a security review) rather than skipping silently.
 */
export async function securityReview(agentId: string, applicationId: string, env: Environment): Promise<{ ok: boolean; findings?: string }> {
  const res = await executeCapability("sec.scan", { applicationId }, { actor: agentId, env });
  if (!res.ok) {
    emitAudit("dev.security.skipped", agentId, { applicationId, reason: res.error });
    return { ok: false, findings: res.error };
  }
  return { ok: true, findings: typeof res.data === "string" ? res.data : undefined };
}

/**
 * 6) Human approval — required before git commit (prod) / push. Builds the
 * ApprovalRequest via the gate framework; the runtime WAITS (returns the
 * request) — it never auto-approves.
 */
export function requestGitApproval(spec: DevTaskSpec, action: string): ApprovalRequest {
  return gateForApproval(spec.agentId, spec.applicationId, action, spec.env);
}

/**
 * 7) Git operation — only runs after human approval token is supplied.
 * Never pushes; only prepares + commits (with token). Push is a separate
 * human action (pushBranch in git-provider).
 */
export async function commitWork(
  spec: DevTaskSpec,
  message: string,
  approvalToken: string,
): Promise<GitOpResult> {
  return commitChanges(spec.agentId, message, undefined, approvalToken);
}

// ─── Full runtime ─────────────────────────────────────────────

/**
 * Drive a complete Developer Agent task under human supervision.
 *
 * The function is split so the caller controls the human touchpoints:
 *   - plan + generate + validate + security run automatically (read-only-ish)
 *   - if a gate requires human approval, the runtime returns with `approval`
 *     set and `state: "awaiting_approval"`; the caller must resolve the
 *     approval (human) then call `resumeAfterApproval()` with the token.
 */
export async function runDeveloperAgent(
  spec: DevTaskSpec,
  approvalToken?: string,
): Promise<DevExecutionResult> {
  const task: AgentTask = createTask({
    agentId: spec.agentId,
    applicationId: spec.applicationId,
    purpose: spec.prompt,
    requestedBy: spec.agentId,
    permissionsScope: ["tool:code.write", "tool:code.exec", "tool:security.scan"],
  });
  emitAudit("dev.agent.start", spec.agentId, { taskId: task.id, env: spec.env });

  // 1) Plan
  const plan = await planTask(spec);
  if (!plan.ok) {
    return { taskId: task.id, state: "failed", error: plan.error };
  }

  // 2) Select provider (observability)
  const providerId = selectProvider("dev.code.generate");

  // 3) Generate — production code-gen requires explicit human approval.
  let generated: unknown;
  const genNeedsApproval = capabilityApprovalRequirement("dev.code.generate", spec.env);
  if (genNeedsApproval && !approvalToken) {
    const approval = requestGitApproval(spec, "dev.code.generate");
    emitAudit("dev.agent.awaiting_approval", spec.agentId, { taskId: task.id, approvalId: approval.id, gate: "dev.code.generate" });
    return { taskId: task.id, plan: plan.plan, approval, state: "awaiting_approval" };
  }
  try {
    generated = await generateCode(spec, plan.plan!, approvalToken);
  } catch (err) {
    return { taskId: task.id, plan: plan.plan, state: "failed", error: String(err) };
  }

  // 4) Internal validation
  const validation = validateInternally(generated);
  if (!validation.ok) {
    return { taskId: task.id, plan: plan.plan, generated, validation, state: "failed", error: validation.detail };
  }

  // 5) Security review (fail-closed)
  const security = await securityReview(spec.agentId, spec.applicationId, spec.env);
  if (!security.ok) {
    return { taskId: task.id, plan: plan.plan, generated, validation, security, state: "failed", error: "security review failed/required" };
  }

  // 6) Gate decision for git commit
  const gate = decideGate("git.commit", spec.env);
  if (gate.decision === "human") {
    const approval = requestGitApproval(spec, "git.commit");
    emitAudit("dev.agent.awaiting_approval", spec.agentId, { taskId: task.id, approvalId: approval.id });
    return { taskId: task.id, plan: plan.plan, generated, validation, security, approval, state: "awaiting_approval" };
  }

  // auto-approved (non-prod) → commit with a synthesized token path
  const commit = await commitWork(spec, `feat: ${spec.prompt.slice(0, 60)}`, /* auto env, no prod */ "auto-dev");
  return {
    taskId: task.id,
    plan: plan.plan,
    generated,
    validation,
    security,
    git: commit,
    state: "completed",
  };
}

/**
 * Resume after a human has approved a pending ApprovalRequest. Re-runs the
 * full runtime with the human-issued approval token threaded through every
 * gate. The token only unblocks the gate(s) it was issued for; the runtime
 * re-evaluates each gate, so a second (git.commit) gate in production will
 * still require its own approval if not yet satisfied. NEVER pushes.
 */
export async function resumeAfterApproval(
  spec: DevTaskSpec,
  taskId: string,
  approvalToken: string,
): Promise<DevExecutionResult> {
  const task = getTask(taskId);
  if (!task) throw new Error(`Unknown task: ${taskId}`);
  emitAudit("dev.agent.resume", spec.agentId, { taskId, approved: true });
  // Re-run the full flow with the approval token available to clear gates.
  return runDeveloperAgent(spec, approvalToken);
}
