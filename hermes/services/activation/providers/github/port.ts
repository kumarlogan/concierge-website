// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — GitHub Provider (vendored capability port)   │
// │ EPIC-AGS · Provider-neutral. No GitHub SDK imported here.      │
// │                                                               │
// │ This is the ONLY extension point the GitHub backend implements. │
// │ The platform never imports @actions/github or the gh binary    │
// │ directly; it calls THIS port. The concrete implementation is   │
// │ injected at deploy time via setGitHubExecutor(). If unset, the  │
// │ provider is fail-closed and refuses execution — it NEVER        │
// │ fabricates GitHub output.                                       │
// │                                                               │
// │ The port intentionally mirrors the claude-code activation       │
// │ pattern (setClaudeCodeExecutor) so both AGS integrations share │
// │ one governance path through HermesExecutionGateway.            │
// └─────────────────────────────────────────────────────────────┘

import type { CapabilityExecutor } from "../../provider-framework.js";

/**
 * The GitHub executor port. `capability` is the vended GitHub capability id
 * (e.g. "code.vcs.repo"), `args` is the normalized request, `ctx` carries the
 * human actor + environment. Returns a ToolResult in the platform contract.
 *
 * Implementations MUST:
 *   • read credentials from the injected secret source (never from code),
 *   • return { ok:false } on any GitHub API/CLI error (never throw across the
 *     platform boundary — the framework converts throws to unhealthy, but a
 *     clean ToolResult is preferred for auditable denial),
 *   • never log secrets.
 */
export type GitHubExecutor = CapabilityExecutor;

let activeExecutor: GitHubExecutor | undefined;

/** Inject the concrete GitHub backend (gh CLI / Octokit / Actions). */
export function setGitHubExecutor(exec: GitHubExecutor): void {
  activeExecutor = exec;
}

/** Clear the backend (e.g. test teardown or provider disable). */
export function clearGitHubExecutor(): void {
  activeExecutor = undefined;
}

/** True when a backend is wired. Used for fail-closed health reporting. */
export function hasGitHubExecutor(): boolean {
  return activeExecutor !== undefined;
}

/** The single dispatch point the provider's executor calls into. */
export function runGitHub(
  capability: string,
  args: Record<string, unknown>,
  ctx: { actor: string; env: "development" | "staging" | "production" },
): ReturnType<GitHubExecutor> {
  if (!activeExecutor) {
    return {
      ok: false,
      error: "github.backend.not-connected: no GitHub executor wired (fail-closed)",
      backend: "hermes.github",
    };
  }
  return activeExecutor(capability, args, ctx);
}
