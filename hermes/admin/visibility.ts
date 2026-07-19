// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin Platform: Visibility Facade          │
// │ EPIC-002-006E · PHASE 1                                        │
// │ Read-only aggregations across the six dashboard domains:      │
// │   Organization · Resources · AI Workforce · Operations ·      │
// │   Security · Platform Health                                   │
// │ Every function is a pure read over existing contracts.         │
// │ No mutation, no external I/O, internal-only.                   │
// └─────────────────────────────────────────────────────────────┘

import { listResources } from "../services/registry/registry.js";
import { discoverApplications } from "../services/discovery/discovery.js";
import { listAgents, type RegisteredAgent } from "../agents/registry.js";
import { listAssignments, type AgentAssignment } from "../services/agents/assignment.js";
import { listTasks, type AgentTask } from "../services/agents/task.js";
import { listAgentPermissions } from "../services/agents/permissions.js";
import { readAuditBuffer, type AuditEvent } from "../audit/event.js";
import { readWorkforceAudit } from "../workforce/events.js";

// ─── ORGANIZATION ────────────────────────────────────────────────

export interface ApplicationView {
  id: string;
  resources: number;
  environments: string[];
}

/** Discover registered applications and their resource footprint. */
export function viewApplications(): ApplicationView[] {
  const discovered = discoverApplications();
  const resources = listResources();
  return discovered.map((app) => ({
    id: app.id,
    resources: resources.filter((r) => r.owner === app.id).length,
    environments: [...new Set(resources.filter((r) => r.owner === app.id).map((r) => r.state))],
  }));
}

// ─── RESOURCES ───────────────────────────────────────────────────

export function viewResources(filter?: {
  kind?: string;
  owner?: string;
  provider?: string;
  state?: string;
}) {
  return listResources(filter as never);
}

// ─── AI WORKFORCE ────────────────────────────────────────────────

export interface AgentRosterEntry {
  agent: RegisteredAgent;
  assignments: AgentAssignment[];
  permissions: string[];
}

export function viewAgentRoster(): AgentRosterEntry[] {
  return listAgents().map((agent) => ({
    agent,
    assignments: listAssignments({ agentId: agent.id }),
    permissions: listAgentPermissions(agent.id),
  }));
}

export function viewAgentDetail(agentId: string): AgentRosterEntry | undefined {
  const agent = listAgents().find((a) => a.id === agentId);
  if (!agent) return undefined;
  return {
    agent,
    assignments: listAssignments({ agentId }),
    permissions: listAgentPermissions(agentId),
  };
}

// ─── OPERATIONS ──────────────────────────────────────────────────

export function viewTasks(filter?: {
  agentId?: string;
  applicationId?: string;
  state?: string;
}): AgentTask[] {
  return listTasks(filter as never);
}

export function viewWorkforceEvents(): readonly AuditEvent[] {
  return readWorkforceAudit();
}

// ─── SECURITY ────────────────────────────────────────────────────

export interface AuditExplorerEntry {
  type: string;
  actor: string;
  at: string;
  detail: Record<string, unknown>;
}

/** Unified audit feed combining the platform audit buffer + workforce events. */
export function viewAuditTrail(filter?: {
  actor?: string;
  typePrefix?: string;
  limit?: number;
}): AuditExplorerEntry[] {
  const platform: AuditEvent[] = [...readAuditBuffer()];
  const workforce: AuditEvent[] = [...readWorkforceAudit()];
  const merged: AuditExplorerEntry[] = [
    ...platform.map((e) => ({ type: e.type, actor: e.actor, at: e.at, detail: e.detail })),
    ...workforce.map((e) => ({ type: e.type, actor: e.actor, at: e.at, detail: e.detail })),
  ];
  merged.sort((a, b) => (a.at < b.at ? 1 : -1));
  return merged
    .filter((e) => (filter?.actor ? e.actor === filter.actor : true))
    .filter((e) => (filter?.typePrefix ? e.type.startsWith(filter.typePrefix) : true))
    .slice(0, filter?.limit ?? 100);
}

/** Denied authorization events — security-monitoring signal. */
export function viewAuthzDenials(): AuditExplorerEntry[] {
  return viewAuditTrail({ typePrefix: "agent.authz.deny" });
}

// ─── PLATFORM HEALTH ─────────────────────────────────────────────

export { getServiceStatuses, getPlatformHealth } from "./service-status.js";
export type { ServiceStatus, HermesServiceId } from "./service-status.js";
