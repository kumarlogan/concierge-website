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
  ctx: { actor: string; env: ToolCall["env"]; approvalToken?: string },
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
  ctx: { actor: string; env: ToolCall["env"]; approvalToken?: string },
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

  // Approval gate (fail-closed: missing token ⇒ refuse, never proceed).
  const needsApproval =
    cap.requiresApproval ||
    (cap.requiresApprovalIn ?? []).includes(ctx.env);
  if (needsApproval && !ctx.approvalToken) {
    emitAudit("provider.capability.denied", ctx.actor, {
      capabilityId,
      reason: "missing approval token",
      env: ctx.env,
    });
    return {
      ok: false,
      error: `Capability ${capabilityId} requires human approval in ${ctx.env}`,
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

  emitAudit("provider.capability.exec", ctx.actor, {
    providerId: p.id,
    capabilityId,
    env: ctx.env,
  });
  try {
    const res = await p.executor(capabilityId, args, ctx);
    emitAudit("provider.capability.done", ctx.actor, {
      providerId: p.id,
      capabilityId,
      ok: res.ok,
    });
    return { ...res, backend: p.backend };
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
