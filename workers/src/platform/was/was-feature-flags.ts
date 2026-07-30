// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — WAS Feature Flag Validator                    │
// │ Enforces the feature-flag-first activation model:           │
// │ all autonomous execution disabled by default.               │
// │ Product-agnostic, reusable across all AGS products.         │
// └─────────────────────────────────────────────────────────────┘

import {
  FeatureFlag as EPCLFeatureFlag,
} from "../epcl/types.js";
import {
  isEnabled as epclIsEnabled,
  resetFlags as epclResetFlags,
} from "../epcl/feature-flags.js";
import {
  WASFeatureFlag,
  DEFAULT_WAS_FLAG_STATE,
  type ValidationGateResult,
  type WASConfig,
} from "./types.js";

// ── Singleton State ──────────────────────────────────────────

let currentWASFlags: Record<WASFeatureFlag, boolean> = { ...DEFAULT_WAS_FLAG_STATE };

// ── API ──────────────────────────────────────────────────────

/**
 * Initialize WAS feature flags. Merges provided flags on top of defaults.
 * All autonomous execution is disabled by default — must be explicitly enabled.
 */
export function initializeWASFlags(flags?: Partial<Record<WASFeatureFlag, boolean>>): void {
  currentWASFlags = { ...DEFAULT_WAS_FLAG_STATE, ...flags };
}

/**
 * Check if a WAS-specific feature flag is enabled.
 */
export function isWASEnabled(flag: WASFeatureFlag): boolean {
  return currentWASFlags[flag] === true;
}

/**
 * Enable a WAS-specific feature flag.
 */
export function enableWASFlag(flag: WASFeatureFlag): void {
  currentWASFlags[flag] = true;
}

/**
 * Disable a WAS-specific feature flag.
 */
export function disableWASFlag(flag: WASFeatureFlag): void {
  currentWASFlags[flag] = false;
}

/**
 * Get current WAS flag state snapshot.
 */
export function getWASFlags(): Readonly<Record<WASFeatureFlag, boolean>> {
  return { ...currentWASFlags };
}

/**
 * Reset WAS flags to default (all disabled).
 */
export function resetWASFlags(): void {
  currentWASFlags = { ...DEFAULT_WAS_FLAG_STATE };
}

/**
 * Synchronize WAS flags with EPCL flags.
 * WAS reads the EPCL ENABLE_AUTONOMOUS_EXECUTION flag as the master switch.
 * If EPCL's ENABLE_AUTONOMOUS_EXECUTION is false, WAS cannot activate autonomously.
 */
export function syncWASFlagsFromEPCL(): void {
  if (!epclIsEnabled(EPCLFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)) {
    currentWASFlags[WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION] = false;
  }
}

/**
 * Reset all flags (WAS and EPCL) to defaults for testing.
 */
export function resetAllFlagsForTest(): void {
  currentWASFlags = { ...DEFAULT_WAS_FLAG_STATE };
  epclResetFlags();
}

// ── Validation Gate ──────────────────────────────────────────

/**
 * Validate that all required feature flags are enabled for activation.
 * Returns a ValidationGateResult — "error" severity blocks activation.
 *
 * Required for activation:
 *   - ENABLE_AUTONOMOUS_EXECUTION (WAS) — master switch
 *   - ENABLE_EXECUTIVE_WORKFLOW (EPCL) — EPCL must be enabled
 *
 * Only checked if requireFeatureFlagValidation is true in config.
 */
export function validateFeatureFlags(config?: Partial<WASConfig>): ValidationGateResult {
  const requireFF = config?.requireFeatureFlagValidation ?? true;

  if (!requireFF) {
    return {
      gate: "feature_flags",
      passed: true,
      message: "Feature flag validation is disabled by configuration",
      severity: "warning",
    };
  }

  // Sync EPCL flags first
  syncWASFlagsFromEPCL();

  // Master switch: ENABLE_AUTONOMOUS_EXECUTION
  if (!currentWASFlags[WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION]) {
    return {
      gate: "feature_flags",
      passed: false,
      message:
        "Autonomous execution is disabled. " +
        "Enable WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION to activate plans through WAS. " +
        "This is a feature-flag-first system — all autonomous behavior is disabled by default.",
      severity: "error",
      detail: "Set ENABLE_AUTONOMOUS_EXECUTION=true via WAS configuration or enableWASFlag().",
    };
  }

  // EPCL executive workflow must be enabled
  if (!epclIsEnabled(EPCLFeatureFlag.ENABLE_EXECUTIVE_WORKFLOW)) {
    return {
      gate: "feature_flags",
      passed: false,
      message:
        "EPCL executive workflow is disabled. " +
        "Enable FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW before activating through WAS.",
      severity: "error",
      detail: "Set ENABLE_EXECUTIVE_WORKFLOW=true via EPCL initializeFlags() or setFlags().",
    };
  }

  // Check batch generation if plan has batches to activate
  if (!currentWASFlags[WASFeatureFlag.ENABLE_BATCH_GENERATION]) {
    return {
      gate: "feature_flags",
      passed: false,
      message:
        "Batch generation is disabled. " +
        "Enable WASFeatureFlag.ENABLE_BATCH_GENERATION to activate batches through WAS.",
      severity: "error",
      detail: "Set ENABLE_BATCH_GENERATION=true via WAS configuration or enableWASFlag().",
    };
  }

  return {
    gate: "feature_flags",
    passed: true,
    message: "All required feature flags are enabled",
    severity: "warning",
  };
}

/**
 * Validate that executive reporting feature flag is enabled.
 * Returns a warning gate — does not block activation, but reports are skipped.
 */
export function validateReportingFlag(): ValidationGateResult {
  if (!currentWASFlags[WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING]) {
    return {
      gate: "executive_reporting",
      passed: false,
      message: "Executive reporting is disabled. Status reports will not be generated.",
      severity: "warning",
      detail: "Enable WASFeatureFlag.ENABLE_EXECUTIVE_REPORTING to generate executive status reports.",
    };
  }

  return {
    gate: "executive_reporting",
    passed: true,
    message: "Executive reporting is enabled",
    severity: "warning",
  };
}