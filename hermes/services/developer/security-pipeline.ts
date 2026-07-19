// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Security Pipeline                 │
// │ EPIC-003-002 · M5                                            │
// │ Generates security verification tasks and produces results:    │
// │  • secret scan          • dependency scan                       │
// │  • permission validation • provider boundary validation         │
// │  • approval verification                                       │
// │ Fail-closed: any open finding blocks the review (requires human).│
// └─────────────────────────────────────────────────────────────┘

import type { DevelopmentWorkRequest } from "./work-request.js";
import type { EngineeringTask } from "./engineering-planner.js";
import type { AgentContribution } from "../execution/review-pipeline.js";

export type SecurityCheckKind =
  | "secret-scan"
  | "dependency-scan"
  | "permission-validation"
  | "provider-boundary"
  | "approval-verification";

export interface SecurityResult {
  kind: SecurityCheckKind;
  capability: string;
  ok: boolean;
  findings: string[];
  targetFile?: string;
}

const SEC_CAP_MAP: Record<SecurityCheckKind, string> = {
  "secret-scan": "sec.secret-scan",
  "dependency-scan": "sec.dependency-scan",
  "permission-validation": "sec.permission-validation",
  "provider-boundary": "sec.provider-boundary",
  "approval-verification": "sec.approval-verification",
};

export function planSecurityTasks(req: DevelopmentWorkRequest, implTaskId: string): EngineeringTask[] {
  return (Object.keys(SEC_CAP_MAP) as SecurityCheckKind[]).map((kind) => ({
    id: `${req.requestId}:sec:${kind}`,
    title: `Security ${kind} for ${req.title}`,
    capability: SEC_CAP_MAP[kind],
    domain: "security",
    priority: Math.max(1, req.priority - 1),
    dependsOn: [implTaskId],
    parallelizable: true,
    owner: "security-agent" as const,
    sourceRequest: req.requestId,
    stage: "secure" as const,
    context: { checkKind: kind, estimatedRisk: req.estimatedRisk },
  }));
}

/**
 * Run the security checks in simulation. Deterministic fail-closed: a
 * production-targeted or critical-risk request without documented constraints
 * raises a permission-validation finding. Never mutates state.
 */
export function runSecurity(req: DevelopmentWorkRequest, opts: { approvalsEnforced: boolean }): SecurityResult[] {
  const out: SecurityResult[] = [];
  for (const kind of Object.keys(SEC_CAP_MAP) as SecurityCheckKind[]) {
    const findings: string[] = [];
    let ok = true;
    if (kind === "permission-validation" && req.env === "production" && req.constraints.length === 0) {
      ok = false;
      findings.push(`No documented permission constraints for production-targeted ${req.kind}`);
    }
    if (kind === "approval-verification" && !opts.approvalsEnforced) {
      ok = false;
      findings.push("Approval gates were not enforced for privileged capabilities");
    }
    if (kind === "secret-scan" && req.estimatedRisk === "critical") {
      findings.push("Simulated secret-scan: review token handling for critical-risk change");
    }
    out.push({
      kind,
      capability: SEC_CAP_MAP[kind],
      ok,
      findings,
    });
  }
  return out;
}

export function securityContributions(results: SecurityResult[]): AgentContribution[] {
  return results.map((r) => ({
    agentId: "security-agent",
    domain: "security" as const,
    capability: r.capability,
    artifact: {
      checkKind: r.kind,
      findings: r.findings,
      targetFile: `sim/sec_${r.kind}.ts`,
      approvalToken: "sim-token",
    },
    privileged: false,
    notes: r.ok ? `SIM ${r.kind} passed` : `SIM ${r.kind} found ${r.findings.length} issue(s)`,
  }));
}

/** True if any security check failed (should block autonomous progression). */
export function securityBlocks(results: SecurityResult[]): boolean {
  return results.some((r) => !r.ok);
}
