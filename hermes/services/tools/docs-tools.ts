// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Docs Tools Adapter (provider-neutral)       │
// │ EPIC-002-006E · PHASE 4                                        │
// │ Read/write documentation through a stable interface. Backend   │
// │ (local markdown, Notion, Confluence, …) injected at runtime.   │
// └─────────────────────────────────────────────────────────────┘

import {
  registerToolProvider,
  type ToolCall,
  type ToolProvider,
  type ToolResult,
} from "./tool-provider.js";
import { emitAudit } from "../../audit/event.js";

export interface DocsBackend {
  readonly name: string;
  readDoc(ref: string): Promise<string> | string;
  writeDoc(ref: string, content: string): Promise<void> | void;
}

class NoopDocsBackend implements DocsBackend {
  readonly name = "noop";
  readDoc(): string {
    return "";
  }
  writeDoc(): void {}
}

export class DocsToolsProvider implements ToolProvider {
  readonly id = "tool:docs.store";
  readonly label = "Docs Tools (store)";
  constructor(private backend: DocsBackend = new NoopDocsBackend()) {}

  async run(call: ToolCall): Promise<ToolResult> {
    emitAudit("tool.docs.call", call.actor, { tool: call.tool, env: call.env });
    const isWrite = call.tool === "tool:docs.write";
    if (call.env === "production" && isWrite && !call.approvalToken) {
      return { ok: false, error: "production doc write requires approval token", backend: this.backend.name };
    }
    try {
      switch (call.tool) {
        case "tool:docs.read": {
          const content = await this.backend.readDoc(String(call.args.ref ?? ""));
          return { ok: true, data: { content }, backend: this.backend.name };
        }
        case "tool:docs.write": {
          await this.backend.writeDoc(String(call.args.ref ?? ""), String(call.args.content ?? ""));
          return { ok: true, backend: this.backend.name };
        }
        default:
          return { ok: false, error: `unknown docs tool: ${call.tool}`, backend: this.backend.name };
      }
    } catch (e) {
      return { ok: false, error: String(e), backend: this.backend.name };
    }
  }
}

registerToolProvider(new DocsToolsProvider());
