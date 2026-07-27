// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential & Secrets Management Types
// │ EPIC-PLATFORM-001: Credential & Secrets Management
// │ Reusable platform capability — NOT Concierge-specific
// └─────────────────────────────────────────────────────────────┘
//
// Types for the Credential & Secrets Management capability.
// All credential resolution, validation, and rotation logic
// imports from these contracts. Platform-first design: no
// product-specific types leak into this interface.

/**
 * Unique provider identifier.
 * One active credential per provider at any time.
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
 * Credential source — where a credential was loaded from.
 */
export type CredentialSource =
  | "hermes-registry"
  | "~/.hermes"
  | "~/.wrangler"
  | "wrangler-auth"
  | "env-var"
  | "cf-workers-secret"
  | "cf-pages-var"
  | "github-secret"
  | "github-var"
  | "oci-config"
  | "deployment-script"
  | "archived-config";

/**
 * Credential status lifecycle.
 */
export enum CredentialStatus {
  ACTIVE = "active",
  ROTATING = "rotating",
  EXPIRED = "expired",
  INVALID = "invalid",
  STALE = "stale",
  DISABLED = "disabled",
}

/**
 * Credential health check result.
 */
export interface CredentialHealth {
  providerId: ProviderId;
  status: CredentialStatus;
  valid: boolean;
  expiresAt: string | null;
  lastChecked: string;
  source: CredentialSource;
  failureReason: string | null;
  permissions: string[];
}

/**
 * Validation result for a credential.
 */
export interface CredentialValidation {
  providerId: ProviderId;
  valid: boolean;
  source: CredentialSource;
  reason: string | null;
  checkedAt: string;
  permissions: string[];
}

/**
 * Rotation policy for a credential provider.
 */
export interface RotationPolicy {
  providerId: ProviderId;
  intervalDays: number;
  maxAgeDays: number;
  notifyBeforeDays: number;
  autoRotate: boolean;
  lastRotatedAt: string | null;
  nextRotationDue: string | null;
}

/**
 * Credential registry entry — the canonical record for one provider.
 */
export interface CredentialRecord {
  providerId: ProviderId;
  credentialRef: string;
  source: CredentialSource;
  status: CredentialStatus;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lastValidationResult: CredentialValidation | null;
  permissions: string[];
  rotationPolicy: RotationPolicy;
  auditHistory: AuditEntry[];
}

/**
 * A single audit log entry for credential changes.
 */
export interface AuditEntry {
  id: string;
  timestamp: string;
  action: CredentialAction;
  providerId: ProviderId;
  actor: string;
  details: string;
  previousStatus: CredentialStatus | null;
  newStatus: CredentialStatus | null;
}

export enum CredentialAction {
  REGISTERED = "registered",
  VALIDATED = "validated",
  ROTATED = "rotated",
  DISABLED = "disabled",
  EXPIRED = "expired",
  FAILED_VALIDATION = "failed_validation",
  ACCESS_CHECK = "access_check",
}

/**
 * Credential resolver — maps a deployment target to a credential.
 */
export interface CredentialResolver {
  resolve(providerId: ProviderId): Promise<CredentialRecord | null>;
  resolveAll(): Promise<CredentialRecord[]>;
}

/**
 * Credential validator — checks if a credential is still valid.
 */
export interface CredentialValidator {
  validate(providerId: ProviderId): Promise<CredentialValidation>;
  validateAll(): Promise<CredentialValidation[]>;
}

/**
 * Credential health checker — runs all provider health checks.
 */
export interface CredentialHealthChecker {
  checkAll(): Promise<CredentialHealth[]>;
  check(providerId: ProviderId): Promise<CredentialHealth>;
}

/**
 * Credential rotation service — manages rotation lifecycle.
 */
export interface CredentialRotationService {
  rotate(providerId: ProviderId): Promise<CredentialRecord>;
  scheduleRotation(providerId: ProviderId): Promise<void>;
  getDueRotations(): Promise<ProviderId[]>;
}

/**
 * Credential registry — the central store for all credential records.
 */
export interface CredentialRegistry {
  get(providerId: ProviderId): Promise<CredentialRecord | null>;
  set(record: CredentialRecord): Promise<void>;
  listAll(): Promise<CredentialRecord[]>;
  remove(providerId: ProviderId): Promise<void>;
  updateStatus(
    providerId: ProviderId,
    status: CredentialStatus,
  ): Promise<void>;
}

/**
 * Deployment readiness — result of checking all credentials before a deploy.
 */
export interface DeploymentReadiness {
  deployable: boolean;
  providerId: ProviderId;
  credential: CredentialRecord | null;
  validation: CredentialValidation | null;
  health: CredentialHealth | null;
  failureReason: string | null;
  checkedAt: string;
}

/**
 * Deployment report — deterministic report produced after credential resolution.
 */
export interface DeploymentReport {
  deploymentId: string;
  timestamp: string;
  environment: "preview" | "production";
  provider: ProviderId;
  credentialSource: CredentialSource;
  credentialStatus: CredentialStatus;
  validation: CredentialValidation;
  health: CredentialHealth | null;
  permissions: string[];
  deployable: boolean;
  failureReason: string | null;
  auditId: string;
}