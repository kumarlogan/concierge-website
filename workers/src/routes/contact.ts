// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Contact Form Route Handler            │
// │ Workstream D: Business Activation                           │
// └─────────────────────────────────────────────────────────────┘
//
// POST /api/v1/contact
//
// Stores contact form submissions (name, email, phone, message)
// to D1 database. Returns a 201 on success.
//
// Architecture: Request → Route → D1 → Response

import type { RouteHandler } from "../types/env.js";

interface ContactBody {
  name: string;
  email: string;
  phone: string;
  message?: string;
}

function isContactBody(obj: unknown): obj is ContactBody {
  if (typeof obj !== "object" || obj === null) return false;
  const o = obj as Record<string, unknown>;
  return (
    typeof o.name === "string" &&
    o.name.length >= 1 &&
    typeof o.email === "string" &&
    o.email.length >= 1 &&
    typeof o.phone === "string" &&
    o.phone.length >= 1
  );
}

export const handleContact: RouteHandler = async (request, env, _params) => {
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

  // ── Validate required fields ───────────────────────────────
  if (!isContactBody(body)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Required fields: name, email, phone. All must be non-empty strings.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const { name, email, phone, message } = body;

  // Basic email format check
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return new Response(
      JSON.stringify({
        success: false,
        error: "validation_error",
        message: "Invalid email format.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  // ── Store in D1 ────────────────────────────────────────────
  try {
    const result = await env.DB.prepare(
      `INSERT INTO contact_submissions (name, email, phone, message, created_at)
       VALUES (?, ?, ?, ?, datetime('now'))`,
    )
      .bind(name, email, phone, message || null)
      .run();

    return new Response(
      JSON.stringify({
        success: true,
        id: result.meta?.last_row_id ?? null,
        message: "Thank you! Your message has been received. We will be in touch soon.",
      }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({
        success: false,
        error: "server_error",
        message: "Failed to store submission. Please try again later.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};