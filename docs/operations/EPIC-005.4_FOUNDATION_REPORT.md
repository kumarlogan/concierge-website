# EPIC-005.4 — Foundation Report
## PHASE 8 · Final Architecture Report

> **Status:** Architecture + documentation complete. **No runtime code written.**
> All 9 phases (0–8) delivered. The design builds on EPIC-003/004/005 foundations
> without redesigning them.

---

## 1. Documents Created

| Phase | Document | Path |
|---|---|---|
| 0 | Baseline Review | `docs/architecture/EPIC-005.4_BASELINE_REVIEW.md` |
| 1 | Provider Permission Model | `docs/architecture/PROVIDER_PERMISSION_MODEL.md` |
| 2 | Provider Sandbox Contract | `docs/architecture/PROVIDER_SANDBOX_CONTRACT.md` |
| 3 | Runtime Guard Layer (`ProviderRuntimeGuard`) | `docs/architecture/PROVIDER_RUNTIME_GUARD.md` |
| 4 | Provider Violation Model | `docs/architecture/PROVIDER_VIOLATION_MODEL.md` |
| 5 | Marketplace Security View | `docs/architecture/PROVIDER_MARKETPLACE_SECURITY_VIEW.md` |
| 6 | Test Strategy Design | `docs/operations/EPIC-005.4_TEST_STRATEGY.md` |
| 7 | AGS Provider Security Readiness | `docs/operations/AGS_PROVIDER_SECURITY_READINESS.md` |
| 8 | This report | `docs/operations/EPIC-005.4_FOUNDATION_REPORT.md` |

---

## 2. Key Architecture Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Build on the foundation, do not redesign.** The `ProviderPermission`, `SandboxPolicy`, `limits` schemas and `TrustLifecycle.admit` already exist. EPIC-005.4 defines *evaluation + enforcement* around them. | Avoids duplication; the foundation was already provider-neutral and fail-closed. |
| D2 | **Guard sits between `execute()` and `provider.execute()`.** It re-validates trust/capability/permission/tenant/transport/limits *every call*, because admission-time state can change. | Admission is necessary but not sufficient; execution-time re-check is the real enforcement. |
| D3 | **Default-deny permissions, capability-scoped, tenant-aware, auditable.** No implicit privilege; `secret.access` never manifest-granted. | Matches the EPIC-005.4 principle: Hermes owns admission, capability, policy, sandbox, limits, audit, failure. |
| D4 | **Sandbox contract is provider-type-agnostic.** CLI/HTTP/MCP/remote all express isolation the same way. Guard enforces in-process limits (timeout, concurrency) and *delegates* hard isolation (memory/CPU/fs/network jail/seccomp) to the backend — but **DENIES** if the backend can't honor the declared isolation (never silently downgrades). | Keeps one model regardless of backend; fail-closed on isolation gap. |
| D5 | **Violation model reuses existing trust states** (REJECTED/SUSPENDED/UNLOADED). Compromise signal = immediate REVOKE + UNLOAD + critical notify. Audit blindness = deny + quarantine (never proceed unaudited). | Fail-closed; no new state machine; evidence preserved on the trust record. |
| D6 | **Marketplace is a read-only security projection.** `SafeExecuteAnswer` is derived from data Hermes already owns — no execution, no mutation. | The marketplace is the dashboard; the guard is the enforcer. |
| D7 | **Guard is provider-neutral.** References only `ProviderManifestV2`, `TrustRecord`, `TransportKind`, `Provider` SDK. No Claude/GitHub/AGS branch. | Satisfies the strict "no provider-specific logic" rule. |

---

## 3. Security Guarantees (architectural)

Once PHASE 3/4 are implemented, Hermes guarantees:

1. **No execution without explicit allow.** Default-deny permission set; every capability+tenant requires a grant.
2. **No cross-tenant provider use.** `enforceTenant` re-checked at every execution.
3. **No undeclared transport.** Resolved transport kind must be in the provider's declared `transports[]` and within its `SandboxPolicy.network` class.
4. **Bounded time & concurrency.** `maxDurationMs` (cancel-on-expiry) and `maxConcurrent` (semaphore) enforced in-process.
5. **No silent isolation downgrade.** If the host can't provide the declared `isolation`, execution is denied.
6. **Fail-closed on audit loss.** A provider action with no audit trail is denied and the provider quarantined.
7. **Compromise = immediate ejection.** Observed-vs-declared drift triggers REVOKE TRUST + UNLOAD + critical operator alert.
8. **Full visibility.** Every allow/deny, violation, and trust transition is an `emitAudit` event; rejected/quarantined providers remain visible in the marketplace with reasons.

---

## 4. Remaining Gaps (explicit)

| Gap | Why | Owner (next epic) |
|---|---|---|
| G1 | **Hard isolation not yet enforced** (memory/CPU/fs jail/network egress/seccomp). Guard *delegates* but no backend wired. | Implementation epic: integrate container/VM/cgroup backend. |
| G2 | **`ProviderRuntimeGuard` not yet coded.** PHASE 3 is design only. | Implementation epic. |
| G3 | **Violation triggers not yet wired** to `TrustLifecycle` transitions. PHASE 4 is design only. | Implementation epic. |
| G4 | **Marketplace security projection not yet coded.** PHASE 5 is design only. | Implementation epic. |
| G5 | **Admission-time transport availability** still advisory (missing transports recorded, not rejected). EPIC-005.3 added the execution-time gate; admission should also hard-fail. | Tighten `validateManifestV2` / `admit`. |
| G6 | **Test suite not yet written.** PHASE 6 is the acceptance contract, not the tests. | Implementation epic (follow §2 catalogs). |

**No gaps in the *foundation* itself** — all are "design-complete, not yet
implemented," which is the intended outcome of an architecture-only epic.

---

## 5. Implementation Roadmap (recommended next epic)

| Step | Deliverable | Depends on |
|---|---|---|
| 1 | `ProviderPermissionSet` evaluator (PHASE 1 rules) | manifest-v2 schemas (exist) |
| 2 | `SandboxBackend` interface + validation (`achievable` check, PHASE 2) | none |
| 3 | `ProviderRuntimeGuard` (PHASE 3) wired into `UniversalCapabilityPlatform.execute()` | steps 1–2 |
| 4 | Violation triggers → `TrustLifecycle` transitions (PHASE 4) | step 3 |
| 5 | Marketplace security projection + `SafeExecuteAnswer` (PHASE 5) | step 3 |
| 6 | Test suite per `EPIC-005.4_TEST_STRATEGY.md` (PHASE 6) | steps 1–5 |
| 7 | Hard-isolation backend integration (G1) — container/cgroup | step 2 + ops |
| 8 | Tighten admission-time transport check (G5) | step 3 |

---

## 6. Validation Against EPIC-005.4 Rules

| Rule | Status |
|---|---|
| No source changes outside approved scope | ✅ Zero source files modified (docs only) |
| No provider-specific logic | ✅ Guard/marketplace reference only generic SDK + manifest types |
| No secrets | ✅ No secrets created; `secret.access` explicitly forbidden via manifest |
| No deployment | ✅ No deploy; architecture-only |
| All docs created | ✅ 9/9 phases (0–8) delivered |
| Aligns with EPIC-003/004/005 | ✅ Reuses `validateManifestV2`, `TrustLifecycle.admit`, `ExecutionPolicyEvaluator`, `emitAudit`, `TransportRegistry`, `ProviderMarketplace`, `enforceTenant` |
| No `git add -A` / no commits | ✅ No git operations performed |

---

## 7. Recommended Next Epic

**EPIC-005.5 — Provider Runtime Guard Implementation**: implement
`ProviderRuntimeGuard` (PHASE 3) + violation triggers (PHASE 4) + marketplace
security projection (PHASE 5), backed by the PHASE 6 test suite, then integrate
the hard-isolation backend (G1). This converts the EPIC-005.4 architecture into
enforced runtime behavior.

---

*EPIC-005.4 architecture complete. Awaiting approval to proceed to implementation
(EPIC-005.5) or to adjust any design decision above.*
