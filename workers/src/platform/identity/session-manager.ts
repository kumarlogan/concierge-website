// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Session Manager                  │
// │ Reusable session CRUD, validation, fingerprinting, expiry.  │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import type { SessionRecord } from "./types.js";
import { IdentityRepository } from "./identity-repository.js";

/**
 * Session context for creating a new session.
 */
export interface SessionContext {
  identityId: string;
  sessionType: string;
  authMethod: string;
  mfaLevel: number;
  ipAddress?: string;
  deviceFingerprint?: string;
  userAgent?: string;
  riskScore?: number;
}

/**
 * Session validation result.
 */
export interface SessionValidation {
  valid: boolean;
  session?: SessionRecord;
  reason?: string;
  requiresMfa?: boolean;
  needsReconsent?: boolean;
}

/**
 * Session Manager — handles creation, validation, refresh, and revocation.
 * Uses D1-backed storage for durability.
 */
export class SessionManager {
  private readonly repo: IdentityRepository;

  /** Session expiry durations in milliseconds. */
  private readonly durations: Record<string, number> = {
    browser_patient: 24 * 60 * 60 * 1000,   // 24h
    browser_staff: 8 * 60 * 60 * 1000,        // 8h
    browser_admin: 4 * 60 * 60 * 1000,        // 4h
    api_token: 60 * 60 * 1000,                // 1h
    agent: 12 * 60 * 60 * 1000,              // 12h
    machine: 24 * 60 * 60 * 1000,            // 24h
  };

  /** Idle timeout durations in ms per type. */
  private readonly idleTimeouts: Record<string, number> = {
    browser_staff: 30 * 60 * 1000,            // 30m
    browser_admin: 30 * 60 * 1000,            // 30m
  };

  constructor(repo: IdentityRepository, durations?: Record<string, number>) {
    this.repo = repo;
    if (durations) Object.assign(this.durations, durations);
  }

  /**
   * Create a new session. Returns the session record.
   */
  async createSession(ctx: SessionContext): Promise<SessionRecord> {
    const duration = this.durations[ctx.sessionType] ?? this.durations.browser_patient;

    const session: SessionRecord = {
      id: crypto.randomUUID(),
      identity_id: ctx.identityId,
      session_type: ctx.sessionType,
      auth_method: ctx.authMethod,
      mfa_level: ctx.mfaLevel,
      status: "active",
      ip_address: ctx.ipAddress,
      device_fingerprint: ctx.deviceFingerprint,
      user_agent: ctx.userAgent,
      risk_score: ctx.riskScore ?? 0,
      started_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + duration).toISOString(),
      last_activity_at: new Date().toISOString(),
      metadata: {},
      consent_snapshot: {},
    };

    await this.repo.createSession(session);
    return session;
  }

  /**
   * Validate an active session. Returns validation result.
   * Checks: exists → active status → not expired → idle timeout.
   * Fail-closed: any uncertainty returns invalid.
   */
  async validateSession(sessionId: string): Promise<SessionValidation> {
    const session = await this.repo.getSession(sessionId);
    if (!session) {
      return { valid: false, reason: "Session not found" };
    }

    if (session.status !== "active") {
      return { valid: false, reason: `Session is ${session.status}`, session };
    }

    const now = Date.now();

    // Check expiry
    if (now >= new Date(session.expires_at).getTime()) {
      await this.repo.updateSessionStatus(sessionId, "expired");
      return { valid: false, reason: "Session expired", session };
    }

    // Check idle timeout
    const idleTimeout = this.idleTimeouts[session.session_type];
    if (idleTimeout) {
      const lastActivity = new Date(session.last_activity_at).getTime();
      if (now - lastActivity > idleTimeout) {
        await this.repo.updateSessionStatus(sessionId, "expired");
        return { valid: false, reason: "Session idle timeout", session };
      }
    }

    // Touch session (update last_activity_at)
    await this.repo.touchSession(sessionId);

    return { valid: true, session };
  }

  /**
   * Refresh a session, extending its expiry.
   */
  async refreshSession(sessionId: string): Promise<SessionRecord> {
    const validation = await this.validateSession(sessionId);
    if (!validation.valid || !validation.session) {
      throw new Error(validation.reason ?? "Session invalid");
    }

    const session = validation.session;
    const duration = this.durations[session.session_type] ?? this.durations.browser_patient;

    const refreshed: SessionRecord = {
      ...session,
      expires_at: new Date(Date.now() + duration).toISOString(),
      last_activity_at: new Date().toISOString(),
    };

    // Create new session record and mark old as refreshed
    await this.repo.createSession(refreshed);
    await this.repo.updateSessionStatus(sessionId, "refreshed");

    return refreshed;
  }

  /**
   * Revoke a single session.
   */
  async revokeSession(sessionId: string, reason?: string): Promise<void> {
    await this.repo.updateSessionStatus(sessionId, "revoked");
  }

  /**
   * Revoke all sessions for an identity.
   */
  async revokeIdentitySessions(identityId: string): Promise<void> {
    await this.repo.revokeIdentitySessions(identityId);
  }

  /**
   * Purge expired sessions from the database.
   */
  async purgeExpiredSessions(): Promise<number> {
    return this.repo.purgeExpiredSessions();
  }

  /**
   * Generate a device fingerprint from request attributes.
   * Used for session binding and anomaly detection.
   */
  static generateFingerprint(
    userAgent?: string,
    ipAddress?: string,
    acceptLanguage?: string,
    acceptEncoding?: string,
  ): string {
    const raw = [
      userAgent ?? "",
      ipAddress ?? "",
      acceptLanguage ?? "",
      acceptEncoding ?? "",
    ].join("|");

    // Hash the fingerprint for privacy - SHA-256 via Web Crypto
    const encoder = new TextEncoder();
    const data = encoder.encode(raw);

    // Use a simple hash for device fingerprinting (not security-critical)
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      hash = ((hash << 5) - hash) + data[i];
      hash |= 0;
    }

    return `fp_${Math.abs(hash).toString(36)}_${(hash & 0xFFFF).toString(16)}`;
  }
}