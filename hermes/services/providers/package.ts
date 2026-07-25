// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Dynamic Provider Package Model               │
// │ EPIC-005.2 · PHASE 1 (contracts only, no logic)                │
// │                                                               │
// │ Defines the on-disk / remote PACKAGE format a provider ships.  │
// │ The package is the unit of discovery. Hermes reads the package │
// │ boundary, never the provider's internals.                      │
// │                                                               │
// │ Supported provider kinds (data-declared, never code-branched): │
// │   cli        — local binary invoked via CliTransport          │
// │   mcp        — Model Context Protocol server                   │
// │   remote     — HTTP/HTTPS endpoint                             │
// │   internal   — Hermes-bundled provider (in-repo)               │
// │   third-party— externally hosted package (signed)              │
// │                                                               │
// │ NO vendor name appears in this file. The loader resolves a     │
// │ package generically by its declared contract, not its brand.   │
// └─────────────────────────────────────────────────────────────┘

import type { ProviderManifestV2 } from "./manifest-v2.js";
import type { TransportKind } from "./transport.js";
import type { Provider } from "./sdk.js";

/** Where a package physically lives. Hermes discovers from any of these. */
export type ProviderPackageLocation =
  | { kind: "filesystem"; rootDir: string }
  | { kind: "remote"; baseUrl: string; manifestUrl: string }
  | { kind: "registry"; registryUrl: string; packageId: string; version?: string }
  | { kind: "inline"; rootDir: string }; // already-resolved in-memory tree

/** Logical category of provider — data only, drives nothing in core code. */
export type ProviderPackageKind = "cli" | "mcp" | "remote" | "internal" | "third-party";

/**
 * transport.json — declares which Hermes-owned transport(s) the package needs.
 * The transport itself is implemented by Hermes (transport/cli.ts, etc.);
 * the package only names the kind + connection hints. This keeps transport
 * logic out of the provider and reusable across providers.
 */
export interface ProviderPackageTransport {
  /** Must match a TransportKind registered in the TransportRegistry. */
  kind: TransportKind;
  /** Connection endpoint (binary name for cli, URL for http/https/mcp). */
  endpoint?: string;
  /** Auth model hint passed to the transport (never a secret value). */
  authModel?: "none" | "token" | "oauth" | "mtls" | "ssh-key";
  /** Extra transport options (non-secret). */
  options?: Record<string, unknown>;
}

/**
 * metadata.json — human-facing catalog metadata (never affects trust/runtime).
 */
export interface ProviderPackageMetadata {
  displayName: string;
  description?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  icon?: string;
  tags?: string[];
}

/**
 * The standardized export contract every provider package MUST satisfy.
 * The generic loader imports the package's entry module and calls
 * `createProvider`. No central factory map, no vendor switch.
 *
 * The package supplies ONLY execution. It receives the validated manifest,
 * the shared TransportRegistry (Hermes-owned transports), and a loader
 * context (spawner injection for tests, etc.).
 */
export interface ProviderPackageContract {
  /** Schema version of THIS contract (distinct from manifest version). */
  contractVersion: "1.0";
  /** Builds a live Provider from the validated manifest. */
  createProvider(
    manifest: ProviderManifestV2,
    transports: import("./transport.js").TransportRegistry,
    ctx: ProviderLoaderContext,
  ): Provider;
  /** Optional self-test hook (used by discovery dry-run). */
  selfTest?(manifest: ProviderManifestV2): Promise<boolean> | boolean;
}

/** Context handed to a package factory by the generic loader. */
export interface ProviderLoaderContext {
  /** Injected process spawner (for CLI transport in tests / non-Node envs). */
  spawner?: import("./transport/cli.js").ProcessSpawner;
  /** Arbitrary Hermes-owned runtime config (non-secret). */
  runtime?: Record<string, unknown>;
}

/**
 * Resolved on-disk package tree. Built by the discovery layer (PHASE 2) by
 * reading manifest.json + transport.json + metadata.json + loading the
 * entry module. This is the in-memory representation the loader consumes.
 */
export interface ProviderPackage {
  /** Stable package id (== manifest.id). */
  id: string;
  /** Declared kind (cli/mcp/remote/internal/third-party). */
  kind: ProviderPackageKind;
  /** Original location it was discovered from. */
  location: ProviderPackageLocation;
  /** Validated manifest (already passed validateManifestV2). */
  manifest: ProviderManifestV2;
  /** Transport declaration(s) from transport.json. */
  transports: ProviderPackageTransport[];
  /** Catalog metadata from metadata.json (optional). */
  metadata?: ProviderPackageMetadata;
  /** The loaded entry module satisfying ProviderPackageContract. */
  contract: ProviderPackageContract;
}

/** Standard package file layout (relative to package root). */
export const PROVIDER_PACKAGE_FILES = {
  manifest: "manifest.json",
  transport: "transport.json",
  metadata: "metadata.json",
  entry: "provider.ts",
} as const;

/**
 * Result of attempting to load a package's entry module + contract.
 * Used by the generic loader to report a malformed package without crashing.
 */
export type PackageLoadResult =
  | { ok: true; contract: ProviderPackageContract }
  | { ok: false; error: string };
