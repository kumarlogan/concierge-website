// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.7A F-2 Regression Suite             │
// │ Trust webhook authenticity (fail-closed)                     │
// └─────────────────────────────────────────────────────────────┘
//
// Real cryptographic verification: a valid signed/fresh/unique webhook is
// verified and its command parsed; every tampered, stale, replayed, or
// malformed request is rejected (fail-closed, never mutates state).
// No stubs — real HMAC-SHA256 over the real body bytes (Web Crypto).

import { describe, it, expect } from "vitest";
import {
  verifyTrustWebhookAuthenticity,
  signWebhook,
  MemoryReplayCache,
  type TrustWebhookHeaders,
} from "../verify.js";
import { TrustWebhookAuthHandler, type VerifiedTrustCommand } from "../handler.js";
import { AuthError } from "../../../../../identity/types.js";

const SECRET = "wh-secret-7a";

function h(map: Record<string, string>): TrustWebhookHeaders {
  return { get: (n: string) => map[n] ?? undefined };
}

function enc(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

async function goodHeaders(body: Uint8Array, ts = String(Date.now()), nonce = "req-1") {
  return h({
    "x-hermes-signature": await signWebhook(SECRET, ts, body),
    "x-hermes-timestamp": ts,
    "x-hermes-request-id": nonce,
  });
}

describe("EPIC-005.7A F-2 — trust webhook authenticity (fail-closed)", () => {
  it("valid signed, fresh, unique webhook is verified + command parsed", async () => {
    const body = enc(JSON.stringify({ providerId: "p1", action: "quarantine", reason: "x" }));
    const handler = new TrustWebhookAuthHandler({ secret: SECRET });
    const cmd: VerifiedTrustCommand = await handler.authenticate(await goodHeaders(body), body);
    expect(cmd.providerId).toBe("p1");
    expect(cmd.action).toBe("quarantine");
    expect(cmd.requestId).toBe("req-1");
  });

  it("tampered body → signature mismatch → AuthError (fail-closed)", async () => {
    const body = enc(JSON.stringify({ providerId: "p1", action: "quarantine" }));
    const bad = enc(JSON.stringify({ providerId: "p1", action: "revoke" }));
    const handler = new TrustWebhookAuthHandler({ secret: SECRET });
    await expect(handler.authenticate(await goodHeaders(body), bad)).rejects.toBeInstanceOf(AuthError);
  });

  it("missing signature header → unverified (no state change)", async () => {
    const body = enc("{}");
    const r = await verifyTrustWebhookAuthenticity(
      h({ "x-hermes-timestamp": String(Date.now()), "x-hermes-request-id": "r" }),
      body,
      { secret: SECRET },
    );
    expect(r).toMatchObject({ verified: false, code: "WEBHOOK_NO_SIGNATURE" });
  });

  it("stale timestamp → rejected", async () => {
    const body = enc("{}");
    const ts = String(Date.now() - 10 * 60 * 1000);
    const r = await verifyTrustWebhookAuthenticity(await goodHeaders(body, ts), body, { secret: SECRET });
    expect(r).toMatchObject({ verified: false, code: "WEBHOOK_STALE" });
  });

  it("replayed nonce → rejected", async () => {
    const body = enc(JSON.stringify({ providerId: "p1", action: "quarantine" }));
    const cache = new MemoryReplayCache();
    const opts = { secret: SECRET, replayCache: cache };
    const first = await verifyTrustWebhookAuthenticity(await goodHeaders(body, String(Date.now()), "dup"), body, opts);
    expect(first.verified).toBe(true);
    const second = await verifyTrustWebhookAuthenticity(await goodHeaders(body, String(Date.now()), "dup"), body, opts);
    expect(second).toMatchObject({ verified: false, code: "WEBHOOK_REPLAY" });
  });

  it("invalid action → AuthError (schema rejected after auth)", async () => {
    const body = enc(JSON.stringify({ providerId: "p1", action: "pwn" }));
    const handler = new TrustWebhookAuthHandler({ secret: SECRET });
    await expect(handler.authenticate(await goodHeaders(body), body)).rejects.toBeInstanceOf(AuthError);
  });
});
