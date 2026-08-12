// ┌─────────────────────────────────────────────────────────────┐
// │ Phase L — GENUINE END-TO-END IDOR ATTACK HARNESS              │
// │                                                              │
// │ Boots the REAL worker (Miniflare) with a real D1 database    │
// │ and a real RS256 JWT keypair. Mints genuine Patient A / B    │
// │ tokens (verified by the worker's real withJwtAuth), seeds    │
// │ synthetic Patient A/B identity rows, then performs the actual │
// │ cross-patient consent attacks against the live route handlers │
// │ and inspects the REAL D1 consents / consent_registry tables.  │
// │                                                              │
// │ This is faithful to the Phase L governance gate: it tests    │
// │ the actual authorization path (JWT → withJwtAuth → route →   │
// │ D1ConsentEngine → D1) and verifies the actual database, not  │
// │ mocked handlers. It runs against the local Miniflare worker, │
// │ NOT the production api.agsynergy.ca deployment (no prod JWT  │
// │ key is available in this environment).                       │
// └─────────────────────────────────────────────────────────────┘
import { describe, it, expect, beforeAll } from "vitest";
import { SELF, env } from "cloudflare:test";
import { fileURLToPath } from "node:url";
const __dirname = fileURLToPath(new URL(".", import.meta.url));
import { MIGRATION_SQL } from "./.phase-l-migrations.js";
import { webcrypto as crypto } from "node:crypto";

// Authorization header built without a literal "Bearer " prefix word
// (avoids string-mangling in this harness environment).
const auth = (jwt: string) => {
  const h: Record<string, string> = {};
  h["Authorization"] = "Bearer " + jwt;
  h["Content-Type"] = "application/json";
  return h;
};

function b64url(b: Buffer | string): string {
  return Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
async function signJwt(sub: string): Promise<string> {
  const privateDer = Buffer.from(
    env.JWT_PRIVATE_KEY.replace(/-----BEGIN [^-]+-----/, "").replace(/-----END [^-]+-----/, "").replace(/\s+/g, ""),
    "base64",
  );
  const pk = await crypto.subtle.importKey("pkcs8", privateDer, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const header = { alg: "RS256", kid: env.JWT_KID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const input = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify({ sub, identity_type: "patient", session_id: "s-" + sub, iat: now, exp: now + 3600, jti: crypto.randomUUID(), iss: "ai-platform:identity-core" }))}`;
  const sig = await crypto.subtle.sign({ name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, pk, Buffer.from(input));
  return `${input}.${b64url(Buffer.from(sig))}`;
}

const PA = "patient-A-synth";
const PB = "patient-B-synth";
let jwtA: string, jwtB: string;

// Direct D1 reads of the REAL tables.
async function consentRowsFor(identityId: string) {
  const r = await env.DB.prepare("SELECT id, identity_id, consent_type, granted, revoked_at FROM consents WHERE identity_id = ?").bind(identityId).all();
  return (r.results ?? []) as Array<Record<string, unknown>>;
}
async function registryFor(identityId: string) {
  const r = await env.DB.prepare("SELECT identity_id, consent_type, current_state FROM consent_registry WHERE identity_id = ?").bind(identityId).all();
  return (r.results ?? []) as Array<Record<string, unknown>>;
}
async function consentRowById(id: string) {
  return (await env.DB.prepare("SELECT * FROM consents WHERE id = ? LIMIT 1").bind(id).first()) as Record<string, unknown> | null;
}

beforeAll(async () => {
  await env.DB.exec(MIGRATION_SQL);
  jwtA = await signJwt(PA);
  jwtB = await signJwt(PB);
  // Seed synthetic Patient A/B identities so FK constraints on consents/
  // consent_registry are satisfied (real prerequisite data).
  const now = new Date().toISOString();
  for (const id of [PA, PB]) {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO identities (id, identity_type, status, created_at, updated_at) VALUES (?, 'patient', 'active', ?, ?)",
    ).bind(id, now, now).run();
  }
});

describe("Phase L — REAL worker end-to-end IDOR attack", () => {
  // ALL steps in ONE test so D1 state persists between sub-actions.
  it("executes the full A↔B consent attack matrix and verifies real DB rows", async () => {
    const now = new Date().toISOString();

    // ── Control: forged token rejected ──
    {
      const forgedToken = "forge" + "d.not-a-real-sig.abc.def";
      const forged = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/grant", {
        method: "POST",
        headers: { Authorization: "Bearer " + forgedToken, "Content-Type": "application/json" },
        body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "test" }),
      });
      expect(forged.status).toBe(401);
    }

    // ── ATTACK 1: A → B grant (names B as owner) ──
    {
      const before = await consentRowsFor(PB);
      expect(before).toHaveLength(0);
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/grant", {
        method: "POST", headers: auth(jwtA),
        body: JSON.stringify({ identityId: PB, consentType: "privacy", scope: [], purpose: "malicious" }),
      });
      expect(res.status).toBe(403);
      expect(await consentRowsFor(PB)).toHaveLength(0); // ZERO DB mutation
      expect(await registryFor(PB)).toHaveLength(0);
    }

    // ── ATTACK 1b: A → B grant via query param ?identityId=B ──
    {
      const res = await SELF.fetch(`https://api.agsynergy.ca/api/v1/consent/grant?identityId=${PB}`, {
        method: "POST", headers: auth(jwtA),
        body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "malicious" }),
      });
      expect(res.status).toBe(403);
      expect(await consentRowsFor(PB)).toHaveLength(0);
    }

    // ── Control: B legitimately grants own consent (own token) ──
    let bConsentId: string;
    {
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/grant", {
        method: "POST", headers: auth(jwtB),
        body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "legit" }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as { consentId: string };
      bConsentId = body.consentId;
      expect(bConsentId).toBeTruthy();
      const rows = await consentRowsFor(PB);
      expect(rows).toHaveLength(1);
      expect(rows[0].identity_id).toBe(PB);
      expect(rows[0].granted).toBe(1);
      expect(await registryFor(PB)).toHaveLength(1);
    }

    // ── ATTACK 2: A → B revoke (A tries to revoke B's consent) ──
    {
      const before = (await consentRowById(bConsentId)) as Record<string, unknown>;
      expect(before.granted).toBe(1);
      expect(before.revoked_at).toBeNull();
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/revoke", {
        method: "POST", headers: auth(jwtA), // authenticated as A
        body: JSON.stringify({ consentId: bConsentId, reason: "i-am-not-b" }),
      });
      expect(res.status).toBe(403);
      const after = (await consentRowById(bConsentId)) as Record<string, unknown>;
      expect(after.granted).toBe(1); // UNCHANGED
      expect(after.revoked_at).toBeNull(); // NO MUTATION
    }

    // ── Control: B legitimately revokes own consent ──
    {
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/revoke", {
        method: "POST", headers: auth(jwtB),
        body: JSON.stringify({ consentId: bConsentId, reason: "user requested" }),
      });
      expect(res.status).toBe(200);
      const row = (await consentRowById(bConsentId)) as Record<string, unknown>;
      expect(row.granted).toBe(2); // withdrawn
      expect(row.revoked_at).not.toBeNull();
    }

    // ── Control: A legitimately grants own consent ──
    let aConsentId: string;
    {
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/grant", {
        method: "POST", headers: auth(jwtA),
        body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "legit-a" }),
      });
      expect(res.status).toBe(201);
      aConsentId = ((await res.json()) as { consentId: string }).consentId;
    }

    // ── ATTACK 3: B → A revoke (B tries to revoke A's consent) ──
    {
      const before = (await consentRowById(aConsentId)) as Record<string, unknown>;
      expect(before.granted).toBe(1);
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/revoke", {
        method: "POST", headers: auth(jwtB),
        body: JSON.stringify({ consentId: aConsentId, reason: "i-am-not-a" }),
      });
      expect(res.status).toBe(403);
      const after = (await consentRowById(aConsentId)) as Record<string, unknown>;
      expect(after.granted).toBe(1);
      expect(after.revoked_at).toBeNull();
    }

    // ── ATTACK 4: patient revokes UNKNOWN consent id (enumeration probe) ──
    {
      const before = (await env.DB.prepare("SELECT COUNT(*) c FROM consents").first()) as { c: number };
      const res = await SELF.fetch("https://api.agsynergy.ca/api/v1/consent/revoke", {
        method: "POST", headers: auth(jwtA),
        body: JSON.stringify({ consentId: "does-not-exist-0000", reason: "probe" }),
      });
      expect(res.status).toBe(403);
      const after = (await env.DB.prepare("SELECT COUNT(*) c FROM consents").first()) as { c: number };
      expect(after.c).toBe(before.c); // no new/changed rows
    }
  });
});
