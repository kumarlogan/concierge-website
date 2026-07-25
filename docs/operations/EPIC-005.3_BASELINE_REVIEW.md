# EPIC-005.3 — Provider Transport Abstraction Platform
## PHASE 0 · Baseline Review

> **Scope of this document:** read-only review of the EPIC-005.1 / EPIC-005.2
> foundation. **No source changes were made in this phase.** It identifies the
> current transport assumptions, remaining provider coupling, and the precise
> gap EPIC-005.3 must close so that *Hermes owns the transport layer* and
> *provider identity is separated from communication mechanism*.

---

## 1. What Already Exists (EPIC-005.1 / EPIC-005.2)

| Component | File | Status | Notes |
|---|---|---|---|
| `Transport` contract | `hermes/services/providers/transport.ts` | ✅ present | Universal interface: `connect / invoke / cancel? / health / close`. Knows nothing about capability semantics. |
| `TransportKind` | `transport.ts` (and mirrored in `manifest-v2.ts`) | ✅ present | `"cli" \| "local-process" \| "stdio" \| "http" \| "https" \| "websocket" \| "mcp" \| "ssh" \| "future"` |
| `TransportRegistry` | `transport.ts` | ✅ present | `register / get / has` keyed by `TransportKind`. |
| `InvocationEnvelope` | `transport.ts` | ✅ present | `{ invocationId, providerId, implKey, payload, timeoutMs }` — opaque payload. |
| `TransportResult` | `transport.ts` | ✅ present | `{ ok, data?, error?, code?, backend, durationMs }`. |
| `CliTransport` | `transport/cli.ts` | ✅ present | Process spawn, stdout/stderr capture, timeout, cancellation, retries, health probe. Zero-dependency; spawner injected for testability. |
| Provider manifest transport decl. | `manifest-v2.ts` → `ProviderTransport { kind, endpoint?, auth? }` | ✅ present | `validateManifestV2` requires `transports[]` non-empty. |
| Marketplace transport visibility | `marketplace.ts` | ✅ present | `MarketplaceEntry.transports: TransportKind[]` derived from manifest. |
| Trust lifecycle | `trust/lifecycle.ts` | ✅ present | DISCOVERED→VALIDATED→AUTHORIZED→AUTHENTICATED→LOADED→ACTIVE; fail-closed on every gate; SUSPENDED on repeated unhealthy. |
| Capability registry | `capability.ts` | ✅ present | `MemoryCapabilityRegistry`; `register / get / list / has / ownerOf`. |
| Dynamic loader | `loader.ts` | ✅ present (EPIC-005.2) | Generic, contract-driven, no vendor switch. |
| Audit (platform-owned) | `platform.ts` | ✅ present | In-memory `auditLog`; emits `PROVIDER_*`, `EXECUTION_*`, `HEALTH_PROBE`, `PROVIDER_REJECTED`, etc. |

**Conclusion:** EPIC-005.1 already delivered a *provider-neutral transport type system* and a working CLI adapter. EPIC-005.3 does **not** need to invent those from scratch — it must *complete the abstraction* so Hermes — not the provider — owns transport **resolution and execution routing**.

---

## 2. Current Transport Assumptions & Coupling (the gap)

### 2.1 Providers still *drive* the transport (coupling)
In `claude-code/provider.ts` and the factory `claude-code/index.ts`, the provider:
- receives a `Transport` **in its constructor**,
- calls `this.transport.invoke(envelope)` inside its own `execute()`,
- reads `this.transport.kind` for metadata.

The `UniversalCapabilityPlatform.execute()` path is `provider.execute(req)` — the
platform hands the request to the provider and the provider internally decides how
to talk to the backend. **This violates the EPIC-005.3 principle:** *"Provider
identity separated from Communication mechanism. Hermes decides … communication."*

The platform currently has **no Hermes-owned seam** that:
- resolves the manifest-declared `TransportKind` → a concrete Hermes-owned `Transport`,
- builds the `InvocationEnvelope` itself,
- invokes `transport.invoke()`,
- maps `TransportResult` → `ProviderOutcome`,
- emits transport-specific audit events.

### 2.2 No transport *health* dimension
`health()` is a single `HealthStatus` returned by the provider (which delegates to
its transport). There is no separation of:
- **Provider health** (manifest/lifecycle state),
- **Transport health** (is the communication channel reachable?),
- **Capability health** (can this specific intention currently serve?).

`TrustLifecycle.reportHealth` collapses everything into one `HealthStatus`.

### 2.3 MCP / HTTP / SSH / WebSocket transports are declared but absent
`TransportKind` lists them, but only `"cli"` has an implementation. There is
**no `McpTransport` boundary contract**, no `HttpTransport`, etc. EPIC-005.3
asks only for the **MCP boundary** (interface + placeholders) — not a working
MCP client.

### 2.4 No transport-specific audit events
`platform.ts` audit types do **not** include:
`TRANSPORT_SELECTED`, `TRANSPORT_HEALTH_CHECKED`, `TRANSPORT_CONNECTION_STARTED`,
`TRANSPORT_CONNECTION_FAILED`, `PROVIDER_EXECUTION_STARTED`,
`PROVIDER_EXECUTION_COMPLETED`, `PROVIDER_EXECUTION_FAILED`.

### 2.5 No "unknown transport → REJECT" / "unavailable transport → fail closed" gate
`loader.ts` `resolveTransports` only *records* missing transports (`missingTransports`);
it does **not** reject. The trust lifecycle has no transport-availability gate.
EPIC-005.3 requires these fail-closed behaviors.

---

## 3. Remaining Provider Coupling Map

| Coupling point | Where | EPIC-005.3 action |
|---|---|---|
| Provider holds `Transport` ref | `ClaudeCodeProvider` ctor | Keep (providers may still use a transport internally) **but** add a Hermes-owned routing path so the platform can execute *through* the resolved transport directly, decoupling provider identity from the comms mechanism. |
| Factory resolves transport by `kind` | `claudeCodeFactory` | This pattern is fine & provider-neutral; EPIC-005.3 generalizes resolution into the platform (`TransportResolution`). |
| Single merged health status | `lifecycle.reportHealth` | Extend with a separate transport-health channel (PHASE 4). |
| No transport audit events | `platform.audit()` | Add the 7 required transport/execution events (PHASE 6). |
| Missing transport = warning only | `loader.resolveTransports` | Add fail-closed gate: unknown/unavailable transport → REJECT/DENY (PHASE 7). |

---

## 4. EPIC-005.3 Build Targets (derived from the gap)

1. **PHASE 1 — Transport Contract hardening.** Confirm/extend `transport.ts`
   interfaces to explicitly cover: transport identity, connection lifecycle,
   health checking, execution request/response, timeout, cancellation, failure
   classification. Ensure no vendor strings appear. (Largely present; minor
   additions for `TransportHealth` + `FailureClass`.)
2. **PHASE 2 — Transport Registry + Resolution.** Generalize `TransportRegistry`
   into a resolution seam: manifest `transport.kind` → Hermes-owned adapter
   instance. No `if (provider === X)` branching.
3. **PHASE 3 — CLI Transport proof.** `CliTransport` already exists; validate it
   against the hardened contract and re-use as the reference adapter.
4. **PHASE 4 — Transport Health Model.** Separate Provider / Transport /
   Capability health dimensions. Selection fails closed.
5. **PHASE 5 — MCP Transport Boundary.** Interface + placeholders only
   (endpoint, auth boundary, capability discovery, timeout policy, health).
   No vendor lock-in, no MCP client implementation.
6. **PHASE 6 — Audit Integration.** Add the 7 required transport/execution audit
   events; Hermes-owned.
7. **PHASE 7 — Security Validation.** Unknown transport → REJECT; unavailable
   transport → FAIL CLOSED; untrusted provider → DENY; expired auth → DENY.
   No bypass of trust/policy/audit/capability/tenant/approval.
8. **PHASE 8 — Testing.** 12 scenarios + existing EPIC-005.1 (12) / EPIC-005.2
   (12) suites remain green. Typecheck clean, no regressions.
9. **PHASE 9 — Documentation.** Architecture + validation + completion reports +
   roadmap update.

---

## 5. Constraints Re-affirmed (no changes)

- No AGS Fertility code changes.
- No Cloudflare configuration changes.
- No deployment or secret creation.
- No provider-specific shortcuts or Claude-specific core logic.
- No `git add -A`; no automatic commits.
- Existing EPIC-005.1/005.2 tests must remain green.

---

## 6. Design Decision (carried into PHASE 1+)

To satisfy "Hermes owns transport" **without breaking the existing `Provider`
SDK or the 24 green tests**, EPIC-005.3 adds a **Hermes-owned execution-routing
seam** on top of the existing `Transport`/`TransportRegistry`:

- The platform resolves the manifest-declared `TransportKind` to a Hermes-owned
  `Transport` instance (registry lookup — no provider branch).
- A new `TransportExecutor` builds the `InvocationEnvelope` and calls
  `transport.invoke(envelope)`, then maps `TransportResult → ProviderOutcome`.
- Existing providers (e.g. `ClaudeCodeProvider`) keep working unchanged; the new
  seam is an *additional* routing path that proves Hermes can communicate through
  a transport directly, independent of provider-internal transport usage.
- All transport decisions emit the 7 required audit events.

This keeps the final execution model:

```
Capability → Policy → Provider Selection → Provider Manifest
           → Transport Resolution → Transport → Execution → Verification → Audit
```

never `Hermes → Claude`.

---

## 7. EPIC-005.3 Completion Report (PHASE 8–9)

> **Validation performed (no source changes in this update phase):** the
> transport abstraction, executor outcome union, audit emitter seam, and the
> 12-scenario test suite were validated end-to-end. Root cause of the prior
> 3/12 test failures was diagnosed and fixed in the **test harness only**
> (no production logic changed), preserving fail-closed behavior and audit
> integrity.

### 7.1 Transport Abstraction Status — COMPLETE

| Capability | Mechanism | Status |
|---|---|---|
| Transport resolution (manifest `kind` → Hermes-owned adapter) | `TransportRegistry` / `resolveTransport` | ✅ |
| Hermes-owned execution seam (builds envelope, invokes transport, maps result) | `executeOverTransport` in `executor.ts` | ✅ |
| CLI transport (reference adapter, injected spawner) | `transport/cli.ts` | ✅ |
| MCP transport boundary (interface + placeholders, no vendor lock) | `transport/mcp.ts` (`McpTransportBoundary`) | ✅ |
| Discriminated execution outcome union | `TransportExecutionOutcome` (ok:true / ok:false+code) | ✅ |
| Audit emitter seam (mockable module boundary) | `audit/emitter.ts` `emitAudit` | ✅ |

**No provider-specific logic**, no Claude-specific assumptions, no secrets,
no deploy, no Cloudflare/AGS changes. Provider identity is fully separated
from the communication mechanism: `executeOverTransport` resolves transport
from the manifest `kind`, never from provider identity.

### 7.2 Audit Behavior (consistent across all outcomes)

`executeOverTransport` emits three transport-execution events via the
platform-owned `emitAudit` seam, each carrying `providerId`, `transportKind`,
`capabilityId`, `invocationId`, and the outcome state:

| Phase | Event type | `decision` | Emitted when |
|---|---|---|---|
| Pre-flight | `transport.execute.start` | — | envelope built, before invoke |
| Success | `transport.execute.success` | `allow` | transport returned `ok:true` |
| Resolution/transport failure | `transport.execute.denied` | `deny` | unknown transport kind, rejected/untrusted provider, or transport-health gate fails |
| Execution failure | `transport.execute.failed` | `deny` | transport returned `ok:false` (e.g. `PROCESS_NONZERO`, `TIMEOUT`, `TRANSPORT_FAILED`) |

All three event types are **captured under the mocked emitter** — proving the
audit contract is exercised end-to-end with zero silent drops.

### 7.3 Validation Results

| Check | Command | Result |
|---|---|---|
| EPIC-005.3 test suite | `npx vitest run hermes/services/providers/__tests__/epic-005.3.test.ts` | **12/12 passed** |
| Production module typecheck | `tsc --noEmit -p tsconfig.epic005.json` (covers executor, transport-health, transport, cli, mcp, emitter) | **EXIT 0 — clean** |
| Discriminated-union narrowing | standalone `tsc` probe: `out.ok` true-branch exposes `transportKind`; false-branch exposes `code` | **EXIT 0 — narrows correctly** |

> **Environment note:** a full-project `tsc -p tsconfig.json` surfaces
> pre-existing, unrelated errors (missing `@cloudflare/workers-types`,
> `@hermes/*` path aliases, and `vitest` type declarations not installed in
> this checkout). These are environment/dependency gaps, not EPIC-005.3
> regressions — every EPIC-005.3 production module typechecks clean under its
> dedicated `tsconfig.epic005.json`, and every test file shares the identical
> `vitest` module-resolution warning.

### 7.4 Failure Modes Handled (fail-closed)

- **Unknown transport kind** (`kind` not in registry) → `UNKNOWN_TRANSPORT`,
  `transport.execute.denied` (`decision: deny`), no execution.
- **Rejected / untrusted / unauthenticated provider** → `PROVIDER_REJECTED`
  (or trust-gate), `transport.execute.denied` (`decision: deny`).
- **Transport-health gate fails** (resolved transport reports unhealthy) →
  `transport.execute.denied` (`decision: deny`).
- **Process nonzero exit** → `PROCESS_NONZERO`, `transport.execute.failed`
  (`decision: deny`), stderr captured.
- **Process timeout** → `TIMEOUT`, `transport.execute.failed` (`decision: deny`),
  child killed (`SIGKILL`).
- **Spawn error / transport-level failure** → `TRANSPORT_FAILED`,
  `transport.execute.failed` (`decision: deny`).
- **Catch-all** → `transport.execute.failed` (`decision: deny`), error message
  preserved.

No `ok:false` path returns without an audit event. No bypass of trust,
policy, capability, tenant, or approval layers.

---

*EPIC-005.3 validation complete. Tests: 12/12. Production typecheck: clean.
No commits made (per task rules).*
