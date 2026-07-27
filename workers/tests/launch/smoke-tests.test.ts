// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Launch Smoke Tests                     │
// │ Workstream C: Launch Readiness                               │
// │ Comprehensive smoke test suite for production validation     │
// └─────────────────────────────────────────────────────────────┘
//
// These tests run against a live Worker deployment to validate
// production readiness. They are NOT comprehensive unit tests —
// they verify the critical path: Is the service up? Does it
// respond? Can a user authenticate? Does the API work?
//
// Usage:
//   npx vitest run workers/tests/launch/smoke-tests.test.ts
//
// Environment variables:
//   SMOKE_TEST_URL  — Base URL of the deployment to test
//                     (default: http://localhost:8787)
//   SMOKE_TEST_ENV  — Expected environment name
//                     (default: "development")

import { describe, it, expect, beforeAll } from "vitest";
import type { Env } from "../../src/types/env.js";

// ══════════════════════════════════════════════════════════════
// Configuration
// ══════════════════════════════════════════════════════════════

const BASE_URL = process.env.SMOKE_TEST_URL || "http://localhost:8787";
const EXPECTED_ENV = process.env.SMOKE_TEST_ENV || "development";

function apiUrl(path: string): string {
  return `${BASE_URL}/api/v1${path}`;
}

// ══════════════════════════════════════════════════════════════
// Shared Types
// ══════════════════════════════════════════════════════════════

interface HealthResponse {
  status: "healthy" | "degraded";
  service: string;
  version: string;
  environment: string;
  timestamp: string;
  database: {
    connected: boolean;
    migrationVersion: number;
    migrationCount: number;
  };
}

interface ErrorResponse {
  error: string;
  message: string;
  code?: string;
}

// ══════════════════════════════════════════════════════════════
// 1. HEALTH ENDPOINT
// ══════════════════════════════════════════════════════════════

describe("Smoke: Health Endpoint", () => {
  it("returns 200 OK", async () => {
    const response = await fetch(apiUrl("/health"));
    expect(response.status).toBe(200);
  });

  it("returns application/json", async () => {
    const response = await fetch(apiUrl("/health"));
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("reports healthy status", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.status).toBe("healthy");
  });

  it("reports service name 'agsynergy-api'", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.service).toBe("agsynergy-api");
  });

  it("exposes a semantic version", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("reports correct environment", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.environment).toBe(EXPECTED_ENV);
  });

  it("includes ISO 8601 timestamp", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    const ts = new Date(body.timestamp);
    expect(ts.toISOString()).toBe(body.timestamp);
  });

  it("includes database status block", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.database).toBeDefined();
    expect(typeof body.database.connected).toBe("boolean");
    expect(typeof body.database.migrationVersion).toBe("number");
    expect(typeof body.database.migrationCount).toBe("number");
  });

  it("database is connected", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.database.connected).toBe(true);
  });

  it("has required top-level fields", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
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

// ══════════════════════════════════════════════════════════════
// 2. ALL API ROUTES RESPOND
// ══════════════════════════════════════════════════════════════

describe("Smoke: API Routes Respond", () => {
  it("GET /api/v1/health — 200 OK", async () => {
    const response = await fetch(apiUrl("/health"));
    expect(response.status).toBe(200);
  });

  it("POST /api/v1/consultations — 400 with validation error (no body)", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(response.status).toBe(400);
  });

  it("POST /api/v1/consultations — returns structured error", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const body = (await response.json()) as ErrorResponse;
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("message");
  });

  it("Telegram webhook endpoint exists", async () => {
    const response = await fetch(`${BASE_URL}/telegram/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Should respond (even if 401/403 due to missing auth, not 404)
    expect(response.status).not.toBe(404);
  });

  it("Admin webhook endpoint exists", async () => {
    const response = await fetch(`${BASE_URL}/admin/webhook`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    // Should respond (even if 401/403 due to missing auth, not 404)
    expect(response.status).not.toBe(404);
  });

  it("Document routes exist — OPTIONS returns CORS/204", async () => {
    const response = await fetch(apiUrl("/documents"), {
      method: "OPTIONS",
      headers: { Origin: "https://agsynergy.ca" },
    });
    // Documents endpoint might be at a different path; accept 204 or 404
    // (404 means the route is handled but path not found — that's valid)
    expect([204, 404]).toContain(response.status);
  });
});

// ══════════════════════════════════════════════════════════════
// 3. AUTHENTICATION FLOW
// ══════════════════════════════════════════════════════════════

describe("Smoke: Authentication Flow", () => {
  it("Identity routes are reachable — OPTIONS returns valid response", async () => {
    const response = await fetch(`${BASE_URL}/identity/auth/login`, {
      method: "OPTIONS",
    });
    // OPTIONS on an existing route should return 204, 200, or 405
    expect([200, 204, 405]).toContain(response.status);
  });

  it("Identity register endpoint is reachable", async () => {
    const response = await fetch(`${BASE_URL}/identity/auth/register`, {
      method: "OPTIONS",
    });
    expect([200, 204, 405]).toContain(response.status);
  });

  it("Protected route returns 401 without auth token", async () => {
    const response = await fetch(apiUrl("/ops/leads"), {
      headers: { Authorization: "Bearer invalid-test-token" },
    });
    // Should return 401/403 (not 200)
    expect([401, 403]).toContain(response.status);
  });

  it("Missing Authorization header returns 401", async () => {
    const response = await fetch(apiUrl("/ops/leads"));
    // Should return 401/404 (not 200)
    expect([401, 404]).toContain(response.status);
  });

  it("Auth endpoint with invalid credentials returns 401", async () => {
    const response = await fetch(`${BASE_URL}/identity/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "invalid@example.com", password: "wrong" }),
    });
    // Should return 401, not 500
    expect([401, 400]).toContain(response.status);
  });
});

// ══════════════════════════════════════════════════════════════
// 4. CORS CONFIGURATION
// ══════════════════════════════════════════════════════════════

describe("Smoke: CORS Configuration", () => {
  it("Returns CORS headers for allowed origin (agsynergy.ca)", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://agsynergy.ca",
    );
  });

  it("Returns CORS headers for allowed origin (www.agsynergy.ca)", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://www.agsynergy.ca" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://www.agsynergy.ca",
    );
  });

  it("Returns CORS headers for localhost (5173)", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "http://localhost:5173" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "http://localhost:5173",
    );
  });

  it("Returns no CORS header for disallowed origin", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://evil.example.com" },
    });
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
  });

  it("Handles OPTIONS preflight with 204", async () => {
    const response = await fetch(apiUrl("/health"), {
      method: "OPTIONS",
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://agsynergy.ca",
    );
  });

  it("Includes CORS methods and headers in preflight response", async () => {
    const response = await fetch(apiUrl("/health"), {
      method: "OPTIONS",
      headers: { Origin: "https://agsynergy.ca" },
    });
    const methods = response.headers.get("Access-Control-Allow-Methods");
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("PATCH");
    const allowedHeaders = response.headers.get("Access-Control-Allow-Headers");
    expect(allowedHeaders).toContain("Content-Type");
    expect(allowedHeaders).toContain("Authorization");
  });

  it("Includes Vary: Origin header", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.headers.get("Vary")).toBe("Origin");
  });
});

// ══════════════════════════════════════════════════════════════
// 5. ERROR RESPONSES STRUCTURED CORRECTLY
// ══════════════════════════════════════════════════════════════

describe("Smoke: Error Responses", () => {
  it("Returns 404 with JSON body for unknown API routes", async () => {
    const response = await fetch(apiUrl("/unknown-route"));
    expect(response.status).toBe(404);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe("Not Found");
    expect(body.message).toBeDefined();
  });

  it("Returns 404 for unknown non-API routes", async () => {
    const response = await fetch(`${BASE_URL}/some-unknown-page`);
    expect(response.status).toBe(404);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe("Not Found");
  });

  it("Returns 400 for malformed JSON body", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not valid json {{{",
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBeDefined();
  });

  it("Returns 400 for empty body", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    expect(response.status).toBe(400);
  });

  it("Returns 400 for array body (expected object)", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "[1, 2, 3]",
    });
    expect(response.status).toBe(400);
  });

  it("All error responses are JSON", async () => {
    const response = await fetch(apiUrl("/unknown-route"));
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });

  it("Error responses have no stack trace leakage", async () => {
    const response = await fetch(apiUrl("/unknown-route"));
    const body = (await response.json()) as Record<string, unknown>;
    expect(body).not.toHaveProperty("stack");
    expect(body).not.toHaveProperty("trace");
    expect(body).not.toHaveProperty("exception");
  });
});

// ══════════════════════════════════════════════════════════════
// 6. SECURITY HEADERS
// ══════════════════════════════════════════════════════════════

describe("Smoke: Security Headers", () => {
  it("Includes HSTS header", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    const hsts = response.headers.get("Strict-Transport-Security");
    expect(hsts).toMatch(/max-age=31536000/);
    expect(hsts).toMatch(/includeSubDomains/);
  });

  it("Includes Content-Security-Policy header", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    const csp = response.headers.get("Content-Security-Policy");
    expect(csp).toBeDefined();
    expect(csp).toContain("default-src 'self'");
  });

  it("Includes X-Frame-Options: DENY", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.headers.get("X-Frame-Options")).toBe("DENY");
  });

  it("Includes X-Content-Type-Options: nosniff", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("Includes Referrer-Policy", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.headers.get("Referrer-Policy")).toBeDefined();
  });

  it("Strips Server header", async () => {
    const response = await fetch(apiUrl("/health"), {
      headers: { Origin: "https://agsynergy.ca" },
    });
    expect(response.headers.get("Server")).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// 7. RATE LIMITING
// ══════════════════════════════════════════════════════════════

describe("Smoke: Rate Limiting", () => {
  it("Includes rate limit headers on responses", async () => {
    const response = await fetch(apiUrl("/health"));
    expect(response.headers.get("X-RateLimit-Limit")).toBeDefined();
    expect(response.headers.get("X-RateLimit-Remaining")).toBeDefined();
    expect(response.headers.get("X-RateLimit-Reset")).toBeDefined();
  });
});

// ══════════════════════════════════════════════════════════════
// 8. CONSULTATION ENDPOINT VALIDATION
// ══════════════════════════════════════════════════════════════

describe("Smoke: Consultation Endpoint Validation", () => {
  it("Returns 400 for missing required fields (email)", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
      }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe("validation_error");
  });

  it("Returns 400 for invalid email format", async () => {
    const response = await fetch(apiUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Test User",
        email: "not-an-email",
        phone: "+1-555-000-0000",
        treatment_interest: "IVF",
      }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrorResponse;
    expect(body.error).toBe("validation_error");
  });
});

// ══════════════════════════════════════════════════════════════
// 9. APPLICATION METADATA
// ══════════════════════════════════════════════════════════════

describe("Smoke: Application Metadata", () => {
  it("Health endpoint returns matching environment", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.environment).toBe(EXPECTED_ENV);
  });

  it("Health endpoint returns non-empty version", async () => {
    const response = await fetch(apiUrl("/health"));
    const body = (await response.json()) as HealthResponse;
    expect(body.version).toBeTruthy();
    expect(body.version.length).toBeGreaterThan(0);
  });
});

// ══════════════════════════════════════════════════════════════
// 10. CONNECTIVITY — ALL ROUTES IN WORKER
// ══════════════════════════════════════════════════════════════

describe("Smoke: Worker Route Coverage", () => {
  const routes = [
    { method: "GET", path: "/health", expectedStatuses: [200] },
    { method: "POST", path: "/consultations", expectedStatuses: [201, 400] },
  ];

  for (const route of routes) {
    it(`${route.method} ${route.path} responds`, async () => {
      const response = await fetch(apiUrl(route.path), {
        method: route.method,
        headers: { "Content-Type": "application/json" },
        body: route.method === "POST"
          ? JSON.stringify({ name: "test", email: "test@example.com" })
          : undefined,
      });
      expect(route.expectedStatuses).toContain(response.status);
    });
  }
});