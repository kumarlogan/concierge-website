// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Marketplace                         │
// │ EPIC-005.1 · PHASE 7                                          │
// │                                                               │
// │ Read-only runtime view of all known providers and their live   │
// │ state. Composes the Trust Lifecycle state + manifest metadata. │
// │ A provider appears AUTOMATICALLY once admitted — no special     │
// │ registration. REJECTED providers remain visible (observability)│
// │ so operators can see what was declined and why.                 │
// │ The Marketplace never mutates a provider. It is derived state.  │
// └─────────────────────────────────────────────────────────────┘

import type { HealthStatus, ProviderLifecycleState, TrustLevel } from "./sdk.js";
import type { TransportKind } from "./transport.js";
import type { TrustLifecycle, TrustRecord } from "./trust/lifecycle.js";
import type { ProviderManifestV2 } from "./manifest-v2.js";

export interface MarketplaceEntry {
  /** Alias kept for convenience; equals providerId. */
  id: string;
  providerId: string;
  name: string;
  vendor: string;
  version: string;
  lifecycle: ProviderLifecycleState;
  trustLevel: TrustLevel;
  health: HealthStatus;
  transports: TransportKind[];
  capabilities: string[];
  approvalRequiredByDefault: boolean;
  humanInLoop?: boolean;
  deprecated: boolean;
  preferredFor: string[];
  lastHealthCheck?: string;
  failureCount: number;
  /** Set when lifecycle === REJECTED, so operators see why it was declined. */
  rejectionReason?: string;
}

export interface MarketplaceQuery {
  trustLevel?: TrustLevel[];
  health?: HealthStatus[];
  capability?: string;
  approvalRequired?: boolean;
  deprecated?: boolean;
  lifecycle?: ProviderLifecycleState[];
  onlyRejected?: boolean;
}

/**
 * The Marketplace aggregates Trust records + manifests. It is the ONLY
 * supported way to ask "what can run" — operators and the Selection Engine
 * query through this surface, never inspecting manifests directly.
 */
export class ProviderMarketplace {
  constructor(
    private readonly lifecycle: TrustLifecycle,
    private readonly manifests: ReadonlyMap<string, ProviderManifestV2>,
  ) {}

  /** All entries, derived from the Trust Lifecycle + registered manifests. */
  list(query: MarketplaceQuery = {}): MarketplaceEntry[] {
    const all = this.lifecycle
      .list()
      .map((rec) => this.toEntry(rec))
      .filter((e): e is MarketplaceEntry => e !== undefined);
    return all.filter((e) => this.matches(e, query));
  }

  get(providerId: string): MarketplaceEntry | undefined {
    const rec = this.lifecycle.getRecord(providerId);
    return rec ? this.toEntry(rec) ?? undefined : undefined;
  }

  private matches(e: MarketplaceEntry, q: MarketplaceQuery): boolean {
    if (q.onlyRejected && e.lifecycle !== "REJECTED") return false;
    if (q.trustLevel && !q.trustLevel.includes(e.trustLevel)) return false;
    if (q.health && !q.health.includes(e.health)) return false;
    if (q.lifecycle && !q.lifecycle.includes(e.lifecycle)) return false;
    if (q.capability && !e.capabilities.includes(q.capability)) return false;
    if (q.approvalRequired !== undefined && e.approvalRequiredByDefault !== q.approvalRequired)
      return false;
    if (q.deprecated !== undefined && e.deprecated !== q.deprecated) return false;
    return true;
  }

  private toEntry(rec: TrustRecord): MarketplaceEntry | undefined {
    const m = this.manifests.get(rec.providerId);
    if (!m) return undefined; // manifest not registered → not visible
    return {
      id: rec.providerId,
      providerId: rec.providerId,
      name: m.name,
      vendor: rec.vendor,
      version: rec.version,
      lifecycle: rec.state,
      // A rejected provider has NO effective trust — it is untrusted until
      // it passes admission. The marketplace reports effective trust, not the
      // manifest's declared (aspirational) level.
      trustLevel: rec.state === "REJECTED" ? "untrusted" : rec.trustLevel,
      health: rec.health,
      transports: m.transports.map((t) => t.kind),
      capabilities: m.capabilities.map((c) => c.id),
      approvalRequiredByDefault: m.approval.requiredByDefault,
      humanInLoop: m.approval.humanInLoop,
      deprecated: m.lifecycle.deprecated ?? false,
      preferredFor: m.lifecycle.preferredFor ?? [],
      lastHealthCheck: rec.lastHealthCheck,
      failureCount: rec.failureCount,
      rejectionReason: rec.rejectedAt?.reason,
    };
  }
}
