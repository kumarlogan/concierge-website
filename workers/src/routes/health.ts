// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Health Route Handler                  │
// │ EPIC-001-004 (base) + EPIC-002-003.5 (expanded)             │
// └─────────────────────────────────────────────────────────────┘
//
// GET /api/v1/health
//
// Operational readiness check. Expanded for production readiness to include:
//   - database connectivity   (live SELECT 1 against the D1 binding)
//   - migration status/version (highest applied migration in d1_migrations)
//   - environment             (env.ENVIRONMENT)
//   - service version         (SERVICE_VERSION constant / env override)
//
// SECURITY: This endpoint intentionally exposes NO secrets, tokens, DSNs,
// internal IPs, or sensitive operational detail. The migration version is a
// non-sensitive build/ops signal safe to surface to authenticated monitors.

import type { RouteHandler, Env } from "../types/env.js";
import { info } from "../middleware/logger.js";

/** Service version — bump on each deploy (also overridable via SERVICE_VERSION env). */
const SERVICE_VERSION = "1.3.0";

function resolveVersion(env?: Env): string {
  // Prefer the deployed env override; fall back to the build constant.
  return env?.SERVICE_VERSION && env.SERVICE_VERSION.length > 0
    ? env.SERVICE_VERSION
    : SERVICE_VERSION;
}

interface HealthResponse {
  status: "healthy" | "degraded";
  service: "agsynergy-api";
  version: string;
  environment: string;
  timestamp: string;
  database: {
    connected: boolean;
    /** Highest applied migration version (0 if none / unknown). */
    migrationVersion: number;
    /** Number of applied migrations. */
    migrationCount: number;
  };
}

export const health: RouteHandler = async (_request, env, _params) => {
  const environment = env.ENVIRONMENT || "development";
  const timestamp = new Date().toISOString();

  let dbConnected = false;
  let migrationVersion = 0;
  let migrationCount = 0;

  try {
    // Liveness probe — cheap, no business data touched.
    await env.DB.prepare("SELECT 1").first();
    dbConnected = true;

    // Migration tracking — d1_migrations is wrangler's applied-migrations table.
    const row = (await env.DB.prepare(
      "SELECT MAX(id) AS v, COUNT(*) AS c FROM d1_migrations",
    ).first()) as { v: number | null; c: number | null } | null;

    migrationVersion = row?.v ?? 0;
    migrationCount = row?.c ?? 0;
  } catch (err) {
    // DB unreachable — report degraded, do NOT leak the error text.
    info("health: database check failed", { environment }, environment);
  }

  const status: HealthResponse["status"] = dbConnected ? "healthy" : "degraded";

  const body: HealthResponse = {
    status,
    service: "agsynergy-api",
    version: resolveVersion(env),
    environment,
    timestamp,
    database: {
      connected: dbConnected,
      migrationVersion,
      migrationCount,
    },
  };

  return new Response(JSON.stringify(body), {
    status: status === "healthy" ? 200 : 503,
    headers: { "Content-Type": "application/json" },
  });
};
