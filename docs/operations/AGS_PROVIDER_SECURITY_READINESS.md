# EPIC-005.4 — AGS Provider Security Readiness
## PHASE 7 · Operations

> **Architecture-only.** Extends `docs/operations/AGS_PROVIDER_READINESS.md`
> (EPIC-005 baseline) with the runtime-security lens: *Can AGS safely use local
> / MCP / remote / third-party providers under the EPIC-005.4 guard — without
> any AGS-specific code in Hermes core?*
>
> **Finding:** Yes for all four classes — **provided** the EPIC-005.4 guard
> (PHASE 3) and violation model (PHASE 4) are implemented. The security boundary
> is Hermes-owned and provider-type-agnostic; AGS needs zero core changes.

---

## 1. The Question, Restated

```
AGS (tenant) ──▶ Hermes UniversalCapabilityPlatform
                    ├─ TrustLifecycle.admit (fail-closed)
                    ├─ ProviderRuntimeGuard.guard (PHASE 3)
                    ├─ provider.execute()  (owned by provider)
                    └─ ProviderViolationModel (PHASE 4)
```

Does AGS require **any** code in `hermes/services/**` that says "AGS", "agsynergy",
or branches on the AGS tenant? If the answer is "no" for each provider class,
AGS is security-ready.

---

## 2. Provider Class Readiness Matrix

| Provider class | Example in AGS flow | Guard-enforced? | AGS-specific code? | Verdict |
|---|---|---|---|---|
| **Local (CLI)** | Claude Code `dev.code.generate` | ✅ timeout, concurrency, spawn-budget, fs-ephemeral, network-egress-only (if `trusted`) | **No** — generic `cli` transport + manifest | ✅ Safe (requires `container` isolation for `trusted`/`privileged`) |
| **MCP** | Any MCP server tool | ✅ transport-kind check, network-egress-only, no spawn | **No** — `transport/mcp.ts` is generic | ✅ Safe |
| **Remote (HTTP/S, future SSH)** | GitHub / Cloudflare / remote worker | ✅ declared-endpoint egress only, response-contract validation, no host fs | **No** — `https` transport + manifest endpoints | ✅ Safe (risk is egress + response trust, both guarded) |
| **Third-party (untrusted vendor)** | any future external provider | ✅ full guard + `sandbox`/`trusted` ceiling + compromise signal | **No** — admission + guard are vendor-free | ✅ Safe **only if** admitted at `sandbox`/`trusted` and never granted `secret.access` via manifest |

---

## 3. Why No AGS-Specific Code Is Needed

| Security concern | Handled by | AGS involvement |
|---|---|---|
| Admission / fail-closed | `TrustLifecycle.admit` (generic) | None — AGS is just a `tenantId` |
| Per-execution authz | `ProviderRuntimeGuard` (generic, PHASE 3) | None — reads manifest + permission set |
| Tenant isolation | `enforceTenant` (reused, PHASE 1 R3) | None — AGS tenant scoped like any tenant |
| Sandbox | `SandboxPolicy` (PHASE 2, generic) | None — AGS does not configure the sandbox |
| Violations | `ProviderViolationModel` (PHASE 4, generic) | None — actions are provider-state transitions |
| Visibility | `MarketplaceSecurityView` (PHASE 5, read-only) | None — AGS queries like any operator |

The only AGS-specific artifact that legitimately exists is the **manifest data**
(the `claude-code` / `github` / `cloudflare` wiring registered via
`registerProvider`) — and that is *data*, not core code, and contains no
security bypass. AGS-specific *secrets* live in the operator-controlled trust
config (`grantedBy: "operator"`), never in source.

---

## 4. Residual Risks AGS Must Accept (not Hermes-core issues)

1. **Local CLI blast radius.** A `trusted` Claude Code provider running with
   `container` isolation still has the privileges of its container. AGS must
   ensure the container image is minimal and the host is hardened. This is an
   *ops* responsibility, not a Hermes-code gap.
2. **Remote provider trust.** GitHub/Cloudflare are `trusted` because their
   endpoints are declared and egress is pinned. If AGS adds an *undeclared*
   remote endpoint, the guard denies it (PHASE 2 S2) — but AGS must not register
   overly-broad `https` egress in the manifest.
3. **Third-party secret access.** A third-party provider must **never** receive
   `secret.access` via manifest (PHASE 1 R4). AGS operators must grant secrets
   only to vetted `privileged` providers via `grantedBy:"operator"`.
4. **Compromise signal latency.** The guard detects compromise from observed-
   vs-declared drift *after* the action; true real-time egress blocking needs
   the external sandbox (PHASE 2). Until that exists, AGS should run higher-risk
   providers at `sandbox` tier (no network) where possible.

---

## 5. Readiness Verdict

| Question | Answer |
|---|---|
| Can AGS safely use **local** providers? | ✅ Yes — with `container` isolation for `trusted`+; guard enforces timeout/concurrency/fs/spawn. |
| Can AGS safely use **MCP** providers? | ✅ Yes — generic transport; egress-only + no spawn. |
| Can AGS safely use **remote** providers? | ✅ Yes — declared-endpoint egress + response-contract validation. |
| Can AGS safely use **third-party** providers? | ✅ Yes — at `sandbox`/`trusted`, never manifest-granted secrets; full guard + compromise signal. |
| **Without AGS-specific code?** | ✅ Yes — the entire boundary is Hermes-owned and provider-type-agnostic. |

**AGS is security-ready pending implementation of PHASE 3/4** (the guard + violation
model). The architecture guarantees no AGS core changes are required.

---

*PHASE 7 complete. AGS can safely use all four provider classes under the
EPIC-005.4 boundary with zero AGS-specific core code. Next: PHASE 8 (Final
Foundation Report).*
