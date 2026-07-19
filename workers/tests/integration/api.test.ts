// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — API Integration Tests                 │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘
//
// Integration tests: Worker → Service → D1 (local Miniflare).
//
// These run inside the Workers runtime via @cloudflare/vitest-pool-workers.
// `exports` gives access to the Worker's default export.
// `env` gives access to bindings (DB, ENVIRONMENT, etc.).

import { describe, it, expect, beforeAll } from "vitest";
import { env, exports } from "cloudflare:workers";

// ── Schema seed (runs once before all integration tests) ─────
// Miniflare creates a fresh D1 per test run — we need to
// apply the leads table schema used by the consultation workflow.

beforeAll(async () => {
  const ddl = `
    CREATE TABLE IF NOT EXISTS leads (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      email       TEXT NOT NULL,
      phone       TEXT,
      preferred_contact_method TEXT,
      treatment_interest TEXT,
      message     TEXT,
      status      TEXT NOT NULL DEFAULT 'new',
      created_at  TEXT NOT NULL,
      updated_at  TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);
    CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
  `;

  for (const stmt of ddl.split(";").map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
});

// ── Helpers ──────────────────────────────────────────────────

interface ApiSuccess {
  success: true;
  lead_id: string;
  status: string;
  message: string;
}

interface ApiError {
  success: false;
  error: string;
  message: string;
}

function makeUrl(path: string): string {
  return `https://test.local/api/v1${path}`;
}

async function postConsultation(body: Record<string, unknown>): Promise<{
  status: number;
  body: ApiSuccess | ApiError;
}> {
  const response = await exports.default.fetch(
    new Request(makeUrl("/consultations"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  );
  const json = (await response.json()) as ApiSuccess | ApiError;
  return { status: response.status, body: json };
}

async function fetchApi(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  return exports.default.fetch(
    new Request(makeUrl(path), init),
    env,
  );
}

// ══════════════════════════════════════════════════════════════
// HEALTH ENDPOINT INTEGRATION
// ══════════════════════════════════════════════════════════════

describe("GET /api/v1/health (integration)", () => {
  it("returns 200 with healthy status", async () => {
    const response = await fetchApi("/health");
    expect(response.status).toBe(200);

    const body = (await response.json()) as Record<string, unknown>;
    expect(body.status).toBe("healthy");
    expect(body.service).toBe("agsynergy-api");
    expect(body.version).toBe("1.3.0");
    expect(body).toHaveProperty("timestamp");
    expect(body).toHaveProperty("environment");
    // EPIC-002-003.5 expanded health contract.
    expect(body).toHaveProperty("database");
    const db = body.database as Record<string, unknown>;
    expect(db.connected).toBe(true);
    expect(typeof db.migrationVersion).toBe("number");
    expect(typeof db.migrationCount).toBe("number");
  });

  it("returns application/json", async () => {
    const response = await fetchApi("/health");
    expect(response.headers.get("Content-Type")).toBe("application/json");
  });
});

// ══════════════════════════════════════════════════════════════
// CONSULTATION WORKFLOW INTEGRATION
// ══════════════════════════════════════════════════════════════

describe("POST /api/v1/consultations (integration)", () => {
  const runId = Date.now().toString(36);

  // ── Happy path ─────────────────────────────────────────────

  it("creates a consultation and returns 201", async () => {
    const { status, body } = await postConsultation({
      name: "Integration Test",
      email: `integration-${runId}@example.com`,
      phone: "+1-555-111-2222",
      treatment_interest: "IVF Integration Test",
      message: "Full pipeline integration test",
    });

    expect(status).toBe(201);
    expect((body as ApiSuccess).success).toBe(true);
    expect((body as ApiSuccess).lead_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
    expect((body as ApiSuccess).status).toBe("new");
    expect((body as ApiSuccess).message).toBe("Consultation request received.");
  });

  it("optionally accepts a message field", async () => {
    const { status, body } = await postConsultation({
      name: "No Message Test",
      email: `no-msg-${runId}@example.com`,
      phone: "+1-555-333-4444",
      treatment_interest: "Egg Freezing",
    });

    expect(status).toBe(201);
    expect((body as ApiSuccess).success).toBe(true);
  });

  // ── Duplicate detection ────────────────────────────────────

  it("returns 409 for duplicate email", async () => {
    const email = `dup-${runId}@example.com`;

    // First submission — should succeed
    const first = await postConsultation({
      name: "Duplicate Test",
      email,
      phone: "+1-555-555-5555",
      treatment_interest: "ICSI",
    });
    expect(first.status).toBe(201);

    // Second submission — should be rejected
    const second = await postConsultation({
      name: "Duplicate Test Again",
      email,
      phone: "+1-555-666-6666",
      treatment_interest: "Surrogacy",
    });
    expect(second.status).toBe(409);
    expect((second.body as ApiError).success).toBe(false);
    expect((second.body as ApiError).error).toBe("duplicate_lead");
    expect((second.body as ApiError).message).toContain("already exists");
  });

  // ── Validation errors ──────────────────────────────────────

  it("returns 400 for missing required fields", async () => {
    const { status, body } = await postConsultation({
      name: "Missing Fields",
    });
    expect(status).toBe(400);
    expect((body as ApiError).error).toBe("validation_error");
    expect((body as ApiError).message).toContain("Missing required field");
  });

  it("returns 400 for invalid email format", async () => {
    const { status, body } = await postConsultation({
      name: "Bad Email",
      email: "this-is-not-valid",
      phone: "123",
      treatment_interest: "IVF",
    });
    expect(status).toBe(400);
    expect((body as ApiError).error).toBe("validation_error");
    expect((body as ApiError).message).toContain("email");
  });

  it("returns 400 for empty string fields", async () => {
    const { status, body } = await postConsultation({
      name: "   ",
      email: "test@example.com",
      phone: "555",
      treatment_interest: "IVF",
    });
    expect(status).toBe(400);
    expect((body as ApiError).message).toContain("empty");
  });

  // ── Malformed request handling ─────────────────────────────

  it("returns 400 for malformed JSON body", async () => {
    const response = await exports.default.fetch(
      new Request(makeUrl("/consultations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not valid json {{{",
      }),
      env,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiError;
    expect(body.error).toBe("validation_error");
    expect(body.message).toContain("JSON");
  });

  it("returns 400 when body is an array", async () => {
    const response = await exports.default.fetch(
      new Request(makeUrl("/consultations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "[1, 2, 3]",
      }),
      env,
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as ApiError;
    expect(body.message).toContain("object");
  });

  it("returns 400 for empty body", async () => {
    const response = await exports.default.fetch(
      new Request(makeUrl("/consultations"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "",
      }),
      env,
    );
    expect(response.status).toBe(400);
  });

  // ── Normalization ──────────────────────────────────────────

  it("normalizes email to lowercase", async () => {
    const email = `Normalize-Test-${runId}@Example.COM`;
    const { status } = await postConsultation({
      name: "Normalize Test",
      email,
      phone: "+1-555-777-8888",
      treatment_interest: "IVF",
    });
    expect(status).toBe(201);

    // A duplicate with the lowercase version should trigger 409
    const duplicate = await postConsultation({
      name: "Normalize Test 2",
      email: email.toLowerCase(),
      phone: "+1-555-999-0000",
      treatment_interest: "Surrogacy",
    });
    expect(duplicate.status).toBe(409);
  });

  it("trims whitespace from all fields", async () => {
    const { status, body } = await postConsultation({
      name: "   Trimmed User   ",
      email: `  trimmed-${runId}@example.com  `,
      phone: "  +1-555-000-1111  ",
      treatment_interest: "   Donor Programs   ",
    });
    expect(status).toBe(201);
    expect((body as ApiSuccess).success).toBe(true);
  });

  // ── D1 persistence ─────────────────────────────────────────

  it("persists lead in D1 and is queryable", async () => {
    const email = `d1-persist-${runId}@example.com`;

    const { status } = await postConsultation({
      name: "D1 Persist Test",
      email,
      phone: "+1-555-111-0000",
      treatment_interest: "IVF",
    });
    expect(status).toBe(201);

    // Query directly via D1 binding to verify persistence
    const stmt = env.DB.prepare(
      "SELECT name, email, phone, treatment_interest, status FROM leads WHERE email = ?1 LIMIT 1",
    ).bind(email.toLowerCase());
    const result = await stmt.first<{
      name: string;
      email: string;
      phone: string;
      treatment_interest: string;
      status: string;
    }>();

    expect(result).not.toBeNull();
    expect(result!.name).toBe("D1 Persist Test");
    expect(result!.email).toBe(email.toLowerCase());
    expect(result!.phone).toBe("+1-555-111-0000");
    expect(result!.treatment_interest).toBe("IVF");
    expect(result!.status).toBe("new");
  });
});

// ══════════════════════════════════════════════════════════════
// CORS INTEGRATION
// ══════════════════════════════════════════════════════════════

describe("CORS (integration)", () => {
  it("returns CORS headers for allowed origin", async () => {
    const response = await exports.default.fetch(
      new Request(makeUrl("/health"), {
        headers: { Origin: "https://agsynergy.ca" },
      }),
      env,
    );
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://agsynergy.ca",
    );
  });

  it("returns empty origin for disallowed origin", async () => {
    const response = await exports.default.fetch(
      new Request(makeUrl("/health"), {
        headers: { Origin: "https://evil.example.com" },
      }),
      env,
    );
    // For disallowed origins, no CORS header is set at all
    expect(
      response.headers.get("Access-Control-Allow-Origin"),
    ).toBeNull();
  });

  it("handles OPTIONS preflight", async () => {
    const response = await exports.default.fetch(
      new Request(makeUrl("/consultations"), {
        method: "OPTIONS",
        headers: { Origin: "https://agsynergy.ca" },
      }),
      env,
    );
    expect(response.status).toBe(204);
  });
});

// ══════════════════════════════════════════════════════════════
// 404 HANDLING
// ══════════════════════════════════════════════════════════════

describe("Unknown routes (integration)", () => {
  it("returns 404 for unknown API path", async () => {
    const response = await fetchApi("/unknown-endpoint");
    expect(response.status).toBe(404);
    const body = (await response.json()) as Record<string, unknown>;
    expect(body.error).toBe("Not Found");
  });

  it("returns 404 for GET on POST-only route", async () => {
    const response = await fetchApi("/consultations");
    expect(response.status).toBe(404);
  });
});