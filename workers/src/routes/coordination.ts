// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Appointment Coordination Routes              │
// │ Cross-provider scheduling, multi-party coordination,         │
// │ conflict resolution for clinic workflows.                    │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { InMemoryAppointmentEngine } from "../platform/appointments/in-memory-appointment-engine.js";
import { AppointmentCoordinationService } from "../platform/appointments/coordination-service.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";

// ── Shared engine instance ──────────────────────────────────

function getAppointmentEngine(_env: Env): InMemoryAppointmentEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__appointmentEngine) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__appointmentEngine = new InMemoryAppointmentEngine();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__appointmentEngine;
}

function getCoordinationService(env: Env): AppointmentCoordinationService {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__coordinationService) {
    const engine = getAppointmentEngine(env);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__coordinationService = new AppointmentCoordinationService(
      (filters) => engine.list(filters),
      (data) => engine.create(data, { decision: "allow" as any, consentTypes: [], verified: true }),
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__coordinationService;
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

// ── Handler Implementations ─────────────────────────────────

async function _coordinateAppointment(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  try {
    const service = getCoordinationService(env);
    const body = await request.json();
    const result = await service.coordinateAppointment(body as any);
    return json(result, result.success ? 201 : 409);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to coordinate appointment", 400);
  }
}

async function _checkMultiProviderAvailability(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  try {
    const service = getCoordinationService(env);
    const url = new URL(request.url);
    const providerIdsStr = url.searchParams.get("providerIds");
    const startAt = url.searchParams.get("startAt");
    const endAt = url.searchParams.get("endAt");

    if (!providerIdsStr || !startAt || !endAt) {
      return error("providerIds, startAt, and endAt query parameters required");
    }

    const providerIds = providerIdsStr.split(",");
    const results = await service.checkMultiProviderAvailability(providerIds, startAt, endAt);
    return json({ slots: results });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to check availability", 400);
  }
}

async function _suggestAlternatives(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  try {
    const service = getCoordinationService(env);
    const body = await request.json();
    const suggestions = await service.suggestAlternatives(
      body.request as any,
      body.unavailableProviderIds as string[],
      body.durationMinutes as number,
    );
    return json({ suggestions });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to suggest alternatives", 400);
  }
}

async function _rescheduleCoordinated(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  try {
    const service = getCoordinationService(env);
    const body = await request.json();
    const result = await service.rescheduleCoordinatedAppointment(
      params.id,
      body.startAt as string,
      body.durationMinutes as number,
    );
    return json(result, result.success ? 200 : 409);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to reschedule", 400);
  }
}

// ── Route Registration ─────────────────────────────────────

export function registerCoordinationRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}): void {
  router.post(
    "/api/v1/coordination/coordinate",
    withJwtAuth(_coordinateAppointment as RouteHandler),
  );
  router.get(
    "/api/v1/coordination/availability",
    withJwtAuth(_checkMultiProviderAvailability as RouteHandler),
  );
  router.post(
    "/api/v1/coordination/suggest",
    withJwtAuth(_suggestAlternatives as RouteHandler),
  );
  router.patch(
    "/api/v1/coordination/reschedule/:id",
    withJwtAuth(_rescheduleCoordinated as RouteHandler),
  );
}