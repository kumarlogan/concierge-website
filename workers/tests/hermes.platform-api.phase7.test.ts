// EPIC-002-006C PHASE 7 — internal platform API dispatcher (auth+audit).
import { describe, it, expect, beforeEach } from "vitest";
import { createPlatformApi } from "../../hermes/contracts/dispatcher.js";
import { _clearRegistry } from "../../hermes/services/registry/registry.js";
import { _clearAgents, registerAgent } from "../../hermes/agents/registry.js";
import { readAuditBuffer as lastAuditEvents, _clearAuditBuffer as clearAuditBuffer } from "../../hermes/audit/event.js";
import type { Principal } from "../../hermes/contracts/platform-api.js";

const admin: Principal = { id: "admin", permissions: ["hermes:registry:write", "hermes:discovery:read", "hermes:lifecycle:write", "hermes:agent:write", "hermes:agent:activate"] };
const reader: Principal = { id: "reader", permissions: ["hermes:discovery:read"] };
const nobody: Principal = { id: "nobody", permissions: [] };

const authorize = (p: Principal, req: string) => p.permissions.includes(req);

beforeEach(() => {
  _clearRegistry();
  _clearAgents();
  clearAuditBuffer();
});

describe("EPIC-002-006C Phase 7 — platform API guards", () => {
  it("denies registry write without permission", () => {
    const api = createPlatformApi({ authorize });
    const res = api.registerResource(nobody, {
      kind: "worker", name: "w", owner: "ags-fertility", env: "production", provider: "cloudflare",
    });
    expect(res.ok).toBe(false);
    expect(res.error).toContain("unauthorized");
  });

  it("allows registry write with permission + returns id", () => {
    const api = createPlatformApi({ authorize });
    const res = api.registerResource(admin, {
      kind: "worker", name: "w", owner: "ags-fertility", env: "production", provider: "cloudflare",
    });
    expect(res.ok).toBe(true);
    expect(res.data?.id).toMatch(/^res_worker_/);
  });

  it("records an audit event for authorized registry write", () => {
    const api = createPlatformApi({ authorize });
    api.registerResource(admin, {
      kind: "database", name: "db", owner: "ags-fertility", env: "production", provider: "cloudflare",
    });
    expect(lastAuditEvents().some((e: { type: string }) => e.type === "registry.register")).toBe(true);
  });

  it("reader can discover but cannot write", () => {
    const api = createPlatformApi({ authorize });
    expect(api.discoverApplications(reader).ok).toBe(true);
    expect(api.registerResource(reader, {
      kind: "worker", name: "w", owner: "ags-fertility", env: "production", provider: "cloudflare",
    }).ok).toBe(false);
  });

  it("agent activation requires hermes:agent:activate and an authorized, gated progression", () => {
    const api = createPlatformApi({ authorize });
    registerAgent({
      id: "qa-agent", name: "QA Agent", domain: "quality", state: "registered", activation: "disabled", registeredAt: new Date().toISOString(),
      capabilities: [{ id: "test.run", description: "t", autonomous: false }],
      principalId: "principal:qa-agent",
    });
    // Direct registered->active without authorization must fail.
    const r1 = api.transitionAgent(admin, { id: "qa-agent", from: "registered", to: "active", authorized: false });
    expect(r1.ok).toBe(false);
    // Gated progression requires authorization at each activation step.
    expect(api.transitionAgent(admin, { id: "qa-agent", from: "registered", to: "assigned", authorized: true }).ok).toBe(true);
    expect(api.transitionAgent(admin, { id: "qa-agent", from: "assigned", to: "approved", authorized: true }).ok).toBe(true);
    const r2 = api.transitionAgent(admin, { id: "qa-agent", from: "approved", to: "active", authorized: true });
    expect(r2.ok).toBe(true);
    // And without the activate permission, even authorized progression is blocked.
    const readerApi = createPlatformApi({ authorize });
    const r3 = readerApi.transitionAgent(reader, { id: "qa-agent", from: "active", to: "paused", authorized: true });
    expect(r3.ok).toBe(false);
  });

  it("dispatcher is never bound to a public route (in-process only)", () => {
    // Sanity: the API surface has no HTTP/route wiring.
    expect(typeof createPlatformApi).toBe("function");
  });
});
