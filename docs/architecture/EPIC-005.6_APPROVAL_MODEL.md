# EPIC-005.6 — Approval Security Model (PHASE 3)

**Requirement (EPIC-005.6 §PHASE 3):** *Remove self-approval possibility.*
**Invariant:** `issuer(approval) != requester(execution)` AND the approval is verifiable,
identity-bound, tenant-bound, capability-bound, and expiring.

---

## 1. The Core Problem

Today two approval models coexist, both weak:

- **Stack B:** `executeCapability` accepts `ctx.approvalToken` = **any non-empty string**
  (`provider-framework.ts:328`). `security-agent.ts:159` literally passes `"human-token"`,
  so the executing agent approves its own privileged action (Bypass #3, #4).
- **Stack C (coordinator):** uses a durable `ExecutionApproval { approver, at, capability,
  scope, expiresAt? }` (`persistence/execution-store.ts`). This is the *right shape*, but
  `verifyApprover` defaults to `(a)=>a.length>0` (`execution-coordinator.ts:91`), so any
  string passes as a valid approver (Bypass #6).

Neither binds the approval to (a) a non-self issuer, (b) the tenant, (c) the capability, or
(d) an expiry in a *verifiable* way.

---

## 2. Target Model — `ApprovalService`

Replace ad-hoc tokens with a single `ApprovalService` that the gateway calls in step 5.

```ts
// services/execution/approval.ts  (DESIGN)
export interface ApprovalRef {
  id: string;                 // unique approval id
  issuedBy: string;           // principal id of the APPROVER (never the requester)
  issuedFor: string;          // principal id of the REQUESTER (bound)
  tenantId: string;           // tenant-bound
  capabilityId: string;       // capability-bound
  providerId?: string;        // optional provider-bound
  issuedAt: string;           // ISO timestamp
  expiresAt: string;          // mandatory expiry
  signature: string;          // verifiable (HMAC/JWS over the above fields)
}

export interface ApprovalService {
  // Human operator issues an approval (out-of-band, never by the executing agent).
  issue(input: {
    approver: Principal;       // a human/operator principal, NOT the agent
    requester: Principal;      // the agent/principal that will execute
    tenantId: string;
    capabilityId: string;
    providerId?: string;
    ttlMs: number;
  }): ApprovalRef;            // returns a signed, verifiable approval

  // Gateway verifies before execution.
  verify(
    ref: ApprovalRef,
    ctx: { requester: Principal; tenantId: string; capabilityId: string; providerId?: string },
  ): { ok: boolean; reason?: string };
}
```

---

## 3. Binding Rules (enforced in `verify`)

1. **Issuer ≠ Requester.** `ref.issuedBy !== ref.issuedFor`. Reject if equal → kills self-approval (Bypass #3).
2. **Tenant bound.** `ref.tenantId === ctx.tenantId` and `=== ref.issuedFor.tenantId`.
3. **Capability bound.** `ref.capabilityId === ctx.capabilityId`. Wrong-capability approval → DENY (validation scenario #6).
4. **Provider bound (if set).** `ref.providerId === ctx.providerId`. Wrong provider → DENY (#7).
5. **Expiration.** `Date.now() < Date.parse(ref.expiresAt)`. Expired → DENY (#5); recovered executions re-verify and DENY if expired (#10).
6. **Signature verifiable.** `verifySignature(ref)` over the canonical field set using a Hermes-owned
   key (`ApprovalSigningKey`). Unknown/mismatched signature → DENY. No opaque string tokens accepted.
7. **Approver identity known.** `ref.issuedBy` must resolve to a known approver principal
   (replaces the unsafe `verifyApprover` default — Bypass #6).

---

## 4. Issuance Is Out-of-Band

The approval is **issued by a human/operator principal**, never by the executing agent:

- An operator action (e.g. an admin API, a reviewed PR, a UI confirmation) calls
  `ApprovalService.issue({ approver: <operator>, requester: <agent>, ... })`.
- The returned `ApprovalRef` is passed to the gateway as `ExecutionRequest.approvalRef`.
- The executing agent **cannot** mint a valid `ApprovalRef` because it does not hold the
  `ApprovalSigningKey` and `issuedBy` would equal `issuedFor` (rejected by rule 1).

This is the structural fix for Bypass #3/#4: self-approval is *cryptographically* and
*structurally* impossible, not merely discouraged.

---

## 5. Migration from `"human-token"`

- `security-agent.ts:159`: remove `approvalToken: "human-token"`. The security agent must
  receive a pre-issued `ApprovalRef` (from an operator) and pass it as `approvalRef`.
- `executeCapability` (Stack B): remove the `approvalToken` parameter entirely; it routes
  through the gateway, which calls `ApprovalService.verify`.
- Existing tests that assert `"human-token"` acceptance must be rewritten to issue a real
  `ApprovalRef` and assert that **self-issued** approvals are DENIED (validation scenario #4).
- `ExecutionCoordinator.approve` already records a durable `ExecutionApproval`; align its
  shape with `ApprovalRef` (add `issuedFor`, `signature`, mandatory `expiresAt`) so the
  coordinator's durable approval *is* the same verifiable object the gateway consumes.

---

## 6. Validation Scenarios Covered

| # | Scenario | Enforced by |
|---|----------|-------------|
| 4 | Self-issued approval denied | Rule 1 (issuer ≠ requester) |
| 5 | Expired approval denied | Rule 5 |
| 6 | Wrong capability approval denied | Rule 3 |
| 7 | Wrong provider denied | Rule 4 |
| 10 | Recovery preserves approval state | `ApprovalRef` stored durably; re-verified on recovery |

*End of PHASE 3. Design only.*
