// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core OAuth Provider Framework         │
// │ Reusable OAuth 2.0 / OpenID Connect integration framework.  │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import { SessionManager } from "./session-manager.js";
import { JwtManager } from "./jwt-manager.js";
import { RefreshTokenManager } from "./refresh-token-manager.js";
import { IdentityProviderRegistry } from "./identity-provider-registry.js";
import type {
  PlatformIdentity,
  LoginResponse,
  ProviderType,
  TokenResult,
  ProviderUserInfo,
  AuthRequest,
  AuthResult,
  OAuthLoginRequest,
} from "./types.js";
import {
  IdentityStatus,
  AuthMethod,
  AuthenticationError,
} from "./types.js";

/**
 * OAuth Service — handles OAuth-based authentication flows.
 * Delegates to provider implementations in the registry.
 */
export class OAuthService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly sessions: SessionManager,
    private readonly jwt: JwtManager,
    private readonly refreshTokens: RefreshTokenManager,
    private readonly providers: IdentityProviderRegistry,
  ) {}

  /**
   * Initiate an OAuth login. Returns the provider's authorization URL.
   */
  async initiateOAuth(
    providerType: ProviderType,
    redirectUri: string,
  ): Promise<{ authorizeUrl: string; state: string }> {
    const provider = this.providers.getProvider(providerType);
    if (!provider) {
      throw new AuthenticationError(`OAuth provider "${providerType}" not available`);
    }

    const state = crypto.randomUUID();
    const result = await provider.initiate({ redirectUri, state });
    return { authorizeUrl: result.redirectUrl!, state };
  }

  /**
   * Handle OAuth callback. Exchanges code for tokens, creates/links identity.
   */
  async handleCallback(
    req: OAuthLoginRequest,
  ): Promise<LoginResponse> {
    const provider = this.providers.getProvider(req.providerType);
    if (!provider) {
      throw new AuthenticationError(
        `OAuth provider "${req.providerType}" not available`,
      );
    }

    // Exchange code for tokens via adapter
    const providerConfig = await this.providers.getProviderConfig(req.providerType);
    if (!providerConfig) {
      throw new AuthenticationError(
        `OAuth provider "${req.providerType}" not configured`,
      );
    }

    const callbackResult = await provider.handleCallback({
      code: req.code,
      state: req.state,
      redirectUri: req.redirectUri,
    } as any);

    if (!callbackResult.authenticated || !callbackResult.subjectId) {
      throw new AuthenticationError(
        callbackResult.error ?? "OAuth authentication failed",
      );
    }

    // Check if this OAuth account is already linked to an identity
    const existingLink = await this.repo.findOAuthAccount(
      providerConfig.id,
      callbackResult.subjectId,
    );

    let identityRecord: import("./types.js").IdentityRecord;

    if (existingLink) {
      // Existing OAuth link — get identity
      const existing = await this.repo.getIdentity(existingLink.identity_id);
      if (!existing) {
        throw new AuthenticationError("Linked identity not found");
      }
      identityRecord = existing;
    } else {
      // New OAuth account — check if email is already registered
      const email = callbackResult.email;
      let identityId: string;

      if (email) {
        const existingByIdentity = await this.repo.findIdentityByEmail(email);
        if (existingByIdentity) {
          identityId = existingByIdentity.id;
          identityRecord = existingByIdentity;
        } else {
          // Create new identity
          identityRecord = await this.createIdentityFromOAuth(callbackResult, req.providerType);
          identityId = identityRecord.id;
        }
      } else {
        // No email — create with minimal info
        identityRecord = await this.createIdentityFromOAuth(callbackResult, req.providerType);
        identityId = identityRecord.id;
      }

      // Link OAuth account to identity
      await this.repo.storeOAuthAccount({
        id: crypto.randomUUID(),
        identity_id: identityId,
        provider_id: providerConfig.id,
        subject_id: callbackResult.subjectId,
        email: callbackResult.email,
        display_name: callbackResult.displayName,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }

    // Update last login
    await this.repo.updateIdentity(identityRecord.id, {
      last_login_at: new Date().toISOString(),
    });

    // Create session
    const session = await this.sessions.createSession({
      identityId: identityRecord.id,
      sessionType: this.getSessionType(identityRecord.identity_type),
      authMethod: req.providerType as string,
      mfaLevel: identityRecord.mfa_enabled ? 2 : 1,
      ipAddress: req.ipAddress,
      deviceFingerprint: req.deviceFingerprint,
      userAgent: req.userAgent,
    });

    // Generate tokens
    const accessToken = await this.jwt.sign({
      sub: identityRecord.id,
      identity_type: identityRecord.identity_type,
      session_id: session.id,
      email: identityRecord.email,
      mfa_level: identityRecord.mfa_enabled ? 2 : 1,
      trust_score: identityRecord.trust_score,
    });

    const refreshTokenResult = await this.refreshTokens.create(
      identityRecord.id,
      session.id,
    );

    // Audit
    await this.repo.recordAudit({
      id: crypto.randomUUID(),
      identity_id: identityRecord.id,
      session_id: session.id,
      action: "identity.oauth_login",
      resource_type: "session",
      resource_id: session.id,
      outcome: "SUCCESS",
      ip_address: req.ipAddress,
      metadata: { providerType: req.providerType },
      created_at: new Date().toISOString(),
    });

    return {
      identity: {
        id: identityRecord.id,
        identityType: identityRecord.identity_type as any,
        status: identityRecord.status as any,
        primaryEmail: identityRecord.email ?? null,
        displayName: identityRecord.display_name ?? null,
        verifiedAt: identityRecord.email_verified ? identityRecord.updated_at : null,
        createdAt: identityRecord.created_at,
        updatedAt: identityRecord.updated_at,
        metadata: identityRecord.metadata ?? {},
      },
      session: {
        id: session.id,
        identityId: session.identity_id,
        identityType: session.session_type as any,
        authMethod: req.providerType as any,
        mfaLevel: session.mfa_level as any,
        state: session.status as any,
        startedAt: session.started_at,
        expiresAt: session.expires_at,
        lastActivityAt: session.last_activity_at,
        deviceFingerprint: session.device_fingerprint ?? null,
        ipAddress: session.ip_address ?? null,
        userAgent: session.user_agent ?? null,
        riskScore: session.risk_score ?? 0,
        metadata: session.metadata ?? {},
      },
      accessToken,
      refreshToken: refreshTokenResult.token,
      mfaRequired: false,
    };
  }

  private async createIdentityFromOAuth(
    userInfo: { email?: string; displayName?: string },
    providerType: string,
  ): Promise<import("./types.js").IdentityRecord> {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const record: import("./types.js").IdentityRecord = {
      id,
      identity_type: "patient",
      status: IdentityStatus.ACTIVE,
      email: userInfo.email,
      email_verified: true, // OAuth providers verify email
      phone: undefined,
      phone_verified: false,
      display_name: userInfo.displayName,
      mfa_enabled: false,
      trust_score: 0.7, // OAuth providers have moderate trust
      created_at: now,
      updated_at: now,
      metadata: { oauth_provider: providerType },
    };

    await this.repo.createIdentity(record);
    return record;
  }

  private getSessionType(identityType: string): string {
    switch (identityType) {
      case "patient": return "browser_patient";
      case "staff": return "browser_staff";
      case "administrator": return "browser_admin";
      case "ai_worker": return "agent";
      default: return "browser_patient";
    }
  }
}