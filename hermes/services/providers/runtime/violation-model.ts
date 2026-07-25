// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Runtime Violation Response Engine           │
// │ EPIC-005.5 · PHASE 4                                          │
// │                                                               │
// │ Maps each runtime ViolationClass to a fail-closed response.    │
// │ Execution MUST NEVER continue after a violation. The engine    │
// │ is declarative: it computes the response and invokes the       │
// │ supplied action callback; it never itself calls Provider.      │
// │                                                               │
// │ Severity model:                                                │
// │   LOW    → deny + audit                                        │
// │   MEDIUM → deny + quarantine + alert                          │
// │   HIGH   → revoke + unload + critical audit                   │
// │                                                               │
// │ No provider-specific, Claude-specific, or AGS-specific logic.  │
// └─────────────────────────────────────────────────────────────┘

import type { ViolationClass, AuditFn } from "./guard.js";

export type ViolationSeverity = "LOW" | "MEDIUM" | "HIGH";

/** A side-effect the platform must apply for a given severity. */
export type ViolationAction =
  | "audit"
  | "quarantine"
  | "alert"
  | "revoke"
  | "unload"
  | "critical-audit";

/** The computed, declarative response to a violation. */
export interface ViolationResponse {
  severity: ViolationSeverity;
  /** ALWAYS true — execution must never continue after a violation. */
  deny: true;
  /** Ordered side-effect actions to apply. */
  actions: ViolationAction[];
}

/** A single data-driven rule: violation → response shape. */
interface Rule {
  severity: ViolationSeverity;
  actions: ViolationAction[];
}

/**
 * The canonical mapping. Provider-neutral: severity is derived solely from the
 * violation dimension, never from provider identity or vendor.
 */
const RULES: Record<ViolationClass, Rule> = {
  // Trust state: rejected/unloaded is fatal (HIGH); suspended is contained (MEDIUM).
  "trust-state": { severity: "HIGH", actions: ["revoke", "unload", "critical-audit"] },
  // Sandbox violations are contained and escalated (MEDIUM).
  "sandbox-requirements": { severity: "MEDIUM", actions: ["quarantine", "alert"] },
  // Policy/authorization gaps are denied + audited (LOW).
  "tenant-scope": { severity: "LOW", actions: ["audit"] },
  "capability-authz": { severity: "LOW", actions: ["audit"] },
  "permission-scope": { severity: "LOW", actions: ["audit"] },
  "transport-authz": { severity: "LOW", actions: ["audit"] },
  "runtime-limits": { severity: "LOW", actions: ["audit"] },
  "audit-availability": { severity: "LOW", actions: ["audit"] },
};

export class ViolationResponseEngine {
  private readonly audit: AuditFn;

  constructor(audit: AuditFn) {
    this.audit = audit;
  }

  /** Compute the response for a violation class (no side-effects). */
  classify(cls: ViolationClass): ViolationResponse {
    const rule = RULES[cls];
    return {
      severity: rule.severity,
      deny: true,
      actions: [...rule.actions],
    };
  }

  /**
   * Compute the response and apply each action via the callback. The callback
   * is supplied by the caller (the guard wires platform hooks). This method
   * NEVER continues execution — it only records the denial and fires the
   * configured side-effects.
   */
  respond(cls: ViolationClass, apply: (action: ViolationAction) => void): ViolationResponse {
    const response = this.classify(cls);
    for (const action of response.actions) {
      apply(action);
    }
    return response;
  }
}
