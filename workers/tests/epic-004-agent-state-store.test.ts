// EPIC-004 PHASE 3 — Agent State Persistence tests
// Run with: npx vitest run epic-004-agent-state-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  createAgentStateStore,
  createMemoryAgentStateStore,
  MemoryAgentBackend,
  canAgentAct,
  type AgentStateStore,
  type AgentPersistenceBackend,
} from "../../hermes/persistence/agent-state-store.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

function principal(id: string, org?: string): Principal {
  return { id, permissions: [], scopes: [], ...(org ? { organizationId: org } : {}) } as Principal;
}

const caps = [{ id: "ops.lead.read", description: "read ops", autonomous: false }];

describe("EPIC-004 PHASE 3: agent state + execution gate", () => {
  let store: AgentStateStore;
  beforeEach(() => {
    store = createMemoryAgentStateStore();
  });

  function registerAndActivate(id: string, tenant: string) {
    store.register({ id, name: id, tenant, owner: "team", principal: principal("admin", tenant), capabilities: caps });
    // registered -> approved -> active
    store.setState(id, "assigned", principal("admin", tenant));
    store.setState(id, "approved", principal("admin", tenant));
    store.setState(id, "active", principal("admin", tenant));
    store.setActivation(id, "enabled", principal("admin", tenant));
  }

  it("disabled agent cannot execute (gate preserved)", () => {
    store.register({ id: "a1", name: "a1", tenant: "t1", owner: "team", principal: principal("admin", "t1"), capabilities: caps });
    store.setState("a1", "assigned", principal("admin", "t1"));
    store.setState("a1", "approved", principal("admin", "t1"));
    store.setState("a1", "active", principal("admin", "t1")); // active but disabled
    const a = store.get("a1", principal("admin", "t1"))!;
    expect(canAgentAct(a)).toBe(false); // activation === disabled
  });

  it("suspended agent cannot execute", () => {
    registerAndActivate("a1", "t1");
    store.setState("a1", "suspended", principal("admin", "t1"));
    const a = store.get("a1", principal("admin", "t1"))!;
    expect(canAgentAct(a)).toBe(false);
  });

  it("fully activated+active agent CAN execute", () => {
    registerAndActivate("a1", "t1");
    const a = store.get("a1", principal("admin", "t1"))!;
    expect(canAgentAct(a)).toBe(true);
  });

  it("illegal transition rejected fail-closed", () => {
    store.register({ id: "a1", name: "a1", tenant: "t1", owner: "team", principal: principal("admin", "t1"), capabilities: caps });
    // registered -> active without approval is illegal
    expect(() => store.setState("a1", "active", principal("admin", "t1"))).toThrow(/Illegal agent transition/);
  });
});

describe("EPIC-004 PHASE 3: restored agent retains state (restart sim)", () => {
  it("state survives a new store instance over the same backend", () => {
    const backend: AgentPersistenceBackend = new MemoryAgentBackend();
    const s1 = createAgentStateStore(backend);
    s1.register({ id: "a1", name: "a1", tenant: "t1", owner: "team", principal: principal("admin", "t1"), capabilities: caps });
    s1.setState("a1", "assigned", principal("admin", "t1"));
    s1.setState("a1", "approved", principal("admin", "t1"));
    s1.setState("a1", "active", principal("admin", "t1"));
    s1.setActivation("a1", "enabled", principal("admin", "t1"));

    const s2 = createAgentStateStore(backend); // simulate restart
    const recovered = s2.get("a1", principal("admin", "t1"))!;
    expect(recovered.state).toBe("active");
    expect(recovered.activation).toBe("enabled");
    expect(canAgentAct(recovered)).toBe(true);
  });
});

describe("EPIC-004 PHASE 3: tenant separation + unauthorized mutation", () => {
  let store: AgentStateStore;
  beforeEach(() => {
    store = createMemoryAgentStateStore();
    store.register({ id: "a1", name: "a1", tenant: "t1", owner: "team", principal: principal("admin", "t1"), capabilities: caps });
    store.register({ id: "b1", name: "b1", tenant: "t2", owner: "team", principal: principal("admin", "t2"), capabilities: caps });
  });

  it("lists only the principal's tenant", () => {
    expect(store.list(principal("admin", "t1"), "t1").map((a) => a.id)).toEqual(["a1"]);
  });

  it("cross-tenant state mutation is denied", () => {
    expect(() => store.setState("b1", "active", principal("admin", "t1"))).toThrow();
  });

  it("unbound principal denied", () => {
    expect(() => store.list(principal("x"), "t1")).toThrow();
  });
});
