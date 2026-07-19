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

export type AgentState = "registered" | "active" | "suspended" | "retired";
export type ActivationState = "disabled" | "enabled";

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
  state: AgentState;
  activation: ActivationState;
  capabilities: AgentCapability[];
  /** RFC3339 registration timestamp. */
  registeredAt: string;
  /** Identity used when the agent authenticates (maps to Hermes Identity). */
  principalId: string;
  /** Free-form notes (audit trail). */
  notes?: string;
}

/** In-memory registry backing store. Replace with D1/contract later (ADR-007). */
const REGISTRY = new Map<string, RegisteredAgent>();

export function registerAgent(agent: RegisteredAgent): RegisteredAgent {
  if (REGISTRY.has(agent.id)) {
    throw new Error(`Agent already registered: ${agent.id}`);
  }
  // Safety: registration ALWAYS starts disabled, regardless of input.
  const safe: RegisteredAgent = { ...agent, activation: "disabled", state: "registered" };
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
  const updated = { ...agent, state };
  REGISTRY.set(id, updated);
  return updated;
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
