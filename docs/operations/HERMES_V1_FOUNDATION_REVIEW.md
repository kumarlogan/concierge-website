# HERMES V1 FOUNDATION REVIEW

**Document type:** Read-only architectural assessment (Phase 2 of EPIC-003-006 closeout)
**Date:** 2026-07-20
**Scope:** Committed Hermes platform code (`workers` package + `hermes/` libs + `shared/`)
**Status:** No code changes made. Assessment only.

---

## 0. Executive Summary

Hermes V1 foundation is **structurally sound and hardening-complete** through
EPIC-003-006. The four core trust boundaries — identity/authorization, agent
runtime, audit, and provider loading — now have explicit, single-insertion-point
contracts with a clean typecheck (EXIT 0) and a green 375-test suite.

**Maturity:** Foundation-complete but **pre-persistence**. All durable state
(audit, capability registry, agent registry, workflow state) is in-memory and
process-local. The contracts are deliberately designed to be D1-swappable
behind stable interfaces, so the persistence gap is an implementation gap, not
an architectural one.

**Top remaining blocker for true V1:** durable audit + durable workflow/agent
state (currently lost on every deploy / isolate restart).

---

## 1. Identity & Authorization

### 1.1 Principal model
`Principal` (`hermes/contracts/platform-api.ts`) is minimal but now carries the
tenant boundary: `organizationId?`, `tenantId?`, `scopes?: AccessScope[]`, plus
`permissions: string[]` and `id`.

- Strengths: tenant fields are present and optional (non-breaking); `scopes`
  insertion point is explicit.
- Gaps:
  - `organizationId` is optional → unbound principals exist by default. The
    boundary check handles this (deny when `requireScope: true`), but no code
    path currently *forces* `requireScope: true` on tenant-protected resources.
  - No `Principal` factory/validator — `id` format is ad-hoc (`assertHumanPrincipal`
    string-matches `agent:` prefixes). No canonical way to mint a verified principal.
  - `permissions` is a flat `string[]` with no typed enum source of truth consumed
    by callers (PLATFORM_PERMISSIONS exists but is uncoupled from Principal checks).

### 1.2 Tenant boundary
`withinTenantScope(principal, target, opts)` (`hermes/admin/access.ts`) is the
single enforcement point. Hard cross-org wall, scope-narrowed grants, tenant
qualifier match.

- Strengths: single choke point; correct deny-by-default for unbound; correct
  cross-org rejection.
- Gaps:
  - The function is **declared but not yet wired** into resource/agent/lifecycle
    mutators. Today it is a library; no caller enforces it at the API edge.
  - `env` qualifier in `AccessScope` is declared but never checked.

### 1.3 Scope enforcement
Scopes are data-only; enforcement is inside `withinTenantScope`. No scope
*issuance* flow (who grants a principal a scope?) exists yet.

### 1.4 Agent permissions
Agents are forbidden from the Admin Console (`assertHumanPrincipal`). Agent
*execution* permission is gated by `canAgentAct()` (lifecycle + activation), not
by a permission string. There is no per-agent capability scoping against
`Principal.scopes` — agents are not yet first-class Principals.

---

## 2. Agent Runtime

### 2.1 Lifecycle model
Canonical two-axis model (`shared/contracts/lifecycle.ts` + `hermes/agents/registry.ts`):
- Lifecycle: `registered → assigned → approved → active → (paused | suspended) → retired`
- Activation: `disabled | enabled` (explicit, authorized out-of-band)

`setState()` enforces the transition table; illegal transitions throw.

- Strengths: single authoritative transition gate; `suspended` added as a safe
  hold; auditHistory recorded on every transition.
- Gaps:
  - `assigned`/`approved` transitions are reachable by anyone who can call
    `setState` — no authorization wrapper around the registry mutators yet.
  - Lifecycle state is in-memory only (`REGISTRY` Map); lost on restart.

### 2.2 Activation gate
`activateAgent()` / `deactivateAgent()` flip `activation` only. `canAgentAct()`
requires `enabled AND active`. Correct separation of concerns.

- Gap: `activateAgent()` has a doc comment forbidding automatic activation, but
  there is **no enforcement** that activation only happens via an authorized
  operator flow. The prohibition is advisory.

### 2.3 Human approval flow
Documented as env-driven fail-closed in EPIC-003-005 orchestration. The
`AgentTransitionInput.authorized` flag exists in the contract but the registry's
`setState` does not consume an `authorized` principal — transitions are not yet
tied to a human approver identity.

### 2.4 Failure handling
- `setState` throws on illegal transition (fail-closed, good).
- `suspendAgent`/`activateAgent` throw on unknown id (good).
- No retry/recovery at the registry level (orchestration layer owns that per
  EPIC-003-005).

---

## 3. Audit System

### 3.1 Event contract
Canonical `AuditEvent` (`shared/interfaces/audit.ts`): id, type, category,
actor, at, action, resource?, decision?, meta?. Rich and provider-neutral.

- Strengths: categories for filtering/retention; decision field for auth events;
  never-include-secrets guidance in the contract.
- Gaps:
  - `emitAudit()` does NOT populate `category` or `decision` — callers pass only
    `{type, actor, detail}`. The richer fields are unused at emission time.
  - Two parallel `AuditEvent` types exist (canonical in `shared/interfaces/audit.ts`
    and a legacy-compatible one in `hermes/audit/event.ts` with `detail` instead of
    `meta`). The adaptation is clean but the duplication is a maintenance seam.

### 3.2 Storage abstraction
`AuditStore` interface (append/query/clear), `MemoryAuditStore` default. Append-only,
non-blocking, store-assigns id/at. Swappable for D1 behind the same interface.

- Strengths: exactly the right boundary for later durability.
- Gaps:
  - **No D1 implementation exists** — audit is lost on every isolate restart.
  - `setAuditSink` (optional durable sink) is unused by any caller.

### 3.3 Future persistence readiness
**High.** The interface is D1-ready (ADR-007 referenced). Only the implementation
is missing.

---

## 4. Provider Architecture

### 4.1 ProviderManifest
Declarative data: `name`, `version`, `capabilities[]` each with `id/name/config/implKey`.
No code shipped in the manifest. Good.

### 4.2 ProviderLoader
`createManifestLoader(implFactories)` maps `implKey` (data) → live impl. Vendor code
enters ONLY through the `implFactories` map. Correct isolation.

### 4.3 CapabilityRegistry
`CapabilityRegistry` interface + `MemoryCapabilityRegistry` default. Single source
of truth for "what can run". Synchronous, edge-safe.

- Strengths: clean three-stage seam; business logic queries the registry, never
  imports a manifest/loader.
- Gaps:
  - **No manifest is registered at startup** — `defaultCapabilityRegistry` is empty
    in production. No bootstrap that loads the Cloudflare `ProviderBundle` into the
    capability registry.
  - `Capability.impl` is typed `unknown` — no typed capability interface for callers
    to consume safely.
  - Decoupled from `ProviderBundle` (low-level adapter service) but the two are not
    yet bridged.

### 4.4 MCP readiness
The seam is MCP-compatible in shape: a manifest describes capabilities, a loader
instantiates them, a registry answers "can I run X?". To support remote/MCP
providers you would add a loader that resolves `implKey` to a remote MCP client.
**Ready as a design; no MCP adapter exists yet.**

### 4.5 Vendor neutrality
**Strong.** Manifest/loader/registry are provider-agnostic. `ProviderName` is the
only vendor-coupled type, and it is already constrained to the adapter vocabulary.

---

## 5. Execution Platform

### 5.1 Workflow orchestration
`hermes/services/execution/` exports `execution-queue`, `work-planner`,
`workforce-dispatch` (per EPIC-003-005). Coordinator + lifecycle + dynamic
capability resolution + human approval gate + audit.

- Strengths: fail-closed approval, audit on every orchestration event.
- Gaps:
  - Workflow state is in-memory; no durable queue. Restart loses in-flight work.
  - `hermes/services/execution/index.ts` shows a diff in the working tree from a
    prior session (NOT part of EPIC-003-006) — execution module is still being
    actively edited elsewhere; consolidation pending.

### 5.2 Developer agent
Present (EPIC-003-002): planning, QA, security, docs pipelines, simulated executor.
Fail-closed, no real side effects.

### 5.3 Security agent
Present (EPIC-003-003): provider-neutral scanner contracts, real OSS adapters
(fail-closed `not_installed`), risk engine, admin visibility.

### 5.4 Workforce model
`workforce-dispatch` resolves capabilities registry → workforce → fail-closed.
Agents registered in `hermes/agents/registry.ts`. Model is coherent; persistence
is the gap (see §2.1).

---

## 6. Current Maturity Scorecard

| Domain | Maturity | Notes |
|---|---|---|
| Identity & AuthZ | 0.6 | Contracts present, not wired at API edge |
| Tenant boundary | 0.5 | `withinTenantScope` correct but unused by callers |
| Agent runtime | 0.7 | Strong lifecycle/activation gate; no durability |
| Audit | 0.7 | Great contract + boundary; in-memory only |
| Provider seam | 0.6 | Clean design; empty at runtime, no MCP adapter |
| Execution | 0.6 | Orchestration sound; no durable queue |
| Test/typecheck | 1.0 | EXIT 0, 375/375 green |

**Overall: ~0.65 — foundation-complete, pre-persistence.**

---

## 7. Remaining Blockers (V1)

1. **Durable audit persistence** (D1 `AuditStore` impl) — audit lost on restart.
2. **Durable agent/workflow state** — registries are in-memory Maps.
3. **Wire `withinTenantScope` into API mutators** — boundary is declared, not enforced.
4. **Capability registry bootstrap** — load provider manifests at startup.
5. **Activation authorization enforcement** — `activateAgent` is advisory-only.

---

## 8. Recommended V1 Completion Checklist

- [ ] Implement `D1AuditStore` behind `AuditStore` (ADR-007); wire `setAuditSink`.
- [ ] Populate `category`/`decision` in `emitAudit` calls.
- [ ] Add `D1AgentRegistry` / `D1WorkflowStore` behind existing interfaces.
- [ ] Insert `withinTenantScope(...)` guards into registry/lifecycle/agent mutators.
- [ ] Bootstrap `defaultCapabilityRegistry` from provider manifests at startup.
- [ ] Enforce `activateAgent` only via authorized operator principal.
- [ ] Add a `Principal` factory + `Authorizer` implementation (replace stub).
- [ ] Bridge `ProviderBundle` → capability registry for Cloudflare.

---

## 9. Recommended EPIC-004 Priorities

Given the "own vs. control" philosophy, prioritize the **persistence + enforcement**
gaps that turn today's correct *contracts* into correct *runtime behavior*:

1. **Persistent Operations Platform** (durable audit + workflow/agent state) —
   highest leverage; unblocks real multi-deploy operation. (See EPIC-004 Proposal,
   Option C.)
2. **Tenant boundary enforcement** (wire `withinTenantScope`) — low effort, high trust gain.
3. **Capability registry bootstrap + MCP-readiness** — enables external/remote providers.
   (Option B.)

Deployment Operations (Option A) is valuable but can be *controlled* via the
existing provider seam rather than *owned* by Hermes core — lower priority for V1.

See `docs/architecture/EPIC-004_PROPOSAL.md` for the full evaluation.
