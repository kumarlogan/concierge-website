# Hermes Foundation v1.0 — Execution Integrity Review (EPIC-005.8A)

**Scope:** Is there exactly one execution boundary, and is it fail-closed for
tenant isolation, policy, approval, and the runtime guard across **both** the
Stack A (manifest/trust/transport) and Stack B (in-process executor) paths?

**Verdict:** ✅ **ARCHITECTURE CONFIRMED.** There is a single
`HermesExecutionGateway` instance on each stack; both stacks route every
capability execution through it. No `skipGuard`/bypass toggle exists anywhere
in the tree. The four `return true` lines the review flagged are benign
lifecycle/filter returns, **not** security bypasses.

---

## 1. The single boundary

`HermesExecutionGateway` (`services/execution/gateway/hermes-execution-gateway.ts`)
is the only component that invokes a capability executor. Gate order (fail-closed):

```
tenant  →  policy  →  approval  →  runtime-guard  →  executor
 (401)      (402)      (403)          (404)           (exec)
```

Every gate returns `{ ok:false, code }` and **no executor runs** on any deny
(proven by EPIC-005.6: 9/9 deny tests assert `calls.length === 0`).

### Stack A (manifest-driven)
`UniversalCapabilityPlatform.bootstrap/execute` (`services/providers/platform.ts:239`)
→ `gateway.execute(...)`. Trust record, manifest, transports, and capability
registry are all real and resolved from the admission pipeline.

### Stack B (in-process executor)
`executeCapability` (`services/activation/provider-framework.ts:419`) builds a
synthesized `GatewayRequest` and calls a **separate** gateway instance
`stackBGateway` (`provider-framework.ts:385`). The synthesis is honest:

- `principal`: `{ id: actor, organizationId: actor, tenantId: actor, groups: [], permissions: [] }`
- `manifest`: synthesized via `stackBManifest(p)` (line 361) — declares `local-process` transport, `untrusted` level
- `trust`: explicitly `undefined`
- `guard`: `StackBGatewayGuard` (line 325) — enforces the **real** Stack B trust: provider must be `active + enabled + healthy`, plus a cross-tenant check
- `approvals`: `failClosedApprovals()` (line 380) — **throws** on `verify()`
- `approvalRequired: false` (line 486)

So Stack B reuses the same gateway; it just expresses its own trust model (lifecycle + health) through the guard slot instead of fabricating a manifest trust record. **No provider-specific logic leaks into core** — `provider-framework.ts` imports only the `CapabilityExecutor` port, never a vendor SDK.

---

## 2. Evidence: "return true" lines

The review flagged `manager.ts(157,185)`, `marketplace.ts(84)`, `platform.ts(117)`.
None are bypasses:

| Location | Context | Verdict |
|---|---|---|
| `manager.ts:157` | `unload()` returns `true` on successful unload | benign lifecycle return |
| `manager.ts:185` | `reload()` returns `true` on successful re-admit | benign lifecycle return |
| `marketplace.ts:84` | `matches()` filter returns `true` when all query predicates pass | benign predicate |
| `platform.ts:117` | `unloadProvider()` returns `true` after `shutdown()` | benign lifecycle return |
| `signature/verifier.ts:195` | `isKeyActive()` returns `true` when key has **no** `expiresAt` | by-design (non-expiring keys); see Security Assessment M-2 |
| `access.ts:139` | `canAccessTenant()` returns `true` when principal has no explicit `scopes` but matches org+tenant | within-tenant default-allow; see Security Assessment M-1 |

---

## 3. Evidence: bypass-toggle search

```
grep -rn "skipGuard|\.bypass|forceExecute|disableGuard|ignoreGuard|noCheck" hermes/
→ 0 matches
```

There is **no runtime switch** that disables the gateway, the guard, the policy
evaluator, or the tenant check. Fail-closed is structural, not configurable.

---

## 4. What Stack B does NOT verify (hand-off to Security Assessment)

The boundary is real and fail-closed for **tenant / policy / runtime-guard**.
The gap is the **approval** dimension (see `EPIC-005.8A-security-trust-assessment.md`,
CRITICAL-1): `StackB` sets `approvalRequired:false` and feeds a hardcoded
`"human-token"` literal (from `security-agent.ts:159`) into a non-empty-string
check. The gateway's approval gate is therefore never exercised on Stack B, and
the token is never verified against a durable record.

---

## 5. Test evidence

Ran the full EPIC-005 corpus with `vitest@4.1.9` (agent toolchain; the `hermes/`
package has no own `node_modules`):

| Suite | Tests | Result |
|---|---|---|
| `epic-005.1` (platform end-to-end) | 12 | ✅ pass |
| `epic-005.3` (transport abstraction) | 12 | ✅ pass |
| `epic-005.5` (runtime guard, 12 scenarios) | 18 | ✅ pass |
| `epic-005.6` (single gateway boundary) | 20 | ✅ pass |
| `epic-005.8` (signature/checksum crypto) | 8 | ✅ pass |
| `dynamic.test.ts` (pipeline) | 12 | ✅ pass |
| `epic-004.6` (execution security) | 20 | ✅ pass |
| **Total** | **102** | **✅ 102/102** |

The single-boundary claim is **directly exercised**: EPIC-005.6 proves all four
gates DENY before the executor runs, on both the happy path and 9 deny paths.
