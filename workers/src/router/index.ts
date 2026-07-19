// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — API Router                            │
// │ Phase 1: Concierge Platform Foundation                     │
// │ EPIC-001-003: API Routing Foundation                       │
// └─────────────────────────────────────────────────────────────┘
//
// Lightweight, dependency-free router for Cloudflare Workers.
// Uses the native URLPattern API for path matching.
//
// Design principles:
//   - Zero external dependencies
//   - Method + path pattern → handler mapping
//   - Path parameters extracted via URLPattern named groups
//   - Returns 404 JSON for unmatched routes
//
// Usage:
//   import { Router } from "./router/index.js";
//   const router = new Router();
//   router.get("/api/v1/health", healthHandler);

import type { Env, RouteHandler } from "../types/env.js";

/** Internal route registration with compiled URLPattern */
interface Route {
  method: string;
  pattern: URLPattern;
  handler: RouteHandler;
}

export class Router {
  private routes: Route[] = [];

  /** Register a GET route */
  get(path: string, handler: RouteHandler): void {
    this.routes.push({
      method: "GET",
      pattern: new URLPattern({ pathname: path }),
      handler,
    });
  }

  /** Register a POST route */
  post(path: string, handler: RouteHandler): void {
    this.register("POST", path, handler);
  }

  /** Register a PATCH route (Operations API mutations) */
  patch(path: string, handler: RouteHandler): void {
    this.register("PATCH", path, handler);
  }

  /** Generic registration used by all method helpers. */
  private register(method: string, path: string, handler: RouteHandler): void {
    this.routes.push({
      method: method.toUpperCase(),
      pattern: new URLPattern({ pathname: path }),
      handler,
    });
  }

  /**
   * Route an incoming request to the matching handler.
   * Iterates registered routes in order; first match wins.
   * Returns 404 JSON if no route matches.
   */
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    for (const route of this.routes) {
      if (route.method !== request.method) continue;

      const match = route.pattern.exec({ pathname: url.pathname });
      if (match) {
        try {
          return await route.handler(request, env, match.pathname.groups);
        } catch (err) {
          // Global error catch — prevents unhandled exceptions
          // from crashing the Worker isolate
          const message =
            err instanceof Error ? err.message : "Internal server error";
          return new Response(
            JSON.stringify({ error: "Internal Server Error", message }),
            { status: 500, headers: { "Content-Type": "application/json" } },
          );
        }
      }
    }

    // No matching route found
    return new Response(
      JSON.stringify({
        error: "Not Found",
        message: `No route matches ${request.method} ${url.pathname}`,
      }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }
}