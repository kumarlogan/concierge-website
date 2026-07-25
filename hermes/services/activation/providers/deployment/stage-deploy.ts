// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Controlled Staging Deploy Wrapper (EPIC-008.1 · P2) │
// │                                                               │
// │ Single, audited orchestration entrypoint that COMPOSES the    │
// │ frozen primitives (runStagingWorkflow for the plan + agsLaunch│
// │ for the gated execution) instead of duplicating their logic.  │
// │                                                               │
// │ This resolves the D1 defect: workflow.ts previously called a  │
// │ non-existent ledger method (recordFromIdentity) and re-implemented │
// │ launch logic that already lived in launch.ts. Now both paths  │
// │ share one source of truth — launch.ts owns execution,         │
// │ workflow.ts owns the validated plan, and this wrapper wires    │
// │ them together.                                                │
// │                                                               │
// │ NO production execution without explicit approval + the frozen │
// │ gateway. Fail-closed at every step.                           │
// └─────────────────────────────────────────────────────────────┘

import { runStagingWorkflow, type StagingWorkflowRequest, type StagingWorkflowPlan } from "./workflow.js";
import { runLaunch, type LaunchRequest, type LaunchOutcome } from "./launch.js";

export interface StagingDeployRequest {
  tenant: string;
  requester: string;
  approver: string;
  capability: string;
  provider: string;
  environment: "development" | "staging" | "production";
  args: Record<string, unknown>;
  /** Pre-granted approval ref (required for production). */
  approvalRef?: StagingWorkflowRequest["approvalRef"];
  /** Operator-owned creds already resolved into readiness executors. */
  readiness?: StagingWorkflowRequest["readiness"];
}

export interface StagingDeployResult {
  plan: StagingWorkflowPlan;
  /** Present only when the operator explicitly requests execution AND it is
   *  not production (production always requires the frozen gateway). */
  launch?: LaunchOutcome;
  executed: boolean;
}

/**
 * Build the validated, audited plan via the single workflow entrypoint.
 * Never executes — returns the plan for human sign-off (matches the frozen
 * workflow contract). To execute, an operator calls `executeStagingDeploy`
 * with an explicit go-ahead, or routes production through the frozen gateway.
 */
export async function planStagingDeploy(req: StagingDeployRequest): Promise<StagingDeployResult> {
  const plan = await runStagingWorkflow({
    tenant: req.tenant,
    requester: req.requester,
    approver: req.approver,
    capability: req.capability,
    provider: req.provider,
    environment: req.environment,
    args: req.args,
    approvalRef: req.approvalRef,
    readiness: req.readiness,
  });
  return { plan, executed: false };
}

/**
 * Execute a staging (non-production) deploy through the shared agsLaunch path.
 * Production is intentionally NOT accepted here — it must go through the frozen
 * gateway (executeWithProductionApproval) so the gated-approval boundary holds.
 */
export async function executeStagingDeploy(
  req: StagingDeployRequest,
  deps: Parameters<typeof runLaunch>[1],
): Promise<StagingDeployResult> {
  if (req.environment === "production") {
    throw new Error("production execution is refused here; route through the frozen gateway");
  }
  const plan = await runStagingWorkflow({
    tenant: req.tenant,
    requester: req.requester,
    approver: req.approver,
    capability: req.capability,
    provider: req.provider,
    environment: req.environment,
    args: req.args,
    approvalRef: req.approvalRef,
    readiness: req.readiness,
  });
  const launchReq: LaunchRequest = {
    tenant: req.tenant,
    requester: req.requester,
    approver: req.approver,
    reference: String(req.args.reference ?? req.args.branch ?? req.capability ?? "n/a"),
    environment: req.environment,
    approvalRef: req.approvalRef,
    idempotencyKey: `stage:${req.tenant}:${req.capability}:${Date.now()}`,
  };
  const launch = await runLaunch(launchReq, deps);
  return { plan, launch, executed: launch.result === "success" };
}
