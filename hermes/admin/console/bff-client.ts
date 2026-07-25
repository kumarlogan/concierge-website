// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Admin Console — Local BFF Client (Phase 2)              │
// │ EPIC-002-006G · PHASE 2                                        │
// │ Implements the SPA's BffClient interface by delegating to the   │
// │ server-side BFF (hermes/admin/bff.ts). The client accepts ONLY  │
// │ a VerifiedPrincipal — it can never mint or trust an unverified   │
// │ principal. This is the console's runtime contact with the       │
// │ platform; it performs no authn itself (that happened upstream).  │
// │                                                 BOUNDARY:      │
// │  • Imports the BFF (server side, already human-gated).          │
// │  • Never imports hermes/services/*, hermes/agents/* directly.   │
// │  • Fail-closed: any BFF throw is surfaced as a redacted error.  │
// └─────────────────────────────────────────────────────────────┘

import { bffBootstrap, bffDomain } from "../bff.js";
import type { ConsoleBootstrap } from "./viewmodels.js";
import type { VerifiedPrincipal } from "./session.js";
import type { BffClient } from "./app.js";

/** Concrete BFF client used by the SPA/server renderer. */
export class LocalBffClient implements BffClient {
  constructor(private readonly principal: VerifiedPrincipal) {}

  /** Bootstrap: full console payload for the verified human principal. */
  async bootstrap(): Promise<ConsoleBootstrap> {
    // bffBootstrap internally re-asserts human principal (defense in depth).
    return bffBootstrap(this.principal);
  }

  /** Fetch a single domain. Fail-closed — unknown/unauthorized => throw. */
  async domain(id: string): Promise<ConsoleBootstrap["domains"][string]> {
    try {
      const data = bffDomain(this.principal as never, id);
      return { ok: true, data };
    } catch (err) {
      // Surface as a typed, redacted failure — never leak internals.
      return {
        ok: false,
        error: {
          code: "BFF_DOMAIN_ERROR",
          message: `domain '${id}' unavailable`,
        },
      };
    }
  }
}

/**
 * Build a BFF client from a verified session principal. This is the only
 * sanctioned constructor — callers must have already established a
 * ConsoleSession (which verified human identity).
 */
export function bffClientFor(principal: VerifiedPrincipal): LocalBffClient {
  return new LocalBffClient(principal);
}
