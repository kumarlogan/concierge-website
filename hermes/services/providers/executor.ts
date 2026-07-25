// ┌─────────────────────────────────────────────────────────────┐
// │ Hermes Platform — Transport Executor (EPIC-005.3 PHASE 2+6+7) │
// │                                                           │
// │ The Hermes-OWNED routing seam. This is the heart of       │
// │ EPIC-005.3: Hermes resolves the transport from the        │
// │ provider manifest, builds the opaque InvocationEnvelope,  │
// │ invokes the transport, and maps the TransportResult back  │
// │ into a normalized TransportExecutionOutcome — emitting     │
// │ append-only audit events at every step.                    │
// │                                                           │
// │ Providers do NOT call transports directly. The platform   │
// │ routes every capability invocation through THIS executor  │
// │ so that provider identity (who) is cleanly separated from │
// │ transport mechanism (how).                                │
// │                                                           │
// │ FAIL-CLOSED: any resolution or transport failure returns  │
// │ a structured error outcome and emits a DENY audit. It     │
// │ never silently falls through to an undefined backend.     │
// └─────────────────────────────────────────────────────────────┘

import { emitAudit } from "../../audit/emitter.js";
import type { Transport, TransportResult, InvocationEnvelope, TransportKind, TransportConnectionState, TransportFailureClass } from "./transport.js";
import type { TransportRegistry } from "./transport.js";
import type { ProviderOutcome, ProviderResult, ProviderError } from "./sdk.js";

/** A capability invocation request routed to the executor by Hermes core. */
export interface TransportRequest {
  /** Provider id (who owns the capability). */
  providerId: string;
  /** Concrete implementation key resolved by the Loader. */
  implKey: string;
  /** Capability intention id, e.g. "dev.code.generate". */
  capabilityId: string;
  /** Opaque payload (already serialized by the calling provider). */
  payload: unknown;
  /** Hard timeout (ms). */
  timeoutMs: number;
  /** Opaque Hermes-assigned invocation id. */
  invocationId: string;
  /** Actor principal id (for audit). */
  actor: string;
  /** Optional tenant / workflow context (for audit). */
  tenant?: string;
  workflow?: string;
}

/**
 * Success branch: Hermes successfully invoked the transport and got data back.
 * Extends ProviderResult so the platform can treat it uniformly downstream.
 */
export interface TransportExecuteOk extends ProviderResult {
  transportId: string;
  transportKind: TransportKind;
  transportState: TransportConnectionState;
  transportCode: TransportFailureClass | "OK";
}

/**
 * Failure branch: the Hermes-owned seam maps every failure to a structured
 * error. Extends ProviderError so the platform can treat it uniformly downstream.
 */
export interface TransportExecuteError extends ProviderError {
  transportId: string;
  transportKind: TransportKind | "unknown";
  transportState: TransportConnectionState;
  transportCode: TransportFailureClass;
}

/**
 * Normalized outcome returned by the executor. Extends a ProviderOutcome with
 * transport-level correlation so Hermes can attribute success/failure to the
 * exact transport instance that carried it — without leaking transport or
 * provider internals into the caller.
 *
 * Clean discriminated union (discriminant `ok`) so callers narrow safely.
 */
export type TransportExecutionOutcome = TransportExecuteOk | TransportExecuteError;

function failClosed(
  req: TransportRequest,
  transport: Transport | null,
  code: string,
  message: string,
): TransportExecutionOutcome {
  const outcome: TransportExecutionOutcome = {
    ok: false,
    backend: req.providerId,
    code,
    message,
    durationMs: 0,
    transportId: transport?.id() ?? "unresolved",
    transportKind: transport?.kind ?? "unknown",
    transportState: transport?.connectionState() ?? "disconnected",
    transportCode: code as TransportFailureClass,
  };
  emitAudit("transport.execute.denied", req.actor, {
    providerId: req.providerId,
    implKey: req.implKey,
    capabilityId: req.capabilityId,
    invocationId: req.invocationId,
    transportId: outcome.transportId,
    transportKind: outcome.transportKind,
    code,
    reason: message,
  }, {
    tenant: req.tenant,
    workflow: req.workflow,
    decision: "deny",
    category: "provider-transport",
  });
  return outcome;
}

/**
 * Execute a capability request over the Hermes-owned transport layer.
 *
 * Steps:
 *   1. Resolve the transport for the provider's declared transport kind.
 *   2. Build the opaque InvocationEnvelope (Hermes injects transportKind).
 *   3. Emit an audit "invoke" event.
 *   4. Call transport.invoke().
 *   5. Map TransportResult → TransportExecutionOutcome.
 *   6. Emit an audit "success" / "failed" event.
 *
 * Any failure in 1–6 is fail-closed: a structured error outcome plus a DENY
 * audit. Transport resolution failure is NEVER silently retried or bypassed.
 */
export async function executeOverTransport(
  req: TransportRequest,
  resolveTransport: (kind: string) => Transport | null,
  registry?: TransportRegistry,
): Promise<TransportExecutionOutcome> {
  // ── 1. Resolve transport (Hermes-owned; fail-closed) ────────────────
  const declaredKind = req.implKey.includes("://")
    ? req.implKey.split("://")[0]
    : "cli";
  const transport =
    resolveTransport(declaredKind) ??
    registry?.resolve({ kind: declaredKind as never });
  if (!transport) {
    return failClosed(
      req,
      null,
      "UNKNOWN_TRANSPORT",
      `Hermes could not resolve a transport for kind "${declaredKind}" (provider "${req.providerId}")`,
    );
  }

  // ── 2. Build opaque envelope (transport-kind injected by Hermes) ────
  const envelope: InvocationEnvelope = {
    invocationId: req.invocationId,
    providerId: req.providerId,
    implKey: req.implKey,
    payload: req.payload,
    timeoutMs: req.timeoutMs,
    transportKind: transport.kind,
  };

  // ── 3. Audit: invoke start ─────────────────────────────────────────
  emitAudit("transport.execute.start", req.actor, {
    providerId: req.providerId,
    implKey: req.implKey,
    capabilityId: req.capabilityId,
    invocationId: req.invocationId,
    transportId: transport.id(),
    transportKind: transport.kind,
  }, { tenant: req.tenant, workflow: req.workflow, category: "provider-transport" });

  // ── 4. Invoke ──────────────────────────────────────────────────────
  const started = Date.now();
  let result: TransportResult;
  try {
    result = await transport.invoke(envelope);
  } catch (err) {
    const durationMs = Date.now() - started;
    const message = err instanceof Error ? err.message : String(err);
    const outcome: TransportExecutionOutcome = {
      ok: false,
      backend: req.providerId,
      code: "TRANSPORT_FAILED",
      message: `Transport "${transport.kind}" threw during invoke: ${message}`,
      durationMs,
      transportId: transport.id(),
      transportKind: transport.kind,
      transportCode: "TRANSPORT_FAILED",
      transportState: transport.connectionState(),
    };
    emitAudit("transport.execute.failed", req.actor, {
      providerId: req.providerId,
      invocationId: req.invocationId,
      transportId: transport.id(),
      transportKind: transport.kind,
      code: "TRANSPORT_FAILED",
      error: message,
    }, { tenant: req.tenant, workflow: req.workflow, decision: "deny", category: "provider-transport" });
    return outcome;
  }

  // ── 5. Map result → outcome ────────────────────────────────────────
  const durationMs = Date.now() - started;
  if (result.ok) {
    const ok: TransportExecutionOutcome = {
      ok: true,
      data: result.data,
      backend: req.providerId,
      durationMs,
      transportId: transport.id(),
      transportKind: transport.kind,
      transportState: result.connectionState ?? transport.connectionState(),
      transportCode: "OK",
      meta: {
        transport: transport.kind,
        transportId: transport.id(),
        transportState: result.connectionState ?? transport.connectionState(),
      },
    };
    emitAudit("transport.execute.success", req.actor, {
      providerId: req.providerId,
      invocationId: req.invocationId,
      transportId: transport.id(),
      transportKind: transport.kind,
      durationMs,
    }, { tenant: req.tenant, workflow: req.workflow, decision: "allow", category: "provider-transport" });
    return ok;
  }

  const outcome: TransportExecutionOutcome = {
    ok: false,
    backend: req.providerId,
    code: typeof result.code === "string" ? result.code : "TRANSPORT_FAILED",
    message: result.error ?? "Transport returned ok:false with no error detail",
    durationMs,
    transportId: transport.id(),
    transportKind: transport.kind,
    transportCode: (typeof result.code === "string" ? result.code : "TRANSPORT_FAILED") as TransportFailureClass,
    transportState: result.connectionState ?? transport.connectionState(),
  };
  emitAudit("transport.execute.failed", req.actor, {
    providerId: req.providerId,
    invocationId: req.invocationId,
    transportId: transport.id(),
    transportKind: transport.kind,
    code: typeof result.code === "string" ? result.code : "TRANSPORT_FAILED",
    transportCode: typeof result.code === "string" ? result.code : "TRANSPORT_FAILED",
    error: result.error,
  }, { tenant: req.tenant, workflow: req.workflow, decision: "deny", category: "provider-transport" });
  return outcome;
}
