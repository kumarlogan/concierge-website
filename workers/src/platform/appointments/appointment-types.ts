// ┌─────────────────────────────────────────────────────────────┐
// │ AI Platform — Appointment Types                            │
// ════════════════════════════════════════════════════════════

export enum AppointmentStatus {
  SCHEDULED = "scheduled",
  CONFIRMED = "confirmed",
  IN_PROGRESS = "in_progress",
  COMPLETED = "completed",
  CANCELLED = "cancelled",
  NO_SHOW = "no_show",
  RESCHEDULED = "rescheduled",
}

export enum AppointmentType {
  CONSULTATION = "consultation",
  FOLLOW_UP = "follow_up",
  PROCEDURE = "procedure",
  TELEHEALTH = "telehealth",
  IN_PERSON = "in_person",
}

export enum AppointmentPriority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export interface Appointment {
  id: string;
  patientId: string;       // opaque identity reference — NOT PHI
  providerId: string;      // opaque reference
  type: AppointmentType;
  status: AppointmentStatus;
  priority: AppointmentPriority;
  startAt: string;         // ISO 8601
  endAt: string;           // ISO 8601
  durationMinutes: number;
  timezone: string;
  title: string;
  notes: string;
  location: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
  updatedBy: string;
}

export interface CreateAppointmentRequest {
  patientId: string;
  providerId: string;
  type: AppointmentType;
  startAt: string;
  durationMinutes: number;
  timezone: string;
  title: string;
  notes?: string;
  location?: string;
  priority?: AppointmentPriority;
  metadata?: Record<string, unknown>;
}

export interface UpdateAppointmentRequest {
  status?: AppointmentStatus;
  startAt?: string;
  durationMinutes?: number;
  title?: string;
  notes?: string;
  location?: string;
  priority?: AppointmentPriority;
}

export interface AppointmentFilters {
  patientId?: string;
  providerId?: string;
  status?: AppointmentStatus[];
  type?: AppointmentType[];
  startFrom?: string;
  startTo?: string;
  limit?: number;
  offset?: number;
}