// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Transport Health Model (EPIC-005.3 PHASE 4) │
// │                                                           │
// │ Three independent health dimensions, reconciled:          │
// │   1. PROVIDER   — trust/lifecycle/authz state (Trust Model)│
// │   2. TRANSPORT  — the communication channel (Transport)    │
// │   3. CAPABILITY — the concrete intent (Provider/Cap spec)  │
// │                                                           │
// │ The model is purely additive: it NEVER downgrades a       │
// │ provider's business health because a transport is merely  │
// │ degraded, and vice-versa. Instead it reports each          │
// │ dimension separately plus a reconciled `effective` status │
// │ that is the worst-of (fail-closed aggregation): if any    │
// │ required dimension is unhealthy, the effective status is  │
// │ unhealthy and invocations must be denied.                  │
// └─────────────────────────────────────────────────────────────┘

import type { HealthStatus } from "./sdk.js";
import type { TransportHealth } from "./transport.js";

/** Provider-dimension health (from the Trust Model / loader). */
export interface ProviderHealthView {
  status: HealthStatus;
  lifecycle: string;
  trustLevel: string;
  detail?: string;
}

/** Capability-dimension health (from the capability registry / spec). */
export interface CapabilityHealthView {
  status: HealthStatus;
  capabilityId: string;
  available: boolean;
  detail?: string;
}

/** Reconciled, three-dimensional health snapshot for one provider+capability. */
export interface ReconciledTransportHealth {
  /** Worst-of aggregation across the three required dimensions (fail-closed). */
  effective: HealthStatus;
  provider: ProviderHealthView;
  transport: TransportHealth;
  capability: CapabilityHealthView;
  /** True when `effective` is "healthy" — safe to invoke. */
  invocable: boolean;
  /** Human-readable reconciliation rationale (never raw secrets). */
  rationale: string;
}

const SEVERITY: Record<HealthStatus, number> = {
  healthy: 0,
  unknown: 1,
  degraded: 2,
  unhealthy: 3,
};

function worst(...states: HealthStatus[]): HealthStatus {
  return states.reduce<HealthStatus>(
    (acc, s) => (SEVERITY[s] > SEVERITY[acc] ? s : acc),
    "healthy",
  );
}

/**
 * Reconcile the three health dimensions into a single fail-closed view.
 *
 * Fail-closed rule: if the PROVIDER or TRANSPORT dimension is "unhealthy",
 * the effective status is "unhealthy" regardless of capability health, and
 * `invocable` is false. "degraded" propagates as degraded (invocable but
 * watched). "unknown" is treated conservatively: a provider/transport of
 * unknown status is NOT invocable until proven healthy.
 */
export function reconcileTransportHealth(input: {
  provider: ProviderHealthView;
  transport: TransportHealth;
  capability: CapabilityHealthView;
}): ReconciledTransportHealth {
  const { provider, transport, capability } = input;

  const effective = worst(provider.status, transport.status, capability.status);

  const blockedByProvider =
    provider.status === "unhealthy" || provider.status === "unknown";
  const blockedByTransport =
    transport.status === "unhealthy" || transport.status === "unknown";
  const blockedByCapability = !capability.available;

  const invocable =
    effective !== "unhealthy" && !blockedByProvider && !blockedByTransport && !blockedByCapability;

  let rationale: string;
  if (blockedByProvider) {
    rationale = `provider dimension not invocable (status=${provider.status}${provider.detail ? `, ${provider.detail}` : ""})`;
  } else if (blockedByTransport) {
    rationale = `transport dimension not invocable (status=${transport.status}, kind=${transport.kind}, conn=${transport.connectionState}${transport.detail ? `, ${transport.detail}` : ""})`;
  } else if (blockedByCapability) {
    rationale = `capability "${capability.capabilityId}" not available`;
  } else if (effective === "degraded") {
    rationale = "degraded but invocable (watch)";
  } else {
    rationale = "all dimensions healthy";
  }

  return { effective, provider, transport, capability, invocable, rationale };
}
