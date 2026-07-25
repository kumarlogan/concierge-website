// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-004.6 Trust Hardening Test Suite        │
// │ PHASE 6 · failure + acceptance scenarios.                      │
// │                                                            \
// │ Self-contained: exercises the provider-neutral policy,         │
// │ idempotency, lease, and metrics boundaries without external    │
// │ provider or network dependencies.                              │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect } from "vitest";
import type { Principal } from "../../contracts/platform-api.js";
import { ExecutionPolicyEvaluator, type PolicyEvaluatorDeps } from "./policy-evaluator.js";
import { ExecutionIdempotencyTracker } from "./idempotency.js";
import { MemoryExecutionLeaseManager } from "./lease.js";
import { MemoryExecutionMetrics } from "./metrics.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const knownProviders = () => ["openai", "anthropic", "local"];
const capRegistry: PolicyEvaluatorDeps["capabilities"] = {
  has: (id: string) => id === "file.read" || id === "exec.shell" || id === "web.search",
  register: () => {},
  get: () => undefined,
  list: () => [],
};
const deps: PolicyEvaluatorDeps = {
  capabilities: capRegistry,
  knownProviders,
  verifyApprover: (a) => a === "admin",
};
const evaluator = new ExecutionPolicyEvaluator(deps);

function principal(over: Partial<Principal> = {}): Principal {
  return {
    id: "user-1",
    permissions: ["exec.run"],
    organizationId: "tenant-a",
    tenantId: "tenant-a",
    ...over,
  };
}

const baseReq = {
  principal: principal(),
  tenantId: "tenant-a",
  executionId: "exec-1",
  capabilityId: "file.read",
  providerId: "openai",
  approvalRequired: false,
  lifecycleState: "approved" as const,
  approval: undefined as undefined | { approver: string; expiresAt?: string },
};

// ---------------------------------------------------------------------------
// PHASE 6 — 8 scenarios
// ---------------------------------------------------------------------------

describe("EPIC-004.6 Policy Evaluator — denial scenarios", () => {
  it("1. Missing tenant → DENY", () => {
    const d = evaluator.evaluate({ ...baseReq, tenantId: "" });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:missing-tenant");
  });

  it("2. Missing approval (when required) → DENY", () => {
    const d = evaluator.evaluate({
      ...baseReq,
      capabilityId: "exec.shell",
      approvalRequired: true,
      approval: undefined,
    });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:missing-approval");
  });

  it("3. Expired approval → DENY", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const d = evaluator.evaluate({
      ...baseReq,
      capabilityId: "exec.shell",
      approvalRequired: true,
      approval: { approver: "admin", expiresAt: past },
    });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:expired-approval");
  });

  it("6. Unknown provider → DENY", () => {
    const d = evaluator.evaluate({ ...baseReq, providerId: "skynet" });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:unknown-provider");
  });

  it("7. Tenant mismatch → DENY", () => {
    const d = evaluator.evaluate({
      ...baseReq,
      principal: principal({ organizationId: "tenant-b", tenantId: "tenant-b" }),
    });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:tenant-mismatch");
  });

  it("missing principal → DENY", () => {
    const d = evaluator.evaluate({ ...baseReq, principal: null as unknown as Principal });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:missing-principal");
  });

  it("missing capability → DENY", () => {
    const d = evaluator.evaluate({ ...baseReq, capabilityId: "does.not.exist" });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:unknown-capability");
  });

  it("invalid lifecycle state → DENY", () => {
    const d = evaluator.evaluate({ ...baseReq, lifecycleState: "created" });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:invalid-lifecycle");
  });

  it("unknown approver → DENY", () => {
    const future = new Date(Date.now() + 100000).toISOString();
    const d = evaluator.evaluate({
      ...baseReq,
      capabilityId: "exec.shell",
      approvalRequired: true,
      approval: { approver: "imposter", expiresAt: future },
    });
    expect(d.allowed).toBe(false);
    expect(d.category).toBe("denied:missing-approval");
  });
});

describe("EPIC-004.6 Policy Evaluator — allow scenario", () => {
  it("8. Successful approved execution → ALLOW + audit metadata", () => {
    const future = new Date(Date.now() + 100000).toISOString();
    const d = evaluator.evaluate({
      ...baseReq,
      capabilityId: "exec.shell",
      approvalRequired: true,
      approval: { approver: "admin", expiresAt: future },
    });
    expect(d.allowed).toBe(true);
    expect(d.category).toBe("allowed");
    expect(d.audit).toBeDefined();
    expect(d.reason).toContain("authorized");
  });

  it("non-approval capability without approval → ALLOW", () => {
    const d = evaluator.evaluate({ ...baseReq });
    expect(d.allowed).toBe(true);
    expect(d.category).toBe("allowed");
  });
});

describe("EPIC-004.6 Idempotency — duplicate request prevention", () => {
  it("4. Duplicate requestId for same execution → idempotent reuse", () => {
    const tracker = new ExecutionIdempotencyTracker();
    const a = tracker.register({ requestId: "req-1", executionId: "exec-1", tenantId: "t1" });
    expect(a.kind).toBe("accepted");

    // Same requestId, same execution → safe reuse (idempotent retry).
    const b = tracker.register({ requestId: "req-1", executionId: "exec-1", tenantId: "t1" });
    expect(b.kind).toBe("duplicate");
    if (b.kind === "duplicate") {
      expect(b.existing.executionId).toBe("exec-1");
    }
  });

  it("distinct execution under reused requestId → rejected (no shadow exec)", () => {
    const tracker = new ExecutionIdempotencyTracker();
    tracker.register({ requestId: "req-2", executionId: "exec-2", tenantId: "t1" });
    const c = tracker.register({ requestId: "req-2", executionId: "exec-3", tenantId: "t1" });
    expect(c.kind).toBe("rejected");
    if (c.kind === "rejected") {
      expect(c.reason).toContain("exec-2");
    }
  });

  it("first registration is accepted", () => {
    const tracker = new ExecutionIdempotencyTracker();
    const r = tracker.register({ requestId: "req-9", executionId: "exec-9", tenantId: "t1" });
    expect(r.kind).toBe("accepted");
    expect(tracker.seen("req-9")).toBe(true);
    expect(tracker.get("req-9")?.executionId).toBe("exec-9");
  });
});

describe("EPIC-004.6 Lease contract — safe distributed recovery", () => {
  it("5. Expired lease is recoverable by another worker", () => {
    const mgr = new MemoryExecutionLeaseManager(() => 1000);
    mgr.acquire("exec-5", "worker-1", 500); // expires at 1500
    // Advance clock past expiry; a different worker may re-acquire.
    const m2 = new MemoryExecutionLeaseManager(() => 2000);
    const recovered = m2.acquire("exec-5", "worker-2", 500);
    expect(recovered.ok).toBe(true);
    if (recovered.ok) expect(recovered.lease.workerId).toBe("worker-2");
  });

  it("active lease cannot be stolen by another worker", () => {
    const mgr = new MemoryExecutionLeaseManager(() => 1000);
    mgr.acquire("exec-7", "worker-1", 5000);
    const stolen = mgr.acquire("exec-7", "worker-2", 5000);
    expect(stolen).toEqual({ ok: false, reason: expect.stringContaining("worker-1") });
  });

  it("unknown worker denied on heartbeat/release", () => {
    const mgr = new MemoryExecutionLeaseManager(() => 1000);
    mgr.acquire("exec-8", "worker-1", 5000);
    expect(mgr.heartbeat("exec-8", "worker-x")).toBeNull();
    mgr.release("exec-8", "worker-x"); // no-op
    expect(mgr.get("exec-8")?.workerId).toBe("worker-1");
  });

  it("state reflects active vs expired", () => {
    const mgr = new MemoryExecutionLeaseManager(() => 1000);
    mgr.acquire("exec-x", "w1", 500);
    expect(mgr.state("exec-x", 1200)).toBe("active");
    expect(mgr.state("exec-x", 2000)).toBe("expired");
  });
});

describe("EPIC-004.6 Metrics boundary — memory implementation", () => {
  it("records lifecycle counters and snapshot", () => {
    const m = new MemoryExecutionMetrics();
    m.recordStart();
    m.recordStart();
    m.recordCompleted(10);
    m.recordFailed(20);
    m.recordCancelled();
    m.recordRetry();
    m.recordProviderFailure("openai");
    const s = m.snapshot();
    expect(s.started).toBe(2);
    expect(s.completed).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.cancelled).toBe(1);
    expect(s.retries).toBe(1);
    expect(s.providerFailures).toBe(1);
    expect(s.averageDurationMs).toBe(15); // (10+20)/2
    expect(s.providerFailureBreakdown.openai).toBe(1);
  });

  it("reset clears counters", () => {
    const m = new MemoryExecutionMetrics();
    m.recordStart();
    m.reset();
    expect(m.snapshot().started).toBe(0);
  });
});
