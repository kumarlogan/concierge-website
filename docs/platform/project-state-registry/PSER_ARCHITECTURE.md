# PSER — Project State & Execution Registry

> **AI Platform Capability — Architecture**
> Reusable, deterministic, platform-level registry for project state, execution history, and workforce coordination.
>
> **Version:** 1.0.0 — Architecture
> **Status:** Architecture Complete
> **Last Updated:** 2026-07-26

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       PSER Architecture
Capability:     Project State & Execution Registry
Phase:          Phase D — Core Runtime (Architecture)
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Purpose

The Project State & Execution Registry (PSER) becomes the **canonical machine-readable source of truth** for:

- **Company state** — organizational hierarchy, active companies, platform instances
- **Platform state** — active capabilities, versions, maturity levels
- **Product state** — product registry, lifecycle phase, current milestone
- **Roadmap state** — phase, wave, epic, sprint progression
- **Execution state** — active execution context, resume points, gates
- **Workforce assignments** — agent-to-task mapping, authority chains
- **Execution history** — completed tasks, decisions, outcomes, timing
- **Blockers, risks, dependencies** — active impediments and their state

**Documentation remains the human-readable representation.**
**PSER becomes the machine-readable representation.**

Future workforce agents query PSER to determine project context, rather than reconstructing it from markdown documents.

---

## 2. Design Principles

| Principle | Rationale |
|-----------|-----------|
| **Platform First** | PSER is a reusable AI Platform capability. No product-specific logic embedded. Concierge is Consumer #1. |
| **Deterministic** | All state queries return deterministic results — no LLM inference of project status. PSER is a structured data service. |
| **Multi-tenant** | Supports multiple companies, products, roadmaps, and workforces simultaneously. |
| **Fail-Closed** | Every query defaults to DENY/BLOCK if authorization cannot be determined. |
| **Immutable Audit** | Execution history is append-only. Once recorded, it cannot be deleted or modified. |
| **Human Authority** | Human operator retains final authority over all state transitions. Gates require human approval to advance. |
| **Documentation-Synchronized** | PSER is the source of truth. Markdown governance documents are derived views, regenerated on state change. |
| **Lightweight Core** | PSER stores metadata, not data. No PHI, no patient records, no product data. Project metadata only. |

---

## 3. Canonical State Hierarchy

```
Company
  ├─ id, name, status, owner, created_at
  │
  ├── Platform
  │     ├─ id, name, version, status, owner
  │     │
  │     ├── Capability
  │     │     ├─ id, name, maturity, status, version
  │     │     ├── Dependencies [ ]  (references other capabilities)
  │     │     └── Consumers [ ]     (references products / capabilities)
  │     │
  │     └── Workforce
  │           ├─ id, name, version (WEF version)
  │           ├── Agent [ ]
  │           │     ├─ id, type, status, current_task, authority
  │           │     └── Assignment history [ ]
  │           └── Human operator principal
  │
  ├── Product
  │     ├─ id, name, brand, status, owner
  │     │
  │     ├── Roadmap
  │     │     ├─ id, name, version, status
  │     │     │
  │     │     ├── Phase
  │     │     │     ├─ id, name, order, status
  │     │     │     ├── Gate status (entry / exit criteria)
  │     │     │     │
  │     │     │     ├── Wave
  │     │     │     │     ├─ id, name, order, status
  │     │     │     │     ├── Gate status
  │     │     │     │     │
  │     │     │     │     ├── Epic
  │     │     │     │     │     ├─ id, name, status
  │     │     │     │     │     ├── Dependencies [ ]
  │     │     │     │     │     ├── Risks [ ]
  │     │     │     │     │     │
  │     │     │     │     │     ├── Sprint
  │     │     │     │     │     │     ├─ id, name, duration, status
  │     │     │     │     │     │     │
  │     │     │     │     │     │     ├── Story
  │     │     │     │     │     │     │     ├─ id, name, status, points
  │     │     │     │     │     │     │     ├── Owner, Assignee
  │     │     │     │     │     │     │     │
  │     │     │     │     │     │     │     └── Task
  │     │     │     │     │     │     │           ├─ id, name, status
  │     │     │     │     │     │     │           ├── Owner, Assignee
  │     │     │     │     │     │     │           ├── Resume point
  │     │     │     │     │     │     │           └── Execution history [ ]
  │     │     │     │     │     │     │
  │     │     │     │     │     │     └── Sprint Retrospective
  │     │     │     │     │     │
  │     │     │     │     │     └── Epic Closeout
  │     │     │     │     │
  │     │     │     │     └── Wave Closeout
  │     │     │     │
  │     │     │     └── Phase Closeout
  │     │     │
  │     │     └── Roadmap Retrospective
  │     │
  │     └── Product Retrospective
  │
  └── Company Retrospective
```

Each node contains: `id`, `name`, `status`, `owner`, `start_date`, `target_date`, `completion_pct`, `created_at`, `updated_at`.

---

## 4. Multi-Tenant Support

PSER supports concurrent projects through tenant-isolated records:

| Dimension | Isolation Strategy |
|-----------|-------------------|
| Multiple Companies | Top-level partition key. Every query scoped to a company_id. |
| Multiple Products | Product_id under company. Independent roadmaps per product. |
| Multiple Roadmaps | Roadmap_id under product. Supports parallel roadmap tracks. |
| Multiple Active Phases | Phase_id under roadmap. Multiple phases can be active concurrently (e.g., Phase 3 architecture while Phase 2 implements). |
| Multiple Waves | Wave_id under phase. Parallel waves supported for independent workstreams. |
| Multiple Epics | Epic_id under wave. Independent epic execution. |
| Multiple Sprints | Sprint_id under epic. Parallel sprints for independent teams. |
| Multiple Workforces | Workforce_id under platform. Each workforce has its own agent registry and execution context. |

---

## 5. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    PSER Consumer Layer                        │
│  (Workforce Agents · Human Operators · Admin Tools · CI/CD)  │
└───────────────────┬─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────┐
│                    PSER API (Interfaces)                      │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ StateQuery   │  │ StateMutate  │  │ ExecutionQuery   │   │
│  │ (read-only)  │  │ (write)      │  │ (history/gates)  │   │
│  └──────┬───────┘  └──────┬───────┘  └───────┬──────────┘   │
└─────────┼─────────────────┼──────────────────┼───────────────┘
          │                 │                  │
          ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    PSER Service Layer                          │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ ProjectState │  │ RoadmapReg.  │  │ ExecutionReg.    │   │
│  │ Service      │  │ Service      │  │ Service          │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤   │
│  │ PhaseService │  │ WaveService  │  │ GateService      │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤   │
│  │ SprintService│  │ StoryService │  │ TaskService      │   │
│  ├──────────────┤  ├──────────────┤  ├──────────────────┤   │
│  │ ResumeService│  │ Workforce    │  │ ExecutionHistory │   │
│  │              │  │ Assignment   │  │ Service          │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└──────────────────────────┬───────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                    PSER Data Layer                             │
│                                                               │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │
│  │ D1 (Primary) │  │ KV (Cache)   │  │ R2 (Archive)     │   │
│  │ Relational   │  │ Hot state    │  │ Historical exec  │   │
│  │ state store  │  │ (read-heavy) │  │ records (cold)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### 5.1 Layered Architecture

- **Consumer Layer** — workforce agents, human operators, admin tools, CI/CD pipelines. All access PSER through defined platform interfaces, never directly through the data layer.
- **API Layer** — stateless read/write interfaces, permission-checked, audit-logged. Three interface groups: StateQuery (read-only), StateMutate (write with approval gates), ExecutionQuery (history and gate status).
- **Service Layer** — domain services implement the API contracts. Each service owns one domain (project state, roadmap, execution, gates, workforce assignments).
- **Data Layer** — D1 as primary relational store. KV for hot read-heavy state (cached hierarchy). R2 for archived historical execution records.

### 5.2 Data Flow: Workforce Agent Queries PSER

```
Agent: "What is the current execution context?"

1. Agent sends structured query to PSER StateQuery API
2. PSER resolves authorization (agent_id → permissions)
3. PSER reads current state from D1 (multi-table join)
4. PSER assembles execution context response:
   - Company: AGS
   - Platform: AI Platform
   - Product: Concierge
   - Phase: Phase 2, Wave 5, Epic 2.2
   - Current sprint: S2.2.1
   - Blocked: No
   - Resume point: Task 4
5. PSER returns structured response (JSON)
6. Agent begins execution from resume point
```

### 5.3 Data Flow: Agent Records Execution

```
Agent completes Task 4

1. Agent sends completion event to PSER ExecutionHistoryService
2. PSER validates agent authorization for task
3. PSER records the execution event (immutable append)
4. PSER updates Task state (completion_pct, status, end_time)
5. PSER evaluates gate conditions:
   - If all tasks in story complete → advance story
   - If all stories in sprint complete → advance sprint
   - Gate check → if all criteria met → prompt human approval
6. PSER returns updated state with next resume point
```

---

## 6. State Model — Entity Relationships

```
companies
  │
  ├── platforms              (ai_platform, future: other platforms)
  │     ├── capabilities      (reusable platform capabilities)
  │     │     └── capability_dependencies
  │     │     └── capability_consumers
  │     └── workforces        (AGS Workforce, future: other workforces)
  │           ├── agents
  │           └── agent_assignments
  │
  └── products
        ├── roadmaps
        │     └── phases
        │           ├── waves
        │           │     └── epics
        │           │           └── sprints
        │           │                 ├── stories
        │           │                 │     └── tasks
        │           │                 └── sprint_retrospectives
        │           ├── phase_gates
        │           └── closeout_records
        ├── blockers
        ├── risks
        ├── dependencies
        ├── approvals
        └── execution_history
```

---

## 7. State Transition Lifecycle

Each entity in the PSER hierarchy follows a governed lifecycle:

```
PLANNED → IN_PROGRESS → COMPLETED → CLOSED
                            │
                            └── BLOCKED ──→ RESOLVED ──→ IN_PROGRESS
                                         (unblocked)
```

### Gate Transition Rules

| Transition | Condition | Approver |
|-----------|-----------|----------|
| PLANNED → IN_PROGRESS | Phase/Wave entry criteria met | Human Operator |
| IN_PROGRESS → COMPLETED | All child entities complete | System (auto) |
| COMPLETED → CLOSED | Phase/Wave exit criteria met, closeout reviewed | Human Operator |
| IN_PROGRESS → BLOCKED | Blocker raised by agent or operator | System (auto) |
| BLOCKED → RESOLVED | Blocker mitigation accepted | Human Operator |
| RESOLVED → IN_PROGRESS | Resume point set | Agent (auto) |

---

## 8. Security Boundaries

### 8.1 RBAC Model

| Role | Permissions |
|------|------------|
| `pser:reader` | Read any state, execution history, gate status |
| `pser:writer` | Create/update entities within scope, record execution events |
| `pser:approver` | Advance gates, close phases/waves/epics, approve transitions |
| `pser:admin` | Manage RBAC assignments, configure PSER, override states |
| `pser:operator` | Human override — final authority on any state transition |

### 8.2 Authorization Rules

- Every PSER API call requires a valid agent or human principal.
- Read operations require `pser:reader` at minimum.
- Write operations require `pser:writer` scoped to the entity's tenant path.
- Gate advancements require `pser:approver` and (for major transitions) `pser:operator`.
- Immutable audit — execution history is write-once, read-only after commit.
- No PHI — PSER stores metadata only. Patient records, clinical data, and personally identifiable information are never stored in PSER.

### 8.3 Audit Events

Every state change, gate transition, and approval generates an immutable audit record:

```
{
  "event_id":         "uuid",
  "event_type":       "state_transition | gate_advance | approval | override",
  "entity_type":      "phase | wave | epic | sprint | story | task",
  "entity_id":        "...",
  "from_state":       "...",
  "to_state":         "...",
  "performed_by":     "agent:<id> | human:<id>",
  "timestamp":        "ISO 8601",
  "reason":           "...",
  "authorization":    "granted | denied"
}
```

---

## 9. Resilience & Consistency

| Concern | Strategy |
|---------|----------|
| Read availability | KV cache for hot state. D1 as source of truth. Cache TTL: 60s default. |
| Write consistency | D1 transactions for hierarchical state updates. Optimistic locking via updated_at version checks. |
| Write conflict | Last-write-wins for independent entities. Transactional for parent-child updates. |
| Data loss | D1 backup via wrangler. R2 archiving for history records. |
| Cold start | KV cache populated on first read after service startup. |
| Performance | N+1 queries avoided via JOIN queries across the hierarchy. Pagination on execution history. |
| Concurrency | Entity-level optimistic locking. Gate transitions are exclusive operations. |

---

## 10. Key Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Storage | D1 (primary) + KV (cache) + R2 (archive) | Uses existing AI Platform Storage capability. No new infrastructure. |
| Interface Pattern | Service-per-domain | Follows the existing platform service pattern (Intent Engine, Identity Core). |
| State Model | Relational (D1 tables) | Hierarchical queries via JOIN. Deterministic. No document store ambiguity. |
| Authorization | RBAC through existing Auth Engine | Reuses the existing AI Platform Security capability. No new auth framework. |
| Audit | Append-only D1 audit_logs table | Follows existing audit pattern established in Phase 1. |
| Cache | KV with 60s TTL | Read-heavy workload (workforce queries every task). KV reduces D1 load. |
| Gate Logic | Service-layer evaluation | Deterministic rules engine. No LLM in gate decisions. Human always in loop for major transitions. |
| Product Registration | First product: Concierge | Future products register through the same ProductService interface. Zero code changes. |

---

## 11. Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| AI Platform Storage (D1, KV, R2) | Infrastructure | ✅ Live |
| AI Platform Security (Auth Engine, RBAC) | Platform | ✅ Live |
| AI Platform Observability (Health, Audit) | Platform | ✅ Live |
| AI Platform Notifications (Approval channels) | Platform | ⚠️ Partial |
| AI Platform Workforce Orchestration (Agent registry) | Platform | ✅ Live |
| WEF v1.0 | Framework | ✅ Active |

---

## 12. Future Consumers

| Consumer | Phase | Status |
|----------|-------|--------|
| Concierge workforce agents | Phase 2+ | 📋 Planned |
| Hermes Agent session context | Phase 2+ | 📋 Planned |
| Admin Bot dashboard queries | Phase 2+ | 📋 Planned |
| CI/CD pipeline state visibility | Phase 2+ | 📋 Planned |
| Future AGS products | Phase H+ | 📋 Planned |
| Multi-product portfolio reporting | Phase H+ | 📋 Future |
| Governance dashboard auto-generation | Phase D+ | 📋 Future |

---

## 13. Out of Scope (PSER v1.0)

| Item | Rationale |
|------|-----------|
| Patient or clinical data storage | PSER stores project metadata only. NO PHI. |
| LLM-based state inference | All state is explicitly written by agents or operators. No LLM guesses project status. |
| Real-time state synchronization | PSER is query-based, not event-streaming. Poll or explicit query only. |
| External API for third-party consumers | v1.0 is platform-internal. External API is future work. |
| Auto-generation of markdown docs | PSER stores data. Doc generation is a separate concern (future capability). |
| Automated sprint planning | PSER tracks state. Planning intelligence belongs in Workforce Intelligence (Phase E). |

---

*This document is authoritative for the PSER capability architecture.*
*All PSER implementation must conform to this design.*
*Architecture document — AI Platform Capability*
*Last updated: 2026-07-26*