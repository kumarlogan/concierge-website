// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Transport Interface (provider-neutral)       │
// │ EPIC-005.1 · PHASE 3                                           │
// │                                                               │
// │ A transport carries an invocation to a provider and returns a │
// │ result. It knows NOTHING about capability semantics.          │
// │                                                               │
// │ Transport code is Hermes-owned. No provider supplies transport│
// │ logic. One transport impl serves many providers (reusable).   │
// └─────────────────────────────────────────────────────────────┘

import type { HealthStatus } from "./sdk.js";

/**
 * The transport kinds Hermes understands. A manifest declares one (or more) of
 * these; the TransportRegistry resolves each to a Hermes-owned adapter.
 * Adding a kind is a data+contract change — NEVER a provider-specific branch.
 */
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

/**
 * Classification of a transport-level failure, independent of any provider or
 * capability semantics. Used to drive retry / fail-closed decisions in Hermes.
 */
export type TransportFailureClass =
  | "TIMEOUT" // exceeded timeoutMs
  | "TRANSPORT_FAILED" // spawn/connect/IO error
  | "PROCESS_NONZERO" // process exited non-zero (carries stderr)
  | "CONNECTION_REFUSED" // endpoint unreachable
  | "AUTH_REQUIRED" // transport auth boundary not satisfied
  | "UNKNOWN"; // anything else

/** Lifecycle of a transport *connection* (distinct from provider lifecycle). */
export type TransportConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "degraded"
  | "failed";

/**
 * Transport-scoped health — the *communication channel* dimension, kept
 * separate from Provider health and Capability health (see PHASE 4).
 *
 * Carries enough signal for Hermes to make a fail-closed decision without
 * leaking vendor internals.
 */
export interface TransportHealth {
  status: HealthStatus;
  /** Resolved transport kind that was probed. */
  kind: TransportKind;
  /** Stable transport instance id. */
  id: string;
  /** Current connection lifecycle state. */
  connectionState: TransportConnectionState;
  /** Last successful probe timestamp (ms epoch), if any. */
  lastProbeAt?: number;
  /** Optional human-readable detail (never raw secrets). */
  detail?: string;
}

/** Opaque envelope assembled by Hermes (TransportExecutor), not the provider. */
export interface InvocationEnvelope {
  invocationId: string;
  providerId: string;
  implKey: string;
  /** Capability args (already serialized by Hermes). Opaque to the transport. */
  payload: unknown;
  timeoutMs: number;
  /** Resolved transport kind — lets the transport self-identify in results. */
  transportKind: TransportKind;
}

export interface TransportResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  /** Stable error code when ok === false (a TransportFailureClass or subset). */
  code?: TransportFailureClass | string;
  backend: string;
  durationMs: number;
  /** Resolved transport kind that produced this result (Hermes correlation). */
  transportKind?: TransportKind;
  /** Transport-reported connection state after this invocation (optional). */
  connectionState?: TransportConnectionState;
}

/**
 * The universal transport contract — provider-neutral by construction.
 * A Transport carries an opaque InvocationEnvelope to a backend and returns a
 * TransportResult. It knows NOTHING about capability semantics, provider
 * identity beyond the id string, or any vendor SDK.
 *
 * Responsibilities (per EPIC-005.3 PHASE 1):
 *   - transport identity      → `kind` + `id()`
 *   - connection lifecycle    → `connect()` / `close()` + `connectionState()`
 *   - health checking        → `health()`
 *   - execution request      → `invoke(envelope)`
 *   - execution response     → `TransportResult`
 *   - timeout handling       → honored via `envelope.timeoutMs`
 *   - cancellation           → `cancel(invocationId)`
 *   - failure classification → `TransportResult.code` (TransportFailureClass)
 *
 * MUST NOT reference: Claude, OpenAI, GitHub, Cloudflare, or any MCP vendor.
 */
export interface Transport {
  /** The declared transport kind (e.g. "cli"). */
  readonly kind: TransportKind;
  /** Stable transport instance id (for audit correlation). */
  id(): string;
  /** Open / connect. Idempotent; safe to call repeatedly. */
  connect(): Promise<void>;
  /** Current connection lifecycle state (Hermes-owned observability). */
  connectionState(): TransportConnectionState;
  /** Carry one invocation. `payload` is opaque to the transport. */
  invoke(envelope: InvocationEnvelope): Promise<TransportResult>;
  /** Cancel an in-flight invocation by id (best-effort). */
  cancel(invocationId: string): Promise<void>;
  /** Health probe of the *communication channel* (drives Transport Health). */
  health(): Promise<TransportHealth>;
  /** Tear down; must be safe to call when already disconnected. */
  close(): Promise<void>;
}
/**
 * Registry mapping a TransportKind to its Hermes-owned implementation(s).
 *
 * EPIC-005.3 PHASE 2 — DYNAMIC RESOLUTION.
 * A manifest declares `transports: [{ kind, endpoint?, auth? }]`. Hermes resolves
 * `kind` → a concrete Transport instance from THIS registry. There is NO
 * `if (provider === X)` branch anywhere: resolution is a pure lookup keyed by the
 * declared transport kind. A single registered transport serves many providers.
 *
 * When multiple transports of the same kind are registered (e.g. distinct HTTP
 * endpoints), `resolve` honors an optional `endpoint` hint.
 */
export class TransportRegistry {
  private readonly map = new Map<TransportKind, Transport[]>();

  /** Register a Hermes-owned transport adapter for a kind. */
  register(kind: TransportKind, transport: Transport): void {
    const list = this.map.get(kind) ?? [];
    list.push(transport);
    this.map.set(kind, list);
  }

  /** True when at least one transport is registered for `kind`. */
  has(kind: TransportKind): boolean {
    return (this.map.get(kind)?.length ?? 0) > 0;
  }

  /** All registered transports for a kind (may be empty). */
  all(kind: TransportKind): Transport[] {
    return [...(this.map.get(kind) ?? [])];
  }

  /**
   * Resolve the best transport for a declared manifest transport.
   * Fail-closed: returns `undefined` when the kind is unknown or no transport
   * is registered — the caller MUST reject / deny (never silently fall through
   * to a default provider-specific path).
   */
  resolve(declared: { kind: TransportKind; endpoint?: string }): Transport | undefined {
    const list = this.map.get(declared.kind);
    if (!list || list.length === 0) return undefined;
    if (declared.endpoint) {
      const byEndpoint = list.find((t) => t.id().endsWith(`:${declared.endpoint}`));
      if (byEndpoint) return byEndpoint;
    }
    return list[0];
  }

  /** Snapshot of registered kinds (observability / audit). */
  registeredKinds(): TransportKind[] {
    return [...this.map.keys()];
  }
}
