// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Appointment Audit Logger                        │
// ════════════════════════════════════════════════════════════

import type { Appointment, AppointmentStatus } from "./appointment-types.js";

export interface AppointmentAuditEvent {
  action: "created" | "updated" | "cancelled" | "completed" | "rescheduled";
  appointmentId: string;
  patientId: string;
  performedBy: string;
  timestamp: string;
  changes: Record<string, { from: unknown; to: unknown }>;
  metadata: Record<string, unknown>;
}

export interface AppointmentAuditLogger {
  log(event: AppointmentAuditEvent): Promise<void>;
  getHistory(appointmentId: string): Promise<AppointmentAuditEvent[]>;
}