// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Provider Registry                │
// │ Reusable provider registry for authentication adapters.     │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import type { IdentityProviderRecord } from "./types.js";
import { IdentityRepository } from "./identity-repository.js";

/**
 * Authentication provider interface.
 * Every auth method (password, OAuth, magic link, etc.) implements this.
 */
export interface AuthProvider {
  readonly id: string;
  readonly providerType: string;
  readonly displayName: string;
  readonly supportedMethods: string[];

  /** Initiate authentication. Returns a redirect URL or challenge. */
  initiate(request: AuthInitiateRequest): Promise<AuthInitiateResult>;

  /** Handle callback/verification. Returns authenticated identity info. */
  handleCallback(request: AuthCallbackRequest): Promise<AuthCallbackResult>;

  /** Health check for the provider. */
  health(): Promise<{ ok: boolean; message?: string }>;
}

export interface AuthInitiateRequest {
  redirectUri?: string;
  state?: string;
  scopes?: string[];
  metadata?: Record<string, unknown>;
}

export interface AuthInitiateResult {
  redirectUrl?: string;
  state?: string;
  challenge?: string;
  expiresAt?: string;
}

export interface AuthCallbackRequest {
  code?: string;
  state?: string;
  token?: string;
  redirectUri?: string;
  metadata?: Record<string, unknown>;
}

export interface AuthCallbackResult {
  authenticated: boolean;
  identityId?: string;
  subjectId?: string;
  email?: string;
  displayName?: string;
  raw?: Record<string, unknown>;
  error?: string;
}

/**
 * Provider Registry — manages registered auth providers.
 * Loads enabled providers from D1 and allows runtime registration.
 */
export class IdentityProviderRegistry {
  private readonly repo: IdentityRepository;
  private readonly providers: Map<string, AuthProvider> = new Map();

  constructor(repo: IdentityRepository) {
    this.repo = repo;
  }

  /**
   * Register a provider implementation.
   */
  registerProvider(provider: AuthProvider): void {
    this.providers.set(provider.id, provider);
  }

  /**
   * Unregister a provider.
   */
  unregisterProvider(id: string): void {
    this.providers.delete(id);
  }

  /**
   * Get a registered provider by ID.
   */
  getProvider(id: string): AuthProvider | undefined {
    return this.providers.get(id);
  }

  /**
   * List all registered providers.
   */
  listProviders(): AuthProvider[] {
    return [...this.providers.values()];
  }

  /**
   * Load enabled provider configurations from D1 and register them.
   * Returns the number of providers loaded.
   */
  async loadFromDatabase(): Promise<number> {
    const records = await this.repo.getEnabledProviders();
    let count = 0;
    for (const record of records) {
      // Only load if a matching provider implementation is registered
      if (this.providers.has(record.provider_type)) {
        count++;
      }
    }
    return count;
  }

  /**
   * Get the enabled provider configuration from D1.
   */
  async getProviderConfig(providerType: string): Promise<IdentityProviderRecord | null> {
    const records = await this.repo.getEnabledProviders();
    return records.find((r) => r.provider_type === providerType) ?? null;
  }
}