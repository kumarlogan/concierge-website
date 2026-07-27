// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Types                           │
// │ Phase 2 — Wave 3: AI Platform Identity Core v1              │
// │ Reusable platform capability — NOT Concierge-specific       │
// └─────────────────────────────────────────────────────────────┘
//
// Core type definitions for the AI Platform Identity Core.
// All identity consumers import these contracts.
// Provider-agnostic — no product-specific logic.
//
// PHI Boundary: Identity types contain NO personal health information.
// Identity attributes (name, email, external IDs) are NOT PHI.
// Product-bound PHI is stored separately, linked by opaque principal ID.

/**
 * Identity types supported by the platform.
 * Every type authenticates through the same Identity Core.
 */
export enum IdentityType {
  PATIENT = "patient",
  STAFF = "staff",
  ADMINISTRATOR = "administrator",
  CLINIC = "clinic",
  PARTNER = "partner",
  AI_WORKER = "ai_worker",
  PLATFORM_SERVICE = "platform_service",
}

/**
 * Identity lifecycle states.
 * Every identity progresses through a strict lifecycle.
 */
export enum IdentityStatus {
  REGISTERED = "registered",
  VERIFIED = "verified",
  ACTIVE = "active",
  SUSPENDED = "suspended",
  ARCHIVED = "archived",
  DELETED = "deleted",
}

/**
 * Authentication methods supported by the platform.
 */
export enum AuthMethod {
  EMAIL_PASSWORD = "email_password",
  MAGIC_LINK = "magic_link",
  GOOGLE_OAUTH = "google_oauth",
  MICROSOFT_OAUTH = "microsoft_oauth",
  APPLE_SIGN_IN = "apple_sign_in",
  GITHUB_OAUTH = "github_oauth",
  OIDC = "oidc",
  SAML = "saml",
  API_TOKEN = "api_token",
  JWT_BEARER = "jwt_bearer",
}

/**
 * Provider identifiers for the Identity Provider Registry.
 */
export enum ProviderType {
  LOCAL = "local",
  GOOGLE = "google",
  MICROSOFT = "microsoft",
  APPLE = "apple",
  GITHUB = "github",
  OIDC = "oidc",
  SAML = "saml",
}

/**
 * MFA tiers for progressive authentication.
 */
export enum MFATier {
  NONE = 0,
  SINGLE_FACTOR = 1,
  TWO_FACTOR = 2,
  MFA_PLUS_DEVICE = 3,
}

/**
 * MFA method types.
 */
export enum MFAMethod {
  TOTP = "totp",
  SMS_OTP = "sms_otp",
  EMAIL_OTP = "email_otp",
  SECURITY_KEY = "security_key",
  BACKUP_CODE = "backup_code",
}

/**
 * Session lifecycle state.
 */
export enum SessionState {
  ACTIVE = "active",
  EXPIRED = "expired",
  REVOKED = "revoked",
}

/**
 * Credential type for credential management.
 */
export enum CredentialType {
  PASSWORD_HASH = "password_hash",
  REFRESH_TOKEN = "refresh_token",
  API_TOKEN = "api_token",
  OAUTH_ACCESS_TOKEN = "oauth_access_token",
  OAUTH_REFRESH_TOKEN = "oauth_refresh_token",
  SESSION_TOKEN = "session_token",
  MAGIC_LINK_TOKEN = "magic_link_token",
  VERIFICATION_TOKEN = "verification_token",
}

// ── Core Data Models ───────────────────────────────────────

/**
 * Platform Identity — canonical identity record.
 * Stored in the identity database (separate from PHI).
 * PHI Boundary: Contains NO personal health information.
 */
export interface PlatformIdentity {
  id: string;
  identityType: IdentityType;
  status: IdentityStatus;
  primaryEmail: string | null;
  displayName: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Profile data for an identity.
 * Stored alongside the identity record — still NOT PHI.
 */
export interface IdentityProfile {
  displayName?: string;
  avatarUrl?: string;
  locale?: string;
  timezone?: string;
  phoneNumber?: string;
}

/**
 * External identity link (OAuth provider accounts).
 */
export interface ExternalIdentity {
  id: string;
  identityId: string;
  providerType: ProviderType;
  providerId: string;         // Provider-internal user/subject ID
  providerEmail: string | null;
  providerName: string | null;
  linkedAt: string;
  lastUsedAt: string | null;
}

/**
 * Identity credential record.
 * PHI Boundary: Contains only hashed/encrypted values, never plaintext secrets.
 */
export interface IdentityCredential {
  id: string;
  identityId: string;
  credentialType: CredentialType;
  credentialHash: string;      // Always hashed, never plaintext
  expiresAt: string | null;
  rotatedAt: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

/**
 * Session — established after successful authentication.
 */
export interface Session {
  id: string;
  identityId: string;
  identityType: IdentityType;
  authMethod: AuthMethod;
  mfaLevel: MFATier;
  state: SessionState;
  startedAt: string;
  expiresAt: string;
  lastActivityAt: string;
  deviceFingerprint: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  riskScore: number;           // 0.0 – 1.0
  metadata: Record<string, unknown>;
}

/**
 * Refresh token record.
 */
export interface RefreshToken {
  id: string;
  sessionId: string;
  identityId: string;
  tokenHash: string;           // Hashed, never plaintext
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
}

/**
 * Email verification record.
 */
export interface EmailVerification {
  id: string;
  identityId: string;
  email: string;
  token: string;               // Hashed for storage
  expiresAt: string;
  verifiedAt: string | null;
  createdAt: string;
}

/**
 * Password reset record.
 */
export interface PasswordReset {
  id: string;
  identityId: string;
  token: string;               // Hashed for storage
  expiresAt: string;
  completedAt: string | null;
  createdAt: string;
}

/**
 * Magic link record.
 */
export interface MagicLink {
  id: string;
  identityId: string;
  email: string;
  token: string;               // Hashed for storage
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
}

/**
 * OAuth account link record.
 */
export interface OAuthAccount {
  id: string;
  identityId: string;
  providerType: ProviderType;
  providerAccountId: string;
  providerEmail: string | null;
  accessToken: string | null;   // Encrypted at rest
  refreshToken: string | null;  // Encrypted at rest
  tokenExpiresAt: string | null;
  scope: string | null;
  linkedAt: string;
  updatedAt: string;
}

/**
 * Identity audit event.
 */
export interface IdentityAuditEvent {
  id: string;
  eventType: string;
  identityId: string | null;
  actorId: string | null;
  timestamp: string;
  outcome: "SUCCESS" | "FAILURE" | "REVOKED";
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  sessionId: string | null;
}

/**
 * Trust snapshot — captured at authentication time.
 */
export interface TrustSnapshot {
  id: string;
  identityId: string;
  sessionId: string;
  trustScore: number;          // 0.0 – 1.0
  factors: TrustFactor[];
  capturedAt: string;
}

export interface TrustFactor {
  name: string;
  score: number;
  weight: number;
  passed: boolean;
  detail?: string;
}

/**
 * Consent snapshot — captured at authentication time.
 */
export interface ConsentSnapshot {
  id: string;
  identityId: string;
  sessionId: string;
  activeConsents: string[];    // Consent type IDs
  hash: string;                // Integrity verification
  capturedAt: string;
}

/**
 * Identity event for event-driven integrations.
 */
export interface IdentityEvent {
  eventType: string;
  identityId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

// ── Request/Response types ─────────────────────────────────

export interface RegisterIdentityRequest {
  identityType: IdentityType;
  email: string;
  password?: string;
  profile?: IdentityProfile;
  metadata?: Record<string, unknown>;
}

export interface LoginRequest {
  email: string;
  password: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface LoginResponse {
  identity: PlatformIdentity;
  session: Session;
  accessToken: string;
  refreshToken: string;
  mfaRequired: boolean;
  mfaMethods?: MFAMethod[];
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  session: Session;
}

export interface OAuthLoginRequest {
  providerType: ProviderType;
  code: string;
  redirectUri: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface MagicLinkRequest {
  email: string;
  deviceFingerprint?: string;
}

export interface MagicLinkVerifyRequest {
  token: string;
  deviceFingerprint?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetComplete {
  token: string;
  newPassword: string;
}

export interface EmailVerificationRequest {
  identityId: string;
  email: string;
}

export interface EmailVerificationComplete {
  token: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

// ── Provider Interfaces ────────────────────────────────────

/**
 * Provider metadata — configuration for each provider.
 */
export interface ProviderMetadata {
  id: string;
  displayName: string;
  providerType: ProviderType;
  supportedMethods: AuthMethod[];
  enabled: boolean;
  config: Record<string, unknown>;
}

/**
 * OAuth provider configuration.
 */
export interface OAuthProviderConfig {
  clientId: string;
  clientSecret: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scopes: string[];
  redirectUri: string;
}

/**
 * Token result from OAuth token exchange.
 */
export interface TokenResult {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  scope?: string;
  idToken?: string;
}

/**
 * User info from OAuth provider (normalized).
 */
export interface ProviderUserInfo {
  providerId: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  verifiedEmail: boolean;
}

/**
 * Identity Provider interface — all providers implement this.
 */
export interface IIdentityProvider {
  readonly providerType: ProviderType;
  readonly metadata: ProviderMetadata;
  authenticate(request: AuthRequest): Promise<AuthResult>;
  exchangeCode(code: string, redirectUri: string): Promise<TokenResult>;
  getUserInfo(tokenResult: TokenResult): Promise<ProviderUserInfo>;
  validateToken(token: string): Promise<boolean>;
  health(): Promise<boolean>;
}

export interface AuthRequest {
  providerType: ProviderType;
  credential: string;
  metadata?: Record<string, unknown>;
}

export interface AuthResult {
  success: boolean;
  principal?: PlatformIdentity;
  session?: Session;
  mfaRequired: boolean;
  mfaMethods?: MFAMethod[];
  error?: string;
  auditId: string;
}

// ── Error types ────────────────────────────────────────────

export class IdentityError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 400,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "IdentityError";
  }
}

export class AuthenticationError extends IdentityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHENTICATION_ERROR", 401, details);
    this.name = "AuthenticationError";
  }
}

export class AuthorizationError extends IdentityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHORIZATION_ERROR", 403, details);
    this.name = "AuthorizationError";
  }
}

export class NotFoundError extends IdentityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "NOT_FOUND", 404, details);
    this.name = "NotFoundError";
  }
}

export class RateLimitError extends IdentityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "RATE_LIMITED", 429, details);
    this.name = "RateLimitError";
  }
}

export class ConflictError extends IdentityError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONFLICT", 409, details);
    this.name = "ConflictError";
  }
}

// ── Repository Record Types ─────────────────────────────────
// Lowercase-Record naming for D1 row-mapping layer.
// These map 1:1 to the SQL table columns.

export interface IdentityRecord {
  id: string;
  identity_type: string;
  status: string;
  email?: string;
  email_verified: boolean;
  phone?: string;
  phone_verified: boolean;
  display_name?: string;
  password_hash?: string;
  mfa_enabled: boolean;
  mfa_method?: string;
  trust_score?: number;
  created_at: string;
  updated_at: string;
  last_login_at?: string;
  metadata: Record<string, unknown>;
}

export interface IdentityProviderRecord {
  id: string;
  name: string;
  provider_type: string;
  client_id?: string;
  client_secret?: string;
  issuer_url?: string;
  scopes: string[];
  enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SessionRecord {
  id: string;
  identity_id: string;
  session_type: string;
  auth_method: string;
  mfa_level: number;
  status: string;
  ip_address?: string;
  device_fingerprint?: string;
  user_agent?: string;
  risk_score?: number;
  started_at: string;
  expires_at: string;
  last_activity_at: string;
  metadata: Record<string, unknown>;
  consent_snapshot: Record<string, unknown>;
}

export interface IdentityCredentialRecord {
  id: string;
  identity_id: string;
  credential_type: string;
  credential_hash: string;
  expires_at?: string;
  rotated_at?: string;
  revoked_at?: string;
  created_at: string;
}

export interface RefreshTokenRecord {
  id: string;
  identity_id: string;
  session_id: string;
  token_hash: string;
  expires_at: string;
  revoked_at?: string;
  created_at: string;
  replaced_by?: string;
}

export interface EmailVerificationRecord {
  id: string;
  identity_id: string;
  email: string;
  token_hash: string;
  expires_at: string;
  verified_at?: string;
  created_at: string;
}

export interface PasswordResetRecord {
  id: string;
  identity_id: string;
  token_hash: string;
  expires_at: string;
  used_at?: string;
  created_at: string;
}

export interface OAuthAccountRecord {
  id: string;
  identity_id: string;
  provider_id: string;
  subject_id: string;
  email?: string;
  display_name?: string;
  access_token?: string;
  refresh_token?: string;
  token_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface IdentityEventRecord {
  id: string;
  identity_id: string;
  event_type: string;
  severity: string;
  details: Record<string, unknown>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

export interface IdentityAuditRecord {
  id: string;
  identity_id: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  outcome: string;
  reason?: string;
  ip_address?: string;
  session_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TrustSnapshotRecord {
  id: string;
  identity_id: string;
  session_id: string;
  trust_score: number;
  trust_level: string;
  factors: TrustFactor[];
  expires_at?: string;
  created_at: string;
}

export interface ConsentSnapshotRecord {
  id: string;
  identity_id: string;
  session_id: string;
  consent_type: string;
  granted: boolean;
  snapshot_data: Record<string, unknown>;
  expires_at?: string;
  created_at: string;
}