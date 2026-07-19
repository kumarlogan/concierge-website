// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — MCP Compatibility Layer                       │
// │ EPIC-002-006H · PHASE 4                                        │
// │                                                 PURPOSE:        │
// │  Bridges the Model Context Protocol (MCP) ecosystem and the     │
// │  Hermes Tool Provider abstraction WITHOUT coupling Hermes to     │
// │  any MCP vendor SDK.                                            │
// │                                                 DESIGN:          │
// │  • Hermes tools can be EXPOSED to an MCP client (list as specs). │
// │  • External MCP tools can be WRAPPED as native Hermes providers. │
// │  • MCP usage is NON-MANDATORY: the platform works identically    │
// │    with or without this adapter. No tool is forced through MCP.  │
// │                                                 SAFETY:          │
// │  • All wrapped calls inherit the Hermes ToolCall contract        │
// │    (approval token for prod, audit, no-throw-on-failure).        │
// │  • Unknown MCP tool names fail CLOSED (isError: true).           │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  listToolProviders,
  getToolProvider,
  registerToolProvider,
  type ToolProvider,
  type ToolCall,
  type ToolResult,
} from "../tools/tool-provider.js";

// ── MCP wire shapes (minimal, vendor-neutral subset) ──

export interface McpToolSpec {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface McpToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export interface McpToolCall {
  name: string;
  arguments: Record<string, unknown>;
}

// ── Expose Hermes tools to an MCP client ──

/**
 * Produce MCP tool specs for every registered Hermes provider.
 * The native provider id is used verbatim as the MCP tool name so the
 * client can round-trip by id. This keeps Hermes provider-neutral — the
 * MCP client is just another consumer, not a dependency.
 */
export function listHermesToolsAsMcp(): { tools: McpToolSpec[] } {
  const tools = listToolProviders().map((p) => ({
    name: p.id,
    description: p.label,
    inputSchema: {
      type: "object" as const,
      properties: { args: { type: "object", description: "Tool arguments" } },
    },
  }));
  emitAudit("mcp.tools.listed", "system", { count: tools.length });
  return { tools };
}

/**
 * Dispatch an incoming MCP tool call to the matching Hermes provider.
 * Fail-closed: an unknown tool name returns isError:true.
 */
export async function handleMcpToolCall(call: McpToolCall): Promise<McpToolResult> {
  const provider = getToolProvider(call.name);
  if (!provider) {
    emitAudit("mcp.tool.unknown", "system", { name: call.name });
    return {
      content: [{ type: "text", text: `Unknown Hermes tool: ${call.name}` }],
      isError: true,
    };
  }
  const toolCall: ToolCall = {
    tool: call.name,
    args: call.arguments ?? {},
    env: "development",
    actor: "mcp:client",
  };
  const res: ToolResult = await provider.run(toolCall);
  return {
    content: [
      {
        type: "text",
        text: res.ok
          ? JSON.stringify(res.data ?? {})
          : `Tool error: ${res.error ?? "unknown"} (backend: ${res.backend})`,
      },
    ],
    isError: !res.ok,
  };
}

// ── Wrap an external MCP tool as a native Hermes provider ──

/**
 * Turn an external MCP tool definition + handler into a Hermes ToolProvider.
 * The wrapped provider follows the Hermes contract: it never throws on tool
 * failure (returns ToolResult.ok=false), and audits every invocation.
 */
export function mcpToolToHermesProvider(
  spec: McpToolSpec,
  handler: (req: McpToolCall) => Promise<McpToolResult> | McpToolResult,
  opts: { register?: boolean } = {},
): ToolProvider {
  const id = spec.name.startsWith("mcp:") ? spec.name : `mcp:${spec.name}`;
  const provider: ToolProvider = {
    id,
    label: spec.description || spec.name,
    async run(call: ToolCall): Promise<ToolResult> {
      emitAudit("tool.mcp.wrapped.run", call.actor, { id });
      try {
        const result = await handler({
          name: spec.name,
          arguments: call.args ?? {},
        });
        if (result.isError) {
          return {
            ok: false,
            error: result.content.map((c) => c.text).join(" "),
            backend: id,
          };
        }
        return {
          ok: true,
          data: result.content.map((c) => c.text).join(" "),
          backend: id,
        };
      } catch (e) {
        // Never let a wrapped MCP tool crash the Hermes call path.
        return {
          ok: false,
          error: e instanceof Error ? e.message : String(e),
          backend: id,
        };
      }
    },
  };
  if (opts.register) {
    try {
      registerToolProvider(provider);
    } catch {
      // Already registered — harmless in tests/reloads.
    }
  }
  return provider;
}
