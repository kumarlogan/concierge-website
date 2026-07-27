// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Appointment Management Capability            │
// │ Product-agnostic scheduling, slot management, booking.     │
// │ Reusable across all AGS products (Concierge, Clinic, etc.)│
// │ Wave 7 — Appointment Management & Messaging                │
// └─────────────────────────────────────────────────────────────┘
//
// PHI Boundary: This capability stores appointment metadata only.
// No PHI payloads — patient references are opaque identity IDs.
// Consent verification required before all write operations.

import type { Appointment, CreateAppointmentRequest, UpdateAppointmentRequest, AppointmentFilters, AppointmentStatus } from "./appointment-types.js";
import type { Decision } from "../trust/types.js";

// ════════════════════════════════════════════════════════════
// Consent Verification Result
// ════════════════════════════════════════════════════════════

export interface ConsentVerificationResult {
  decision: Decision;
  consentTypes: string[];
  verified: boolean;
}

// ════════════════════════════════════════════════════════════
// Appointment Engine
// ════════════════════════════════════════════════════════════

export interface AppointmentEngine {
  /** Create a new appointment, verifying consent and slot availability */
  create(request: CreateAppointmentRequest, consent: ConsentVerificationResult): Promise<Appointment>;
  /** Retrieve an appointment by ID */
  get(id: string): Promise<Appointment | null>;
  /** List appointments matching filters */
  list(filters: AppointmentFilters): Promise<Appointment[]>;
  /** Update an existing appointment */
  update(id: string, request: UpdateAppointmentRequest): Promise<Appointment>;
  /** Cancel an appointment */
  cancel(id: string): Promise<void>;
  /** Check slot availability for a given time range */
  checkAvailability(start: string, end: string): Promise<boolean>;
}