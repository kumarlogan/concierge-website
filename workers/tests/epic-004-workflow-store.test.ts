// EPIC-004 PHASE 2 — Workflow State Persistence tests
// Run with: npx vitest run epic-004-workflow-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  createWorkflowStore,
  createMemoryWorkflowStore,
  MemoryWorkflowBackend,
  canTransitionWorkflow,
  type WorkflowStore,
  type WorkflowPersistenceBackend,
} from "../../hermes/persistence/workflow-store.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

function principal(id: string, org?: string): Principal {
  return { id, permissions: [], scopes: [], ...(org ? { organizationId: org } : {}) } as Principal;
}

describe("EPIC-004 PHASE 2: workflow persistence + transitions", () => {
  let store: WorkflowStore;
  let backend: WorkflowPersistenceBackend;
  beforeEach(() => {
    backend = new MemoryWorkflowBackend();
    store = createWorkflowStore(backend);
  });

  it("creates a planned workflow and records tenant + owner", () => {
    const wf = store.create({ id: "wf-1", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    expect(wf.state).toBe("planned");
    expect(wf.tenant).toBe("t1");
    expect(wf.owner).toBe("u1");
  });

  it("rejects illegal transitions fail-closed", () => {
    const wf = store.create({ id: "wf-1", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    // planned -> completed is illegal (must go through running)
    expect(() => store.transition("wf-1", "completed", principal("u1", "t1"))).toThrow(/Illegal workflow transition/);
    expect(wf.state).toBe("planned");
  });

  it("persists a legal transition with history", () => {
    store.create({ id: "wf-1", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    const wf = store.transition("wf-1", "running", principal("u1", "t1"), "u1");
    expect(wf.state).toBe("running");
    expect(wf.transitions).toHaveLength(1);
    expect(wf.transitions[0]).toMatchObject({ from: "planned", to: "running", by: "u1" });
  });

  it("records human approvals", () => {
    store.create({ id: "wf-1", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    const wf = store.approve("wf-1", "approver-x", principal("u1", "t1"), "looks good");
    expect(wf.approvals).toHaveLength(1);
    expect(wf.approvals[0].approver).toBe("approver-x");
  });

  it("links audit events", () => {
    store.create({ id: "wf-1", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    const wf = store.linkAudit("wf-1", "audit_abc", principal("u1", "t1"));
    expect(wf.auditEvents).toContain("audit_abc");
  });
});

describe("EPIC-004 PHASE 2: restart simulation (durability)", () => {
  it("state survives a new store instance over the same backend", () => {
    const backend = new MemoryWorkflowBackend();
    const s1 = createWorkflowStore(backend);
    s1.create({ id: "wf-1", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    s1.transition("wf-1", "running", principal("u1", "t1"));

    // Simulate restart: brand-new store instance, SAME durable backend.
    const s2 = createWorkflowStore(backend);
    const recovered = s2.get("wf-1", principal("u1", "t1"))!;
    expect(recovered).toBeDefined();
    expect(recovered.state).toBe("running");
    expect(recovered.transitions).toHaveLength(1);
  });

  it("a fresh (unseeded) backend yields no state — proves durability lives in the backend, not the store", () => {
    const fresh = new MemoryWorkflowBackend();
    const s = createWorkflowStore(fresh);
    expect(s.list(principal("u1", "t1"), "t1")).toHaveLength(0);
  });
});

describe("EPIC-004 PHASE 2: tenant separation", () => {
  let store: WorkflowStore;
  beforeEach(() => {
    store = createMemoryWorkflowStore();
    store.create({ id: "wf-a", tenant: "t1", owner: "u1", principal: principal("u1", "t1") });
    store.create({ id: "wf-b", tenant: "t2", owner: "u2", principal: principal("u2", "t2") });
  });

  it("lists only the principal's tenant", () => {
    expect(store.list(principal("u1", "t1"), "t1").map((w) => w.id)).toEqual(["wf-a"]);
    expect(store.list(principal("u2", "t2"), "t2").map((w) => w.id)).toEqual(["wf-b"]);
  });

  it("cross-tenant read is denied", () => {
    expect(() => store.get("wf-b", principal("u1", "t1"))).toThrow();
  });

  it("unbound principal is denied", () => {
    expect(() => store.list(principal("u3"), "t1")).toThrow();
  });
});

describe("EPIC-004 PHASE 2: transition table sanity", () => {
  it("enforces the canonical workflow transition table", () => {
    expect(canTransitionWorkflow("running", "completed")).toBe(true);
    expect(canTransitionWorkflow("completed", "running")).toBe(false);
    expect(canTransitionWorkflow("planned", "failed")).toBe(false);
  });
});
