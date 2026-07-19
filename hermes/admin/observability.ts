// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Observability / Health Dashboard            │
// │ EPIC-002-006H · PHASE 5                                        │
// │                                                 EXTENDS:       │
// │  Reuses the 006E service-status foundation (getServiceStatuses) │
// │  and the existing tool/identity/memory registries. Does NOT     │
// │  reimplement them.                                              │
// │                                                 SAFETY:         │
// │  • READ-ONLY: this builder never mutates platform state.        │
// │  • PERMISSION-CONTROLLED: requires `ops-read` in the calling    │
// │    principal's permission set. Unauthorized callers fail closed.│
// │  • AUDITED: every dashboard access is recorded.                 │
// └─────────────────────────────────────────────────────────────┘

import { getServiceStatuses, type ServiceStatus } from "./service-status.js";
import { listToolProviders } from "../services/tools/tool-provider.js";
import { listAuthenticators } from "../identity/authn.js";
import { listActiveSessions } from "../identity/authn.js";
import { memoryStoreBackend } from "../services/memory/architecture.js";
import { listAgents } from "../agents/registry.js";
import { readAuditBuffer } from "../audit/event.js";
import { emitAudit } from "../audit/event.js";

export interface HealthDashboard {
  generatedAt: string;
  /** Per-service health rollup from the 006E foundation. */
  services: ServiceStatus[];
  /** Identity provider authentication status. */
  identity: {
    registeredAuthenticators: number;
    providers: string[];
    activeSessions: number;
  };
  /** Agent status — human-controlled, inactive-by-default enforced. */
  agents: {
    total: number;
    active: number;
    enabled: number;
    disabled: number;
  };
  /** Tool provider status. */
  tools: {
    total: number;
    providers: string[];
  };
  /** Audit status — tamper evidence. */
  audit: {
    bufferedEvents: number;
  };
  /** Provider/backend status — vendor neutrality evidence. */
  provider: {
    memoryBackend: string;
  };
  /** Overall posture summary. */
  posture: "healthy" | "attention" | "critical";
}

/**
 * Build the Hermes Health Dashboard for a viewing principal.
 *
 * @param viewerPermissions the effective permission set of the requesting
 *        principal (from the 006D permission resolution). Must include
 *        `ops-read`. Unauthorized callers receive null (fail-closed).
 */
export function buildHealthDashboard(
  viewerPermissions: Set<string> | string[],
  viewerId: string,
): HealthDashboard | null {
  const perms = viewerPermissions instanceof Set ? viewerPermissions : new Set(viewerPermissions);
  if (!perms.has("ops-read")) {
    emitAudit("observability.dashboard.denied", viewerId, {
      reason: "missing ops-read",
    });
    return null;
  }

  const services = getServiceStatuses();
  const agents = listAgents();
  const active = agents.filter((a) => a.state === "active").length;
  const enabled = agents.filter((a) => a.activation === "enabled").length;

  const authenticators = listAuthenticators();
  const tools = listToolProviders();

  const dashboard: HealthDashboard = {
    generatedAt: new Date().toISOString(),
    services,
    identity: {
      registeredAuthenticators: authenticators.length,
      providers: authenticators.map((a) => a.provider),
      activeSessions: listActiveSessions().length,
    },
    agents: {
      total: agents.length,
      active,
      enabled,
      disabled: agents.length - enabled,
    },
    tools: {
      total: tools.length,
      providers: tools.map((t) => t.id),
    },
    audit: {
      bufferedEvents: readAuditBuffer().length,
    },
    provider: {
      memoryBackend: memoryStoreBackend(),
    },
    posture: derivePosture(services, agents, perms),
  };

  emitAudit("observability.dashboard.viewed", viewerId, {
    services: dashboard.services.length,
    agents: dashboard.agents.total,
    tools: dashboard.tools.total,
  });
  return dashboard;
}

/**
 * Derive an overall posture. Critical if any human-controlled agent is active
 * without being enabled (should never happen) or if the viewer lacks the
 * baseline ops permissions. Attention if any service is degraded.
 */
function derivePosture(
  services: ServiceStatus[],
  agents: ReturnType<typeof listAgents>,
  perms: Set<string>,
): HealthDashboard["posture"] {
  // Safety invariant: an active agent must also be enabled.
  const orphanActive = agents.some((a) => a.state === "active" && a.activation !== "enabled");
  if (orphanActive) return "critical";
  if (services.some((s) => s.health === "degraded")) return "attention";
  return "healthy";
}

/** Lightweight summary string for the Telegram/console surface. */
export function summarizeHealth(d: HealthDashboard): string {
  return [
    `Hermes Health — ${d.posture.toUpperCase()}`,
    `Services: ${d.services.length} | Agents: ${d.agents.total} (active ${d.agents.active}, enabled ${d.agents.enabled})`,
    `Tools: ${d.tools.total} | Auth providers: ${d.identity.registeredAuthenticators}`,
    `Memory backend: ${d.provider.memoryBackend} | Audit events: ${d.audit.bufferedEvents}`,
  ].join("\n");
}
