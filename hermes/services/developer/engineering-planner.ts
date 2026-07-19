// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Engineering Planner              │
// │ EPIC-003-002 · M2                                            │
// │ Converts a DevelopmentWorkRequest into an executable GoalSpec │
// │ (the input the existing Execution Platform work-planner       │
// │ consumes). Adds task ownership, dependency edges, and parallel│
// │ waves. Pure planning — never executes or touches providers.   │
// └─────────────────────────────────────────────────────────────┘

import type { DevelopmentWorkRequest, WorkKind } from "./work-request.js";
import type { WorkItem, GoalSpec } from "../execution/work-planner.js";

/** Owner role assigned per task domain (workforce specialization). */
export type EngineeringRole =
  | "developer-agent"
  | "qa-agent"
  | "security-agent"
  | "documentation-agent"
  | "research-agent";

/** A planned engineering task with explicit ownership. */
export interface EngineeringTask extends WorkItem {
  /** Which specialized agent owns execution of this task. */
  owner: EngineeringRole;
  /** The development request this task derives from. */
  sourceRequest: string;
  /** The conceptual stage in the pipeline. */
  stage: "plan" | "implement" | "verify" | "secure" | "document" | "review" | "release";
}

const ROLE_BY_CAPABILITY: Record<string, EngineeringRole> = {
  "dev.code.plan": "developer-agent",
  "dev.code.generate": "developer-agent",
  "dev.code.diff": "developer-agent",
  "qa.unit": "qa-agent",
  "qa.integration": "qa-agent",
  "qa.typecheck": "qa-agent",
  "qa.lint": "qa-agent",
  "qa.boundary": "qa-agent",
  "sec.secret-scan": "security-agent",
  "sec.dependency-scan": "security-agent",
  "sec.permission-validation": "security-agent",
  "sec.provider-boundary": "security-agent",
  "sec.approval-verification": "security-agent",
  "docs.adr": "documentation-agent",
  "docs.roadmap": "documentation-agent",
  "docs.completion": "documentation-agent",
  "docs.release-notes": "documentation-agent",
  "docs.architecture": "documentation-agent",
  "research.query": "research-agent",
};

function ownerFor(capability: string): EngineeringRole {
  const r = ROLE_BY_CAPABILITY[capability];
  if (!r) throw new Error(`No engineering role mapped for capability ${capability}`);
  return r;
}

/**
 * Build the engineering task graph from a development request.
 *
 * Pipeline stages and dependency edges:
 *   plan → implement → { qa.* , sec.* } → docs.* → review (aggregation)
 *
 * QA and Security tasks are independent of each other (parallel),
 * but both depend on implement. Docs depends on qa + sec. The review
 * stage is the aggregation step (handled outside the planner).
 */
export function buildEngineeringTasks(req: DevelopmentWorkRequest): EngineeringTask[] {
  const R = req.requestId;
  const P = req.priority;
  const tasks: EngineeringTask[] = [];

  // Plan
  tasks.push({
    id: `${R}:plan`,
    title: `Plan implementation for "${req.title}"`,
    capability: "dev.code.plan",
    domain: "development",
    priority: P,
    parallelizable: false,
    owner: "developer-agent",
    sourceRequest: R,
    stage: "plan",
    context: { objective: req.objective, scope: req.scope, affectedModules: req.affectedModules },
  });

  // Implement
  tasks.push({
    id: `${R}:implement`,
    title: `Implement ${req.kind}: ${req.title}`,
    capability: "dev.code.generate",
    domain: "development",
    priority: P,
    dependsOn: [`${R}:plan`],
    parallelizable: false,
    owner: "developer-agent",
    sourceRequest: R,
    stage: "implement",
    context: {
      objective: req.objective,
      kind: req.kind,
      affectedModules: req.affectedModules,
      acceptanceCriteria: req.acceptanceCriteria,
      constraints: req.constraints,
    },
  });

  // QA tasks (parallel among themselves)
  const qaCaps: Array<[string, string, string]> = [
    ["qa.unit", "unit", "Run unit tests"],
    ["qa.integration", "integration", "Run integration tests"],
    ["qa.typecheck", "typecheck", "Type-check the project"],
    ["qa.lint", "lint", "Lint the changed code"],
    ["qa.boundary", "boundary", "Validate capability/provider boundaries"],
  ];
  for (const [cap, sub, label] of qaCaps) {
    tasks.push({
      id: `${R}:qa:${sub}`,
      title: `${label} for ${req.title}`,
      capability: cap,
      domain: "quality",
      priority: P,
      dependsOn: [`${R}:implement`],
      parallelizable: true,
      owner: "qa-agent",
      sourceRequest: R,
      stage: "verify",
      context: { affectedModules: req.affectedModules },
    });
  }

  // Security tasks (parallel among themselves, depend on implement)
  const secCaps: Array<[string, string, string]> = [
    ["sec.secret-scan", "secret", "Scan for leaked secrets"],
    ["sec.dependency-scan", "dependency", "Scan dependencies for CVEs"],
    ["sec.permission-validation", "permission", "Validate RBAC/permission scopes"],
    ["sec.provider-boundary", "provider-boundary", "Validate provider boundary isolation"],
    ["sec.approval-verification", "approval", "Verify approval gates were enforced"],
  ];
  for (const [cap, sub, label] of secCaps) {
    tasks.push({
      id: `${R}:sec:${sub}`,
      title: `${label} for ${req.title}`,
      capability: cap,
      domain: "security",
      priority: Math.max(1, P - 1),
      dependsOn: [`${R}:implement`],
      parallelizable: true,
      owner: "security-agent",
      sourceRequest: R,
      stage: "secure",
      context: { estimatedRisk: req.estimatedRisk, targetApplication: req.targetApplication },
    });
  }

  // Docs tasks (depend on qa + sec completing)
  const docsCaps: Array<[string, string, string]> = [
    ["docs.completion", "completion", "Write completion report"],
    ["docs.release-notes", "release-notes", "Draft release notes"],
    ["docs.roadmap", "roadmap", "Update roadmap if milestone closed"],
  ];
  for (const [cap, sub, label] of docsCaps) {
    tasks.push({
      id: `${R}:docs:${sub}`,
      title: `${label} for ${req.title}`,
      capability: cap,
      domain: "docs",
      priority: Math.max(1, P - 2),
      dependsOn: [
        `${R}:qa:unit`,
        `${R}:sec:secret`,
        `${R}:sec:approval`,
      ],
      parallelizable: true,
      owner: "documentation-agent",
      sourceRequest: R,
      stage: "document",
      context: { kind: req.kind, targetApplication: req.targetApplication },
    });
  }

  return tasks;
}

/**
 * Convert a DevelopmentWorkRequest into the GoalSpec the Execution Platform
 * planner consumes. Reuses the canonical WorkItem shape with ownership
 * metadata preserved in `context.owner`.
 */
export function planEngineering(req: DevelopmentWorkRequest): {
  goal: GoalSpec;
  tasks: EngineeringTask[];
} {
  const tasks = buildEngineeringTasks(req);
  const goal: GoalSpec = {
    goalId: `goal_${req.requestId}`,
    title: req.title,
    applicationId: req.targetApplication,
    requestedBy: req.requestedBy,
    items: tasks.map((t) => ({
      id: t.id,
      title: t.title,
      capability: t.capability,
      domain: t.domain,
      dependsOn: t.dependsOn,
      priority: t.priority,
      parallelizable: t.parallelizable,
      context: { ...(t.context ?? {}), owner: t.owner, stage: t.stage },
    })),
  };
  emitPlanningAudit(req, tasks);
  return { goal, tasks };
}

function emitPlanningAudit(req: DevelopmentWorkRequest, tasks: EngineeringTask[]): void {
  // Imported lazily to avoid a circular dependency at module-eval time.
  import("../../audit/event.js").then(({ emitAudit }) => {
    emitAudit("dev.plan.engineering", req.requestedBy, {
      requestId: req.requestId,
      tasks: tasks.length,
      owners: [...new Set(tasks.map((t) => t.owner))],
    });
  });
}

/** Capability → owner role (for dispatch observability). */
export function roleForCapability(capability: string): EngineeringRole | undefined {
  return ROLE_BY_CAPABILITY[capability];
}

export const PLANNER_CAPABILITIES: string[] = Object.keys(ROLE_BY_CAPABILITY);
