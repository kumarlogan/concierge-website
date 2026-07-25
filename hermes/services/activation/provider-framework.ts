// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Capability Provider Framework               │
// │ EPIC-002-007 · M1 (Provider activation framework)             │
// │                                                 DESIGN:        │
// │  • Extends (does NOT replace) the existing ToolProvider        │
// │    execution primitive in services/tools/tool-provider.ts.     │
// │  • Adds the governance layer the epic requires:                │
// │      – provider lifecycle (registered → enabled → active → …) │
// │      – health probing                                         │
// │      – enable / disable (fail-closed: disabled = no calls)    │
// │      – dynamic capability discovery (no hardcoded providers)  │
// │      – fail-closed: a provider that is not HEALTHY+ENABLED     │
// │        MUST NOT execute — calls are refused, never silently    │
// │        routed to a fallback vendor.                            │
// │  • Vendor SDKs are NEVER imported here. Concrete backends are  │
// │    injected via the CapabilityExecutor port (see claude-code). │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  type ToolProvider,
  type ToolCall,
  type ToolResult,
} from "../tools/tool-provider.js";
import type { Principal } from "../../contracts/platform-api.js";
import { PLATFORM_PERMISSIONS } from "../../contracts/platform-api.js";
import { HermesExecutionGateway } from "../execution/gateway/hermes-execution-gateway.js";
import type { GatewayRequest, GatewayProviderContext } from "../execution/gateway/hermes-execution-gateway.js";
import { ExecutionPolicyEvaluator, type PolicyEvaluatorDeps } from "../execution/policy-evaluator.js";
import {
  type ApprovalRef,
  type ApprovalService,
  createApprovalService,
  approvalRefFromRecord,
} from "../execution/gateway/approval.js";
// Re-export the canonical ApprovalRef so legacy activation modules import it
// from the provider-framework seam (single source of truth, no duplication).
export type { ApprovalRef } from "../execution/gateway/approval.js";
import {
  type ExecutionApproval,
  type ExecutionStore,
  createExecutionStore,
  MemoryExecutionBackend,
} from "../../persistence/execution-store.js";
import {
  ProviderRuntimeGuard,
  type GuardContext,
  type GuardDecision,
} from "../providers/runtime/index.js";
import { TransportRegistry } from "../providers/transport.js";
import { MemoryCapabilityRegistry, type Capability, type CapabilityRegistry } from "../providers/capability.js";
import type { ProviderManifestV2 } from "../providers/manifest-v2.js";
import type { ProviderRequest, ProviderOutcome } from "../providers/sdk.js";
import { okResult, errResult } from "../providers/sdk.js";

// ─── Lifecycle ─────────────────────────────────────────────────

export type ProviderLifecycleState =
  | "registered"
  | "enabled"
  | "active"
  | "disabled"
  | "failed"
  | "retired";

/** Legal provider lifecycle transitions (fail-closed by construction). */
const PROVIDER_TRANSITIONS: Record<ProviderLifecycleState, ProviderLifecycleState[]> = {
  registered: ["enabled", "retired"],
  enabled: ["active", "disabled", "retired"],
  active: ["disabled", "failed", "retired"],
  disabled: ["enabled", "retired"],
  failed: ["disabled", "retired"],
  retired: [],
};

export function canTransitionProvider(
  from: ProviderLifecycleState,
  to: ProviderLifecycleState,
): boolean {
  return PROVIDER_TRANSITIONS[from]?.includes(to) ?? false;
}

// ─── Health ────────────────────────────────────────────────────

/**
 * Provider health states (EPIC-003-004 / M5).
 *  • healthy      — responsive, executing normally
 *  • degraded     — responsive but impaired (partial results, retries)
 *  • offline      — expected to be reachable but not responding
 *  • not_installed — the concrete backend binary/SDK is absent (fail-closed)
 *  • unknown      — never probed
 *
 * NOTE: backward compatible — existing callers only ever assign
 * "healthy" | "unhealthy" | "degraded" | "unknown". The two new states
 * ("offline", "not_installed") are produced by the health monitor and by
 * provider adapters that detect a missing backend.
 */
export type ProviderHealth =
  | "unknown"
  | "healthy"
  | "degraded"
  | "unhealthy"
  | "offline"
  | "not_installed";

export interface HealthReport {
  health: ProviderHealth;
  checkedAt: string;
  detail?: string;
}

// ─── Capability descriptor (dynamic discovery) ────────────────

/**
 * A capability a provider advertises. The platform negotiates on these IDs;
 * never on concrete backend names. This is what lets a Developer Agent say
 * "I need code.generation" and Hermes resolve ANY provider that exposes it.
 */
export interface CapabilityDescriptor {
  /** Stable capability ID, namespaced (e.g. "dev.code.generate"). */
  id: string;
  /** Human description. */
  description: string;
  /** If true, any use requires a human approval token. */
  requiresApproval?: boolean;
  /** Environments that require an approval token. */
  requiresApprovalIn?: Array<"development" | "staging" | "production">;
}

// ─── Executor port (vendor-neutral) ───────────────────────────

/**
 * The ONLY extension point a concrete vendor backend implements. The platform
 * never imports a vendor SDK; it calls this port. If the port is unset (e.g.
 * the real Claude Code CLI is not wired in a given deploy), the provider is
 * fail-closed and refuses execution — it never fabricates a result.
 */
export type CapabilityExecutor = (
  capability: string,
  args: Record<string, unknown>,
  ctx: { actor: string; env: ToolCall["env"] },
) => Promise<ToolResult> | ToolResult;

// ─── Managed provider record ──────────────────────────────────

export interface ManagedProvider {
  /** Stable provider id, e.g. "dev.claude-code". */
  id: string;
  /** Human label. */
  label: string;
  /** The kind of capability domain this provider serves. */
  domain: "development" | "security" | "research" | "documentation" | "monitoring" | "social";
  lifecycle: ProviderLifecycleState;
  health: HealthReport;
  /** Capabilities this provider advertises (dynamic discovery source). */
  capabilities: CapabilityDescriptor[];
  /** Whether the provider is currently enabled for use. */
  enabled: boolean;
  /** Optional injected executor (vendor backend). */
  executor?: CapabilityExecutor;
  /** Backend provenance string (for audit only). */
  backend: string;
  registeredAt: string;
  updatedAt: string;
}

// ─── Registry ─────────────────────────────────────────────────

const REGISTRY = new Map<string, ManagedProvider>();

function nowIso(): string {
  return new Date().toISOString();
}

/** Register a provider. Starts in "registered" (fail-closed, not executable). */
export function registerProvider(p: {
  id: string;
  label: string;
  domain: ManagedProvider["domain"];
  capabilities: CapabilityDescriptor[];
  backend: string;
  executor?: CapabilityExecutor;
}): ManagedProvider {
  if (REGISTRY.has(p.id)) {
    throw new Error(`Provider already registered: ${p.id}`);
  }
  const ts = nowIso();
  const rec: ManagedProvider = {
    ...p,
    lifecycle: "registered",
    health: { health: "unknown", checkedAt: ts },
    enabled: false,
    registeredAt: ts,
    updatedAt: ts,
  };
  REGISTRY.set(p.id, rec);
  emitAudit("provider.registered", "system", { id: p.id, domain: p.domain });
  return rec;
}

/**
 * Enable a provider for use. Requires an authorized principal — providers are
 * NEVER auto-enabled. Fail-closed: a registered provider cannot execute until
 * explicitly enabled by a human/authorized principal.
 */
export function enableProvider(id: string, principal: Principal): ManagedProvider {
  if (!principal.permissions.includes(PLATFORM_PERMISSIONS.ACTIVATION_PROVIDER)) {
    emitAudit("provider.enable.denied", principal.id, { id, reason: "missing hermes:activation:provider" });
    throw new Error(`Unauthorized to enable provider ${id}: missing hermes:activation:provider`);
  }
  const p = REGISTRY.get(id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  if (!canTransitionProvider(p.lifecycle, "enabled")) {
    throw new Error(`Illegal provider transition: ${p.lifecycle} -> enabled`);
  }
  p.lifecycle = "enabled";
  p.enabled = true;
  p.updatedAt = nowIso();
  emitAudit("provider.enabled", principal.id, { id });
  return p;
}

/** Disable a provider (fail-closed: stops all future execution). */
export function disableProvider(id: string, principal: Principal): ManagedProvider {
  if (!principal.permissions.includes(PLATFORM_PERMISSIONS.ACTIVATION_PROVIDER)) {
    emitAudit("provider.disable.denied", principal.id, { id, reason: "missing hermes:activation:provider" });
    throw new Error(`Unauthorized to disable provider ${id}: missing hermes:activation:provider`);
  }
  const p = REGISTRY.get(id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  if (!canTransitionProvider(p.lifecycle, "disabled")) {
    throw new Error(`Illegal provider transition: ${p.lifecycle} -> disabled`);
  }
  p.lifecycle = "disabled";
  p.enabled = false;
  p.updatedAt = nowIso();
  emitAudit("provider.disabled", principal.id, { id });
  return p;
}

/** Retire a provider (irreversible by design). */
export function retireProvider(id: string, principal: Principal): ManagedProvider {
  if (!principal.permissions.includes(PLATFORM_PERMISSIONS.ACTIVATION_PROVIDER)) {
    emitAudit("provider.retire.denied", principal.id, { id, reason: "missing hermes:activation:provider" });
    throw new Error(`Unauthorized to retire provider ${id}: missing hermes:activation:provider`);
  }
  const p = REGISTRY.get(id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  p.lifecycle = "retired";
  p.enabled = false;
  p.updatedAt = nowIso();
  emitAudit("provider.retired", principal.id, { id });
  return p;
}

/**
 * Mark a provider healthy/active after a successful health probe. Only an
 * enabled provider may become active.
 */
export function setProviderHealth(
  id: string,
  health: ProviderHealth,
  detail?: string,
): ManagedProvider {
  const p = REGISTRY.get(id);
  if (!p) throw new Error(`Unknown provider: ${id}`);
  const wasHealthy = p.health.health === "healthy";
  p.health = { health, checkedAt: nowIso(), detail };
  if (health === "healthy" && p.enabled) {
    p.lifecycle = "active";
  } else if (health !== "healthy" && p.lifecycle === "active") {
    p.lifecycle = p.enabled ? "enabled" : "disabled";
  }
  if (health === "unhealthy" && wasHealthy) {
    emitAudit("provider.health.degraded", "system", { id, health });
  }
  return p;
}

// ─── Capability negotiation (dynamic discovery) ───────────────

/**
 * Resolve the ACTIVE provider that exposes a given capability. Returns the
 * first provider that: is active, enabled, healthy, and advertises the
 * capability. No provider is hardcoded — negotiation is fully dynamic.
 */
export function resolveProviderForCapability(
  capabilityId: string,
): ManagedProvider | undefined {
  for (const p of REGISTRY.values()) {
    if (p.lifecycle !== "active" || !p.enabled) continue;
    if (p.health.health !== "healthy") continue;
    if (p.capabilities.some((c) => c.id === capabilityId)) return p;
  }
  return undefined;
}

/** List all capabilities advertised across active providers. */
export function discoverCapabilities(): CapabilityDescriptor[] {
  const out: CapabilityDescriptor[] = [];
  for (const p of REGISTRY.values()) {
    if (p.lifecycle === "active" && p.enabled) out.push(...p.capabilities);
  }
  return out;
}

/**
 * Inspect whether a capability requires human approval in a given environment.
 * Driven by the capability descriptor (requiresApproval / requiresApprovalIn),
 * NOT hardcoded. Returns false when the capability is not advertised.
 */
export function capabilityApprovalRequirement(
  capabilityId: string,
  env: ToolCall["env"],
): boolean {
  for (const p of REGISTRY.values()) {
    if (p.lifecycle !== "active" || !p.enabled) continue;
    const cap = p.capabilities.find((c) => c.id === capabilityId);
    if (!cap) continue;
    return Boolean(cap.requiresApproval) || (cap.requiresApprovalIn ?? []).includes(env);
  }
  return false;
}

// ─── EPIC-005.6 single execution boundary (Stack B) ──────────────
//
// Stack B uses an in-process CapabilityExecutor model (no manifest/trust/
// transport), so its real trust is the provider lifecycle + health gating
// already enforced here. We express THAT as the gateway's runtime-guard slot
// (gate 4) rather than fabricating a manifest. The gateway still runs the
// tenant + policy gates; Stack B's approval-token gate stays upstream.

/**
 * Runtime guard for Stack B providers. Enforces the SAME fail-closed trust
 * Stack B already used (provider must be active + enabled + healthy) and a
 * cross-tenant scope check. No manifest/transport checks — Stack B has none
 * by design (in-process executors).
 */
export class StackBGatewayGuard extends ProviderRuntimeGuard {
  guard(ctx: GuardContext): GuardDecision {
    const p = getProvider(ctx.providerId);
    if (!p) {
      return { allow: false, reason: `provider "${ctx.providerId}" is not registered`, code: "RUNTIME_TRUST", violationClass: "trust-state" };
    }
    if (p.lifecycle !== "active" || !p.enabled) {
      return { allow: false, reason: `provider "${ctx.providerId}" is not active/enabled (state=${p.lifecycle}, enabled=${p.enabled})`, code: "RUNTIME_TRUST", violationClass: "trust-state" };
    }
    if (p.health.health !== "healthy") {
      return { allow: false, reason: `provider "${ctx.providerId}" is not healthy (${p.health.health})`, code: "RUNTIME_TRUST", violationClass: "trust-state" };
    }
    // 2/8 — cross-tenant scope check (principal bound to its own tenant).
    const rd = (ctx.request.context ?? {}) as Record<string, unknown>;
    const principal = rd.principal as Principal | undefined;
    const own = typeof rd.tenantId === "string" ? (rd.tenantId as string) : undefined;
    const target = typeof rd.targetTenantId === "string" ? (rd.targetTenantId as string) : (principal?.organizationId ?? own);
    if (principal && own && target && own !== target) {
      return { allow: false, reason: `cross-tenant execution denied (${own} → ${target})`, code: "RUNTIME_TENANT", violationClass: "tenant-scope" };
    }
    return { allow: true, reason: "stack-b trust ok", code: "RUNTIME_OK" };
  }
}

/** Live capability registry view over Stack B's dynamic discovery. */
function stackBCapabilityRegistry(): CapabilityRegistry {
  // Map discovery descriptors to the registry's full Capability shape.
  const toCapability = (c: CapabilityDescriptor): Capability => ({
    id: c.id,
    name: c.id,
    provider: "stack-b" as never,
    config: { description: c.description, requiresApproval: c.requiresApproval, requiresApprovalIn: c.requiresApprovalIn },
  });
  return {
    register: () => {},
    get: (id) => discoverCapabilities().filter((c) => c.id === id).map(toCapability)[0],
    list: () => discoverCapabilities().map(toCapability),
    has: (id) => discoverCapabilities().some((c) => c.id === id),
    ownerOf: () => undefined,
  };
}

/** Minimal, honest manifest shape the gateway's guard slot requires. */
function stackBManifest(p: ManagedProvider): ProviderManifestV2 {
  return {
    id: p.id,
    name: p.label,
    vendor: p.domain,
    version: "1.0.0",
    manifestSchema: "v2",
    transports: [{ kind: "local-process" }],
    capabilities: p.capabilities.map((c) => ({ id: c.id, implKey: c.id, effects: ["read"] })),
    permissions: p.capabilities.map((c) => ({ capability: c.id, scope: "*", grantedBy: "runtime" })),
    trust: { level: "untrusted", authModel: "token" },
    health: { probe: "none", intervalMs: 0, timeoutMs: 0, healthyWithinMs: 0 },
    limits: { maxConcurrent: 0, maxDurationMs: 0 },
    approval: { requiredByDefault: false },
    lifecycle: { discoverable: true, autoLoad: false },
  };
}

// ─── EPIC-005.9 (P1): single durable approval model for Stack B ─────────
// Stack B's execution boundary now verifies a structured ApprovalRef against
// REAL durable ExecutionApproval records in the execution store — the SAME
// model the rest of the platform uses. The ONLY way to obtain a ref is the
// human approval queue (grantStackBApproval). No bare string token can ever
// satisfy a Stack B approval gate. Exactly one approval model, everywhere.

const stackBApprovalStore: ExecutionStore = createExecutionStore(new MemoryExecutionBackend());

/** Thin, fail-closed lookup the ApprovalService uses (never throws). */
function stackBApprovalLookup(id: string, principal: Principal): { approval?: ExecutionApproval } | undefined {
  try {
    const ex = stackBApprovalStore.get(id, principal);
    return ex ? { approval: ex.approval } : undefined;
  } catch {
    return undefined;
  }
}

const stackBApprovals: ApprovalService = createApprovalService({ get: stackBApprovalLookup });

/**
 * Mint a durable ApprovalRef. THE ONLY issuer of Stack B approval refs — the
 * human approval queue. Backed by a durable ExecutionApproval record so the
 * gateway can verify it fail-closed. Returns the structured ref callers pass
 * into executeCapability({ approvalRef }).
 */
export async function grantStackBApproval(
  actor: string,
  applicationId: string,
  action: string,
  env: ToolCall["env"],
): Promise<ApprovalRef> {
  const principal: Principal = { id: actor, organizationId: actor, tenantId: actor, permissions: [] };
  const id = `apr_${action.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const scope = `${applicationId}:${action}`;
  const at = new Date().toISOString();
  stackBApprovalStore.create({
    id,
    tenant: actor,
    principal: actor,
    capability: action,
    backend: "stack-b-approval",
    principalSubject: principal,
  });
  const approval: ExecutionApproval = { approver: actor, at, capability: action, scope };
  stackBApprovalStore.recordApproval(id, approval, principal);
  emitAudit("stack-b.approval.granted", actor, { approvalId: id, action, env, scope, applicationId });
  return approvalRefFromRecord(id, approval, actor);
}

/** The single execution boundary for Stack B. */
const stackBGateway = new HermesExecutionGateway({
  policy: new ExecutionPolicyEvaluator({
    capabilities: stackBCapabilityRegistry(),
    knownProviders: () => listActiveProviders().map((p) => p.id),
  } as PolicyEvaluatorDeps),
  guard: new StackBGatewayGuard(),
  approvals: stackBApprovals,
});

/** Map a ToolResult (Stack B's model) into the gateway's ProviderOutcome. */
function toolResultToOutcome(providerId: string, res: ToolResult): ProviderOutcome {
  if (res.ok) return okResult(providerId, res, 0, { backend: res.backend });
  return errResult(providerId, "TOOL_FAILED", res.error ?? "tool execution failed", 0, res);
}

/** Map the gateway's ProviderOutcome back to Stack B's ToolResult contract. */
function outcomeToToolResult(p: ManagedProvider, outcome: ProviderOutcome): ToolResult {
  if (outcome.ok) {
    const inner = (outcome.data ?? {}) as ToolResult;
    return { ...inner, backend: p.backend };
  }
  return { ok: false, error: outcome.message, backend: p.backend };
}

// ─── Execution (fail-closed) ──────────────────────────────────

/**
 * Execute a capability through its resolved provider. FAIL-CLOSED:
 *  • provider must be active + enabled + healthy, else refusal (no fallback
 *    vendor, no fabricated result);
 *  • production use requires an approval token when the capability declares
 *    requiresApproval / requiresApprovalIn includes the env;
 *  • no executor injected ⇒ refusal (we never invent vendor output).
 */
export async function executeCapability(
  capabilityId: string,
  args: Record<string, unknown>,
  ctx: { actor: string; env: ToolCall["env"]; approvalRef?: ApprovalRef },
): Promise<ToolResult> {
  const p = resolveProviderForCapability(capabilityId);
  const cap = p?.capabilities.find((c) => c.id === capabilityId);

  if (!p || !cap) {
    emitAudit("provider.capability.unresolved", ctx.actor, { capabilityId });
    return {
      ok: false,
      error: `No active provider resolves capability: ${capabilityId}`,
      backend: "hermes.fail-closed",
    };
  }

  // EPIC-005.9 (P1) — approval gate (fail-closed). Stack B now uses the SAME
  // structured ApprovalRef model as the rest of the platform. A capability that
  // requires approval MUST be backed by a valid, durable ApprovalRef verified
  // by the gateway. There is exactly one approval model: no bare string token.
  const needsApproval =
    cap.requiresApproval ||
    (cap.requiresApprovalIn ?? []).includes(ctx.env);
  const approvalRef: ApprovalRef | undefined = needsApproval ? ctx.approvalRef : undefined;
  if (needsApproval && !approvalRef) {
    emitAudit("provider.capability.denied", ctx.actor, {
      capabilityId,
      reason: "missing durable ApprovalRef",
      env: ctx.env,
    });
    return {
      ok: false,
      error: `Capability ${capabilityId} requires a durable human approval (ApprovalRef) in ${ctx.env}`,
      backend: p.backend,
    };
  }

  if (!p.executor) {
    emitAudit("provider.executor.missing", ctx.actor, { id: p.id });
    return {
      ok: false,
      error: `Provider ${p.id} has no executor wired (vendor backend not connected)`,
      backend: p.backend,
    };
  }

  // ── EPIC-005.6 — single execution boundary ────────────────────────────
  // Route through the governed gateway (tenant → policy → guard). The gateway
  // is the ONLY thing that actually invokes the capability executor; no caller
  // may bypass the guard. Stack B's approval-token gate above stays upstream.
  const principal: Principal = {
    id: ctx.actor,
    organizationId: ctx.actor,
    tenantId: ctx.actor,
    permissions: [],
  };
  const gwReq: GatewayRequest = {
    executionId: `${p.id}:${capabilityId}:${ctx.actor}`,
    tenantId: ctx.actor,
    principal,
    providerId: p.id,
    providerRequest: {
      invocationId: `${p.id}:${capabilityId}:${ctx.actor}:${Date.now()}`,
      capabilityId,
      implKey: capabilityId,
      args,
      timeoutMs: 30_000,
      context: { principal, tenantId: ctx.actor, targetTenantId: ctx.actor },
    },
    capabilityId,
    // EPIC-005.9 (P1) — the gateway verifies the structured ApprovalRef once,
    // fail-closed, instead of any string-token matching.
    approvalRequired: needsApproval,
    ...(approvalRef ? { approvalRef } : {}),
    lifecycleState: "approved",
  };
  const providerCtx: GatewayProviderContext = {
    manifest: stackBManifest(p),
    trust: undefined,
    transports: new TransportRegistry(),
    capabilities: stackBCapabilityRegistry(),
  };

  emitAudit("provider.capability.exec", ctx.actor, {
    providerId: p.id,
    capabilityId,
    env: ctx.env,
  });
  try {
    const gwRes = await stackBGateway.execute(gwReq, providerCtx, async (_cap, req) => {
      const raw = await p.executor!(capabilityId, req.args ?? {}, ctx);
      const out = toolResultToOutcome(p.id, raw);
      return out;
    });
    if (!gwRes.ok) {
      emitAudit("provider.capability.denied", ctx.actor, {
        providerId: p.id,
        capabilityId,
        reason: gwRes.reason,
        code: gwRes.code,
      });
      return { ok: false, error: gwRes.reason, backend: p.backend };
    }
    const res = outcomeToToolResult(p, gwRes.outcome);
    emitAudit("provider.capability.done", ctx.actor, {
      providerId: p.id,
      capabilityId,
      ok: res.ok,
    });
    return res;
  } catch (err) {
    // A thrown error from the vendor port is converted to a failed result;
    // we never re-throw across the platform boundary (resilience), but we
    // mark the provider unhealthy so future calls fail-closed fast.
    setProviderHealth(p.id, "unhealthy", String(err));
    return {
      ok: false,
      error: `Provider ${p.id} executor threw: ${String(err)}`,
      backend: p.backend,
    };
  }
}

// ─── Read helpers ─────────────────────────────────────────────

export function getProvider(id: string): ManagedProvider | undefined {
  return REGISTRY.get(id);
}
export function listProviders(): ManagedProvider[] {
  return [...REGISTRY.values()];
}
export function listActiveProviders(): ManagedProvider[] {
  return listProviders().filter((p) => p.lifecycle === "active" && p.enabled);
}

/** Test/reset helper. */
export function _clearProviders(): void {
  REGISTRY.clear();
}
