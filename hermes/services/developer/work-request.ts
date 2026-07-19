// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Developer Automation — Development Work Specification    │
// │ EPIC-003-002 · M1                                            │
// │ Canonical request shape accepted by the Developer Automation  │
// │ pipeline. Pure data; no execution side effects.               │
// └─────────────────────────────────────────────────────────────┘

export type WorkKind =
  | "feature"
  | "bug"
  | "refactor"
  | "documentation"
  | "security"
  | "testing"
  | "research";

export type RiskLevel = "low" | "medium" | "high" | "critical";

/** A single acceptance criterion (testable, human-readable). */
export interface AcceptanceCriterion {
  id: string;
  description: string;
  /** Whether automated verification is possible in CI. */
  automatable: boolean;
}

/** A constraint that bounds the implementation (non-functional or policy). */
export interface Constraint {
  id: string;
  description: string;
  kind: "policy" | "technical" | "compliance" | "performance";
}

/**
 * Canonical development work request — the single entry point for the
 * Developer Automation pipeline. Hermes plans and orchestrates from this.
 */
export interface DevelopmentWorkRequest {
  /** Stable request id (caller-supplied or generated). */
  requestId: string;
  /** Human title. */
  title: string;
  kind: WorkKind;
  /** Natural-language objective. */
  objective: string;
  priority: 1 | 2 | 3 | 4 | 5;
  /** Functional scope statement. */
  scope: string;
  /** Target application id (e.g. "ags-fertility", "hermes-platform"). */
  targetApplication: string;
  /** Modules/files expected to be touched (for impact + conflict detection). */
  affectedModules: string[];
  acceptanceCriteria: AcceptanceCriterion[];
  constraints: Constraint[];
  estimatedRisk: RiskLevel;
  /** Who raised the request (for audit + approval routing). */
  requestedBy: string;
  /** Environment the work targets (drives approval gates). */
  env: "development" | "staging" | "production";
}

/** Generate a stable request id if the caller did not supply one. */
export function normalizeWorkRequest(
  r: Omit<DevelopmentWorkRequest, "requestId"> & { requestId?: string },
): DevelopmentWorkRequest {
  const VALID_KINDS: WorkKind[] = ["feature", "bug", "refactor", "documentation", "security", "testing", "research"];
  if (!VALID_KINDS.includes(r.kind)) {
    throw new Error(`Invalid work kind: ${String(r.kind)}`);
  }
  return {
    ...r,
    requestId: r.requestId ?? `devreq_${Math.random().toString(36).slice(2, 10)}`,
    acceptanceCriteria: r.acceptanceCriteria ?? [],
    constraints: r.constraints ?? [],
  };
}
