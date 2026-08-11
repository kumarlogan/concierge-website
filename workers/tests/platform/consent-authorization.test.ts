// ┌─────────────────────────────────────────────────────────────┐
// │ Phase L — Consent IDOR / Authorization Remediation          │
// │ Provider: agsy Merge                                        │
// └─────────────────────────────────────────────────────────────┘
//
// Regression tests for the Phase L consent authorization bypass
// (Patient A could create/revoke consent for Patient B via a
// client-supplied identityId / consentId).
//
// Coverage:
//   1. Route-level consent GRANT authorization matrix (403, no engine call)
//   2. Route-level consent REVOKE ownership forwarding + 403 mapping
//      (replaces the previous unhandled HTTP 500 on unauthorized revoke)
//   3. D1ConsentEngine ownership enforcement + "NO D1 MUTATION" verification
//      on every unauthorized attempt
//   4. Normal A→A behaviour still works (feature not broken)

import { describe, it, expect, vi } from "vitest";
import { consentGrant, consentRevoke } from "../../src/routes/trustRuntime.js";
import { withAuthzErrors, AuthzError } from "../../src/middleware/authz.js";
import { D1ConsentEngine } from "../../src/platform/trust/d1-consent-engine.js";
import { ConsentSource, ConsentType } from "../../src/platform/trust/types.js";

// ── Route-level harness ─────────────────────────────────────
// Protected routes are withJwtAuth(withAuthzErrors(handler)). We exercise the
// authorization half (withAuthzErrors) with the JWT-bound identity headers set
// directly, exactly as withJwtAuth would attach them from a verified JWT.

function authedRequest(
  method: string,
  path: string,
  identityId: string,
  identityType = "patient",
  body?: unknown,
): Request {
  const headers = new Headers();
  headers.set("x-authenticated-identity-id", identityId);
  headers.set("x-authenticated-identity-type", identityType);
  const init: RequestInit = { method, headers };
  if (body !== undefined) {
    init.body = JSON.stringify(body);
    headers.set("Content-Type", "application/json");
  }
  return new Request(`https://api.agsynergy.ca${path}`, init);
}

type EngineCall = { method: string; args: unknown[] };

function makeEnv(engine: unknown) {
  const calls: EngineCall[] = [];
  const recorded = engine as {
    grantConsent?: (...a: unknown[]) => unknown;
    revokeConsent?: (...a: unknown[]) => unknown;
  };
  const wrapped = {
    grantConsent: (...args: unknown[]) => {
      calls.push({ method: "grantConsent", args });
      if (recorded.grantConsent) return recorded.grantConsent(...args);
      return { id: "c-" + Math.random(), granted: true, versionToken: "v", createdAt: "2026-08-11T00:00:00Z" };
    },
    revokeConsent: (...args: unknown[]) => {
      calls.push({ method: "revokeConsent", args });
      if (recorded.revokeConsent) return recorded.revokeConsent(...args);
      return { consentId: args[2], revoked: true, revokedAt: "2026-08-11T00:00:00Z" };
    },
  };
  return {
    env: {
      CONSENT_ENGINE: wrapped,
      EVENT_BUS: { publish: vi.fn().mockResolvedValue(undefined) },
    } as unknown as Record<string, unknown>,
    calls,
  };
}

const grant = withAuthzErrors(consentGrant);
const revoke = withAuthzErrors(consentRevoke);

const PRIVACY: Record<string, unknown> = { consentType: ConsentType.PRIVACY, scope: [], purpose: "test" };

// ── 1. Consent GRANT authorization matrix ────────────────────

describe("consentGrant — authorization (Phase L)", () => {
  it("A granting consent for A (body identityId=A) → 201, engine called with A", async () => {
    const { env, calls } = makeEnv({});
    const res = await grant(
      authedRequest("POST", "/api/v1/consent/grant", "A", "patient", { identityId: "A", ...PRIVACY }),
      env as never,
      {},
    );
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("grantConsent");
    expect(calls[0].args[0]).toBe("A");
    const payload = calls[0].args[1] as Record<string, unknown>;
    expect(payload.consentType).toBe(ConsentType.PRIVACY);
    expect(payload).not.toHaveProperty("identityId");
  });

  it("A attempting consent for B (body identityId=B) → 403, engine NOT called (no mutation)", async () => {
    const { env, calls } = makeEnv({});
    const res = await grant(
      authedRequest("POST", "/api/v1/consent/grant", "A", "patient", { identityId: "B", ...PRIVACY }),
      env as never,
      {},
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("A attempting consent for B (query ?identityId=B) → 403, engine NOT called", async () => {
    const { env, calls } = makeEnv({});
    const res = await grant(
      authedRequest("POST", "/api/v1/consent/grant?identityId=B", "A", "patient", PRIVACY),
      env as never,
      {},
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("A omitting identityId → server derives A from JWT, consent granted for A", async () => {
    const { env, calls } = makeEnv({});
    const res = await grant(authedRequest("POST", "/api/v1/consent/grant", "A", "patient", PRIVACY), env as never, {});
    expect(res.status).toBe(201);
    expect(calls).toHaveLength(1);
    expect(calls[0].args[0]).toBe("A");
  });

  it("B attempting consent for A (body identityId=A) → 403, engine NOT called", async () => {
    const { env, calls } = makeEnv({});
    const res = await grant(
      authedRequest("POST", "/api/v1/consent/grant", "B", "patient", { identityId: "A", ...PRIVACY }),
      env as never,
      {},
    );
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it("A consenting for self WITHOUT body identityId (JWT-derived) is the normal path → 201", async () => {
    const { env, calls } = makeEnv({});
    const res = await grant(authedRequest("POST", "/api/v1/consent/grant", "A", "patient", PRIVACY), env as never, {});
    expect(res.status).toBe(201);
    expect(calls[0].args[0]).toBe("A");
  });
});

// ── 2. Consent REVOKE ownership forwarding + 403 mapping ─────

describe("consentRevoke — authorization (Phase L)", () => {
  it("A revoking A's own consent → 200, engine called with caller identity A", async () => {
    const { env, calls } = makeEnv({});
    const res = await revoke(
      authedRequest("POST", "/api/v1/consent/revoke", "A", "patient", { consentId: "consent-A", reason: "x" }),
      env as never,
      {},
    );
    expect(res.status).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0].method).toBe("revokeConsent");
    expect(calls[0].args[0]).toBe("A"); // caller identity (JWT), never client-supplied
    expect(calls[0].args[1]).toBe("patient");
    expect(calls[0].args[2]).toBe("consent-A");
  });

  it("Unauthorized revoke (ownership mismatch) surfaces as 403, not HTTP 500", async () => {
    const engine = {
      revokeConsent: () => {
        throw new AuthzError("Not authorized to revoke this consent", "CONSENT_NOT_OWNED", 403);
      },
    };
    const { env } = makeEnv(engine);
    const res = await revoke(
      authedRequest("POST", "/api/v1/consent/revoke", "A", "patient", { consentId: "consent-B", reason: "x" }),
      env as never,
      {},
    );
    expect(res.status).toBe(403);
    const body = (await res.json()) as { code?: string };
    expect(body.code).toBe("CONSENT_NOT_OWNED");
    // No SQL / stack / schema leakage in the body
    expect(JSON.stringify(body)).not.toMatch(/sql|stack|syntax|constraint|consent_versions/i);
  });

  it("Revoke requires consentId and reason → 400", async () => {
    const { env, calls } = makeEnv({});
    const res = await revoke(
      authedRequest("POST", "/api/v1/consent/revoke", "A", "patient", { reason: "x" }),
      env as never,
      {},
    );
    expect(res.status).toBe(400);
    expect(calls).toHaveLength(0);
  });
});

// ── 3. D1ConsentEngine ownership enforcement + no mutation ───

type Row = Record<string, unknown>;

/** Minimal D1 double recording every write; only supports the SELECT the
 *  engine issues for ownership lookup. Write .run() calls are recorded so
 *  tests can assert NO mutation occurred on denied paths. */
class RecordingD1 {
  runs: Array<{ sql: string; values: unknown[] }> = [];
  constructor(private seed: Record<string, Row[]> = {}) {}
  prepare(sql: string): any {
    const self = this;
    return {
      bind(...values: unknown[]) {
        return {
          async first(): Promise<Row | null> {
            const m = /FROM\s+(\w+)\s+WHERE\s+id\s*=\s*\?/i.exec(sql);
            if (m) {
              const rows = self.seed[m[1]] ?? [];
              return rows.find((r) => r.id === values[0]) ?? null;
            }
            return null;
          },
          async run() {
            self.runs.push({ sql: sql.trim(), values: [...values] });
            return { success: true, meta: {} };
          },
          async all() {
            self.runs.push({ sql: sql.trim(), values: [...values] });
            return { success: true, results: [] as Row[], meta: {} };
          },
          async raw() {
            return [] as Row[];
          },
        };
      },
      async run() {
        self.runs.push({ sql: sql.trim(), values: [] });
        return { success: true, meta: {} };
      },
      async first(): Promise<Row | null> {
        return null;
      },
      async all() {
        return { success: true, results: [] as Row[], meta: {} };
      },
      async raw() {
        return [] as Row[];
      },
    };
  }
  async batch(statements: any[]): Promise<unknown[]> {
    for (const s of statements) await s.run();
    return [];
  }
  /** Count of write statements (INSERT/UPDATE) issued. */
  writes(): number {
    return this.runs.filter((r) => /^(INSERT|UPDATE)/i.test(r.sql)).length;
  }
}

function consentRow(consentId: string, owner: string): Row {
  return {
    id: consentId,
    identity_id: owner,
    consent_type: "privacy",
    granted: 1,
    scope: "[]",
    purpose: "test",
    source: "explicit",
    delegator_id: null,
    expires_at: null,
    version: 1,
    metadata: "{}",
    created_at: "2026-08-11T00:00:00Z",
    revoked_at: null,
    version_token: "tok",
    updated_at: "2026-08-11T00:00:00Z",
  };
}

describe("D1ConsentEngine.revokeConsent — ownership + no unauthorized mutation", () => {
  it("A revoking B's consent (JWT A) → AuthzError, ZERO D1 writes", async () => {
    const db = new RecordingD1({ consents: [consentRow("consent-B", "B")] });
    const engine = new D1ConsentEngine(db as never);
    await expect(engine.revokeConsent("A", "patient", "consent-B", "x")).rejects.toBeInstanceOf(AuthzError);
    expect(db.writes()).toBe(0);
  });

  it("B revoking B's own consent (JWT B) → success, writes occur (normal behaviour intact)", async () => {
    const db = new RecordingD1({ consents: [consentRow("consent-B", "B")] });
    const engine = new D1ConsentEngine(db as never);
    const result = await engine.revokeConsent("B", "patient", "consent-B", "x");
    expect(result.revoked).toBe(true);
    expect(db.writes()).toBeGreaterThan(0);
  });

  it("staff revoking any consent → success (cross-patient revoke is staff's job)", async () => {
    const db = new RecordingD1({ consents: [consentRow("consent-B", "B")] });
    const engine = new D1ConsentEngine(db as never);
    const result = await engine.revokeConsent("staff-1", "clinic", "consent-B", "admin action");
    expect(result.revoked).toBe(true);
    expect(db.writes()).toBeGreaterThan(0);
  });

  it("patient revoking an unknown consent id → 403 (no enumeration), ZERO D1 writes", async () => {
    const db = new RecordingD1({ consents: [] });
    const engine = new D1ConsentEngine(db as never);
    const err = await engine.revokeConsent("A", "patient", "does-not-exist", "x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthzError);
    expect((err as AuthzError).status).toBe(403);
    expect(db.writes()).toBe(0);
  });

  it("staff revoking an unknown consent id → controlled 404, ZERO D1 writes", async () => {
    const db = new RecordingD1({ consents: [] });
    const engine = new D1ConsentEngine(db as never);
    const err = await engine.revokeConsent("staff-1", "clinic", "does-not-exist", "x").catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AuthzError);
    expect((err as AuthzError).status).toBe(404);
    expect(db.writes()).toBe(0);
  });
});

describe("D1ConsentEngine.grantConsent — authoritative identity", () => {
  it("writes identity_id from the acting (JWT) identity, not any client data", async () => {
    const db = new RecordingD1({ consents: [] });
    const engine = new D1ConsentEngine(db as never);
    const result = await engine.grantConsent("A", {
      consentType: ConsentType.PRIVACY,
      scope: [],
      purpose: "test",
      source: ConsentSource.EXPLICIT,
    });
    expect(result.granted).toBe(true);
    // INSERT INTO consents bound values: [consentId, identity_id, ...] → [1] must be 'A'
    const insert = db.runs.find((r) => /^INSERT INTO consents/i.test(r.sql));
    expect(insert).toBeDefined();
    expect(insert!.values[1]).toBe("A");
  });
});
