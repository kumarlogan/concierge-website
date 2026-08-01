// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Operator Experience (Single-Command Execution)│
// │ EPIC-007 · Deliverable 08                                        │
// │ Operator-facing experience that wraps the entire EPIC-007       │
// │ pipeline into a single command invocation. The operator calls  │
// │ `execute()` and gets back a complete result with evidence,     │
// │ trace, flags, and a human-readable summary.                   │
// │ Integrates all EPIC-007 services transparently.                 │
// └─────────────────────────────────────────────────────────────────┘

import { ExecutionContext } from "./context.js";
import type { OperatorCommand, ExecutionResult } from "./entry-point.js";
import { ExecutiveExecutionEntryPoint } from "./entry-point.js";
import { ResearchIntelligence } from "./research-intelligence.js";
import { ExecutiveTraceGenerator } from "./executive-trace.js";
import { ExecutionFlagLifecycle } from "./execution-flag-lifecycle.js";
import { DisciplineRouterIntegration } from "./discipline-router-integration.js";
import type { Discipline } from "../../contracts/planning.js";
import type { DisciplineRouteResult } from "./discipline-router-integration.js";
import { emitAudit } from "../../audit/event.js";
import type { Principal } from "../../contracts/platform-api.js";

// ── Types ──────────────────────────────────────────────────

export type OperatorExecuteOptions = {
  tenant: string;
  principal: Principal;
  capability: string;
  backend: string;
  command: OperatorCommand;
  /** Pre-created execution context (optional). */
  context?: ExecutionContext;
};

export type OperatorResult = {
  /** The execution result from the entry point. */
  execution: ExecutionResult;
  /** The research evidence package (if research was requested). */
  research?: {
    packageId: string;
    hitCount: number;
    errorCount: number;
    success: boolean;
  };
  /** The flag bundle used during execution. */
  flags?: {
    contextId: string;
    activeCount: number;
    eventsCount: number;
  };
  /** The executive trace. */
  trace?: {
    traceId: string;
    success: boolean;
    summary: string;
  };
  /** Whether the full pipeline completed without errors. */
  success: boolean;
  /** Human-readable summary for the operator console. */
  summary: string;
  /** Total execution time in ms. */
  durationMs: number;
};

export type OperatorIntent = {
  /** The natural-language or structured intent from the operator. */
  intent: string;
  /** Extracted discipline (if any). */
  discipline?: string;
  /** Extracted flags from the intent. */
  flags?: Record<string, boolean>;
  /** Whether research should be done. */
  research?: boolean;
  /** Research queries (if research is enabled). */
  researchQueries?: { query: string; source: "web" | "internal" | "docs" | "codebase" }[];
};

// ── Class ──────────────────────────────────────────────────

export class OperatorExperience {
  private static instance: OperatorExperience;

  private readonly researchIntelligence: ResearchIntelligence;
  private readonly traceGenerator: ExecutiveTraceGenerator;
  private readonly flagLifecycle: ExecutionFlagLifecycle;
  private readonly disciplineRouter: DisciplineRouterIntegration;

  private constructor() {
    this.researchIntelligence = ResearchIntelligence.getInstance();
    this.traceGenerator = ExecutiveTraceGenerator.getInstance();
    this.flagLifecycle = ExecutionFlagLifecycle.getInstance();
    this.disciplineRouter = DisciplineRouterIntegration.getInstance();
  }

  static getInstance(): OperatorExperience {
    if (!OperatorExperience.instance) {
      OperatorExperience.instance = new OperatorExperience();
    }
    return OperatorExperience.instance;
  }

  /**
   * Execute a single operator command through the full EPIC-007
   * pipeline. This is the primary Operator Experience method —
   * one call wires up context, discipline routing, research,
   * flag lifecycle, execution, trace, and audit.
   */
  async execute(opts: OperatorExecuteOptions): Promise<OperatorResult> {
    const startTime = Date.now();
    const { tenant, principal, capability, backend, command, context } = opts;
    const ctx = context ?? ExecutionContext.create({
      tenant,
      principal,
      capability,
      backend,
      source: "operator",
      atomId: command.atomId,
      batchId: command.batchId,
    });

    // ── Step 1: Parse intent ──────────────────────
    const intent = this._parseIntent(command);

    // ── Step 2: Discipline auto-selection ─────────
    const discipline = this.disciplineRouter.routeCommand({
      action: command.action,
      description: `${capability}:${command.action}`,
      hint: intent.discipline as Discipline,
    });

    // ── Step 3: Flag lifecycle ───────────────────
    const flagBundle = this.flagLifecycle.createBundle(ctx, {
      initialFlags: intent.flags ?? command.flags ?? {},
    });

    // ── Step 4: Entry point execution ────────────
    const entryResult = await ExecutiveExecutionEntryPoint.execute({
      tenant,
      principal,
      capability,
      backend,
      command,
      context: ctx,
    });

    // ── Step 5: Research (if requested) ──────────
    let researchResult: OperatorResult["research"] | undefined;
    if (intent.research && intent.researchQueries.length > 0) {
      try {
        const evidencePackage = await this.researchIntelligence.research(ctx, {
          queries: intent.researchQueries ?? [],
          timeoutMs: 5000,
        });
        researchResult = {
          packageId: evidencePackage.id,
          hitCount: evidencePackage.research?.hits.length ?? 0,
          errorCount: evidencePackage.research?.error ? 1 : 0,
          success: evidencePackage.research?.success ?? false,
        };
      } catch {
        researchResult = {
          packageId: "unknown",
          hitCount: 0,
          errorCount: 1,
          success: false,
        };
      }
    }

    // ── Step 6: Flag lifecycle finalize ──────────
    this.flagLifecycle.finalizeBundle(flagBundle, ctx);

    // ── Step 7: Trace generation ─────────────────
    const trace = this.traceGenerator.generate(ctx);
    const formattedTrace = this.traceGenerator.formatTrace(trace);
    const totalPhases = trace.summary.totalPhases;

    // ── Step 8: Build operator summary ───────────
    const summary = this._buildSummary(
      entryResult,
      discipline,
      flagBundle,
      researchResult,
      trace,
      totalPhases,
    );

    const duration = Date.now() - startTime;

    // Audit the complete operator execution
    emitAudit("epic007.operator.execute", principal.id, {
      contextId: ctx.id,
      command: command.action,
      discipline: discipline.discipline,
      success: entryResult.success,
      evidenceCount: entryResult.evidence.length,
      traceSuccess: trace.success,
      flagCount: flagBundle.flags.size,
      researchDone: researchResult !== undefined,
      durationMs: duration,
      tenant,
    }, { tenant });

    return {
      execution: entryResult,
      ...(researchResult ? { research: researchResult } : {}),
      flags: {
        contextId: flagBundle.contextId,
        activeCount: flagBundle.flags.size,
        eventsCount: flagBundle.events.length,
      },
      trace: {
        traceId: trace.traceId,
        success: trace.success,
        summary: formattedTrace,
      },
      success: entryResult.success,
      summary,
      durationMs: duration,
    };
  }

  private _parseIntent(command: OperatorCommand): OperatorIntent {
    const flags: Record<string, boolean> = {};
    if (command.flags) {
      Object.assign(flags, command.flags);
    }

    return {
      intent: command.action,
      discipline: command.discipline,
      flags,
      research: flags["epic007.research-enabled"] ?? false,
      researchQueries: [],
    };
  }

  private _buildSummary(
    execution: ExecutionResult,
    discipline: DisciplineRouteResult,
    flagBundle: { flags: Map<string, { value: boolean }>; active: boolean; contextId: string; events: unknown[] },
    research: OperatorResult["research"] | undefined,
    trace: { success: boolean; summary: { phasesCompleted: number; phasesErrored: number; totalEvidenceItems: number; totalSpans: number } },
    totalPhases: number,
  ): string {
    const lines: string[] = [
      "═══ EPIC-007 Operator Summary ═══",
      `Discipline: ${discipline.discipline} (${(discipline.assignment.confidence * 100).toFixed(0)}%)`,
      `Status: ${execution.success ? "SUCCESS" : "FAILED"}`,
      `Errors: ${execution.errors.length}`,
      `Evidence Items: ${execution.evidence.length}`,
      `Active Flags: ${flagBundle.flags.size}`,
      ...(research ? [`Research: ${research.hitCount} hits, ${research.errorCount} errors`] : []),
      `Trace: ${trace.success ? "COMPLETE" : "INCOMPLETE"} — ${trace.summary.phasesCompleted}/${totalPhases} phases ok`,
      "",
    ];

    if (execution.errors.length > 0) {
      lines.push("Errors:");
      for (const err of execution.errors) {
        lines.push(`  • ${err}`);
      }
    }

    return lines.join("\n");
  }
}