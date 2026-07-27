// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Credential Rotation Service                      │
// │ EPIC-PLATFORM-001: Credential & Secrets Management           │
// │ Reusable platform capability — NOT Concierge-specific         │
// └─────────────────────────────────────────────────────────────┘
//
// Manages the rotation lifecycle for all platform credentials.
// Hermes never uses expired credentials for deployment — fail-closed.

import { CredentialStatus as CS, CredentialAction as CA } from "./types.js";
import type {
  CredentialRecord,
  CredentialRotationService,
  RotationPolicy,
  ProviderId,
} from "./types.js";
import { credentialRegistry } from "./credential-registry.js";

/**
 * Default rotation policies per provider.
 * Cloudflare and OCI tokens have shorter TTLs; others are longer.
 */
const DEFAULT_POLICIES: Record<ProviderId, RotationPolicy> = {
  cloudflare: {
    providerId: "cloudflare",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  github: {
    providerId: "github",
    intervalDays: 90,
    maxAgeDays: 120,
    notifyBeforeDays: 14,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  telegram: {
    providerId: "telegram",
    intervalDays: 365,
    maxAgeDays: 365,
    notifyBeforeDays: 30,
    autoRotate: false,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  openrouter: {
    providerId: "openrouter",
    intervalDays: 90,
    maxAgeDays: 120,
    notifyBeforeDays: 14,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  oci: {
    providerId: "oci",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  google: {
    providerId: "google",
    intervalDays: 90,
    maxAgeDays: 120,
    notifyBeforeDays: 14,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  email: {
    providerId: "email",
    intervalDays: 180,
    maxAgeDays: 270,
    notifyBeforeDays: 21,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  workers: {
    providerId: "workers",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  pages: {
    providerId: "pages",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  d1: {
    providerId: "d1",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  kv: {
    providerId: "kv",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
  r2: {
    providerId: "r2",
    intervalDays: 30,
    maxAgeDays: 45,
    notifyBeforeDays: 7,
    autoRotate: true,
    lastRotatedAt: null,
    nextRotationDue: null,
  },
};

/**
 * Credential Rotation Service — manages credential rotation lifecycle.
 */
export class CredentialRotationServiceImpl implements CredentialRotationService {
  private policies: Record<ProviderId, RotationPolicy>;

  constructor(policies?: Record<ProviderId, RotationPolicy>) {
    this.policies = { ...DEFAULT_POLICIES, ...(policies ?? {}) };
  }

  /**
   * Rotate a credential for a provider.
   * Returns the new credential record with updated timestamps.
   */
  async rotate(providerId: ProviderId): Promise<CredentialRecord | null> {
    const current = await credentialRegistry.get(providerId);
    const policy = this.policies[providerId];
    if (!policy) return null;

    // Archive the current credential (disable it)
    if (current) {
      await credentialRegistry.updateStatus(providerId, CS.DISABLED);
    }

    // Create the new credential record
    const newRecord: CredentialRecord = {
      providerId,
      credentialRef: `rotated-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      source: "hermes-registry",
      status: CS.ACTIVE,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      expiresAt: this.calculateExpiry(policy),
      lastValidatedAt: null,
      lastValidationResult: null,
      permissions: current?.permissions ?? [],
      rotationPolicy: {
        ...policy,
        lastRotatedAt: new Date().toISOString(),
        nextRotationDue: this.calculateNextRotation(policy),
      },
      auditHistory: [
        {
          id: crypto.randomUUID(),
          timestamp: new Date().toISOString(),
          action: CA.ROTATED,
          providerId,
          actor: "credential-rotation-service",
          details: `Credential rotated for provider "${providerId}"`,
          previousStatus: (current?.status as CS) ?? null,
          newStatus: CS.ACTIVE,
        },
      ],
    };

    await credentialRegistry.set(newRecord);
    return newRecord;
  }

  /**
   * Schedule rotation for a provider (set up the timer).
   */
  async scheduleRotation(providerId: ProviderId): Promise<void> {
    const policy = this.policies[providerId];
    if (!policy || !policy.autoRotate) return;

    const now = new Date();
    const nextDue = policy.nextRotationDue
      ? new Date(policy.nextRotationDue)
      : this.calculateNextRotation(policy);

    // If already past due, rotate immediately
    if (nextDue <= now) {
      await this.rotate(providerId);
    }
  }

  /**
   * Get all providers whose credentials are due for rotation.
   */
  async getDueRotations(): Promise<ProviderId[]> {
    const all = await credentialRegistry.listAll();
    const due: ProviderId[] = [];

    for (const record of all) {
      const policy = this.policies[record.providerId];
      if (!policy || !policy.autoRotate) continue;

      const nextDue = policy.nextRotationDue
        ? new Date(policy.nextRotationDue)
        : null;

      if (nextDue && nextDue <= new Date()) {
        due.push(record.providerId);
      }
    }

    return due;
  }

  private calculateExpiry(policy: RotationPolicy): string | null {
    if (policy.maxAgeDays === 0) return null;
    const expiry = new Date();
    expiry.setDate(expiry.getDate() + policy.maxAgeDays);
    return expiry.toISOString();
  }

  private calculateNextRotation(policy: RotationPolicy): string {
    const next = new Date();
    next.setDate(next.getDate() + policy.intervalDays);
    return next.toISOString();
  }
}

export const credentialRotationService = new CredentialRotationServiceImpl();