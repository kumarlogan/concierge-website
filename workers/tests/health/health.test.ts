// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Health Endpoint Unit Tests            │
// │ EPIC-001-008: Testing Foundation                            │
// │ EPIC-002-003.5: expanded health contract                    │
// └─────────────────────────────────────────────────────────────┘
//
// Tests for GET /api/v1/health
//
// The health handler resolves DB connectivity via env.DB. In this pure unit
// context there is no Workers runtime / D1, so env.DB is a stub that throws on
// .prepare() — exercising the DEGRADED path. The healthy path (DB connected)
// is covered by the integration test under tests/integration/api.test.ts,
// which runs against a real Miniflare D1 binding.

import { describe, it, expect } from "vitest";
import { health } from "../../src/routes/health.js";
import type { Env } from "../../src/types/env.js";

// ── Helpers ──────────────────────────────────────────────────

function makeEnv(environment?: string, db?: unknown): Env {
  return {
    DB: (db ?? {}) as D1Database,
    ENVIRONMENT: environment,
  } as Env;
}

function makeRequest(): Request {
  return new Request("https://api.agsynergy.ca/api/v1/health");
}

// A D1 stub whose prepare() throws — simulates DB unreachable.
const unreachableDb = {
  prepare: () => {
    throw new Error("simulated DB down");
  },
};

// ── Tests ────────────────────────────────────────────────────

describe("Health Endpoint — degraded path (unit, no runtime)", () => {
  describe("GET /api/v1/health", () => {
    it("returns 503 when database is unreachable", async () => {
      const response = await health(
        makeRequest(),
        makeEnv("production", unreachableDb),
        {},
      );
      expect(response.status).toBe(503);
    });

    it("reports status 'degraded' when DB is down", async () => {
      const response = await health(
        makeRequest(),
        makeEnv("production", unreachableDb),
        {},
      );
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.status).toBe("degraded");
    });

    it("reports service name 'agsynergy-api'", async () => {
      const response = await health(makeRequest(), makeEnv(), {});
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.service).toBe("agsynergy-api");
    });

    it("reports version '1.3.0' (canonical build version)", async () => {
      const response = await health(makeRequest(), makeEnv(), {});
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.version).toBe("1.3.0");
    });

    it("reads environment from ENVIRONMENT binding", async () => {
      const response = await health(makeRequest(), makeEnv("production"), {});
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.environment).toBe("production");
    });

    it("defaults environment to 'development' when not set", async () => {
      const response = await health(makeRequest(), makeEnv(undefined), {});
      const body = (await response.json()) as Record<string, unknown>;
      expect(body.environment).toBe("development");
    });

    it("includes an ISO 8601 timestamp", async () => {
      const response = await health(makeRequest(), makeEnv(), {});
      const body = (await response.json()) as Record<string, unknown>;
      const timestamp = body.timestamp as string;
      expect(timestamp).toBeDefined();
      expect(new Date(timestamp).toISOString()).toBe(timestamp);
    });

    it("exposes non-sensitive database status block (no secrets)", async () => {
      const response = await health(makeRequest(), makeEnv(), {});
      const body = (await response.json()) as Record<string, unknown>;
      expect(body).toHaveProperty("database");
      const db = body.database as Record<string, unknown>;
      // Shape check — declarative, no values that could leak infra.
      expect(db).toHaveProperty("connected");
      expect(db).toHaveProperty("migrationVersion");
      expect(db).toHaveProperty("migrationCount");
      expect(typeof db.connected).toBe("boolean");
      expect(typeof db.migrationVersion).toBe("number");
      expect(typeof db.migrationCount).toBe("number");
    });

    it("reports database.connected false when DB unreachable", async () => {
      const response = await health(
        makeRequest(),
        makeEnv("production", unreachableDb),
        {},
      );
      const body = (await response.json()) as Record<string, unknown>;
      const db = body.database as Record<string, unknown>;
      expect(db.connected).toBe(false);
    });
  });

  describe("Response shape completeness", () => {
    it("contains the required top-level fields", async () => {
      const response = await health(makeRequest(), makeEnv(), {});
      const body = (await response.json()) as Record<string, unknown>;
      const keys = Object.keys(body).sort();
      expect(keys).toEqual([
        "database",
        "environment",
        "service",
        "status",
        "timestamp",
        "version",
      ]);
    });
  });
});
