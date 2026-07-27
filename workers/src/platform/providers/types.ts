// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Provider Registry Types                   │
// │ EPIC-PLATFORM-002: Provider Registry                       │
// │ Reusable platform capability — NOT Concierge-specific      │
// └─────────────────────────────────────────────────────────────┘
//
// Types for the Provider Registry capability.
// Each provider exposes its ID, capability, credentials,
// validation routine, health status, scopes, rotation policy,
// and audit history. Platform-first design.

/**
 * Provider identifiers registered in the system.
 */
export type ProviderId =
  | "cloudflare"
  | "github"
  | "telegram"
  | "openrouter"
  | "oci"
  | "google"
  | "email"
  | "workers"
  | "pages"
  | "d1"
  | "kv"
  | "r2";

/**
 * Health status of a registered provider.
 */
export enum ProviderHealthStatus {
  HEALTHY = "healthy",
  DEGRADED = "degraded",
  UNHEALTHY = "unhealthy",
  UNKNOWN = "unknown",
}

/**
 * Capability exposed by a provider.
 */
export type ProviderCapability =
  | "deployment"
  | "secrets"
  | "auth"
  | "messaging"
  | "compute"
  | "storage"
  | "dns"
  | "monitoring"
  | "identity"
  | "orchestration";

/**
 * Required OAuth scopes for a provider.
 */
export interface RequiredScope {
  scope: string;
  description: string;
  critical: boolean;
}

/**
 * Rotation policy for a provider's credentials.
 */
export interface RotationPolicy {
  intervalDays: number;
  maxAgeDays: number;
  notifyBeforeDays: number;
  autoRotate: boolean;
}

/**
 * Audit history entry for a provider.
 */
export interface ProviderAuditEntry {
  id: string;
  timestamp: string;
  action: string;
  actor: string;
  details: string;
  previousHealth: ProviderHealthStatus | null;
  newHealth: ProviderHealthStatus | null;
}

/**
 * A registered provider.
 * Each provider must expose all mandatory fields.
 */
export interface RegisteredProvider {
  providerId: ProviderId;
  name: string;
  description: string;
  capability: ProviderCapability;
  credentials: {
    source: string;
    lastValidatedAt: string | null;
    status: "valid" | "invalid" | "expired" | "stale";
  };
  validationRoutine: {
    endpoint: string;
    method: string;
    intervalSeconds: number;
    lastRunAt: string | null;
    lastResult: boolean;
  };
  healthStatus: ProviderHealthStatus;
  requiredScopes: RequiredScope[];
  rotationPolicy: RotationPolicy;
  auditHistory: ProviderAuditEntry[];
  registeredAt: string;
  updatedAt: string;
}

/**
 * Provider registry — the central store for all registered providers.
 */
export interface ProviderRegistry {
  register(provider: RegisteredProvider): Promise<void>;
  updateHealth(providerId: ProviderId, status: ProviderHealthStatus): Promise<void>;
  get(providerId: ProviderId): Promise<RegisteredProvider | null>;
  listAll(): Promise<RegisteredProvider[]>;
  listByCapability(capability: ProviderCapability): Promise<RegisteredProvider[]>;
  remove(providerId: ProviderId): Promise<void>;
  validateAll(): Promise<Record<ProviderId, boolean>>;
  healthCheckAll(): Promise<Record<ProviderId, ProviderHealthStatus>>;
}

/**
 * Provider registration request — used to register a new provider.
 */
export interface RegisterProviderRequest {
  providerId: ProviderId;
  name: string;
  description: string;
  capability: ProviderCapability;
  credentials: {
    source: string;
  };
  validationRoutine: {
    endpoint: string;
    method: string;
    intervalSeconds: number;
  };
  requiredScopes: RequiredScope[];
  rotationPolicy: RotationPolicy;
}