// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Manifest V2 + Loader               │
// │ EPIC-005.1 · PHASE 2                                           │
// │                                                               │
// │ The manifest is the ONLY thing a provider ships — data, never │
// │ code. The loader turns a manifest into live Provider instances │
// │ plus registered capabilities. NO hardcoded registration.      │
// │                                                               │
// │ Adding a provider = add a manifest file + register its impl   │
// │ factories. No core edit, no vendor branch.                    │
// └─────────────────────────────────────────────────────────────┘

import type { Provider, TrustLevel, HealthStatus } from "./sdk.js";
import type { ProviderManifest as LegacyManifest, CapabilityRegistry } from "./capability.js";

// ── Manifest V2 schema (mirrors docs/architecture/PROVIDER_MANIFEST_V2.md) ──

export type TransportKind =
  | "cli"
  | "local-process"
  | "stdio"
  | "http"
  | "https"
  | "websocket"
  | "mcp"
  | "ssh"
  | "future";

export interface ManifestCapability {
  /** Intention id, e.g. "dev.code.generate" (never vendor names). */
  id: string;
  /** Resolved by the Loader factory map (data, not code). */
  implKey: string;
  config?: Record<string, unknown>;
  effects?: Array<"read" | "write" | "network" | "exec" | "delete" | "external">;
}

export interface ProviderTransport {
  kind: TransportKind;
  endpoint?: string;
  auth?: string;
}

export interface ProviderPermission {
  capability: string;
  scope: string;
  grantedBy: "manifest" | "operator" | "runtime";
}

export interface SandboxPolicy {
  isolation: "none" | "process" | "container" | "vm";
  filesystem: "ro" | "rw" | "ephemeral";
  network: "none" | "egress-only" | "full";
  seccomp?: "default" | "strict";
}

export interface ProviderManifestV2 {
  id: string;
  name: string;
  vendor: string;
  version: string;
  manifestSchema: "v2";

  transports: ProviderTransport[];
  capabilities: ManifestCapability[];
  permissions: ProviderPermission[];

  trust: {
    level: TrustLevel;
    authModel: "none" | "token" | "oauth" | "mtls" | "ssh-key";
    signature?: {
      algorithm: "sha256" | "sha512" | "ed25519";
      /** SHA256 (or algorithm) of the canonical manifest body, excluding the signature. */
      checksum: string;
      /** Trusted signer id (must be pinned in TrustConfig.trustedSigners). */
      signer: string;
      /** Optional X.509/PEM certificate or public-key reference. */
      certificate?: string;
      /**
       * Detached ed25519 signature (base64) over the canonical manifest body.
       * When present and a public key is registered for `signer`, the verifier
       * performs REAL asymmetric verification (Phase 3). Absent = checksum-only
       * integrity (fail-closed if enforcement requires authenticity).
       */
      value?: string;
      /** Optional key id for rotation (maps to TrustedSignerRegistry). */
      keyId?: string;
    };
    sandboxPolicy?: SandboxPolicy;
  };

  health: {
    probe: "none" | "http" | "tcp" | "process" | "command";
    endpoint?: string;
    intervalMs: number;
    timeoutMs: number;
    healthyWithinMs: number;
  };

  limits: {
    maxConcurrent: number;
    maxDurationMs: number;
    memoryMb?: number;
    networkEgress?: "none" | "egress-only" | "full";
  };

  approval: {
    requiredByDefault: boolean;
    perCapability?: Record<string, boolean>;
    humanInLoop?: boolean;
  };

  lifecycle: {
    discoverable: boolean;
    autoLoad: boolean;
    deprecated?: boolean;
    deprecationNote?: string;
    preferredFor?: string[];
  };

  features?: {
    streaming?: boolean;
    cancel?: boolean;
    idempotency?: boolean;
    retry?: boolean;
    webhook?: boolean;
  };
}

// ── Validation ─────────────────────────────────────────────────────────────

export class ManifestValidationError extends Error {
  constructor(
    public readonly manifestId: string,
    public readonly reason: string,
  ) {
    super(`Manifest "${manifestId}" invalid: ${reason}`);
    this.name = "ManifestValidationError";
  }
}

/**
 * Validate a manifest's structural + semantic invariants.
 * Pure data check — no I/O, no provider code. Fail-closed: throws on any gap.
 */
export function validateManifestV2(m: unknown): ProviderManifestV2 {
  if (typeof m !== "object" || m === null) {
    throw new ManifestValidationError("<unknown>", "manifest is not an object");
  }
  const obj = m as Record<string, unknown>;
  const id = String(obj.id ?? "<unknown>");

  const require = (cond: unknown, field: string) => {
    if (!cond) throw new ManifestValidationError(id, `missing/invalid field: ${field}`);
  };

  require(typeof obj.id === "string" && obj.id.length > 0, "id");
  require(typeof obj.vendor === "string", "vendor");
  require(typeof obj.version === "string", "version");
  require(obj.manifestSchema === "v2", "manifestSchema === 'v2'");
  require(Array.isArray(obj.transports) && obj.transports.length > 0, "transports[]");
  require(Array.isArray(obj.capabilities), "capabilities[]");
  require(Array.isArray(obj.permissions), "permissions[]");
  require(typeof obj.trust === "object" && obj.trust !== null, "trust");
  require(typeof obj.health === "object" && obj.health !== null, "health");
  require(typeof obj.limits === "object" && obj.limits !== null, "limits");
  require(typeof obj.approval === "object" && obj.approval !== null, "approval");
  require(typeof obj.lifecycle === "object" && obj.lifecycle !== null, "lifecycle");

  const trust = obj.trust as Record<string, unknown>;
  require(
    ["untrusted", "sandbox", "trusted", "privileged"].includes(trust.level as string),
    "trust.level",
  );
  // Trust tier >= trusted REQUIRES a signature (supply-chain integrity).
  if (trust.level !== "untrusted" && trust.level !== "sandbox") {
    require(typeof trust.signature === "object" && trust.signature !== null, "trust.signature");
  }

  const caps = obj.capabilities as ManifestCapability[];
  require(caps.length > 0, "capabilities[] non-empty");
  for (const c of caps) {
    require(typeof c.id === "string" && c.id.length > 0, "capability.id");
    require(typeof c.implKey === "string" && c.implKey.length > 0, "capability.implKey");
    // Intention id must NOT be vendor-namespaced (EPIC-005 rule).
    require(!c.id.includes(":"), `capability.id "${c.id}" must be vendor-free intention`);
  }

  return m as ProviderManifestV2;
}

// ── Loader ─────────────────────────────────────────────────────────────────

/** A factory that builds a live Provider from its manifest. */
export type ProviderFactory = (manifest: ProviderManifestV2) => Provider;

/**
 * Builds a manifest-aware loader. The factory map is keyed by provider `id`
 * (data, not a code branch). To add a provider, register ONE factory here.
 */
export function createProviderLoader(
  providerFactories: Record<string, ProviderFactory>,
): (manifest: ProviderManifestV2) => Provider {
  return (manifest: ProviderManifestV2): Provider => {
    const factory = providerFactories[manifest.id];
    if (!factory) {
      throw new ManifestValidationError(
        manifest.id,
        `no provider factory registered for id "${manifest.id}"`,
      );
    }
    return factory(manifest);
  };
}

/**
 * Register a provider's capabilities into the capability registry.
 * Reuses the existing EPIC-003-006 M5 registry seam — no new registry invented.
 * The impl stored is the provider instance (opaque to the registry).
 */
export function registerProviderCapabilities(
  provider: Provider,
  manifest: ProviderManifestV2,
  registry: CapabilityRegistry,
): void {
  const meta = provider.metadata();
  const caps = manifest.capabilities.map((c) => ({
    id: c.id,
    name: c.id,
    provider: meta.id as unknown as LegacyManifest["name"],
    config: c.config,
    impl: provider,
  }));
  registry.register(caps);
}

// Re-export so callers need only import this module.
export type { LegacyManifest, CapabilityRegistry, HealthStatus };
