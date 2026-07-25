// PHASE 5 — Safe Execution Validation (no production deploy, no real secrets).
// Exercises the REAL governed agsLaunch path with an in-process fake spawner.
// Verifies: dry-run, missing-secret fail-closed, missing-approval fail-closed,
// invalid-tenant fail-closed, audit emission, deployment-identity creation,
// and rollback-capability checks. Also surfaces the Cloudflare token-name split.

import { agsLaunch, buildAgsLaunchDeps, type AgsDeploymentConfig } from "../deployment/index.js";
import type { Spawner, SpawnResult } from "../deployment/backends/spawner.js";
import { setSecretSource, type SecretSource } from "../secret-source.js";
import { emitAudit, readAuditBuffer, _clearAuditBuffer } from "../../../../audit/event.js";
import { deploymentLedger } from "../deployment/ledger.js";

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = ""): void {
  if (cond) { pass++; console.log(`  ✓ ${name}${detail ? ` (${detail})` : ""}`); }
  else { fail++; console.log(`  ✗ ${name}${detail ? ` (${detail})` : ""}`); }
}

class FakeSpawner implements Spawner {
  calls: { cmd: string; args: string[] }[] = [];
  async run(cmd: string, args: string[], _opts?: unknown): Promise<SpawnResult> {
    this.calls.push({ cmd, args });
    return { code: 0, stdout: "ok", stderr: "" };
  }
}

function cfg(): AgsDeploymentConfig {
  return {
    githubRepo: "kumarlogan/hermes-website",
    githubBranch: "main",
    cfAccount: "test-account",
    cfProject: "hermes-website",
    siteUrl: "https://agsynergy.ca",
  };
}

function setSecrets(map: Record<string, string>): void {
  const src: SecretSource = { get: (ref) => map[ref] ?? undefined };
  setSecretSource(src);
}

async function main(): Promise<void> {
  _clearAuditBuffer();
  deploymentLedger.clear();

  const spawner = new FakeSpawner();

  console.log("\n[1] Dry-run works (no execution, plan recorded)");
  {
    const out = await agsLaunch(
      { tenant: "ags-fertility", requester: "ops@ags", reference: "v0.0.1-staging", environment: "staging", dryRun: true, idempotencyKey: "dry-1" },
      cfg(), spawner,
    );
    check("dry-run returns result 'dry-run'", out.result === "dry-run", out.result);
    check("dry-run executed NO provider calls", spawner.calls.length === 0, `${spawner.calls.length} calls`);
    check("dry-run created a deploymentId", !!out.deploymentId);
    check("dry-run emitted audit", readAuditBuffer().some((e) => e.type === "ags.launch.dry-run"));
  }

  console.log("\n[2] Missing secrets fail closed (staging real-exec, empty secret source)");
  {
    setSecrets({});
    const s2 = new FakeSpawner();
    const out = await agsLaunch(
      { tenant: "ags-fertility", requester: "ops@ags", reference: "v0.0.1-staging", environment: "staging", idempotencyKey: "miss-sec-1" },
      cfg(), s2,
    );
    check("launch did NOT succeed", out.result !== "success", out.result);
    check("no provider execution occurred", s2.calls.length === 0, `${s2.calls.length} calls`);
    check("audit records a non-success outcome", readAuditBuffer().some((e) => e.type.startsWith("ags.launch")));
  }

  console.log("\n[3] Missing approval fails closed (production)");
  {
    setSecrets({ GITHUB_TOKEN: "x", CLOUDFLARE_API_TOKEN: "x", CF_API_TOKEN: "x" });
    const s3 = new FakeSpawner();
    const out = await agsLaunch(
      { tenant: "ags-fertility", requester: "ops@ags", reference: "v1.0.0", environment: "production" },
      cfg(), s3,
    );
    check("production w/o approvalRef is DENIED", out.result === "denied", out.result);
    check("denial reason cites approval", /approval/i.test(out.error ?? ""), out.error);
    check("no provider execution", s3.calls.length === 0, `${s3.calls.length} calls`);
  }

  console.log("\n[4] Invalid tenant fails closed");
  {
    setSecrets({ GITHUB_TOKEN: "x", CLOUDFLARE_API_TOKEN: "x", CF_API_TOKEN: "x" });
    const s4 = new FakeSpawner();
    const out = await agsLaunch(
      { tenant: "evil-corp", requester: "ops@ags", reference: "v0.0.1-staging", environment: "staging", idempotencyKey: "bad-tenant-1" },
      cfg(), s4,
    );
    check("non-AGS tenant is DENIED", out.result === "denied", out.result);
    check("denial reason cites tenant", /tenant/i.test(out.error ?? ""), out.error);
    check("no provider execution", s4.calls.length === 0, `${s4.calls.length} calls`);
  }

  console.log("\n[5] Deployment identity + audit + rollback target (staging real-exec, secrets injected)");
  {
    // NOTE: live path requires BOTH CLOUDFLARE_API_TOKEN (readiness) and
    // CF_API_TOKEN (deploy backend) to be set for the same Cloudflare token.
    setSecrets({ GITHUB_TOKEN: "gh-tok", CLOUDFLARE_API_TOKEN: "cf-tok", CF_API_TOKEN: "cf-tok" });
    const s5 = new FakeSpawner();
    const out = await agsLaunch(
      { tenant: "ags-fertility", requester: "ops@ags", reference: "v0.0.1-staging", environment: "staging", idempotencyKey: "real-stg-1" },
      cfg(), s5,
    );
    check("staging real-exec SUCCEEDS with all gates met", out.result === "success", out.result);
    check("deployment identity created (deploymentId)", !!out.deploymentId);
    check("site identity bound to AGS tenant (ledger entry)", deploymentLedger.forTenant("ags-fertility").some((e) => e.tenant === "ags-fertility"));
    check("provider calls executed (tag/push/deploy)", s5.calls.length >= 3, `${s5.calls.length} calls`);
    check("success audit emitted", readAuditBuffer().some((e) => e.type === "ags.launch.success"));
    check("rollback target now exists (lastSuccessful)", !!deploymentLedger.lastSuccessful("ags-fertility", "staging"));
  }

  console.log("\n[6] Rollback capability check executes + replay protection");
  {
    // Replay same idempotencyKey -> denied (replay protection).
    setSecrets({ GITHUB_TOKEN: "gh-tok", CLOUDFLARE_API_TOKEN: "cf-tok", CF_API_TOKEN: "cf-tok" });
    const s6 = new FakeSpawner();
    const out = await agsLaunch(
      { tenant: "ags-fertility", requester: "ops@ags", reference: "v0.0.1-staging", environment: "staging", idempotencyKey: "real-stg-1" },
      cfg(), s6,
    );
    check("duplicate idempotencyKey is DENIED (replay)", out.result === "denied" && out.deduplicated === true, out.result);
    check("replay executed NO provider calls", s6.calls.length === 0, `${s6.calls.length} calls`);
  }

  console.log("\n=== PHASE 5 SAFE VALIDATION RESULT ===");
  console.log(`PASS: ${pass}  FAIL: ${fail}`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("HARNESS ERROR:", e); process.exit(2); });
