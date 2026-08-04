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

// ── Patient Record type (D1-backed) ─────────────────────────

interface PatientRecord {
  id: string;
  name: string;        // display_name ?? 'Unknown'
  email: string;       // email ?? ''
  status: string;      // identity status: 'registered'|'verified'|'active' etc.
  createdAt: string;
  lastLoginAt: string | null;
}

// ── Handler Implementations ─────────────────────────────────

async function _listPatients(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const search = url.searchParams.get("search")?.toLowerCase();
  const limit = Math.min(parseInt(url.searchParams.get("limit") ?? "50", 10), 100);
  const offset = parseInt(url.searchParams.get("offset") ?? "0", 10);

  let sql = `SELECT id, display_name, email, status, created_at, last_login_at
             FROM identities WHERE identity_type = 'patient'`;
  const params: (string | number)[] = [];

  if (status) {
    sql += ` AND status = ?`;
    params.push(status);
  }
  // search: approximate match via LIKE on display_name or email
  if (search) {
    sql += ` AND (LOWER(display_name) LIKE ? OR LOWER(email) LIKE ?)`;
    params.push(`%${search}%`, `%${search}%`);
  }

  const countSql = sql.replace(
    "SELECT id, display_name, email, status, created_at, last_login_at",
    "SELECT COUNT(*) AS cnt"
  );
  const countRow = await env.DB.prepare(countSql).bind(...params).first<{ cnt: number }>();
  const total = countRow?.cnt ?? 0;

  sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const rows = await env.DB.prepare(sql).bind(...params).all<{
    id: string; display_name: string | null; email: string | null;
    status: string; created_at: string; last_login_at: string | null;
  }>();

  const patients = (rows.results ?? []).map(r => ({
    id: r.id,
    name: r.display_name ?? "Unknown",
    email: r.email ?? "",
    status: r.status,
    createdAt: r.created_at,
    lastLoginAt: r.last_login_at,
  }));

  return json({ patients, total, limit, offset });
}

async function _getPatient(
  _request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const row = await env.DB.prepare(
    `SELECT id, display_name, email, status, created_at, last_login_at
     FROM identities WHERE id = ? AND identity_type = 'patient' LIMIT 1`
  ).bind(params.id).first<{ id: string; display_name: string | null; email: string | null; status: string; created_at: string; last_login_at: string | null }>();

  if (!row) return error("Patient not found", 404);

  return json({
    patient: {
      id: row.id,
      name: row.display_name ?? "Unknown",
      email: row.email ?? "",
      status: row.status,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
    }
  });
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
