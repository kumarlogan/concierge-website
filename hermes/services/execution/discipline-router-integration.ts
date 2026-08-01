// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Discipline Router Integration              │
// │ EPIC-007 · Deliverable 04                                     │
// │ Wires EPCL DisciplineRouter into the executive execution      │
// │ pipeline. Automatic discipline selection based on command     │
// │ keywords and work descriptions.                                 │
// └─────────────────────────────────────────────────────────────┘

import { DisciplineRouter } from "../planning/discipline-router";
import type { Discipline, DisciplineAssignment } from "../../contracts/planning.js";
import type { ExecutionContext } from "./context.js";

// ── Types ──────────────────────────────────────────────────

export type DisciplineRouteResult = {
  /** The resolved discipline (e.g. "backend", "frontend", "devops"). */
  discipline: Discipline;
  /** Confidence score (0.0–1.0). */
  confidence: number;
  /** Reasoning for the selection. */
  reasoning: string;
  /** The assignment metadata. */
  assignment: DisciplineAssignment;
};

export type RouteOptions = {
  /** The operator command action to route. */
  action: string;
  /** Description of what this execution targets. */
  description: string;
  /** Optional hint to override auto-detection. */
  hint?: Discipline;
};

// ── Class ──────────────────────────────────────────────────

export class DisciplineRouterIntegration {
  private router: DisciplineRouter;

  private constructor() {
    this.router = DisciplineRouter.getInstance();
  }

  static getInstance(): DisciplineRouterIntegration {
    return new DisciplineRouterIntegration();
  }

  /**
   * Route an operator command to a discipline automatically.
   * Uses the EPCL DisciplineRouter's pattern-matching to assign
   * the work item to the correct workforce discipline.
   */
  routeCommand(opts: RouteOptions): DisciplineRouteResult {
    const { action, description, hint } = opts;

    // If a hint discipline is provided, use it directly
    if (hint) {
      return {
        discipline: hint,
        confidence: 1.0,
        reasoning: `Explicit hint provided: "${hint}"`,
        assignment: {
          atom_id: "",
          discipline: hint,
          confidence: 1.0,
          reasoning: `Explicit hint: "${hint}"`,
        },
      };
    }

    // Delegate to EPCL DisciplineRouter
    const assignment = this.router.assign(action, description);

    return {
      discipline: assignment.discipline as Discipline,
      confidence: assignment.confidence,
      reasoning: assignment.reasoning,
      assignment,
    };
  }

  /**
   * Route and attach discipline metadata to an ExecutionContext.
   * Convenience method for the entry point pipeline.
   */
  routeWithContext(ctx: ExecutionContext, opts: RouteOptions): ExecutionContext {
    const result = this.routeCommand(opts);
    ctx.setFlag(`discipline:${result.discipline}`, true);
    return ctx;
  }
}