// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Shared Contracts (agent)                     │
// │ EPIC-002-006C · PHASE 1                                        │
// │ Agent record contract — provider-neutral, reuse 006B registry. │
// └─────────────────────────────────────────────────────────────┘

export type AgentState =
  | "registered"
  | "assigned"
  | "approved"
  | "active"
  | "paused"
  | "retired";

export type ActivationState = "disabled" | "enabled";

export interface AgentCapability {
  id: string;
  description: string;
  /** If true, the agent MAY act without per-call human confirmation. */
  autonomous: boolean;
}

export interface AgentRecord {
  id: string;
  name: string;
  /** Owning org unit / application domain. */
  domain: string;
  /** Purpose / mission statement. */
  purpose: string;
  /** Owner account. */
  owner: string;
  /** Permissions granted to the agent (Hermes permission ids). */
  permissions: string[];
  /** Applications the agent is permitted to operate within. */
  applicationsAllowed: string[];
  /** Environments the agent may touch. */
  environments: string[];
  /** Memory scope identifier (Memory Service namespace). */
  memoryScope: string;
  state: AgentState;
  activation: ActivationState;
  capabilities: AgentCapability[];
  /** Identity principal used when the agent authenticates. */
  principalId: string;
  /** RFC3339 registration timestamp. */
  registeredAt: string;
  /** Append-only audit history (state/activation changes). */
  auditHistory: Array<{
    at: string;
    actor: string;
    action: string;
    detail?: string;
  }>;
  notes?: string;
}
