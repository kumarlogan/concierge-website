// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Claude Code Provider                         │
// │ EPIC-005.1 · PHASE 4 + 5                                        │
// │                                                               │
// │ The FIRST real provider. It proves the Universal Capability    │
// │ Platform: it implements ONLY the generic Provider SDK, uses a  │
// │ generic Transport, and maps intention ids → CLI invocation.    │
// │                                                              
// │ It contains NO policy, NO audit, NO workflow, NO approvals.    │
// │ Those are Hermes-owned and live elsewhere.                      │
// │                                                              
// │ Claude must remain replaceable: swapping this provider for any │
// │ other is a manifest+factory change, not a core change.         │
// └─────────────────────────────────────────────────────────────┘

import type {
  Provider,
  ProviderRequest,
  ProviderOutcome,
  ProviderMetadata,
  ProviderResult,
  ProviderError,
  HealthStatus,
} from "../sdk.js";
import { okResult, errResult } from "../sdk.js";
import type { Transport } from "../transport.js";
import type { ProviderManifestV2 } from "../manifest-v2.js";

/** Intention id → CLI subcommand + capability prompt template. */
interface CapabilitySpec {
  /** CLI subcommand passed to the binary (e.g. "generate"). */
  subcommand: string;
  /** Human-readable intent passed through to the backend. */
  intent: string;
}

/**
 * The capability map is DATA, not logic. Adding a capability = add a row.
 * These are intention ids from the Capability Model — never vendor names.
 */
export const CLAUDE_CODE_CAPABILITIES: Record<string, CapabilitySpec> = {
  "dev.code.generate": { subcommand: "generate", intent: "Generate code for the given task." },
  "dev.code.review": { subcommand: "review", intent: "Review the provided code for issues." },
  "dev.code.refactor": { subcommand: "refactor", intent: "Refactor the provided code." },
  "dev.code.explain": { subcommand: "explain", intent: "Explain the provided code." },
  "dev.code.fix": { subcommand: "fix", intent: "Fix the reported issue in the code." },
};

/** Build the args passed to the CLI for a given capability + request. */
function buildArgs(req: ProviderRequest): string[] {
  const spec = CLAUDE_CODE_CAPABILITIES[req.capabilityId];
  const parts: string[] = [spec.subcommand, "--intent", spec.intent];
  if (req.args.code !== undefined) parts.push("--code", String(req.args.code));
  if (req.args.prompt !== undefined) parts.push("--prompt", String(req.args.prompt));
  if (req.args.path !== undefined) parts.push("--path", String(req.args.path));
  return parts;
}

/**
 * Claude Code Provider — a concrete, reusable implementation of the
 * universal Provider SDK backed by a CLI Transport.
 */
export class ClaudeCodeProvider implements Provider {
  private readonly manifest: ProviderManifestV2;
  private readonly transport: Transport;
  private initialized = false;

  constructor(manifest: ProviderManifestV2, transport: Transport) {
    this.manifest = manifest;
    this.transport = transport;
  }

  async initialize(): Promise<void> {
    await this.transport.connect();
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    await this.transport.close();
    this.initialized = false;
  }

  version(): string {
    return this.manifest.version;
  }

  metadata(): ProviderMetadata {
    return {
      id: this.manifest.id,
      vendor: this.manifest.vendor,
      version: this.manifest.version,
      capabilities: Object.keys(CLAUDE_CODE_CAPABILITIES),
      trustLevel: this.manifest.trust.level,
    };
  }

  async capabilities(): Promise<string[]> {
    return Object.keys(CLAUDE_CODE_CAPABILITIES);
  }

  async health(): Promise<HealthStatus> {
    const th = await this.transport.health();
    return th.status;
  }

  async cancel(invocationId: string): Promise<void> {
    if (this.transport.cancel) await this.transport.cancel(invocationId);
  }

  async execute(req: ProviderRequest): Promise<ProviderOutcome> {
    if (!this.initialized) await this.initialize();

    // Unknown capability → structured error, NOT a crash.
    const spec = CLAUDE_CODE_CAPABILITIES[req.capabilityId];
    if (!spec) {
      return errResult(
        this.manifest.id,
        "CAPABILITY_UNKNOWN",
        `provider "${this.manifest.id}" does not implement "${req.capabilityId}"`,
        Date.now(),
      );
    }

    const args = buildArgs(req);
    const started = Date.now();
    const result = await this.transport.invoke({
      invocationId: req.invocationId,
      providerId: this.manifest.id,
      implKey: req.implKey,
      payload: { subcommand: spec.subcommand, args },
      timeoutMs: req.timeoutMs,
      transportKind: this.transport.kind,
    });

    const durationMs = Date.now() - started;

    if (result.ok) {
      const ok: ProviderResult = okResult(
        this.manifest.id,
        { output: result.data },
        durationMs,
        { transport: this.transport.kind },
      );
      return ok;
    }

    // Translate transport failure into a structured provider error.
    const code =
      result.code === "TIMEOUT"
        ? "TIMEOUT"
        : result.code === "PROCESS_NONZERO"
          ? "EXECUTION_FAILED"
          : "TRANSPORT_FAILED";
    const err: ProviderError = errResult(
      this.manifest.id,
      code,
      result.error ?? "unknown transport failure",
      durationMs,
    );
    return err;
  }
}
