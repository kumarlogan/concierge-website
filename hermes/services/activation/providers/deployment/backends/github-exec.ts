// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Real GitHub Backend (EPIC-007)               │
// │                                                               │
// │ Implements GitHubBackend against the gh CLI (+ git for push)  │
// │ via the injected Spawner. Credentials resolve from the operator │
// │ SecretSource at call time. Every failure returns a clean        │
// │ { ok:false }; the backend NEVER throws across the platform      │
// │ boundary and NEVER fabricates output.                          │
// └─────────────────────────────────────────────────────────────┘

import type { GitHubBackend } from "../../github/backend.js";
import { resolveSecret } from "../../secret-source.js";
import type { Spawner } from "./spawner.js";
import { spawnResultToTool } from "./spawner.js";

export interface GitHubBackendOpts {
  repo: string; // owner/name
  branch: string;
  tokenRef?: string;
  gh?: string;
  git?: string;
}

function ghEnv(opts: GitHubBackendOpts): Record<string, string> {
  const token = resolveSecret(opts.tokenRef ?? "GITHUB_TOKEN");
  return token ? { GITHUB_TOKEN: token } : {};
}

function missingCreds(backend: string): { ok: false; error: string; backend: string } {
  return {
    ok: false,
    error: "github.exec: GITHUB_TOKEN absent from secret source (fail-closed)",
    backend,
  };
}

/** Build a GitHub backend backed by gh + git via the injected spawner. */
export function createGitHubCliBackend(
  spawner: Spawner,
  opts: GitHubBackendOpts,
): GitHubBackend {
  const gh = opts.gh ?? "gh";
  const git = opts.git ?? "git";
  const env = ghEnv(opts);
  const repoArgs = ["repo", opts.repo];

  return {
    status() {
      return spawner
        .run(gh, [...repoArgs, "view"], { env })
        .then((r) => spawnResultToTool(r, "hermes.github", { repo: opts.repo }));
    },
    branch(args) {
      const name = args.name ? String(args.name) : undefined;
      if (name) {
        return spawner
          .run(gh, [...repoArgs, "branch", name], { env })
          .then((r) => spawnResultToTool(r, "hermes.github"));
      }
      return spawner
        .run(gh, [...repoArgs, "branch", "--list"], { env })
        .then((r) => spawnResultToTool(r, "hermes.github"));
    },
    commit(args) {
      const message = String(args.message ?? "chore: ags deployment commit");
      const paths = (args.paths as string[] | undefined) ?? ["."];
      return spawner
        .run(git, ["add", ...paths], { env })
        .then(() => spawner.run(git, ["commit", "-m", message], { env }))
        .then((r) => spawnResultToTool(r, "hermes.github"));
    },
    push(args) {
      const branch = String(args.branch ?? opts.branch);
      const force = args.force ? ["--force"] : [];
      return spawner
        .run(git, ["push", "origin", branch, ...force], { env })
        .then((r) => spawnResultToTool(r, "hermes.github", { branch }));
    },
    pullRequest(args) {
      const title = String(args.title ?? "AGS release");
      const body = String(args.body ?? "");
      const merge = Boolean(args.merge);
      if (merge) {
        const num = String(args.number ?? "");
        return spawner
          .run(gh, [...repoArgs, "pr", "merge", num, "--squash"], { env })
          .then((r) => spawnResultToTool(r, "hermes.github"));
      }
      return spawner
        .run(gh, [...repoArgs, "pr", "create", "--title", title, "--body", body], { env })
        .then((r) => spawnResultToTool(r, "hermes.github"));
    },
    tag(args) {
      const name = String(args.name ?? "");
      if (!name) return { ok: false, error: "github.tag: name required", backend: "hermes.github" };
      return spawner
        .run(git, ["tag", name], { env })
        .then(() => spawner.run(git, ["push", "origin", "refs/tags/" + name], { env }))
        .then((r) => spawnResultToTool(r, "hermes.github", { tag: name }));
    },
    rollback(args) {
      const ref = String(args.ref ?? "");
      if (!ref) return { ok: false, error: "github.rollback: ref required", backend: "hermes.github" };
      return spawner
        .run(git, ["revert", "--no-edit", ref], { env })
        .then((r) => spawnResultToTool(r, "hermes.github"));
    },
  };
}
