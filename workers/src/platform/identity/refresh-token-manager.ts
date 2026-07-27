// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Refresh Token Manager            │
// │ Secure refresh token lifecycle with rotation and hashing.   │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import type { RefreshTokenRecord } from "./types.js";

/**
 * Refresh Token Manager — handles creation, validation, rotation.
 * Tokens are hashed in storage (never plaintext).
 * Rotation invalidates old tokens (replay attack protection).
 */
export class RefreshTokenManager {
  private readonly repo: IdentityRepository;
  private readonly tokenExpiryMs: number;
  private readonly tokenByteLength: number;

  constructor(
    repo: IdentityRepository,
    opts: {
      tokenExpiryMs?: number;
      tokenByteLength?: number;
    } = {},
  ) {
    this.repo = repo;
    this.tokenExpiryMs = opts.tokenExpiryMs ?? 30 * 24 * 60 * 60 * 1000; // 30 days
    this.tokenByteLength = opts.tokenByteLength ?? 64; // 64 bytes = 512-bit token
  }

  /**
   * Create a new refresh token for an identity.
   * Returns the plaintext token (shown once) and stores the hash.
   */
  async create(
    identityId: string,
    sessionId: string,
  ): Promise<{ token: string; record: RefreshTokenRecord }> {
    const tokenBytes = crypto.getRandomValues(new Uint8Array(this.tokenByteLength));
    const plaintext = this.toBase64url(tokenBytes);
    const hash = await this.hashToken(plaintext);

    const record: RefreshTokenRecord = {
      id: crypto.randomUUID(),
      identity_id: identityId,
      session_id: sessionId,
      token_hash: hash,
      expires_at: new Date(Date.now() + this.tokenExpiryMs).toISOString(),
      created_at: new Date().toISOString(),
    };

    await this.repo.storeRefreshToken(record);
    return { token: plaintext, record };
  }

  /**
   * Validate a refresh token. Returns the token record if valid.
   * Throws if expired, revoked, or not found.
   */
  async validate(plaintext: string): Promise<RefreshTokenRecord> {
    const hash = await this.hashToken(plaintext);
    const record = await this.repo.findRefreshToken(hash);

    if (!record) {
      throw new Error("Invalid refresh token");
    }

    if (record.revoked_at) {
      throw new Error("Refresh token has been revoked");
    }

    const now = Date.now();
    if (now >= new Date(record.expires_at).getTime()) {
      throw new Error("Refresh token has expired");
    }

    return record;
  }

  /**
   * Rotate a refresh token: revoke the old one and create a new one.
   * Implements refresh token rotation (RFC 6749 best practice).
   */
  async rotate(
    oldTokenId: string,
    identityId: string,
    sessionId: string,
  ): Promise<{ token: string; record: RefreshTokenRecord }> {
    // Revoke old token
    await this.repo.revokeRefreshToken(oldTokenId);

    // Create new token with replaced_by reference
    const { token, record } = await this.create(identityId, sessionId);
    return { token, record };
  }

  /**
   * Revoke a specific refresh token.
   */
  async revoke(tokenId: string): Promise<void> {
    await this.repo.revokeRefreshToken(tokenId);
  }

  /**
   * Revoke all refresh tokens for an identity.
   * Used on password change, account suspension, etc.
   */
  async revokeAllForIdentity(identityId: string): Promise<void> {
    await this.repo.revokeIdentityRefreshTokens(identityId);
  }

  /**
   * Hash a token for storage using SHA-256.
   * Never stores plaintext tokens.
   */
  private async hashToken(token: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(token);
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = new Uint8Array(hashBuffer);
    return this.toBase64url(hashArray);
  }

  private toBase64url(bytes: Uint8Array): string {
    return btoa(String.fromCharCode(...bytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }
}