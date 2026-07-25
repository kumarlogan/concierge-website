// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Tool Provider Abstraction                   │
// │ EPIC-002-006E · PHASE 4                                        │
// │ Provider-neutral tool layer. Each tool domain (dev, security,  │
// │ docs, research, monitoring) is exposed through a stable         │
// │ interface. Concrete vendor backends are injected at runtime —   │
// │ no vendor lock-in; the platform depends only on the interface.  │
// │                                                 SAFETY:         │
// │  • Tool calls are gated by hermes/agents/tool-contracts.ts.     │
// │  • No adapter performs production writes without an approval    │
// │    token passed in the ToolCall context.                        │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";

/** A single tool invocation request. */
export interface ToolCall {
  /** Tool identifier, namespaced (e.g. "tool:code.exec"). */
  tool: string;
  /** Free-form arguments for the backend. */
  args: Record<string, unknown>;
  /** Target environment for the call. */
  env: "development" | "staging" | "production";
  /** Human approval token — REQUIRED for any write/exec in prod. */
  approvalToken?: string;
  /** Agent principal performing the call (for audit). */
  actor: string;
}

/** Normalized tool result. */
export interface ToolResult {
  ok: boolean;
  /** Structured output (may be large; adapters should summarize). */
  data?: unknown;
  /** Human-readable error if !ok. */
  error?: string;
  /** Backend that produced the result (provenance). */
  backend: string;
  /** Set true when the result is a dry-run plan, not an actual execution. */
  dryRun?: boolean;
}

/**
 * The contract every tool backend implements. Concrete providers
 * (Claude Code, local shell, Snyk, Semgrep, etc.) implement this — the
 * platform never imports a vendor SDK directly.
 */
export interface ToolProvider {
  /** Stable provider id, e.g. "dev.local-shell". */
  readonly id: string;
  /** Human label. */
  readonly label: string;
  /**
   * Execute a tool call. Must: (1) respect the approval token for
   * prod writes, (2) emit an audit event, (3) never throw on tool
   * failure (return ToolResult with ok=false instead).
   */
  run(call: ToolCall): Promise<ToolResult> | ToolResult;
}

/**
 * Lightweight provider registry. Adapters register at module load.
 * Lookups are by provider id; consumers request a domain's provider
 * without knowing the concrete backend.
 */
const PROVIDERS = new Map<string, ToolProvider>();

export function registerToolProvider(p: ToolProvider): void {
  if (PROVIDERS.has(p.id)) {
    throw new Error(`Tool provider already registered: ${p.id}`);
  }
  PROVIDERS.set(p.id, p);
  emitAudit("tool.provider.registered", "system", { id: p.id });
}

export function getToolProvider(id: string): ToolProvider | undefined {
  return PROVIDERS.get(id);
}

/** Resolve the active provider for a tool namespace (config-driven later). */
export function resolveProvider(namespace: string): ToolProvider | undefined {
  // Convention: provider id == `${namespace}.<backend>`; pick the first match.
  for (const [id, p] of PROVIDERS) {
    if (id.startsWith(namespace + ".")) return p;
  }
  return undefined;
}

export function listToolProviders(): ToolProvider[] {
  return [...PROVIDERS.values()];
}
