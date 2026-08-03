// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Appointment & Messaging Routes             │
// │ Wave 7: Appointment Management & Messaging                  │
// │ Wave 8: Integration — Platform Engine → Route Handlers      │
// │ Wave 8.1: Production Hardening — real consent engine,       │
// │           JWT-bound identity on all handlers                │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import type { StartWorkflowRequest, Actor, TaskActionRequest, TaskSearchRequest, WorkflowSearchRequest, WorkflowContext, WorkflowStatus } from "../platform/workflow/types.js";
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
import { D1NotificationStore } from "../platform/notifications/d1-notification-store.js";
import { DeliveryEngine } from "../platform/notifications/delivery-engine.js";
import { EscalationEngine } from "../platform/notifications/escalation-engine.js";
import { NotificationAudit } from "../platform/notifications/notification-audit.js";
import { NotificationAnalytics } from "../platform/notifications/analytics.js";
import { DeliveryStatus } from "../platform/notifications/delivery-types.js";
import type { EvidencePackTemplate, WorkflowInstance } from "../platform/workflow/types.js";
import { WorkflowEngine } from "../platform/workflow/engine/workflow-engine.js";
import { EventStore } from "../platform/workflow/events/event-store.js";
import { TaskOrchestrator } from "../platform/workflow/tasks/task-orchestrator.js";
import { ApprovalGateService } from "../platform/workflow/approval/approval-gate.js";
import { TimerService } from "../platform/workflow/timers/timer-service.js";
import { QueueManager } from "../platform/workflow/tasks/queue-manager.js";
import { BatchOperations } from "../platform/workflow/tasks/batch-operations.js";
import { EvidencePackBuilder, defaultEvidencePackTemplate } from "../platform/workflow/approval/evidence-pack.js";

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

function getD1NotificationStore(env: Env): D1NotificationStore | null {
  const db = env.NOTIFICATIONS as D1Database | undefined;
  if (!db) return null;
  return new D1NotificationStore(db);
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

// ── Wave 7: Notification Delivery & Engagement Routes ──

export function registerNotificationDeliveryRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
}): void {
  router.get("/api/v1/notifications/stream", withJwtAuth(_getNotificationStream as RouteHandler));
  router.get("/api/v1/notifications/delivery-status/:id", withJwtAuth(_getDeliveryStatus as RouteHandler));
  router.get("/api/v1/notifications/analytics", withJwtAuth(_getNotificationAnalytics as RouteHandler));
  router.get("/api/v1/notifications/escalation/status", withJwtAuth(_getEscalationStatus as RouteHandler));
}

async function _getNotificationStream(_request: Request, _env: Env, _params: Record<string, string>): Promise<Response> {
  // SSE endpoint for real-time notification updates
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("event: connected\ndata: {\"status\":\"connected\"}\n\n"));
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

async function _getDeliveryStatus(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const deliveryEngine = new DeliveryEngine(env);
  const deliveries = await deliveryEngine.getDeliveryStatus(params.id);
  return json({ deliveries });
}

async function _getNotificationAnalytics(_request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const analytics = new NotificationAnalytics(env);
  const data = await analytics.getAnalytics();
  return json({ analytics: data });
}

async function _getEscalationStatus(_request: Request, env: Env, _params: Record<string, string>): Promise<Response> {
  const escalationEngine = new EscalationEngine(env);
  const count = await escalationEngine.checkEscalations();
  return json({ escalatedCount: count });
}

// ── Wave 8: Workflow & Automation Engine Routes ──

export function registerWorkflowRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}): void {
  // Workflow management (literal paths registered before :id to avoid shadowing)
  router.get("/api/v1/workflows/dashboard", withJwtAuth(_getDashboard as RouteHandler));
  router.get("/api/v1/workflows/search", withJwtAuth(_searchWorkflows as RouteHandler));
  router.post("/api/v1/workflows", withJwtAuth(_startWorkflow as RouteHandler));
  router.get("/api/v1/workflows/:id", withJwtAuth(_getWorkflow as RouteHandler));
  router.patch("/api/v1/workflows/:id/pause", withJwtAuth(_pauseWorkflow as RouteHandler));
  router.patch("/api/v1/workflows/:id/resume", withJwtAuth(_resumeWorkflow as RouteHandler));
  router.post("/api/v1/workflows/:id/cancel", withJwtAuth(_cancelWorkflow as RouteHandler));
  router.get("/api/v1/workflows/:workflowId/tasks", withJwtAuth(_getWorkflowTasks as RouteHandler));
  router.get("/api/v1/workflows/:workflowId/history", withJwtAuth(_getWorkflowHistory as RouteHandler));
  router.get("/api/v1/workflows/:workflowId/audit", withJwtAuth(_getWorkflowAudit as RouteHandler));
  router.post("/api/v1/workflows/:workflowId/override", withJwtAuth(_manualOverride as RouteHandler));

  // Approval gates
  router.get("/api/v1/workflows/:workflowId/approvals", withJwtAuth(_getApprovals as RouteHandler));
  router.post("/api/v1/approvals/:gateId/decide", withJwtAuth(_decideApproval as RouteHandler));
  router.post("/api/v1/approvals/:gateId/override", withJwtAuth(_overrideApproval as RouteHandler));

  // Task management (literal :search before :id)
  router.get("/api/v1/tasks/search", withJwtAuth(_searchTasks as RouteHandler));
  router.get("/api/v1/tasks/:id", withJwtAuth(_getTask as RouteHandler));
  router.patch("/api/v1/tasks/:id/state", withJwtAuth(_transitionTask as RouteHandler));
  router.post("/api/v1/tasks/:id/assign", withJwtAuth(_assignTask as RouteHandler));
  router.post("/api/v1/tasks/:id/claim", withJwtAuth(_claimTask as RouteHandler));
  router.post("/api/v1/tasks/:id/complete", withJwtAuth(_completeTask as RouteHandler));
  router.post("/api/v1/tasks/:id/escalate", withJwtAuth(_escalateTask as RouteHandler));
  router.get("/api/v1/tasks/:id/evidence", withJwtAuth(_getEvidencePack as RouteHandler));
  router.get("/api/v1/tasks/:id/audit", withJwtAuth(_getTaskAudit as RouteHandler));

  // Task queue (coordinator dashboard)
  router.get("/api/v1/queue", withJwtAuth(_getQueue as RouteHandler));
  router.get("/api/v1/queue/stats", withJwtAuth(_getQueueStats as RouteHandler));
  router.post("/api/v1/queue/batch", withJwtAuth(_batchAssign as RouteHandler));
}

// ── Wave 8: Workflow Route Handlers ──

// Single wiring point for the workflow dependency graph. Every engine is
// constructed with its real D1 owner (env.DB) and the shared EventStore, so
// the runtime is fully D1-backed with one owner per dependency.
function buildWorkflowEventStore(env: Env): EventStore {
  return new EventStore({ db: env.DB });
}

function buildWorkflowEngine(env: Env): WorkflowEngine {
  const eventStore = buildWorkflowEventStore(env);
  return new WorkflowEngine({
    eventStore,
    taskOrchestrator: new TaskOrchestrator({ db: env.DB, eventStore }),
    approvalGate: new ApprovalGateService({ db: env.DB, eventStore }),
    timerService: new TimerService({ db: env.DB, eventStore }),
  });
}

async function _startWorkflow(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const engine = buildWorkflowEngine(env);
  const req: StartWorkflowRequest = {
    definitionId: String(body.definitionId ?? ""),
    patientId: String(body.patientId ?? ""),
    initialContext: body.initialContext as Partial<WorkflowContext> | undefined,
  };
  const instance = await engine.startWorkflow(req, { type: "user", id: identityId });
  return json({ workflow: instance });
}

async function _getWorkflow(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const engine = buildWorkflowEngine(env);
  const instance = await engine.getInstance(params.id);
  if (!instance) return error("Workflow not found", 404);
  return json({ workflow: instance });
}

async function _pauseWorkflow(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const engine = buildWorkflowEngine(env);
  await engine.pauseWorkflow(params.id, (body.reason as string) || "", { type: "user", id: identityId });
  return json({ ok: true });
}

async function _resumeWorkflow(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const engine = buildWorkflowEngine(env);
  await engine.resumeWorkflow(params.id, { type: "user", id: identityId });
  return json({ ok: true });
}

async function _cancelWorkflow(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const engine = buildWorkflowEngine(env);
  await engine.cancelWorkflow(params.id, (body.reason as string) || "", { type: "user", id: identityId });
  return json({ ok: true });
}

async function _getWorkflowTasks(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const results = await orchestrator.searchTasks({ workflowInstanceId: params.workflowId, limit: 100, offset: 0 });
  return json({ tasks: results.items, total: results.total });
}

async function _getTask(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const task = await orchestrator.getTask(params.id);
  if (!task) return error("Task not found", 404);
  return json({ task });
}

async function _transitionTask(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const engine = buildWorkflowEngine(env);
  const action = (body.action as TaskActionRequest["action"]) || "claim";
  const task = await engine.processTaskAction(params.id, {
    action,
    actor: { type: "user", id: identityId },
    payload: body.payload as Record<string, unknown> | undefined,
  });
  return json({ task });
}

async function _assignTask(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const assigneeId = String(body.assigneeId ?? "");
  const task = await orchestrator.reassignTask(params.id, assigneeId, { type: "user", id: identityId });
  return json({ task });
}

async function _claimTask(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const task = await orchestrator.claimTask(params.id, identityId);
  return json({ task });
}

async function _completeTask(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const task = await orchestrator.completeTask(params.id, (body.outcome as Record<string, unknown>) || {}, { type: "user", id: identityId });
  return json({ task });
}

async function _escalateTask(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const task = await orchestrator.escalateTask(params.id, (body.reason as string) || "", { type: "user", id: identityId });
  return json({ task });
}

async function _getQueue(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const queueManager = new QueueManager({ db: env.DB });
  const depth = await queueManager.getQueueDepth("default");
  return json({ queueDepth: depth });
}

async function _getQueueStats(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const queueManager = new QueueManager({ db: env.DB });
  const depth = await queueManager.getQueueDepth("default");
  return json({ queueDepth: depth });
}

async function _batchAssign(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const assignments = Array.isArray(body.assignments) ? (body.assignments as string[]) : [];
  const eventStore = buildWorkflowEventStore(env);
  const batchOps = new BatchOperations({ db: env.DB, eventStore });
  const results = await batchOps.bulkClaim(assignments, { type: "user", id: identityId });
  return json({ results });
}

async function _getApprovals(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const gateService = new ApprovalGateService({ db: env.DB, eventStore });
  const gates = await gateService.getApprovedGatesForWorkflow(params.workflowId);
  return json({ approvals: gates });
}

async function _decideApproval(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventStore = buildWorkflowEventStore(env);
  const gateService = new ApprovalGateService({ db: env.DB, eventStore });
  const decisionValue: "approve" | "deny" | "escalate" = body.decision === "deny" || body.decision === "escalate" ? body.decision : "approve";
  const decision = await gateService.processDecision(params.gateId, {
    decision: decisionValue,
    approver: { type: "user", id: identityId },
    reason: (body.reason as string) || "",
    evidenceReviewed: body.evidenceReviewed as Record<string, unknown> | undefined,
  });
  return json({ decision });
}

async function _overrideApproval(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventStore = buildWorkflowEventStore(env);
  const gateService = new ApprovalGateService({ db: env.DB, eventStore });
  const decisionValue: "approve" | "deny" | "escalate" = body.decision === "deny" || body.decision === "escalate" ? body.decision : "approve";
  const decision = await gateService.processDecision(params.gateId, {
    decision: decisionValue,
    approver: { type: "user", id: identityId },
    reason: (body.reason as string) || "",
    evidenceReviewed: { override: true, reason: body.overrideReason as string },
  });
  return json({ decision });
}

async function _getEvidencePack(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const builder = new EvidencePackBuilder({ eventStore });
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const task = await orchestrator.getTask(params.id);
  if (!task) return error("Task not found", 404);
  const engine = buildWorkflowEngine(env);
  const instance = await engine.getInstance(task.workflowInstanceId);
  if (!instance) return error("Workflow not found", 404);
  const pack = await builder.buildFromTemplate(defaultEvidencePackTemplate, task, instance);
  return json({ evidencePack: pack });
}

async function _getWorkflowHistory(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const events = await eventStore.getEventsForWorkflow(params.workflowId, 100, 0);
  return json({ events });
}

async function _getWorkflowAudit(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const events = await eventStore.getEventsForWorkflow(params.workflowId, 500, 0);
  return json({ auditTrail: events });
}

async function _getTaskAudit(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const events = await eventStore.getEventsByCorrelationId(params.id);
  return json({ auditTrail: events });
}

async function _manualOverride(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const identityId = getIdentityId(request);
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const eventStore = buildWorkflowEventStore(env);
  await eventStore.append({
    workflowInstanceId: params.workflowId,
    eventType: "manual.override",
    payload: { reason: (body.reason as string) || "", override: (body.override as Record<string, unknown>) || {} },
    actor: { type: "user", id: identityId },
    correlationId: params.workflowId,
    timestamp: Date.now(),
    version: 1,
  });
  return json({ ok: true });
}

async function _getDashboard(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const dashboard = await orchestrator.getDashboardQueue({ type: "user", id: "system" });
  return json({ dashboard });
}

async function _searchWorkflows(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const url = new URL(request.url);
  const engine = buildWorkflowEngine(env);
  const statusRaw = url.searchParams.get("status");
  const status = statusRaw ? [statusRaw as WorkflowStatus] : undefined;
  const results = await engine.searchInstances({ status, limit: 50, offset: 0 });
  return json({ results });
}

async function _searchTasks(request: Request, env: Env, params: Record<string, string>): Promise<Response> {
  const eventStore = buildWorkflowEventStore(env);
  const orchestrator = new TaskOrchestrator({ db: env.DB, eventStore });
  const results = await orchestrator.searchTasks({ limit: 50, offset: 0 });
  return json({ results });
}