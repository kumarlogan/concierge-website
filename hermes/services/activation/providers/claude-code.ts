// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Claude Code Provider (FIRST dev provider)   │
// │ EPIC-002-007 · M2                                            │
// │                                                 SAFETY:        │
// │  • NO vendor SDK / CLI import here. The real Claude Code CLI  │
// │    is wired at deploy time through setClaudeCodeExecutor().    │
// │  • The platform depends only on the CapabilityExecutor port.  │
// │  • Everything is fail-closed: with no executor wired, every   │
// │    capability call is refused — never fabricated.             │
// │  • Claude Code is the FIRST development provider. It is NOT   │
// │    Hermes. Hermes owns orchestration/approval/audit; the      │
// │    provider owns only code generation behind the port.        │
// └─────────────────────────────────────────────────────────────┘

import {
  registerProvider,
  type CapabilityDescriptor,
  type CapabilityExecutor,
  type ManagedProvider,
} from "../provider-framework.js";
import {
  type ToolProvider,
  type ToolCall,
  type ToolResult,
} from "../../tools/tool-provider.js";

export const CLAUDE_CODE_PROVIDER_ID = "dev.claude-code";

/**
 * Capabilities Claude Code exposes. These are PROVIDER-NEUTRAL capability IDs —
 * the Developer Agent requests them; Hermes resolves the provider. Future
 * providers (Codex, local models) can advertise the SAME ids, so swapping
 * Claude Code for another backend requires zero agent-code changes.
 */
export const CLAUDE_CODE_CAPABILITIES: CapabilityDescriptor[] = [
  { id: "dev.code.plan", description: "Produce an implementation plan from a spec", requiresApproval: false },
  { id: "dev.code.generate", description: "Generate code from a prompt/plan", requiresApprovalIn: ["production"] },
  { id: "dev.code.refactor", description: "Refactor existing code", requiresApprovalIn: ["production"] },
  { id: "dev.code.explain", description: "Explain code or a diff", requiresApproval: false },
  { id: "dev.code.review", description: "Review a changeset for quality/risk", requiresApproval: false },
  { id: "dev.code.tests", description: "Generate/run tests", requiresApprovalIn: ["production"] },
  { id: "dev.code.docs", description: "Generate documentation for code", requiresApproval: false },
];

let EXECUTOR: CapabilityExecutor | undefined;

/**
 * Wire the real vendor backend. Called once at platform init in a deploy that
 * has Claude Code available. Passing nothing leaves the provider fail-closed.
 */
export function setClaudeCodeExecutor(exec: CapabilityExecutor | undefined): void {
  EXECUTOR = exec;
}

/**
 * Register Claude Code as a managed provider. Starts in "registered"
 * (fail-closed) — must be enabled + health-checked by an authorized principal
 * before any capability executes.
 */
export function registerClaudeCodeProvider(): ManagedProvider {
  return registerProvider({
    id: CLAUDE_CODE_PROVIDER_ID,
    label: "Claude Code",
    domain: "development",
    capabilities: CLAUDE_CODE_CAPABILITIES,
    backend: "anthropic/claude-code",
    executor: (capability, args, ctx) => {
      // Delegate to the injected vendor port. If unset, the framework's
      // executeCapability already refuses (no executor) — but we guard here
      // too so a direct provider.executor call is also fail-closed.
      if (!EXECUTOR) {
        return {
          ok: false,
          error: "Claude Code executor not wired (vendor backend not connected)",
          backend: "anthropic/claude-code",
        };
      }
      return EXECUTOR(capability, args, ctx);
    },
  });
}

/**
 * Convenience: also expose Claude Code as a legacy ToolProvider so it can be
 * resolved through the existing tool registry (services/tools/tool-provider).
 * This keeps backward compatibility without leaking the vendor.
 */
export const claudeCodeToolProvider: ToolProvider = {
  id: "tool:code.claude-code",
  label: "Claude Code (capability provider)",
  run(call: ToolCall): ToolResult | Promise<ToolResult> {
    if (!EXECUTOR) {
      return {
        ok: false,
        error: "Claude Code executor not wired",
        backend: "anthropic/claude-code",
      };
    }
    return EXECUTOR(call.tool, call.args, {
      actor: call.actor,
      env: call.env,
      approvalToken: call.approvalToken,
    });
  },
};
