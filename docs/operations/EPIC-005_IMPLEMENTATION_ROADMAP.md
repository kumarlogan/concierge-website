# EPIC-005 — Implementation Roadmap

**Phase:** 8 — Milestone roadmap
**Status:** Architecture-only. Milestones are design commitments, not code.
**Date:** 2026-07-20

---

## Design Constraints (from EPIC-005 Strict Rules)

Every milestone MUST be:
- **Independent** — shippable alone
- **Reversible** — safe to roll back
- **Provider-neutral** — no vendor logic in core
- **Testable** — verifiable in isolation
- **Auditable** — every change emits/records audit
- **Separately committable** — own PR, own review

No milestone may require another to be rewritten.

---

## Milestone Map

| ID | Milestone | Depends on | Provider-neutral? | Reversible? |
|----|-----------|-----------|-------------------|-------------|
| M0 | **Capability Model migration** — re-key registry to intention ids; add `UniversalCapability` shape; keep `Capability` as compat alias | — | ✅ | ✅ (alias removal later) |
| M1 | **Manifest V2 loader** — extend `ProviderManifest` → `ProviderManifestV2`; extend `createManifestLoader` to read new fields; old manifests still parse | — | ✅ | ✅ |
| M2 | **Transport interface** — define `Transport` + `TransportRegistry`; wrap existing `executor` closure as `local-process` transport (no behavior change) | — | ✅ | ✅ |
| M3 | **Trust lifecycle state machine** — add provider lifecycle states + transitions (reuse fail-closed pattern from `execution-store`) | M1 | ✅ | ✅ |
| M4 | **Signature & checksum verification** — implement verify step in VALIDATED transition; pin `TRUSTED_SIGNERS` in config | M3 | ✅ | ✅ |
| M5 | **Sandbox policy enforcement** — apply `sandboxPolicy` at transport spawn (container/process boundary) | M2, M3 | ✅ | ✅ |
| M6 | **Provider Marketplace** — read-only aggregate over Trust lifecycle + Transport health | M2, M3 | ✅ | ✅ |
| M7 | **Selection Engine (scoring)** — implement `score()` + ranked fallback; weights in config | M6 | ✅ | ✅ |
| M8 | **Policy-Evaluator provider integration** — feed Selection result through existing `ExecutionPolicyEvaluator` as the gate | M6, M7 | ✅ | ✅ |
| M9 | **First provider manifest: claude-code** — author manifest + register implKeys against existing adapter seam | M1, M2, M3 | ✅ | ✅ |
| M10 | **First provider manifest: github** — manifest + implKeys (https+oauth transport) | M1, M2, M3 | ✅ | ✅ |
| M11 | **First provider manifest: cloudflare (manifest-driven)** — replace `cloudflareBundle` special-case with manifest + implKeys | M1, M2, M3, M9 | ✅ | ✅ |
| M12 | **AGS scenario end-to-end validation** — drive the Phase-7 flow through manifests only; assert zero AGS code in core | M8, M9, M10, M11 | ✅ | ✅ |

---

## Dependency Graph (no rewrite chains)

```
M0 ─┐
M1 ─┼──▶ M3 ─▶ M4
M2 ─┼──▶ M3 ─▶ M5
    │         M3 ─▶ M6 ─▶ M7 ─▶ M8 ─▶ M12
    │         M1 ─▶ M9/M10/M11 ─▶ M12
```

- M0, M1, M2 are **parallel, independent** starting points.
- M9/M10/M11 are **independent of each other** — each is its own provider, its own PR.
- M12 is the only milestone that touches all three reference providers, and only as a *validation* (no new core code).

---

## Commit Grouping (suggested)

| PR | Contains | Touches core? |
|----|----------|---------------|
| PR-0 | M0 capability re-key + compat alias | registry only |
| PR-1 | M1 manifest V2 schema + loader extension | loader only |
| PR-2 | M2 transport interface + in-memory wrapper | new file |
| PR-3 | M3 lifecycle state machine | new file |
| PR-4 | M4 signature verify | new file |
| PR-5 | M5 sandbox enforcement | transport only |
| PR-6 | M6 marketplace read-only | new file |
| PR-7 | M7 scoring engine | new file |
| PR-8 | M8 policy integration | coordinator injection |
| PR-9/10/11 | M9/M10/M11 manifests + implKeys | data + adapter wiring |
| PR-12 | M12 validation suite | tests only |

Each PR is independently reviewable and revertible.

---

## PHASE 9 — Documentation & Validation (EPIC-005.1)

**Status:** ✅ Complete.

- **Validation suite:** `services/providers/__tests__/epic-005.1.test.ts` — 12/12 passing.
  Covers the full lifecycle (discover → validate → authorize → load → execute → audit)
  plus 10 fail-closed scenarios (bad manifest, auth denied, timeout, health→SUSPENDED,
  unknown capability, provider-unavailable, transport failure, bad signature, etc.).
  Uses an injected fake spawner — no real binary, no network, no secrets.
- **Typecheck:** `tsc -p tsconfig.epic005.json --noEmit` → clean (DOM lib enabled for
  timer/stream support).
- **Authoring guide:** `docs/architecture/PROVIDER_AUTHORING_GUIDE.md` — the 4-step
  procedure to add a new provider with zero core edits, plus the trust-gate map and
  the proven failure-mode matrix. This is the primary onboarding doc for future
  provider contributors.

**Proof point:** The Universal Capability Platform is demonstrated end-to-end with the
Claude Code provider as the concrete proof vehicle — but no Claude-specific code exists
in `platform.ts`, `lifecycle.ts`, `marketplace.ts`, `transport/`, or `sdk.ts`. The
provider is pure data (manifest) + one factory. Architecture goal met.

---

## PHASE 10 — EPIC-005.2 Dynamic Provider Loading (follow-on epic)

**Status:** ✅ Complete (PHASE 1–8). Implemented on top of the EPIC-005.1 foundation.

EPIC-005.2 extends the static manifest/factory model into a **fully dynamic** one: Hermes
discovers, loads, and trust-admits provider code at runtime through a single generic,
provider-neutral path — with **zero core source changes** and **no provider-specific imports**
required to add a new provider.

### Deliverables

| Area | Artifact |
|------|----------|
| Discovery | `services/providers/discovery.ts` (filesystem/inline/remote; `packageDir` plumbing) |
| Loader | `services/providers/loader.ts` (generic `loadModule` → `ProviderPackageContract`) |
| Orchestration | `services/providers/manager.ts` (duplicate + collision guards; `scan`/`unload`/`reload`) |
| Trust gate | `services/providers/platform.ts` (`bootstrap` fail-closed; `setTrustConfig`) |
| Lifecycle | `services/providers/trust/lifecycle.ts` (`setConfig` for runtime policy) |
| Capabilities | `services/providers/capability.ts` (`ownerOf()` dynamic tracking) |
| Marketplace | `services/providers/marketplace-view.ts` (full-state view: ready/offline/rejected/unloaded/collisions) |
| Tests | `services/providers/dynamic.test.ts` (12 PHASE 7 scenarios) |
| Config | `hermes/vitest.epic005.config.ts` (node pool; excluded from workers tsconfig) |
| Docs | `EPIC-005.2_DYNAMIC_LOADING_DESIGN.md`, `EPIC-005.2_RUNTIME_GUIDE.md`, `EPIC-005.2_CONTRACT_AUTHORING.md` |

### Validation

- **PHASE 7 dynamic scenarios:** 12/12 passing under `vitest` (node pool, run from `workers/`).
- **EPIC-005.1 regression:** 12/12 passing — the foundation is unbroken.
- **Total:** 24/24 green. All I/O faked (no fs/network/secrets).
- **Typecheck:** `tsc -p tsconfig.epic005.tmp.json` → clean.

### Constraints honored (from mission)

- ✅ No core source changes needed to add a new provider (data + opaque module only).
- ✅ No provider-specific imports in Hermes services (`provider.ts` loaded via path, never imported).
- ✅ No custom registration functions (`manager.scan()` is the sole entry).
- ✅ Strict trust lifecycle, no bypass paths (single `bootstrap` → `admit` gate; fail-closed).
- ✅ Rejected providers remain visible (marketplace composes from `TrustLifecycle.records`).
- ✅ Provider-neutral throughout (only `kind`/`transport.kind` data fields; no vendor branches).

### New in EPIC-005.2 (beyond 005.1)

- Runtime **discovery** of provider packages (not just pre-known manifests).
- **Generic loader** that treats every provider's code as opaque data.
- **Capability collision** detection (both providers load; collision recorded, not fatal).
- **Full-state marketplace** incl. OFFLINE (unregistered transport) and UNLOADED (post-unload).
- **Runtime lifecycle ops:** `unload` / `reload` with record retention + location recovery.

---

## PHASE 11 — EPIC-005.5 Provider Runtime Guard (follow-on epic)

**Status:** ✅ Implemented & validated (not yet committed).

EPIC-005.5 closes the **runtime** gap EPIC-005.1 left open: after a provider is
`ACTIVE`, `execute()` ran `provider.execute(req)` with no further checks. The
**Provider Runtime Guard** is the provider-execution boundary between the
`ExecutionPolicyEvaluator` (policy admission) and the concrete `provider.execute()`
call — re-validating the runtime contract on every invocation, fail-closed.

### Deliverables

| Area | Artifact |
|------|----------|
| Runtime guard | `services/providers/runtime/guard.ts` (`ProviderRuntimeGuard`, 8 fail-closed checks) |
| Violation response | `services/providers/runtime/violation-model.ts` (`ViolationResponseEngine`: severity + declarative side-effects) |
| Marketplace projection | `services/providers/runtime/marketplace-security.ts` (`MarketplaceSecurityView.safeExecuteAnswer()` — read-only) |
| Barrel | `services/providers/runtime/index.ts` |
| Integration | `services/providers/platform.ts` (optional `runtimeGuard` ctor param; deny path → `errResult` + `PROVIDER_RUNTIME_DENIED` audit) |
| Tests | `services/providers/__tests__/epic-005.5.test.ts` (12 scenarios + 4 violation-engine + 2 projection) |
| Docs | `EPIC-005.5_RUNTIME_GUARD.md` |

### The 8 checks

`trust-state` · `tenant-scope` · `capability-authz` (`CAPABILITY_UNKNOWN`) ·
`permission-scope` (`PERMISSION_DENIED`) · `transport-authz` · `runtime-limits`
(timeout/concurrency) · `sandbox-requirements` · `audit-availability`.

### Validation

- **EPIC-005.5 suite:** 18/18 passing.
- **EPIC-005.1 regression:** 12/12 passing (no contract break; canonical codes preserved).
- **Full providers suite:** 54/54 passing.
- **Typecheck:** clean for `runtime/*`, `platform.ts`, and the suite.
- **Secret scan:** clean.

### Constraints honored

- ✅ Provider-neutral — pure data in/out; no vendor/Claude/AGS branches.
- ✅ Fail-closed — any uncertainty → DENY; never "allow on unknown".
- ✅ Non-breaking — existing platform error codes (`CAPABILITY_UNKNOWN`, `PERMISSION_DENIED`, …) preserved; guard only adds new deny paths.
- ✅ Crash-safe — guard never throws, even with a missing audit sink (`typeof this.audit` defenses).
- ✅ Injected via optional constructor param (`runtimeGuard?`) — independently testable, platform stays neutral.
- ✅ No AGS/Cloudflare/secret/prod-credential changes; no auto-commit (staged for review).

---

## Rules Adherence Check

- ✅ Independent — M0/M1/M2 start in parallel; providers independent.
- ✅ Reversible — every milestone is additive; aliases/feature flags allow rollback.
- ✅ Provider-neutral — no vendor branch added; all behavior data-driven.
- ✅ Testable — each milestone has a unit/integration boundary (registry, loader, transport, lifecycle, scoring).
- ✅ Auditable — lifecycle transitions emit audit (Phase 4 §7); selection emits rationale.
- ✅ Separately committable — 13 PRs, one per milestone group.
