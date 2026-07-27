// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Appointments & Messaging Module Index              │
// ═══════════════════════════════════════════════════════════

export { AppointmentStatus, AppointmentType, AppointmentPriority } from "./appointment-types.js";
export type { Appointment, CreateAppointmentRequest, UpdateAppointmentRequest, AppointmentFilters } from "./appointment-types.js";
export { checkSlotConflict } from "./appointment-validation.js";
export type { AppointmentAuditEvent, AppointmentAuditLogger } from "./appointment-audit.js";
export { MessageStatus, MessageType } from "./../messaging/message-types.js";
export type { Message, CreateMessageRequest, ThreadQuery } from "./../messaging/message-types.js";
export type { MessageAuditEvent, MessageAuditLogger } from "./../messaging/message-audit.js";