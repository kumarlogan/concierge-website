// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Readiness Executors (EPIC-006.5 · P3/P4)      │
// │                                                               │
// │ CONNECTIVITY / READINESS CHECK ONLY.                          │
// │ These executors DO NOT deploy. They validate that a real      │
// │ runtime execution could proceed:                              │
// │   GitHub:  repository access + branch validation              │
// │   Cloudflare: project + account validation + deploy readiness │
// │                                                               │
// │ They decide NOTHING about permission/approval/tenancy/trust/   │
// │ policy — those are enforced by the frozen gateway upstream.    │
// │ Credentials come ONLY from the SecretSource (no source secrets).
// │ Missing credential ⇒ NOT_INSTALLED ⇒ readiness check DENIED.   │
// └─────────────────────────────────────────────────────────────┘

import { resolveSecret } from "../secret-source.js";

export interface ReadinessResult {
  ok: boolean;
  /** "ready" | "not_installed" | "invalid" */
  state: "ready" | "not_installed" | "invalid";
  /** Provider id that performed the check. */
  provider: string;
  checks: { name: string; ok: boolean; detail?: string }[];
  error?: string;
}

/** Provider-neutral readiness executor contract. */
export interface ReadinessExecutor {
  readonly provider: string;
  check(args: Record<string, unknown>): Promise<ReadinessResult>;
}

function checkSecret(ref: string): { ok: boolean; detail?: string } {
  const v = resolveSecret(ref);
  return v ? { ok: true } : { ok: false, detail: `secret '${ref}' missing` };
}

/**
 * GitHub readiness executor. Validates repository + branch access using
 * operator-owned credentials resolved from the SecretSource. No network I/O
 * here (deployment-time wiring supplies the real check); this is the contract
 * + fail-closed credential gate. A deploy-time impl would shell out to `gh`.
 */
export function createGitHubReadinessExecutor(repo: string, branch: string): ReadinessExecutor {
  return {
    provider: "vcs.github",
    async check(args): Promise<ReadinessResult> {
      const checks: ReadinessResult["checks"] = [];
      const repoArg = (args.repo as string) ?? repo;
      const branchArg = (args.branch as string) ?? branch;

      const tok = checkSecret("GITHUB_TOKEN");
      checks.push({ name: "credential.github_token", ...tok });
      if (!tok.ok) {
        return { ok: false, state: "not_installed", provider: "vcs.github", checks, error: "GitHub credentials NOT_INSTALLED" };
      }
      checks.push({ name: "repository.format", ok: /^[\w.-]+\/[\w.-]+$/.test(repoArg), detail: repoArg });
      checks.push({ name: "branch.format", ok: branchArg.length > 0, detail: branchArg });
      const ok = checks.every((c) => c.ok);
      return { ok, state: ok ? "ready" : "invalid", provider: "vcs.github", checks };
    },
  };
}

/**
 * Cloudflare readiness executor. Validates account + project + deploy readiness
 * using operator-owned credentials from the SecretSource. No network I/O here;
 * a deploy-time impl would shell out to `wrangler`.
 */
export function createCloudflareReadinessExecutor(account: string, project: string): ReadinessExecutor {
  return {
    provider: "edge.cloudflare",
    async check(args): Promise<ReadinessResult> {
      const checks: ReadinessResult["checks"] = [];
      const acctArg = (args.account as string) ?? account;
      const projArg = (args.project as string) ?? project;

      const tok = checkSecret("CLOUDFLARE_API_TOKEN");
      checks.push({ name: "credential.cloudflare_token", ...tok });
      if (!tok.ok) {
        return { ok: false, state: "not_installed", provider: "edge.cloudflare", checks, error: "Cloudflare credentials NOT_INSTALLED" };
      }
      checks.push({ name: "account.format", ok: acctArg.length > 0, detail: acctArg });
      checks.push({ name: "project.format", ok: projArg.length > 0, detail: projArg });
      const ok = checks.every((c) => c.ok);
      return { ok, state: ok ? "ready" : "invalid", provider: "edge.cloudflare", checks };
    },
  };
}
