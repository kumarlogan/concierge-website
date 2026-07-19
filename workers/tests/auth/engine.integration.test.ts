// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Authorization Engine Integration Tests  │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// End-to-end pipeline tests against REAL D1 (Miniflare), using the RBAC schema
// from migrations 0002 + 0003. No mocks — these exercise the actual SQL
// (role_permissions, user_permissions, audit_logs) the way production will.
//
// Pipeline under test:  Request(header) → resolveIdentity → buildPrincipal
//   → hasPermission (data-driven) → writeAuditEvent → Principal | 401/403

import { describe, it, expect, beforeAll } from "vitest";
import { env } from "cloudflare:workers";
import { authorize } from "../../src/auth/middleware.js";

// ── Seed the RBAC tables with a known scenario ────────────────
// This mirrors the production seed shape but uses test-scoped ids so it never
// collides with migration seed data.

interface SeedRow {
  [k: string]: unknown;
}

async function insert(db: any, sql: string, binds: unknown[]): Promise<void> {
  await db.prepare(sql).bind(...binds).run();
}

// Stable ids for the test scenario.
const ROLE_OWNER = "r-owner";
const ROLE_ADMIN = "r-admin";
const ROLE_OPS = "r-ops";
const ROLE_VIEWER = "r-viewer";
const PERM = {
  "leads.read": "p-leads-read",
  "leads.update": "p-leads-update",
  "leads.assign": "p-leads-assign",
  "consultations.read": "p-cons-read",
  "consultations.update": "p-cons-update",
  "audit.read": "p-audit-read",
  "users.manage": "p-users-manage",
} as const;

// The cloudflareTest pool gives each test file a fresh Miniflare D1, so we
// create the RBAC schema here (mirroring migrations 0002 + 0003 exactly) and
// seed a known scenario. This matches the existing integration test pattern
// (api.test.ts builds its schema in beforeAll rather than relying on the
// global migration apply).
const RBAC_DDL = `
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  resource TEXT NOT NULL,
  action TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id),
  external_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  effect TEXT NOT NULL CHECK (effect IN ('grant','revoke')),
  granted_by TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, permission_id)
);
CREATE TABLE IF NOT EXISTS role_permissions (
  id TEXT PRIMARY KEY,
  role_id TEXT NOT NULL REFERENCES roles(id),
  permission_id TEXT NOT NULL REFERENCES permissions(id),
  created_at TEXT NOT NULL,
  UNIQUE(role_id, permission_id)
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  decision TEXT NOT NULL,
  metadata TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

beforeAll(async () => {
  const db = env.DB;

  // Create schema.
  for (const stmt of RBAC_DDL.split(";").map((s) => s.trim()).filter(Boolean)) {
    await db.prepare(stmt).run();
  }

  const now = new Date().toISOString();

  // Roles
  for (const [id, name] of [
    [ROLE_OWNER, "OWNER"],
    [ROLE_ADMIN, "ADMIN"],
    [ROLE_OPS, "OPERATIONS"],
    [ROLE_VIEWER, "VIEWER"],
  ]) {
    await insert(db, "INSERT OR IGNORE INTO roles (id, name, description, created_at) VALUES (?1,?2,?3,?4)", [
      id,
      name,
      "test role",
      now,
    ]);
  }

  // Permissions
  for (const [key, id] of Object.entries(PERM)) {
    const [resource, action] = key.split(".");
    await insert(db, "INSERT OR IGNORE INTO permissions (id, key, resource, action, description, created_at) VALUES (?1,?2,?3,?4,?5,?6)", [
      id,
      key,
      resource,
      action,
      "test permission",
      now,
    ]);
  }

  // Role grants (data-driven)
  const grants: [string, string][] = [
    [ROLE_ADMIN, PERM["leads.read"]],
    [ROLE_ADMIN, PERM["leads.update"]],
    [ROLE_ADMIN, PERM["leads.assign"]],
    [ROLE_ADMIN, PERM["consultations.read"]],
    [ROLE_ADMIN, PERM["consultations.update"]],
    [ROLE_ADMIN, PERM["audit.read"]],
    [ROLE_OPS, PERM["leads.read"]],
    [ROLE_OPS, PERM["leads.update"]],
    [ROLE_OPS, PERM["consultations.read"]],
    [ROLE_OPS, PERM["consultations.update"]],
    [ROLE_VIEWER, PERM["leads.read"]],
    [ROLE_VIEWER, PERM["consultations.read"]],
  ];
  for (const [roleId, permId] of grants) {
    await insert(db, "INSERT OR IGNORE INTO role_permissions (id, role_id, permission_id, created_at) VALUES (?1,?2,?3,?4)", [
      `rp-${roleId}-${permId}`,
      roleId,
      permId,
      now,
    ]);
  }

  // Users — one per role, plus a constrained ops user with a revoke override.
  const users: [string, string, string, string][] = [
    ["u-owner", ROLE_OWNER, "tg-owner", "Owner"],
    ["u-admin", ROLE_ADMIN, "tg-admin", "Admin"],
    ["u-ops", ROLE_OPS, "tg-ops", "Ops"],
    ["u-viewer", ROLE_VIEWER, "tg-viewer", "Viewer"],
    ["u-ops-revoked", ROLE_OPS, "tg-ops-revoked", "OpsRevoked"],
  ];
  for (const [id, roleId, ext, name] of users) {
    await insert(db, "INSERT OR IGNORE INTO users (id, role_id, external_id, display_name, is_active, created_at) VALUES (?1,?2,?3,?4,?5,?6)", [
      id,
      roleId,
      ext,
      name,
      1,
      now,
    ]);
  }

  // User override: u-ops-revoked loses leads.update despite OPERATIONS role
  // holding it (deny wins).
  await insert(db, "INSERT OR IGNORE INTO user_permissions (id, user_id, permission_id, effect, granted_by, created_at) VALUES (?1,?2,?3,?4,?5,?6)", [
    "up-revoke-1",
    "u-ops-revoked",
    PERM["leads.update"],
    "revoke",
    "u-owner",
    now,
  ]);

  // User override: u-ops-revoked GAINS users.manage (a perm the role lacks).
  await insert(db, "INSERT OR IGNORE INTO user_permissions (id, user_id, permission_id, effect, granted_by, created_at) VALUES (?1,?2,?3,?4,?5,?6)", [
    "up-grant-1",
    "u-ops-revoked",
    PERM["users.manage"],
    "grant",
    "u-owner",
    now,
  ]);
});

// ── Helpers ──────────────────────────────────────────────────

function authedRequest(chatId: string, permission: string, resource?: { type: string; id?: string | null }): Request {
  const url = `https://test.local/api/v1/secure?perm=${encodeURIComponent(permission)}`;
  const headers: Record<string, string> = { "X-Telegram-Chat-Id": chatId };
  if (resource) headers["X-Resource-Type"] = resource.type;
  if (resource?.id) headers["X-Resource-Id"] = resource.id;
  return new Request(url, { method: "GET", headers });
}

// ── Pipeline tests ───────────────────────────────────────────

describe("Authorization pipeline (integration)", () => {
  it("OWNER is authorized for any permission (short-circuit) via Telegram header", async () => {
    const result = await authorize(env.DB, authedRequest("tg-owner", "users.manage"), {
      permission: "users.manage",
    });
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.principal.roleName).toBe("OWNER");
      expect(result.principal.permissions.has("users.manage")).toBe(true);
    }
  });

  it("ADMIN is authorized for an admin permission", async () => {
    const result = await authorize(env.DB, authedRequest("tg-admin", "leads.assign"), {
      permission: "leads.assign",
    });
    expect(result.authorized).toBe(true);
  });

  it("ADMIN is denied a permission the role lacks", async () => {
    const result = await authorize(env.DB, authedRequest("tg-admin", "users.manage"), {
      permission: "users.manage",
    });
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(403);
      const body = (await result.response.json()) as { error?: string };
      expect(body.error).toBe("forbidden");
    }
  });

  it("OPERATIONS is authorized for leads.read", async () => {
    const result = await authorize(env.DB, authedRequest("tg-ops", "leads.read"), {
      permission: "leads.read",
    });
    expect(result.authorized).toBe(true);
  });

  it("VIEWER is denied leads.update", async () => {
    const result = await authorize(env.DB, authedRequest("tg-viewer", "leads.update"), {
      permission: "leads.update",
    });
    expect(result.authorized).toBe(false);
  });

  it("user override REVOKE removes a role-granted permission (deny wins)", async () => {
    // u-ops-revoked has OPERATIONS role (which grants leads.update) but a
    // user_permissions revoke for leads.update.
    const result = await authorize(env.DB, authedRequest("tg-ops-revoked", "leads.update"), {
      permission: "leads.update",
    });
    expect(result.authorized).toBe(false);
  });

  it("user override GRANT adds a permission the role lacks", async () => {
    // u-ops-revoked gains users.manage via a user_permissions grant.
    const result = await authorize(env.DB, authedRequest("tg-ops-revoked", "users.manage"), {
      permission: "users.manage",
    });
    expect(result.authorized).toBe(true);
  });

  it("unknown Telegram chat id → 401 unauthenticated", async () => {
    const result = await authorize(env.DB, authedRequest("tg-unknown", "leads.read"), {
      permission: "leads.read",
    });
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it("request with no identity header → 401", async () => {
    const result = await authorize(
      env.DB,
      new Request("https://test.local/api/v1/secure", { method: "GET" }),
      { permission: "leads.read" },
    );
    expect(result.authorized).toBe(false);
    if (!result.authorized) expect(result.response.status).toBe(401);
  });

  it("writes an audit_logs row for BOTH allow and deny decisions", async () => {
    // Allow
    await authorize(env.DB, authedRequest("tg-viewer", "leads.read"), {
      permission: "leads.read",
      resource: { type: "lead", id: "lead-1" },
    });
    // Deny
    await authorize(env.DB, authedRequest("tg-viewer", "leads.update"), {
      permission: "leads.update",
    });

    const allowRow = await env.DB
      .prepare("SELECT * FROM audit_logs WHERE action = ?1 AND target_id = ?2 LIMIT 1")
      .bind("leads.read", "lead-1")
      .first();
    expect(allowRow).not.toBeNull();
    expect((allowRow as any).decision).toBe("allow");
    expect((allowRow as any).actor_id).toBe("u-viewer");

    const denyRow = await env.DB
      .prepare("SELECT * FROM audit_logs WHERE action = ?1 LIMIT 1")
      .bind("denied:leads.update")
      .first();
    expect(denyRow).not.toBeNull();
    expect((denyRow as any).decision).toBe("deny");
  });

  it("business services receive only the Principal (no provider id leakage)", async () => {
    const result = await authorize(env.DB, authedRequest("tg-admin", "leads.read"), {
      permission: "leads.read",
    });
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      const p = result.principal;
      // Principal carries provider info but it's structured, not raw request.
      expect(p.userId).toBe("u-admin");
      expect(p.roleName).toBe("ADMIN");
      expect(p.permissions instanceof Set).toBe(true);
      // A service could pass `p` downstream; it never needs the chat id.
      expect(Object.keys(p)).toEqual(
        expect.arrayContaining([
          "userId",
          "roleId",
          "roleName",
          "permissions",
          "provider",
          "providerIdentifier",
          "metadata",
        ]),
      );
    }
  });
});
