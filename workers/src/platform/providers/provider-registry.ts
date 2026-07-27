// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Provider Registry                            │
// │ EPIC-PLATFORM-002: Provider Registry                        │
// │ Reusable platform capability — NOT Concierge-specific       │
// └─────────────────────────────────────────────────────────────┘
//
// The Provider Registry manages all platform providers.
// Each provider exposes: ID, capability, credentials,
// validation routine, health status, required scopes,
// rotation policy, and audit history.

import type {
  RegisteredProvider,
  ProviderRegistry,
  ProviderId,
  ProviderHealthStatus,
  RegisterProviderRequest,
} from "./types.js";

/**
 * In-memory provider registry implementation.
 * Backed by D1 in production. Initial in-memory implementation
 * establishes the interface contract.
 */
export class InMemoryProviderRegistry implements ProviderRegistry {
  private readonly providers: Map<ProviderId, RegisteredProvider> = new Map();

  async register(provider: RegisteredProvider): Promise<void> {
    this.providers.set(provider.providerId, provider);
  }

  async updateHealth(
    providerId: ProviderId,
    status: ProviderHealthStatus,
  ): Promise<void> {
    const provider = this.providers.get(providerId);
    if (!provider) return;
    provider.healthStatus = status;
    provider.updatedAt = new Date().toISOString();
    provider.auditHistory.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      action: "health_update",
      actor: "provider-registry",
      details: `Health status updated: ${provider.healthStatus} → ${status}`,
      previousHealth: provider.healthStatus,
      newHealth: status,
    });
  }

  async get(providerId: ProviderId): Promise<RegisteredProvider | null> {
    return this.providers.get(providerId) ?? null;
  }

  async listAll(): Promise<RegisteredProvider[]> {
    return Array.from(this.providers.values());
  }

  async listByCapability(
    capability: string,
  ): Promise<RegisteredProvider[]> {
    return Array.from(this.providers.values()).filter(
      (p) => p.capability === capability,
    );
  }

  async remove(providerId: ProviderId): Promise<void> {
    this.providers.delete(providerId);
  }

  async validateAll(): Promise<Record<ProviderId, boolean>> {
    const results: Record<ProviderId, boolean> = {};
    for (const [id, provider] of this.providers) {
      results[id] =
        provider.credentials.status === "valid" &&
        provider.validationRoutine.lastResult;
    }
    return results;
  }

  async healthCheckAll(): Promise<Record<ProviderId, ProviderHealthStatus>> {
    const results: Record<ProviderId, ProviderHealthStatus> = {};
    for (const [id, provider] of this.providers) {
      results[id] = provider.healthStatus;
    }
    return results;
  }
}

// Singleton default registry.
export const providerRegistry = new InMemoryProviderRegistry();