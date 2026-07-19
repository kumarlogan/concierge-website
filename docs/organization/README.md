# AGS Organization Architecture — Index

> **Epic:** EPIC-002-005 (org architecture) + EPIC-002-005A (Hermes platform) +
> EPIC-002-005B (identity, environment & resource registry).
> **Planning only** — no code, infra, migrations, deployments, bots, APIs, or secrets.

AGS is a **multi-application organization** with an AI workforce owned by the
**Hermes Organization Platform**. AGS Fertility is **Application #1**. Every
resource is inventoried in a provider-neutral Resource Registry; every identity
has a scoped place in the hierarchy.

## Governing Decisions
| ADR | Topic |
|---|---|
| [ADR-004](../decisions/ADR-004-organization-architecture.md) | Three-layer org architecture, isolation, mobility, repo shape |
| [ADR-005](../decisions/ADR-005-hermes-platform.md) | Hermes as the permanent AGS Organization Platform |
| [ADR-006](../decisions/ADR-006-organization-resource-registry.md) | Identity hierarchy, environments, resource registry, AI Registry V2, discovery, dependency graph, lifecycle |

## Organization Architecture (EPIC-002-005)
| Doc | Coverage |
|---|---|
| [ORGANIZATION_ARCHITECTURE.md](./ORGANIZATION_ARCHITECTURE.md) | Org/App/AI layers, boundaries, isolation, mobility, AI registry, Hermes, repo, risks, trade-offs, roadmap |
| [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) | Detailed repo layout + current→target relocation map |
| [MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) | Phased migration, zero prod risk |

## Hermes Platform (EPIC-002-005A)
| Doc | Coverage |
|---|---|
| [HERMES_PLATFORM.md](./HERMES_PLATFORM.md) | Hermes promotion, platform responsibilities, App #1 classification |
| [AI_WORKFORCE.md](./AI_WORKFORCE.md) | AI Registry model, worker catalog, lifecycle, boundaries |
| [PLATFORM_SERVICES.md](./PLATFORM_SERVICES.md) | Cross-app platform services catalog + ownership rules |
| [PROVIDER_ABSTRACTIONS.md](./PROVIDER_ABSTRACTIONS.md) | Interface/adapter mobility model |
| [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) | One-way scope dependency rules |
| [ORGANIZATION_ROADMAP.md](./ORGANIZATION_ROADMAP.md) | Phased, reversible current→target roadmap |

## Identity, Environment & Resource Registry (EPIC-002-005B)
| Doc | Coverage |
|---|---|
| [IDENTITY_MODEL.md](./IDENTITY_MODEL.md) | Org→App→Env→Service/AI/Human hierarchy; no upward permission leak |
| [RESOURCE_REGISTRY.md](./RESOURCE_REGISTRY.md) | Authoritative inventory schema; provider/data-field neutrality |
| [ENVIRONMENT_MODEL.md](./ENVIRONMENT_MODEL.md) | Independent envs; no shared prod infra |
| [INFRASTRUCTURE_INVENTORY.md](./INFRASTRUCTURE_INVENTORY.md) | Current AGS Fertility resources as registry seed |
| [AI_REGISTRY_V2.md](./AI_REGISTRY_V2.md) | Expanded agent record; inactive-by-default; future-proof |
| [LIFECYCLE_MODEL.md](./LIFECYCLE_MODEL.md) | Resource + agent lifecycle states |
| [DISCOVERY_MODEL.md](./DISCOVERY_MODEL.md) | Hermes queries registry; never hardcodes |
| [DEPENDENCY_GRAPH.md](./DEPENDENCY_GRAPH.md) | Allowed/forbidden edges; isolation enforcement |

## Principles
Organization First · Application Isolation · Infrastructure Isolation · Zero Trust
· API-First · Provider Independence · AI Workforce Ready · Dashboard Ready ·
Mobile Ready · Multi-Cloud Ready · Future-Proof · Documentation First.

## Scope note
All files here are **planning artifacts**. None modify application code, Workers,
D1, migrations, APIs, infrastructure, or secrets.
