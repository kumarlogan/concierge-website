// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — GitHub Backend Contract (EPIC-006 · P1)       │
// │ Provider-neutral execution interface. The platform depends on  │
// │ THIS contract, never on a vendor SDK. The deploy-time backend  │
// │ (gh CLI / Octokit / Actions) implements GitHubBackend; an       │
// │ adapter (githubBackendToExecutor) maps capability ids onto it. │
// │                                                               │
// │ Ownership boundary (Foundation Principle 1+5): the backend      │
// │ owns EXECUTION ONLY. It must NOT make approval, policy,        │
// │ tenancy, trust, or audit decisions. Those are enforced by the  │
// │ gateway before this code ever runs. The backend receives the   │
// │ human actor + target env purely for provenance/labeling.       │
// └─────────────────────────────────────────────────────────────┘

import type { CapabilityExecutor } from "../../provider-framework.js";
import type { ToolCall, ToolResult } from "../../../tools/tool-provider.js";

export type BackendEnv = ToolCall["env"];
export interface BackendCtx {
  /** Human actor (provenance only — never an auth/approval decision). */
  actor: string;
  /** Target environment (provenance only). */
  env: BackendEnv;
}

/**
 * The GitHub execution surface. Every method is a pure execution primitive.
 * The backend resolves its own credentials from an injected secret source
 * (see EPIC-006 P2) and returns a platform ToolResult — it NEVER throws
 * across the platform boundary on a GitHub error (clean { ok:false } instead).
 */
export interface GitHubBackend {
  /** Repository metadata / commit-history read. */
  status(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** List / create branches. */
  branch(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Create a commit. */
  commit(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Push refs to the remote. */
  push(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Open / merge a pull request. */
  pullRequest(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** List / create tags or releases. */
  tag(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Revert / reset to a known-good ref. */
  rollback(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
}

/** Map each vended GitHub capability id to its backend operation. */
const GITHUB_CAP_TO_OP: Record<string, keyof GitHubBackend> = {
  "code.vcs.repo": "status",
  "code.vcs.commit-history": "status",
  "code.vcs.branch": "branch",
  "code.vcs.commit": "commit",
  "code.vcs.push": "push",
  "code.vcs.pull-request": "pullRequest",
  "code.vcs.tag": "tag",
  "code.vcs.rollback": "rollback",
};

/**
 * Adapt a GitHubBackend into the generic CapabilityExecutor the platform
 * port consumes. Unknown capabilities are refused fail-closed (never
 * fabricated). This is the single place capability ids bind to backend ops.
 */
export function githubBackendToExecutor(backend: GitHubBackend): CapabilityExecutor {
  return (capability, args, ctx) => {
    const op = GITHUB_CAP_TO_OP[capability];
    if (!op) {
      return {
        ok: false,
        error: `github.backend.unsupported: no operation for capability ${capability}`,
        backend: "hermes.github",
      };
    }
    return backend[op](args, { actor: ctx.actor, env: ctx.env });
  };
}
