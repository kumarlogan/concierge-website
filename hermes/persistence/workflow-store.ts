// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workflow State Persistence                   │
// │ EPIC-004 PHASE 2 · durable workflow lifecycle boundary.       │
// │                                                            \
// │  WorkflowStore           : canonical boundary                │
// │  WorkflowPersistenceBackend: provider-neutral low-level store │
// │  MemoryWorkflowStore      : in-memory impl (dev/edge + tests)  │
// │                                                            \
// │ D1 is NEVER referenced. To add D1, implement                  │
// │ WorkflowPersistenceBackend — no redesign needed.             │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../contracts/platform-api.js";
import { enforceTenant, TenantViolationError } from "./tenant.js";

/** Workflow lifecycle states (orthogonal to agent lifecycle). */
export type WorkflowState =
  | "planned"
  | "running"
  | "paused"
  | "suspended"
  | "completed"
  | "failed"
  | "cancelled";

/** Legal workflow transitions (fail-closed — illegal moves rejected). */
export const WORKFLOW_TRANSITIONS: Record<WorkflowState, WorkflowState[]> = {
  planned: ["running", "cancelled"],
  running: ["paused", "suspended", "completed", "failed", "cancelled"],
  paused: ["running", "cancelled"],
  suspended: ["running", "cancelled"],
  completed: [],
  failed: ["planned", "cancelled"], // allow re-plan after failure
  cancelled: [],
};

export function canTransitionWorkflow(from: WorkflowState, to: WorkflowState): boolean {
  return WORKFLOW_TRANSITIONS[from]?.includes(to) ?? false;
}

/** A single recorded transition (immutable audit of state changes). */
export interface WorkflowTransition {
  from: WorkflowState;
  to: WorkflowState;
  at: string;
  /** Principal id that caused the transition. */
  by: string;
}

/** A recorded approval (human authorization gate). */
export interface WorkflowApproval {
  at: string;
  approver: string;
  note?: string;
}

/** Canonical durable workflow record. */
export interface Workflow {
  id: string;
  tenant: string;
  /** Owner principal id (authorized to act on this workflow). */
  owner: string;
  state: WorkflowState;
  transitions: WorkflowTransition[];
  createdAt: string;
  updatedAt: string;
  approvals: WorkflowApproval[];
  /** Audit event ids correlated to this workflow. */
  auditEvents: string[];
  meta?: Record<string, unknown>;
}

/** Provider-neutral low-level workflow backend (D1/Postgres/KV implement). */
export interface WorkflowPersistenceBackend {
  put(workflow: Workflow): void;
  get(id: string): Workflow | undefined;
  listByTenant(tenant: string): Workflow[];
  delete(id: string): void;
  clear(): void;
}

/** Canonical workflow store boundary (tenant-scoped reads/writes). */
export interface WorkflowStore {
  create(input: {
    id: string;
    tenant: string;
    owner: string;
    principal: Principal;
    meta?: Record<string, unknown>;
  }): Workflow;
  get(id: string, principal: Principal): Workflow | undefined;
  list(principal: Principal, tenant: string): Workflow[];
  /** Apply a state transition. Illegal transitions throw (fail-closed). */
  transition(id: string, to: WorkflowState, principal: Principal, by?: string): Workflow;
  /** Record a human approval. */
  approve(id: string, approver: string, principal: Principal, note?: string): Workflow;
  /** Link an audit event id to the workflow. */
  linkAudit(id: string, auditEventId: string, principal: Principal): Workflow;
  /** Remove (used by tests / lifecycle cleanup). */
  destroy(id: string, principal: Principal): void;
}

/** Create a workflow store over any backend. Enforces tenant on every op. */
export function createWorkflowStore(
  backend: WorkflowPersistenceBackend,
): WorkflowStore {
  function load(id: string, principal: Principal): Workflow {
    const wf = backend.get(id);
    if (!wf) throw new Error(`Unknown workflow: ${id}`);
    enforceTenant(principal, wf.tenant);
    return wf;
  }

  return {
    create({ id, tenant, owner, principal, meta }): Workflow {
      enforceTenant(principal, tenant);
      const existing = backend.get(id);
      if (existing) throw new Error(`Workflow already exists: ${id}`);
      const now = new Date().toISOString();
      const wf: Workflow = {
        id,
        tenant,
        owner,
        state: "planned",
        transitions: [],
        createdAt: now,
        updatedAt: now,
        approvals: [],
        auditEvents: [],
        ...(meta ? { meta } : {}),
      };
      backend.put(wf);
      return wf;
    },

    get(id, principal): Workflow | undefined {
      const wf = backend.get(id);
      if (!wf) return undefined;
      enforceTenant(principal, wf.tenant);
      return wf;
    },

    list(principal, tenant): Workflow[] {
      enforceTenant(principal, tenant);
      return backend.listByTenant(tenant);
    },

    transition(id, to, principal, by): Workflow {
      const wf = load(id, principal);
      if (!canTransitionWorkflow(wf.state, to)) {
        throw new Error(`Illegal workflow transition: ${wf.state} -> ${to}`);
      }
      const now = new Date().toISOString();
      const updated: Workflow = {
        ...wf,
        state: to,
        updatedAt: now,
        transitions: [
          ...wf.transitions,
          { from: wf.state, to, at: now, by: by ?? principal.id },
        ],
      };
      backend.put(updated);
      return updated;
    },

    approve(id, approver, principal, note): Workflow {
      const wf = load(id, principal);
      const now = new Date().toISOString();
      const updated: Workflow = {
        ...wf,
        updatedAt: now,
        approvals: [...wf.approvals, { at: now, approver, ...(note ? { note } : {}) }],
      };
      backend.put(updated);
      return updated;
    },

    linkAudit(id, auditEventId, principal): Workflow {
      const wf = load(id, principal);
      const updated: Workflow = {
        ...wf,
        updatedAt: new Date().toISOString(),
        auditEvents: [...new Set([...wf.auditEvents, auditEventId])],
      };
      backend.put(updated);
      return updated;
    },

    destroy(id, principal): void {
      const wf = load(id, principal);
      backend.delete(wf.id);
    },
  };
}

/** In-memory backend (dev/edge + tests). Swap for D1Backend later. */
export class MemoryWorkflowBackend implements WorkflowPersistenceBackend {
  private readonly map = new Map<string, Workflow>();
  put(wf: Workflow): void {
    this.map.set(wf.id, { ...wf, transitions: [...wf.transitions], approvals: [...wf.approvals], auditEvents: [...wf.auditEvents] });
  }
  get(id: string): Workflow | undefined {
    const wf = this.map.get(id);
    return wf ? { ...wf, transitions: [...wf.transitions], approvals: [...wf.approvals], auditEvents: [...wf.auditEvents] } : undefined;
  }
  listByTenant(tenant: string): Workflow[] {
    return [...this.map.values()].filter((w) => w.tenant === tenant).map((w) => ({ ...w }));
  }
  delete(id: string): void {
    this.map.delete(id);
  }
  clear(): void {
    this.map.clear();
  }
}

/** Ready workflow store over an in-memory backend. */
export function createMemoryWorkflowStore(): WorkflowStore {
  return createWorkflowStore(new MemoryWorkflowBackend());
}

export { TenantViolationError };
