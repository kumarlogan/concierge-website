# Hermes Platform — Architecture Freeze Review (Pre-v1 Foundation)

**Status:** READ-ONLY review · No source changes · No commits · No deploy
**Scope:** Entire Hermes platform prior to EPIC-005.8 (Foundation v1)
**Method:** Direct source inspection of `hermes/` services, persistence, audit, providers, and workforce modules. 108/108 existing tests pass on this branch.
**Reviewer note:** This review validates *architecture stability* (module boundaries, interfaces, layering, fail-closed defaults). Open *enforcement* gaps in the trust layer are tracked as known, scoped, and already assigned to EPIC-005.7.

---

## 1. Execution Architecture — Score 9/10

**Reviewed:** `HermesExecutionGateway`, `UniversalCapabilityPlatform`, `Runtime Guard`, execution flow.

**Verified:**
- **Exactly one execution boundary.** EPIC-005.6 unified all capability execution through `HermesExecutionGateway`. The platform's `execute()` routes every provider call through `GatewayRequest` → tenant gate → policy → approval → runtime guard. The only literal `.execute(` call site in non-test code (`providers/platform.ts:240`) is *inside the gateway's resolved executor closure* — it is the governed terminal call, not a bypass.
- **No hidden bypasses.** No direct provider execution outside the gateway was found in production code.
- **Fail-closed preserved.** Gateway ordering is tenant → policy → approval → runtime-guard; every stage throws on violation.
- **Orchestration vs execution separated.** `workforce/orchestration.ts` is a pure coordinator (plan/queue/approve/run) that composes already-governed primitives (work-planner, execution-queue, approval-gates). It introduces no new execution mechanics.

**Minor note:** Doc comment in `capability.ts:21` says capability ids are "namespaced by provider (e.g. `cloudflare:r2`)" but actual registration (`platform.ts:174-175`) uses the raw `cap` id with `provider` stored separately — the naming convention isn't enforced. Cosmetic, not structural.

---

## 2. Trust Architecture — Score 6/10

**Reviewed:** trust lifecycle, runtime guard, provider admission, revocation model, signature architecture, authentication architecture.

| Subsystem | State | Evidence |
|---|---|---|
| Trust lifecycle | **COMPLETE** | `trust/lifecycle.ts` — full `DISCOVERED→VALIDATED→AUTHORIZED→REVOKED/QUARANTINED` enum incl. required REVOKED/QUARANTINED states |
| Runtime guard | **COMPLETE** | `runtime/guard.ts` — provider-neutral, fail-closed, HIGH severity → revoke+unload |
| Provider admission | **COMPLETE** | `providers/manager.ts` + `platform.ts` trust gate before load |
| Revocation model | **DESIGNED / UNWIRED** | `setHooks` unwired in production (G-4) — revoke/quarantine side-effects need manual intervention |
| Signature architecture | **DISABLED** | `manager.ts:69` `enforceSignatures:false`, `trustedSigners:[]` (G-2) |
| Authentication architecture | **MISSING** | `lifecycle.ts:129-130` auth is a no-op placeholder for all modes (G-3) |
| Checksum verification | **MISSING** | `lifecycle.ts:174-178` `return true` stub (G-1) |

**Assessment:** The *design* is sound and provider-neutral. Three **HIGH** enforcement gaps remain stubbed/disabled. These are explicitly scheduled in EPIC-005.7 (next phase) — they are not architecture defects, but they MUST be closed before v1 GA. The foundation is freezable; the enforcement layer is not yet production-ready.

---

## 3. Capability Model — Score 8/10

**Reviewed:** capability registry, ownership, provider independence.

**Verified:**
- Capabilities represent **intent**, not providers. The registry (`capability.ts:62`) resolves by stable `id`; the bound `provider` is a lookup attribute, not part of the identity.
- `Provider independence`: execution resolves the provider from the capability at runtime via the gateway; business logic queries the registry, never imports a manifest or loader directly (seam isolation confirmed).
- `CapabilityRegistry` interface is stable (`register/get/list/has/ownerOf`); in-memory impl is edge-safe with a documented D1-backed variant seam (ADR-007).

**Weakness:** Two divergent capability contracts coexist:
- V1 `capability.ts` registry (used by `platform.ts`, `marketplace-security.ts`) — comment claims `:` namespacing; actual code doesn't enforce it.
- V2 `ProviderManifestV2.capabilities[].id` — explicitly forbids `:` (per EPIC-005.5 contract).

This contract drift can confuse a new provider author. Not a blocker, but should be reconciled in EPIC-005.8.

---

## 4. Provider SDK — Score 7/10

**Reviewed:** `ProviderManifestV2`, SDK contracts, transport abstraction, dynamic loading, onboarding.

**Verified:**
- `ProviderManifestV2` is declarative data (no code).
- SDK contracts (`Provider`, `ProviderRequest`, `ProviderResult`) are stable and transport-agnostic.
- Transport abstraction present (`TransportRegistry`, `transport/cli.ts`, kinds).
- Dynamic loading seam: `createManifestLoader(implFactories)` maps `implKey` (data) → live impl; vendor code enters only through the factory map.

**Gap (medium):** Onboarding a *completely new* provider currently requires adding its `implKey → factory` entry to the factory map, which is wired in core/config code — not purely declarative. Manifest authoring is zero-core; factory registration is code in core. True "drop-in without touching core" needs a registration/discovery mechanism (e.g. a provider registry config or auto-discovery). Track for EPIC-005.8.

---

## 5. Multi-Tenant Model — Score 8/10

**Reviewed:** `Principal`, tenant enforcement, approval, identity propagation.

**Verified:**
- **No tenant bypass.** All persistence stores (`execution`, `workflow`, `agent-state`) call the *same* centralized `enforceTenant()` (`persistence/tenant.ts:29`), which delegates to `withinTenantScope` and throws `TenantViolationError` on cross-tenant/unbound access (fail-closed). Every store read/write enforces it.
- Approval: dual gates — workflow approval (`orchestration.ts` M4) and execution approval (`gateway` `approvalRequired`) — both human-driven, fail-closed.
- Identity propagation: `Principal` flows through the gateway; tenant is recorded on every durable record and enforced on retrieval.

**Minor risk:** Stack A system-internal executions synthesize `principal = { id: "system:<providerId>", organizationId: providerId, groups: ["root"] }` (`platform.ts:213-219`). This is intentional (system context, no invented user) but grants `root` group. Acceptable by design; document the trust boundary clearly for enterprise auditors.

---

## 6. Persistence — Score 9/10

**Reviewed:** execution store, workflow store, agent state, audit store.

**Verified — provider-neutral across the board:**
- `ExecutionStore` / `WorkflowStore` / `AgentStateStore` all define a `XPersistenceBackend` interface; `D1 is NEVER referenced` (per-file comments). Swapping in D1/Postgres/KV requires implementing the backend only — no redesign.
- All stores reuse canonical state machines (task/workflow/agent transitions) and enforce tenant on every op.
- Fail-closed defaults: agents register `disabled`/`registered` (never auto-active).

**Strength:** This is the cleanest layer in the platform. The backend seam is the correct abstraction for multi-tenant, multi-runtime scale.

---

## 7. Audit — Score 8/10

**Reviewed:** audit emission, runtime events, trust events, execution events.

**Verified:**
- `emitAudit()` (`audit/emitter.ts`) is non-blocking and never throws — failures are logged, not propagated (correct: audit must not break the observed action).
- Runtime events: emitted (e.g. `EXECUTION_REQUESTED`, `EXECUTION_REJECTED`).
- Trust events: emitted (`PROVIDER_REJECTED`, `PROVIDER_LOADED`).
- Execution/agent events: emitted (`workflow.state`, `workflow.approval.*`, `agent.authz.allow/deny`).
- Traceability: events carry `tenant`, `workflow`, `category`, `decision`; workflow records link `auditEvents[]`.

**Caveat:** Because audit is best-effort, a failing store/sink loses events silently (logged only). For enterprise completeness, a dead-letter or startup assertion on the durable sink is recommended. Not a blocker for freeze.

---

## 8. Marketplace — Score 9/10

**Reviewed:** provider discovery, marketplace security, selection engine.

**Verified — read-only maintained:**
- `ProviderMarketplace` (`marketplace.ts`) is derived state (trust records + manifests); never mutates a provider. REJECTED providers stay visible for observability.
- `MarketplaceSecurityView` (`marketplace-security.ts`) is a **pure read-only evaluation** — builds a `GuardContext` from data the caller already holds, calls `guard.evaluate()` (not `enforce()`), emits no audit, mutates no state, contains no vendor-specific logic.
- Selection/composure flows through the marketplace surface; operators don't inspect manifests directly.

**Strength:** The marketplace is structurally incapable of executing or mutating — the read-only guarantee is enforced by code shape, not convention.

---

## 9. Dependency Boundaries — Score 8/10

**Reviewed:** layering, dependency inversion, circular deps, provider-specific imports.

**Verified:**
- **No provider-specific imports in production core.** The only `claude|anthropic|openai|ags` import match is in `__tests__/epic-005.1.test.ts` (test fixture). Core `providers/` and `services/` are vendor-agnostic.
- **No dependency inversion.** Stores depend on `Principal` (contract), not on services; `audit/emitter.ts` deliberately has zero heavy transitive imports so it loads anywhere.
- **No circular dependencies** detected in the reviewed graph.
- Layering is clean: `persistence` → `services` → `providers`/`workforce`; `audit` sits at the leaf.

**Weakness:** The V1/V2 capability contract drift (Area 3) is a *conceptual* dependency inconsistency — two definitions of "capability id" that don't agree. Resolve before v1 to avoid consumer confusion.

---

## 10. Future Scalability — Score 7/10

**Assumption:** 100+ providers, 10,000 exec/day, multiple runtimes, multiple transports.

**Strengths:**
- Provider-neutral persistence backend seam supports D1/Postgres/KV for shared, durable state across runtimes.
- `TransportRegistry` + `ProviderManifestV2` make transports and providers pluggable.
- Runtime guard and tenant gate are stateless per-request → horizontally scalable.
- In-memory registries handle 100 providers comfortably.

**Bottlenecks / Risks:**
- **Ephemeral state.** Current stores are in-memory (`Memory*Backend`). At 10k exec/day / multi-runtime, process restarts lose execution/workflow/agent state unless the D1/Postgres backend is implemented. The seam exists — implementation is required before GA.
- **Audit best-effort.** Silent event loss under sink failure (Area 7).
- **Synthetic root principal** for system executions (Area 5) — acceptable but needs auditor documentation at enterprise scale.
- **Capability contract drift** (Area 3/9) — will multiply confusion as provider count grows.
- **Factory registration in core** (Area 4) — onboarding 100 providers by editing core factory maps does not scale; needs a registration/discovery mechanism.

**Verdict:** The architecture *holds* conceptually. Production scale requires (a) the durable backend implementation, (b) provider discovery/registration, and (c) contract reconciliation — all additive, none requiring redesign.

---

## Final Scoring Summary

| # | Area | Score |
|---|---|---|
| 1 | Execution Architecture | 9/10 |
| 2 | Trust Architecture | 6/10 |
| 3 | Capability Model | 8/10 |
| 4 | Provider SDK | 7/10 |
| 5 | Multi-Tenant Model | 8/10 |
| 6 | Persistence | 9/10 |
| 7 | Audit | 8/10 |
| 8 | Marketplace | 9/10 |
| 9 | Dependency Boundaries | 8/10 |
| 10 | Future Scalability | 7/10 |
| | **TOTAL** | **79/100** |

---

## Overall Classification: **B — Freeze after minor adjustments**

The **module boundaries, interfaces, layering, and fail-closed defaults are stable and freezable.** The foundation can be frozen. Required adjustments before v1 GA:

1. **Mandatory (trust):** Close G-1/G-2/G-3/G-4 via EPIC-005.7 — checksum, signature enforcement, authentication, and wired revocation hooks. *Design is done; enforcement is the only remaining work.*
2. **Recommended (contract):** Reconcile V1/V2 capability-id conventions (Area 3/9).
3. **Recommended (onboarding):** Add provider registration/discovery so new providers don't require core factory edits (Area 4).
4. **Recommended (scale):** Implement the durable persistence backend (Area 10) and audit sink dead-letter before multi-runtime production.

**Freeze the foundation. Do NOT declare v1 GA until EPIC-005.7 enforcement is complete.**
