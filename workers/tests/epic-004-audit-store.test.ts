// EPIC-004 PHASE 1 — Durable Audit Platform tests
// Run with: npx vitest run epic-004-audit-store.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import {
  createMemoryDurableAuditStore,
  MemoryAuditBackend,
  createDurableAuditStore,
  type DurableAuditStore,
} from "../../hermes/audit/store.durable.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

function principal(id: string, org?: string): Principal {
  return {
    id,
    permissions: [],
    scopes: [],
    ...(org ? { organizationId: org } : {}),
  } as Principal;
}

describe("EPIC-004 PHASE 1: audit persists through store abstraction", () => {
  let store: DurableAuditStore;
  beforeEach(() => {
    store = createMemoryDurableAuditStore();
  });

  it("persists a valid event and reads it back through the abstraction", () => {
    store.append({
      type: "security.access",
      actor: "agent:ops",
      action: "read",
      at: new Date().toISOString(),
      category: "security",
      tenant: "tenant-a",
      workflow: "wf-1",
    });
    const all = store.query({});
    expect(all).toHaveLength(1);
    expect(all[0].type).toBe("security.access");
    expect(all[0].tenant).toBe("tenant-a");
  });

  it("rejects an invalid event (missing required fields) fail-closed", () => {
    expect(() =>
      store.append({ type: "", actor: "", action: "" } as any),
    ).toThrow(/Invalid audit event/);
    // store remains empty
    expect(store.query({})).toHaveLength(0);
  });
});

describe("EPIC-004 PHASE 1: tenant isolation", () => {
  let store: DurableAuditStore;
  beforeEach(() => {
    store = createMemoryDurableAuditStore();
    store.append({ type: "a", actor: "x", action: "do", at: new Date().toISOString(), tenant: "tenant-a" });
    store.append({ type: "b", actor: "y", action: "do", at: new Date().toISOString(), tenant: "tenant-b" });
  });

  it("scoped read returns only the principal's tenant", () => {
    const p = principal("u1", "tenant-a");
    const res = store.queryScoped({}, p);
    expect(res).toHaveLength(1);
    expect(res[0].tenant).toBe("tenant-a");
  });

  it("cross-tenant scoped read is denied (throws)", () => {
    const p = principal("u1", "tenant-a");
    expect(() => store.queryScoped({ tenant: "tenant-b" }, p)).toThrow();
  });

  it("unbound principal sees nothing", () => {
    const p = principal("u2"); // no organizationId
    expect(store.queryScoped({}, p)).toHaveLength(0);
  });
});

describe("EPIC-004 PHASE 1: query filtering", () => {
  let store: DurableAuditStore;
  beforeEach(() => {
    store = createMemoryDurableAuditStore();
    const base = { actor: "agent:ops", at: new Date().toISOString(), tenant: "t1" };
    store.append({ ...base, type: "exec.start", action: "start", category: "agent", workflow: "wf-1" });
    store.append({ ...base, type: "exec.stop", action: "stop", category: "agent", workflow: "wf-1" });
    store.append({ ...base, type: "auth.denied", action: "deny", category: "auth", decision: "deny", workflow: "wf-2" });
  });

  it("filters by category", () => {
    expect(store.query({ category: "auth" })).toHaveLength(1);
  });
  it("filters by workflow", () => {
    expect(store.query({ workflow: "wf-1" })).toHaveLength(2);
  });
  it("filters by decision", () => {
    expect(store.query({ decision: "deny" })).toHaveLength(1);
  });
  it("filters by time range", () => {
    const future = new Date(Date.now() + 100000).toISOString();
    const past = new Date(Date.now() - 100000).toISOString();
    expect(store.query({ since: past, until: future })).toHaveLength(3);
    expect(store.query({ since: future })).toHaveLength(0);
  });
  it("respects limit", () => {
    expect(store.query({ limit: 1 }).length).toBeLessThanOrEqual(1);
  });
});

describe("EPIC-004 PHASE 1: provider-neutral backend seam (D1-ready)", () => {
  it("store works over any AuditPersistenceBackend impl (no D1 coupling)", () => {
    // A hypothetical external backend could be swapped in here without
    // touching the store. We assert the in-memory backend satisfies it.
    const backend = new MemoryAuditBackend();
    const store2 = createDurableAuditStore(backend);
    store2.append({ type: "x", actor: "a", action: "go", at: new Date().toISOString() });
    expect(backend.query({})).toHaveLength(1);
  });
});
