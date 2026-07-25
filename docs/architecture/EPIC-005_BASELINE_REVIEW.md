# EPIC-005 — Platform Baseline Review

**Phase:** 0 — Foundation Constitution · Platform Baseline Review
**Status:** Architecture-only review. No source code modified.
**Date:** 2026-07-20
**Scope:** Current Hermes internal operating platform, inspected for provider-neutrality, transport separation, trust boundaries, and extension points ahead of the EPIC-005 Universal Capability Platform transition.

---

## 1. Inspected Components

| Area | File | Role |
|------|------|------|
| Activation | `hermes/services/activation/orchestrator.ts` | Generic, vendor-agnostic retry/timeout/cancel engine |
| Execution | `hermes/services/execution/execution-coordinator.ts` | Durable execution lifecycle owner |
| Execution | `hermes/services/execution/policy-evaluator.ts` | Single fail-closed authorization decision point |
| Persistence | `hermes/persistence/execution-store.ts` | Durable execution truth (provider-neutral backend) |
| Persistence | `hermes/persistence/workflow-store.ts` | Workflow lifecycle durability |
| Persistence | `hermes/persistence/provider.ts` | Provider-neutral persistence seam (memory ships; D1/PG/KV future) |
| Persistence | `hermes/persistence/tenant.ts` | Shared tenant enforcement gate |
| Audit | `hermes/audit/event.ts` | Append-only audit emission seam |
| Capability | `hermes/services/providers/capability.ts` | Manifest → Loader → Registry seam |
| Provider | `hermes/services/providers/index.ts` | Adapter service (currently Cloudflare-only) |
| Metrics | `hermes/services/execution/metrics.ts` | Execution metrics boundary |
| Trust | `hermes/services/execution/lease.ts`, `idempotency.ts` | Lease + idempotency guards |

---

## 2. Hardcoded Assumptions

| # | Finding | Location | Severity |
|---|---------|----------|----------|
| H1 | `ProviderName` union is a closed set: `"cloudflare" \| "oci" \| "aws" \| "azure" \| "local"`. Adding a new vendor requires editing this type — a compile-time hardcode. | `providers/index.ts:23` | Medium |
| H2 | `isAdapterImplemented()` returns `true` only for `"cloudflare"`. All other providers are explicitly declared-but-unimplemented. | `providers/index.ts:69-71` | Low (intentional) |
| H3 | Capability `id` is namespaced by provider (`cloudflare:r2`). The *registry lookup key* couples capability identity to a vendor prefix. | `capability.ts:23` | Medium |
| H4 | `defaultCapabilityRegistry` is a process-wide singleton. No multi-tenant registry isolation at the seam boundary. | `capability.ts:120` | Low |
| H5 | Execution `backend` field stores a raw provider id string; the policy evaluator checks it against `knownProviders()` but there is no loader/discovery abstraction around which backends are live. | `execution-store.ts:91`, `policy-evaluator.ts:208` | Medium |

---

## 3. Provider Coupling

| # | Finding | Location | Severity |
|---|---------|----------|----------|
| P1 | The adapter service (`providers/index.ts`) is the **only** place vendor SDKs bind, and it correctly keeps `cloudflareBundle` receiving pre-built impls. This is a *strength* — but the type vocabulary (`ProviderName`) still names vendors. | `providers/index.ts` | Low (good pattern, leaky type) |
| P2 | `Capability.provider` is typed as `ProviderName` (vendor-typed). A capability's source is therefore a vendor, not a logical backend. | `capability.ts:27` | Medium |
| P3 | `ExecutionCoordinator` takes `knownProviders: string[]` (raw ids) — there is no Provider Manifest object, no trust/health/sandbox metadata carried alongside the id. | `execution-coordinator.ts:56` | Medium |
| P4 | No transport abstraction exists. Execution flows `coordinator → executor(executorFn)` where `executor` is an injected closure. The closure is the *de-facto* transport, but it is never typed as such and carries no protocol/lifecycle semantics. | `execution-coordinator.ts:189` | High (gap) |

---

## 4. Transport Coupling

| # | Finding | Location | Severity |
|---|---------|----------|----------|
| T1 | There is **no transport layer** in the current architecture. All execution is local in-process closures (`executor` callback). CLI/HTTP/MCP/SSH transports are entirely absent. | n/a | High (gap, by design of EPIC-004) |
| T2 | Audit emission uses a global `SINK` function — effectively an anonymous transport, but untyped and unmanaged (no health, no retry contract). | `audit/event.ts:30-35` | Low |
| T3 | Nothing prevents a future `executor` closure from smuggling provider-specific logic into the coordinator. The contract is `Promise<{ok, data?, error?, backend}>` — provider-neutral on paper, unenforced in practice. | `execution-coordinator.ts:189` | Medium |

---

## 5. Trust Boundaries

| # | Boundary | Assessment |
|---|----------|------------|
| TB1 | **Principal → Tenant** | Enforced centrally via `enforceTenant` (fail-closed). Strong. |
| TB2 | **Capability → Execution** | Enforced via `ExecutionPolicyEvaluator` single decision point. Strong — this is the model EPIC-005 wants everywhere. |
| TB3 | **Provider → Trust** | **Weak.** A provider is a raw `string` id. No signature verification, checksum, trust level, or sandbox boundary is attached to a provider. `knownProviders()` is an allow-list with no provenance. |
| TB4 | **Approval → Execution** | Strong. Durable approval, approver verification, TTL expiry, fail-closed. |
| TB5 | **Vendor code → Core** | Isolated behind the adapter `cloudflareBundle` factory + `implKey` loader map. Strong pattern; needs to become the universal loader. |

---

## 6. Extension Points (already present)

| # | Extension Point | What it enables |
|---|-----------------|-----------------|
| E1 | `ProviderLoader = (manifest) => Capability[]` | Manifest→impl seam. The canonical extension point for new vendors. |
| E2 | `createManifestLoader(implFactories)` | Injects vendor code only through a factory map. Keeps vendor logic out of registry. |
| E3 | `ExecutionPersistenceBackend` / `WorkflowPersistenceBackend` | Provider-neutral durability. D1/Postgres/KV slot in with zero consumer change. |
| E4 | `PersistenceProvider` kind union + `createPersistenceProvider()` | Backend swap is a one-line kind change. |
| E5 | `ExecutionPolicyEvaluator` injected deps (`capabilities`, `knownProviders`, `verifyApprover`, `now`) | All trust inputs are injected, not hardcoded. |
| E6 | `AuditSink` | External audit writers attach without touching emitters. |

---

## 7. Architectural Strengths

1. **Single fail-closed policy decision point** (`policy-evaluator.ts`) — the exact pattern EPIC-005 wants for provider selection.
2. **Clear seams**: Manifest/Loader/Registry, Persistence Backend, Audit Sink, Adapter Bundle. Vendor code is already quarantined.
3. **Tenant enforcement is centralized** — no ad-hoc per-store logic.
4. **Durable execution truth** lives in `ExecutionStore`, not the queue.
5. **Provider-neutral persistence** is real (interface exists; only memory ships).
6. **Generic orchestration engine** is vendor-agnostic by design.

---

## 8. Technical Risks

| # | Risk | Impact | EPIC-005 mitigation |
|---|------|--------|---------------------|
| R1 | Provider identity is a bare string with no trust metadata | A compromised/forged provider id passes the allow-list if it matches | Provider Manifest V2 + Trust Model (Phases 2, 4) |
| R2 | No transport abstraction | Cannot run remote/CLI/MCP providers without redesign | Transport Architecture (Phase 3) |
| R3 | `ProviderName` is a closed union | Every new vendor is a source edit | Open manifest-driven registry |
| R4 | Capability ids carry vendor prefix | Vendor lock-in at the capability layer | Capability = intention, provider resolved at selection time (Phase 1) |
| R5 | No provider health/selection intelligence | Coordinator cannot pick the best backend | Selection Engine (Phase 6) |
| R6 | No runtime provider discovery | Operators cannot answer "which providers are healthy/trusted?" | Provider Marketplace (Phase 5) |

---

## 9. Conclusion

The current platform is **strong on internal trust boundaries** (tenant, policy, approval, persistence) but **weak on the provider dimension**: providers are bare strings, there is no transport layer, and capability identity is vendor-namespaced. EPIC-005's job is to lift the *internal* trust model and apply it uniformly to the *external provider* dimension — without touching the already-solid internal seams. The existing extension points (E1–E6) mean this can be done **additively**, satisfying the "no rewrite" rule.
