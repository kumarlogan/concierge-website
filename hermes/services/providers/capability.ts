// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Loader Seam                         │
// │ EPIC-003-006 M5 · Manifest → Loader → Capability Registry.     │
// │                                                            
// │  Manifest    : declarative description of a provider's         │
// │                capabilities (data, never code).                 │
// │  Loader      : turns a Manifest into live, registered          │
// │                Capability instances (the only place that       │
// │                instantiates provider code).                    │
// │  Registry    : stores/looks up capabilities by id; the single  │
// │                source of truth for "what can run here".         │
// │                                                            
// │ This seam isolates vendor SDK binding from capability lookup.   │
// │ Business logic asks the Registry; it never imports a manifest   │
// │ or loader directly.                                             │
// └─────────────────────────────────────────────────────────────┘

import type { ProviderName } from "./index.js";

/** A single capability a provider exposes (e.g. "compute", "object-store"). */
export interface Capability {
  /** Stable capability id, namespaced by provider (e.g. "cloudflare:r2"). */
  id: string;
  /** Human label. */
  name: string;
  /** Provider that supplies this capability. */
  provider: ProviderName;
  /** Arbitrary capability-specific config (non-secret). */
  config?: Record<string, unknown>;
  /** Live implementation handle (opaque to the registry). */
  impl?: unknown;
}

/** Declarative manifest: the ONLY thing a provider ships to be registered. */
export interface ProviderManifest {
  /** Provider name (matches the adapter service vocabulary). */
  name: ProviderName;
  /** Semantic version of the manifest contract. */
  version: string;
  /** Declared capabilities (loaded by the Loader into live instances). */
  capabilities: Array<{
    id: string;
    name: string;
    config?: Record<string, unknown>;
    /** Factory key the Loader resolves to a live impl (data, not a function). */
    implKey: string;
  }>;
}

/**
 * Loads manifests into live Capability instances. The Loader is the ONLY place
 * that maps an `implKey` (data) to a concrete implementation, keeping vendor
 * code out of the manifest and the registry.
 */
export type ProviderLoader = (manifest: ProviderManifest) => Capability[];

/**
 * Capability registry — single source of truth for "what can run here".
 * Lookups are synchronous and in-memory (edge-safe); a D1-backed variant can
 * wrap the same interface later (ADR-007).
 */
export interface CapabilityRegistry {
  /** Register a batch of capabilities (idempotent by id). */
  register(caps: Capability[]): void;
  /** Resolve a capability by id. */
  get(id: string): Capability | undefined;
  /** List all registered capabilities (optionally filtered by provider). */
  list(provider?: ProviderName): Capability[];
  /** True when a capability is available. */
  has(id: string): boolean;
}

/** Default in-memory registry. */
export class MemoryCapabilityRegistry implements CapabilityRegistry {
  private readonly caps = new Map<string, Capability>();

  register(caps: Capability[]): void {
    for (const c of caps) this.caps.set(c.id, c);
  }
  get(id: string): Capability | undefined {
    return this.caps.get(id);
  }
  list(provider?: ProviderName): Capability[] {
    const all = [...this.caps.values()];
    return provider ? all.filter((c) => c.provider === provider) : all;
  }
  has(id: string): boolean {
    return this.caps.has(id);
  }
}

/**
 * Standard loader: resolves each manifest capability's `implKey` through a
 * provided factory map, producing live Capability instances. The factory map
 * is the ONLY place vendor code enters the seam.
 */
export function createManifestLoader(
  implFactories: Record<string, (config?: Record<string, unknown>) => unknown>,
): ProviderLoader {
  return (manifest: ProviderManifest): Capability[] => {
    return manifest.capabilities.map((spec) => {
      const factory = implFactories[spec.implKey];
      if (!factory) {
        throw new Error(
          `Provider "${manifest.name}" capability "${spec.id}" references unknown implKey "${spec.implKey}"`,
        );
      }
      return {
        id: spec.id,
        name: spec.name,
        provider: manifest.name,
        config: spec.config,
        impl: factory(spec.config),
      };
    });
  };
}

/** Process-wide default registry (the active capability seam). */
export const defaultCapabilityRegistry: CapabilityRegistry = new MemoryCapabilityRegistry();
