# EPIC-005 — Provider Transport Architecture

**Phase:** 3 — Separate providers from communication
**Status:** Architecture-only. No source code modified.
**Date:** 2026-07-20

---

## 1. Principle

> **Transport owns only communication. Provider owns only execution.**
> The transport never knows *what* capability it is carrying.
> The provider never knows *what* policy approved it.

Today, execution is an injected `executor` closure (`ExecutionCoordinator.run`'s `executor` param). There is no transport type, no protocol, no lifecycle. This phase defines the transport layer that lets Hermes drive *remote, CLI, and MCP* providers through the **same** coordinator path used for in-process execution.

---

## 2. Transport Interface (provider-neutral)

```ts
/** A transport carries an invocation to a provider and returns a result.
 *  It knows NOTHING about capability semantics. */
interface Transport {
  readonly kind: TransportKind;
  /** Open / connect (idempotent). */
  connect(): Promise<void>;
  /** Carry one invocation. `payload` is an opaque envelope. */
  invoke(envelope: InvocationEnvelope): Promise<TransportResult>;
  /** Cancel an in-flight invocation by id (if supported). */
  cancel?(invocationId: string): Promise<void>;
  /** Health probe (drives Marketplace health). */
  health(): Promise<HealthStatus>;
  /** Tear down. */
  close(): Promise<void>;
}

type TransportKind =
  | "cli" | "local-process" | "stdio"
  | "http" | "https" | "websocket"
  | "mcp" | "ssh" | "future";

/** Opaque to the transport — assembled by the Provider Loader, not the transport. */
interface InvocationEnvelope {
  invocationId: string;
  providerId: string;
  implKey: string;            // which impl the Loader resolved
  payload: unknown;           // capability args (already serialized by Loader)
  timeoutMs: number;
  // transport adds its own wire framing; it does NOT interpret payload
}

interface TransportResult {
  ok: boolean;
  data?: unknown;
  error?: string;
  backend: string;            // provider id (for audit/metrics)
  durationMs: number;
}
```

The transport is **semantically blind**: it moves `payload` bytes/structs, never reads capability meaning.

---

## 3. Transport Catalog

| Kind | Use case | Example providers |
|------|----------|-------------------|
| `cli` | Spawn a local binary, capture stdout | Claude Code, GitHub CLI, Terraform, Docker |
| `local-process` | Long-lived local daemon / socket | Cursor, Windsurf (local agents) |
| `stdio` | Bidirectional stdio protocol | MCP servers, Gemini CLI, Codex |
| `http` | REST (plain) | Internal services |
| `https` | REST over TLS | Cloudflare, GitHub, OpenAI, PostgreSQL wire (proxy) |
| `websocket` | Streaming duplex | Realtime agents, live logs |
| `mcp` | Model Context Protocol framed | Any MCP server |
| `ssh` | Remote execution on a host | Self-hosted runners, OCI instances |
| `future` | Reserved extension slot | Not-yet-invented transports |

---

## 4. How a Transport Is Selected

```
Provider Manifest.transports: [ {kind: cli}, {kind: https} ]
            │
            ▼
Transport Registry: maps TransportKind → Transport implementation
            │  (Hermes-built; provider never supplies transport code)
            ▼
Selected Transport (by policy/health/capability need)
            │
            ▼
Provider Loader builds InvocationEnvelope (implKey + payload)
            │
            ▼
transport.invoke(envelope)   ← blind carry
```

The provider declares *which transports it speaks*; Hermes owns *how each transport is implemented*. A provider can never inject custom transport logic.

---

## 5. Boundaries Enforced

| Rule | Rationale |
|------|-----------|
| Transport code is **Hermes-owned**, never provider-supplied | Prevents provider from hijacking the channel |
| Transport never inspects `payload` semantics | Keeps transport reusable across all capabilities |
| Provider never sees policy decision | Policy is Hermes-internal; provider only receives approved work |
| Cancellation is best-effort, transport-specific | `cancel?` optional; coordinator fails-closed on timeout regardless |
| Health probe is transport-driven, not provider self-reported | Prevents a provider from lying about its own health |

---

## 6. Mapping to Today's Architecture

| Current | EPIC-005 transport |
|---------|--------------------|
| `executor` closure in `ExecutionCoordinator.run` | Becomes a `local-process` / in-memory Transport wrapping that closure |
| `AuditSink` global function | Becomes a `Transport` (or direct store call) — typed, health-aware |
| `ExecutionPersistenceBackend` | Already transport-independent (persistence, not execution transport) |

The existing `executor: (capability, args) => Promise<...>` closure is preserved as the **in-memory transport's** step function. No coordinator rewrite — the transport is injected where the closure used to be.

---

## 7. Rules

- A transport is selected by Hermes from the provider's declared `transports[]` — the provider cannot force an unlisted transport.
- Adding a transport = implement one `Transport` class + register it. No provider change, no coordinator change.
- Transports are **reusable**: one `https` transport serves Cloudflare, GitHub, OpenAI, etc.
- No capability-specific branching inside any transport.
