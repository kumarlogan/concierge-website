// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Consultations Route Handler           │
// │ Phase 1: Concierge Platform Foundation                     │
// │ EPIC-001-007: Consultation Workflow                        │
// └─────────────────────────────────────────────────────────────┘
//
// POST /api/v1/consultations
//
// Route handler responsibilities (HTTP concerns ONLY):
//  1. Parse JSON request body
//  2. Call the consultation service
//  3. Translate service result → HTTP response
//
// Business logic (validation, normalization, duplicate checking,
// database operations) lives in src/services/consultationService.ts.
//
// Architecture: Request → Route → Service → D1 → Response
//
// BOT PROTECTION (HIGH #7):
//  - Honeypot field (`fax`): if present and non-empty, silently ignore (bot)
//  - Cloudflare Turnstile: verify cf-turnstile-response token if configured

import type { RouteHandler } from "../types/env.js";
import { processConsultation } from "../services/consultationService.js";
import { verifyTurnstile } from "../middleware/turnstile.js";

export const createConsultation: RouteHandler = async (request, env, _params) => {
  // ── Parse JSON body ────────────────────────────────────────
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Request body must be valid JSON",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Reject non-object bodies (arrays, primitives) ──────────
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Request body must be a JSON object",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const data = body as Record<string, unknown>;

  // ── Honeypot field: silently reject bots ──────────────────
  // Bots often fill every visible field, including hidden ones.
  // The `fax` field is invisible to humans; if filled, this is a bot.
  if (data.fax && typeof data.fax === "string" && data.fax.trim().length > 0) {
    // Return a success response so bots think submission worked
    return new Response(
      JSON.stringify({
        success: true,
        message: "Consultation request received.",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Turnstile bot protection ───────────────────────────────
  // Verify the cf-turnstile-response token from the frontend.
  // If TURNSTILE_SECRET_KEY is not configured, verification is
  // silently skipped (development mode).
  const turnstileToken = data["cf-turnstile-response"] as string | undefined;
  const turnstileResult = await verifyTurnstile(
    turnstileToken,
    env.TURNSTILE_SECRET_KEY as string | undefined,
    request.headers.get("CF-Connecting-IP") || undefined,
  );
  if (!turnstileResult.success) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "captcha_required",
        message: "Bot verification failed. Please complete the captcha.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Call service ───────────────────────────────────────────
  const result = await processConsultation(env.DB, data);

  // ── Translate to HTTP response ─────────────────────────────
  if (result.success) {
    return new Response(
      JSON.stringify({
        success: true,
        lead_id: result.lead_id,
        status: result.status,
        message: "Consultation request received.",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // Error response — use the status code from the service
  return new Response(
    JSON.stringify({
      success: false,
      error: result.error,
      message: result.message,
    }),
    {
      status: result.status,
      headers: { "Content-Type": "application/json" },
    },
  );
};