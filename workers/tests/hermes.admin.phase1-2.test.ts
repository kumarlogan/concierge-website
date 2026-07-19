// EPIC-002-006E PHASE 1+2 — Admin Platform service layer + UI contracts.
import { describe, it, expect, beforeEach } from "vitest";
import { _clearAgents, registerAgent } from "../../hermes/agents/registry.js";
import { _clearAuditBuffer } from "../../hermes/audit/event.js";
import {
  requireDomainRead,
  requireAdminPermission,
  assertHumanPrincipal,
  deriveAdminRole,
} from "../../hermes/admin/access.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import { DASHBOARD_IA, CONSOLE_BOUNDARY, CONSOLE_AUTH } from "../../hermes/admin/ui-contracts.js";
import {
  adminViewApplications,
  adminViewWorkforce,
  adminViewServiceStatus,
  adminViewAuditTrail,
  adminViewAuthzDenials,
} from "../../hermes/admin/index.js";

const humanOwner: Principal = {
  id: "principal:admin-kl",
  permissions: [
    "hermes:admin:read",
    "hermes:admin:workforce-write",
    "hermes:admin:task-write",
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

describe("EPIC-002-006E Phase 1 — access gate", () => {
  it("allows a human owner to read every domain", () => {
    for (const d of DASHBOARD_IA) {
      expect(() => requireDomainRead(humanOwner, d.id)).not.toThrow();
    }
  });

  it("forbids agent principals from any admin call", () => {
    const agentPrincipal: Principal = { id: "agent:demo-agent", permissions: humanOwner.permissions };
    expect(() => assertHumanPrincipal(agentPrincipal)).toThrow(/HUMAN principal/);
    expect(() => requireDomainRead(agentPrincipal, "organization")).toThrow(/HUMAN principal/);
  });

  it("denies missing permission", () => {
    const viewer: Principal = { id: "principal:v", permissions: ["hermes:admin:read"] };
    expect(() => requireAdminPermission(viewer, "hermes:admin:role-grant")).toThrow(/requires/);
  });

  it("derives owner role from role-grant permission", () => {
    expect(deriveAdminRole(humanOwner)).toBe("owner");
  });
});

describe("EPIC-002-006E Phase 1 — visibility facade", () => {
  it("lists applications and agents for an authorized human", () => {
    expect(adminViewApplications(humanOwner)).toBeInstanceOf(Array);
    const roster = adminViewWorkforce(humanOwner);
    expect(roster.find((r) => r.agent.id === "demo-agent")).toBeDefined();
  });

  it("returns service statuses", () => {
    const statuses = adminViewServiceStatus(humanOwner);
    expect(statuses.length).toBeGreaterThan(0);
    expect(statuses[0]).toHaveProperty("id");
    expect(statuses[0]).toHaveProperty("health");
  });

  it("exposes audit trail and denials (audit-read required)", () => {
    const trail = adminViewAuditTrail(humanOwner);
    expect(trail).toBeInstanceOf(Array);
    expect(adminViewAuthzDenials(humanOwner)).toBeInstanceOf(Array);
  });

  it("blocks audit read for a principal without audit-read", () => {
    const noAudit: Principal = { id: "p", permissions: ["hermes:admin:read"] };
    expect(() => adminViewAuditTrail(noAudit)).toThrow(/requires/);
  });
});

describe("EPIC-002-006E Phase 2 — UI contracts", () => {
  it("defines six dashboard domains", () => {
    expect(DASHBOARD_IA).toHaveLength(6);
    const ids = DASHBOARD_IA.map((d) => d.id).sort();
    expect(ids).toEqual(
      ["organization", "resources", "workforce", "operations", "security", "platform-health"].sort(),
    );
  });

  it("boundary forbids direct service imports and requires auth entry", () => {
    expect(CONSOLE_BOUNDARY.authEntryRequired).toBe(true);
    expect(CONSOLE_BOUNDARY.forbiddenImports).toContain("hermes/services/*");
    expect(CONSOLE_AUTH.principalKind).toBe("human");
    expect(CONSOLE_AUTH.forbidden).toContain("agent principals");
  });
});
