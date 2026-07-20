// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Security Automation — Provider Discovery (M3)         │
// │ EPIC-003-004                                                │
// │ Hermes automatically discovers registered providers. Exposes:│
// │   available · enabled · healthy · capabilities · version ·   │
// │   installation state                                        │
// │ No vendor-specific logic lives here — discovery reads the   │
// │ platform provider registry and the optional adapter probes. │
// └─────────────────────────────────────────────────────────────┘

import {
  listProviders,
  type ManagedProvider,
} from "../../activation/provider-framework.js";
import type { SecurityToolAdapter, InstallationState } from "./real-adapters.js";

/** A single discovered security provider (provider-neutral view). */
export interface DiscoveredProvider {
  id: string;
  label: string;
  domain: string;
  /** Provider is registered + active (can resolve capabilities). */
  available: boolean;
  /** Provider is enabled in the lifecycle. */
  enabled: boolean;
  /** Health from the framework (or adapter NOT_INSTALLED). */
  healthy: "unknown" | "healthy" | "degraded" | "offline" | "not_installed" | "unhealthy";
  /** Capability ids advertised. */
  capabilities: string[];
  /** Version if reported by the backend. */
  version?: string;
  /** Whether the concrete backend binary is installed. */
  installationState: InstallationState;
  /** Extra detail (degraded reason, not-installed note). */
  detail?: string;
}

/**
 * Discover all security-domain providers registered in the platform.
 * Real adapters are passed in (they carry version + installation state from
 * their own detection); the simulated provider is always "available" with
 * unknown version. This function performs NO vendor logic — it only reads
 * registry + adapter state.
 */
export function discoverSecurityProviders(
  realAdapters: SecurityToolAdapter[] = [],
): DiscoveredProvider[] {
  const out: DiscoveredProvider[] = [];
  const adapterByTool = new Map(realAdapters.map((a) => [a.tool, a]));

  for (const p of listProviders()) {
    if (p.domain !== "security") continue;
    const ad = realAdapters.find((a) => p.label.toLowerCase().includes(a.tool) || p.id.includes(a.tool));
    const install = ad?.installationState() ?? "unknown";
    const health: DiscoveredProvider["healthy"] =
      ad && install === "not_installed" ? "not_installed" : p.health.health;
    out.push({
      id: p.id,
      label: p.label,
      domain: p.domain,
      available: p.lifecycle === "active" || p.lifecycle === "enabled",
      enabled: p.lifecycle === "enabled" || p.lifecycle === "active",
      healthy: health,
      capabilities: p.capabilities.map((c) => c.id),
      version: ad?.version(),
      installationState: install,
      detail: p.health.detail,
    });
  }

  // Surface real adapters that are NOT yet registered as ManagedProviders.
  for (const a of realAdapters) {
    const already = out.some((d) => d.label.toLowerCase().includes(a.tool) || d.id.includes(a.tool));
    if (already) continue;
    out.push({
      id: `sec.adapter.${a.tool}`,
      label: a.label,
      domain: "security",
      available: false,
      enabled: false,
      healthy: a.health(),
      capabilities: a.capabilities,
      version: a.version(),
      installationState: a.installationState(),
      detail: "Adapter registered but not yet wired into a ManagedProvider",
    });
  }

  return out;
}

/** Convenience: just the healthy + available provider ids. */
export function healthyProviderIds(realAdapters: SecurityToolAdapter[] = []): string[] {
  return discoverSecurityProviders(realAdapters)
    .filter((d) => d.available && (d.healthy === "healthy" || d.healthy === "degraded"))
    .map((d) => d.id);
}
