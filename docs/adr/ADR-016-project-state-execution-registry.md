# ADR-016 — Project State & Execution Registry

> **Status:** ✅ Accepted
> **Date:** 2026-07-26
> **Phase:** Phase D — Core Runtime (Architecture)
> **Category:** Architecture · Platform Capability · Workforce Integration

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge (first registered PSER product)
Public Brand:   AG Synergy
Repository:     concierge-website
ADR:            ADR-016 — Project State & Execution Registry
Status:         ✅ Accepted
Author:         AI Platform Architecture
Framework:      WEF v1.0 (Workforce Execution Framework)
Capability:     #12 — Project State & Execution Registry
```

---

## Context

Workforce agents currently reconstruct project context from markdown documentation at the start of every execution cycle. The WEF v1.0 Phase 0 validation step reads COMPANY_STATUS.md, ROADMAP.md, CURRENT_SPRINT.md, and PROGRAM_STATUS.md — then synthesizes a context from unstructured text. This approach has six fundamental problems:

1. **Non-deterministic** — Different agents may interpret the same documents differently. LLM understanding of project state is probabilistic, not deterministic.
2. **Fragile** — Document format changes break agent context retrieval. A renamed section heading causes context loss.
3. **Slow** — An agent must read multiple documents (15,000+ words combined) at every session start.
4. **No resume support** — There is no canonical resume point. The previous session's human operator must describe where work left off.
5. **No execution history** — Completed tasks, decisions, and outcomes are recorded in text if at all. No machine-readable execution timeline exists.
6. **No lifecycle gates** — Phase transitions, wave completions, and epic closeouts are tracked in governance documents but never validated programmatically.

PSER solves all six problems by providing a deterministic, structured, queryable source of truth for project state, execution history, workforce assignments, and governance gates.

---

## Decision

Adopt the Project State & Execution Registry (PSER) as AI Platform Capability #12.

### What PSER Is

- A **machine-readable source of truth** for all project state, execution history, and workforce context
- A **deterministic query service** — workforce agents call one API instead of reading multiple markdown documents
- A **resume point service** — the exact step from which work should continue is stored and retrievable
- A **gate evaluation service** — entry and exit criteria for phases, waves, and epics are evaluated against the data model
- An **append-only execution history** — every task, session, and decision is recorded immutably

### What PSER Is Not

- **Not a markdown replacement** — Documentation remains the human-readable representation. Documents become derived views of PSER state.
- **Not a product feature** — PSER is a platform capability. Concierge is Product #1 registered with PSER, not the implementation.
- **Not an LLM service** — All PSER state is explicitly written by agents or operators. No LLM infers project status.
- **Not a runtime service** — PSER v1.0 is architecture + data model + interfaces. Runtime implementation is Phase D Wave 1+.

---

## Design Choices

| Decision | Choice | Alternatives Considered | Rationale |
|----------|--------|------------------------|-----------|
| **State storage** | D1 (SQLite-compatible) | Postgres, KV-only, document store | D1 is the existing AI Platform storage layer. Zero new infrastructure. Relational hierarchy maps naturally to state hierarchy. |
| **Cache layer** | KV (60s TTL) | No cache, Redis, Postgres | KV is the existing cache layer. 60s TTL handles read-heavy workforce queries. Invalidation on write. |
| **Archive** | R2 (90-day cold store) | D1 retention, S3 | R2 is existing archive layer. 90-day threshold balances query performance with storage cost. |
| **Interface pattern** | Service-per-domain | Monolithic CRUD, GraphQL, event bus | Mirrors existing platform service pattern (Intent Engine, Identity Core). Each service owns one domain. No breaking changes for consumers. |
| **State machine** | Service-layer evaluation | Database triggers, external engine | Deterministic rules engine. No LLM in gate decisions. Human always in loop for major transitions. |
| **Authorization** | RBAC via Auth Engine | Custom ACL, API keys | Reuses existing AI Platform Security capability. Roles: reader/writer/approver/admin/operator. |
| **Audit** | Append-only D1 table | Event stream, external audit service | Immutable audit aligned with existing Pattern (Phase 1 audit logs). No external dependencies. |
| **Concurrency** | Optimistic locking (version field) | Pessimistic locks, last-write-wins | Version field on every entity table. UPDATE WHERE version = :expected. Conflict returns error for retry. |

---

## Consequences

### Positive

- Workforce agents query one API instead of reading multiple markdown documents — context retrieval becomes deterministic and O(1)
- Resume points enable exact continuation between sessions — no human handoff required
- Execution history enables audit, metrics, and performance analysis across all products
- Gate evaluation prevents premature phase/wave transitions — criteria must be met programmatically
- Multi-product support is built into the data model from day one — future products register through ProductService
- Capability registry integration — PSER is documented as Capability #12 with its dependencies, consumers, and maturity tracked

### Negative

- Initial seed of PSER from existing governance documents is a one-time manual migration — existing markdown state must be translated to structured records
- PSER adds platform overhead — each task creates execution events, gate evaluations, and audit records that would not exist in a purely markdown-driven workflow
- Cache invalidation on write requires careful design — stale KV state could cause agents to read outdated context
- D1's 5GB storage limit may constrain execution history retention — R2 archival strategy must be implemented before the first 90 days of production use

### Neutral

- Existing markdown governance documents become derived views rather than source of truth — document regeneration from PSER is Phase D Wave 3 work, not v1.0
- Workforce agents must be updated to use PSER interfaces instead of reading documents — migration requires coordination but the protocol is well-defined
- Human operators gain a new interface (approval queue, state override panel) but lose the ability to edit project state by editing documents directly

---

## Dependencies

| Dependency | Type | Status |
|-----------|------|--------|
| AI Platform Storage (D1, KV, R2) | Infrastructure | ✅ Live |
| AI Platform Security (Auth Engine, RBAC) | Platform | ✅ Live |
| AI Platform Observability (Health, Audit) | Platform | ✅ Live |
| AI Platform Notifications (Approval channels) | Platform | ⚠️ Partial |
| AI Platform Capability Registry (#12 slot) | Platform | ✅ Updated |
| Workforce Orchestration (Agent registry) | Platform | ✅ Live |
| WEF v1.0 | Framework | ✅ Active |

---

## Implementation Roadmap

| Wave | Focus | Deliverables |
|------|-------|-------------|
| **Wave 1** | Implementation | D1 migrations (0003–0010), service layer (11 services), interface contracts, KV cache, R2 archiver, seed Concierge product state |
| **Wave 2** | Workforce Adoption | Update WEF Phase 0 to PSER queries, update all 5 agent types to use PSER interfaces, remove markdown-parsing dependency |
| **Wave 3** | Dashboard & Docs | Auto-generation of governance documents from PSER state, admin dashboard for human operators, approval queue in notifications |

---

## Related Documents

- PSER Architecture — `docs/platform/project-state-registry/PSER_ARCHITECTURE.md`
- PSER Interfaces — `docs/platform/project-state-registry/PSER_INTERFACES.md`
- PSER Data Model — `docs/platform/project-state-registry/PSER_DATA_MODEL.md`
- PSER Execution State — `docs/platform/project-state-registry/PSER_EXECUTION_STATE.md`
- PSER Workforce Integration — `docs/platform/project-state-registry/PSER_WORKFORCE_INTEGRATION.md`
- Capability Registry — `docs/platform/capability-registry/CAPABILITY_REGISTRY.md` (Capability #12)
- AI Platform Roadmap — `docs/platform/AI_PLATFORM_ROADMAP.md` (Phase D)

---

*This ADR is authoritative for the PSER capability decision.*
*Accepted by AI Platform Architecture on 2026-07-26.*
*ADR-016 — AI Platform Capability*