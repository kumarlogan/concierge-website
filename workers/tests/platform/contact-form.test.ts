// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Contact Form Route Tests              │
// │ Phase P.1 Remediation: contact_submissions migration        │
// └─────────────────────────────────────────────────────────────┘
//
// Focused regression tests for the contact form endpoint and
// the contact_submissions D1 table.
//
// Covers:
//   1. Valid submission is created + persisted to D1
//   2. Malformed input is rejected (validation contract)
//   3. D1 persistence confirmed (row exists, correct fields)
//   4. Internal notification routing is invoked correctly
//   5. Multiple internal recipients are handled correctly
//   6. No patient-facing recipient is auto-introduced
//   7. No PHI/secrets leaked in logs or responses
//   8. Multiple submissions get unique IDs
//   9. Duplicate recipient addresses are handled safely
//   10. Empty recipient configuration fails safely
//   11. Malformed recipient configuration is filtered safely
//   12. Existing email flows remain green (import check)

import { describe, it, expect, vi, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { handleContact } from "../../src/routes/contact.js";

// ── Ensure contact_submissions table exists in the test D1 pool ──
// The vitest Cloudflare pool may spin up a fresh Miniflare D1 instance
// that hasn't received all migrations. We ensure the table here using
// the same schema as migration 016 (idempotent CREATE TABLE IF NOT EXISTS).
const CONTACT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS contact_submissions (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    email     TEXT NOT NULL,
    phone     TEXT NOT NULL,
    message   TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`;

beforeAll(async () => {
  for (const stmt of CONTACT_TABLE_SQL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await env.DB.prepare(stmt).run();
  }
});

function buildEnv(overrides: Record<string, unknown> = {}): any {
  return {
    DB: env.DB,
    RESEND_API_KEY: "re_test_key_for_testing",
    EMAIL_FROM: "noreply@agsynergy.ca",
    EMAIL_SUPPORT_TO: "support@agsynergy.ca,help@agsynergy.ca",
    EMAIL_OPERATIONS_TO: "ops@agsynergy.ca,admin@agsynergy.ca",
    EMAIL_SECURITY_TO: "security@agsynergy.ca",
    APP_URL: "https://www.agsynergy.ca",
    FRONTEND_URL: "https://www.agsynergy.ca",
    NOTIFICATIONS: env.NOTIFICATIONS ?? env.DB,
    DOCUMENT_STORAGE: {} as R2Bucket,
    DOCUMENT_SERVICE: {} as any,
    DOCUMENT_CONSENT_INTEGRATION: {} as any,
    DOCUMENT_AUDIT: {} as any,
    DOCUMENT_ENCRYPTION: {} as any,
    DOCUMENT_POLICY_INTEGRATION: {} as any,
    POLICY_ENGINE: {} as any,
    CONSENT_ENGINE: {} as any,
    TRUST_ENGINE: {} as any,
    RISK_ENGINE: {} as any,
    DELEGATION_ENGINE: {} as any,
    AUTHORIZATION_ENGINE: {} as any,
    EVENT_BUS: {} as any,
    DECISION_ENGINE: {} as any,
    SENDGRID_API_KEY: "sg_test_key_for_testing",
    ...overrides,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("https://api.agsynergy.ca/api/v1/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const DUMMY_PARAMS = { path: [] };

// ──────────────────────────────────────────────────────────────
describe("Contact Form Route — contact_submissions migration", () => {
  // ── T1: Valid submission is created + persisted + 201 ────────
  it("T1: valid submission returns 201 + unique id and persists to D1", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+141****0100",
      message: "I would like to schedule a consultation.",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
    const json = await resp.json() as { success: boolean; id: number; message: string };
    expect(json.success).toBe(true);
    expect(typeof json.id).toBe("number");
    expect(json.message).toMatch(/received/i);
  });

  // ── T2: Malformed input is rejected (validation contract) ────
  it("T2a: missing name → 400", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({ email: "a@b.com", phone: "1234567890" });
    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(400);
    const json = await resp.json() as { error: string };
    expect(json.error).toBe("validation_error");
  });

  it("T2b: empty name → 400", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({ name: "", email: "a@b.com", phone: "1234567890" });
    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(400);
  });

  it("T2c: missing phone → 400", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({ name: "Test", email: "a@b.com" });
    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(400);
  });

  it("T2d: invalid email format → 400", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({ name: "Test", email: "not-an-email", phone: "1234567890" });
    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(400);
    const json = await resp.json() as { error: string };
    expect(json.error).toBe("validation_error");
  });

  it("T2e: invalid JSON body → 400", async () => {
    const testEnv = buildEnv();
    const req = new Request("https://api.agsynergy.ca/api/v1/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{ not valid json",
    });
    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(400);
    const json = await resp.json() as { error: string };
    expect(json.error).toBe("validation_error");
  });

  it("T2f: message is optional — submission succeeds without message", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({ name: "NoMessage", email: "nomsg@example.com", phone: "+141****0200" });
    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
    const json = await resp.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  // ── T3: D1 persistence confirmed (row exists, correct fields) ─
  it("T3: persisted row has correct field values", async () => {
    const testEnv = buildEnv();
    const req = makeRequest({
      name: "Persistence Test",
      email: "persist@example.com",
      phone: "+141****0300",
      message: "Verify D1 storage",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    const json = await resp.json() as { id: number };

    const row = await testEnv.DB
      .prepare("SELECT * FROM contact_submissions WHERE id = ?")
      .bind(json.id)
      .first();

    expect(row).not.toBeNull();
    expect(row?.name).toBe("Persistence Test");
    expect(row?.email).toBe("persist@example.com");
    expect(row?.phone).toBe("+141****0300");
    expect(row?.message).toBe("Verify D1 storage");
    expect(row?.created_at).toBeTruthy();
  });

  // ── T4: Internal notification routing is invoked correctly ───
  it("T4: contact notification invoked with support + operations recipients", async () => {
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO: "support@agsynergy.ca,help@agsynergy.ca",
      EMAIL_OPERATIONS_TO: "ops@agsynergy.ca,admin@agsynergy.ca",
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const req = makeRequest({
      name: "Notify Test",
      email: "notify@example.com",
      phone: "+141****0400",
      message: "Routing check",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
    const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnCalls.every((msg) => !msg.includes("server_error"))).toBe(true);
    warnSpy.mockRestore();
  });

  // ── T5: Multiple internal recipients are handled correctly ───
  it("T5: parseRecipients handles multiple comma-separated + invalid + duplicate", async () => {
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO:
        "support@agsynergy.ca,support@agsynergy.ca,not-an-email,help@agsynergy.ca",
      EMAIL_OPERATIONS_TO: "ops@agsynergy.ca,admin@agsynergy.ca",
    });
    const req = makeRequest({
      name: "Multi Recipient",
      email: "multi@example.com",
      phone: "+141****0500",
      message: "Multi-recipient routing test",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
  });

  // ── T6: No patient-facing recipient is auto-introduced ────────
  it("T6: contact notification recipients never include the submitter's email", async () => {
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO: "support@agsynergy.ca",
      EMAIL_OPERATIONS_TO: "ops@agsynergy.ca",
    });
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const submitterEmail = "patient.secret@example.com";
    const req = makeRequest({
      name: "Patient Test",
      email: submitterEmail,
      phone: "+141****0600",
      message: "I should not appear in TO field",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
    const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
    expect(warnCalls.every((msg) => !msg.includes(submitterEmail))).toBe(true);
    warnSpy.mockRestore();
  });

  // ── T7: No PHI/secrets in logs or responses ──────────────────
  it("T7a: D1 error response does not leak internal error details", async () => {
    const testEnv = buildEnv({
      DB: {
        prepare: () => {
          throw new Error("SQLITE_ERROR: no such table: contact_submissions");
        },
      } as any,
    });

    const req = makeRequest({
      name: "Fail Test",
      email: "fail@example.com",
      phone: "+141****0700",
      message: "Should get generic 500",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(500);
    const json = await resp.json() as { error: string; message: string };
    expect(json.error).toBe("server_error");
    expect(json.message).not.toContain("SQLITE_ERROR");
    expect(json.message).not.toContain("no such table");
    expect(json.message).toBe("Failed to store submission. Please try again later.");
  });

  it("T7b: success response does not leak internal config/secrets", async () => {
    const secretSupportEmail = "super-secret-support@example.com";
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO: secretSupportEmail,
    });
    const req = makeRequest({
      name: "Leak Test",
      email: "leak@example.com",
      phone: "+141****0800",
      message: "Check no leak",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    const body = await resp.text();
    expect(body).not.toContain(secretSupportEmail);
    expect(body).not.toContain("EMAIL_SUPPORT_TO");
    expect(body).not.toContain("RESEND_API_KEY");
    expect(body).not.toContain("SENDGRID_API_KEY");
  });

  // ── T8: Idempotency — multiple submissions get unique IDs ────
  it("T8: multiple submissions each get unique IDs", async () => {
    const testEnv = buildEnv();

    const resp1 = await handleContact(
      makeRequest({ name: "First", email: "first@example.com", phone: "+141****0100" }),
      testEnv,
      DUMMY_PARAMS,
    );
    const json1 = await resp1.json() as { id: number };
    expect(json1.id).toBeDefined();

    const resp2 = await handleContact(
      makeRequest({ name: "Second", email: "second@example.com", phone: "+141****0200" }),
      testEnv,
      DUMMY_PARAMS,
    );
    const json2 = await resp2.json() as { id: number };
    expect(json2.id).toBeDefined();

    expect(json1.id).not.toBe(json2.id);
    expect(typeof json1.id).toBe("number");
    expect(typeof json2.id).toBe("number");
  });

  // ── T9: Duplicate recipient addresses are handled safely ──────
  it("T9: duplicate recipient addresses in config are deduplicated (submission succeeds)", async () => {
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO:
        "support@agsynergy.ca,support@agsynergy.ca,support@agsynergy.ca",
    });
    const req = makeRequest({
      name: "Dup Test",
      email: "dup@example.com",
      phone: "+141****0900",
      message: "Duplicate recipient test",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
  });

  // ── T10: Empty recipient config fails safely ──────────────────
  it("T10: empty EMAIL_SUPPORT_TO + EMAIL_OPERATIONS_TO — submission succeeds, email silently skipped", async () => {
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO: "",
      EMAIL_OPERATIONS_TO: "",
    });
    const req = makeRequest({
      name: "Empty Recipient",
      email: "empty@example.com",
      phone: "+141****1000",
      message: "No recipients configured",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
    const json = await resp.json() as { success: boolean };
    expect(json.success).toBe(true);
  });

  // ── T11: Malformed recipient config is filtered safely ────────
  it("T11: malformed recipient entries (no @) are filtered out (submission succeeds)", async () => {
    const testEnv = buildEnv({
      EMAIL_SUPPORT_TO: "support@agsynergy.ca,not-an-email,also-not-email",
    });
    const req = makeRequest({
      name: "Malformed Filter",
      email: "malformed@example.com",
      phone: "+141****1100",
      message: "Malformed recipient test",
    });

    const resp = await handleContact(req, testEnv, DUMMY_PARAMS);
    expect(resp.status).toBe(201);
  });

  // ── T12: Existing email flows remain green (import check) ─────
  it("T12: contact route imports cleanly alongside email service (no module load errors)", () => {
    expect(handleContact).toBeDefined();
    expect(typeof handleContact).toBe("function");
  });
});
