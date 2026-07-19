// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Operations Telegram Bot Integration     │
// │ EPIC-002-004-IMPL: Operations Telegram Bot — Implementation   │
// └─────────────────────────────────────────────────────────────┘
//
// End-to-end tests against REAL D1 (Miniflare) exercising the full bot
// pipeline the way production will run it:
//
//   Telegram Update → POST /telegram/webhook → telegramWebhook
//     → requirePermission (SAME auth engine as HTTP API)
//     → Ops route handler (SAME handlers as HTTP API)
//     → opsService → D1
//     → response formatted back as a Telegram sendMessage payload
//
// This proves the bot is a THIN CLIENT: it reuses the exact authorization
// middleware and Ops handlers as the HTTP API. No business logic is
// duplicated in the bot. The schema mirrors migrations 0002 (RBAC) +
// 0003 (ops lead fields) + 0004 (role_permissions seed) exactly, copied
// from tests/ops/ops.integration.test.ts so identity resolution matches.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../../src/index.js";
import type { Env } from "../../src/types/env.js";

const E = env as unknown as Env;

// ── Schema (self-provisioned; mirrors migrations 0002 + 0003 + 0004) ──
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
CREATE TABLE IF NOT EXISTS leads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  preferred_contact_method TEXT,
  treatment_interest TEXT,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'new',
  assigned_to TEXT,
  priority TEXT NOT NULL DEFAULT 'normal',
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);
`;

const ROLE = {
  OWNER: "00000000-0000-0000-0000-000000000001",
  ADMIN: "00000000-0000-0000-0000-000000000002",
  OPS: "00000000-0000-0000-0000-000000000003",
  VIEWER: "00000000-0000-0000-0000-000000000004",
  GUEST: "00000000-0000-0000-0000-000000000005",
} as const;
const ROLE_NAME = { OWNER: "OWNER", ADMIN: "ADMIN", OPS: "OPERATIONS", VIEWER: "VIEWER", GUEST: "GUEST" } as const;
const PERM = {
  "leads.read": "00000000-0000-0000-0000-000000000101",
  "leads.update": "00000000-0000-0000-0000-000000000102",
  "leads.assign": "00000000-0000-0000-0000-000000000103",
  "consultations.read": "00000000-0000-0000-0000-000000000104",
  "consultations.update": "00000000-0000-0000-0000-000000000105",
  "audit.read": "00000000-0000-0000-0000-000000000108",
  "users.manage": "00000000-0000-0000-0000-000000000106",
} as const;

// Telegram chat ids → seeded test users. The auth provider resolves by
// external_id, so external_id MUST equal the chat id string.
const TG = {
  owner: "tg-owner",
  admin: "tg-admin",
  ops: "tg-ops",
  viewer: "tg-viewer",
  opsRevoked: "tg-ops-revoked",
} as const;

async function run(db: any, sql: string, binds: unknown[] = []): Promise<void> {
  await db.prepare(sql).bind(...binds).run();
}

let db: any;

beforeAll(async () => {
  db = E.DB;
  const now = new Date().toISOString();

  // Idempotent schema provisioning: CREATE TABLE IF NOT EXISTS never throws
  // on a persisted DB and never depends on a fresh Miniflare state file.
  for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }

  // Deterministic, idempotent seeding. Fixed UUIDs + INSERT OR IGNORE make
  // repeated runs (and shared pool DBs) self-healing instead of colliding.
  for (const [name, id] of Object.entries(ROLE_NAME)) {
    await run(db, "INSERT OR IGNORE INTO roles (id, name, description, is_system, created_at, updated_at) VALUES (?1,?2,?3,1,?4,?5)", [ROLE[name as keyof typeof ROLE], id, "test", now, now]);
  }
  for (const [key, id] of Object.entries(PERM)) {
    const [resource, action] = key.split(".");
    await run(db, "INSERT OR IGNORE INTO permissions (id, key, description, resource, action, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", [id, key, "test", resource, action, now, now]);
  }
  const grants: [string, string][] = [
    [ROLE.ADMIN, PERM["leads.read"]],
    [ROLE.ADMIN, PERM["leads.update"]],
    [ROLE.ADMIN, PERM["leads.assign"]],
    [ROLE.ADMIN, PERM["consultations.read"]],
    [ROLE.ADMIN, PERM["consultations.update"]],
    [ROLE.ADMIN, PERM["audit.read"]],
    [ROLE.ADMIN, PERM["users.manage"]],
    [ROLE.OPS, PERM["leads.read"]],
    [ROLE.OPS, PERM["leads.update"]],
    [ROLE.OPS, PERM["leads.assign"]],
    [ROLE.OPS, PERM["consultations.read"]],
    [ROLE.OPS, PERM["consultations.update"]],
    [ROLE.VIEWER, PERM["leads.read"]],
    [ROLE.VIEWER, PERM["consultations.read"]],
    [ROLE.VIEWER, PERM["audit.read"]],
  ];
  // Stable, deterministic ids (role+perm-derived) so re-runs don't collide.
  for (const [roleId, permId] of grants) {
    const rpId = `rp-${roleId}-${permId}`;
    await run(db, "INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?1,?2,?3,?4)", [rpId, roleId, permId, now]);
  }

  const users: [string, string, string, string][] = [
    [TG.owner, ROLE.OWNER, TG.owner, "Owner"],
    [TG.admin, ROLE.ADMIN, TG.admin, "Admin"],
    [TG.ops, ROLE.OPS, TG.ops, "Ops"],
    [TG.viewer, ROLE.VIEWER, TG.viewer, "Viewer"],
    [TG.opsRevoked, ROLE.OPS, TG.opsRevoked, "OpsRevoked"],
    ["tg-guest", ROLE.GUEST, "tg-guest", "Guest"],
  ];
  for (const [id, roleId, ext, name] of users) {
    // The bot identifies users by their Telegram NUMERIC id (from.id), which
    // it sends as X-Telegram-Chat-Id. So external_id must equal that same
    // numeric id (hashChat(ext)) for the auth provider to resolve them.
    await run(db, "INSERT OR IGNORE INTO users (id, role_id, external_id, display_name, is_active, created_at, updated_at) VALUES (?1,?2,?3,?4,1,?5,?6)", [id, roleId, String(hashChat(ext)), name, now, now]);
  }
  await run(db, "INSERT OR IGNORE INTO user_permissions (id, user_id, permission_id, effect, granted_by, created_at, updated_at) VALUES (?1,?2,?3,'revoke',?4,?5,?6)", ["up-rev-1", TG.opsRevoked, PERM["leads.update"], TG.owner, now, now]);

  await seedLeads(db, now);
});

beforeEach(async () => {
  await seedLeads(db, new Date().toISOString());
});

async function seedLeads(db: any, now: string): Promise<void> {
  await db.prepare("DELETE FROM leads").run();
  const leads: [string, string, string, string, string, string, string][] = [
    ["L1", "Alice New", "alice@example.com", "new", "normal", TG.ops, "ivf"],
    ["L2", "Bob Contacted", "bob@example.com", "contacted", "urgent", TG.ops, "egg-freezing"],
    ["L3", "Carol Unassigned", "carol@example.com", "new", "normal", "", "ivf"],
    ["L4", "Dan Qualified", "dan@example.com", "qualified", "low", TG.admin, "surrogacy"],
  ];
  for (const [id, name, email, status, priority, assignedTo, interest] of leads) {
    await run(db, "INSERT INTO leads (id, name, email, phone, treatment_interest, status, assigned_to, priority, notes, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11)", [id, name, email, "555", interest, status, assignedTo || null, priority, null, now, now]);
  }
}

// ── Helpers ────────────────────────────────────────────────────

/** Build a Telegram Update webhook payload for a private-chat message. */
function privateMessage(chatId: string, text: string, from?: Partial<{ first_name: string; last_name: string; username: string; is_bot: boolean }>): Request {
  const user = { id: hashChat(chatId), is_bot: false, first_name: "Tester", ...from };
  const body = {
    update_id: 1,
    message: {
      message_id: 1,
      from: user,
      chat: { id: hashChat(chatId), type: "private", first_name: "Tester" },
      text,
      date: 1,
    },
  };
  return new Request("https://test.local/telegram/webhook", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Map a chat id string to a stable positive integer (Telegram chat ids are ints). */
function hashChat(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** POST an Update and parse the bot's Telegram reply payload. */
async function botReply(req: Request): Promise<{ status: number; payload: { method?: string; chat_id?: string; text?: string } | null }> {
  const res = await worker.fetch(req, E);
  let payload: { method?: string; chat_id?: string; text?: string } | null = null;
  const txt = await res.text();
  if (txt && txt !== "OK") {
    try { payload = JSON.parse(txt); } catch { /* ack with no body */ }
  }
  return { status: res.status, payload };
}

// ── Parsing & dispatch (unsupported types) ─────────────────────

describe("Telegram bot — webhook ingress", () => {
  it("returns 200 (OK) for a private-chat message and frames a sendMessage reply", async () => {
    const { status, payload } = await botReply(privateMessage("tg-ops", "/start"));
    expect(status).toBe(200);
    expect(payload?.method).toBe("sendMessage");
    expect(payload?.chat_id).toBe(String(hashChat("tg-ops")));
    expect(payload?.text).toContain("Welcome");
  });

  it("ignores group-chat messages with a bare 200 ack (no reply)", async () => {
    const body = {
      update_id: 2,
      message: {
        message_id: 2,
        from: { id: 99, first_name: "G" },
        chat: { id: -100, type: "group" },
        text: "/dashboard",
        date: 1,
      },
    };
    const req = new Request("https://test.local/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { status, payload } = await botReply(req);
    expect(status).toBe(200);
    expect(payload).toBeNull();
  });

  it("ignores callback_query updates (unsupported type) with 200 ack", async () => {
    const body = { update_id: 3, callback_query: { id: "cb1", from: { id: 1 }, data: "x" } };
    const req = new Request("https://test.local/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const { status, payload } = await botReply(req);
    expect(status).toBe(200);
    expect(payload).toBeNull();
  });

  it("ignores malformed JSON body with a 200 ack (never 5xx)", async () => {
    const req = new Request("https://test.local/telegram/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not json",
    });
    const { status, payload } = await botReply(req);
    expect(status).toBe(200);
    expect(payload).toBeNull();
  });

  it("strips the @BotName suffix from commands", async () => {
    const { status, payload } = await botReply(privateMessage("tg-ops", "/help@AGSBot"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Commands");
  });
});

// ── Static commands (no auth required) ─────────────────────────

describe("Telegram bot — static commands", () => {
  it("/start greets the user", async () => {
    const { payload } = await botReply(privateMessage("tg-ops", "/start"));
    expect(payload?.text).toContain("AG Synergy");
  });

  it("/help lists available commands", async () => {
    const { payload } = await botReply(privateMessage("tg-ops", "/help"));
    expect(payload?.text).toContain("/dashboard");
    expect(payload?.text).toContain("/leads");
    expect(payload?.text).toContain("/lead");
  });

  it("unknown command shows a helpful hint", async () => {
    const { payload } = await botReply(privateMessage("tg-ops", "/frobnicate"));
    expect(payload?.text).toContain("didn't recognize");
    expect(payload?.text).toContain("/help");
  });
});

// ── Authenticated read commands (reuse real Ops API + RBAC) ────

describe("Telegram bot — authenticated commands", () => {
  it("/dashboard renders totals for an authorized ops user", async () => {
    const { status, payload } = await botReply(privateMessage("tg-ops", "/dashboard"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Operations Dashboard");
    expect(payload?.text).toContain("Total leads");
  });

  it("/leads lists recent leads for an authorized admin", async () => {
    const { status, payload } = await botReply(privateMessage("tg-admin", "/leads"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Alice New");
    expect(payload?.text).toContain("L1");
  });

  it("/lead <id> returns detail for an authorized user", async () => {
    const { status, payload } = await botReply(privateMessage("tg-admin", "/lead L1"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Alice New");
    expect(payload?.text).toContain("alice@example.com");
    expect(payload?.text).toContain("Status:");
  });

  it("/lead <missing> returns the not-found message (maps 404)", async () => {
    const { status, payload } = await botReply(privateMessage("tg-admin", "/lead NOPE"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Not found");
  });

  it("/lead with no argument returns usage hint", async () => {
    const { status, payload } = await botReply(privateMessage("tg-admin", "/lead"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Usage");
  });

  it("OWNER (superuser) can read the dashboard", async () => {
    const { status, payload } = await botReply(privateMessage("tg-owner", "/dashboard"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Operations Dashboard");
  });
});

// ── Authorization & identity (bot respects the SAME RBAC) ──────

describe("Telegram bot — authorization & identity", () => {
  it("rejects a Telegram user with no linked profile (401 → access denied)", async () => {
    const { status, payload } = await botReply(privateMessage("tg-stranger", "/dashboard"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Access denied");
    expect(payload?.text).toContain("isn't linked");
  });

  it("VIEWER CAN read leads via the bot (role grants leads.read)", async () => {
    const { status, payload } = await botReply(privateMessage("tg-viewer", "/lead L1"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Alice New");
  });

  it("GUEST (role with no ops grants) is forbidden from /dashboard (403)", async () => {
    const { status, payload } = await botReply(privateMessage("tg-guest", "/dashboard"));
    expect(status).toBe(200);
    expect(payload?.text).toContain("Permission required");
  });

  it("unauthenticated (no user row) never leaks data", async () => {
    const { payload } = await botReply(privateMessage("tg-ghost", "/leads"));
    expect(payload?.text).toContain("Access denied");
  });
});

// ── Error mapping (bot turns HTTP statuses into friendly text) ──

describe("Telegram bot — error mapping", () => {
  it("maps 404 (unknown lead) to the not-found message", async () => {
    const { payload } = await botReply(privateMessage("tg-admin", "/lead NOPE"));
    expect(payload?.text).toContain("Not found");
  });

  it("maps 401 (unlinked identity) to the access-denied message", async () => {
    const { payload } = await botReply(privateMessage("tg-stranger", "/leads"));
    expect(payload?.text).toContain("Access denied");
  });

  it("maps 403 (insufficient role) to the permission-required message", async () => {
    const { payload } = await botReply(privateMessage("tg-guest", "/leads"));
    expect(payload?.text).toContain("Permission required");
  });
});
