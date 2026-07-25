// EPIC-004.5 PHASE 5 — Recovery model (restart simulation) tests
// Run with: npx vitest run epic-004.5-recovery.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  ExecutionCoordinator,
  CoordinatorError,
} from "../../hermes/services/execution/execution-coordinator.js";
import {
  createExecutionStore,
  MemoryExecutionBackend,
} from "../../hermes/persistence/execution-store.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import { MemoryCapabilityRegistry } from "../../hermes/services/providers/capability.js";

// Shared capability registry: EPIC-004.6 makes the policy evaluator the
// single gate, so the coordinator requires a registered capability before
// run() reaches the approval/approver/ttl checks the recovery tests exercise.
const caps = new MemoryCapabilityRegistry();
caps.register([{ id: "deploy", name: "Deploy", provider: "local" }]);
// Policy deps shared by all coordinators in this suite. "agent:x" is the
// placeholder backend the tests request; declare it a known/trusted provider
// so the policy evaluator passes the provider gate and reaches the
// approval/approver/ttl gates these recovery tests actually assert on.
const policy = { capabilities: caps, knownProviders: () => ["agent:x"] };

function principal(over: Partial<Principal> = {}): Principal {
  return { id: "u1", organizationId: "tenant-a", roles: [], scopes: [], ...over } as Principal;
}

/** A backend that persists across "restarts" (external to coordinator). */
function makeBackend() { return new MemoryExecutionBackend(); }

const okExecutor = async (_c: string, _a: unknown) => ({ ok: true, data: { ran: true }, backend: "agent:x" });

describe("Recovery — restart simulation", () => {
  let backend: ReturnType<typeof makeBackend>;
  const subj = principal();

  beforeEach(() => { backend = makeBackend(); });

  it("recovers a created execution after restart without duplication", async () => {
    // First process: request + approve, then "crash" before run.
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    c1.approve(id, "approver-x", "deploy", "app:prod", subj);

    // Second process: NEW coordinator over the SAME durable backend.
    const c2 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const recoverable = c2.recoverable(subj);
    expect(recoverable).toContain(id);
    expect(recoverable).toHaveLength(1); // no duplicate

    const ex = c2.get(id, subj)!;
    expect(ex.state).toBe("approved"); // approval persisted
    expect(ex.approval?.approver).toBe("approver-x");
  });

  it("does NOT bypass approval after restart — running requires durable approval", async () => {
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    // Approved + running started, then crash mid-run.
    c1.approve(id, "approver-x", "deploy", "app:prod", subj);
    // Simulate crash BEFORE run() persisted a result.

    const c2 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    // Re-run: approval is present and matches → allowed.
    const res = await c2.run(id, "approver-x", okExecutor, {}, subj);
    expect(res.ok).toBe(true);
    expect(c2.get(id, subj)!.state).toBe("completed");
  });

  it("DENIES run when approval is lost (never recorded) after restart", async () => {
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    // Crash before any approval.

    const c2 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    await expect(c2.run(id, "approver-x", okExecutor, {}, subj)).rejects.toThrow(/non-runnable state|no durable approval|created/);
  });

  it("DENIES run when approver becomes unknown after restart", async () => {
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    c1.approve(id, "approver-x", "deploy", "app:prod", subj);

    // After restart, the approver is no longer recognized.
    const c2 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: (a) => a !== "approver-x", policy });
    await expect(c2.run(id, "approver-x", okExecutor, {}, subj)).rejects.toThrow(/no longer known/);
  });

  it("DENIES run when approval expired after restart", async () => {
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, approvalTtlMs: -1, policy }); // already expired
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    c1.approve(id, "approver-x", "deploy", "app:prod", subj);

    const c2 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    await expect(c2.run(id, "approver-x", okExecutor, {}, subj)).rejects.toThrow(/expired/);
    // Recovered execution must not be left in a running limbo.
    expect(c2.get(id, subj)!.state).toBe("cancelled");
  });

  it("tenant isolation preserved across restart", async () => {
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    c1.approve(id, "approver-x", "deploy", "app:prod", subj);

    const c2 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const other = principal({ id: "u2", organizationId: "tenant-b" });
    expect(() => c2.get(id, other)).toThrow();
    expect(c2.recoverable(other)).not.toContain(id);
  });

  it("no duplicate execution id on re-request of same logical work", async () => {
    const c1 = new ExecutionCoordinator({ store: createExecutionStore(backend), verifyApprover: () => true, policy });
    const id = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    expect(id).toBeTruthy();
    // A second request produces a DISTINCT id (idempotency is caller's job).
    const id2 = c1.request({ tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "agent:x", principalSubject: subj }).executionId;
    expect(id2).not.toBe(id);
  });
});
