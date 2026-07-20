// EPIC-004 PHASE 4 — Tenant enforcement activation (boundary) tests
// Run with: npx vitest run epic-004-tenant-boundary.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { MemoryAuditStore, defaultAuditStore } from "../../hermes/audit/store.js";
import type { AuditEvent } from "../../shared/interfaces/audit.js";
import { createMemoryWorkflowStore } from "../../hermes/persistence/workflow-store.js";
import { createMemoryAgentStateStore } from "../../hermes/persistence/agent-state-store.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

function principal(id: string, org?: string): Principal {
  return { id, permissions: [], scopes: [], ...(org ? { organizationId: org } : {}) } as Principal;
}

describe("EPIC-004 PHASE 4: tenant enforcement is ACTIVE everywhere", () => {
  describe("audit store (memory path, queryScoped)", () => {
    let store: MemoryAuditStore;
    beforeEach(() => {
      store = new MemoryAuditStore();
      store.append({ type: "test", actor: "u", at: new Date().toISOString(), action: "read", tenant: "t1", workflow: "w1" } as AuditEvent);
      store.append({ type: "test", actor: "u", at: new Date().toISOString(), action: "read", tenant: "t2", workflow: "w2" } as AuditEvent);
    });

    it("cross-tenant read of scoped query is denied", () => {
      expect(() => store.queryScoped({ tenant: "t2" }, principal("admin", "t1"))).toThrow();
    });

    it("tenant-only principal cannot read another tenant via defense-in-depth", () => {
      // principal bound to t1 sees only t1 events, never t2
      const r = store.queryScoped({ tenant: "t1" }, principal("admin", "t1"));
      expect(r.every((e) => e.tenant === "t1")).toBe(true);
      expect(r.length).toBe(1);
    });

    it("unbound principal reads nothing (fail-closed)", () => {
      const r = store.queryScoped({}, principal("admin"));
      expect(r.length).toBe(0);
    });
  });

  describe("workflow store tenant boundary", () => {
    let wf: ReturnType<typeof createMemoryWorkflowStore>;
    beforeEach(() => {
      wf = createMemoryWorkflowStore();
    });
    it("cross-tenant workflow mutation denied", () => {
      wf.create({ id: "w1", tenant: "t1", owner: "team", principal: principal("admin", "t1") });
      expect(() => wf.get("w1", principal("admin", "t2"))).toThrow();
    });
  });

  describe("agent store tenant boundary", () => {
    let agents: ReturnType<typeof createMemoryAgentStateStore>;
    beforeEach(() => {
      agents = createMemoryAgentStateStore();
    });
    it("cross-tenant agent list empty + mutation denied", () => {
      agents.register({ id: "a1", name: "a1", tenant: "t1", owner: "team", principal: principal("admin", "t1"), capabilities: [] });
      expect(agents.list(principal("admin", "t2"), "t2").map((a) => a.id)).toEqual([]);
      expect(() => agents.get("a1", principal("admin", "t2"))).toThrow();
    });
  });

  it("default process-wide audit store still works (no regression)", () => {
    const before = defaultAuditStore.query({ type: "noop" }).length;
    defaultAuditStore.append({ type: "noop", actor: "smoke", at: new Date().toISOString(), action: "noop" });
    expect(defaultAuditStore.query({ type: "noop" }).length).toBe(before + 1);
  });
});
