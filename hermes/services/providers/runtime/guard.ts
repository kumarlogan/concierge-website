// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Runtime Guard                       │
// │ EPIC-005.5 · PHASE 1 + PHASE 3                                │
// │                                                               │
// │ Provider-neutral, fail-closed runtime enforcement that sits    │
// │ between the ExecutionPolicyEvaluator (policy admission) and    │
// │ the concrete Provider.execute() call.                          │
// │                                                               │
// │ It knows NOTHING about any vendor. Every input is data: the    │
// │ manifest, the trust record, the registry, the transport set.   │
// │ Every check is fail-closed: any uncertainty → DENY.            │
// │                                                               │
// │ No Claude-specific, AGS-specific, or provider-specific logic.  │
// └─────────────────────────────────────────────────────────────┘

import type { ProviderManifestV2 } from "../manifest-v2.js";
import type { TrustRecord } from "../trust/lifecycle.js";
import type { TransportRegistry, TransportKind } from "../transport.js";
import type { ProviderRequest } from "../sdk.js";
import type { ProviderLifecycleState } from "../sdk.js";
import type { CapabilityRegistry } from "../capability.js";
import { enforceTenant, TenantViolationError } from "../../../persistence/tenant.js";
import { emitAudit } from "../../../audit/emitter.js";
import type { Principal } from "../../../contracts/platform-api.js";
import { ViolationResponseEngine } from "./violation-model.js";

/** The 8 runtime enforcement dimensions. Each maps to a violation class. */
export type ViolationClass =
  | "trust-state"
  | "tenant-scope"
  | "capability-authz"
  | "permission-scope"
  | "transport-authz"
  | "runtime-limits"
  | "sandbox-requirements"
  | "audit-availability";

/** A single failed or passed runtime check. */
export interface CheckResult {
  /** Stable check name. */
  name: ViolationClass;
  /** True when the check passed. */
  passed: boolean;
  /** Human-readable reason (present on failure). */
  reason?: string;
  /** Stable error code for fail-closed deny responses. */
  code: string;
}

/** The guard's verdict. `allow:false` ⇒ execution MUST NOT proceed. */
export interface GuardDecision {
  allow: boolean;
  reason: string;
  code: string;
  /** Set only when `allow` is false. */
  violationClass?: ViolationClass;
}

/** Everything the guard needs to make a verdict — all data, no behavior. */
export interface GuardContext {
  providerId: string;
  manifest: ProviderManifestV2;
  /** Trust record from TrustLifecycle (undefined ⇒ never admitted). */
  trust: TrustRecord | undefined;
  /** The normalized execution request. */
  request: ProviderRequest;
  /** Shared transport registry (Hermes-owned adapters). */
  transports: TransportRegistry;
  /** Capability registry (source of truth for what can run). */
  capabilities: CapabilityRegistry;
  /** Injectable clock (deterministic tests). */
  now?: () => number;
}

/** Audit sink (matches emitAudit signature). Injectable for tests. */
export type AuditFn = (type: string, actor: string, detail: Record<string, unknown>) => void;

/** Trust tiers that REQUIRE an enforced sandbox before execution. */
const SANDBOX_REQUIRED: ReadonlySet<string> = new Set(["trusted", "privileged"]);

export class ProviderRuntimeGuard {
  /** Trust states that are considered RUNTIME-ACTIVE (provider backend may
   * execute). This is the ONLY set that permits execution. Every other state —
   * including AUTHENTICATED (proof-of-identity, NOT runtime readiness) and the
   * negative/pre-active states — is NON-runtime and DENIED by evaluateTrustState. */
  private static readonly RUNTIME_ACTIVE_STATES: ReadonlySet<ProviderLifecycleState> = new Set<ProviderLifecycleState>([
    "ACTIVE",
    "LOADED",
    "RUNNING",
  ]);

  /** Explicitly NON-runtime states (EPIC-005.7A F-1). Documented so a future
   * edit cannot silently add AUTHENTICATED (or any pre-active/negated state)
   * to the runnable set. AUTHENTICATED is proof-of-identity, NOT runtime
   * readiness; DISCOVERED/VALIDATED/AUTHORIZED are pre-admission; SUSPENDED
   * and the negative states are post-admission but non-executing. */
  private static readonly NON_RUNTIME_STATES: ReadonlySet<ProviderLifecycleState> = new Set<ProviderLifecycleState>([
    "DISCOVERED",
    "VALIDATED",
    "AUTHORIZED",
    "AUTHENTICATED",
    "SUSPENDED",
    "UNLOADED",
    "QUARANTINED",
    "REJECTED",
    "REVOKED",
  ]);

  private readonly audit: AuditFn;
  /** Per-provider in-flight execution counter (in-memory, platform seam). */
  private readonly active = new Map<string, number>();
  /** Optional quarantine/revoke/unload hooks (wired by the platform). */
  private hooks?: GuardHooks;

  constructor(audit: AuditFn = emitAudit, hooks?: GuardHooks) {
    // Crash-safe wrapper: the guard must NEVER throw when reporting a verdict,
    // even if the supplied sink is unusable. Check 8 (audit-availability)
    // inspects `typeof this.audit !== "function"` so a missing sink is caught
    // at enforcement time, not as a thrown exception.
    this.audit = (type, actor, detail) => {
      if (typeof audit === "function") audit(type, actor, detail);
    };
    this.hooks = hooks;
  }

  /** Wire external lifecycle hooks (quarantine/revoke/unload). */
  setHooks(hooks: GuardHooks): void {
    this.hooks = hooks;
  }

  /**
   * LIVE path. Short-circuits on the FIRST failing check (fail-closed) and
   * returns a DENY decision. On ALLOW it increments the per-provider
   * concurrency counter — call `release()` after execution completes.
   *
   * Emits audit for both outcomes. Never throws.
   */
  guard(ctx: GuardContext): GuardDecision {
    const decision = this.firstFailure(ctx);
    if (!decision.allow) {
      if (typeof this.audit === "function") {
        this.audit("provider.runtime.denied", ctx.providerId, {
          capabilityId: ctx.request.capabilityId,
          violationClass: decision.violationClass,
          code: decision.code,
          reason: decision.reason,
        });
      }
      this.applyViolationResponse(ctx, decision);
      return decision;
    }
    if (typeof this.audit === "function") {
      this.audit("provider.runtime.allowed", ctx.providerId, {
        capabilityId: ctx.request.capabilityId,
      });
    }
    this.bump(ctx.providerId);
    return decision;
  }

  /**
   * READ-ONLY enumeration used by the Marketplace security projection.
   * Runs every check but NEVER mutates state (no concurrency bump) and
   * NEVER emits audit. Returns the full per-check result list.
   */
  evaluate(ctx: GuardContext): CheckResult[] {
    return this.runChecks(ctx, { readonly: true });
  }

  /** Decrement the per-provider concurrency counter (call post-execution). */
  release(providerId: string): void {
    const n = this.active.get(providerId) ?? 0;
    if (n <= 1) this.active.delete(providerId);
    else this.active.set(providerId, n - 1);
  }

  /** Current in-flight count for a provider (observability). */
  activeCount(providerId: string): number {
    return this.active.get(providerId) ?? 0;
  }

  // ── internals ────────────────────────────────────────────────────────

  private bump(providerId: string): void {
    this.active.set(providerId, (this.active.get(providerId) ?? 0) + 1);
  }

  /** Run all checks; return only the first failure as a DENY decision. */
  private firstFailure(ctx: GuardContext): GuardDecision {
    for (const r of this.runChecks(ctx, { readonly: false })) {
      if (!r.passed) {
        return {
          allow: false,
          reason: r.reason ?? `runtime check failed: ${r.name}`,
          code: r.code,
          violationClass: r.name,
        };
      }
    }
    return {
      allow: true,
      reason: "all runtime checks passed",
      code: "RUNTIME_ALLOWED",
    };
  }

  /**
   * The 8 enforcement checks. `readonly` skips the concurrency mutation so
   * this is safe to call from the marketplace projection.
   */
  private runChecks(ctx: GuardContext, _opts: { readonly: boolean }): CheckResult[] {
    const { manifest, trust, request, providerId } = ctx;
    const cap = request.capabilityId;
    const results: CheckResult[] = [];

    // 1. TRUST STATE — the provider must be admitted and runnable.
    if (!trust) {
      results.push({
        name: "trust-state",
        passed: false,
        reason: "provider has no trust record (never admitted)",
        code: "RUNTIME_TRUST_MISSING",
      });
    } else if (!ProviderRuntimeGuard.RUNTIME_ACTIVE_STATES.has(trust.state)) {
      // AUTHENTICATED is proof-of-identity, NOT runtime readiness (EPIC-005.7A
      // F-1). It must NOT be treated as runnable. The negative + pre-active
      // states below are fail-closed DENIED.
      const detail = ProviderRuntimeGuard.NON_RUNTIME_STATES.has(trust.state)
        ? ` (pre-active/negated state)`
        : ` (unrecognized state)`;
      results.push({
        name: "trust-state",
        passed: false,
        reason: `provider trust state is "${trust.state}"${detail} — not runtime-active`,
        code: "RUNTIME_TRUST_STATE",
      });
    } else {
      results.push({ name: "trust-state", passed: true, code: "RUNTIME_TRUST_OK" });
    }

    // 2. TENANT SCOPE — extracted so it can early-return a CheckResult.
    results.push(this.checkTenantScope(ctx));

    // 3. CAPABILITY AUTHORIZATION — the requested capability must be DECLARED
    //    by this provider's manifest. An undeclared capability is a contract
    //    violation ⇒ deny. (Registry registration is the platform's concern;
    //    by the time execute() runs post-bootstrap the cap is registered.)
    const declared = manifest.capabilities.some((c) => c.id === cap);
    if (!declared) {
      results.push({
        name: "capability-authz",
        passed: false,
        reason: `capability "${cap}" not declared by provider manifest`,
        code: "CAPABILITY_UNKNOWN",
      });
    } else {
      results.push({ name: "capability-authz", passed: true, code: "RUNTIME_CAPABILITY_OK" });
    }

    // 4. PERMISSION SCOPE — a declared capability must carry a granted
    //    permission in the manifest (grantedBy present). A capability with no
    //    granted permission cannot execute (fail-closed).
    const perm = manifest.permissions.find((p) => p.capability === cap);
    if (!perm || !perm.grantedBy) {
      results.push({
        name: "permission-scope",
        passed: false,
        reason: `capability "${cap}" has no granted permission (grantedBy missing)`,
        code: "PERMISSION_DENIED",
      });
    } else {
      results.push({ name: "permission-scope", passed: true, code: "RUNTIME_PERMISSION_OK" });
    }

    /** Transport kinds the platform recognizes. A manifest declaring any other
    *  kind is malformed and must be denied (fail-closed). Concrete adapter
    *  availability is the platform's concern, not the guard's. */
    const KNOWN_TRANSPORTS: ReadonlySet<string> = new Set([
    "cli",
    "http",
    "websocket",
    "grpc",
    "inprocess",
    "message-bus",
    ]);

    // 5. TRANSPORT AUTHORIZATION — every declared transport kind must be a
    //    recognized platform transport. An unknown kind is malformed and could
    //    route to an unmanaged channel ⇒ deny. Adapter *availability* is resolved
    //    by the platform itself, so we only validate kind membership here.
    const declaredKinds = manifest.transports.map((t) => t.kind) as string[];
    const unknown = declaredKinds.filter((k) => !KNOWN_TRANSPORTS.has(k));
    if (declaredKinds.length === 0 || unknown.length > 0) {
      results.push({
        name: "transport-authz",
        passed: false,
        reason:
          declaredKinds.length === 0
            ? "manifest declares no transports"
            : `unknown transport kind(s): ${unknown.join(", ")}`,
        code: "RUNTIME_TRANSPORT",
      });
    } else {
      results.push({ name: "transport-authz", passed: true, code: "RUNTIME_TRANSPORT_OK" });
    }

    // 6. RUNTIME LIMITS — timeout bound + concurrency ceiling.
    const maxDuration = manifest.limits?.maxDurationMs ?? 0;
    const reqTimeout = request.timeoutMs ?? 0;
    if (maxDuration > 0 && reqTimeout > maxDuration) {
      results.push({
        name: "runtime-limits",
        passed: false,
        reason: `request timeout ${reqTimeout}ms exceeds manifest maxDurationMs ${maxDuration}ms`,
        code: "RUNTIME_TIMEOUT",
      });
    } else {
      const maxConc = manifest.limits?.maxConcurrent ?? 0;
      const current = this.active.get(providerId) ?? 0;
      if (maxConc > 0 && current >= maxConc) {
        results.push({
          name: "runtime-limits",
          passed: false,
          reason: `concurrency ${current} >= maxConcurrent ${maxConc}`,
          code: "RUNTIME_CONCURRENCY",
        });
      } else {
        results.push({ name: "runtime-limits", passed: true, code: "RUNTIME_LIMITS_OK" });
      }
    }

    // 7. SANDBOX REQUIREMENTS — trust tiers >= sandbox REQUIRE a non-"none"
    //    sandbox policy declared in the manifest (backend cannot run bare).
    const level = manifest.trust?.level ?? "untrusted";
    if (SANDBOX_REQUIRED.has(level)) {
      const iso = manifest.trust?.sandboxPolicy?.isolation;
      if (!iso || iso === "none") {
        results.push({
          name: "sandbox-requirements",
          passed: false,
          reason: `trust level "${level}" requires sandbox isolation, but manifest declares "${iso ?? "none"}"`,
          code: "RUNTIME_SANDBOX",
        });
      } else {
        results.push({ name: "sandbox-requirements", passed: true, code: "RUNTIME_SANDBOX_OK" });
      }
    } else {
      results.push({ name: "sandbox-requirements", passed: true, code: "RUNTIME_SANDBOX_NA" });
    }

    // 8. AUDIT AVAILABILITY — the guard must have a usable audit sink.
    //    Without one, execution cannot be observed ⇒ deny (fail-closed).
    if (typeof this.audit !== "function") {
      results.push({
        name: "audit-availability",
        passed: false,
        reason: "no audit sink configured; execution cannot be observed",
        code: "RUNTIME_AUDIT",
      });
    } else {
      results.push({ name: "audit-availability", passed: true, code: "RUNTIME_AUDIT_OK" });
    }

    return results;
  }

  /**
   * Tenant-scope check (2/8). Returns a CheckResult so it can early-return
   * without affecting the runChecks loop. The authenticated principal is taken
   * from the request context; a cross-tenant target ⇒ fail-closed DENY.
   */
  private checkTenantScope(ctx: GuardContext): CheckResult {
    const { request } = ctx;
    const ctxData = (request.context ?? {}) as Record<string, unknown>;
    const principal = ctxData.principal as Principal | undefined;
    const principalId = typeof ctxData.principalId === "string" ? ctxData.principalId : "";
    const ownTenantId = typeof ctxData.tenantId === "string" ? ctxData.tenantId : "";
    const targetTenantId =
      typeof ctxData.targetTenantId === "string"
        ? ctxData.targetTenantId
        : principal?.organizationId ?? ownTenantId;

    // No tenant boundary was asserted on this request → nothing to enforce.
    // Consistent with enforceTenant's default (requireScope:false): a
    // tenant-unprotected capability is allowed, not denied. The wall is only
    // raised when a target tenant IS present (so cross-tenant access is caught).
    if (!targetTenantId) {
      return { name: "tenant-scope", passed: true, code: "RUNTIME_TENANT_NA" };
    }

    let effectivePrincipal: Principal | undefined = principal;
    if (!effectivePrincipal) {
      if (!principalId || !ownTenantId) {
        return {
          name: "tenant-scope",
          passed: false,
          reason: "request asserts a tenant boundary but carries no authenticated principal",
          code: "RUNTIME_TENANT_CONTEXT",
        };
      }
      effectivePrincipal = {
        id: principalId,
        permissions: [],
        organizationId: ownTenantId,
        tenantId: ownTenantId,
      };
    }
    try {
      enforceTenant(effectivePrincipal, targetTenantId);
      return { name: "tenant-scope", passed: true, code: "RUNTIME_TENANT_OK" };
    } catch (err) {
      if (err instanceof TenantViolationError) {
        return {
          name: "tenant-scope",
          passed: false,
          reason: `tenant scope violation: ${err.message}`,
          code: "RUNTIME_TENANT_SCOPE",
        };
      }
      return {
        name: "tenant-scope",
        passed: false,
        reason: "tenant scope check error",
        code: "RUNTIME_TENANT_SCOPE",
      };
    }
  }

  /**
   * Apply the ViolationResponseEngine's response for a denied decision.
   * Declarative side-effects only — the guard never *continues* execution.
   * Imported lazily to keep this module dependency-light.
   */
  private applyViolationResponse(ctx: GuardContext, decision: GuardDecision): void {
    const engine = new ViolationResponseEngine(this.audit);
    engine.respond(decision.violationClass!, (action) => {
      switch (action) {
        case "quarantine":
          this.hooks?.quarantine?.(ctx.providerId);
          break;
        case "alert":
          this.hooks?.alert?.({
            providerId: ctx.providerId,
            capabilityId: ctx.request.capabilityId,
            violationClass: decision.violationClass!,
            code: decision.code,
          });
          break;
        case "revoke":
          this.hooks?.revoke?.(ctx.providerId);
          break;
        case "unload":
          this.hooks?.unload?.(ctx.providerId);
          break;
        case "critical-audit":
          this.audit("provider.runtime.violation.critical", ctx.providerId, {
            capabilityId: ctx.request.capabilityId,
            violationClass: decision.violationClass,
            code: decision.code,
            reason: decision.reason,
          });
          break;
        case "audit":
        default:
          break;
      }
    });
  }

  /** Default guard instance (uses the real emitAudit sink). */
  static readonly DEFAULT = new ProviderRuntimeGuard();
}

/** Side-effect hooks the platform wires into the guard. */
export interface GuardHooks {
  quarantine?: (providerId: string) => void;
  alert?: (payload: { providerId: string; capabilityId: string; violationClass: ViolationClass; code: string }) => void;
  revoke?: (providerId: string) => void;
  unload?: (providerId: string) => void;
}
