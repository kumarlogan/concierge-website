# Provider Permission Model (Hermes-owned)
## EPIC-005.4 · PHASE 1

> **Architecture-only.** This document defines the permission *model* and the
> evaluation *rules*. It does **not** modify `manifest-v2.ts` or any runtime
> code. The existing `ProviderPermission` schema in `manifest-v2.ts` is the
> carrier; this document defines how Hermes **evaluates** it at admission and at
> every execution.

---

## 1. Principle

```
Default DENY.
Explicit ALLOW only.
Capability-scoped.
Tenant-aware.
Auditable.
```

A provider may do **nothing** until Hermes has explicitly granted the specific
permission for the specific capability, scoped to the specific tenant. There is
no implicit privilege, no "admin" provider, no fallback-to-allow.

---

## 2. Permission Vocabulary

A permission is a `(resource, action)` pair, expressed in a stable, provider-
neutral namespace. The *provider* never names these — Hermes owns the
vocabulary. Examples:

| Permission string | Meaning | Typical grant |
|---|---|---|
| `capability.execute` | May serve an execution request for a registered capability | Implicit once capability is in `manifest.capabilities` **and** an explicit `allow` exists |
| `transport.network` | May open outbound network (HTTP/HTTPS/WebSocket/MCP egress) | Only to declared `transports[]` endpoints |
| `transport.local` | May use local-process / stdio / cli transports | Granted for CLI providers |
| `filesystem.read` | May read host files (paths constrained by sandbox) | Scoped to a declared mount/root |
| `filesystem.write` | May write host files | Only inside ephemeral/scratch root |
| `process.spawn` | May spawn child processes | CLI providers only; count-limited |
| `secret.access` | May read a Hermes-managed secret at runtime | None by default; operator-granted, never manifest-self-asserted |
| `environment.read` | May read environment variables | Constrained subset (never `SECRET*`, `CF_*`, etc.) |

**Rule:** `secret.access` is **never** granted by a manifest. It requires an
operator action recorded in the trust config (`grantedBy: "operator"`). A
manifest that *claims* `secret.access` is rejected at admission (privilege
escalation attempt).

---

## 3. Data Model (extends, does not replace, `manifest-v2.ts`)

The existing schema:

```ts
interface ProviderPermission {
  capability: string;   // intention id, e.g. "dev.code.generate"
  scope: string;        // tenant scope: "*" | tenantId | "none"
  grantedBy: "manifest" | "operator" | "runtime";
}
```

EPIC-005.4 adds a **Hermes-owned evaluation layer** (`ProviderPermissionSet`)
that interprets these rows *plus* the resource-action vocabulary above. The
manifest row answers *"what does the provider ask for"*; the permission set
answers *"what does Hermes permit, for whom, right now."*

### 3.1 Effective permission = manifest ask ∩ Hermes grant ∩ tenant scope

```
effective(provider, capability, tenant) =
    manifest.permissions contains {capability, scope ⊇ tenant}
      AND hermesGrant allows (capability → resource.actions)
      AND tenant in scope
      AND NOT revoked
```

- If any conjunct fails → **DENY** (default-deny).
- `scope: "*"` means "any tenant Hermes has admitted this provider to" — it is
  **not** a blanket grant; the tenant must still be in the provider's admitted
  tenant set (maintained by the trust/tenant layer).
- `scope: "none"` or missing row → DENY for every capability.

---

## 4. Evaluation Rules (the guard's contract)

| # | Rule | On violation |
|---|---|---|
| R1 | **Default deny** — absence of an explicit allow = deny. | `PERMISSION_DENIED` |
| R2 | **Capability-scoped** — a permission for `dev.code.*` does **not** grant `dev.deploy.*`. Wildcards are prefix-only and Hermes-controlled (never provider-asserted beyond the declared capability id). | `PERMISSION_DENIED` |
| R3 | **Tenant-aware** — `scope` must include the requesting tenant; cross-tenant use is denied even if capability is allowed. | `TENANT_MISMATCH` |
| R4 | **No self-escalation** — a manifest may not grant `secret.access`, `privileged`, or `scope:"*"` for a higher tier than its `trust.level` permits. | `PRIVILEGE_ESCALATION` (admission reject) |
| R5 | **Auditable** — every allow/deny is emitted via `emitAudit` with `decision` + `category`. No silent permit. | audit event required |
| R6 | **Revocable** — operator revocation (or trust downgrade) immediately removes the grant; in-flight executions are allowed to finish but no new ones start. | `TRUST_DOWNGRADE` → suspend new execs |

---

## 5. Trust Tier → Permission Ceiling

Hermes caps what a permission set may grant by the provider's `trust.level`
(assigned by Hermes, never self-asserted):

| Trust level | Permissible ceiling |
|---|---|
| `untrusted` | No execution. Visible in marketplace as rejected. |
| `sandbox` | `capability.execute` + `transport.local` + `filesystem` (ephemeral only) + `process.spawn` (count-limited). **No** `transport.network`, **no** `secret.access`. |
| `trusted` | + `transport.network` (to declared endpoints only). Still **no** `secret.access` unless operator-granted. |
| `privileged` | Operator-reviewed superset; `secret.access` possible **only** via `grantedBy: "operator"`. Requires signed manifest + pinned signer. |

A `sandbox` provider whose manifest *requests* `transport.network` is **rejected
at admission** (R4) — it asked for more than its tier ceiling.

---

## 6. Admission vs Execution

| Check | When | Gate |
|---|---|---|
| Manifest permission schema valid (no self-escalation, no forbidden grants) | `TrustLifecycle.admit` → extended `validateManifestV2` | fail-closed REJECT |
| Permission set built & stored (Hermes grant state) | after AUTHORIZE | stored in trust record |
| **Per-execution** permission re-check (capability + tenant scope + not revoked) | `ProviderRuntimeGuard` (PHASE 3), every `execute()` | fail-closed DENY |

The admission check is necessary but **not sufficient** — the execution-time
check (PHASE 3) is what actually enforces the model, because trust/tenant
state can change after admission.

---

## 7. Example Decision Matrix

| Provider trust | Manifest ask | Tenant | Hermes grant | Result |
|---|---|---|---|---|
| sandbox | `capability.execute` (dev.code.generate), scope `*` | acme | allowed, tenant acme admitted | **ALLOW** |
| sandbox | `capability.execute` (dev.code.generate), scope `*` | globex (not admitted) | allowed | **DENY** (tenant not in admitted set) |
| sandbox | `transport.network` requested | — | n/a | **REJECT** at admission (R4) |
| trusted | `capability.execute` + `transport.network` (declared endpoint) | acme | allowed | **ALLOW** |
| trusted | `secret.access` in manifest | — | n/a | **REJECT** at admission (R4 — never manifest-granted) |
| privileged | `secret.access` via `grantedBy:"operator"` | acme | operator-granted | **ALLOW** (audited) |
| any | capability NOT in manifest.permissions | — | n/a | **DENY** (R1 default-deny) |

---

*PHASE 1 complete. The permission model is fully defined on top of the existing
`ProviderPermission` schema. Next: PHASE 2 (Sandbox Contract).*
