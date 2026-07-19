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

  // R2 storage binding — will be added in Phase 2
  // STORAGE: R2Bucket;

  // Environment variable injected by wrangler per environment
  ENVIRONMENT?: string;

  // Service version (overrides the in-code default when set)
  SERVICE_VERSION?: string;

  // Rate limiting (optional overrides; sensible defaults if absent)
  RATE_LIMIT_WINDOW_MS?: string;
  RATE_LIMIT_LIMIT?: string;
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