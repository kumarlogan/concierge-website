# AGS Master Roadmap

> **Status:** Active — single source of truth for the AGS ecosystem.
> **Created:** 2026-07-19 (after completion of EPIC-002-006A baseline establishment).
> **Owner:** AGS Organization (Chief Architect + Human Product Owner).
> **Scope:** Documentation only. No application code, Workers, D1, migrations, Cloudflare config, secrets, or deployments are modified by this document.

---

## 1. Executive Vision

**AGS organizational vision.** AGS is an **organization**, not a single product. It builds and operates multiple independent applications, each powered by a shared AI organization platform — Hermes — and served by an expanding AI workforce.

**Hermes as the AI Organization Platform.** Hermes is the permanent control plane for AGS: it owns the AI workforce, the shared platform services (identity, permissions, audit, provider adapters, agent registry), and organization governance. Hermes owns **no application business logic**. (See `docs/organization/HERMES_PLATFORM.md`, ADR-005.)

**AGS Fertility as Application #1.** The first production application running on Hermes. It validates the three-layer architecture with real users, real security infrastructure, and real Cloudflare deployment.

**Future applications model.** Every new application (AGS Cyber, AGS Quant, …) consumes Hermes capabilities through stable contracts. Applications never share databases, never depend on each other directly, and never reach into platform internals.

**AI workforce vision.** AGS operates through specialized AI agents (Operations, Security, QA, Documentation, Monitoring, Research, Finance, Customer Support, DevOps) registered in the Hermes Agent Registry, each with scoped permissions and a defined lifecycle. Agents are first-class organizational assets, governed by ADR-002 (Multi-Agent Operations Architecture).

---

## 2. Current State (verified 2026-07-19)

### Completed Epics
| Epic | Outcome |
|---|---|
| EPIC-002-001 | Organization foundation established |
| EPIC-002-002 | Application architecture baseline |
| EPIC-002-003 | Platform service design |
| EPIC-002-004 | Security foundation |
| EPIC-002-005 | Organization architecture + AI workforce model ratified (ADR-004, ADR-005, ADR-006) |
| EPIC-002-006A | Security remediation + repository hygiene + **baseline-002-006** tag established |
| EPIC-002-006B | Hermes extraction complete — Identity, Permissions, Audit, Agent Registry extracted to `hermes/`; 10 provider contracts in `shared/interfaces/`; AGS Fertility consumes Hermes; first AI agent registered (`ags-fertility-ops-agent`, disabled) |
| EPIC-002-006C | Hermes Platform Core Services built — Resource Registry, Discovery, Lifecycle, AI Registry foundation (8-agent workforce), Provider Adapter boundary, Internal Platform API contracts. 158/158 tests; AGS Fertility isolated & protected |

### What exists today
- **Organization architecture** — three-layer model defined in `docs/organization/ORGANIZATION_ARCHITECTURE.md` (ADR-004).
- **Hermes platform design** — control-plane spec in `docs/organization/HERMES_PLATFORM.md` (ADR-005); platform services in `docs/organization/PLATFORM_SERVICES.md`.
- **Hermes platform services (operational, in-process)** — `hermes/services/{registry,discovery,lifecycle,scheduler,notification,memory,providers}`, `hermes/contracts` (internal API), `hermes/agents/seed.ts` (8-agent workforce). See ADR-008 (implemented).
- **Security foundation** — Identity & Authorization Engine (`workers/src/auth/*`: provider registry, principal builder, data-driven permission resolver, authorization middleware, audit writer), Telegram Ops Bot MVP, CI/CD. Ratified by ADR-001/002/003.
- **Repository baseline** — `baseline-002-006` (commit `ded1c953`), 0 secrets tracked, gitleaks CI scanning operational.
- **Application foundation** — AGS Fertility live on Cloudflare Workers + D1, frontend on Cloudflare Pages.

### Reference documents
- **ADRs:** `docs/decisions/ADR-001` (Cloudflare migration) · `ADR-002` (Multi-Agent Ops) · `ADR-003` (Permission resolution) · `ADR-004` (Org architecture) · `ADR-005` (Hermes platform) · `ADR-006` (Resource registry) · `ADR-007` (Hermes extraction) · `ADR-008` (Hermes Platform Core Services — **implemented**).
- **EPIC-002-006A reports:** `docs/operations/EPIC-002-006_EXECUTIVE_CLOSEOUT.md`, `EPIC-002-006A4C_*` verification reports.
- **EPIC-002-006B reports:** `docs/operations/EPIC-002-006B_PROGRESS.md`, `EPIC-002-006B_VALIDATION_REPORT.md`.
- **EPIC-002-006C reports:** `docs/operations/EPIC-002-006C_EXECUTION_PLAN.md`, `EPIC-002-006C_PROGRESS.md`, `EPIC-002-006C_VALIDATION_REPORT.md`.
- **Organization docs:** `docs/organization/*` (architecture, identity model, AI workforce, dependency rules, provider abstractions, repository structure).

---

## 3. Target Organization Architecture

### Layer 1 — Organization (permanent, cross-application)
| Capability | Owner | Source |
|---|---|---|
| AGS identity | Org-owned directory of owners/admins | `docs/organization/IDENTITY_MODEL.md` |
| Owner accounts | Human owners with highest privilege | ADR-004 |
| Governance | Policies, standards, ADR repository, architecture | `docs/decisions/` |
| AI registry | Catalog of agents, capabilities, lifecycles | `docs/organization/AI_REGISTRY_V2.md`, ADR-006 |
| Security policies | Zero Trust, least privilege, secret mgmt | ADR-001/003 |
| Audit framework | Immutable org-wide audit policy | `workers/src/auth/audit.ts` design |

### Layer 2 — Platform (Hermes)
| Service | Responsibility |
|---|---|
| Hermes core | Org control plane; owns no app logic |
| Identity services | Principal building, auth provider registry |
| Permission services | Data-driven RBAC resolver |
| Audit services | Write-once audit events |
| Agent registry | Register/lookup agents + capabilities |
| Resource registry | Track infra, environments, ownership (ADR-006) |
| Provider adapters | Cloudflare / OCI / AWS / Azure / local |
| Shared interfaces | Contracts apps depend on (not implementations) |

### Layer 3 — Applications
| Application | State | Rule |
|---|---|---|
| AGS Fertility | Live (#1) | Independent infra, data, permissions |
| AGS Cyber | Future | Same isolation rules |
| AGS Quant | Future | Same isolation rules |

Each application consumes Hermes through contracts; it has its own infrastructure, its own data store, and its own permission set.

---

## 4. Repository Architecture

### Target structure
```
organization/      # Org-level governance, ADRs, cross-app policy
applications/      # One subtree per application (ags-fertility, ags-cyber, ...)
shared/            # Cross-app shared libraries (by contract only)
hermes/           # Extracted Hermes platform packages
agents/           # Agent definitions, registries, lifecycles
docs/             # This roadmap + operations + organization docs
archive/          # Retired/quarantined artifacts (e.g. Category D scripts)
```

### Rules
- **Ownership boundaries:** `organization/` is owned by the org; `applications/<x>/` by app-x; `hermes/` by the platform team. No layer edits another layer's internals.
- **Dependency rules:** Apps → Hermes (contracts only). Hermes → providers (adapters). Org → governance docs. See `docs/organization/DEPENDENCY_RULES.md`.
- **Import rules:** Applications import from `hermes/` public interfaces and `shared/` contracted libs. They do **not** import platform implementation files.
- **Isolation rules:** No shared databases between applications. No direct app-to-app imports. Provider specifics live behind adapters.

---

## 5. Completed Roadmap

| Epic | Purpose | Status | Outcome |
|---|---|---|---|
| EPIC-002-001 | Organization foundation | ✅ Complete | AGS established as multi-app org |
| EPIC-002-002 | Application architecture baseline | ✅ Complete | AGS Fertility architecture ratified |
| EPIC-002-003 | Platform service design | ✅ Complete | Hermes service boundaries defined |
| EPIC-002-004 | Security foundation | ✅ Complete | Identity/permission/audit engine built |
| EPIC-002-005 | Organization architecture | ✅ Complete | ADR-004/005/006 ratified; AI workforce model |
| EPIC-002-006A | Security remediation + hygiene | ✅ Complete | 0 secrets, gitleaks CI, `baseline-002-006` |

---

## 6. Active Roadmap

### EPIC-002-006B — Hermes Platform Extraction
**Purpose:** Extract reusable platform capabilities from AGS Fertility **without breaking production behavior**.

**Planned extraction areas:**
- **Identity extraction** — move `workers/src/auth/*` identity primitives into `hermes/`.
- **Permission extraction** — data-driven RBAC resolver → platform permission service.
- **Audit extraction** — audit writer → platform audit service (write-once).
- **Provider registry extraction** — provider registry → platform provider-adapter layer.
- **Shared interfaces** — define stable contracts apps depend on.
- **Hermes package boundaries** — split `hermes/` into owned, versioned packages.

**Constraint:** Six incremental, reversible phases (per `EPIC-002-006_HERMES_PLATFORM_EVOLUTION.md`); AGS Fertility keeps working at every step. ADR-007 governs this extraction.

---

## 7. Future Platform Roadmap (EPIC-002-006C+)

| Initiative | Description |
|---|---|
| Resource Registry implementation | Runtime for ADR-006 (track infra, environments, ownership) |
| AI Registry runtime | Active agent registry + capability discovery |
| Agent activation system | Lifecycle: register → activate → monitor → retire |
| Hermes Admin Platform | Org control UI for owners/admins |
| Provider abstraction implementation | Concrete adapters behind defined interfaces |
| Multi-provider support | OCI, AWS, Azure, local alongside Cloudflare |
| OCI/local/cloud portability | Business logic depends on interfaces, not providers |

---

## 8. AI Workforce Roadmap

| Agent | Purpose | Permissions | Application access | Lifecycle |
|---|---|---|---|---|
| Operations Agent | Deploy, monitor, remediate | Ops-scoped, no owner creds | AGS Fertility + platform | Register → Activate → Monitor |
| Security Agent | Secret scan, vuln watch | Read-only + alert | All apps (audit view) | Register → Activate |
| QA Agent | Test, validate, report | Test env only | Per assigned app | On-demand activate |
| Documentation Agent | Generate/maintain docs | Write docs/ only | Org-wide | Persistent |
| Monitoring Agent | Health, metrics, alerts | Read telemetry | All apps | Persistent |
| Research Agent | Market, tech, competitive | Public/web only | Org-wide | On-demand |
| Finance Agent | Spend, billing oversight | Billing read-only | Org + providers | Scheduled |
| Customer Support Agent | User-facing help | App-scoped, no admin | AGS Fertility | Activate on load |
| DevOps Agent | Infra, CI, pipeline | Deploy-scoped | Platform + apps | Register → Activate |

Each agent is registered in the Hermes Agent Registry (`docs/organization/AI_REGISTRY_V2.md`), governed by ADR-002, with scoped permissions resolved by the platform permission service.

---

## 9. Application Expansion Model

```
AGS Fertility ─┐
               ├─→ Hermes Platform (contracts)
AGS Cyber     ─┤
               │
AGS Quant     ─┘
```

**Rules:**
1. Applications do **not** share databases.
2. Applications do **not** directly depend on each other.
3. Applications consume Hermes capabilities **through contracts** (stable interfaces), never platform internals.

New applications inherit the three-layer architecture with zero redesign.

---

## 10. Security Principles

| Principle | Enforcement |
|---|---|
| **Zero Trust** | Every request authenticated + authorized via Hermes identity/permission services |
| **Least privilege** | Agents and apps get scoped permissions; owner creds never in automation |
| **Secret management** | Secrets in provider vaults / CI secrets; 0 in repo (gitleaks CI gate) |
| **Auditability** | Write-once audit service; every privileged action recorded |
| **Environment isolation** | Dev/staging/prod separated; no cross-env secret leakage |
| **Provider independence** | Logic depends on interfaces; providers swappable behind adapters |

---

## 11. Cloud Strategy

**Current:** Cloudflare-first — Workers (API) + D1 (data) + Pages (frontend). Established by ADR-001.

**Future:** OCI, AWS, Azure, and local infrastructure supported through provider adapters.

**Rule:** Business logic must depend on **interfaces**, not providers. Provider choice is a deployment-time decision, not a code-time coupling. (See `docs/organization/PROVIDER_ABSTRACTIONS.md`.)

---

## 12. Success Metrics

### Platform
- **Applications supported** — count of live apps on Hermes (target: 3+ by next milestone).
- **AI agents active** — registered + activated agents in the registry.
- **Provider portability** — number of supported providers behind abstractions.
- **Deployment reliability** — successful CI deploys / total (target: ≥ 99%).
- **Security posture** — gitleaks findings in repo (target: 0), audit coverage %.

### Application
- **Business outcomes** — per-app KPIs (AGS Fertility: consultations, conversions).
- **User growth** — active users / period.
- **Operational efficiency** — manual ops hours reduced by agents.

---

## 13. Decision Authority

| Decision | Authority | Mechanism |
|---|---|---|
| Organization architecture | Chief Architect + Owner approval | ADR (docs/decisions/) |
| Platform evolution | Platform team + ADR | ADR-005/007 process |
| Application changes | App owner + ADR reference | App-scoped, ADR-compliant |
| Security changes | Security Agent + Owner | ADR-001/003 + audit |

Governance is **ADR-driven**: every architectural decision is recorded, reviewed, and ratified before implementation.

---

## 14. Change Log

### 2026-07-19
- **AGS Master Roadmap created** after completion of EPIC-002-006A baseline establishment (`baseline-002-006`).
- Single source of truth for the AGS ecosystem: vision, current state, target architecture, repository structure, completed/active/future roadmaps, AI workforce, expansion model, security principles, cloud strategy, success metrics, and decision authority.

---

*This document is documentation-only. It modifies no code, Workers, D1, migrations, Cloudflare configuration, secrets, deployments, or production behavior. All references point to existing ADRs, EPIC-002-006A reports, and organization documentation.*
