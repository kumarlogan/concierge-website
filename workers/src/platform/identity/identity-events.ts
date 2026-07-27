// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Identity Core Event Definitions                │
// │ Event types and payloads for identity event-driven arch.   │
// │ Wave 3 — AI Platform Identity Core v1                        │
// └─────────────────────────────────────────────────────────────┘

/**
 * Identity event types that can be emitted by the Identity Core.
 * Used for event-driven integrations (notifications, webhooks,
 * audit pipelines, analytics).
 */
export enum IdentityEventType {
  // Identity lifecycle
  IDENTITY_CREATED = "identity.created",
  IDENTITY_ACTIVATED = "identity.activated",
  IDENTITY_SUSPENDED = "identity.suspended",
  IDENTITY_ARCHIVED = "identity.archived",
  IDENTITY_DELETED = "identity.deleted",
  IDENTITY_UPDATED = "identity.updated",

  // Authentication
  LOGIN_SUCCESS = "identity.login",
  LOGIN_FAILED = "identity.login.failed",
  LOGOUT = "identity.logout",
  PASSWORD_CHANGED = "identity.password.changed",
  PASSWORD_RESET_REQUESTED = "identity.password.reset.requested",
  PASSWORD_RESET_COMPLETED = "identity.password.reset.completed",

  // Email verification
  EMAIL_VERIFICATION_SENT = "identity.email.verification.sent",
  EMAIL_VERIFIED = "identity.email.verified",

  // MFA
  MFA_SETUP = "identity.mfa.setup",
  MFA_ENABLED = "identity.mfa.enabled",
  MFA_DISABLED = "identity.mfa.disabled",
  MFA_FAILED = "identity.mfa.failed",

  // OAuth
  OAUTH_ACCOUNT_LINKED = "identity.oauth.linked",
  OAUTH_ACCOUNT_UNLINKED = "identity.oauth.unlinked",

  // Sessions
  SESSION_CREATED = "identity.session.created",
  SESSION_EXPIRED = "identity.session.expired",
  SESSION_REVOKED = "identity.session.revoked",

  // Security
  SUSPICIOUS_ACTIVITY = "identity.security.suspicious",
  RATE_LIMIT_HIT = "identity.security.rate_limited",
  ACCOUNT_LOCKOUT = "identity.security.account_lockout",

  // Credentials
  CREDENTIAL_ROTATED = "identity.credential.rotated",
  CREDENTIAL_REVOKED = "identity.credential.revoked",
  CREDENTIAL_EXPIRING = "identity.credential.expiring",

  // Workforce
  AI_WORKER_CREDENTIALS_ISSUED = "identity.workforce.ai_worker.credentials_issued",
  AI_WORKER_CREDENTIALS_REVOKED = "identity.workforce.ai_worker.credentials_revoked",
}

/**
 * Base identity event payload.
 */
export interface IdentityEventPayload {
  eventType: IdentityEventType;
  identityId: string;
  timestamp: string;
  sessionId?: string;
  correlationId?: string;
  data: Record<string, unknown>;
  source: string;
}

/**
 * Create a standard identity event payload.
 */
export function createEvent(
  eventType: IdentityEventType,
  identityId: string,
  data: Record<string, unknown> = {},
  opts?: { sessionId?: string; correlationId?: string },
): IdentityEventPayload {
  return {
    eventType,
    identityId,
    timestamp: new Date().toISOString(),
    correlationId: opts?.correlationId ?? crypto.randomUUID(),
    data,
    source: "ai-platform:identity-core",
    ...(opts?.sessionId ? { sessionId: opts.sessionId } : {}),
  };
}