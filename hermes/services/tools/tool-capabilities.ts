// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Tool Capability Model (provider-neutral)      │
// │ EPIC-002-006F · PHASE 4                                        │
// │ A stable, vendor-agnostic description of what a tool provider   │
// │ can do. The workforce/registry references these IDs — never a   │
// │ concrete backend name (GitHub, OpenAI, Claude, …). This is the  │
// │ contract that lets agents request capabilities without coupling  │
// │ to a provider, and lets the permission model gate them.         │
// └─────────────────────────────────────────────────────────────┘

/** A single declared tool capability. */
export interface ToolCapability {
  /** Stable capability ID, e.g. "tool:code.read". */
  id: string;
  /** Human description. */
  description: string;
  /** True if any environment use requires human approval. */
  requiresApproval?: boolean;
  /** Environments (subset) that require an approval token. */
  requiresApprovalIn?: string[];
}

/** Registry of all known provider-neutral capability IDs (documentation). */
export const KNOWN_CAPABILITY_IDS = [
  "tool:code.read",
  "tool:code.write",
  "tool:code.exec",
  "tool:security.scan.deps",
  "tool:security.scan.secrets",
  "tool:security.iac.validate",
] as const;

export type KnownCapabilityId = (typeof KNOWN_CAPABILITY_IDS)[number];
