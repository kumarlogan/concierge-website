// ┌─────────────────────────────────────────────────────────────┐
// │ Wave 7 — Appointment Management Tests                           │
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import { checkSlotConflict } from "../../src/platform/appointments/appointment-validation.js";
import { AppointmentStatus, AppointmentType } from "../../src/platform/appointments/appointment-types.js";

describe("Appointment Validation", () => {
  it("detects overlapping appointments for same provider", () => {
    const existing = [{
      id: "appt-1",
      providerId: "provider-1",
      startAt: "2026-08-10T10:00:00Z",
      endAt: "2026-08-10T11:00:00Z",
      status: AppointmentStatus.SCHEDULED,
    }];

    const newAppt = {
      startAt: "2026-08-10T10:30:00Z",
      endAt: "2026-08-10T11:30:00Z",
      providerId: "provider-1",
    };

    const result = checkSlotConflict(newAppt, existing as any);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it("allows non-overlapping appointments for same provider", () => {
    const existing = [{
      id: "appt-1",
      providerId: "provider-1",
      startAt: "2026-08-10T10:00:00Z",
      endAt: "2026-08-10T11:00:00Z",
      status: AppointmentStatus.SCHEDULED,
    }];

    const newAppt = {
      startAt: "2026-08-10T11:00:00Z",
      endAt: "2026-08-10T12:00:00Z",
      providerId: "provider-1",
    };

    const result = checkSlotConflict(newAppt, existing as any);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("allows overlapping appointments for different providers", () => {
    const existing = [{
      id: "appt-1",
      providerId: "provider-1",
      startAt: "2026-08-10T10:00:00Z",
      endAt: "2026-08-10T11:00:00Z",
      status: AppointmentStatus.SCHEDULED,
    }];

    const newAppt = {
      startAt: "2026-08-10T10:30:00Z",
      endAt: "2026-08-10T11:30:00Z",
      providerId: "provider-2",
    };

    const result = checkSlotConflict(newAppt, existing as any);
    expect(result.valid).toBe(true);
  });

  it("ignores cancelled appointments in conflict check", () => {
    const existing = [{
      id: "appt-1",
      providerId: "provider-1",
      startAt: "2026-08-10T10:00:00Z",
      endAt: "2026-08-10T11:00:00Z",
      status: AppointmentStatus.CANCELLED,
    }];

    const newAppt = {
      startAt: "2026-08-10T10:30:00Z",
      endAt: "2026-08-10T11:30:00Z",
      providerId: "provider-1",
    };

    const result = checkSlotConflict(newAppt, existing as any);
    expect(result.valid).toBe(true);
  });

  it("rejects appointments with start after end", () => {
    const result = checkSlotConflict({
      startAt: "2026-08-01T12:00:00Z",
      endAt: "2026-08-01T11:00:00Z",
      providerId: "provider-1",
    } as any, []);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes("start must be before end"))).toBe(true);
  });
});