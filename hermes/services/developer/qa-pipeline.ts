// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — QA Pipeline                       │
// │ EPIC-003-002 · M4                                            │
// │ Generates QA tasks after development and produces QA result    │
// │ contributions for the review package. Supports: unit,          │
// │ integration, typecheck, lint, boundary validation.             │
// │ Simulation-only by design (no test runner is invoked for real).│
// └─────────────────────────────────────────────────────────────┘

import type { DevelopmentWorkRequest } from "./work-request.js";
import type { EngineeringTask } from "./engineering-planner.js";
import type { AgentContribution } from "../execution/review-pipeline.js";

export type QaKind = "unit" | "integration" | "typecheck" | "lint" | "boundary";

export interface QaResult {
  kind: QaKind;
  capability: string;
  ok: boolean;
  passed: number;
  failed: number;
  detail: string;
  targetFile?: string;
}

const QA_CAP_MAP: Record<QaKind, string> = {
  unit: "qa.unit",
  integration: "qa.integration",
  typecheck: "qa.typecheck",
  lint: "qa.lint",
  boundary: "qa.boundary",
};

/** Generate the QA tasks implied by a request (after implement). */
export function planQaTasks(req: DevelopmentWorkRequest, implTaskId: string): EngineeringTask[] {
  return (Object.keys(QA_CAP_MAP) as QaKind[]).map((kind) => ({
    id: `${req.requestId}:qa:${kind}`,
    title: `QA ${kind} for ${req.title}`,
    capability: QA_CAP_MAP[kind],
    domain: "quality",
    priority: req.priority,
    dependsOn: [implTaskId],
    parallelizable: true,
    owner: "qa-agent" as const,
    sourceRequest: req.requestId,
    stage: "verify" as const,
    context: { qaKind: kind, affectedModules: req.affectedModules },
  }));
}

/**
 * Produce simulated QA results. Deterministic: a high-risk request with zero
 * acceptance criteria yields a failed boundary check (fail-closed posture).
 * No real test runner is invoked — this is the governed simulation surface.
 */
export function runQa(req: DevelopmentWorkRequest): QaResult[] {
  const out: QaResult[] = [];
  for (const kind of Object.keys(QA_CAP_MAP) as QaKind[]) {
    let ok = true;
    let detail = `SIM ${kind} passed`;
    if (kind === "boundary" && req.acceptanceCriteria.length === 0 && req.estimatedRisk !== "low") {
      ok = false;
      detail = `SIM boundary validation failed: no automatable acceptance criteria for ${req.estimatedRisk} risk`;
    }
    out.push({
      kind,
      capability: QA_CAP_MAP[kind],
      ok,
      passed: ok ? 12 : 9,
      failed: ok ? 0 : 3,
      detail,
    });
  }
  return out;
}

/** Convert QA results into review contributions. */
export function qaContributions(req: DevelopmentWorkRequest, results: QaResult[]): AgentContribution[] {
  return results.map((r) => ({
    agentId: "qa-agent",
    domain: "quality" as const,
    capability: r.capability,
    artifact: {
      qaKind: r.kind,
      passed: r.passed,
      failed: r.failed,
      targetFile: `sim/qa_${r.kind}.ts`,
      approvalToken: "sim-token",
    },
    privileged: false,
    notes: r.detail,
  }));
}
