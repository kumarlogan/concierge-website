// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Git Operation Provider (provider-neutral)   │
// │ EPIC-002-007 · M4                                            │
// │                                                 SAFETY:        │
// │  • Branch / commit / diff / PR-prep are supported.            │
// │  • PUSH IS NEVER PERFORMED AUTOMATICALLY. Every push requires │
// │    an explicit human approval token AND a direct human call.  │
// │    An agent may PREPARE a push (build the ref + summary) but   │
// │    the actual `git push` only runs when a human approves.      │
// │  • Provider-neutral: the real backend (local git, a remote     │
// │    Git service API) is injected via GitBackend port.           │
// │  • Fail-closed: no backend ⇒ refuse; missing approval ⇒ refuse.│
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/event.js";
import {
  registerProvider,
  type CapabilityExecutor,
  type ManagedProvider,
} from "./provider-framework.js";

export const GIT_PROVIDER_ID = "git.local";

// ─── Backend port (vendor-neutral) ───────────────────────────

export interface GitBackend {
  branch(name: string, base?: string): Promise<{ ok: boolean; ref?: string; error?: string }>;
  commit(message: string, paths?: string[]): Promise<{ ok: boolean; sha?: string; error?: string }>;
  diff(target?: string): Promise<{ ok: boolean; patch?: string; error?: string }>;
  preparePush(remote: string, ref: string): Promise<{ ok: boolean; summary?: string; error?: string }>;
  /** Only invoked after explicit human approval. */
  push(remote: string, ref: string, approvalToken: string): Promise<{ ok: boolean; error?: string }>;
}

let BACKEND: GitBackend | undefined;
export function setGitBackend(b: GitBackend | undefined): void {
  BACKEND = b;
}

// ─── Capabilities ─────────────────────────────────────────────

const GIT_CAPABILITIES: import("./provider-framework.js").CapabilityDescriptor[] = [
  { id: "git.branch", description: "Create a branch", requiresApproval: false },
  { id: "git.commit", description: "Commit staged changes (explicit paths)", requiresApprovalIn: ["production"] },
  { id: "git.diff", description: "Show diff for review", requiresApproval: false },
  { id: "git.pr-prepare", description: "Prepare a pull request (no push)", requiresApproval: false },
  // push is intentionally NOT a discoverable capability — it is gated solely
  // by an explicit human action via pushBranch(), never via executeCapability.
];

// ─── Provider registration ───────────────────────────────────

export function registerGitProvider(): ManagedProvider {
  const executor: CapabilityExecutor = (capability, args, ctx) => {
    if (!BACKEND) {
      return { ok: false, error: "Git backend not wired", backend: "git.local" };
    }
    const B = "git.local";
    switch (capability) {
      case "git.branch":
        return { ...BACKEND.branch(String(args.name), args.base ? String(args.base) : undefined), backend: B };
      case "git.commit":
        return { ...BACKEND.commit(String(args.message), (args.paths as string[]) ?? undefined), backend: B };
      case "git.diff":
        return { ...BACKEND.diff(args.target ? String(args.target) : undefined), backend: B };
      case "git.pr-prepare":
        return { ...BACKEND.preparePush(String(args.remote ?? "origin"), String(args.ref)), backend: B };
      default:
        return { ok: false, error: `Unsupported git capability: ${capability}`, backend: B };
    }
  };
  return registerProvider({
    id: GIT_PROVIDER_ID,
    label: "Local Git",
    domain: "development",
    capabilities: [...GIT_CAPABILITIES],
    backend: "git/local",
    executor,
  });
}

// ─── Typed operations (with the no-auto-push guarantee) ───────

export interface GitOpResult {
  ok: boolean;
  ref?: string;
  sha?: string;
  patch?: string;
  summary?: string;
  error?: string;
}

export async function createBranch(
  actor: string,
  name: string,
  base?: string,
): Promise<GitOpResult> {
  if (!BACKEND) return { ok: false, error: "Git backend not wired" };
  emitAudit("git.branch", actor, { name, base });
  return BACKEND.branch(name, base);
}

export async function commitChanges(
  actor: string,
  message: string,
  paths?: string[],
  approvalToken?: string,
): Promise<GitOpResult> {
  if (!BACKEND) return { ok: false, error: "Git backend not wired" };
  // Production commit always needs a human approval token (fail-closed).
  if (!approvalToken) {
    emitAudit("git.commit.denied", actor, { reason: "missing approval token" });
    return { ok: false, error: "Commit requires a human approval token" };
  }
  emitAudit("git.commit", actor, { message, paths, approved: true });
  return BACKEND.commit(message, paths);
}

export async function showDiff(actor: string, target?: string): Promise<GitOpResult> {
  if (!BACKEND) return { ok: false, error: "Git backend not wired" };
  emitAudit("git.diff", actor, { target });
  return BACKEND.diff(target);
}

/**
 * Prepare a push for human review. Returns a summary + ref but DOES NOT push.
 * The human then calls pushBranch() with an approval token.
 */
export async function preparePush(actor: string, remote: string, ref: string): Promise<GitOpResult> {
  if (!BACKEND) return { ok: false, error: "Git backend not wired" };
  emitAudit("git.pr-prepare", actor, { remote, ref });
  return BACKEND.preparePush(remote, ref);
}

/**
 * THE ONLY PATH TO PUSH. Requires an explicit human approval token. Agents
 * CANNOT call this — it is invoked by the human approval flow after a human
 * reviews the prepared push. Fail-closed on missing/invalid token.
 */
export async function pushBranch(
  actor: string,
  remote: string,
  ref: string,
  approvalToken: string,
): Promise<GitOpResult> {
  if (!BACKEND) return { ok: false, error: "Git backend not wired" };
  if (!approvalToken) {
    emitAudit("git.push.denied", actor, { reason: "missing approval token" });
    return { ok: false, error: "Push requires explicit human approval" };
  }
  emitAudit("git.push", actor, { remote, ref, approved: true });
  return BACKEND.push(remote, ref, approvalToken);
}
