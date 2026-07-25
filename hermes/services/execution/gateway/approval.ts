// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Execution Gateway: ApprovalRef + Service     │
// │ EPIC-005.6 PHASE 1 · structured, verifiable durable approval  │
// │                                                               │
// │ Replaces the loose `execution.approval` string matching with  │
// │ an explicit, structured ApprovalRef that is verified by an    │
// │ injected ApprovalService. Provider-neutral. Fail-closed.      │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../../contracts/platform-api.js";
import type { ExecutionApproval } from "../../../persistence/execution-store.js";

/**
 * A structured, verifiable reference to a durable human approval.
 *
 * The gateway accepts ONLY this shape (never a bare string) so that approval
 * cannot be faked, mis-scoped, or silently mismatched. Every field is
 * validated by ApprovalService before execution proceeds.
 */
export interface ApprovalRef {
  /** Stable approval id (e.g. "apr_…"); the durable handle. */
  id: string;
  /** Principal id that granted the approval. */
  approver: string;
  /** Capability the approval covers. */
  capability: string;
  /** Owning tenant — approvals are tenant-scoped (no cross-tenant reuse). */
  tenant: string;
  /** Scope string (applicationId + permissions) the approval was bound to. */
  scope: string;
  /** ISO timestamp the approval was recorded. */
  at: string;
  /** Optional ISO expiry; if set and passed, the approval is DENIED. */
  expiresAt?: string;
}

/** Validation errors — fail-closed, surfaced as a denial reason. */
export class ApprovalError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ApprovalError";
  }
}

/**
 * Verifies a presented ApprovalRef against durable approval state.
 * Provider-neutral. Implementations MUST fail closed: any uncertainty → DENY.
 */
export interface ApprovalService {
  /**
   * Verify that `ref` is a valid, currently-granted approval for the given
   * capability/tenant/principal. Throws ApprovalError (fail-closed) on any
   * mismatch, expiry, or unknown approval. Never returns a silent allow.
   */
  verify(ref: ApprovalRef, ctx: { capability: string; tenant: string; principal: Principal }): void;
}

/** Adapter that verifies an ApprovalRef against a durable ExecutionStore record. */
export interface ApprovalStoreLike {
  get(id: string, principal: Principal): { approval?: ExecutionApproval } | undefined;
}

/**
 * Default ApprovalService: verifies the structured ref against the durable
 * execution record. This is the canonical EPIC-005.6 enforcement — no bare
 * string matching, every field checked, fail-closed on any gap.
 */
export function createApprovalService(
  store: ApprovalStoreLike,
  opts: { verifyApprover?: (approver: string) => boolean; now?: () => number } = {},
): ApprovalService {
  const verifyApprover = opts.verifyApprover ?? ((a: string) => a.length > 0);
  const now = opts.now ?? (() => Date.now());

  return {
    verify(ref: ApprovalRef, ctx): void {
      if (!ref || !ref.id) {
        throw new ApprovalError("ApprovalRef is missing its id", "APPROVAL_MISSING_ID");
      }
      if (!verifyApprover(ref.approver)) {
        throw new ApprovalError(
          `Approver "${ref.approver}" is no longer a known principal`,
          "APPROVAL_UNKNOWN_APPROVER",
        );
      }
      const rec = store.get(ref.id, ctx.principal);
      if (!rec) {
        throw new ApprovalError(`Approval "${ref.id}" is not a known durable approval`, "APPROVAL_UNKNOWN");
      }
      const approval = rec.approval;
      if (!approval) {
        throw new ApprovalError(`Execution "${ref.id}" has no durable approval`, "APPROVAL_NONE");
      }
      if (approval.approver !== ref.approver) {
        throw new ApprovalError(
          `Approver mismatch on "${ref.id}": stored "${approval.approver}" ≠ presented "${ref.approver}"`,
          "APPROVAL_APPROVER_MISMATCH",
        );
      }
      if (approval.capability !== ref.capability || approval.capability !== ctx.capability) {
        throw new ApprovalError(
          `Approval capability mismatch on "${ref.id}"`,
          "APPROVAL_CAPABILITY_MISMATCH",
        );
      }
      if (approval.scope !== ref.scope) {
        throw new ApprovalError(`Approval scope mismatch on "${ref.id}"`, "APPROVAL_SCOPE_MISMATCH");
      }
      // Tenant is enforced by the store.get() call above (fail-closed), but we
      // also assert the ref's tenant matches the execution's owning tenant so
      // an approval cannot be replayed across tenants.
      if (ref.tenant !== ctx.tenant) {
        throw new ApprovalError(
          `Approval tenant "${ref.tenant}" does not match execution tenant "${ctx.tenant}"`,
          "APPROVAL_TENANT_MISMATCH",
        );
      }
      const expires = approval.expiresAt ?? ref.expiresAt;
      if (expires && new Date(expires).getTime() < now()) {
        throw new ApprovalError(`Approval "${ref.id}" expired at ${expires}`, "APPROVAL_EXPIRED");
      }
    },
  };
}

/** Build an ApprovalRef from a stored ExecutionApproval (helper for callers). */
export function approvalRefFromRecord(
  id: string,
  approval: ExecutionApproval,
  tenant: string,
): ApprovalRef {
  return {
    id,
    approver: approval.approver,
    capability: approval.capability,
    tenant,
    scope: approval.scope,
    at: approval.at,
    ...(approval.expiresAt ? { expiresAt: approval.expiresAt } : {}),
  };
}
