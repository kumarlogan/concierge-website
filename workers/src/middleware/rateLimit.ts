// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Lightweight Rate Limiter              │
// │ EPIC-002-003.5: Production Readiness                        │
// └─────────────────────────────────────────────────────────────┘
//
// Sliding-window rate limiter suitable for Cloudflare Workers edge traffic
// (Telegram webhooks, future dashboard/API clients).
//
// DESIGN NOTES (read before relying on this in production):
//   - State lives in a module-level Map, i.e. per-isolate memory. Workers
//     isolates are ephemeral (cold starts wipe state). This means the limiter
//     is APPROXIMATE: under scale-out it throttles aggressively within a single
//     isolate but does not provide a hard global cap across all isolates.
//   - For a hard global cap, front this with Cloudflare's built-in
//     per-IP rate limiting (Zone → Speed → Rate Limiting) or a KV/DO-backed
//     counter. This middleware is the *first line* defense against abuse and
//     runaway retries, not the only one.
//   - Retry tolerance: the window is short (default 60s) with a generous burst
//     (default 60 requests) so legitimate Telegram webhook retries and brief
//     dashboard bursts are never falsely blocked.

import type { Env } from "../types/env.js";

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  /** Seconds until the oldest request in the window expires. */
  retryAfter: number;
}

interface Bucket {
  /** Timestamps (ms) of requests within the current window. */
  hits: number[];
}

const buckets = new Map<string, Bucket>();

// Default allowances — overridden per environment via env vars if present.
const DEFAULT_WINDOW_MS = 60_000; // 60s sliding window
const DEFAULT_LIMIT = 60; // requests per window (burst-tolerant for retries)

function windowMs(env?: Env): number {
  const v = env?.RATE_LIMIT_WINDOW_MS;
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_WINDOW_MS;
}

function limit(env?: Env): number {
  const v = env?.RATE_LIMIT_LIMIT;
  const n = v ? Number(v) : NaN;
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_LIMIT;
}

/**
 * Check + record a request for `key` (typically client IP or chat id).
 * Returns whether the request is allowed and headers to set on the response.
 */
export function rateLimit(
  key: string,
  env?: Env,
  now: number = Date.now(),
): RateLimitResult {
  const win = windowMs(env);
  const cap = limit(env);
  const cutoff = now - win;

  const bucket = buckets.get(key) ?? { hits: [] };
  // Drop hits outside the window.
  bucket.hits = bucket.hits.filter((t) => t > cutoff);

  if (bucket.hits.length >= cap) {
    const oldest = bucket.hits[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + win - now) / 1000));
    return { allowed: false, limit: cap, remaining: 0, retryAfter };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    limit: cap,
    remaining: cap - bucket.hits.length,
    retryAfter: 0,
  };
}

/** Standard rate-limit headers (RFC 6585 / 7231 style). */
export function rateLimitHeaders(r: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    ...(r.allowed ? {} : { "Retry-After": String(r.retryAfter) }),
  };
}

/** Client key from a request — prefers CF-Connecting-IP, falls back to host. */
export function clientKey(request: Request, env?: Env): string {
  const cfIp = request.headers.get("CF-Connecting-IP");
  if (cfIp) return `ip:${cfIp}`;
  const fwd = request.headers.get("X-Forwarded-For");
  if (fwd) return `ip:${fwd.split(",")[0].trim()}`;
  // Telegram webhooks always carry CF-Connecting-IP; this fallback covers
  // local/dev where it is absent.
  return `anon:${env?.ENVIRONMENT ?? "dev"}`;
}
