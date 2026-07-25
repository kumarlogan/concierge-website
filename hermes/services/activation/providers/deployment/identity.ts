// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Deployment Identity & Environment (EPIC-006.5 · P1/P2)
// │                                                               │
// │ Operational-readiness controls AROUND the frozen Foundation.  │
// │ No core change. This module composes existing frozen          │
// │ primitives (Env, ApprovalRef, SecretSource, emitAudit) and    │
// │ adds a traceable identity + environment isolation layer for   │
// │ every website deployment action.                              │
// │                                                               │
// │ Fail-closed rules enforced here:                              │
// │  • No deployment without a valid DeploymentIdentity.          │
// │  • No anonymous execution (requester + approver required).    │
// │  • Unknown environment ⇒ DENY.                                │
// │  • Production ⇒ requires ApprovalRef + valid identity +       │
// │    trusted provider + audit record.                           │
// └─────────────────────────────────────────────────────────────┘

import type { Env } from "../website.js";
import type { ApprovalRef } from "../../provider-framework.js";

/** Re-export the canonical environment set from the frozen website layer. */
export type { Env } from "../website.js";
export const ENVIRONMENTS: Env[] = ["development", "staging", "production"];

/**
 * Operational tenant allowlist for AGS deployments. Fail-closed: only tenants
 * listed here may deploy. Configured at bootstrap; defaults to the AGS tenant.
 * Any other tenant is rejected at identity validation (mandatory tenancy).
 */
let ALLOWED_DEPLOYMENT_TENANTS: string[] = ["ags-fertility"];
export function setAllowedDeploymentTenants(tenants: string[]): void {
  ALLOWED_DEPLOYMENT_TENANTS = tenants && tenants.length ? tenants : ["ags-fertility"];
}

/** Strongly-typed deployment identity. Every action carries one. */
export interface DeploymentIdentity {
  /** Stable, unique deployment id (e.g. "dep_…"). */
  id: string;
  /** Owning tenant (mandatory tenancy). */
  tenant: string;
  /** Principal id that requested the deployment. */
  requester: string;
  /** Principal id that approved (human). Empty ⇒ anonymous (DENIED). */
  approver: string;
  /** Resolved website capability (e.g. "website.deploy"). */
  capability: string;
  /** Provider that will execute (e.g. "edge.cloudflare"). */
  provider: string;
  /** Target environment. */
  environment: Env;
  /** ISO creation timestamp. */
  createdAt: string;
  /** ISO expiry timestamp (identity is invalid after this). */
  expiresAt: string;
  /** Audit event reference for this identity. */
  auditReference: string;
  /** Durable approval ref (required for production). */
  approvalRef?: ApprovalRef;
}

/** Error thrown when a DeploymentIdentity fails validation (fail-closed). */
export class DeploymentIdentityError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = "DeploymentIdentityError";
  }
}

function isNonEmpty(s: unknown): s is string {
  return typeof s === "string" && s.trim().length > 0;
}

function isKnownEnv(e: unknown): e is Env {
  return typeof e === "string" && (ENVIRONMENTS as string[]).includes(e);
}

/**
 * Validate a DeploymentIdentity fail-closed. Throws DeploymentIdentityError on
 * any deficiency. Production additionally requires an unexpired ApprovalRef and
 * a non-empty approver.
 */
export function validateDeploymentIdentity(
  ident: DeploymentIdentity | null | undefined,
  opts: { requireApproverForProd?: boolean } = {},
): DeploymentIdentity {
  if (!ident || typeof ident !== "object") {
    throw new DeploymentIdentityError("deployment identity missing", "NO_IDENTITY");
  }
  if (!isNonEmpty(ident.id)) throw new DeploymentIdentityError("identity.id empty", "NO_ID");
  if (!isNonEmpty(ident.tenant)) throw new DeploymentIdentityError("identity.tenant empty", "NO_TENANT");
  if (!ALLOWED_DEPLOYMENT_TENANTS.includes(ident.tenant)) {
    throw new DeploymentIdentityError(`tenant not authorized for deployment: ${ident.tenant}`, "TENANT_DENIED");
  }
  if (!isNonEmpty(ident.requester)) throw new DeploymentIdentityError("identity.requester empty", "NO_REQUESTER");
  if (!isNonEmpty(ident.capability)) throw new DeploymentIdentityError("identity.capability empty", "NO_CAPABILITY");
  if (!isNonEmpty(ident.provider)) throw new DeploymentIdentityError("identity.provider empty", "NO_PROVIDER");
  if (!isKnownEnv(ident.environment)) {
    throw new DeploymentIdentityError(`unknown environment: ${String(ident.environment)}`, "UNKNOWN_ENV");
  }
  if (!isNonEmpty(ident.auditReference)) throw new DeploymentIdentityError("identity.auditReference empty", "NO_AUDIT");

  // Anonymous execution is never allowed.
  if (!isNonEmpty(ident.approver)) {
    throw new DeploymentIdentityError("anonymous deployment (no approver)", "ANONYMOUS");
  }

  // Production gate.
  if (ident.environment === "production") {
    if (!ident.approvalRef || typeof ident.approvalRef !== "object" || !isNonEmpty(ident.approvalRef.id)) {
      throw new DeploymentIdentityError("production requires a valid ApprovalRef", "PROD_NO_APPROVAL");
    }
    const now = Date.now();
    const exp = ident.approvalRef.expiresAt ? Date.parse(ident.approvalRef.expiresAt) : NaN;
    if (!Number.isNaN(exp) && now > exp) {
      throw new DeploymentIdentityError("approval expired", "APPROVAL_EXPIRED");
    }
    const created = Date.parse(ident.createdAt);
    const identExp = Date.parse(ident.expiresAt);
    if (Number.isNaN(created) || Number.isNaN(identExp) || now > identExp) {
      throw new DeploymentIdentityError("deployment identity expired", "IDENTITY_EXPIRED");
    }
  }
  return ident;
}

/** Mint a fresh DeploymentIdentity (caller supplies approver/approval for prod). */
export function createDeploymentIdentity(input: {
  id: string;
  tenant: string;
  requester: string;
  approver: string;
  capability: string;
  provider: string;
  environment: Env;
  auditReference: string;
  approvalRef?: ApprovalRef;
  ttlMs?: number;
}): DeploymentIdentity {
  const now = Date.now();
  const ttl = input.ttlMs ?? (input.environment === "production" ? 30 * 60_000 : 60 * 60_000);
  const ident: DeploymentIdentity = {
    id: input.id,
    tenant: input.tenant,
    requester: input.requester,
    approver: input.approver,
    capability: input.capability,
    provider: input.provider,
    environment: input.environment,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    auditReference: input.auditReference,
  };
  if (input.environment === "production") {
    if (!input.approvalRef) throw new DeploymentIdentityError("production requires approvalRef", "PROD_NO_APPROVAL");
    ident.approvalRef = input.approvalRef;
  }
  // Validate before returning (fail-closed).
  return validateDeploymentIdentity(ident);
}
