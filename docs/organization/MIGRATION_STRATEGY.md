# AGS Migration Strategy (Current → Organization Architecture)

> **Status:** Planning only — no code, infra, DB, migration, or deployment.
> Companion to [ORGANIZATION_ARCHITECTURE.md](./ORGANIZATION_ARCHITECTURE.md)
> and [ADR-004](../../docs/decisions/ADR-004-organization-architecture.md).

This describes how to move from the **current single repo**
(`kumarlogan/hermes-website`, one Cloudflare Workers app) to the **target
multi-application organization** without breaking the live AGS Fertility
service at any step.

---

## Guiding Rules

1. **Never break production.** Every phase leaves AGS Fertility deployable and
   functioning.
2. **No big-bang rewrite.** Migrate structure and boundaries before any
   provider change.
3. **Docs/orgs first, code last.** Establish the Organization Layer and
   standards before touching application code.
4. **Mobility is a later, independent wave.** Provider portability work happens
   only after app isolation is proven.

---

## Phase 0 — Ratify & Document (no code change)
- Approve ADR-004.
- Create `docs/organization/` with the architecture, repo structure, and this
  strategy.
- **Zero runtime impact.** Pure documentation.

## Phase 1 — Establish the Organization Layer (repo-only)
- Create `organization/`, `shared/`, `hermes/` trees in the *same* repo
  (monorepo), moving org-scoped docs per the relocation map in
  [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md).
- Define `shared/interfaces/` (TypeScript interface stubs only — no
  implementation yet): `DataStore`, `ObjectStorage`, `Queue`, `AuthProvider`.
- AGS Fertility keeps working; nothing references the new interfaces yet.

## Phase 2 — Carve AGS Fertility into `applications/ags-fertility/`
- Move `workers/` and app docs under `applications/ags-fertility/`.
- Confirm the pnpm workspace still builds and deploys identically.
- This *proves* the application-isolation pattern on the one app we have.

## Phase 3 — Introduce a 2nd Application (validates the model)
- Scaffold `applications/ags-finance/` reusing `shared/` libraries and
  org standards.
- Finance gets its **own** Cloudflare account/namespace, D1, secrets.
- Demonstrates "new app requires minimal new organizational work."

## Phase 4 — AI Registry MVP
- Stand up the Organization AI Registry (metadata store + schema from
  ORGANIZATION_ARCHITECTURE §7).
- Register existing Hermes workers as `inactive`; assign 2–3 to Fertility via
  the registry. No new infra — assignment is configuration.

## Phase 5 — Provider Mobility Pilot (independent)
- Implement one `shared/interfaces/` adapter for a non-Cloudflare backend
  (e.g. OCI or a generic Node runtime) behind the interface.
- Pilot on **one** app (e.g. a throwaway branch of Fertility) to prove the
  shim works. No production provider change yet.

## Phase 6 — Multi-Tenant Org Layer
- Extend the Organization Identity + Registry to model multiple organizations,
  applications, environments, and AI workforces.
- Satisfies the future multi-tenant requirement without redesigning apps.

---

## Rollback & Safety

- Each phase is independently revertible (git revert of doc/structure moves).
- Phases 1–4 carry **no production risk** (docs + repo layout + inactive
  registry entries).
- Provider work (Phase 5) is branched and never merged until validated on a
  non-production app.

## What is explicitly NOT done here
- No application code is modified for behavior.
- No D1 schema/migration is created.
- No Cloudflare/OCl account is provisioned.
- No deployment or secret is touched.
- No bot or API is created.
