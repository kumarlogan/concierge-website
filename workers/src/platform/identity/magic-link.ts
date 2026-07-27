// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Magic Link Authentication        │
// │ Passwordless email authentication with hashed tokens.       │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import { SessionManager } from "./session-manager.js";
import { JwtManager } from "./jwt-manager.js";
import { RefreshTokenManager } from "./refresh-token-manager.js";
import type { PlatformIdentity, MagicLinkRequest } from "./types.js";
import { NotFoundError, IdentityError } from "./types.js";

export class MagicLinkManager {
  private readonly repo: IdentityRepository;
  private readonly sessions: SessionManager;
  private readonly jwt: JwtManager;
  private readonly refreshTokens: RefreshTokenManager;
  private readonly expiryMs: number;
  private readonly tokenByteLength: number;

  constructor(
    repo: IdentityRepository,
    sessions: SessionManager,
    jwt: JwtManager,
    refreshTokens: RefreshTokenManager,
    opts: { expiryMs?: number; tokenByteLength?: number } = {},
  ) {
    this.repo = repo;
    this.sessions = sessions;
    this.jwt = jwt;
    this.refreshTokens = refreshTokens;
    this.expiryMs = opts.expiryMs ?? 15 * 60 * 1000; // 15 minutes
    this.tokenByteLength = opts.tokenByteLength ?? 48;
  }

  /**
   * Request a magic link for the given email.
   * If email exists, generates a one-time token (hashed for storage).
   * If email doesn't exist, silently returns (don't reveal existence).
   * Returns a token that would be emailed to the user in production.
   */
  async requestMagicLink(email: string): Promise<string> {
    const identity = await this.repo.findIdentityByEmail(email);
    if (!identity) return "sent"; // Don't reveal missing email

    const tokenBytes = crypto.getRandomValues(new Uint8Array(this.tokenByteLength));
    const plaintext = this.toBase64url(tokenBytes);
    const hash = await this.hashToken(plaintext);

    // Store in refresh_tokens table (or a dedicated magic_links table)
    // For now, we use the same hashed-token pattern
    await this.repo.storeRefreshToken({
      id: crypto.randomUUID(),
      identity_id: identity.id,
      session_id: "", // Not yet linked to a session
      token_hash: hash,
      expires_at: new Date(Date.now() + this.expiryMs).toISOString(),
      created_at: new Date().toISOString(),
    });

    return plaintext;
  }

  /**
   * Verify a magic link token and create a session.
   * If valid, creates session + JWT + refresh token.
   */
  async verifyMagicLink(
    plaintext: string,
    ipAddress?: string,
    userAgent?: string,
    deviceFingerprint?: string,
  ): Promise<{
    identity: PlatformIdentity;
    accessToken: string;
    refreshToken: string;
  }> {
    const hash = await this.hashToken(plaintext);
    const record = await this.repo.findRefreshToken(hash);

    if (!record) {
      throw new NotFoundError("Invalid magic link token");
    }

    const now = Date.now();
    if (now >= new Date(record.expires_at).getTime()) {
      throw new IdentityError("Magic link has expired", "TOKEN_EXPIRED", 410);
    }

    if (record.session_id !== "") {
      throw new IdentityError("Magic link already used", "TOKEN_USED", 400);
    }

    const identity = await this.repo.getIdentity(record.identity_id);
    if (!identity) {
      throw new NotFoundError("Identity not found");
    }

    // Mark token as used by setting revoked_at
    await this.repo.revokeRefreshToken(record.id);

    // Update last login
    await this.repo.updateIdentity(identity.id, {
      last_login_at: new Date().toISOString(),
    });

    // Create session
    const session = await this.sessions.createSession({
      identityId: identity.id,
      sessionType: "browser_patient",
      authMethod: "magic_link",
      mfaLevel: 1,
      ipAddress,
      deviceFingerprint,
      userAgent,
    });

    // Generate JWT
    const accessToken = await this.jwt.sign({
      sub: identity.id,
      identity_type: identity.identity_type,
      session_id: session.id,
      email: identity.email,
      mfa_level: 1,
      trust_score: identity.trust_score,
    });

    // Generate refresh token
    const refreshTokenResult = await this.refreshTokens.create(
      identity.id,
      session.id,
    );

    return {
      identity: {
        id: identity.id,
        identityType: identity.identity_type as any,
        status: identity.status as any,
        primaryEmail: identity.email ?? null,
        displayName: identity.display_name ?? null,
        verifiedAt: identity.email_verified ? identity.updated_at : null,
        createdAt: identity.created_at,
        updatedAt: identity.updated_at,
        metadata: identity.metadata ?? {},
      },
      accessToken,
      refreshToken: refreshTokenResult.token,
    };
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