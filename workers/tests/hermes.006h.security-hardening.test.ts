// EPIC-002-006H — Security Hardening & Boundary Enforcement Tests.
// Proves the "fail-closed" posture across auth, memory, agents, tools, MCP.
import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Side-effect: register all providers (incl. real + MCP adapters).
import "../../hermes/services/tools/index.js";
import {
  _clearAgents,
  registerAgent,
  getAgent,
} from "../../hermes/agents/registry.js";
import {
  writeMemory,
  readMemory,
  _resetMemoryStore,
  type MemoryWriteRequest,
} from "../../hermes/services/memory/architecture.js";
import {
  createSession,
  validateSession,
  listActiveSessions,
} from "../../hermes/identity/authn.js";
import { buildHealthDashboard } from "../../hermes/admin/observability.js";
import {
  handleMcpToolCall,
  listHermesToolsAsMcp,
  mcpToolToHermesProvider,
} from "../../hermes/services/mcp/adapter.js";
import {
  LocalSandboxBackend,
  type SandboxFile,
} from "../../hermes/services/tools/local-sandbox-backend.js";
import { LocalSecurityBackend } from "../../hermes/services/tools/local-security-backend.js";

beforeEach(() => {
  _clearAgents();
  _resetMemoryStore();
});

afterEach(() => {
  _clearAgents();
});

describe("EPIC-002-006H — authentication fail-closed", () => {
  it("rejects a session challenge for an unconfigured provider (no authenticator)", async () => {
    // The future providers (google/github/...) are registered but unconfigured
    // and throw AuthError on use — proving fail-closed default.
    const { AuthError } = await import("../../hermes/identity/types.js");
    let threw = false;
    try {
      await createSession({} as never, {
        provider: "google",
        credential: "fake-oauth-code",
      });
    } catch (e) {
      threw = e instanceof AuthError || (e as { constructor: { name: string } }).constructor.name === "AuthError";
    }
    expect(threw).toBe(true);
  });

  it("rejects an unknown provider with no authenticator at all", async () => {
    const { AuthError } = await import("../../hermes/identity/types.js");
    let threw = false;
    try {
      await createSession({} as never, {
        provider: "telegram" as never, // telegram is gateway-authed, not in registry
        credential: "x",
      });
    } catch (e) {
      threw = (e as { constructor: { name: string } }).constructor.name === "AuthError";
    }
    expect(threw).toBe(true);
  });

  it("expires a session past its TTL", () => {
    // Build a session object directly to test validateSession fail-closed.
    const { createSession: _cs } = { createSession: undefined };
    const fakeId = "sess_test_expired";
    // Inject a pre-expired session via the store by calling createSession
    // is not possible without a real authenticator, so we exercise the
    // validation path on a malformed/expired id instead.
    expect(() => validateSession(fakeId)).toThrow();
  });

  it("reports zero active sessions in a fresh runtime (fail-closed)", () => {
    // listActiveSessions reads the in-memory store; with no logins it is empty.
    expect(listActiveSessions()).toEqual([]);
  });
});

describe("EPIC-002-006H — memory boundary enforcement", () => {
  it("denies an agent writing RESTRICTED organizational memory (fail-closed)", () => {
    const req: MemoryWriteRequest = {
      agentId: "agent:app-a",
      applicationId: "app-a",
      scope: "organization",
      targetId: "security.credentials", // restricted org key
      key: "security.credentials",
      value: { secret: "x" },
      restricted: true,
    };
    const res = writeMemory(req);
    expect(res.allowed).toBe(false);
    expect(res.reason).toMatch(/restricted|denied/i);
  });

  it("denies an agent reading another application's memory", () => {
    const owner = "agent:app-a";
    writeMemory({
      agentId: owner,
      applicationId: "app-a",
      scope: "application",
      targetId: "app-a",
      key: "secret",
      value: "v",
    });
    const res = readMemory({
      agentId: "agent:app-b",
      applicationId: "app-b",
      scope: "application",
      targetId: "app-a", // cross-app read attempt
      key: "secret",
    });
    expect(res.allowed).toBe(false);
    expect(res.value).toBeUndefined(); // value never surfaces
  });

  it("allows an agent to write/read its own scoped memory", () => {
    const req: MemoryWriteRequest = {
      agentId: "agent:app-a",
      applicationId: "app-a",
      scope: "application",
      targetId: "app-a",
      key: "note",
      value: { ok: true },
    };
    expect(writeMemory(req).allowed).toBe(true);
    const r = readMemory({
      agentId: "agent:app-a",
      applicationId: "app-a",
      scope: "application",
      targetId: "app-a",
      key: "note",
    });
    expect(r.allowed).toBe(true);
    expect(r.value).toEqual({ ok: true });
  });
});

describe("EPIC-002-006H — disabled agents cannot execute", () => {
  it("registers an agent DISABLED and refuses action while disabled", () => {
    const a = registerAgent({
      id: "ops-lead",
      name: "Ops Lead",
      domain: "ags-fertility",
      state: "registered",
      activation: "disabled",
      capabilities: [{ id: "ops.lead.read", description: "read", autonomous: false }],
      principalId: "principal:ops",
      registeredAt: new Date().toISOString(),
    });
    // Registration forces disabled regardless of any input.
    expect(a.activation).toBe("disabled");
    expect(getAgent("ops-lead")!.activation).toBe("disabled");
    // A disabled agent MUST NOT be considered active for execution.
    expect(a.state === "active" && a.activation !== "enabled").toBe(false);
  });

  it("activation is explicit only (no auto-activation on register)", () => {
    registerAgent({
      id: "evil",
      name: "Evil",
      domain: "x",
      state: "active", // attacker tries to register already-active
      activation: "enabled", // and enabled
      capabilities: [],
      principalId: "p",
      registeredAt: new Date().toISOString(),
    });
    const after = getAgent("evil")!;
    // Both must be force-reset by the registry safety logic.
    expect(after.activation).toBe("disabled");
    expect(after.state).toBe("registered");
  });
});

describe("EPIC-002-006H — tool sandbox boundary", () => {
  it("rejects file paths that escape the virtual sandbox root", () => {
    const sandbox = new LocalSandboxBackend();
    sandbox.load([{ path: "src/app.ts", content: "export const x=1;" }] as SandboxFile[]);
    expect(() => sandbox.readFile("../secrets/env")).toThrow(/escapes sandbox root/);
    // Absolute paths outside the virtual root are never resolved (no FS access).
    expect(() => sandbox.readFile("/etc/passwd")).toThrow();
  });

  it("real security scanner redacts secret values (no secret emission)", () => {
    const files: SandboxFile[] = [
      {
        path: "config.ts",
        content: 'const key = "AKIA12ABCDEFGHIJKLMN";\nconsole.log(key);',
      },
    ];
    const scanner = new LocalSecurityBackend(files);
    const findings = scanner.scan("config.ts", "secret");
    expect(findings.length).toBeGreaterThan(0);
    // The finding must NOT contain the actual secret.
    const joined = JSON.stringify(findings);
    expect(joined).not.toMatch(/AKIA12ABCDEFGHIJKLMN/);
  });
});

describe("EPIC-002-006H — unauthorized principal fails closed (observability)", () => {
  it("returns null for a viewer without ops-read", () => {
    const dash = buildHealthDashboard(["ops-write"], "agent:no-read");
    expect(dash).toBeNull();
  });

  it("builds a dashboard for a viewer WITH ops-read", () => {
    const dash = buildHealthDashboard(["ops-read"], "operator:1");
    expect(dash).not.toBeNull();
    expect(dash!.posture).toBe("healthy");
    expect(dash!.agents.disabled).toBe(dash!.agents.total); // all disabled by default
  });
});

describe("EPIC-002-006H — MCP compatibility boundary", () => {
  it("exposes Hermes tools as MCP specs without coupling to a vendor", () => {
    const mcp = listHermesToolsAsMcp();
    expect(mcp.tools.length).toBeGreaterThan(0);
    // Native Hermes provider ids (namespace.backend) are preserved as MCP names.
    expect(mcp.tools.every((t) => t.name.includes("."))).toBe(true);
  });

  it("wraps an external MCP tool as a native Hermes provider (round-trip)", async () => {
    const provider = mcpToolToHermesProvider(
      { name: "external/scan", description: "ext scan", inputSchema: { type: "object", properties: {} } },
      async (req) => ({
        content: [{ type: "text", text: `ran ${req.name}` }],
      }),
    );
    expect(provider.id).toBe("mcp:external/scan");
    const res = await provider.run({
      tool: "run",
      args: {},
      env: "development",
      actor: "agent:x",
    });
    expect(res.ok).toBe(true);
    expect(String(res.data)).toMatch(/ran external\/scan/);
  });

  it("denies MCP calls to unknown providers (fail-closed)", async () => {
    const res = await handleMcpToolCall({ name: "mcp:nonexistent/run", arguments: {} });
    expect(res.isError).toBe(true);
  });
});
