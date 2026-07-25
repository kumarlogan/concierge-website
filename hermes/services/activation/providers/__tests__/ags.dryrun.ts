// AGS Dry-Run Mode — REAL runtime test (no vitest dep)
// EPIC-006 P5: dryRun returns a plan WITHOUT invoking the gateway/backend;
// the real execution path is verifiably NOT touched (no backend calls).

import { _clearProviders, executeCapability, grantStackBApproval } from "../../provider-framework.js";
import { bootstrapProviders } from "../bootstrap.js";
import { activationPrincipal } from "../github/provider.js";
import { setSecretSource, type SecretSource } from "../secret-source.js";
import { runWebsiteCapability } from "../website.js";

let pass = 0, fail = 0;
function ok(n: string, c: boolean, e?: unknown) { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n}`, e ?? ""); } }

function memSource(map: Record<string, string>): SecretSource {
  return { get: (ref) => map[ref] || undefined };
}

async function main(): Promise<void> {
  _clearProviders();
  setSecretSource(memSource({
    GITHUB_TOKEN: "ghs_test",
    AGS_GITHUB_REPOSITORY: "kumarlogan/hermes-website",
    CLOUDFLARE_API_TOKEN: "cf_test",
    AGS_CLOUDFLARE_ACCOUNT: "ags-acct",
    AGS_CLOUDFLARE_PROJECT: "agsynergy",
  }));

  const calls: string[] = [];
  const cfBackend = {
    build: () => { calls.push("build"); return { ok: true, data: {}, backend: "mock-cf" }; },
    deploy: () => { calls.push("deploy"); return { ok: true, data: {}, backend: "mock-cf" }; },
    status: () => ({ ok: true, data: {}, backend: "mock-cf" }),
    rollback: () => ({ ok: true, data: {}, backend: "mock-cf" }),
    history: () => ({ ok: true, data: {}, backend: "mock-cf" }),
    health: () => ({ ok: true, data: {}, backend: "mock-cf" }),
    logs: () => ({ ok: true, data: {}, backend: "mock-cf" }),
    analytics: () => ({ ok: true, data: {}, backend: "mock-cf" }),
  } as never;
  const ghBackend = {
    status: () => ({ ok: true, data: {}, backend: "mock-gh" }),
    branch: () => ({ ok: true, data: {}, backend: "mock-gh" }),
    commit: () => ({ ok: true, data: {}, backend: "mock-gh" }),
    push: () => ({ ok: true, data: {}, backend: "mock-gh" }),
    pullRequest: () => ({ ok: true, data: {}, backend: "mock-gh" }),
    tag: () => ({ ok: true, data: {}, backend: "mock-gh" }),
    rollback: () => ({ ok: true, data: {}, backend: "mock-gh" }),
  } as never;
  bootstrapProviders(activationPrincipal("ops@ags"), { github: ghBackend, cloudflare: cfBackend });

  console.log("\n[1] Dry-run deploy returns a plan, NO backend invoked");
  calls.length = 0;
  const plan = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "production", dryRun: true });
  ok("dryRun result is ok", plan.ok === true);
  ok("dryRun flag set", plan.dryRun === true);
  ok("backend tagged dryrun", plan.backend === "hermes.website.dryrun");
  ok("NO backend call happened", calls.length === 0);
  const p = (plan.data as { plan: { capability: string; provider: string; underlying: string; env: string; wouldRequireApproval: boolean } }).plan;
  ok("plan names capability", p.capability === "website.deploy");
  ok("plan names provider", p.provider === "edge.cloudflare");
  ok("plan names underlying", p.underlying === "deploy.pages");
  ok("plan flags prod approval needed", p.wouldRequireApproval === true);

  console.log("\n[2] Dry-run in dev also plans, no approval flagged");
  const planDev = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "development", dryRun: true });
  const pd = (planDev.data as { plan: { wouldRequireApproval: boolean } }).plan;
  ok("dev dryRun: no approval flagged", pd.wouldRequireApproval === false);

  console.log("\n[3] Non-dry-run prod STILL requires real approval (no silent exec)");
  calls.length = 0;
  const noAppr = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "production" });
  ok("prod without approval refused", noAppr.ok === false);
  ok("no backend call without approval", calls.length === 0);
  const ref = await grantStackBApproval("ops@ags", "agsynergy", "deploy.pages", "production");
  calls.length = 0;
  const yesAppr = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "production", approvalRef: ref });
  ok("prod WITH approval executes", yesAppr.ok === true);
  ok("backend invoked only when not dry-run", calls.includes("deploy"));

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("DRY-RUN TEST THREW:", e); process.exit(1); });
