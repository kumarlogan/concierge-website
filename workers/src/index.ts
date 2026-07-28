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
import { handleContact } from "./routes/contact.js";
import type { Env } from "./types/env.js";
import { rateLimit, rateLimitHeaders, clientKey } from "./middleware/rateLimit.js";
import { info, warn } from "./middleware/logger.js";
// P0 fix: coerce `undefined` bind values → null before they reach D1
// (real D1 rejects undefined; the local test stub does not). See platform/d1.ts.
import { createSafeD1 } from "./platform/d1.js";

// ── Security Headers (Wave 8.1) ──────────────────────────
import { applySecurityHeaders } from "./middleware/security-headers.js";

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
router.post("/api/v1/contact", handleContact);

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

// ── Hermes Admin Bot (EPIC-002-005) ──────────────────────────
import { adminWebhook } from "./routes/adminBot.js";
import { registerTrustRuntimeRoutes } from "./routes/trustRuntime.js";
router.post("/admin/webhook", (request, env, _params) =>
  adminWebhook(request, env, _params),
);

registerTrustRuntimeRoutes(router);

// ── Document Upload API routes (Wave 6 — Secure Document Upload) ────────
import { registerDocumentRoutes } from "./routes/documents.js";
registerDocumentRoutes(router);

// ── Wave 7: Appointment Management & Messaging ────────
import { registerAppointmentRoutes, registerMessageRoutes } from "./routes/wave7.js";
registerAppointmentRoutes(router);
registerMessageRoutes(router);

// ── Workstream A: Timeline Routes ─────────────────────
import { registerTimelineRoutes } from "./routes/timeline.js";
registerTimelineRoutes(router);

// ── Workstream B: Clinic Routes ──────────────────────────────
import { registerClinicRoutes } from "./routes/clinic.js";
import { registerCoordinationRoutes } from "./routes/coordination.js";
import { registerClinicMessageRoutes } from "./routes/clinic-messages.js";
registerClinicRoutes(router);
registerCoordinationRoutes(router);
registerClinicMessageRoutes(router);

// ── Identity API routes (Wave 3 — Identity Core) ────────────────
// Bridge between the Worker's RouteHandler signature and
// the IdentityRouter.route() interface.
// Each /identity/* path is handled by the IdentityRouter class.
import { IdentityRouter, IdentityService, IdentityRepository, SessionManager, PasswordManager, JwtManager, IdentityProviderRegistry, RefreshTokenManager, EmailVerificationManager, PasswordResetManager, MagicLinkManager, OAuthService, MFAManager } from "./platform/identity/index.js";

// Identity router instance — lazily initialised
let _identityRouter: IdentityRouter | null = null;

function getIdentityRouter(env: Env): IdentityRouter {
  if (_identityRouter) return _identityRouter;

  // Build the full dependency chain
  const db = env.DB;
  const repo = new IdentityRepository(db);
  const sessions = new SessionManager(repo);
  const passwords = new PasswordManager();
  const jwt = new JwtManager();
  const providers = new IdentityProviderRegistry(repo);
  const refreshTokens = new RefreshTokenManager(repo);
  const identityService = new IdentityService(repo, sessions, passwords, jwt, providers, refreshTokens);
  const emailVerification = new EmailVerificationManager(repo);
  const passwordReset = new PasswordResetManager(repo, passwords);
  const magicLink = new MagicLinkManager(repo, sessions, jwt, refreshTokens);
  const oauth = new OAuthService(repo, sessions, jwt, refreshTokens, providers);
  const mfa = new MFAManager(repo);

  _identityRouter = new IdentityRouter(
    identityService,
    emailVerification,
    passwordReset,
    magicLink,
    oauth,
    mfa,
    jwt,
    providers,
  );

  return _identityRouter;
}

async function handleIdentityRequest(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  let body: Record<string, unknown> = {};
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/json") && (method === "POST" || method === "PATCH" || method === "PUT")) {
    try { body = await request.json(); } catch { /* empty body */ }
  }

  const headers: Record<string, string> = {};
  request.headers.forEach((v, k) => { headers[k] = v; });

  const router = getIdentityRouter(env);
  const result = await router.route(method, path, body, headers, env as any);

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { "Content-Type": "application/json" },
  });
}

// Register a single catch-all for identity routes
router.post("/identity/*", handleIdentityRequest);
router.get("/identity/*", handleIdentityRequest);

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
    // P0 fix (Wave 8.1 hardening): wrap DB so no `undefined` bind reaches
    // real D1. The router + all services/handlers receive the wrapped env.
    const safeEnv: Env = { ...env, DB: createSafeD1(env.DB) };
    const environment = safeEnv.ENVIRONMENT || "development";
    const started = Date.now();

    // ── Structured request logging (no bodies, no PII) ─────────
    const url = new URL(request.url);
    info(
      "request.start",
      { method: request.method, path: url.pathname },
      environment,
    );

    // ── Lightweight rate limiting (per-IP, retry-tolerant) ─────
    const rl = rateLimit(clientKey(request, safeEnv), safeEnv);
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
          "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    const response = await router.fetch(request, safeEnv);

    // Add CORS + security headers to the actual response
    let headers = new Headers(response.headers);
    if (isAllowed) {
      headers.set("Access-Control-Allow-Origin", origin);
      headers.set("Vary", "Origin");
    }
    // Propagate CORS methods on non-preflight responses
    headers.set("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

    // Propagate rate-limit headers on every response.
    for (const [k, v] of Object.entries(rateLimitHeaders(rl))) {
      headers.set(k, v);
    }

    let finalResponse = new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });

    // Apply security headers (HSTS, CSP, X-Frame-Options, etc.)
    finalResponse = applySecurityHeaders(finalResponse);

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

    return finalResponse;
  },
};