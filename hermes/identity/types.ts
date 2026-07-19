// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Identity & Authorization Engine        │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Core type definitions for the reusable security pipeline.
//
//   Identity Resolver → Principal Builder → Permission Resolver
//     → Authorization Middleware → Audit Middleware → Business Service
//
// These types are provider-agnostic. No Telegram, dashboard, or mobile
// specific concepts appear here — those are concerns of individual
// IdentityResolver implementations (see providers.ts).

/** Stable identifiers for the identity providers the engine supports. */
export type IdentityProvider =
  | "telegram"
  | "dashboard"
  | "mobile"
  | "api_key"
  | "clinic_portal"
  | string; // open-ended for future providers

/**
 * The authenticated caller, presented to all downstream business services.
 * Services must consume ONLY this object — never the raw request, never a
 * provider-specific identifier (e.g. a Telegram chat id).
 */
export interface Principal {
  /** User id (users.id) — the canonical internal identity. */
  userId: string;
  /** Role id (roles.id) — resolved from users.role_id. */
  roleId: string;
  /** Role name (roles.name), e.g. "OWNER". Convenience + audit. */
  roleName: string;
  /** Effective permissions (final, post-override, deny-wins resolved). */
  permissions: Set<string>;
  /** Which provider authenticated this principal. */
  provider: IdentityProvider;
  /** Provider-specific stable identifier (e.g. Telegram chat id). */
  providerIdentifier: string;
  /** Free-form, provider-specific metadata (display name, etc.). */
  metadata: Record<string, unknown>;
}

/**
 * Result of resolving an identity from a request. A resolver returns this
 * WITHOUT touching the permission tables — it only establishes "who".
 */
export interface IdentityResolution {
  /** The external/programmatic id used by the provider (e.g. Telegram id). */
  providerIdentifier: string;
  /** The provider that produced this resolution. */
  provider: IdentityProvider;
  /** Optional provider-supplied display metadata. */
  metadata?: Record<string, unknown>;
}

/** A single authorization decision captured for the audit trail. */
export interface AuthorizationDecision {
  /** Actor (user id) that the decision was made for. */
  actorId: string;
  /** Permission key that was requested (e.g. "leads.read"). */
  permission: string;
  /** The resource the action targeted, if any. */
  resource?: { type: string; id: string | null };
  /** Whether the request was authorized. */
  result: "allow" | "deny";
  /** Human-readable note (e.g. "OWNER short-circuit"). */
  reason?: string;
  /** ISO 8601 timestamp of the decision. */
  timestamp: string;
  /** Request metadata for forensic context. */
  context?: {
    provider?: IdentityProvider;
    providerIdentifier?: string;
    ipAddress?: string | null;
    userAgent?: string | null;
    requestId?: string | null;
  };
}

/**
 * Contract every identity provider must satisfy. A provider knows how to pull
 * an IdentityResolution out of a request for its channel. It performs NO
 * permission logic — that is the job of the Permission Resolver.
 *
 * Adding a new provider (mobile, dashboard, clinic portal) means implementing
 * this interface and registering it. Business logic is untouched.
 */
export interface IdentityResolver {
  /** The provider identifier this resolver handles. */
  readonly provider: IdentityProvider;
  /**
   * Extract identity from a request.
   * @returns the resolution, or null if the request does not carry this
   *          provider's credentials (so the pipeline can try the next one).
   * @throws AuthError if credentials are present but invalid/expired.
   */
  resolve(request: Request): Promise<IdentityResolution | null>;
}

/** Error thrown when identity resolution or authorization fails. */
export class AuthError extends Error {
  constructor(
    message: string,
    /** HTTP status to return to the caller. */
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}
