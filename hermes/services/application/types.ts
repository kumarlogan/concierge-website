// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Application Management Layer                  │
// │ EPIC-005.95 · Phase 1 (Application abstraction)                │
// │                                                                │
// │ NEW, ADDITIVE module. Does NOT modify the frozen Foundation    │
// │ (HermesExecutionGateway, TrustLifecycle, ProviderRuntimeGuard, │
// │ UniversalCapabilityPlatform, Provider SDK, Marketplace, Tenant  │
// │ model). It depends ONLY on frozen seams:                        │
// │   • provider-framework (ManagedProvider, capability registry)    │
// │   • providers/sdk (ProviderRequest / ProviderOutcome)            │
// │   • execution/gateway/hermes-execution-gateway (single boundary)│
// │   • providers/trust/lifecycle (TrustRecord)                      │
// │   • contracts/platform-api (Principal, TenantScope)              │
// │   • audit/event (emitAudit)                                      │
// │                                                                │
// │ An Application is a stable, provider-neutral record that maps a │
// │ real product (AGS Fertility = #1) to: repositories, providers,  │
// │ environments, capability intents, and a lifecycle/health state. │
// │ All concrete work is dispatched through the SINGLE execution   │
// │ boundary (HermesExecutionGateway) — never directly at a vendor. │
// └─────────────────────────────────────────────────────────────┘

import type { Principal, TenantScope } from "../../contracts/platform-api.js";
import type { ProviderRequest, ProviderOutcome } from "../providers/sdk.js";
import type { ApprovalRef } from "../execution/gateway/approval.js";
import type { TrustRecord } from "../providers/trust/lifecycle.js";

// ─── Identity & lifecycle ────────────────────────────────────────────────

/** Application lifecycle states (distinct from provider/resource states). */
export type ApplicationLifecycleState =
  | "registered" // declared in Hermes, not yet operating
  | "discovered" // components inventoried
  | "operating" // Hermes actively manages build/test/deploy/health
  | "maintenance" // temporarily paused (no deploys)
  | "retired"; // decommissioned

/** Health rollups reuse the SDK's provider-health vocabulary (no new types). */
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/** Environments an application may span (reuses ENVIRONMENT_MODEL.md). */
export type ApplicationEnvironment =
  | "development"
  | "testing"
  | "staging"
  | "production"
  | "sandbox"
  | "experimental";

/** Autonomy classification for a single capability (Phase 6). */
export type AutonomyClass =
  | "FULLY_AUTONOMOUS" // Hermes runs end-to-end, no human in loop
  | "APPROVAL_REQUIRED" // Hermes runs but needs a verified ApprovalRef first
  | "MANUAL_ONLY"; // Hermes can plan/describe but cannot perform (no binding)

// ─── Mapping structures ───────────────────────────────────────────────────

/**
 * A single repository owned by the application. Provider-neutral: the repo host
 * is a `providerId` string resolved against the provider framework at runtime.
 */
export interface ApplicationRepository {
  id: string;
  /** e.g. "kumarlogan/hermes-website". */
  name: string;
  /** Provider that hosts the repo (must resolve to a registered provider). */
  providerId: string;
  /** Default branch Hermes targets. */
  defaultBranch: string;
  /** Environments this repo serves. */
  environments: ApplicationEnvironment[];
  /** Free-form non-secret metadata (language, framework). */
  meta?: Record<string, unknown>;
}

/**
 * A capability intent the application exposes/consumes, expressed as a
 * provider-neutral intention id (e.g. "deploy.website"). The concrete backend
 * is resolved dynamically by the provider framework — never hardcoded here.
 */
export interface ApplicationCapabilityBinding {
  /** Provider-neutral intention id (EPIC-005.1). */
  intent: string;
  /** Human label. */
  label: string;
  /** Environments this binding applies to. */
  environments: ApplicationEnvironment[];
  /**
   * Autonomy class for this intent. Drives whether Hermes can run it without a
   * human approval token. Does NOT bypass the gateway — APPROVAL_REQUIRED
   * intents still pass through the boundary with a verified ApprovalRef.
   */
  autonomy: AutonomyClass;
  /** Optional non-secret config carried into the ProviderRequest. */
  config?: Record<string, unknown>;
}

/**
 * A provider dependency of the application. Declares the provider's declared
 * capabilities, health, auth model, trust model, and ownership — but contains
 * NO provider-specific execution logic (that lives behind the provider's
 * manifest + executor port in the frozen layer).
 */
export interface ApplicationProviderBinding {
  /** Provider id (resolves to a ManagedProvider in the provider framework). */
  providerId: string;
  /** Role this provider plays for the application (documentation only). */
  role: string;
  /** Capability intents this application uses from the provider. */
  capabilities: string[];
  /** Declared auth model (mirrors the provider manifest; never secretes). */
  authModel: "none" | "token" | "oauth" | "mtls" | "ssh-key";
  /** Declared trust level (mirrors SDK TrustLevel). */
  trustLevel: "untrusted" | "sandbox" | "trusted" | "privileged";
  /** Ownership statement (who operates the provider). */
  ownership: string;
}

/** A deployment target descriptor (provider-neutral). */
export interface ApplicationDeploymentTarget {
  id: string;
  label: string;
  environment: ApplicationEnvironment;
  /** Provider that hosts the target (resolves at runtime). */
  providerId: string;
  /** Resource kind (worker | pages | d1 | r2 | kv | repo). */
  kind: "worker" | "pages" | "d1" | "r2" | "kv" | "repo";
  /** Non-secret handle (e.g. worker name, D1 id, repo name). */
  handle: string;
}

// ─── Application record ───────────────────────────────────────────────────

/** The Application abstraction — Application #1 (AGS Fertility) is one of these. */
export interface Application {
  /** Stable application id (e.g. "ags-fertility"). */
  id: string;
  /** Human name. */
  name: string;
  /** Owning tenant (EPIC-003-006 M4) — isolation boundary. */
  tenant: TenantScope;
  /** Monotonic sequence number; AGS Fertility = 1. */
  sequence: number;
  lifecycle: ApplicationLifecycleState;
  registeredAt: string;
  updatedAt: string;

  repositories: ApplicationRepository[];
  providers: ApplicationProviderBinding[];
  environments: ApplicationEnvironment[];
  capabilities: ApplicationCapabilityBinding[];
  deploymentTargets: ApplicationDeploymentTarget[];

  /** Non-secret operational metadata (domains, region, notes). */
  meta?: Record<string, unknown>;
}

// ─── Health model (Phase 5) ──────────────────────────────────────────────

export interface HealthDimension {
  dimension:
    | "build"
    | "deployment"
    | "repository"
    | "documentation"
    | "security"
    | "infrastructure";
  status: HealthStatus;
  /** 0..100 sub-score. */
  score: number;
  detail?: string;
  checkedAt: string;
}

export interface ApplicationHealth {
  applicationId: string;
  dimensions: HealthDimension[];
  /** 0..100 overall score (weighted). */
  overallScore: number;
  status: HealthStatus;
  checkedAt: string;
}

// ─── Execution request envelope (Phase 4) ────────────────────────────────

/**
 * A Hermes-originated request to operate the application. This layer turns it
 * into a GatewayRequest and dispatches through HermesExecutionGateway — it
 * NEVER invokes a provider directly.
 */
export interface ApplicationOperationRequest {
  applicationId: string;
  /** Provider-neutral capability intent (e.g. "deploy.website"). */
  intent: string;
  environment: ApplicationEnvironment;
  actor: Principal;
  /** Whether a verified human approval is supplied (for APPROVAL_REQUIRED). */
  approvalRef?: ApprovalRef;
  /** Non-secret args forwarded into the ProviderRequest. */
  args?: Record<string, unknown>;
  /** Optional workflow id for audit correlation. */
  workflowId?: string;
}

/** The result of an application operation routed through the single boundary. */
export interface ApplicationOperationResult {
  ok: boolean;
  intent: string;
  /** Underlying provider outcome (when allowed). */
  outcome?: ProviderOutcome;
  /** Gateway denial code when refused (proves single-boundary enforcement). */
  denialCode?: string;
  reason?: string;
  routedProviderId?: string;
  durationMs?: number;
}

// Re-exported frozen types for convenience (no redefinition).
export type { Principal, TenantScope, ProviderRequest, ProviderOutcome, ApprovalRef, TrustRecord };
