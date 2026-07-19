// EPIC-002-006G PHASE 1 — Renderer fail-closed boundary + real domain output.
import { describe, it, expect, beforeEach } from "vitest";
import { _clearAgents, registerAgent } from "../../hermes/agents/registry.js";
import { _clearAuditBuffer } from "../../hermes/audit/event.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import { ConsoleSession } from "../../hermes/admin/console/session.js";
import { bffClientFor } from "../../hermes/admin/console/bff-client.js";
import { renderConsole, renderDomain } from "../../hermes/admin/console/app.js";

const owner: Principal = {
  id: "principal:admin-kl",
  permissions: [
    "hermes:admin:read",
    "hermes:admin:workforce-read",
    "hermes:admin:audit-read",
    "hermes:admin:role-grant",
  ],
};

beforeEach(() => {
  _clearAgents();
  _clearAuditBuffer();
  registerAgent({
    id: "demo-agent",
    name: "Demo Agent",
    domain: "engineering",
    state: "registered",
    activation: "disabled",
    capabilities: [{ id: "x", description: "d", autonomous: false }],
    principalId: "principal:demo",
    registeredAt: new Date().toISOString(),
  });
});

describe("EPIC-002-006G Phase 1 — renderer output & boundary", () => {
  it("renders all six domains with real governance data", async () => {
    const sess = ConsoleSession.establish(owner);
    const md = await renderConsole(bffClientFor(sess.principal));
    expect(md).toContain("# Hermes Admin Console");
    for (const d of ["Organization", "Infrastructure", "AI Workforce", "Security", "Operations", "Governance"]) {
      expect(md).toContain(d);
    }
    // Governance domain renders real ADRs from the live facade.
    expect(md).toMatch(/ADR-0\d\d/);
  });

  it("renders a disabled-by-default safety invariant badge", async () => {
    const sess = ConsoleSession.establish(owner);
    const md = await renderConsole(bffClientFor(sess.principal));
    expect(md).toMatch(/disabled by default|non-autonomous/i);
  });

  it("fails closed when a principal lacks domain permission", () => {
    const viewer: Principal = { id: "principal:viewer", permissions: ["hermes:admin:read"] };
    const sess = ConsoleSession.establish(viewer);
    // governance requires audit-read; viewer lacks it -> the BFF returns ok:false
    // and renderDomain fails closed with a REDACTED block.
    const out = renderDomain(sess.principal, { id: "governance", label: "Governance", description: "", panels: [] });
    expect(out).toMatch(/REDACTED|access denied/);
  });
});
