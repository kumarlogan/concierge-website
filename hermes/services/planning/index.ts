// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Index / Barrel Export                    │
// │ ADR-018 · Capability #14                                    │
// │ Single-import entry point for all EPCL services.            │
// └─────────────────────────────────────────────────────────────┘

export { RoadmapEngine } from "./roadmap-engine.js";
export { PlanningEngine } from "./planning-engine.js";
export { DisciplineRouter } from "./discipline-router.js";
export { ContextBudgetManager } from "./context-budget-manager.js";
export { TokenBudgetManager } from "./token-budget-manager.js";
export { PlanAtomService } from "./plan-atom-service.js";
export { ExecutiveDashboard } from "./executive-dashboard.js";
export {
  createFeatureFlags,
  validateFlagDependencies,
  featureFlagsFromEnv,
  DEFAULT_FEATURE_FLAGS,
} from "./feature-flags.js";
export type { EpclFeatureFlags, FlagDependencyReport } from "./feature-flags.js";