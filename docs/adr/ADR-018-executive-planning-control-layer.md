# ADR-018 — Executive Planning & Control Layer (EPCL)

> **Status:** ✅ Accepted
> **Date:** 2026-07-29
> **Phase:** Phase E — Executive Planning & Control
> **Category:** Architecture · Platform Capability · Workforce Integration · Strategic Planning

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge (first registered EPCL product)
Public Brand:   AG Synergy
Repository:     concierge-website
ADR:            ADR-018 — Executive Planning & Control Layer
Status:         ✅ Accepted
Author:         AI Platform Architecture
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
Capability:     #14 — Executive Planning & Control Layer
```

---

## Context

The AI Platform has two mature execution layers:

| Layer | Responsibility | Status |
|-------|---------------|--------|
| **WEF** (Workforce Execution Framework) | Dispatch, execute, monitor work through a governed agent workforce | ✅ Live (v1.1) |
| **PSER** (Project State & Execution Registry) | Deterministic machine-readable state tracking, execution history, resume points | ✅ Architecture (v1.0) |

These layers handle **execution** and **state tracking** but have no native capability for **strategic planning** — the decomposition of high-level objectives into executable work items. The gap manifests in four measurable problem areas:

### Problem 1 — Ad-hoc Decomposition

When a human operator issues a natural-language request like *"implement Phase 2 Wave 6 of the Concierge roadmap"*, the Hermes Agent must:

1. Read unstructured markdown documents (ROADMAP.md, PHASE_2_PLANNING.md, CURRENT_SPRINT.md)
2. Infer the roadmap hierarchy (which phase, which waves, which epics)
3. Decompose into executable stories and tasks
4. Identify dependencies between work items
5. Route work to the correct workforce discipline
6. Track progress across multiple sessions
7. Handle interruptions and resumption

This is currently done **ad-hoc by the agent** using document-reading skills with no deterministic planning framework. Different agents produce different plans for the same roadmap.

### Problem 2 — No Context Budget Management

Hermes Agent operates within a finite context window (~65k tokens for tencent/hy3). When a planning session ingests:
- ROADMAP.md (~8K tokens)
- PHASE_2_PLANNING.md (~5K tokens)
- CURRENT_SPRINT.md (~3K tokens)
- Architecture docs (~20K tokens)
- Existing codebase context (~15K tokens)

The total (~51K tokens) leaves **<14K tokens** for the actual planning work — and no mechanism to detect when the context budget is exceeded, or to decompose the plan across multiple sessions.

### Problem 3 — No Deterministic Plan Model

PSER provides a deterministic state model for **completed and in-progress work** but has no native data model for **planned work** — the decomposition of roadmap items into phases, waves, epics, stories, and tasks before execution begins. Plans are currently:

- Written as markdown in `.hermes/plans/`
- Ingested fresh each session with no structured schema
- Not queryable by PSER or other platform components
- Not versioned or comparable across runs

### Problem 4 — No Discipline Routing

Work items have implicit discipline requirements (frontend, backend, DevOps, architecture, documentation, security, testing) but there is no deterministic routing mechanism. The agent must infer discipline from context, leading to:

- Cross-discipline work items assigned to a single agent
- Missing discipline handoffs (architecture → frontend → backend → test)
- No parallel workstream management across disciplines

---

## Decision

Adopt the **Executive Planning & Control Layer (EPCL)** as AI Platform Capability #14.

### What EPCL Is

- A **strategic planning engine** that decomposes roadmap objectives into executable work items (phases → waves → epics → stories → tasks)
- A **discipline router** that maps work items to the appropriate workforce discipline (frontend, backend, DevOps, architecture, docs, security, testing)
- A **context budget manager** that monitors token consumption and decomposes plans across sessions when context limits are exceeded
- A **plan data model** that stores structured plans in a machine-readable, versioned format
- A **progress tracker** that monitors execution through PSER and handles interruptions and resumption
- An **executive dashboard** that provides deterministic status reports to human operators

### What EPCL Is Not

- **Not an execution engine** — EPCL plans. WEF executes.
- **Not a state store** — EPCL writes plans to PSER for durability. PSER is the source of truth for state.
- **Not a replacement for human planning** — EPCL produces machine-readable plan drafts. Human operators review, approve, and override.
- **Not an LLM service** — EPCL planning is structured and deterministic. No LLM infers plan state.
- **Not a product feature** — EPCL is a platform capability. Concierge is Product #1.

---

## Design Choices

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| **Architecture** | Hermes-side service layer + Workers-side interfaces | Pure Hermes skill, Pure Workers service | EPCL needs Hermes context (NL input, token awareness) AND Workers infrastructure (persistence, execution) |
| **Plan storage** | PSER (extended with plan tables) | Separate D1 database, KV-only, R2 documents | PSER is the canonical state store. Adding plan tables reuses existing infrastructure. |
| **Discipline routing** | TypeScript routing engine with map+reduce | LLM-based routing, config file routing | Deterministic routing eliminates LLM ambiguity. Map+reduce enables parallel workstreams. |
| **Context budgeting** | Proactive token estimation + session decomposition | Reactive (warn on overflow), Fixed-size chunks | Proactive budgeting prevents context overflow before planning begins. |
| **Plan format** | Structured JSON (TypeScript interfaces) | Markdown, YAML, GraphQL, Mermaid | JSON is natively parseable by both Hermes (TS) and Workers (TS). Markdown is derived view. |
| **Execution batches** | Plan-atom: self-contained executable work unit | Single task dispatch, Wave-level dispatch | Plan-atom is the minimum viable execution unit — self-contained, discipline-assigned, dependency-tracked. |
| **Interruption model** | Checkpoint-based (resume from last completed atom) | Reset-on-interrupt, Full plan re-ingest | Checkpoints minimize wasted work. Each atom is independently completable. |
| **Versions** | Plan versioning via PSER audit lifecycle | Git-based, R2 snapshots | PSER already has optimistic locking and audit. Plan versions are PSER state versions. |

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                     Executive Planning Layer                       │
│                  (Hermes Agent — Strategic)                        │
│                                                                   │
│  ┌─────────────────────┐  ┌──────────────────────────────────┐   │
│  │ EPCL Skill Workflow  │  │ Executive Dashboard               │   │
│  │ (Hermes agent-side)  │  │ (status, metrics, decisions)     │   │
│  └─────────┬───────────┘  └──────────────┬───────────────────┘   │
│            │                              │                       │
│            ▼                              ▼                       │
│  ┌──────────────────────────────────────────────────────────┐    │
│  │                 EPCL Engine (Service Layer)                │    │
│  │                                                           │    │
│  │  ┌─────────────┐  ┌─────────────┐  ┌───────────────────┐ │    │
│  │  │PlanningEng. │  │RoadmapEng.  │  │DisciplineRouter   │ │    │
│  │  ├─────────────┤  ├─────────────┤  ├───────────────────┤ │    │
│  │  │Decomposition│  │Hierarchy    │  │Map (work→disc.)   │ │    │
│  │  │Dependency   │  │Ingestion    │  │Reduce (disc.→batch)│ │    │
│  │  │Prioritizat. │  │Validation   │  │Parallel workstream│ │    │
│  │  └──────┬──────┘  └──────┬──────┘  └────────┬──────────┘ │    │
│  │         │                │                    │            │    │
│  │  ┌──────┴────────────────┴────────────────────┴──────┐    │    │
│  │  │           PlanAtom Service                         │    │    │
│  │  │  (atom creation, dependency resolution, batches)    │    │    │
│  │  └──────────────────────┬────────────────────────────┘    │    │
│  │                         │                                  │    │
│  │  ┌──────────────────────┴────────────────────────────┐    │    │
│  │  │   ContextBudgetManager   │   TokenBudgetManager    │    │    │
│  │  │   (context window track)  │   (token estimate/limit) │    │    │
│  │  └──────────────────────────┴────────────────────────┘    │    │
│  └──────────────────────────┬───────────────────────────────┘    │
│                             │                                    │
└─────────────────────────────┼────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Platform Interface Layer                        │
│                                                                   │
│  ┌────────────────────┐  ┌────────────────┐  ┌────────────────┐  │
│  │  PSER (State)      │  │  Execution     │  │  Feature Flags │  │
│  │  Plan tables       │  │  Gateway       │  │  EPCL config   │  │
│  │  Exec history      │  │  (WEF dispatch) │  │  ENABLE_EPCL   │  │
│  └────────────────────┘  └────────────────┘  └────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

### Execution Flow

```
User: "Implement Phase 2 Wave 6 of Concierge"

1. EPCL Skill receives NL request
2. EPCL Engine:
   a. RoadmapEngine ingests roadmap docs → structured hierarchy
   b. ContextBudgetManager estimates tokens → fits in window? Yes
   c. PlanningEngine decomposes Wave 6 into epics, stories, tasks
   d. DependencyEngine identifies dependencies between work items
   e. DisciplineRouter maps each task to a discipline
   f. PlanAtomService creates executable atoms from task groups
   g. Plan written to PSER (plan tables)
3. EPCL presents plan summary to human operator
4. Human approves plan (or requests changes)
5. EPCL dispatches first batch to Execution Gateway → WEF
6. WEF executes batched work
7. PSER records execution events
8. EPCL monitors progress via PSER query
9. On interruption, EPCL records checkpoint → resume point
10. On resume, EPCL reads checkpoint → continues from last atom
```

---

## Consequences

### Positive

- **Deterministic planning** — Same roadmap produces the same decomposition every time. LLM variability is constrained to structured plan outlines.
- **Context management** — Proactive token budgeting prevents context overflow. Plans that exceed window size are decomposed across sessions.
- **Discipline routing** — Work items are assigned to the correct workforce discipline deterministically. Parallel workstreams enabled.
- **Plan traceability** — Every plan is versioned and stored in PSER. Audit trail from objective through decomposition to execution.
- **Resume from interruption** — Checkpoint-based interruption ensures no work is lost. Resumption reads last completed atom.
- **Human-in-the-loop** — Plans are presented for approval before execution. Human operators review, approve, or request changes.

### Negative

- **Initial plan overhead** — Creating structured plans adds ~8-15% overhead to the planning phase compared to ad-hoc decomposition.
- **PSER schema extension** — Plan tables add ~3 new D1 tables. Existing PSER schema must be extended.
- **Skill complexity** — EPCL skill is the most complex Hermes skill to date. Requires careful versioning and testing.
- **Learning curve** — Operators must understand planning decomposition, discipline routing, and atom concepts.

### Neutral

- **Existing Hermes skills remain unchanged** — EPCL is additive. Existing skills (ag-synergy-platform, github-pr-workflow) continue to work.
- **WEF is unchanged** — EPCL dispatches to the existing Execution Gateway. WEF sees the same governed execution interface.
- **PSER adoption is unchanged** — PSER remains the source of truth. EPCL writes plans to PSER; WEF continues recording execution events.

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| Hermes Agent runtime | Platform | ✅ Live |
| PSER (Project State & Execution Registry) | Platform | ✅ Architecture |
| WEF v1.1 | Framework | ✅ Active |
| Execution Gateway | Platform | ✅ Live |
| Feature Flags (Platform Config) | Platform | 🆕 New |
| AI Platform Storage (for plan persistence) | Infrastructure | ✅ Live |

---

## Implementation Roadmap

| Step | Focus | Deliverables |
|------|-------|-------------|
| **Step 1** | Architecture | ADR-018, EPCL Architecture Doc, TypeScript Interfaces, Feature Flags |
| **Step 2** | Core Services | PlanningEngine, RoadmapEngine, DisciplineRouter, ContextBudgetManager, TokenBudgetManager, PlanAtomService |
| **Step 3** | Hermes Skill | EPCL skill workflow, dashboard reporting, interruption handling |
| **Step 4** | Testing | Unit tests for each service, governance verification, token efficiency verification |
| **Step 5** | Documentation | Architecture docs, runbooks, operator guide |

---

## Related Documents

| Document | Location | Status |
|----------|----------|--------|
| EPCL Architecture | `docs/platform/executive-planning-control/EPCL_ARCHITECTURE.md` | 🆕 New |
| EPCL Interfaces | `docs/platform/executive-planning-control/EPCL_INTERFACES.md` | 🆕 New |
| Capability Registry | `docs/platform/capability-registry/CAPABILITY_REGISTRY.md` | 📋 Update |
| ADR-016 — PSER | `docs/adr/ADR-016-project-state-execution-registry.md` | ✅ Reference |
| ADR-017 — Enterprise Operating Model | `docs/adr/ADR-017-enterprise-operating-model.md` | ✅ Reference |
| WEF v1.1 Architecture | `docs/architecture/WEF_V2_ARCHITECTURE_REVIEW.md` | ✅ Reference |

---

*This ADR is authoritative for the EPCL capability decision.*
*Accepted by AI Platform Architecture on 2026-07-29.*
*ADR-018 — AI Platform Capability #14*