// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Clinic Routes                                │
// │ Clinic-specific API endpoints: manage schedules, list        │
// │ patients, provider workflows.                                │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { InMemoryAppointmentEngine } from "../platform/appointments/in-memory-appointment-engine.js";
import type { AppointmentFilters } from "../platform/appointments/appointment-types.js";
import { AppointmentStatus, AppointmentType } from "../platform/appointments/appointment-types.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";

// ── Shared engine instances ──────────────────────────────────

function getAppointmentEngine(_env: Env): InMemoryAppointmentEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__appointmentEngine) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__appointmentEngine = new InMemoryAppointmentEngine();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__appointmentEngine;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ── Mock patient data (in-memory for demonstration) ─────────

interface PatientRecord {
  id: string;
  name: string;
  email: string;
  status: string;
  lastAppointment: string | null;
  nextAppointment: string | null;
  providerId: string;
}

const _mockPatients: PatientRecord[] = [
  { id: "patient-001", name: "Alice Johnson", email: "alice@example.com", status: "active", lastAppointment: "2026-07-20T10:00:00Z", nextAppointment: "2026-08-03T14:00:00Z", providerId: "provider-001" },
  { id: "patient-002", name: "Bob Smith", email: "bob@example.com", status: "active", lastAppointment: "2026-07-18T09:00:00Z", nextAppointment: "2026-08-01T11:00:00Z", providerId: "provider-001" },
  { id: "patient-003", name: "Carol Davis", email: "carol@example.com", status: "pending", lastAppointment: null, nextAppointment: "2026-07-28T15:00:00Z", providerId: "provider-002" },
  { id: "patient-004", name: "David Wilson", email: "david@example.com", status: "completed", lastAppointment: "2026-06-15T10:00:00Z", nextAppointment: null, providerId: "provider-001" },
  { id: "patient-005", name: "Eva Martinez", email: "eva@example.com", status: "active", lastAppointment: "2026-07-25T13:00:00Z", nextAppointment: "2026-08-10T09:00:00Z", providerId: "provider-002" },
  { id: "patient-006", name: "Frank Brown", email: "frank@example.com", status: "inactive", lastAppointment: "2026-05-01T10:00:00Z", nextAppointment: null, providerId: "provider-002" },
  { id: "patient-007", name: "Grace Lee", email: "grace@example.com", status: "active", lastAppointment: "2026-07-22T11:00:00Z", nextAppointment: "2026-08-05T10:00:00Z", providerId: "provider-001" },
  { id: "patient-008", name: "Henry Kim", email: "henry@example.com", status: "pending", lastAppointment: null, nextAppointment: "2026-07-30T14:00:00Z", providerId: "provider-001" },
];

// ── Handler Implementations ─────────────────────────────────

async function _listPatients(
  request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const providerId = url.searchParams.get("providerId");
  const search = url.searchParams.get("search")?.toLowerCase();

  let patients = [..._mockPatients];

  if (status) {
    patients = patients.filter((p) => p.status === status);
  }
  if (providerId) {
    patients = patients.filter((p) => p.providerId === providerId);
  }
  if (search) {
    patients = patients.filter(
      (p) =>
        p.name.toLowerCase().includes(search) ||
        p.email.toLowerCase().includes(search) ||
        p.id.toLowerCase().includes(search),
    );
  }

  return json({ patients });
}

async function _getPatient(
  _request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const patient = _mockPatients.find((p) => p.id === params.id);
  if (!patient) {
    return error("Patient not found", 404);
  }
  return json({ patient });
}

async function _getClinicSchedule(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const url = new URL(request.url);

  const filters: AppointmentFilters = {};
  const providerId = url.searchParams.get("providerId");
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const startFrom = url.searchParams.get("startFrom");
  const startTo = url.searchParams.get("startTo");
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  if (providerId) filters.providerId = providerId;
  if (status) filters.status = [status as AppointmentStatus];
  if (type) filters.type = [type as AppointmentType];
  if (startFrom) filters.startFrom = startFrom;
  if (startTo) filters.startTo = startTo;
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  const appointments = await engine.list(filters);
  return json({ appointments });
}

async function _confirmAppointment(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  try {
    const appointment = await engine.update(params.id, {
      status: AppointmentStatus.CONFIRMED,
    });
    return json({ appointment });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to confirm appointment", 400);
  }
}

async function _getTodaySchedule(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId");

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const filters: AppointmentFilters = {
    startFrom: today.toISOString(),
    startTo: tomorrow.toISOString(),
    status: [
      AppointmentStatus.SCHEDULED,
      AppointmentStatus.CONFIRMED,
      AppointmentStatus.IN_PROGRESS,
    ],
  };

  if (providerId) filters.providerId = providerId;

  const appointments = await engine.list(filters);
  return json({ appointments, date: today.toISOString() });
}

// ── Route Registration ─────────────────────────────────────

export function registerClinicRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}): void {
  // Patient management
  router.get("/api/v1/clinic/patients", withJwtAuth(_listPatients as RouteHandler));
  router.get("/api/v1/clinic/patients/:id", withJwtAuth(_getPatient as RouteHandler));

  // Schedule management
  router.get("/api/v1/clinic/schedule", withJwtAuth(_getClinicSchedule as RouteHandler));
  router.get("/api/v1/clinic/schedule/today", withJwtAuth(_getTodaySchedule as RouteHandler));
  router.patch("/api/v1/clinic/appointments/:id/confirm", withJwtAuth(_confirmAppointment as RouteHandler));
}