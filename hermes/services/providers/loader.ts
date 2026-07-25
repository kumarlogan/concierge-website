// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Generic Provider Loader                      │
// │ EPIC-005.2 · PHASE 3                                           │
// │                                                               │
// │ Turns a DiscoveredProvider (data) into a live, registered       │
// │ Provider — WITHOUT knowing any vendor. It loads the package's  │
// │ entry module generically, calls its exported `createProvider`, │
// │ and attaches the Hermes-owned transport named in the manifest. │
// │                                                               │
// │ The ONLY coupling to a provider is its standardized contract   │
// │ export (ProviderPackageContract). No central factory map. No   │
// │ vendor switch. A malformed package is reported, never crashed. │
// └─────────────────────────────────────────────────────────────┘

import type { TransportRegistry } from "./transport.js";
import type { Provider } from "./sdk.js";
import type { ProviderManifestV2 } from "./manifest-v2.js";
import type { DiscoveredProvider } from "./discovery.js";
import {
  type ProviderPackage,
  type ProviderPackageContract,
  type ProviderLoaderContext,
  type PackageLoadResult,
  PROVIDER_PACKAGE_FILES,
} from "./package.js";

/** Loads a package entry module by path. Injected (Hermes-owned). */
export type ModuleLoader = (entryPath: string) => Promise<unknown>;

/** Builds/looks-up a transport instance for a declared transport kind. */
export type TransportResolver = (
  kind: Parameters<TransportRegistry["resolve"]>[0]["kind"],
  endpoint?: string,
  ctx?: ProviderLoaderContext,
) => import("./transport.js").Transport | undefined;

export interface LoaderResult {
  ok: true;
  pkg: ProviderPackage;
  provider: Provider;
  /** Transport kinds that were requested but could not be resolved. */
  missingTransports: string[];
}

export type LoadOutcome =
  | LoaderResult
  | { ok: false; providerId: string; stage: "LOAD"; reason: string };

/**
 * The generic loader. Given a discovered provider, it:
 *   1. loads the entry module (provider.ts) via the injected module loader,
 *   2. verifies it satisfies ProviderPackageContract,
 *   3. resolves each declared transport from the TransportRegistry,
 *   4. calls createProvider(manifest, transports, ctx),
 *   5. returns a fully wired ProviderPackage + live Provider.
 */
export class ProviderLoader {
  constructor(
    private readonly transports: TransportRegistry,
    private readonly loadModule: ModuleLoader,
    private readonly resolveTransport?: TransportResolver,
    private readonly ctx: ProviderLoaderContext = {},
  ) {}

  async load(discovered: DiscoveredProvider): Promise<LoadOutcome> {
    const id = discovered.id;

    // 1 + 2: load + validate the package contract.
    const contractRes = await this.loadContract(discovered);
    if (!contractRes.ok) {
      return { ok: false, providerId: id, stage: "LOAD", reason: contractRes.error };
    }
    const contract = contractRes.contract;

    // 3: resolve transports (Hermes-owned). Missing ones are reported, not fatal
    //    for construction, but recorded so the provider can self-report unavailable.
    const missingTransports: string[] = [];
    // Attach a concrete transport when available; the factory falls back to a
    // spawner-backed transport if the registry lacks one (test-friendly).
    const resolved = this.resolveTransports(discovered, missingTransports);

    // 4: build the live provider via the package's own factory.
    let provider: Provider;
    try {
      provider = contract.createProvider(discovered.manifest, this.transports, {
        ...this.ctx,
      });
    } catch (e) {
      return {
        ok: false,
        providerId: id,
        stage: "LOAD",
        reason: `createProvider threw: ${(e as Error).message}`,
      };
    }

    // 5: assemble the resolved package.
    const pkg: ProviderPackage = {
      id,
      kind: discovered.kind,
      location: discovered.location,
      manifest: discovered.manifest,
      transports: discovered.transports,
      metadata: discovered.metadata,
      contract,
    };

    return { ok: true, pkg, provider, missingTransports };
  }

  // ── internals ─────────────────────────────────────────────────

  private async loadContract(d: DiscoveredProvider): Promise<PackageLoadResult> {
    // remote/registry packages carry the entry inline via a loader that the
    // discovery layer resolved; for filesystem we import provider.ts.
    const entryPath =
      d.location.kind === "filesystem" || d.location.kind === "inline"
        ? `${d.packageDir}/${PROVIDER_PACKAGE_FILES.entry}`
        : d.location.kind === "remote"
          ? d.location.manifestUrl.replace(/manifest\.json$/, PROVIDER_PACKAGE_FILES.entry)
          : `${d.packageDir}/${PROVIDER_PACKAGE_FILES.entry}`;

    let mod: unknown;
    try {
      mod = await this.loadModule(entryPath);
    } catch (e) {
      return { ok: false, error: `entry module load failed: ${(e as Error).message}` };
    }

    const c = mod as Partial<ProviderPackageContract> & Record<string, unknown>;
    if (!c || typeof c.createProvider !== "function" || c.contractVersion !== "1.0") {
      return {
        ok: false,
        error: `entry module missing ProviderPackageContract (need contractVersion '1.0' + createProvider)`,
      };
    }
    return { ok: true, contract: c as ProviderPackageContract };
  }

  private resolveTransports(d: DiscoveredProvider, missing: string[]): void {
    for (const t of d.transports) {
      const exists = this.transports.has(t.kind);
      if (this.resolveTransport) {
        const inst = this.resolveTransport(t.kind, t.endpoint, this.ctx);
        if (!inst && !exists) missing.push(t.kind);
      } else if (!exists) {
        missing.push(t.kind);
      }
    }
  }
}
