# AGS Organization Architecture

> **Status:** Planning only — no implementation, code, infrastructure, or deployment.
> **Epic:** EPIC-002-005 · **ADR:** [ADR-004](../../docs/decisions/ADR-004-organization-architecture.md)
> **Companion docs:** [Migration Strategy](./MIGRATION_STRATEGY.md) · [Repository Structure](./REPOSITORY_STRUCTURE.md)

This document establishes AGS as a **multi-application organization** that owns
independent business units and an expanding AI workforce, rather than a single
application. It is the reference architecture for everything in the
`docs/organization/` tree.

---

## 1. Organization Architecture (Layer 1)

AGS is an **organization**, not an application. A permanent **Organization Layer**
owns everything that belongs to AGS as a whole rather than to any single product.

```
AGS (Organization)
├── Layer 1 — Organization (permanent, cross-application)
│   ├── Identity          (owners, admins, global auth, directory, AI registry)
│   ├── Governance        (policies, standards, ADR repo, architecture)
│   ├── Security          (org security, audit framework, compliance, crypto)
│   └── Infra Registry    (Cloudflare accounts, OCI tenancies, GitHub org, DNS)
├── Layer 2 — Applications (independent business units)
│   ├── AGS Fertility    (today)
│   ├── AGS Finance      (future)
│   ├── AGS Trading      (future)
│   └── …                (research, legal, realty, labs, health, ventures)
└── Layer 3 — AI Workforce (organizational resources, assigned to apps)
    ├── Executive / Engineering / Operations / Business / Medical / Intelligence
    └── AI Registry (metadata for every worker)
```

**Ownership rule:** Organization-Layer resources set *standards*; applications
*consume* them. Applications never redefine organization-level concerns (auth,
encryption, logging, DNS) — they import the standard and configure locally.

### 1.1 Identity (Organization scope)
- Organization Owners & Administrators (the human control plane).
- Global Authentication provider (single sign-on boundary for the org).
- Organization Identity + Directory (who exists in AGS, independent of app).
- **AI Identity Registry** — every AI worker gets an org-level identity (see §6).

### 1.2 Governance (Organization scope)
- Organization Policies & Standards (architecture, documentation, security).
- **ADR Repository** — all architectural decisions live here, org-wide.
- Review & approval workflow for new applications joining the org.

### 1.3 Security (Organization scope)
- Organization Security Policies (applied uniformly across apps).
- Audit Framework (org-wide audit schema; apps emit to it).
- Compliance & Encryption Standards (defined once, inherited everywhere).
- Identity Standards (how any principal — human or AI — is authenticated).

### 1.4 Infrastructure Registry (Organization scope)
- Inventory of org resources: Cloudflare accounts, OCI tenancies, GitHub
  org, DNS ownership, monitoring/logging/secret-management standards.
- Applications **reference** registry entries; they do not own the accounts.

---

## 2. Multi-Application Architecture (Layer 2)

Each application is an **independent business unit** that owns its full stack:

| Application owns | Notes |
|---|---|
| Identity (app-local users/roles) | Distinct from Org Identity; app users are a subset mapped to org principals |
| Database | Private D1 / future portable store |
| Infrastructure | Own Worker, Pages, R2, KV, Queues, Secrets |
| APIs & Workers | Self-contained; no cross-app runtime calls |
| Storage, Monitoring, Dashboards | Isolated per app |
| AI Workers (assigned) | Consumed from the org AI Registry, not built per app |
| Documentation, Deployments, Audit History | App-local, org-standardized format |

**Independence guarantee:** any application can be independently deployed,
backed up, restored, archived, migrated, or retired **without affecting** any
other application or the Organization Layer.

**No cross-application infrastructure dependency.** App A must never require
App B's database, worker, or secrets to function.

---

## 3. Organization vs Application Boundaries

Every component belongs to **exactly one scope**. Cross-scope communication
happens **only through explicit APIs or contracts** — never via shared internal
state.

| Scope | Owns | Must NOT own |
|---|---|---|
| **Organization** | Identity, Governance, AI Registry, Standards, Global Security, Shared Libraries | Application business logic, app databases |
| **Application** | Infrastructure, Database, APIs, Dashboards, App Users, Business Logic | Org-wide auth/security policy, other apps' data |
| **AI Worker** | Capabilities, Prompts, Permissions, Memory, Assigned Apps, Interfaces | Application infrastructure, org governance |

**Contract rule:** A shared library (org scope) may be *imported* by an
application, but the application may not modify the library's internals. An AI
worker (AI scope) is *assigned* to an application via the registry; it accesses
app data only through the app's published API.

---

## 4. Infrastructure Isolation Architecture

Each application receives **fully separate infrastructure**. The goal: a failure,
breach, quota, or migration in one app is invisible to all others.

```
AGS Fertility          AGS Finance (future)
┌──────────────┐       ┌──────────────┐
│ Worker       │       │ Different     │
│ Pages        │       │ Worker       │
│ D1 (DB)      │       │ Different     │
│ R2 (Storage) │       │ DB           │
│ KV           │       │ Different     │
│ Queues       │       │ Storage      │
│ Secrets      │       │ Different     │
└──────────────┘       │ Secrets      │
                        └──────────────┘
```

Isolation is enforced at three levels:
1. **Account/Project separation** — distinct Cloudflare accounts or at minimum
   distinct namespaces/projects per app (recommended: per-app Cloudflare
   account under one org, or per-app OCI compartment).
2. **Secret separation** — each app's secrets live in its own secret store;
   never shared.
3. **Data separation** — each app owns its database; no cross-database joins.

---

## 5. Infrastructure Mobility Strategy

**Goal:** AGS must be able to migrate off Cloudflare (or any single provider)
without redesign, and each application migrates **independently**.

Principles:
- **Interface over implementation.** Business logic depends on provider
  *interfaces* (e.g. `DataStore`, `ObjectStorage`, `Queue`, `AuthProvider`)
  defined in `shared/interfaces/`, not on Cloudflare-specific SDKs.
- **Provider shim layer.** Each app ships an adapter implementing the shared
  interface for its current provider. Migrating = writing a new adapter; app
  logic is untouched.
- **Portable data.** Prefer open, exportable data formats and documented
  schemas so a D1 → Postgres/SQLite/Spanner move is a data migration, not a
  rewrite.
- **Org Layer is provider-agnostic.** Organization Identity, Governance,
  Security, and the AI Registry are defined as standards/concepts, not as
  Cloudflare services, so they survive any provider change.
- **Independent migration waves.** App A can move to Provider X while App B
  stays on Cloudflare; the AI workforce and Org Layer are unaffected.

**Avoided lock-in:**
- No app hard-codes `cloudflare:` URLs or Workers-only APIs in business logic.
- Queues/R2/KV usage is wrapped behind interfaces so the backend is swappable.
- DNS is owned at org level (registry), so re-pointing is an org action, not
  per-app.

---

## 6. AI Workforce Architecture

AGS manages a **growing AI workforce** as organizational resources. Workers are
defined at org level (in the AI Registry), initially often **inactive**, and
later assigned to one or many applications **without redesign**.

### 6.1 Worker families (illustrative, not exhaustive)
- **Executive AI** — CEO, COO, CTO, CFO, CMO, CRO, CLO, Chief Compliance/
  Security/Risk/Data/Strategy AI.
- **Engineering AI** — Hermes Architect, Developer, Reviewer, QA, DevOps,
  Cloud Engineer, Infrastructure, Database Engineer, Documentation, Release
  Manager, Performance Engineer, Security Engineer.
- **Operations AI** — Operations Manager, Lead Manager, Customer Success,
  Scheduling Assistant, Case Coordinator, Escalation Manager, Notification
  Manager, Reporting Manager.
- **Business AI** — Sales, Marketing, CRM, Finance, HR, Procurement,
  Analytics, Research Assistants.
- **Medical AI** (application-specific) — Patient Coordinator, Consultation
  Assistant, Clinic Liaison, Follow-up Coordinator, Documentation Assistant.
- **Intelligence AI** — Dashboard, KPI, Forecasting, Trend Analysis, Audit
  Intelligence, Compliance Intelligence, Executive Reporting Agents.

### 6.2 Lifecycle
- Workers are **registrable before activation** — metadata exists, status =
  `inactive`, no app depends on them yet.
- Activation = flipping status + assigning to app(s) via the registry. No
  architectural change required.
- Workers access application data **only through the app's published API**
  (see §3 boundary rule), preserving application isolation.

---

## 7. AI Registry Design

A single **Organization AI Registry** is the source of truth for every worker.

### 7.1 Record schema (metadata only — planning)
| Field | Purpose |
|---|---|
| `name` | Unique worker identifier |
| `description` | Human summary of role |
| `scope` | Organization / Application (which app(s) it may serve) |
| `capabilities` | What it can do (skills, tools) |
| `required_permissions` | Permission keys it needs from assigned apps |
| `active` | `true` / `false` — independently toggled |
| `assigned_applications` | List of app IDs currently using it |
| `supported_interfaces` | Channels (Telegram, dashboard, API, CLI) |
| `version` | Worker version |
| `owner` | Responsible team/principal |
| `dependencies` | Other workers or services it needs |
| `status` | `inactive` / `active` / `deprecated` |
| `documentation` | Link to worker spec |
| `adr_references` | Related ADRs |

### 7.2 Governance
- Registry is **org-scoped**; applications read assignments, do not own entries.
- Adding a worker = create record (status `inactive`). Activating = status flip
  + assignment. Retiring = `deprecated` (no deletion of history).

---

## 8. Hermes Platform Architecture

Hermes evolves from a single assistant into a **modular organizational platform**
— a reusable ecosystem of specialized agents usable by **every** AGS
application, with **no coupling to AGS Fertility**.

- **Decoupling:** Hermes core is provider/tenant-agnostic. Application-specific
  behavior lives in *skills* and *assignments*, not in Hermes internals.
- **Reusability:** The same Hermes engineering/operations workers serve Finance,
  Trading, Research, etc., by reading per-app configuration from the registry.
- **Structure (proposed):** `hermes/` tree with `executive/`, `engineering/`,
  `operations/`, `intelligence/`, `business/`, `registry/` — each a
  self-contained agent module consumable by any app.
- **Tenancy:** Hermes instances are parameterized by organization + application
  context, enabling future multi-tenant operation without rewrite.

---

## 9. Repository Structure Recommendation

Refined from the illustrative layout. The current repo
(`kumarlogan/hermes-website`, a pnpm monorepo) becomes the **AGS Fertility
application package** inside a larger org workspace.

```
ags-org/                         # GitHub organization (new)
├── organization/                # Layer 1 — org-wide, provider-agnostic
│   ├── architecture/            # this doc, diagrams
│   ├── governance/              # policies, review workflow
│   ├── identity/                # org identity, AI identity registry spec
│   ├── security/                # org security, audit framework, crypto std
│   ├── ai-workforce/           # AI Registry + worker family specs
│   └── standards/              # architecture/doc/security standards
├── applications/
│   ├── ags-fertility/          # ← today's hermes-website/workers
│   ├── ags-finance/            # future
│   └── ags-trading/           # future
├── shared/                     # cross-app, org-owned
│   ├── auth/                   # org auth interfaces + adapters
│   ├── libraries/              # shared, import-only
│   ├── interfaces/             # provider interfaces (DataStore, Queue, …)
│   ├── observability/          # logging/monitoring standards
│   ├── deployment/             # portable deploy tooling
│   └── infrastructure/         # provider shims (cloudflare/, oci/, …)
├── hermes/                     # Hermes platform (org asset)
│   ├── executive/ engineering/ operations/ intelligence/ business/ registry/
└── docs/                       # org-level documentation hub
```

See [REPOSITORY_STRUCTURE.md](./REPOSITORY_STRUCTURE.md) for the detailed
mapping from the current repo to this layout, and
[MIGRATION_STRATEGY.md](./MIGRATION_STRATEGY.md) for the phased move.

---

## 12. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Org Layer becomes a bottleneck for app delivery | Slow onboarding of new apps | Strict "standards, not gatekeeping" rule; apps self-serve from registry |
| Over-isolation raises duplicated cost | Higher infra + ops overhead | Shared *libraries* (not shared *runtime*) reduce duplication |
| AI workers over-reach app boundaries | Privacy/security breach | Workers access apps only via published APIs + scoped permissions |
| Provider-agnostic interfaces add indirection | Slower feature work early | Interfaces introduced incrementally; only at real boundaries |
| Monorepo sprawl | Cognitive overload | Clear scope ownership; each tree has a single owner team |
| Registry drift (docs ≠ reality) | Broken assignments | Registry is the contract; CI checks assignments resolve |

---

## 13. Trade-offs

- **Isolation vs. Cost** — full separation costs more than shared infra; we
  accept the cost for independence and portability.
- **Standards vs. Velocity** — org standards slow the first app slightly but
  make the *nth* app nearly free.
- **Interfaces vs. Simplicity** — abstraction layers add code now to save
  rewrites later; justified by the explicit mobility goal.
- **Central Registry vs. Autonomy** — a single AI Registry reduces chaos but
  requires governance discipline; mitigated by inactive-by-default workers.

---

## 14. Future Expansion Roadmap

| Phase | Focus | Enables |
|---|---|---|
| **P0 (now)** | Ratify org architecture + ADR-004; establish `organization/` + `shared/interfaces/` | Foundation for everything |
| **P1** | Extract AGS Fertility cleanly into `applications/ags-fertility/` | Proves the app-isolation pattern |
| **P2** | Stand up AGS Finance as a 2nd app reusing `shared/` | Validates "new app = minimal org work" |
| **P3** | AI Registry MVP + assign 2–3 inactive workers to Fertility | Proves AI-workforce lifecycle |
| **P4** | Provider shim for one non-Cloudflare backend (pilot) | Proves mobility on one app |
| **P5** | Multi-tenant org layer (multiple orgs/apps/envs) | Satisfies future multi-tenant requirement |
| **P6** | Dashboards per layer (org → app → AI → ops) | Read-only consumption of existing data |

No phase requires architectural redesign of earlier phases.
