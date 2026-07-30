// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — EPCL Feature Flag Management                 │
// │ Feature-flag-first deployment: all flows disabled by       │
// │ default. Enable individually per environment.              │
// └─────────────────────────────────────────────────────────────┘

import {
  FeatureFlag,
  DEFAULT_FLAG_STATE,
  type EPCLConfig,
  DEFAULT_EPCL_CONFIG,
} from "./types.js";

// ── Singleton state ──────────────────────────────────────────

let currentFlags: Record<FeatureFlag, boolean> = { ...DEFAULT_FLAG_STATE };
let currentConfig: EPCLConfig = { ...DEFAULT_EPCL_CONFIG };

// ── API ──────────────────────────────────────────────────────

/**
 * Initialize feature flags from a config object.
 * Must be called before using the EPCL layer.
 * Falls back to defaults for any unset flags.
 */
export function initializeFlags(config?: Partial<EPCLConfig>): void {
  if (config) {
    currentConfig = { ...DEFAULT_EPCL_CONFIG, ...config };
    currentFlags = { ...DEFAULT_FLAG_STATE, ...currentConfig.flags };
  } else {
    currentConfig = { ...DEFAULT_EPCL_CONFIG };
    currentFlags = { ...DEFAULT_FLAG_STATE };
  }
}

/** Check if a specific feature flag is enabled. */
export function isEnabled(flag: FeatureFlag): boolean {
  return currentFlags[flag] === true;
}

/** Enable a specific feature flag. */
export function enableFlag(flag: FeatureFlag): void {
  currentFlags[flag] = true;
}

/** Disable a specific feature flag. */
export function disableFlag(flag: FeatureFlag): void {
  currentFlags[flag] = false;
}

/** Set multiple flags at once. */
export function setFlags(flags: Partial<Record<FeatureFlag, boolean>>): void {
  for (const [flag, value] of Object.entries(flags)) {
    if (value !== undefined) {
      currentFlags[flag as FeatureFlag] = value;
    }
  }
}

/** Get current flag state snapshot. */
export function getFlags(): Readonly<Record<FeatureFlag, boolean>> {
  return { ...currentFlags };
}

/** Get current EPCL config. */
export function getConfig(): Readonly<EPCLConfig> {
  return { ...currentConfig };
}

/** Reset all flags to default (disabled). */
export function resetFlags(): void {
  currentFlags = { ...DEFAULT_FLAG_STATE };
}

/**
 * Assert that the executive workflow is enabled.
 * Throws if not — used as a guard at the top of the workflow engine.
 */
export function requireExecutiveWorkflow(): void {
  if (!isEnabled(FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW)) {
    throw new Error(
      "EPCL: Executive workflow is disabled. " +
      "Enable FeatureFlag.ENABLE_EXECUTIVE_WORKFLOW to use the planning layer. " +
      "This is a feature-flag-first system — set flags via initializeFlags() or setFlags()."
    );
  }
}

/**
 * Execute a function only if a flag is enabled.
 * Returns the result of the function, or undefined if disabled.
 */
export function withFlag<T>(
  flag: FeatureFlag,
  fn: () => T
): T | undefined {
  if (!isEnabled(flag)) return undefined;
  return fn();
}

/**
 * Execute a function only if a flag is enabled, with a default fallback.
 */
export function withFlagOr<T>(
  flag: FeatureFlag,
  fn: () => T,
  fallback: T
): T {
  if (!isEnabled(flag)) return fallback;
  return fn();
}

// ── Reset for testing ───────────────────────────────────────

/** Reset to default state. Used in test teardown. */
export function resetForTest(): void {
  currentFlags = { ...DEFAULT_FLAG_STATE };
  currentConfig = { ...DEFAULT_EPCL_CONFIG };
}