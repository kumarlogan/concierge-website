// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Real Cloudflare Backend (EPIC-007)            │
// │                                                               │
// │ Implements CloudflareBackend against the wrangler CLI via the  │
// │ injected Spawner. Credentials are resolved from the operator-  │
// │ owned SecretSource at call time (never hardcoded). Every       │
// │ failure returns a clean { ok:false } — it NEVER throws across  │
// │ the platform boundary and NEVER fabricates a success.          │
// └─────────────────────────────────────────────────────────────┘

import type { CloudflareBackend } from "../../cloudflare/backend.js";
import { resolveSecret } from "../../secret-source.js";
import type { Spawner } from "./spawner.js";
import { spawnResultToTool } from "./spawner.js";

// Canonical Cloudflare token reference (EPIC-008.1 · Phase 1). The legacy
// `CF_API_TOKEN` name is accepted as a fallback so existing operator setups keep
// working, but `CLOUDFLARE_API_TOKEN` is the single documented name.
const CF_TOKEN_REFS = ["CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"] as const;

export interface CloudflareBackendOpts {
  account: string;
  project: string;
  /** Falls back to CLOUDFLARE_API_TOKEN (then legacy CF_API_TOKEN) if omitted. */
  tokenRef?: string;
  /** Optional: override the wrangler binary (tests / alternate installs). */
  wrangler?: string;
}

/**
 * Resolve the Cloudflare token from the injected SecretSource. Returns the env
 * block (canonical name only) when a token is present, otherwise empty so the
 * fail-closed check below fires. Legacy CF_API_TOKEN is read for convenience
 * but always normalized to CLOUDFLARE_API_TOKEN at the boundary.
 */
function cfEnv(opts: CloudflareBackendOpts): Record<string, string> {
  const refs = opts.tokenRef ? [opts.tokenRef, ...CF_TOKEN_REFS] : [...CF_TOKEN_REFS];
  let token: string | undefined;
  for (const ref of refs) {
    token = resolveSecret(ref);
    if (token) break;
  }
  return token ? { CLOUDFLARE_API_TOKEN: token } : {};
}

function missingCreds(backend: string): { ok: false; error: string; backend: string } {
  return {
    ok: false,
    error: "cloudflare.exec: CLOUDFLARE_API_TOKEN absent from secret source (fail-closed)",
    backend,
  };
}

/**
 * Build a Cloudflare backend backed by wrangler + the injected spawner.
 * Returns the structured CloudflareBackend the platform adapter consumes.
 */
export function createCloudflareWranglerBackend(
  spawner: Spawner,
  opts: CloudflareBackendOpts,
): CloudflareBackend {
  const bin = opts.wrangler ?? "wrangler";
  const env = cfEnv(opts);
  const baseArgs = ["--account-id", opts.account];

  return {
    build(args) {
      if (!env.CLOUDFLARE_API_TOKEN) return missingCreds("hermes.cloudflare");
      const dir = String(args.dir ?? ".");
      return spawner
        .run(bin, [...baseArgs, "pages", "build", dir], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare"));
    },
    deploy(args) {
      if (!env.CLOUDFLARE_API_TOKEN) return missingCreds("hermes.cloudflare");
      const dir = String(args.dir ?? "dist");
      const project = String(args.project ?? opts.project);
      return spawner
        .run(bin, [...baseArgs, "pages", "deploy", dir, "--project-name", project], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare", { url: `https://${project}.pages.dev` }));
    },
    status(args) {
      const project = String(args.project ?? opts.project);
      return spawner
        .run(bin, [...baseArgs, "pages", "project", "list"], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare", { project }));
    },
    rollback(args) {
      if (!env.CLOUDFLARE_API_TOKEN) return missingCreds("hermes.cloudflare");
      const deploymentId = String(args.deploymentId ?? "");
      return spawner
        .run(bin, [...baseArgs, "deployments", "rollback", deploymentId], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare"));
    },
    history(args) {
      const project = String(args.project ?? opts.project);
      return spawner
        .run(bin, [...baseArgs, "pages", "deployment", "list", "--project-name", project], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare"));
    },
    health(args) {
      // Health = a live HTTP probe of the site; here we ask wrangler for the
      // project status (cheap) and map success. A full HTTP smoke is the RLSE
      // layer's job (probeSite).
      const project = String(args.project ?? opts.project);
      return spawner
        .run(bin, [...baseArgs, "pages", "project", "get", project], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare"));
    },
    logs(args) {
      const project = String(args.project ?? opts.project);
      return spawner
        .run(bin, [...baseArgs, "pages", "deployment", "tail", "--project-name", project], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare"));
    },
    analytics(args) {
      const project = String(args.project ?? opts.project);
      return spawner
        .run(bin, [...baseArgs, "pages", "analytics", "get", "--project-name", project], { env })
        .then((r) => spawnResultToTool(r, "hermes.cloudflare"));
    },
  };
}
