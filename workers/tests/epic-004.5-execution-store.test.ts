// EPIC-004.5 PHASE 1+2+4 — ExecutionStore + approval durability tests
// Run with: npx vitest run epic-004.5-execution-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  createMemoryExecutionStore,
  type ExecutionApproval,
} from "../../hermes/persistence/execution-store.js";
import { TenantViolationError } from "../../hermes/persistence/tenant.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

function principal(over: Partial<Principal> = {}): Principal {
  return { id: "u1", organizationId: "tenant-a", roles: [], scopes: [], ...over } as Principal;
}

describe("ExecutionStore — creation + tenant", () => {
  let store: ReturnType<typeof createMemoryExecutionStore>;
  beforeEach(() => { store = createMemoryExecutionStore(); });

  it("creates an execution with state 'created'", () => {
    const ex = store.create({
      id: "e1", tenant: "tenant-a", principal: "u1",
      capability: "deploy", backend: "agent:x", principalSubject: principal(),
    });
    expect(ex.state).toBe("created");
    expect(ex.tenant).toBe("tenant-a");
    expect(ex.capability).toBe("deploy");
  });

  it("rejects missing tenant (fail-closed)", () => {
    expect(() => store.create({
      id: "e2", tenant: "", principal: "u1",
      capability: "deploy", backend: "agent:x", principalSubject: principal(),
    })).toThrow(/Missing tenant/);
  });

  it("rejects duplicate execution id", () => {
    store.create({ id: "e3", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() });
    expect(() => store.create({ id: "e3", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() }))
      .toThrow(/already exists/);
  });

  it("cross-tenant read is denied", () => {
    store.create({ id: "e4", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() });
    const other = principal({ id: "u2", organizationId: "tenant-b" });
    expect(() => store.get("e4", other)).toThrow(TenantViolationError);
  });

  it("unbound principal (no org) is denied", () => {
    store.create({ id: "e5", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() });
    const unbound = principal({ id: "u3", organizationId: undefined });
    expect(() => store.get("e5", unbound as Principal)).toThrow(TenantViolationError);
  });
});

describe("ExecutionStore — lifecycle transitions", () => {
  let store: ReturnType<typeof createMemoryExecutionStore>;
  beforeEach(() => {
    store = createMemoryExecutionStore();
    store.create({ id: "e1", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() });
  });

  it("legal transitions succeed and are recorded", () => {
    store.transition("e1", "assigned", principal());
    store.transition("e1", "approved", principal(), "u1");
    const ex = store.get("e1", principal())!;
    expect(ex.state).toBe("approved");
    expect(ex.transitions.map((t) => `${t.from}->${t.to}`)).toEqual(["created->assigned", "assigned->approved"]);
  });

  it("illegal transition rejected", () => {
    expect(() => store.transition("e1", "completed", principal())).toThrow(/Illegal execution transition/);
  });

  it("records attempts (retries)", () => {
    store.transition("e1", "assigned", principal());
    store.transition("e1", "approved", principal());
    store.transition("e1", "running", principal());
    store.recordAttempt("e1", { attempt: 1, at: new Date().toISOString(), ok: false, backend: "b", error: "boom" }, principal());
    store.recordAttempt("e1", { attempt: 2, at: new Date().toISOString(), ok: true, backend: "b" }, principal());
    const ex = store.get("e1", principal())!;
    expect(ex.attempts).toHaveLength(2);
    expect(ex.attempts[0].ok).toBe(false);
    expect(ex.attempts[1].ok).toBe(true);
  });

  it("records terminal result", () => {
    store.transition("e1", "assigned", principal());
    store.transition("e1", "approved", principal());
    store.transition("e1", "running", principal());
    const res = store.recordResult("e1", { ok: true, state: "completed", attempts: 1, completedAt: new Date().toISOString() }, principal());
    expect(res.state).toBe("completed");
    expect(res.result?.ok).toBe(true);
  });
});

describe("ExecutionStore — approval durability", () => {
  let store: ReturnType<typeof createMemoryExecutionStore>;
  beforeEach(() => { store = createMemoryExecutionStore(); });

  it("persists approver identity, timestamp, scope", () => {
    store.create({ id: "e1", tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "b", principalSubject: principal() });
    const approval: ExecutionApproval = {
      approver: "approver-x", at: new Date().toISOString(),
      capability: "deploy", scope: "app:prod:limited",
    };
    store.recordApproval("e1", approval, principal());
    const ex = store.get("e1", principal())!;
    expect(ex.approval?.approver).toBe("approver-x");
    expect(ex.approval?.scope).toBe("app:prod:limited");
    expect(ex.approval?.capability).toBe("deploy");
  });

  it("records expiry when provided", () => {
    store.create({ id: "e2", tenant: "tenant-a", principal: "u1", capability: "deploy", backend: "b", principalSubject: principal() });
    const future = new Date(Date.now() + 3600_000).toISOString();
    store.recordApproval("e2", { approver: "ax", at: new Date().toISOString(), capability: "deploy", scope: "x", expiresAt: future }, principal());
    expect(store.get("e2", principal())!.approval?.expiresAt).toBe(future);
  });
});

describe("ExecutionStore — recovery list", () => {
  let store: ReturnType<typeof createMemoryExecutionStore>;
  beforeEach(() => { store = createMemoryExecutionStore(); });

  it("lists only non-terminal executions as recoverable", () => {
    store.create({ id: "run", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() });
    store.transition("run", "assigned", principal());
    store.transition("run", "approved", principal());
    store.transition("run", "running", principal());
    store.create({ id: "done", tenant: "tenant-a", principal: "u1", capability: "c", backend: "b", principalSubject: principal() });
    store.transition("done", "assigned", principal());
    store.transition("done", "approved", principal());
    store.transition("done", "running", principal());
    store.transition("done", "completed", principal());
    const rec = store.listRecoverable(principal());
    expect(rec.map((e) => e.id)).toEqual(["run"]);
  });
});
