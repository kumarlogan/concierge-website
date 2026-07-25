// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — AGS Controlled Deployment Orchestrator        │
// │ (EPIC-007 · single entry point)                                │
// │                                                               │
// │ Assembles the governed launch pipeline from its parts:         │
// │   • RLSE executor (readiness + live smoke + rollback cap)      │
// │   • real GitHub + Cloudflare backends (vendor-neutral Spawner) │
// │   • the unified launch workflow (staging routine / prod gated) │
// │                                                               │
// │ Providers own EXECUTION ONLY. This module owns the policy,     │
// │ sequencing, idempotency, and audit wiring. No Foundation edit. │
// └─────────────────────────────────────────────────────────────┘

import type { Principal } from "../../../../contracts/platform-api.js";
import { connectGitHubBackend } from "../github/provider.js";
import { connectCloudflareBackend } from "../cloudflare/provider.js";
import type { GitHubBackend } from "../github/backend.js";
import type { CloudflareBackend } from "../cloudflare/backend.js";
import { createRlseExecutor, type RlseExecutor } from "./rlse.js";
import { runLaunch, type LaunchDeps, type LaunchRequest, type LaunchOutcome } from "./launch.js";
import { deploymentLedger, type DeployEnv } from "./ledger.js";
import { AGS_TENANT, AGS_DOMAIN, AGS_SITE_URL } from "./site-identity.js";
import { type Spawner } from "./backends/spawner.js";
import { createGitHubCliBackend } from "./backends/github-exec.js";
import { createCloudflareWranglerBackend } from "./backends/cloudflare-exec.js";

export interface AgsDeploymentConfig {
  githubRepo: string;
  githubBranch: string;
  cfAccount: string;
  cfProject: string;
  siteUrl?: string;
  /** Optional injected spawner (tests / alternate runtime). */
  spawner?: Spawner;
}

/** Default RLSE + dispatch wiring for AGS. */
export function buildAgsLaunchDeps(cfg: AgsDeploymentConfig, spawner: Spawner): LaunchDeps {
  const rlse: RlseExecutor = createRlseExecutor({
    githubRepo: cfg.githubRepo,
    githubBranch: cfg.githubBranch,
    cfAccount: cfg.cfAccount,
    cfProject: cfg.cfProject,
    siteUrl: cfg.siteUrl ?? AGS_SITE_URL,
    tenant: AGS_TENANT,
  });
  return {
    rlse,
    lastProdSuccessAt: () => {
      const last = deploymentLedger.lastSuccessful(AGS_TENANT, "production");
      return last ? last.at : null;
    },
    dispatch: {
      async pullGitHubRelease(ref: string) {
        const b = createGitHubCliBackend(spawner, { repo: cfg.githubRepo, branch: cfg.githubBranch });
        const r = await b.tag({ name: ref }, { actor: "ags-orchestrator", env: "staging" });
        return { ok: r.ok, error: r.error, data: r.data };
      },
      async pushToGitHub(_ref: string) {
        const b = createGitHubCliBackend(spawner, { repo: cfg.githubRepo, branch: cfg.githubBranch });
        const r = await b.push({ branch: cfg.githubBranch }, { actor: "ags-orchestrator", env: "staging" });
        return { ok: r.ok, error: r.error, data: r.data };
      },
      async deployToCloudflare(reference: string, env: DeployEnv) {
        const backend: CloudflareBackend = createCloudflareWranglerBackend(spawner, {
          account: cfg.cfAccount,
          project: cfg.cfProject,
        });
        void reference;
        const r = await backend.deploy({ project: cfg.cfProject, dir: "dist" }, { actor: "ags-orchestrator", env });
        // Environment selection is encoded in the project/alias wiring at
        // deploy time; the capability request carries the env as provenance.
        void env;
        return { ok: r.ok, error: r.error, data: r.data };
      },
    },
  };
}

/** Wire the real backends into the registered providers (provider-neutral). */
export function wireAgsProviders(
  cfg: AgsDeploymentConfig,
  spawner: Spawner,
  authorizedBy: Principal,
): void {
  const gh: GitHubBackend = createGitHubCliBackend(spawner, { repo: cfg.githubRepo, branch: cfg.githubBranch });
  connectGitHubBackend(gh, authorizedBy);
  const cf: CloudflareBackend = createCloudflareWranglerBackend(spawner, {
    account: cfg.cfAccount,
    project: cfg.cfProject,
  });
  connectCloudflareBackend(cf, authorizedBy);
}

/** The single public entry: run a controlled AGS launch. */
export async function agsLaunch(
  req: LaunchRequest,
  cfg: AgsDeploymentConfig,
  spawner: Spawner,
): Promise<LaunchOutcome> {
  const deps = buildAgsLaunchDeps(cfg, spawner);
  return runLaunch(req, deps);
}

export { deploymentLedger, AGS_TENANT, AGS_DOMAIN, AGS_SITE_URL };
export type { LaunchDeps, LaunchRequest, LaunchOutcome, Spawner, RlseExecutor };
