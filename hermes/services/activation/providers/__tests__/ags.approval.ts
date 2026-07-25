// AGS Production Approval Adapter — REAL runtime test (no vitest dep)
// EPIC-006 P6: buildProductionApprovalRequest (operator prompt) + executeWithProductionApproval
// mints a durable ApprovalRef and executes through the gateway; non-gated
// prod capabilities still run; gated ones REQUIRE the ref.

import { _clearProviders, executeCapability } from "../../provider-framework.js";
import { bootstrapProviders } from "../bootstrap.js";
import { activationPrincipal } from "../github/provider.js";
import { setSecretSource, type SecretSource } from "../secret-source.js";
import { runWebsiteCapability, buildProductionApprovalRequest, executeWithProductionApproval } from "../website.js";

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

  console.log("\n[1] buildProductionApprovalRequest produces operator prompt + scope");
  const req = buildProductionApprovalRequest({
    capability: "website.deploy",
    actor: "ops@ags",
    applicationId: "agsynergy",
    args: { project: "agsynergy" },
  });
  ok("request id scoped", req.id === "prod-req:agsynergy:website.deploy");
  ok("prompt mentions capability", /website\.deploy/.test(req.prompt));
  ok("scope = app:capability", req.scope === "agsynergy:deploy.pages");

  console.log("\n[2] executeWithProductionApproval mints ApprovalRef + executes through gateway");
  calls.length = 0;
  const res = await executeWithProductionApproval({
    capability: "website.deploy",
    actor: "ops@ags",
    applicationId: "agsynergy",
    args: { project: "agsynergy" },
  });
  ok("prod deploy via adapter executes", res.ok === true);
  ok("backend invoked exactly once (deploy)", calls.filter((c) => c === "deploy").length === 1);

  console.log("\n[3] Non-gated prod capability runs without minting a ref");
  calls.length = 0;
  const health = await executeWithProductionApproval({
    capability: "website.health",
    actor: "ops@ags",
    applicationId: "agsynergy",
    args: {},
  });
  ok("prod health runs", health.ok === true);
  ok("prod health result tagged with provider backend", health.backend === "cloudflare");

  console.log("\n[4] Manual path WITHOUT adapter still fails closed (no ref)");
  calls.length = 0;
  const manual = await runWebsiteCapability("website.deploy", { project: "agsynergy" }, { actor: "ops@ags", env: "production" });
  ok("manual prod deploy without ref refused", manual.ok === false);
  ok("no backend invoked without ref", calls.length === 0);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("APPROVAL ADAPTER TEST THREW:", e); process.exit(1); });
