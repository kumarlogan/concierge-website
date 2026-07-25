# Hermes Foundation v1.0 — Security & Trust Assessment (EPIC-005.8A)

**Scope:** Runtime enforcement, tenant isolation, provider neutrality, audit
trail durability, and trust-lifecycle persistence.

**Verdict:** ⚠️ **ARCHITECTURE SOUND, 2 CRITICAL IMPLEMENTATION GAPS, 2 HIGH, 2 MEDIUM.**

The freeze's structural claims hold (single boundary, provider neutrality,
fail-closed gates, tenant isolation). The gaps are in **durability** and in
**Stack B's approval control** — both are provable from source and from the
test corpus (the tests pass *because* they don't exercise the gap).

---

## CRITICAL-1 — Stack B approval control is not enforced

**Files:** `services/security/security-agent.ts:159`, `services/activation/provider-framework.ts:419-488`

The security agent requests a capability and injects a hardcoded token:

```ts
// security-agent.ts:159
approvalToken: req.approvalRequirement.required ? "human-token" : undefined
```

That token flows into `executeCapability`, whose only check is:

```ts
// provider-framework.ts:440
if (needsApproval && !ctx.approvalToken) { /* refuse */ }
```

…and the gateway is built so its approval gate **never runs**:

```ts
// provider-framework.ts:380-392
const failClosedApprovals = () => ({ verify() { throw new Error("...") } });
const stackBGateway = new HermesExecutionGateway({ ..., approvals: failClosedApprovals() });
// ...
// provider-framework.ts:486
approvalRequired: false,
```

**Net effect:** Stack B's human-in-the-loop approval is a **non-empty-string
presence check**. Any caller that supplies *any* non-empty string (the literal
`"human-token"` is manufactured by the agent itself) satisfies the gate. The
token is **never** verified against a durable approval store, never expiry-checked,
never bound to an approver identity. EPIC-005.6 proves the *gateway's* approval
gate works (ghost approver, missing record, expiry, capability mismatch all
DENY) — but **Stack B routes around that gate** via `approvalRequired:false`.

**Severity: CRITICAL** for any capability that declares `requiresApproval` and
is invoked through Stack B. The control exists in the gateway; Stack B disables it.

**Fix direction:** Route Stack B approval through the real `ApprovalService`
(like EPIC-005.6 does), or delete the `human-token` literal and require a
verifiable `ApprovalRef`. Do not self-issue the token.

---

## CRITICAL-2 — Audit trail is in-memory only (no durability)

**File:** `services/audit/store.ts` (whole file, 65 lines)

```ts
export class MemoryAuditStore implements AuditStore {
  private readonly events: AuditEvent[] = [];   // process-local array
  clear(): void { this.events.length = 0; }
}
export const defaultAuditStore: AuditStore = new MemoryAuditStore();
```

The header claims it is "swappable for a D1-backed store behind the same
interface." **No D1 implementation exists** in the tree (search for
`D1Database` shows only *type* imports; no `AuditStore` subclass other than
`MemoryAuditStore`). On any worker restart / isolate recycle, **all audit
events are lost**.

What *is* correct: `queryScoped` (line 48) enforces cross-tenant read isolation
fail-closed (`enforceTenant` + filter to `principal.organizationId`). Read
access control is sound; **write durability is not**.

**Severity: CRITICAL** for a security/audit system — the trail that would
explain a breach does not survive a restart.

**Fix direction:** Implement the D1-backed `AuditStore` behind the same
interface and wire `defaultAuditStore` to it in production; keep `MemoryAuditStore`
for tests/dev.

---

## HIGH-1 — Signature enforcement OFF by default

**File:** `services/providers/manager.ts:69`

```ts
{ trustedSigners: [], enforceSignatures: false, authorize }
```

The dynamic admission pipeline defaults to `enforceSignatures: false`. Signatures
are only checked if the caller opts in. EPIC-005.1 SCENARIO 10 proves enforcement
works *when enabled* (`enforceSignatures: true` → `REJECTED`), but the default
posture admits unsigned providers. The `trustedSigners: []` empty list means
even when enabled, nothing is trusted unless configured.

**Severity: HIGH** — default-permissive admission.

---

## HIGH-2 — Trust state is in-memory only

**File:** `services/providers/trust/persistence/trust-state-store.ts`

```ts
export class InMemoryTrustStateStore implements TrustStateStore { /* Map-based */ }
```

Trust lifecycle (ADMITTED / REJECTED / SUSPENDED / REVOKED) is held in a process
local `Map`. On restart the state resets; a previously REVOKED provider can be
re-admitted by the discovery scan. The `lifecycle.ts` writes to this store
(`this.stateStore.save(record)`) but the store does not persist.

**Severity: HIGH** — revocation is not durable; a restart silently re-trusts.

---

## MEDIUM-1 — Within-tenant default-allow

**File:** `admin/access.ts:139` (and `persistence/tenant.ts` `enforceTenant`)

```ts
if (principal.scopes && principal.scopes.length > 0) { /* scoped check */ }
return true;   // no explicit scopes + matching org/tenant ⇒ allow
```

A `Principal` with empty `scopes` but matching org/tenant is granted. Stack B
synthesizes exactly such a principal (`groups: [], permissions: []`, no scopes),
so its access reduces to the tenant-equality check. This is acceptable *given*
the gateway's own cross-tenant guard, but it means authorization within a tenant
defaults open. Document the intent or require explicit scopes.

---

## MEDIUM-2 — Non-expiring signing keys never expire

**File:** `services/providers/trust/signature/verifier.ts:192-195`

```ts
if (key.expiresAt) { return new Date(key.expiresAt).getTime() > now; }
return true;   // key with no expiresAt is always active
```

Keys provisioned without `expiresAt` are valid forever. By design, but worth a
policy note (rotation required to retire such a key).

---

## Provider neutrality — CONFIRMED ✅

Vendor-keyword scan (`claude|anthropic|openai|gemini`) returned 13 hits, **all**
confined to `services/providers/claude-code/` (manifest, index, factory) and
test fixtures. No vendor SDK is imported by `provider-framework.ts`,
`platform.ts`, `guard.ts`, `hermes-execution-gateway.ts`, or `policy-evaluator.ts`.
The `CapabilityExecutor` port is the only extension point; backends are injected,
never imported. Neutrality claim holds.

## Marketplace — DOCUMENTED, NOT IMPLEMENTED (as a flow)

`services/providers/marketplace.ts` is a **read-only projection** over admitted
providers (`MarketplaceSecurityView` answers `safeExecuteAnswer` without executing).
There is no install / transaction / publish flow — consistent with the earlier
finding that "Marketplace" exists only in design docs. Not a security gap, but a
scope delta vs. the freeze narrative.

---

## Priority order

1. **CRITICAL-1** — make Stack B approval real (route through `ApprovalService`).
2. **CRITICAL-2** — ship durable `AuditStore` (D1).
3. **HIGH-1** — default `enforceSignatures: true` (or fail closed on unsigned).
4. **HIGH-2** — durable `TrustStateStore`.
5. **MEDIUM-1 / -2** — document default-allow and key-expiry policy.
