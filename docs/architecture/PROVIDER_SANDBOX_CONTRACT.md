# Provider Sandbox Contract (Architecture-only)
## EPIC-005.4 · PHASE 2

> **No implementation in this epic.** This document defines the *contract* every
> provider type must honor so Hermes can enforce isolation. It names the
> required controls and the enforcement boundary, but specifies **no particular
> sandbox backend** (container runtime, VM, seccomp profile, OS-level jail).
> The carrier schema (`SandboxPolicy` in `manifest-v2.ts`) already exists; this
> document defines what Hermes *requires* of it and how the guard validates it.

---

## 1. Motivation

Today a loaded provider runs with the **full privileges of the host process**
that loaded it. `SandboxPolicy` is declared in the manifest but never applied.
EPIC-005.4 requires that, before any execution, Hermes can prove the provider
is running inside a boundary that enforces:

- an execution timeout,
- memory and CPU limits,
- network restrictions,
- filesystem restrictions,
- process restrictions.

The contract is **provider-type-agnostic**: CLI, HTTP, MCP, and future remote
workers all express their isolation the same way, so the guard enforces one
model regardless of backend.

---

## 2. Sandbox Profile (the required shape)

Reuses the existing `SandboxPolicy` from `manifest-v2.ts` and extends its
semantics with **enforced** meanings:

```ts
interface SandboxPolicy {
  isolation: "none" | "process" | "container" | "vm";
  filesystem: "ro" | "rw" | "ephemeral";
  network: "none" | "egress-only" | "full";
  seccomp?: "default" | "strict";
}
```

Plus the resource limits already in `limits`:

```ts
limits: {
  maxConcurrent: number;     // concurrency cap (enforced in-process by guard)
  maxDurationMs: number;     // hard timeout (enforced in-process by guard)
  memoryMb?: number;         // enforced by external sandbox
  networkEgress?: "none" | "egress-only" | "full";
}
```

### 2.1 Control → Enforcement boundary

| Control | In-process enforceable today? | Requires external sandbox? | Notes |
|---|---|---|---|
| Execution timeout (`maxDurationMs`) | ✅ Yes (guard + transport cancel) | No | Guard starts a deadline timer; on expiry → cancel + `TIMEOUT`. |
| Concurrency (`maxConcurrent`) | ✅ Yes (guard semaphore) | No | Guard tracks in-flight count per provider. |
| Network (`network` / `networkEgress`) | ⚠ Partial (guard can *refuse* to configure egress) | ✅ Yes for hard enforcement | Guard validates the resolved transport endpoints match the allowed egress class; true network isolation needs the sandbox/network policy. |
| Filesystem (`filesystem`) | ⚠ Partial (guard can pass a constrained root) | ✅ Yes for hard enforcement | Guard passes an ephemeral/scratch root path to the provider; the OS/sandbox must actually mount it read-only or ephemeral. |
| Memory (`memoryMb`) | ❌ No | ✅ Yes | cgroup / VM memory cap. Guard records the declared cap; enforcement is external. |
| CPU | ❌ No | ✅ Yes | cgroup / VM CPU cap. Declared separately (see §3). |
| Process (`process.spawn` count) | ⚠ Partial (guard can cap spawn calls) | ✅ Yes for hard restriction | Guard caps declared spawn budget; true process jail is external. |
| seccomp | ❌ No | ✅ Yes | Profile applied at sandbox creation. Guard records requested profile. |

**Key design point:** the guard enforces what it *can* in-process (timeout,
concurrency, and pre-execution validation of network/fs/process budgets) and
**delegates** hard isolation (memory, CPU, true network/fs jail, seccomp) to the
sandbox backend — but it **refuses to execute** a provider whose declared
`sandboxPolicy.isolation` cannot be satisfied by the available backend. If the
host can only offer `isolation: "process"` but the provider's trust tier
requires `container`, the guard **DENIES** (fail-closed), it does not silently
downgrade isolation.

---

## 3. Provider-Type Support Matrix

| Provider type | Isolation options | Network class | Filesystem | Process | Notes |
|---|---|---|---|---|---|
| **CLI** (`cli`, `local-process`, `stdio`) | process / container / vm | none or egress-only | ephemeral (ro base + rw scratch) | spawn-budget capped | Highest risk surface (arbitrary subprocess). Requires `container`+ for `trusted`/`privileged`. |
| **HTTP** (`http`, `https`) | process / container | egress-only (to declared endpoint) | ro (config only) | none (no spawn) | Lowest local surface; risk is egress + response trust. |
| **MCP** (`mcp`) | process / container | egress-only (to MCP server) | ro | none | Boundary contract only (EPIC-005.3); transport is a client, not a subprocess. |
| **Future remote workers** (`ssh`, `future`) | n/a (remote) | full (operator-defined tunnel) | n/a | n/a | Isolation is the *remote* host's responsibility; Hermes enforces only the transport + trust + audit boundary. Documented so the contract is forward-compatible. |

---

## 4. Guard Validation Rules (what the runtime guard checks pre-execution)

| # | Rule | On violation |
|---|---|---|
| S1 | Declared `isolation` must be **achievable** by the active sandbox backend; never silently downgrade. | `SANDBOX_UNAVAILABLE` → DENY |
| S2 | `network` class must be ≥ the transport's actual egress (e.g. `network:"none"` but transport is `https` → DENY). | `NETWORK_POLICY_VIOLATION` → DENY |
| S3 | `filesystem:"ro"` providers must receive **no writable mount**; guard passes only read-only roots. | `FS_POLICY_VIOLATION` → DENY |
| S4 | `maxDurationMs` and `maxConcurrent` must be present and > 0; guard enforces both in-process. | `LIMITS_INVALID` → DENY |
| S5 | Trust tier ceiling must permit the declared `isolation` (e.g. `sandbox` tier cannot declare `vm` with `secret.access`). | `PRIVILEGE_ESCALATION` → DENY |
| S6 | `seccomp:"strict"` requires `container`/`vm` isolation; `process` isolation cannot satisfy strict. | `SANDBOX_UNAVAILABLE` → DENY |

---

## 5. Contract Guarantees (what "sandboxed" means to Hermes)

A provider admitted and executed under this contract is guaranteed, by the guard:

1. **Bounded time** — it cannot run past `maxDurationMs`; the guard cancels and
   records `TIMEOUT`.
2. **Bounded concurrency** — it cannot exceed `maxConcurrent` in-flight
   invocations.
3. **Declared network only** — any transport it uses was resolved from its
   declared `transports[]` and validated against `network` class (S2).
4. **Declared filesystem only** — it receives only the mounts its `filesystem`
   class permits.
5. **No silent privilege** — if the host cannot provide the declared isolation,
   it is denied, never downgraded.

Hard memory/CPU/seccomp isolation is the sandbox backend's job; the guard's job
is to **refuse execution** when the backend cannot honor the contract.

---

## 6. Out of Scope (this epic)

- No container runtime integration (Docker/Podman/firecracker) is specified.
- No cgroup/VM configuration is written.
- No seccomp profile is authored.
- No changes to `manifest-v2.ts` `SandboxPolicy` shape (reused as-is).

These are **implementation** items for the next epic (see FINAL report roadmap).

---

*PHASE 2 complete. The sandbox contract is defined architecture-only, reusing
the existing `SandboxPolicy` / `limits` schemas and extending their enforced
semantics. Next: PHASE 3 (Runtime Guard Layer).*
