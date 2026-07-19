# Organization Roadmap (Current → Target)

> **Status:** Planning only — zero production risk until migration begins.
> Companion to [HERMES_PLATFORM.md](./HERMES_PLATFORM.md) and
> [ADR-005](../../docs/decisions/ADR-005-hermes-platform.md).
> Builds on ADR-004 Migration Strategy Phase 0–6.

Each phase is **independently reversible** (git revert or branch delete). No
phase modifies running production behavior until explicitly stated.

---

## Current State
- Single repo `kumarlogan/hermes-website`, one Cloudflare Worker app
  (AGS Fertility = Application #1, implicit).
- Hermes present only as the app's assistant/bot — **not yet formalized** as a
  platform.
- Org-level docs scattered at repo root; no `organization/`, `shared/`,
  `hermes/` trees.

---

## Phase 0 — Ratify & Document ✅ (this epic)
- Approve ADR-004 (org architecture) + **ADR-005** (Hermes platform).
- Create `docs/organization/` platform docs (this set) + update org README.
- **Risk:** none (docs only).

## Phase 1 — Establish Organization & Shared Trees (repo-only)
- Create `organization/`, `shared/interfaces/`, `hermes/` in the same repo.
- Define interface stubs (no impl): `DataStore`, `ObjectStorage`, `Queue`,
  `IdentityProvider`, `NotificationProvider`, `Scheduler`, `SecretProvider`,
  `LoggingProvider`.
- Relocate org-scoped docs per ADR-004 relocation map.
- **Risk:** none (no runtime reference yet).

## Phase 2 — Classify Application #1
- Move `workers/` + app docs under `applications/ags-fertility/`.
- Confirm pnpm workspace still builds/deploys identically.
- **Risk:** low (structural move; deploy verified after).

## Phase 3 — Stand Up Hermes Platform Services (inactive)
- Implement `hermes/` platform services against the interfaces (adapters for
  Cloudflare). Ship **inactive** — not yet called by App #1.
- **Risk:** low (new code path, not yet wired to prod traffic).

## Phase 4 — AI Registry MVP
- Deploy the AI Registry + Activation + Assignment services (org scope).
- Register existing Hermes workers as `inactive`; assign 2–3 to Application #1.
- **Risk:** low (registry is additive; activation gated).

## Phase 5 — Second Application (proves the model)
- Scaffold `applications/ags-cyber/` (or another) reusing `shared/` + Hermes
  workers. Own Cloudflare account/namespace, D1, secrets.
- **Risk:** low (new isolated app; no impact on App #1).

## Phase 6 — Provider Mobility Pilot
- Implement one non-Cloudflare adapter (e.g. OCI) behind an interface.
- Pilot on a **branch/non-prod** app only.
- **Risk:** contained (never merged to prod until validated).

## Phase 7 — Multi-Tenant Org Layer
- Extend Org Identity + Registry to model multiple orgs/apps/envs/workforces.
- **Risk:** low (additive to org layer).

---

## Reversibility Summary
| Phase | Revert method | Prod impact if reverted |
|---|---|---|
| 0 | delete docs | none |
| 1–2 | git revert structural moves | none (build verified) |
| 3–4 | keep adapters inactive / unassign workers | none |
| 5 | delete new app tree | none (App #1 untouched) |
| 6 | delete branch | none (never in prod) |
| 7 | feature-flag off | none |

No phase requires architectural redesign of earlier phases.
