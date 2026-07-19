// Smoketest for EPIC-002-006C services (registry/discovery/lifecycle).
// Run with: npx vitest run hermes.services.smoke.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { registerResource, listResources, updateResource, removeResource, _clearRegistry } from "../../hermes/services/registry/registry.js";
import { discoverApplications, discoverResourcesByOwner, discoverAgents, discoverProviderOfResource } from "../../hermes/services/discovery/discovery.js";
import { transitionResource, transitionAgent, LifecycleError } from "../../hermes/services/lifecycle/lifecycle.js";
import { listAgents, registerAgent, _clearAgents } from "../../hermes/agents/registry.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";

beforeEach(() => {
  // reset in-process stores
  _clearRegistry();
  _clearAgents();
  _clearAuditBuffer();
});

describe("EPIC-002-006C registry", () => {
  it("registers a provider-neutral resource and audits it", () => {
    const r = registerResource({
      kind: "worker",
      name: "ags-leads-worker",
      owner: "ags-fertility",
      env: "production",
      provider: "cloudflare",
      region: "ENAM",
      state: "active",
      meta: { binding: "DB" },
    }, "admin");
    expect(r.id).toMatch(/^res_/);
    expect(listResources({ owner: "ags-fertility" })).toHaveLength(1);
    // audit emitted
    const buf = readAuditBuffer();
    expect(buf.some((e: any) => e.type === "registry.register")).toBe(true);
  });

  it("queries without hardcoded topology", () => {
    registerResource({ kind: "database", name: "ags-db", owner: "ags-fertility", env: "production", provider: "cloudflare", state: "active" }, "admin");
    registerResource({ kind: "application", name: "AGS Fertility", owner: "ags-fertility", env: "*", provider: "cloudflare", state: "active" }, "admin");
    expect(discoverApplications().map((a: any) => a.name)).toContain("AGS Fertility");
    expect(discoverResourcesByOwner("ags-fertility").length).toBe(2);
    expect(discoverProviderOfResource(listResources({})[0].id)).toBe("cloudflare");
  });
});

describe("EPIC-002-006C lifecycle", () => {
  it("enforces legal resource transitions", () => {
    expect(() => transitionResource("r1", "active", "planned", "admin")).toThrow(LifecycleError);
    const t = transitionResource("r1", "planned", "active", "admin");
    expect(t.to).toBe("active");
  });

  it("NEVER auto-activates an agent without authorization", () => {
    registerAgent({
      id: "qa-agent",
      name: "QA Agent",
      domain: "quality",
      capabilities: [{ id: "test.run", description: "Run test suites", autonomous: false }],
      principalId: "principal:qa-agent",
      notes: "Phase 5 placeholder",
    });
    // unauth activation must fail
    expect(() => transitionAgent("qa-agent", "registered", "active", "admin", false)).toThrow(LifecycleError);
    // authorized move to assigned works
    const t = transitionAgent("qa-agent", "registered", "assigned", "admin", true);
    expect(t.to).toBe("assigned");
    expect(discoverAgents().find((a: any) => a.id === "qa-agent")?.state).toBe("registered");
  });
});
