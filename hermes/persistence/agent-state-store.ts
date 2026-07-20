// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent State Persistence                      │
// │ EPIC-004 PHASE 3 · durable agent registry boundary.           │
// │                                                            \
// │  AgentStateStore         : canonical boundary                │
// │  AgentPersistenceBackend  : provider-neutral low-level store  │
// │  MemoryAgentStore         : in-memory impl (dev/edge + tests) │
// │                                                            \
// │ IMPORTANT: canAgentAct() remains the ONLY execution gate.    │
// │ D1 is NEVER referenced. Implement AgentPersistenceBackend    │
// │ (D1Backend) later with no redesign.                          │
// └─────────────────────────────────────────────────────────────┘

import type { AgentLifecycleState } from "../../shared/contracts/lifecycle.js";
import { canTransitionAgent } from "../../shared/contracts/lifecycle.js";
import type { Principal } from "../contracts/platform-api.js";
import { enforceTenant, TenantViolationError } from "./tenant.js";

export type ActivationState = "disabled" | "enabled";

export interface AgentCapabilityAssignment {
  id: string;
  description: string;
  autonomous: boolean;
}

/** Canonical durable agent record. */
export interface PersistedAgent {
  id: string;
  name: string;
  tenant: string;
  /** Owning principal/team. */
  owner: string;
  /** Lifecycle state (registered -> ... -> active -> ... -> retired). */
  state: AgentLifecycleState;
  /** Activation switch (operator-authorized). */
  activation: ActivationState;
  /** Permission grants required to act. */
  permissions: string[];
  /** Capability assignments. */
  capabilities: AgentCapabilityAssignment[];
  registeredAt: string;
  updatedAt: string;
  notes?: string;
}

/** Provider-neutral low-level agent backend (D1/Postgres/KV implement). */
export interface AgentPersistenceBackend {
  put(agent: PersistedAgent): void;
  get(id: string): PersistedAgent | undefined;
  listByTenant(tenant: string): PersistedAgent[];
  delete(id: string): void;
  clear(): void;
}

/** Canonical agent state store boundary (tenant-scoped, fail-closed). */
export interface AgentStateStore {
  register(input: {
    id: string;
    name: string;
    tenant: string;
    owner: string;
    principal: Principal;
    capabilities: AgentCapabilityAssignment[];
    permissions?: string[];
    notes?: string;
  }): PersistedAgent;
  get(id: string, principal: Principal): PersistedAgent | undefined;
  list(principal: Principal, tenant: string): PersistedAgent[];
  /** Lifecycle transition — illegal moves rejected (fail-closed). */
  setState(id: string, to: AgentLifecycleState, principal: Principal): PersistedAgent;
  /** Operator activation switch (explicit, authorized). */
  setActivation(id: string, activation: ActivationState, principal: Principal): PersistedAgent;
  /** The ONLY execution gate — preserved from registry semantics. */
  canAgentAct(agent: PersistedAgent): boolean;
  destroy(id: string, principal: Principal): void;
}

/**
 * The authoritative execution gate. An agent acts ONLY when BOTH axes are
 * satisfied: activation === "enabled" AND state === "active". Mirrors
 * hermes/agents/registry.ts canAgentAct — this is the single contract.
 */
export function canAgentAct(agent: PersistedAgent): boolean {
  return agent.activation === "enabled" && agent.state === "active";
}

export function createAgentStateStore(
  backend: AgentPersistenceBackend,
): AgentStateStore {
  function load(id: string, principal: Principal): PersistedAgent {
    const a = backend.get(id);
    if (!a) throw new Error(`Unknown agent: ${id}`);
    enforceTenant(principal, a.tenant);
    return a;
  }

  return {
    register({ id, name, tenant, owner, principal, capabilities, permissions, notes }): PersistedAgent {
      enforceTenant(principal, tenant);
      if (backend.get(id)) throw new Error(`Agent already registered: ${id}`);
      const now = new Date().toISOString();
      // Fail-closed defaults: registered + disabled (never auto-active/enabled).
      const agent: PersistedAgent = {
        id,
        name,
        tenant,
        owner,
        state: "registered",
        activation: "disabled",
        permissions: permissions ?? [],
        capabilities,
        registeredAt: now,
        updatedAt: now,
        ...(notes ? { notes } : {}),
      };
      backend.put(agent);
      return agent;
    },

    get(id, principal): PersistedAgent | undefined {
      const a = backend.get(id);
      if (!a) return undefined;
      enforceTenant(principal, a.tenant);
      return a;
    },

    list(principal, tenant): PersistedAgent[] {
      enforceTenant(principal, tenant);
      return backend.listByTenant(tenant);
    },

    setState(id, to, principal): PersistedAgent {
      const a = load(id, principal);
      if (!canTransitionAgent(a.state, to)) {
        throw new Error(`Illegal agent transition: ${a.state} -> ${to}`);
      }
      const updated: PersistedAgent = { ...a, state: to, updatedAt: new Date().toISOString() };
      backend.put(updated);
      return updated;
    },

    setActivation(id, activation, principal): PersistedAgent {
      const a = load(id, principal);
      const updated: PersistedAgent = { ...a, activation, updatedAt: new Date().toISOString() };
      backend.put(updated);
      return updated;
    },

    canAgentAct(agent): boolean {
      return canAgentAct(agent);
    },

    destroy(id, principal): void {
      const a = load(id, principal);
      backend.delete(a.id);
    },
  };
}

/** In-memory backend (dev/edge + tests). */
export class MemoryAgentBackend implements AgentPersistenceBackend {
  private readonly map = new Map<string, PersistedAgent>();
  put(a: PersistedAgent): void {
    this.map.set(a.id, { ...a, capabilities: [...a.capabilities], permissions: [...a.permissions] });
  }
  get(id: string): PersistedAgent | undefined {
    const a = this.map.get(id);
    return a ? { ...a, capabilities: [...a.capabilities], permissions: [...a.permissions] } : undefined;
  }
  listByTenant(tenant: string): PersistedAgent[] {
    return [...this.map.values()].filter((x) => x.tenant === tenant).map((x) => ({ ...x, capabilities: [...x.capabilities], permissions: [...x.permissions] }));
  }
  delete(id: string): void {
    this.map.delete(id);
  }
  clear(): void {
    this.map.clear();
  }
}

/** Ready agent store over an in-memory backend. */
export function createMemoryAgentStateStore(): AgentStateStore {
  return createAgentStateStore(new MemoryAgentBackend());
}

export { TenantViolationError };
