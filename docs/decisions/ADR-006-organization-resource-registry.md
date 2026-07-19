# ADR-006: Organization Identity, Environment & Resource Registry

- **Status:** Proposed (planning)
- **Date:** 2026-07-19
- **Epic:** EPIC-002-005B
- **Builds on:** [ADR-004](../decisions/ADR-004-organization-architecture.md)
  (three-layer org) + [ADR-005](../decisions/ADR-005-hermes-platform.md)
  (Hermes as platform). Does not supersede them; specializes the registry/identity
  layer they implied.
- **Related docs:** [IDENTITY_MODEL.md](./IDENTITY_MODEL.md) ·
  [RESOURCE_REGISTRY.md](./RESOURCE_REGISTRY.md) ·
  [ENVIRONMENT_MODEL.md](./ENVIRONMENT_MODEL.md) ·
  [INFRASTRUCTURE_INVENTORY.md](./INFRASTRUCTURE_INVENTORY.md) ·
  [AI_REGISTRY_V2.md](./AI_REGISTRY_V2.md) ·
  [LIFECYCLE_MODEL.md](./LIFECYCLE_MODEL.md) ·
  [DISCOVERY_MODEL.md](./DISCOVERY_MODEL.md) ·
  [DEPENDENCY_GRAPH.md](./DEPENDENCY_GRAPH.md)

## Context

ADR-004/005 established the three-layer organization and named Hermes as the
platform owning the AI workforce and shared services. They did not define the
**authoritative inventory** Hermes needs to discover, orchestrate, and govern
infrastructure — nor the **identity hierarchy** that scopes permissions. Without
a Resource Registry and Identity Model, Hermes would hardcode topology (vendor
lock-in) and permissions would leak across scopes. EPIC-002-005B requires both,
scaling to unlimited orgs/apps/envs/agents/providers/resources without redesign.

## Decision

1. **Resource Registry** is the single authoritative inventory of every AGS
   resource. Schema includes `resource_id, organization, application,
   environment, provider, region, resource_type, name, status, owner, tags,
   dependencies, created, modified, version, health, criticality, lifecycle`.
   `provider` and `resource_type` are **data fields** — unknown values are valid,
   so new providers/types need no schema change.
2. **Identity Model** is a strict hierarchy: Organization → Application →
   Environment → (Service | AI | Human). Each level is its own scope;
   **permissions never leak upward**. Composite namespaced IDs key the tree.
3. **Environment Model**: each application has independent environments
   (dev/test/staging/prod/sandbox/experimental); every environment owns fully
   separate resources; **no shared production infrastructure**.
4. **AI Registry V2** expands the worker record with `agent_id, role,
   capabilities, environment_scope, provider, health, memory, knowledge_sources,
   tools, security_classification, identity_ref`, etc. Activation stays
   config-only; future agents need no redesign.
5. **Discovery Model**: Hermes queries the registry by filter; provider is read
   from the record and handled by an adapter. **No hardcoded infrastructure.**
6. **Dependency Graph**: allowed edges are structural (org→app→env→resource) or
   explicit (deps, assignments); cross-app/cross-env (into prod) and upward
   permission leaks are forbidden and rejected at activation time.
7. **Lifecycle Model**: resources use planning→provisioning→active⇄maintenance→
   suspended→archived→deleted(soft); agents overlay inactive→assigned→active→
   retired. Lifecycle is a first-class discovery dimension.

## Consequences

**Positive**
- Hermes discovers everything; zero hardcoded topology → cloud portability held.
- Unlimited orgs/apps/envs/agents/providers/resources via namespaced IDs + data
  fields; no redesign to add any of them.
- Permission scoping prevents blast-radius leaks; audit trail via soft-deletes.
- Dashboards, automation, and future tooling are just saved queries over the registry.

**Negative / Costs**
- Registry must itself be highly available and kept in sync (drift risk) —
  mitigated by CI checks (future) + adapters that reconcile.
- More metadata to maintain per resource; offset by automation (future epic).
- Governance discipline needed to keep `provider`/`resource_type` honest.

**Neutral**
- No production code, infra, migration, or deployment changed by this ADR.
- ADR-004/005 unchanged except by reference from this ADR + the org README.

## Alternatives Considered

- **Hermes hardcodes resource lists per app** — rejected: vendor lock-in,
  violates Provider Independence, breaks discovery goal.
- **Flat identity (no hierarchy)** — rejected: permits upward permission leak,
  violates Zero Trust.
- **Shared prod infra across envs for cost** — rejected: violates isolation
  principle and ENVIRONMENT_MODEL guarantee.
- **Fixed resource-type enum** — rejected: blocks future providers/types without
  redesign; data-field approach chosen instead.

## Validation

- INFRASTRUCTURE_INVENTORY.md seeds today's AGS Fertility resources as registry
  records — proves the schema fits reality.
- Discovery queries in DISCOVERY_MODEL.md answer every brief example.
- AI_REGISTRY_V2.md maps the existing Telegram bot to a V2 record — proves the
  model fits Application #1 today.
- Adding a 2nd org/app/provider (Phase 5 of ORGANIZATION_ROADMAP) is the
  acceptance test for "unlimited without redesign."
