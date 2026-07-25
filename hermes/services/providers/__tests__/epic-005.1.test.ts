// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — EPIC-005.1 Validation Suite                   │
// │ PHASE 8 · 10 fail-closed scenarios + happy path                │
// │                                                               │
// │ Uses an INJECTED fake spawner — no real CLI binary, no         │
// │ network, no secrets. Proves the Universal Capability Platform   │
// │ end-to-end: discover → validate → authorize → load → execute   │
// │ → verify → audit, with every failure mode closing safely.      │
// └─────────────────────────────────────────────────────────────┘

import { describe, it, expect, beforeEach } from "vitest";
import { UniversalCapabilityPlatform } from "../platform.js";
import { CLAUDE_CODE_MANIFEST, claudeCodeFactory } from "../claude-code/index.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";
import type { ProcessSpawner, SpawnedProcess } from "../transport/cli.js";
import { MemoryCapabilityRegistry, type CapabilityRegistry } from "../capability.js";
import { isProviderError } from "../sdk.js";

// ── Fake spawner ────────────────────────────────────────────────────────────
type SpawnBehavior =
  | { kind: "ok"; stdout?: string }
  | { kind: "fail"; exitCode: number; stderr?: string }
  | { kind: "timeout" }
  | { kind: "error"; message: string }
  | { kind: "health-ok" };

function makeSpawner(behavior: SpawnBehavior): ProcessSpawner {
  return () => {
    const listeners: Record<string, (arg?: unknown) => void> = {};
    const proc: SpawnedProcess = {
      kill: () => {},
      stdout: { on: (_e: "data", cb: (d: string) => void) => void 0 },
      stderr: { on: (_e: "data", cb: (d: string) => void) => void 0 },
      on: (event: "error" | "close", cb: (arg: Error | number | null) => void) => {
        listeners[event] = cb as (arg?: unknown) => void;
        return proc;
      },
    };
    // Async trigger so the transport's promises can attach listeners first.
    queueMicrotask(() => {
      if (behavior.kind === "error") {
        listeners["error"]?.(new Error(behavior.message));
        return;
      }
      if (behavior.kind === "timeout") {
        // never emit close → transport's timer fires TIMEOUT
        return;
      }
      if (behavior.kind === "ok" || behavior.kind === "health-ok") {
        listeners["close"]?.(0);
        return;
      }
      if (behavior.kind === "fail") {
        listeners["close"]?.(behavior.exitCode);
        return;
      }
    });
    return proc;
  };
}

// Real in-memory registry so the gateway's policy gate (gate 2) can resolve
// capability membership the same way production does after bootstrap().
function freshRegistry(): CapabilityRegistry {
  return new MemoryCapabilityRegistry();
}

function buildPlatform(opts: {
  manifest?: ProviderManifestV2;
  authorize?: boolean;
  enforceSignatures?: boolean;
  spawnerBehavior?: SpawnBehavior;
}) {
  const manifest = opts.manifest ?? CLAUDE_CODE_MANIFEST;
  const spawner = makeSpawner(opts.spawnerBehavior ?? { kind: "ok", stdout: "done" });
  const registry = freshRegistry();
  const platform = new UniversalCapabilityPlatform(
    {
      trustedSigners: ["anthropic"],
      enforceSignatures: opts.enforceSignatures ?? false,
      authorize: () => opts.authorize ?? true,
    },
    registry,
  );
  platform.registerProvider({
    manifest,
    factory: (m, transports) => claudeCodeFactory(m, transports, spawner),
  });
  return { platform, registry };
}

// ── Tests ─────────────────────────────────────────────────────────────────────
describe("EPIC-005.1 — Universal Capability Platform", () => {
  let platform: UniversalCapabilityPlatform;

  beforeEach(() => {
    platform = buildPlatform({ authorize: true, spawnerBehavior: { kind: "ok", stdout: "ok" } }).platform;
  });

  it("SUCCESS: discover → load → execute → audit without Claude-specific core logic", async () => {
    const provider = await platform.bootstrap("claude-code");
    expect(provider).toBeDefined();
    expect(provider!.metadata().id).toBe("claude-code");
    expect(provider!.metadata().capabilities).toContain("dev.code.generate");

    const result = await platform.execute("claude-code", {
      invocationId: "inv-1",
      capabilityId: "dev.code.generate",
      implKey: "claude-code:generate",
      args: { prompt: "write a function" },
      timeoutMs: 5000,
    });
    expect(result.ok).toBe(true);
    const audit = platform.getAuditLog().map((e) => e.type);
    expect(audit).toContain("PROVIDER_DISCOVERED");
    expect(audit).toContain("PROVIDER_LOADED");
    expect(audit).toContain("EXECUTION_SUCCESS");
  });

  it("SCENARIO 1: Provider discovery fails (no wiring) → undefined, not crash", async () => {
    const p = await platform.bootstrap("does-not-exist");
    expect(p).toBeUndefined();
    expect(platform.marketplace.get("does-not-exist")).toBeUndefined();
  });

  it("SCENARIO 2: Manifest validation failure → REJECTED", async () => {
    const bad = { ...CLAUDE_CODE_MANIFEST, capabilities: [] } as unknown as ProviderManifestV2;
    const { platform: pf } = buildPlatform({ manifest: bad });
    const p = await pf.bootstrap("claude-code");
    expect(p).toBeUndefined();
    expect(pf.marketplace.get("claude-code")?.lifecycle).toBe("REJECTED");
  });

  it("SCENARIO 3: Authorization denied → REJECTED (fail-closed)", async () => {
    const { platform: pf } = buildPlatform({ authorize: false });
    const p = await pf.bootstrap("claude-code");
    expect(p).toBeUndefined();
    const entry = pf.marketplace.get("claude-code");
    expect(entry?.lifecycle).toBe("REJECTED");
    expect(entry?.trustLevel).toBe("untrusted");
  });

  it("SCENARIO 4: Cancellation — cancel emits audit, no crash", async () => {
    await platform.bootstrap("claude-code");
    await platform.cancel("claude-code", "inv-x");
    expect(platform.getAuditLog().some((e) => e.type === "EXECUTION_CANCELLED")).toBe(true);
  });

  it("SCENARIO 5: Timeout — transport returns TIMEOUT, provider normalizes to TIMEOUT error", async () => {
    const { platform: pf } = buildPlatform({ spawnerBehavior: { kind: "timeout" } });
    await pf.bootstrap("claude-code");
    const res = await pf.execute("claude-code", {
      invocationId: "inv-t",
      capabilityId: "dev.code.generate",
      implKey: "claude-code:generate",
      args: {},
      timeoutMs: 50,
    });
    expect(res.ok).toBe(false);
    expect(isProviderError(res) ? res.code : undefined).toBe("TIMEOUT");
  });

  it("SCENARIO 6: Health failure → SUSPENDED after repeated unhealthy probes", async () => {
    const { platform: pf } = buildPlatform({ spawnerBehavior: { kind: "fail", exitCode: 1 } });
    await pf.bootstrap("claude-code");
    for (let i = 0; i < 3; i++) await pf.probeHealth("claude-code");
    expect(pf.marketplace.get("claude-code")?.lifecycle).toBe("SUSPENDED");
  });

  it("SCENARIO 7: Unknown capability → policy gate denies (fail-closed)", async () => {
    await platform.bootstrap("claude-code");
    const res = await platform.execute("claude-code", {
      invocationId: "inv-u",
      capabilityId: "dev.code.nonexistent",
      implKey: "x",
      args: {},
      timeoutMs: 1000,
    });
    expect(res.ok).toBe(false);
    // EPIC-005.6: the single gateway boundary denies an unregistered
    // capability at the policy gate (was CAPABILITY_UNKNOWN under the old
    // guard-only path). The execution is still fail-closed.
    expect(isProviderError(res) ? res.code : undefined).toBe("policy-denied");
  });

  it("SCENARIO 8: Provider unavailable (not loaded) → PROVIDER_UNAVAILABLE", async () => {
    const res = await platform.execute("claude-code", {
      invocationId: "inv-na",
      capabilityId: "dev.code.generate",
      implKey: "claude-code:generate",
      args: {},
      timeoutMs: 1000,
    });
    expect(res.ok).toBe(false);
    expect(isProviderError(res) ? res.code : undefined).toBe("PROVIDER_UNAVAILABLE");
  });

  it("SCENARIO 9: Transport failure → TRANSPORT_FAILED normalized error", async () => {
    const { platform: pf } = buildPlatform({ spawnerBehavior: { kind: "error", message: "boom" } });
    await pf.bootstrap("claude-code");
    const res = await pf.execute("claude-code", {
      invocationId: "inv-e",
      capabilityId: "dev.code.generate",
      implKey: "claude-code:generate",
      args: {},
      timeoutMs: 1000,
    });
    expect(res.ok).toBe(false);
    expect(isProviderError(res) ? res.code : undefined).toBe("TRANSPORT_FAILED");
  });

  it("SCENARIO 10: Signature enforcement (trust.level=sandbox) rejects untrusted signer", async () => {
    const signedManifest = {
      ...CLAUDE_CODE_MANIFEST,
      trust: {
        ...CLAUDE_CODE_MANIFEST.trust,
        level: "trusted" as const,
        signature: {
          algorithm: "sha256" as const,
          checksum: "abc",
          signer: "evil-corp",
        },
      },
    };
    const { platform: pf } = buildPlatform({ manifest: signedManifest, enforceSignatures: true });
    const p = await pf.bootstrap("claude-code");
    expect(p).toBeUndefined();
    expect(pf.marketplace.get("claude-code")?.lifecycle).toBe("REJECTED");
  });

  it("Marketplace: provider auto-appears with capabilities once loaded", async () => {
    await platform.bootstrap("claude-code");
    const entries = platform.marketplace.list({ capability: "dev.code.generate" });
    expect(entries.length).toBe(1);
    expect(entries[0].id).toBe("claude-code");
    expect(entries[0].transports).toContain("cli");
  });
});
