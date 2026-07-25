// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Staging Deployment Workflow (EPIC-006.5 · P6) │
// │                                                               │
// │ Dry-run VALIDATED workflow. It composes the frozen primitives  │
// │ into a controlled, audited path:                              │
// │                                                               │
// │   Request → Tenant validation → Policy check → ApprovalRef    │
// │   validation → Runtime Guard → DeploymentIdentity creation →  │
// │   Provider readiness check → Audit event                      │
// │                                                               │
// │ NO production execution. For production it builds the identity │
// │ + readiness plan and returns it for human sign-off; it never   │
// │ calls the executor. Fail-closed at every step.                 │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../../../audit/event.js";
import { grantStackBApproval, executeCapability } from "../../provider-framework.js";
import type { ApprovalRef } from "../../provider-framework.js";
import {
  createDeploymentIdentity,
  validateDeploymentIdentity,
  type DeploymentIdentity,
  type Env,
} from "./identity.js";
import { createGitHubReadinessExecutor, createCloudflareReadinessExecutor, type ReadinessExecutor } from "./executors.js";
import { deploymentLedger } from "./ledger.js";

export interface StagingWorkflowRequest {
  tenant: string;
  requester: string;
  approver: string;
  capability: string;
  provider: string;
  environment: Env;
  args: Record<string, unknown>;
  /** Pre-granted approval ref (for production). */
  approvalRef?: ApprovalRef;
  /** Operator-owned creds already resolved into readiness executors. */
  readiness?: { github?: ReadinessExecutor; cloudflare?: ReadinessExecutor };
}

export interface StagingWorkflowPlan {
  identity: DeploymentIdentity;
  /** Readiness check result (connectivity only). */
  readiness: { provider: string; ok: boolean; state: string; checks: unknown[] };
  /** Whether this plan is execution-ready (prod still requires human sign-off). */
  executionReady: boolean;
  /** Whether the workflow actually EXECUTED (always false here — dry-run path). */
  executed: false;
  auditReference: string;
}

/**
 * Execute the controlled staging/deploy workflow. This is the single, audited
 * orchestration entrypoint. It NEVER performs a production deployment — for
 * production it returns a validated plan that an operator must approve + run
 * via the frozen gateway (executeWithProductionApproval from EPIC-006).
 */
export async function runStagingWorkflow(
  req: StagingWorkflowRequest,
): Promise<StagingWorkflowPlan> {
  const auditRef = `audit:${req.tenant}:${req.capability}:${Date.now()}`;

  // 1. Tenant validation (mandatory tenancy).
  if (!req.tenant || req.tenant.length === 0) {
    emitAudit("deployment.denied", req.requester, { reason: "no tenant" });
    throw new Error("tenant required");
  }

  // 2. Policy check + ApprovalRef validation (production).
  let approvalRef = req.approvalRef;
  if (req.environment === "production") {
    if (!approvalRef) {
      // Mint a durable approval ref via the frozen approval primitive. This is
      // the ONLY way to get one; it requires a real human grant upstream.
      approvalRef = await grantStackBApproval(req.approver, req.tenant, req.capability, "production");
    }
    validateDeploymentIdentity({
      id: `dep_${Date.now()}`,
      tenant: req.tenant,
      requester: req.requester,
      approver: req.approver,
      capability: req.capability,
      provider: req.provider,
      environment: req.environment,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      auditReference: auditRef,
      approvalRef,
    });
  }

  // 3. Runtime Guard — build + validate identity (fail-closed).
  const identity = createDeploymentIdentity({
    id: `dep_${Date.now()}`,
    tenant: req.tenant,
    requester: req.requester,
    approver: req.approver,
    capability: req.capability,
    provider: req.provider,
    environment: req.environment,
    auditReference: auditRef,
    approvalRef,
  });

  // 4. Provider readiness check (connectivity only — no deploy).
  const executor =
    req.provider === "vcs.github"
      ? req.readiness?.github ?? createGitHubReadinessExecutor(String(req.args.repo ?? ""), String(req.args.branch ?? "main"))
      : req.readiness?.cloudflare ?? createCloudflareReadinessExecutor(String(req.args.account ?? ""), String(req.args.project ?? ""));
  const readiness = await executor.check(req.args);

  // 5. Audit event (mandatory).
  emitAudit("deployment.workflow.plan", req.requester, {
    deploymentId: identity.id,
    tenant: req.tenant,
    provider: req.provider,
    environment: req.environment,
    capability: req.capability,
    readinessState: readiness.state,
    auditRef,
  });

  // 6. Record into ledger (dry-run; no execution). Uses the real ledger API
  //    (recordDeployment) — never recordFromIdentity, which does not exist
  //    (D1 defect, EPIC-008.1). idempotencyKey omitted in the plan path.
  deploymentLedger.recordDeployment(undefined, {
    deploymentId: identity.id,
    tenant: req.tenant,
    requester: req.requester,
    approver: req.approver,
    provider: req.provider,
    environment: req.environment,
    capability: req.capability,
    reference: String(req.args.reference ?? req.args.branch ?? req.args.project ?? "n/a"),
    result: "dry-run",
    auditReference: auditRef,
    approvalRef: req.approvalRef,
  });

  // Execution is deferred to the operator (especially for production).
  return {
    identity,
    readiness: {
      provider: readiness.provider,
      ok: readiness.ok,
      state: readiness.state,
      checks: readiness.checks,
    },
    executionReady: readiness.ok,
    executed: false,
    auditReference: auditRef,
  };
}
