// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Production Governance Guardrails (EPIC-007)   │
// │                                                               │
// │ The fail-closed gate set that distinguishes a STAGING launch   │
// │ (allowed, routine) from a PRODUCTION launch (gated by human    │
// │ approval, approver authority, domain ownership, a GitHub       │
// │ release tag, a change-freeze guard, and live secret validity). │
// │ Every guard THROWS LaunchError on violation — no silent allow. │
// │ These guards are Hermes-owned policy; providers/backends never │
// │ decide these things.                                          │
// └─────────────────────────────────────────────────────────────┘

import type { ApprovalRef } from "../../provider-framework.js";
import { resolveSecret } from "../secret-source.js";
import { AGS_TENANT, AGS_DOMAIN, type SiteIdentity } from "./site-identity.js";
import type { DeployEnv } from "./ledger.js";

/** Principals authorized to grant a production launch approval. */
export const PROD_APPROVERS = ["lead@ags", "admin@ags"] as const;

/**
 * Change-freeze guard: a production launch is refused if a production deploy
 * already succeeded within this window (prevents rapid uncontrolled prod
 * churn). Operators widen/narrow this per policy; 24h is the safe default.
 */
export const PROD_CHANGE_FREEZE_GUARD_HOURS = 24;

/** Production launches MUST reference a semantic GitHub release tag. */
export const REQUIRED_GITHUB_RELEASE_TAG = /^v\d+\.\d+\.\d+$/;

/** Retry policy for the launch executor (bounded; never infinite). */
export const LAUNCH_RETRY_POLICY = { maxAttempts: 3, backoffMs: 1000 } as const;

export class LaunchError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "LaunchError";
  }
}

/** Environment must be a known deploy environment. */
export function requireEnvironment(env: DeployEnv): void {
  if (!["development", "staging", "production"].includes(env)) {
    throw new LaunchError(`Unknown deploy environment: ${env}`, "ENV_INVALID");
  }
}

/** Tenant must be the AGS tenant (no cross-tenant launch). */
export function requireTenant(tenant: string): void {
  if (tenant !== AGS_TENANT) {
    throw new LaunchError(`Tenant "${tenant}" is not authorized for AGS launches`, "TENANT_DENIED");
  }
}

/** Production requires a valid, unexpired ApprovalRef. */
export function requireProdApproval(env: DeployEnv, approvalRef?: ApprovalRef): ApprovalRef {
  if (env !== "production") return approvalRef as ApprovalRef; // unused for non-prod
  if (!approvalRef || !approvalRef.id) {
    throw new LaunchError("Production launch requires a durable ApprovalRef", "PROD_NO_APPROVAL");
  }
  if (approvalRef.expiresAt && new Date(approvalRef.expiresAt).getTime() < Date.now()) {
    throw new LaunchError(`Production ApprovalRef expired at ${approvalRef.expiresAt}`, "APPROVAL_EXPIRED");
  }
  return approvalRef;
}

/** Production approval must come from an authorized approver. */
export function requireProdApproverAuthority(env: DeployEnv, approver: string): void {
  if (env !== "production") return;
  if (!PROD_APPROVERS.includes(approver as (typeof PROD_APPROVERS)[number])) {
    throw new LaunchError(
      `Approver "${approver}" is not authorized for production launches`,
      "PROD_APPROVER_UNAUTHORIZED",
    );
  }
}

/** The site identity must be the AGS-owned domain (no foreign domain prod). */
export function requireDomainOwnership(env: DeployEnv, site: SiteIdentity): void {
  if (env !== "production") return;
  if (site.tenant !== AGS_TENANT || site.domain !== AGS_DOMAIN) {
    throw new LaunchError(
      `Production launch domain "${site.domain}" is not the AGS-owned ${AGS_DOMAIN}`,
      "DOMAIN_NOT_OWNED",
    );
  }
}

/** Production must reference a semantic GitHub release tag (immutable ref). */
export function requireGithubReleaseTag(env: DeployEnv, reference: string): void {
  if (env !== "production") return;
  if (!REQUIRED_GITHUB_RELEASE_TAG.test(reference)) {
    throw new LaunchError(
      `Production launch reference "${reference}" is not a semantic release tag (e.g. v1.2.3)`,
      "GITHUB_RELEASE_REQUIRED",
    );
  }
}

/**
 * Change-freeze guard: refuse a production launch if a production deploy
 * already succeeded within PROD_CHANGE_FREEZE_GUARD_HOURS. `lastProdAt` is the
 * ISO timestamp of the most recent successful production deployment (or null).
 */
export function enforceProdChangeFreezeGuard(env: DeployEnv, lastProdAt: string | null, now = Date.now()): void {
  if (env !== "production" || !lastProdAt) return;
  const elapsedMs = now - new Date(lastProdAt).getTime();
  const windowMs = PROD_CHANGE_FREEZE_GUARD_HOURS * 60 * 60 * 1000;
  if (elapsedMs < windowMs) {
    throw new LaunchError(
      `Production change-freeze guard: last prod deploy ${Math.round(elapsedMs / 60000)}m ago (< ${PROD_CHANGE_FREEZE_GUARD_HOURS}h window)`,
      "CHANGE_FREEZE_GUARD",
    );
  }
}

/**
 * Validate the Cloudflare deploy token hasn't expired / been revoked.
 * Accepts the canonical CLOUDFLARE_API_TOKEN, falling back to the legacy
 * CF_API_TOKEN name (EPIC-008.1 · Phase1). Only enforced in production.
 */
export function checkSecretExpiry(env: DeployEnv, secretRef = "CLOUDFLARE_API_TOKEN"): boolean {
  if (env !== "production") return true;
  const token = resolveSecret(secretRef);
  if (!token) {
    throw new LaunchError(
      `Required secret "${secretRef}" is absent from the secret source`,
      "SECRET_EXPIRED",
    );
  }
  return true;
}
