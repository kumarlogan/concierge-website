// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Claude Code Provider Wiring                   │
// │ EPIC-005.1 · PHASE 4 + 5 (data + factory)                       │
// │                                                               │
// │ This file is the ONLY Claude-specific data. It is a manifest   │
// │ (data) + a factory (builds a generic provider). Adding another │
// │ provider = copy this shape and change strings. No core edits.  │
// └─────────────────────────────────────────────────────────────┘

import { CliTransport, type ProcessSpawner } from "../transport/cli.js";
import { ClaudeCodeProvider } from "./provider.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";
import type { Provider } from "../sdk.js";
import type { TransportRegistry } from "../transport.js";

/** Manifest V2 for the Claude Code CLI provider (pure data). */
export const CLAUDE_CODE_MANIFEST: ProviderManifestV2 = {
  id: "claude-code",
  name: "Claude Code CLI",
  vendor: "anthropic",
  version: "1.0.0",
  manifestSchema: "v2",

  transports: [{ kind: "cli", endpoint: "claude", auth: "none" }],
  capabilities: [
    { id: "dev.code.generate", implKey: "claude-code:generate" },
    { id: "dev.code.review", implKey: "claude-code:review" },
    { id: "dev.code.refactor", implKey: "claude-code:refactor" },
    { id: "dev.code.explain", implKey: "claude-code:explain" },
    { id: "dev.code.fix", implKey: "claude-code:fix" },
  ],
  permissions: [
    { capability: "dev.code.generate", scope: "repo:local", grantedBy: "manifest" },
    { capability: "dev.code.review", scope: "repo:local", grantedBy: "manifest" },
    { capability: "dev.code.refactor", scope: "repo:local", grantedBy: "manifest" },
    { capability: "dev.code.explain", scope: "repo:local", grantedBy: "manifest" },
    { capability: "dev.code.fix", scope: "repo:local", grantedBy: "manifest" },
  ],

  trust: {
    level: "sandbox",
    authModel: "none",
    sandboxPolicy: { isolation: "process", filesystem: "rw", network: "egress-only" },
  },

  health: {
    probe: "command",
    endpoint: "claude --version",
    intervalMs: 60_000,
    timeoutMs: 10_000,
    healthyWithinMs: 5_000,
  },

  limits: {
    maxConcurrent: 4,
    maxDurationMs: 600_000,
    memoryMb: 2048,
    networkEgress: "egress-only",
  },

  approval: { requiredByDefault: false, humanInLoop: false },

  lifecycle: {
    discoverable: true,
    autoLoad: true,
    preferredFor: ["dev.code.generate", "dev.code.review", "dev.code.refactor"],
  },

  features: { streaming: false, cancel: true, idempotency: false, retry: true },
};

/**
 * Factory: builds a ClaudeCodeProvider from its manifest + a transport.
 * The transport is resolved from the registry by kind — so the factory is
 * itself provider-neutral (any future provider uses the same pattern).
 */
export function claudeCodeFactory(
  manifest: ProviderManifestV2,
  transports: TransportRegistry,
  spawner?: ProcessSpawner,
): Provider {
  const cli = transports.resolve({ kind: "cli", endpoint: manifest.transports[0]?.endpoint });
  if (!cli) {
    // Fall back to a CLI transport built from the injected spawner (Node side).
    if (!spawner) throw new Error("no cli transport registered and no spawner provided");
    const transport = new CliTransport({
      command: manifest.transports[0]?.endpoint ?? "claude",
      baseArgs: [],
      healthProbeArgs: ["--version"],
      spawner,
    });
    return new ClaudeCodeProvider(manifest, transport);
  }
  return new ClaudeCodeProvider(manifest, cli);
}
