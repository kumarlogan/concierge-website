// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Controlled AGS Launch Workflow (EPIC-007)     │
// │                                                               │
// │ The single, governed execution path that takes AGS from a      │
// │ GitHub release to a live, verified deployment on agsynergy.ca. │
// │                                                               │
// │ Staging and production flow through ONE function so the        │
// │ governance asymmetry is explicit and auditable:                │
// │   • staging  → allowed, no human approval, routine RLSE        │
// │   • production → blocked unless a durable ApprovalRef +         │
// │     authorized approver + AGS-owned domain + semantic release   │
// │     tag + change-freeze guard + live secret validity ALL hold.  │
// │                                                               │
// │ Fail-closed: any guard throw aborts before any provider call    │
// │ and is recorded as a denied ledger entry + audit event.        │
// └─────────────────────────────────────────────────────────────┘

import type { ApprovalRef } from "../../provider-framework.js";
import { emitAudit } from "../../../../audit/event.js";
import { deploymentLedger, type DeployEnv, type DeploymentResult } from "./ledger.js";
import {
  createSiteIdentity,
  validateSiteIdentity,
  type SiteIdentity,
} from "./site-identity.js";
import {
  requireEnvironment,
  requireTenant,
  requireProdApproval,
  requireProdApproverAuthority,
  requireDomainOwnership,
  requireGithubReleaseTag,
  enforceProdChangeFreezeGuard,
  checkSecretExpiry,
  LaunchError,
} from "./guardrails.js";
import { createRlseExecutor, type RlseExecutor } from "./rlse.js";

export interface LaunchDeps {
  /** RLS executor (readiness + live smoke + rollback capability). */
  rlse: RlseExecutor;
  /** Provider dispatch: pushes to GitHub and deploys to Cloudflare. */
  dispatch: {
    pullGitHubRelease(ref: string): Promise<{ ok: boolean; error?: string; data?: unknown }>;
    pushToGitHub(ref: string): Promise<{ ok: boolean; error?: string; data?: unknown }>;
    deployToCloudflare(reference: string, env: DeployEnv): Promise<{ ok: boolean; error?: string; data?: unknown }>;
  };
  /** Resolve the timestamp of the last successful production deployment. */
  lastProdSuccessAt: () => string | null;
}

export interface LaunchRequest {
  tenant: string;
  requester: string;
  approver?: string;
  reference: string; // git sha / release tag
  environment: DeployEnv;
  approvalRef?: ApprovalRef;
  /** Idempotency key — same intent never double-executes. */
  idempotencyKey?: string;
  /** Treat as a dry-run only (produce the plan, execute nothing). */
  dryRun?: boolean;
}

export interface LaunchOutcome {
  deploymentId: string;
  environment: DeployEnv;
  tenant: string;
  reference: string;
  result: DeploymentResult;
  idempotencyKey?: string;
  deduplicated?: boolean;
  ready: { github: boolean; cloudflare: boolean };
  live?: boolean;
  canRollback: boolean;
  lastDeploymentId?: string;
  lastReference?: string;
  error?: string;
  auditReference?: string;
}

function genDeploymentId(env: DeployEnv): string {
  return `dep_${env}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function mintAuditRef(): string {
  return `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Execute the controlled launch. Staging is routine; production is gated.
 * Returns an outcome object; never throws across the boundary (callers get a
 * structured { result: "denied" | "failed", error }).
 */
export async function runLaunch(
  req: LaunchRequest,
  deps: LaunchDeps,
): Promise<LaunchOutcome> {
  const deploymentId = genDeploymentId(req.environment);
  const base = {
    deploymentId,
    environment: req.environment,
    tenant: req.tenant,
    reference: req.reference,
    idempotencyKey: req.idempotencyKey,
  };

  // ── 1. Pre-flight governance (fail-closed) ──
  let auditReference = "";
  try {
    requireTenant(req.tenant);
    const approval: ApprovalRef | undefined = requireProdApproval(req.environment, req.approvalRef);
    requireProdApproverAuthority(req.environment, req.approver ?? req.requester);
    const site: SiteIdentity = createSiteIdentity({
      environment: req.environment,
      ...(req.environment === "production" ? { approvalRef: approval } : {}),
    });
    validateSiteIdentity(site);
    requireDomainOwnership(req.environment, site);
    requireGithubReleaseTag(req.environment, req.reference);
    enforceProdChangeFreezeGuard(req.environment, deps.lastProdSuccessAt());
    checkSecretExpiry(req.environment);
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    auditReference = mintAuditRef();
    // Record the denial in the ledger (idempotency-safe) + audit.
    const rec = deploymentLedger.recordDeployment(req.idempotencyKey, {
      ...base,
      requester: req.requester,
      approver: req.approver,
      provider: "ags-controlled",
      capability: req.environment === "production" ? "launch.production" : "launch.staging",
      result: "denied",
      approvalRef: req.approvalRef,
      auditReference,
    });
    emitAudit("ags.launch.denied", req.requester, {
      deploymentId,
      environment: req.environment,
      reason: e.message,
      code: e instanceof LaunchError ? e.code : "GOVERNANCE",
      auditReference,
    });
    return { ...base, result: "denied", error: e.message, ready: { github: false, cloudflare: false }, canRollback: false, auditReference };
  }
  // ── 2. Idempotency (never double-execute the same intent) ──
  if (req.idempotencyKey) {
    const prior = deploymentLedger.findByIdempotencyKey(req.tenant, req.idempotencyKey);
    if (prior) {
      const auditReference = mintAuditRef();
      emitAudit("ags.launch.replay-denied", req.requester, {
        deploymentId,
        priorId: prior.deploymentId,
        reason: "duplicate idempotencyKey — intent already executed",
        auditReference,
      });
      return {
        ...base,
        result: "denied",
        deduplicated: true,
        error: "Duplicate idempotencyKey: this launch intent was already executed",
        ready: { github: false, cloudflare: false },
        canRollback: false,
        auditReference,
      };
    }
  }

  // ── 3. RLSE: readiness + live smoke + rollback capability ──
  const readiness = await deps.rlse.readiness();
  const smoke = await deps.rlse.smoke();
  const rb = deps.rlse.rollbackCapable(req.environment);
  auditReference = mintAuditRef();

  // Production requires a verified rollback target BEFORE any deploy. This is
  // the fail-closed safety net: you may only ship to prod if you can undo it.
  if (req.environment === "production" && !rb.canRollback) {
    const err = "Production launch requires a verified rollback target (no prior successful deployment)";
    deploymentLedger.recordDeployment(req.idempotencyKey, {
      ...base,
      requester: req.requester,
      approver: req.approver,
      provider: "ags-controlled",
      capability: "launch.production",
      result: "denied",
      approvalRef: req.approvalRef,
      auditReference,
    });
    emitAudit("ags.launch.denied", req.requester, { deploymentId, environment: req.environment, reason: err, code: "NO_ROLLBACK_TARGET", auditReference });
    return { ...base, result: "denied", error: err, ready: { github: readiness.github.ok, cloudflare: readiness.cloudflare.ok }, canRollback: false, auditReference };
  }

  // ── 4. Dry-run: record the plan, execute nothing ──
  if (req.dryRun) {
    deploymentLedger.recordDeployment(req.idempotencyKey, {
      ...base,
      requester: req.requester,
      approver: req.approver,
      provider: "ags-controlled",
      capability: req.environment === "production" ? "launch.production" : "launch.staging",
      result: "dry-run",
      approvalRef: req.approvalRef,
      auditReference,
    });
    emitAudit("ags.launch.dry-run", req.requester, { deploymentId, environment: req.environment, reference: req.reference, auditReference });
    return {
      ...base,
      result: "dry-run",
      ready: { github: readiness.github.ok, cloudflare: readiness.cloudflare.ok },
      live: smoke.live,
      canRollback: rb.canRollback,
      auditReference,
      ...(rb.canRollback ? { lastDeploymentId: rb.lastDeploymentId, lastReference: rb.lastReference } : {}),
    };
  }

  if (!readiness.allReady) {
    const err = "Providers not ready (credentials missing or unreachable)";
    deploymentLedger.recordDeployment(req.idempotencyKey, {
      ...base,
      requester: req.requester,
      approver: req.approver,
      provider: "ags-controlled",
      capability: req.environment === "production" ? "launch.production" : "launch.staging",
      result: "failed",
      approvalRef: req.approvalRef,
      auditReference,
    });
    emitAudit("ags.launch.failed", req.requester, { deploymentId, reason: err, auditReference });
    return {
      ...base,
      result: "failed",
      error: err,
      ready: { github: readiness.github.ok, cloudflare: readiness.cloudflare.ok },
      live: smoke.live,
      canRollback: rb.canRollback,
      auditReference,
    };
  }

  // ── 5. Execute the launch (pull → push → deploy) ──
  const rec = deploymentLedger.recordDeployment(req.idempotencyKey, {
    ...base,
    requester: req.requester,
    approver: req.approver,
    provider: "ags-controlled",
    capability: req.environment === "production" ? "launch.production" : "launch.staging",
    result: "planned",
    approvalRef: req.approvalRef,
    auditReference,
  });
  emitAudit("ags.launch.started", req.requester, { deploymentId, environment: req.environment, reference: req.reference, auditReference });

  try {
    const pull = await deps.dispatch.pullGitHubRelease(req.reference);
    if (!pull.ok) throw new Error(pull.error ?? "GitHub release pull failed");
    const push = await deps.dispatch.pushToGitHub(req.reference);
    if (!push.ok) throw new Error(push.error ?? "GitHub push failed");
    const deploy = await deps.dispatch.deployToCloudflare(req.reference, req.environment);
    if (!deploy.ok) throw new Error(deploy.error ?? "Cloudflare deploy failed");

    // Post-flight live verification
    const post = await deps.rlse.smoke();
    deploymentLedger.markResult(req.tenant, deploymentId, "success");
    emitAudit("ags.launch.success", req.requester, {
      deploymentId,
      environment: req.environment,
      reference: req.reference,
      auditReference: rec.entry.auditReference,
    });
    return {
      ...base,
      result: "success",
      ready: { github: readiness.github.ok, cloudflare: readiness.cloudflare.ok },
      live: post.live,
      canRollback: true,
      lastDeploymentId: deploymentId,
      lastReference: req.reference,
      auditReference: rec.entry.auditReference,
    };
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    deploymentLedger.markResult(req.tenant, deploymentId, "failed");
    emitAudit("ags.launch.failed", req.requester, { deploymentId, environment: req.environment, error: e.message, auditReference });
    return {
      ...base,
      result: "failed",
      error: e.message,
      ready: { github: readiness.github.ok, cloudflare: readiness.cloudflare.ok },
      live: smoke.live,
      canRollback: rb.canRollback,
      auditReference,
      ...(rb.canRollback ? { lastDeploymentId: rb.lastDeploymentId, lastReference: rb.lastReference } : {}),
    };
  }
}
