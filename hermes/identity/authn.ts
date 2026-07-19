// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Authentication Provider Foundation          │
// │ EPIC-002-006H · PHASE 1                                        │
// │                                                 DESIGN:        │
// │  The existing engine has an IdentityResolver (establishes      │
// │  "who") and a Principal Builder (resolves roles/permissions).  │
// │  This module adds the MISSING middle layer: AUTHENTICATION.    │
// │                                                 SEPARATION:     │
// │  • IdentityResolver  → "who is making this request?"           │
// │  • Authenticator      → "are their credentials valid NOW?"     │
// │  • Session            → "is this an established trusted session?"│
// │  • Principal Builder  → "what may they do?"  (existing)         │
// │                                                 NEUTRALITY:     │
// │  Hermes is NOT permanently bound to one IdP. Telegram is the    │
// │  seed; Google/GitHub/Microsoft/hardware-key are interface-only  │
// │  stubs — they implement Authenticator but wire no secrets, so   │
// │  adding a real provider later is a config drop-in, not a        │
// │  platform rewrite.                                              │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../audit/event.js";
import { AuthError, type IdentityProvider, type IdentityResolution } from "./types.js";
import { resolveIdentity } from "./providers.js";
import { buildPrincipal } from "./principal.js";
import {
  listIdentityResolvers,
  registerIdentityResolver,
  unregisterIdentityResolver,
  type IdentityResolver,
} from "./providers.js";
import type { D1Database } from "@cloudflare/workers-types";
import type { Principal } from "./types.js";

// ── Authenticator: credential verification (the missing layer) ──

/**
 * A credential challenge presented by a provider during an interactive
 * authentication (OAuth code, WebAuthn assertion, OTP, …). The Authenticator
 * verifies it and returns a normalized identity resolution on success.
 *
 * Distinct from IdentityResolver: a resolver reads an already-authenticated
 * transport header; an Authenticator proves the credential itself.
 */
export interface AuthChallenge {
  /** Provider that issued the challenge. */
  provider: IdentityProvider;
  /** Opaque credential material (OAuth code, assertion, token, …). */
  credential: string;
  /** Optional nonce/state to prevent replay. */
  state?: string;
}

/**
 * Contract every authentication provider must satisfy. An Authenticator
 * VERIFIES credentials and yields an IdentityResolution; it never touches the
 * permission tables. Adding Google/GitHub/Microsoft/hardware-key providers
 * means implementing this interface + registering — no engine change.
 */
export interface Authenticator {
  /** The provider this authenticator handles. */
  readonly provider: IdentityProvider;
  /**
   * Verify a credential challenge.
   * @returns a normalized IdentityResolution on success.
   * @throws AuthError if the credential is invalid/expired/forged.
   */
  verify(challenge: AuthChallenge): Promise<IdentityResolution>;
}

// ── Session lifecycle model ──

export type SessionState = "active" | "expired" | "revoked";

/**
 * A verified human session. Hermes owns the session, not the IdP — this is
 * what lets us stay provider-neutral (the IdP authenticates once; Hermes
 * issues and controls the session).
 */
export interface Session {
  /** Hermes-issued session id (not the provider's token). */
  id: string;
  /** Provider that authenticated the session. */
  provider: IdentityProvider;
  /** Provider-specific stable identifier (chat id, subject, …). */
  providerIdentifier: string;
  /** Internal user id (users.id) resolved at session creation. */
  userId: string;
  /** ISO 8601 creation time. */
  createdAt: string;
  /** ISO 8601 expiry time. */
  expiresAt: string;
  /** Current lifecycle state. */
  state: SessionState;
  /** Whether a human verified this session (MFA / operator ack). */
  humanVerified: boolean;
}

/** Default session lifetime (15 minutes) — short, fail-closed. */
export const DEFAULT_SESSION_TTL_MS = 15 * 60 * 1000;

// In-memory session store. A durable backend (D1/KV) can be attached later
// via setSessionStore without changing call sites — provider-neutral by design.
type SessionStore = {
  put(s: Session): void;
  get(id: string): Session | undefined;
  remove(id: string): void;
  list(): Session[];
};

const MEMORY_SESSIONS: Map<string, Session> = new Map();
const store: SessionStore = {
  put: (s) => MEMORY_SESSIONS.set(s.id, s),
  get: (id) => MEMORY_SESSIONS.get(id),
  remove: (id) => MEMORY_SESSIONS.delete(id),
  list: () => [...MEMORY_SESSIONS.values()],
};

/** Attach a durable session store (D1/KV). Optional; defaults to in-memory. */
export function setSessionStore(_s: SessionStore): void {
  // Hook for future durable wiring; the in-memory store is sufficient for
  // the contract + tests today.
}

// ── Authenticator registry ──

const AUTHENTICATORS = new Map<IdentityProvider, Authenticator>();

export function registerAuthenticator(a: Authenticator): void {
  AUTHENTICATORS.set(a.provider, a);
  emitAudit("auth.provider.registered", "system", { provider: a.provider });
}

export function getAuthenticator(provider: IdentityProvider): Authenticator | undefined {
  return AUTHENTICATORS.get(provider);
}

export function listAuthenticators(): Authenticator[] {
  return [...AUTHENTICATORS.values()];
}

// ── Core flows ──

/**
 * Resolve a Principal from an incoming request by chaining:
 *   IdentityResolver → Principal Builder
 * This is the request-path (already-authenticated transport) flow.
 * Every resolution is audited.
 */
export async function resolvePrincipalFromRequest(
  db: D1Database,
  request: Request,
): Promise<Principal> {
  const identity = await resolveIdentity(request);
  if (!identity) {
    emitAudit("auth.failed", "anonymous", { reason: "no identity resolver matched" });
    throw new AuthError("Unauthenticated: no identity provider recognized this request", 401);
  }
  emitAudit("auth.resolved", identity.providerIdentifier, {
    provider: identity.provider,
  });
  return buildPrincipal(db, identity);
}

/**
 * Create a verified session from a credential challenge. This is the
 * interactive login flow (OAuth / WebAuthn / …). On success Hermes issues its
 * own session — the IdP token is never shared downstream.
 */
export async function createSession(
  db: D1Database,
  challenge: AuthChallenge,
  opts: { ttlMs?: number; humanVerified?: boolean } = {},
): Promise<Session> {
  const authenticator = getAuthenticator(challenge.provider);
  if (!authenticator) {
    emitAudit("auth.failed", "anonymous", {
      reason: "no authenticator for provider",
      provider: challenge.provider,
    });
    throw new AuthError(`No authenticator registered for provider "${challenge.provider}"`, 401);
  }

  // Verify credentials → identity. AuthError propagates (bad credentials).
  const identity = await authenticator.verify(challenge);

  // Resolve the principal to obtain the internal user id (fail-closed).
  const principal = await buildPrincipal(db, identity);

  const now = Date.now();
  const ttl = opts.ttlMs ?? DEFAULT_SESSION_TTL_MS;
  const session: Session = {
    id: crypto.randomUUID(),
    provider: identity.provider,
    providerIdentifier: identity.providerIdentifier,
    userId: principal.userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
    state: "active",
    humanVerified: opts.humanVerified ?? false,
  };
  store.put(session);
  emitAudit("auth.session.created", principal.userId, {
    sessionId: session.id,
    provider: session.provider,
    humanVerified: session.humanVerified,
  });
  return session;
}

/**
 * Validate a Hermes session id. Returns the Session if active + unexpired,
 * otherwise throws AuthError (fail-closed). Expired sessions are marked and
 * pruned.
 */
export function validateSession(sessionId: string): Session {
  const s = store.get(sessionId);
  if (!s) {
    emitAudit("auth.session.invalid", "anonymous", { sessionId });
    throw new AuthError("Invalid session", 401);
  }
  if (s.state === "revoked") {
    emitAudit("auth.session.revoked", s.userId, { sessionId });
    throw new AuthError("Session revoked", 401);
  }
  if (s.state === "expired" || Date.now() >= Date.parse(s.expiresAt)) {
    s.state = "expired";
    store.remove(sessionId);
    emitAudit("auth.session.expired", s.userId, { sessionId });
    throw new AuthError("Session expired", 401);
  }
  return s;
}

/** Revoke a session (logout / operator action). */
export function revokeSession(sessionId: string): void {
  const s = store.get(sessionId);
  if (!s) return;
  s.state = "revoked";
  store.remove(sessionId);
  emitAudit("auth.session.revoked", s.userId, { sessionId });
}

/** Resolve the Principal bound to an active session (session-path flow). */
export async function resolvePrincipalFromSession(
  db: D1Database,
  sessionId: string,
): Promise<Principal> {
  const s = validateSession(sessionId);
  // Re-resolve the principal so permissions are always fresh (deny-wins).
  return buildPrincipal(db, {
    provider: s.provider,
    providerIdentifier: s.providerIdentifier,
  });
}

/** Introspection for the observability layer (Phase 5). */
export function listActiveSessions(): Session[] {
  return store
    .list()
    .filter((s) => s.state === "active" && Date.parse(s.expiresAt) > Date.now());
}

// ── Future provider stubs (interface-only, no secrets wired) ──
//
// These satisfy the Authenticator contract so the registry is complete and
// the platform is demonstrably provider-neutral. They do NOT hold any
// client secret / private key — wiring those is a deployment-time config
// step, never a code change. They throw AuthError on use, signaling
// "registered but not yet configured", which is the safe default.

class UnconfiguredAuthenticator implements Authenticator {
  constructor(readonly provider: IdentityProvider) {}
  async verify(_c: AuthChallenge): Promise<IdentityResolution> {
    emitAudit("auth.provider.unconfigured", "anonymous", { provider: this.provider });
    throw new AuthError(
      `Authenticator "${this.provider}" is registered but not yet configured`,
      501,
    );
  }
}

// Seed the registry with the future providers (interface-only).
// Telegram is handled by the IdentityResolver on the request path; it is
// intentionally NOT in the Authenticator registry because it authenticates
// at the gateway, not via an interactive challenge.
registerAuthenticator(new UnconfiguredAuthenticator("google"));
registerAuthenticator(new UnconfiguredAuthenticator("github"));
registerAuthenticator(new UnconfiguredAuthenticator("microsoft"));
registerAuthenticator(new UnconfiguredAuthenticator("hardware-key"));

// Re-export resolver registry bits for convenience / tests.
export {
  listIdentityResolvers,
  registerIdentityResolver,
  unregisterIdentityResolver,
  type IdentityResolver,
};
