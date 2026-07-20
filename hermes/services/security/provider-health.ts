// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Provider Health Monitor (M5)    │
// │ EPIC-003-004                                                │
// │ Monitor provider health across the platform. Supports:       │
// │   healthy · degraded · offline · not installed · unknown     │
// │ Health influences provider SELECTION. Fail closed: a provider│
// │ that is not healthy/degraded is never auto-selected.         │
// └─────────────────────────────────────────────────────────────┘

import {
  listProviders,
  setProviderHealth,
  type ProviderHealth,
} from "../activation/provider-framework.js";
import type { SecurityToolAdapter } from "./providers/real-adapters.js";

export type MonitoredHealth = "healthy" | "degraded" | "offline" | "not_installed" | "unknown";

export interface ProviderHealthStatus {
  id: string;
  label: string;
  domain: string;
  /** "adapter" when backed by a local tool, "managed" for the framework provider. */
  kind: "managed" | "adapter";
  health: MonitoredHealth;
  /** Whether this provider is selectable for execution (fail-closed gate). */
  selectable: boolean;
  detail?: string;
  checkedAt: string;
}

/**
 * Probe + reconcile health for all security providers.
 *
 *  • Managed (framework) providers report lifecycle + stored health.
 *  • Real adapters report NOT_INSTALLED when their binary is absent.
 *
 * A provider is SELECTABLE only when healthy or degraded — everything else
 * fails closed (offline / not_installed / unknown → never auto-selected).
 */
export async function monitorSecurityProviderHealth(
  realAdapters: SecurityToolAdapter[] = [],
): Promise<ProviderHealthStatus[]> {
  const checkedAt = new Date().toISOString();
  const out: ProviderHealthStatus[] = [];

  // 1) Framework-managed security providers.
  for (const p of listProviders()) {
    if (p.domain !== "security") continue;

    let health: MonitoredHealth;
    let detail: string | undefined;

    if (p.lifecycle !== "active" && p.lifecycle !== "enabled") {
      health = "offline";
      detail = `Provider lifecycle=${p.lifecycle} (not active)`;
    } else {
      const stored = p.health?.health ?? "unknown";
      health = stored === "unhealthy" ? "degraded" : (stored as MonitoredHealth);
      detail = p.health?.detail;
    }

    syncHealth(p.id, health, detail);
    out.push({
      id: p.id,
      label: p.label,
      domain: p.domain,
      kind: "managed",
      health,
      selectable: health === "healthy" || health === "degraded",
      detail,
      checkedAt,
    });
  }

  // 2) Real adapters (optional, local-first). Not in the framework registry.
  for (const ad of realAdapters) {
    // Ensure the adapter has probed its backend before we read state/health.
    await ad.detect();
    const install = ad.installationState();
    let health: MonitoredHealth;
    let detail: string | undefined;
    if (install === "not_installed") {
      health = "not_installed";
      detail = `${ad.tool} binary not installed`;
    } else if (install === "unknown") {
      health = "unknown";
      detail = `${ad.tool} availability unknown in this runtime`;
    } else {
      // Installed: trust the adapter's self-reported health (default healthy).
      health = (ad.health() === "not_installed" ? "degraded" : ad.health()) as MonitoredHealth;
      detail = `${ad.tool} ${ad.version() ?? ""}`.trim();
    }
    out.push({
      id: ad.id,
      label: ad.label,
      domain: "security",
      kind: "adapter",
      health,
      selectable: health === "healthy" || health === "degraded",
      detail,
      checkedAt,
    });
  }

  return out;
}

/** Select the best healthy/degraded provider for a capability (fail closed). */
export async function selectHealthyProvider(
  capability: string,
  realAdapters: SecurityToolAdapter[] = [],
): Promise<string | undefined> {
  const statuses = await monitorSecurityProviderHealth(realAdapters);
  const candidates = statuses.filter((s) => s.selectable);
  if (candidates.length === 0) return undefined; // fail closed
  // Prefer 'healthy' over 'degraded'.
  const healthyFirst = candidates.sort((a, b) => rank(a.health) - rank(b.health));
  return healthyFirst[0]?.id;
}

function rank(h: MonitoredHealth): number {
  return { healthy: 0, degraded: 1, unknown: 2, "not_installed": 3, offline: 3 }[h] ?? 2;
}

/** Map our monitored vocabulary back onto the framework's ProviderHealth. */
function syncHealth(id: string, health: MonitoredHealth, detail?: string): void {
  const map: Record<MonitoredHealth, ProviderHealth> = {
    healthy: "healthy",
    degraded: "degraded",
    offline: "offline",
    "not_installed": "not_installed",
    unknown: "unknown",
  };
  try {
    setProviderHealth(id, map[health], detail);
  } catch {
    // Non-fatal: monitoring must never throw.
  }
}
