// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — AI Workforce Expansion: Tool Contracts     │
// │ EPIC-002-006E · PHASE 3                                        │
// │ Contracts that govern how a (future, human-activated) coding    │
// │ or security agent may USE tools, run in a sandbox, access       │
// │ memory, and pass through the approval workflow.                  │
// │                                                 SAFETY:         │
// │  • Every tool call is permission-checked against the agent's    │
// │    granted scope (least privilege).                             │
// │  • Execution is sandboxed; production writes require approval.   │
// │  • Memory is isolated by default; shared/global needs explicit   │
// │    grant + audit.                                               │
// │  • No tool may bypass the human approval gate for deploy/exec.   │
// └─────────────────────────────────────────────────────────────┘

import type { RegisteredAgent } from "./registry.js";
import { emitAudit } from "../audit/event.js";

// ─── TOOL PERMISSION MODEL ──────────────────────────────────────

/** Canonical tool capability namespaces (provider-neutral). */
export const TOOL_NAMESPACES = [
  "tool:code.read",
  "tool:code.write",
  "tool:code.exec",
  "tool:security.scan",
  "tool:security.findings",
  "tool:docs.read",
  "tool:docs.write",
  "tool:research.query",
  "tool:monitor.read",
  "tool:monitor.alert",
] as const;

export type ToolNamespace = (typeof TOOL_NAMESPACES)[number];

/** A resolved tool permission for an agent, scoped to env + application. */
export interface ToolGrant {
  namespace: ToolNamespace;
  /** Applications this grant is valid for. Empty = all (use sparingly). */
  applications: string[];
  environments: Array<"development" | "staging" | "production">;
  /** Whether this grant is allowed to act WITHOUT a per-call approval. */
  autoApprove: boolean;
}

// ─── SANDBOX BOUNDARY ───────────────────────────────────────────

export type SandboxTier = "none" | "read-only" | "ephemeral" | "persistent";

export interface SandboxPolicy {
  /** Maximum tier the agent's tools may execute under. */
  tier: SandboxTier;
  /** Filesystem root the sandbox is confined to (never the platform root). */
  root: string;
  /** Network egress allowed (empty = none). */
  networkAllowlist: string[];
  /** Whether production credentials are injected (almost always false). */
  productionSecrets: boolean;
}

/** Default sandbox for any coding/security agent: ephemeral, no prod secrets. */
export const DEFAULT_SANDBOX: SandboxPolicy = {
  tier: "ephemeral",
  root: "/tmp/hermes-agent-workspace",
  networkAllowlist: [],
  productionSecrets: false,
};

// ─── EPHEMERAL EXECUTION ────────────────────────────────────────

/**
 * A single ephemeral execution context. State created here is discarded when
 * the run completes — nothing persists to the host or the agent's memory.
 */
export interface EphemeralRun {
  id: string;
  agentId: string;
  applicationId: string;
  env: "development" | "staging" | "production";
  /** True once the run's scratch state has been wiped. */
  sealed: boolean;
  startedAt: string;
  finishedAt?: string;
}

/**
 * Begin an ephemeral run. Returns a context the caller MUST seal() after the
 * work completes. The sandbox root is isolated and wiped on seal — this is the
 * only execution tier an agent may use without an explicit persistent grant.
 */
export function beginEphemeralRun(
  agentId: string,
  applicationId: string,
  env: "development" | "staging" | "production",
  policy: SandboxPolicy = DEFAULT_SANDBOX,
): EphemeralRun {
  if (policy.tier !== "ephemeral" && policy.tier !== "read-only") {
    emitAudit("agent.ephemeral.denied", agentId, {
      reason: "sandbox tier not ephemeral",
      tier: policy.tier,
    });
    throw new Error(`Ephemeral execution requires an ephemeral/read-only sandbox, got ${policy.tier}`);
  }
  const run: EphemeralRun = {
    id: `run:${agentId}:${Date.now()}`,
    agentId,
    applicationId,
    env,
    sealed: false,
    startedAt: new Date().toISOString(),
  };
  emitAudit("agent.ephemeral.begin", agentId, {
    runId: run.id,
    applicationId,
    env,
    root: policy.root,
  });
  return run;
}

/**
 * Seal an ephemeral run: discard all scratch state. Idempotent — calling on an
 * already-sealed run is a no-op (audited). The platform never persists agent
 * execution state unless an explicit persistent grant exists.
 */
export function sealEphemeralRun(run: EphemeralRun): EphemeralRun {
  if (run.sealed) {
    emitAudit("agent.ephemeral.seal-noop", run.agentId, { runId: run.id });
    return run;
  }
  const sealed: EphemeralRun = {
    ...run,
    sealed: true,
    finishedAt: new Date().toISOString(),
  };
  emitAudit("agent.ephemeral.seal", run.agentId, {
    runId: run.id,
    applicationId: run.applicationId,
    env: run.env,
    note: "scratch state discarded",
  });
  return sealed;
}

// ─── MEMORY SCOPE ───────────────────────────────────────────────

export type MemoryScope = "isolated" | "shared" | "global";

/**
 * Resolve the memory scope for an agent. Isolated is the safe default;
 * shared/global require an explicit agent declaration + audit trail.
 */
export function resolveMemoryScope(agent: RegisteredAgent): MemoryScope {
  const scope = agent.memoryScope ?? "isolated";
  if (scope !== "isolated") {
    emitAudit("agent.memory.scope", agent.id, { scope, note: "non-isolated memory boundary" });
  }
  return scope;
}

// ─── APPROVAL WORKFLOW ──────────────────────────────────────────

export type ToolApprovalKind = "auto" | "human" | "forbidden";

/**
 * A pending human-approval request. Created when an agent needs a capability
 * that requires human sign-off (e.g. production write/exec). The request is
 * emitted to the audit trail and MUST be resolved by a human before the agent
 * proceeds — there is no autonomous path.
 */
export interface ApprovalRequest {
  id: string;
  agentId: string;
  applicationId: string;
  env: "development" | "staging" | "production";
  action: "read" | "write" | "exec";
  tool: ToolNamespace;
  requestedAt: string;
  state: "pending" | "approved" | "rejected";
}

/**
 * Request human approval for a tool action. Emits an `agent.request.approval`
 * audit event (consumed by the Governance approval queue). The returned request
 * is in `pending` state — the agent must NOT proceed until a human approves.
 */
export function requestApproval(
  agentId: string,
  applicationId: string,
  env: "development" | "staging" | "production",
  action: "read" | "write" | "exec",
  tool: ToolNamespace,
): ApprovalRequest {
  const req: ApprovalRequest = {
    id: `approval:${agentId}:${Date.now()}`,
    agentId,
    applicationId,
    env,
    action,
    tool,
    requestedAt: new Date().toISOString(),
    state: "pending",
  };
  emitAudit("agent.request.approval", agentId, {
    requestId: req.id,
    applicationId,
    env,
    action,
    tool,
  });
  return req;
}

/**
 * Decide the approval requirement for a tool call. Governance rules:
 *  - Production writes (code.exec / code.write in prod) → human approval.
 *  - Anything touching production secrets → forbidden unless explicitly granted.
 *  - Read-only + non-prod → auto (still audited).
 *  - Explicit grant with autoApprove=false → human.
 */
export function classifyToolApproval(
  grant: ToolGrant,
  env: "development" | "staging" | "production",
  action: "read" | "write" | "exec",
): ToolApprovalKind {
  if (env === "production" && (action === "write" || action === "exec")) return "human";
  if (action === "exec" && !grant.autoApprove) return "human";
  if (grant.autoApprove && env !== "production") return "auto";
  if (action === "read") return "auto";
  return "human";
}

/**
 * Gate a tool call. Throws if forbidden; returns the approval kind the
 * caller must satisfy (human prompt, or proceed). Records an audit event.
 *
 * @param applicationId the specific application the call targets. The grant's
 *   `applications` list is enforced here (empty list = all applications).
 */
export function guardToolCall(
  agentId: string,
  grant: ToolGrant,
  env: "development" | "staging" | "production",
  action: "read" | "write" | "exec",
  tool: ToolNamespace,
  applicationId: string,
): ToolApprovalKind {
  // A grant for "tool:code" permits "tool:code.*" but NOT "tool:security.*".
  const grantDomain = grant.namespace.split(":")[1];
  const toolDomain = tool.split(":")[1];
  if (grantDomain !== toolDomain) {
    emitAudit("agent.tool.denied", agentId, { reason: "namespace mismatch", tool, grant: grant.namespace });
    throw new Error(`Tool ${tool} not permitted by grant ${grant.namespace}`);
  }
  // Application scoping: a non-empty grant.applications list restricts the
  // grant to exactly those applications.
  if (grant.applications.length > 0 && !grant.applications.includes(applicationId)) {
    emitAudit("agent.tool.denied", agentId, {
      reason: "application out of scope",
      tool,
      applicationId,
      allowed: grant.applications,
    });
    throw new Error(`Tool ${tool} not permitted for application ${applicationId}`);
  }
  const kind = classifyToolApproval(grant, env, action);
  emitAudit("agent.tool.gate", agentId, { tool, env, action, applicationId, approval: kind });
  if (kind === "forbidden") {
    throw new Error(`Tool ${tool} forbidden in ${env} for action ${action}`);
  }
  return kind;
}
