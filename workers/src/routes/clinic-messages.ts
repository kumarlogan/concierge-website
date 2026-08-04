// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy API — Clinic Messaging Endpoints                  │
// │ Clinic-specific messaging: triage queue, message templates, │
// │ patient message overview.                                    │
// └─────────────────────────────────────────────────────────────┘

import type { Env, RouteHandler } from "../types/env.js";
import { InMemoryMessageEngine } from "../platform/messaging/in-memory-message-engine.js";
import { MessageType, MessageStatus } from "../platform/messaging/message-types.js";
import { withJwtAuth } from "../middleware/jwt-auth.js";

// ── Shared engine instances ──────────────────────────────────

function getMessageEngine(_env: Env): InMemoryMessageEngine {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if (!(globalThis as any).__messageEngine) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).__messageEngine = new InMemoryMessageEngine();
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (globalThis as any).__messageEngine;
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

// ── Message Templates ──────────────────────────────────────

interface MessageTemplate {
  id: string;
  title: string;
  content: string;
  category: string;
}

const _messageTemplates: MessageTemplate[] = [
  {
    id: "template-001",
    title: "Appointment Reminder",
    content: "Dear {patientName}, this is a reminder of your upcoming appointment on {appointmentDate} at {appointmentTime}. Please arrive 15 minutes early.",
    category: "appointment",
  },
  {
    id: "template-002",
    title: "Test Results Available",
    content: "Dear {patientName}, your recent test results are now available. Please schedule a follow-up appointment to discuss them with your provider.",
    category: "results",
  },
  {
    id: "template-003",
    title: "Welcome Message",
    content: "Dear {patientName}, welcome to our clinic! We look forward to supporting you on your fertility journey. Please complete your intake forms before your first appointment.",
    category: "onboarding",
  },
  {
    id: "template-004",
    title: "Follow-up Request",
    content: "Dear {patientName}, your provider has requested a follow-up appointment. Please contact the clinic to schedule at your earliest convenience.",
    category: "follow-up",
  },
  {
    id: "template-005",
    title: "Cancellation Confirmation",
    content: "Dear {patientName}, your appointment on {appointmentDate} has been cancelled as requested. If you would like to reschedule, please contact the clinic.",
    category: "appointment",
  },
];

// ── Handler Implementations ─────────────────────────────────

async function _getTriageQueue(
  _request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  // Build triage from real patients. Message counts are unavailable until
  // messaging is migrated to D1 (tracked as a separate backlog item).
  const rows = await env.DB.prepare(
    `SELECT id, display_name, email, status, last_login_at, updated_at
     FROM identities
     WHERE identity_type = 'patient' AND status IN ('verified', 'active')
     ORDER BY updated_at DESC LIMIT 50`
  ).all<{ id: string; display_name: string | null; email: string | null; status: string; last_login_at: string | null; updated_at: string }>();

  const queue = (rows.results ?? []).map(r => ({
    patientId: r.id,
    patientName: r.display_name ?? "Unknown",
    email: r.email ?? "",
    status: r.status,
    lastActivityAt: r.last_login_at ?? r.updated_at,
    unreadCount: 0,           // in-memory messaging; count not available from D1
    priority: "medium" as const,
    flagged: false,
  }));

  return json({ queue });
}

async function _getMessageTemplates(
  _request: Request,
  _env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const url = new URL(_request.url);
  const category = url.searchParams.get("category");

  let templates = _messageTemplates;
  if (category) {
    templates = templates.filter((t) => t.category === category);
  }

  return json({ templates });
}

async function _getPatientThreads(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getMessageEngine(env);
  const url = new URL(request.url);
  const patientId = url.searchParams.get("patientId");

  if (!patientId) {
    return error("patientId query parameter required");
  }

  const threads = await engine.listThreads(patientId, 50, 0);
  return json({ threads });
}

async function _sendClinicMessage(
  request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const engine = getMessageEngine(env);
  try {
    const body = await request.json();

    // Validate required fields
    if (!body.recipientId || !body.content) {
      return error("recipientId and content are required");
    }

    const message = await engine.send(
      {
        threadId: body.threadId || `thread-${Date.now()}`,
        senderId: "clinic",
        recipientId: body.recipientId,
        type: MessageType.TEXT,
        subject: body.subject || null,
        content: body.content,
        contentType: "text/plain",
        metadata: body.metadata || {},
      },
      { decision: "allow" as any, consentTypes: ["messaging"], verified: true },
    );

    return json({ message }, 201);
  } catch (err) {
    return error(err instanceof Error ? err.message : "Failed to send message", 400);
  }
}

async function _flagThread(
  _request: Request,
  _env: Env,
  params: Record<string, string>,
): Promise<Response> {
  // In production this would update a DB record
  return json({ flagged: true, threadId: params.threadId });
}

async function _getPatientConversations(
  _request: Request,
  env: Env,
  _params: Record<string, string>,
): Promise<Response> {
  const rows = await env.DB.prepare(
    `SELECT id, display_name, email, updated_at
     FROM identities WHERE identity_type = 'patient'
     ORDER BY updated_at DESC LIMIT 50`
  ).all<{ id: string; display_name: string | null; email: string | null; updated_at: string }>();

  const conversations = (rows.results ?? []).map(r => ({
    threadId: `thread-${r.id}`,
    patientId: r.id,
    patientName: r.display_name ?? "Unknown",
    lastMessage: null,
    lastMessageAt: r.updated_at,
    unreadCount: 0,
  }));

  return json({ conversations });
}

// ── Route Registration ─────────────────────────────────────

export function registerClinicMessageRoutes(router: {
  get: (path: string, handler: RouteHandler) => void;
  post: (path: string, handler: RouteHandler) => void;
  patch: (path: string, handler: RouteHandler) => void;
}): void {
  // Triage queue
  router.get("/api/v1/clinic/messages/triage", withJwtAuth(_getTriageQueue as RouteHandler));

  // Templates
  router.get("/api/v1/clinic/messages/templates", withJwtAuth(_getMessageTemplates as RouteHandler));

  // Patient threads
  router.get("/api/v1/clinic/messages/patients", withJwtAuth(_getPatientConversations as RouteHandler));
  router.get("/api/v1/clinic/messages/threads", withJwtAuth(_getPatientThreads as RouteHandler));

  // Send clinic message
  router.post("/api/v1/clinic/messages/send", withJwtAuth(_sendClinicMessage as RouteHandler));

  // Flag thread
  router.patch("/api/v1/clinic/messages/threads/:threadId/flag", withJwtAuth(_flagThread as RouteHandler));
}
