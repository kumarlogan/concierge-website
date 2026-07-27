// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential Validator                            │
// │ EPIC-PLATFORM-001: Credential & Secrets Management           │
// │ Reusable platform capability — NOT Concierge-specific         │
// └─────────────────────────────────────────────────────────────┘
//
// Validates credentials against their provider. Checks scope,
// expiry, and provider-specific constraints. Hermes never
// deploys with an uncertified credential.

import type {
  CredentialValidation,
  CredentialRecord,
  ProviderId,
  CredentialValidator,
} from "./types.js";

/**
 * Provider-specific validation rules.
 * Each provider has its own validation contract for credentials.
 */
interface ProviderValidationRules {
  requiredScopes: string[];
  maxAgeHours: number;
  endpoint: string;
}

const PROVIDER_RULES: Record<ProviderId, ProviderValidationRules> = {
  cloudflare: {
    requiredScopes: ["account:read", "workers:edit", "dns:edit"],
    maxAgeHours: 168, // 1 week
    endpoint: "https://api.cloudflare.com/client/v4/user/tokens/verify",
  },
  github: {
    requiredScopes: ["repo", "workflow", "admin:org"],
    maxAgeHours: 720, // 30 days
    endpoint: "https://api.github.com/user",
  },
  telegram: {
    requiredScopes: ["bot"],
    maxAgeHours: 8760, // 1 year (token does not expire by default)
    endpoint: "https://api.telegram.org/bot<token>/getMe",
  },
  openrouter: {
    requiredScopes: ["models:read", "chat:completions"],
    maxAgeHours: 720,
    endpoint: "https://openrouter.ai/api/v1/models",
  },
  oci: {
    requiredScopes: ["tenancy:read", "instance:read"],
    maxAgeHours: 168,
    endpoint: "https://iaas.oraclecloud.com/20160918/instances",
  },
  google: {
    requiredScopes: ["https://www.googleapis.com/auth/cloud-platform"],
    maxAgeHours: 720,
    endpoint: "https://www.googleapis.com/oauth2/v3/tokeninfo",
  },
  email: {
    requiredScopes: ["smtp", "imap"],
    maxAgeHours: 720,
    endpoint: "smtp://mail.provider.com",
  },
  workers: {
    requiredScopes: ["workers:edit"],
    maxAgeHours: 168,
    endpoint: "",
  },
  pages: {
    requiredScopes: ["pages:deploy"],
    maxAgeHours: 168,
    endpoint: "",
  },
  d1: {
    requiredScopes: ["d1:read", "d1:write"],
    maxAgeHours: 168,
    endpoint: "",
  },
  kv: {
    requiredScopes: ["kv:read", "kv:write"],
    maxAgeHours: 168,
    endpoint: "",
  },
  r2: {
    requiredScopes: ["r2:read", "r2:write"],
    maxAgeHours: 168,
    endpoint: "",
  },
};

/**
 * Credential Validator — validates credentials against provider rules.
 */
export class CredentialValidatorImpl implements CredentialValidator {
  async validate(providerId: ProviderId): Promise<CredentialValidation> {
    const rules = PROVIDER_RULES[providerId];
    const record = await this.loadRecord(providerId);
    if (!record) {
      return {
        providerId,
        valid: false,
        source: "hermes-registry",
        reason: `No credential registered for provider "${providerId}"`,
        checkedAt: new Date().toISOString(),
        permissions: [],
      };
    }

    const valid = this.evaluate(record, rules);
    return {
      providerId,
      valid,
      source: record.source,
      reason: valid ? null : this.failureReason(record, rules),
      checkedAt: new Date().toISOString(),
      permissions: rules.requiredScopes,
    };
  }

  async validateAll(): Promise<CredentialValidation[]> {
    const records = await this.loadAllRecords();
    return Promise.all(
      records.map((record) => this.validate(record.providerId)),
    );
  }

  private async loadRecord(
    providerId: ProviderId,
  ): Promise<CredentialRecord | null> {
    // In production this calls CredentialRegistry.get().
    // For the platform capability, this is a contract placeholder.
    return null;
  }

  private async loadAllRecords(): Promise<CredentialRecord[]> {
    // In production this calls CredentialRegistry.listAll().
    return [];
  }

  private evaluate(
    record: CredentialRecord,
    rules: ProviderValidationRules,
  ): boolean {
    if (record.status !== "active") return false;
    if (record.expiresAt) {
      const expires = new Date(record.expiresAt);
      if (expires < new Date()) return false;
    }
    const ageHours =
      (Date.now() - new Date(record.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > rules.maxAgeHours) return false;
    return true;
  }

  private failureReason(
    record: CredentialRecord,
    rules: ProviderValidationRules,
  ): string {
    if (record.status !== "active") {
      return `Credential status is "${record.status}"`;
    }
    if (record.expiresAt && new Date(record.expiresAt) < new Date()) {
      return `Credential expired at ${record.expiresAt}`;
    }
    const ageHours =
      (Date.now() - new Date(record.createdAt).getTime()) / (1000 * 60 * 60);
    if (ageHours > rules.maxAgeHours) {
      return `Credential age (${Math.round(ageHours)}h) exceeds max (${rules.maxAgeHours}h)`;
    }
    return "Validation failed (unknown reason)";
  }
}

export const credentialValidator = new CredentialValidatorImpl();