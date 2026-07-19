// EPIC-002-006G PHASE 4 — Safe tool adapter (default-deny, MCP-ready).
import { describe, it, expect } from "vitest";
import type { ToolProvider, ToolCall, ToolResult } from "../../hermes/services/tools/tool-provider.js";
import type { ToolCapability } from "../../hermes/services/tools/tool-capabilities.js";
import { ConsoleToolAdapter, buildConsoleToolAdapter } from "../../hermes/admin/console/tool-adapter.js";

const fakeProvider: ToolProvider = {
  id: "dev.local-shell",
  label: "fake",
  run(call: ToolCall): ToolResult {
    if (call.tool === "tool:code.read") return { ok: true, data: { content: "x" }, backend: this.id };
    if (call.tool === "tool:code.write") return { ok: true, backend: this.id };
    return { ok: false, error: "unknown", backend: this.id };
  },
};

const caps: ToolCapability[] = [
  { id: "tool:code.read", description: "read", requiresApproval: false },
  { id: "tool:code.write", description: "write", requiresApprovalIn: ["development", "production"] },
];

describe("EPIC-002-006G Phase 4 — console tool adapter safety", () => {
  it("admits only allowlisted tools (default-deny)", async () => {
    const adapter = new ConsoleToolAdapter(fakeProvider, new Set(["tool:code.read"]), caps);
    const ok = await adapter.invoke({ tool: "tool:code.read", args: {}, env: "development", actor: "p" });
    expect(ok.ok).toBe(true);
    const blocked = await adapter.invoke({ tool: "tool:code.write", args: {}, env: "development", actor: "p" });
    expect(blocked.ok).toBe(false);
    expect(blocked.error).toMatch(/allowlist/);
  });

  it("requires a human approval token for write capabilities", async () => {
    const adapter = new ConsoleToolAdapter(
      fakeProvider,
      new Set(["tool:code.read", "tool:code.write"]),
      caps,
    );
    const noToken = await adapter.invoke({ tool: "tool:code.write", args: {}, env: "development", actor: "p" });
    expect(noToken.ok).toBe(false);
    expect(noToken.error).toMatch(/approval token/);
    const withToken = await adapter.invoke({
      tool: "tool:code.write", args: {}, env: "development", actor: "p", approvalToken: "human-123",
    });
    expect(withToken.ok).toBe(true);
  });

  it("never throws — surfaces provider errors as ToolResult", async () => {
    const boom: ToolProvider = { id: "x", label: "x", run: () => { throw new Error("explode"); } };
    const adapter = new ConsoleToolAdapter(boom, new Set(["tool:code.read"]));
    const r = await adapter.invoke({ tool: "tool:code.read", args: {}, env: "development", actor: "p" });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/explode/);
  });

  it("builds from a registered provider id (or returns null)", () => {
    const registry = new Map<string, ToolProvider>([["dev.local-shell", fakeProvider]]);
    const resolve = (id: string) => registry.get(id);
    const a = buildConsoleToolAdapter("dev.local-shell", ["tool:code.read"], caps, resolve);
    expect(a).not.toBeNull();
    expect(buildConsoleToolAdapter("missing", ["tool:code.read"], caps, resolve)).toBeNull();
  });
});
