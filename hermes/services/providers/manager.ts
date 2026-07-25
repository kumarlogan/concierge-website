// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Dynamic Provider Manager                     │
// │ EPIC-005.2 · PHASE 4 + 5 + 6 glue                              │
// │                                                               │
// │ Orchestrates the FULL dynamic pipeline:                        │
// │   Discovery → Loader → Trust Admission → Capability Reg →      │
// │   Activation → Marketplace.                                    │
// │                                                               │
// │ CRITICAL (PHASE 4): every provider enters ONLY through the     │
// │ UniversalCapabilityPlatform trust gate. There is NO bypass     │
// │ path. Rejected providers stay visible in the marketplace.      │
// │                                                               │
// │ Handles duplicates (PHASE 7 #4) and capability collisions      │
// │ (PHASE 7 #5) at the manager layer, around the trust gate.      │
// └─────────────────────────────────────────────────────────────┘

import { ProviderDiscovery, type DiscoveryResult } from "./discovery.js";
import { ProviderLoader } from "./loader.js";
import type { ProviderPackage, ProviderLoaderContext, ProviderPackageLocation } from "./package.js";
import { UniversalCapabilityPlatform } from "./platform.js";
import type { CapabilityRegistry } from "./capability.js";
import type { Provider } from "./sdk.js";
import type { ProviderManifestV2 } from "./manifest-v2.js";
import type { TrustStateStore } from "./trust/persistence/trust-state-store.js";

export interface ScanResult {
  /** Providers that passed discovery + load + trust admission. */
  loaded: string[];
  /** Discovered but invalid manifests / unreadable locations. */
  discoveryRejected: DiscoveryResult["rejected"];
  /** Loaded package but trust-rejected (visible in marketplace). */
  trustRejected: string[];
  /** Provider id already admitted — duplicate rejected. */
  duplicates: string[];
  /** capId claimed by two providers. */
  collisions: Array<{ capability: string; providers: string[] }>;
}

export interface ManagerOptions {
  /** Injected file reader (Hermes-owned). */
  read: import("./discovery.js").FileReader;
  /** Injected dir lister (Hermes-owned). */
  listDir: import("./discovery.js").DirLister;
  /** Injected module loader (Hermes-owned). */
  loadModule: import("./loader.js").ModuleLoader;
  /** Loader context (spawner injection, etc.). */
  ctx?: ProviderLoaderContext;
  /** EPIC-005.9 (P3): durable trust state store (file-backed in production). */
  trustStateStore?: TrustStateStore;
}

/**
 * Drives dynamic provider loading end-to-end. Composes Discovery, Loader, and
 * the UniversalCapabilityPlatform (which owns the trust gate). Provider-neutral.
 */
export class DynamicProviderManager {
  readonly discovery: ProviderDiscovery;
  readonly loader: ProviderLoader;
  readonly platform: UniversalCapabilityPlatform;
  private readonly loaded = new Map<string, { pkg: ProviderPackage; provider: Provider }>();
  private readonly capabilityOwners = new Map<string, string>();
  private readonly locations = new Map<string, ProviderPackageLocation>();

  constructor(
    private readonly capabilityRegistry: CapabilityRegistry,
    opts: ManagerOptions,
  ) {
    const authorize =
      (opts.ctx as { runtime?: { authorize?: (m: ProviderManifestV2) => boolean | Promise<boolean> } } | undefined)
        ?.runtime?.authorize ?? (() => true);
    // EPIC-005.9 (P4): production trust defaults. Signature enforcement is
    // fail-closed in production (HERMES_ENFORCE_SIGNATURES=true or NODE_ENV=
    // production ⇒ true). Dev/test default is false so unsigned local providers
    // still admit during development. Hermes owns this policy, never a provider.
    const enforceSignatures =
      process.env.HERMES_ENFORCE_SIGNATURES === "true" ||
      (process.env.NODE_ENV === "production" && process.env.HERMES_ENFORCE_SIGNATURES !== "false");
    this.platform = new UniversalCapabilityPlatform(
      { trustedSigners: [], enforceSignatures, enablePersistence: Boolean(opts.trustStateStore), authorize },
      capabilityRegistry,
      undefined,
      opts.trustStateStore,
    );
    this.discovery = new ProviderDiscovery(opts.read, opts.listDir);
    this.loader = new ProviderLoader(
      this.platform.transportRegistry,
      opts.loadModule,
      undefined,
      opts.ctx,
    );
  }

  /** Replace the platform's trust config (Hermes-owned policy). */
  withTrustConfig(cfg: ConstructorParameters<typeof UniversalCapabilityPlatform>[0]): this {
    this.platform.setTrustConfig(cfg);
    return this;
  }

  /**
   * Discover + load + admit all providers at the given locations.
   * Failures are isolated per-provider; the scan never throws.
   */
  async scan(locations: ProviderPackageLocation[]): Promise<ScanResult> {
    const result: ScanResult = {
      loaded: [],
      discoveryRejected: [],
      trustRejected: [],
      duplicates: [],
      collisions: [],
    };

    const discovered = await this.discovery.discoverAll(locations);
    result.discoveryRejected.push(...discovered.rejected);

    for (const d of discovered.discovered) {
      // PHASE 7 #4 — duplicate id already admitted → reject, never clobber.
      if (this.loaded.has(d.id) || this.platform.marketplace.get(d.id)) {
        result.duplicates.push(d.id);
        continue;
      }

      const loadOutcome = await this.loader.load(d);
      if (!loadOutcome.ok) {
        // Loader failure → trust-rejected (visible). Record via platform.
        this.platform.registerProvider({
          manifest: d.manifest,
          factory: () => {
            throw new Error(loadOutcome.reason);
          },
        });
        const p = await this.platform.bootstrap(d.id);
        if (!p) result.trustRejected.push(d.id);
        continue;
      }

      // PHASE 5 — collision pre-check (before admission registers caps).
      const preCollisions = this.detectCollisions(d.id, loadOutcome.pkg.manifest.capabilities.map((c) => c.id));
      if (preCollisions.length) result.collisions.push(...preCollisions);

      // ── Trust admission (PHASE 4: the ONLY path) ──
      this.platform.registerProvider({
        manifest: loadOutcome.pkg.manifest,
        factory: () => loadOutcome.provider,
      });
      const provider = await this.platform.bootstrap(d.id);
      if (!provider) {
        result.trustRejected.push(d.id);
        continue;
      }

      this.loaded.set(d.id, { pkg: loadOutcome.pkg, provider });
      this.locations.set(d.id, d.location);
      result.loaded.push(d.id);
    }

    return result;
  }

  /** Unload a provider (PHASE 7 #7). Tears down live provider + frees caps; record stays visible (UNLOADED). */
  async unload(providerId: string): Promise<boolean> {
    const entry = this.loaded.get(providerId);
    if (!entry) return false;
    await this.platform.unloadProvider(providerId);
    this.loaded.delete(providerId);
    // Keep this.locations[providerId] so reload() can recover post-unload.
    for (const [cap, owner] of [...this.capabilityOwners]) {
      if (owner === providerId) this.capabilityOwners.delete(cap);
    }
    return true;
  }

  /** Reload a provider (PHASE 7 #8): unload then re-admit from its package. */
  async reload(providerId: string): Promise<boolean> {
    const entry = this.loaded.get(providerId);
    // If already loaded, unload first; otherwise recover location from last scan.
    if (entry) {
      await this.unload(providerId);
    } else if (!this.locations.has(providerId)) {
      return false;
    }
    const location = entry?.pkg.location ?? this.locations.get(providerId)!;
    // Re-discover from the same location.
    const discovered = await this.discovery.discover(location);
    const d = discovered.discovered.find((x) => x.id === providerId);
    if (!d) return false;
    const loadOutcome = await this.loader.load(d);
    if (!loadOutcome.ok) return false;
    this.detectCollisions(providerId, loadOutcome.pkg.manifest.capabilities.map((c) => c.id));
    this.platform.registerProvider({
      manifest: loadOutcome.pkg.manifest,
      factory: () => loadOutcome.provider,
    });
    const provider = await this.platform.bootstrap(providerId);
    if (!provider) return false;
    this.loaded.set(providerId, { pkg: loadOutcome.pkg, provider });
    this.locations.set(providerId, location);
    return true;
  }

  getLoaded(providerId: string): Provider | undefined {
    return this.loaded.get(providerId)?.provider;
  }

  // ── internals ─────────────────────────────────────────────────

  private detectCollisions(providerId: string, caps: string[]): ScanResult["collisions"] {
    const collisions: ScanResult["collisions"] = [];
    for (const cap of caps) {
      const existing = this.capabilityRegistry.ownerOf(cap);
      if (existing && existing !== (providerId as never)) {
        collisions.push({ capability: cap, providers: [String(existing), providerId] });
        this.capabilityOwners.set(cap, providerId); // current wins, but collision recorded
      } else {
        this.capabilityOwners.set(cap, providerId);
      }
    }
    return collisions;
  }
}
