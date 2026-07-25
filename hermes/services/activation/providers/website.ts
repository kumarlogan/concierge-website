// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — AGS Website app capabilities (provider-neutral)
// │ EPIC-AGS · Thin routing layer over the platform providers.      │
// │                                                               │
// │ These are NOT new vendor code. They are application-level        │
// │ intention ids (website.deploy, website.rollback, …) that the    │
// │ platform resolves to the underlying vcs.github / edge.cloudflare │
// │ providers through the SAME HermesExecutionGateway every other   │
// │ capability uses. The AGS website gets first-class, governed      │
// │ operations without any core change and without touching the     │
// │ existing GitHub Actions / Cloudflare Pages pipelines.            │
// │                                                               │
// │ Deploy-time behavior (who actually runs `wrangler`/`gh`) is      │
// │ decided by the executor wired into each provider — fail-closed   │
// │ until then. This file contains ZERO secrets and ZERO network I/O.│
// └─────────────────────────────────────────────────────────────┘

import { executeCapability } from "../provider-framework.js";
import { grantStackBApproval } from "../provider-framework.js";
import { emitAudit } from "../../../audit/event.js";
import type { ToolResult } from "../../tools/tool-provider.js";
import {
  GITHUB_PROVIDER_ID,
  GITHUB_CAPABILITIES,
  getGitHubProvider,
} from "./github/provider.js";
import {
  CLOUDFLARE_PROVIDER_ID,
  CLOUDFLARE_CAPABILITIES,
  getCloudflareProvider,
} from "./cloudflare/provider.js";

export type Env = "development" | "staging" | "production";

/** AGS website-specific app capability ids (provider-neutral intentions). */
export const WEBSITE_CAPABILITIES = [
  "website.status",
  "website.build",
  "website.deploy",
  "website.preview",
  "website.publish",
  "website.rollback",
  "website.health",
  "website.logs",
  "website.analytics",
  "website.version",
] as const;

export type WebsiteCapability = (typeof WEBSITE_CAPABILITIES)[number];

/** Static routing table: app capability → (providerId, underlying capability). */
const ROUTES: Record<WebsiteCapability, { provider: string; capability: string }> = {
  "website.status": { provider: CLOUDFLARE_PROVIDER_ID, capability: "ops.health" },
  "website.build": { provider: CLOUDFLARE_PROVIDER_ID, capability: "deploy.build" },
  "website.deploy": { provider: CLOUDFLARE_PROVIDER_ID, capability: "deploy.pages" },
  "website.preview": { provider: CLOUDFLARE_PROVIDER_ID, capability: "deploy.pages" },
  "website.publish": { provider: CLOUDFLARE_PROVIDER_ID, capability: "deploy.pages" },
  "website.rollback": { provider: CLOUDFLARE_PROVIDER_ID, capability: "deploy.rollback" },
  "website.health": { provider: CLOUDFLARE_PROVIDER_ID, capability: "ops.health" },
  "website.logs": { provider: CLOUDFLARE_PROVIDER_ID, capability: "ops.logs" },
  "website.analytics": { provider: CLOUDFLARE_PROVIDER_ID, capability: "ops.analytics" },
  "website.version": { provider: CLOUDFLARE_PROVIDER_ID, capability: "deploy.history" },
};

/**
 * Execute a website app capability. Resolves to the underlying platform
 * provider and runs it through HermesExecutionGateway (fail-closed: if the
 * provider is not active/healthy, or needs an approval that is missing, the
 * call is refused — never fabricated).
 */
export function runWebsiteCapability(
  capability: WebsiteCapability,
  args: Record<string, unknown>,
  ctx: { actor: string; env: Env; approvalRef?: Parameters<typeof executeCapability>[2]["approvalRef"]; dryRun?: boolean },
): Promise<ToolResult> {
  const route = ROUTES[capability];
  if (!route) {
    return Promise.resolve({
      ok: false,
      error: `unknown website capability: ${capability}`,
      backend: "hermes.website",
    });
  }
  // EPIC-006 P5 — Dry-run mode: return a plan WITHOUT invoking the gateway
  // or any vendor backend. The fail-closed execution path is never touched;
  // this is a pure routing/policy decision in the app layer.
  if (ctx.dryRun) {
    emitAudit("website.dryrun.plan", ctx.actor, {
      capability,
      provider: route.provider,
      underlying: route.capability,
      env: ctx.env,
      args,
    });
    return Promise.resolve({
      ok: true,
      dryRun: true,
      data: {
        plan: {
          capability,
          provider: route.provider,
          underlying: route.capability,
          env: ctx.env,
          args,
          wouldRequireApproval: ctx.env === "production" && route.capability === "deploy.pages",
        },
      },
      backend: "hermes.website.dryrun",
    });
  }
  return executeCapability(route.capability, args, {
    actor: ctx.actor,
    env: ctx.env,
    ...(ctx.approvalRef ? { approvalRef: ctx.approvalRef } : {}),
  });
}

/** Convenience accessors used by the agent/operator surface. */
export function githubProviderId(): string {
  return GITHUB_PROVIDER_ID;
}
export function cloudflareProviderId(): string {
  return CLOUDFLARE_PROVIDER_ID;
}
export function listWebsiteCapabilityRoutes(): Array<{ app: WebsiteCapability; provider: string; capability: string }> {
  return WEBSITE_CAPABILITIES.map((app) => ({ app, ...ROUTES[app] }));
}
export { GITHUB_CAPABILITIES, CLOUDFLARE_CAPABILITIES, getGitHubProvider, getCloudflareProvider };

/**
 * EPIC-006 P6 — Production Approval Flow adapter.
 *
 * Wires the website deploy/publish path to the platform's single, durable
 * approval primitive (grantStackBApproval → ApprovalRef). The AGS operator
 * surface (e.g. Hermes/Telegram) requests approval; on grant, the durable
 * ApprovalRef is minted here and passed to runWebsiteCapability. No string
 * token, no bypass, no core change — this is pure orchestration over the
 * existing fail-closed approval model.
 */

export interface ProductionApprovalRequest {
  capability: WebsiteCapability;
  actor: string;
  applicationId: string;
  args: Record<string, unknown>;
  /** Human-readable summary for the operator prompt. */
  summary?: string;
}

/**
 * Build the operator-facing approval request (no side effects). The caller
 * (Hermes/Telegram) presents this and, on human approval, calls
 * `executeWithProductionApproval` below.
 */
export function buildProductionApprovalRequest(
  req: ProductionApprovalRequest,
): { id: string; prompt: string; scope: string } {
  const route = ROUTES[req.capability];
  const scope = `${req.applicationId}:${route?.capability ?? req.capability}`;
  const prompt =
    req.summary ??
    `Approve production ${req.capability} on ${req.applicationId} ` +
      `(routes to ${route?.provider}/${route?.capability})?`;
  return { id: `prod-req:${req.applicationId}:${req.capability}`, prompt, scope };
}

/**
 * Mint a durable ApprovalRef for production and execute the capability through
 * the gateway. The ApprovalRef is the ONLY thing that unlocks a prod deploy;
 * the gateway verifies it fail-closed.
 */
export async function executeWithProductionApproval(
  req: ProductionApprovalRequest,
): Promise<ToolResult> {
  const route = ROUTES[req.capability];
  if (!route) {
    return { ok: false, error: `unknown website capability: ${req.capability}`, backend: "hermes.website" };
  }
  // Only deploy/publish to prod require an approval gate.
  const needsApproval = req.capability === "website.deploy" || req.capability === "website.publish";
  if (!needsApproval) {
    return runWebsiteCapability(req.capability, req.args, { actor: req.actor, env: "production" });
  }
  const approvalRef = await grantStackBApproval(
    req.actor,
    req.applicationId,
    route.capability,
    "production",
  );
  return runWebsiteCapability(req.capability, req.args, {
    actor: req.actor,
    env: "production",
    approvalRef,
  });
}
