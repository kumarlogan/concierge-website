// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Cloudflare Backend Contract (EPIC-006 · P1)   │
// │ Provider-neutral execution interface. The platform depends on  │
// │ THIS contract, never on the wrangler SDK. The deploy-time       │
// │ backend (wrangler / Cloudflare API) implements CloudflareBackend;│
// │ an adapter (cloudflareBackendToExecutor) maps capability ids.   │
// │                                                               │
// │ Ownership boundary (Foundation Principle 1+5): the backend      │
// │ owns EXECUTION ONLY. It must NOT make approval, policy,         │
// │ tenancy, trust, or audit decisions — those are enforced by the  │
// │ gateway before this code runs. Actor + env are provenance only. │
// └─────────────────────────────────────────────────────────────┘

import type { CapabilityExecutor } from "../../provider-framework.js";
import type { ToolCall, ToolResult } from "../../../tools/tool-provider.js";

export type BackendEnv = ToolCall["env"];
export interface BackendCtx {
  actor: string;
  env: BackendEnv;
}

/**
 * The Cloudflare execution surface (execution primitives only). The backend
 * resolves its own credentials from an injected secret source (EPIC-006 P2)
 * and returns a platform ToolResult — it NEVER throws across the platform
 * boundary on a Cloudflare error (clean { ok:false } instead).
 */
export interface CloudflareBackend {
  /** Build trigger (e.g. wrangler build / pages build). */
  build(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Deploy (Pages project or Worker). `target` selects the surface. */
  deploy(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Deployment status / edge status probe. */
  status(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Roll back to a previous deployment. */
  rollback(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** List recent deployments / releases. */
  history(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Probe deployment health (HTTP status, latency, edge status). */
  health(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Fetch deployment / runtime logs. */
  logs(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
  /** Read edge analytics (requests, errors, bandwidth). */
  analytics(args: Record<string, unknown>, ctx: BackendCtx): Promise<ToolResult> | ToolResult;
}

/** Map each vended Cloudflare capability id to its backend operation. */
const CLOUDFLARE_CAP_TO_OP: Record<string, keyof CloudflareBackend> = {
  "deploy.build": "build",
  "deploy.pages": "deploy",
  "deploy.worker": "deploy",
  "deploy.history": "history",
  "deploy.rollback": "rollback",
  "ops.health": "health",
  "ops.logs": "logs",
  "ops.analytics": "analytics",
  "deploy.status": "status",
};

/**
 * Adapt a CloudflareBackend into the generic CapabilityExecutor. Unknown
 * capabilities are refused fail-closed. Single place capability ids bind to
 * backend ops.
 */
export function cloudflareBackendToExecutor(backend: CloudflareBackend): CapabilityExecutor {
  return (capability, args, ctx) => {
    const op = CLOUDFLARE_CAP_TO_OP[capability];
    if (!op) {
      return {
        ok: false,
        error: `cloudflare.backend.unsupported: no operation for capability ${capability}`,
        backend: "hermes.cloudflare",
      };
    }
    // Surface selection (Pages vs Worker) is carried in args by the caller.
    return backend[op](args, { actor: ctx.actor, env: ctx.env });
  };
}
