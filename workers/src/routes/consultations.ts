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

import type { RouteHandler } from "../types/env.js";
import { processConsultation } from "../services/consultationService.js";

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

  // ── Call service ───────────────────────────────────────────
  const result = await processConsultation(env.DB, body as Record<string, unknown>);

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