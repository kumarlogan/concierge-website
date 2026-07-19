// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Research Tools Adapter (provider-neutral)   │
// │ EPIC-002-006E · PHASE 4                                        │
// │ Web/search/research queries behind a stable interface. Backend │
// │ (Firecrawl, SerpAPI, internal KB, …) injected at runtime.      │
// └─────────────────────────────────────────────────────────────┘

import {
  registerToolProvider,
  type ToolCall,
  type ToolProvider,
  type ToolResult,
} from "./tool-provider.js";
import { emitAudit } from "../../audit/event.js";

export interface ResearchBackend {
  readonly name: string;
  query(q: string, opts?: Record<string, unknown>): Promise<ResearchHit[]> | ResearchHit[];
}

export interface ResearchHit {
  title: string;
  url: string;
  snippet: string;
}

class NoopResearchBackend implements ResearchBackend {
  readonly name = "noop";
  query(): ResearchHit[] {
    return [];
  }
}

export class ResearchToolsProvider implements ToolProvider {
  readonly id = "tool:research.engine";
  readonly label = "Research Tools (engine)";
  constructor(private backend: ResearchBackend = new NoopResearchBackend()) {}

  async run(call: ToolCall): Promise<ToolResult> {
    emitAudit("tool.research.call", call.actor, { tool: call.tool, env: call.env });
    if (call.tool !== "tool:research.query") {
      return { ok: false, error: `unknown research tool: ${call.tool}`, backend: this.backend.name };
    }
    try {
      const hits = await this.backend.query(String(call.args.q ?? ""), call.args.opts as Record<string, unknown>);
      return { ok: true, data: { hits, count: hits.length }, backend: this.backend.name };
    } catch (e) {
      return { ok: false, error: String(e), backend: this.backend.name };
    }
  }
}

registerToolProvider(new ResearchToolsProvider());
