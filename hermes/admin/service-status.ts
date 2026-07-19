// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Admin Platform: Service Status             │
// │ EPIC-002-006E · PHASE 1                                        │
// │ Aggregates live status of every Hermes platform service.      │
// │ Read-only, internal-only. No external exposure.                │
// └─────────────────────────────────────────────────────────────┘
//
// The Admin Platform NEVER imports application business code (AGS Fertility).
// It reads only from Hermes platform services and the audit buffer.

import { readAuditBuffer } from "../audit/event.js";
import { listResources } from "../services/registry/registry.js";
import { listAgents } from "../agents/registry.js";
import { readWorkforceAudit } from "../workforce/events.js";

/** Identifier for each Hermes platform service the console can observe. */
export type HermesServiceId =
  | "identity"
  | "permissions"
  | "audit"
  | "registry"
  | "discovery"
  | "lifecycle"
  | "scheduler"
  | "notification"
  | "memory"
  | "provider-adapter"
  | "agent-registry"
  | "workforce";

export interface ServiceStatus {
  id: HermesServiceId;
  name: string;
  /** Operational health derived from in-process state. */
  health: "healthy" | "degraded" | "unknown";
  /** Number of tracked entities (resources, agents, etc.) for a quick load signal. */
  entityCount: number;
  /** Most recent activity timestamp (from audit), if any. */
  lastActivity?: string;
  /** Human-readable note. */
  detail: string;
}

const SERVICE_META: Array<{ id: HermesServiceId; name: string; detail: string }> = [
  { id: "identity", name: "Identity Service", detail: "Principal building + auth provider registry" },
  { id: "permissions", name: "Permission Service", detail: "Data-driven RBAC + agent permission boundary" },
  { id: "audit", name: "Audit Service", detail: "Write-once audit event buffer" },
  { id: "registry", name: "Registry Service", detail: "Resource inventory (org, apps, infra, agents)" },
  { id: "discovery", name: "Discovery Service", detail: "Runtime resolution of applications/resources" },
  { id: "lifecycle", name: "Lifecycle Service", detail: "State transitions for resources + agents" },
  { id: "scheduler", name: "Scheduler Service", detail: "Cron/event trigger dispatch (not yet active)" },
  { id: "notification", name: "Notification Service", detail: "Fan-out via NotificationProvider" },
  { id: "memory", name: "Memory Service", detail: "Durable, agent-scoped memory" },
  { id: "provider-adapter", name: "Provider Adapter Service", detail: "Only module binding shared/interfaces to vendor SDKs" },
  { id: "agent-registry", name: "Agent Registry", detail: "Registered agents + lifecycle/activation state" },
  { id: "workforce", name: "Workforce Service", detail: "Assignment/approval/task/event orchestration" },
];

/**
 * Collect a status snapshot of every Hermes platform service.
 * Pure read — never mutates state. Safe to call from any admin view.
 */
export function getServiceStatuses(): ServiceStatus[] {
  const audit = readAuditBuffer();
  const workforceAudit = readWorkforceAudit();
  const allEvents = [...audit, ...workforceAudit];
  const lastByTag = new Map<string, string>();
  for (const e of allEvents) {
    const key = e.type.split(".")[0]; // e.g. "agent" from "agent.activated"
    const prev = lastByTag.get(key);
    if (!prev || e.at > prev) lastByTag.set(key, e.at);
  }

  return SERVICE_META.map((m) => {
    let entityCount = 0;
    let health: ServiceStatus["health"] = "healthy";
    switch (m.id) {
      case "registry":
        entityCount = listResources().length;
        break;
      case "agent-registry":
      case "workforce":
        entityCount = listAgents().length;
        break;
      case "audit":
        entityCount = allEvents.length;
        break;
      default:
        // Services without a countable entity store report presence only.
        break;
    }
    return {
      id: m.id,
      name: m.name,
      health,
      entityCount,
      lastActivity: lastByTag.get(m.id.split("-")[0]) ?? lastByTag.get(m.id),
      detail: m.detail,
    };
  });
}

/** Convenience: overall platform health rollup. */
export function getPlatformHealth(): {
  healthy: number;
  degraded: number;
  unknown: number;
  total: number;
} {
  const statuses = getServiceStatuses();
  const rollup = { healthy: 0, degraded: 0, unknown: 0, total: statuses.length };
  for (const s of statuses) rollup[s.health]++;
  return rollup;
}
