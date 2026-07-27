// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Email Verification               │
// │ Reusable email verification with expiration and hashing.    │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import type { EmailVerificationRecord } from "./types.js";
import { NotFoundError, ConflictError } from "./types.js";

export class EmailVerificationManager {
  private readonly repo: IdentityRepository;
  private readonly expiryMs: number;
  private readonly tokenByteLength: number;

  constructor(
    repo: IdentityRepository,
    opts: { expiryMs?: number; tokenByteLength?: number } = {},
  ) {
    this.repo = repo;
    this.expiryMs = opts.expiryMs ?? 24 * 60 * 60 * 1000; // 24 hours
    this.tokenByteLength = opts.tokenByteLength ?? 48; // 48 bytes = 384-bit token
  }

  /**
   * Create an email verification token.
   * Returns the plaintext token (shown once) and stores the hash.
   */
  async createVerification(
    identityId: string,
    email: string,
  ): Promise<string> {
    const tokenBytes = crypto.getRandomValues(new Uint8Array(this.tokenByteLength));
    const plaintext = this.toBase64url(tokenBytes);
    const hash = await this.hashToken(plaintext);

    const record: EmailVerificationRecord = {
      id: crypto.randomUUID(),
      identity_id: identityId,
      email,
      token_hash: hash,
      expires_at: new Date(Date.now() + this.expiryMs).toISOString(),
      created_at: new Date().toISOString(),
    };

    await this.repo.storeEmailVerification(record);
    return plaintext;
  }

  /**
   * Complete email verification with the token.
   * Validates: exists → not expired → not already verified → confirms email.
   */
  async completeVerification(plaintext: string): Promise<{
    identityId: string;
    email: string;
  }> {
    const hash = await this.hashToken(plaintext);
    const record = await this.repo.findEmailVerification(hash);

    if (!record) {
      throw new NotFoundError("Invalid verification token");
    }

    if (record.verified_at) {
      throw new ConflictError("Email already verified");
    }

    const now = Date.now();
    if (now >= new Date(record.expires_at).getTime()) {
      throw new NotFoundError("Verification token has expired");
    }

    // Mark as verified
    await this.repo.verifyEmail(record.id);

    // Update identity record
    await this.repo.updateIdentity(record.identity_id, {
      email_verified: true,
    });

    return { identityId: record.identity_id, email: record.email };
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