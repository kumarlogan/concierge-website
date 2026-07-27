// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Deployment Resolution Engine                  │
// │ EPIC-PLATFORM-003: Deployment Resolution Engine               │
// │ Hermes never guesses credentials — deterministic resolution. │
// │ Reusable platform capability — NOT Concierge-specific.       │
// └─────────────────────────────────────────────────────────────┘

import { CredentialStatus } from "../credentials/types.js";
import type {
  ProviderId,
  DeploymentReport,
} from "../credentials/types.js";
import { credentialResolver } from "../credentials/credential-resolver.js";
import { credentialValidator } from "../credentials/credential-validator.js";
import { credentialHealthChecker } from "../credentials/credential-health-checker.js";
import { providerRegistry } from "../providers/provider-registry.js";

/**
 * Deployment Resolution Engine — deterministic credential resolution.
 *
 * Each deployment MUST resolve through this pipeline:
 *   1. Resolve provider (which provider?)
 *   2. Resolve credential (which credential?)
 *   3. Validate credential (is it valid?)
 *   4. Check permissions (does it have what it needs?)
 *   5. Execute deployment (only if all checks pass)
 *   6. Record audit (always, even on failure)
 *
 * Hermes stops if ANY step fails — fail-closed, never guesswork.
 */
export class DeploymentResolutionEngine {
  async resolve(providerId: ProviderId): Promise<DeploymentReport> {
    const deploymentId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    const provider = await providerRegistry.get(providerId);
    if (!provider) {
      return this.failureReport(
        deploymentId,
        providerId,
        timestamp,
        `Provider "${providerId}" is not registered`,
      );
    }

    const readiness = await credentialResolver.checkReadiness(providerId);
    if (!readiness.deployable) {
      return {
        deploymentId,
        timestamp,
        environment: "preview" as const,
        provider: providerId,
        credentialSource: "hermes-registry" as const,
        credentialStatus: CredentialStatus.INVALID,
        validation: readiness.validation ?? {
          providerId,
          valid: false,
          source: "hermes-registry" as const,
          reason: "No credential available",
          checkedAt: timestamp,
          permissions: [],
        },
        health: readiness.healthCheck ?? null,
        permissions: [],
        deployable: false,
        failureReason:
          readiness.failureReason ?? "Credential resolution failed",
        auditId: deploymentId,
      };
    }

    const validation = await credentialValidator.validate(providerId);
    const health = await credentialHealthChecker.check(providerId);
    const hasPermissions = this.checkPermissions(
      provider,
      validation.permissions,
    );

    const failureReason = !hasPermissions
      ? `Missing required scopes. Required: ${provider.requiredScopes.map((s) => s.scope).join(", ")}`
      : null;

    return {
      deploymentId,
      timestamp,
      environment: "preview" as const,
      provider: providerId,
      credentialSource: readiness.credential?.source ?? "hermes-registry" as const,
      credentialStatus: readiness.credential?.status ?? CredentialStatus.INVALID,
      validation,
      health,
      permissions: validation.permissions,
      deployable: hasPermissions && validation.valid && health.valid,
      failureReason,
      auditId: deploymentId,
    };
  }

  async checkAllReadiness(): Promise<DeploymentReport[]> {
    const providers = await providerRegistry.listAll();
    return Promise.all(
      providers.map((p) => this.resolve(p.providerId)),
    );
  }

  private failureReport(
    deploymentId: string,
    providerId: ProviderId,
    timestamp: string,
    reason: string,
  ): DeploymentReport {
    return {
      deploymentId,
      timestamp,
      environment: "preview" as const,
      provider: providerId,
      credentialSource: "hermes-registry" as const,
      credentialStatus: CredentialStatus.INVALID,
      validation: {
        providerId,
        valid: false,
        source: "hermes-registry" as const,
        reason,
        checkedAt: timestamp,
        permissions: [],
      },
      health: null,
      permissions: [],
      deployable: false,
      failureReason: reason,
      auditId: deploymentId,
    };
  }

  private checkPermissions(
    provider: { requiredScopes: { scope: string }[] },
    granted: string[],
  ): boolean {
    return provider.requiredScopes.every((s) =>
      granted.includes(s.scope),
    );
  }
}

export const deploymentResolutionEngine = new DeploymentResolutionEngine();