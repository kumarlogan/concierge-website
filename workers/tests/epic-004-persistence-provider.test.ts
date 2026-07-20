// EPIC-004 PHASE 5 — Persistence Provider seam tests
// Run with: npx vitest run epic-004-persistence-provider.test.ts
import { describe, it, expect } from "vitest";
import {
  createPersistenceProvider,
  MemoryPersistenceProvider,
} from "../../hermes/persistence/provider.js";

describe("EPIC-004 PHASE 5: provider-neutral persistence seam", () => {
  it("memory provider bundles the three durable stores", () => {
    const p = new MemoryPersistenceProvider();
    expect(p.kind).toBe("memory");
    expect(p.auditStore()).toBeDefined();
    expect(p.durableAuditStore()).toBeDefined();
    expect(p.workflowStore()).toBeDefined();
    expect(p.agentStore()).toBeDefined();
  });

  it("stores are cached (same instance per capability)", () => {
    const p = new MemoryPersistenceProvider();
    expect(p.auditStore()).toBe(p.auditStore());
    expect(p.workflowStore()).toBe(p.workflowStore());
    expect(p.agentStore()).toBe(p.agentStore());
  });

  it("createPersistenceProvider('memory') resolves", () => {
    const p = createPersistenceProvider("memory");
    expect(p.kind).toBe("memory");
  });

  it("future providers (d1/postgres/kv) are declared but not implemented (no vendor lock-in)", () => {
    for (const kind of ["d1", "postgres", "kv"] as const) {
      expect(() => createPersistenceProvider(kind)).toThrow(/future-ready|not yet implemented/i);
    }
  });
});
