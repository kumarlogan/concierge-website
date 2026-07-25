// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — GitHub Provider (activation seam)            │
// │ EPIC-AGS · Provider-neutral. Mirrors claude-code activation.   │
// │                                                               │
// │ Registers GitHub as a Stack B provider through the SAME        │
// │ registerProvider → enableProvider → setProviderHealth path     │
// │ that Claude Code uses, so every GitHub capability execution     │
// │ routes through HermesExecutionGateway (tenant → policy →        │
// │ approval → runtime-guard). No GitHub-specific core code.        │
// │                                                               │
// │ The concrete backend (gh CLI / Octokit) is wired via            │
// │ setGitHubExecutor() at deploy time. Until then the provider is  │
// │ fail-closed: it reports "not_installed" and refuses execution.  │
// └─────────────────────────────────────────────────────────────┘

import {
  registerProvider,
  enableProvider,
  setProviderHealth,
  getProvider,
  type CapabilityDescriptor,
  type CapabilityExecutor,
  type ManagedProvider,
  type ProviderHealth,
} from "../../provider-framework.js";
import { PLATFORM_PERMISSIONS, type Principal } from "../../../../contracts/platform-api.js";
import { runGitHub, setGitHubExecutor, hasGitHubExecutor } from "./port.js";
import { githubBackendToExecutor, type GitHubBackend } from "./backend.js";

export const GITHUB_PROVIDER_ID = "vcs.github";

/** Capabilities GitHub exposes to Hermes (intention ids, never vendor verbs). */
export const GITHUB_CAPABILITIES: CapabilityDescriptor[] = [
  {
    id: "code.vcs.repo",
    description: "Inspect a GitHub repository (default branch, visibility, metadata).",
  },
  {
    id: "code.vcs.pull-request",
    description: "Open or merge a GitHub pull request.",
    requiresApprovalIn: ["production"],
  },
  {
    id: "code.vcs.branch",
    description: "List or create branches.",
    requiresApprovalIn: ["production"],
  },
  {
    id: "code.vcs.commit-history",
    description: "Read commit history / compare refs.",
  },
  {
    id: "code.vcs.tag",
    description: "List or create tags / releases.",
    requiresApprovalIn: ["production"],
  },
  {
    id: "code.vcs.rollback",
    description: "Revert a commit or reset a branch to a known-good ref.",
    requiresApprovalIn: ["production"],
  },
];

const GITHUB_EXECUTOR: CapabilityExecutor = (capability, args, ctx) =>
  runGitHub(capability, args, { actor: ctx.actor, env: ctx.env });

/**
 * Register + (authorization-gated) enable GitHub as a Stack B provider.
 * Returns the managed record so callers can wire the executor and mark
 * health. Fails closed if the caller lacks hermes:activation:provider.
 */
export function registerGitHubProvider(authorizedBy: Principal): ManagedProvider {
  const rec = registerProvider({
    id: GITHUB_PROVIDER_ID,
    label: "GitHub",
    domain: "development",
    capabilities: GITHUB_CAPABILITIES,
    backend: "github",
    executor: GITHUB_EXECUTOR,
  });
  enableProvider(rec.id, authorizedBy);
  // Reflect backend wiring in health (fail-closed when no executor yet).
  setProviderHealth(rec.id, githubHealth());
  return getGitHubProvider();
}

/** Recompute + persist health from backend wiring state. */
export function refreshGitHubHealth(): ManagedProvider {
  return setProviderHealth(GITHUB_PROVIDER_ID, githubHealth());
}

function githubHealth(): ProviderHealth {
  return hasGitHubExecutor() ? "healthy" : "not_installed";
}

/** Wire the concrete backend (call at deploy time, NOT at repo build). */
export function connectGitHubBackend(backend: GitHubBackend, authorizedBy: Principal): ManagedProvider {
  setGitHubExecutor(githubBackendToExecutor(backend));
  refreshGitHubHealth();
  return getGitHubProvider();
}

export function getGitHubProvider(): ManagedProvider {
  const p = getProvider(GITHUB_PROVIDER_ID);
  if (!p) throw new Error(`GitHub provider not registered: ${GITHUB_PROVIDER_ID}`);
  return p;
}

/** Principal helper for activation authorization in tests / deploy glue. */
export function activationPrincipal(id: string): Principal {
  return {
    id,
    organizationId: id,
    tenantId: id,
    permissions: [PLATFORM_PERMISSIONS.ACTIVATION_PROVIDER],
  };
}
