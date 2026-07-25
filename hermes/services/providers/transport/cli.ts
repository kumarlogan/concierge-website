// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — CLI Transport                               │
// │ EPIC-005.1 · PHASE 3                                           │
// │                                                               │
// │ Hermes-OWNED transport. The transport knows NOTHING about     │
// │ capability semantics — it only launches a process, sends an   │
// │ opaque payload, captures stdout/stderr, enforces timeout,     │
// │ supports cancellation + retries + health probes.              │
// │                                                               │
// │ Reusable for ANY CLI backend: Claude Code, GitHub CLI,        │
// │ Terraform, Docker, Codex, Gemini CLI, ... — no Claude logic.  │
// │                                                               │
// │ This module is ZERO-dependency and node-free: process spawning│
// │ is injected via `ProcessSpawner`, so it is fully testable with│
// │ a fake spawner (see PHASE 8) and runs in any JS runtime that  │
// │ supplies a spawner.                                           │
// └─────────────────────────────────────────────────────────────┘

import type {
  Transport,
  TransportKind,
  TransportConnectionState,
  TransportFailureClass,
  TransportHealth,
  InvocationEnvelope,
  TransportResult,
} from "../transport.js";
import type { HealthStatus } from "../sdk.js";

/** Minimal process abstraction the transport depends on (injected). */
export interface SpawnedProcess {
  kill(signal?: string): void;
  stdout: AsyncIterable<string> | { on(event: "data", cb: (d: string) => void): void };
  stderr: { on(event: "data", cb: (d: string) => void): void };
  on(event: "error", cb: (err: Error) => void): void;
  on(event: "close", cb: (code: number | null) => void): void;
}

/** A function that spawns a child process. Injected — typically node child_process. */
export type ProcessSpawner = (command: string, args: string[], opts: SpawnOptions) => SpawnedProcess;

export interface SpawnOptions {
  cwd?: string;
  env?: Record<string, string>;
  /** Capture stdin as a writable sink. */
  stdin?: boolean;
}

export interface CliTransportOptions {
  /** Binary name / path to spawn (e.g. "claude", "gh"). */
  command: string;
  /** Extra argv always passed before the payload args. */
  baseArgs?: string[];
  /** Default invocation timeout (ms) when envelope omits one. */
  defaultTimeoutMs?: number;
  /** Max retries on transport-level failure (default 0). */
  maxRetries?: number;
  /** Environment to merge into the child process (non-secret only). */
  env?: Record<string, string>;
  /** Working directory for the child. */
  cwd?: string;
  /** Health probe: run these argv and expect exit 0. */
  healthProbeArgs?: string[];
  /** Injected process spawner (Hermes-owned; in Node it wraps child_process). */
  spawner: ProcessSpawner;
}

/**
 * CLI transport: wraps a local binary as a Transport.
 * Payload is serialized to JSON and passed via `--payload <json>`.
 * The transport never interprets payload semantics.
 */
export class CliTransport implements Transport {
  readonly kind: TransportKind = "cli";
  private readonly opts: Required<Pick<CliTransportOptions, "defaultTimeoutMs" | "maxRetries">> &
    CliTransportOptions;
  private connected = false;
  private connState: TransportConnectionState = "disconnected";
  private readonly inflight = new Map<string, SpawnedProcess>();
  /** Stable instance id for audit correlation (e.g. cli:claude). */
  private readonly instanceId: string;

  constructor(opts: CliTransportOptions) {
    this.opts = { defaultTimeoutMs: 120_000, maxRetries: 0, ...opts };
    this.instanceId = `cli:${this.opts.command}`;
  }

  /** Stable transport instance id. */
  id(): string {
    return this.instanceId;
  }

  async connect(): Promise<void> {
    this.connected = true; // idempotent; spawn happens per-invoke
    this.connState = "connected";
  }

  connectionState(): TransportConnectionState {
    return this.connState;
  }

  async close(): Promise<void> {
    for (const child of this.inflight.values()) child.kill("SIGKILL");
    this.inflight.clear();
    this.connected = false;
    this.connState = "disconnected";
  }

  /** Serialize the opaque envelope payload for the CLI. */
  private serialize(env: InvocationEnvelope): string {
    return JSON.stringify({ implKey: env.implKey, args: env.payload });
  }

  async invoke(envelope: InvocationEnvelope): Promise<TransportResult> {
    if (!this.connected) await this.connect();
    const timeoutMs = envelope.timeoutMs || this.opts.defaultTimeoutMs;
    const started = Date.now();

    const maxAttempts = 1 + this.opts.maxRetries;
    let attempt = 0;
    let lastErr: string | undefined;
    let lastCode: TransportFailureClass = "TRANSPORT_FAILED";

    while (attempt < maxAttempts) {
      attempt++;
      const res = await this.runOnce(envelope, timeoutMs);
      if (res.ok) return res;
      lastErr = res.error;
      lastCode = (res.code as TransportFailureClass) ?? "TRANSPORT_FAILED";
      // Retry only on transport-level failure (not capability errors).
      if (lastCode === "TIMEOUT" || lastCode === "TRANSPORT_FAILED") continue;
      return res;
    }

    return {
      ok: false,
      error: lastErr ?? "TRANSPORT_FAILED",
      code: lastCode,
      backend: envelope.providerId,
      durationMs: Date.now() - started,
      transportKind: this.kind,
      connectionState: this.connState,
    };
  }

  private runOnce(envelope: InvocationEnvelope, timeoutMs: number): Promise<TransportResult> {
    return new Promise((resolve) => {
      const started = Date.now();
      const args = [...(this.opts.baseArgs ?? []), "--payload", this.serialize(envelope)];
      let child: SpawnedProcess;
      try {
        child = this.opts.spawner(this.opts.command, args, {
          cwd: this.opts.cwd,
          env: this.opts.env,
        });
      } catch (e) {
        resolve({
          ok: false,
          error: `spawn failed: ${(e as Error).message}`,
          code: "TRANSPORT_FAILED",
          backend: envelope.providerId,
          durationMs: Date.now() - started,
        });
        return;
      }

      this.inflight.set(envelope.invocationId, child);

      let stdout = "";
      let stderr = "";
      let settled = false;

      const isAsyncIter = typeof (child.stdout as { [Symbol.asyncIterator]?: unknown })[
        Symbol.asyncIterator
      ] === "function";
      const consume = (chunk: string) => {
        stdout += chunk;
      };
      if (isAsyncIter) {
        void (async () => {
          for await (const chunk of child.stdout as AsyncIterable<string>) consume(chunk);
        })();
      } else {
        (child.stdout as { on(e: "data", cb: (d: string) => void): void }).on("data", consume);
      }
      child.stderr.on("data", (d: string) => (stderr += d));

      const t = setTimeout(() => {
        if (settled) return;
        settled = true;
        child.kill("SIGKILL");
        this.inflight.delete(envelope.invocationId);
        this.connState = "degraded";
        resolve({
          ok: false,
          error: `timeout after ${timeoutMs}ms`,
          code: "TIMEOUT",
          backend: envelope.providerId,
          durationMs: Date.now() - started,
          transportKind: this.kind,
          connectionState: this.connState,
        });
      }, timeoutMs);

      child.on("error", (err: Error) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        this.inflight.delete(envelope.invocationId);
        this.connState = "failed";
        resolve({
          ok: false,
          error: `process error: ${err.message}`,
          code: "TRANSPORT_FAILED",
          backend: envelope.providerId,
          durationMs: Date.now() - started,
          transportKind: this.kind,
          connectionState: this.connState,
        });
      });

      child.on("close", (code: number | null) => {
        if (settled) return;
        settled = true;
        clearTimeout(t);
        this.inflight.delete(envelope.invocationId);
        const durationMs = Date.now() - started;
        if (code === 0) {
          this.connState = "connected";
          resolve({
            ok: true,
            data: stdout.trim(),
            backend: envelope.providerId,
            durationMs,
            transportKind: this.kind,
            connectionState: this.connState,
          });
        } else {
          this.connState = "degraded";
          resolve({
            ok: false,
            error: `exit ${code}: ${stderr.trim() || stdout.trim() || "(no output)"}`,
            code: "PROCESS_NONZERO",
            backend: envelope.providerId,
            durationMs,
            transportKind: this.kind,
            connectionState: this.connState,
          });
        }
      });
    });
  }

  async cancel(invocationId: string): Promise<void> {
    const child = this.inflight.get(invocationId);
    if (child) {
      child.kill("SIGTERM");
      this.inflight.delete(invocationId);
      if (this.inflight.size === 0) this.connState = "connected";
    }
  }

  async health(): Promise<TransportHealth> {
    const base: Omit<TransportHealth, "status"> = {
      kind: this.kind,
      id: this.instanceId,
      connectionState: this.connState,
    };
    if (!this.opts.healthProbeArgs) {
      return { ...base, status: "unknown", detail: "no healthProbeArgs configured" };
    }
    return new Promise<TransportHealth>((resolve) => {
      const child = this.opts.spawner(this.opts.command, this.opts.healthProbeArgs ?? [], {
        cwd: this.opts.cwd,
        env: this.opts.env,
      });
      const t = setTimeout(() => {
        child.kill("SIGKILL");
        resolve({ ...base, status: "unhealthy", detail: "health probe timed out" });
      }, 10_000);
      child.on("error", () => {
        clearTimeout(t);
        resolve({ ...base, status: "unhealthy", detail: "health probe spawn error" });
      });
      child.on("close", (code: number | null) => {
        clearTimeout(t);
        resolve({
          ...base,
          status: code === 0 ? "healthy" : "unhealthy",
          lastProbeAt: Date.now(),
          detail: code === 0 ? "probe ok" : `probe exited ${code}`,
        });
      });
    });
  }
}
