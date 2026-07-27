// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Password Reset                   │
// │ Secure password reset with expiration, rate limiting.       │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import { PasswordManager } from "./password-manager.js";
import type { PasswordResetRecord } from "./types.js";
import { NotFoundError, AuthenticationError, IdentityError } from "./types.js";

export class PasswordResetManager {
  private readonly repo: IdentityRepository;
  private readonly passwords: PasswordManager;
  private readonly expiryMs: number;
  private readonly tokenByteLength: number;
  /** Simple in-memory rate limiter: recent requests per email. */
  private readonly recentRequests: Map<string, number> = new Map();
  private readonly rateLimitCooldown: number;

  constructor(
    repo: IdentityRepository,
    passwords: PasswordManager,
    opts: {
      expiryMs?: number;
      tokenByteLength?: number;
      rateLimitMs?: number;
    } = {},
  ) {
    this.repo = repo;
    this.passwords = passwords;
    this.expiryMs = opts.expiryMs ?? 60 * 60 * 1000; // 1 hour
    this.tokenByteLength = opts.tokenByteLength ?? 48;
    this.rateLimitCooldown = opts.rateLimitMs ?? 60_000; // 1 minute
  }

  /**
   * Request a password reset for an email.
   * Returns the plaintext reset token. In production, this would be
   * emailed to the user instead of returned directly.
   */
  async requestReset(email: string): Promise<string> {
    // Rate limit: one request per email per cooldown window
    const lastReq = this.recentRequests.get(email);
    if (lastReq && Date.now() - lastReq < this.rateLimitCooldown) {
      // Don't reveal if email exists or not — always return a token
      return "rate_limited";
    }
    this.recentRequests.set(email, Date.now());

    const identity = await this.repo.findIdentityByEmail(email);
    if (!identity) {
      // Don't reveal whether email exists — return as if sent
      return "reset_requested";
    }

    const tokenBytes = crypto.getRandomValues(new Uint8Array(this.tokenByteLength));
    const plaintext = this.toBase64url(tokenBytes);
    const hash = await this.hashToken(plaintext);

    const record: PasswordResetRecord = {
      id: crypto.randomUUID(),
      identity_id: identity.id,
      token_hash: hash,
      expires_at: new Date(Date.now() + this.expiryMs).toISOString(),
      created_at: new Date().toISOString(),
    };

    await this.repo.storePasswordReset(record);
    return plaintext;
  }

  /**
   * Complete a password reset with the token and new password.
   */
  async completeReset(plaintext: string, newPassword: string): Promise<void> {
    const hash = await this.hashToken(plaintext);
    const record = await this.repo.findPasswordReset(hash);

    if (!record) {
      throw new NotFoundError("Invalid reset token");
    }

    if (record.used_at) {
      throw new AuthenticationError("Reset token already used");
    }

    const now = Date.now();
    if (now >= new Date(record.expires_at).getTime()) {
      throw new NotFoundError("Reset token has expired");
    }

    // Validate new password
    const validation = this.passwords.validate(newPassword);
    if (!validation.valid) {
      throw new IdentityError(
        `Password validation failed: ${validation.errors.join("; ")}`,
        "INVALID_PASSWORD",
        400,
        { errors: validation.errors },
      );
    }

    // Hash new password
    const newHash = await this.passwords.hash(newPassword);

    // Update identity password
    await this.repo.updateIdentity(record.identity_id, {
      password_hash: newHash,
    });

    // Mark reset token as used
    await this.repo.usePasswordReset(record.id);

    // Revoke all refresh tokens (force re-login)
    await this.repo.revokeIdentityRefreshTokens(record.identity_id);

    // Revoke all sessions
    await this.repo.revokeIdentitySessions(record.identity_id);
  }

  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    return this.toBase64url(new Uint8Array(hashBuffer));
  }

  private toBase64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}