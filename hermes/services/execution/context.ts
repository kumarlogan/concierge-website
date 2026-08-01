// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Execution Context                      │
// │ EPIC-007 · Deliverable 02                                   │
// │ Foundation data object wrapping every execution with       │
// │ metadata, provenance, and trace context. Pure data +       │
// │ factory. No side effects.                                   │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../contracts/platform-api.js";
import type { ExecutionBatch } from "../../contracts/planning.js";

// ── Types ────────────────────────────────────────────────────

export type ExecutionPhase =
  | "planning"
  | "discipline-routing"
  | "activation"
  | "execution"
  | "delegation"
  | "recovery"
  | "trace";

export type ExecutionProvenance = {
  /** The plan atom (if this execution derives from a plan). */
  atomId?: string;
  /** The EPCL execution batch (if batch-driven). */
  batchId?: string;
  /** The discipline that routed this execution. */
  discipline?: string;
  /** The original request source (e.g. "operator", "automated"). */
  source: string;
  /** ISO-8601 timestamp of request creation. */
  requestedAt: string;
};

export type TraceSpan = {
  /** Phase this span covers. */
  phase: ExecutionPhase;
  /** Unique span id (correlates across phases). */
  spanId: string;
  /** Parent span id (empty string for root). */
  parentSpanId: string;
  /** When this span started. */
  startedAt: string;
  /** When this span ended (omit if in-flight). */
  endedAt?: string;
  /** Duration in ms (set when ended). */
  durationMs?: number;
  /** Any status message or error. */
  status?: "ok" | "error" | "skipped";
  /** Free-form details. */
  details?: Record<string, unknown>;
};

export type ExecutionEvidence = {
  /** Artifact type (e.g. "wrangler-deploy", "github-pr", "cf-pages"). */
  type: string;
  /** Artifact identifier (deployment id, PR number, etc.). */
  reference: string;
  /** Backend that produced this evidence. */
  backend: string;
  /** When evidence was captured. */
  capturedAt: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
};

export type ExecutionContextInput = {
  tenant: string;
  principal: Principal;
  capability: string;
  backend: string;
  /** The request source (e.g. "operator", "automated", "recovery"). */
  source: string;
  /** Optional plan atom this execution is tied to. */
  atomId?: string;
  /** Optional batch this execution belongs to. */
  batchId?: string;
  /** Optional discipline that routed this execution. */
  discipline?: string;
};

// ── Class ─────────────────────────────────────────────────────

export class ExecutionContext {
  readonly id: string;
  readonly tenant: string;
  readonly principal: Principal;
  readonly capability: string;
  readonly backend: string;
  readonly provenance: ExecutionProvenance;
  private _phase: ExecutionPhase;
  readonly traceSpans: TraceSpan[];
  readonly evidence: ExecutionEvidence[];
  readonly createdAt: string;
  readonly flags: Record<string, boolean>;

  private constructor(input: ExecutionContextInput) {
    this.id = `ctx_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    this.tenant = input.tenant;
    this.principal = input.principal;
    this.capability = input.capability;
    this.backend = input.backend;
    this.provenance = {
      atomId: input.atomId,
      batchId: input.batchId,
      discipline: input.discipline,
      source: input.source,
      requestedAt: new Date().toISOString(),
    };
    this._phase = "planning";
    this.traceSpans = [];
    this.evidence = [];
    this.createdAt = new Date().toISOString();
    this.flags = {};
  }

  /** Get the current execution phase (read-only getter). */
  get phase(): ExecutionPhase {
    return this._phase;
  }

  // ── Factory ────────────────────────────────────────────

  /** Create a fresh ExecutionContext from input parameters. */
  static create(input: ExecutionContextInput): ExecutionContext {
    return new ExecutionContext(input);
  }

  // ── Mutation (returns this for chaining) ───────────────

  /** Advance to a new execution phase. */
  advancePhase(phase: ExecutionPhase): this {
    this._phase = phase;
    return this;
  }

  /** Record a trace span for this execution. */
  recordSpan(span: TraceSpan): this {
    this.traceSpans.push(span);
    return this;
  }

  /** Attach execution evidence (deployment, PR, etc.). */
  attachEvidence(evidence: ExecutionEvidence): this {
    this.evidence.push(evidence);
    return this;
  }

  /** Set an execution-scoped feature flag. */
  setFlag(key: string, value: boolean): this {
    this.flags[key] = value;
    return this;
  }

  /** Get the current execution-scoped flag value (defaults to false). */
  getFlag(key: string): boolean {
    return this.flags[key] ?? false;
  }

  // ── Read-only views ────────────────────────────────────

  /** Get a snapshot of the trace (immutable copy). */
  getTrace(): readonly TraceSpan[] {
    return [...this.traceSpans];
  }

  /** Get the evidence package collected so far. */
  getEvidence(): readonly ExecutionEvidence[] {
    return [...this.evidence];
  }

  /** Get a flat summary for logging or audit. */
  summary(): Record<string, unknown> {
    return {
      id: this.id,
      tenant: this.tenant,
      capability: this.capability,
      backend: this.backend,
      phase: this.phase,
      provenance: this.provenance,
      spanCount: this.traceSpans.length,
      evidenceCount: this.evidence.length,
      flagCount: Object.keys(this.flags).length,
      createdAt: this.createdAt,
    };
  }
}
