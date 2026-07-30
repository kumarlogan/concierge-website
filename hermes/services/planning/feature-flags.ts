// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Feature Flags                            │
// │ ADR-018 · Capability #14 · Gradual Rollout Support          │
// │ Controls EPCL feature availability at runtime.              │
// └─────────────────────────────────────────────────────────────┘

/**
 * EPCL feature flags — keyed by feature, each with its own
 * rollout strategy and dependency requirements.
 *
 * Design decisions:
 * - Feature flags are independent of Hermes agent feature flags
 * - Defaults are conservative (most flags off)
 * - Each flag has a documented dependency chain
 * - Flags can be configured via environment or config file
 */

export interface EpclFeatureFlags {
  /**
   * Core EPCL planning engine. Enables plan decomposition.
   * Dependencies: none
   */
  planning_engine: boolean;

  /**
   * Roadmap engine for long-term planning and forecasting.
   * Dependencies: planning_engine
   */
  roadmap_engine: boolean;

  /**
   * Discipline routing — auto-assigns work to disciplines.
   * Dependencies: planning_engine
   */
  discipline_routing: boolean;

  /**
   * Context budget management — proactive overflow prevention.
   * Dependencies: none
   */
  context_budgeting: boolean;

  /**
   * Token budget management — fine-grained token tracking.
   * Dependencies: context_budgeting
   */
  token_budgeting: boolean;

  /**
   * Executive dashboard — operator-facing status reports.
   * Dependencies: planning_engine
   */
  executive_dashboard: boolean;

  /**
   * Cross-session decomposition. Required for large plans.
   * Dependencies: context_budgeting, token_budgeting
   */
  multi_session_decomposition: boolean;

  /**
   * Checkpoint-based resumption. Enables plan pause/resume.
   * Dependencies: planning_engine, multi_session_decomposition
   */
  checkpoint_resumption: boolean;

  /**
   * Batched execution with automatic dependency ordering.
   * Dependencies: discipline_routing
   */
  batched_dispatch: boolean;

  /**
   * Parallel workstream detection across disciplines.
   * Dependencies: discipline_routing
   */
  parallel_workstreams: boolean;
}

/**
 * Default feature flags — conservative, all disabled.
 * Enable as each capability is verified.
 */
const DEFAULT_FEATURE_FLAGS: EpclFeatureFlags = {
  planning_engine: false,
  roadmap_engine: false,
  discipline_routing: false,
  context_budgeting: false,
  token_budgeting: false,
  executive_dashboard: false,
  multi_session_decomposition: false,
  checkpoint_resumption: false,
  batched_dispatch: false,
  parallel_workstreams: false,
};

/**
 * Feature flag validator — ensures dependency chains are met.
 * Returns a report of what would be disabled due to missing deps.
 */
export interface FlagDependencyReport {
  enabled: string[];
  disabled: string[];
  disabled_due_to_deps: string[];
  errors: string[];
}

/**
 * Validate feature flag dependency chains.
 * Automatically disables flags whose dependencies are missing.
 */
export function validateFlagDependencies(
  flags: Partial<EpclFeatureFlags>,
): FlagDependencyReport {
  const resolved = { ...DEFAULT_FEATURE_FLAGS, ...flags };
  const errors: string[] = [];
  const disabledDueToDeps: string[] = [];

  // Dependency chains
  const deps: Array<{ flag: keyof EpclFeatureFlags; requires: (keyof EpclFeatureFlags)[] }> = [
    { flag: "roadmap_engine", requires: ["planning_engine"] },
    { flag: "discipline_routing", requires: ["planning_engine"] },
    { flag: "token_budgeting", requires: ["context_budgeting"] },
    { flag: "executive_dashboard", requires: ["planning_engine"] },
    { flag: "multi_session_decomposition", requires: ["context_budgeting", "token_budgeting"] },
    { flag: "checkpoint_resumption", requires: ["planning_engine", "multi_session_decomposition"] },
    { flag: "batched_dispatch", requires: ["discipline_routing"] },
    { flag: "parallel_workstreams", requires: ["discipline_routing"] },
  ];

  for (const { flag, requires } of deps) {
    if (resolved[flag]) {
      for (const req of requires) {
        if (!resolved[req]) {
          resolved[flag] = false;
          disabledDueToDeps.push(flag);
          errors.push(
            `${flag} requires ${req} to be enabled`,
          );
          break;
        }
      }
    }
  }

  const enabled = (Object.entries(resolved) as [string, boolean][])
    .filter(([, v]) => v)
    .map(([k]) => k);

  const disabled = (Object.entries(resolved) as [string, boolean][])
    .filter(([, v]) => !v)
    .map(([k]) => k);

  return {
    enabled,
    disabled,
    disabled_due_to_deps: disabledDueToDeps,
    errors,
  };
}

/**
 * Merge environment variables into feature flags.
 * Env format: EPCL_FEATURE_<FLAG_NAME>=true
 */
export function featureFlagsFromEnv(
  env: Record<string, string | undefined>,
): Partial<EpclFeatureFlags> {
  const flags: Partial<EpclFeatureFlags> = {};
  const flagNames = Object.keys(DEFAULT_FEATURE_FLAGS) as (keyof EpclFeatureFlags)[];

  for (const name of flagNames) {
    const envKey = `EPCL_FEATURE_${name.toUpperCase()}`;
    const envVal = env[envKey];
    if (envVal !== undefined) {
      flags[name] = envVal === "true" || envVal === "1";
    }
  }

  return flags;
}

/**
 * Create a validated feature flag set from partial input.
 * Missing flags default to false. Dependencies are validated.
 */
export function createFeatureFlags(
  overrides?: Partial<EpclFeatureFlags>,
): { flags: EpclFeatureFlags; report: FlagDependencyReport } {
  const merged: EpclFeatureFlags = { ...DEFAULT_FEATURE_FLAGS, ...overrides };
  const report = validateFlagDependencies(merged);

  return { flags: merged, report };
}

export { DEFAULT_FEATURE_FLAGS };