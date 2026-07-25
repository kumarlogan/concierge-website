// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Marketplace Security Projection              │
// │ EPIC-005.5 · PHASE 5                                          │
// │                                                               │
// │ A READ-ONLY projection answering exactly one question:         │
// │   "Can this provider safely execute this capability?"          │
// │                                                               │
// │ It NEVER executes a provider. It only inspects data (manifest, │
// │ trust record, registries) through ProviderRuntimeGuard's       │
// │ read-only evaluation and reports which checks pass or fail.    │
// │                                                               │
// │ No provider-specific, Claude-specific, or AGS-specific logic.  │
// └─────────────────────────────────────────────────────────────┘

import {
  ProviderRuntimeGuard,
  type GuardContext,
  type CheckResult,
  type ViolationClass,
  type AuditFn,
} from "./guard.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";
import type { TrustRecord } from "../trust/lifecycle.js";
import type { TransportRegistry } from "../transport.js";
import type { CapabilityRegistry } from "../capability.js";
import type { ProviderRequest } from "../sdk.js";

/** The read-only answer surfaced by the marketplace. */
export interface SafeExecuteAnswer {
  providerId: string;
  capabilityId: string;
  /** True only when EVERY runtime check passes. */
  safe: boolean;
  /** Per-dimension pass/fail detail (never vendor-specific). */
  checks: Array<{
    dimension: ViolationClass;
    passed: boolean;
    reason?: string;
    code: string;
  }>;
  /** Convenience: the failing dimensions (empty when safe). */
  failures: ViolationClass[];
}

/**
 * Read-only marketplace security view. Builds a GuardContext from data the
 * caller already holds and asks the guard to EVALUATE (not enforce) it.
 */
export class MarketplaceSecurityView {
  private readonly guard: ProviderRuntimeGuard;

  constructor(audit: AuditFn = () => {}) {
    // The projection never emits audit of its own — it is a pure read.
    this.guard = new ProviderRuntimeGuard(audit);
  }

  /**
   * Answer "can this provider safely execute this capability?" using ONLY
   * data inspection. No provider is loaded, started, or executed.
   */
  safeExecuteAnswer(input: {
    providerId: string;
    capabilityId: string;
    manifest: ProviderManifestV2;
    trust: TrustRecord | undefined;
    transports: TransportRegistry;
    capabilities: CapabilityRegistry;
    /** Optional pre-built request (defaults to a minimal capability probe). */
    request?: Partial<ProviderRequest>;
  }): SafeExecuteAnswer {
    const request: ProviderRequest = {
      invocationId: "marketplace-probe",
      capabilityId: input.capabilityId,
      implKey: input.manifest.capabilities.find((c) => c.id === input.capabilityId)?.implKey ?? "",
      args: {},
      timeoutMs: input.manifest.limits?.maxDurationMs ?? 0,
      ...(input.request ?? {}),
    };

    const ctx: GuardContext = {
      providerId: input.providerId,
      manifest: input.manifest,
      trust: input.trust,
      request,
      transports: input.transports,
      capabilities: input.capabilities,
    };

    // Read-only enumeration — no state mutation, no audit emission.
    const results: CheckResult[] = this.guard.evaluate(ctx);
    const checks = results.map((r) => ({
      dimension: r.name,
      passed: r.passed,
      ...(r.reason ? { reason: r.reason } : {}),
      code: r.code,
    }));
    const failures = results.filter((r) => !r.passed).map((r) => r.name);

    return {
      providerId: input.providerId,
      capabilityId: input.capabilityId,
      safe: failures.length === 0,
      checks,
      failures,
    };
  }
}
