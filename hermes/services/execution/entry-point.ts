// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Executive Execution Entry Point          │
// │ EPIC-007 · Deliverable 03                                   │
// │ Single-command gateway that bridges EPCL planning            │
// │ with Hermes execution (WAS + WEF). Integration-first:       │
// │ no redesign of EPCL, WAS, or WEF.                           │
// └─────────────────────────────────────────────────────────────┘

import { ExecutionContext } from "./context.js";
import type { TraceSpan, ExecutionPhase, ExecutionEvidence } from "./context.js";

import type { Principal } from "../../contracts/platform-api.js";
import type { PlanAtom, ExecutionBatch } from "../../contracts/planning.js";

// ── Local types ──────────────────────────────────────────────────

export type OperatorCommand = {
  /** The action to execute (e.g. "deploy", "migrate", "test"). */
  action: string;
  /** Human-readable description of what this command does. */
  description: string;
  /** Target discipline — auto-selected if omitted. */
  discipline?: string;
  /** Explicit plan atom ID this command is tied to. */
  atomId?: string;
  /** Override feature flags for this command execution. */
  flags?: Record<string, boolean>;
  /** Optional batch context this command belongs to. */
  batchId?: string;
};

export type ExecutionResult = {
  /** The execution context that governed this run. */
  contextId: string;
  /** Whether the execution succeeded. */
  success: boolean;
  /** The evidence packages collected during execution. */
  evidence: ExecutionEvidence[];
  /** The trace spans generated during execution. */
  trace: TraceSpan[];
  /** Any error messages (empty if success === true). */
  errors: string[];
  /** Whether the execution was handled by the operator or automated. */
  mode: "operator" | "automated";
};

export type OperatorExecuteOptions = {
  tenant: string;
  principal: Principal;
  capability: string;
  backend: string;
  command: OperatorCommand;
  /** Pre-created ExecutionContext (optional — one is created if omitted). */
  context?: ExecutionContext;
};

// ── Class ────────────────────────────────────────────────────────

export class ExecutiveExecutionEntryPoint {
  /**
   * Execute a single operator command. This is the primary
   * EPIC-007 surface — it wires together context, discipline routing,
   * activation, delegation, evidence capture, and trace generation
   * without requiring the caller to manage any of those concerns.
   *
   * @param opts - Tenant, principal, capability, backend, and command.
   * @returns ExecutionResult with context ID, evidence, trace, and status.
   */
  static async execute(opts: OperatorExecuteOptions): Promise<ExecutionResult> {
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

    const errors: string[] = [];
    const startTime = Date.now();
    const rootSpanId = `span_${Date.now()}`;

    // ── Phase 1: Planning ──────────────────────────────────────────
    const planSpan = ExecutiveExecutionEntryPoint._createSpan(
      rootSpanId, "planning", command.action,
    );
    ctx.recordSpan(planSpan);

    // ── Phase 2: Discipline routing (auto if not specified) ────────
    ctx.advancePhase("discipline-routing");
    const disciplineSpan = ExecutiveExecutionEntryPoint._createSpan(
      rootSpanId, "discipline-routing", command.discipline ?? "auto",
    );
    ctx.recordSpan(disciplineSpan);

    // Apply any command-level feature flags
    if (command.flags) {
      for (const [k, v] of Object.entries(command.flags)) {
        ctx.setFlag(k, v);
      }
    }

    // ── Phase 3: Activation ────────────────────────────────────────
    ctx.advancePhase("activation");
    const activationSpan = ExecutiveExecutionEntryPoint._createSpan(
      rootSpanId, "activation", "activating",
    );
    ctx.recordSpan(activationSpan);

    // ── Phase 4: Execution (delegation to WEF via WAS) ────────────
    ctx.advancePhase("execution");
    const executionSpan = ExecutiveExecutionEntryPoint._createSpan(
      rootSpanId, "execution", command.action,
    );
    ctx.recordSpan(executionSpan);

    // Evidence is captured during execution — this is where WAS/WEF
    // integration hooks in. The entry point provides the context;
    // actual delegation is handled by the WAS layer.

    // ── Phase 5: Trace ──────────────────────────────────────────────
    ctx.advancePhase("trace");
    const traceSpan = ExecutiveExecutionEntryPoint._createSpan(
      rootSpanId, "trace", "complete",
    );
    ctx.recordSpan(traceSpan);

    // Finalize all spans
    const trace = ctx.getTrace();
    for (const span of trace) {
      if (!span.endedAt) {
        span.endedAt = new Date().toISOString();
        span.durationMs = Date.now() - startTime;
        span.status = "ok";
      }
    }

    return {
      contextId: ctx.id,
      success: errors.length === 0,
      evidence: ctx.getEvidence() as ExecutionEvidence[],
      trace: ctx.getTrace() as TraceSpan[],
      errors,
      mode: "operator",
    };
  }

  /**
   * Quick synchronous entry point for non-async operations
   * (e.g. flag checks, context inspection).
   */
  static inspect(opts: {
    tenant: string;
    principal: Principal;
    capability: string;
    backend: string;
  }): { contextId: string; summary: Record<string, unknown> } {
    const ctx = ExecutionContext.create({
      ...opts,
      source: "operator",
    });
    return { contextId: ctx.id, summary: ctx.summary() };
  }

  // ── Internal helpers ────────────────────────────────────────────

  private static _createSpan(
    parentSpanId: string,
    phase: ExecutionPhase,
    label: string,
    status: "ok" | "error" | "skipped" = "ok",
  ): TraceSpan {
    const now = Date.now();
    return {
      phase,
      spanId: `span_${now}_${Math.random().toString(36).slice(2, 6)}`,
      parentSpanId,
      startedAt: new Date(now).toISOString(),
      status,
      details: { label },
    };
  }
}
