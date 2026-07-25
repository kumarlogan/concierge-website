// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — AGS Provider Bootstrap (EPIC-006 · P3)         │
// │                                                               │
// │ Controlled startup registration for the AGS website providers. │
// │ On startup it:                                                 │
// │   1. registers each provider (fail-closed, enabled by auth),   │
// │   2. validates the provider manifest (capabilities present),   │
// │   3. validates operator credentials via the secret source,     │
// │   4. wires the backend ONLY if both pass,                       │
// │   5. emits an audit event.                                     │
// │                                                               │
// │ Failure semantics: if manifest OR credentials are invalid, the  │
// │ provider remains NOT_INSTALLED (no executor, capabilities        │
// │ refused fail-closed). NO partial activation. No secrets are     │
// │ logged. The bootstrap itself performs NO execution and NO       │
// │ network I/O — backends are supplied by the deployer.            │
// │                                                               │
// │ This module does NOT import any vendor SDK. The concrete GitHub │
// │ / Cloudflare backend objects are passed in by the deploy       │
// │ environment (see bootstrapProviders signature).                │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../../audit/event.js";
import { registerGitHubProvider, connectGitHubBackend, getGitHubProvider, GITHUB_CAPABILITIES, GITHUB_PROVIDER_ID } from "./github/provider.js";
import type { GitHubBackend } from "./github/backend.js";
import { registerCloudflareProvider, connectCloudflareBackend, getCloudflareProvider, CLOUDFLARE_CAPABILITIES, CLOUDFLARE_PROVIDER_ID } from "./cloudflare/provider.js";
import type { CloudflareBackend } from "./cloudflare/backend.js";
import { validateGitHubConfig } from "./github/config.js";
import { validateCloudflareConfig } from "./cloudflare/config.js";
import type { Principal } from "../../../contracts/platform-api.js";
import {
  configureDeploymentLedger,
  FileDeploymentLedgerBackend,
  MemoryDeploymentLedgerBackend,
  type DeploymentLedgerBackend,
} from "./deployment/ledger.js";
import { readFileSync, appendFileSync, existsSync } from "node:fs";

/**
 * Resolve the durable ledger backend.
 *  - If DEPLOYMENT_LEDGER_FILE is set, use the file-backed append-only ledger
 *    (restart-safe, tenant-isolated writes via the platform's own backend).
 *  - Otherwise fall back to the in-memory backend (dev/test/edge default).
 *  - If the file backend throws on construction, fail-closed: refuse to use a
 *    silently-broken durable store and fall back to in-memory + audit.
 */
function resolveLedgerBackend(env: Record<string, string | undefined> = process.env): DeploymentLedgerBackend {
  const path = env.DEPLOYMENT_LEDGER_FILE;
  if (!path) return new MemoryDeploymentLedgerBackend();
  try {
    return new FileDeploymentLedgerBackend(path, {
      readFileSync: (p: string, e: string) => readFileSync(p, { encoding: e as BufferEncoding }),
      appendFileSync: (p: string, d: string, e: string) => appendFileSync(p, d, { encoding: e as BufferEncoding }),
      existsSync: (p: string) => existsSync(p),
    });
  } catch (err) {
    emitAudit("deployment.ledger.backend.failed", "system", {
      reason: `file ledger unavailable, falling back to in-memory: ${(err as Error).message}`,
    });
    return new MemoryDeploymentLedgerBackend();
  }
}

/** Auto-wire the durable deployment ledger backend (EPIC-008.1 · Phase 3). */
function wireDeploymentLedger(env: Record<string, string | undefined> = process.env): void {
  const backend = resolveLedgerBackend(env);
  configureDeploymentLedger(backend);
  const durable = env.DEPLOYMENT_LEDGER_FILE ? `file:${env.DEPLOYMENT_LEDGER_FILE}` : "memory";
  emitAudit("deployment.ledger.wired", "system", { backend: durable });
}

export interface BootstrapResult {
  provider: string;
  registered: boolean;
  activated: boolean;
  reason: string;
}

function manifestValid(caps: { id: string }[]): boolean {
  return Array.isArray(caps) && caps.length > 0 && caps.every((c) => !!c.id);
}

/**
 * Bootstrap the AGS website providers at platform startup.
 *
 * @param authorizedBy  Principal authorized to register/enable providers.
 * @param backends      Concrete backends supplied by the deploy environment.
 *                       A backend is only wired when config validation passes.
 */
export function bootstrapProviders(
  authorizedBy: Principal,
  backends: { github?: GitHubBackend; cloudflare?: CloudflareBackend } = {},
): BootstrapResult[] {
  const results: BootstrapResult[] = [];

  // ── GitHub ──────────────────────────────────────────────────────
  {
    const registered = !!registerGitHubProvider(authorizedBy);
    const manifestOk = manifestValid(GITHUB_CAPABILITIES);
    const cfg = validateGitHubConfig();
    if (registered && manifestOk && cfg.ok) {
      if (backends.github) {
        connectGitHubBackend(backends.github, authorizedBy);
        emitAudit("provider.activated", authorizedBy.id, {
          provider: GITHUB_PROVIDER_ID,
          reason: "manifest+credentials valid; backend wired",
        });
        results.push({ provider: GITHUB_PROVIDER_ID, registered: true, activated: true, reason: "active" });
      } else {
        // Manifest + creds OK but no backend supplied → leave NOT_INSTALLED
        // fail-closed (no executor). Still registered, refused until wired.
        emitAudit("provider.bootstrap.deferred", authorizedBy.id, {
          provider: GITHUB_PROVIDER_ID,
          reason: "credentials valid; backend not supplied at boot (NOT_INSTALLED)",
        });
        results.push({ provider: GITHUB_PROVIDER_ID, registered: true, activated: false, reason: "registered; backend not wired (NOT_INSTALLED)" });
      }
    } else {
      const why = !registered ? "registration failed" : !manifestOk ? "manifest invalid (no capabilities)" : cfg.missing.join("; ");
      emitAudit("provider.bootstrap.refused", authorizedBy.id, {
        provider: GITHUB_PROVIDER_ID,
        reason: why,
      });
      results.push({ provider: GITHUB_PROVIDER_ID, registered, activated: false, reason: `NOT_INSTALLED: ${why}` });
    }
  }

  // ── Cloudflare ──────────────────────────────────────────────────
  {
    const registered = !!registerCloudflareProvider(authorizedBy);
    const manifestOk = manifestValid(CLOUDFLARE_CAPABILITIES);
    const cfg = validateCloudflareConfig();
    if (registered && manifestOk && cfg.ok) {
      if (backends.cloudflare) {
        connectCloudflareBackend(backends.cloudflare, authorizedBy);
        emitAudit("provider.activated", authorizedBy.id, {
          provider: CLOUDFLARE_PROVIDER_ID,
          reason: "manifest+credentials valid; backend wired",
        });
        results.push({ provider: CLOUDFLARE_PROVIDER_ID, registered: true, activated: true, reason: "active" });
      } else {
        emitAudit("provider.bootstrap.deferred", authorizedBy.id, {
          provider: CLOUDFLARE_PROVIDER_ID,
          reason: "credentials valid; backend not supplied at boot (NOT_INSTALLED)",
        });
        results.push({ provider: CLOUDFLARE_PROVIDER_ID, registered: true, activated: false, reason: "registered; backend not wired (NOT_INSTALLED)" });
      }
    } else {
      const why = !registered ? "registration failed" : !manifestOk ? "manifest invalid (no capabilities)" : cfg.missing.join("; ");
      emitAudit("provider.bootstrap.refused", authorizedBy.id, {
        provider: CLOUDFLARE_PROVIDER_ID,
        reason: why,
      });
      results.push({ provider: CLOUDFLARE_PROVIDER_ID, registered, activated: false, reason: `NOT_INSTALLED: ${why}` });
    }
  }

  // ── Deployment Ledger (durable backend auto-wire) ──────────────
  // Phase 3 (EPIC-008.1): the controlled deployment ledger is now auto-wired
  // at bootstrap so production deployments survive restarts. Fail-closed: a
  // broken durable store is refused and an in-memory fallback is audited.
  wireDeploymentLedger(process.env);

  return results;
}

/** Convenience: report whether a given provider is wired + healthy. */
export function providerStatus(): { github: string; cloudflare: string } {
  try {
    return {
      github: getGitHubProvider().health.health,
      cloudflare: getCloudflareProvider().health.health,
    };
  } catch {
    return { github: "unregistered", cloudflare: "unregistered" };
  }
}
