// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Universal Capability Platform Orchestrator   │
// │ EPIC-005.1 · PHASE 0 wiring + glue                              │
// │                                                               │
// │ This is the ONLY place that composes the subsystems. It is      │
// │ 100% provider-neutral: it knows about Manifests, Trust,         │
// │ Transports, and the Marketplace — never about Claude.           │
// │                                                              
// │ To add a provider: register its manifest + a factory here.      │
// │ To add a transport: register it in the TransportRegistry.       │
// │ No edit to this file changes behavior for any specific vendor.  │
// └─────────────────────────────────────────────────────────────┘

import { TrustLifecycle, type TrustConfig, type TrustRecord } from "./trust/lifecycle.js";
import { ProviderMarketplace } from "./marketplace.js";
import { TransportRegistry } from "./transport.js";
import type { ProviderManifestV2 } from "./manifest-v2.js";
import type { TrustStateStore } from "./trust/persistence/trust-state-store.js";
import type { Provider, ProviderResult } from "./sdk.js";
import { okResult, errResult } from "./sdk.js";
import type { CapabilityRegistry } from "./capability.js";
import {
  ProviderRuntimeGuard,
  type GuardHooks,
  type GuardDecision,
} from "./runtime/index.js";
import { HermesExecutionGateway } from "../execution/gateway/hermes-execution-gateway.js";
import type { GatewayRequest, GatewayProviderContext } from "../execution/gateway/hermes-execution-gateway.js";
import { ExecutionPolicyEvaluator, type PolicyEvaluatorDeps } from "../execution/policy-evaluator.js";
import type { Principal } from "../../contracts/platform-api.js";
import { type ApprovalService } from "../execution/gateway/approval.js";
import { emitAudit } from "../../audit/event.js";

/** A single provider's wiring: its manifest + a factory that builds it. */
export interface ProviderWiring {
  manifest: ProviderManifestV2;
  /** Builds a live Provider from the manifest using registered transports. */
  factory: (manifest: ProviderManifestV2, transports: TransportRegistry) => Provider;
}

/**
 * The Universal Capability Platform. Owns discovery, trust admission,
 * marketplace visibility, capability registration, and audit emission.
 * Providers only ever receive approved, normalized requests.
 */
export class UniversalCapabilityPlatform {
  private readonly lifecycle: TrustLifecycle;
  private readonly transports = new TransportRegistry();
  private readonly manifests = new Map<string, ProviderManifestV2>();
  private readonly wirings = new Map<string, ProviderWiring>();
  private readonly liveProviders = new Map<string, Provider>();
  readonly marketplace: ProviderMarketplace;
  private readonly auditLog: AuditEvent[] = [];
  /** EPIC-005.5 — runtime enforcement boundary (provider-neutral). */
  private readonly runtimeGuard: ProviderRuntimeGuard;
  /** EPIC-005.6 — single governed execution gateway (tenant→policy→approval→guard). */
  private readonly gateway: HermesExecutionGateway;
  /** EPIC-005.6 — live policy evaluator, refreshed as manifests register. */
  private policy: ExecutionPolicyEvaluator;

  constructor(
    private readonly trustConfig: TrustConfig,
    private readonly capabilityRegistry: CapabilityRegistry,
    runtimeGuard?: ProviderRuntimeGuard,
    stateStore?: TrustStateStore,
  ) {
    this.lifecycle = new TrustLifecycle(trustConfig, stateStore);
    this.lifecycle.setLoader((m) => this.instantiateFromWiring(m));
    this.marketplace = new ProviderMarketplace(this.lifecycle, this.manifests);
    this.runtimeGuard = runtimeGuard ?? ProviderRuntimeGuard.DEFAULT;
    // The gateway is the ONLY execution chokepoint. It reuses the same
    // runtime guard the platform previously applied directly, plus the
    // policy evaluator. Approvals are fail-closed (required when the
    // policy marks a capability approval-gated; Stack A runs system-internal
    // executions that the platform does not gate behind human approval).
    const policyDeps: PolicyEvaluatorDeps = {
      capabilities: this.capabilityRegistry,
      knownProviders: () => Array.from(this.liveProviders.keys()),
    };
    this.policy = new ExecutionPolicyEvaluator(policyDeps);
    this.gateway = new HermesExecutionGateway({
      policy: this.policy,
      guard: this.runtimeGuard,
      approvals: this.failClosedApprovals(),
    });
  }

  /** Register a Hermes-owned transport (reusable across providers). */
  registerTransport(kind: Parameters<TransportRegistry["register"]>[0], t: Parameters<TransportRegistry["register"]>[1]): void {
    this.transports.register(kind, t);
  }

  /** Read-only access to the shared transport registry (for the generic loader). */
  get transportRegistry(): TransportRegistry {
    return this.transports;
  }

  /** Replace the trust config at runtime (Hermes-owned policy override). */
  setTrustConfig(cfg: TrustConfig): void {
    (this as unknown as { trustConfig: TrustConfig }).trustConfig = cfg;
    this.lifecycle.setConfig(cfg);
  }

  /** Remove a provider's wiring (used by unload/reload). */
  unregisterProvider(providerId: string): void {
    this.wirings.delete(providerId);
    this.manifests.delete(providerId);
    this.liveProviders.delete(providerId);
    this.audit({ type: "PROVIDER_UNREGISTERED", providerId });
  }

  /** Tear down a loaded provider and remove it from the live set. */
  async unloadProvider(providerId: string): Promise<boolean> {
    const provider = this.liveProviders.get(providerId);
    if (!provider) return false;
    await provider.shutdown();
    this.liveProviders.delete(providerId);
    this.lifecycle.setUnloaded(providerId);
    this.audit({ type: "PROVIDER_UNLOADED", providerId });
    return true;
  }

  /**
   * Register a provider by its manifest + factory. The platform only learns
   * about providers through THIS data — never through hardcoded imports.
   */
  registerProvider(wiring: ProviderWiring): void {
    this.manifests.set(wiring.manifest.id, wiring.manifest);
    this.wirings.set(wiring.manifest.id, wiring);
    this.audit({ type: "PROVIDER_REGISTERED", providerId: wiring.manifest.id });
  }

  /**
   * Discover → trust-admit → load → register capabilities → activate.
   * Fail-closed: any gate failure leaves the provider REJECTED and out of
   * the marketplace. Returns the resulting provider or undefined (rejected).
   */
  async bootstrap(providerId: string): Promise<Provider | undefined> {
    const wiring = this.wirings.get(providerId);
    if (!wiring) {
      this.audit({ type: "PROVIDER_DISCOVER_FAILED", providerId, reason: "no wiring registered" });
      return undefined;
    }
    this.audit({ type: "PROVIDER_DISCOVERED", providerId });

    let record: TrustRecord;
    let provider: Provider | undefined;
    try {
      const admitted = await this.lifecycle.admit(wiring.manifest);
      record = admitted.record;
      provider = admitted.provider;
    } catch (e) {
      // Fail-closed: any admission error (incl. factory throw) → REJECTED.
      this.audit({
        type: "PROVIDER_REJECTED",
        providerId,
        stage: "LOAD",
        reason: `admission threw: ${(e as Error).message}`,
      });
      return undefined;
    }
    if (record.state === "REJECTED" || !provider) {
      this.audit({
        type: "PROVIDER_REJECTED",
        providerId,
        stage: record.rejectedAt?.stage ?? "UNKNOWN",
        reason: record.rejectedAt?.reason ?? "rejected",
      });
      return undefined;
    }

    // Register the provider's capabilities into the shared registry.
    this.liveProviders.set(providerId, provider);
    this.lifecycle.activate(providerId);
    const meta = provider.metadata();
    for (const cap of meta.capabilities) {
      this.capabilityRegistry.register([
        { id: cap, name: cap, provider: providerId as never, config: {}, impl: provider },
      ]);
    }
    this.audit({ type: "PROVIDER_LOADED", providerId, capabilities: meta.capabilities });
    return provider;
  }

  /**
   * Execute a capability against a loaded provider (already trust-admitted).
   *
   * EPIC-005.6 — every execution now routes through the single governed
   * gateway (tenant → policy → approval → runtime-guard). The platform no
   * longer applies the guard directly; the gateway IS the boundary. The
   * external contract (a `ProviderResult`) is unchanged, so callers and the
   * rest of the manager pipeline are unaffected.
   */
  async execute(
    providerId: string,
    req: Parameters<Provider["execute"]>[0],
  ): Promise<ReturnType<Provider["execute"]> extends Promise<infer R> ? R : never> {
    const provider = this.liveProviders.get(providerId);
    if (!provider) {
      const err = {
        ok: false as const,
        backend: providerId,
        code: "PROVIDER_UNAVAILABLE",
        message: `provider "${providerId}" is not loaded`,
        durationMs: 0,
      };
      this.audit({ type: "EXECUTION_REJECTED", providerId, reason: "not loaded", capabilityId: req.capabilityId });
      return err;
    }
    this.audit({ type: "EXECUTION_REQUESTED", providerId, capabilityId: req.capabilityId, invocationId: req.invocationId });

    // Stack A runs system-internal executions (no end-user tenant). Derive a
    // system security context from the REAL loaded provider id so the gateway's
    // tenant + policy + guard gates still run. No user identity is invented.
    const executionId = req.invocationId ? `${providerId}:${req.invocationId}` : `${providerId}:${Date.now()}`;
    const principal: Principal = {
      id: `system:${providerId}`,
      organizationId: providerId,
      tenantId: providerId,
      permissions: [],
    };
    const gwReq: GatewayRequest = {
      executionId,
      tenantId: providerId,
      principal,
      providerId,
      providerRequest: req,
      capabilityId: req.capabilityId,
      // System-internal: the platform does not gate behind human approval.
      approvalRequired: false,
      // Stack A executions are pre-authorized at the trust-admission stage.
      lifecycleState: "approved",
    };
    const providerCtx: GatewayProviderContext = {
      manifest: this.manifests.get(providerId)!,
      trust: this.lifecycle.getRecord(providerId),
      transports: this.transports,
      capabilities: this.capabilityRegistry,
    };

    const gwRes = await this.gateway.execute(gwReq, providerCtx, (_capabilityId, r) =>
      provider.execute(r),
    );
    // Release any runtime-guard lease the gateway acquired for this execution.
    this.runtimeGuard.release(executionId);

    if (gwRes.ok) {
      const result = gwRes.outcome;
      this.audit({
        type: result.ok ? "EXECUTION_SUCCESS" : "EXECUTION_FAILURE",
        providerId,
        capabilityId: req.capabilityId,
        invocationId: req.invocationId,
        code: result.ok ? undefined : result.code,
      });
      return result;
    }

    this.audit({
      type: "PROVIDER_RUNTIME_DENIED",
      providerId,
      capabilityId: req.capabilityId,
      invocationId: req.invocationId,
      reason: gwRes.reason,
      code: gwRes.code,
    });
    return errResult(providerId, gwRes.code, gwRes.reason, 0);
  }

  /** Fail-closed approval verifier: Stack A never requires human approval. */
  private failClosedApprovals(): ApprovalService {
    return {
      verify(): void {
        throw new Error("Stack A execution does not require an approval ref");
      },
    };
  }

  async cancel(providerId: string, invocationId: string): Promise<void> {
    const provider = this.liveProviders.get(providerId);
    if (provider) await provider.cancel(invocationId);
    this.audit({ type: "EXECUTION_CANCELLED", providerId, invocationId });
  }

  /** Probe health for all loaded providers; updates trust + marketplace. */
  async probeHealth(providerId: string): Promise<void> {
    const provider = this.liveProviders.get(providerId);
    if (!provider) return;
    const health = await provider.health();
    this.lifecycle.reportHealth(providerId, health);
    this.audit({ type: "HEALTH_PROBE", providerId, health });
  }

  getAuditLog(): AuditEvent[] {
    return [...this.auditLog];
  }

  private instantiateFromWiring(m: ProviderManifestV2): Provider | undefined {
    const wiring = this.wirings.get(m.id);
    return wiring ? wiring.factory(m, this.transports) : undefined;
  }

  private audit(ev: AuditEvent): void {
    this.auditLog.push({ ...ev, at: new Date().toISOString() });
  }
}

export interface AuditEvent {
  type: string;
  providerId: string;
  at?: string;
  reason?: string;
  stage?: string;
  capabilityId?: string;
  invocationId?: string;
  capabilities?: string[];
  health?: string;
  code?: string;
}
