// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Human Approval Gates                        │
// │ EPIC-002-007 · M6                                            │
// │                                                 SAFETY:        │
// │  • Centralizes the rule: a human MUST approve before:         │
// │      – git commit (prod) / git push                           │
// │      – deploy                                                 │
// │      – destructive actions (delete, drop, force)              │
// │      – secrets read/write                                     │
// │      – production access                                      │
// │  • Fail-closed: anything not explicitly auto-approved requires │
// │    human sign-off. No autonomous execution path exists.        │
// │  • Reuses hermes/agents/approval (human-gated queue).          │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  type ApprovalRequest,
  requestApproval,
} from "../../agents/tool-contracts.js";

export type GateAction =
  | "git.commit"
  | "git.push"
  | "deploy"
  | "destructive"
  | "secret.read"
  | "secret.write"
  | "production.access"
  | "provider.enable"
  | "provider.retire";

export type Environment = "development" | "staging" | "production";

/**
 * Policy table: which actions require human approval in which envs.
 * Anything not listed as auto is human-gated by default (fail-closed).
 */
const GATE_POLICY: Record<GateAction, { auto: Environment[]; human: Environment[] }> = {
  "git.commit": { auto: ["development", "staging"], human: ["production"] },
  "git.push": { auto: [], human: ["development", "staging", "production"] }, // NEVER auto
  deploy: { auto: [], human: ["development", "staging", "production"] }, // NEVER auto
  destructive: { auto: [], human: ["development", "staging", "production"] }, // NEVER auto
  "secret.read": { auto: [], human: ["development", "staging", "production"] },
  "secret.write": { auto: [], human: ["development", "staging", "production"] },
  "production.access": { auto: [], human: ["production"] },
  "provider.enable": { auto: [], human: ["development", "staging", "production"] },
  "provider.retire": { auto: [], human: ["development", "staging", "production"] },
};

export interface GateDecision {
  action: GateAction;
  env: Environment;
  /** "auto" = may proceed without a human; "human" = must get approval. */
  decision: "auto" | "human";
  reason: string;
}

/**
 * Decide whether an action may proceed without a human. Fail-closed:
 * if the action/env is not explicitly in the auto list, it requires a human.
 */
export function decideGate(action: GateAction, env: Environment): GateDecision {
  const pol = GATE_POLICY[action];
  // Unknown / non-policy actions (e.g. capability-level code-gen approvals)
  // fail closed to a human decision by default.
  if (!pol || !pol.auto.includes(env)) {
    return {
      action,
      env,
      decision: "human",
      reason: `requires human approval (${action} in ${env})`,
    };
  }
  return { action, env, decision: "auto", reason: "auto-approved by policy" };
}

/**
 * Request human approval for a gated action. Returns a pending ApprovalRequest
 * (integrated with the existing human-gated approval queue). The caller MUST
 * NOT proceed until the request is resolved "approved" by a human.
 */
export function gateForApproval(
  agentId: string,
  applicationId: string,
  action: string,
  env: Environment,
): ApprovalRequest {
  const d = decideGate(action as GateAction, env);
  emitAudit("gate.request", agentId, { action, env, decision: d.decision });
  // Map gate action → approval kind expected by the queue.
  return requestApproval(agentId, applicationId, env, gateActionToToolAction(action), gateActionToNamespace(action));
}

function gateActionToToolAction(a: string): "read" | "write" | "exec" {
  if (a === "git.commit" || a === "git.push" || a === "secret.write" || a === "deploy" || a === "destructive") return "write";
  if (a === "production.access") return "exec";
  if (a.startsWith("dev.code.")) return "write";
  return "read";
}

function gateActionToNamespace(a: string): "tool:code.read" | "tool:code.write" | "tool:code.exec" | "tool:security.scan" | "tool:docs.read" | "tool:docs.write" | "tool:research.query" | "tool:monitor.read" | "tool:monitor.alert" {
  switch (a) {
    case "git.commit":
    case "git.push":
      return "tool:code.write";
    case "secret.read":
    case "secret.write":
      return "tool:security.scan";
    case "deploy":
    case "destructive":
    case "production.access":
      return "tool:code.exec";
    default:
      return "tool:code.write";
  }
}

/**
 * Guard helper: throws if the decision is "human" and no approval token is
 * present. Used by git/provider operations to enforce fail-closed.
 */
export function enforceGate(
  action: GateAction,
  env: Environment,
  approvalToken?: string,
): void {
  const d = decideGate(action, env);
  if (d.decision === "human" && !approvalToken) {
    emitAudit("gate.denied", "system", { action, env, reason: "missing approval token" });
    throw new Error(`Gate denied: ${d.reason}`);
  }
}
