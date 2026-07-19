// EPIC-002-006E PHASE 3+4 — Tool contracts + provider-abstracted adapters.
import { describe, it, expect, beforeEach } from "vitest";
// Import the barrel to trigger provider registration side-effects.
import "../../hermes/services/tools/index.js";
import {
  registerToolProvider,
  resolveProvider,
  listToolProviders,
  type ToolCall,
} from "../../hermes/services/tools/tool-provider.js";
import {
  guardToolCall,
  classifyToolApproval,
  resolveMemoryScope,
  DEFAULT_SANDBOX,
  type ToolGrant,
} from "../../hermes/agents/tool-contracts.js";
import { _clearAgents, registerAgent } from "../../hermes/agents/registry.js";

const devCall: ToolCall = {
  tool: "tool:code.exec",
  args: { cmd: "echo hi", cwd: "." },
  env: "development",
  actor: "agent:developer-agent-local",
};

beforeEach(() => {
  _clearAgents();
  registerAgent({
    id: "developer-agent-local",
    name: "Local Dev",
    domain: "engineering",
    state: "registered",
    activation: "disabled",
    capabilities: [{ id: "code.local.run", description: "run", autonomous: false }],
    principalId: "principal:dev",
    memoryScope: "isolated",
    registeredAt: new Date().toISOString(),
  });
});

describe("EPIC-002-006E Phase 4 — tool providers register", () => {
  it("registers domain providers (native + real backends)", () => {
    const ids = listToolProviders().map((p) => p.id).sort();
    expect(ids).toEqual(
      [
        "tool:code.local-shell",
        "tool:code.local-sandbox",
        "tool:docs.store",
        "tool:monitor.gateway",
        "tool:research.engine",
        "tool:security.local-scanner",
        "tool:security.scanner",
      ].sort(),
    );
  });

  it("resolves a provider by namespace", () => {
    expect(resolveProvider("tool:code")?.id).toBe("tool:code.local-shell");
    expect(resolveProvider("tool:monitor")?.id).toBe("tool:monitor.gateway");
  });

  it("refuses duplicate registration", () => {
    expect(() =>
      registerToolProvider({ id: "tool:code.local-shell", label: "x", run: () => ({ ok: true, backend: "x" }) }),
    ).toThrow(/already registered/);
  });
});

describe("EPIC-002-006E Phase 4 — dev tool safety", () => {
  it("blocks production write without approval token", async () => {
    const p = resolveProvider("tool:code")!;
    const res = await p.run({ ...devCall, env: "production" });
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/approval token/);
  });

  it("allows development exec", async () => {
    const p = resolveProvider("tool:code")!;
    const res = await p.run(devCall);
    expect(res.ok).toBe(false); // noop backend returns code 1, but no auth error
    expect(res.error).toBeUndefined();
  });
});

describe("EPIC-002-006E Phase 3 — tool contracts", () => {
  const grant: ToolGrant = {
    namespace: "tool:code",
    applications: ["hermes-platform"],
    environments: ["development", "staging"],
    autoApprove: false,
  };

  it("classifies prod write as human approval", () => {
    expect(classifyToolApproval(grant, "production", "write")).toBe("human");
    expect(classifyToolApproval(grant, "production", "exec")).toBe("human");
  });

  it("classifies dev read as auto", () => {
    expect(classifyToolApproval(grant, "development", "read")).toBe("auto");
  });

  it("guardToolCall throws on forbidden namespace", () => {
    expect(() =>
      guardToolCall("agent:x", grant, "development", "read", "tool:security.scan" as never),
    ).toThrow(/not permitted/);
  });

  it("default sandbox has no production secrets", () => {
    expect(DEFAULT_SANDBOX.productionSecrets).toBe(false);
    expect(DEFAULT_SANDBOX.tier).toBe("ephemeral");
  });

  it("resolves isolated memory scope by default", () => {
    const agent = _clearAgents_and_get();
    expect(resolveMemoryScope(agent)).toBe("isolated");
  });
});

// helper: re-register after clear to get a handle
function _clearAgents_and_get() {
  _clearAgents();
  return registerAgent({
    id: "m", name: "M", domain: "d", state: "registered", activation: "disabled",
    capabilities: [], principalId: "p", memoryScope: "isolated", registeredAt: new Date().toISOString(),
  });
}
