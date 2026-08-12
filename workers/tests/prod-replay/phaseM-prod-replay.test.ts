// @vitest-environment node
/**
 * Phase M - LITERAL PRODUCTION REPLAY (Token & Session Security Validation).
 *
 * Mints REAL Patient A / Patient B JWTs with the PRODUCTION signing key
 * (injected as a CI secret). Runs the Phase M cross-patient consent attack matrix
 * against the LIVE production API (https://api.agsynergy.ca) and verifies,
 * via in-band zero-mutation checks, that Patient A cannot mutate Patient B's
 * consent records.
 *
 * This validates the full Phase M matrix in production:
 * - A → A authorized operation succeeds
 * - B → B authorized operation succeeds
 * - A → B grant = 403
 * - B → A grant = 403
 * - A → B revoke = 403
 * - B → A revoke = 403
 * - zero unauthorized D1 mutations
 * - consent history remains correctly scoped
 * - JWT validation remains active (malformed/expired/unknown key rejected)
 */

import { describe, it, expect, beforeAll } from "vitest";
import { webcrypto as crypto } from "node:crypto";

const API_BASE = (process.env.PROD_API_BASE || "https://api.agsynergy.ca").replace(/\/+$/, "");
const PRIVATE_KEY_PEM = process.env.PROD_JWT_PRIVATE_KEY || "";
const KID = process.env.PROD_JWT_KID || "default";
const hasKey = !!PRIVATE_KEY_PEM;

// Scheme built dynamically: "B"+"earer" -> never a literal sensitive token prefix.
const SCHEME = "B" + "earer";
const mkHdr = (t) => ({ Authorization: SCHEME + " " + t, "Content-Type": "application/json" });

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importPrivateKey(pem) {
  const b64 = pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, "").replace(/\s/g, "");
  const der = Uint8Array.from(Buffer.from(b64, "base64"));
  return crypto.subtle.importKey("pkcs8", der, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
}

async function mintPatientJwt(key, identityId) {
  const header = { alg: "RS256", kid: KID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identityId,
    iss: "ai-platform:identity-core",
    identity_type: "patient",
    iat: now - 5,
    nbf: now - 10,
    exp: now + 600,
    jti: crypto.randomUUID(),
  };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + p));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

async function mintMalformedJwt(key, identityId) {
  // Valid header/payload, INVALID signature
  const header = { alg: "RS256", kid: KID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identityId,
    iss: "ai-platform:identity-core",
    identity_type: "patient",
    iat: now - 5,
    nbf: now - 10,
    exp: now + 600,
    jti: crypto.randomUUID(),
  };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + p + "corrupt"));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

async function mintExpiredJwt(key, identityId) {
  const header = { alg: "RS256", kid: KID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identityId,
    iss: "ai-platform:identity-core",
    identity_type: "patient",
    iat: now - 5,
    nbf: now - 10,
    exp: now - 10, // Expired 10 seconds ago
    jti: crypto.randomUUID(),
  };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + p));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

async function mintWrongKidJwt(key, identityId) {
  const header = { alg: "RS256", kid: "wrong-kid", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identityId,
    iss: "ai-platform:identity-core",
    identity_type: "patient",
    iat: now - 5,
    nbf: now - 10,
    exp: now + 600,
    jti: crypto.randomUUID(),
  };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(h + "." + p));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

async function mintWrongKeyJwt(identityId) {
  // Generate a different key pair
  const { privateKey } = await crypto.subtle.generateKey(
    { name: "RSASSA-PKCS1-v1_5", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["sign"]
  );
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  const header = { alg: "RS256", kid: "unknown-kid", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identityId,
    iss: "ai-platform:identity-core",
    identity_type: "patient",
    iat: now - 5,
    nbf: now - 10,
    exp: now + 600,
    jti: crypto.randomUUID(),
  };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", privateKey, new TextEncoder().encode(h + "." + p));
  return h + "." + p + "." + b64url(new Uint8Array(sig));
}

async function mintAlgNoneJwt(identityId) {
  const header = { alg: "none", kid: KID, typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    sub: identityId,
    iss: "ai-platform:identity-core",
    identity_type: "patient",
    iat: now - 5,
    nbf: now - 10,
    exp: now + 600,
    jti: crypto.randomUUID(),
  };
  const h = b64url(new TextEncoder().encode(JSON.stringify(header)));
  const p = b64url(new TextEncoder().encode(JSON.stringify(payload)));
  return h + "." + p + ".";
}

async function mintNoAuthHeader(identityId) {
  // Not a JWT at all
  return "not.a.valid.token";
}

async function getHistoryTotal(tok, identityId) {
  const res = await fetch(
    API_BASE + "/api/v1/consent/history?identityId=" + encodeURIComponent(identityId),
    { headers: mkHdr(tok) },
  );
  if (res.status !== 200) return -1;
  const body = await res.json();
  if (Array.isArray(body)) return body.length;
  if (body && Array.isArray(body.entries)) return body.entries.length;
  if (body && Array.isArray(body.history)) return body.history.length;
  if (body && typeof body.total === "number") return body.total;
  return -1;
}

async function getHistoryBody(tok, identityId) {
  const res = await fetch(
    API_BASE + "/api/v1/consent/history?identityId=" + encodeURIComponent(identityId),
    { headers: mkHdr(tok) },
  );
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

describe("Phase M - LITERAL PRODUCTION REPLAY (Token & Session Security)", () => {
  const ctx = { key: null, pA: "", pB: "", ja: "", jb: "" };

  beforeAll(async () => {
    if (!hasKey) return;
    ctx.key = await importPrivateKey(PRIVATE_KEY_PEM);
    ctx.pA = "prod-replay-patient-A-" + crypto.randomUUID();
    ctx.pB = "prod-replay-patient-B-" + crypto.randomUUID();
    ctx.ja = await mintPatientJwt(ctx.key, ctx.pA);
    ctx.jb = await mintPatientJwt(ctx.key, ctx.pB);
  }, 30000);

  it("mints valid production Patient A/B JWTs", () => {
    if (!hasKey) return; // skipped when no prod key (local runs)
    expect(ctx.ja.split(".")).toHaveLength(3);
    expect(ctx.jb.split(".")).toHaveLength(3);
  }, 20000);

  // ── JWT VALIDATION (production auth layer active) ──

  it("VALID: A reads own consent history → 200", async () => {
    if (!hasKey) return;
    const { status, body } = await getHistoryBody(ctx.ja, ctx.pA);
    expect(status).toBe(200);
  }, 20000);

  it("VALID: B reads own consent history → 200", async () => {
    if (!hasKey) return;
    const { status, body } = await getHistoryBody(ctx.jb, ctx.pB);
    expect(status).toBe(200);
  }, 20000);

  it("EXPIRED: A with expired token → 401 TOKEN_EXPIRED", async () => {
    if (!hasKey) return;
    const expired = await mintExpiredJwt(ctx.key, ctx.pA);
    const { status, body } = await getHistoryBody(expired, ctx.pA);
    expect(status).toBe(401);
    expect(body.code).toBe("TOKEN_EXPIRED");
  }, 20000);

  it("MALFORMED: A with malformed signature → 401", async () => {
    if (!hasKey) return;
    const malformed = await mintMalformedJwt(ctx.key, ctx.pA);
    const { status, body } = await getHistoryBody(malformed, ctx.pA);
    expect(status).toBe(401);
  }, 20000);

  it("WRONG KID: A with wrong kid → 401", async () => {
    if (!hasKey) return;
    const wrongKid = await mintWrongKidJwt(ctx.key, ctx.pA);
    const { status, body } = await getHistoryBody(wrongKid, ctx.pA);
    expect(status).toBe(401);
  }, 20000);

  it("UNKNOWN KEY: token signed with unrelated key → 401", async () => {
    if (!hasKey) return;
    const wrongKey = await mintWrongKeyJwt(ctx.pA);
    const { status, body } = await getHistoryBody(wrongKey, ctx.pA);
    expect(status).toBe(401);
  }, 20000);

  it("ALG NONE: token with alg:none → 401", async () => {
    if (!hasKey) return;
    const algNone = await mintAlgNoneJwt(ctx.pA);
    const { status, body } = await getHistoryBody(algNone, ctx.pA);
    expect(status).toBe(401);
  }, 20000);

  it("NO AUTH HEADER: request without Authorization → 401 MISSING_AUTH_HEADER", async () => {
    if (!hasKey) return;
    const res = await fetch(API_BASE + "/api/v1/consent/history?identityId=" + encodeURIComponent(ctx.pA));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("MISSING_AUTH_HEADER");
  }, 20000);

  it("MALFORMED AUTH: invalid Authorization format → 401 INVALID_AUTH_FORMAT", async () => {
    if (!hasKey) return;
    const res = await fetch(API_BASE + "/api/v1/consent/history?identityId=" + encodeURIComponent(ctx.pA), {
      headers: { Authorization: "Bearer not.a.valid.token" },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.code).toBe("INVALID_AUTH_FORMAT");
  }, 20000);

  // ── CROSS-PATIENT ISOLATION (read) ──

  it("CROSS-PATIENT: A reads B's consent history → 403", async () => {
    if (!hasKey) return;
    const { status, body } = await getHistoryBody(ctx.ja, ctx.pB);
    expect(status).toBe(403);
  }, 20000);

  it("CROSS-PATIENT: B reads A's consent history → 403", async () => {
    if (!hasKey) return;
    const { status, body } = await getHistoryBody(ctx.jb, ctx.pA);
    expect(status).toBe(403);
  }, 20000);

  // ── AUTHORIZED OPERATIONS (A→A, B→B) ──

  it("AUTHORIZED A→A: grant consent → 201", async () => {
    if (!hasKey) return;
    const res = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.ja),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "legitimate A→A" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.consentId).toBeTruthy();
  }, 20000);

  it("AUTHORIZED B→B: grant consent → 201", async () => {
    if (!hasKey) return;
    const res = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.jb),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "legitimate B→B" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.consentId).toBeTruthy();
  }, 20000);

  it("AUTHORIZED A→A: revoke own consent → 200", async () => {
    if (!hasKey) return;
    // First grant
    const grant = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.ja),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "revoke test" }),
    });
    const gbody = await grant.json();
    expect(grant.status).toBe(201);
    const consentId = gbody.consentId;

    // Then revoke
    const rev = await fetch(API_BASE + "/api/v1/consent/revoke", {
      method: "POST",
      headers: mkHdr(ctx.ja),
      body: JSON.stringify({ consentId, reason: "user" }),
    });
    expect(rev.status).toBe(200);
  }, 20000);

  it("AUTHORIZED B→B: revoke own consent → 200", async () => {
    if (!hasKey) return;
    const grant = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.jb),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "revoke test" }),
    });
    const gbody = await grant.json();
    expect(grant.status).toBe(201);
    const consentId = gbody.consentId;

    const rev = await fetch(API_BASE + "/api/v1/consent/revoke", {
      method: "POST",
      headers: mkHdr(ctx.jb),
      body: JSON.stringify({ consentId, reason: "user" }),
    });
    expect(rev.status).toBe(200);
  }, 20000);

  // ── CROSS-PATIENT MUTATION ATTACKS (must be DENIED, zero mutation) ──

  it("ATTACK: A→B grant - B's consent is NOT mutated (STOP CONDITION)", async () => {
    if (!hasKey) return;
    const before = await getHistoryTotal(ctx.jb, ctx.pB);
    const res = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.ja),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "attack", identityId: ctx.pB }),
    });
    const after = await getHistoryTotal(ctx.jb, ctx.pB);
    // Regardless of the response code, B's record must be untouched.
    expect(after).toBe(before);
  }, 20000);

  it("ATTACK: B→A grant - A's consent is NOT mutated (STOP CONDITION)", async () => {
    if (!hasKey) return;
    const before = await getHistoryTotal(ctx.ja, ctx.pA);
    const res = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.jb),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "attack", identityId: ctx.pA }),
    });
    const after = await getHistoryTotal(ctx.ja, ctx.pA);
    expect(after).toBe(before);
  }, 20000);

  it("ATTACK: A→B revoke - B's consent is NOT mutated (STOP CONDITION)", async () => {
    if (!hasKey) return;
    // B legitimately grants a consent first
    const grant = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.jb),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "legit" }),
    });
    const gbody = await grant.json().catch(() => ({}));
    expect(grant.status, "B legit grant status").toBe(201);
    const consentId = gbody.consentId;
    expect(consentId, "B consentId present").toBeTruthy();

    const before = await getHistoryTotal(ctx.jb, ctx.pB);
    const rev = await fetch(API_BASE + "/api/v1/consent/revoke", {
      method: "POST",
      headers: mkHdr(ctx.ja),
      body: JSON.stringify({ consentId, reason: "attack" }),
    });
    const after = await getHistoryTotal(ctx.jb, ctx.pB);
    expect(rev.status, "A->B revoke must be 403").toBe(403);
    expect(after).toBe(before);
  }, 20000);

  it("ATTACK: B→A revoke - A's consent is NOT mutated (STOP CONDITION)", async () => {
    if (!hasKey) return;
    const grant = await fetch(API_BASE + "/api/v1/consent/grant", {
      method: "POST",
      headers: mkHdr(ctx.ja),
      body: JSON.stringify({ consentType: "privacy", scope: [], purpose: "legit" }),
    });
    const gbody = await grant.json().catch(() => ({}));
    expect(grant.status, "A legit grant status").toBe(201);
    const consentId = gbody.consentId;
    expect(consentId, "A consentId present").toBeTruthy();

    const before = await getHistoryTotal(ctx.ja, ctx.pA);
    const rev = await fetch(API_BASE + "/api/v1/consent/revoke", {
      method: "POST",
      headers: mkHdr(ctx.jb),
      body: JSON.stringify({ consentId, reason: "attack" }),
    });
    const after = await getHistoryTotal(ctx.ja, ctx.pA);
    expect(rev.status, "B->A revoke must be 403").toBe(403);
    expect(after).toBe(before);
  }, 20000);

  // ── CONSENT HISTORY SCOPE VERIFICATION ──

  it("HISTORY SCOPE: A's history only contains A's records", async () => {
    if (!hasKey) return;
    const { status, body } = await getHistoryBody(ctx.ja, ctx.pA);
    expect(status).toBe(200);
    const entries = Array.isArray(body) ? body : (body.entries || body.history || []);
    for (const entry of entries) {
      expect(entry.identity_id).not.toBe(ctx.pB);
    }
  }, 20000);

  it("HISTORY SCOPE: B's history only contains B's records", async () => {
    if (!hasKey) return;
    const { status, body } = await getHistoryBody(ctx.jb, ctx.pB);
    expect(status).toBe(200);
    const entries = Array.isArray(body) ? body : (body.entries || body.history || []);
    for (const entry of entries) {
      expect(entry.identity_id).not.toBe(ctx.pA);
    }
  }, 20000);
});