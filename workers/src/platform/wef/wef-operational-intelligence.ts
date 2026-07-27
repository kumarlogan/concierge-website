// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WEF Operational Intelligence                      │
// │ EPIC-PLATFORM-007: Extend WEF Phase 0                          │
// │ Pre-deployment automated health & readiness reporting.    │
// │ Reusable platform capability — NOT Concierge-specific.         │
// └─────────────────────────────────────────────────────────────┘
//
// Before every deployment Hermes automatically reports:
//   - Platform dependency health (Cloudflare, GitHub, Telegram,
//     OpenRouter, Workers, Pages, D1, KV, R2, Identity Runtime, Trust Runtime)
//   - Credential Status for all registered providers
//   - Deployment Readiness
//   - Overall Platform Health
// No deployment proceeds if a critical dependency fails.

import { DeploymentHealthFramework } from "../deployment/deployment-health.js";
import { credentialResolver } from "../credentials/credential-resolver.js";
import { deploymentResolutionEngine } from "../deployment/deployment-resolution-engine.js";
import { providerRegistry } from "../providers/provider-registry.js";

export type Severity = "critical" | "warning" | "ok" | "info";

export interface DependencyReport {
  name: string;
  severity: Severity;
  healthy: boolean;
  message: string;
  details: Record<string, unknown>;
}

export interface WefOperationalReport {
  timestamp: string;
  deploymentId: string;
  overallHealth: "green" | "yellow" | "red";
  canDeploy: boolean;
  criticalFailures: DependencyReport[];
  warnings: DependencyReport[];
  healthy: DependencyReport[];
  credentialStatus: Record<string, {
    source: string;
    status: string;
    deployable: boolean;
    failureReason: string | null;
  }>;
  providerStatus: Record<string, {
    registered: boolean;
    healthy: boolean;
    credentialStatus: string;
  }>;
  readiness: Record<string, boolean>;
  summary: {
    totalDependencies: number;
    healthyCount: number;
    warningCount: number;
    criticalCount: number;
  };
}

export class WefOperationalIntelligence {
  private healthFramework: DeploymentHealthFramework;

  constructor() {
    this.healthFramework = new DeploymentHealthFramework();
  }

  /**
   * Run full pre-deployment health report.
   * Returns a deterministic report. No deployment proceeds if critical failures exist.
   */
  async preDeploymentReport(): Promise<WefOperationalReport> {
    const deploymentId = crypto.randomUUID();
    const timestamp = new Date().toISOString();

    // Run health checks for all platform dependencies
    const healthResults = await this.healthFramework.runAll();

    // Resolve credentials for all registered providers
    const providers = await providerRegistry.listAll();
    const credentialReports: Record<string, WefOperationalReport["credentialStatus"][string]> = {};
    const providerReports: Record<string, WefOperationalReport["providerStatus"][string]> = {};

    for (const provider of providers) {
      const resolution = await credentialResolver.checkReadiness(provider.providerId);
      credentialReports[provider.providerId] = {
        source: resolution.credential?.source ?? "hermes-registry",
        status: resolution.credential?.status ?? "invalid",
        deployable: resolution.deployable,
        failureReason: resolution.failureReason,
      };

      providerReports[provider.providerId] = {
        registered: true,
        healthy: healthResults.find((r) => r.dependency === provider.providerId)?.healthy ?? true,
        credentialStatus: resolution.credential?.status ?? "invalid",
      };
    }

    // Categorize results
    const criticalFailures: DependencyReport[] = [];
    const warnings: DependencyReport[] = [];
    const healthy: DependencyReport[] = [];

    for (const result of healthResults) {
      const report: DependencyReport = {
        name: result.dependency,
        healthy: result.healthy,
        severity: result.status === "down" ? "critical" : result.status === "degraded" ? "warning" : "ok",
        message: result.error ?? "All checks passed",
        details: {
          status: result.status,
          responseTimeMs: result.responseTimeMs,
          checkedAt: result.checkedAt,
        },
      };

      if (result.status === "down") {
        criticalFailures.push(report);
      } else if (result.status === "degraded") {
        warnings.push(report);
      } else {
        healthy.push(report);
      }
    }

    // Check credential failures
    for (const providerId of Object.keys(credentialReports)) {
      const credReport = credentialReports[providerId];
      if (!credReport.deployable) {
        const isCritical = credReport.status === "invalid" || credReport.status === "stale" || credReport.status === "disabled";
        const report: DependencyReport = {
          name: `credential:${providerId}`,
          healthy: false,
          severity: isCritical ? "critical" : "warning",
          message: credReport.failureReason ?? `Credential for ${providerId} is not deployable`,
          details: credReport,
        };
        if (isCritical) {
          criticalFailures.push(report);
        } else {
          warnings.push(report);
        }
      }
    }

    const overallHealth = criticalFailures.length > 0 ? "red" : warnings.length > 0 ? "yellow" : "green";
    const canDeploy = criticalFailures.length === 0;

    return {
      timestamp,
      deploymentId,
      overallHealth,
      canDeploy,
      criticalFailures,
      warnings,
      healthy,
      credentialStatus: credentialReports,
      providerStatus: providerReports,
      readiness: Object.fromEntries(
        providers.map((p) => [p.providerId, credentialReports[p.providerId]?.deployable ?? false]),
      ),
      summary: {
        totalDependencies: healthResults.length + providers.length,
        healthyCount: healthy.length,
        warningCount: warnings.length,
        criticalCount: criticalFailures.length,
      },
    };
  }

  /**
   * Check if deployment is allowed to proceed.
   * Returns true only if no critical failures exist.
   */
  async canDeploy(): Promise<{ deployable: boolean; report: WefOperationalReport }> {
    const report = await this.preDeploymentReport();
    return { deployable: report.canDeploy, report };
  }
}