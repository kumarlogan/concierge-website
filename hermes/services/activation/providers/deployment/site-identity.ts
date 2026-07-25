// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — AGS Site Identity + Live Probes (EPIC-007)    │
// │                                                               │
// │ Binds a deployment to the AGS-owned external surface: the site │
// │ identity (tenant + domain agsynergy.ca) and live readiness      │
// │ probes (DNS resolution, TLS validity, HTTP smoke). These are    │
// │ the "is the thing we are about to launch actually ours and      │
// │ actually reachable" checks that sit OUTSIDE provider execution  │
// │ and OUTSIDE approvals — pure, fail-closed reality checks.       │
// └─────────────────────────────────────────────────────────────┘

import type { ApprovalRef } from "../../provider-framework.js";
import type { DeployEnv } from "./ledger.js";

export const AGS_TENANT = "ags-fertility";
export const AGS_DOMAIN = "agsynergy.ca";
export const AGS_SITE_URL = "https://agsynergy.ca";

/** The canonical AGS site identity. Tenant + domain are FIXED by policy. */
export const AGS_SITE_IDENTITY = {
  tenant: AGS_TENANT,
  domain: AGS_DOMAIN,
  siteUrl: AGS_SITE_URL,
} as const;

export interface SiteIdentity {
  tenant: string;
  domain: string;
  siteUrl: string;
  environment: DeployEnv;
  /** Required for production launches. */
  approvalRef?: ApprovalRef;
}

export class SiteIdentityError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "SiteIdentityError";
  }
}

/** Build a site identity for the AGS tenant. */
export function createSiteIdentity(over: Partial<SiteIdentity> = {}): SiteIdentity {
  return {
    tenant: AGS_TENANT,
    domain: AGS_DOMAIN,
    siteUrl: AGS_SITE_URL,
    environment: "staging",
    ...over,
  };
}

/**
 * Fail-closed validation of an AGS site identity.
 *  • tenant MUST be ags-fertility (no cross-tenant site)
 *  • domain MUST be agsynergy.ca (no foreign domain)
 *  • environment MUST be a known deploy env
 *  • production MUST carry a valid, unexpired ApprovalRef
 */
export function validateSiteIdentity(id: SiteIdentity): SiteIdentity {
  if (id.tenant !== AGS_TENANT) {
    throw new SiteIdentityError(
      `Site identity tenant "${id.tenant}" is not the AGS tenant`,
      "SITE_TENANT_DENIED",
    );
  }
  if (id.domain !== AGS_DOMAIN) {
    throw new SiteIdentityError(
      `Site identity domain "${id.domain}" is not ${AGS_DOMAIN}`,
      "SITE_DOMAIN_MISMATCH",
    );
  }
  if (!["development", "staging", "production"].includes(id.environment)) {
    throw new SiteIdentityError(
      `Site identity environment "${id.environment}" is invalid`,
      "SITE_ENV_INVALID",
    );
  }
  if (id.environment === "production") {
    if (!id.approvalRef || !id.approvalRef.id) {
      throw new SiteIdentityError(
        "Production launch requires a valid ApprovalRef",
        "SITE_PROD_NO_APPROVAL",
      );
    }
    const expires = id.approvalRef.expiresAt;
    if (expires && new Date(expires).getTime() < Date.now()) {
      throw new SiteIdentityError(
        `Production ApprovalRef expired at ${expires}`,
        "SITE_PROD_APPROVAL_EXPIRED",
      );
    }
  }
  return id;
}

// ── Live readiness probes (real network; fail-closed on any failure) ──

export interface ProbeResult {
  ok: boolean;
  status?: number;
  dnsOk: boolean;
  tlsOk: boolean;
  latencyMs?: number;
  error?: string;
}

/**
 * Probe the live site: DNS resolution + TLS validity + HTTP status.
 * Uses the runtime fetch with a timeout. Any failure → ok:false (never
 * fabricates reachability).
 */
export async function probeSite(siteUrl: string = AGS_SITE_URL, timeoutMs = 8000): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(siteUrl, {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
    });
    const latencyMs = Date.now() - start;
    // TLS is implicitly valid if an https fetch completed without a cert error.
    const tlsOk = siteUrl.startsWith("https://");
    return {
      ok: res.status >= 200 && res.status < 500,
      status: res.status,
      dnsOk: true,
      tlsOk,
      latencyMs,
    };
  } catch (err) {
    return {
      ok: false,
      dnsOk: false,
      tlsOk: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * DNS + TLS are inferred by `probeSite` (an https fetch that completes implies
 * both resolution and a valid certificate). Kept as a single portable probe so
 * the executor needs no Node-specific imports and remains edge-runtime safe.
 */
