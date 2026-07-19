/**
 * Hermes Platform — Provider Boundary Interfaces
 * EPIC-002-006B · PHASE 5
 *
 * These are CONTRACTS ONLY. They define the boundary between the
 * application-agnostic Hermes Platform and its concrete (currently Cloudflare)
 * adapters. No implementation lives here — Cloudflare remains the first
 * adapter and is NOT replaced in this EPIC.
 *
 * Design rules:
 *  - Interfaces are capability-scoped, not vendor-scoped.
 *  - Every method is async (adapters may be remote).
 *  - Interfaces must be importable by both `hermes/*` and `workers/*`
 *    via the `@shared/interfaces` alias.
 */

export interface IdentityResolution {
  providerType: "telegram" | "email" | "api_key" | "system";
  externalId: string;
  displayName?: string;
  raw?: Record<string, unknown>;
}

export interface Principal {
  id: string;
  roleId: string;
  roleName: string;
  permissions: string[];
  isActive: boolean;
  externalId: string;
  source: IdentityResolution["providerType"];
}

export interface IdentityProvider {
  /** Resolve a raw credential/token into a provider-neutral identity. */
  resolveIdentity(credential: unknown): Promise<IdentityResolution>;
  /** Build a fully-formed Principal from a resolved identity. */
  buildPrincipal(resolution: IdentityResolution, store: unknown): Promise<Principal>;
}
