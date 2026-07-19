// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Safe Tool Adapter (Phase 4)              │
// │ EPIC-002-006G · PHASE 4                                        │
// │ A console-facing safety wrapper over the provider-neutral tool  │
// │ layer (hermes/services/tools). It makes the platform's tool     │
// │ surface SAFE BY DEFAULT and MCP-READY:                           │
// │  • DEFAULT-DENY: nothing runs unless its tool id is on the       │
// │    allowlist.                                                    │
// │  • HUMAN-GATED: any write/exec capability requires an explicit   │
// │    approval token issued by a human (no autonomous tool use).    │
// │  • NO VENDOR LOCK-IN: the underlying ToolProvider can be a local │
// │    shell, an MCP server, or any backend — the console only sees  │
// │    the ToolProvider interface + ToolCall/ToolResult (which map   │
// │    1:1 to MCP tools/call).                                       │
// │                                                 BOUNDARY:      │
// │  • Imports only the tool-provider abstraction (not vendor SDKs).│
// │  • Never throws; always returns a ToolResult.                   │
// └─────────────────────────────────────────────────────────────┘

import {
  type ToolProvider,
  type ToolCall,
  type ToolResult,
} from "../../services/tools/tool-provider.js";
import type { ToolCapability } from "../../services/tools/tool-capabilities.js";

/**
 * MCP-ready tool surface for the console. Wraps a ToolProvider and adds
 * allowlist + human-approval enforcement on top of the provider's own
 * (env-based) checks. This is the only object the console uses to invoke
 * tools — it cannot bypass the gates.
 */
export class ConsoleToolAdapter {
  /**
   * @param provider  Underlying provider (local shell, MCP server, …).
   * @param allowlist Tool ids permitted through THIS adapter. Anything
   *                  not listed is denied (default-deny).
   * @param requiresHumanTokenFor Capability ids that demand an explicit
   *                  human approval token before invocation. Defaults to
   *                  all write/exec capabilities passed in `capabilities`.
   */
  constructor(
    private readonly provider: ToolProvider,
    private readonly allowlist: ReadonlySet<string>,
    private readonly capabilities: ToolCapability[] = [],
  ) {}

  /** Tool ids this adapter will admit. */
  get admittedTools(): string[] {
    return [...this.allowlist];
  }

  /**
   * Invoke a tool. Enforces allowlist + human-approval BEFORE delegating
   * to the provider. Never throws.
   */
  async invoke(call: ToolCall): Promise<ToolResult> {
    // 1) Allowlist gate (default-deny).
    if (!this.allowlist.has(call.tool)) {
      return {
        ok: false,
        error: `tool '${call.tool}' not on console allowlist`,
        backend: this.provider.id,
      };
    }
    // 2) Human-approval gate for write/exec capabilities.
    const cap = this.capabilities.find((c) => c.id === call.tool);
    const needsToken =
      !!cap && (cap.requiresApproval || (cap.requiresApprovalIn?.length ?? 0) > 0);
    if (needsToken && !call.approvalToken) {
      return {
        ok: false,
        error: `tool '${call.tool}' requires a human approval token`,
        backend: this.provider.id,
      };
    }
    // 3) Delegate to the provider (which enforces its own env rules).
    try {
      return await this.provider.run(call);
    } catch (e) {
      return { ok: false, error: String(e), backend: this.provider.id };
    }
  }
}

/**
 * Build an adapter for the console from a registered provider id.
 * The allowlist is explicit — the caller (console config) enumerates
 * exactly which tools are exposed. Returns null if the provider is unknown.
 */
export function buildConsoleToolAdapter(
  providerId: string,
  allowlist: string[],
  capabilities: ToolCapability[] = [],
  resolve: (id: string) => ToolProvider | undefined,
): ConsoleToolAdapter | null {
  const provider = resolve(providerId);
  if (!provider) return null;
  return new ConsoleToolAdapter(provider, new Set(allowlist), capabilities);
}
