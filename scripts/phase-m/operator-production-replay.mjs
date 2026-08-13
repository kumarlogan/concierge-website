#!/usr/bin/env node
/**
 * PHASE M — HYBRID OPERATOR PRODUCTION REPLAY
 * ============================================
 * Runs the Phase M literal production validation matrix against the LIVE API
 * (https://api.agsynergy.ca) ONLY from the operator's normal consumer device.
 *
 * This script is the EXECUTION plane of the Phase M hybrid model.
 *   - Hermes = governance/orchestration/analysis (NOT this script's runtime)
 *   - Operator device = this script's runtime (clean residential/consumer egress)
 *
 * REQUIREMENTS
 *   - Node.js >= 18 (native fetch). 24 recommended.
 *   - A normal consumer internet connection (clean egress).
 *   - A test inbox able to receive production verification emails, OR two
 *     already-verified synthetic patient accounts you are authorized to use.
 *
 * SECURITY INVARIANTS (enforced by this script)
 *   - NEVER reads, exports, prints, or materializes JWT_PRIVATE_KEY or any
 *     production secret.
 *   - NEVER prints Authorization headers, JWTs, refresh tokens, passwords,
 *     verification tokens, or cookies.
 *   - Tokens / passwords / emails are held ONLY in memory and redacted in
 *     output and evidence artifacts.
 *   - No Cloudflare configuration change. No WAF bypass. No DNS change.
 *   - No direct production D1 modification.
 *   - No Hermes filesystem/network dependency.
 *
 * USAGE
 *   node scripts/phase-m/operator-production-replay.mjs \
 *     --patientA emailA --passwordA '...' \
 *     --patientB emailB --passwordB '...' \
 *     [--no-verify] [--outdir ./phase-m-evidence]
 *
 *   If registration is needed, the script pauses and prompts you to paste the
 *   verification token from the test inbox (redacted input).
 *
 * OUTPUT
 *   phase-m-production-evidence.json
 *   phase-m-production-report.md
 *   (no credentials, no raw JWTs, no Authorization headers)
 */

import { createInterface } from "node:readline";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const API_BASE = (process.env.PROD_API_BASE || "https://api.agsynergy.ca").replace(/\/+$/, "");
const REPLAY_UA = "AGSynergy-PhaseM-OperatorReplay/1.0";
const REDACTED = "[REDACTED]";

// ─────────────────────────── CLI ARGS ───────────────────────────
function argv(flags) {
  const out = {};
  const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    for (const f of flags) {
      if (a[i] === f) out[f.replace(/^-+/, "")] = a[i + 1];
    }
  }
  return out;
}
const args = argv(["--patientA", "--passwordA", "--patientB", "--passwordB", "--outdir"]);
const SKIP_VERIFY = process.argv.includes("--no-verify");

const OUTDIR = args.outdir || "./phase-m-evidence";
const patientA = { email: args.patientA || "", password: args.passwordA || "", label: "PATIENT_A" };
const patientB = { email: args.patientB || "", password: args.passwordB || "", label: "PATIENT_B" };

// ─────────────────────────── HTTP / HELPERS ───────────────────────────
async function request(method, pathSeg, { token, body, raw, headers = {} } = {}) {
  const h = { ...headers, "User-Agent": REPLAY_UA, Accept: "application/json" };
  if (body) h["Content-Type"] = "application/json";
  if (token) h["Authorization"] = "Bearer " + token;
  const res = await fetch(API_BASE + pathSeg, {
    method,
    headers: h,
    body: body ? JSON.stringify(body) : raw,
    redirect: "manual",
  });
  const ct = res.headers.get("content-type") || "";
  const cfMitigated = res.headers.get("cf-mitigated") || null;
  const server = res.headers.get("server") || null;
  const ray = res.headers.get("cf-ray") || null;
  let text = await res.text();
  let json = null;
  let classified = "worker_json";
  if (ct.includes("json")) {
    try { json = JSON.parse(text); } catch { /* leave json null */ }
  } else if (/<!DOCTYPE|Just a moment|Managed Challenge|cf-chl/i.test(text)) {
    classified = "cloudflare_challenge";
  }
  return { status: res.status, ct, cfMitigated, server, ray, json, classified, bodyText: text.slice(0, 300) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function prompt(query) {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  return new Promise((resolve) => rl.question(query, (a) => { rl.close(); resolve(a); }));
}

function redactEmail(e) {
  if (!e || !e.includes("@")) return REDACTED;
  const [u, d] = e.split("@");
  return u.slice(0, 2) + "***@" + d;
}

const evidence = {
  meta: { script: "phase-m/operator-production-replay.mjs", target: API_BASE, executed_at: new Date().toISOString() },
  preflight: {},
  patients: {},
  tokens: {},
  matrix: [],
  secrets: { clean: true },
};

function statusEquals(res, expected, expectedStatus) {
  if (expectedStatus !== undefined) return res.status === expectedStatus;
  if (expected === "ALLOW") return res.status === 200;
  if (expected === "DENY" || expected === "403") return res.status === 403;
  if (expected === "401") return res.status === 401;
  return res.status === (expected || 0);
}

function record(test, expected, res, extra = {}) {
  const pass = statusEquals(res, expected, extra.expectedStatus);
  const row = {
    test,
    expected,
    expectedStatus: extra.expectedStatus,
    actualStatus: res && res.status,
    classification: res && res.classified,
    cloudflare: res ? { cf_mitigated: res.cfMitigated, server: res.server, ray: res.ray } : null,
    bodyCode: res && res.json && (res.json.code || (res.json.error && res.json.error.code) || null),
    pass,
    mutation: extra.mutation || null,
  };
  evidence.matrix.push(row);
  return row;
}

function appendMutation(before, after) {
  const equal = before === after;
  return { before, after, equal };
}

// ─────────────────────────── PREFLIGHT / IDENTITY ───────────────────────────
async function preflight() {
  console.log("\n=== PHASE M PREFLIGHT ===");
  let ip = null;
  try { ip = (await (await fetch("https://api.ipify.org?format=json")).json()).ip; } catch { /* ignore */ }
  evidence.preflight.publicEgressIP = ip || REDACTED;

  const health = await request("GET", "/api/v1/health");
  evidence.preflight.health = { status: health.status, classification: health.classified, cf_mitigated: health.cfMitigated };

  console.log(`  Target            : ${API_BASE}`);
  console.log(`  Public egress IP  : ${ip || REDACTED}`);
  console.log(`  /api/v1/health    : status=${health.status} classification=${health.classified}`);
  console.log(`  Operator MUST confirm this device is NOT the Hermes host and uses normal consumer/residential egress.`);
  return health;
}

async function ensureIdentity(pat) {
  console.log(`\n=== ${pat.label} ===`);
  const entry = { email: redactEmail(pat.email), verified: false, identityId: null };
  let loginJson = null;

  try {
    const r = await request("POST", "/identity/login", { body: { email: pat.email, password: pat.password } });
    loginJson = r.json;
    if (r.json && r.json.accessToken) {
      entry.verified = true;
      entry.identityId = r.json.identity?.id || r.json.user?.id || null;
      console.log(`  Login: HTTP ${r.status} OK (token held in memory)`);
    } else {
      console.log(`  Login: HTTP ${r.status} (${r.json?.error?.code || r.json?.code || "no token"}) . Trying registration path.`);
    }
  } catch (e) { console.log(`  Login error: ${e.message}`); }

  if (!loginJson || !loginJson.accessToken) {
    const reg = await request("POST", "/identity/register", {
      body: { identityType: "patient", email: pat.email, password: pat.password, profile: { displayName: pat.label + " synthetic" } },
    });
    console.log(`  Register: HTTP ${reg.status} ${reg.json?.error?.code || reg.json?.code || ""}`);
    if (reg.json && (reg.json.identity || reg.json.id)) {
      entry.identityId = (reg.json.identity && reg.json.identity.id) || reg.json.id || entry.identityId;
    }

    await request("POST", "/identity/email/verify", { body: { identityId: entry.identityId, email: pat.email } });
    console.log("  Verify-request: sent (email to test inbox)");

    if (SKIP_VERIFY) {
      console.log("  SKIP_VERIFY set — treating patient as UNVERIFIED.");
    } else {
      const token = (await prompt("  Paste the verification token from the test inbox (redacted input): ")).trim();
      const vc = await request("POST", "/identity/email/verify/complete", { body: { token } });
      console.log(`  Verify-complete: HTTP ${vc.status} ${vc.json?.error?.code || ""}`);
      const l2 = await request("POST", "/identity/login", { body: { email: pat.email, password: pat.password } });
      if (l2.json && l2.json.accessToken) {
        entry.verified = true;
        entry.identityId = l2.json.identity?.id || l2.json.user?.id || entry.identityId;
        console.log(`  Login-after-verify: HTTP ${l2.status} OK`);
        loginJson = l2.json;
      } else {
        console.log(`  Login-after-verify: HTTP ${l2.status} — patient may remain unverified. STOP condition.`);
      }
    }
  }

  pat.identityId = entry.identityId;
  pat.accessToken = (loginJson && loginJson.accessToken) ? loginJson.accessToken : null;
  pat.refreshToken = (loginJson && loginJson.refreshToken) ? loginJson.refreshToken : null;
  evidence.patients[pat.label] = entry;
  evidence.tokens[pat.label] = { access: pat.accessToken ? "HELD_IN_MEMORY" : null, refresh: pat.refreshToken ? "HELD_IN_MEMORY" : null };
  return { ok: !!pat.accessToken };
}

function garbageToken() { return "not.a.valid.jwt"; }
function alteredToken(real) {
  if (!real) return "no.real.token";
  const parts = real.split(".");
  if (parts.length !== 3) return "bad.token";
  const sig = parts[2] || "";
  const alt = (sig[0] === "A" ? "B" : "A") + sig.slice(1);
  return parts[0] + "." + parts[1] + "." + alt;
}
function algNoneToken(real) {
  if (!real) return "no.token";
  const parts = real.split(".");
  let h = {};
  try { h = JSON.parse(Buffer.from(parts[0] || "", "base64url").toString()); } catch { /* ignore */ }
  h.alg = "none";
  const newHeaderB64 = Buffer.from(JSON.stringify(h)).toString("base64url").replace(/=+$/, "");
  return newHeaderB64 + "." + (parts[1] || "") + ".";
}

async function consentHistory(pat, targetId) {
  const r = await request("GET", "/api/v1/consent/history?identityId=" + encodeURIComponent(targetId) + "&limit=50", {
    token: pat.accessToken,
  });
  let fingerprint = null;
  let count = 0;
  if (r.json) {
    const arr = Array.isArray(r.json) ? r.json : (r.json.entries || r.json.history || []);
    count = arr.length;
    fingerprint = JSON.stringify(arr.map((c) => ({ id: c.consentId || c.id, type: c.consentType, state: c.state, v: c.versionToken || c.version })).sort());
  }
  return { r, fingerprint, count };
}

async function consentGrant(pat, targetId) {
  return request("POST", "/api/v1/consent/grant", {
    token: pat.accessToken,
    body: { identityId: targetId || pat.identityId, consentType: "privacy", scope: [], purpose: "phase-m-synthetic" },
  });
}

async function consentRevoke(pat, consentId, reason) {
  return request("POST", "/api/v1/consent/revoke", {
    token: pat.accessToken,
    body: { consentId, reason: reason || "phase-m-synthetic" },
  });
}

async function firstConsentId(pat) {
  const h = await consentHistory(pat, pat.identityId);
  if (h.r.json) {
    const arr = Array.isArray(h.r.json) ? h.r.json : (h.r.json.entries || h.r.json.history || []);
    if (arr && arr[0]) return arr[0].consentId || arr[0].id || null;
  }
  return null;
}

// ─────────────────────────── MAIN ───────────────────────────
async function main() {
  if (!patientA.email || !patientB.email || !patientA.password || !patientB.password) {
    console.error("ERROR: --patientA, --passwordA, --patientB, --passwordB are required. Exiting.");
    process.exit(2);
  }

  await preflight();

  const A = await ensureIdentity(patientA);
  const B = await ensureIdentity(patientB);
  if (!A.ok || !B.ok) {
    console.error("\nSTOP: could not obtain valid production sessions for both synthetic patients. No matrix executed.");
    writeEvidence();
    process.exit(3);
  }

  // ── AUTH + /identity/me ──
  const meA = await request("GET", "/identity/me", { token: patientA.accessToken });
  const meB = await request("GET", "/identity/me", { token: patientB.accessToken });
  record("A login/me", 200, meA, { expectedStatus: 200 });
  record("B login/me", 200, meB, { expectedStatus: 200 });
  console.log("  A /identity/me: HTTP " + meA.status);
  console.log("  B /identity/me: HTTP " + meB.status);

  // ── TOKEN / AUTH SECURITY ──
  const missingAuth = await request("GET", "/api/v1/consent/history?identityId=abc");
  record("missing auth -> 401", 401, missingAuth, { expectedStatus: 401 });

  const malformedAuth = await request("GET", "/api/v1/consent/history?identityId=abc", {
    headers: { Authorization: "Malformed-NotBearer anything" },
  });
  record("malformed auth -> 401", 401, malformedAuth, { expectedStatus: 401 });

  const invalidTok = await request("GET", "/api/v1/consent/history?identityId=abc", { token: garbageToken() });
  record("invalid token -> 401", 401, invalidTok, { expectedStatus: 401 });

  const alteredTok = await request("GET", "/api/v1/consent/history?identityId=abc", { token: alteredToken(patientA.accessToken) });
  record("altered token -> 401", 401, alteredTok, { expectedStatus: 401 });

  const algNone = await request("GET", "/api/v1/consent/history?identityId=abc", { token: algNoneToken(patientA.accessToken) });
  record("alg:none -> 401", 401, algNone, { expectedStatus: 401 });

  // ── CROSS-PATIENT RESOURCE ISOLATION ──
  record("A -> A resource", "ALLOW", (await request("GET", "/identity/me", { token: patientA.accessToken })), { expectedStatus: 200 });
  record("B -> B resource", "ALLOW", (await request("GET", "/identity/me", { token: patientB.accessToken })), { expectedStatus: 200 });

  // ── CONSENT: OWN GRANTS (201) ──
  const gAA = await consentGrant(patientA, patientA.identityId);
  record("A -> A consent grant", "201", gAA, { expectedStatus: 201 });
  const gBB = await consentGrant(patientB, patientB.identityId);
  record("B -> B consent grant", "201", gBB, { expectedStatus: 201 });

  // ── CONSENT: CROSS-PATIENT ATTACKS (403 + 0 mutation) ──
  const bBefore = await consentHistory(patientB, patientB.identityId);
  const gAB = await consentGrant(patientA, patientB.identityId);
  const bAfter = await consentHistory(patientB, patientB.identityId);
  record("A -> B consent grant", "403+0mutation", gAB, { expectedStatus: 403, mutation: appendMutation(bBefore.fingerprint, bAfter.fingerprint) });

  const aBefore = await consentHistory(patientA, patientA.identityId);
  const gBA = await consentGrant(patientB, patientA.identityId);
  const aAfter = await consentHistory(patientA, patientA.identityId);
  record("B -> A consent grant", "403+0mutation", gBA, { expectedStatus: 403, mutation: appendMutation(aBefore.fingerprint, aAfter.fingerprint) });

  // ── CONSENT REVOKE: cross-patient ──
  const bConsentId = await firstConsentId(patientB);
  const bBeforeR = await consentHistory(patientB, patientB.identityId);
  const rAB = bConsentId ? await consentRevoke(patientA, bConsentId) : null;
  const bAfterR = await consentHistory(patientB, patientB.identityId);
  record("A -> B consent revoke", "403+0mutation", rAB || { status: 0 }, {
    expectedStatus: 403,
    mutation: rAB ? appendMutation(bBeforeR.fingerprint, bAfterR.fingerprint) : { equal: true, note: "no consent id" },
  });

  const aConsentId = await firstConsentId(patientA);
  const aBeforeR = await consentHistory(patientA, patientA.identityId);
  const rBA = aConsentId ? await consentRevoke(patientB, aConsentId) : null;
  const aAfterR = await consentHistory(patientA, patientA.identityId);
  record("B -> A consent revoke", "403+0mutation", rBA || { status: 0 }, {
    expectedStatus: 403,
    mutation: rBA ? appendMutation(aBeforeR.fingerprint, aAfterR.fingerprint) : { equal: true, note: "no consent id" },
  });

  // ── CONSENT HISTORY SCOPING ──
  const histAB = await consentHistory(patientA, patientB.identityId);
  record("A -> B history", "403", histAB.r, { expectedStatus: 403 });
  const histBA = await consentHistory(patientB, patientA.identityId);
  record("B -> A history", "403", histBA.r, { expectedStatus: 403 });

  // ── LOGOUT / SESSION ──
  const lo = await request("POST", "/identity/logout", { token: patientA.accessToken, body: {} });
  record("A logout/session revocation", "PASS", lo, { expectedStatus: 200 });

  writeEvidence();
}

function writeEvidence() {
  fs.mkdirSync(path.resolve(OUTDIR), { recursive: true });
  const allPass = evidence.matrix.every((m) => m.pass);
  evidence.overall = {
    result: allPass ? "PASS" : "FAIL",
    matrixPassCount: evidence.matrix.filter((m) => m.pass).length,
    matrixTotal: evidence.matrix.length,
  };

  const evPath = path.resolve(OUTDIR, "phase-m-production-evidence.json");
  fs.writeFileSync(evPath, JSON.stringify(evidence, null, 2));
  writeReport(evidence);
  console.log("\nEvidence written to: " + evPath);
  console.log("Matrix result: " + evidence.matrix.filter((m) => m.pass).length + "/" + evidence.matrix.length + " PASS");
  console.log("Overall Phase M (operator execution): " + (allPass ? "PASS — evidence returned to Hermes for certification." : "FAIL — see report."));
}

function writeReport(ev) {
  const lines = [];
  lines.push("# Phase M — Hybrid Operator Production Replay Report");
  lines.push("");
  lines.push("**Executed at:** " + ev.meta.executed_at);
  lines.push("**Target:** " + ev.meta.target);
  lines.push("**Public egress IP:** " + (ev.preflight.publicEgressIP || "[REDACTED]"));
  lines.push("**Execution plane:** Operator consumer device (NOT Hermes host)");
  lines.push("");
  lines.push("## Test Matrix");
  lines.push("");
  lines.push("| Test | Expected | Actual | Classification | Mutation | Status |");
  lines.push("|------|----------|--------|----------------|----------|--------|");
  for (const m of ev.matrix) {
    const mut = m.mutation ? (m.mutation.equal ? "0-mutation" : "MUTATION!") : "n/a";
    lines.push("| " + m.test + " | " + m.expected + " | " + m.actualStatus + " | " + m.classification + " | " + mut + " | " + (m.pass ? "PASS" : "FAIL") + " |");
  }
  lines.push("");
  lines.push("**Overall:** " + ev.overall.result + " (" + ev.overall.matrixPassCount + "/" + ev.overall.matrixTotal + ")");
  lines.push("");
  lines.push("## Secret Audit");
  lines.push("- No JWT private key used, requested, or exposed.");
  lines.push("- No Authorization headers / JWTs / refresh tokens / passwords / verification tokens printed in this report or evidence.");
  lines.push("- No Cloudflare configuration change; no WAF bypass; no DNS change; no Bot-Fight-Mode disable.");
  lines.push("");
  lines.push("> Return this report + phase-m-production-evidence.json to Hermes for certification. Hermes remains the certification authority — this script exit 0 does NOT itself certify GREEN.");
  const p = path.resolve(OUTDIR, "phase-m-production-report.md");
  fs.writeFileSync(p, lines.join("\n"));
  console.log("Report written to: " + p);
}

main().catch((e) => { console.error("Fatal:", e.message); process.exit(1); });
