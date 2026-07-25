// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Trust Webhook Auth Handler                  │
// │ EPIC-005.7A (F-2) · single verified ingress                   │
// └─────────────────────────────────────────────────────────────┘
//
// Stateless, provider-neutral verifier for trust-state-change webhooks.
// Authenticity is verified FIRST (via verifyTrustWebhookAuthenticity).
// Only a fully verified + schema-valid payload is returned. Any failure is
// fail-closed: the handler throws AuthError and emits a DENY audit. Callers
// MUST route every trust webhook through this before mutating trust state.

import { emitAudit } from "../../../../audit/emitter.js";
import { AuthError } from "../../../../identity/types.js";
import {
  verifyTrustWebhookAuthenticity,
  type ReplayCache,
  type TrustWebhookHeaders,
  type TrustWebhookVerificationOptions,
} from "./verify.js";

/** A validated trust-state-change command (only produced after verification). */
export interface VerifiedTrustCommand {
  requestId: string;
  receivedAt: number;
  /** Target provider id the command applies to. */
  providerId: string;
  /** Requested lifecycle transition. */
  action: "admit" | "quarantine" | "revoke" | "suspend";
  /** Optional reason / evidence (audited, never trusted as authority). */
  reason?: string;
  /** Raw parsed payload for the caller's own strict parsing. */
  payload: unknown;
}

export interface TrustWebhookAuthHandlerOptions extends TrustWebhookVerificationOptions {
  replayCache?: ReplayCache;
}

const ALLOWED_ACTIONS = new Set(["admit", "quarantine", "revoke", "suspend"]);

/**
 * Wire it with the provider's shared secret (injected from config / secret
 * store — never code). Reuses the frozen Authenticator contract semantics:
 * a single, verify-first auth boundary. For signature-based providers, supply
 * a scheme; there is no second, parallel auth system.
 */
export class TrustWebhookAuthHandler {
  constructor(private readonly opts: TrustWebhookAuthHandlerOptions) {}

  /**
   * Verify authenticity AND validate the command shape. Returns a
   * VerifiedTrustCommand only when BOTH pass. Throws AuthError otherwise
   * (fail-closed) — callers must treat a throw as "do not mutate state".
   */
  async authenticate(
    headers: TrustWebhookHeaders,
    rawBody: Uint8Array,
  ): Promise<VerifiedTrustCommand> {
    const v = await verifyTrustWebhookAuthenticity(headers, rawBody, this.opts);
    if (!v.verified) {
      // Already audited inside verify(). Surface as AuthError for the caller.
      throw new AuthError(`Trust webhook authenticity check failed: ${v.reason}`, 401);
    }

    // Authenticity proven — only NOW parse + validate the command (schema).
    let parsed: any;
    try {
      parsed = JSON.parse(new TextDecoder().decode(rawBody));
    } catch {
      emitAudit("trust.webhook.bad-json", "system", { requestId: v.requestId }, { category: "trust-webhook", decision: "deny" });
      throw new AuthError("Trust webhook body is not valid JSON", 400);
    }

    const providerId = parsed?.providerId;
    const action = parsed?.action;
    if (typeof providerId !== "string" || providerId.length === 0) {
      emitAudit("trust.webhook.bad-command", "system", { requestId: v.requestId, missing: "providerId" }, { category: "trust-webhook", decision: "deny" });
      throw new AuthError("Trust webhook command missing providerId", 400);
    }
    if (typeof action !== "string" || !ALLOWED_ACTIONS.has(action)) {
      emitAudit("trust.webhook.bad-command", "system", { requestId: v.requestId, action }, { category: "trust-webhook", decision: "deny" });
      throw new AuthError(`Trust webhook command has invalid action "${action}"`, 400);
    }

    emitAudit("trust.webhook.command.accepted", "system", { requestId: v.requestId, providerId, action }, { category: "trust-webhook", decision: "allow" });
    return {
      requestId: v.requestId,
      receivedAt: v.receivedAt,
      providerId,
      action: action as VerifiedTrustCommand["action"],
      reason: typeof parsed.reason === "string" ? parsed.reason : undefined,
      payload: parsed,
    };
  }
}
