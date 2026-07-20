// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Agent Registry                              │
// │ EPIC-002-006B · PHASE 7                                       │
// │ Foundation for the AGS AI-operated organization.             │
// └─────────────────────────────────────────────────────────────┘
//
// The Agent Registry is the canonical record of every AI agent that may
// operate within the AGS Organization. Registration is the FIRST gate: an
// agent cannot act until it is (a) registered and (b) activated by an
// explicit, authorized action.
//
// Safety posture (EPIC-002-006B): every agent is registered DISABLED by
// default. No agent performs autonomous actions until activated. Activation
// is an out-of-band, human-authorized operation — never automatic.

// EPIC-002-006D: align AgentState with the canonical AgentLifecycleState
// defined in shared/contracts/lifecycle.ts (registered → assigned → approved
// → active → paused → retired). The registry is the source of truth for the
// agent's lifecycle state; the shared contract is the single vocabulary.
import type { AgentLifecycleState } from "../../shared/contracts/lifecycle.js";
import { canTransitionAgent } from "../../shared/contracts/lifecycle.js";

export type AgentState = AgentLifecycleState;
export type ActivationState = "disabled" | "enabled";

// ── Authoritative agent state vocabulary (EPIC-003-006 M2) ──────
// Two ORTHOGONAL axes govern whether an agent may act:
//   1. Lifecycle (AgentLifecycleState): registered → assigned → approved →
//      active → (paused | suspended) → retired. Governed by setState() and the
//      canonical AGENT_TRANSITIONS table in shared/contracts/lifecycle.ts.
//   2. Activation (ActivationState): "disabled" | "enabled". Governed by
//      activateAgent()/deactivateAgent() — an explicit, human-authorized op.
// An agent may ONLY execute when BOTH axes are satisfied:
//   activation === "enabled" AND state === "active"  (see canAgentAct).
// "disabled", "paused", and "suspended" all prevent execution; they are NOT
// interchangeable — activation is an operator switch, paused/suspended are
// lifecycle holds with distinct re-entry transitions.
export const AGENT_LIFECYCLE_STATES: readonly AgentLifecycleState[] = [
  "registered",
  "assigned",
  "approved",
  "active",
  "paused",
  "suspended",
  "retired",
];
export const AGENT_ACTIVATION_STATES: readonly ActivationState[] = ["disabled", "enabled"];

export interface AgentCapability {
  /** Stable capability identifier, e.g. "ops.lead.read". */
  id: string;
  /** Human description of what the capability allows. */
  description: string;
  /** Whether the capability may act autonomously when activated. */
  autonomous: boolean;
}

export interface RegisteredAgent {
  id: string;
  name: string;
  /** Owning organization unit, e.g. "ags-fertility". */
  domain: string;
  /**
   * Lifecycle state. OPTIONAL on input: registerAgent() ALWAYS forces
   * "registered" (fail-closed — registration is the first gate, never an
   * active state). The registry is the authoritative source of truth for
   * lifecycle transitions (see setState / canTransitionAgent).
   */
  state?: AgentState;
  /**
   * Activation flag. OPTIONAL on input: registerAgent() ALWAYS forces
   * "disabled". An agent can only execute after an explicit, authorized
   * activateAgent() call (see canAgentAct).
   */
  activation?: ActivationState;
  capabilities: AgentCapability[];
  /** RFC3339 registration timestamp. */
  registeredAt: string;
  /** Identity used when the agent authenticates (maps to Hermes Identity). */
  principalId: string;
  /** Free-form notes (audit trail). */
  notes?: string;
  // ── EPIC-002-006C PHASE 5 platform metadata (all optional for compat) ──
  /** Human-readable purpose statement. */
  purpose?: string;
  /** Owning principal/team accountable for the agent. */
  owner?: string;
  /** Hermes permission grants required for the agent to act. */
  permissions?: string[];
  /** Applications the agent is permitted to operate within. */
  applicationsAllowed?: string[];
  /** Environments the agent may touch (production/staging/development). */
  environments?: string[];
  /** Memory scope isolation boundary for the agent. */
  memoryScope?: "isolated" | "shared" | "global";
  /** Audit history of lifecycle/activation changes. */
  auditHistory?: Array<{ at: string; actor: string; action: string; detail?: Record<string, unknown> }>;
}

/** In-memory registry backing store. Replace with D1/contract later (ADR-007). */
const REGISTRY = new Map<string, RegisteredAgent>();

export function registerAgent(agent: RegisteredAgent): RegisteredAgent {
  if (REGISTRY.has(agent.id)) {
    throw new Error(`Agent already registered: ${agent.id}`);
  }
  // Safety: registration ALWAYS starts disabled + registered, regardless of
  // input. These are the fail-closed defaults — an agent is never registered
  // in an active or enabled state. (state/activation are optional on input
  // precisely because the registry owns them here.)
  const safe: RegisteredAgent = {
    ...agent,
    activation: "disabled" as ActivationState,
    state: "registered" as AgentState,
    auditHistory: [
      ...(agent.auditHistory ?? []),
      {
        at: new Date().toISOString(),
        actor: agent.owner ?? "system",
        action: "registered",
        detail: { activation: "disabled", autonomous: false },
      },
    ],
  };
  REGISTRY.set(agent.id, safe);
  return safe;
}

export function getAgent(id: string): RegisteredAgent | undefined {
  return REGISTRY.get(id);
}

export function listAgents(): RegisteredAgent[] {
  return [...REGISTRY.values()];
}

export function setState(id: string, state: AgentState): RegisteredAgent {
  const agent = REGISTRY.get(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  const from = agent.state ?? "registered";
  // Hardened: enforce the canonical agent lifecycle transition table.
  // This is the single gate for all lifecycle moves — illegal transitions
  // (e.g. registered -> active without approval) are rejected here.
  if (!canTransitionAgent(from, state)) {
    throw new Error(`Illegal agent transition: ${from} -> ${state}`);
  }
  const updated: RegisteredAgent = {
    ...agent,
    state,
    auditHistory: [
      ...(agent.auditHistory ?? []),
      { at: new Date().toISOString(), actor: "system", action: "state", detail: { from, to: state } },
    ],
  };
  REGISTRY.set(id, updated);
  return updated;
}

/**
 * Authoritative execution gate. An agent may ONLY act when it is BOTH
 * activated (activation === "enabled") AND in the active lifecycle state.
 * Calling setAgentState/activateAgent does not bypass this — every dispatch
 * path MUST call canAgentAct() before allowing the agent to execute.
 */
export function canAgentAct(agent: RegisteredAgent): boolean {
  return agent.activation === "enabled" && (agent.state ?? "registered") === "active";
}

/**
 * Activation is EXPLICIT and authorized out-of-band. This function exists so
 * the capability is wired, but it MUST only be called by an authorized
 * operator flow — never automatically during registration or startup.
 */
export function activateAgent(id: string): RegisteredAgent {
  const agent = REGISTRY.get(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  const updated = { ...agent, activation: "enabled" as ActivationState };
  REGISTRY.set(id, updated);
  return updated;
}

export function deactivateAgent(id: string): RegisteredAgent {
  const agent = REGISTRY.get(id);
  if (!agent) throw new Error(`Unknown agent: ${id}`);
  const updated = { ...agent, activation: "disabled" as ActivationState };
  REGISTRY.set(id, updated);
  return updated;
}

/**
 * Place an agent into the lifecycle `suspended` hold. Suspension is a
 * lifecycle transition (not an activation switch): it must go through the
 * canonical transition table and is recorded in auditHistory. A suspended
 * agent cannot execute (canAgentAct requires state === "active"). Re-entry is
 * only to "active" or "retired" (see AGENT_TRANSITIONS).
 */
export function suspendAgent(id: string): RegisteredAgent {
  return setState(id, "suspended");
}

/** Test/reset helper — clears the in-memory registry (not used in production). */
export function _clearAgents(): void {
  REGISTRY.clear();
}
