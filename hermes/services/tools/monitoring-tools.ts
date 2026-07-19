// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Monitoring Tools Adapter (provider-neutral)  │
// │ EPIC-002-006E · PHASE 4                                        │
// │ Read health/metrics and emit alerts through a stable interface.│
// │ Backend (Prometheus, Datadog, CloudWatch, …) injected at run.  │
// └─────────────────────────────────────────────────────────────┘

import {
  registerToolProvider,
  type ToolCall,
  type ToolProvider,
  type ToolResult,
} from "./tool-provider.js";
import { emitAudit } from "../../audit/event.js";

export interface MonitoringBackend {
  readonly name: string;
  readHealth(service: string): Promise<{ status: string; detail?: string }> | { status: string; detail?: string };
  queryMetrics(query: string): Promise<unknown> | unknown;
  emitAlert(name: string, severity: string, msg: string): Promise<void> | void;
}

class NoopMonitoringBackend implements MonitoringBackend {
  readonly name = "noop";
  readHealth(): { status: string; detail?: string } {
    return { status: "unknown" };
  }
  queryMetrics(): unknown {
    return null;
  }
  emitAlert(): void {}
}

export class MonitoringToolsProvider implements ToolProvider {
  readonly id = "tool:monitor.gateway";
  readonly label = "Monitoring Tools (gateway)";
  constructor(private backend: MonitoringBackend = new NoopMonitoringBackend()) {}

  async run(call: ToolCall): Promise<ToolResult> {
    emitAudit("tool.monitor.call", call.actor, { tool: call.tool, env: call.env });
    try {
      switch (call.tool) {
        case "tool:monitor.read": {
          const health = await this.backend.readHealth(String(call.args.service ?? ""));
          return { ok: true, data: health, backend: this.backend.name };
        }
        case "tool:monitor.metrics": {
          const m = await this.backend.queryMetrics(String(call.args.query ?? ""));
          return { ok: true, data: m, backend: this.backend.name };
        }
        case "tool:monitor.alert": {
          await this.backend.emitAlert(
            String(call.args.name ?? "alert"),
            String(call.args.severity ?? "info"),
            String(call.args.msg ?? ""),
          );
          return { ok: true, backend: this.backend.name };
        }
        default:
          return { ok: false, error: `unknown monitoring tool: ${call.tool}`, backend: this.backend.name };
      }
    } catch (e) {
      return { ok: false, error: String(e), backend: this.backend.name };
    }
  }
}

registerToolProvider(new MonitoringToolsProvider());
