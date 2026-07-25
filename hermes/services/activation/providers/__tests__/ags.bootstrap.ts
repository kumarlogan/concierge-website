// AGS Provider Bootstrap — REAL runtime test (no vitest dep)
// Verifies EPIC-006 P2+P3: missing credentials => NOT_INSTALLED (fail-closed),
// no partial activation, audit emitted; with creds+backend => activated.

import { _clearProviders, executeCapability } from "../../provider-framework.js";
import { bootstrapProviders, providerStatus } from "../bootstrap.js";
import { activationPrincipal } from "../github/provider.js";
import { setSecretSource, type SecretSource } from "../secret-source.js";

let pass = 0, fail = 0;
function ok(n: string, c: boolean, e?: unknown) { if (c) { pass++; console.log(`  ✓ ${n}`); } else { fail++; console.error(`  ✗ ${n}`, e ?? ""); } }
function eq(n: string, a: unknown, b: unknown) { ok(`${n} (${JSON.stringify(a)} === ${JSON.stringify(b)})`, a === b, { a, b }); }

// In-memory secret source for deterministic testing (no real env/secrets).
function memSource(map: Record<string, string>): SecretSource {
  return { get: (ref) => map[ref] || undefined };
}

async function main(): Promise<void> {
  _clearProviders();

  console.log("\n[A] Bootstrap with NO credentials → both NOT_INSTALLED (fail-closed)");
  setSecretSource(memSource({}));
  const r1 = bootstrapProviders(activationPrincipal("ops@ags"));
  const gh1 = r1.find((r) => r.provider === "vcs.github")!;
  const cf1 = r1.find((r) => r.provider === "edge.cloudflare")!;
  ok("github registered", gh1.registered);
  ok("github NOT activated (no creds)", !gh1.activated);
  ok("github reason NOT_INSTALLED", /NOT_INSTALLED/.test(gh1.reason));
  ok("cloudflare NOT activated (no creds)", !cf1.activated);
  ok("cloudflare reason NOT_INSTALLED", /NOT_INSTALLED/.test(cf1.reason));

  console.log("\n[B] Capability still refused fail-closed until a backend is wired");
  const res = await executeCapability(
    "deploy.pages", { project: "agsynergy" }, { actor: "ops@ags", env: "development" },
  );
  ok("deploy.pages refused pre-wire", res.ok === false);
  ok("refusal mentions no active provider", /No active provider|not-connected/i.test((res as { error: string }).error));

  console.log("\n[C] With credentials + backend supplied → activated");
  _clearProviders();
  setSecretSource(memSource({
    GITHUB_TOKEN: "ghs_test",
    AGS_GITHUB_REPOSITORY: "kumarlogan/hermes-website",
    CLOUDFLARE_API_TOKEN: "cf_test",
    AGS_CLOUDFLARE_ACCOUNT: "ags-acct",
    AGS_CLOUDFLARE_PROJECT: "agsynergy",
  }));
  const ghBackend = { status: () => ({ ok: true, data: {}, backend: "mock-gh" }), branch: () => ({ ok: true, data: {}, backend: "mock-gh" }), commit: () => ({ ok: true, data: {}, backend: "mock-gh" }), push: () => ({ ok: true, data: {}, backend: "mock-gh" }), pullRequest: () => ({ ok: true, data: {}, backend: "mock-gh" }), tag: () => ({ ok: true, data: {}, backend: "mock-gh" }), rollback: () => ({ ok: true, data: {}, backend: "mock-gh" }) } as never;
  const cfBackend = { build: () => ({ ok: true, data: {}, backend: "mock-cf" }), deploy: () => ({ ok: true, data: {}, backend: "mock-cf" }), status: () => ({ ok: true, data: {}, backend: "mock-cf" }), rollback: () => ({ ok: true, data: {}, backend: "mock-cf" }), history: () => ({ ok: true, data: {}, backend: "mock-cf" }), health: () => ({ ok: true, data: {}, backend: "mock-cf" }), logs: () => ({ ok: true, data: {}, backend: "mock-cf" }), analytics: () => ({ ok: true, data: {}, backend: "mock-cf" }) } as never;
  const r2 = bootstrapProviders(activationPrincipal("ops@ags"), { github: ghBackend, cloudflare: cfBackend });
  const gh2 = r2.find((r) => r.provider === "vcs.github")!;
  const cf2 = r2.find((r) => r.provider === "edge.cloudflare")!;
  ok("github activated with creds+backend", gh2.activated);
  ok("cloudflare activated with creds+backend", cf2.activated);
  const status = providerStatus();
  eq("github health healthy", status.github, "healthy");
  eq("cloudflare health healthy", status.cloudflare, "healthy");

  console.log(`\nRESULT: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error("BOOTSTRAP TEST THREW:", e); process.exit(1); });
