// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution State Persistence                   │
// │ EPIC-004.5 PHASE 1+2+4 · durable execution boundary.           │
// │                                                            \
// │  ExecutionStore             : canonical execution boundary     │
// │  ExecutionPersistenceBackend : provider-neutral low-level store │
// │  MemoryExecutionBackend      : in-memory impl (dev/edge/tests)  │
// │                                                            \
// │ Reuses the canonical task lifecycle from agents/task.ts         │
// │ (canTransitionTask) — NEVER redefines the state machine.       │
// │ Tenant isolation via EPIC-004 enforceTenant (fail-closed).     │
// │ D1 is NEVER referenced. To add D1, implement                    │
// │ ExecutionPersistenceBackend — no redesign needed.              │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { enforceTenant, TenantViolationError } from "./tenant.js";

// ── PHASE 1: Execution domain contracts ──────────────────────────

/**
 * Execution lifecycle REUSES the canonical task state machine
 * (created → assigned → approved → running → completed|failed|cancelled,
 * plus cancelled terminal). Declared locally to avoid a persistence→services
 * layering inversion; the legal-transition SET is identical to agents/task.ts.
 */
export type ExecutionState =
  | "created"
  | "assigned"
  | "approved"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

const EXECUTION_TRANSITIONS: Record<ExecutionState, ExecutionState[]> = {
  created: ["assigned", "cancelled"],
  assigned: ["approved", "cancelled"],
  approved: ["running", "cancelled"],
  running: ["completed", "failed", "cancelled"],
  completed: [],
  failed: ["assigned", "cancelled"],
  cancelled: [],
};

export function canTransitionExecution(from: ExecutionState, to: ExecutionState): boolean {
  return EXECUTION_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A recorded execution lifecycle transition (immutable). */
export interface ExecutionTransition {
  from: ExecutionState;
  to: ExecutionState;
  at: string;
  by: string;
}

/** A durable human approval decision (PHASE 4). */
export interface ExecutionApproval {
  approver: string;
  at: string;
  capability: string;
  /** Execution scope (e.g. applicationId + permissions). */
  scope: string;
  /** Optional expiry ISO; if set and passed, approval is DENIED on use. */
  expiresAt?: string;
}

/** A single execution attempt (retry record). */
export interface ExecutionAttempt {
  attempt: number;
  at: string;
  ok: boolean;
  /** Backend that served the attempt (from the dispatcher). */
  backend: string;
  error?: string;
}

/** The terminal result of an execution. */
export interface ExecutionResult {
  ok: boolean;
  state: ExecutionState;
  attempts: number;
  data?: unknown;
  error?: string;
  completedAt: string;
}

/** Canonical durable execution record — Hermes-owned execution truth. */
export interface ExecutionTask {
  /** Execution id (stable handle). */
  id: string;
  /** Workflow id this execution belongs to (optional linkage). */
  workflowId?: string;
  /** Owning tenant/organization id. */
  tenant: string;
  /** Principal id that requested execution. */
  principal: string;
  /** Capability to execute. */
  capability: string;
  /** Resolved executor backend. */
  backend: string;
  /** Lifecycle state (shared machine with agents/task.ts). */
  state: ExecutionState;
  /** Human approval gate state. */
  approval?: ExecutionApproval;
  /** Immutable transition history. */
  transitions: ExecutionTransition[];
  /** Attempt log (retries). */
  attempts: ExecutionAttempt[];
  /** Final result (once terminal). */
  result?: ExecutionResult;
  createdAt: string;
  updatedAt: string;
}

// ── PHASE 2: ExecutionStore boundary ─────────────────────────────

/** Provider-neutral low-level store (D1/Postgres/KV implement). */
export interface ExecutionPersistenceBackend {
  put(exec: ExecutionTask): void;
  get(id: string): ExecutionTask | undefined;
  /** Recoverable = non-terminal (queued/assigned/approved/running). */
  listRecoverable(): ExecutionTask[];
  listByTenant(tenant: string): ExecutionTask[];
  delete(id: string): void;
  clear(): void;
}

export class ExecutionError extends Error {}

/** Canonical execution store boundary. Tenant-scoped + fail-closed. */
export interface ExecutionStore {
  /** Create a new execution record (state: created). Rejects missing tenant. */
  create(input: {
    id: string;
    tenant: string;
    principal: string;
    capability: string;
    backend: string;
    workflowId?: string;
    principalSubject: Principal; // for tenant enforcement
  }): ExecutionTask;
  /** Get an execution (tenant-enforced). */
  get(id: string, principal: Principal): ExecutionTask | undefined;
  /** Apply a lifecycle transition. Illegal → throw (reuses task machine). */
  transition(id: string, to: ExecutionState, principal: Principal, by?: string): ExecutionTask;
  /** Record an attempt (retry log). */
  recordAttempt(id: string, attempt: ExecutionAttempt, principal: Principal): ExecutionTask;
  /** Persist a human approval decision. */
  recordApproval(id: string, approval: ExecutionApproval, principal: Principal): ExecutionTask;
  /** Record the terminal result. */
  recordResult(id: string, result: ExecutionResult, principal: Principal): ExecutionTask;
  /** List executions recoverable after a restart (non-terminal). */
  listRecoverable(principal: Principal): ExecutionTask[];
}

export function createExecutionStore(backend: ExecutionPersistenceBackend): ExecutionStore {
  function load(id: string, principal: Principal): ExecutionTask {
    const ex = backend.get(id);
    if (!ex) throw new ExecutionError(`Unknown execution: ${id}`);
    enforceTenant(principal, ex.tenant);
    return ex;
  }

  return {
    create({ id, tenant, principal, capability, backend: be, workflowId, principalSubject }): ExecutionTask {
      if (!tenant) throw new ExecutionError("Missing tenant — execution cannot be created");
      enforceTenant(principalSubject, tenant);
      const existing = backend.get(id);
      if (existing) throw new ExecutionError(`Execution already exists: ${id}`);
      const now = new Date().toISOString();
      const ex: ExecutionTask = {
        id,
        ...(workflowId ? { workflowId } : {}),
        tenant,
        principal,
        capability,
        backend: be,
        state: "created",
        transitions: [],
        attempts: [],
        createdAt: now,
        updatedAt: now,
      };
      backend.put(ex);
      return ex;
    },

    get(id, principal): ExecutionTask | undefined {
      const ex = backend.get(id);
      if (!ex) return undefined;
      enforceTenant(principal, ex.tenant);
      return ex;
    },

    transition(id, to, principal, by): ExecutionTask {
      const ex = load(id, principal);
      if (!canTransitionExecution(ex.state, to)) {
        throw new ExecutionError(`Illegal execution transition: ${ex.state} -> ${to}`);
      }
      const now = new Date().toISOString();
      const updated: ExecutionTask = {
        ...ex,
        state: to,
        updatedAt: now,
        transitions: [...ex.transitions, { from: ex.state, to, at: now, by: by ?? principal.id }],
      };
      backend.put(updated);
      return updated;
    },

    recordAttempt(id, attempt, principal): ExecutionTask {
      const ex = load(id, principal);
      const updated: ExecutionTask = {
        ...ex,
        updatedAt: attempt.at,
        attempts: [...ex.attempts, attempt],
      };
      backend.put(updated);
      return updated;
    },

    recordApproval(id, approval, principal): ExecutionTask {
      const ex = load(id, principal);
      const now = new Date().toISOString();
      const updated: ExecutionTask = {
        ...ex,
        updatedAt: now,
        approval,
      };
      backend.put(updated);
      return updated;
    },

    recordResult(id, result, principal): ExecutionTask {
      const ex = load(id, principal);
      const updated: ExecutionTask = {
        ...ex,
        state: result.state,
        updatedAt: result.completedAt,
        result,
        transitions: [
          ...ex.transitions,
          { from: ex.state, to: result.state, at: result.completedAt, by: principal.id },
        ],
      };
      backend.put(updated);
      return updated;
    },

    listRecoverable(principal): ExecutionTask[] {
      return backend
        .listRecoverable()
        .filter((e) => {
          try {
            enforceTenant(principal, e.tenant);
            return true;
          } catch {
            return false;
          }
        });
    },
  };
}

// ── In-memory backend (ships today; D1/Postgres/KV are future seams) ──

export class MemoryExecutionBackend implements ExecutionPersistenceBackend {
  private readonly map = new Map<string, ExecutionTask>();

  put(ex: ExecutionTask): void {
    this.map.set(ex.id, {
      ...ex,
      transitions: [...ex.transitions],
      attempts: [...ex.attempts],
      ...(ex.approval ? { approval: { ...ex.approval } } : {}),
      ...(ex.result ? { result: { ...ex.result } } : {}),
    });
  }
  get(id: string): ExecutionTask | undefined {
    const ex = this.map.get(id);
    if (!ex) return undefined;
    return {
      ...ex,
      transitions: [...ex.transitions],
      attempts: [...ex.attempts],
      ...(ex.approval ? { approval: { ...ex.approval } } : {}),
      ...(ex.result ? { result: { ...ex.result } } : {}),
    };
  }
  listRecoverable(): ExecutionTask[] {
    return [...this.map.values()].filter(
      (e) => e.state === "created" || e.state === "assigned" || e.state === "approved" || e.state === "running",
    );
  }
  listByTenant(tenant: string): ExecutionTask[] {
    return [...this.map.values()].filter((e) => e.tenant === tenant).map((e) => ({ ...e }));
  }
  delete(id: string): void {
    this.map.delete(id);
  }
  clear(): void {
    this.map.clear();
  }
}

/** Ready execution store over an in-memory backend. */
export function createMemoryExecutionStore(): ExecutionStore {
  return createExecutionStore(new MemoryExecutionBackend());
}

export { TenantViolationError };
