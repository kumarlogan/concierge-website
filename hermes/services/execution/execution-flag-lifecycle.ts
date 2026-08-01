// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Execution — Execution-Scoped Feature Flag Lifecycle   │
// │ EPIC-007 · Deliverable 07                                        │
// │ Manages execution-scoped feature flags tied to an            │
// │ ExecutionContext. Flags are transient, scoped to a single     │
// │ execution run, and audited on create/update/delete.          │
// │ Integrates with WAS FeatureFlags (source of truth) via       │
// │ EPCL flag definitions — no redesign of existing flag system. │
// └─────────────────────────────────────────────────────────────┘

import { ExecutionContext } from "./context.js";
import type { ExecutionEvidence } from "./context.js";
import { emitAudit } from "../../audit/event.js";

// ── Types ──────────────────────────────────────────────

export type FeatureFlagKey = string;
export type FeatureFlagValue = boolean;

export type ExecutionScopedFlag = {
  /** The flag key (e.g. "epic007.enable-research"). */
  key: FeatureFlagKey;
  /** The flag value. */
  value: FeatureFlagValue;
  /** Who set this flag. */
  setBy: string;
  /** When the flag was set. */
  setAt: string;
  /** Scope: execution context id this flag belongs to. */
  contextId: string;
  /** Optional EPCL feature flag name this maps to. */
  epclFlag?: string;
  /** Why this flag was set. */
  reason?: string;
  /** Whether this flag was explicitly overridden (vs inherited). */
  overridden: boolean;
};

export type FlagLifecycleEvent = {
  /** The flag key. */
  key: FeatureFlagKey;
  /** The transition type. */
  event: "created" | "updated" | "deleted" | "escalated" | "reset";
  /** The value after the event. */
  value: FeatureFlagValue;
  /** Actor who triggered the event. */
  actor: string;
  /** Timestamp. */
  at: string;
  /** The context this flag belongs to. */
  contextId: string;
  /** Additional metadata. */
  metadata?: Record<string, unknown>;
};

export type FlagBundle = {
  /** The execution context these flags belong to. */
  contextId: string;
  /** All active flags for this execution. */
  flags: Map<FeatureFlagKey, ExecutionScopedFlag>;
  /** The lifecycle events generated during this execution. */
  events: FlagLifecycleEvent[];
  /** When the bundle was created. */
  createdAt: string;
  /** Whether the bundle is still active (not finalized). */
  active: boolean;
};

export type FlagLifecycleOptions = {
  /** Initial flags to set on creation. */
  initialFlags?: Record<FeatureFlagKey, FeatureFlagValue>;
  /** Whether to auto-escalate conflicting flags (default true). */
  autoEscalate?: boolean;
  /** Whether to persist events to audit log (default true). */
  auditEvents?: boolean;
};

// ── Class ──────────────────────────────────────────────

export class ExecutionFlagLifecycle {
  private static instance: ExecutionFlagLifecycle;

  private constructor() {}

  static getInstance(): ExecutionFlagLifecycle {
    if (!ExecutionFlagLifecycle.instance) {
      ExecutionFlagLifecycle.instance = new ExecutionFlagLifecycle();
    }
    return ExecutionFlagLifecycle.instance;
  }

  /**
   * Create a FlagBundle for an execution context, initialized
   * with any provided starting flags. All flags are scoped to the
   * context and registered in the audit log.
   *
   * @param ctx - The execution context.
   * @param opts - Initial flags and lifecycle options.
   * @returns FlagBundle with initial flags set.
   */
  createBundle(
    ctx: ExecutionContext,
    opts: FlagLifecycleOptions = {},
  ): FlagBundle {
    const bundle: FlagBundle = {
      contextId: ctx.id,
      flags: new Map(),
      events: [],
      createdAt: new Date().toISOString(),
      active: true,
    };

    const autoEscalate = opts.autoEscalate ?? true;
    const auditEvents = opts.auditEvents ?? true;

    // Set initial flags
    if (opts.initialFlags) {
      for (const [key, value] of Object.entries(opts.initialFlags)) {
        this._setFlag(bundle, key, value, ctx, autoEscalate, auditEvents);
      }
    }

    // Capture evidence if any flags were set
    const flagEvidence = [...bundle.flags.values()].map((flag) => ({
      type: "flag" as const,
      reference: `flag:${flag.key}`,
      backend: "execution-flag-lifecycle",
      capturedAt: flag.setAt,
      metadata: {
        key: flag.key,
        value: flag.value,
        overridden: flag.overridden,
        epclFlag: flag.epclFlag,
      },
    }));
    for (const evidence of flagEvidence) {
      ctx.attachEvidence(evidence);
    }

    // Audit the bundle creation
    if (auditEvents && bundle.events.length > 0) {
      emitAudit("epic007.flags.bundle-created", ctx.principal.id, {
        contextId: ctx.id,
        flagCount: bundle.flags.size,
        eventCount: bundle.events.length,
        tenant: ctx.tenant,
      }, { tenant: ctx.tenant });
    }

    return bundle;
  }

  /**
   * Set or update a flag within a bundle. Validates the flag key
   * and records the lifecycle event.
   *
   * @param bundle - The flag bundle to update.
   * @param key - The flag key.
   * @param value - The new value.
   * @param ctx - The execution context.
   * @param reason - Optional reason for the change.
   */
  setFlag(
    bundle: FlagBundle,
    key: FeatureFlagKey,
    value: FeatureFlagValue,
    ctx: ExecutionContext,
    reason?: string,
  ): ExecutionScopedFlag {
    if (!bundle.active) {
      throw new Error(`FlagBundle ${bundle.contextId} is no longer active`);
    }

    const existing = bundle.flags.get(key);
    const overridden = existing !== undefined && existing.value !== value;

    const flag: ExecutionScopedFlag = {
      key,
      value,
      setBy: ctx.principal.id,
      setAt: new Date().toISOString(),
      contextId: ctx.id,
      overridden,
      ...(reason ? { reason } : {}),
      ...(existing?.epclFlag ? { epclFlag: existing.epclFlag } : {}),
    };

    bundle.flags.set(key, flag);

    const event: FlagLifecycleEvent = {
      key,
      event: existing ? "updated" : "created",
      value,
      actor: ctx.principal.id,
      at: flag.setAt,
      contextId: ctx.id,
      metadata: {
        overridden,
        reason,
      },
    };
    bundle.events.push(event);

    // Attach evidence
    ctx.attachEvidence({
      type: "flag",
      reference: `flag:${key}`,
      backend: "execution-flag-lifecycle",
      capturedAt: flag.setAt,
      metadata: { key, value, event: event.event },
    });

    // Audit
    emitAudit("epic007.flags.changed", ctx.principal.id, {
      contextId: ctx.id,
      key,
      value,
      event: event.event,
      overridden,
      tenant: ctx.tenant,
    }, { tenant: ctx.tenant });

    return flag;
  }

  /**
   * Remove a flag from the bundle. The flag is marked as deleted
   * in events but remains for audit trail purposes.
   *
   * @param bundle - The flag bundle.
   * @param key - The flag key to remove.
   * @param ctx - The execution context.
   */
  deleteFlag(
    bundle: FlagBundle,
    key: FeatureFlagKey,
    ctx: ExecutionContext,
  ): boolean {
    if (!bundle.flags.has(key)) {
      return false;
    }

    bundle.flags.delete(key);

    const at = new Date().toISOString();
    const event: FlagLifecycleEvent = {
      key,
      event: "deleted",
      value: false,
      actor: ctx.principal.id,
      at,
      contextId: ctx.id,
    };
    bundle.events.push(event);

    // Audit
    emitAudit("epic007.flags.deleted", ctx.principal.id, {
      contextId: ctx.id,
      key,
      tenant: ctx.tenant,
    }, { tenant: ctx.tenant });

    return true;
  }

  /**
   * Check if a specific flag is enabled in the bundle.
   * Returns false if the flag is not found (fail-closed).
   */
  isEnabled(bundle: FlagBundle, key: FeatureFlagKey): boolean {
    const flag = bundle.flags.get(key);
    return flag?.value ?? false;
  }

  /**
   * Get all flags that match a given prefix (e.g. "epic007.").
   */
  getFlagsByPrefix(bundle: FlagBundle, prefix: string): Record<FeatureFlagKey, FeatureFlagValue> {
    const result: Record<FeatureFlagKey, FeatureFlagValue> = {};
    for (const [key, flag] of bundle.flags) {
      if (key.startsWith(prefix)) {
        result[key] = flag.value;
      }
    }
    return result;
  }

  /**
   * Finalize a flag bundle, marking it as inactive and recording
   * the final state. No further modifications are allowed after finalization.
   */
  finalizeBundle(bundle: FlagBundle, ctx: ExecutionContext): FlagBundle {
    bundle.active = false;

    emitAudit("epic007.flags.bundle-finalized", ctx.principal.id, {
      contextId: ctx.id,
      flagCount: bundle.flags.size,
      eventCount: bundle.events.length,
      tenant: ctx.tenant,
    }, { tenant: ctx.tenant });

    return bundle;
  }

  /**
   * Internal: set a flag with escalation support.
   */
  private _setFlag(
    bundle: FlagBundle,
    key: FeatureFlagKey,
    value: FeatureFlagValue,
    ctx: ExecutionContext,
    autoEscalate: boolean,
    auditEvents: boolean,
  ): ExecutionScopedFlag {
    const existing = bundle.flags.get(key);
    if (existing && existing.value !== value && autoEscalate) {
      const escalatedEvent: FlagLifecycleEvent = {
        key,
        event: "escalated",
        value,
        actor: ctx.principal.id,
        at: new Date().toISOString(),
        contextId: ctx.id,
        metadata: {
          previousValue: existing.value,
          newOrConflictingValue: value,
          autoEscalated: true,
        },
      };
      bundle.events.push(escalatedEvent);
    }

    return this.setFlag(bundle, key, value, ctx, "Initial flag set via ExecutionFlagLifecycle");
  }
}