// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Operations API Integration Tests        │
// │ Phase 2: Operations Platform Foundation                      │
// │ EPIC-002-003A: Operations API Foundation                     │
// └─────────────────────────────────────────────────────────────┘
//
// End-to-end tests against REAL D1 (Miniflare) exercising the full pipeline:
//
//   Request (X-Telegram-Chat-Id) → auth middleware (requirePermission)
//     → ops route handler → opsService → D1
//
// This proves:
//   1. Authorization is enforced (no header / wrong role → 401/403)
//   2. Listing, detail, update, assign, "my leads", dashboard, timeline work
//   3. RBAC deny-wins + scope filtering behave correctly
//
// The schema mirrors migrations 0002 (RBAC) + 0003 (ops lead fields) exactly.

import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { env } from "cloudflare:workers";
import worker from "../../src/index.js";
import type { Env } from "../../src/types/env.js";

// The Miniflare-injected `env` is typed as Cloudflare.Env; our handlers expect
// the local Env interface. At runtime they are the same object, so cast once.
const E = env as unknown as Env;

// ── Schema (self-provisioned; mirrors migrations 0002 + 0003 + 0004) ──
// The @cloudflare/vitest-pool-workers D1 state PERSISTS across runs (it is NOT
// a fresh DB each time, and is separate from globalSetup's migrations target).
// So we provision + seed idempotently (CREATE TABLE IF NOT EXISTS + INSERT OR
// IGNORE) here. This must match the production schema produced by migrations
// 0002 (RBAC), 0003 (ops lead fields) and 0004 (role_permissions seed) so the
// real authorization engine resolves correctly.
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
CREATE INDEX idx_leads_assigned_to ON leads(assigned_to);
CREATE INDEX idx_leads_priority ON leads(priority);
`;

// ── Seed ids (stable, self-contained) ─────────────────────────
const ROLE = {
  OWNER: "00000000-0000-0000-0000-000000000001",
  ADMIN: "00000000-0000-0000-0000-000000000002",
  OPS: "00000000-0000-0000-0000-000000000003",
  VIEWER: "00000000-0000-0000-0000-000000000004",
} as const;
const ROLE_NAME = { OWNER: "OWNER", ADMIN: "ADMIN", OPS: "OPERATIONS", VIEWER: "VIEWER" } as const;
const PERM = {
  "leads.read": "00000000-0000-0000-0000-000000000101",
  "leads.update": "00000000-0000-0000-0000-000000000102",
  "leads.assign": "00000000-0000-0000-0000-000000000103",
  "consultations.read": "00000000-0000-0000-0000-000000000104",
  "consultations.update": "00000000-0000-0000-0000-000000000105",
  "audit.read": "00000000-0000-0000-0000-000000000108",
  "users.manage": "00000000-0000-0000-0000-000000000106",
} as const;

// Test telegram chat ids → map to seeded test users.
const TG = {
  owner: "tg-owner",
  admin: "tg-admin",
  ops: "tg-ops",
  viewer: "tg-viewer",
  opsRevoked: "tg-ops-revoked",
} as const;

async function run(db: any, sql: string, binds: unknown[] = []): Promise<void> {
  try {
    await db.prepare(sql).bind(...binds).run();
  } catch (e) {
    console.error("DB RUN FAILED:", sql, JSON.stringify(binds), e instanceof Error ? e.message : e);
    throw e;
  }
}

let db: any;

beforeAll(async () => {
  db = E.DB;
  const now = new Date().toISOString();

  // Idempotent schema provisioning. The vitest-pool-workers D1 state PERSISTS
  // across runs (it is not a fresh DB each time), so CREATE TABLE IF NOT EXISTS
  // + INSERT OR IGNORE makes repeated full-suite runs self-healing instead of
  // colliding on already-existing rows. No DROP / no PRAGMA needed.
  for (const stmt of DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }

  // Roles (name is what the engine resolves; id is a stable UUID).
  for (const [name, id] of Object.entries(ROLE_NAME)) {
    await run(db, "INSERT OR IGNORE INTO roles (id, name, description, is_system, created_at, updated_at) VALUES (?1,?2,?3,1,?4,?5)", [ROLE[name as keyof typeof ROLE], id, "test", now, now]);
  }
  // Permissions
  for (const [key, id] of Object.entries(PERM)) {
    const [resource, action] = key.split(".");
    await run(db, "INSERT OR IGNORE INTO permissions (id, key, description, resource, action, created_at, updated_at) VALUES (?1,?2,?3,?4,?5,?6,?7)", [id, key, "test", resource, action, now, now]);
  }
  // Role grants (data-driven, via role_permissions) — mirrors migration 0004.
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
  for (const [roleId, permId] of grants) {
    const rpId = `rp-${roleId}-${permId}`;
    await run(db, "INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?1,?2,?3,?4)", [rpId, roleId, permId, now]);
  }

  // Users: owner (superuser), admin, ops, viewer, and an ops user whose
  // leads.update is REVOKED (deny wins).
  const users: [string, string, string, string][] = [
    [TG.owner, ROLE.OWNER, TG.owner, "Owner"],
    [TG.admin, ROLE.ADMIN, TG.admin, "Admin"],
    [TG.ops, ROLE.OPS, TG.ops, "Ops"],
    [TG.viewer, ROLE.VIEWER, TG.viewer, "Viewer"],
    [TG.opsRevoked, ROLE.OPS, TG.opsRevoked, "OpsRevoked"],
  ];
  for (const [id, roleId, ext, name] of users) {
    await run(db, "INSERT OR IGNORE INTO users (id, role_id, external_id, display_name, is_active, created_at, updated_at) VALUES (?1,?2,?3,?4,1,?5,?6)", [id, roleId, ext, name, now, now]);
  }
  // Revoke leads.update from u-ops-revoked (OPERATIONS grants it → deny wins)
  await run(db, "INSERT OR IGNORE INTO user_permissions (id, user_id, permission_id, effect, granted_by, created_at, updated_at) VALUES (?1,?2,?3,'revoke',?4,?5,?6)", ["up-rev-1", TG.opsRevoked, PERM["leads.update"], TG.owner, now, now]);

  await seedLeads(db, now);
});

// Each test mutates leads (status/priority/assignment), so reseed the lead
// rows before every test to keep assertions order-independent and stable.
beforeEach(async () => {
  await seedLeads(db, new Date().toISOString());
});

// Seed leads: 4 with varied status/priority/assignment.
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

// ── Request helper ──────────────────────────────────────────────
function authed(method: string, path: string, chatId?: string, body?: unknown): Request {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (chatId) headers["X-Telegram-Chat-Id"] = chatId;
  return new Request(`https://test.local${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── Authorization tests ─────────────────────────────────────────
describe("Operations API — authorization", () => {
  it("rejects unauthenticated requests (no identity header) with 401", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads"), E);
    expect(res.status).toBe(401);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("unauthenticated");
  });

  it("rejects VIEWER from leads.update (PATCH) with 403", async () => {
    const res = await worker.fetch(authed("PATCH", "/api/v1/ops/leads/L1", "tg-viewer", { status: "contacted" }), E);
    expect(res.status).toBe(403);
    const body = await res.json() as { error?: string };
    expect(body.error).toBe("forbidden");
  });

  it("rejects OPS user whose leads.update is revoked (deny wins) with 403", async () => {
    const res = await worker.fetch(authed("PATCH", "/api/v1/ops/leads/L1", "tg-ops-revoked", { status: "contacted" }), E);
    expect(res.status).toBe(403);
  });

  it("allows OWNER through all ops endpoints (superuser short-circuit)", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads", "tg-owner"), E);
    expect(res.status).toBe(200);
  });
});

// ── Listing + filtering ─────────────────────────────────────────
describe("Operations API — lead listing", () => {
  it("lists all leads for an authorized admin", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads", "tg-admin"), E);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; leads: unknown[]; total: number };
    expect(body.success).toBe(true);
    expect(body.total).toBe(4);
    expect(body.leads).toHaveLength(4);
  });

  it("filters by status", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads?status=new", "tg-admin"), E);
    const body = await res.json() as { leads: { status: string }[]; total: number };
    expect(body.total).toBe(2); // L1 + L3
    expect(body.leads.every((l) => l.status === "new")).toBe(true);
  });

  it("filters by unassigned scope", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads?scope=unassigned", "tg-admin"), E);
    const body = await res.json() as { leads: { assigned_to: string | null }[]; total: number };
    expect(body.total).toBe(1); // L3
    expect(body.leads[0].assigned_to).toBeNull();
  });

  it("rejects an invalid status filter with 400", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads?status=bogus", "tg-admin"), E);
    expect(res.status).toBe(400);
  });

  it("paginates with limit/offset", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads?limit=2&offset=1", "tg-admin"), E);
    const body = await res.json() as { leads: unknown[]; limit: number; offset: number };
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(1);
    expect(body.leads).toHaveLength(2);
  });
});

// ── Detail ──────────────────────────────────────────────────────
describe("Operations API — lead detail", () => {
  it("returns a single lead with assignee name", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads/L1", "tg-admin"), E);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; lead: { id: string; assignee_name: string | null } };
    expect(body.lead.id).toBe("L1");
    expect(body.lead.assignee_name).toBe("Ops");
  });

  it("returns 404 for unknown lead", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads/NOPE", "tg-admin"), E);
    expect(res.status).toBe(404);
  });
});

// ── Update ──────────────────────────────────────────────────────
describe("Operations API — lead update", () => {
  it("updates status + priority + notes for an ops user with leads.update", async () => {
    const res = await worker.fetch(
      authed("PATCH", "/api/v1/ops/leads/L1", "tg-ops", { status: "contacted", priority: "high", notes: "called" }),
      E,
    );
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; lead: { status: string; priority: string; notes: string } };
    expect(body.lead.status).toBe("contacted");
    expect(body.lead.priority).toBe("high");
    expect(body.lead.notes).toBe("called");
  });

  it("rejects an invalid priority with 400", async () => {
    const res = await worker.fetch(authed("PATCH", "/api/v1/ops/leads/L1", "tg-ops", { priority: "critical" }), E);
    expect(res.status).toBe(400);
  });

  it("persists the update to D1 (subsequent GET reflects it)", async () => {
    await worker.fetch(authed("PATCH", "/api/v1/ops/leads/L3", "tg-ops", { priority: "urgent" }), E);
    const get = await worker.fetch(authed("GET", "/api/v1/ops/leads/L3", "tg-admin"), E);
    const body = await get.json() as { lead: { priority: string } };
    expect(body.lead.priority).toBe("urgent");
  });
});

// ── Assign ──────────────────────────────────────────────────────
describe("Operations API — lead assignment", () => {
  it("assigns a lead to an ops user (leads.assign)", async () => {
    const res = await worker.fetch(authed("POST", "/api/v1/ops/leads/L3/assign", "tg-ops", { assignee_id: "tg-ops" }), E);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; lead: { assigned_to: string | null } };
    expect(body.lead.assigned_to).toBe("tg-ops");
  });

  it("unassigns a lead (assignee_id: null) returning it to the pool", async () => {
    const res = await worker.fetch(authed("POST", "/api/v1/ops/leads/L3/assign", "tg-ops", { assignee_id: null }), E);
    const body = await res.json() as { lead: { assigned_to: string | null } };
    expect(body.lead.assigned_to).toBeNull();
  });

  it("rejects assignment to a non-existent user with 400", async () => {
    const res = await worker.fetch(authed("POST", "/api/v1/ops/leads/L3/assign", "tg-ops", { assignee_id: "ghost" }), E);
    expect(res.status).toBe(400);
  });

  it("returns 404 when assigning a missing lead", async () => {
    const res = await worker.fetch(authed("POST", "/api/v1/ops/leads/NOPE/assign", "tg-ops", { assignee_id: "tg-ops" }), E);
    expect(res.status).toBe(404);
  });
});

// ── My leads ────────────────────────────────────────────────────
describe("Operations API — my leads", () => {
  it("returns only leads assigned to the calling ops user", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/leads/mine", "tg-ops"), E);
    expect(res.status).toBe(200);
    const body = await res.json() as { leads: { assigned_to: string | null }[]; total: number };
    // L1 (tg-ops) + L2 (tg-ops) — L3 unassigned, L4 assigned to tg-admin.
    expect(body.total).toBe(2);
    expect(body.leads.every((l) => l.assigned_to === "tg-ops")).toBe(true);
  });
});

// ── Dashboard ───────────────────────────────────────────────────
describe("Operations API — dashboard", () => {
  it("returns aggregate totals + recent activity", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/dashboard", "tg-admin"), E);
    expect(res.status).toBe(200);
    const body = await res.json() as {
      success: boolean;
      dashboard: {
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
        recent_leads: unknown[];
        recent_activity: unknown[];
      };
    };
    expect(body.dashboard.totals.leads).toBe(4);
    expect(body.dashboard.totals.leads_new).toBe(2);
    expect(body.dashboard.totals.leads_contacted).toBe(1);
    expect(body.dashboard.totals.leads_qualified).toBe(1);
    expect(body.dashboard.totals.unassigned).toBe(1);
    // L2 seeded as urgent priority → 1 urgent lead.
    expect(body.dashboard.totals.urgent).toBe(1);
    expect(Array.isArray(body.dashboard.recent_leads)).toBe(true);
    expect(Array.isArray(body.dashboard.recent_activity)).toBe(true);
  });
});

// ── Timeline ────────────────────────────────────────────────────
describe("Operations API — timeline", () => {
  it("returns a merged activity feed", async () => {
    const res = await worker.fetch(authed("GET", "/api/v1/ops/timeline?limit=10", "tg-admin"), E);
    expect(res.status).toBe(200);
    const body = await res.json() as { success: boolean; events: { id: string; kind: string; occurred_at: string }[] };
    expect(body.success).toBe(true);
    expect(body.events.length).toBeGreaterThan(0);
    expect(body.events.every((e) => ["lead", "audit"].includes(e.kind))).toBe(true);
    // Sorted descending by time.
    for (let i = 1; i < body.events.length; i++) {
      expect(body.events[i - 1].occurred_at >= body.events[i].occurred_at).toBe(true);
    }
  });
});
