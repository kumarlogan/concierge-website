# EPIC-005.5 — Provider Runtime Guard (Implementation)

**Phase:** 9 (follow-on to EPIC-005.1/005.2) · **Status:** ✅ Implemented, validated, not yet committed
**Date:** 2026-07-20
**Owner:** Hermes (autonomous, via Telegram)

---

## 1. Purpose

EPIC-005.1 established the **admission-time** trust gate (`TrustLifecycle.admit()`
runs once during `bootstrap()`). After a provider is `ACTIVE`, `execute()`
called `provider.execute(req)` with **no further runtime checks** — a provider
could be mutated, its trust revoked, or a cross-tenant request issued, and the
platform would still run it.

The **Provider Runtime Guard** is the **provider-execution boundary** that sits
*between* the `ExecutionPolicyEvaluator` (policy admission) and the concrete
`provider.execute()` call. It re-validates the runtime contract on **every**
capability invocation, fail-closed.

> Execution order: `PolicyEvaluator → ProviderRuntimeGuard → TransportRegistry → Provider.execute()`.
> The guard is the **only** chokepoint before provider execution. No bypass.

---

## 2. Design Constraints (honored)

| Constraint | How |
|-----------|-----|
| Provider-neutral | Knows nothing about any vendor. Every input is data: manifest, trust record, registry, transports. No Claude/AGS/provider branches. |
| Fail-closed | Any uncertainty → DENY. No "allow on unknown". |
| Non-breaking | The existing EPIC-005.1 platform contract (codes `CAPABILITY_UNKNOWN`, `PERMISSION_DENIED`, `TRANSPORT_FAILED`, `TIMEOUT`, …) is preserved. The guard only adds *new* deny paths; it never preempts or shadows an existing platform code. |
| Crash-safe | The guard never throws — not even when reporting a denial or when its audit sink is missing. (`typeof this.audit !== "function"` defenses at every call site.) |
| Independently testable | Injected via optional constructor param (`runtimeGuard?: ProviderRuntimeGuard`). `guard.ts` has no hard dependency on `platform.ts`. |

---

## 3. The 8 Runtime Enforcement Checks

All checks run in `ProviderRuntimeGuard.runChecks()`. Each returns a `CheckResult`
(`passed`, `reason`, `code`). The first failure short-circuits to DENY.

| # | Check | Deny code | Fail-closed rule |
|---|-------|-----------|------------------|
| 1 | **trust-state** | `RUNTIME_TRUST_MISSING` / `RUNTIME_TRUST_STATE` | No trust record, or state not in `{ACTIVE, LOADED, RUNNING}`. |
| 2 | **tenant-scope** | `RUNTIME_TENANT_CONTEXT` / `RUNTIME_TENANT_SCOPE` | If a tenant boundary is *asserted* (`targetTenantId` present) and the request has no authenticated Principal → DENY. Cross-tenant access (per `enforceTenant`) → DENY. |
| 3 | **capability-authz** | `CAPABILITY_UNKNOWN` | Requested capability **not declared** by the provider manifest. (Registry registration is the platform's job post-bootstrap.) |
| 4 | **permission-scope** | `PERMISSION_DENIED` | Declared capability has no granted permission in the manifest (`grantedBy` missing). |
| 5 | **transport-authz** | `RUNTIME_TRANSPORT` | Declared transport `kind` is not a recognized platform transport. Adapter *availability* is resolved by the platform, not the guard. |
| 6 | **runtime-limits** | `RUNTIME_TIMEOUT` / `RUNTIME_CONCURRENCY` | `req.timeoutMs > manifest.limits.maxDurationMs`, or in-flight count ≥ `maxConcurrent` (per-provider in-memory counter). |
| 7 | **sandbox-requirements** | `RUNTIME_SANDBOX` | Trust tier `trusted`/`privileged` requires a non-`none` `sandboxPolicy.isolation`. |
| 8 | **audit-availability** | `RUNTIME_AUDIT` | No usable audit sink → execution cannot be observed → DENY. |

### Tenant enforcement nuance (deviation from EPIC-005.4 design)

EPIC-005.4 assumed a *missing tenant context* → DENY. We **changed** this to
match `enforceTenant`'s default semantics (`requireScope: false`): a request
that asserts **no** tenant boundary (`targetTenantId` absent) is **allowed**,
not denied. The wall is raised **only** when a target tenant *is* present, so
cross-tenant access is caught without breaking tenant-unprotected capabilities.
This is the same conservative default the platform's policy evaluator uses, so
the guard does not over-reject.

---

## 4. Files

| File | Role |
|------|------|
| `hermes/services/providers/runtime/guard.ts` | `ProviderRuntimeGuard` — the 8 checks, fail-closed `guard()` + read-only `evaluate()`. |
| `hermes/services/providers/runtime/violation-model.ts` | `ViolationResponseEngine` — maps each `ViolationClass` → severity + side-effect actions (revoke/unload/quarantine/alert/critical-audit). Declarative only; the guard never continues execution. |
| `hermes/services/providers/runtime/marketplace-security.ts` | `MarketplaceSecurityView.safeExecuteAnswer()` — **read-only** projection answering "can this provider safely execute this capability?" Never loads/starts/executes a provider. |
| `hermes/services/providers/runtime/index.ts` | Barrel exports. |
| `hermes/services/providers/platform.ts` | Integration: optional `runtimeGuard` ctor param (default `ProviderRuntimeGuard.DEFAULT`); guard called after `liveProviders` lookup, before `provider.execute()`; denial maps to `errResult(providerId, decision.code, …)` + `PROVIDER_RUNTIME_DENIED` audit + `release()`. |
| `hermes/services/providers/__tests__/epic-005.5.test.ts` | 12-scenario validation suite (provider-neutral fakes). |

---

## 5. Validation

- **EPIC-005.5 suite:** 18/18 passing (`epic-005.5.test.ts` — 12 scenarios + 4 violation-engine + 2 marketplace-projection).
- **EPIC-005.1 regression:** 12/12 passing (no breaking change to the platform contract).
- **Full providers suite:** 54/54 passing (`epic-005.1`, `epic-005.3`, `dynamic`, `epic-005.5`).
- **Typecheck:** clean for `runtime/*`, `platform.ts`, and the test (under the vitest config the suite runs under).
- **Secret scan:** clean — no credentials/keys in `runtime/`.

### Test scenarios (EPIC-005.5)

| Scenario | Check exercised | Expect |
|----------|-----------------|--------|
| 1 HAPPY PATH | all | ALLOW + concurrency bump/release |
| 2 UNKNOWN PROVIDER | trust-state | DENY `RUNTIME_TRUST_MISSING` |
| 3 REVOKED PROVIDER | trust-state | DENY `RUNTIME_TRUST_STATE` |
| 4 MISSING CAPABILITY | capability-authz | DENY `CAPABILITY_UNKNOWN` |
| 5 MISSING PERMISSION | permission-scope | DENY `PERMISSION_DENIED` |
| 6 TENANT MISMATCH | tenant-scope | DENY `RUNTIME_TENANT_SCOPE` |
| 7 MISSING PRINCIPAL | tenant-scope | DENY `RUNTIME_TENANT_CONTEXT` |
| 8 UNREGISTERED TRANSPORT | transport-authz | DENY `RUNTIME_TRANSPORT` |
| 9 TIMEOUT OVER LIMIT | runtime-limits | DENY `RUNTIME_TIMEOUT` |
| 10 CONCURRENCY OVER LIMIT | runtime-limits | DENY `RUNTIME_CONCURRENCY` |
| 11 SANDBOX REQUIRED BUT NONE | sandbox-requirements | DENY `RUNTIME_SANDBOX` |
| 12 AUDIT FAILURE | audit-availability | DENY `RUNTIME_AUDIT` |

---

## 6. What is deliberately NOT in scope (per mission)

- No hard backend sandbox isolation (guard *validates* the policy is declared; the
  Transport enforces it — consistent with EPIC-005.4 "deny if backend cannot enforce").
- No MCP provider implementation, no marketplace distribution, no EPIC-006 deploy.
- No AGS / Cloudflare / secret / production-credential changes.
- No auto-commit — changes are staged for explicit review.

---

## 7. Commit grouping (recommended)

| PR | Contains | Touches core? |
|----|----------|---------------|
| PR-A | `runtime/guard.ts`, `violation-model.ts`, `marketplace-security.ts`, `index.ts` | new files |
| PR-B | `platform.ts` integration (guard injection + deny path) | coordinator glue only |
| PR-C | `epic-005.5.test.ts` | tests only |

Each independently reviewable and revertible.
