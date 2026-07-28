// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Repository                       │
// │ Reusable D1-backed data persistence for identity records.    │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

import type { D1Database, D1Result } from "@cloudflare/workers-types";
import type {
  IdentityRecord,
  IdentityProviderRecord,
  SessionRecord,
  IdentityCredentialRecord,
  RefreshTokenRecord,
  EmailVerificationRecord,
  PasswordResetRecord,
  OAuthAccountRecord,
  IdentityEventRecord,
  IdentityAuditRecord,
  TrustSnapshotRecord,
  ConsentSnapshotRecord,
} from "./types.js";

// ── Identity Repository ──────────────────────────────────────

export class IdentityRepository {
  constructor(private readonly db: D1Database) {}

  // ── Identity CRUD ────────────────────────────────────────

  async createIdentity(record: IdentityRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identities (
          id, identity_type, status, email, email_verified,
          phone, phone_verified, display_name, password_hash,
          mfa_enabled, mfa_method, trust_score,
          created_at, updated_at, last_login_at, metadata
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)`,
      )
      // D1 rejects `undefined` bindings (D1_TYPE_ERROR). Coerce optional
      // fields to null before binding. Real D1 enforces this; the local
      // in-memory stub used by unit tests does not, which is why the bug
      // only surfaced in production.
      .bind(
        record.id, record.identity_type, record.status,
        record.email, record.email_verified ? 1 : 0,
        record.phone ?? null, record.phone_verified ? 1 : 0,
        record.display_name ?? null, record.password_hash,
        record.mfa_enabled ? 1 : 0, record.mfa_method ?? null,
        record.trust_score,
        record.created_at, record.updated_at, record.last_login_at ?? null,
        JSON.stringify(record.metadata ?? {}),
      )
      .run();
  }

  async getIdentity(id: string): Promise<IdentityRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM identities WHERE id = ?1")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapIdentityRow(row);
  }

  async findIdentityByEmail(email: string): Promise<IdentityRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM identities WHERE email = ?1")
      .bind(email)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapIdentityRow(row);
  }

  async updateIdentity(
    id: string,
    updates: Partial<IdentityRecord>,
  ): Promise<void> {
    const setClauses: string[] = [];
    const bindValues: unknown[] = [];

    if (updates.email !== undefined) { setClauses.push("email = ?"); bindValues.push(updates.email); }
    if (updates.email_verified !== undefined) { setClauses.push("email_verified = ?"); bindValues.push(updates.email_verified ? 1 : 0); }
    if (updates.phone !== undefined) { setClauses.push("phone = ?"); bindValues.push(updates.phone); }
    if (updates.phone_verified !== undefined) { setClauses.push("phone_verified = ?"); bindValues.push(updates.phone_verified ? 1 : 0); }
    if (updates.display_name !== undefined) { setClauses.push("display_name = ?"); bindValues.push(updates.display_name); }
    if (updates.password_hash !== undefined) { setClauses.push("password_hash = ?"); bindValues.push(updates.password_hash); }
    if (updates.status !== undefined) { setClauses.push("status = ?"); bindValues.push(updates.status); }
    if (updates.mfa_enabled !== undefined) { setClauses.push("mfa_enabled = ?"); bindValues.push(updates.mfa_enabled ? 1 : 0); }
    if (updates.mfa_method !== undefined) { setClauses.push("mfa_method = ?"); bindValues.push(updates.mfa_method); }
    if (updates.trust_score !== undefined) { setClauses.push("trust_score = ?"); bindValues.push(updates.trust_score); }
    if (updates.last_login_at !== undefined) { setClauses.push("last_login_at = ?"); bindValues.push(updates.last_login_at); }
    if (updates.metadata !== undefined) { setClauses.push("metadata = ?"); bindValues.push(JSON.stringify(updates.metadata)); }

    if (setClauses.length === 0) return;

    setClauses.push("updated_at = ?");
    bindValues.push(new Date().toISOString());
    bindValues.push(id);

    await this.db
      .prepare(`UPDATE identities SET ${setClauses.join(", ")} WHERE id = ?`)
      .bind(...bindValues)
      .run();
  }

  async updateIdentityStatus(
    id: string,
    status: string,
    reason: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identities SET status = ?1, updated_at = ?2 WHERE id = ?3",
      )
      .bind(status, new Date().toISOString(), id)
      .run();
  }

  async findIdentities(
    type?: string,
    status?: string,
  ): Promise<IdentityRecord[]> {
    let sql = "SELECT * FROM identities WHERE 1=1";
    const bind: unknown[] = [];
    if (type) { sql += " AND identity_type = ?"; bind.push(type); }
    if (status) { sql += " AND status = ?"; bind.push(status); }
    sql += " ORDER BY created_at DESC";

    const results = await this.db
      .prepare(sql)
      .bind(...bind)
      .all<Record<string, unknown>>();
    return results.results.map((r) => this.mapIdentityRow(r));
  }

  // ── Identity Provider Records ────────────────────────────

  async registerIdentityProvider(record: IdentityProviderRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identity_providers (id, name, provider_type, client_id, client_secret, 
         issuer_url, scopes, enabled, config, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        record.id, record.name, record.provider_type,
        record.client_id, record.client_secret,
        record.issuer_url, JSON.stringify(record.scopes ?? []),
        record.enabled ? 1 : 0,
        JSON.stringify(record.config ?? {}),
        record.created_at, record.updated_at,
      )
      .run();
  }

  async getEnabledProviders(): Promise<IdentityProviderRecord[]> {
    const results = await this.db
      .prepare("SELECT * FROM identity_providers WHERE enabled = 1")
      .all<Record<string, unknown>>();
    return results.results.map((r) => this.mapProviderRow(r));
  }

  async getProvider(id: string): Promise<IdentityProviderRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM identity_providers WHERE id = ?1")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapProviderRow(row);
  }

  // ── Sessions ─────────────────────────────────────────────

  async createSession(record: SessionRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identity_sessions (
          id, identity_id, session_type, auth_method, mfa_level,
          status, ip_address, device_fingerprint, user_agent,
          risk_score, started_at, expires_at, last_activity_at,
          metadata, consent_snapshot
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)`,
      )
      .bind(
        record.id, record.identity_id, record.session_type,
        record.auth_method, record.mfa_level, record.status,
        record.ip_address, record.device_fingerprint, record.user_agent,
        record.risk_score, record.started_at, record.expires_at,
        record.last_activity_at,
        JSON.stringify(record.metadata ?? {}),
        JSON.stringify(record.consent_snapshot ?? {}),
      )
      .run();
  }

  async getSession(id: string): Promise<SessionRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM identity_sessions WHERE id = ?1")
      .bind(id)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapSessionRow(row);
  }

  async updateSessionStatus(
    id: string,
    status: string,
  ): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identity_sessions SET status = ?1, last_activity_at = ?2 WHERE id = ?3",
      )
      .bind(status, new Date().toISOString(), id)
      .run();
  }

  async touchSession(id: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identity_sessions SET last_activity_at = ?1 WHERE id = ?2",
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  async revokeIdentitySessions(identityId: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identity_sessions SET status = 'revoked', last_activity_at = ?1 WHERE identity_id = ?2 AND status = 'active'",
      )
      .bind(new Date().toISOString(), identityId)
      .run();
  }

  async purgeExpiredSessions(): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM identity_sessions WHERE expires_at < ?1")
      .bind(new Date().toISOString())
      .run();
    return result.meta.changes ?? 0;
  }

  // ── Credentials ──────────────────────────────────────────

  async storeCredential(record: IdentityCredentialRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identity_credentials (id, identity_id, credential_type, credential_hash,
         expires_at, rotated_at, revoked_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        record.id, record.identity_id, record.credential_type,
        record.credential_hash, record.expires_at,
        record.rotated_at, record.revoked_at, record.created_at,
      )
      .run();
  }

  async getActiveCredentials(
    identityId: string,
  ): Promise<IdentityCredentialRecord[]> {
    const results = await this.db
      .prepare(
        `SELECT * FROM identity_credentials 
         WHERE identity_id = ?1 AND revoked_at IS NULL 
         AND (expires_at IS NULL OR expires_at > ?2)
         ORDER BY created_at DESC`,
      )
      .bind(identityId, new Date().toISOString())
      .all<Record<string, unknown>>();
    return results.results.map((r) => this.mapCredentialRow(r));
  }

  async revokeCredential(id: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE identity_credentials SET revoked_at = ?1 WHERE id = ?2",
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  // ── Refresh Tokens ───────────────────────────────────────

  async storeRefreshToken(record: RefreshTokenRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO refresh_tokens (id, identity_id, session_id, token_hash,
         expires_at, revoked_at, created_at, replaced_by)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        record.id, record.identity_id, record.session_id,
        record.token_hash, record.expires_at,
        record.revoked_at, record.created_at, record.replaced_by,
      )
      .run();
  }

  async findRefreshToken(
    tokenHash: string,
  ): Promise<RefreshTokenRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM refresh_tokens WHERE token_hash = ?1")
      .bind(tokenHash)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapRefreshTokenRow(row);
  }

  async revokeRefreshToken(id: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE refresh_tokens SET revoked_at = ?1 WHERE id = ?2",
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  async revokeIdentityRefreshTokens(identityId: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE refresh_tokens SET revoked_at = ?1 WHERE identity_id = ?2 AND revoked_at IS NULL",
      )
      .bind(new Date().toISOString(), identityId)
      .run();
  }

  // ── Email Verification ───────────────────────────────────

  async storeEmailVerification(record: EmailVerificationRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO email_verifications (id, identity_id, email, token_hash,
         expires_at, verified_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)`,
      )
      .bind(
        record.id, record.identity_id, record.email,
        record.token_hash, record.expires_at,
        record.verified_at, record.created_at,
      )
      .run();
  }

  async findEmailVerification(
    tokenHash: string,
  ): Promise<EmailVerificationRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM email_verifications WHERE token_hash = ?1")
      .bind(tokenHash)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapEmailVerificationRow(row);
  }

  async verifyEmail(id: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE email_verifications SET verified_at = ?1 WHERE id = ?2",
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  // ── Password Resets ──────────────────────────────────────

  async storePasswordReset(record: PasswordResetRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO password_resets (id, identity_id, token_hash,
         expires_at, used_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
      )
      .bind(
        record.id, record.identity_id, record.token_hash,
        record.expires_at, record.used_at, record.created_at,
      )
      .run();
  }

  async findPasswordReset(
    tokenHash: string,
  ): Promise<PasswordResetRecord | null> {
    const row = await this.db
      .prepare("SELECT * FROM password_resets WHERE token_hash = ?1")
      .bind(tokenHash)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapPasswordResetRow(row);
  }

  async usePasswordReset(id: string): Promise<void> {
    await this.db
      .prepare(
        "UPDATE password_resets SET used_at = ?1 WHERE id = ?2",
      )
      .bind(new Date().toISOString(), id)
      .run();
  }

  // ── OAuth Accounts ───────────────────────────────────────

  async storeOAuthAccount(record: OAuthAccountRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO oauth_accounts (id, identity_id, provider_id, subject_id,
         email, display_name, access_token, refresh_token, token_expires_at,
         created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        record.id, record.identity_id, record.provider_id,
        record.subject_id, record.email, record.display_name,
        record.access_token, record.refresh_token,
        record.token_expires_at, record.created_at, record.updated_at,
      )
      .run();
  }

  async findOAuthAccount(
    providerId: string,
    subjectId: string,
  ): Promise<OAuthAccountRecord | null> {
    const row = await this.db
      .prepare(
        "SELECT * FROM oauth_accounts WHERE provider_id = ?1 AND subject_id = ?2",
      )
      .bind(providerId, subjectId)
      .first<Record<string, unknown>>();
    if (!row) return null;
    return this.mapOAuthRow(row);
  }

  async getIdentityOAuthAccounts(
    identityId: string,
  ): Promise<OAuthAccountRecord[]> {
    const results = await this.db
      .prepare("SELECT * FROM oauth_accounts WHERE identity_id = ?1")
      .bind(identityId)
      .all<Record<string, unknown>>();
    return results.results.map((r) => this.mapOAuthRow(r));
  }

  // ── Events & Audit ───────────────────────────────────────

  async recordEvent(record: IdentityEventRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identity_events (id, identity_id, event_type, 
         severity, details, ip_address, user_agent, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        record.id, record.identity_id, record.event_type,
        record.severity, JSON.stringify(record.details ?? {}),
        record.ip_address, record.user_agent, record.created_at,
      )
      .run();
  }

  async recordAudit(record: IdentityAuditRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO identity_audit (id, identity_id, action, resource_type,
         resource_id, outcome, reason, ip_address, session_id, metadata, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)`,
      )
      .bind(
        record.id, record.identity_id, record.action,
        record.resource_type, record.resource_id, record.outcome,
        record.reason, record.ip_address, record.session_id,
        JSON.stringify(record.metadata ?? {}), record.created_at,
      )
      .run();
  }

  // ── Trust & Consent Snapshots ────────────────────────────

  async storeTrustSnapshot(record: TrustSnapshotRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO trust_snapshots (id, identity_id, session_id, trust_score,
         trust_level, factors, expires_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        record.id, record.identity_id, record.session_id,
        record.trust_score, record.trust_level,
        JSON.stringify(record.factors ?? []),
        record.expires_at, record.created_at,
      )
      .run();
  }

  async storeConsentSnapshot(record: ConsentSnapshotRecord): Promise<void> {
    await this.db
      .prepare(
        `INSERT INTO consent_snapshots (id, identity_id, session_id, consent_type,
         granted, snapshot_data, expires_at, created_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
      )
      .bind(
        record.id, record.identity_id, record.session_id,
        record.consent_type, record.granted ? 1 : 0,
        JSON.stringify(record.snapshot_data ?? {}),
        record.expires_at, record.created_at,
      )
      .run();
  }

  // ── Row Mappers ──────────────────────────────────────────

  private mapIdentityRow(row: Record<string, unknown>): IdentityRecord {
    return {
      id: row.id as string,
      identity_type: row.identity_type as string,
      status: row.status as string,
      email: row.email as string | undefined,
      email_verified: (row.email_verified as number) === 1,
      phone: row.phone as string | undefined,
      phone_verified: (row.phone_verified as number) === 1,
      display_name: row.display_name as string | undefined,
      password_hash: row.password_hash as string | undefined,
      mfa_enabled: (row.mfa_enabled as number) === 1,
      mfa_method: row.mfa_method as string | undefined,
      trust_score: row.trust_score as number | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      last_login_at: row.last_login_at as string | undefined,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata ?? {}),
    };
  }

  private mapProviderRow(row: Record<string, unknown>): IdentityProviderRecord {
    return {
      id: row.id as string,
      name: row.name as string,
      provider_type: row.provider_type as string,
      client_id: row.client_id as string | undefined,
      client_secret: row.client_secret as string | undefined,
      issuer_url: row.issuer_url as string | undefined,
      scopes: typeof row.scopes === "string" ? JSON.parse(row.scopes) : (row.scopes as string[] ?? []),
      enabled: (row.enabled as number) === 1,
      config: typeof row.config === "string" ? JSON.parse(row.config) : (row.config ?? {}),
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }

  private mapSessionRow(row: Record<string, unknown>): SessionRecord {
    return {
      id: row.id as string,
      identity_id: row.identity_id as string,
      session_type: row.session_type as string,
      auth_method: row.auth_method as string,
      mfa_level: row.mfa_level as number,
      status: row.status as string,
      ip_address: row.ip_address as string | undefined,
      device_fingerprint: row.device_fingerprint as string | undefined,
      user_agent: row.user_agent as string | undefined,
      risk_score: row.risk_score as number | undefined,
      started_at: row.started_at as string,
      expires_at: row.expires_at as string,
      last_activity_at: row.last_activity_at as string,
      metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata ?? {}),
      consent_snapshot: typeof row.consent_snapshot === "string" ? JSON.parse(row.consent_snapshot) : (row.consent_snapshot ?? {}),
    };
  }

  private mapCredentialRow(row: Record<string, unknown>): IdentityCredentialRecord {
    return {
      id: row.id as string,
      identity_id: row.identity_id as string,
      credential_type: row.credential_type as string,
      credential_hash: row.credential_hash as string,
      expires_at: row.expires_at as string | undefined,
      rotated_at: row.rotated_at as string | undefined,
      revoked_at: row.revoked_at as string | undefined,
      created_at: row.created_at as string,
    };
  }

  private mapRefreshTokenRow(row: Record<string, unknown>): RefreshTokenRecord {
    return {
      id: row.id as string,
      identity_id: row.identity_id as string,
      session_id: row.session_id as string,
      token_hash: row.token_hash as string,
      expires_at: row.expires_at as string,
      revoked_at: row.revoked_at as string | undefined,
      created_at: row.created_at as string,
      replaced_by: row.replaced_by as string | undefined,
    };
  }

  private mapEmailVerificationRow(row: Record<string, unknown>): EmailVerificationRecord {
    return {
      id: row.id as string,
      identity_id: row.identity_id as string,
      email: row.email as string,
      token_hash: row.token_hash as string,
      expires_at: row.expires_at as string,
      verified_at: row.verified_at as string | undefined,
      created_at: row.created_at as string,
    };
  }

  private mapPasswordResetRow(row: Record<string, unknown>): PasswordResetRecord {
    return {
      id: row.id as string,
      identity_id: row.identity_id as string,
      token_hash: row.token_hash as string,
      expires_at: row.expires_at as string,
      used_at: row.used_at as string | undefined,
      created_at: row.created_at as string,
    };
  }

  private mapOAuthRow(row: Record<string, unknown>): OAuthAccountRecord {
    return {
      id: row.id as string,
      identity_id: row.identity_id as string,
      provider_id: row.provider_id as string,
      subject_id: row.subject_id as string,
      email: row.email as string | undefined,
      display_name: row.display_name as string | undefined,
      access_token: row.access_token as string | undefined,
      refresh_token: row.refresh_token as string | undefined,
      token_expires_at: row.token_expires_at as string | undefined,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
    };
  }
}