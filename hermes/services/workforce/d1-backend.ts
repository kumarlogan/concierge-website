// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Workforce D1 Backend                      │
// │ EPIC-005 · PHASE 5                                          │
// │ Cloudflare D1 (SQLite) persistence backend for workforce.    │
// └─────────────────────────────────────────────────────────────┘

import type { D1Database } from "@cloudflare/workers-types";
import type {
  WorkforceAgent,
  AgentActivationRequest,
  AgentAuditEvent,
  WorkforcePersistenceBackend,
} from "./repository.js";

/**
 * D1-backed workforce persistence backend.
 * Implements the WorkforcePersistenceBackend interface using Cloudflare D1.
 */
export class D1WorkforceBackend implements WorkforcePersistenceBackend {
  private db: D1Database;

  constructor(db: D1Database) {
    this.db = db;
  }

  // workforce_agents

  async putWorkforceAgent(agent: WorkforceAgent): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO workforce_agents (
        agent_id, lifecycle_state, enabled, autonomous, domain, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`
    );
    
    await stmt
      .bind(
        agent.agentId,
        agent.lifecycleState,
        agent.enabled ? 1 : 0,
        agent.autonomous ? 1 : 0,
        agent.domain ?? null,
        agent.createdAt,
        agent.updatedAt
      )
      .run();
  }

  async getWorkforceAgent(agentId: string): Promise<WorkforceAgent | undefined> {
    const stmt = this.db.prepare(
      `SELECT agent_id, lifecycle_state, enabled, autonomous, domain, created_at, updated_at
       FROM workforce_agents
       WHERE agent_id = ?1`
    );
    
    const result = await stmt.bind(agentId).first<{
      agent_id: string;
      lifecycle_state: string;
      enabled: number;
      autonomous: number;
      domain: string | null;
      created_at: string;
      updated_at: string;
    }>();
    
    if (!result) return undefined;
    
    return {
      agentId: result.agent_id,
      lifecycleState: result.lifecycle_state as any,
      enabled: result.enabled === 1,
      autonomous: result.autonomous === 1,
      domain: result.domain ?? undefined,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  async deleteWorkforceAgent(agentId: string): Promise<void> {
    const stmt = this.db.prepare(
      `DELETE FROM workforce_agents WHERE agent_id = ?1`
    );
    
    await stmt.bind(agentId).run();
  }

  async listWorkforceAgents(): Promise<WorkforceAgent[]> {
    const stmt = this.db.prepare(
      `SELECT agent_id, lifecycle_state, enabled, autonomous, domain, created_at, updated_at
       FROM workforce_agents`
    );
    
    const results = await stmt.all<{
      agent_id: string;
      lifecycle_state: string;
      enabled: number;
      autonomous: number;
      domain: string | null;
      created_at: string;
      updated_at: string;
    }>();
    
    return (results.results ?? []).map(result => ({
      agentId: result.agent_id,
      lifecycleState: result.lifecycle_state as any,
      enabled: result.enabled === 1,
      autonomous: result.autonomous === 1,
      domain: result.domain ?? undefined,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  // agent_activation_requests

  async putActivationRequest(request: AgentActivationRequest): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT OR REPLACE INTO agent_activation_requests (
        request_id, agent_id, requested_by, approved_by, approval_reference, status, created_at, updated_at
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`
    );
    
    await stmt
      .bind(
        request.requestId,
        request.agentId,
        request.requestedBy,
        request.approvedBy ?? null,
        request.approvalReference,
        request.status,
        request.createdAt,
        request.updatedAt
      )
      .run();
  }

  async getActivationRequest(requestId: string): Promise<AgentActivationRequest | undefined> {
    const stmt = this.db.prepare(
      `SELECT request_id, agent_id, requested_by, approved_by, approval_reference, status, created_at, updated_at
       FROM agent_activation_requests
       WHERE request_id = ?1`
    );
    
    const result = await stmt.bind(requestId).first<{
      request_id: string;
      agent_id: string;
      requested_by: string;
      approved_by: string | null;
      approval_reference: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>();
    
    if (!result) return undefined;
    
    return {
      requestId: result.request_id,
      agentId: result.agent_id,
      requestedBy: result.requested_by,
      approvedBy: result.approved_by ?? undefined,
      approvalReference: result.approval_reference,
      status: result.status as any,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    };
  }

  async getActivationRequestsByAgent(agentId: string): Promise<AgentActivationRequest[]> {
    const stmt = this.db.prepare(
      `SELECT request_id, agent_id, requested_by, approved_by, approval_reference, status, created_at, updated_at
       FROM agent_activation_requests
       WHERE agent_id = ?1`
    );
    
    const results = await stmt.bind(agentId).all<{
      request_id: string;
      agent_id: string;
      requested_by: string;
      approved_by: string | null;
      approval_reference: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>();
    
    return (results.results ?? []).map(result => ({
      requestId: result.request_id,
      agentId: result.agent_id,
      requestedBy: result.requested_by,
      approvedBy: result.approved_by ?? undefined,
      approvalReference: result.approval_reference,
      status: result.status as any,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  async getActivationRequestsByStatus(
    status: "pending" | "approved" | "denied"
  ): Promise<AgentActivationRequest[]> {
    const stmt = this.db.prepare(
      `SELECT request_id, agent_id, requested_by, approved_by, approval_reference, status, created_at, updated_at
       FROM agent_activation_requests
       WHERE status = ?1`
    );
    
    const results = await stmt.bind(status).all<{
      request_id: string;
      agent_id: string;
      requested_by: string;
      approved_by: string | null;
      approval_reference: string;
      status: string;
      created_at: string;
      updated_at: string;
    }>();
    
    return (results.results ?? []).map(result => ({
      requestId: result.request_id,
      agentId: result.agent_id,
      requestedBy: result.requested_by,
      approvedBy: result.approved_by ?? undefined,
      approvalReference: result.approval_reference,
      status: result.status as any,
      createdAt: result.created_at,
      updatedAt: result.updated_at,
    }));
  }

  async deleteActivationRequest(requestId: string): Promise<void> {
    const stmt = this.db.prepare(
      `DELETE FROM agent_activation_requests WHERE request_id = ?1`
    );
    
    await stmt.bind(requestId).run();
  }

  async clearActivationRequests(): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM agent_activation_requests`);
    await stmt.run();
  }

  // agent_audit_events

  async appendAuditEvent(event: AgentAuditEvent): Promise<void> {
    const stmt = this.db.prepare(
      `INSERT INTO agent_audit_events (
        event_id, agent_id, event_type, actor, metadata, timestamp
      ) VALUES (?1, ?2, ?3, ?4, ?5, ?6)`
    );
    
    await stmt
      .bind(
        event.eventId,
        event.agentId,
        event.eventType,
        event.actor,
        event.metadata ? JSON.stringify(event.metadata) : null,
        event.timestamp
      )
      .run();
  }

  async getAuditEventsByAgent(agentId: string): Promise<AgentAuditEvent[]> {
    const stmt = this.db.prepare(
      `SELECT event_id, agent_id, event_type, actor, metadata, timestamp
       FROM agent_audit_events
       WHERE agent_id = ?1
       ORDER BY timestamp ASC`
    );
    
    const results = await stmt.bind(agentId).all<{
      event_id: string;
      agent_id: string;
      event_type: string;
      actor: string;
      metadata: string | null;
      timestamp: string;
    }>();
    
    return (results.results ?? []).map(result => ({
      eventId: result.event_id,
      agentId: result.agent_id,
      eventType: result.event_type,
      actor: result.actor,
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
      timestamp: result.timestamp,
    }));
  }

  async getAuditEventsByType(eventType: string): Promise<AgentAuditEvent[]> {
    const stmt = this.db.prepare(
      `SELECT event_id, agent_id, event_type, actor, metadata, timestamp
       FROM agent_audit_events
       WHERE event_type = ?1
       ORDER BY timestamp ASC`
    );
    
    const results = await stmt.bind(eventType).all<{
      event_id: string;
      agent_id: string;
      event_type: string;
      actor: string;
      metadata: string | null;
      timestamp: string;
    }>();
    
    return (results.results ?? []).map(result => ({
      eventId: result.event_id,
      agentId: result.agent_id,
      eventType: result.event_type,
      actor: result.actor,
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
      timestamp: result.timestamp,
    }));
  }

  async getAuditEventsSince(timestamp: string): Promise<AgentAuditEvent[]> {
    const stmt = this.db.prepare(
      `SELECT event_id, agent_id, event_type, actor, metadata, timestamp
       FROM agent_audit_events
       WHERE timestamp >= ?1
       ORDER BY timestamp ASC`
    );
    
    const results = await stmt.bind(timestamp).all<{
      event_id: string;
      agent_id: string;
      event_type: string;
      actor: string;
      metadata: string | null;
      timestamp: string;
    }>();
    
    return (results.results ?? []).map(result => ({
      eventId: result.event_id,
      agentId: result.agent_id,
      eventType: result.event_type,
      actor: result.actor,
      metadata: result.metadata ? JSON.parse(result.metadata) : undefined,
      timestamp: result.timestamp,
    }));
  }

  async clearAuditEvents(): Promise<void> {
    const stmt = this.db.prepare(`DELETE FROM agent_audit_events`);
    await stmt.run();
  }
}