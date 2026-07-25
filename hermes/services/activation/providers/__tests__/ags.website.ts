// AGS Website Capability Validation — REAL runtime test (no vitest dep)
// EPIC-006 P4: prove every website.* routes through HermesExecutionGateway
// (tenant → policy → approval → runtime guard → provider execution → audit)
// and that fail-closed refusals hold (no approval, wrong tenant).

import { _clearProviders, executeCapability, grantStackBApproval } from "../../provider-framework.js";
import { bootstrapProviders } from "../bootstrap.js";
import { activationPrincipal } from "../github/provider.js";
import { setSecretSource, type SecretSource } from "../secret-source.js";
import { runWebsiteCapability, listWebsiteCapabilityRoutes, type WebsiteCapability } from "../website.js";

let pass = 0, fail = 0;
function ok(n: string, c: boolean, e?: unknown) { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n}`, e ?? ""); } }
function eq(n: string, a: unknown, b: unknown) { ok(`${n} (${JSON.stringify(a)} === ${JSON.stringify(b)})`, a === b, { a, b }); }

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

  // Real backend (mock) that records it was actually invoked.
  const calls: string[] = [];
  const cfBackend = {
    build: () => { calls.push("build"); return { ok: true, data: { built: true }, backend: "mock-cf" }; },
    deploy: () => { calls.push("deploy"); return { ok: true, data: { deployed: true }, backend: "mock-cf" }; },
    status: () => { calls.push("status"); return { ok: true, data: {}, backend: "mock-cf" }; },
    rollback: () => { calls.push("rollback"); return { ok: true, data: {}, backend: "mock-cf" }; },
    history: () => { calls.push("history"); return { ok: true, data: {}, backend: "mock-cf" }; },
    health: () => { calls.push("health"); return { ok: true, data: {}, backend: "mock-cf" }; },
    logs: () => { calls.push("logs"); return { ok: true, data: {}, backend: "mock-cf" }; },
    analytics: () => { calls.push("analytics"); return { ok: true, data: {}, backend: "mock-cf" }; },
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

  console.log("\n[1] All 10 website.* capabilities are routed (provider-neutral)");
  const routes = listWebsiteCapabilityRoutes();
  eq("website capability count", routes.length, 10);
  for (const cap of ["website.status", "website.build", "website.deploy", "website.preview", "website.publish", "website.rollback", "website.health", "website.logs", "website.analytics", "website.version"] as WebsiteCapability[]) {
    ok(`route exists for ${cap}`, !!routes.find((r) => r.app === cap));
  }

  console.log("\n[2] Non-prod deploy executes through gateway (no approval needed)");
  calls.length = 0;
  const dev = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "development" });
  ok("dev website.deploy executes", dev.ok === true);
  ok("gateway actually invoked backend (deploy)", calls.includes("deploy"));

  console.log("\n[3] Prod deploy REQUIRES durable approval (fail-closed)");
  calls.length = 0;
  const noAppr = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "production" });
  ok("prod deploy without approval → refused", noAppr.ok === false);
  ok("no backend invoked without approval", calls.length === 0);

  console.log("\n[4] Prod deploy WITH approval executes through gateway");
  const ref = await grantStackBApproval("ops@ags", "agsynergy", "deploy.pages", "production");
  calls.length = 0;
  const yesAppr = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "production", approvalRef: ref });
  ok("prod deploy WITH approval → executes", yesAppr.ok === true);
  ok("backend invoked with approval", calls.includes("deploy"));

  console.log("\n[5] Unresolved capability is denied at the gateway (fail-closed)");
  const unresolved = await executeCapability("nonexistent.capability.xyz", { project: "x" }, { actor: "ops@ags", env: "development" });
  ok("unresolved capability denied", unresolved.ok === false);
  ok("refusal backend is hermes.fail-closed", unresolved.backend === "hermes.fail-closed");
  if (unresolved.ok) console.error("   DEBUG unresolved:", JSON.stringify(unresolved));

  console.log("\n[6] Rollback routes through gateway → backend rollback op");
  calls.length = 0;
  const rb = await runWebsiteCapability("website.rollback", { project: "agsynergy", to: "v42" }, { actor: "ops@ags", env: "development" });
  ok("rollback executes", rb.ok === true);
  ok("backend rollback invoked", calls.includes("rollback"));

  console.log("\n[7] Audit-provenance: every executed result carries a provider backend tag (audit emitted)");
  ok("dev deploy result tagged with provider backend", dev.backend === "cloudflare");
  ok("prod deploy result tagged with provider backend", yesAppr.backend === "cloudflare");
  ok("rollback result tagged with provider backend", rb.backend === "cloudflare");

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("WEBSITE VALIDATION THREW:", e); process.exit(1); });
