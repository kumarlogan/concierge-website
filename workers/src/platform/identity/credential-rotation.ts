// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Credential Rotation Manager      │
// │ Supports credential expiry tracking, rotation scheduling.   │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import { PasswordManager } from "./password-manager.js";
import type { IdentityCredentialRecord } from "./types.js";

export interface RotationPolicy {
  passwordExpiryDays: number;
  apiTokenExpiryDays: number;
  oauthTokenExpiryDays: number;
  warningDays: number;
}

const DEFAULT_ROTATION_POLICY: RotationPolicy = {
  passwordExpiryDays: 90,
  apiTokenExpiryDays: 30,
  oauthTokenExpiryDays: 365,
  warningDays: 14,
};

/**
 * Credential Rotation Manager — tracks credential lifecycle.
 * Works with password expiry, API token rotation, and OAuth access tokens.
 */
export class CredentialRotationManager {
  private readonly repo: IdentityRepository;
  private readonly passwords: PasswordManager;
  private readonly policy: RotationPolicy;

  constructor(
    repo: IdentityRepository,
    passwords: PasswordManager,
    policy?: Partial<RotationPolicy>,
  ) {
    this.repo = repo;
    this.passwords = passwords;
    this.policy = { ...DEFAULT_ROTATION_POLICY, ...policy };
  }

  /**
   * Check if credentials need rotation.
   * Returns credentials that are expiring or expired.
   */
  async checkExpiringCredentials(
    identityId: string,
  ): Promise<{
    expiring: IdentityCredentialRecord[];
    expired: IdentityCredentialRecord[];
  }> {
    const activeCredentials = await this.repo.getActiveCredentials(identityId);
    const now = Date.now();
    const warningMs = this.policy.warningDays * 24 * 60 * 60 * 1000;

    const expiring: IdentityCredentialRecord[] = [];
    const expired: IdentityCredentialRecord[] = [];

    for (const cred of activeCredentials) {
      if (!cred.expires_at) continue;

      const expiryTime = new Date(cred.expires_at).getTime();
      if (now >= expiryTime) {
        expired.push(cred);
      } else if (expiryTime - now <= warningMs) {
        expiring.push(cred);
      }
    }

    return { expiring, expired };
  }

  /**
   * Rotate all expired credentials for an identity.
   * Returns count of rotated credentials.
   */
  async rotateExpiredCredentials(identityId: string): Promise<number> {
    const { expired } = await this.checkExpiringCredentials(identityId);
    let rotated = 0;

    for (const cred of expired) {
      await this.repo.revokeCredential(cred.id);
      rotated++;
    }

    return rotated;
  }

  /**
   * Calculate password expiry date from policy.
   */
  getPasswordExpiry(): string {
    return new Date(
      Date.now() + this.policy.passwordExpiryDays * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  /**
   * Get days until password expiration for an identity.
   */
  async daysUntilPasswordExpiry(identityId: string): Promise<number | null> {
    const credentials = await this.repo.getActiveCredentials(identityId);
    const passwordCred = credentials.find(
      (c) => c.credential_type === "password_hash",
    );

    if (!passwordCred?.expires_at) return null;

    const expiryTime = new Date(passwordCred.expires_at).getTime();
    const diff = expiryTime - Date.now();
    return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
  }

  /**
   * Get the rotation policy.
   */
  getPolicy(): RotationPolicy {
    return { ...this.policy };
  }
}