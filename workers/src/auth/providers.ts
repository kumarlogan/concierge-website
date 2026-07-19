// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Identity Resolver Registry              │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Provider-agnostic identity resolution.
//
// The engine resolves an incoming request to a single IdentityResolution by
// trying each registered resolver in order. Telegram is only the FIRST
// provider — dashboard, mobile, api_key, and clinic_portal resolvers can be
// added later simply by implementing IdentityResolver and calling
// registerIdentityResolver(). No business logic changes.
//
// IMPORTANT: resolvers establish "who" only. They never read the permission
// tables and never build a Principal. That is the Principal Builder's job
// (principal.ts), which runs AFTER identity resolution succeeds.

import {
  AuthError,
  type IdentityProvider,
  type IdentityResolution,
  type IdentityResolver,
} from "./types.js";

/**
 * Telegram identity resolver — the first concrete provider.
 *
 * Telegram-specific concerns are quarantined to THIS class. The rest of the
 * engine never sees a Telegram chat id; it only ever receives a normalized
 * IdentityResolution. When the Operations Bot / Admin Bot land (EPIC-002-003/4)
 * they authenticate here and the downstream pipeline is identical for every
 * provider.
 *
 * Resolution contract (transport-agnostic): the calling Telegram gateway
 * presents the chat id via the `X-Telegram-Chat-Id` header. Signature
 * verification is the gateway's responsibility before it reaches the Worker;
 * in this engine layer we trust the gateway-issued header. This keeps the
 * reusable engine free of Telegram SDK dependencies.
 */
export class TelegramIdentityResolver implements IdentityResolver {
  readonly provider: IdentityProvider = "telegram";

  async resolve(request: Request): Promise<IdentityResolution | null> {
    const chatId = request.headers.get("X-Telegram-Chat-Id");
    if (!chatId) return null; // not a Telegram request — try next resolver

    const rawName = request.headers.get("X-Telegram-Display-Name");
    return {
      provider: "telegram",
      providerIdentifier: chatId,
      metadata: rawName ? { displayName: rawName } : undefined,
    };
  }
}

/** In-memory registry of identity resolvers, keyed by provider. */
const resolvers = new Map<IdentityProvider, IdentityResolver>();

/** Register an identity resolver. Later-registered wins on provider clash. */
export function registerIdentityResolver(resolver: IdentityResolver): void {
  resolvers.set(resolver.provider, resolver);
}

/** Remove a resolver (used by tests to isolate state). */
export function unregisterIdentityResolver(provider: IdentityProvider): void {
  resolvers.delete(provider);
}

/** Return all registered resolvers (insertion-stable iteration). */
export function listIdentityResolvers(): IdentityResolver[] {
  return [...resolvers.values()];
}

/**
 * Resolve a request to an identity by trying each registered resolver in
 * order. The first resolver that returns a non-null resolution wins.
 *
 * @returns the resolution, or null if no provider recognized the request.
 * @throws AuthError if a provider recognized the request but its credentials
 *         were invalid/expired (distinct from "no provider matched").
 */
export async function resolveIdentity(
  request: Request,
): Promise<IdentityResolution | null> {
  for (const resolver of listIdentityResolvers()) {
    const resolution = await resolver.resolve(request);
    if (resolution) return resolution;
  }
  return null;
}

// ── Default registration ──────────────────────────────────────
// Telegram is the seed provider. Future providers (dashboard, mobile, etc.)
// register themselves at startup; the engine does not hardcode them.
registerIdentityResolver(new TelegramIdentityResolver());

// Re-export for convenience.
export { AuthError };
export type { IdentityResolution, IdentityProvider, IdentityResolver };
