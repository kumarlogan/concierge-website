// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential Resolver                            │
// │ EPIC-PLATFORM-001: Credential & Secrets Management         │
// │ Reusable platform capability — NOT Concierge-specific.       │
// └─────────────────────────────────────────────────────────────┘
//
// Hermes never guesses credentials. Every deployment resolves
// through a deterministic chain:
//   Provider → Credential → Validation → PermissionCheck → Deployment → Audit
// If ANY step fails, deployment stops. Hermes is fail-closed.

import { CredentialStatus } from "./types.js";
import type {
  ProviderId,
  CredentialRecord,
  CredentialSource,
  CredentialValidation,
  CredentialHealth,
} from "./types.js";
import { credentialRegistry } from "./credential-registry.js";
import { credentialValidator } from "./credential-validator.js";
import { credentialHealthChecker } from "./credential-health-checker.js";

export interface CredentialResolutionResult {
  providerId: ProviderId;
  credential: CredentialRecord | null;
  validation: CredentialValidation | null;
  healthCheck: CredentialHealth | null;
  source: CredentialSource;
  status: CredentialStatus;
  deployable: boolean;
  failureReason: string | null;
}

/**
 * CredentialResolver — deterministic credential resolution.
 *
 * Hermes never guesses credentials. Every deployment resolves through
 * this deterministic chain. If ANY step fails, deployment stops.
 * Hermes is fail-closed.
 */
export class CredentialResolver {
  /**
   * Check whether a provider is ready for deployment.
   * Returns a deterministic resolution result — Hermes never guesses.
   */
  async checkReadiness(
    providerId: ProviderId,
  ): Promise<CredentialResolutionResult> {
    const credential = await credentialRegistry.get(providerId);
    const source: CredentialSource = credential?.source ?? "hermes-registry";
    const status: CredentialStatus = credential?.status ?? CredentialStatus.DISABLED;
    const validation = credential ? await credentialValidator.validate(providerId) : null;
    const health = credential ? await credentialHealthChecker.check(providerId) : null;

    if (!credential) {
      return {
        providerId,
        credential: null,
        validation: null,
        healthCheck: null,
        source,
        status,
        deployable: false,
        failureReason: `No active credential registered for provider "${providerId}"`,
      };
    }

    if (credential.status === CredentialStatus.INVALID) {
      return {
        providerId,
        credential,
        validation: null,
        healthCheck: null,
        source,
        status,
        deployable: false,
        failureReason: `Credential for "${providerId}" is in INVALID status`,
      };
    }

    if (credential.status === CredentialStatus.STALE) {
      return {
        providerId,
        credential,
        validation: null,
        healthCheck: null,
        source,
        status,
        deployable: false,
        failureReason: `Credential for "${providerId}" is STALE — rotation required`,
      };
    }

    const deployable = !!(
      validation &&
      validation.valid &&
      credential.status === CredentialStatus.ACTIVE &&
      health &&
      health.valid
    );

    return {
      providerId,
      credential,
      validation,
      healthCheck: health,
      source,
      status,
      deployable,
      failureReason: deployable ? null : (validation?.reason ?? "Unknown resolution failure"),
    };
  }
}

export const credentialResolver = new CredentialResolver();