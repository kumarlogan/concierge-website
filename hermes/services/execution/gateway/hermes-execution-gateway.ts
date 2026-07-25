// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution Gateway (SINGLE TRUST BOUNDARY)   │
// │ EPIC-005.6 PHASE 1 · one governed path for every execution    │
// │                                                               │
// │ Collapses the two legacy execution stacks into ONE boundary:  │
// │   Stack A: UniversalCapabilityPlatform.execute (RuntimeGuard) │
// │   Stack B: ExecutionCoordinator.run (PolicyEvaluator+approve)  │
// │                                                               │
// │ The gateway runs, IN ORDER, every required gate:             │
// │   (1) Tenant enforcement        (EPIC-004 / persistence)     │
// │   (2) Policy evaluation         (EPIC-004.6 single decision) │
// │   (3) Structured ApprovalRef    (EPIC-005.6 fail-closed)     │
// │   (4) ProviderRuntimeGuard      (EPIC-005.5 8-dim guard)     │
// │ then dispatches through ONE injected executor.                │
// │                                                               │
// │ Provider-neutral. No Claude/AGS-specific logic. Fail-closed. │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../../contracts/platform-api.js";
import { enforceTenant, TenantViolationError } from "../../../persistence/tenant.js";
import { emitAudit } from "../../../audit/event.js";
import { ExecutionPolicyEvaluator } from "../policy-evaluator.js";
import type {
  PolicyEvaluatorDeps,
  ExecutionPolicyRequest,
} from "../policy-evaluator.js";
import {
  ProviderRuntimeGuard,
  type GuardContext,
} from "../../providers/runtime/index.js";
import type { ProviderManifestV2 } from "../../providers/manifest-v2.js";
import type { TrustRecord } from "../../providers/trust/lifecycle.js";
import type { TransportRegistry } from "../../providers/transport.js";
import type { CapabilityRegistry } from "../../providers/capability.js";
import type { ProviderRequest, ProviderOutcome } from "../../providers/sdk.js";
import {
  type ApprovalRef,
  type ApprovalService,
} from "./approval.js";

// ── Inputs ────────────────────────────────────────────────────────────────

/** Everything required to make ONE governed execution decision. */
export interface GatewayRequest {
  /** Stable execution id (minted by the caller). */
  executionId: string;
  /** Owning tenant id. */
  tenantId: string;
  /** Requesting principal. */
  principal: Principal;
  /** Capability to execute (must exist in the registry). */
  capabilityId: string;
  /** Resolved provider/backend id (must be a known provider). */
  providerId: string;
  /** The normalized provider request handed to the executor + guard. */
  providerRequest: ProviderRequest;
  /** Whether the capability requires a verified durable approval. */
  approvalRequired: boolean;
  /**
   * Structured, verified approval reference. REQUIRED when approvalRequired
   * is true. The gateway verifies it (fail-closed) before dispatch.
   */
  approvalRef?: ApprovalRef;
  /** Current durable lifecycle state of the execution (runnable gate). */
  lifecycleState: "approved" | "running";
  /** Optional workflow id for audit correlation. */
  workflowId?: string;
  /** Free-form risk signals for audit. */
  riskContext?: Record<string, unknown>;
}

/** Injectable provider-side context for the Runtime Guard. */
export interface GatewayProviderContext {
  manifest: ProviderManifestV2;
  trust: TrustRecord | undefined;
  transports: TransportRegistry;
  capabilities: CapabilityRegistry;
}

/** The executor — the ONLY thing that actually runs the capability. */
export type GatewayExecutor = (
  capabilityId: string,
  providerRequest: ProviderRequest,
) => Promise<ProviderOutcome>;

// ── Outputs ────────────────────────────────────────────────────────────────

export type GatewayDenialCode =
  | "tenant-violation"
  | "policy-denied"
  | "approval-missing"
  | "approval-rejected"
  | "runtime-guard-denied"
  | "executor-failed";

export interface GatewayDenied {
  ok: false;
  code: GatewayDenialCode;
  reason: string;
  /** Machine-readable sub-category when from the policy evaluator. */
  category?: string;
  /** Violation class when from the runtime guard. */
  violationClass?: string;
  audit: Record<string, unknown>;
}

export interface GatewayAllowed {
  ok: true;
  /** The executor's raw outcome (already normalized by the provider). */
  outcome: ProviderOutcome;
  audit: Record<string, unknown>;
}

export type GatewayResult = GatewayDenied | GatewayAllowed;

// ── Dependencies ──────────────────────────────────────────────────────────

export interface HermesExecutionGatewayDeps {
  /** Policy evaluator (EPIC-004.6). */
  policy: ExecutionPolicyEvaluator | PolicyEvaluatorDeps;
  /** Runtime guard (EPIC-005.5). Defaults to the shared DEFAULT instance. */
  guard?: ProviderRuntimeGuard;
  /** Structured approval verification (EPIC-005.6). */
  approvals: ApprovalService;
  /** Whether a capability requires human approval (gate policy). */
  approvalRequiredFor?: (capabilityId: string) => boolean;
}

/**
 * The single execution trust boundary. Every execution in Hermes — regardless
 * of which legacy stack initiated it — MUST pass through `execute()`. No caller
 * may bypass the guard, the policy evaluator, tenant enforcement, or approval
 * verification. The executor is injected so both legacy stacks route through
 * this one boundary without re-guarding.
 */
export class HermesExecutionGateway {
  private readonly policy: ExecutionPolicyEvaluator;
  private readonly guard: ProviderRuntimeGuard;
  private readonly approvals: ApprovalService;
  private readonly approvalRequiredFor: (capabilityId: string) => boolean;

  constructor(private readonly deps: HermesExecutionGatewayDeps) {
    this.policy =
      deps.policy instanceof ExecutionPolicyEvaluator
        ? deps.policy
        : new ExecutionPolicyEvaluator(deps.policy);
    this.guard = deps.guard ?? ProviderRuntimeGuard.DEFAULT;
    this.approvals = deps.approvals;
    this.approvalRequiredFor = deps.approvalRequiredFor ?? (() => false);
  }

  /**
   * Run ALL gates in order, then dispatch. Fail-closed: any gate failure
   * returns a GatewayDenied (never throws past the boundary). The executor is
   * only ever invoked after every gate passes.
   */
  async execute(
    req: GatewayRequest,
    providerCtx: GatewayProviderContext,
    executor: GatewayExecutor,
  ): Promise<GatewayResult> {
    const auditBase: Record<string, unknown> = {
      executionId: req.executionId,
      tenantId: req.tenantId,
      capabilityId: req.capabilityId,
      providerId: req.providerId,
      principalId: req.principal.id,
      ...(req.workflowId ? { workflowId: req.workflowId } : {}),
      ...(req.riskContext ? { riskContext: req.riskContext } : {}),
    };

    const deny = (
      code: GatewayDenialCode,
      reason: string,
      extra: Record<string, unknown> = {},
    ): GatewayDenied => {
      const audit = { ...auditBase, decision: "deny", code, reason, ...extra };
      emitAudit("execution.gateway.denied", req.principal.id, audit);
      return { ok: false, code, reason, audit };
    };

    // ── (1) TENANT ENFORCEMENT ──────────────────────────────────────────
    // Hard wall: principal must be bound to the execution's tenant. Fail-closed.
    try {
      enforceTenant(req.principal, req.tenantId);
    } catch (err) {
      if (err instanceof TenantViolationError) {
        return deny("tenant-violation", err.message, { category: "denied:tenant-mismatch" });
      }
      throw err;
    }
    // A tenant-protected request's ProviderRequest context MUST carry the
    // principal so the Runtime Guard's tenant-scope check (2/8) can enforce
    // cross-tenant access. Stamp it in if the caller did not.
    if (!req.providerRequest.context?.principal && !req.providerRequest.context?.tenantId) {
      req.providerRequest.context = {
        ...(req.providerRequest.context ?? {}),
        principal: req.principal,
        tenantId: req.tenantId,
        targetTenantId: req.tenantId,
      };
    }

    // ── (2) POLICY EVALUATION (EPIC-004.6 single decision point) ─────────
    const preq: ExecutionPolicyRequest = {
      principal: req.principal,
      tenantId: req.tenantId,
      ...(req.workflowId ? { workflowId: req.workflowId } : {}),
      executionId: req.executionId,
      capabilityId: req.capabilityId,
      providerId: req.providerId,
      approval: req.approvalRef
        ? { approver: req.approvalRef.approver, ...(req.approvalRef.expiresAt ? { expiresAt: req.approvalRef.expiresAt } : {}) }
        : undefined,
      approvalRequired: req.approvalRequired,
      lifecycleState: req.lifecycleState,
      ...(req.riskContext ? { riskContext: req.riskContext } : {}),
    };
    const decision = this.policy.evaluate(preq);
    if (!decision.allowed) {
      return deny("policy-denied", decision.reason, {
        category: decision.category,
        ...decision.audit,
      });
    }

    // ── (3) STRUCTURED APPROVAL VERIFICATION (EPIC-005.6) ────────────────
    // Approval is verified HERE, once, with the structured ApprovalRef. No
    // bare-string matching anywhere in the boundary.
    if (req.approvalRequired) {
      if (!req.approvalRef) {
        return deny(
          "approval-missing",
          `Capability "${req.capabilityId}" requires a structured ApprovalRef; none presented`,
          { category: "denied:missing-approval" },
        );
      }
      try {
        this.approvals.verify(req.approvalRef, {
          capability: req.capabilityId,
          tenant: req.tenantId,
          principal: req.principal,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : "approval verification failed";
        const code = err instanceof Error && "code" in err ? (err as { code: string }).code : "approval-rejected";
        return deny("approval-rejected", reason, { approvalCode: code, category: "denied:missing-approval" });
      }
    }

    // ── (4) PROVIDER RUNTIME GUARD (EPIC-005.5, 8 dimensions) ───────────
    const guardCtx: GuardContext = {
      providerId: req.providerId,
      manifest: providerCtx.manifest,
      trust: providerCtx.trust,
      request: req.providerRequest,
      transports: providerCtx.transports,
      capabilities: providerCtx.capabilities,
      now: () => Date.now(),
    };
    const guardDecision = this.guard.guard(guardCtx);
    if (!guardDecision.allow) {
      return deny("runtime-guard-denied", guardDecision.reason, {
        violationClass: guardDecision.violationClass,
        code: guardDecision.code,
      });
    }

    // ── DISPATCH through the single injected executor ───────────────────
    // Only reached after every gate passed.
    try {
      const outcome = await executor(req.capabilityId, req.providerRequest);
      emitAudit("execution.gateway.allowed", req.principal.id, {
        ...auditBase,
        decision: "allow",
      });
      return { ok: true, outcome, audit: auditBase };
    } catch (err) {
      const reason = err instanceof Error ? err.message : "executor failed";
      return deny("executor-failed", reason, {});
    } finally {
      // Always release the guard's concurrency counter.
      this.guard.release(req.providerId);
    }
  }
}
