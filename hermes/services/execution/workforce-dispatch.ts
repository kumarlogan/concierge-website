// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution Platform — Workforce Dispatcher               │
// │ EPIC-003-001 · DELIVERABLE 2                                   │
// │ Matches planned work to registered agents/capability providers.│
// │ Resolution is ALWAYS dynamic through the Provider Registry —   │
// │ provider selection is NEVER hardcoded (architecture rule).     │
// │ Falls back to the workforce registry (agents with the matching│
// │ capability) when no capability provider is active.             │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  resolveProviderForCapability,
  listActiveProviders,
} from "../activation/provider-framework.js";
import { listAgents, type RegisteredAgent } from "../../agents/registry.js";

/** A resolved assignment: where a work item should execute. */
export interface DispatchResult {
  capability: string;
  /** Provider id if a capability provider resolved it. */
  providerId?: string;
  /** Agent id if resolved via the workforce registry. */
  agentId?: string;
  /** The executor backend that will serve the capability. */
  backend: string;
  /** How it was resolved (for audit + transparency). */
  via: "capability-provider" | "workforce-agent" | "unresolved";
  /** Human-readable note. */
  note?: string;
}

export class DispatchError extends Error {}

/**
 * Resolve a single capability to a concrete executor.
 *
 * Priority:
 *  1. Active capability provider (via the Provider Registry — vendor-neutral).
 *  2. Registered workforce agent advertising the capability (non-autonomous).
 *
 * Never returns a hardcoded selection. Throws only on a true resolution
 * failure so the caller can fail-closed (no silent fallback to an unsafe exec).
 */
export function dispatchCapability(
  capability: string,
  context: { actor: string; applicationId: string; env: "development" | "staging" | "production" },
): DispatchResult {
  // 1) Try the capability provider registry (dynamic, vendor-neutral).
  const provider = resolveProviderForCapability(capability);
  if (provider) {
    const res: DispatchResult = {
      capability,
      providerId: provider.id,
      backend: provider.backend,
      via: "capability-provider",
    };
    emitAudit("execution.dispatch.resolved", context.actor, {
      capability,
      providerId: provider.id,
      via: "capability-provider",
    });
    return res;
  }

  // 2) Fall back to the workforce registry (agents advertising the capability).
  const agents = listAgents();
  const candidate = agents.find((a) =>
    a.capabilities.some((c: { id: string }) => c.id === capability),
  );
  if (candidate) {
    const res: DispatchResult = {
      capability,
      agentId: candidate.id,
      backend: `agent:${candidate.id}`,
      via: "workforce-agent",
      note: "No active capability provider; resolved via workforce registry",
    };
    emitAudit("execution.dispatch.resolved", context.actor, {
      capability,
      agentId: candidate.id,
      via: "workforce-agent",
    });
    return res;
  }

  // 3) Unresolved — fail-closed. The caller decides (queue/pause), never auto-run.
  const res: DispatchResult = {
    capability,
    backend: "hermes.fail-closed",
    via: "unresolved",
    note: "No active provider or registered agent for capability",
  };
  emitAudit("execution.dispatch.unresolved", context.actor, {
    capability,
    applicationId: context.applicationId,
  });
  return res;
}

/**
 * Bulk-dispatch a plan's capabilities. Returns a map keyed by capability.
 * Unresolved capabilities are reported (not thrown) so the planner can
 * surface them for human triage.
 */
export function dispatchPlan(
  capabilities: string[],
  context: { actor: string; applicationId: string; env: "development" | "staging" | "production" },
): Map<string, DispatchResult> {
  const out = new Map<string, DispatchResult>();
  for (const cap of capabilities) {
    if (!out.has(cap)) out.set(cap, dispatchCapability(cap, context));
  }
  return out;
}

/** Inspect active providers (transparency / operator visibility). */
export function activeProviderSummary(): Array<{ id: string; backend: string; capabilities: string[] }> {
  return listActiveProviders().map((p) => ({
    id: p.id,
    backend: p.backend,
    capabilities: p.capabilities.map((c) => c.id),
  }));
}
