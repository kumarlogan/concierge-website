// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce Persistence Repository          │
// │ EPIC-005 · PHASE 5                                          │
// │ Provider-neutral persistence layer for workforce agents.    │
// └─────────────────────────────────────────────────────────────┘

import type { AgentLifecycleState } from "../../../shared/contracts/lifecycle.js";

/** Workforce-specific agent state. */
export interface WorkforceAgent {
  agentId: string;
  lifecycleState: AgentLifecycleState;
  enabled: boolean;
  autonomous: boolean;
  domain?: string;
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

/** Agent activation request. */
export interface AgentActivationRequest {
  requestId: string;
  agentId: string;
  requestedBy: string;
  approvedBy?: string;
  approvalReference: string; // e.g., "${workflowId}:${itemId}"
  status: "pending" | "approved" | "denied";
  createdAt: string; // ISO 8601 UTC
  updatedAt: string; // ISO 8601 UTC
}

/** Audit event for workforce agent lifecycle and activation requests. */
export interface AgentAuditEvent {
  eventId: string;
  agentId: string;
  eventType: string; // e.g., 'agent.enabled', 'activation.requested'
  actor: string; // Principal who triggered the event
  metadata?: Record<string, unknown>; // JSON-serializable
  timestamp: string; // ISO 8601 UTC
}

/** Provider-neutral low-level workforce persistence backend. */
export interface WorkforcePersistenceBackend {
  // workforce_agents
  putWorkforceAgent(agent: WorkforceAgent): Promise<void>;
  getWorkforceAgent(agentId: string): Promise<WorkforceAgent | undefined>;
  deleteWorkforceAgent(agentId: string): Promise<void>;
  listWorkforceAgents(): Promise<WorkforceAgent[]>;

  // agent_activation_requests
  putActivationRequest(request: AgentActivationRequest): Promise<void>;
  getActivationRequest(requestId: string): Promise<AgentActivationRequest | undefined>;
  getActivationRequestsByAgent(agentId: string): Promise<AgentActivationRequest[]>;
  getActivationRequestsByStatus(status: "pending" | "approved" | "denied"): Promise<AgentActivationRequest[]>;
  deleteActivationRequest(requestId: string): Promise<void>;
  clearActivationRequests(): Promise<void>;

  // agent_audit_events
  appendAuditEvent(event: AgentAuditEvent): Promise<void>;
  getAuditEventsByAgent(agentId: string): Promise<AgentAuditEvent[]>;
  getAuditEventsByType(eventType: string): Promise<AgentAuditEvent[]>;
  getAuditEventsSince(timestamp: string): Promise<AgentAuditEvent[]>;
  clearAuditEvents(): Promise<void>;
}

/** Canonical workforce persistence repository (tenant-scoped, fail-closed). */
export interface WorkforceRepository {
  // workforce_agents
  saveAgentState(agent: WorkforceAgent): Promise<void>;
  getAgentState(agentId: string): Promise<WorkforceAgent | undefined>;

  // agent_activation_requests
  saveActivationRequest(request: AgentActivationRequest): Promise<void>;
  getActivationRequest(requestId: string): Promise<AgentActivationRequest | undefined>;

  // agent_audit_events
  appendAuditEvent(event: AgentAuditEvent): Promise<void>;
  getAgentHistory(agentId: string): Promise<AgentAuditEvent[]>;
}

/**
 * Create a workforce repository over a provider-neutral backend.
 * @param backend - The workforce persistence backend.
 * @returns A workforce repository.
 */
export function createWorkforceRepository(
  backend: WorkforcePersistenceBackend,
): WorkforceRepository {
  return {
    async saveAgentState(agent) {
      await backend.putWorkforceAgent(agent);
    },
    async getAgentState(agentId) {
      return await backend.getWorkforceAgent(agentId);
    },
    async saveActivationRequest(request) {
      await backend.putActivationRequest(request);
    },
    async getActivationRequest(requestId) {
      return await backend.getActivationRequest(requestId);
    },
    async appendAuditEvent(event) {
      await backend.appendAuditEvent(event);
    },
    async getAgentHistory(agentId) {
      return await backend.getAuditEventsByAgent(agentId);
    },
  };
}

/** In-memory backend for development and tests. */
export class MemoryWorkforceBackend implements WorkforcePersistenceBackend {
  private agents = new Map<string, WorkforceAgent>();
  private requests = new Map<string, AgentActivationRequest>();
  private events = new Map<string, AgentAuditEvent[]>(); // keyed by agentId

  // workforce_agents
  async putWorkforceAgent(agent: WorkforceAgent): Promise<void> {
    this.agents.set(agent.agentId, { ...agent });
  }
  async getWorkforceAgent(agentId: string): Promise<WorkforceAgent | undefined> {
    return this.agents.get(agentId);
  }
  async deleteWorkforceAgent(agentId: string): Promise<void> {
    this.agents.delete(agentId);
  }
  async listWorkforceAgents(): Promise<WorkforceAgent[]> {
    return Array.from(this.agents.values());
  }

  // agent_activation_requests
  async putActivationRequest(request: AgentActivationRequest): Promise<void> {
    this.requests.set(request.requestId, { ...request });
  }
  async getActivationRequest(requestId: string): Promise<AgentActivationRequest | undefined> {
    return this.requests.get(requestId);
  }
  async getActivationRequestsByAgent(agentId: string): Promise<AgentActivationRequest[]> {
    return Array.from(this.requests.values()).filter(
      (req) => req.agentId === agentId,
    );
  }
  async getActivationRequestsByStatus(
    status: "pending" | "approved" | "denied",
  ): Promise<AgentActivationRequest[]> {
    return Array.from(this.requests.values()).filter(
      (req) => req.status === status,
    );
  }
  async deleteActivationRequest(requestId: string): Promise<void> {
    this.requests.delete(requestId);
  }
  async clearActivationRequests(): Promise<void> {
    this.requests.clear();
  }

  // agent_audit_events
  async appendAuditEvent(event: AgentAuditEvent): Promise<void> {
    const events = this.events.get(event.agentId) ?? [];
    events.push({ ...event });
    this.events.set(event.agentId, events);
  }
  async getAuditEventsByAgent(agentId: string): Promise<AgentAuditEvent[]> {
    return this.events.get(agentId) ?? [];
  }
  async getAuditEventsByType(eventType: string): Promise<AgentAuditEvent[]> {
    const all = Array.from(this.events.values()).flat();
    return all.filter((e) => e.eventType === eventType);
  }
  async getAuditEventsSince(timestamp: string): Promise<AgentAuditEvent[]> {
    const all = Array.from(this.events.values()).flat();
    return all.filter((e) => e.timestamp >= timestamp);
  }
  async clearAuditEvents(): Promise<void> {
    this.events.clear();
  }
}
