// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.5 Provider Runtime Guard           │
// │ PHASE 6 · 12 scenario validation suite                         │
// │                                                               │
// │ Provider-NEUTRAL. Builds a minimal fake Provider + manifest    │
// │ inline — NO Claude-specific, AGS-specific, or vendor imports.  │
// │ Proves every fail-closed check DENIES and the happy path        │
// │ ALLOWS, plus the marketplace read-only projection.             │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { ProviderRuntimeGuard, ViolationResponseEngine, MarketplaceSecurityView } from "../runtime/index.js";
import type { GuardContext, ViolationClass } from "../runtime/index.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";
import type { CapabilityRegistry } from "../capability.js";
import type { TransportRegistry, TransportKind } from "../transport.js";
import type { ProviderRequest, Provider, ProviderOutcome } from "../sdk.js";
import type { Principal } from "../../../contracts/platform-api.js";

// ── Fake transport registry ────────────────────────────────────────────────
function makeTransports(...kinds: TransportKind[]): TransportRegistry {
  const set = new Set(kinds);
  return {
    has: (k: TransportKind) => set.has(k),
    resolve: () => ({} as never),
    register: () => {},
    list: () => [...set],
  } as unknown as TransportRegistry;
}

// ── Fake capability registry ─────────────────────────────────────────────────
function makeCapabilities(...ids: string[]): CapabilityRegistry {
  const set = new Set(ids);
  return {
    has: (id: string) => set.has(id),
    register: () => {},
    get: () => undefined,
    list: () => [...set],
  } as unknown as CapabilityRegistry;
}

// ── Minimal valid manifest (provider-neutral) ─────────────────────────────────
const VALID_MANIFEST: ProviderManifestV2 = {
  id: "demo-provider",
  name: "Demo Provider",
  version: "1.0.0",
  transports: [{ kind: "cli", endpoint: "demo" }],
  capabilities: [{ id: "demo.echo", implKey: "demo-provider:echo" }],
  permissions: [{ capability: "demo.echo", scope: "demo", grantedBy: "operator" }],
  limits: { maxConcurrent: 2, maxDurationMs: 5000 },
  trust: { level: "sandbox", sandboxPolicy: { isolation: "seccomp" } },
} as unknown as ProviderManifestV2;

// ── Minimal fake provider (never actually executed in deny tests) ─────────────
function makeProvider(): Provider {
  return {
    initialize: async () => {},
    shutdown: async () => {},
    metadata: () => ({
      id: "demo-provider",
      vendor: "demo",
      version: "1.0.0",
      capabilities: ["demo.echo"],
      trustLevel: "sandbox",
    }),
    capabilities: async () => ["demo.echo"],
    execute: async (_req: ProviderRequest): Promise<ProviderOutcome> =>
      ({ ok: true, backend: "demo-provider", data: { echoed: true }, durationMs: 1 }),
    cancel: async () => {},
    health: async () => "healthy",
  };
}

// ── Friendly principal for happy-path / cross-tenant tests ─────────────────────
const SAME_TENANT_PRINCIPAL: Principal = {
  id: "principal:user-a",
  permissions: [],
  organizationId: "tenant-A",
  tenantId: "tenant-A",
};

const OTHER_TENANT_PRINCIPAL: Principal = {
  id: "principal:user-b",
  permissions: [],
  organizationId: "tenant-B",
  tenantId: "tenant-B",
};

interface BuildOpts {
  manifest?: ProviderManifestV2;
  transports?: TransportKind[];
  capabilities?: string[];
  trustState?: string;
  /** When set, no trust record is supplied (simulates never-admitted). */
  noTrust?: boolean;
  /** Request context overrides. */
  ctx?: Record<string, unknown>;
}

function buildCtx(opts: BuildOpts): GuardContext {
  const manifest = opts.manifest ?? VALID_MANIFEST;
  const transports = makeTransports(...(opts.transports ?? ["cli"]));
  const capabilities = makeCapabilities(...(opts.capabilities ?? ["demo.echo"]));
  const trust = opts.noTrust
    ? undefined
    : ({ id: "demo-provider", state: (opts.trustState ?? "ACTIVE") as never, createdAt: 0 } as never);
  const request: ProviderRequest = {
    invocationId: "inv-1",
    capabilityId: "demo.echo",
    implKey: "demo-provider:echo",
    args: {},
    timeoutMs: 1000,
    context: opts.ctx ?? { principal: SAME_TENANT_PRINCIPAL, targetTenantId: "tenant-A" },
  };
  return { providerId: "demo-provider", manifest, trust, request, transports, capabilities };
}

let guard: ProviderRuntimeGuard;
let audits: Array<{ type: string; actor: string; detail: Record<string, unknown> }>;

beforeEach(() => {
  audits = [];
  guard = new ProviderRuntimeGuard((type, actor, detail) => audits.push({ type, actor, detail }));
});

describe("EPIC-005.5 — Provider Runtime Guard (12 scenarios)", () => {
  it("SCENARIO 1: HAPPY PATH — valid execute is ALLOWED and bumps concurrency", () => {
    const d = guard.guard(buildCtx({}));
    expect(d.allow).toBe(true);
    expect(d.code).toBe("RUNTIME_ALLOWED");
    expect(guard.activeCount("demo-provider")).toBe(1);
    guard.release("demo-provider");
    expect(guard.activeCount("demo-provider")).toBe(0);
  });

  it("SCENARIO 2: UNKNOWN PROVIDER — no trust record ⇒ DENY (trust-state)", () => {
    const d = guard.guard(buildCtx({ noTrust: true }));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("trust-state");
    expect(d.code).toBe("RUNTIME_TRUST_MISSING");
  });

  it("SCENARIO 3: REVOKED PROVIDER — unrunnable trust state ⇒ DENY (trust-state)", () => {
    const d = guard.guard(buildCtx({ trustState: "REJECTED" }));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("trust-state");
    expect(d.code).toBe("RUNTIME_TRUST_STATE");
  });

  it("SCENARIO 4: MISSING CAPABILITY — capability not declared by manifest ⇒ DENY (capability-authz)", () => {
    const manifest = {
      ...VALID_MANIFEST,
      capabilities: [{ id: "demo.other", implKey: "demo-provider:other" }],
    } as unknown as ProviderManifestV2;
    const d = guard.guard(buildCtx({ manifest }));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("capability-authz");
    expect(d.code).toBe("CAPABILITY_UNKNOWN");
  });

  it("SCENARIO 5: MISSING PERMISSION — capability has no granted permission ⇒ DENY (permission-scope)", () => {
    const manifest = {
      ...VALID_MANIFEST,
      permissions: [],
    } as unknown as ProviderManifestV2;
    const d = guard.guard(buildCtx({ manifest }));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("permission-scope");
    expect(d.code).toBe("PERMISSION_DENIED");
  });

  it("SCENARIO 6: TENANT MISMATCH — principal bound to tenant-B targeting tenant-A ⇒ DENY (tenant-scope)", () => {
    const d = guard.guard(
      buildCtx({ ctx: { principal: OTHER_TENANT_PRINCIPAL, targetTenantId: "tenant-A" } }),
    );
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("tenant-scope");
    expect(d.code).toBe("RUNTIME_TENANT_SCOPE");
  });

  it("SCENARIO 7: MISSING PRINCIPAL — tenant boundary asserted but no principal ⇒ DENY (tenant-scope)", () => {
    const d = guard.guard(
      buildCtx({ ctx: { targetTenantId: "tenant-A" } }), // asserts boundary, but no principal
    );
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("tenant-scope");
    expect(d.code).toBe("RUNTIME_TENANT_CONTEXT");
  });

  it("SCENARIO 8: UNREGISTERED TRANSPORT — manifest declares unknown kind ⇒ DENY (transport-authz)", () => {
    const manifest = {
      ...VALID_MANIFEST,
      transports: [{ kind: "magic-bus", endpoint: "x" }],
    } as unknown as ProviderManifestV2;
    const d = guard.guard(buildCtx({ manifest, transports: ["cli"] }));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("transport-authz");
    expect(d.code).toBe("RUNTIME_TRANSPORT");
  });

  it("SCENARIO 9: TIMEOUT OVER LIMIT — request timeout > maxDurationMs ⇒ DENY (runtime-limits)", () => {
    const request: ProviderRequest = {
      invocationId: "inv-t",
      capabilityId: "demo.echo",
      implKey: "demo-provider:echo",
      args: {},
      timeoutMs: 99999,
      context: { principal: SAME_TENANT_PRINCIPAL, targetTenantId: "tenant-A" },
    };
    const ctx = buildCtx({});
    ctx.request = request;
    const d = guard.guard(ctx);
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("runtime-limits");
    expect(d.code).toBe("RUNTIME_TIMEOUT");
  });

  it("SCENARIO 10: CONCURRENCY OVER LIMIT — exceeds maxConcurrent ⇒ DENY (runtime-limits)", () => {
    const manifest = {
      ...VALID_MANIFEST,
      limits: { maxConcurrent: 1, maxDurationMs: 5000 },
    } as unknown as ProviderManifestV2;
    const ctx = buildCtx({ manifest });
    expect(guard.guard(ctx).allow).toBe(true); // 1st
    const d = guard.guard(ctx); // 2nd → exceeds
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("runtime-limits");
    expect(d.code).toBe("RUNTIME_CONCURRENCY");
    guard.release("demo-provider");
    guard.release("demo-provider");
  });

  it("SCENARIO 11: SANDBOX REQUIRED BUT NONE — trusted level, isolation 'none' ⇒ DENY (sandbox-requirements)", () => {
    const manifest = {
      ...VALID_MANIFEST,
      trust: { level: "trusted", sandboxPolicy: { isolation: "none" } },
    } as unknown as ProviderManifestV2;
    const d = guard.guard(buildCtx({ manifest }));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("sandbox-requirements");
    expect(d.code).toBe("RUNTIME_SANDBOX");
  });

  it("SCENARIO 12: AUDIT FAILURE — no audit sink ⇒ DENY (audit-availability)", () => {
    // Construct a real guard, then drop its audit sink at runtime. The guard's
    // `typeof this.audit !== "function"` check must then fail-closed DENY.
    const noAudit = new ProviderRuntimeGuard(() => {});
    (noAudit as unknown as { audit?: unknown }).audit = undefined;
    const d = noAudit.guard(buildCtx({}));
    expect(d.allow).toBe(false);
    expect(d.violationClass).toBe("audit-availability");
    expect(d.code).toBe("RUNTIME_AUDIT");
  });
});

describe("EPIC-005.5 — Violation Response Engine", () => {
  it("maps trust-state to HIGH (revoke + unload + critical-audit)", () => {
    const e = new ViolationResponseEngine(() => {});
    const r = e.classify("trust-state");
    expect(r.severity).toBe("HIGH");
    expect(r.deny).toBe(true);
    expect(r.actions).toEqual(["revoke", "unload", "critical-audit"]);
  });

  it("maps sandbox-requirements to MEDIUM (quarantine + alert)", () => {
    const e = new ViolationResponseEngine(() => {});
    const r = e.classify("sandbox-requirements");
    expect(r.severity).toBe("MEDIUM");
    expect(r.actions).toEqual(["quarantine", "alert"]);
  });

  it("maps tenant-scope to LOW (audit)", () => {
    const e = new ViolationResponseEngine(() => {});
    const r = e.classify("tenant-scope");
    expect(r.severity).toBe("LOW");
    expect(r.actions).toEqual(["audit"]);
  });

  it("never returns a continue/allow action on any class", () => {
    const e = new ViolationResponseEngine(() => {});
    const classes: ViolationClass[] = [
      "trust-state", "tenant-scope", "capability-authz", "permission-scope",
      "transport-authz", "runtime-limits", "sandbox-requirements", "audit-availability",
    ];
    for (const c of classes) {
      const r = e.classify(c);
      expect(r.deny).toBe(true);
      expect(r.actions.length).toBeGreaterThan(0);
    }
  });
});

describe("EPIC-005.5 — Marketplace Security Projection (read-only)", () => {
  it("answers SAFE=false with enumerable failure dimensions, no execution", () => {
    const view = new MarketplaceSecurityView();
    const answer = view.safeExecuteAnswer({
      providerId: "demo-provider",
      capabilityId: "demo.echo",
      manifest: VALID_MANIFEST,
      trust: undefined, // simulate not admitted
      transports: makeTransports("cli"),
      capabilities: makeCapabilities("demo.echo"),
    });
    expect(answer.safe).toBe(false);
    expect(answer.failures).toContain("trust-state");
    expect(answer.checks.length).toBe(8);
    expect(answer.checks.every((c) => typeof c.passed === "boolean")).toBe(true);
  });

  it("answers SAFE=true for a fully valid provider+capability", () => {
    const view = new MarketplaceSecurityView();
    const answer = view.safeExecuteAnswer({
      providerId: "demo-provider",
      capabilityId: "demo.echo",
      manifest: VALID_MANIFEST,
      trust: { id: "demo-provider", state: "ACTIVE", createdAt: 0 } as never,
      transports: makeTransports("cli"),
      capabilities: makeCapabilities("demo.echo"),
      request: { context: { principal: SAME_TENANT_PRINCIPAL, targetTenantId: "tenant-A" } },
    });
    expect(answer.safe).toBe(true);
    expect(answer.failures.length).toBe(0);
  });
});
