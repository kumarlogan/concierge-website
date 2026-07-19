# EPIC-002-006C — Hermes Platform Core Services (Planning)

> **Status:** PLANNING ONLY — no code, no migrations, no deployments, no secrets.
> **Date:** 2026-07-19
> **Depends on:** ADR-001..007, EPIC-002-001..EPIC-002-006B
> **Baseline:** `baseline-002-006` (immutable), 141/141 tests passing, `ags-fertility-ops-agent` registered + disabled.
> **Outcome of this EPIC:** an implementation blueprint that turns Hermes from *extracted libraries* (`hermes/` + `shared/interfaces/`) into an **operational platform** with seven core services, a resource registry, data models, a security model, and an AI-workforce-ready foundation.

---

## 0. Current State (ground truth from repo)

| Asset | Location | State |
|-------|----------|-------|
| Identity | `hermes/identity/{types,providers,principal}.ts` | extracted (006B) |
| Permissions | `hermes/permissions/{permissions,middleware}.ts` | extracted (006B) |
| Audit | `hermes/audit/audit.ts` | extracted (006B) |
| Provider contracts | `shared/interfaces/*.ts` (10 files) | defined (006B) |
| Agent registry | `hermes/agents/{registry,seed,index}.ts` | foundation (006B) |
| App consumers | `workers/src/{index,index/telegram}.ts` import `@hermes/*` | wired (006B) |
| **Missing** | `hermes/services/`, `organization/`, `applications/`, `agents/` (top-level) | not yet created |
| **Missing** | Registry/Discovery/Lifecycle/Scheduler/Notification/Memory/Adapter services | not yet built |

The extraction (006B) produced **libraries**. 006C designs the **services layer** that operates over them — consistent with ADR-007 §Phase 3 ("stand up Hermes as its own deployable unit") and Phase 5–6 (Registry runtime + app consumes `@hermes/*` only).

---

## 1. Resource Registry

A single source of truth for **everything AGS owns**. Stored as Hermes-owned D1 tables (Phase 4 of ADR-007 dual-write), but modeled first as contracts in `shared/interfaces` (Phase 5 of 006B already scaffolded the pattern).

### 1.1 Inventory dimensions
| Dimension | Examples | Owned by |
|-----------|----------|----------|
| Organization | AGS Organization | Org Layer |
| Applications | `ags-fertility` (#1), `ags-cyber` (future), `hermes-quant` (future) | App Layer |
| Environments | `production`, `staging`, `development` | per-application |
| Infrastructure resources | Cloudflare Workers, D1 DBs, R2 buckets, Queues, DNS zones | Hermes Providers |
| AI agents | `ags-fertility-ops-agent` (registered/disabled), + 7 planned | Agent Registry |
| Ownership | owner account → application → resource mapping | Org Layer |

### 1.2 Entity kinds (registry records)
- `OrganizationUnit` — top node, owns policies.
- `Application` — deployable unit; references environments + resources.
- `Environment` — `{app, name, status, configRef}`.
- `InfraResource` — `{kind, provider, region, bindings, owner}`.
- `Agent` — reuses `hermes/agents/registry.ts` `RegisteredAgent`.
- `OwnershipLink` — `{subject, resource, role}` (separate from RBAC runtime grants).

### 1.3 Lifecycle states (all resources)
`provisioning → active → degraded → suspended → retired → archived`
Agents add: `registered → active → suspended → retired` (006B already enforces `registered`+`disabled` start).

---

## 2. Hermes Services Architecture

Seven services. Each is a **module under `hermes/services/<name>/`** exposing a contract from `shared/interfaces` and consuming extracted capabilities. No service replaces Cloudflare in 006C — adapters stay first-class.

| Service | Responsibility | Consumes | Produces |
|---------|----------------|-----------|----------|
| **Registry Service** | CRUD + query over Resource Registry; authoritative inventory | DataStore, Identity | registry events |
| **Discovery Service** | Resolve "what exists / where is it" for apps & agents at runtime | Registry, Provider Adapter | service catalog |
| **Lifecycle Service** | State transitions for resources + agents; enforces inactive-by-default | Registry, Audit, Notification | lifecycle events |
| **Scheduler Service** | Cron/event trigger dispatch; maps to Cloudflare Cron Triggers + Queue | Queue, DataStore | trigger events |
| **Notification Service** | Fan-out to Telegram/email/webhook via `NotificationProvider` | NotificationProvider, Audit | delivery receipts |
| **Memory Service** | Durable agent/organization memory (episodic + semantic); scoped per agent | DataStore, ObjectStorage | memory records |
| **Provider Adapter Service** | Binds `shared/interfaces` to concrete Cloudflare impls; the ONLY place vendor code lives | all `shared/interfaces` | bound providers |

### 2.1 Interaction model
```
Applications ──consume──> Hermes Services ──use──> Extracted Capabilities (identity/permissions/audit)
        │                        │                          │
        └── @hermes/* ───────────┘── contracts ──> shared/interfaces ──adapted by──> Provider Adapter → Cloudflare
```
Services are **in-process libraries** in 006C (ADR-007 Phase 3: in-process first, no new network failure domain). Promotion to a deployable Hermes Worker is a later phase (post-006C), gated by ADR-007 Phase 4 dual-write.

---

## 3. Data Models

### 3.1 Entities (contracts in `shared/interfaces` + `shared/contracts`)
```ts
// Pseudocode — defines shape, not implementation
interface ResourceRecord {
  id: string; kind: ResourceKind; owner: string;
  env: EnvironmentName; state: LifecycleState;
  meta: Record<string, unknown>;
}
interface AgentRecord extends RegisteredAgent { /* from 006B registry */ }
interface LifecycleEvent { resourceId; from; to; actor; at; reason; }
interface MemoryRecord { agentId; scope; key; value; ttl?; }
```

### 3.2 Relationships
- `OrganizationUnit 1—* Application`
- `Application 1—* Environment`
- `Environment 1—* InfraResource`
- `OwnershipLink *—* (subject, resource)`
- `Agent *—1 Application` (domain field already in 006B `RegisteredAgent`)
- `MemoryRecord *—1 Agent`

### 3.3 Permissions
- Registry/Lifecycle mutations require `hermes.admin` (OWNER-equivalent) — reuses extracted `hasPermission` + OWNER override.
- Discovery/Read require `hermes.reader`.
- Agent self-state changes (activate/deactivate) require **explicit human authorization** — never automatic (006B safety posture).
- All permission checks go through `hermes/permissions` (extracted, unchanged).

### 3.4 Audit requirements
- Every Registry/Lifecycle/Activation mutation → `AuditProvider.write` (non-blocking, preserved behavior).
- Event types: `resource.registered`, `resource.lifecycle`, `agent.activated`, `agent.deactivated`, `discovery.query` (read-audit optional).
- Audit records are **immutable** (append-only D1 table).

---

## 4. Repository Placement

Follows the ratified three-layer layout (`docs/organization/*`, ADR-004):

```
organization/            # Org Layer governance (NEW in 006C)
  policies/
  ownership/
  README.md

applications/            # App Layer (NEW in 006C)
  ags-fertility/         # pointer/manifest to existing workers/ + config refs
  README.md

shared/                  # already exists (006B)
  interfaces/            # provider contracts (done)
  contracts/             # service-level schemas (006C adds)

hermes/                  # Platform (extended in 006C)
  identity/ permissions/ audit/   # extracted (006B)
  agents/                         # registry (006B)
  services/                       # NEW: the 7 services
    registry/ discovery/ lifecycle/ scheduler/
    notification/ memory/ provider-adapter/
  providers/             # adapter bindings (006B scaffold)

agents/                  # top-level agent workspace (NEW in 006C)
  ags-fertility-ops-agent/
  README.md

docs/                    # already exists
  operations/  decisions/  organization/  security/
```

**Placement rule (enforced by CI lint in later phase):** Applications import only `@hermes/*` and `@shared/*`. Org Layer never imports app code. Services import capabilities + interfaces, never vendor SDKs directly (that is the Adapter Service's job).

---

## 5. Security Model

| Principle | Enforcement |
|-----------|-------------|
| **Zero trust** | No implicit trust between services; every cross-service call carries a Principal from `hermes/identity`. |
| **Least privilege** | Agents get only the capabilities declared at registration (006B `capabilities[]`); activation grants no new perms. |
| **Audit everything** | All mutations + agent actions → `AuditProvider`. Immutable log. |
| **Inactive-by-default agents** | `registerAgent` forces `activation: "disabled"` (006B). Activation = explicit authorized out-of-band call. |
| **No secret exposure** | `SecretProvider` returns values only to Adapter Service; services receive bound providers, never raw secrets. |
| **Human authority boundary** | Agent autonomous actions prohibited until `activation=enabled` by human operator flow. |

---

## 6. Migration Strategy (reversible, zero production impact)

Mirrors ADR-007's gating model. 006C adds the **services layer** without touching AGS Fertility runtime:

1. **P0 — Contracts first.** Add `shared/contracts` + extend `shared/interfaces`. No runtime change. *Reversible: delete files.*
2. **P1 — Service modules (in-process).** Implement 7 services as libraries consuming extracted caps. App still calls extracted caps directly; services unused at runtime. *Reversible: services unused = no blast radius.*
3. **P2 — Registry backfill.** Dual-write resource records to new D1 tables alongside existing; read from existing. *Reversible: flag flip.*
4. **P3 — App adopts services (flag-gated).** `HERMES_PLATFORM_MODE=services` routes app through services; `legacy` bypasses. Golden-request replay must match baseline. *Reversible: flag flip.*
5. **P4 — Agent activation pathway.** Build authorized operator flow for `activateAgent` (human-in-loop). Agent stays disabled until used. *Reversible: deactivate.*
6. **P5 — Promote services to deployable Hermes Worker** (post-006C, ADR-007 Phase 4). Out of scope for planning doc; noted as continuation.

**Zero production impact guarantee:** every phase is either (a) unused code, (b) flag-gated, or (c) dual-write with compensating rollback. AGS Fertility customer behavior stays byte-identical (ADR-007 Must-Hold).

---

## 7. Future AI Workforce Readiness

Registry already supports arbitrary agents (006B `registerAgent`). 006C prepares onboarding for 7 planned agents:

| Agent | Domain | Planned capabilities (declared, disabled) | Depends on |
|-------|--------|-------------------------------------------|------------|
| QA agent | `ags-org` | `qa.run`, `qa.report` | Scheduler, Notification, Memory |
| Security agent | `ags-org` | `sec.scan`, `sec.alert` | Registry, Audit, Notification |
| Documentation agent | `ags-org` | `doc.generate`, `doc.pr` | Memory, Notification |
| Deployment agent | `ags-org` | `deploy.apply`, `deploy.rollback` | Lifecycle, Registry, Notification |
| Research agent | `ags-org` | `research.query`, `research.summarize` | Memory, Notification |
| Finance agent | `ags-org` | `fin.report`, `fin.forecast` | Registry, Memory |
| Customer support agent | `ags-fertility` | `support.reply`, `support.escalate` | Memory, Notification, Identity |

All registered **disabled**. Activation is per-agent, human-authorized, and each capability is `autonomous: false` at registration. The Memory Service gives agents durable, scoped context; the Lifecycle Service governs their state transitions.

---

## 8. Deliverables of this Planning EPIC

- ✅ This planning document (`EPIC-002-006C_PLANNING.md`)
- ✅ ADR proposal (`ADR-008_HERMES_PLATFORM_CORE_SERVICES.md`)
- ✅ Implementation roadmap (`EPIC-002-006C_ROADMAP.md`)
- ✅ Risks & tradeoffs (§9 below + ADR-008)

**STOP — no implementation performed.** No `.ts`/`.sql`/`.json` code created; no `organization/`, `applications/`, `agents/`, or `hermes/services/` directories created. Only planning artifacts written.

---

## 9. Risks & Tradeoffs

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Service layer adds indirection / latency | Med | Low (in-process) | Keep services in-process (ADR-007 P3); promote to Worker only after proven |
| Registry becomes source-of-truth drift vs Cloudflare | Med | Med | Dual-write + parity check (P2); reconcile job |
| Agent activation flow abused | Low | High | Human-in-loop mandatory; audit every activation; disabled default |
| Scope creep into runtime before baseline proven | Med | Med | Flag-gated cutover; golden-request replay gate |
| Memory Service cost (storage/queries) | Low | Low | TTL + scope limits; ObjectStorage for large blobs |
| CI lint for dependency rules not yet enforced | Med | Low | Add in P1; block merges violating layering |

**Tradeoff accepted:** temporary duplication (services wrap already-extracted caps) is the price of reversibility and zero production impact — consistent with ADR-007's stated cost.
