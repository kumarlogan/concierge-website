# ADR-007 — AGS Hermes Platform Extraction Strategy

- **Status:** Proposed (planning only — not yet implemented)
- **Date:** 2026-07-19
- **Deciders:** Chief Architect (AGS), Human Product Owner (approval required)
- **Supersedes:** — (complements ADR-001..006)
- **Related:** EPIC-002-006 planning package, AI_OPERATING_MODEL.md

## Context

AGS has production-quality security infrastructure — an Identity & Authorization
Engine (`workers/src/auth/*`: provider registry, principal builder, data-driven
permission resolver, authorization middleware, audit writer), a Telegram Ops Bot
MVP, API specs, shared tooling, and CI/CD — all currently embedded in the AGS
Fertility application Worker.

The ratified target architecture (docs/organization/*, ADR-001..006) defines
three layers:

1. **Organization Layer** — governance, identity *model*, owner accounts, AI
   workforce registry, security policy, audit *policy*.
2. **Hermes Platform** — reusable operating platform owning identity services,
   permissions, auth providers, audit services, agent registry, agent lifecycle,
   automation, provider adapters, shared interfaces.
3. **Applications** — independent business units (AGS Fertility = #1; AGS Cyber,
   Hermes Quant = future) consuming Hermes via contracts.

The capabilities that belong to Hermes already exist but live inside the app. We
must extract them **without breaking AGS Fertility**, incrementally and
reversibly, preserving cloud-provider independence and an inactive-by-default
agent model.

## Decision

Adopt an **incremental, interface-first extraction** of the existing engine into
a standalone `hermes/` platform, executed in six reversible phases
(EPIC-002-006 §2):

- **Phase 0** Freeze & baseline (tag `baseline-002-006`, schema dump).
- **Phase 1** Introduce `hermes/interfaces` contracts via a non-behavioral shim.
- **Phase 2** Publish `hermes/identity`, `permissions`, `audit`, `providers` as
  workspace packages (bit-for-bit copy of current `auth/*`); app imports them.
- **Phase 3** Stand up Hermes as its own deployable unit; app calls it
  in-process first (no new network failure domain).
- **Phase 4** Move RBAC ownership to Hermes-owned storage via dual-write +
  compensating migration; canary before cutover.
- **Phase 5** Register + activate the Ops Bot as the first Hermes agent via the
  new Registry runtime (inactive-by-default enforced).
- **Phase 6** Delete `workers/src/auth`; app consumes `@hermes/*` only; scaffold
  future apps.

Every phase is gated by a feature flag (`HERMES_PLATFORM_MODE`) and a recorded
golden-request replay so any phase can roll back to the prior state with a flag
flip or one-row/one-migration revert.

## Rationale

- The engine is already **data-driven** (ADR-003) and **provider-abstracted**
  (`providers.ts` registry) — it was designed to be lifted out.
- Copying verbatim in Phase 2 preserves 141/141 passing tests and eliminates
  behavioral risk during extraction.
- In-process import in Phase 3 avoids introducing a distributed-systems failure
  mode before the boundary is proven.
- Dual-write + compensating migration in Phase 4 makes the only high-risk step
  (data ownership) safely reversible.
- Inactive-by-default agents satisfy the AI Operating Model §3 authority
  boundary and the user's explicit constraint.

## Alternatives Rejected

| Alternative | Why rejected |
|---|---|
| **Big-bang microservice rewrite** | Highest risk; violates "DO NOT break AGS Fertility" and "no unnecessary rewrites"; weeks of downtime exposure. |
| **Keep auth inside the app permanently** | Contradicts ratified target architecture; blocks AGS Cyber / Hermes Quant reuse; couples governance to one app. |
| **Adopt external IdP (Auth0/Okta/Clerk) now** | Premature; current engine is sufficient and already provider-abstracted; adds cost + vendor lock-in opposite to cloud-mobility goal. |
| **Extract only after building OCI adapters** | Inverts dependency order; interfaces should be proven on Cloudflare first (lowest risk) then adapted. |

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| RBAC data-ownership move breaks auth | Med | Dual-write, compensating migration `0002_rollback.sql`, canary, row-parity check |
| Import-graph refactor regresses app | Low–Med | Bit-for-bit copy; golden-request replay; flag-gated cutover |
| Registry runtime has bugs | Med | Phase 5 starts with single read-only agent (Ops Bot); inactive default contains blast radius |
| Future apps couple to app internals | Low | Dependency rules in §3 enforced by lint/CI |

## Consequences

- **Positive:** Clean Org / Hermes / App boundary; future apps onboard by
  consuming `@hermes/*`; cloud migration = adapter authoring only; AI workforce
  gains a real registry + lifecycle.
- **Negative / cost:** Temporary duplication of `auth/*` (Phase 2–3) and RBAC
  tables (Phase 4); additional CI checks; org must own Hermes repo governance.
- **Must hold:** AGS Fertility customer-facing behavior remains byte-identical
  throughout; all agents inactive until explicitly activated by a human.

## Validation Gates (all must pass before Phase N→N+1)

- `pnpm -r test` green (≥141 passing).
- Golden-request replay shows identical auth responses vs `baseline-002-006`.
- Phase 4 only: RBAC row-count parity + 50-principal permission parity.
- Phase 5 only: Ops Bot `status=operational` + audit rows present.

---

*Proposed ADR — requires Human Product Owner approval before any implementation.*
