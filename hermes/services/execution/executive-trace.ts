// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Executive Trace Generation                │
// │ EPIC-007 · Deliverable 06                                     │
// │ Generates structured Executive Trace documents from           │
// │ ExecutionContext trace spans and evidence. Produces a       │
// │ trace tree correlating planning → routing → activation →   │
// │ execution → verification phases.                              │
// └─────────────────────────────────────────────────────────────┘

import { ExecutionContext } from "./context.js";
import type { TraceSpan, ExecutionPhase, ExecutionEvidence } from "./context.js";
import { emitAudit } from "../../audit/event.js";

// ── Types ──────────────────────────────────────────────

export type TraceNode = {
  /** The phase this node represents. */
  phase: ExecutionPhase;
  /** Unique node id. */
  nodeId: string;
  /** Parent node id (empty for root). */
  parentNodeId: string;
  /** Status of this node. */
  status: "ok" | "error" | "skipped" | "in-flight";
  /** Start timestamp. */
  startedAt: string;
  /** End timestamp (if completed). */
  endedAt?: string;
  /** Duration in ms (if completed). */
  durationMs?: number;
  /** Evidence items captured at this node. */
  evidence: ExecutionEvidence[];
  /** Children nodes (sub-phases). */
  children: TraceNode[];
  /** Free-form details. */
  details?: Record<string, unknown>;
};

export type ExecutiveTrace = {
  /** The trace id (correlates with ExecutionContext id). */
  traceId: string;
  /** The execution context id this trace belongs to. */
  contextId: string;
  /** The root node of the trace tree. */
  root: TraceNode;
  /** All leaf nodes (terminal phases). */
  leaves: TraceNode[];
  /** Total duration from first span start to last span end. */
  totalDurationMs?: number;
  /** Whether the full trace completed successfully. */
  success: boolean;
  /** When the trace was generated. */
  generatedAt: string;
  /** Summary of findings. */
  summary: {
    totalPhases: number;
    phasesCompleted: number;
    phasesErrored: number;
    totalEvidenceItems: number;
    totalSpans: number;
  };
};

export type TraceOptions = {
  /** Include evidence in the trace nodes. */
  includeEvidence?: boolean;
  /** Include timing details. */
  includeTiming?: boolean;
};

// ── Class ──────────────────────────────────────────────

export class ExecutiveTraceGenerator {
  private static instance: ExecutiveTraceGenerator;

  private constructor() {}

  static getInstance(): ExecutiveTraceGenerator {
    if (!ExecutiveTraceGenerator.instance) {
      ExecutiveTraceGenerator.instance = new ExecutiveTraceGenerator();
    }
    return ExecutiveTraceGenerator.instance;
  }

  /**
   * Generate an ExecutiveTrace from an ExecutionContext.
   * Builds a hierarchical trace tree from the flat spans recorded
   * in the execution context, correlating each phase with its
   * evidence and timing.
   *
   * @param ctx - The execution context to generate trace from.
   * @param options - Trace generation options.
   * @returns ExecutiveTrace document.
   */
  generate(ctx: ExecutionContext, options: TraceOptions = {}): ExecutiveTrace {
    const { includeEvidence = true, includeTiming = true } = options;
    const spans = ctx.getTrace();

    // Build a tree structure from flat spans
    const phaseOrder: ExecutionPhase[] = [
      "planning",
      "discipline-routing",
      "activation",
      "execution",
      "delegation",
      "recovery",
      "trace",
    ];

    // Group spans by phase
    const phaseSpans = new Map<ExecutionPhase, TraceSpan[]>();
    for (const phase of phaseOrder) {
      phaseSpans.set(phase, []);
    }
    for (const span of spans) {
      const existing = phaseSpans.get(span.phase) ?? [];
      existing.push(span);
      phaseSpans.set(span.phase, existing);
    }

    // Build trace nodes
    const rootNode = this._buildNode(phaseOrder[0], phaseSpans.get(phaseOrder[0]) ?? [], ctx, includeEvidence, includeTiming);
    const allNodes: TraceNode[] = [rootNode];
    const leaves: TraceNode[] = [];

    for (let i = 1; i < phaseOrder.length; i++) {
      const node = this._buildNode(phaseOrder[i], phaseSpans.get(phaseOrder[i]) ?? [], ctx, includeEvidence, includeTiming);
      allNodes.push(node);
    }

    // Identify leaves (nodes without children or terminal phases)
    const terminalPhases = new Set(["execution", "trace", "recovery"]);
    for (const node of allNodes) {
      if (node.children.length === 0 || terminalPhases.has(node.phase)) {
        leaves.push(node);
      }
    }

    // Calculate totals
    const totalEvidence = includeEvidence ? ctx.getEvidence().length : 0;
    let totalDuration: number | undefined;
    const allSpans = ctx.getTrace();
    if (allSpans.length > 0) {
      const firstStart = new Date(allSpans[0].startedAt).getTime();
      const lastEnd = allSpans.reduce(
        (max, s) => Math.max(max, s.endedAt ? new Date(s.endedAt).getTime() : firstStart),
        firstStart,
      );
      totalDuration = lastEnd - firstStart;
    }

    const summary = {
      totalPhases: phaseOrder.length,
      phasesCompleted: allNodes.filter((n) => n.status === "ok").length,
      phasesErrored: allNodes.filter((n) => n.status === "error").length,
      totalEvidenceItems: totalEvidence,
      totalSpans: allSpans.length,
    };

    const trace: ExecutiveTrace = {
      traceId: `trace_${ctx.id}`,
      contextId: ctx.id,
      root: rootNode,
      leaves,
      ...(totalDuration !== undefined ? { totalDurationMs: totalDuration } : {}),
      success: summary.phasesErrored === 0,
      generatedAt: new Date().toISOString(),
      summary,
    };

    // Audit the trace generation
    emitAudit("epic007.trace.generated", ctx.principal.id, {
      contextId: ctx.id,
      traceId: trace.traceId,
      success: trace.success,
      totalPhases: summary.totalPhases,
      phasesCompleted: summary.phasesCompleted,
      totalEvidenceItems: summary.totalEvidenceItems,
      totalDurationMs: totalDuration,
      tenant: ctx.tenant,
    }, { tenant: ctx.tenant });

    return trace;
  }

  /**
   * Build a TraceNode from a phase and its spans.
   */
  private _buildNode(
    phase: ExecutionPhase,
    spans: TraceSpan[],
    ctx: ExecutionContext,
    includeEvidence: boolean,
    includeTiming: boolean,
  ): TraceNode {
    const phaseSpans = spans.length > 0 ? spans : [
      {
        phase,
        spanId: `span_${phase}_empty`,
        parentSpanId: "",
        startedAt: ctx.createdAt,
        status: "skipped" as const,
        details: { note: "No spans recorded for this phase" },
      },
    ];

    const latestSpan = phaseSpans[phaseSpans.length - 1];
    const firstSpan = phaseSpans[0];

    const node: TraceNode = {
      phase,
      nodeId: `node_${phase}_${Date.now()}`,
      parentNodeId: "",
      status: latestSpan.status ?? "in-flight",
      startedAt: firstSpan.startedAt,
      ...(latestSpan.endedAt ? { endedAt: latestSpan.endedAt } : {}),
      ...(latestSpan.durationMs !== undefined && includeTiming ? { durationMs: latestSpan.durationMs } : {}),
      evidence: includeEvidence ? ctx.getEvidence().filter(
        (e) => !phaseSpans.some((s) => s.details?.backend === e.backend),
      ) : [],
      children: [],
      details: {
        spanCount: phaseSpans.length,
        ...(latestSpan.details ?? {}),
      },
    };

    return node;
  }

  /**
   * Format an ExecutiveTrace as a human-readable string for
   * operator console display or logging.
   */
  formatTrace(trace: ExecutiveTrace): string {
    const lines: string[] = [
      `═══ Executive Trace ═══`,
      `Trace ID: ${trace.traceId}`,
      `Context ID: ${trace.contextId}`,
      `Generated: ${trace.generatedAt}`,
      `Success: ${trace.success}`,
      `Total Duration: ${trace.totalDurationMs ?? "N/A"}ms`,
      ``,
      `Summary:`,
      `  Phases: ${trace.summary.totalPhases} total, ${trace.summary.phasesCompleted} ok, ${trace.summary.phasesErrored} errored`,
      `  Evidence Items: ${trace.summary.totalEvidenceItems}`,
      `  Spans: ${trace.summary.totalSpans}`,
      ``,
      `Trace Tree:`,
    ];

    this._formatNode(lines, trace.root, 0);

    for (const leaf of trace.leaves) {
      if (leaf !== trace.root) {
        this._formatNode(lines, leaf, 1);
      }
    }

    return lines.join("\n");
  }

  private _formatNode(lines: string[], node: TraceNode, indent: number): void {
    const prefix = "  ".repeat(indent) + (indent > 0 ? "└─ " : "");
    const duration = node.durationMs !== undefined ? ` (${node.durationMs}ms)` : "";
    lines.push(`${prefix}[${node.phase}] ${node.status}${duration}`);
    for (const child of node.children) {
      this._formatNode(lines, child, indent + 1);
    }
  }
}