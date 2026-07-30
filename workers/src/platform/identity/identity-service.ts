// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Service                          │
// │ Central orchestration for all identity operations.           │
// │ Reusable — no Concierge-specific logic.                      │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import { IdentityRepository } from "./identity-repository.js";
import { SessionManager } from "./session-manager.js";
import { PasswordManager } from "./password-manager.js";
import { JwtManager } from "./jwt-manager.js";
import { IdentityProviderRegistry } from "./identity-provider-registry.js";
import { RefreshTokenManager } from "./refresh-token-manager.js";
import type {
  PlatformIdentity,
  Session,
  LoginResponse,
  RefreshTokenResponse,
  RegisterIdentityRequest,
  LoginRequest,
  IdentityRecord,
  SessionRecord,
  IdentityEventRecord,
  IdentityAuditRecord,
} from "./types.js";
import {
  IdentityStatus,
  AuthMethod,
  IdentityType,
  SessionState,
  MFATier,
  AuthenticationError,
  IdentityError,
  NotFoundError,
  ConflictError,
  RateLimitError,
} from "./types.js";

/**
 * Identity Service — central identity orchestration.
 * All identity operations flow through here.
 */
export class IdentityService {
  constructor(
    private readonly repo: IdentityRepository,
    private readonly sessions: SessionManager,
    private readonly passwords: PasswordManager,
    private readonly jwt: JwtManager,
    private readonly providers: IdentityProviderRegistry,
    private readonly refreshTokens: RefreshTokenManager,
  ) {}

  // ── Registration ──────────────────────────────────────────

  async register(
    req: RegisterIdentityRequest,
    metadata?: Record<string, unknown>,
  ): Promise<PlatformIdentity> {
    // Check for existing email
    if (req.email) {
      const existing = await this.repo.findIdentityByEmail(req.email);
      if (existing) {
        throw new ConflictError("Email already registered", {
          field: "email",
        });
      }
    }

    const now = new Date().toISOString();
    const identityId = crypto.randomUUID();

    // Hash password if provided
    let passwordHash: string | undefined;
    if (req.password) {
      const validation = this.passwords.validate(req.password);
      if (!validation.valid) {
        throw new IdentityError(
          `Password validation failed: ${validation.errors.join("; ")}`,
          "INVALID_PASSWORD",
          400,
          { errors: validation.errors },
        );
      }
      passwordHash = await this.passwords.hash(req.password);
    }

    const record: IdentityRecord = {
      id: identityId,
      identity_type: req.identityType,
      status: IdentityStatus.REGISTERED,
      email: req.email,
      email_verified: false,
      phone: undefined,
      phone_verified: false,
      display_name: req.profile?.displayName,
      password_hash: passwordHash,
      mfa_enabled: false,
      trust_score: 0.5,
      created_at: now,
      updated_at: now,
      metadata: {
        ...req.metadata,
        profile: req.profile ?? {},
      },
    };

    await this.repo.createIdentity(record);

    await this.recordAudit({
      identity_id: identityId,
      action: "identity.register",
      resource_type: "identity",
      resource_id: identityId,
      outcome: "SUCCESS",
      metadata,
    });

    // Publish event
    await this.publishEvent({
      identity_id: identityId,
      event_type: "identity.created",
      severity: "INFO",
      details: { identityType: req.identityType },
      created_at: now,
    });

    return this.recordToIdentity(record);
  }

  // ── Email/Password Login ──────────────────────────────────

  async loginWithPassword(
    req: LoginRequest,
  ): Promise<LoginResponse> {
    const identity = await this.repo.findIdentityByEmail(req.email);
    if (!identity) {
      throw new AuthenticationError("Invalid email or password");
    }

    if (identity.status !== IdentityStatus.ACTIVE && identity.status !== IdentityStatus.VERIFIED) {
      throw new AuthenticationError(
        `Identity is ${identity.status}. Cannot authenticate.`,
        { status: identity.status },
      );
    }

    if (!identity.password_hash) {
      throw new AuthenticationError(
        "Password login not configured for this identity",
      );
    }

    const valid = await this.passwords.verify(req.password, identity.password_hash);
    if (!valid) {
      await this.recordEvent({
        identity_id: identity.id,
        event_type: "login.failed",
        severity: "WARN",
        details: { reason: "invalid_password", email: req.email },
        ip_address: req.ipAddress,
        created_at: new Date().toISOString(),
      });
      throw new AuthenticationError("Invalid email or password");
    }

    // Update last login
    await this.repo.updateIdentity(identity.id, {
      last_login_at: new Date().toISOString(),
    });

    // Check if email is verified
    const emailVerified = identity.email_verified ?? false;

    // Create session
    const session = await this.sessions.createSession({
      identityId: identity.id,
      sessionType: this.getSessionType(identity.identity_type),
      authMethod: AuthMethod.EMAIL_PASSWORD,
      mfaLevel: identity.mfa_enabled ? MFATier.TWO_FACTOR : MFATier.SINGLE_FACTOR,
      ipAddress: req.ipAddress,
      deviceFingerprint: req.deviceFingerprint,
      userAgent: req.userAgent,
    });

    // Generate tokens
    const accessToken = await this.jwt.sign({
      sub: identity.id,
      identity_type: identity.identity_type,
      session_id: session.id,
      email: identity.email,
      mfa_level: identity.mfa_enabled ? MFATier.TWO_FACTOR : MFATier.SINGLE_FACTOR,
      trust_score: identity.trust_score,
    });

    const refreshToken = await this.refreshTokens.create(
      identity.id,
      session.id,
    );

    // Audit
    await this.recordAudit({
      identity_id: identity.id,
      session_id: session.id,
      action: "identity.login",
      resource_type: "session",
      resource_id: session.id,
      outcome: "SUCCESS",
      ip_address: req.ipAddress,
    });

    // Event
    await this.publishEvent({
      identity_id: identity.id,
      event_type: "identity.login",
      severity: "INFO",
      details: { authMethod: AuthMethod.EMAIL_PASSWORD },
      ip_address: req.ipAddress,
    });

    return {
      identity: this.recordToIdentity(identity),
      session: this.sessionRecordToSession(session),
      accessToken,
      refreshToken: refreshToken.token,
      mfaRequired: identity.mfa_enabled,
      mfaMethods: identity.mfa_enabled ? [] : undefined,
    };
  }

  // ── Token Refresh ─────────────────────────────────────────

  async refreshAccessToken(
    refreshTokenStr: string,
  ): Promise<RefreshTokenResponse> {
    const tokenRecord = await this.refreshTokens.validate(refreshTokenStr);

    // Validate session still active
    const sessionValidation = await this.sessions.validateSession(
      tokenRecord.session_id,
    );
    if (!sessionValidation.valid || !sessionValidation.session) {
      await this.refreshTokens.revoke(tokenRecord.id);
      throw new AuthenticationError("Session invalid or expired");
    }

    const identity = await this.repo.getIdentity(tokenRecord.identity_id);
    if (!identity) {
      throw new NotFoundError("Identity not found");
    }

    // Rotate the refresh token
    const newRefreshToken = await this.refreshTokens.rotate(
      tokenRecord.id,
      tokenRecord.identity_id,
      tokenRecord.session_id,
    );

    const newAccessToken = await this.jwt.sign({
      sub: identity.id,
      identity_type: identity.identity_type,
      session_id: tokenRecord.session_id,
      email: identity.email,
      mfa_level: identity.mfa_enabled ? MFATier.TWO_FACTOR : MFATier.SINGLE_FACTOR,
      trust_score: identity.trust_score,
    });

    // Touch the session
    await this.sessions.refreshSession(tokenRecord.session_id);

    // Get session for response
    const session = sessionValidation.session;

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken.token,
      session: this.sessionRecordToSession(session),
    };
  }

  // ── Logout ────────────────────────────────────────────────

  async logout(sessionId: string, identityId: string): Promise<void> {
    await this.sessions.revokeSession(sessionId);
    await this.refreshTokens.revokeAllForIdentity(identityId);

    await this.recordAudit({
      identity_id: identityId,
      session_id: sessionId,
      action: "identity.logout",
      resource_type: "session",
      resource_id: sessionId,
      outcome: "SUCCESS",
    });
  }

  // ── Get Identity ──────────────────────────────────────────

  async getIdentity(identityId: string): Promise<PlatformIdentity> {
    const record = await this.repo.getIdentity(identityId);
    if (!record) throw new NotFoundError("Identity not found");
    return this.recordToIdentity(record);
  }

  async listIdentities(
    type?: string,
    status?: string,
  ): Promise<PlatformIdentity[]> {
    const records = await this.repo.findIdentities(type, status);
    return records.map((r) => this.recordToIdentity(r));
  }

  // ── Status Changes ────────────────────────────────────────

  async activateIdentity(identityId: string): Promise<void> {
    await this.repo.updateIdentityStatus(identityId, IdentityStatus.ACTIVE, "admin_activation");
    await this.recordAudit({
      identity_id: identityId,
      action: "identity.activate",
      resource_type: "identity",
      resource_id: identityId,
      outcome: "SUCCESS",
    });
  }

  // ── Password Change (authenticated) ──────────────────────

  /**
   * Change password for an authenticated identity.
   * Verifies current password, validates new password policy,
   * hashes new password, and invalidates all existing sessions.
   *
   * Throws IdentityError on validation failure, AuthenticationError
   * on wrong current password, NotFoundError if identity not found.
   */
  async changePassword(
    identityId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    // Get the full record (needs password_hash)
    const record = await this.repo.getIdentity(identityId);
    if (!record) {
      throw new NotFoundError("Identity not found");
    }

    if (!record.password_hash) {
      throw new IdentityError(
        "Password login not configured for this identity",
        "NO_PASSWORD",
        400,
      );
    }

    // Verify current password
    const valid = await this.passwords.verify(currentPassword, record.password_hash);
    if (!valid) {
      throw new AuthenticationError("Invalid credentials");
    }

    // Validate new password policy
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
    await this.repo.updateIdentity(identityId, {
      password_hash: newHash,
    });

    // Force re-login: invalidate all sessions + refresh tokens
    await this.sessions.revokeIdentitySessions(identityId);
    await this.refreshTokens.revokeAllForIdentity(identityId);

    // Record audit event
    await this.recordAudit({
      identity_id: identityId,
      action: "identity.password.change",
      resource_type: "identity",
      resource_id: identityId,
      outcome: "SUCCESS",
    });

    // Publish event
    await this.publishEvent({
      identity_id: identityId,
      event_type: "identity.password.change",
      severity: "INFO",
      details: {},
      created_at: new Date().toISOString(),
    });
  }

  async suspendIdentity(identityId: string, reason?: string): Promise<void> {
    await this.repo.updateIdentityStatus(
      identityId,
      IdentityStatus.SUSPENDED,
      reason ?? "admin_suspension",
    );
    await this.sessions.revokeIdentitySessions(identityId);
    await this.refreshTokens.revokeAllForIdentity(identityId);
    await this.recordAudit({
      identity_id: identityId,
      action: "identity.suspend",
      resource_type: "identity",
      resource_id: identityId,
      outcome: "SUCCESS",
      reason,
    });
  }

  // ── Internal ──────────────────────────────────────────────

  private getSessionType(identityType: string): string {
    switch (identityType) {
      case IdentityType.PATIENT:
        return "browser_patient";
      case IdentityType.STAFF:
        return "browser_staff";
      case IdentityType.ADMINISTRATOR:
        return "browser_admin";
      case IdentityType.AI_WORKER:
        return "agent";
      case IdentityType.PLATFORM_SERVICE:
        return "machine";
      default:
        return "browser_patient";
    }
  }

  private async recordAudit(opts: {
    identity_id: string;
    action: string;
    resource_type: string;
    resource_id?: string;
    outcome: string;
    reason?: string;
    ip_address?: string;
    session_id?: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    const audit: IdentityAuditRecord = {
      id: crypto.randomUUID(),
      identity_id: opts.identity_id,
      action: opts.action,
      resource_type: opts.resource_type,
      resource_id: opts.resource_id,
      outcome: opts.outcome,
      reason: opts.reason,
      ip_address: opts.ip_address,
      session_id: opts.session_id,
      metadata: opts.metadata ?? {},
      created_at: new Date().toISOString(),
    };
    await this.repo.recordAudit(audit);
  }

  private async recordEvent(opts: {
    identity_id: string;
    event_type: string;
    severity: string;
    details: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created_at?: string;
  }): Promise<void> {
    const event: IdentityEventRecord = {
      id: crypto.randomUUID(),
      identity_id: opts.identity_id,
      event_type: opts.event_type,
      severity: opts.severity,
      details: opts.details ?? {},
      ip_address: opts.ip_address,
      user_agent: opts.user_agent,
      created_at: opts.created_at ?? new Date().toISOString(),
    };
    await this.repo.recordEvent(event);
  }

  private async publishEvent(opts: {
    identity_id: string;
    event_type: string;
    severity: string;
    details: Record<string, unknown>;
    ip_address?: string;
    user_agent?: string;
    created_at: string;
  }): Promise<void> {
    // Record to DB + in future will publish to event bus
    await this.recordEvent({
      ...opts,
      created_at: new Date().toISOString(),
    });
  }

  private recordToIdentity(record: IdentityRecord): PlatformIdentity {
    return {
      id: record.id,
      identityType: record.identity_type as IdentityType,
      status: record.status as IdentityStatus,
      primaryEmail: record.email ?? null,
      displayName: record.display_name ?? null,
      verifiedAt: record.email_verified ? record.updated_at : null,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      metadata: record.metadata ?? {},
    };
  }

  private sessionRecordToSession(record: SessionRecord): Session {
    return {
      id: record.id,
      identityId: record.identity_id,
      identityType: record.session_type as unknown as IdentityType,
      authMethod: record.auth_method as AuthMethod,
      mfaLevel: record.mfa_level as MFATier,
      state: record.status as SessionState,
      startedAt: record.started_at,
      expiresAt: record.expires_at,
      lastActivityAt: record.last_activity_at,
      deviceFingerprint: record.device_fingerprint ?? null,
      ipAddress: record.ip_address ?? null,
      userAgent: record.user_agent ?? null,
      riskScore: record.risk_score ?? 0,
      metadata: record.metadata ?? {},
    };
  }
}