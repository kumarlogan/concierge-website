// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Hermes Admin Bot Integration Tests    │
// │ EPIC-002-005: Hermes Control Plane — Admin Bot Foundation   │
// └─────────────────────────────────────────────────────────────┘
//
// End-to-end tests exercising the full Admin Bot pipeline:
//   Telegram Update → /admin/webhook → auth → command dispatch → sendMessage reply
//
// Covers: authorization enforcement, all read-only commands,
//         audit/security commands, unknown commands, and edge cases.

import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../../src/index.js";
import type { Env } from "../../src/types/env.js";

const E = env as unknown as Env;

// ── Schema (matches migrations 0002–0005) ──────────────────────
const DDL = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  description TEXT,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id),
  external_id TEXT,
  display_name TEXT NOT NULL,
  email TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  effect TEXT NOT NULL DEFAULT 'grant',
  granted_by TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  created_at TEXT NOT NULL,
  UNIQUE (role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  decision TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

// ── Constants ──────────────────────────────────────────────────
const ROLE = {
  OWNER: "00000000-0000-0000-0000-000000000001",
  ADMIN: "00000000-0000-0000-0000-000000000002",
  VIEWER: "00000000-0000-0000-0000-000000000004",
  GUEST: "00000000-0000-0000-0000-000000000005",
} as const;
const ROLE_NAME: Record<string, string> = {
  OWNER: "OWNER",
  ADMIN: "ADMIN",
  VIEWER: "VIEWER",
  GUEST: "GUEST",
};
const PERM = {
  "hermes:admin:read": "00000000-0000-0000-0000-000000000201",
  "hermes:admin:audit-read": "00000000-0000-0000-0000-000000000202",
  "leads.read": "00000000-0000-0000-0000-000000000101",
} as const;

const TG = {
  owner: "tg-admin-owner",
  admin: "tg-admin-admin",
  viewer: "tg-admin-viewer",
  guest: "tg-admin-guest",
} as const;

// ── Helpers ────────────────────────────────────────────────────
function hashChat(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

async function run(db: any, sql: string, binds: unknown[] = []): Promise<void> {
  await db.prepare(sql).bind(...binds).run();
}

function privateMessage(chatId: string, text: string): Request {
  const userId = hashChat(chatId);
  const body = {
    update_id: 1,
    message: {
      message_id: 1,
      from: { id: userId, is_bot: false, first_name: "Tester" },
      chat: { id: userId, type: "private", first_name: "Tester" },
      text,
      date: 1,
    },
  };
  return new Request("https://test.local/admin/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function botReply(req: Request): Promise<{
  status: number;
  payload: { method?: string; chat_id?: string; text?: string } | null;
}> {
  const res = await worker.fetch(req, E);
  let payload: { method?: string; chat_id?: string; text?: string } | null = null;
  const txt = await res.text();
  if (txt && txt !== "OK") {
    try { payload = JSON.parse(txt); } catch { /* ack */ }
  }
  return { status: res.status, payload };
}

// ── Seed ───────────────────────────────────────────────────────
beforeAll(async () => {
  const db = E.DB;
  const now = new Date().toISOString();

  for (const stmt of DDL.split(";").map(s => s.trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }

  for (const [key, id] of Object.entries(ROLE)) {
    await run(
      db,
      "INSERT OR IGNORE INTO roles (id, name, description, is_system, created_at, updated_at) VALUES (?1,?2,?3,1,?4,?5)",
      [id, ROLE_NAME[key] ?? key, "test", now, now],
    );
  }

  for (const [key, id] of Object.entries(PERM)) {
    const resource = key.includes(":") ? key.split(":")[0] : key.split(".")[0];
    const action = key.includes(":") ? key.split(":").slice(1).join(":") : key.split(".").slice(1).join(".");
    await run(
      db,
      "INSERT OR IGNORE INTO permissions (id, key, description, resource, action, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)",
      [id, key, "test", resource, action, now, now],
    );
  }

  const grants: [string, string][] = [
    [ROLE.OWNER, PERM["hermes:admin:read"]],
    [ROLE.OWNER, PERM["hermes:admin:audit-read"]],
    [ROLE.ADMIN, PERM["hermes:admin:read"]],
    [ROLE.ADMIN, PERM["hermes:admin:audit-read"]],
    [ROLE.VIEWER, PERM["leads.read"]],
  ];
  for (const [roleId, permId] of grants) {
    await run(
      db,
      "INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?1,?2,?3,?4)",
      [`rp-${roleId.replace(/-/g, "")}-${permId.replace(/-/g, "")}`, roleId, permId, now],
    );
  }

  const users: [string, string, string, string][] = [
    [TG.owner, ROLE.OWNER, String(hashChat(TG.owner)), "AdminOwner"],
    [TG.admin, ROLE.ADMIN, String(hashChat(TG.admin)), "AdminUser"],
    [TG.viewer, ROLE.VIEWER, String(hashChat(TG.viewer)), "AdminViewer"],
    [TG.guest, ROLE.GUEST, String(hashChat(TG.guest)), "AdminGuest"],
  ];
  for (const [userId, roleId, extId, name] of users) {
    await run(
      db,
      "INSERT OR IGNORE INTO users (id, role_id, external_id, display_name, is_active, created_at, updated_at) VALUES (?1,?2,?3,?4,1,?5,?6)",
      [userId, roleId, extId, name, now, now],
    );
  }
});

// ── Tests ──────────────────────────────────────────────────────
describe("Admin Bot — webhook ingress", () => {
  it("returns 200 + sendMessage for private-chat /start", async () => {
    const { status, payload } = await botReply(privateMessage(TG.owner, "/start"));
    expect(status).toBe(200);
    expect(payload?.method).toBe("sendMessage");
    expect(payload?.chat_id).toBe(String(hashChat(TG.owner)));
    expect(payload?.text).toContain("Welcome");
  });

  it("ignores malformed JSON body with 200 ack", async () => {
    const req = new Request("https://test.local/admin/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    });
    const { status, payload } = await botReply(req);
    expect(status).toBe(200);
    expect(payload).toBeNull();
  });

  it("ignores empty body with 200 ack", async () => {
    const req = new Request("https://test.local/admin/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "",
    });
    const { status, payload } = await botReply(req);
    expect(status).toBe(200);
    expect(payload).toBeNull();
  });
});

describe("Admin Bot — authorization", () => {
  it("allows OWNER role to execute /status", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/status"));
    expect(payload?.text).toContain("Status");
  });

  it("allows ADMIN role to execute /health", async () => {
    const { payload } = await botReply(privateMessage(TG.admin, "/health"));
    expect(payload?.text).toContain("Health");
  });

  it("denies VIEWER role with 403 forbidden", async () => {
    const { payload } = await botReply(privateMessage(TG.viewer, "/status"));
    expect(payload?.text).toContain("Permission required");
  });

  it("denies GUEST role with 403 forbidden", async () => {
    const { payload } = await botReply(privateMessage(TG.guest, "/status"));
    expect(payload?.text).toContain("Permission required");
  });
});

describe("Admin Bot — read-only commands", () => {
  it("/start renders Welcome", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/start"));
    expect(payload?.text).toContain("Welcome");
  });

  it("/help renders command list", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/help"));
    expect(payload?.text).toContain("/health");
    expect(payload?.text).toContain("/status");
    expect(payload?.text).toContain("/workforce");
    expect(payload?.text).toContain("/security");
  });

  it("/health returns platform health", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/health"));
    expect(payload?.text).toContain("Health");
  });

  it("/status returns full status", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/status"));
    expect(payload?.text).toContain("Status");
  });

  it("/version returns version info", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/version"));
    expect(payload?.text).toContain("Version");
  });

  it("/workforce returns agent summary", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/workforce"));
    expect(payload?.text).toContain("Workforce");
  });

  it("/agents returns agent roster", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/agents"));
    expect(payload?.text).toContain("Workforce");
  });

  it("/workflows returns workflow summary", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/workflows"));
    expect(payload?.text).toContain("Workflows");
  });

  it("/providers returns provider status", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/providers"));
    expect(payload?.text).toContain("Provider");
  });

  it("/deploy returns read-only deployment status", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/deploy"));
    expect(payload?.text).toContain("Deployment");
    expect(payload?.text).toContain("Read-only");
  });
});

describe("Admin Bot — audit/security commands", () => {
  it("/security returns security status", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/security"));
    expect(payload?.text).toContain("Security");
  });

  it("/approvals returns approval queue (or empty)", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/approvals"));
    expect(payload?.text).toContain("Approval");
  });

  it("denies VIEWER /security (needs audit-read)", async () => {
    const { payload } = await botReply(privateMessage(TG.viewer, "/security"));
    expect(payload?.text).toContain("Permission required");
  });
});

describe("Admin Bot — unknown commands", () => {
  it("returns unknown command message for /invalid", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/invalid"));
    expect(payload?.text).toContain("I didn't recognize that command");
  });

  it("treats /help@AdminBot same as /help", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/help@AdminBot"));
    expect(payload?.text).toContain("/health");
  });

  it("handles commands with trailing whitespace", async () => {
    const { payload } = await botReply(privateMessage(TG.owner, "/status  "));
    expect(payload?.text).toContain("Status");
  });
});