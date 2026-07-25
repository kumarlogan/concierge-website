// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution Policy Evaluator                  │
// │ EPIC-004.6 PHASE 1 · the SINGLE execution authorization        │
// │ decision point. Provider-neutral. No policy bypasses.         │
// │                                                            \
// │  Request ─▶ Tenant ─▶ Capability ─▶ Policy ─▶ Approval ─▶     │
// │  ExecutionStore ─▶ Provider ─▶ Audit                         │
// │                                                            \
// │ Every execution MUST pass through evaluate() before it runs.  │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../contracts/platform-api.js";
import { enforceTenant, TenantViolationError } from "../../persistence/tenant.js";
import type { ExecutionStore, ExecutionState } from "../../persistence/execution-store.js";
import type { CapabilityRegistry } from "../providers/capability.js";

// ── Decision categorization (auditable, machine-readable) ───────

export type PolicyDecisionCategory =
  | "allowed"
  | "denied:missing-tenant"
  | "denied:missing-principal"
  | "denied:missing-capability"
  | "denied:missing-approval"
  | "denied:expired-approval"
  | "denied:invalid-lifecycle"
  | "denied:unknown-provider"
  | "denied:unknown-capability"
  | "denied:tenant-mismatch"
  | "denied:unknown-principal";

// ── Input: everything needed to make ONE authorization decision ─

export interface ExecutionPolicyRequest {
  /** Requesting principal (caller identity). */
  principal: Principal;
  /** Owning tenant id. */
  tenantId: string;
  /** Workflow this execution belongs to (optional). */
  workflowId?: string;
  /** Execution id (already minted by the caller). */
  executionId: string;
  /** Capability to execute (must exist in the registry). */
  capabilityId: string;
  /** Resolved provider/backend id (must be known). */
  providerId: string;
  /**
   * Current durable approval state for this execution, if any.
   * `undefined` → no approval recorded yet.
   */
  approval?: {
    approver: string;
    expiresAt?: string;
  };
  /**
   * Whether the capability requires human approval before execution.
   * Derived by the caller from the capability registry / gate policy.
   */
  approvalRequired: boolean;
  /**
   * Current lifecycle state of the execution (from the store).
   * Used to confirm the execution is in a runnable state.
   */
  lifecycleState: ExecutionState;
  /** Risk context — free-form signals for audit (e.g. env, scope). */
  riskContext?: Record<string, unknown>;
}

// ── Output: a provable, auditable decision ──────────────────────

export interface ExecutionPolicyDecision {
  allowed: boolean;
  /** Human-readable reason (also the audit "why"). */
  reason: string;
  /** Machine-readable category (drives audit indexing + dashboards). */
  category: PolicyDecisionCategory;
  /** Audit metadata emitted alongside the decision. */
  audit: Record<string, unknown>;
}

// ── Dependencies the evaluator needs (injected, never hardcoded) ─

export interface PolicyEvaluatorDeps {
  /** Capability registry — source of truth for "what can run". */
  capabilities: CapabilityRegistry;
  /** Known provider ids (the set of providers Hermes trusts to execute). */
  knownProviders?: () => string[];
  /**
   * Approver verifier (fail-closed). Default: known non-empty principal.
   * Mirrors ExecutionCoordinator's ApproverVerifier.
   */
  verifyApprover?: (approver: string) => boolean;
  /** Returns "now" — injectable for deterministic tests. */
  now?: () => number;
}

/** Thrown only on internal misconfiguration (not on a policy DENY). */
export class PolicyEvaluationError extends Error {}

/**
 * The single, mandatory execution authorization decision point.
 *
 * RULE: DENY (never bypass) when any of:
 *  - missing tenant
 *  - missing principal
 *  - missing capability
 *  - missing approval when required
 *  - expired approval
 *  - invalid lifecycle state (not runnable)
 *  - unknown provider
 *  - tenant mismatch (principal not bound to tenantId)
 *  - unknown principal (unbound / no org)
 */
export class ExecutionPolicyEvaluator {
  private readonly capabilities: CapabilityRegistry;
  private readonly knownProviders: () => string[];
  private readonly verifyApprover: (approver: string) => boolean;
  private readonly now: () => number;

  constructor(deps: PolicyEvaluatorDeps) {
    this.capabilities = deps.capabilities;
    const knownProviders = deps.knownProviders ?? (() => []);
    this.knownProviders = knownProviders;
    this.verifyApprover = deps.verifyApprover ?? ((a: string) => a.length > 0);
    this.now = deps.now ?? (() => Date.now());
  }

  /** Decide whether the execution described by `req` may proceed. */
  evaluate(req: ExecutionPolicyRequest): ExecutionPolicyDecision {
    // 1. Missing principal identity — guard FIRST so we never dereference a
    //    null principal while building audit metadata.
    if (!req.principal || !req.principal.id) {
      return {
        allowed: false,
        reason: "Execution request has no principal identity",
        category: "denied:missing-principal",
        audit: {
          executionId: req.executionId,
          tenantId: req.tenantId,
          capabilityId: req.capabilityId,
          providerId: req.providerId,
          principalId: req.principal?.id ?? "unknown",
          decision: "deny",
          category: "denied:missing-principal",
        },
      };
    }

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
      category: PolicyDecisionCategory,
      reason: string,
    ): ExecutionPolicyDecision => ({
      allowed: false,
      reason,
      category,
      audit: { ...auditBase, decision: "deny", category },
    });

    const allow = (reason: string): ExecutionPolicyDecision => ({
      allowed: true,
      reason,
      category: "allowed",
      audit: { ...auditBase, decision: "allow", category: "allowed" },
    });

    // 2. Unknown / unbound principal (no organizationId ⇒ no tenant scope).
    if (!req.principal.organizationId) {
      return deny("denied:unknown-principal", "Principal is unbound (no organizationId)");
    }

    // 3. Missing tenant.
    if (!req.tenantId) {
      return deny("denied:missing-tenant", "Execution request is missing a tenant id");
    }

    // 4. Tenant mismatch — principal must be scoped to the target tenant.
    try {
      enforceTenant(req.principal, req.tenantId);
    } catch (err) {
      if (err instanceof TenantViolationError) {
        return deny("denied:tenant-mismatch", `Principal ${req.principal.id} is not authorized for tenant ${req.tenantId}`);
      }
      throw err;
    }

    // 5. Missing capability.
    if (!req.capabilityId) {
      return deny("denied:missing-capability", "Execution request is missing a capability id");
    }
    if (!this.capabilities.has(req.capabilityId)) {
      return deny("denied:unknown-capability", `Capability "${req.capabilityId}" is not registered`);
    }

    // 6. Unknown provider.
    if (!req.providerId) {
      return deny("denied:unknown-provider", "Execution request is missing a provider id");
    }
    if (!this.knownProviders().includes(req.providerId)) {
      return deny("denied:unknown-provider", `Provider "${req.providerId}" is not a known/trusted provider`);
    }

    // 7. Missing approval when required.
    if (req.approvalRequired) {
      if (!req.approval) {
        return deny("denied:missing-approval", `Capability "${req.capabilityId}" requires approval and none was recorded`);
      }
      if (!this.verifyApprover(req.approval.approver)) {
        return deny("denied:missing-approval", `Approver "${req.approval.approver}" is no longer a known principal`);
      }
      // 8. Expired approval.
      if (req.approval.expiresAt && new Date(req.approval.expiresAt).getTime() < this.now()) {
        return deny("denied:expired-approval", `Approval for ${req.executionId} expired at ${req.approval.expiresAt}`);
      }
    }

    // 9. Invalid lifecycle state — only runnable executions may proceed.
    const RUNNABLE: ExecutionState[] = ["approved", "running"];
    if (!RUNNABLE.includes(req.lifecycleState)) {
      return deny(
        "denied:invalid-lifecycle",
        `Execution ${req.executionId} is in non-runnable state "${req.lifecycleState}" (expected approved/running)`,
      );
    }

    return allow(`Execution ${req.executionId} authorized for capability "${req.capabilityId}" on provider "${req.providerId}"`);
  }
}

/**
 * Build a policy request from a durable ExecutionTask + registry lookup.
 * Centralizes "what does the store currently say" → policy input, so every
 * caller assembles the request the SAME way.
 */
export function policyRequestFromStore(
  store: ExecutionStore,
  tenantId: string,
  executionId: string,
  principal: Principal,
  capabilityId: string,
  providerId: string,
  approvalRequired: boolean,
): ExecutionPolicyRequest {
  const ex = store.get(executionId, principal);
  if (!ex) {
    // No stored execution yet — caller must decide (typically DENY unknown).
    return {
      principal,
      tenantId,
      executionId,
      capabilityId,
      providerId,
      approvalRequired,
      lifecycleState: "created",
      approval: undefined,
    };
  }
  return {
    principal,
    tenantId: ex.tenant,
    executionId: ex.id,
    workflowId: ex.workflowId,
    capabilityId: ex.capability,
    providerId: ex.backend,
    approval: ex.approval
      ? { approver: ex.approval.approver, ...(ex.approval.expiresAt ? { expiresAt: ex.approval.expiresAt } : {}) }
      : undefined,
    approvalRequired,
    lifecycleState: ex.state,
  };
}
