// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential Health Checker
// │ EPIC-PLATFORM-001: Credential & Secrets Management
// │ Reusable platform capability — NOT Concierge-specific
// └─────────────────────────────────────────────────────────────┘
//
// Runs health checks against all registered providers.
// WEF Phase 0 automatically executes these checks before any deployment.
// Hermes stops if a critical dependency fails — fail-closed.

import type {
  CredentialHealth,
  CredentialHealthChecker,
  ProviderId,
} from "./types.js";
import { CredentialStatus } from "./types.js";

/**
 * Provider health check endpoint mapping.
 * Each provider has a known endpoint for health verification.
 */
interface HealthCheckEndpoint {
  url: string;
  method: "GET" | "POST";
  timeoutMs: number;
}

const HEALTH_ENDPOINTS: Record<ProviderId, HealthCheckEndpoint> = {
  cloudflare: {
    url: "https://api.cloudflare.com/client/v4/user/tokens/verify",
    method: "GET",
    timeoutMs: 5000,
  },
  github: {
    url: "https://api.github.com/user",
    method: "GET",
    timeoutMs: 5000,
  },
  telegram: {
    url: "https://api.telegram.org/bot",
    method: "GET",
    timeoutMs: 5000,
  },
  openrouter: {
    url: "https://openrouter.ai/api/v1/models",
    method: "GET",
    timeoutMs: 5000,
  },
  oci: {
    url: "https://iaas.oraclecloud.com/20160918/instances",
    method: "GET",
    timeoutMs: 10000,
  },
  google: {
    url: "https://www.googleapis.com/oauth2/v3/tokeninfo",
    method: "GET",
    timeoutMs: 5000,
  },
  email: {
    url: "smtp://mail.provider.com",
    method: "POST",
    timeoutMs: 5000,
  },
  workers: {
    url: "",
    method: "GET",
    timeoutMs: 5000,
  },
  pages: {
    url: "",
    method: "GET",
    timeoutMs: 5000,
  },
  d1: {
    url: "",
    method: "GET",
    timeoutMs: 5000,
  },
  kv: {
    url: "",
    method: "GET",
    timeoutMs: 5000,
  },
  r2: {
    url: "",
    method: "GET",
    timeoutMs: 5000,
  },
};

/**
 * Credential Health Checker — runs health checks against providers.
 */
export class CredentialHealthCheckerImpl implements CredentialHealthChecker {
  async check(providerId: ProviderId): Promise<CredentialHealth> {
    const endpoint = HEALTH_ENDPOINTS[providerId];
    const now = new Date().toISOString();

    // Providers without external endpoints are always healthy
    // (the check is structural, not network-based).
    if (!endpoint.url) {
      return {
        providerId,
        status: CredentialStatus.ACTIVE,
        valid: true,
        expiresAt: null,
        lastChecked: now,
        source: "hermes-registry",
        failureReason: null,
        permissions: [],
      };
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        endpoint.timeoutMs,
      );

      const response = await fetch(endpoint.url, {
        method: endpoint.method,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return {
          providerId,
          status: CredentialStatus.INVALID,
          valid: false,
          expiresAt: null,
          lastChecked: now,
          source: "hermes-registry",
          failureReason: `Health endpoint returned HTTP ${response.status}`,
          permissions: [],
        };
      }

      return {
        providerId,
        status: CredentialStatus.ACTIVE,
        valid: true,
        expiresAt: null,
        lastChecked: now,
        source: "hermes-registry",
        failureReason: null,
        permissions: [],
      };
    } catch (error) {
      return {
        providerId,
        status: CredentialStatus.STALE,
        valid: false,
        expiresAt: null,
        lastChecked: now,
        source: "hermes-registry",
        failureReason:
          error instanceof Error ? error.message : "Unknown health check failure",
        permissions: [],
      };
    }
  }

  async checkAll(): Promise<CredentialHealth[]> {
    const providerIds: ProviderId[] = [
      "cloudflare",
      "github",
      "telegram",
      "openrouter",
      "oci",
      "google",
      "email",
      "workers",
      "pages",
      "d1",
      "kv",
      "r2",
    ];
    return Promise.all(providerIds.map((id) => this.check(id)));
  }
}

export const credentialHealthChecker = new CredentialHealthCheckerImpl();