// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Cloudflare Workers API                │
// │ Phase 1: Concierge Platform Foundation                     │
// │ EPIC-001-003: API Routing Foundation                       │
// └─────────────────────────────────────────────────────────────┘
//
// Worker entry point. This file is intentionally thin:
//   1. Instantiate the router
//   2. Register API routes
//   3. Export the fetch handler
//
// Architecture: Request → Router → Route Handler → Response
//
// All route logic lives in src/routes/.
// All shared service logic lives in src/services/.
// Global concerns (CORS, logging, error handling) live in src/middleware/.
//
// Do NOT add business logic to this file.

import { Router } from "./router/index.js";
import { health } from "./routes/health.js";
import { createConsultation } from "./routes/consultations.js";
import type { Env } from "./types/env.js";
import { rateLimit, rateLimitHeaders, clientKey } from "./middleware/rateLimit.js";
import { info, warn } from "./middleware/logger.js";

// ── Operations API (EPIC-002-003A) ──────────────────────────
import { requirePermission } from "@hermes/permissions/middleware.js";
import {
  listOpsLeads,
  listMyLeads,
  getOpsLead,
  patchOpsLead,
  assignOpsLead,
  getOpsDashboard,
  getOpsTimeline,
  attachPrincipal,
  type OpsPrincipal,
} from "./routes/ops.js";

// ── Router instantiation ────────────────────────────────────
const router = new Router();

// ── API v1 routes ───────────────────────────────────────────
router.get("/api/v1/health", health);
router.post("/api/v1/consultations", createConsultation);

// ── Operations API route registration ──────────────────────
// Each route is wrapped with requirePermission (data-driven RBAC from the auth
// engine) and attaches the resolved Principal so handlers can read actingUserId
// without re-resolving identity. Authorization lives ONLY here + in the auth
// middleware — never in the service layer (ADR-003).
function opsRoute(
  method: "get" | "post" | "patch",
  path: string,
  permission: string,
  handler: (request: Request, env: Env, params: Record<string, string>) => Response | Promise<Response>,
): void {
  const wrapped: typeof handler = async (request, env, params) => {
    const result = await requirePermission(env.DB, request, permission);
    if (!result.authorized) return result.response;
    const principal: OpsPrincipal = {
      userId: result.principal.userId,
      roleName: result.principal.roleName,
    };
    attachPrincipal(request, principal);
    return handler(request, env, params);
  };
  if (method === "get") router.get(path, wrapped);
  else if (method === "post") router.post(path, wrapped);
  else router.patch(path, wrapped);
}

opsRoute("get", "/api/v1/ops/leads", "leads.read", listOpsLeads);
opsRoute("get", "/api/v1/ops/leads/mine", "leads.read", listMyLeads);
opsRoute("get", "/api/v1/ops/leads/:id", "leads.read", getOpsLead);
opsRoute("patch", "/api/v1/ops/leads/:id", "leads.update", patchOpsLead);
opsRoute("post", "/api/v1/ops/leads/:id/assign", "leads.assign", assignOpsLead);
opsRoute("get", "/api/v1/ops/dashboard", "leads.read", getOpsDashboard);
opsRoute("get", "/api/v1/ops/timeline", "leads.read", getOpsTimeline);

// ── Operations Telegram Bot (MVP) ──────────────────────────
// Thin Telegram client over the Operations API. Inbound Telegram Updates
// are parsed here, framed with the same identity headers the HTTP API uses,
// and dispatched to the existing Ops handlers — so all RBAC + audit flows
// through the exact same engine. No business logic lives in the bot.
import { telegramWebhook } from "./routes/telegram.js";
router.post("/telegram/webhook", (request, env, _params) =>
  telegramWebhook(request, env, _params),
);

// ── Catch-all for non-API requests ──────────────────────────
// Handles any request that doesn't match an /api/v1/ route.
// The router itself returns 404 for unmatched /api/v1/* paths;
// this fallback handles completely different paths.
router.get("*", (_request, _env, _params) => {
  return new Response(
    JSON.stringify({
      error: "Not Found",
      message:
        "This Worker serves the AG Synergy API. See /api/v1/health for status.",
    }),
    {
      status: 404,
      headers: { "Content-Type": "application/json" },
    },
  );
});

// ── Export ──────────────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const environment = env.ENVIRONMENT || "development";
    const started = Date.now();

    // ── Structured request logging (no bodies, no PII) ─────────
    const url = new URL(request.url);
    info(
      "request.start",
      { method: request.method, path: url.pathname },
      environment,
    );

    // ── Lightweight rate limiting (per-IP, retry-tolerant) ─────
    const rl = rateLimit(clientKey(request, env), env);
    if (!rl.allowed) {
      warn(
        "rate_limit.exceeded",
        { path: url.pathname, limit: rl.limit, retryAfter: rl.retryAfter },
        environment,
      );
      return new Response(
        JSON.stringify({
          error: "Too Many Requests",
          message: "Rate limit exceeded. Retry after the indicated delay.",
        }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            ...rateLimitHeaders(rl),
          },
        },
      );
    }

    // ── CORS: allow requests from the website origin ─────────
    const origin = request.headers.get("Origin");
    const allowedOrigins = [
      "https://agsynergy.ca",
      "https://www.agsynergy.ca",
      "http://localhost:5173", // dev
      "http://localhost:23815", // artifact dev
    ];
    const isAllowed = origin && allowedOrigins.includes(origin);

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": isAllowed ? origin : "",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = await router.fetch(request, env);

    // Add CORS headers to the actual response
    const headers = new Headers(response.headers);
    if (isAllowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    // Propagate rate-limit headers on every response.
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) {
      headers.set(k, v);
    }

    const latencyMs = Date.now() - started;
    info(
      "request.complete",
      {
        method: request.method,
        path: url.pathname,
        status: response.status,
        latencyMs,
      },
      environment,
    );

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};