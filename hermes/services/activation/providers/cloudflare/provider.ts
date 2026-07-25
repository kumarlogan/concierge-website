// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Cloudflare Provider (activation seam)        │
// │ EPIC-AGS · Provider-neutral. Mirrors claude-code activation.   │
// │                                                               │
// │ Registers Cloudflare as a Stack B provider through the SAME    │
// │ registerProvider → enableProvider → setProviderHealth path, so │
// │ every Cloudflare capability routes through HermesExecutionGateway
// │ (tenant → policy → approval → runtime-guard). No vendor SDK in  │
// │ the core activation path.                                       │
// │                                                               │
// │ The concrete backend (wrangler / Cloudflare API) is wired via  │
// │ setCloudflareExecutor() at deploy time. Until then the provider │
// │ is fail-closed: "not_installed" + executes nothing.            │
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
import { runCloudflare, setCloudflareExecutor, hasCloudflareExecutor } from "./port.js";
import { cloudflareBackendToExecutor, type CloudflareBackend } from "./backend.js";

export const CLOUDFLARE_PROVIDER_ID = "edge.cloudflare";

/** Capabilities Cloudflare exposes (intention ids). */
export const CLOUDFLARE_CAPABILITIES: CapabilityDescriptor[] = [
  {
    id: "deploy.build",
    description: "Trigger a build (wrangler build / pages build) for the website.",
  },
  {
    id: "deploy.pages",
    description: "Deploy a Cloudflare Pages project (agsynergy.ca).",
    requiresApprovalIn: ["production"],
  },
  {
    id: "deploy.worker",
    description: "Deploy a Cloudflare Worker (e.g. hermes-website worker).",
    requiresApprovalIn: ["production"],
  },
  {
    id: "deploy.history",
    description: "List recent deployments / releases.",
  },
  {
    id: "deploy.rollback",
    description: "Roll a deployment back to a previous known-good version.",
    requiresApprovalIn: ["production"],
  },
  {
    id: "ops.health",
    description: "Probe deployment health (HTTP status, latency, edge status).",
  },
  {
    id: "ops.logs",
    description: "Fetch deployment / runtime logs.",
  },
  {
    id: "ops.analytics",
    description: "Read edge analytics (requests, errors, bandwidth).",
  },
];

const CLOUDFLARE_EXECUTOR: CapabilityExecutor = (capability, args, ctx) =>
  runCloudflare(capability, args, { actor: ctx.actor, env: ctx.env });

export function registerCloudflareProvider(authorizedBy: Principal): ManagedProvider {
  const rec = registerProvider({
    id: CLOUDFLARE_PROVIDER_ID,
    label: "Cloudflare",
    domain: "development",
    capabilities: CLOUDFLARE_CAPABILITIES,
    backend: "cloudflare",
    executor: CLOUDFLARE_EXECUTOR,
  });
  enableProvider(rec.id, authorizedBy);
  setProviderHealth(rec.id, cloudflareHealth());
  return getCloudflareProvider();
}

export function refreshCloudflareHealth(): ManagedProvider {
  return setProviderHealth(CLOUDFLARE_PROVIDER_ID, cloudflareHealth());
}

function cloudflareHealth(): ProviderHealth {
  return hasCloudflareExecutor() ? "healthy" : "not_installed";
}

export function connectCloudflareBackend(backend: CloudflareBackend, authorizedBy: Principal): ManagedProvider {
  setCloudflareExecutor(cloudflareBackendToExecutor(backend));
  refreshCloudflareHealth();
  return getCloudflareProvider();
}

export function getCloudflareProvider(): ManagedProvider {
  const p = getProvider(CLOUDFLARE_PROVIDER_ID);
  if (!p) throw new Error(`Cloudflare provider not registered: ${CLOUDFLARE_PROVIDER_ID}`);
  return p;
}

export function activationPrincipal(id: string): Principal {
  return {
    id,
    organizationId: id,
    tenantId: id,
    permissions: [PLATFORM_PERMISSIONS.ACTIVATION_PROVIDER],
  };
}
