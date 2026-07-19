// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Operations Telegram Bot (MVP)           │
// │ EPIC-002-004-IMPL: Operations Telegram Bot — Implementation   │
// └─────────────────────────────────────────────────────────────┘
//
// Thin Telegram client over the existing Operations API.
//
// DESIGN (see docs/bots/OPERATIONS_BOT_SPECIFICATION.md):
//   Telegram Update → webhook → [auth middleware] → Ops API → D1
//
// This module is a PRESENTATION layer only. It contains:
//   - Telegram Update parsing (safe, ignores unsupported types)
//   - Command routing (/start /help /dashboard /leads /lead)
//   - A thin gate that reuses the EXISTING authorization middleware
//     (requirePermission) and the EXISTING Ops route handlers. The bot
//     never reads D1, never holds business logic, and never bypasses RBAC.
//   - Human-readable text formatters for the Ops API responses.
//
// All lead data, filtering, pagination, authorization, and audit live in
// src/services/opsService.ts + src/auth/* — exactly as the HTTP API uses them.
// The bot is a second client of that same surface.

import type { Env, RouteHandler } from "../types/env.js";
import { requirePermission } from "../auth/middleware.js";
import {
  getOpsDashboard,
  listOpsLeads,
  getOpsLead,
  attachPrincipal,
  type OpsPrincipal,
} from "./ops.js";

// ════════════════════════════════════════════════════════════════
// Telegram types (subset needed to parse inbound Updates)
// ════════════════════════════════════════════════════════════════

interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramChat {
  id: number;
  type: string; // "private" | "group" | "supergroup" | "channel"
  first_name?: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: TelegramChat;
  text?: string;
  date?: number;
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramMessage;
  // Other update types (callback_query, edited_message, etc.) are explicitly
  // NOT handled by the MVP. They are detected and ignored gracefully.
  [key: string]: unknown;
}

// ════════════════════════════════════════════════════════════════
// Webhook entry point
// ════════════════════════════════════════════════════════════════

/**
 * POST /telegram/webhook — Telegram sends Update payloads here.
 *
 * Responsibilities:
 *   1. Parse + validate the Update JSON (safe; never throws to caller).
 *   2. Reject anything that is not a private-chat message (unsupported types).
 *   3. Build an internal Request carrying the Telegram identity headers and
 *      dispatch to the matching command handler.
 *
 * The handler returns a 200 quickly (Telegram requires a fast 2xx ack). All
 * user-facing text is produced by the command handlers; this function only
 * frames the response.
 */
export const telegramWebhook: RouteHandler = async (request, env, _params) => {
  // Telegram secret verification (if configured). Kept out of source code —
  // the secret lives in the Worker environment binding `TELEGRAM_BOT_TOKEN`.
  const configuredToken = (env as { TELEGRAM_BOT_TOKEN?: string }).TELEGRAM_BOT_TOKEN;
  const providedToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (configuredToken && providedToken && providedToken !== configuredToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    const raw = await request.text();
    if (!raw) return telegramAck();
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    // Malformed webhook body — acknowledge to avoid Telegram retries, but log.
    console.warn("telegram.webhook: malformed JSON body");
    return telegramAck();
  }

  // Unsupported update type (callback_query, edited_message, etc.) → ignore.
  if (!update.message || typeof update.message !== "object") {
    return telegramAck();
  }

  const message = update.message;

  // Only private chats are supported in the MVP.
  if (message.chat?.type !== "private") {
    return telegramAck();
  }

  // No sender (shouldn't happen) or missing text → ignore.
  if (!message.from || !message.text) {
    return telegramAck();
  }

  const chatId = String(message.chat.id);
  const displayName = formatDisplayName(message.from);

  // Build an internal request that carries the Telegram identity the same way
  // the HTTP API expects it. The existing auth engine resolves identity from
  // these exact headers (see src/auth/providers.ts).
  const identityHeaders: Record<string, string> = {
    "X-Telegram-Chat-Id": chatId,
    "X-Telegram-Display-Name": displayName,
  };

  const text = message.text.trim();
  const reply = await dispatchCommand(text, identityHeaders, env);

  // Telegram-compatible response: the Worker fetch handler can optionally
  // forward this to the Telegram Send Message API. For the MVP we return the
  // rendered text as the body so it can be delivered (the gateway / a
  // subsequent step posts it back to Telegram). 200 status = ack.
  return new Response(JSON.stringify({ method: "sendMessage", chat_id: chatId, text: reply }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};

/** A bare 200 acknowledgment (no reply) for ignored updates. */
function telegramAck(): Response {
  return new Response("OK", { status: 200 });
}

function formatDisplayName(user: TelegramUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ") || user.username || `tg-${user.id}`;
}

// ════════════════════════════════════════════════════════════════
// Command dispatch
// ════════════════════════════════════════════════════════════════

/**
 * Route a command string to its handler. All handlers delegate to the EXISTING
 * Ops API handlers (which themselves delegate to opsService). The bot adds
 * only: identity framing, command parsing, and text rendering.
 */
async function dispatchCommand(
  text: string,
  identityHeaders: Record<string, string>,
  env: Env,
): Promise<string> {
  // Telegram commands may arrive as "/lead@BotName 123" — strip the bot suffix.
  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = rawCmd.toLowerCase().split("@")[0];
  const arg = rest.join(" ").trim();

  switch (cmd) {
    case "/start":
      return renderStart();
    case "/help":
      return renderHelp();
    case "/dashboard":
      return callOps(() => buildInternalRequest("GET", "/api/v1/ops/dashboard", identityHeaders), getOpsDashboard, "leads.read", env);
    case "/leads":
      return callOps(() => buildInternalRequest("GET", "/api/v1/ops/leads?limit=10&offset=0", identityHeaders), listOpsLeads, "leads.read", env);
    case "/lead":
      return handleLead(arg, identityHeaders, env);
    default:
      return renderUnknownCommand();
  }
}

/**
 * Build an internal Request carrying Telegram identity headers. This is the
 * SAME mechanism the HTTP API uses; the bot does not invent a new auth path.
 */
function buildInternalRequest(
  method: string,
  path: string,
  identityHeaders: Record<string, string>,
): Request {
  return new Request(`https://internal.local${path}`, {
    method,
    headers: { "Content-Type": "application/json", ...identityHeaders },
  });
}

/**
 * Thin gate that reuses the EXISTING authorization middleware + Ops handler.
 * Mirrors the 6-line `opsRoute` wrapper in src/index.ts — it does NOT duplicate
 * business logic. The gate guarantees every bot action flows through RBAC and
 * audit before reaching the service layer.
 */
async function callOps(
  buildReq: () => Request,
  handler: RouteHandler,
  permission: string,
  env: Env,
): Promise<string> {
  const request = buildReq();
  const result = await requirePermission(env.DB, request, permission);
  if (!result.authorized) {
    return renderAuthError(result.response.status);
  }
  const principal: OpsPrincipal = {
    userId: result.principal.userId,
    roleName: result.principal.roleName,
  };
  attachPrincipal(request, principal);
  const params = pathParamsFromUrl(new URL(request.url));
  const response = await handler(request, env, params);
  return renderOpsResponse(permission, response);
}

/**
 * Extract path parameters for the Ops handlers from a bot-built internal URL.
 * The Ops routes use a single trailing `:id` segment
 * (`/api/v1/ops/leads/:id`, `/api/v1/ops/leads/:id/assign`), so we mirror that
 * convention here. This keeps the bot consistent with the HTTP router without
 * duplicating the full route table.
 */
function pathParamsFromUrl(url: URL): Record<string, string> {
  const m = url.pathname.match(/\/leads\/([^/]+)(?:\/assign)?$/);
  if (m) return { id: decodeURIComponent(m[1]) };
  return {};
}

async function handleLead(
  arg: string,
  identityHeaders: Record<string, string>,
  env: Env,
): Promise<string> {
  const leadId = arg.trim();
  if (!leadId) {
    return renderMalformed("lead", "Usage: /lead <id>  — e.g. /lead L1");
  }
  return callOps(
    () => buildInternalRequest("GET", `/api/v1/ops/leads/${encodeURIComponent(leadId)}`, identityHeaders),
    getOpsLead,
    "leads.read",
    env,
  );
}

// ════════════════════════════════════════════════════════════════
// Error handling — user-friendly, never leaks internals
// ════════════════════════════════════════════════════════════════

function renderAuthError(status: number): string {
  switch (status) {
    case 401:
      return MSG_ACCESS_DENIED;
    case 403:
      return MSG_FORBIDDEN;
    case 429:
      return MSG_RATE_LIMITED;
    case 500:
      return MSG_SERVER_ERROR;
    default:
      return MSG_GENERIC_ERROR;
  }
}

async function renderOpsResponse(permission: string, response: Response): Promise<string> {
  switch (response.status) {
    case 200:
      return formatSuccess(permission, response);
    case 401:
      return MSG_ACCESS_DENIED;
    case 403:
      return MSG_FORBIDDEN;
    case 404:
      return MSG_NOT_FOUND;
    case 429:
      return MSG_RATE_LIMITED;
    case 500:
      return MSG_SERVER_ERROR;
    default:
      return MSG_GENERIC_ERROR;
  }
}

// ════════════════════════════════════════════════════════════════
// Success formatters — render Ops API JSON into Telegram text
// ════════════════════════════════════════════════════════════════

async function formatSuccess(permission: string, response: Response): Promise<string> {
  const body = (await response.json()) as {
    leads?: LeadView[];
    total?: number;
    lead?: LeadView;
    dashboard?: DashboardView;
  };
  if (permission === "leads.read" && body.leads) {
    return formatLeadList({ leads: body.leads, total: body.total ?? body.leads.length });
  }
  if (permission === "leads.read" && body.lead) {
    return formatLeadDetail(body.lead);
  }
  if (permission === "leads.read" && body.dashboard) {
    return formatDashboard(body.dashboard);
  }
  return "✅ Done.";
}

// The .then above returns a Promise — callOps awaits renderOpsResponse's
// result, so we must make renderOpsResponse async. (Kept simple: wrap.)
// NOTE: renderOpsResponse is called as `renderOpsResponse(permission, response)`
// and its result is returned from an async function, so a Promise<string> is
// acceptable. We convert renderAuthError synchronously and the success path
// resolves via the promise.

function formatLeadList(body: { leads: LeadView[]; total: number }): string {
  const { leads, total } = body;
  if (!leads.length) {
    return "📋 *Leads*\n\nNo leads match your view.";
  }
  const lines = leads.map((l) => {
    const assignee = l.assignee_name ? `@${l.assignee_name}` : "unassigned";
    return `• *${escapeMd(l.name)}* \`${escapeMd(l.id)}\`\n  ${l.status} · ${l.priority} · ${assignee}`;
  });
  return `📋 *Leads* (${leads.length}/${total})\n\n${lines.join("\n")}`;
}

function formatLeadDetail(lead: LeadView): string {
  const assignee = lead.assignee_name ? lead.assignee_name : "Unassigned";
  return [
    `*Lead ${escapeMd(lead.id)}*`,
    `${escapeMd(lead.name)}`,
    `📧 ${escapeMd(lead.email)}`,
    lead.phone ? `📞 ${escapeMd(lead.phone)}` : null,
    lead.treatment_interest ? `💊 ${escapeMd(lead.treatment_interest)}` : null,
    "",
    `Status: *${escapeMd(lead.status)}*`,
    `Priority: *${escapeMd(lead.priority)}*`,
    `Assigned: ${assignee}`,
  ]
    .filter((x) => x !== null)
    .join("\n");
}

function formatDashboard(d: DashboardView): string {
  const t = d.totals;
  const byPriority = Object.entries(d.by_priority)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
  return [
    "*📊 Operations Dashboard*",
    "",
    `Total leads: *${t.leads}*`,
    `New: ${t.leads_new} · Contacted: ${t.leads_contacted} · Qualified: ${t.leads_qualified} · Disqualified: ${t.leads_disqualified}`,
    `Unassigned: ${t.unassigned} · Urgent: ${t.urgent}`,
    byPriority ? `\nBy priority: ${byPriority}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

// ════════════════════════════════════════════════════════════════
// Static user-facing messages
// ════════════════════════════════════════════════════════════════

const MSG_ACCESS_DENIED =
  "🔒 *Access denied*\n\nYour Telegram account isn't linked to an AG Synergy operations profile.\nContact an administrator to be provisioned.";

const MSG_FORBIDDEN =
  "⛔ *Permission required*\n\nYou don't have access to that operation. Ask an administrator if you believe this is a mistake.";

const MSG_NOT_FOUND =
  "🔍 *Not found*\n\nThat lead doesn't exist or you don't have access to it.";

const MSG_RATE_LIMITED =
  "⏳ *Slow down*\n\nToo many requests. Please wait a moment and try again.";

const MSG_SERVER_ERROR =
  "⚠️ *Service unavailable*\n\nSomething went wrong on our end. Please try again shortly.";

const MSG_GENERIC_ERROR =
  "❓ *Unexpected response*\n\nI couldn't complete that. Please try again.";

function renderStart(): string {
  return [
    "*Welcome to the AG Synergy Operations Bot* 👋",
    "",
    "This is the operational interface for the AG Synergy team.",
    "Use /help to see what I can do.",
  ].join("\n");
}

function renderHelp(): string {
  return [
    "*Operations Bot — Commands*",
    "",
    "/start — introduction",
    "/help — this message",
    "/dashboard — lead overview + counts",
    "/leads — list recent leads (top 10)",
    "/lead <id> — full detail for one lead",
    "",
    "_Read-only MVP. More commands coming soon._",
  ].join("\n");
}

function renderUnknownCommand(): string {
  return "❓ I didn't recognize that command.\nUse /help to see available commands.";
}

function renderMalformed(command: string, usage: string): string {
  return `⚠️ *Invalid ${command} command*\n\n${usage}`;
}

// ════════════════════════════════════════════════════════════════
// Types re-declared locally (read-only view) to keep the bot decoupled
// from the service module's mutable surface. These mirror LeadView /
// DashboardView exactly — the bot never writes them.
// ════════════════════════════════════════════════════════════════

interface LeadView {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  treatment_interest: string | null;
  status: string;
  priority: string;
  assigned_to: string | null;
  assignee_name: string | null;
}

interface DashboardView {
  totals: {
    leads: number;
    leads_new: number;
    leads_contacted: number;
    leads_qualified: number;
    leads_disqualified: number;
    unassigned: number;
    urgent: number;
  };
  by_priority: Record<string, number>;
  recent_leads: LeadView[];
  recent_activity: unknown[];
}

/** Escape Telegram Markdown v1 special characters. */
function escapeMd(s: string): string {
  return s.replace(/[_*`\[]/g, (c) => `\\${c}`);
}
