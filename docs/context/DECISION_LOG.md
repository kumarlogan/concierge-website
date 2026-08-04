# DECISION_LOG.md — Consolidated Decision Index
## kumarlogan/concierge-website

**Generated:** 2026-08-04  
**Status of this document:** Authoritative index. Updated when new ADRs are created.  
**Format note:** Tags used throughout — `[OBSERVED]` = confirmed directly from file content, `[INFERRED]` = reasoned from related evidence, `[UNKNOWN]` = could not be confirmed.

---

## 1. Purpose and Scope

This file is an **INDEX** of architectural decisions recorded elsewhere in the repository. It does not replace the ADR files; the ADR files remain authoritative for full context, rationale, alternatives considered, and implementation notes. This index exists so that a new session — human or AI — can orient itself without reading all 18 ADR files.

**Root `DECISIONS.md` is incomplete.** It lists only ADR-001 (Cloudflare migration) and has not been updated since the project's earliest phase [OBSERVED]. As of 2026-08-04 there are 19 ADR entries across 18 files (one number is used twice; see Section 2). This log supersedes `DECISIONS.md` as the index. `DECISIONS.md` itself is preserved in place; it should not be deleted, but it should not be treated as a complete record.

---

## 2. ADR Location Problem

Architecture Decision Records live in **two directories** with **overlapping number ranges**:

| Directory | Number Range | File Count | Notes |
|---|---|---|---|
| `docs/decisions/` | ADR-001 through ADR-016 | 12 files (gap at 009, 012, 013, 015) | Older ADRs; the directory pre-dates `docs/adr/` |
| `docs/adr/` | ADR-012 through ADR-018 | 6 files | Newer ADRs; more recently active directory |

The ranges overlap at ADR-012 through ADR-016. `docs/architecture/README.md` states "all significant architectural decisions are recorded in `docs/decisions/`" — this is stale and incorrect [OBSERVED]; it was written before `docs/adr/` was created.

### ADR-016 Number Collision

**ADR-016 is used twice for two completely different decisions:**

| File | Title | Date | Status |
|---|---|---|---|
| `docs/decisions/ADR-016-communication-centre.md` | Communication Centre Architecture | 2026-08-01 | Approved |
| `docs/adr/ADR-016-project-state-execution-registry.md` | Project State & Execution Registry (PSER) | 2026-07-26 | Accepted |

These are distinct decisions. A reference to "ADR-016" is ambiguous without specifying the directory.

**[RECOMMENDED] Disambiguation convention for future ADRs:** All new ADRs should be placed exclusively in `docs/adr/` and numbered starting from ADR-019. When referencing the colliding ADR-016 in documentation, use the full path or a suffix: `ADR-016-COMM` for the Communication Centre decision and `ADR-016-PSER` for the Project State & Execution Registry decision. Do not renumber or move existing files — that would break existing cross-references.

---

## 3. Complete ADR Index

Sorted by ADR number. Where two files share a number, both rows are shown adjacent with a collision flag. The `Decision (one sentence)` column is drawn directly from each file's Decision section [OBSERVED] unless tagged otherwise.

| ADR | Title | Status | Date | Location | Decision (one sentence) |
|---|---|---|---|---|---|
| ADR-001 | Migration Strategy from Express/PostgreSQL Prototype to Cloudflare Platform | Accepted | 2026-07-18 | `docs/decisions/ADR-001-cloudflare-migration.md` | All future AG Synergy development follows the Cloudflare architecture (Workers + D1 + R2 + Pages); the existing Express/PostgreSQL backend will not be expanded and no new features will be added to it. |
| ADR-002 | Multi-Agent Operations Architecture | Accepted | 2026-07-18 | `docs/decisions/ADR-002-multi-agent-operations-architecture.md` | Two separate Telegram bot interfaces are built (Hermes Admin and Operations Assistant), both communicating exclusively through the Workers API behind a shared Authorization Middleware; no AI agent directly accesses D1. |
| ADR-003 | Permission Resolution Strategy | Accepted | 2026-07-18 | `docs/decisions/ADR-003-permission-resolution-strategy.md` | Role-to-permission mappings are stored as data in a `role_permissions` table (not hardcoded); middleware resolves effective permissions dynamically from the database at request time. |
| ADR-004 | AGS Organization & Multi-Application Architecture | Proposed (planning) | 2026-07-19 | `docs/decisions/ADR-004-organization-architecture.md` | Adopt a three-layer organization architecture (Organization, Applications, AI Workforce) with one-way dependency rules, provider-agnostic interfaces, and monorepo layout. |
| ADR-005 | Hermes as the AGS Organization Platform | Proposed (planning) | 2026-07-19 | `docs/decisions/ADR-005-hermes-platform.md` | Hermes is designated the AGS Organization Platform owning AI Registry, Activation, Governance, Shared Services, and Provider Adapters; it owns no application business logic. |
| ADR-006 | Organization Identity, Environment & Resource Registry | Proposed (planning) | 2026-07-19 | `docs/decisions/ADR-006-organization-resource-registry.md` | The Resource Registry is the single authoritative inventory of every AGS resource; the Identity Model is a strict org → app → env → service/AI/human hierarchy with no upward permission leaks. |
| ADR-007 | AGS Hermes Platform Extraction Strategy | Proposed (planning) | 2026-07-19 | `docs/decisions/ADR-007_HERMES_PLATFORM_EXTRACTION.md` | Adopt an incremental, interface-first, six-phase extraction of the existing auth engine into a standalone `hermes/` platform, with each phase flag-gated and reversible. |
| ADR-008 | Hermes Platform Core Services | Implemented (EPIC-002-006C) | 2026-07-19 | `docs/decisions/ADR-008_HERMES_PLATFORM_CORE_SERVICES.md` | Adopt a seven-service Hermes Core Services layer (Registry, Discovery, Lifecycle, Scheduler, Notification, Memory, Provider Adapter) operating in-process over the extracted capabilities, with all vendor SDK usage isolated in the Provider Adapter Service. |
| ADR-009 | [MISSING — no file exists] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] | [UNKNOWN] — no ADR-009 file found in either directory or via code search. |
| ADR-010 | Trust & Identity as an AI Platform Capability | Accepted | 2026-07-26 | `docs/decisions/ADR-010-trust-identity-platform-capability.md` | Create Trust & Identity as a first-class AI Platform capability with 12 provider-agnostic interfaces, identity-PHI separation, and a workforce identity model; do not embed any open-source IdP at this stage, building instead on Cloudflare Workers. |
| ADR-011 | AI Platform Governance Core Capabilities | Accepted | 2026-07-26 | `docs/decisions/ADR-011-ai-platform-governance-core.md` | Create five new AI Platform governance capabilities (Policy Engine, Consent & Trust, Platform Capability Registry, Engineering Standards, Capability Maturity Model) and expand the Workforce Identity model to 14 agent types, all architecture-only with no implementation authorized. |
| ADR-012 | Admin Platform Internal-Only Facade (No Direct HTTP Exposure) | Accepted | 2026-07-19 | `docs/adr/ADR-012-admin-platform-facade.md` | All admin operations live in `hermes/admin/*` as pure functions with no HTTP route table; the future console reaches them only through the authenticated BFF requiring a verified human principal. |
| ADR-013 | Admin Console BFF (Secure Access Layer) & AI Workforce Integration Foundations | Accepted | 2026-07-19 | `docs/adr/ADR-013-admin-bff-workforce-foundations.md` | All console reads flow through a single `hermes/admin/bff.ts` boundary that receives (never constructs) a verified human principal and fail-closes on agent principals; the dashboard is governed by exactly six domains (Organization, Infrastructure, Workforce, Operations, Security, Governance). |
| ADR-014 | Workforce Development Cycle v1.0 as Official AGS Engineering Execution Model | Accepted | 2026-07-26 | `docs/decisions/ADR-014-workforce-development-cycle.md` | Adopt the Workforce Development Cycle (WDC) v1.0 as the official AGS seven-phase, gate-driven engineering execution model with mandatory human oversight at each gate; subsequently superseded by ADR-015 which renames WDC to WEF. |
| ADR-015 | Governance Freeze & Workforce Execution Framework | Accepted | 2026-07-26 | `docs/adr/ADR-015-governance-freeze-wef.md` | Governance is declared feature-complete (no standalone governance waves after GOV-004); WDC v1.0 is renamed to WEF v1.0 (Workforce Execution Framework); the AI Platform roadmap is separated from the Concierge roadmap. |
| **ADR-016** ⚠️ COLLISION | **Communication Centre Architecture** | Approved | 2026-08-01 | `docs/decisions/ADR-016-communication-centre.md` | Build the Communication Centre as a frontend integration layer over the existing Hermes Platform MessageEngine, adding a unified inbox and notification preferences UI; no new backend platform code. |
| **ADR-016** ⚠️ COLLISION | **Project State & Execution Registry (PSER)** | Accepted | 2026-07-26 | `docs/adr/ADR-016-project-state-execution-registry.md` | Adopt PSER as AI Platform Capability #12 — a deterministic, machine-readable source of truth for all project state, execution history, and workforce context stored in D1 + KV + R2, replacing markdown-parsing at session start. |
| ADR-017 | Enterprise Operating Model | Accepted | 2026-07-27 | `docs/adr/ADR-017-enterprise-operating-model.md` | Adopt a new twelve-level enterprise hierarchy (Company → Business Unit → Platform → Product → Portfolio → Roadmap → Phase → Wave → Epic → Sprint → Story → Task); upgrade WEF to v1.1 as the enterprise-wide (not engineering-only) execution framework; create `docs/company/` as the authoritative home for enterprise operating model documents. |
| ADR-018 | Executive Planning & Control Layer (EPCL) | Accepted | 2026-07-29 | `docs/adr/ADR-018-executive-planning-control-layer.md` | Adopt EPCL as AI Platform Capability #14 — a strategic planning engine that decomposes roadmap objectives into deterministic plan atoms, routes work to workforce disciplines, manages context budget across sessions, and dispatches to WEF for execution. |

**Total unique ADR numbers referenced:** 18 (001–008, 010–018, with 016 appearing twice).  
**Total ADR files:** 18 files in 2 directories.  
**Gap confirmed:** ADR-009 does not exist [OBSERVED via directory listing and code search].

---

## 4. Decisions of Standing Architectural Consequence

These ADRs most constrain future engineering work. For each: what it decided, what it constrains, and whether the repository state actually reflects it.

---

### ADR-001 — Cloudflare Migration (Express/PostgreSQL → Cloudflare)
**File:** `docs/decisions/ADR-001-cloudflare-migration.md`  
**Date:** 2026-07-18 | **Status:** Accepted

**What it decided:** The entire platform runs on Cloudflare (Workers + D1 + R2 + Pages). The Express/PostgreSQL prototype in `artifacts/api-server/` and the `lib/api-zod` and `lib/db` libraries are frozen — no new features, no new tables, no schema changes.

**What it constrains:**
- No new code may be added to `artifacts/api-server/`, `lib/db/`, or any PostgreSQL-dependent path.
- All new backend capabilities must be Workers + D1.
- Database features requiring PostgreSQL-specific syntax (CTEs beyond SQLite support, row-level locking, certain aggregate functions) are not available.

**Repository state vs. decision:** The prototype directory and legacy libraries remain present in the repository as noted in the ADR (preserved for reference). `replit.md` at the repo root still describes the Express/PostgreSQL stack [OBSERVED from G_root_docs_catalogue.md]; it is de facto superseded but not marked as such — a new session loading `replit.md` without this index would be misled. **The constraint is being honored** — no evidence of new features added to the prototype. [OBSERVED from CHANGELOG.md and ARCHITECTURE.md, both of which describe the Cloudflare-only stack as live.]

---

### ADR-011 — AI Platform Governance Core
**File:** `docs/decisions/ADR-011-ai-platform-governance-core.md`  
**Date:** 2026-07-26 | **Status:** Accepted

**What it decided:** Five governance capabilities were designed: Policy Engine, Consent & Trust, Platform Capability Registry (11 capabilities), Engineering Standards (110 mandatory standards across 19 categories), and Capability Maturity Model (8 levels). This ADR also expanded Workforce Identity to 14 agent types. All were architecture-only; no implementation was authorized by ADR-011 itself.

**What it constrains:**
- All future platform capabilities must be documented in the Capability Registry (`docs/platform/capability-registry/CAPABILITY_REGISTRY.md`).
- All capabilities must comply with the 110 Engineering Standards before reaching Production Ready maturity.
- Regulatory compliance (PIPEDA, PHIPA, CASL) is a first-class constraint on any feature touching consent, patient data, or PHI.
- The Policy Engine must be used (not bypassed) for authorization in new products; the existing RBAC engine is wrapped, not replaced.

**Repository state vs. decision:** Architecture documents for all five capabilities exist in `docs/platform/` [OBSERVED from H_docs_tree_catalogue.md]. Implementation status of the Policy Engine and Consent & Trust runtime is [UNKNOWN] — the ADR explicitly states these were architecture-only at adoption; whether subsequent waves implemented them fully is not confirmed by the discovery evidence. The Capability Registry document exists. Engineering Standards enforcement tooling is [UNKNOWN] — the ADR notes that enforcement tools "don't exist yet."

---

### ADR-015 — Governance Freeze & WEF Adoption
**File:** `docs/adr/ADR-015-governance-freeze-wef.md`  
**Date:** 2026-07-26 | **Status:** Accepted

**What it decided:** (1) Governance is feature-complete; no new standalone governance waves. (2) WDC v1.0 is renamed WEF v1.0 (Workforce Execution Framework). (3) The AI Platform roadmap is separated from the Concierge product roadmap. (4) `docs/governance/CURRENT_SPRINT.md` is the authoritative sprint doc (not `docs/planning/CURRENT_SPRINT.md`). (5) Human Operator retains final authority at all WEF gates.

**What it constrains:**
- Governance expansion can only occur if triggered by engineering, architecture, or compliance needs — not as standalone governance work.
- All execution must follow WEF phases and gates with human approval at each gate.
- No autonomous deployment, merge, roadmap change, or scope expansion.
- ADR-014 (WDC v1.0) is superseded; references to WDC should be understood as WEF.

**Repository state vs. decision:** `docs/governance/GOVERNANCE_FREEZE.md` exists [OBSERVED from H_docs_tree_catalogue.md]. `docs/platform/AI_PLATFORM_ROADMAP.md` was created per this ADR [OBSERVED]. CHANGELOG.md as of v1.6.0 (2026-08-01) shows continued wave-based delivery under WEF, consistent with the decision [OBSERVED from G_root_docs_catalogue.md]. Some older documents still reference WDC terminology [INFERRED from ADR-015's own consequences section], creating terminology inconsistency but not a compliance gap.

---

### ADR-016/PSER — Project State & Execution Registry
**File:** `docs/adr/ADR-016-project-state-execution-registry.md`  
**Date:** 2026-07-26 | **Status:** Accepted

**What it decided:** PSER is AI Platform Capability #12. Workforce agents must query a structured PSER API instead of reading markdown documents to reconstruct project state. State is stored in D1 (primary), KV (60s TTL cache), R2 (90-day archive). PSER v1.0 was architecture + interfaces only; runtime implementation was deferred to Phase D Waves 1–3.

**What it constrains:**
- Future sessions should not reconstruct project state from markdown if PSER is live; they should query PSER first.
- Document format changes must not break PSER state (documents become derived views, not the source of truth).
- Gate evaluation for phase and wave transitions must be done programmatically through PSER, not by reading governance markdown.

**Repository state vs. decision:** `docs/launch/PSER_ACTIVATION.md` exists [OBSERVED from H_docs_tree_catalogue.md], suggesting PSER activation occurred. Whether the runtime implementation (D1 migrations 0003–0010 for plan tables, service layer with 11 services) was fully deployed is [UNKNOWN] — the discovery evidence does not confirm this. The ADR itself states that Wave 1 implementation was planned but not yet delivered at the time of writing. **Until confirmed live, agents should continue reading markdown documents for project context and use PSER only if it responds.**

---

### ADR-017 — Enterprise Operating Model
**File:** `docs/adr/ADR-017-enterprise-operating-model.md`  
**Date:** 2026-07-27 | **Status:** Accepted

**What it decided:** (1) New twelve-level enterprise hierarchy adopted (Company → Business Unit → Platform → Product → Portfolio → Roadmap → Phase → Wave → Epic → Sprint → Story → Task). (2) WEF upgraded from v1.0 to v1.1 as an enterprise-wide (not engineering-only) framework. (3) 11 business units defined (Engineering is the only active one). (4) `docs/company/` created as the authoritative home for enterprise operating model documents.

**What it constrains:**
- Future work must be tracked against the full hierarchy (Business Unit and Portfolio are now explicit fields, not implicit).
- Platforms must never own products; the AI Platform serves products, it does not own them.
- `docs/organization/` content about the org structure is now secondary to `docs/company/`; the old files were not removed but ADR-017 makes `docs/company/` authoritative.
- PSER schema must be extended to include Business Unit, Portfolio, Wave, Story, and Task fields before Phase D Wave 1 begins.

**Repository state vs. decision:** The four `docs/company/` files (Enterprise Operating Model, Business Unit Model, Workforce Model, Platform Model) were created per this ADR [OBSERVED]. `docs/organization/` was not cleaned up [OBSERVED from H_docs_tree_catalogue.md], leaving overlapping content. The PSER schema extension required by ADR-017 is [UNKNOWN] — it depends on whether PSER runtime was implemented. Ten of the eleven business units are architecture-only; only Engineering is active [OBSERVED from ADR-017 text].

---

### ADR-018 — Executive Planning & Control Layer (EPCL)
**File:** `docs/adr/ADR-018-executive-planning-control-layer.md`  
**Date:** 2026-07-29 | **Status:** Accepted

**What it decided:** EPCL is AI Platform Capability #14 — a strategic planning engine sitting above PSER and WEF. It decomposes natural-language roadmap objectives into deterministic plan atoms, routes atoms to workforce disciplines, manages context budget (proactive token estimation), and dispatches to WEF's Execution Gateway. Plans are stored in PSER. Humans approve plans before execution begins.

**What it constrains:**
- No AI agent should perform ad-hoc roadmap decomposition from markdown once EPCL is live; decomposition goes through EPCL.
- Context budget management is a platform concern: agents must respect token limits and use EPCL's session decomposition when plans exceed the context window.
- PSER must be extended with plan tables (approximately 3 new D1 tables) before EPCL can persist plans.
- WEF is unchanged by EPCL; EPCL dispatches to WEF, not around it.

**Repository state vs. decision:** `docs/platform/executive-planning-control/` directory exists [OBSERVED from H_docs_tree_catalogue.md, which notes `docs/platform/` contains an EPCL subdirectory]. EPIC-007 certification (root `EPIC-007_CERTIFICATION.md`) shows a "12-stage EPCL workflow" with 748/750 tests — this suggests EPCL was at least partially implemented [OBSERVED from G_root_docs_catalogue.md]. `WAVE2_AUDIT_REPORT.md` (2026-07-30) states that Wave 2 did NOT execute through the certified Hermes Foundation architecture — EPCL flags defaulted to false and the certified execution path was not invoked [OBSERVED from G_root_docs_catalogue.md]. This is a gap: **EPCL is implemented but not yet used as the actual execution path for wave delivery.** The autonomous orchestration pipeline exists but was bypassed in practice.

---

### ADR-012 + ADR-013 — Admin Platform Security Boundary
**Files:** `docs/adr/ADR-012-admin-platform-facade.md`, `docs/adr/ADR-013-admin-bff-workforce-foundations.md`  
**Dates:** Both 2026-07-19 | **Status:** Both Accepted

**What they decided:** The admin platform has no public HTTP endpoints. All admin logic lives as pure functions in `hermes/admin/*`. The only runtime boundary is the BFF (`hermes/admin/bff.ts`), which requires a verified human principal. Agent principals and service tokens are rejected at the gate (fail-closed). Six dashboard domains are canonical. The console SPA is a skeleton — component rendering was deferred [OBSERVED from ADR-013 consequences]. ADR-013's addendum (EPIC-002-006G) completed a real console renderer and a controlled workflow orchestrator (non-autonomous, approval-required), with 239/239 tests passing [OBSERVED].

**What they constrain:**
- No admin route may be added to any public worker. Admin access requires a human principal every time.
- Any new admin domain must be added to the six-domain canonical set through a new ADR.
- Agent execution through the console workflow requires explicit human approval; there is no autonomous approval path.
- MCP tools must implement the `ToolProvider` interface — no direct vendor SDK wiring.

**Repository state vs. decision:** 239/239 tests passing at the time of ADR-013 addendum [OBSERVED]. Console SPA renderer is implemented [OBSERVED]. No evidence that the console has been deployed as a running endpoint — it is an internal-only facade [INFERRED as intended by design, per ADR-012].

---

## 5. Decisions Recorded Outside the ADR System

Significant choices captured only in root documents or governance files, not in a numbered ADR.

| Decision | Document(s) | Date | Summary |
|---|---|---|---|
| Repository rename from `hermes-website` to `concierge-website` | `GOV-001_MIGRATION_CHECKLIST.md`, `GOV-001_REFERENCE_AUDIT.md` | 2026-07-26 | Repo renamed as GOV-001 to reflect product-first naming; Cloudflare Worker name intentionally not yet renamed (deferred). |
| Canonical naming taxonomy (AGS / AI Platform / Concierge / AG Synergy / Hermes) | `NAMING_STANDARDS.md` | 2026-07-26 (GOV-001) | Establishes which name applies at each layer; prohibits "Hermes Platform" in governance hierarchy; preserves "Hermes" for the software itself. |
| Foundation freeze at v1.0 — no new capabilities to Hermes Foundation | `FOUNDATION_FREEZE.md` | 2026-07-30 | Hermes Foundation frozen at v1.0 (614/614 tests); no new capabilities; certified for controlled autonomy. |
| Operating model for human vs. Hermes authority boundaries | `OPERATING_MODEL_v1.md`, `AI_OPERATING_MODEL.md` | 2026-07-30, 2026-07-18 | Human operator has final authority; no autonomous deployment, merge, or scope expansion; agents are advisory. |
| Multi-product model (Concierge as Product #1; future products) | `MULTI_PRODUCT_MODEL.md` | 2026-07-30 | Defines how the Hermes Foundation manages multiple products; Concierge is Product #1; AGS as the company entity. |
| Product execution lifecycle (9-phase model) | `PRODUCT_EXECUTION_MODEL.md` | 2026-07-30 | Nine-phase lifecycle for every Hermes-managed product from Vision through Next Batch. |
| MVP security baseline with 9 accepted residual risks | `MVP_SECURITY_BASELINE.md` | 2026-07-29 | Defines active security controls and formally accepts risks R1–R9; WEF 87% compliance. |
| Governance declared feature-complete (GOVERNANCE_FREEZE) | `docs/governance/GOVERNANCE_FREEZE.md` | 2026-07-26 | Parallel to ADR-015; governance freeze is also recorded as a standalone governance document. |
| Two CURRENT_SPRINT.md files exist — `docs/governance/` is authoritative | ADR-015 (Related Documents table) | 2026-07-26 | ADR-015 designates `docs/governance/CURRENT_SPRINT.md` as canonical; `docs/planning/CURRENT_SPRINT.md` is secondary and may drift. |

---

## 6. How to Record a New Decision

**[RECOMMENDED] Procedure for new ADRs:**

1. **Where to put it:** All new ADRs go in `docs/adr/`. Do not add new files to `docs/decisions/`; that directory is preserved for historical ADRs but is no longer the active location.

2. **Next free number:** ADR-019. (ADR-018 is the highest numbered ADR as of 2026-08-04. ADR-009 was skipped and should remain unassigned.)

3. **Required fields** (follow the format established in ADR-015 through ADR-018):
   ```
   # ADR-NNN — Title
   
   > **Status:** [Proposed | Accepted | Superseded | Deprecated]
   > **Date:** YYYY-MM-DD
   > **Phase:** [phase or context]
   > **Category:** [Architecture | Process | Governance | Security | etc.]
   
   ## Governance Header (block)
   Company / Platform / Product / ADR ID / Status / Author / Framework
   
   ## Context
   ## Decision
   ## Consequences (Positive / Negative / Neutral / Risks)
   ## Related Documents
   ```

4. **Add a row to this index:** After creating the ADR file, add a row to the table in Section 3 of this document. Include: ADR number, title, status, date, path, and a one-sentence decision statement.

5. **If the decision supersedes an earlier ADR:** Add a "Superseded By" field to the old ADR's header (or a note at the top if the file is treated as append-only), and note the relationship in the new ADR's Related Documents section.

6. **Avoid the ADR-016 problem:** Confirm the chosen number is free in both `docs/decisions/` and `docs/adr/` before creating the file.

---

## Appendix: File Inventory Cross-Reference

| File | SHA (as of 2026-08-04) | Size |
|---|---|---|
| `docs/decisions/ADR-001-cloudflare-migration.md` | `54538925` | 3,486 bytes |
| `docs/decisions/ADR-002-multi-agent-operations-architecture.md` | `06907b9c` | 3,377 bytes |
| `docs/decisions/ADR-003-permission-resolution-strategy.md` | `9492741b` | 4,908 bytes |
| `docs/decisions/ADR-004-organization-architecture.md` | `4e814e9d` | 4,381 bytes |
| `docs/decisions/ADR-005-hermes-platform.md` | `d15e243f` | 4,009 bytes |
| `docs/decisions/ADR-006-organization-resource-registry.md` | `6647979d` | 5,033 bytes |
| `docs/decisions/ADR-007_HERMES_PLATFORM_EXTRACTION.md` | `c5bc99e1` | 5,502 bytes |
| `docs/decisions/ADR-008_HERMES_PLATFORM_CORE_SERVICES.md` | `62f13258` | 6,717 bytes |
| `docs/decisions/ADR-010-trust-identity-platform-capability.md` | `79c1eecd` | 6,277 bytes |
| `docs/decisions/ADR-011-ai-platform-governance-core.md` | `0b465901` | 10,332 bytes |
| `docs/decisions/ADR-014-workforce-development-cycle.md` | `4282a85a` | 5,503 bytes |
| `docs/decisions/ADR-016-communication-centre.md` | `0b23798f` | 9,765 bytes |
| `docs/adr/ADR-012-admin-platform-facade.md` | `be3cbc3e` | 2,735 bytes |
| `docs/adr/ADR-013-admin-bff-workforce-foundations.md` | `9c117a25` | 11,072 bytes |
| `docs/adr/ADR-015-governance-freeze-wef.md` | `a157b39e` | 7,218 bytes |
| `docs/adr/ADR-016-project-state-execution-registry.md` | `d451fe54` | 8,607 bytes |
| `docs/adr/ADR-017-enterprise-operating-model.md` | `36fd0dec` | 7,015 bytes |
| `docs/adr/ADR-018-executive-planning-control-layer.md` | `15415d70` | 16,749 bytes |

*All 18 ADR files read and indexed. ADR-009 confirmed absent. ADR-016 collision confirmed. Source: GitHub API, branch `35a665e7` (main).*
