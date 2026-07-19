// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Lifecycle Service                           │
// │ EPIC-002-006C · PHASE 4                                        │
// │ Enforces state-machine transitions for resources + agents.     │
// │ Every transition is audited. No activation without authz.       │
// └─────────────────────────────────────────────────────────────┘

import {
  canTransitionResource,
  canTransitionAgent,
  type ResourceLifecycleState,
  type AgentLifecycleState,
} from "../../../shared/contracts/lifecycle.js";
import { emitAudit } from "../../audit/event.js";

export class LifecycleError extends Error {}

/** Transition a RESOURCE through its lifecycle. */
export function transitionResource(
  id: string,
  from: ResourceLifecycleState,
  to: ResourceLifecycleState,
  actor: string,
  reason?: string,
): { id: string; from: ResourceLifecycleState; to: ResourceLifecycleState } {
  if (!canTransitionResource(from, to)) {
    throw new LifecycleError(`Illegal resource transition: ${from} -> ${to}`);
  }
  emitAudit("lifecycle.resource", actor, { resourceId: id, from, to, reason });
  return { id, from, to };
}

/**
 * Transition an AGENT. CRITICAL: activation (-> active) requires explicit
 * authorization passed by the caller. This service NEVER auto-activates.
 */
export function transitionAgent(
  id: string,
  from: AgentLifecycleState,
  to: AgentLifecycleState,
  actor: string,
  authorized: boolean,
  reason?: string,
): { id: string; from: AgentLifecycleState; to: AgentLifecycleState } {
  if (!canTransitionAgent(from, to)) {
    throw new LifecycleError(`Illegal agent transition: ${from} -> ${to}`);
  }
  // Guard: moving to active requires explicit human authorization.
  if (to === "active" && !authorized) {
    throw new LifecycleError("Agent activation requires explicit authorization");
  }
  emitAudit("lifecycle.agent", actor, { agentId: id, from, to, authorized, reason });
  return { id, from, to };
}
