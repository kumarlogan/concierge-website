// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.3 Validation Suite                   │
// │ PHASE 8 · 12 transport-abstraction scenarios                   │
// │                                                               │
// │ Proves the Hermes-OWNED transport seam: provider identity is  │
// │ cleanly separated from transport mechanism. Uses an INJECTED  │
// │ fake spawner and a captured audit sink — no real CLI binary,  │
// │ no network, no secrets. Every resolution failure closes       │
// │ safely (fail-closed).                                         │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CliTransport } from "../transport/cli.js";
import { McpTransportBoundary } from "../transport/mcp.js";
import { TransportRegistry } from "../transport.js";
import type { Transport, TransportResult, InvocationEnvelope, TransportHealth } from "../transport.js";
import { executeOverTransport } from "../executor.js";
import type { TransportRequest } from "../executor.js";
import { reconcileTransportHealth } from "../transport-health.js";
import type { ProcessSpawner, SpawnedProcess } from "../transport/cli.js";

// Audit emitter is mocked at the module boundary. The test file lives in
// `services/providers/__tests__/`, one level deeper than `executor.ts`
// (services/providers/), so the specifier must be `../../../audit/emitter.js`
// to resolve to the SAME module that executor.ts imports (`../../audit/emitter.js`
// from services/providers/ == hermes/audit/emitter.js). Using the wrong depth
// would mock a non-existent path and silently leave the REAL emitter active.
const emitAuditMock = vi.hoisted(() => vi.fn());
vi.mock("../../../audit/emitter.js", () => ({
  emitAudit: emitAuditMock,
  setAuditSink: vi.fn(),
}));

// ── Fake spawner (mirrors EPIC-005.1 pattern) ────────────────────────────────
type SpawnBehavior =
  | { kind: "ok"; stdout?: string }
  | { kind: "fail"; exitCode: number; stderr?: string }
  | { kind: "timeout" }
  | { kind: "error"; message: string };

function makeSpawner(behavior: SpawnBehavior): ProcessSpawner {
  return (command, args, opts) => {
    void command; void args; void opts;
    const errorCbs: Array<(err: Error) => void> = [];
    const closeCbs: Array<(code: number | null) => void> = [];
    const onImpl = (event: "error" | "close", cb: (arg: Error | number | null) => void): void => {
      if (event === "error") errorCbs.push(cb as (err: Error) => void);
      else closeCbs.push(cb as (code: number | null) => void);
    };
    const proc: SpawnedProcess = {
      kill: () => {},
      stdout: { on: (_e: "data", _cb: (d: string) => void) => void 0 },
      stderr: { on: (_e: "data", _cb: (d: string) => void) => void 0 },
      on: onImpl as SpawnedProcess["on"],
    };
    queueMicrotask(() => {
      if (behavior.kind === "error") { errorCbs.forEach((cb) => cb(new Error(behavior.message))); return; }
      if (behavior.kind === "timeout") return; // never closes → TIMEOUT
      if (behavior.kind === "ok") { closeCbs.forEach((cb) => cb(0)); return; }
      if (behavior.kind === "fail") { closeCbs.forEach((cb) => cb(behavior.exitCode)); return; }
    });
    return proc;
  };
}

// ── Captured audit events ─────────────────────────────────────────────────────
let captured: Array<{ type: string; decision?: string; detail: Record<string, unknown> }> = [];
beforeEach(() => {
  captured = [];
  emitAuditMock.mockImplementation((type: string, _actor: string, detail: Record<string, unknown>, opts?: { decision?: string }) => {
    captured.push({ type, decision: opts?.decision, detail });
  });
});
afterEach(() => emitAuditMock.mockReset());

function req(over: Partial<TransportRequest> = {}): TransportRequest {
  return {
    providerId: "claude-code",
    implKey: "claude-code:generate",
    capabilityId: "dev.code.generate",
    payload: { subcommand: "generate", args: ["x"] },
    timeoutMs: 5000,
    invocationId: "inv-" + Math.random().toString(36).slice(2),
    actor: "user:kl",
    ...over,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("EPIC-005.3 — Provider Transport Abstraction Platform", () => {
  it("1. Transport contract is provider-neutral: CliTransport carries opaque payload, not capability semantics", async () => {
    const t = new CliTransport({ command: "echo", spawner: makeSpawner({ kind: "ok", stdout: "ran" }) });
    expect(t.kind).toBe("cli");
    expect(typeof t.id()).toBe("string");
    expect(t.connectionState()).toBe("disconnected");
    const env: InvocationEnvelope = {
      invocationId: "i1", providerId: "p", implKey: "p:c", payload: { arbitrary: 1 }, timeoutMs: 100, transportKind: "cli",
    };
    const r = await t.invoke(env);
    expect(r.backend).toBe("p");
    expect(r.transportKind).toBe("cli");
    expect(r.connectionState).toBe("connected");
  });

  it("2. TransportRegistry resolves by declared kind — single registered transport serves many providers", () => {
    const reg = new TransportRegistry();
    const a = new CliTransport({ command: "echo", spawner: makeSpawner({ kind: "ok", stdout: "a" }) });
    const b = new CliTransport({ command: "echo", spawner: makeSpawner({ kind: "ok", stdout: "b" }) });
    reg.register("cli", a);
    reg.register("cli", b);
    expect(reg.has("cli")).toBe(true);
    expect(reg.has("ssh")).toBe(false);
    expect(reg.resolve({ kind: "cli" })).toBe(a);
    expect(reg.all("cli").length).toBe(2);
  });

  it("3. TransportRegistry is FAIL-CLOSED: unknown kind → undefined, never a default/fallback", () => {
    const reg = new TransportRegistry();
    const reg2 = new TransportRegistry();
    reg2.register("cli", new CliTransport({ command: "echo", spawner: makeSpawner({ kind: "ok" }) }));
    expect(reg.resolve({ kind: "ssh" })).toBeUndefined();
    expect(reg2.resolve({ kind: "mcp" })).toBeUndefined();
    expect(reg2.resolve({ kind: "cli" })).not.toBeUndefined();
  });

  it("4. TransportExecutor routes invocation through Hermes-owned seam and emits success audit", async () => {
    const cli = new CliTransport({ command: "echo", spawner: makeSpawner({ kind: "ok", stdout: "ok" }) });
    const resolve = (kind: string) => (kind === "cli" ? cli : null);
    const out = await executeOverTransport(req(), resolve);
    expect(out.ok).toBe(true);
    if (out.ok) {
      expect(out.transportKind).toBe("cli");
      expect(out.transportId).toBe(cli.id());
    }
    const types = captured.map((c) => c.type);
    expect(types).toContain("transport.execute.start");
    expect(types).toContain("transport.execute.success");
    expect(captured.find((c) => c.type === "transport.execute.success")?.decision).toBe("allow");
  });

  it("5. TransportExecutor FAIL-CLOSED: unknown transport kind → UNKNOWN_TRANSPORT deny, no silent fallback", async () => {
    const resolve = () => null;
    const out = await executeOverTransport(req({ implKey: "ssh:run" }), resolve);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("UNKNOWN_TRANSPORT");
      expect(out.transportKind).toBe("unknown");
    }
    const deny = captured.find((c) => c.type === "transport.execute.denied");
    expect(deny).toBeDefined();
    expect(deny!.decision).toBe("deny");
  });

  it("6. TransportExecutor maps transport TIMEOUT into structured error outcome + failed audit", async () => {
    const cli = new CliTransport({ command: "sleep", spawner: makeSpawner({ kind: "timeout" }), defaultTimeoutMs: 30 });
    const resolve = (k: string) => (k === "cli" ? cli : null);
    const out = await executeOverTransport(req({ timeoutMs: 30 }), resolve);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("TIMEOUT");
      expect(out.transportCode).toBe("TIMEOUT");
    }
    const failed = captured.find((c) => c.type === "transport.execute.failed");
    expect(failed?.decision).toBe("deny");
  });

  it("7. TransportExecutor maps PROCESS_NONZERO into capability-structured error (not a crash)", async () => {
    const cli = new CliTransport({ command: "false", spawner: makeSpawner({ kind: "fail", exitCode: 2, stderr: "boom" }) });
    const resolve = (k: string) => (k === "cli" ? cli : null);
    const out = await executeOverTransport(req(), resolve);
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.code).toBe("PROCESS_NONZERO");
      expect(out.transportState).toBe("degraded");
    }
  });

  it("8. Transport Health Model reconciles 3 dimensions; unhealthy transport → effective unhealthy, not invocable", () => {
    const r = reconcileTransportHealth({
      provider: { status: "healthy", lifecycle: "ACTIVE", trustLevel: "trusted" },
      transport: { status: "unhealthy", kind: "cli", id: "cli:echo", connectionState: "failed" },
      capability: { status: "healthy", capabilityId: "dev.code.generate", available: true },
    });
    expect(r.effective).toBe("unhealthy");
    expect(r.invocable).toBe(false);
    expect(r.rationale).toContain("transport dimension");
  });

  it("9. Transport Health Model: degraded transport is invocable-but-watched (fail-open on degraded, fail-closed on unhealthy)", () => {
    const r = reconcileTransportHealth({
      provider: { status: "healthy", lifecycle: "ACTIVE", trustLevel: "trusted" },
      transport: { status: "degraded", kind: "cli", id: "cli:echo", connectionState: "degraded" },
      capability: { status: "healthy", capabilityId: "dev.code.generate", available: true },
    });
    expect(r.effective).toBe("degraded");
    expect(r.invocable).toBe(true);
  });

  it("10. MCP Transport Boundary FAILS CLOSED: no adapter → AUTH_REQUIRED, never carries a real invocation", async () => {
    const mcp = new McpTransportBoundary({
      endpoint: "https://mcp.example/x",
      auth: { scheme: "token", secretRef: "vault://mcp" },
      timeoutMs: 5000,
      requireDiscovery: true,
    });
    expect(mcp.kind).toBe("mcp");
    const res = await mcp.invoke({
      invocationId: "i", providerId: "p", implKey: "mcp:c", payload: {}, timeoutMs: 100, transportKind: "mcp",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.code).toBe("AUTH_REQUIRED");
      expect(res.transportKind).toBe("mcp");
    }
  });

  it("11. MCP Transport Boundary health reports unknown (not attached) without leaking vendor state", async () => {
    const mcp = new McpTransportBoundary({
      endpoint: "https://mcp.example/x",
      auth: { scheme: "none" },
      timeoutMs: 5000,
      requireDiscovery: false,
    });
    const h: TransportHealth = await mcp.health();
    expect(h.status).toBe("unknown");
    expect(h.kind).toBe("mcp");
    expect(h.detail).toContain("not attached");
  });

  it("12. CliTransport connection state transitions disconnected → connected → degraded across invocations", async () => {
    const cli = new CliTransport({ command: "echo", spawner: makeSpawner({ kind: "ok", stdout: "x" }) });
    expect(cli.connectionState()).toBe("disconnected");
    await cli.connect();
    const r1 = await cli.invoke({ invocationId: "a", providerId: "p", implKey: "p:c", payload: {}, timeoutMs: 100, transportKind: "cli" });
    expect(r1.connectionState).toBe("connected");
    // A failing call should mark degraded.
    const cliBad = new CliTransport({ command: "false", spawner: makeSpawner({ kind: "fail", exitCode: 1, stderr: "e" }) });
    await cliBad.connect();
    await cliBad.invoke({ invocationId: "b", providerId: "p", implKey: "p:c", payload: {}, timeoutMs: 100, transportKind: "cli" });
    expect(cliBad.connectionState()).toBe("degraded");
  });
});
