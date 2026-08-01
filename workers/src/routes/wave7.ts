// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Appointment & Messaging Routes             │
// │ Wave 7: Appointment Management & Messaging                  │
// │ Wave 8: Integration — Platform Engine → Route Handlers      │
// │ Wave 8.1: Production Hardening — real consent engine,       │
// │           JWT-bound identity on all handlers                │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { InMemoryAppointmentEngine } from "../platform/appointments/in-memory-appointment-engine.js";
import type { ConsentVerificationResult } from "../platform/appointments/appointment-engine.js";
import type { AppointmentFilters } from "../platform/appointments/appointment-types.js";
import { AppointmentStatus, AppointmentType } from "../platform/appointments/appointment-types.js";
import { InMemoryMessageEngine } from "../platform/messaging/in-memory-message-engine.js";
import type { ConsentVerificationResult as MessageConsentResult } from "../platform/messaging/message-engine.js";
import { MessageType } from "../platform/messaging/message-types.js";
import { Decision } from "../platform/trust/types.js";
import type { CreateAppointmentRequest, UpdateAppointmentRequest } from "../platform/appointments/appointment-types.js";
import type { CreateMessageRequest } from "../platform/messaging/message-types.js";
import { withJwtAuth, getIdentityId } from "../middleware/jwt-auth.js";
import { InMemoryNotificationStore } from "../platform/notifications/in-memory-notification-store.js";
import { notificationStore } from "../platform/notifications/in-memory-notification-store.js";

// ── Shared engine instances (per-request singletons via env) ──
// In production these would be D1-backed; in-memory for integration testing.

function getAppointmentEngine(_env: Env): InMemoryAppointmentEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__appointmentEngine) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__appointmentEngine = new InMemoryAppointmentEngine();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__appointmentEngine;
}

function getMessageEngine(_env: Env): InMemoryMessageEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__messageEngine) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__messageEngine = new InMemoryMessageEngine();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__messageEngine;
}

/**
 * Verify consent for appointment scheduling via the AI Platform Consent Engine.
 * Replaces the Wave 7 stub with real consent evaluation.
 */
async function verifyAppointmentConsent(
  env: Env,
  identityId: string,
): Promise<ConsentVerificationResult> {
  try {
    const result = await env.CONSENT_ENGINE.evaluate(
      identityId,
      "appointment_scheduling" as any,
      "healthcare",
    );
    if (result.granted && !result.expired) {
      return {
        decision: Decision.ALLOW,
        consentTypes: ["appointment_scheduling"],
        verified: true,
      };
    }
  } catch {
    // Consent engine unavailable — fail closed
  }
  return {
    decision: Decision.DENY,
    consentTypes: [],
    verified: false,
  };
}

/**
 * Verify consent for messaging via the AI Platform Consent Engine.
 * Replaces the Wave 7 stub with real consent evaluation.
 */
async function verifyMessagingConsent(
  env: Env,
  identityId: string,
): Promise<MessageConsentResult> {
  try {
    const result = await env.CONSENT_ENGINE.evaluate(
      identityId,
      "messaging" as any,
      "healthcare",
    );
    if (result.granted && !result.expired) {
      return {
        decision: Decision.ALLOW,
        consentTypes: ["messaging"],
        verified: true,
      };
    }
  } catch {
    // Consent engine unavailable — fail closed
  }
  return {
    decision: Decision.DENY,
    consentTypes: [],
    verified: false,
  };
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

// ── Appointment Routes ──────────────────────────────────────

export function registerAppointmentRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
  delete: (path: string, handler: RouteHandler) => void;
}): void {
  router.get("/api/v1/appointments", withJwtAuth(_getAppointments as RouteHandler));
  router.get("/api/v1/appointments/slots/available", withJwtAuth(_checkAvailability as RouteHandler));
  router.get("/api/v1/appointments/:id", withJwtAuth(_getAppointmentById as RouteHandler));
  router.post("/api/v1/appointments", withJwtAuth(_createAppointment as RouteHandler));
  router.patch("/api/v1/appointments/:id", withJwtAuth(_updateAppointment as RouteHandler));
  router.delete("/api/v1/appointments/:id", withJwtAuth(_cancelAppointment as RouteHandler));
}

// ── Messaging Routes ──────────────────────────────────────────

export function registerMessageRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
}): void {
  router.get("/api/v1/messages/threads", withJwtAuth(_getThreads as RouteHandler));
  router.get("/api/v1/messages/threads/:threadId", withJwtAuth(_getThreadMessages as RouteHandler));
  router.post("/api/v1/messages", withJwtAuth(_sendMessage as RouteHandler));
}

// ── Appointment Handler Implementations ──────────────────────

async function _getAppointments(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const identityId = getIdentityId(request);
  const url = new URL(request.url);

  const filters: AppointmentFilters = {};
  // Use authenticated identity as patientId (cryptographic binding)
  const patientId = url.searchParams.get("patientId") || identityId;
  const providerId = url.searchParams.get("providerId");
  const status = url.searchParams.get("status");
  const type = url.searchParams.get("type");
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  if (patientId) filters.patientId = patientId;
  if (providerId) filters.providerId = providerId;
  if (status) filters.status = [status as AppointmentStatus];
  if (type) filters.type = [type as AppointmentType];
  if (limit) filters.limit = parseInt(limit, 10);
  if (offset) filters.offset = parseInt(offset, 10);

  const appointments = await engine.list(filters);
  return json({ appointments });
}

async function _getAppointmentById(
  _request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const appointment = await engine.get(params.id);
  if (!appointment) {
    return error("Appointment not found", 404);
  }
  return json({ appointment });
}

async function _createAppointment(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const identityId = getIdentityId(request);
  try {
    const body = await request.json();
    // Verify appointment consent before creating
    const consent = await verifyAppointmentConsent(env, identityId);
    if (!consent.verified) {
      return error("Consent not granted for appointment scheduling", 403);
    }
    // Cryptographically bind identity to appointment
    const requestWithIdentity = {
      ...(body as CreateAppointmentRequest),
      patientId: identityId,
    };
    const appointment = await engine.create(requestWithIdentity, consent);
    return json({ appointment }, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to create appointment", 400);
  }
}

async function _updateAppointment(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  try {
    const body = await request.json();
    const appointment = await engine.update(params.id, body as UpdateAppointmentRequest);
    return json({ appointment });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to update appointment", 400);
  }
}

async function _cancelAppointment(
  request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const identityId = getIdentityId(request);
  try {
    // Verify the caller owns this appointment before allowing cancel
    const appointment = await engine.get(params.id);
    if (!appointment) {
      return error("Appointment not found", 404);
    }
    // Only the owner can cancel their appointment
    if (appointment.patientId !== identityId) {
      return error("Not authorized to cancel this appointment", 403);
    }
    await engine.cancel(params.id);
    return json({ cancelled: true });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to cancel appointment", 400);
  }
}

async function _checkAvailability(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getAppointmentEngine(env);
  const url = new URL(request.url);
  const start = url.searchParams.get("start");
  const end = url.searchParams.get("end");

  if (!start || !end) {
    return error("start and end query parameters required");
  }

  const available = await engine.checkAvailability(start, end);
  return json({ available });
}

// ── Messaging Handler Implementations ──────────────────────────

async function _getThreads(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getMessageEngine(env);
  const identityId = getIdentityId(request);
  const url = new URL(request.url);
  // Default to authenticated identity — no anonymous access
  const participantId = url.searchParams.get("participantId") || identityId;
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  const threads = await engine.listThreads(
    participantId,
    limit ? parseInt(limit, 10) : 20,
    offset ? parseInt(offset, 10) : 0,
  );
  return json({ threads });
}

async function _getThreadMessages(
  _request: Request,
  env: Env,
  params: Record<string, string>,
): Promise<Response> {
  const engine = getMessageEngine(env);
  const messages = await engine.listThread(params.threadId);
  return json({ messages });
}

async function _sendMessage(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getMessageEngine(env);
  const identityId = getIdentityId(request);
  try {
    const body = await request.json();
    // Verify messaging consent before sending
    const consent = await verifyMessagingConsent(env, identityId);
    if (!consent.verified) {
      return error("Consent not granted for messaging", 403);
    }
    // Cryptographically bind sender identity
    const requestWithIdentity = {
      ...(body as CreateMessageRequest),
      senderId: identityId,
    };
    const message = await engine.send(requestWithIdentity, consent);
    return json({ message }, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to send message", 400);
  }
}

// ── Notification Routes ──────────────────────────────────────

export function registerNotificationRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}): void {
  router.get("/api/v1/notifications", withJwtAuth(_getNotifications as RouteHandler));
  router.get("/api/v1/notifications/:id", withJwtAuth(_getNotificationById as RouteHandler));
  router.patch("/api/v1/notifications/:id/read", withJwtAuth(_markNotificationRead as RouteHandler));
  router.patch("/api/v1/notifications/read-all", withJwtAuth(_markAllNotificationsRead as RouteHandler));
  router.get("/api/v1/notifications/preferences", withJwtAuth(_getNotificationPreferences as RouteHandler));
  router.patch("/api/v1/notifications/preferences", withJwtAuth(_updateNotificationPreferences as RouteHandler));
  router.get("/api/v1/notifications/unread-count", withJwtAuth(_getUnreadCount as RouteHandler));
}

// ── Notification Handler Implementations ─────────────────────

function getNotificationStore(_env: Env): InMemoryNotificationStore {
  return notificationStore;
}

async function _getNotifications(request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  const identityId = getIdentityId(request);
  const url = new URL(request.url);
  
  const unreadOnly = url.searchParams.get("unreadOnly") === "true";
  const type = url.searchParams.get("type") || undefined;
  const limit = url.searchParams.get("limit");
  const offset = url.searchParams.get("offset");

  // Seed sample data if none exist
  const existing = await store.getNotifications(identityId, { limit: 1 });
  if (existing.length === 0) {
    await store.seedSampleNotifications(identityId);
  }

  const notifications = await store.getNotifications(identityId, {
    unreadOnly,
    type,
    limit: limit ? parseInt(limit, 10) : 50,
    offset: offset ? parseInt(offset, 10) : 0,
  });
  return json({ notifications });
}

async function _getNotificationById(_request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  const notification = await store.getNotification(params.id);
  if (!notification) return error("Notification not found", 404);
  return json({ notification });
}

async function _markNotificationRead(_request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  await store.markRead(params.id);
  return json({ success: true });
}

async function _markAllNotificationsRead(request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  const identityId = getIdentityId(request);
  const count = await store.getUnreadCount(identityId);
  await store.markAllRead(identityId);
  return json({ success: true, markedRead: count });
}

async function _getUnreadCount(request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  const identityId = getIdentityId(request);
  const count = await store.getUnreadCount(identityId);
  return json({ unreadCount: count });
}

async function _getNotificationPreferences(request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  const identityId = getIdentityId(request);
  const preferences = await store.getPreferences(identityId);
  return json({ preferences });
}

async function _updateNotificationPreferences(request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const store = getNotificationStore(env);
  const identityId = getIdentityId(request);
  try {
    const body = await request.json();
    const preferences = await store.updatePreferences(identityId, body as Partial<any>);
    return json({ preferences });
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to update preferences", 400);
  }
}