# Hermes Platform M1 — Independent Architecture Review

**Date:** 2026-07-20
**Reviewer:** Independent Architecture Review Board (read-only)
**Scope:** EPIC-003 → EPIC-005.5 (as-built, treated as production candidates)
**Method:** Evidence from repository (`docs/architecture/HERMES_PLATFORM_M1.md` is the inventory).
**Rules honored:** No code changes, no commits, no deploys, no secret access.

---

## 1. Executive Summary

Hermes has built an impressive, genuinely fail-closed *foundation*: a centralized
tenant wall (`withinTenantScope`), a single policy decision point
(`ExecutionPolicyEvaluator`), a provider trust lifecycle, a crash-safe runtime
guard (EPIC-005.5), and a fail-closed MCP transport boundary. The *intent* is
strong and the *happy-path* design is clean.

However, the review found **one CRITICAL and several HIGH severity defects** that
must be resolved before any production claim. The dominant systemic problem is
**architectural bifurcation**: there are **two execution stacks with two different
security models**, and EPIC-005.5's runtime guard covers only one of them. On top
of that, the **human-approval gate is bypassable by an agent using a hardcoded
string literal**, and **provider signature verification is a placeholder that
always returns true**.

**Verdict: NO-GO for production orchestration until CRITICAL/HIGH items are fixed.**
The platform is a strong *prototype* and a good *design reference*, not yet a
safe production control plane.

---

## 2. Architecture Overview

See `HERMES_PLATFORM_M1.md`. Two stacks:

- **Stack A** — `UniversalCapabilityPlatform` (+ `ProviderRuntimeGuard`, EPIC-005.5).
  Instantiated only in `services/providers/manager.ts` and tests.
- **Stack B** — `ExecutionCoordinator` → caller-supplied `executor` →
  `executeCapability` (`activation/provider-framework.ts`). Used by
  `security-agent.ts`, `git-provider.ts`, and the activation Claude Code provider.

The two stacks have **separate capability registries, separate provider lifecycles,
separate approval models, and divergent tenant enforcement**.

---

## 3. Strengths

- **Centralized tenant wall** (`withinTenantScope`, `admin/access.ts`): cross-org
  always denied; unbound principal denied under `requireScope:true`. Solid.
- **Single policy decision point** (`ExecutionPolicyEvaluator`): explicit, auditable
  categories, fail-closed. Good separation of concerns.
- **Trust lifecycle fail-closed** (`trust/lifecycle.ts`): any admission failure →
  REJECTED; factory never turns a rejected manifest into a live provider.
- **Runtime guard is crash-safe & non-breaking** (EPIC-005.5): never throws;
  preserves canonical platform error codes; optional injection keeps it testable.
- **MCP boundary fails closed** (`transport/mcp.ts`): contract-only placeholder;
  `AUTH_REQUIRED` until a real adapter is injected. No vendor code leaks.
- **Vendor SDK never imported**: backends injected via `CapabilityExecutor` port.
- **Rejected providers remain visible** in the marketplace (operability).
- **Recovery requires re-approval** (no auto-approve after restart).

---

## 4. Weaknesses

- **Bifurcated execution + security model** (see §5 CRITICAL-1).
- **Approval self-attestation** (see §5 CRITICAL-2).
- **Placeholder signature verification** (see §5 HIGH-1).
- **No-op provider authentication** (see §5 HIGH-2).
- **No tenant enforcement on Stack B** (see §5 HIGH-3).
- **Self-approved AgentTask inside `run()`** (see §5 HIGH-4).
- **In-memory-only durability** (see §5 MEDIUM-1).
- **Duplicate Claude Code provider implementations** (Stack A vs Stack B).
- **Duplicated capability registries** (no single source of truth).

---

## 5. Security Findings

### 🔴 CRITICAL-1 — Runtime guard covers only one of two execution paths (bypass)
- **Severity:** CRITICAL
- **Location:** `services/providers/platform.ts:181` (guard) vs
  `services/activation/provider-framework.ts:307` (`executeCapability`, no guard) vs
  `services/security/security-agent.ts:159` (calls `executeCapability`).
- **Risk:** `ProviderRuntimeGuard` (EPIC-005.5) is enforced **only** inside
  `UniversalCapabilityPlatform.execute()`. The activation stack —
  `executeCapability` — has **no runtime guard**. The Security Agent, Git provider,
  and activation Claude Code provider all execute through `executeCapability`.
  Therefore the entire 8-check runtime enforcement (tenant re-validation at exec
  time, timeout/concurrency caps, sandbox-required, audit-availability) is
  **silently absent** for a large fraction of real traffic.
- **Recommendation:** Make `executeCapability` (and any other execution entry) route
  through the **same** `ProviderRuntimeGuard` instance, or fold Stack B into Stack A.
  There must be exactly one chokepoint before any `provider.execute`/`executor` call.

### 🔴 CRITICAL-2 — Agents self-approve privileged capabilities
- **Severity:** CRITICAL
- **Location:** `services/security/security-agent.ts:159`
  ```ts
  approvalToken: req.approvalRequirement.required ? "human-token" : undefined
  ```
- **Risk:** An *agent* (not a human) passes the literal string `"human-token"` as
  the approval token whenever approval is "required". `executeCapability`
  (`provider-framework.ts:328`) only checks `if (needsApproval && !ctx.approvalToken)`
  — any non-empty string passes. Grep confirms `"human-token"` is **produced** here
  and **validated nowhere**. So agents bypass the human-approval gate for any
  `requiresApprovalIn:["production"]` capability. This defeats the platform's core
  "human-in-the-loop" guarantee.
- **Recommendation:** An approval token must be a **cryptographically verifiable,
  human-issued credential** bound to a specific execution/principal, verified by a
  real `verifyApprover` (not the default `(a)=>a.length>0`). Agents must never be
  able to mint or present an approval token. Remove the literal.

### 🟠 HIGH-1 — Signature verification is a placeholder (supply-chain risk)
- **Severity:** HIGH
- **Location:** `services/providers/trust/lifecycle.ts:174` `verifyChecksum()`
  returns `true`; enforcement (L105-114) only checks signature *presence* + signer
  membership, never cryptographic validity.
- **Risk:** A provider manifest with `trust.level >= sandbox` and
  `enforceSignatures=true` is admitted if it merely *claims* a trusted signer — no
  checksum is actually verified. Tampered manifests pass. The trust model's
  "signature integrity" claim is not real.
- **Recommendation:** Wire a real verifier (injected, Hermes-owned) that validates
  checksum + signature against pinned keys. Fail-closed on any verification error.

### 🟠 HIGH-2 — Provider authentication is a no-op
- **Severity:** HIGH
- **Location:** `services/providers/trust/lifecycle.ts:129-130` — `AUTHENTICATED`
  state transition with no implementation; `manifest.trust.authModel` (oauth/mtls/ssh)
  is never acted upon.
- **Risk:** Providers declared with `authModel: oauth/mtls/ssh` receive no
  credential handling. A provider that *should* be authenticated runs bare. Trust
  level can be `trusted`/`privileged` with zero actual auth.
- **Recommendation:** Implement the AUTHENTICATED step (token/mtls/ssh negotiation)
  or downgrade trust level when auth cannot be satisfied. Fail-closed.

### 🟠 HIGH-3 — No tenant isolation on Stack B
- **Severity:** HIGH
- **Location:** `services/activation/provider-framework.ts:307` `executeCapability`
  performs **no `enforceTenant`** call.
- **Risk:** Executions through Stack B skip tenant isolation entirely. Combined with
  CRITICAL-1, this means cross-tenant data access is possible via the unguarded path.
  (Stack A does enforce tenant at exec time via `ProviderRuntimeGuard.checkTenantScope`.)
- **Recommendation:** Enforce `enforceTenant(principal, tenantId)` inside
  `executeCapability` (and require a `tenantId` on the call), or unify stacks.

### 🟠 HIGH-4 — Self-approved AgentTask inside `run()`
- **Severity:** HIGH
- **Location:** `services/execution/execution-coordinator.ts:250-257` — `run()`
  creates an `AgentTask` and immediately `assignTask`+`approveTask` with the same
  `approver` that is running the execution.
- **Risk:** The orchestrator's "task must be approved before orchestration" gate is
  satisfied by the *executor itself*, not a human. The dual gating (policy evaluator
  + task approval) collapses into a single self-approval. Separation of duties is
  lost at the task layer.
- **Recommendation:** The AgentTask approval must come from a distinct human/system
  authority recorded before `run()`; `run()` should consume an already-approved task,
  not create-and-approve one inline.

### 🟡 MEDIUM-1 — Durability is in-memory only
- **Severity:** MEDIUM
- **Location:** `persistence/execution-store.ts` `createMemoryExecutionStore`
  (default); `ExecutionCoordinator` defaults to it.
- **Risk:** Restart loses all execution state, approvals, and leases. "Recoverable"
  executions are unrecoverable after a crash. Not production-grade for an
  orchestration control plane.
- **Recommendation:** Ship a durable `ExecutionStore` (D1/SQL) as the default before
  v1.0; keep memory store for tests/dev.

### 🟡 MEDIUM-2 — `verifyApprover` unsafe default
- **Severity:** MEDIUM
- **Location:** `execution/policy-evaluator.ts:124` and
  `execution/execution-coordinator.ts:91` — default `(a) => a.length > 0`.
- **Risk:** Unless every caller wires a real verifier, any non-empty approver string
  is accepted. Compounds CRITICAL-2.
- **Recommendation:** Default to **deny** (no known approvers) and require explicit
  injection of a verifier that checks real principal authority.

### 🟡 MEDIUM-3 — Two Claude Code providers / two capability registries
- **Severity:** MEDIUM
- **Location:** `activation/providers/claude-code.ts` (id `dev.claude-code`) vs
  `services/providers/claude-code/index.ts` (id `claude-code`);
  `activation/provider-framework.ts` REGISTRY vs `services/providers/capability.ts`.
- **Risk:** Divergent behavior, double maintenance, inconsistent governance. A
  capability resolved via Stack B may never see Stack A's guard and vice versa.
- **Recommendation:** Consolidate to a single provider registry + single execution
  path. Deprecate one stack.

### 🟢 LOW-1 — MCP `secretRef` never resolved
- **Severity:** LOW
- **Location:** `services/providers/transport/mcp.ts:105` checks `secretRef` string
  *presence*; no resolver/vault integration exists in scope.
- **Risk:** Even when wired, the credential is never fetched/validated. Today it's a
  placeholder boundary (acceptable), but it must not be mistaken for real auth.
- **Recommendation:** Document as contract-only; implement resolver before any real
  MCP provider is enabled.

### 🟢 LOW-2 — Audit store not durable/append-only
- **Severity:** LOW
- **Location:** `audit/event.ts` `emitAudit` — in-process; no tamper-evident store
  found in scope.
- **Risk:** Audits can be lost on restart and are not cryptographically protected.
  For a control plane, audit integrity matters.
- **Recommendation:** Add a durable, append-only audit sink (e.g. D1) with hashing.

---

## 6. Technical Debt Inventory

### Critical (fix before production)
| Item | Impact | Risk | Effort | Priority |
|------|--------|------|--------|----------|
| Unify execution stacks under one guarded chokepoint (CRIT-1) | Runtime guard bypassed for Stack B | Full runtime-enforcement gap | M | P0 |
| Verifiable human approval (CRIT-2, MED-2) | Agents self-approve privileged ops | Loss of human-in-loop | S–M | P0 |
| Real signature/checksum verification (HIGH-1) | Tampered manifests admitted | Supply-chain compromise | S | P0 |

### High (fix before scaling)
| Item | Impact | Risk | Effort | Priority |
|------|--------|------|--------|----------|
| Provider auth implementation (HIGH-2) | Trusted providers run unauthenticated | Impersonation | M | P1 |
| Tenant enforcement on Stack B (HIGH-3) | Cross-tenant access | Data breach | S | P1 |
| Remove inline self-approval in `run()` (HIGH-4) | SoD lost at task layer | Unauthorized exec | S | P1 |

### Medium (future improvement)
| Item | Impact | Risk | Effort | Priority |
|------|--------|------|--------|----------|
| Durable ExecutionStore (MED-1) | State lost on restart | Recovery failure | M | P2 |
| Consolidate duplicate providers/registries (MED-3) | Divergent governance | Bugs, drift | M | P2 |
| Durable append-only audit (LOW-2) | Audit loss/tamper | Compliance gap | M | P2 |

### Low (nice-to-have)
| Item | Impact | Risk | Effort | Priority |
|------|--------|------|--------|----------|
| MCP secret resolver (LOW-1) | Placeholder auth | False sense of security | S | P3 |

---

## 7. Maturity Scores (honest, 0–100)

| Dimension | Score | Rationale |
|-----------|------:|-----------|
| Architecture | 55 | Clean intent; crippled by bifurcation into two divergent stacks. |
| Security | 40 | Strong walls in places, but bypassable approval + unguarded path = critical. |
| Trust Model | 45 | Lifecycle good; checksum placeholder + no-op auth undermine it. |
| Runtime Safety | 50 | Excellent guard design, but covers ~half the traffic. |
| Provider Extensibility | 75 | Ports are clean; duplication is the only drag. |
| Transport Layer | 70 | CLI real, MCP fails-closed well; auth unresolved. |
| Persistence | 30 | In-memory only; not production-durable. |
| Audit | 60 | Rich emission; not durable/tamper-evident. |
| Multi-tenancy | 55 | Wall is correct where applied; absent on Stack B. |
| Operations | 50 | Marketplace/recovery present but state is volatile. |
| Developer Experience | 70 | Clear seams, good docs, fail-closed ergonomics. |
| **Overall Platform** | **52** | Strong prototype, not yet a safe production control plane. |

---

## 8. v1.0 Readiness

**Decision: NO (with conditions).**

Hermes is **not** ready to be a production orchestration platform. The blocking
items are:

1. **CRITICAL-1** — Runtime guard must cover *all* execution paths (single chokepoint).
2. **CRITICAL-2** — Human approval must be cryptographically verifiable; agents must
   not self-approve (remove the `"human-token"` literal + unsafe `verifyApprover` default).
3. **HIGH-1** — Real signature/checksum verification before admitting trusted providers.
4. **HIGH-3** — Tenant isolation on *every* execution path.
5. **MED-1** — Durable execution store (state survives restart).

Until these are resolved, the platform's safety claims (fail-closed, human-in-loop,
tenant isolation, trusted providers) do not hold end-to-end.

---

## 9. Recommended Next Epic

**EPIC-005.6 — Execution Isolation & Unification** (chosen over 005.7/006/007/008).

- **Why highest value:** The CRITICAL and several HIGH findings all stem from the
  *split* between Stack A and Stack B and the missing unified chokepoint. No amount of
  new marketplace/ops/multi-agent features is safe while a whole execution path
  bypasses the runtime guard and tenant wall. Unification is the prerequisite that
  makes every later epic trustworthy.
- **Why alternatives wait:**
  - **EPIC-005.7 (Marketplace)** — building distribution on top of a bypassable guard
    multiplies the blast radius.
  - **EPIC-006 (Operations)** — operating an unverifiable approval/tenant model is
    unsafe.
  - **EPIC-007 (Deployment)** — deploying a control plane with in-memory state and a
    self-approving agent is a production incident waiting to happen.
  - **EPIC-008 (Multi-Agent Intelligence)** — agents must not be able to self-approve
    privileged capabilities (CRITICAL-2) before coordinating real work.
- **Expected architectural impact:** Collapse Stack A/B into one execution entry that
  unconditionally invokes `ProviderRuntimeGuard` + `enforceTenant` + verifiable
  approval; delete the duplicate Claude Code provider and second capability registry;
  make `verifyApprover` deny-by-default; wire real signature verification. This
  converts the current ~50% guard coverage to 100% and closes the approval/tenant gaps.

---

## 10. Final Go / No-Go

**NO-GO** for production until the P0 (Critical) and P1 (High) items in §6 are
remediated and re-verified. The design philosophy is sound and worth continuing; the
*implementation* currently has exploitable gaps that directly contradict the
platform's stated safety guarantees.

**Conditions to reach GO:**
- [ ] Single guarded execution chokepoint (CRITICAL-1)
- [ ] Verifiable, non-self-issuable human approval (CRITICAL-2, MED-2)
- [ ] Real signature/checksum verification (HIGH-1)
- [ ] Tenant enforcement on all paths (HIGH-3)
- [ ] Durable execution store (MED-1)

---

*Review complete. Documentation only — no code, commits, or deploys performed.*
