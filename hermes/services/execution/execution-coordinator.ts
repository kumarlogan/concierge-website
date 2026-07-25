// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Execution Coordinator                │
// │ EPIC-004.5 PHASE 3+4 · queue becomes COORDINATOR, not state     │
// │ authority. Durable execution truth lives in ExecutionStore.     │
// │ Preserves: fail-closed approval, retry, cancellation, timeout,  │
// │ human approval, auditability, tenant isolation.                 │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  createExecutionStore,
  createMemoryExecutionStore,
  type ExecutionStore,
  type ExecutionApproval,
  type ExecutionResult,
  type ExecutionAttempt,
} from "../../persistence/execution-store.js";
import { orchestrate, DEFAULT_ORCHESTRATION, type OrchestrationConfig } from "../activation/orchestrator.js";
import { createTask, assignTask, approveTask, completeTask, failTask } from "../agents/task.js";
import type { Principal } from "../../contracts/platform-api.js";
import {
  ExecutionPolicyEvaluator,
  policyRequestFromStore,
  type PolicyEvaluatorDeps,
} from "./policy-evaluator.js";
import { ExecutionIdempotencyTracker, type ExecutionRequestIdentity } from "./idempotency.js";
import { MemoryExecutionLeaseManager, type ExecutionLeaseManager } from "./lease.js";
import { MemoryExecutionMetrics, type ExecutionMetrics } from "./metrics.js";

export class CoordinatorError extends Error {}

/** Thrown when the policy evaluator DENIES an execution (fail-closed). */
export class PolicyDeniedError extends Error {
  constructor(
    message: string,
    public readonly category: string,
    public readonly audit: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PolicyDeniedError";
  }
}

/** Verifies an approver identity is known/authorized (fail-closed). */
export type ApproverVerifier = (approver: string) => boolean;

export interface CoordinatorDeps {
  store?: ExecutionStore;
  /** Verifies an approver is a known principal. Default: accept any non-empty. */
  verifyApprover?: ApproverVerifier;
  /** Approval TTL in ms (optional). Expired approvals are DENIED. */
  approvalTtlMs?: number;
  /** Policy evaluator deps (capability registry + known providers). */
  policy?: PolicyEvaluatorDeps;
  /** Known provider ids (trusted execution backends). */
  knownProviders?: string[];
  /** Whether the requested capability requires human approval. */
  approvalRequiredFor?: (capabilityId: string) => boolean;
  /** Idempotency tracker (PHASE 2). Created internally if omitted. */
  idempotency?: ExecutionIdempotencyTracker;
  /** Lease manager (PHASE 3). Created internally if omitted. */
  leases?: ExecutionLeaseManager;
  /** Metrics boundary (PHASE 4). Created internally if omitted. */
  metrics?: ExecutionMetrics;
}

let seq = 0;
function genExecId(): string {
  seq += 1;
  return `exec_${seq}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * The coordinator owns the durable execution lifecycle. It is the ONLY component
 * that mutates ExecutionStore. The queue (execution-queue.ts) becomes a thin
 * operator-visibility surface that delegates here.
 */
export class ExecutionCoordinator {
  private readonly store: ExecutionStore;
  private readonly verifyApprover: ApproverVerifier;
  private readonly approvalTtlMs?: number;
  private readonly policy: ExecutionPolicyEvaluator;
  private readonly knownProviders: () => string[];
  private readonly approvalRequiredFor: (capabilityId: string) => boolean;
  private readonly idempotency: ExecutionIdempotencyTracker;
  private readonly leases: ExecutionLeaseManager;
  private readonly metrics: ExecutionMetrics;

  constructor(deps: CoordinatorDeps = {}) {
    this.store = deps.store ?? createMemoryExecutionStore();
    this.verifyApprover = deps.verifyApprover ?? ((a: string) => a.length > 0);
    this.approvalTtlMs = deps.approvalTtlMs;
    // The policy evaluator REQUIRES a capability registry — it is the single
    // source of truth for "what can run". Refuse to construct without one.
    if (!deps.policy?.capabilities) {
      throw new CoordinatorError(
        "ExecutionCoordinator requires CoordinatorDeps.policy.capabilities (capability registry) for EPIC-004.6 policy evaluation",
      );
    }
    const toProviderList = (p?: string[] | (() => string[])): (() => string[]) =>
      typeof p === "function" ? p : () => p ?? [];
    this.policy = new ExecutionPolicyEvaluator({
      capabilities: deps.policy.capabilities,
      knownProviders: toProviderList(deps.knownProviders ?? deps.policy?.knownProviders),
      verifyApprover: this.verifyApprover,
    });
    this.knownProviders = toProviderList(deps.knownProviders ?? deps.policy?.knownProviders);
    this.approvalRequiredFor = deps.approvalRequiredFor ?? (() => false);
    this.idempotency = deps.idempotency ?? new ExecutionIdempotencyTracker();
    this.leases = deps.leases ?? new MemoryExecutionLeaseManager();
    this.metrics = deps.metrics ?? new MemoryExecutionMetrics();
  }

  /**
   * Request an execution.
   * PHASE 2: registers an idempotency key. Duplicate requestId for the same
   * execution → returns the existing id (safe retry). Distinct execution under
   * a reused requestId → rejected (no shadow execution).
   * Creates a durable ExecutionTask (state: created) on first accept.
   */
  request(input: {
    tenant: string;
    principal: string;
    capability: string;
    backend: string;
    principalSubject: Principal;
    workflowId?: string;
    /** Idempotency key (PHASE 2). If omitted, one is generated. */
    requestId?: string;
  }): { executionId: string; requestId: string; duplicate?: boolean } {
    const requestId = input.requestId ?? `req_${genExecId()}`;
    const id = genExecId();
    const reg = this.idempotency.register({
      requestId,
      executionId: id,
      tenantId: input.tenant,
    });
    if (reg.kind === "duplicate") {
      return { executionId: reg.existing.executionId, requestId, duplicate: true };
    }
    if (reg.kind === "rejected") {
      throw new CoordinatorError(reg.reason);
    }
    this.store.create({
      id,
      tenant: input.tenant,
      principal: input.principal,
      capability: input.capability,
      backend: input.backend,
      ...(input.workflowId ? { workflowId: input.workflowId } : {}),
      principalSubject: input.principalSubject,
    });
    emitAudit("execution.requested", input.principal, {
      executionId: id,
      capability: input.capability,
      tenant: input.tenant,
    });
    return { executionId: id, requestId, duplicate: false };
  }

  /** Persist a human approval decision (PHASE 4). */
  approve(
    id: string,
    approver: string,
    capability: string,
    scope: string,
    principal: Principal,
  ): void {
    if (!this.verifyApprover(approver)) {
      throw new CoordinatorError(`Unknown approver: ${approver} — DENIED`);
    }
    const approval: ExecutionApproval = {
      approver,
      at: new Date().toISOString(),
      capability,
      scope,
      ...(this.approvalTtlMs ? { expiresAt: new Date(Date.now() + this.approvalTtlMs).toISOString() } : {}),
    };
    this.store.recordApproval(id, approval, principal);
    this.store.transition(id, "assigned", principal, approver);
    this.store.transition(id, "approved", principal, approver);
    emitAudit("execution.approved", approver, { executionId: id, capability, scope });
  }

  /** Run an approved execution through the orchestrator (retry/timeout/cancel). */
  async run(
    id: string,
    approver: string,
    executor: (capability: string, args: unknown) => Promise<{ ok: boolean; data?: unknown; error?: string; backend: string }>,
    args: unknown,
    principal: Principal,
    opts?: { config?: Partial<OrchestrationConfig>; maxAttempts?: number; workerId?: string; leaseTtlMs?: number },
  ): Promise<ExecutionResult> {
    const ex = this.store.get(id, principal);
    if (!ex) throw new CoordinatorError(`Unknown execution: ${id}`);

    // PHASE 5: SINGLE DECISION POINT. The policy evaluator is the gate that
    // every execution must pass BEFORE any approval/lifecycle handling. It
    // centralizes tenant/principal/capability/provider/approval/lifecycle
    // checks and fails closed (DENY) on any violation.
    const preq = policyRequestFromStore(
      this.store,
      ex.tenant,
      id,
      principal,
      ex.capability,
      ex.backend,
      this.approvalRequiredFor(ex.capability),
    );
    const decision = this.policy.evaluate(preq);
    if (!decision.allowed) {
      emitAudit("execution.policy.denied", principal.tenantId ?? approver, {
        executionId: id,
        category: decision.category,
        reason: decision.reason,
        ...decision.audit,
      });
      throw new PolicyDeniedError(decision.reason, decision.category, decision.audit);
    }

    // PHASE 3: lease acquisition (contract-only; prepares for distributed
    // workers). Unknown worker is rejected; expired lease is recoverable.
    const workerId = opts?.workerId ?? "worker:local";
    const lease = this.leases.acquire(id, workerId, opts?.leaseTtlMs ?? 30_000);
    if (!lease.ok) {
      throw new CoordinatorError(`Lease denied for ${id}: ${lease.reason}`);
    }

    // PHASE 4: fail-closed approval verification (durable + verified).
    if (!ex.approval) throw new CoordinatorError(`Execution ${id} has no durable approval — DENIED`);
    if (ex.approval.approver !== approver) {
      throw new CoordinatorError(`Approver mismatch on ${id} — DENIED`);
    }
    if (!this.verifyApprover(approver)) {
      throw new CoordinatorError(`Approver ${approver} no longer known — DENIED`);
    }
    if (ex.approval.expiresAt && new Date(ex.approval.expiresAt).getTime() < Date.now()) {
      // Lost/expired approval after restart → DENY.
      this.store.transition(id, "cancelled", principal, "system");
      throw new CoordinatorError(`Approval for ${id} expired — DENIED`);
    }

    this.metrics.recordStart();
    this.store.transition(id, "running", principal, approver);

    // Create a backing AgentTask so the existing orchestration gate
    // (task must be approved) is satisfied. The ExecutionStore remains the
    // durable authority for execution truth; the task is the orchestration
    // substrate (same pattern the legacy queue uses).
    const task = createTask({
      agentId: ex.principal,
      applicationId: ex.tenant,
      purpose: ex.capability,
      requestedBy: ex.principal,
    });
    assignTask(task.id, approver);
    approveTask(task.id, approver);

    let lastData: unknown;
    let lastBackend = ex.backend;
    const outcome = await orchestrate(
      task.id,
      async () => {
        const r = await executor(ex.capability, args);
        if (!r.ok) return { ok: false, error: r.error };
        lastData = r.data;
        lastBackend = r.backend;
        return { ok: true, data: r.data };
      },
      { actor: approver, config: { ...DEFAULT_ORCHESTRATION, maxAttempts: opts?.maxAttempts ?? 3, ...opts?.config } },
    );

    // Keep the task registry's terminal state consistent (fail-closed).
    try {
      if (outcome.ok) completeTask(task.id, approver);
      else failTask(task.id, approver, outcome.error ?? "execution failed");
    } catch { /* non-fatal: task state is secondary to execution truth */ }

    const attempt: ExecutionAttempt = {
      attempt: outcome.attempts,
      at: new Date().toISOString(),
      ok: outcome.ok,
      backend: lastBackend,
      ...(outcome.error ? { error: outcome.error } : {}),
    };
    this.store.recordAttempt(id, attempt, principal);

    const result: ExecutionResult = {
      ok: outcome.ok,
      state: outcome.state as ExecutionResult["state"],
      attempts: outcome.attempts,
      ...(lastData !== undefined ? { data: lastData } : {}),
      ...(outcome.error ? { error: outcome.error } : {}),
      completedAt: new Date().toISOString(),
    };
    this.store.recordResult(id, result, principal);

    // PHASE 4: metrics + PHASE 3: lease release.
    const durationMs = Date.now() - new Date(result.completedAt).getTime();
    if (outcome.ok) this.metrics.recordCompleted(durationMs);
    else {
      this.metrics.recordFailed(durationMs);
      this.metrics.recordProviderFailure(lastBackend);
    }
    this.leases.release(id, workerId);

    emitAudit("execution.run", approver, {
      executionId: id,
      capability: ex.capability,
      ok: outcome.ok,
      attempts: outcome.attempts,
      state: outcome.state,
    });
    return result;
  }

  /** Cancel an execution (human-governed). */
  cancel(id: string, actor: string, principal: Principal): void {
    const ex = this.store.get(id, principal);
    if (!ex) throw new CoordinatorError(`Unknown execution: ${id}`);
    this.store.transition(id, "cancelled", principal, actor);
    emitAudit("execution.cancelled", actor, { executionId: id });
  }

  /**
   * PHASE 5: Recovery after restart. Lists non-terminal executions from the
   * durable store and returns their ids. The caller re-drives them with a
   * fresh approval (no approval bypass — recovered executions are NOT
   * auto-approved; they require re-approval to run).
   */
  recoverable(principal: Principal): string[] {
    return this.store.listRecoverable(principal).map((e) => e.id);
  }

  /** Read-only view of an execution. */
  get(id: string, principal: Principal) {
    return this.store.get(id, principal);
  }
}

export { createExecutionStore };
