// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Provider SDK Extensions for Persistence    │
// │                                                           │
// │ Adds QUARANTINED and REVOKED states to trust lifecycle.     │
// └─────────────────────────────────────────────────────────────┘

/** All possible trust lifecycle states for a provider. */
export type ProviderLifecycleState =
  | "DISCOVERED"
  | "VALIDATED"
  | "AUTHORIZED"
  | "AUTHENTICATED"
  | "LOADED"
  | "ACTIVE"
  | "SUSPENDED"
  | "RUNNING"
  | "REJECTED"
  | "UNLOADED"
  | "QUARANTINED"
  | "REVOKED";

/** Health of a provider as reported by its transport probe. */
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/** Trust tier assigned by Hermes (never self-asserted by the provider). */
export type TrustLevel = "untrusted" | "sandbox" | "trusted" | "privileged";

/** A normalized capability request handed to a provider for execution. */
export interface ProviderRequest {
  /** Opaque Hermes-assigned invocation id (for cancel correlation). */
  invocationId: string;
  /** Intention id, e.g. "dev.code.generate". */
  capabilityId: string;
  /** Concrete impl key resolved by the Loader (data, not code). */
  implKey: string;
  /** Capability arguments (already validated by Hermes policy). */
  args: Record<string, unknown>;
  /** Hard timeout for this invocation (ms). */
  timeoutMs: number;
  /** Caller-supplied request context (tenant, principal id) — read-only metadata. */
  context?: Record<string, unknown>;
}

/** A normalized result returned by a provider after execution. */
export interface ProviderResult {
  ok: true;
  /** Provider-specific output payload (already normalized by the provider). */
  data: unknown;
  /** Backend that produced it (provider id) — for audit/metrics. */
  backend: string;
  /** Wall-clock duration of execution (ms). */
  durationMs: number;
  /** Optional machine-readable hints (e.g. streaming, partial). */
  meta?: Record<string, unknown>;
}

/** A normalized, structured error returned by a provider. */
export interface ProviderError {
  ok: false;
  backend: string;
  /** Stable error code (e.g. "TIMEOUT", "CAPABILITY_UNKNOWN", "TRANSPORT_FAILED"). */
  code: string;
  message: string;
  /** Optional underlying cause detail (never raw secrets). */
  detail?: unknown;
  durationMs: number;
}

export type ProviderOutcome = ProviderResult | ProviderError;

/** Static metadata a provider exposes (no execution). */
export interface ProviderMetadata {
  id: string;
  vendor: string;
  version: string;
  /** Intention ids this provider advertises. */
  capabilities: string[];
  trustLevel: TrustLevel;
}

/**
 * The universal provider interface. Every provider — Claude Code, GitHub,
 * Cloudflare, or any future backend — implements exactly this shape.
 */
export interface Provider {
  // ── Lifecycle ──────────────────────────────────────────────
  /** One-time setup (connect transport, prime caches). Idempotent. */
  initialize(): Promise<void>;
  /** Tear down (close transport, release resources). */
  shutdown(): Promise<void>;

  // ── Introspection ──────────────────────────────────────────
  /** Provider version string. */
  version(): string;
  /** Static metadata (id, vendor, advertised capabilities, trust). */
  metadata(): ProviderMetadata;
  /** Live capability ids this provider can currently serve. */
  capabilities(): Promise<string[]>;

  // ── Runtime ────────────────────────────────────────────────
  /** Execute an approved capability request; return a normalized outcome. */
  execute(req: ProviderRequest): Promise<ProviderOutcome>;
  /** Best-effort cancellation of an in-flight invocation. */
  cancel(invocationId: string): Promise<void>;
  /** Health probe (drives the Marketplace). */
  health(): Promise<HealthStatus>;
}

/** Helper: build a normalized success result. */
export function okResult(
  backend: string,
  data: unknown,
  durationMs: number,
  meta?: Record<string, unknown>,
): ProviderResult {
  return { ok: true, backend, data, durationMs, meta };
}

/** Helper: build a normalized error. */
export function errResult(
  backend: string,
  code: string,
  message: string,
  durationMs: number,
  detail?: unknown,
): ProviderError {
  return { ok: false, backend, code, message, durationMs, detail };
}

/** Type guard: narrow a ProviderOutcome to a ProviderError. */
export function isProviderError(o: ProviderOutcome): o is ProviderError {
  return o.ok === false;
}
