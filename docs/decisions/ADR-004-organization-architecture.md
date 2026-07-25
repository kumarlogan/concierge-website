# ADR-004: AGS Organization & Multi-Application Architecture

- **Status:** Proposed (planning)
- **Date:** 2026-07-19
- **Epic:** EPIC-002-005
- **Supersedes:** — (foundational; precedes ADR-001..003 in scope, but dated
  after them because it generalizes their single-app context)
- **Related:** [ORGANIZATION_ARCHITECTURE.md](../organization/ORGANIZATION_ARCHITECTURE.md),
  [MIGRATION_STRATEGY.md](../organization/MIGRATION_STRATEGY.md)

## Context

AGS today ships a single application (AGS Fertility) as one Cloudflare Workers
repo (`kumarlogan/concierge-website`). The brief requires AGS to be treated as a
**multi-application organization** with an expanding AI workforce, where every
application is independently deployable, portable across infrastructure
providers, and isolated from every other application.

We must decide the permanent shape of the Organization Layer, application
boundaries, infrastructure isolation, provider mobility, the AI workforce
model, the Hermes platform posture, and the repository layout — **before**
building the Hermes Admin Platform.

## Decision

Adopt a **three-layer organization architecture**:

1. **Layer 1 — Organization (permanent, cross-application):** owns Identity,
   Governance, Security, and an Infrastructure Registry. Sets *standards* that
   applications *consume*; never redefined per app.
2. **Layer 2 — Applications (independent business units):** each owns its full
   stack (DB, Worker, Pages, Storage, Secrets, APIs, Dashboards, Audit). No
   application depends on another's infrastructure.
3. **Layer 3 — AI Workforce (organizational resources):** workers are defined
   in an Organization AI Registry, initially often `inactive`, and assigned to
   applications via the registry — accessing app data only through published
   APIs.

**Binding principles (adopted):**
- *Organization First, Application Isolation, Infrastructure Isolation.*
- *Zero Trust Security, API-First Communication, Provider Independence.*
- *AI Workforce Ready, Dashboard Ready, Mobile Ready, Multi-Cloud Ready,
  Future-Proof, Documentation First.*

**Key sub-decisions:**
- **Scope exclusivity:** every component belongs to exactly one scope
  (Organization / Application / AI Worker); cross-scope communication occurs
  only via explicit APIs or contracts.
- **Provider mobility:** business logic depends on `shared/interfaces/`
  (DataStore, ObjectStorage, Queue, AuthProvider), not cloud-specific SDKs;
  providers are swappable via adapter shims; the Org Layer is provider-agnostic.
- **Hermes decoupling:** Hermes becomes a modular organizational platform
  reusable across all apps, with no coupling to AGS Fertility.
- **Repository:** monorepo with `organization/`, `applications/<x>/`,
  `shared/`, `hermes/`, `docs/` trees; one-way import direction
  (apps import shared/org, never reverse; no cross-app imports).

## Consequences

**Positive**
- New applications require minimal new organizational work (standards +
  registry reuse).
- Applications migrate/retire independently without affecting others or the Org
  Layer.
- Provider migration is an adapter-writing exercise, not a rewrite.
- AI workforce scales by registry entries, not architectural change.

**Negative / Costs**
- Full infrastructure isolation raises infra + ops cost vs. shared services.
- Provider-agnostic interfaces add early indirection.
- Org Layer governance requires discipline to avoid becoming a delivery
  bottleneck.

**Neutral**
- Current repo is reclassified as the AGS Fertility application package; its
  org-level docs are promoted to Layer 1. No code behavior changes.

## Alternatives Considered

- **Single shared infrastructure per app class** — rejected: violates
  isolation & mobility principles; cross-app blast radius.
- **Separate GitHub org per application** — deferred: monorepo with clear tree
  ownership achieves isolation now; split later only if app count justifies.
- **AI workers built per-application** — rejected: duplicates the workforce,
  breaks the organizational AI Registry model.
- **Cloudflare-coupled architecture** — rejected: contradicts the explicit
  multi-cloud / mobility goal.

## Validation

- Phase 0–4 of the Migration Strategy prove the model incrementally without
  production risk.
- The 2nd application (AGS Finance) is the acceptance test for "minimal new
  org work."
