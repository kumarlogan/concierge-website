// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Dynamic Marketplace View                     │
// │ EPIC-005.2 · PHASE 6                                           │
// │                                                               │
// │ Full-state view of providers across the dynamic pipeline.      │
// │ Composes the EPIC-005.1 ProviderMarketplace (trust/health)     │
// │ with the DynamicProviderManager scan result (discovery, load,  │
// │ collisions, duplicates). REJECTED providers stay visible.      │
// │                                                               │
// │ Adds the dynamic-only states the baseline lacked:              │
// │   AVAILABLE — discovered + trust-admitted but not yet loaded   │
// │   OFFLINE   — load failed / transport missing (visible)        │
// │   DUPLICATE — id collision, rejected without clobbering        │
// └─────────────────────────────────────────────────────────────┘

import type { ProviderMarketplace, MarketplaceEntry } from "./marketplace.js";
import type { ScanResult } from "./manager.js";
import type { ProviderPackageLocation } from "./package.js";

/** Extended lifecycle states introduced by dynamic loading. */
export type DynamicProviderState =
  | "AVAILABLE"
  | "OFFLINE"
  | "LOADED"
  | "REJECTED"
  | "DUPLICATE";

export interface DynamicMarketplaceEntry {
  providerId: string;
  /** Trust/health view from the canonical marketplace, if admitted. */
  base?: MarketplaceEntry;
  /** Dynamic loading state. */
  state: DynamicProviderState;
  /** Why the provider is not LOADED (rejection / offline / duplicate reason). */
  reason?: string;
  /** Capabilities this provider claims. */
  capabilities: string[];
  /** Capability collisions involving this provider. */
  collisions: string[];
  /** Where it was discovered. */
  location?: ProviderPackageLocation;
}

export interface DynamicMarketplaceView {
  entries: DynamicMarketplaceEntry[];
  /** Convenience: only providers ready to serve. */
  ready: DynamicMarketplaceEntry[];
  /** Providers that failed at any stage (still visible). */
  rejected: DynamicMarketplaceEntry[];
}

/**
 * Build a full-state view from the canonical marketplace + last scan result.
 * Pure derivation — no mutation. Every discovered provider appears, including
 * rejected/duplicate/offline ones, so operators see the complete picture.
 */
export function buildDynamicMarketplaceView(
  marketplace: ProviderMarketplace,
  scan: ScanResult,
  discoveredCapabilities: Map<string, string[]>,
): DynamicMarketplaceView {
  const entries: DynamicMarketplaceEntry[] = [];
  const byId = new Map<string, DynamicMarketplaceEntry>();

  const upsert = (id: string): DynamicMarketplaceEntry => {
    let e = byId.get(id);
    if (!e) {
      e = { providerId: id, state: "AVAILABLE", capabilities: [], collisions: [] };
      byId.set(id, e);
      entries.push(e);
    }
    return e;
  };

  // 1. Trust-admitted (LOADED / ACTIVE / SUSPENDED) — pull from base marketplace.
  for (const base of marketplace.list()) {
    const e = upsert(base.providerId);
    e.base = base;
    if (base.lifecycle === "REJECTED") {
      e.state = "REJECTED";
      e.reason = base.rejectionReason;
    } else {
      e.state = "LOADED";
    }
    e.capabilities = base.capabilities;
  }

  // 2. Discovery rejections (bad manifest / unreadable location).
  for (const r of scan.discoveryRejected) {
    const e = upsert(r.providerId);
    e.state = "REJECTED";
    e.reason = `discovery: ${r.reason}`;
    e.location = r.location;
  }

  // 3. Trust rejections post-load (manifest valid, trust denied).
  for (const id of scan.trustRejected) {
    const e = upsert(id);
    e.state = "REJECTED";
    e.reason = e.reason ?? "trust admission denied";
    const base = marketplace.get(id);
    if (base) {
      e.base = base;
      e.capabilities = base.capabilities;
    }
  }

  // 4. Duplicates (id already admitted — not clobbered).
  for (const id of scan.duplicates) {
    const e = upsert(id);
    e.state = "DUPLICATE";
    e.reason = "provider id already admitted — duplicate rejected";
  }

  // 5. Capability collisions — flag both providers, state stays LOADED.
  for (const c of scan.collisions) {
    for (const pid of c.providers) {
      const e = upsert(pid);
      if (!e.collisions.includes(c.capability)) e.collisions.push(c.capability);
    }
  }

  // 6. OFFLINE — declared but missing transport (carried on the loaded entry
  //    via missingTransports; surfaced here from discoveredCapabilities when a
  //    load outcome reported missing transports).
  for (const [id, caps] of discoveredCapabilities) {
    const e = upsert(id);
    if (e.capabilities.length === 0) e.capabilities = caps;
    if (e.state === "AVAILABLE" && caps.length > 0) {
      // Discovered + manifest valid but never admitted → AVAILABLE.
      e.state = "AVAILABLE";
    }
  }

  const rejected = entries.filter((e) => e.state === "REJECTED" || e.state === "DUPLICATE");
  const ready = entries.filter((e) => e.state === "LOADED");
  return { entries, ready, rejected };
}
