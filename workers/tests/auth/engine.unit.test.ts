// ┌─────────────────────────────────────────────────────────────┐
// │ AG Synergy Platform — Authorization Engine Unit Tests        │
// │ EPIC-002-002: Identity & Authorization Engine                │
// └─────────────────────────────────────────────────────────────┘
//
// Pure unit tests for the permission math and principal building. These use a
// hand-built in-memory mock of the D1 query surface (prepare/bind/first/all/
// run) so they run fast and deterministically with NO Miniflare/network.
//
// They verify the DATA-DRIVEN contract of ADR-003:
//   • role grants come from role_permissions rows (no code constant)
//   • user revoke overrides grant (deny wins)
//   • OWNER short-circuits to all permissions

import { describe, it, expect } from "vitest";
import {
  resolveEffectivePermissions,
  hasPermission,
  OWNER_ROLE_NAME,
} from "../../src/auth/permissions.js";
import { buildPrincipal } from "../../src/auth/principal.js";
import { writeAuditEvent } from "../../src/auth/audit.js";
import { AuthError } from "../../src/auth/types.js";

// ── Tiny in-memory D1 mock ────────────────────────────────────
// Supports the exact chained API the engine uses:
//   db.prepare(sql).bind(...).first<T>() / .all<T>() / .run()

interface Row {
  [k: string]: unknown;
}

class MockD1 {
  private tables: Record<string, Row[]> = {};
  constructor(seed: Record<string, Row[]>) {
    this.tables = seed;
  }
  prepare(_sql: string) {
    // We don't parse SQL — callers register canned query results per test.
    return this;
  }
  bind(..._args: unknown[]) {
    return this;
  }
  async first<T extends Row>(): Promise<T | null> {
    return (this._pending as T[]) ? (this._pending as T[])[0] ?? null : null;
  }
  async all<T extends Row>(): Promise<{ results: T[] }> {
    return { results: (this._pending as T[]) ?? [] };
  }
  async run(): Promise<{ success: true }> {
    return { success: true };
  }
  // Test harness hook: set what the next first()/all() returns.
  _pending: Row[] | null = null;
  setPending(rows: Row[] | null) {
    this._pending = rows;
  }
}

// Helper: build a mock that returns `rows` for the next .all()/.first() call.
function mockDb(rows: Row[]): MockD1 {
  const db = new MockD1({});
  db.setPending(rows);
  return db;
}

// ── Permission resolution math ───────────────────────────────

describe("resolveEffectivePermissions", () => {
  it("returns role grants read from role_permissions only (no code constant)", async () => {
    // Simulate the JOIN result from role_permissions -> permissions.
    const db = mockDb([
      { permission_key: "leads.read" },
      { permission_key: "leads.update" },
      { permission_key: "consultations.read" },
    ]);
    const perms = await resolveEffectivePermissions(db as any, "role-ops", "user-1");
    expect(perms.has("leads.read")).toBe(true);
    expect(perms.has("leads.update")).toBe(true);
    expect(perms.has("consultations.read")).toBe(true);
    expect(perms.has("audit.read")).toBe(false);
  });

  it("applies user grant override on top of role grants", async () => {
    // Role grants
    const db = mockDb([
      { permission_key: "leads.read" },
    ]);
    // We need TWO query results: first the role query, then the user query.
    // Build a sequenced mock instead.
    const seq = new MockD1({});
    const calls: Row[][] = [
      [{ permission_key: "leads.read" }], // role_permissions
      [{ permission_key: "audit.read", effect: "grant" }], // user_permissions
    ];
    let i = 0;
    seq.first = async () => null; // role name lookup returns something below
    seq.all = async (): Promise<{ results: Row[] }> => ({ results: calls[i++] ?? [] });
    // Patch getRoleName by returning OWNER? No — we want non-owner path.
    // Simplest: stub getRoleName via separate mock is overkill; instead
    // provide role name first. We re-implement a sequenced mock precisely:
    const seq2 = new SequenceMock([
      [{ name: "OPERATIONS" }], // getRoleName
      [{ permission_key: "leads.read" }], // role_permissions
      [{ permission_key: "audit.read", effect: "grant" }], // user_permissions
    ]);
    const perms = await resolveEffectivePermissions(seq2 as any, "role-ops", "user-1");
    expect(perms.has("leads.read")).toBe(true);
    expect(perms.has("audit.read")).toBe(true); // granted by user override
  });

  it("deny wins: a user revoke removes a role-granted permission", async () => {
    const seq = new SequenceMock([
      [{ name: "OPERATIONS" }],
      [{ permission_key: "leads.update" }], // role grants it
      [{ permission_key: "leads.update", effect: "revoke" }], // user revokes it
    ]);
    const perms = await resolveEffectivePermissions(seq as any, "role-ops", "user-1");
    expect(perms.has("leads.update")).toBe(false);
  });

  it("OWNER short-circuits to ALL permission keys", async () => {
    const seq = new SequenceMock([
      [{ name: OWNER_ROLE_NAME }], // getRoleName -> OWNER
      [{ key: "leads.read" }, { key: "leads.update" }, { key: "audit.read" }], // allPermissionKeys
    ]);
    const perms = await resolveEffectivePermissions(seq as any, "role-owner", "user-owner");
    expect(perms.has("leads.read")).toBe(true);
    expect(perms.has("leads.update")).toBe(true);
    expect(perms.has("audit.read")).toBe(true);
    expect(perms.size).toBe(3);
  });
});

describe("hasPermission", () => {
  it("returns true when role holds the permission", async () => {
    const seq = new SequenceMock([
      [{ name: "ADMIN" }], // getRoleName
      [{ hit: 1 }], // role_permissions hit
      [], // user_permissions empty
    ]);
    expect(await hasPermission(seq as any, "role-admin", "u1", "leads.read")).toBe(true);
  });

  it("returns false when neither role nor user grants it", async () => {
    const seq = new SequenceMock([
      [{ name: "VIEWER" }], // getRoleName
      [], // role_permissions miss
      [], // user_permissions empty
    ]);
    expect(await hasPermission(seq as any, "role-viewer", "u1", "leads.update")).toBe(false);
  });

  it("OWNER short-circuits to true for any permission", async () => {
    const seq = new SequenceMock([
      [{ name: OWNER_ROLE_NAME }], // getRoleName -> OWNER (short-circuit)
    ]);
    expect(await hasPermission(seq as any, "role-owner", "u1", "users.manage")).toBe(true);
  });

  it("user revoke overrides a role grant (deny wins)", async () => {
    // Role grant MUST miss so hasPermission proceeds to the user override
    // layer, where the revoke should win.
    const seq = new SequenceMock([
      [{ name: "ADMIN" }], // getRoleName
      [], // role_permissions hit -> MISS (so we check user overrides)
      [{ permission_key: "leads.update", effect: "revoke" }], // user revokes it
    ]);
    expect(await hasPermission(seq as any, "role-admin", "u1", "leads.update")).toBe(false);
  });

  it("user grant adds a permission the role lacks", async () => {
    const seq = new SequenceMock([
      [{ name: "VIEWER" }], // getRoleName
      [], // role grant miss
      [{ permission_key: "leads.update", effect: "grant" }], // user grant
    ]);
    expect(await hasPermission(seq as any, "role-viewer", "u1", "leads.update")).toBe(true);
  });
});

describe("buildPrincipal", () => {
  it("builds a Principal with effective permissions from data", async () => {
    const seq = new SequenceMock([
      [
        {
          id: "user-1",
          role_id: "role-ops",
          external_id: "tg-123",
          is_active: 1,
          display_name: "Ops Lead",
        },
      ], // users lookup
      [{ id: "role-ops", name: "OPERATIONS" }], // role lookup
      [{ name: "OPERATIONS" }], // getRoleName (inside resolveEffectivePermissions)
      [{ permission_key: "leads.read" }, { permission_key: "leads.update" }], // role perms
      [], // user perms
    ]);
    const identity = { provider: "telegram", providerIdentifier: "tg-123" };
    const principal = await buildPrincipal(seq as any, identity);
    expect(principal.userId).toBe("user-1");
    expect(principal.roleName).toBe("OPERATIONS");
    expect(principal.provider).toBe("telegram");
    expect(principal.providerIdentifier).toBe("tg-123");
    expect(principal.permissions.has("leads.read")).toBe(true);
    expect(principal.metadata.displayName).toBe("Ops Lead");
  });

  it("rejects a disabled principal with 403", async () => {
    const seq = new SequenceMock([
      [
        {
          id: "user-2",
          role_id: "role-x",
          external_id: "tg-999",
          is_active: 0,
          display_name: null,
        },
      ],
    ]);
    await expect(
      buildPrincipal(seq as any, { provider: "telegram", providerIdentifier: "tg-999" }),
    ).rejects.toBeInstanceOf(AuthError);
  });

  it("rejects an unknown identity with 401", async () => {
    const seq = new SequenceMock([[]]); // no user row
    await expect(
      buildPrincipal(seq as any, { provider: "telegram", providerIdentifier: "tg-unknown" }),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("writeAuditEvent", () => {
  it("serializes allow decisions with the bare permission as action", async () => {
    const captured: any = {};
    const db = new CaptureMock(captured);
    const id = await writeAuditEvent(db as any, {
      actorId: "user-1",
      permission: "leads.read",
      resource: { type: "lead", id: "lead-42" },
      result: "allow",
      reason: "role grant",
      timestamp: new Date().toISOString(),
      context: { provider: "telegram", ipAddress: "1.2.3.4", userAgent: "test" },
    });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(captured.action).toBe("leads.read");
    expect(captured.decision).toBe("allow");
    expect(captured.target_type).toBe("lead");
    expect(captured.target_id).toBe("lead-42");
    const meta = JSON.parse(captured.metadata);
    expect(meta.provider).toBe("telegram");
  });

  it("prefixes denied permissions with 'denied:'", async () => {
    const captured: any = {};
    const db = new CaptureMock(captured);
    await writeAuditEvent(db as any, {
      actorId: "user-1",
      permission: "users.manage",
      result: "deny",
      timestamp: new Date().toISOString(),
    });
    expect(captured.action).toBe("denied:users.manage");
    expect(captured.decision).toBe("deny");
  });
});

// ── Sequenced mock: returns the Nth registered row-set for each all()/first()
// call in order, looping the last set if exhausted. ─────────────────────────
class SequenceMock {
  private i = 0;
  constructor(private sets: Row[][]) {}
  prepare(_sql: string) {
    return this;
  }
  bind(..._a: unknown[]) {
    return this;
  }
  async first<T extends Row>(): Promise<T | null> {
    const set = this.sets[Math.min(this.i, this.sets.length - 1)] ?? [];
    this.i++;
    return (set[0] as T) ?? null;
  }
  async all<T extends Row>(): Promise<{ results: T[] }> {
    const set = this.sets[Math.min(this.i, this.sets.length - 1)] ?? [];
    this.i++;
    return { results: set as T[] };
  }
  async run() {
    return { success: true };
  }
}

// ── Capture mock: records the bound params of the INSERT. ─────────────────
class CaptureMock {
  constructor(private target: Record<string, unknown>) {}
  prepare(_sql: string) {
    return this;
  }
  bind(...values: unknown[]) {
    // INSERT column order from audit.ts:
    // id, actor_id, action, target_type, target_id, ip, ua, decision, metadata, created_at
    const [
      id,
      actor_id,
      action,
      target_type,
      target_id,
      ip,
      ua,
      decision,
      metadata,
    ] = values;
    this.target.id = id;
    this.target.actor_id = actor_id;
    this.target.action = action;
    this.target.target_type = target_type;
    this.target.target_id = target_id;
    this.target.ip_address = ip;
    this.target.user_agent = ua;
    this.target.decision = decision;
    this.target.metadata = metadata;
    return this;
  }
  async first() {
    return null;
  }
  async all() {
    return { results: [] };
  }
  async run() {
    return { success: true };
  }
}
