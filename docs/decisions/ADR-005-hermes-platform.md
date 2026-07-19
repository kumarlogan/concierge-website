# ADR-005: Hermes as the AGS Organization Platform

- **Status:** Proposed (planning)
- **Date:** 2026-07-19
- **Epic:** EPIC-002-005A
- **Supersedes / Extends:** Specializes [ADR-004](../organization/ORGANIZATION_ARCHITECTURE.md)
  (three-layer org architecture). ADR-004 remains the governing decision; this
  ADR names Hermes as the concrete owner of the AI Workforce + Shared Services.
- **Related:** [HERMES_PLATFORM.md](../organization/HERMES_PLATFORM.md),
  [AI_WORKFORCE.md](../organization/AI_WORKFORCE.md),
  [PLATFORM_SERVICES.md](../organization/PLATFORM_SERVICES.md),
  [PROVIDER_ABSTRACTIONS.md](../organization/PROVIDER_ABSTRACTIONS.md),
  [DEPENDENCY_RULES.md](../organization/DEPENDENCY_RULES.md),
  [ORGANIZATION_ROADMAP.md](../organization/ORGANIZATION_ROADMAP.md)

## Context

ADR-004 established AGS as a three-layer organization (Organization / Application
/ AI Workforce) with a monorepo shape. It did not name *who* owns the AI
Workforce or the cross-application shared services. The brief EPIC-002-005A
requires promoting Hermes from an application-specific assistant into the
**permanent AGS Organization Platform**, with AGS Fertility as Application #1,
and unlimited future applications without redesign.

## Decision

1. **Hermes is the AGS Organization Platform** (Organization scope). It owns:
   AI Registry, AI Activation, Agent Assignment, Organization Governance, Shared
   Services, Shared Interfaces, Shared Security, Provider Adapters, and
   Organization Audit.
2. **Hermes owns no application business logic.** Applications own their DB,
   Worker, Pages, storage, secrets, permissions, business rules, APIs, and UI.
3. **AGS Fertility is formally Application #1**, running on Hermes. Its current
   `hermes-website/workers` repo is reclassified as Application #1's
   implementation *consuming* Hermes platform services.
4. **AI Workforce is Hermes-owned and org-scoped.** Every worker is registered,
   `inactive` by default, assigned via the registry, and accesses app data only
   through the app's published API using scoped permissions.
5. **Provider mobility is preserved:** business logic depends on
   `shared/interfaces/`; Cloudflare is an implementation. Changing providers
   replaces adapters only.
6. **One-way dependency rules** (see DEPENDENCY_RULES.md): apps import
   shared/org/hermes; never reverse; no cross-app imports; cross-scope
   communication only via APIs/contracts.

## Consequences

**Positive**
- Clear ownership: Hermes = platform/orchestration; apps = business logic.
- Unlimited applications need no Hermes or Org-Layer redesign — only a new
  `applications/<x>/` tree + registry assignment.
- AI workforce scales via registry entries, not code changes.
- Cloud portability preserved via interface/adapter split.

**Negative / Costs**
- Platform services add an orchestration layer (complexity) — justified by the
  multi-app goal.
- Governance discipline required to keep Hermes from drifting into app logic.
- Initial interface/adapter scaffolding is upfront work (Phase 1–3).

**Neutral**
- No production code, infra, migration, or deployment changed by this ADR.
- ADR-004 unchanged except by reference to ADR-005.

## Alternatives Considered

- **Hermes stays app-specific** — rejected: contradicts the explicit
  organization-platform requirement and blocks workforce reuse.
- **Applications own their AI workers** — rejected: duplicates the workforce,
  breaks the org AI Registry model (ADR-004).
- **Hermes owns some business logic** — rejected: violates Application
  Isolation and the "never both scopes" rule.
- **Tight Cloudflare coupling** — rejected: contradicts Provider Independence
  (ADR-004) and the mobility goal.

## Validation

- Phase 0–5 of ORGANIZATION_ROADMAP prove the model incrementally with zero
  production risk.
- Application #2 (AGS Cyber/Realty/etc.) is the acceptance test for "no
  redesign needed."
- Provider Mobility Pilot (Phase 6) validates the adapter-only migration claim.
