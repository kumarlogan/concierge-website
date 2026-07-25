// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — RLSE Executor (EPIC-007 · PHASE 2)            │
// │ Readiness + Live Smoke + rollback-capability Executor.         │
// │                                                               │
// │ RLSE is the pre-flight + post-flight execution surface the      │
// │ launch workflow delegates to. It is NOT a provider — it is the │
// │ Hermes-owned reality check that runs BEFORE a deploy (readiness │
// │ + live smoke) and reports rollback capability AFTER. It reuses  │
// │ the existing provider readiness executors (cred-gated,          │
// │ NOT_INSTALLED fail-closed) and the live site probes.           │
// └─────────────────────────────────────────────────────────────┘

import {
  createGitHubReadinessExecutor,
  createCloudflareReadinessExecutor,
  type ReadinessResult,
} from "./executors.js";
import { probeSite, type ProbeResult } from "./site-identity.js";
import { deploymentLedger } from "./ledger.js";
import type { DeployEnv } from "./ledger.js";

export interface RlseDeps {
  githubRepo: string;
  githubBranch: string;
  cfAccount: string;
  cfProject: string;
  siteUrl: string;
  tenant: string;
}

export interface RlseReadiness {
  github: ReadinessResult;
  cloudflare: ReadinessResult;
  /** True only when BOTH backends report ready. */
  allReady: boolean;
}

export interface RlseSmoke {
  site: ProbeResult;
  /** True when the live site is reachable + serving. */
  live: boolean;
}

export interface RlseRollback {
  ok: boolean;
  canRollback: boolean;
  lastDeploymentId?: string;
  lastReference?: string;
}

/**
 * Build the RLSE executor. Backends are consulted live; missing credentials
 * make the underlying readiness executor report NOT_INSTALLED (fail-closed).
 */
export function createRlseExecutor(deps: RlseDeps) {
  const github = createGitHubReadinessExecutor(deps.githubRepo, deps.githubBranch);
  const cloudflare = createCloudflareReadinessExecutor(deps.cfAccount, deps.cfProject);

  return {
    /** Pre-flight: are both providers ready (creds present + reachable)? */
    async readiness(): Promise<RlseReadiness> {
      const [g, c] = await Promise.all([
        github.check({ repo: deps.githubRepo, branch: deps.githubBranch }),
        cloudflare.check({ account: deps.cfAccount, project: deps.cfProject }),
      ]);
      return { github: g, cloudflare: c, allReady: g.ok && c.ok };
    },

    /** Live smoke: is the public site actually reachable + serving? */
    async smoke(): Promise<RlseSmoke> {
      const site = await probeSite(deps.siteUrl);
      return { site, live: site.ok };
    },

    /** Rollback capability: is there a prior successful deployment to revert to? */
    rollbackCapable(environment?: DeployEnv): RlseRollback {
      const last = deploymentLedger.lastSuccessful(deps.tenant, environment);
      return {
        ok: true,
        canRollback: !!last,
        ...(last ? { lastDeploymentId: last.deploymentId, lastReference: last.reference } : {}),
      };
    },
  };
}

export type RlseExecutor = ReturnType<typeof createRlseExecutor>;
