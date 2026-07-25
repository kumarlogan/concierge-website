// ┌─────────────────────────────────────────────────────────────┐
// │ AGS Integration — REAL runtime integration test (no vitest dep) │
// │ Verifies the Foundation-preserving path end-to-end:             │
// │   registerProvider → enableProvider → setProviderHealth →       │
// │   executeCapability → HermesExecutionGateway (tenant/policy/    │
// │   approval/guard) → executor port.                              │
// │                                                                │
// │ Run: tsx providers/__tests__/ags.integration.ts                 │
// │ No secrets, no network. A mock backend stands in for gh/wrangler │
// │ exactly as a real deploy-time executor would be wired.          │
// └─────────────────────────────────────────────────────────────┘

import {
  registerGitHubProvider,
  connectGitHubBackend,
  getGitHubProvider,
  activationPrincipal,
  GITHUB_CAPABILITIES,
} from "../github/provider.js";
import {
  registerCloudflareProvider,
  connectCloudflareBackend,
  getCloudflareProvider,
  CLOUDFLARE_CAPABILITIES,
} from "../cloudflare/provider.js";
import {
  runWebsiteCapability,
  listWebsiteCapabilityRoutes,
  type WebsiteCapability,
} from "../website.js";
import { executeCapability, _clearProviders } from "../../provider-framework.js";
import { grantStackBApproval } from "../../provider-framework.js";

// ── tiny assert harness (avoids vitest dependency in this sandbox) ──
let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean, extra?: unknown): void {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    fail++;
    console.error(`  ✗ ${name}`, extra ?? "");
  }
}
function eq(name: string, a: unknown, b: unknown): void {
  ok(`${name} (${JSON.stringify(a)} === ${JSON.stringify(b)})`, a === b, { a, b });
}

// Mock backends that mimic how the REAL gh/wrangler executors would be wired
// at deploy time — same contract, zero network/secrets here. Each implements
// the typed GitHubBackend / CloudflareBackend interface so the adapter
// (githubBackendToExecutor / cloudflareBackendToExecutor) binds capability ids.
const bctx = { actor: "operator@ags", env: "development" as const };
const mk = (backend: string) => (_args: Record<string, unknown>) => ({
  ok: true as const,
  data: { backend, capability: "mock" },
  backend,
});
const githubMock: import("../github/backend.js").GitHubBackend = {
  status: (_a, _c) => ({ ok: true, data: { gh: "status" }, backend: "mock-gh" }),
  branch: (_a, _c) => ({ ok: true, data: { gh: "branch" }, backend: "mock-gh" }),
  commit: (_a, _c) => ({ ok: true, data: { gh: "commit" }, backend: "mock-gh" }),
  push: (_a, _c) => ({ ok: true, data: { gh: "push" }, backend: "mock-gh" }),
  pullRequest: (_a, _c) => ({ ok: true, data: { gh: "pr" }, backend: "mock-gh" }),
  tag: (_a, _c) => ({ ok: true, data: { gh: "tag" }, backend: "mock-gh" }),
  rollback: (_a, _c) => ({ ok: true, data: { gh: "rollback" }, backend: "mock-gh" }),
};
const cloudflareMock: import("../cloudflare/backend.js").CloudflareBackend = {
  build: (_a, _c) => ({ ok: true, data: { cf: "build" }, backend: "mock-cf" }),
  deploy: (_a, _c) => ({ ok: true, data: { cf: "deploy" }, backend: "mock-cf" }),
  status: (_a, _c) => ({ ok: true, data: { cf: "status" }, backend: "mock-cf" }),
  rollback: (_a, _c) => ({ ok: true, data: { cf: "rollback" }, backend: "mock-cf" }),
  history: (_a, _c) => ({ ok: true, data: { cf: "history" }, backend: "mock-cf" }),
  health: (_a, _c) => ({ ok: true, data: { cf: "health" }, backend: "mock-cf" }),
  logs: (_a, _c) => ({ ok: true, data: { cf: "logs" }, backend: "mock-cf" }),
  analytics: (_a, _c) => ({ ok: true, data: { cf: "analytics" }, backend: "mock-cf" }),
};
void bctx; void mk;

async function main(): Promise<void> {
  _clearProviders();

  console.log("\n[1] Registration + authorization-gated enable");
  const actor = "operator@ags";
  const p = activationPrincipal(actor);
  const gh = registerGitHubProvider(p);
  const cf = registerCloudflareProvider(p);
  eq("github registered id", gh.id, "vcs.github");
  eq("github enabled", gh.enabled, true);
  eq("github lifecycle enabled after register", gh.lifecycle, "enabled");
  eq("github capabilities count", gh.capabilities.length, GITHUB_CAPABILITIES.length);
  eq("cloudflare registered id", cf.id, "edge.cloudflare");

  console.log("\n[2] Fail-closed when no backend executor wired");
  const noBackend = await executeCapability("code.vcs.repo", { repo: "kumarlogan/hermes-website" }, { actor, env: "development" });
  ok("no backend → refused", noBackend.ok === false);
  ok("no backend → fail-closed message", /No active provider|not-connected|refused/i.test((noBackend as { error: string }).error));

  console.log("\n[3] Wire real (mock) backends at deploy time");
  connectGitHubBackend(githubMock as never, p);
  connectCloudflareBackend(cloudflareMock as never, p);
  const gh2 = getGitHubProvider();
  eq("github healthy after wiring", gh2.health.health, "healthy");

  console.log("\n[4] Execute through the gateway (real path, no approval needed)");
  const repoRes = await executeCapability("code.vcs.repo", { repo: "kumarlogan/hermes-website" }, { actor, env: "development" });
  ok("repo capability executes", repoRes.ok === true);
  eq("repo backend label = provider id", (repoRes as { backend: string }).backend, "github");

  console.log("\n[5] Website app capability routes to Cloudflare via gateway");
  const routes = listWebsiteCapabilityRoutes();
  eq("website routes count", routes.length, 10);
  eq("website.deploy → deploy.pages", routes.find((r) => r.app === "website.deploy")?.capability, "deploy.pages");
  const deployRes = await runWebsiteCapability("website.deploy" as WebsiteCapability, { project: "agsynergy", branch: "main" }, { actor, env: "development" });
  ok("website.deploy executes via gateway", deployRes.ok === true);
  eq("website.deploy backend label = provider id", (deployRes as { backend: string }).backend, "cloudflare");

  console.log("\n[6] Production deploy REQUIRES a durable human approval (fail-closed)");
  const noApproval = await runWebsiteCapability("website.deploy" as WebsiteCapability, { project: "agsynergy", branch: "main" }, { actor, env: "production" });
  ok("prod deploy without approval → refused", noApproval.ok === false);
  ok("prod deploy denial mentions approval", /approval/i.test((noApproval as { error: string }).error));

  console.log("\n[7] With a real ApprovalRef, production deploy proceeds");
  const ref = await grantStackBApproval(actor, "agsynergy", "deploy.pages", "production");
  const approved = await runWebsiteCapability("website.deploy" as WebsiteCapability, { project: "agsynergy", branch: "main" }, { actor, env: "production", approvalRef: ref });
  ok("prod deploy WITH approval → executes", approved.ok === true);

  console.log("\n[8] Unknown / unregistered capability is refused (no fallback vendor)");
  const unknown = await executeCapability("code.vcs.nonexistent", {}, { actor, env: "development" });
  ok("unknown capability → refused", unknown.ok === false);

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => {
  console.error("INTEGRATION TEST THREW:", e);
  process.exit(1);
});
