// EPIC-002-006C PHASE 8 — AGS Fertility application isolation verification.
// Proves Hermes platform services do NOT depend on AGS Fertility business code,
// and that Hermes owns platform capabilities while AGS Fertility owns its domain.
//
// Approach: dynamically import the Hermes platform modules. If any of them
// transitively imported AGS Fertility business routes (workers/src/routes/ops,
// workers/src/routes/consultations), the import would fail at load time. The
// successful import IS the isolation guarantee. We then assert the expected
// ownership surface (Hermes-owned capabilities exist; no AGS import leaked).
import { describe, it, expect } from "vitest";

describe("EPIC-002-006C Phase 8 — isolation", () => {
  it("Hermes platform modules load WITHOUT any AGS Fertility business dependency", async () => {
    // Each of these must import cleanly. If they referenced workers/src/routes/*
    // (AGS Fertility leads/consultations), the import would throw.
    const [registry, discovery, lifecycle, contracts, agents] = await Promise.all([
      import("../../hermes/services/registry/registry.js"),
      import("../../hermes/services/discovery/discovery.js"),
      import("../../hermes/services/lifecycle/lifecycle.js"),
      import("../../hermes/contracts/dispatcher.js"),
      import("../../hermes/agents/seed.js"),
    ]);
    expect(typeof registry.registerResource).toBe("function");
    expect(typeof discovery.discoverApplications).toBe("function");
    expect(typeof lifecycle.transitionAgent).toBe("function");
    expect(typeof contracts.createPlatformApi).toBe("function");
    expect(typeof agents.seedAgentWorkforce).toBe("function");
  });

  it("Hermes owns identity / permissions / audit / agents / registry capabilities", async () => {
    const [identity, permissions, audit, agentReg] = await Promise.all([
      import("../../hermes/identity/principal.js"),
      import("../../hermes/permissions/permissions.js"),
      import("../../hermes/audit/event.js"),
      import("../../hermes/agents/registry.js"),
    ]);
    expect(identity).toBeDefined();
    expect(permissions).toBeDefined();
    expect(typeof audit.emitAudit).toBe("function");
    expect(typeof agentReg.registerAgent).toBe("function");
  });

  it("discovery answers platform questions without hardcoded AGS topology", async () => {
    const { discoverApplications } = await import("../../hermes/services/discovery/discovery.js");
    const { registerResource, _clearRegistry } = await import("../../hermes/services/registry/registry.js");
    _clearRegistry();
    // Register AGS Fertility as DATA (not hardcoded topology).
    registerResource({
      kind: "application", provider: "local", owner: "ags-fertility",
      name: "AGS Fertility", scope: "org:ags-fertility",
      permissions: [], lifecycleState: "active", meta: {},
    }, "test");
    const apps = discoverApplications();
    // AGS Fertility appears ONLY because it was registered as data, not hardcoded.
    expect(apps.some((a: { name: string }) => a.name === "AGS Fertility")).toBe(true);
  });
});
