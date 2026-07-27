// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Appointment Validation                          │
// │ Ensures no overlapping slots, valid time boundaries.      │
// ═══════════════════════════════════════════════════════════

import type { Appointment } from "./appointment-types.js";
import { AppointmentStatus } from "./appointment-types.js";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Check that an appointment doesn't overlap with any existing appointments.
 */
export function checkSlotConflict(
  newAppointment: { startAt: string; endAt: string; providerId: string },
  existing: Appointment[],
): ValidationResult {
  const errors: string[] = [];
  const newStart = new Date(newAppointment.startAt).getTime();
  const newEnd = new Date(newAppointment.endAt).getTime();

  if (newStart >= newEnd) {
    errors.push("Appointment start must be before end");
  }

  if (newStart < Date.now()) {
    errors.push("Cannot book appointments in the past");
  }

  for (const existingAppt of existing) {
    if (existingAppt.providerId !== newAppointment.providerId) continue;
    if (existingAppt.status === AppointmentStatus.CANCELLED) continue;

    const existingStart = new Date(existingAppt.startAt).getTime();
    const existingEnd = new Date(existingAppt.endAt).getTime();

    if (newStart < existingEnd && newEnd > existingStart) {
      errors.push(`Slot conflicts with existing appointment ${existingAppt.id}`);
    }
  }

  return { valid: errors.length === 0, errors };
}