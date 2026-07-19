// EPIC-002-006F PHASE 2+3+5 — BFF secure access layer, AI Workforce
// dashboard invariants, tool ecosystem readiness, and agent sandbox model.
import { describe, it, expect, beforeEach } from "vitest";
import { _clearAgents, registerAgent } from "../../hermes/agents/registry.js";
import { _clearAuditBuffer, readAuditBuffer } from "../../hermes/audit/event.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";
import { bffBootstrap, bffDomain } from "../../hermes/admin/bff.js";
import { viewGovernancePolicies } from "../../hermes/admin/governance.js";
import { adminViewWorkforce } from "../../hermes/admin/index.js";
import {
  beginEphemeralRun,
  sealEphemeralRun,
  requestApproval,
  guardToolCall,
  classifyToolApproval,
  type ToolGrant,
  type ToolNamespace,
} from "../../hermes/agents/tool-contracts.js";

const humanOwner: Principal = {
  id: "principal:admin-kl",
  permissions: [
    "hermes:admin:read",
    "hermes:admin:workforce-write",
    "hermes:admin:audit-read",
    "hermes:admin:role-grant",
  ],
};

// An agent principal must NEVER reach the admin boundary.
const agentPrincipal: Principal = {
  id: "agent:demo-agent",
  permissions: humanOwner.permissions,
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
    capabilities: [{ id: "cap-1", description: "d", autonomous: false }],
    principalId: "principal:demo",
    registeredAt: new Date().toISOString(),
  });
});

describe("EPIC-002-006F Phase 2 — BFF secure access layer", () => {
  it("accepts a verified human principal and returns a typed bootstrap", () => {
    const boot = bffBootstrap(humanOwner);
    expect(boot.role).toBe("owner");
    expect(boot.domains.workforce.ok).toBe(true);
    // Every agent is disabled-by-default (governance invariant).
    const roster = adminViewWorkforce(humanOwner);
    for (const a of roster) expect(a.agent.activation).toBe("disabled");
  });

  it("rejects an agent principal at the boundary (fail-closed)", () => {
    expect(() => bffDomain(agentPrincipal, "workforce")).toThrow(/HUMAN principal/);
    expect(() => bffBootstrap(agentPrincipal)).toThrow(/HUMAN principal/);
  });

  it("emits a governance audit trail on every BFF read", () => {
    bffDomain(humanOwner, "governance");
    const buf = readAuditBuffer();
    expect(buf.some((e) => e.type === "admin.bff.domain")).toBe(true);
  });

  it("scopes reads to the principal's permissions (no admin read → denied)", () => {
    const noAdmin: Principal = { id: "p", permissions: [] };
    // workforce domain requires hermes:admin:read; a principal with no admin
    // permissions must be rejected at the boundary.
    expect(() => bffDomain(noAdmin, "workforce")).toThrow(/requires/);
  });
});

describe("EPIC-002-006F Phase 3 — AI Workforce dashboard invariants", () => {
  it("governance policies enforce agents-disabled-by-default + human approval gate", () => {
    const policies = viewGovernancePolicies();
    const ids = policies.map((p) => p.id);
    expect(ids).toContain("policy:agent-disabled-by-default");
    expect(ids).toContain("policy:human-approval");
    expect(policies.filter((p) => p.enforced).length).toBe(policies.length);
  });

  it("roster shows agents disabled by default with no autonomous capabilities", () => {
    const roster = adminViewWorkforce(humanOwner);
    expect(roster.every((r) => r.agent.activation === "disabled")).toBe(true);
    expect(
      roster.every((r) => (r.agent.capabilities ?? []).every((c) => c.autonomous === false)),
    ).toBe(true);
  });
});

describe("EPIC-002-006F Phase 5a — Agent sandbox model", () => {
  const codeReadGrant: ToolGrant = {
    namespace: "tool:code.read" as ToolNamespace,
    applications: ["app-1"],
    environments: ["development", "staging"],
    autoApprove: true,
  };

  it("seals an ephemeral run and discards scratch state", () => {
    const run = beginEphemeralRun("demo-agent", "app-1", "development");
    expect(run.sealed).toBe(false);
    const sealed = sealEphemeralRun(run);
    expect(sealed.sealed).toBe(true);
    // Idempotent re-seal is a no-op.
    expect(sealEphemeralRun(sealed).sealed).toBe(true);
    const buf = readAuditBuffer();
    expect(buf.some((e) => e.type === "agent.ephemeral.begin")).toBe(true);
    expect(buf.some((e) => e.type === "agent.ephemeral.seal")).toBe(true);
  });

  it("refuses ephemeral execution outside an ephemeral/read-only sandbox", () => {
    const persistentPolicy = {
      tier: "persistent" as const,
      root: "/var/lib/agent",
      networkAllowlist: [],
      productionSecrets: true,
    };
    expect(() => beginEphemeralRun("demo-agent", "app-1", "development", persistentPolicy)).toThrow();
  });

  it("requires human approval for production write/exec", () => {
    expect(classifyToolApproval(codeReadGrant, "production", "write")).toBe("human");
    expect(classifyToolApproval(codeReadGrant, "production", "exec")).toBe("human");
  });

  it("emits a human-approval request that stays pending (no autonomous path)", () => {
    const req = requestApproval("demo-agent", "app-1", "production", "exec", "tool:code.exec" as ToolNamespace);
    expect(req.state).toBe("pending");
    const buf = readAuditBuffer();
    expect(buf.some((e) => e.type === "agent.request.approval")).toBe(true);
  });

  it("enforces application scoping on a tool grant", () => {
    // app-2 is not in the grant's allowed applications → must throw.
    expect(() =>
      guardToolCall("demo-agent", codeReadGrant, "development", "read", "tool:code.read" as ToolNamespace, "app-2"),
    ).toThrow(/not permitted for application/);
    // app-1 is allowed.
    expect(() =>
      guardToolCall("demo-agent", codeReadGrant, "development", "read", "tool:code.read" as ToolNamespace, "app-1"),
    ).not.toThrow();
  });

  it("enforces namespace separation (code grant cannot call security tools)", () => {
    expect(() =>
      guardToolCall("demo-agent", codeReadGrant, "development", "read", "tool:security.scan" as ToolNamespace, "app-1"),
    ).toThrow(/not permitted by grant/);
  });
});
