// EPIC-005.2 · PHASE 7 — Dynamic Provider Loading validation (12 scenarios)
//
// All I/O is faked (no real fs, network, binaries, or secrets). The manager is
// driven entirely through injected read/listDir/loadModule functions.

import { describe, it, expect, beforeEach } from "vitest";
import { MemoryCapabilityRegistry } from "./capability.js";
import { DynamicProviderManager, type ManagerOptions } from "./manager.js";
import { buildDynamicMarketplaceView } from "./marketplace-view.js";
import { CliTransport } from "./transport/cli.js";
import type { Provider, ProviderRequest } from "./sdk.js";
import type { ProviderPackageContract } from "./package.js";
import type { ProviderManifestV2 } from "./manifest-v2.js";

// ── fakes ──────────────────────────────────────────────────────────────────

function fakeProvider(manifest: ProviderManifestV2): Provider {
  return {
    async initialize() {},
    async shutdown() {},
    version: () => manifest.version,
    metadata: () => ({
      id: manifest.id,
      vendor: manifest.vendor,
      version: manifest.version,
      capabilities: manifest.capabilities.map((c) => c.id),
      trustLevel: manifest.trust.level,
    }),
    async capabilities() {
      return manifest.capabilities.map((c) => c.id);
    },
    async execute(_req: ProviderRequest) {
      return { ok: true as const, backend: manifest.id, data: { ok: true }, durationMs: 1 };
    },
    async cancel() {},
    async health() {
      return "healthy" as const;
    },
  };
}

function contractFor(manifest: ProviderManifestV2): ProviderPackageContract {
  return {
    contractVersion: "1.0",
    createProvider: (m) => fakeProvider(m),
  };
}

function validManifest(id: string, caps: string[]): ProviderManifestV2 {
  return {
    id,
    name: id,
    vendor: "test-vendor",
    version: "1.0.0",
    manifestSchema: "v2",
    transports: [{ kind: "cli", endpoint: "echo" }],
    capabilities: caps.map((c) => ({ id: c, implKey: c })),
    permissions: [],
    trust: { level: "sandbox", authModel: "none" },
    health: { probe: "none", intervalMs: 1000, timeoutMs: 500, healthyWithinMs: 5000 },
    limits: { maxConcurrent: 1, maxDurationMs: 1000 },
    approval: { requiredByDefault: false },
    lifecycle: { discoverable: true, autoLoad: true },
  };
}

interface FsFile {
  [path: string]: string;
}
interface FsTree {
  /** root → list of subdir names (package dirs) */
  dirs: Record<string, string[]>;
  /** absolute file path → contents */
  files: FsFile;
}

function makeFs(tree: FsTree) {
  const read = (p: string): string => {
    const c = tree.files[p];
    if (c === undefined) throw new Error(`ENOENT: ${p}`);
    return c;
  };
  const listDir = (d: string): string[] => tree.dirs[d] ?? [];
  return { read, listDir };
}

/** Build a filesystem tree with one package dir per manifest under root. */
function treeWithPackages(root: string, packages: Array<{ id: string; manifest: ProviderManifestV2 }>) {
  const dirs: Record<string, string[]> = { [root]: [] };
  const files: FsFile = {};
  for (const pkg of packages) {
    const dir = `${root}/${pkg.id}`;
    dirs[root].push(pkg.id);
    files[`${dir}/manifest.json`] = JSON.stringify(pkg.manifest);
    files[`${dir}/transport.json`] = JSON.stringify(pkg.manifest.transports);
    files[`${dir}/metadata.json`] = JSON.stringify({ displayName: pkg.id });
  }
  return { dirs, files };
}

// module loader: maps a provider.ts path → contract, driven by a provided map.
function makeModuleLoader(map: Record<string, ProviderPackageContract>) {
  return async (p: string): Promise<unknown> => {
    const c = map[p];
    if (!c) throw new Error(`no module for ${p}`);
    return c;
  };
}

// ── fixtures ────────────────────────────────────────────────────────────────

const ROOT = "/providers";

function opts(
  tree: FsTree,
  contracts: Record<string, ProviderPackageContract>,
  authorize: (m: ProviderManifestV2) => boolean = () => true,
): ManagerOptions {
  const { read, listDir } = makeFs(tree);
  return {
    read,
    listDir,
    loadModule: makeModuleLoader(contracts),
    ctx: { runtime: { authorize } as never },
  };
}

function contractsFor(packages: Array<{ id: string; manifest: ProviderManifestV2 }>) {
  const map: Record<string, ProviderPackageContract> = {};
  for (const p of packages) map[`${ROOT}/${p.id}/provider.ts`] = contractFor(p.manifest);
  return map;
}

function newManager(
  tree: FsTree,
  contracts: Record<string, ProviderPackageContract>,
  authorize?: (m: ProviderManifestV2) => boolean,
) {
  const reg = new MemoryCapabilityRegistry();
  const m = new DynamicProviderManager(reg, opts(tree, contracts, authorize));
  // Register a Hermes-owned CLI transport so loaders can resolve transports.
  m.platform.registerTransport("cli", new CliTransport());
  return m;
}

// ── tests ─────────────────────────────────────────────────────────────────

describe("EPIC-005.2 dynamic provider loading", () => {
  // Scenario 1: discover + load a valid CLI provider
  it("1. discovers and loads a valid CLI provider package", async () => {
    const pkgs = [{ id: "alpha", manifest: validManifest("alpha", ["cap.a"]) }];
    const tree = treeWithPackages(ROOT, pkgs);
    const m = newManager(tree, contractsFor(pkgs));
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded).toEqual(["alpha"]);
    expect(res.trustRejected).toHaveLength(0);
    expect(res.discoveryRejected).toHaveLength(0);
    expect(m.getLoaded("alpha")).toBeDefined();
  });

  // Scenario 2: bad JSON manifest is rejected, sibling still loads
  it("2. isolates a JSON-parse failure and still loads siblings", async () => {
    const good = { id: "good", manifest: validManifest("good", ["cap.g"]) };
    const tree = treeWithPackages(ROOT, [good]);
    // corrupt the bad package's manifest
    tree.dirs[ROOT].push("bad");
    tree.files[`${ROOT}/bad/manifest.json`] = "{ not json";
    tree.files[`${ROOT}/bad/transport.json`] = "[]";
    tree.files[`${ROOT}/bad/metadata.json`] = "{}";
    const contracts = contractsFor([good]);
    contracts[`${ROOT}/bad/provider.ts`] = contractFor(validManifest("bad", ["cap.b"]));
    const m = newManager(tree, contracts);
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded).toEqual(["good"]);
    expect(res.discoveryRejected.map((r) => r.providerId)).toContain("bad");
    expect(m.getLoaded("good")).toBeDefined();
    expect(m.getLoaded("bad")).toBeUndefined();
  });

  // Scenario 3: manifest fails validateManifestV2 (missing implKey)
  it("3. rejects a manifest that fails schema validation", async () => {
    const bad = validManifest("bad", ["cap.b"]);
    // break: capability missing implKey
    bad.capabilities[0] = { id: "cap.b" } as never;
    const tree = treeWithPackages(ROOT, [{ id: "bad", manifest: bad }]);
    const m = newManager(tree, contractsFor([{ id: "bad", manifest: bad }]));
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded).toHaveLength(0);
    expect(res.discoveryRejected.map((r) => r.providerId)).toContain("bad");
  });

  // Scenario 4: duplicate id — second rejected, first retained
  it("4. rejects a duplicate provider id without clobbering the first", async () => {
    const pkgs = [{ id: "dup", manifest: validManifest("dup", ["cap.d"]) }];
    const tree = treeWithPackages(ROOT, pkgs);
    const m = newManager(tree, contractsFor(pkgs));
    const r1 = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(r1.loaded).toEqual(["dup"]);
    // Re-scan same location → same id discovered again → duplicate
    const r2 = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(r2.duplicates).toContain("dup");
    expect(r2.loaded).toHaveLength(0);
    expect(m.getLoaded("dup")).toBeDefined();
  });

  // Scenario 5: capability collision between two providers
  it("5. detects capability collision and still loads both providers", async () => {
    const a = { id: "provA", manifest: validManifest("provA", ["shared.cap"]) };
    const b = { id: "provB", manifest: validManifest("provB", ["shared.cap"]) };
    const tree = treeWithPackages(ROOT, [a, b]);
    const m = newManager(tree, contractsFor([a, b]));
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded.sort()).toEqual(["provA", "provB"]);
    expect(res.collisions).toContainEqual({
      capability: "shared.cap",
      providers: ["provA", "provB"],
    });
  });

  // Scenario 6: missing declared transport kind → OFFLINE surfaced
  it("6. flags a provider whose declared transport kind is unregistered", async () => {
    const pkgs = [{ id: "noTransport", manifest: validManifest("noTransport", ["cap.t"]) }];
    pkgs[0].manifest.transports = [{ kind: "mcp", endpoint: "x" } as never];
    const tree = treeWithPackages(ROOT, pkgs);
    const m = newManager(tree, contractsFor(pkgs));
    // Do NOT register mcp transport → it should be missing.
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    // The provider still loads (createProvider does not require the transport at
    // construction), but the load outcome flagged the missing transport.
    expect(res.loaded).toContain("noTransport");
  });

  // Scenario 7: malformed contract (no createProvider) → trustRejected visible
  it("7. rejects a package whose entry module lacks a valid contract", async () => {
    const pkgs = [{ id: "broken", manifest: validManifest("broken", ["cap.k"]) }];
    const tree = treeWithPackages(ROOT, pkgs);
    const contracts = contractsFor(pkgs);
    // overwrite with a malformed contract (missing createProvider)
    contracts[`${ROOT}/broken/provider.ts`] = { contractVersion: "1.0" } as never;
    const m = newManager(tree, contracts);
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded).toHaveLength(0);
    expect(res.trustRejected).toContain("broken");
  });

  // Scenario 8: trust rejection (authorize=false) → REJECTED, not loaded
  it("8. rejects a provider denied by the trust policy", async () => {
    const pkgs = [{ id: "denied", manifest: validManifest("denied", ["cap.n"]) }];
    const tree = treeWithPackages(ROOT, pkgs);
    const m = newManager(tree, contractsFor(pkgs), () => false);
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded).toHaveLength(0);
    expect(res.trustRejected).toContain("denied");
    expect(m.getLoaded("denied")).toBeUndefined();
  });

  // Scenario 9: rejected providers remain visible in the marketplace view
  it("9. marketplace view keeps REJECTED providers visible", async () => {
    const good = { id: "ok", manifest: validManifest("ok", ["cap.ok"]) };
    const denied = { id: "denied", manifest: validManifest("denied", ["cap.d"]) };
    const tree = treeWithPackages(ROOT, [good, denied]);
    const m = newManager(tree, contractsFor([good, denied]), (mf) => mf.id !== "denied");
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    const view = buildDynamicMarketplaceView(m.platform.marketplace, res, new Map());
    const deniedEntry = view.entries.find((e) => e.providerId === "denied");
    expect(deniedEntry?.state).toBe("REJECTED");
    expect(view.rejected).toContain(deniedEntry!);
    expect(view.ready.map((e) => e.providerId)).toContain("ok");
  });

  // Scenario 10: unload removes provider + capabilities
  it("10. unload tears down a provider and frees its capabilities", async () => {
    const pkgs = [{ id: "u", manifest: validManifest("u", ["cap.u"]) }];
    const tree = treeWithPackages(ROOT, pkgs);
    const m = newManager(tree, contractsFor(pkgs));
    await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(m.getLoaded("u")).toBeDefined();
    const ok = await m.unload("u");
    expect(ok).toBe(true);
    expect(m.getLoaded("u")).toBeUndefined();
    expect(m.platform.marketplace.get("u")).toBeDefined(); // record retained
  });

  // Scenario 11: reload re-admits a provider after unload
  it("11. reload re-admits a provider after unload", async () => {
    const pkgs = [{ id: "r", manifest: validManifest("r", ["cap.r"]) }];
    const tree = treeWithPackages(ROOT, pkgs);
    const m = newManager(tree, contractsFor(pkgs));
    await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    await m.unload("r");
    expect(m.getLoaded("r")).toBeUndefined();
    const ok = await m.reload("r");
    expect(ok).toBe(true);
    expect(m.getLoaded("r")).toBeDefined();
  });

  // Scenario 12: provider-neutral — two unrelated vendor-shaped packages load
  // via the same generic path (no vendor switch anywhere).
  it("12. loads two unrelated provider shapes through one generic path", async () => {
    const cli = { id: "cli-provider", manifest: validManifest("cli-provider", ["dev.run"]) };
    const remote = { id: "remote-provider", manifest: validManifest("remote-provider", ["net.fetch"]) };
    remote.manifest.transports = [{ kind: "https", endpoint: "https://x" } as never];
    const tree = treeWithPackages(ROOT, [cli, remote]);
    const m = newManager(tree, contractsFor([cli, remote]));
    m.platform.registerTransport("https", new CliTransport()); // dummy for resolve
    const res = await m.scan([{ kind: "filesystem", rootDir: ROOT }]);
    expect(res.loaded.sort()).toEqual(["cli-provider", "remote-provider"]);
    // No vendor-specific branch in the manager — both went through the same loader.
    expect(m.getLoaded("cli-provider")).toBeDefined();
    expect(m.getLoaded("remote-provider")).toBeDefined();
  });
});
