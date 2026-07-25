# AGS Repository Structure

> **Status:** Planning only. Companion to
> [ORGANIZATION_ARCHITECTURE.md](./ORGANIZATION_ARCHITECTURE.md) and
> [ADR-004](../../docs/decisions/ADR-004-organization-architecture.md).

This maps the **current** repository to the **target** organization structure
and explains the refinements made to the illustrative layout from the brief.

---

## 1. Current State (ground truth)

- **Repo:** `kumarlogan/concierge-website` (single GitHub repo, pnpm workspace).
- **Stack:** Cloudflare Workers (`workers/` package) + Cloudflare Pages, D1.
- **Top-level docs:** `ARCHITECTURE.md`, `API.md`, `DATABASE.md`,
  `SECURITY.md`, `CHANGELOG.md`, `ROADMAP.md`, `PROJECT.md`,
  `PRODUCT_BOUNDARIES.md`, `AI_OPERATING_MODEL.md`, `DECISIONS.md`, etc.
- **Worker docs:** `workers/docs/{bots,operations,database,decisions,sprints,api,architecture,security}/`.
- **Decisions:** `docs/decisions/ADR-001..003`.

This repo is, in target terms, **the AGS Fertility application package** plus a
scatter of org-level docs that have not yet been separated into the
Organization Layer.

---

## 2. Target Structure (refined)

The brief's illustrative layout is sound. Refinements:

1. **Keep `applications/ags-fertility/` as a pnpm workspace package** inside
   the org monorepo (not a separate GitHub org) for now — simpler than N repos
   until app count justifies it. The structure still permits splitting later.
2. **Promote today's scattered top-level docs** into `organization/` or
   `applications/ags-fertility/` based on scope (see §3).
3. **Add `shared/interfaces/` explicitly** — the mobility strategy depends on
   it; the brief implied it but did not name it.
4. **Group Hermes by family** as listed in the brief; each family is an
   importable agent module.

```
ags-org/                         # GitHub org (or monorepo root)
├── organization/                # Layer 1 — org-wide
│   ├── architecture/           # ORGANIZATION_ARCHITECTURE.md, diagrams
│   ├── governance/             # policies, review workflow
│   ├── identity/               # org + AI identity registry spec
│   ├── security/               # SECURITY.md (org-level), audit framework
│   ├── ai-workforce/           # AI Registry + worker specs
│   └── standards/              # arch/doc/security style standards
├── applications/
│   ├── ags-fertility/          # ← today's workers/ + app docs
│   ├── ags-finance/            # future
│   └── ags-trading/            # future
├── shared/
│   ├── auth/                   # org auth interfaces + adapters
│   ├── libraries/              # shared, import-only code
│   ├── interfaces/             # DataStore, ObjectStorage, Queue, AuthProvider
│   ├── observability/          # logging/monitoring standards
│   ├── deployment/             # portable deploy tooling
│   └── infrastructure/         # provider shims (cloudflare/, oci/, …)
├── hermes/
│   ├── executive/ engineering/ operations/ intelligence/ business/ registry/
└── docs/                       # org documentation hub (index)
```

---

## 3. Doc Relocation Map (current → target)

| Current file | Target location | Scope |
|---|---|---|
| `ARCHITECTURE.md` | `applications/ags-fertility/docs/ARCHITECTURE.md` | Application |
| `API.md`, `DATABASE.md` | `applications/ags-fertility/docs/` | Application |
| `SECURITY.md` (org-level) | `organization/security/SECURITY.md` | Organization |
| `AI_OPERATING_MODEL.md` | `organization/ai-workforce/` | Organization |
| `PRODUCT_BOUNDARIES.md` | `organization/governance/` | Organization |
| `DECISIONS.md` + `docs/decisions/ADR-*` | `organization/governance/adr/` | Organization |
| `ROADMAP.md` | `organization/architecture/` (org roadmap) + app roadmaps | Mixed |
| `workers/docs/bots/OPERATIONS_BOT_SPECIFICATION.md` | `applications/ags-fertility/docs/bots/` | Application |
| `docs/database/*`, `docs/operations/*`, `docs/sprints/*` | `applications/ags-fertility/docs/` | Application |
| `docs/decisions/ADR-001..003` | `organization/governance/adr/` | Organization |

> Relocation is a documentation/org-action only. File *content* describing the
> Fertility app stays with the app; only org-level standards move up a layer.

---

## 4. Ownership & Boundaries in the Repo

- **One owner team per top-level tree.** `organization/` owned by the Org
  Architecture guild; each `applications/<x>/` owned by that app's team;
  `shared/` owned by a platform team; `hermes/` owned by the Hermes platform
  team.
- **Import direction is one-way:** `applications/*` and `hermes/*` import from
  `shared/` and `organization/standards/`; never the reverse.
- **No cross-app imports.** `applications/ags-finance/` cannot import from
  `applications/ags-fertility/`.
