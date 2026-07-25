// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.6 Execution Gateway Suite           │
// │ PHASE 8 · single trust boundary: tenant + policy + approval    │
// │ + runtime-guard, one dispatch path.                            │
// │                                                               │
// │ No real CLI / network / secrets. Hand-built stubs only.        │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import {
  HermesExecutionGateway,
  type GatewayRequest,
  type GatewayProviderContext,
  type GatewayExecutor,
  type GatewayResult,
} from "../hermes-execution-gateway.js";
import {
  type ApprovalRef,
  type ApprovalService,
  createApprovalService,
  ApprovalError,
} from "../approval.js";
import { ExecutionPolicyEvaluator, type PolicyEvaluatorDeps } from "../../policy-evaluator.js";
import { ProviderRuntimeGuard } from "../../../providers/runtime/guard.js";
import { MemoryCapabilityRegistry } from "../../../providers/capability.js";
import { TransportRegistry } from "../../../providers/transport.js";
import { emitAudit, _clearAuditBuffer, readAuditBuffer } from "../../../../audit/event.js";
import type { Principal } from "../../../contracts/platform-api.js";
import type { ProviderManifestV2 } from "../../../providers/manifest-v2.js";
import type { TrustRecord } from "../../../providers/trust/lifecycle.js";
import type { ProviderRequest, ProviderOutcome } from "../../../providers/sdk.js";

// ── Fixtures ──────────────────────────────────────────────────────────────

const TENANT = "org-ags";
const PROVIDER = "cloudflare"; // providerId field is plain string
const APPROVER = "admin-1";

const PRINCIPAL: Principal = {
  id: "user-kl",
  permissions: ["capability:execute"],
  organizationId: TENANT,
  tenantId: TENANT,
};

const SCOPE = "app:ags-fertility|perm:execute";

function makeManifest(overrides: Partial<ProviderManifestV2> = {}): ProviderManifestV2 {
  return {
    id: "claude-code",
    name: "Claude Code",
    vendor: "anthropic",
    version: "1.0.0",
    manifestSchema: "v2",
    transports: [{ kind: "cli", auth: "token" }],
    capabilities: [{ id: "dev.code.generate", implKey: "gen", effects: ["exec"] }],
    permissions: [{ capability: "dev.code.generate", scope: "code", grantedBy: "manifest" }],
    trust: { level: "sandbox", authModel: "token" },
    health: { probe: "process", intervalMs: 30000, timeoutMs: 5000, healthyWithinMs: 10000 },
    limits: { maxConcurrent: 4, maxDurationMs: 600000 },
    approval: { requiredByDefault: false },
    lifecycle: { discoverable: true, autoLoad: true },
    ...overrides,
  };
}

function makeTrust(state: TrustRecord["state"] = "ACTIVE"): TrustRecord {
  return {
    providerId: "claude-code",
    vendor: "anthropic",
    version: "1.0.0",
    state,
    trustLevel: "sandbox",
    health: "healthy",
    failureCount: 0,
  };
}

function makeProviderCtx(overrides: Partial<GatewayProviderContext> = {}): GatewayProviderContext {
  const manifest = makeManifest(overrides.manifest);
  const registry = new MemoryCapabilityRegistry();
  registry.register([{ id: "dev.code.generate", name: "gen", provider: PROVIDER }]);
  const transports = new TransportRegistry();
  return {
    manifest,
    trust: makeTrust("ACTIVE"),
    transports,
    capabilities: registry,
    ...overrides,
  };
}

/** A recording executor that returns a success ProviderOutcome (incl. durationMs). */
function okExecutor() {
  const calls: { capabilityId: string; req: ProviderRequest }[] = [];
  const fn: GatewayExecutor = async (capabilityId, req) => {
    calls.push({ capabilityId, req });
    const outcome: ProviderOutcome = {
      ok: true,
      data: { ran: capabilityId },
      backend: "cloudflare",
      durationMs: 12,
    };
    return outcome;
  };
  return { fn, calls };
}

function baseRequest(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    executionId: "inv-1",
    tenantId: TENANT,
    principal: PRINCIPAL,
    capabilityId: "dev.code.generate",
    providerId: PROVIDER,
    providerRequest: {
      invocationId: "inv-1",
      capabilityId: "dev.code.generate",
      implKey: "gen",
      args: { prompt: "hi" },
      timeoutMs: 5000,
    },
    approvalRequired: false,
    lifecycleState: "approved",
    ...overrides,
  };
}

// ── Approval service helpers ────────────────────────────────────────────────

interface ApprovalRecord {
  id: string;
  approval?: { approver: string; capability: string; scope: string; at: string; expiresAt?: string };
}

/** In-memory fake of the durable approval store the ApprovalService reads. */
function makeApprovalStore(records: Map<string, { approval?: any }>) {
  return {
    get(id: string, _principal: Principal): { approval?: any } | undefined {
      return records.get(id);
    },
  };
}

function buildApprovalService(records: Map<string, { approval?: any }>, verifyApprover?: (a: string) => boolean): ApprovalService {
  return createApprovalService(makeApprovalStore(records), {
    verifyApprover: verifyApprover ?? ((a: string) => a === APPROVER),
  });
}

function validApprovalRef(overrides: Partial<ApprovalRef> = {}): ApprovalRef {
  const at = new Date(Date.now() - 1000).toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  return {
    id: "apr-1",
    approver: APPROVER,
    capability: "dev.code.generate",
    tenant: TENANT,
    scope: SCOPE,
    at,
    expiresAt,
    ...overrides,
  };
}

function seedRecord(ref: ApprovalRef): Map<string, { approval?: any }> {
  const m = new Map<string, { approval?: any }>();
  m.set(ref.id, {
    approval: {
      approver: ref.approver,
      capability: ref.capability,
      scope: ref.scope,
      at: ref.at,
      ...(ref.expiresAt ? { expiresAt: ref.expiresAt } : {}),
    },
  });
  return m;
}

// ── Gateway builder ──────────────────────────────────────────────────────────

interface BuildOpts {
  ctx?: GatewayProviderContext;
  approvalService?: ApprovalService;
  policy?: ExecutionPolicyEvaluator;
  guard?: ProviderRuntimeGuard;
}

function buildGateway(opts: BuildOpts) {
  const ctx = opts.ctx ?? makeProviderCtx();
  const policyDeps: PolicyEvaluatorDeps = {
    capabilities: ctx.capabilities,
    knownProviders: () => [PROVIDER, "claude-code"],
    verifyApprover: (a) => a === APPROVER,
  };
  const policy = opts.policy ?? new ExecutionPolicyEvaluator(policyDeps);
  const guard = opts.guard ?? new ProviderRuntimeGuard(emitAudit);
  return new HermesExecutionGateway({
    policy,
    guard,
    approvals: opts.approvalService ?? buildApprovalService(new Map()),
  });
}

function isAllow(r: GatewayResult): r is Extract<GatewayResult, { ok: true }> {
  return r.ok === true;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("EPIC-005.6 — HermesExecutionGateway (single trust boundary)", () => {
  beforeEach(() => {
    _clearAuditBuffer();
  });

  it("SUCCESS: all gates pass → executor runs once, returns normalized result", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest(), ctx, fn);

    expect(res.ok).toBe(true);
    if (isAllow(res)) {
      expect(res.outcome.ok).toBe(true);
      expect(res.outcome.backend).toBe("cloudflare");
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].capabilityId).toBe("dev.code.generate");
    // context carries tenant + principal for the guard's tenant-scope check
    expect((calls[0].req.context as Record<string, unknown>)?.tenantId).toBe(TENANT);
  });

  it("DENY: tenant mismatch (principal from different org) → tenant gate closes", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();
    const foreign: Principal = { ...PRINCIPAL, organizationId: "evil-org", tenantId: "evil-org" };

    const res = await gw.execute(baseRequest({ principal: foreign }), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("tenant-violation");
    expect(calls).toHaveLength(0);
  });

  it("DENY: policy rejects unknown capability → executor never runs", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ capabilityId: "does.not.exist" }), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("policy-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: policy rejects unknown provider → executor never runs", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ providerId: "rogue" as ProviderName }), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("policy-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: non-runnable lifecycle state → policy gate closes", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(
      baseRequest({ lifecycleState: "created" as unknown as GatewayRequest["lifecycleState"] }),
      ctx,
      fn,
    );

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("policy-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: missing approval when required (no ApprovalRef) → policy gate closes first", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ approvalRequired: true }), ctx, fn);

    // Policy (gate 2) runs before the structured approval gate (gate 3) and
    // already denies a required-but-absent approval → policy-denied.
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("policy-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: approval required but supplied approver is unknown → fail-closed", async () => {
    const { fn, calls } = okExecutor();
    const svc = buildApprovalService(seedRecord(validApprovalRef()), () => false); // ghost approver
    const gw = buildGateway({ approvalService: svc });
    const ctx = makeProviderCtx();

    const res = await gw.execute(baseRequest({ approvalRequired: true, approvalRef: validApprovalRef() }), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("approval-rejected");
    expect(calls).toHaveLength(0);
  });

  it("DENY: approval presented but not present in durable store → fail-closed", async () => {
    const svc = buildApprovalService(new Map()); // empty store
    const gw = buildGateway({ approvalService: svc });
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ approvalRequired: true, approvalRef: validApprovalRef() }), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("approval-rejected");
    expect(calls).toHaveLength(0);
  });

  it("DENY: expired approval → policy gate catches expiry before approval gate", async () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const ref = validApprovalRef({ expiresAt: past });
    const svc = buildApprovalService(seedRecord(ref));
    const gw = buildGateway({ approvalService: svc });
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ approvalRequired: true, approvalRef: ref }), ctx, fn);

    // Policy (gate 2) checks the ref's expiresAt and denies first → policy-denied.
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("policy-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: approval capability mismatch → fail-closed", async () => {
    const ref = validApprovalRef({ capability: "other.cap" });
    const svc = buildApprovalService(seedRecord(ref));
    const gw = buildGateway({ approvalService: svc });
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ approvalRequired: true, approvalRef: ref }), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("approval-rejected");
    expect(calls).toHaveLength(0);
  });

  it("ALLOW: valid unexpired ApprovalRef → executor runs", async () => {
    const ref = validApprovalRef();
    const svc = buildApprovalService(seedRecord(ref));
    const gw = buildGateway({ approvalService: svc });
    const ctx = makeProviderCtx();
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest({ approvalRequired: true, approvalRef: ref }), ctx, fn);

    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("DENY: runtime guard blocks (no trust record) → executor never runs", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx({ trust: undefined });
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest(), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("runtime-guard-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: runtime guard blocks (provider in non-runnable state) → executor never runs", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx({ trust: makeTrust("REJECTED") });
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest(), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("runtime-guard-denied");
    expect(calls).toHaveLength(0);
  });

  it("DENY: undeclared capability in manifest → guard capability-authz fails", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx({
      manifest: makeManifest({ capabilities: [{ id: "other.cap", implKey: "x" }] }),
    });
    const { fn, calls } = okExecutor();

    const res = await gw.execute(baseRequest(), ctx, fn);

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.code).toBe("runtime-guard-denied");
    expect(calls).toHaveLength(0);
  });

  it("Audit: emits a gateway decision event for an allowed execution", async () => {
    const gw = buildGateway({});
    const ctx = makeProviderCtx();
    const { fn } = okExecutor();

    await gw.execute(baseRequest(), ctx, fn);

    const events = readAuditBuffer();
    const gatewayEvents = events.filter((e: { type: unknown }) => String(e.type).startsWith("execution.gateway"));
    expect(gatewayEvents.length).toBeGreaterThanOrEqual(1);
  });
});

describe("EPIC-005.6 — createApprovalService verification", () => {
  it("verifies a valid, unexpired ref against a seeded store", () => {
    const svc = buildApprovalService(seedRecord(validApprovalRef()));
    expect(() =>
      svc.verify(validApprovalRef(), { capability: "dev.code.generate", tenant: TENANT, principal: PRINCIPAL }),
    ).not.toThrow();
  });

  it("throws ApprovalError when approver is unknown (fail-closed)", () => {
    const svc = buildApprovalService(seedRecord(validApprovalRef()), () => false);
    expect(() =>
      svc.verify(validApprovalRef(), { capability: "dev.code.generate", tenant: TENANT, principal: PRINCIPAL }),
    ).toThrow(ApprovalError);
  });

  it("throws ApprovalError when approval not found in store", () => {
    const svc = buildApprovalService(new Map());
    expect(() =>
      svc.verify(validApprovalRef(), { capability: "dev.code.generate", tenant: TENANT, principal: PRINCIPAL }),
    ).toThrow(ApprovalError);
  });

  it("throws ApprovalError on tenant mismatch (no cross-tenant replay)", () => {
    const svc = buildApprovalService(seedRecord(validApprovalRef()));
    expect(() =>
      svc.verify(validApprovalRef(), { capability: "dev.code.generate", tenant: "other-tenant", principal: PRINCIPAL }),
    ).toThrow(ApprovalError);
  });

  it("throws ApprovalError when the durable record is expired", () => {
    const past = new Date(Date.now() - 10_000).toISOString();
    const ref = validApprovalRef({ expiresAt: past });
    const svc = buildApprovalService(seedRecord(ref));
    expect(() =>
      svc.verify(ref, { capability: "dev.code.generate", tenant: TENANT, principal: PRINCIPAL }),
    ).toThrow(ApprovalError);
  });
});
