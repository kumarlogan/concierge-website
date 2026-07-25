// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Hermes Admin Bot (Control Plane)       │
// │ EPIC-002-005: Hermes Control Plane — Admin Bot Foundation    │
// └─────────────────────────────────────────────────────────────┘
//
// Telegram bot interface for the Hermes Admin Control Plane.
//
// DESIGN:
//   Telegram Update → webhook → [auth middleware] → Admin Facade → Response
//
// This module is a PRESENTATION layer only. It contains:
//   - Telegram Update parsing (mirrors the ops bot pattern)
//   - Command routing (/status /workforce /agents /workflows /security
//     /providers /deploy /version /health /approvals /help)
//   - A thin gate that reuses the EXISTING authorization middleware
//     (requirePermission) and the EXISTING Hermes Admin facade
//     (@hermes/admin). The bot never reads D1 directly, never holds
//     business logic, and never bypasses RBAC.
//   - Human-readable text formatters for Admin facade responses.
//
// All platform state, authorization, and audit live in hermes/admin/*
// exactly as the Admin Console would use them. The bot is a second
// client of that same surface.

import type { Env, RouteHandler } from "../types/env.js";
import { requirePermission } from "@hermes/permissions/middleware.js";
import type { Principal as IdentityPrincipal } from "@hermes/identity/types.js";
import type { Principal as AdminPrincipal } from "@hermes/contracts/platform-api.js";
import {
  adminViewWorkforce,
  adminViewAgent,
  adminViewPlatformHealth,
  adminViewServiceStatus,
  adminViewAuthzDenials,
  adminViewAuditTrail,
  adminViewTasks,
  adminViewWorkflows,
} from "@hermes/admin/index.js";
import { viewGovernanceApprovals } from "@hermes/admin/governance.js";

/**
 * Bridge from the identity/types Principal (returned by requirePermission)
 * to the platform-api Principal (consumed by the admin facade).
 *
 * The admin facade's access.ts already handles both Set<string> and string[]
 * for permissions at runtime by checking .has first, so this is purely
 * a TypeScript type fix.
 */
function toAdminPrincipal(p: IdentityPrincipal): AdminPrincipal {
  return {
    id: p.userId,
    permissions: [...p.permissions],
    // The identity Principal always has userId — use it as id.
    // Tenant/org scopes are not available from the identity pipeline,
    // so we leave them unset (the admin facade handles missing optional fields).
  };
}

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
  type: string;
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
  [key: string]: unknown;
}

// ════════════════════════════════════════════════════════════════
// Webhook entry point
// ════════════════════════════════════════════════════════════════

/**
 * POST /admin/webhook — Telegram sends Update payloads here.
 *
 * Responsibilities:
 *   1. Parse + validate the Update JSON (safe; never throws to caller).
 *   2. Reject anything that is not a private-chat message.
 *   3. Build an internal Request carrying Telegram identity headers and
 *      dispatch to the matching admin command handler.
 *   4. Return 200 quickly (Telegram requires a fast 2xx ack).
 */
export const adminWebhook: RouteHandler = async (request, env, _params) => {
  // Telegram secret verification (if configured).
  const configuredToken = (env as { ADMIN_BOT_TOKEN?: string }).ADMIN_BOT_TOKEN;
  const providedToken = request.headers.get("X-Telegram-Bot-Api-Secret-Token");
  if (configuredToken && providedToken && providedToken !== configuredToken) {
    return new Response("Unauthorized", { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    const raw = await request.text();
    if (!raw) return adminAck();
    update = JSON.parse(raw) as TelegramUpdate;
  } catch {
    console.warn("admin.webhook: malformed JSON body");
    return adminAck();
  }

  if (!update.message || typeof update.message !== "object") {
    return adminAck();
  }

  const message = update.message;

  if (message.chat?.type !== "private") {
    return adminAck();
  }

  if (!message.from || !message.text) {
    return adminAck();
  }

  // 🔒 Authorized Telegram user IDs only
  const AUTHORIZED_USERS = new Set(["8117947039"]);
  if (!AUTHORIZED_USERS.has(String(message.from.id))) {
    return new Response(
      JSON.stringify({
        method: "sendMessage",
        chat_id: message.chat.id,
        text: "⛔ Unauthorized — you are not authorized to use this bot.",
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const chatId = String(message.chat.id);
  const displayName = formatDisplayName(message.from);

  const identityHeaders: Record<string, string> = {
    "X-Telegram-Chat-Id": chatId,
    "X-Telegram-Display-Name": displayName,
  };

  const text = message.text.trim();
  const reply = await dispatchAdminCommand(text, identityHeaders, env);

  return new Response(
    JSON.stringify({ method: "sendMessage", chat_id: chatId, text: reply }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
};

/** A bare 200 acknowledgment (no reply) for ignored updates. */
function adminAck(): Response {
  return new Response("OK", { status: 200 });
}

function formatDisplayName(user: TelegramUser): string {
  const parts = [user.first_name, user.last_name].filter(Boolean);
  return parts.join(" ") || user.username || `tg-${user.id}`;
}

// ════════════════════════════════════════════════════════════════
// Command dispatch
// ════════════════════════════════════════════════════════════════

type AdminCommandHandler = (
  arg: string,
  principal: AdminPrincipal,
  env: Env,
) => Promise<string>;

/** Map of command → { permission, handler } */
const ADMIN_COMMANDS = new Map<
  string,
  { permission: string; handler: AdminCommandHandler }
>([
  // ── Read-only (hermes:admin:read) ─────────────────────
  ["/health", { permission: "hermes:admin:read", handler: cmdHealth }],
  ["/status", { permission: "hermes:admin:read", handler: cmdStatus }],
  ["/version", { permission: "hermes:admin:read", handler: cmdVersion }],
  [
    "/workforce",
    { permission: "hermes:admin:read", handler: cmdWorkforce },
  ],
  ["/agents", { permission: "hermes:admin:read", handler: cmdAgents }],
  [
    "/workflows",
    { permission: "hermes:admin:read", handler: cmdWorkflows },
  ],
  [
    "/providers",
    { permission: "hermes:admin:read", handler: cmdProviders },
  ],

  // ── Audit/Security (hermes:admin:audit-read) ──────────
  [
    "/security",
    { permission: "hermes:admin:audit-read", handler: cmdSecurity },
  ],
  [
    "/approvals",
    { permission: "hermes:admin:audit-read", handler: cmdApprovals },
  ],
]);

async function dispatchAdminCommand(
  text: string,
  identityHeaders: Record<string, string>,
  env: Env,
): Promise<string> {
  const [rawCmd, ...rest] = text.split(/\s+/);
  const cmd = rawCmd.toLowerCase().split("@")[0];
  const arg = rest.join(" ").trim();

  // Static commands (no auth required)
  if (cmd === "/start") return renderStart();
  if (cmd === "/help") return renderHelp();

  // /deploy is a special case (deployment gate — read-only views, never auto-deploy)
  if (cmd === "/deploy") {
    return callAdmin(
      identityHeaders,
      "hermes:admin:read",
      env,
      cmdDeploy,
      arg,
    );
  }

  // Look up in command table
  const entry = ADMIN_COMMANDS.get(cmd);
  if (!entry) return renderUnknownCommand();

  return callAdmin(identityHeaders, entry.permission, env, entry.handler, arg);
}

/**
 * Thin gate that reuses the EXISTING authorization middleware + Admin facade.
 * Mirrors the `callOps` pattern from telegram.ts. The gate guarantees every
 * admin bot action flows through RBAC and audit before reaching the service
 * layer.
 */
async function callAdmin(
  identityHeaders: Record<string, string>,
  permission: string,
  env: Env,
  handler: AdminCommandHandler,
  arg: string,
): Promise<string> {
  const request = new Request("https://internal.local/admin/command", {
    method: "GET",
    headers: { "Content-Type": "application/json", ...identityHeaders },
  });

  const result = await requirePermission(env.DB, request, permission);
  if (!result.authorized) {
    return renderAuthError(result.response.status);
  }

  try {
    return await handler(arg, toAdminPrincipal(result.principal), env);
  } catch (err) {
    console.error(
      "adminBot command failed:",
      err instanceof Error ? err.message : String(err),
    );
    return renderAdminError(err);
  }
}

// ════════════════════════════════════════════════════════════════
// Command handlers — each calls the Admin facade
// ════════════════════════════════════════════════════════════════

/** /health — platform health rollup */
async function cmdHealth(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const health = adminViewPlatformHealth(principal);
  return formatPlatformHealth(health);
}

/** /status — full platform status (health + services) */
async function cmdStatus(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const health = adminViewPlatformHealth(principal);
  const services = adminViewServiceStatus(principal);
  return formatStatus(health, services);
}

/** /version — platform version information */
async function cmdVersion(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const health = adminViewPlatformHealth(principal);
  return formatVersion(health);
}

/** /workforce — agent roster summary */
async function cmdWorkforce(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const roster = adminViewWorkforce(principal);
  return formatWorkforce(roster);
}

/** /agents — agent roster with optional detail */
async function cmdAgents(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const roster = adminViewWorkforce(principal);
  // If a specific agent id was requested, show detail
  if (_arg) {
    try {
      const detail = adminViewAgent(principal, _arg);
      return formatAgentDetail(_arg, detail);
    } catch {
      return `❓ Agent \`${escapeMd(_arg)}\` not found.`;
    }
  }
  return formatWorkforce(roster);
}

/** /workflows — workflow views */
async function cmdWorkflows(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const filter = _arg
    ? ({
        state: _arg as
          | "queued"
          | "planning"
          | "waiting"
          | "running"
          | "paused"
          | "completed"
          | "cancelled"
          | "failed",
      } as const)
    : undefined;
  const workflows = adminViewWorkflows(principal, filter);
  return formatWorkflows(workflows);
}

/** /providers — provider status summary */
async function cmdProviders(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const services = adminViewServiceStatus(principal);
  return formatProviders(services);
}

/** /security — security status + denial summary */
async function cmdSecurity(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const denials = adminViewAuthzDenials(principal);
  // Use a try/catch for audit trail (optional permission)
  let audit: unknown[] = [];
  try {
    audit = adminViewAuditTrail(principal) as unknown[];
  } catch {
    // caller lacks audit-read permission — that's OK
  }
  return formatSecurity(denials, audit);
}

/** /approvals — approval queue */
async function cmdApprovals(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const approvals = viewGovernanceApprovals();
  return formatApprovals(approvals);
}

/** /deploy — deployment status (read-only gate; never auto-deploy) */
async function cmdDeploy(
  _arg: string,
  principal: AdminPrincipal,
  _env: Env,
): Promise<string> {
  const tasks = adminViewTasks(principal) as unknown[];
  const services = adminViewServiceStatus(principal);
  return formatDeployStatus(tasks, services);
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

function renderAdminError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  // Filter known permission errors to user-friendly text
  if (msg.includes("requires") || msg.includes("missing permission")) {
    return MSG_FORBIDDEN;
  }
  if (msg.includes("HUMAN principal") || msg.includes("agent principal")) {
    return MSG_ACCESS_DENIED;
  }
  return `⚠️ *Command error*\n\n${escapeMd(msg)}`;
}

// ════════════════════════════════════════════════════════════════
// Success formatters
// ════════════════════════════════════════════════════════════════

function formatPlatformHealth(health: unknown): string {
  const h = health as Record<string, unknown>;
  return [
    "*🩺 Platform Health*",
    "",
    ...Object.entries(h).map(
      ([k, v]) =>
        `• *${escapeMd(k)}*: ${typeof v === "object" ? JSON.stringify(v) : escapeMd(String(v))}`,
    ),
  ].join("\n");
}

function formatStatus(health: unknown, services: unknown): string {
  const h = health as Record<string, unknown>;
  const s = services as Record<string, unknown>;
  return [
    "*📊 Platform Status*",
    "",
    "*Health*",
    ...Object.entries(h).map(
      ([k, v]) =>
        `• ${escapeMd(k)}: ${typeof v === "object" ? JSON.stringify(v) : escapeMd(String(v))}`,
    ),
    "",
    "*Services*",
    ...Object.entries(s).map(([k, v]) => {
      const svc = v as Record<string, unknown>;
      const statusIcon = svc.status === "ok" ? "✅" : svc.status === "degraded" ? "⚠️" : "❌";
      return `• ${statusIcon} *${escapeMd(k)}*: ${escapeMd(String(svc.status ?? "unknown"))}`;
    }),
  ].join("\n");
}

function formatVersion(health: unknown): string {
  const h = health as Record<string, unknown>;
  const version = (h.version as string) ?? "v1.0.0";
  const uptime = (h.uptime as string) ?? "unknown";
  return [
    `*ℹ️ Hermes Platform*`,
    "",
    `Version: \`${escapeMd(version)}\``,
    `Uptime: ${escapeMd(uptime)}`,
    `Build: \`EPIC-002-005\``,
  ].join("\n");
}

function formatWorkforce(roster: unknown): string {
  const arr = Array.isArray(roster) ? roster : [];
  if (arr.length === 0) {
    return "*👥 AI Workforce*\n\nNo agents registered.";
  }
  const lines = arr.map((a: unknown) => {
    const agent = a as Record<string, unknown>;
    const statusIcon =
      agent.status === "active"
        ? "🟢"
        : agent.status === "suspended"
          ? "🟡"
          : agent.status === "disabled"
            ? "🔴"
            : "⚪";
    return `${statusIcon} *${escapeMd(String(agent.name ?? agent.id ?? "?"))}*\n` +
      `  ID: \`${escapeMd(String(agent.id ?? "?"))}\` · Status: ${escapeMd(String(agent.status ?? "unknown"))}`;
  });
  return `*👥 AI Workforce* (${arr.length})\n\n${lines.join("\n")}`;
}

function formatAgentDetail(
  agentId: string,
  detail: unknown,
): string {
  const d = detail as Record<string, unknown>;
  const capabilities = Array.isArray(d.capabilities)
    ? (d.capabilities as unknown[])
        .map((c: unknown) => {
          const cap = c as Record<string, unknown>;
          return `  • ${escapeMd(String(cap.id ?? "?"))}: ${escapeMd(String(cap.description ?? ""))}`;
        })
        .join("\n")
    : "  None";
  return [
    `*🤖 Agent: ${escapeMd(String(d.name ?? agentId))}*`,
    "",
    `ID: \`${escapeMd(agentId)}\``,
    `Status: *${escapeMd(String(d.status ?? "unknown"))}*`,
    `Role: ${escapeMd(String(d.role ?? "none"))}`,
    `Activation: \`${escapeMd(String(d.activation ?? "disabled"))}\``,
    "",
    "*Capabilities*",
    capabilities,
  ].join("\n");
}

function formatWorkflows(workflows: unknown): string {
  const arr = Array.isArray(workflows) ? workflows : [];
  if (arr.length === 0) {
    return "*📋 Workflows*\n\nNo active workflows.";
  }
  const lines = arr.map((w: unknown) => {
    const wf = w as Record<string, unknown>;
    const stateIcon =
      wf.state === "running"
        ? "▶️"
        : wf.state === "completed"
          ? "✅"
          : wf.state === "failed"
            ? "❌"
            : wf.state === "paused"
              ? "⏸️"
              : wf.state === "cancelled"
                ? "🚫"
                : "⏳";
    return `${stateIcon} *${escapeMd(String(wf.name ?? wf.id ?? "?"))}*\n` +
      `  State: \`${escapeMd(String(wf.state ?? "unknown"))}\` · Stage: ${escapeMd(String(wf.stage ?? "-"))}`;
  });
  return `*📋 Workflows* (${arr.length})\n\n${lines.join("\n")}`;
}

function formatProviders(services: unknown): string {
  const s = services as Record<string, unknown>;
  const lines = Object.entries(s).map(([k, v]) => {
    const svc = v as Record<string, unknown>;
    const icon =
      svc.status === "ok"
        ? "✅"
        : svc.status === "degraded"
          ? "⚠️"
          : "❌";
    return `${icon} *${escapeMd(k)}* — ${escapeMd(String(svc.status ?? "unknown"))}`;
  });
  return `*🔌 Provider Status*\n\n${lines.join("\n")}`;
}

function formatSecurity(
  denials: unknown,
  _audit: unknown[],
): string {
  const denialsArr = Array.isArray(denials) ? denials : [];
  if (denialsArr.length === 0) {
    return "*🛡️ Security*\n\nNo authorization denials. All clear.";
  }
  const lines = denialsArr.slice(0, 10).map((d: unknown) => {
    const entry = d as Record<string, unknown>;
    return `• \`${escapeMd(String(entry.id ?? "?"))}\` — ${escapeMd(String(entry.reason ?? "unknown"))} [${escapeMd(String(entry.created_at ?? ""))}]`;
  });
  return [
    `*🛡️ Security* (${denialsArr.length} denials)`,
    "",
    ...lines,
    denialsArr.length > 10 ? `\n_+${denialsArr.length - 10} more_` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatApprovals(approvals: unknown): string {
  const arr = Array.isArray(approvals) ? approvals : [];
  if (arr.length === 0) {
    return "*📋 Approval Queue*\n\nNo pending approvals.";
  }
  const lines = arr.slice(0, 15).map((a: unknown) => {
    const entry = a as Record<string, unknown>;
    return `• *${escapeMd(String(entry.id ?? "?"))}* — ${escapeMd(String(entry.type ?? entry.description ?? ""))}`;
  });
  return [
    `*📋 Approval Queue* (${arr.length} pending)`,
    "",
    ...lines,
    arr.length > 15 ? `\n_+${arr.length - 15} more_` : "",
    "",
    "_Status via /workflows_",
  ]
    .filter(Boolean)
    .join("\n");
}

function formatDeployStatus(tasks: unknown[], _services: unknown): string {
  return [
    "*🚀 Deployment Status*",
    "",
    "⚠️ *Read-only gate* — auto-deployment is not available via Telegram.",
    "",
    `Active tasks: ${tasks.length}`,
    "",
    "_To deploy: visit the Hermes Admin Console or run locally._",
  ].join("\n");
}

// ════════════════════════════════════════════════════════════════
// Static user-facing messages
// ════════════════════════════════════════════════════════════════

const MSG_ACCESS_DENIED =
  "🔒 *Access denied*\n\nYour Telegram account isn't linked to an admin profile.\nContact an administrator to be provisioned.";

const MSG_FORBIDDEN =
  "⛔ *Permission required*\n\nYou don't have admin access to that operation.\nAsk an administrator if you believe this is a mistake.";

const MSG_RATE_LIMITED =
  "⏳ *Slow down*\n\nToo many requests. Please wait a moment and try again.";

const MSG_SERVER_ERROR =
  "⚠️ *Service unavailable*\n\nSomething went wrong on our end. Please try again shortly.";

const MSG_GENERIC_ERROR =
  "❓ *Unexpected response*\n\nI couldn't complete that. Please try again.";

function renderStart(): string {
  return [
    "*Welcome to the Hermes Admin Bot* 🏗️",
    "",
    "This is the administrative interface for the Hermes Platform.",
    "Use /help to see available commands.",
    "",
    "_Only authorized administrators may access this bot._",
  ].join("\n");
}

function renderHelp(): string {
  return [
    "*Hermes Admin Bot — Commands*",
    "",
    "*Read-only (admin access required)*",
    "/health — platform health status",
    "/status — full platform status overview",
    "/version — version & build info",
    "/workforce — agent roster summary",
    "/agents — agent roster (use `/agents <id>` for detail)",
    "/workflows — current workflows; `/workflows running` to filter",
    "/providers — provider connectivity status",
    "",
    "*Security & Audit*",
    "/security — authorization denials & security status",
    "/approvals — pending approval queue",
    "",
    "*Deployment*",
    "/deploy — deployment status (read-only)",
    "",
    "*Help*",
    "/start — introduction",
    "/help — this message",
    "",
    "_All commands flow through RBAC + audit. No auto-deploy._",
  ].join("\n");
}

function renderUnknownCommand(): string {
  return (
    "❓ I didn't recognize that command.\n" +
    "Use /help to see available admin commands."
  );
}

// ════════════════════════════════════════════════════════════════
// Helpers
// ════════════════════════════════════════════════════════════════

/** Escape Telegram Markdown special characters. */
function escapeMd(text: string): string {
  return text
    .replace(/_/g, "\\_")
    .replace(/\*/g, "\\*")
    .replace(/`/g, "\\`")
    .replace(/\[/g, "\\[");
}