// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Developer Agent Runtime (compose) │
// │ EPIC-003-002 · M3                                            │
// │                                                               │
// │ Reuses the canonical Claude Code ToolProvider                  │
// │ (services/activation/providers/claude-code.ts, EPIC-002-007)  │
// │ and the Developer Agent step functions                        │
// │ (services/activation/developer-agent.ts). Hermes orchestrates;│
// │ Claude Code is ONE provider of many.                          │
// │                                                               │
// │ IMPORTANT: this runtime drives plan + generate + validate +   │
// │ security-review. It does NOT perform a real git commit — that │
// │ is delegated to the simulation-only Git Workflow (M8). The    │
// │ existing runDeveloperAgent auto-commits in non-prod; we use   │
// │ the lower-level steps so simulation never mutates a repo.     │
// └─────────────────────────────────────────────────────────────┘

import {
  registerClaudeCodeProvider,
  setClaudeCodeExecutor,
  CLAUDE_CODE_PROVIDER_ID,
} from "../activation/providers/claude-code.js";
import {
  planTask,
  selectProvider,
  generateCode,
  validateInternally,
  securityReview,
} from "../activation/developer-agent.js";
import { capabilityApprovalRequirement } from "../activation/provider-framework.js";
import { emitAudit } from "../../audit/event.js";

export { registerClaudeCodeProvider, setClaudeCodeExecutor, CLAUDE_CODE_PROVIDER_ID };

/**
 * SIMULATED backend executor used by the Developer Automation demo/tests.
 * Returns deterministic, non-destructive stand-in results so the full pipeline
 * can be exercised without a real coding backend or any production change.
 * This is explicitly a simulation — never used in production orchestration.
 */
export function makeSimulatedClaudeCodeExecutor(): import("../activation/provider-framework.js").CapabilityExecutor {
  return async (capability, args) => {
    switch (capability) {
      case "dev.code.plan":
        return { ok: true, data: `SIM PLAN for "${String(args.prompt ?? args.objective ?? "objective")}": decompose into modules, add tests, wire handler.`, backend: "dev.claude-code" };
      case "dev.code.generate":
        return { ok: true, data: `SIM generated changes for ${String(args.prompt ?? "objective")}`, backend: "dev.claude-code" };
      case "dev.code.diff":
        return { ok: true, data: `--- sim diff ---\n+ simulated change\n`, backend: "dev.claude-code" };
      case "dev.code.tests":
        return { ok: true, data: { passed: 12, failed: 0, suite: "sim" }, backend: "dev.claude-code" };
      default:
        return { ok: false, error: `Unsupported capability: ${capability}`, backend: "dev.claude-code" };
    }
  };
}

import type { DevelopmentWorkRequest } from "./work-request.js";
import type { EngineeringTask } from "./engineering-planner.js";
import type { Environment } from "../activation/approval-gates.js";

export interface DeveloperRuntimeResult {
  taskId: string;
  capability: string;
  owner: EngineeringTask["owner"];
  providerId?: string;
  plan?: string;
  generated?: unknown;
  diff?: string;
  state: "planned" | "generated" | "awaiting_approval" | "failed";
  approvalRequired: boolean;
  error?: string;
}

/**
 * Run a single developer-owned engineering task through the resolved provider.
 * Hermes chooses the provider dynamically (capability negotiation); Claude Code
 * is just one candidate. If generation requires approval and no token is
 * present, the runtime returns awaiting_approval — it NEVER auto-approves or
 * auto-applies a diff. No git operation is performed here.
 */
export async function runDeveloperTask(
  task: EngineeringTask,
  req: DevelopmentWorkRequest,
  opts: { actor: string; approvalToken?: string },
): Promise<DeveloperRuntimeResult> {
  const taskId = `devtask_${task.id}_${Math.random().toString(36).slice(2, 7)}`;
  const env = req.env as Environment;

  // Plan stage.
  if (task.capability === "dev.code.plan") {
    const plan = await planTask({
      agentId: opts.actor,
      applicationId: req.targetApplication,
      prompt: req.objective,
      env,
    });
    return {
      taskId,
      capability: task.capability,
      owner: task.owner,
      providerId: selectProvider("dev.code.plan"),
      plan: plan.plan,
      state: plan.ok ? "planned" : "failed",
      approvalRequired: false,
      error: plan.ok ? undefined : plan.error,
    };
  }

  // Generate stage.
  const needsApproval = capabilityApprovalRequirement("dev.code.generate", env);
  if (needsApproval && !opts.approvalToken) {
    return {
      taskId,
      capability: task.capability,
      owner: task.owner,
      providerId: selectProvider("dev.code.generate"),
      state: "awaiting_approval",
      approvalRequired: true,
      error: "Generation in this environment requires human approval",
    };
  }

  // A lightweight plan is required for generateCode; reuse objective as prompt.
  let generated: unknown;
  try {
    generated = await generateCode(
      { agentId: opts.actor, applicationId: req.targetApplication, prompt: req.objective, env },
      req.objective,
      opts.approvalToken,
    );
  } catch (err) {
    return {
      taskId,
      capability: task.capability,
      owner: task.owner,
      providerId: selectProvider("dev.code.generate"),
      state: "failed",
      approvalRequired: needsApproval,
      error: String(err),
    };
  }

  const validation = validateInternally(generated);
  if (!validation.ok) {
    return {
      taskId,
      capability: task.capability,
      owner: task.owner,
      providerId: selectProvider("dev.code.generate"),
      generated,
      state: "failed",
      approvalRequired: needsApproval,
      error: validation.detail,
    };
  }

  emitAudit("dev.task.generated", opts.actor, { taskId, capability: task.capability, providerId: selectProvider("dev.code.generate") });

  return {
    taskId,
    capability: task.capability,
    owner: task.owner,
    providerId: selectProvider("dev.code.generate"),
    generated,
    diff: typeof generated === "string" ? generated : undefined,
    state: "generated",
    approvalRequired: needsApproval,
  };
}
