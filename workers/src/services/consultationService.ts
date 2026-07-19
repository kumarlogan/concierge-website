// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Consultation Service                   │
// │ Phase 1: Concierge Platform Foundation                       │
// │ EPIC-001-007: Consultation Workflow                          │
// └─────────────────────────────────────────────────────────────┘
//
// Business logic for consultation request processing:
//  1. Validate request body
//  2. Normalize data
//  3. Check for duplicate active leads
//  4. Insert lead into D1
//
// This service contains NO HTTP concerns — it operates on
// plain data and returns typed results. The route handler is
// responsible for translating HTTP ↔ service calls.
//
// Architecture: Route → Service → D1

import type { D1Database } from "@cloudflare/workers-types";

// ── Types ────────────────────────────────────────────────────

/** Raw input from the consultation form */
export interface ConsultationInput {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  treatment_interest?: unknown;
  message?: unknown;
}

/** Validated and normalized input ready for database insert */
export interface NormalizedConsultation {
  name: string;
  email: string;
  phone: string;
  treatment_interest: string;
  message: string | null;
}

/** Success result from the service */
export interface ConsultationSuccess {
  success: true;
  lead_id: string;
  status: string;
}

/** Validation / duplicate / server error result */
export interface ConsultationError {
  success: false;
  error: string;
  message: string;
  status: number;
}

export type ConsultationResult = ConsultationSuccess | ConsultationError;

// ── Constants ────────────────────────────────────────────────

const FIELD_MAX_LENGTHS: Record<string, number> = {
  name: 255,
  email: 255,
  phone: 100,
  treatment_interest: 500,
  message: 2000,
};

const REQUIRED_FIELDS = [
  "name",
  "email",
  "phone",
  "treatment_interest",
] as const;

// Simple email regex — good enough for form validation.
// Does not handle every RFC 5322 edge case; that's intentional.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ── Validation ───────────────────────────────────────────────

/**
 * Validate and normalize consultation request data.
 * Returns normalized data or a structured error.
 */
export function validateConsultationRequest(
  input: ConsultationInput,
): NormalizedConsultation | ConsultationError {
  // ── Type checks: reject non-string values ──────────────────
  for (const field of REQUIRED_FIELDS) {
    const value = input[field];

    if (value === undefined || value === null) {
      return {
        success: false,
        error: "validation_error",
        message: `Missing required field: ${field}`,
        status: 400,
      };
    }

    if (typeof value !== "string") {
      return {
        success: false,
        error: "validation_error",
        message: `Field '${field}' must be a string`,
        status: 400,
      };
    }
  }

  // Optional message field — allow undefined or string
  if (
    input.message !== undefined &&
    input.message !== null &&
    typeof input.message !== "string"
  ) {
    return {
      success: false,
      error: "validation_error",
      message: "Field 'message' must be a string if provided",
      status: 400,
    };
  }

  // ── Normalize: trim whitespace ─────────────────────────────
  // Cast through unknown — the loop above already verified these are strings
  const raw = input as Record<string, string>;
  const name = raw.name.trim().replace(/\s+/g, " ");
  const email = raw.email.trim().toLowerCase();
  const phone = raw.phone.trim();
  const treatment_interest = raw.treatment_interest.trim();
  const message = (input.message as string | undefined)?.trim() || null;

  // ── Reject empty values after trimming ─────────────────────
  if (name.length === 0) {
    return {
      success: false,
      error: "validation_error",
      message: "Field 'name' cannot be empty",
      status: 400,
    };
  }

  if (email.length === 0) {
    return {
      success: false,
      error: "validation_error",
      message: "Field 'email' cannot be empty",
      status: 400,
    };
  }

  if (phone.length === 0) {
    return {
      success: false,
      error: "validation_error",
      message: "Field 'phone' cannot be empty",
      status: 400,
    };
  }

  if (treatment_interest.length === 0) {
    return {
      success: false,
      error: "validation_error",
      message: "Field 'treatment_interest' cannot be empty",
      status: 400,
    };
  }

  // ── Email format ───────────────────────────────────────────
  if (!EMAIL_REGEX.test(email)) {
    return {
      success: false,
      error: "validation_error",
      message: "Invalid email format",
      status: 400,
    };
  }

  // ── Max field lengths ──────────────────────────────────────
  const fieldValues: Record<string, string> = {
    name,
    email,
    phone,
    treatment_interest,
  };
  if (message) {
    fieldValues["message"] = message;
  }

  for (const [field, value] of Object.entries(fieldValues)) {
    const maxLen = FIELD_MAX_LENGTHS[field];
    if (maxLen && value.length > maxLen) {
      return {
        success: false,
        error: "validation_error",
        message:
          `Field '${field}' exceeds maximum length of ${maxLen} characters`,
        status: 400,
      };
    }
  }

  return { name, email, phone, treatment_interest, message };
}

// ── Duplicate Check ──────────────────────────────────────────

/**
 * Check if an active lead already exists for the given email.
 * Returns true if a duplicate active lead is found.
 */
export async function checkDuplicateLead(
  db: D1Database,
  email: string,
): Promise<boolean> {
  const stmt = db
    .prepare(
      "SELECT id FROM leads WHERE email = ?1 AND status != 'disqualified' LIMIT 1",
    )
    .bind(email);
  const result = await stmt.first();
  return result !== null;
}

// ── Insert ───────────────────────────────────────────────────

/**
 * Insert a new lead record into the leads table.
 * Returns the generated lead ID.
 */
export async function insertLead(
  db: D1Database,
  data: NormalizedConsultation,
): Promise<string> {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  const status = "new";

  const stmt = db
    .prepare(
      `INSERT INTO leads (id, name, email, phone, treatment_interest, message, status, created_at, updated_at)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
    )
    .bind(id, data.name, data.email, data.phone, data.treatment_interest, data.message, status, now, now);

  await stmt.run();
  return id;
}

// ── Main Service ─────────────────────────────────────────────

/**
 * Process a consultation request end-to-end:
 * validate → normalize → duplicate check → insert.
 *
 * Returns a typed result that the route handler translates into
 * an HTTP response. This service has no HTTP knowledge — it
 * works with plain data and returns structured results.
 */
export async function processConsultation(
  db: D1Database,
  input: ConsultationInput,
): Promise<ConsultationResult> {
  // Step 1: Validate & Normalize
  const validated = validateConsultationRequest(input);
  if ("error" in validated) {
    return validated;
  }

  // Step 2: Duplicate Check
  try {
    const isDuplicate = await checkDuplicateLead(db, validated.email);
    if (isDuplicate) {
      return {
        success: false,
        error: "duplicate_lead",
        message: "An active consultation request already exists.",
        status: 409,
      };
    }
  } catch (err) {
    // Log server-side only — no stack traces exposed
    console.error("Duplicate check failed:", err instanceof Error ? err.message : String(err));
    return {
      success: false,
      error: "internal_error",
      message: "An unexpected error occurred. Please try again later.",
      status: 500,
    };
  }

  // Step 3: Insert
  try {
    const leadId = await insertLead(db, validated);
    return {
      success: true,
      lead_id: leadId,
      status: "new",
    };
  } catch (err) {
    // Log server-side only — no stack traces, no SQL errors exposed
    console.error("Insert lead failed:", err instanceof Error ? err.message : String(err));
    return {
      success: false,
      error: "internal_error",
      message: "An unexpected error occurred. Please try again later.",
      status: 500,
    };
  }
}