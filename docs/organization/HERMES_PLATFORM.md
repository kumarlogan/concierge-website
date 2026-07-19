# Hermes Organization Platform

> **Status:** Planning only — no code, Workers, D1, migrations, APIs, or deployments.
> **Epic:** EPIC-002-005A · **ADR:** [ADR-005](../../docs/decisions/ADR-005-hermes-platform.md)
> **Companion docs:** [AI_WORKFORCE.md](./AI_WORKFORCE.md) · [PLATFORM_SERVICES.md](./PLATFORM_SERVICES.md) ·
> [PROVIDER_ABSTRACTIONS.md](./PROVIDER_ABSTRACTIONS.md) · [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) ·
> [ORGANIZATION_ROADMAP.md](./ORGANIZATION_ROADMAP.md)

This document promotes **Hermes from an application-specific assistant into the
permanent AGS Organization Platform**. AGS Fertility becomes **Application #1**
running on Hermes. The architecture supports unlimited future applications
without redesign.

---

## 1. Promotion Statement

Hermes is no longer "the AGS Fertility bot." Hermes is the **organizational
control plane** for AGS: it owns the AI workforce, the shared platform services,
the provider abstractions, and the organization governance — while owning **no
application business logic**.

```
AGS (Organization)
├── Hermes Platform (org-owned control plane)   ← this document
│   ├── AI Registry            (every worker registered here)
│   ├── AI Activation         (active / inactive toggle)
│   ├── Agent Assignment      (workers ↔ applications)
│   ├── Organization Governance
│   ├── Shared Services
│   ├── Shared Interfaces
│   ├── Shared Security
│   ├── Provider Adapters
│   └── Organization Audit
├── Application Layer
│   ├── AGS Fertility  (#1 — runs on Hermes today)
│   ├── AGS Cyber       (future)
│   ├── AGS Realty      (future)
│   ├── AGS Finance     (future)
│   ├── AGS Research    (future)
│   └── AGS Internal    (future)
└── Organization Layer (identity, security, standards — see ADR-004)
```

**Key reframing:** What exists today as `hermes-website/workers` (the
Operations Bot, the ops API) is reclassified as **Application #1's
implementation**, *consuming* Hermes platform services — not as Hermes itself.

---

## 2. What Hermes Owns (Platform Responsibilities)

| Platform capability | Scope | Notes |
|---|---|---|
| **AI Registry** | Org | Single source of truth for every AI worker (see [AI_WORKFORCE.md](./AI_WORKFORCE.md)) |
| **AI Activation** | Org | Workers are `inactive` until explicitly activated; flip = config only |
| **Agent Assignment** | Org | Maps registered workers to one or many applications via the registry |
| **Organization Governance** | Org | ADR process, standards enforcement, new-app onboarding |
| **Shared Services** | Org | Cross-app capabilities delivered through interfaces (e.g. notification, scheduling, audit) |
| **Shared Interfaces** | Org | The `shared/interfaces/` contracts (DataStore, ObjectStorage, Queue, IdentityProvider, …) |
| **Shared Security** | Org | Org-wide authn/authz standards, secret-handling patterns, zero-trust baseline |
| **Provider Adapters** | Org | Concrete implementations of the interfaces for each cloud (Cloudflare today) |
| **Organization Audit** | Org | Org-level audit log; applications emit to it via the Audit interface |

**What Hermes explicitly does NOT own:** any application's business logic,
database, UI, app-specific permissions, or infrastructure. Those live in the
Application Layer.

---

## 3. AGS Fertility = Application #1

Today's `kumarlogan/hermes-website` repo is, in this model, **Application #1**.
Its current components map as:

| Current | Target classification |
|---|---|
| `workers/` (Cloudflare Worker + ops API) | Application #1 infrastructure |
| `workers/migrations/` (D1 schema, RBAC seed) | Application #1 database + permissions |
| `workers/docs/bots/OPERATIONS_BOT_SPECIFICATION.md` | Application #1 bot spec |
| Telegram bot (callOps) | Application #1 consumer of Hermes Engineering/Operations workers |
| `docs/` (architecture, api, database, security, decisions) | Split: org-level → `organization/`, app-level → `applications/ags-fertility/` |

No code change is implied. This is a **classification and ownership** statement
that the migration strategy (ADR-004 Phase 1–2) will enact.

---

## 4. Unlimited Applications Without Redesign

Adding **Application #N** requires only:
1. A new `applications/ags-<n>/` tree (its own infra, DB, secrets).
2. Registration in the Organization Layer (identity + DNS + standards adoption).
3. Optional assignment of existing Hermes workers via the AI Registry.

**No** change to Hermes internals, **no** change to other applications, **no**
redesign of the Organization Layer. The platform is fixed; applications are
pluggable.

---

## 5. Relationship to ADR-004

ADR-004 defined the three-layer organization (Organization / Application / AI
Workforce) and the monorepo shape. This document (and ADR-005) **refine Layer 3
and the Org Layer's platform responsibilities** by naming Hermes as the concrete
owner of the AI Workforce and Shared Services. ADR-004 remains the governing
decision; ADR-005 specializes it for the Hermes platform.

See also: [DEPENDENCY_RULES.md](./DEPENDENCY_RULES.md) (one-way import rules),
[PROVIDER_ABSTRACTIONS.md](./PROVIDER_ABSTRACTIONS.md) (mobility),
[ORGANIZATION_ROADMAP.md](./ORGANIZATION_ROADMAP.md) (phased, reversible).
