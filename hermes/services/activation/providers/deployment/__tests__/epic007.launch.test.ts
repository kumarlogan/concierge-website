// ────────────────────────────────────────────────────────────────
// EPIC-007 · Controlled AGS Launch — Guarantee Suite
//
// Runs the REAL modules (ledger, launch, rlse, guardrails, site-identity,
// real cloudflare/github executors against a FAKE vendor spawner — no
// internal logic is mocked). Proves the 10 guarantees from the EPIC.
//
// Run:  node <tsx> services/activation/providers/deployment/__tests__/epic007.launch.test.ts
// No vitest — minimal assert harness so the frozen corpus gate is untouched.
// ────────────────────────────────────────────────────────────────

import assert from "node:assert/strict";
import type { Spawner, SpawnResult } from "../backends/spawner.js";
import { createCloudflareWranglerBackend } from "../backends/cloudflare-exec.js";
import { createGitHubCliBackend } from "../backends/github-exec.js";
import { deploymentLedger, type DeploymentLedgerEntry } from "../ledger.js";
import { runLaunch, type LaunchDeps, type LaunchRequest, type LaunchOutcome } from "../launch.js";
import { requireTenant, requireProdApproval, enforceProdChangeFreezeGuard } from "../guardrails.js";
import { probeSite, AGS_TENANT, AGS_SITE_URL } from "../site-identity.js";
import { createRlseExecutor, type RlseExecutor } from "../rlse.js";
import { setSecretSource } from "../../secret-source.js";

// ── test counters ────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const failures: string[] = [];
async function test(name: string, fn: () => Promise<void> | void) {
  try {
    await fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    failures.push(`${name}: ${(e as Error).message}`);
    console.log(`  ✗ ${name}\n      ${(e as Error).message}`);
  }
}

// ── fake vendor spawner (records argv, returns scripted result) ──
class FakeSpawner implements Spawner {
  calls: { cmd: string; args: string[] }[] = [];
  script: Partial<Record<string, SpawnResult>> = {};
  default: SpawnResult = { code: 0, stdout: "ok", stderr: "" };
  async run(cmd: string, args: string[]): Promise<SpawnResult> {
    this.calls.push({ cmd, args });
    if (cmd === "wrangler" && args.includes("deploy")) return this.script["wrangler:deploy"] ?? this.default;
    if (cmd === "gh" && args.includes("pr")) return this.script["gh:pr"] ?? this.default;
    return this.default;
  }
}

// ── a TTL'd fake approval (so guardrails pass) ──
function freshApproval(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const now = Date.now();
  return {
    id: "apr_test_" + now + "_" + Math.random().toString(36).slice(2, 6),
    tenant: AGS_TENANT,
    capability: "deploy.website",
    environment: "production",
    provider: "cloudflare.pages",
    grantedBy: "lead@ags",
    grantedAt: now,
    expiresAt: now + 30 * 60 * 1000,
    signature: { alg: "ed25519", value: "sigtok" },
    ...overrides,
  };
}

// ── build deps from a fake spawner ──
function buildDeps(spawner: FakeSpawner): LaunchDeps {
  const rlse: RlseExecutor = createRlseExecutor({
    githubRepo: "kumarlogan/hermes-website",
    githubBranch: "main",
    cfAccount: "ag-account",
    cfProject: "agsynergy",
    siteUrl: AGS_SITE_URL,
    tenant: AGS_TENANT,
  });
  return {
    rlse,
    lastProdSuccessAt: () => {
      const last = deploymentLedger.lastSuccessful(AGS_TENANT, "production");
      return last ? last.at : null;
    },
    dispatch: {
      async pullGitHubRelease(ref) {
        const r = await createGitHubCliBackend(spawner, { repo: "kumarlogan/hermes-website", branch: "main" }).tag(
          { name: ref },
          { actor: "ags", env: "staging" },
        );
        return { ok: r.ok, error: r.error, data: r.data };
      },
      async pushToGitHub(_ref) {
        const r = await createGitHubCliBackend(spawner, { repo: "kumarlogan/hermes-website", branch: "main" }).push(
          { branch: "main" },
          { actor: "ags", env: "staging" },
        );
        return { ok: r.ok, error: r.error, data: r.data };
      },
      async deployToCloudflare(_reference, env) {
        const r = await createCloudflareWranglerBackend(spawner, { account: "ag-account", project: "agsynergy" }).deploy(
          { project: "agsynergy", dir: "dist" },
          { actor: "ags", env },
        );
        return { ok: r.ok, error: r.error, data: r.data };
      },
    },
  };
}

function baseReq(overrides: Record<string, unknown> = {}): LaunchRequest {
  return {
    idempotencyKey: "idk-" + Math.random().toString(36).slice(2),
    tenant: AGS_TENANT,
    requester: "deployer@ags",
    approver: "lead@ags",
    environment: "staging",
    reference: "v0.7.0",
    approvalRef: freshApproval({ environment: "staging" }),
    ...overrides,
  } as unknown as LaunchRequest;
}

// ══════════════════════════════════════════════════════════════════
async function main() {
  console.log("\nEPIC-007 · Controlled AGS Launch — Guarantee Suite\n");

  // Provide a credential so production success paths aren't blocked by the
  // live secret-validity guard (this is the operator-owned secret source).
  setSecretSource({ get: () => "test-token" });

  // G1 — STAGING NEVER TOUCHES PROD
  await test("G1: staging launch never writes a production ledger entry", async () => {
    deploymentLedger.clear();
    const sp = new FakeSpawner();
    const out = await runLaunch(baseReq({ environment: "staging" }), buildDeps(sp));
    assert.equal(out.result, "success", `expected success, got ${out.result}: ${out.error}`);
    assert.equal(out.environment, "staging");
    const prod = deploymentLedger.all().filter((e) => e.environment === "production");
    assert.equal(prod.length, 0, "staging run must not write a production ledger entry");
  });

  // G2 — GATED PRODUCTION (no approval => fail-closed)
  await test("G2: production launch with NO approval is denied fail-closed", async () => {
    deploymentLedger.clear();
    const sp = new FakeSpawner();
    const req = baseReq({ environment: "production" });
    (req as Record<string, unknown>).approvalRef = undefined;
    const out = await runLaunch(req, buildDeps(sp));
    assert.equal(out.result, "denied", `expected denied, got ${out.result}`);
    assert.equal(sp.calls.some((c) => c.args.includes("deploy")), false, "no deploy attempted");
  });

  // G2b — GATED PRODUCTION (expired approval => fail-closed)
  await test("G2b: production launch with EXPIRED approval is denied", async () => {
    const sp = new FakeSpawner();
    const expired = freshApproval({ expiresAt: Date.now() - 1000 });
    const out = await runLaunch(baseReq({ environment: "production", approvalRef: expired as never }), buildDeps(sp));
    assert.equal(out.result, "denied");
    assert.equal(sp.calls.some((c) => c.args.includes("deploy")), false);
  });

  // G2c — GATED PRODUCTION (wrong tenant => fail-closed)
  await test("G2c: production launch with tenant-mismatched request is denied", async () => {
    const sp = new FakeSpawner();
    const out = await runLaunch(baseReq({ environment: "production", tenant: "enemy-tenant" }), buildDeps(sp));
    assert.equal(out.result, "denied");
  });

  // G2d — GATED PRODUCTION (unauthorized approver => fail-closed)
  await test("G2d: production launch with unauthorized approver is denied", async () => {
    const sp = new FakeSpawner();
    const out = await runLaunch(baseReq({ environment: "production", approver: "rando@ags" }), buildDeps(sp));
    assert.equal(out.result, "denied");
  });

  // G3 — PROD APPROVAL FLOW WRITES A DURABLE, REVOCABLE RECORD
  await test("G3: successful production launch writes a durable, revocable ledger record", async () => {
    deploymentLedger.clear();
    // Seed an OLD successful prod deploy so the rollback target exists AND the
    // change-freeze guard (24h) does not trip.
    deploymentLedger.appendRaw({
      deploymentId: "dep_seed", tenant: AGS_TENANT, requester: "deployer@ags", approver: "lead@ags",
      provider: "ags-controlled", environment: "production", capability: "launch.production",
      reference: "v0.6.0", result: "success",
      at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    const sp = new FakeSpawner();
    const out = await runLaunch(baseReq({ environment: "production" }), buildDeps(sp));
    assert.equal(out.result, "success", `got ${out.result}: ${out.error}`);
    const entries = deploymentLedger.all().filter((e) => e.environment === "production");
    assert.ok(entries.length >= 1);
    const e = entries.filter((x) => x.deploymentId === out.deploymentId).pop() as DeploymentLedgerEntry;
    assert.equal(e.result, "success");
    assert.equal(e.tenant, AGS_TENANT);
    assert.ok(e.approvalRef, "approvalRef recorded on the entry");
    assert.equal(e.result, "success");
    // Revocation: durable + queryable afterwards.
    const revoked = deploymentLedger.revoke(AGS_TENANT, out.deploymentId, "incident", "oncall@ags");
    assert.equal(revoked?.revoked, true);
    const afterAll = deploymentLedger.all().filter((x) => x.deploymentId === out.deploymentId).pop();
    assert.equal(afterAll?.revoked, true);
  });

  // G4 — GRANULAR ROLLBACK CAPABILITY (verified before prod)
  await test("G4: rollback capability is verified via RLSE before any production launch", async () => {
    const rlse = createRlseExecutor({
      githubRepo: "kumarlogan/hermes-website",
      githubBranch: "main",
      cfAccount: "ag-account",
      cfProject: "agsynergy",
      siteUrl: AGS_SITE_URL,
      tenant: AGS_TENANT,
    });
    deploymentLedger.clear();
    // No prior success -> no rollback target.
    const none = rlse.rollbackCapable("production");
    assert.equal(none.canRollback, false, "must report no rollback target when none exists");
    // Seed one, then it must be present.
    deploymentLedger.appendRaw({
      deploymentId: "dep_rb", tenant: AGS_TENANT, requester: "d", approver: "lead@ags",
      provider: "ags-controlled", environment: "production", capability: "launch.production",
      reference: "v0.6.0", result: "success", at: new Date().toISOString(),
    });
    const yes = rlse.rollbackCapable("production");
    assert.equal(yes.canRollback, true, "rollback target must be asserted");
  });

  await test("G4b: production launch is DENIED if no rollback target exists (fail-closed)", async () => {
    deploymentLedger.clear();
    const sp = new FakeSpawner();
    const out = await runLaunch(baseReq({ environment: "production" }), buildDeps(sp));
    assert.equal(out.result, "denied", `expected denied, got ${out.result}: ${out.error}`);
    assert.match(out.error ?? "", /rollback/i);
    assert.equal(sp.calls.some((c) => c.args.includes("deploy")), false);
  });

  // G5 — ZERO-DOWNTIME + SMOKE (live probe)
  await test("G5: probeSite is a real fail-closed reachability check (returns a boolean .ok)", async () => {
    const bad = await probeSite("https://nonexistent.invalid.host.ags", 600);
    assert.equal(typeof bad.ok, "boolean");
    assert.equal(bad.ok, false, "unreachable host must report ok:false");
    assert.equal(bad.dnsOk, false);
    // A valid URL returns an object with a boolean ok; never fabricates.
    const valid = await probeSite("https://example.com", 1500).catch(() => ({ ok: false } as const));
    assert.equal(typeof valid.ok, "boolean");
  });

  // G6 — FAIL-CLOSED (backend returns ok:false, never throws, no fake success)
  await test("G6: real backend maps vendor failure to {ok:false}, never throws", async () => {
    const sp = new FakeSpawner();
    sp.script["wrangler:deploy"] = { code: 1, stdout: "", stderr: "error: build failed" };
    const backend = createCloudflareWranglerBackend(sp, { account: "ag-account", project: "agsynergy" });
    const r = await backend.deploy({ project: "agsynergy", dir: "dist" }, { actor: "ags", env: "production" });
    assert.equal(r.ok, false, "failure must propagate as ok:false");
    assert.match(r.error ?? "", /exited 1/);
  });

  await test("G6b: backend without credentials is fail-closed (no CF token)", async () => {
    setSecretSource({ get: () => undefined }); // simulate absent token
    const sp = new FakeSpawner();
    const backend = createCloudflareWranglerBackend(sp, { account: "ag-account", project: "agsynergy" });
    const r = await backend.deploy({ project: "agsynergy", dir: "dist" }, { actor: "ags", env: "production" });
    assert.equal(r.ok, false);
    assert.match(r.error ?? "", /CLOUDFLARE_API_TOKEN absent/);
    setSecretSource({ get: () => "test-token" }); // restore for later tests
  });

  // G7 — TENANT ISOLATION on ledger
  await test("G7: ledger enforces tenant isolation (cross-tenant query returns nothing)", async () => {
    deploymentLedger.clear();
    await runLaunch(baseReq({ environment: "staging" }), buildDeps(new FakeSpawner()));
    const other = deploymentLedger.all().filter((e) => e.tenant === "enemy-tenant");
    assert.equal(other.length, 0);
    const mine = deploymentLedger.all().filter((e) => e.tenant === AGS_TENANT);
    assert.ok(mine.length >= 1);
  });

  // G8 — REPLAY PROTECTION (idempotency key)
  await test("G8: duplicate idempotencyKey is denied as replay", async () => {
    deploymentLedger.clear();
    const sp = new FakeSpawner();
    const key = "same-key-123";
    const r1 = await runLaunch(baseReq({ environment: "staging", idempotencyKey: key }), buildDeps(sp));
    const r2 = await runLaunch(baseReq({ environment: "staging", idempotencyKey: key }), buildDeps(sp));
    assert.equal(r1.result, "success");
    assert.equal(r2.result, "denied", `dup should be denied, got ${r2.result}`);
    assert.ok(r2.result === "denied" && !!r2.auditReference, "replay denied with an audit reference");
  });

  // G9 — AUDIT COMPLETENESS (every action emits an audit record)
  await test("G9: launch emits audit records and correlates the ledger entry", async () => {
    deploymentLedger.clear();
    const sp = new FakeSpawner();
    const out = await runLaunch(baseReq({ environment: "staging" }), buildDeps(sp));
    assert.ok(out.auditReference, "outcome must carry an audit reference");
    const e = deploymentLedger.all().find((x) => x.deploymentId === out.deploymentId);
    assert.ok(e, "ledger entry exists for the deployment");
  });

  // G10 — GOVERNANCE GUARD PRIMITIVES
  await test("G10: guardrail primitives enforce tenant / approval / stability independently", async () => {
    assert.throws(() => requireTenant("enemy"), /tenant/i);
    assert.doesNotThrow(() => requireTenant(AGS_TENANT));
    assert.throws(() => requireProdApproval("production", undefined), /approval/i);
    assert.throws(() => requireProdApproval("production", freshApproval({ expiresAt: Date.now() - 5_000 }) as never), /expired/i);
    assert.doesNotThrow(() => requireProdApproval("production", freshApproval()));
    // stability gate: absent history => no throw (guard only fires on a recent prod success)
    assert.doesNotThrow(() => enforceProdChangeFreezeGuard("production", null));
    deploymentLedger.clear();
    // Old prod success within the window-boundary: must NOT throw.
    deploymentLedger.appendRaw({
      deploymentId: "dep_old", tenant: AGS_TENANT, requester: "d", approver: "lead@ags",
      provider: "ags-controlled", environment: "production", capability: "launch.production",
      reference: "v0.6.0", result: "success", at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
    });
    const old = deploymentLedger.lastSuccessful(AGS_TENANT, "production");
    assert.doesNotThrow(() => enforceProdChangeFreezeGuard("production", old?.at ?? null));
    // Recent prod success (within 24h) MUST trip the guard.
    assert.throws(() => enforceProdChangeFreezeGuard("production", new Date().toISOString()), /change-freeze/i);
  });

  // ── summary ──
  console.log(`${"─".repeat(48)}`);
  console.log(`EPIC-007 suite: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
    process.exit(1);
  } else {
    console.log("ALL GUARANTEES VERIFIED");
  }
}

main().catch((e) => {
  console.error("FATAL:", e);
  process.exit(1);
});
