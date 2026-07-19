// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Consultation Service Unit Tests       │
// │ EPIC-001-008: Testing Foundation                            │
// └─────────────────────────────────────────────────────────────┘
//
// Tests for the consultation service pipeline:
//   validate → normalize → duplicate check → insert
//
// These are pure unit tests — no Workers runtime, no D1 hit.
// Duplicate check and insert use stubbed D1Database.

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  validateConsultationRequest,
  checkDuplicateLead,
  insertLead,
  processConsultation,
} from "../../src/services/consultationService.js";
import type {
  ConsultationInput,
  NormalizedConsultation,
} from "../../src/services/consultationService.js";

// ── D1 Stub Helpers ──────────────────────────────────────────

/** Create a minimal D1Database stub for testing */
function stubDb(rows: Record<string, unknown>[] = []): D1Database {
  const first = vi.fn().mockResolvedValue(rows.length > 0 ? rows[0] : null);
  const run = vi.fn().mockResolvedValue(undefined);
  const prepare = vi.fn().mockReturnValue({
    bind: vi.fn().mockReturnValue({ first, run }),
  });
  return { prepare } as unknown as D1Database;
}

// ── Valid Input ──────────────────────────────────────────────

function validInput(overrides: Partial<ConsultationInput> = {}): ConsultationInput {
  return {
    name: "Jane Doe",
    email: "Jane@Example.com",
    phone: " +1-555-123-4567 ",
    treatment_interest: "  IVF with Donor Eggs  ",
    message: "  Looking for options in Bangalore  ",
    ...overrides,
  };
}

// ══════════════════════════════════════════════════════════════
// VALIDATION TESTS
// ══════════════════════════════════════════════════════════════

describe("validateConsultationRequest", () => {
  // ── Happy path ─────────────────────────────────────────────

  it("accepts a fully valid input", () => {
    const result = validateConsultationRequest(validInput());
    expect(result).not.toHaveProperty("error");
  });

  it("accepts input with message omitted (null)", () => {
    const result = validateConsultationRequest(
      validInput({ message: undefined }),
    );
    expect(result).not.toHaveProperty("error");
  });

  // ── Required field checks ──────────────────────────────────

  describe("required fields", () => {
    const required = ["name", "email", "phone", "treatment_interest"] as const;

    for (const field of required) {
      it(`rejects missing required field: ${field}`, () => {
        const input = validInput();
        delete input[field];
        const result = validateConsultationRequest(input);
        expect(result).toHaveProperty("error", "validation_error");
        expect(result).toHaveProperty("status", 400);
        expect(result).toHaveProperty("message");
        expect((result as { message: string }).message).toContain(field);
      });

      it(`rejects null for required field: ${field}`, () => {
        const input = validInput({ [field]: null });
        const result = validateConsultationRequest(input);
        expect(result).toHaveProperty("error", "validation_error");
        expect(result).toHaveProperty("status", 400);
      });

      it(`rejects non-string for required field: ${field}`, () => {
        const input = validInput({ [field]: 12345 });
        const result = validateConsultationRequest(input);
        expect(result).toHaveProperty("error", "validation_error");
        expect(result).toHaveProperty("status", 400);
        expect((result as { message: string }).message).toContain("must be a string");
      });
    }
  });

  // ── Optional message field ─────────────────────────────────

  it("rejects non-string message if provided", () => {
    const result = validateConsultationRequest(
      validInput({ message: 999 as unknown as string }),
    );
    expect(result).toHaveProperty("error", "validation_error");
    expect((result as { message: string }).message).toContain("message");
  });

  // ── Empty / whitespace rejection ───────────────────────────

  it("rejects name that is only whitespace", () => {
    const result = validateConsultationRequest(
      validInput({ name: "   " }),
    );
    expect(result).toHaveProperty("error", "validation_error");
    expect((result as { message: string }).message).toContain("name");
    expect((result as { message: string }).message).toContain("empty");
  });

  it("rejects email that is only whitespace", () => {
    const result = validateConsultationRequest(
      validInput({ email: "   " }),
    );
    expect(result).toHaveProperty("error", "validation_error");
  });

  it("rejects phone that is only whitespace", () => {
    const result = validateConsultationRequest(
      validInput({ phone: "   " }),
    );
    expect(result).toHaveProperty("error", "validation_error");
  });

  it("rejects treatment_interest that is only whitespace", () => {
    const result = validateConsultationRequest(
      validInput({ treatment_interest: "   " }),
    );
    expect(result).toHaveProperty("error", "validation_error");
  });

  // ── Email format ───────────────────────────────────────────

  it("rejects invalid email format", () => {
    const result = validateConsultationRequest(
      validInput({ email: "not-an-email" }),
    );
    expect(result).toHaveProperty("error", "validation_error");
    expect((result as { message: string }).message).toContain("email");
  });

  it("rejects email without @ sign", () => {
    const result = validateConsultationRequest(
      validInput({ email: "janeexample.com" }),
    );
    expect(result).toHaveProperty("error", "validation_error");
  });

  it("rejects email without domain", () => {
    const result = validateConsultationRequest(
      validInput({ email: "jane@" }),
    );
    expect(result).toHaveProperty("error", "validation_error");
  });

  // ── Max length enforcement ─────────────────────────────────

  it("rejects name exceeding 255 characters", () => {
    const result = validateConsultationRequest(
      validInput({ name: "A".repeat(256) }),
    );
    expect(result).toHaveProperty("error", "validation_error");
    expect((result as { message: string }).message).toContain("name");
    expect((result as { message: string }).message).toContain("255");
  });

  it("rejects email exceeding 255 characters", () => {
    const result = validateConsultationRequest(
      validInput({ email: "A".repeat(250) + "@b.com" }),
    );
    expect(result).toHaveProperty("error", "validation_error");
  });

  it("rejects message exceeding 2000 characters", () => {
    const result = validateConsultationRequest(
      validInput({ message: "X".repeat(2001) }),
    );
    expect(result).toHaveProperty("error", "validation_error");
    expect((result as { message: string }).message).toContain("2000");
  });

  // ── Boundary: exactly at max ───────────────────────────────

  it("accepts name at exactly 255 characters", () => {
    const result = validateConsultationRequest(
      validInput({ name: "A".repeat(255) }),
    );
    expect(result).not.toHaveProperty("error");
  });

  it("accepts message at exactly 2000 characters", () => {
    const result = validateConsultationRequest(
      validInput({ message: "X".repeat(2000) }),
    );
    expect(result).not.toHaveProperty("error");
  });
});

// ══════════════════════════════════════════════════════════════
// NORMALIZATION TESTS
// ══════════════════════════════════════════════════════════════

describe("normalization", () => {
  it("lowercases email", () => {
    const result = validateConsultationRequest(
      validInput({ email: "Jane@Example.COM" }),
    );
    expect((result as NormalizedConsultation).email).toBe("jane@example.com");
  });

  it("trims leading/trailing whitespace from name", () => {
    const result = validateConsultationRequest(
      validInput({ name: "   Jane Doe   " }),
    );
    expect((result as NormalizedConsultation).name).toBe("Jane Doe");
  });

  it("collapses multiple spaces in name", () => {
    const result = validateConsultationRequest(
      validInput({ name: "Jane    Marie    Doe" }),
    );
    expect((result as NormalizedConsultation).name).toBe("Jane Marie Doe");
  });

  it("trims whitespace from phone", () => {
    const result = validateConsultationRequest(
      validInput({ phone: "  +1-555-123-4567  " }),
    );
    expect((result as NormalizedConsultation).phone).toBe("+1-555-123-4567");
  });

  it("trims whitespace from treatment_interest", () => {
    const result = validateConsultationRequest(
      validInput({ treatment_interest: "  IVF  " }),
    );
    expect((result as NormalizedConsultation).treatment_interest).toBe("IVF");
  });

  it("trims whitespace from message", () => {
    const result = validateConsultationRequest(
      validInput({ message: "  Hello there  " }),
    );
    expect((result as NormalizedConsultation).message).toBe("Hello there");
  });

  it("sets message to null when empty string", () => {
    const result = validateConsultationRequest(
      validInput({ message: "" }),
    );
    expect((result as NormalizedConsultation).message).toBeNull();
  });

  it("sets message to null when whitespace-only", () => {
    const result = validateConsultationRequest(
      validInput({ message: "   " }),
    );
    expect((result as NormalizedConsultation).message).toBeNull();
  });

  it("sets message to null when undefined", () => {
    const result = validateConsultationRequest(
      validInput({ message: undefined }),
    );
    expect((result as NormalizedConsultation).message).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════
// DUPLICATE DETECTION TESTS
// ══════════════════════════════════════════════════════════════

describe("checkDuplicateLead", () => {
  it("returns true when a matching active lead exists", async () => {
    const db = stubDb([{ id: "existing-id" }]);
    const result = await checkDuplicateLead(db, "jane@example.com");
    expect(result).toBe(true);
  });

  it("returns false when no matching lead exists", async () => {
    const db = stubDb([]);
    const result = await checkDuplicateLead(db, "jane@example.com");
    expect(result).toBe(false);
  });

  it("uses correct SQL and binds email parameter", async () => {
    const first = vi.fn().mockResolvedValue(null);
    const bind = vi.fn().mockReturnValue({ first });
    const prepare = vi.fn().mockReturnValue({ bind });
    const db = { prepare } as unknown as D1Database;

    await checkDuplicateLead(db, "test@example.com");

    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("SELECT id FROM leads"),
    );
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("status != 'disqualified'"),
    );
    expect(bind).toHaveBeenCalledWith("test@example.com");
  });
});

// ══════════════════════════════════════════════════════════════
// INSERT TESTS
// ══════════════════════════════════════════════════════════════

describe("insertLead", () => {
  it("returns a UUID string", async () => {
    const db = stubDb();
    const data: NormalizedConsultation = {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "+15551234567",
      treatment_interest: "IVF",
      message: null,
    };
    const id = await insertLead(db, data);
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it("sets status to 'new'", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const db = { prepare } as unknown as D1Database;

    const data: NormalizedConsultation = {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1234",
      treatment_interest: "Surrogacy",
      message: "Test",
    };
    await insertLead(db, data);

    // Verify the INSERT SQL was called with bind params
    expect(prepare).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO leads"),
    );
    const bindArgs = bind.mock.calls[0];
    // Status is the 7th positional param (index 6)
    expect(bindArgs[6]).toBe("new");
  });

  it("uses ISO 8601 timestamps for created_at and updated_at", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const bind = vi.fn().mockReturnValue({ run });
    const prepare = vi.fn().mockReturnValue({ bind });
    const db = { prepare } as unknown as D1Database;

    const data: NormalizedConsultation = {
      name: "Jane Doe",
      email: "jane@example.com",
      phone: "555-1234",
      treatment_interest: "IVF",
      message: null,
    };
    await insertLead(db, data);

    const bindArgs = bind.mock.calls[0];
    const createdAt = bindArgs[7] as string;
    const updatedAt = bindArgs[8] as string;

    // Both should be valid ISO 8601
    expect(new Date(createdAt).toISOString()).toBe(createdAt);
    expect(new Date(updatedAt).toISOString()).toBe(updatedAt);
    // Should be set to the same instant
    expect(createdAt).toBe(updatedAt);
  });
});

// ══════════════════════════════════════════════════════════════
// END-TO-END SERVICE TESTS
// ══════════════════════════════════════════════════════════════

describe("processConsultation (end-to-end service)", () => {
  it("returns success with lead_id for valid input", async () => {
    const db = stubDb([]); // No duplicate
    const result = await processConsultation(db, validInput());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.lead_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      );
      expect(result.status).toBe("new");
    }
  });

  it("returns 409 for duplicate email", async () => {
    const db = stubDb([{ id: "dup-id" }]);
    const result = await processConsultation(db, validInput());

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("duplicate_lead");
      expect(result.status).toBe(409);
      expect(result.message).toContain("already exists");
    }
  });

  it("returns validation error for missing fields", async () => {
    const db = stubDb([]);
    const result = await processConsultation(db, { name: "No fields" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBe("validation_error");
      expect(result.status).toBe(400);
    }
  });
});