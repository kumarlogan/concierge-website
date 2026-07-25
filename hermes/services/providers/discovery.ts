// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider Manifest Discovery                  │
// │ EPIC-005.2 · PHASE 2                                           │
// │                                                               │
// │ Reads provider locations, identifies manifests, validates      │
// │ schema, and reports results SAFELY. A bad provider never        │
// │ crashes Hermes — it is reported as REJECTED with a reason and  │
// │ other providers proceed.                                       │
// │                                                               │
// │ Discovery is I/O-agnostic: the file reader is injected         │
// │ (Hermes-owned), so this runs on Node, Edge, or in tests with   │
// │ an in-memory fake. No real filesystem access is hardcoded.     │
// └─────────────────────────────────────────────────────────────┘

import {
  validateManifestV2,
  ManifestValidationError,
  type ProviderManifestV2,
} from "./manifest-v2.js";
import {
  PROVIDER_PACKAGE_FILES,
  type ProviderPackageKind,
  type ProviderPackageLocation,
  type ProviderPackageTransport,
  type ProviderPackageMetadata,
} from "./package.js";

/** Injected file reader (Hermes-owned). Returns file contents or throws. */
export type FileReader = (path: string) => Promise<string> | string;
/** Injected directory lister (Hermes-owned). Returns child entries. */
export type DirLister = (dir: string) => Promise<string[]> | string[];

/** A provider found by discovery but NOT yet loaded into a contract. */
export interface DiscoveredProvider {
  id: string;
  kind: ProviderPackageKind;
  location: ProviderPackageLocation;
  /** Absolute package directory (parent of manifest.json). */
  packageDir: string;
  manifest: ProviderManifestV2;
  transports: ProviderPackageTransport[];
  metadata?: ProviderPackageMetadata;
}

export type DiscoveryOutcome =
  | { status: "discovered"; provider: DiscoveredProvider }
  | { status: "rejected"; providerId: string; location: ProviderPackageLocation; reason: string };

export interface DiscoveryResult {
  /** Providers that passed manifest validation. */
  discovered: DiscoveredProvider[];
  /** Providers that failed (invalid manifest, missing file, parse error). */
  rejected: Array<{ providerId: string; location: ProviderPackageLocation; reason: string }>;
}

function inferKind(manifest: ProviderManifestV2, location: ProviderPackageLocation): ProviderPackageKind {
  if (location.kind === "registry" || location.kind === "remote") return "third-party";
  if (manifest.lifecycle?.deprecated) return "internal"; // bundled-but-deprecated → internal
  // Declare kind from transport: cli binary → cli, mcp → mcp, http(s) → remote.
  const tk = manifest.transports[0]?.kind;
  if (tk === "cli" || tk === "local-process" || tk === "stdio") return "cli";
  if (tk === "mcp") return "mcp";
  if (tk === "http" || tk === "https" || tk === "websocket") return "remote";
  return "internal";
}

function readJson<T>(read: FileReader, path: string): T {
  const raw = read(path);
  if (typeof raw !== "string") {
    // Allow async in tests by throwing a clear sync-only error.
    throw new Error(`file reader returned non-string for ${path}`);
  }
  return JSON.parse(raw) as T;
}

/**
 * The discovery abstraction. Scans a location, validates each manifest, and
 * returns a structured result. Never throws for a single bad provider — it
 * isolates failures and keeps discovering the rest.
 */
export class ProviderDiscovery {
  constructor(
    private readonly read: FileReader,
    private readonly listDir: DirLister,
  ) {}

  /** Discover all providers under a single location. */
  async discover(location: ProviderPackageLocation): Promise<DiscoveryResult> {
    const result: DiscoveryResult = { discovered: [], rejected: [] };

    let packageDirs: string[];
    try {
      packageDirs = await this.resolvePackageDirs(location);
    } catch (e) {
      // Location itself unreadable — record as a single rejected entry with
      // the location root as id, but DO NOT crash the caller.
      result.rejected.push({
        providerId: this.locationLabel(location),
        location,
        reason: `location unreadable: ${(e as Error).message}`,
      });
      return result;
    }

    for (const dir of packageDirs) {
      const outcome = await this.discoverOne(dir, location);
      if (outcome.status === "discovered") result.discovered.push(outcome.provider);
      else result.rejected.push(outcome);
    }
    return result;
  }

  /** Discover across multiple locations, merging results. */
  async discoverAll(locations: ProviderPackageLocation[]): Promise<DiscoveryResult> {
    const merged: DiscoveryResult = { discovered: [], rejected: [] };
    for (const loc of locations) {
      const r = await this.discover(loc);
      merged.discovered.push(...r.discovered);
      merged.rejected.push(...r.rejected);
    }
    return merged;
  }

  // ── internals ─────────────────────────────────────────────────

  private locationLabel(loc: ProviderPackageLocation): string {
    if (loc.kind === "filesystem" || loc.kind === "inline") return loc.rootDir;
    if (loc.kind === "remote") return loc.manifestUrl;
    return `${loc.registryUrl}/${loc.packageId}`;
  }

  private async resolvePackageDirs(loc: ProviderPackageLocation): Promise<string[]> {
    if (loc.kind === "registry" || loc.kind === "remote") {
      // Remote/registry packages are fetched as a single manifest URL, not a
      // directory scan. Return a synthetic dir handle the loader resolves.
      return [this.locationLabel(loc)];
    }
    // filesystem / inline: list immediate subdirs that contain a manifest.json.
    const entries = await this.listDir(loc.rootDir);
    const dirs: string[] = [];
    for (const entry of entries) {
      const candidate = `${loc.rootDir}/${entry}`;
      try {
        // A package dir contains manifest.json.
        this.read(`${candidate}/${PROVIDER_PACKAGE_FILES.manifest}`);
        dirs.push(candidate);
      } catch {
        // Not a package dir (or unreadable) — skip silently.
      }
    }
    return dirs;
  }

  private async discoverOne(dir: string, location: ProviderPackageLocation): Promise<DiscoveryOutcome> {
    try {
      const manifestRaw = this.read(`${dir}/${PROVIDER_PACKAGE_FILES.manifest}`);
      const manifest = validateManifestV2(this.parse(manifestRaw, "manifest.json"));

      const transports = this.tryRead<ProviderPackageTransport[]>(
        `${dir}/${PROVIDER_PACKAGE_FILES.transport}`,
        [],
      );
      const metadata = this.tryRead<ProviderPackageMetadata | undefined>(
        `${dir}/${PROVIDER_PACKAGE_FILES.metadata}`,
        undefined,
      );

      const provider: DiscoveredProvider = {
        id: manifest.id,
        kind: inferKind(manifest, location),
        location,
        packageDir: dir,
        manifest,
        transports,
        metadata,
      };
      return { status: "discovered", provider };
    } catch (e) {
      const pid = this.guessId(dir, location);
      const reason =
        e instanceof ManifestValidationError
          ? e.message
          : e instanceof SyntaxError
            ? `manifest JSON parse error: ${e.message}`
            : `discovery failed: ${(e as Error).message}`;
      return { status: "rejected", providerId: pid, location, reason };
    }
  }

  private parse(raw: unknown, file: string): unknown {
    if (typeof raw !== "string") {
      // Support async readers by rejecting here (caller handles safely).
      throw new Error(`${file} content unavailable`);
    }
    return JSON.parse(raw);
  }

  private tryRead<T>(path: string, fallback: T): T {
    try {
      return this.parse(this.read(path), path) as T;
    } catch {
      return fallback;
    }
  }

  private guessId(dir: string, loc: ProviderPackageLocation): string {
    const base = dir.split("/").pop() ?? this.locationLabel(loc);
    return base;
  }
}
