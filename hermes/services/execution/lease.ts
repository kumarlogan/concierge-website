// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution Lease Contract                     │
// │ EPIC-004.6 PHASE 3 · prepares for future distributed workers.  │
// │                                                            \
// │ CONTRACT ONLY. No distributed worker implementation. Defines  │
// │ the lease shape + rules so EPIC-005+ can plug in safely:      │
// │  - expired leases are recoverable                            │
// │  - an active lease cannot be stolen                          │
// │  - an unknown worker is denied                               │
// └─────────────────────────────────────────────────────────────┘

/** A time-bounded claim on an execution by a worker. */
export interface ExecutionLease {
  /** Execution the lease covers. */
  executionId: string;
  /** Worker that holds the lease. */
  workerId: string;
  /** ISO time the lease was acquired. */
  acquiredAt: string;
  /** ISO time the lease expires (fail-open recovery window). */
  expiresAt: string;
  /** ISO time of the last heartbeat (liveness). */
  heartbeatAt: string;
}

export type LeaseAcquireResult =
  | { ok: true; lease: ExecutionLease }
  | { ok: false; reason: string };

export type LeaseState = "active" | "expired" | "none";

/**
 * Contract for a lease manager. Implementations (in-memory now, distributed
 * later) MUST honor the rules below. This interface is the seam EPIC-005's
 * worker pool will depend on — never the concrete store.
 */
export interface ExecutionLeaseManager {
  /** Acquire a lease. Returns { ok:true, lease } on success, or { ok:false, reason } if an active lease is held by another worker. */
  acquire(executionId: string, workerId: string, ttlMs: number): LeaseAcquireResult;
  /** Renew an existing lease via heartbeat (same worker only). */
  heartbeat(executionId: string, workerId: string): ExecutionLease | null;
  /** Release a lease held by workerId. */
  release(executionId: string, workerId: string): void;
  /** Current lease for an execution, or null if none. */
  get(executionId: string): ExecutionLease | null;
  /** State of the lease relative to `now`. */
  state(executionId: string, now?: number): LeaseState;
}

/** Lease rule enforcement shared by all implementations. */
export function leaseRules() {
  return {
    /** An active lease cannot be stolen by another worker. */
    stealForbidden: true,
    /** Expired leases are recoverable (re-acquirable). */
    expiredRecoverable: true,
    /** Unknown worker is denied all mutating operations. */
    unknownWorkerDenied: true,
  } as const;
}

/**
 * In-memory lease manager — satisfies the contract for single-node use and
 * as a reference implementation for distributed backends.
 */
export class MemoryExecutionLeaseManager implements ExecutionLeaseManager {
  private readonly leases = new Map<string, ExecutionLease>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  acquire(executionId: string, workerId: string, ttlMs: number): LeaseAcquireResult {
    const existing = this.leases.get(executionId);
    if (existing && existing.workerId !== workerId && existing.expiresAt > new Date(this.clock()).toISOString()) {
      return { ok: false, reason: `active lease held by ${existing.workerId}` }; // cannot steal
    }
    const now = this.clock();
    const lease: ExecutionLease = {
      executionId,
      workerId,
      acquiredAt: new Date(now).toISOString(),
      expiresAt: new Date(now + ttlMs).toISOString(),
      heartbeatAt: new Date(now).toISOString(),
    };
    this.leases.set(executionId, lease);
    return { ok: true, lease };
  }

  heartbeat(executionId: string, workerId: string): ExecutionLease | null {
    const lease = this.leases.get(executionId);
    if (!lease) return null;
    if (lease.workerId !== workerId) return null; // unknown worker denied
    const now = this.clock();
    if (lease.expiresAt <= new Date(now).toISOString()) return null; // expired → not recoverable via heartbeat
    const renewed: ExecutionLease = { ...lease, heartbeatAt: new Date(now).toISOString() };
    this.leases.set(executionId, renewed);
    return renewed;
  }

  release(executionId: string, workerId: string): void {
    const lease = this.leases.get(executionId);
    if (!lease) return;
    if (lease.workerId !== workerId) return; // unknown worker denied
    this.leases.delete(executionId);
  }

  get(executionId: string): ExecutionLease | null {
    return this.leases.get(executionId) ?? null;
  }

  state(executionId: string, now: number = this.clock()): LeaseState {
    const lease = this.leases.get(executionId);
    if (!lease) return "none";
    return lease.expiresAt > new Date(now).toISOString() ? "active" : "expired";
  }
}
