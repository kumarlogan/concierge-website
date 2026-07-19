// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Shared Contracts (lifecycle)                 │
// │ EPIC-002-006C · PHASE 1                                        │
// │ Lifecycle transition tables. State types live in resource.ts. │
// └─────────────────────────────────────────────────────────────┘

import type {
  ResourceLifecycleState,
  AgentLifecycleState,
} from "./resource.js";

export type {
  ResourceLifecycleState,
  AgentLifecycleState,
};

/** Valid transitions for RESOURCE lifecycle. */
export const RESOURCE_TRANSITIONS: Record<ResourceLifecycleState, ResourceLifecycleState[]> = {
  planned: ["active", "deprecated"],
  active: ["suspended", "deprecated", "deleted"],
  suspended: ["active", "deprecated", "deleted"],
  deprecated: ["deleted"],
  deleted: [],
};

/** Valid transitions for AGENT lifecycle. */
export const AGENT_TRANSITIONS: Record<AgentLifecycleState, AgentLifecycleState[]> = {
  registered: ["assigned", "retired"],
  assigned: ["approved", "retired"],
  approved: ["active", "paused", "retired"],
  active: ["paused", "retired"],
  paused: ["active", "retired"],
  retired: [],
};

export function canTransitionResource(from: ResourceLifecycleState, to: ResourceLifecycleState): boolean {
  return RESOURCE_TRANSITIONS[from]?.includes(to) ?? false;
}

export function canTransitionAgent(from: AgentLifecycleState, to: AgentLifecycleState): boolean {
  return AGENT_TRANSITIONS[from]?.includes(to) ?? false;
}
