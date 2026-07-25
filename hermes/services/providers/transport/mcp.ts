// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — MCP Transport Boundary (EPIC-005.3 PHASE 5) │
// │                                                           │
// │ Contract-only boundary for the Model Context Protocol        │
// │ transport kind. This file defines the AUTH BOUNDARY, the    │
// │ capability-discovery surface, timeout policy, and health    │
// │ contract that any future MCP client must satisfy.           │
// │                                                           │
// │ NO vendor MCP SDK is imported or implemented here. The      │
// │ `McpTransportBoundary` class is a NON-OPERATIONAL placeholder│
// │ that FAILS CLOSED: every invocation resolves to an         │
// │ `AUTH_REQUIRED` / `UNKNOWN` error until a real, registered │
// │ MCP client adapter is supplied. This keeps the abstraction  │
// │ open and provider-neutral without leaking any implementation.│
// └─────────────────────────────────────────────────────────────┘

import type {
  Transport,
  TransportKind,
  TransportConnectionState,
  TransportFailureClass,
  InvocationEnvelope,
  TransportResult,
  TransportHealth,
} from "../transport.js";

/** A single capability a remote MCP server exposes over the boundary. */
export interface McpCapabilityDescriptor {
  /** Stable capability id as advertised by the MCP server. */
  id: string;
  /** Human label. */
  name: string;
  /** Opaque schema reference (never parsed by Hermes). */
  schemaRef?: string;
}

/**
 * The MCP AUTH BOUNDARY — the ONLY place an MCP transport may express
 * authentication. Hermes enforces this before any invocation; an unsatisfied
 * boundary ⇒ the transport must return `AUTH_REQUIRED` and Hermes denies.
 */
export interface McpAuthBoundary {
  /** Required scheme the MCP server expects (data, not a code branch). */
  scheme: "none" | "token" | "oauth2" | "mtls";
  /** Where the credential is sourced from (NEVER inline in a manifest). */
  secretRef?: string;
  /** Token refresh endpoint (optional). */
  refreshEndpoint?: string;
}

/** Configuration the Hermes-owned MCP boundary requires from a manifest. */
export interface McpTransportConfig {
  /** Endpoint URL of the MCP server (data only). */
  endpoint: string;
  /** Auth boundary that must be satisfied before connect. */
  auth: McpAuthBoundary;
  /** Per-invocation timeout policy (ms). */
  timeoutMs: number;
  /** Whether capability discovery is required before invocation. */
  requireDiscovery: boolean;
}

/**
 * Contract a real MCP client adapter must satisfy. Defined here so the
 * boundary is unambiguous; the reference adapter is implemented elsewhere
 * (future phase) and registered into the TransportRegistry under "mcp".
 */
export interface McpClientAdapter {
  discover(): Promise<McpCapabilityDescriptor[]>;
  invoke(descriptorId: string, payload: unknown, timeoutMs: number): Promise<TransportResult>;
  health(): Promise<TransportHealth>;
  close(): Promise<void>;
}

/**
 * Placeholder MCP transport. Fails closed: it advertises `kind:"mcp"` but
 * refuses to carry real invocations until a real `McpClientAdapter` is
 * injected via `withAdapter`. This guarantees no silent "works by accident"
 * path and no vendor code in the boundary.
 */
export class McpTransportBoundary implements Transport {
  readonly kind: TransportKind = "mcp";
  private adapter: McpClientAdapter | undefined;
  private connState: TransportConnectionState = "disconnected";
  private readonly config: McpTransportConfig;

  constructor(config: McpTransportConfig) {
    this.config = config;
  }

  /** Attach a real, Hermes-owned MCP client adapter (registered separately). */
  withAdapter(adapter: McpClientAdapter): this {
    this.adapter = adapter;
    return this;
  }

  id(): string {
    return `mcp:${this.config.endpoint}`;
  }

  async connect(): Promise<void> {
    // Auth boundary enforcement: Hermes-owned. Without a satisfied secretRef
    // the boundary is NOT connected. The placeholder has no adapter, so it
    // can only be "connected" in the degenerate case of scheme "none".
    if (this.config.auth.scheme !== "none" && !this.config.auth.secretRef) {
      this.connState = "failed";
      throw new Error("MCP auth boundary unsatisfied: missing secretRef");
    }
    this.connState = "connected";
  }

  connectionState(): TransportConnectionState {
    return this.connState;
  }

  async invoke(envelope: InvocationEnvelope): Promise<TransportResult> {
    const started = Date.now();
    if (!this.adapter) {
      this.connState = "failed";
      return this.fail("AUTH_REQUIRED", "MCP client adapter not registered", started, envelope);
    }
    return this.adapter.invoke(envelope.implKey, envelope.payload, envelope.timeoutMs);
  }

  async cancel(_invocationId: string): Promise<void> {
    await this.adapter?.close().catch(() => undefined);
  }

  async health(): Promise<TransportHealth> {
    if (!this.adapter) {
      return {
        status: "unknown",
        kind: this.kind,
        id: this.id(),
        connectionState: this.connState,
        detail: "MCP boundary not attached (no concrete transport adapter)",
      };
    }
    return this.adapter.health();
  }

  async close(): Promise<void> {
    this.connState = "disconnected";
    await this.adapter?.close().catch(() => undefined);
  }

  private fail(
    code: TransportFailureClass,
    error: string,
    started: number,
    envelope: InvocationEnvelope,
  ): TransportResult {
    return {
      ok: false,
      error,
      code,
      backend: envelope.providerId,
      durationMs: Date.now() - started,
      transportKind: this.kind,
      connectionState: this.connState,
    };
  }
}
