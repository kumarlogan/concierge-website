// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution Idempotency Model                  │
// │ EPIC-004.6 PHASE 2 · guarantee no duplicate external actions.  │
// │                                                            \
// │ Every execution request carries a stable requestId. Duplicate │
// │ requestIds are DENIED (or return the existing execution).     │
// │ Retries reuse the SAME executionId (lineage preserved).       │
// └─────────────────────────────────────────────────────────────┘

/** Stable identity attached to every execution request. */
export interface ExecutionRequestIdentity {
  /** Client-supplied idempotency key (UUID / dedup token). */
  requestId: string;
  /** Hermes execution handle (stable across retries). */
  executionId: string;
  /** Owning tenant. */
  tenantId: string;
  /** ISO timestamp the request was first seen. */
  createdAt: string;
}

/** Result of attempting to register a request identity. */
export type IdempotencyOutcome =
  | { kind: "accepted"; identity: ExecutionRequestIdentity }
  | { kind: "duplicate"; existing: ExecutionRequestIdentity }
  | { kind: "rejected"; reason: string };

/**
 * In-memory idempotency tracker. Provider-neutral seam: a D1/Redis-backed
 * variant can implement the same shape later (no call-site change).
 *
 * Guarantees:
 *  - Same requestId seen twice → DENY duplicate creation (return existing).
 *  - Retries that reuse the same requestId + executionId are idempotent.
 *  - No two distinct executions may share a requestId.
 */
export class ExecutionIdempotencyTracker {
  private readonly byRequestId = new Map<string, ExecutionRequestIdentity>();
  private readonly byExecutionId = new Map<string, string>(); // executionId → requestId

  constructor(private readonly now: () => string = () => new Date().toISOString()) {}

  /**
   * Register a request. If the requestId already exists:
   *  - returns the existing identity (duplicate) when the executionId matches,
   *    so retries safely reuse lineage;
   *  - rejects (different executionId for same requestId) to prevent
   *    shadow/colliding executions.
   */
  register(input: Omit<ExecutionRequestIdentity, "createdAt">): IdempotencyOutcome {
    const existing = this.byRequestId.get(input.requestId);
    if (existing) {
      if (existing.executionId === input.executionId && existing.tenantId === input.tenantId) {
        return { kind: "duplicate", existing };
      }
      return {
        kind: "rejected",
        reason: `requestId "${input.requestId}" already bound to execution "${existing.executionId}"`,
      };
    }
    const identity: ExecutionRequestIdentity = { ...input, createdAt: this.now() };
    this.byRequestId.set(identity.requestId, identity);
    this.byExecutionId.set(identity.executionId, identity.requestId);
    return { kind: "accepted", identity };
  }

  /** Look up an existing identity by requestId (safe reuse). */
  get(requestId: string): ExecutionRequestIdentity | undefined {
    return this.byRequestId.get(requestId);
  }

  /** True when this requestId has already been accepted. */
  seen(requestId: string): boolean {
    return this.byRequestId.has(requestId);
  }

  /** Clear (tests / restart of in-memory tracker). */
  clear(): void {
    this.byRequestId.clear();
    this.byExecutionId.clear();
  }
}
