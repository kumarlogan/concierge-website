// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Security Tools Adapter (provider-neutral)   │
// │ EPIC-002-006E · PHASE 4                                        │
// │ Wraps SAST/DAST/secret-scan backends behind a stable interface.│
// │ Concrete vendor (Snyk, Semgrep, Trivy, …) injected at runtime. │
// └─────────────────────────────────────────────────────────────┘

import {
  registerToolProvider,
  type ToolCall,
  type ToolProvider,
  type ToolResult,
} from "./tool-provider.js";
import { emitAudit } from "../../audit/event.js";

export interface SecurityBackend {
  readonly name: string;
  /** Run a scan; return normalized findings. */
  scan(target: string, kind: "sast" | "dast" | "secret"): Promise<SecurityFinding[]> | SecurityFinding[];
}

export interface SecurityFinding {
  id: string;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  location?: string;
  cwe?: string;
}

class NoopSecurityBackend implements SecurityBackend {
  readonly name = "noop";
  scan(): SecurityFinding[] {
    return [];
  }
}

export class SecurityToolsProvider implements ToolProvider {
  readonly id = "tool:security.scanner";
  readonly label = "Security Tools (scanner)";
  constructor(private backend: SecurityBackend = new NoopSecurityBackend()) {}

  async run(call: ToolCall): Promise<ToolResult> {
    emitAudit("tool.security.call", call.actor, { tool: call.tool, env: call.env });
    if (call.tool !== "tool:security.scan" && call.tool !== "tool:security.findings") {
      return { ok: false, error: `unknown security tool: ${call.tool}`, backend: this.backend.name };
    }
    try {
      const kind = (call.args.kind as "sast" | "dast" | "secret") ?? "sast";
      const findings = await this.backend.scan(String(call.args.target ?? "."), kind);
      return { ok: true, data: { findings, count: findings.length }, backend: this.backend.name };
    } catch (e) {
      return { ok: false, error: String(e), backend: this.backend.name };
    }
  }
}

registerToolProvider(new SecurityToolsProvider());
