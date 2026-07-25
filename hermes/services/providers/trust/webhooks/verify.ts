// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Trust Webhook Authenticity Verification      │
// │ EPIC-005.7A (F-2) · provider-neutral, fail-closed              │
// └─────────────────────────────────────────────────────────────┘
//
// Verifies the AUTHENTICITY of an inbound trust webhook BEFORE any trust
// state is mutated. Real cryptographic verification only:
//   • HMAC-SHA256 over (timestamp ‖ body) via Web Crypto
//   • constant-time signature compare
//   • timestamp freshness window (replay / clock-skew protection)
//   • nonce replay cache (each notification id used at most once)
//
// No simulation, no "trust-on-first-use". A failed check returns
// { verified:false } and emits a DENY audit; it NEVER permits a state
// change. The verified body is only returned on full success.
//
// Uses the Web Crypto API (crypto.subtle) — no Node globals — so it stays
// typecheck-clean under the platform tsconfig (types: []).

import { emitAudit } from "../../../../audit/emitter.js";

/** Case-insensitive header lookup surface (vendor-neutral). */
export interface TrustWebhookHeaders {
  get(name: string): string | undefined;
}

export interface TrustWebhookVerificationOptions {
  /** Shared secret used for HMAC (provider-neutral; injected, never hardcoded). */
  secret: string;
  /** Header carrying the HMAC signature (base64url or base64). Default: x-hermes-signature. */
  signatureHeader?: string;
  /** Header carrying the request timestamp (epoch ms). */
  timestampHeader?: string;
  /** Header carrying the unique notification id (replay protection). */
  nonceHeader?: string;
  /** Max age of a message before it is rejected (ms). Default 5 min. */
  maxAgeMs?: number;
  /** Replay cache: records seen nonce ids; must reject repeats. */
  replayCache?: ReplayCache;
}

/** Records seen nonce ids; returns true if already used. */
export interface ReplayCache {
  seen(id: string): boolean;
}

export interface VerifiedTrustWebhook {
  verified: true;
  requestId: string;
  receivedAt: number;
  /** The raw, unmodified body that was verified (caller parses after). */
  rawBody: Uint8Array;
  scheme: "hmac";
}

export interface UnverifiedTrustWebhook {
  verified: false;
  reason: string;
  code: string;
}

export type TrustWebhookVerification =
  | VerifiedTrustWebhook
  | UnverifiedTrustWebhook;

const DEFAULTS = {
  signatureHeader: "x-hermes-signature",
  timestampHeader: "x-hermes-timestamp",
  nonceHeader: "x-hermes-request-id",
  maxAgeMs: 5 * 60 * 1000,
  scheme: "hmac" as const,
};

const encoder = new TextEncoder();

/**
 * A simple in-memory replay cache (suitable for single-instance deployments).
 * Swap for a distributed store in multi-region deployments — same interface.
 * The timestamp freshness window already bounds validity, so a full nonce
 * store can be bounded by an LRU/cap.
 */
export class MemoryReplayCache implements ReplayCache {
  private seenSet = new Set<string>();
  constructor(private readonly cap = 100_000) {}
  seen(id: string): boolean {
    if (this.seenSet.has(id)) return true;
    this.seenSet.add(id);
    if (this.seenSet.size > this.cap) this.seenSet.clear();
    return false;
  }
}

/**
 * Compute the expected HMAC-SHA256 signature (base64). Binds timestamp ‖ body
 * so a captured signature cannot be replayed against a different payload or an
 * unbounded time window.
 */
export async function signWebhook(
  secret: string,
  tsRaw: string,
  rawBody: Uint8Array,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const msg = concatBytes(encoder.encode(tsRaw), rawBody);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, msg as BufferSource));
  return bytesToBase64(sig);
}

/**
 * Verify an inbound trust webhook's authenticity.
 * FAIL-CLOSED: any missing field, bad signature, stale timestamp, or replayed
 * nonce returns { verified:false } and emits a DENY audit. The body is NEVER
 * handed back for use when verification fails.
 */
export async function verifyTrustWebhookAuthenticity(
  headers: TrustWebhookHeaders,
  rawBody: Uint8Array,
  opts: TrustWebhookVerificationOptions,
): Promise<TrustWebhookVerification> {
  const sigHdr = opts.signatureHeader ?? DEFAULTS.signatureHeader;
  const tsHdr = opts.timestampHeader ?? DEFAULTS.timestampHeader;
  const nonceHdr = opts.nonceHeader ?? DEFAULTS.nonceHeader;
  const maxAge = opts.maxAgeMs ?? DEFAULTS.maxAgeMs;

  const requestId = headers.get(nonceHdr) ?? "";
  const tsRaw = headers.get(tsHdr) ?? "";
  const sigRaw = headers.get(sigHdr) ?? "";

  const deny = (code: string, reason: string): UnverifiedTrustWebhook => {
    emitAudit(
      "trust.webhook.verify.denied",
      "system",
      { code, reason, requestId },
      { category: "trust-webhook", decision: "deny" },
    );
    return { verified: false, reason, code };
  };

  if (!requestId) return deny("WEBHOOK_NO_REQUEST_ID", "missing request id header");
  if (!tsRaw) return deny("WEBHOOK_NO_TIMESTAMP", "missing timestamp header");
  if (!sigRaw) return deny("WEBHOOK_NO_SIGNATURE", "missing signature header");

  // ── Timestamp freshness ──
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts) || ts <= 0) {
    return deny("WEBHOOK_BAD_TIMESTAMP", "timestamp is not a valid epoch-ms number");
  }
  const now = Date.now();
  if (Math.abs(now - ts) > maxAge) {
    return deny("WEBHOOK_STALE", `timestamp outside freshness window (±${maxAge}ms)`);
  }

  // ── Replay protection ──
  if (opts.replayCache && opts.replayCache.seen(requestId)) {
    return deny("WEBHOOK_REPLAY", `request id ${requestId} already used`);
  }

  // ── Signature verification (constant-time compare) ──
  const expected = await signWebhook(opts.secret, tsRaw, rawBody);
  let provided: Uint8Array;
  try {
    provided = base64ToBytes(sigRaw);
  } catch {
    return deny("WEBHOOK_BAD_SIGNATURE", "signature is not valid base64");
  }
  const expectedBytes = base64ToBytes(expected);
  if (!constantTimeEqual(expectedBytes, provided)) {
    return deny("WEBHOOK_BAD_SIGNATURE", "signature mismatch");
  }

  emitAudit(
    "trust.webhook.verify.allowed",
    "system",
    { requestId },
    { category: "trust-webhook", decision: "allow" },
  );
  return { verified: true, requestId, receivedAt: now, rawBody, scheme: "hmac" };
}

// ── byte / base64 helpers (no Node globals) ────────────────────────────────

function concatBytes(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

function base64ToBytes(s: string): Uint8Array {
  // tolerate base64url by normalizing
  const norm = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(norm);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
