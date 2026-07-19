// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Dev Tools Adapter (provider-neutral)        │
// │ EPIC-002-006E · PHASE 4 / EPIC-002-006F · PHASE 4            │
// │ Exposes code read/write/exec through a stable interface. The    │
// │ concrete backend (local shell, Claude Code remote, etc.) is    │
// │ injected — the platform never depends on a vendor SDK.          │
// └─────────────────────────────────────────────────────────────┘

import {
  registerToolProvider,
  type ToolCall,
  type ToolProvider,
  type ToolResult,
} from "./tool-provider.js";
import { emitAudit } from "../../audit/event.js";
import type { ToolCapability } from "./tool-capabilities.js";

/** Backend contract a concrete dev tool implementation must satisfy. */
export interface DevBackend {
  readonly name: string;
  readFile(path: string): Promise<string> | string;
  writeFile(path: string, content: string): Promise<void> | void;
  exec(cmd: string, cwd: string): Promise<{ stdout: string; stderr: string; code: number }> | { stdout: string; stderr: string; code: number };
}

/** Default backend: in-process no-op (safe; refuses prod writes). */
class NoopDevBackend implements DevBackend {
  readonly name = "noop";
  readFile(): string {
    return "";
  }
  writeFile(): void {}
  exec(): { stdout: string; stderr: string; code: number } {
    return { stdout: "", stderr: "dev backend disabled", code: 1 };
  }
}

/**
 * Capability declarations for the dev tools provider. These are the stable,
 * provider-neutral capability IDs the workforce/registry references — they do
 * NOT name any vendor backend (GitHub, OpenAI, Claude, …).
 */
export const DEV_TOOL_CAPABILITIES: ToolCapability[] = [
  { id: "tool:code.read", description: "Read source files from a repository", requiresApproval: false },
  { id: "tool:code.write", description: "Write/modify source files", requiresApprovalIn: ["production"] },
  { id: "tool:code.exec", description: "Execute shell commands in a sandbox", requiresApprovalIn: ["production"] },
];

/**
 * Dev tools provider. Wraps a DevBackend. Enforces the approval rule:
 * prod writes/exec require an approvalToken; otherwise the call is denied.
 */
export class DevToolsProvider implements ToolProvider {
  readonly id: string = "tool:code.local-shell";
  readonly label: string = "Dev Tools (local shell)";
  constructor(private backend: DevBackend = new NoopDevBackend()) {}

  /** Declared capabilities (provider-neutral). Used by the permission model. */
  declaredCapabilities(): ToolCapability[] {
    return DEV_TOOL_CAPABILITIES;
  }

  async run(call: ToolCall): Promise<ToolResult> {
    emitAudit("tool.code.call", call.actor, { tool: call.tool, env: call.env });
    const isWrite = call.tool === "tool:code.write" || call.tool === "tool:code.exec";
    if (call.env === "production" && isWrite && !call.approvalToken) {
      return { ok: false, error: "production write requires approval token", backend: this.backend.name };
    }
    try {
      switch (call.tool) {
        case "tool:code.read": {
          const content = await this.backend.readFile(String(call.args.path ?? ""));
          return { ok: true, data: { content }, backend: this.backend.name };
        }
        case "tool:code.write": {
          await this.backend.writeFile(String(call.args.path ?? ""), String(call.args.content ?? ""));
          return { ok: true, backend: this.backend.name };
        }
        case "tool:code.exec": {
          const r = await this.backend.exec(String(call.args.cmd ?? ""), String(call.args.cwd ?? "."));
          return { ok: r.code === 0, data: r, backend: this.backend.name };
        }
        default:
          return { ok: false, error: `unknown dev tool: ${call.tool}`, backend: this.backend.name };
      }
    } catch (e) {
      return { ok: false, error: String(e), backend: this.backend.name };
    }
  }
}

registerToolProvider(new DevToolsProvider());
