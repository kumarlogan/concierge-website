// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Cloudflare Provider (vendored port)          │
// │ EPIC-AGS · Provider-neutral. No wrangler/workers-types here.   │
// │                                                               │
// │ The ONLY extension point the Cloudflare backend implements.    │
// │ The platform never imports the wrangler SDK directly; it calls │
// │ THIS port. Concrete impl is injected at deploy time via         │
// │ setCloudflareExecutor(). Until then the provider is fail-closed │
// │ and refuses execution (never fabricates Cloudflare output).     │
// └─────────────────────────────────────────────────────────────┘

import type { CapabilityExecutor } from "../../provider-framework.js";

export type CloudflareExecutor = CapabilityExecutor;

let activeExecutor: CloudflareExecutor | undefined;

export function setCloudflareExecutor(exec: CloudflareExecutor): void {
  activeExecutor = exec;
}

export function clearCloudflareExecutor(): void {
  activeExecutor = undefined;
}

export function hasCloudflareExecutor(): boolean {
  return activeExecutor !== undefined;
}

export function runCloudflare(
  capability: string,
  args: Record<string, unknown>,
  ctx: { actor: string; env: "development" | "staging" | "production" },
): ReturnType<CloudflareExecutor> {
  if (!activeExecutor) {
    return {
      ok: false,
      error: "cloudflare.backend.not-connected: no Cloudflare executor wired (fail-closed)",
      backend: "hermes.cloudflare",
    };
  }
  return activeExecutor(capability, args, ctx);
}
