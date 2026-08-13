// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Shared TypeScript Types               │
// │ Phase 1: Concierge Platform Foundation                     │
// └─────────────────────────────────────────────────────────────┘
//
// Central type definitions shared across the Worker.
// All route handlers, services, and middleware import from here.

/**
 * Worker environment bindings.
 * Extend this interface as new bindings are added
 * (D1, R2, KV, secrets, etc.).
 */
export interface Env {
  // D1 database binding — EPIC-001-005
  DB: D1Database;

  // D1 notifications binding — Wave 7: Notification & Engagement Platform
  NOTIFICATIONS: D1Database;

  // R2 storage binding — Wave 6: Secure Document Upload
  DOCUMENT_STORAGE: R2Bucket;

  // Document Service bindings — Wave 6
  DOCUMENT_SERVICE: any;
  DOCUMENT_CONSENT_INTEGRATION: any;
  DOCUMENT_AUDIT: any;
  DOCUMENT_ENCRYPTION: any;
  DOCUMENT_POLICY_INTEGRATION: any;

  // Environment variable injected by wrangler per environment
  ENVIRONMENT?: string;

  // Rate limiting (optional overrides; sensible defaults if absent)
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_LIMIT?: string;

  // Cloudflare Turnstile secret key — bot protection for public endpoints
  TURNSTILE_SECRET_KEY?: string;

  // JWT signing keypair — provisioned as GH secrets → wrangler vars
  JWT_PRIVATE_KEY?: string;
  JWT_PUBLIC_KEY?: string;
  JWT_KID?: string;
  PLATFORM_JWT_PUBLIC_KEY?: string;
  PLATFORM_JWT_KID?: string;

  // Email provider secrets (EPIC-016/017) — required for EmailService
  RESEND_API_KEY?: string;
  EMAIL_FROM?: string;
  FRONTEND_URL?: string;

  // Trust Runtime bindings — Phase 2, Wave 4
  POLICY_ENGINE: any;
  CONSENT_ENGINE: any;
  TRUST_ENGINE: any;
  RISK_ENGINE: any;
  DELEGATION_ENGINE: any;
  AUTHORIZATION_ENGINE: any;
  EVENT_BUS: any;
  DECISION_ENGINE: any;
}

/**
 * Route handler function signature.
 * Receives the raw request, environment bindings, and
 * any path parameters extracted by the router.
 */
export type RouteHandler = (
  request: Request,
  env: Env,
  params: Record<string, string>,
) => Response | Promise<Response>;