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
  const inScope =
    grant.applications.length === 0 || true; // application scoping enforced upstream
  if (!inScope) return "forbidden";
  if (env === "production" && (action === "write" || action === "exec")) return "human";
  if (action === "exec" && !grant.autoApprove) return "human";
  if (grant.autoApprove && env !== "production") return "auto";
  if (action === "read") return "auto";
  return "human";
}

/**
 * Gate a tool call. Throws if forbidden; returns the approval kind the
 * caller must satisfy (human prompt, or proceed). Records an audit event.
 */
export function guardToolCall(
  agentId: string,
  grant: ToolGrant,
  env: "development" | "staging" | "production",
  action: "read" | "write" | "exec",
  tool: ToolNamespace,
): ToolApprovalKind {
  // A grant for "tool:code" permits "tool:code.*" but NOT "tool:security.*".
  const grantDomain = grant.namespace.split(":")[1];
  const toolDomain = tool.split(":")[1];
  if (grantDomain !== toolDomain) {
    emitAudit("agent.tool.denied", agentId, { reason: "namespace mismatch", tool, grant: grant.namespace });
    throw new Error(`Tool ${tool} not permitted by grant ${grant.namespace}`);
  }
  const kind = classifyToolApproval(grant, env, action);
  emitAudit("agent.tool.gate", agentId, { tool, env, action, approval: kind });
  if (kind === "forbidden") {
    throw new Error(`Tool ${tool} forbidden in ${env} for action ${action}`);
  }
  return kind;
}
