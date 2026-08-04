# Documentation Index — kumarlogan/concierge-website

**Generated:** 2026-08-04  
**Evidence sources:** `G_root_docs_catalogue.md`, `H_docs_tree_catalogue.md`, `I_repo_activity.md`  
**All claims traceable to those files. Anything not found there is marked `unknown`.**

---

## 1. How to Use This Index

### Authority Model

Every document in this repository carries one of four authority labels:

| Label | Meaning | How to read it |
|---|---|---|
| **AUTHORITATIVE** | Describes current state as of the date shown. Trust it as ground truth. | Read and act on it. |
| **HISTORICAL** | A deliberate point-in-time record — a certification, audit, completion report, or snapshot frozen at a specific moment. It was accurate when written; it is not a claim about today. | Read for context and evidence trail only. Do not interpret it as current state. |
| **SUPERSEDED** | Replaced by a named newer document. The old document is kept for audit continuity. | Read the replacement instead. Do not delete the superseded file. |
| **UNCERTAIN** | Could not be verified as current or was found to contain contradictions with more recent documents. | Treat with scepticism; cross-check against AUTHORITATIVE sources before acting. |

**Critical rule:** Historical documents are intentionally retained and must not be deleted. They form the evidence trail for certifications, governance decisions, and phase gate reviews. Deleting them would destroy audit continuity.

---

## 2. Start Here

Read these documents in order when beginning a new session. Each one narrows the context needed to work safely.

| # | Document | Why read it first |
|---|---|---|
| 1 | `NAMING_STANDARDS.md` | Establishes the canonical name hierarchy (AGS / AI Platform / Concierge / AG Synergy / Hermes) that every other document uses. Without this, naming in older docs is confusing. |
| 2 | `PROJECT.md` | Project constitution v1.1: vision, principles, tech stack, definition of done, phase table (Phases 0–2 complete, Phase 3 planned). The single authoritative anchor for "what this project is." |
| 3 | `ARCHITECTURE.md` | Full system architecture v2.2 (52 KB). Describes all platform layers, components, and the WEF v1.1 framework. Required before reading any technical document. |
| 4 | `ROADMAP.md` | Phase 0–4 roadmap. Phases 0–2 complete (2026-07-27); all 9 waves delivered; Phase 3 pending. Establishes where the product stands in its lifecycle. |
| 5 | `OPERATING_MODEL_v1.md` | Definitive operating model: what Hermes does autonomously vs what requires human approval. Critical safety document — governs agent behaviour boundaries. |
| 6 | `FOUNDATION_FREEZE.md` | Declares Hermes Foundation v1.0 frozen. Lists frozen components and freeze rules. No new capabilities may be added without a deliberate unfreeze. |
| 7 | `AI_OPERATING_MODEL.md` | Defines AI roles (Human PO, Architecture Advisor, Hermes, QA/Security/Docs agents), authority boundaries, and collaboration workflow. Required for any AI session that will perform work. |
| 8 | `CURRENT_SPRINT.md` | Current sprint status: Wave 9 complete, Phase 2 delivered. Contains stop conditions — explicit things an AI session must not do. Read before taking any action. |
| 9 | `MVP_SECURITY_BASELINE.md` | Post-certification security baseline: active controls, 9 accepted residual risks (R1–R9), deployment checklist. Read before any code or deployment action. |
| 10 | `docs/governance/GOVERNANCE_INDEX.md` | The closest thing to a global governance table of contents. Covers governance documents, decision log, and phase gates. Read to understand the governance layer. |

---

## 3. Root Documents Table

All 47 root markdown files. No omissions.

| # | File | Purpose | Authority | Date | Notes / Superseded by |
|---|---|---|---|---|---|
| 1 | `ACTIVATION_WORKFLOW_SUMMARY.md` | Workforce agent activation workflow — operator-controlled, approval-gated; all constraints honored | HISTORICAL | unknown | Implementation summary only |
| 2 | `AI_OPERATING_MODEL.md` | AI roles, authority boundaries, and collaboration workflow; v1.0 ratified | AUTHORITATIVE | 2026-07-18 | — |
| 3 | `API.md` | REST API reference for agsynergy-api Workers v0.2.0; health, consultations, ops endpoints, Telegram webhook, CORS; 141 tests at time of writing | AUTHORITATIVE | unknown | Test count is stale (614 tests as of Phase 2 complete); API surface is current |
| 4 | `ARCHITECTURE.md` | Full system architecture v2.2; all layers, components, WEF v1.1 framework (52 KB) | AUTHORITATIVE | 2026-07-26 | — |
| 5 | `CHANGELOG.md` | Release history; latest entry v1.6.0 (2026-08-01, Wave 6 Communication Centre) | AUTHORITATIVE | 2026-08-01 | ~90 KB; authoritative version history |
| 6 | `COMPLETION_REPORT.md` | Phase 2 Wave 9 completion report; 614/614 tests; all workstreams done; v1.22.0-dev | HISTORICAL | 2026-07-27 | Point-in-time completion record |
| 7 | `CURRENT_SPRINT.md` | Current sprint: Wave 9 complete; Phase 2 delivered; stop conditions active | AUTHORITATIVE | unknown | Contains mandatory stop conditions for AI sessions |
| 8 | `DATABASE.md` | D1 schema reference (agsynergy-db): 6 ops tables + 6 RBAC tables; migration history | AUTHORITATIVE | 2026-07-18 | — |
| 9 | `DECISIONS.md` | ADR index — only ADR-001 listed; severely incomplete | UNCERTAIN | 2026-07-18 | Lists only 1 of 19+ ADRs; do not use as ADR index; see `docs/decisions/` and `docs/adr/` |
| 10 | `EPIC-007_CERTIFICATION.md` | Runtime certification of EPIC-007 (12-stage EPCL workflow); 748/750 tests; conditional pass | HISTORICAL | 2026-07-30 | Point-in-time certification record |
| 11 | `EPIC-010_DEPLOY_GOVERNANCE.md` | Record of EPIC-010 governed deployment: overlay removal from About Us hero | HISTORICAL | 2026-07-21 | Post-deploy record |
| 12 | `EPIC-010_PREVIEW.md` | Pre-deploy analysis for EPIC-010: no-op confirmed; change already present | HISTORICAL | 2026-07-21 | Pre-deploy analysis record |
| 13 | `EXECUTION_READINESS.md` | Hermes readiness assessment for AG Synergy roadmap; all 8 criteria met | HISTORICAL | 2026-07-30 | Point-in-time readiness gate |
| 14 | `FOUNDATION_AUDIT_REPORT.md` | Evidence-based audit of Hermes Foundation components; all production-ready | HISTORICAL | approx. 2026-07-30 | Audit trail record |
| 15 | `FOUNDATION_CHANGELOG.md` | Hermes Foundation version history: v0.5.0 through v1.0.0 (certified 2026-07-30, frozen) | HISTORICAL | 2026-07-30 | Frozen version log |
| 16 | `FOUNDATION_FREEZE.md` | Declaration freezing Hermes Foundation v1.0; frozen components and freeze rules | AUTHORITATIVE | 2026-07-30 | Active governance constraint |
| 17 | `FOUNDATION_RECONCILIATION.md` | Resolves 614 vs 750 vs 558 test count discrepancy across baseline snapshots | HISTORICAL | 2026-07-30 | See Conflict 1 below; 614 is authoritative current count |
| 18 | `FOUNDATION_v1_RELEASE_NOTES.md` | Official release notes for Hermes Foundation v1.0.0; certified for controlled autonomy | HISTORICAL | 2026-07-30 | Frozen release record |
| 19 | `GOV-001_MIGRATION_CHECKLIST.md` | Manual steps for renaming repo from hermes-website to concierge-website; 9 phases | HISTORICAL | 2026-07-26 | Worker rename deferred (still named hermes-website in Cloudflare) |
| 20 | `GOV-001_REFERENCE_AUDIT.md` | Comprehensive audit of all hermes-website references; 55+ auto-updated; 14 keep-as-is | HISTORICAL | 2026-07-26 | Completed audit record |
| 21 | `GOVERNANCE_CERTIFICATION.md` | Certifies Hermes Platform Foundation governance as production-ready | HISTORICAL | approx. 2026-07-30 | Point-in-time certification record |
| 22 | `HERMES_CORE_NIGHT_PROMPT.md` | Operational prompt for Hermes night sprint; M1–M3 (trust persistence, checksum, signature) complete | HISTORICAL | unknown | Implementation record; awaiting human review before M4 |
| 23 | `HERMES_PLATFORM_CERTIFICATION.md` | Final certification for Hermes Platform Foundation; 614/614 tests; certified for controlled autonomous execution | HISTORICAL | 2026-07-30 | Point-in-time certification record |
| 24 | `HERMES_PROJECT_STATE_AUDIT_2026-07-25.md` | Large machine-readable point-in-time audit: 558 tests, 193 untracked files, 12 agents all disabled | HISTORICAL | 2026-07-25 | Frozen snapshot; 46 KB |
| 25 | `HERMES_V1_STABILIZATION_REPORT.md` | Stabilization results: 5 test failures fixed; 558 tests passing; 4 files committed | HISTORICAL | 2026-07-25 | Pre-production stabilization record |
| 26 | `HERMES_v1_RELEASE_NOTES.md` | v1.0.0 release notes: Cloudflare-first platform; 558 tests; production deploy blocked at time of writing | HISTORICAL | 2026-07-25 | Production was achieved by 2026-07-29; these notes are a historical snapshot only |
| 27 | `MULTI_PRODUCT_MODEL.md` | How Hermes manages multiple products; Concierge as first; Product B/C future; isolation rules | AUTHORITATIVE | 2026-07-30 | — |
| 28 | `MVP_SECURITY_BASELINE.md` | Post-certification security baseline: active controls, residual risks R1–R9, deployment checklist | AUTHORITATIVE | 2026-07-29 | — |
| 29 | `NAMING_STANDARDS.md` | Canonical naming taxonomy: AGS / AI Platform / Concierge / AG Synergy / Hermes; prohibited usages | AUTHORITATIVE | 2026-07-26 | Adopted via GOV-001; read first |
| 30 | `OPERATING_MODEL_v1.md` | Definitive operating model: human vs Hermes responsibilities; autonomous boundaries; operating cycle | AUTHORITATIVE | 2026-07-30 | — |
| 31 | `OPERATIONAL_READINESS_REPORT.md` | Platform operational readiness: all 8 criteria met; 614/614 tests; controlled autonomy verified | HISTORICAL | approx. 2026-07-30 | Point-in-time readiness gate |
| 32 | `PLATFORM_BASELINE_v1.md` | Comprehensive frozen platform baseline: full architecture inventory, 558 tests, 193 untracked files (61 KB) | HISTORICAL | 2026-07-25 | Frozen at main@85980e9 |
| 33 | `PRODUCT_BOUNDARIES.md` | AG Synergy platform scope: core services, healthcare provider responsibilities, AI boundaries, patient data principles | AUTHORITATIVE | 2026-07-18 | — |
| 34 | `PRODUCT_EXECUTION_MODEL.md` | 9-phase execution lifecycle for every Hermes-managed product | AUTHORITATIVE | 2026-07-30 | — |
| 35 | `PROJECT.md` | Project constitution v1.1: vision, principles, tech stack, DoD, governance, phase table | AUTHORITATIVE | 2026-07-26 | — |
| 36 | `README.md` | Repo overview: status (Phase 1 complete), quick links, tech stack | AUTHORITATIVE | unknown | Note: Phase 2 is also complete; README phase status is slightly stale but still useful as orientation |
| 37 | `ROADMAP.md` | Full product roadmap: Phases 0–4; Phases 0–2 complete 2026-07-27; Phase 3 planned | AUTHORITATIVE | 2026-07-27 | — |
| 38 | `SECURITY-REVIEW.md` | v1.0 security review: 5 critical, 6 high, 9 medium findings; score 5.6/10; WEF 63% | SUPERSEDED | 2026-07-29 | Superseded by `SECURITY-REVIEW-v2.md` |
| 39 | `SECURITY-REVIEW-v2.md` | v2.0 reconciliation: all critical and high findings resolved; score 9.0/10; WEF 87%; certification candidate | AUTHORITATIVE | 2026-07-29 | Supersedes `SECURITY-REVIEW.md` |
| 40 | `SECURITY.md` | Security policies and posture at Phase 1 baseline; last reviewed 2026-07-18 | UNCERTAIN | 2026-07-18 | Stale — describes Phase 2 auth as "planned" but it was completed by 2026-07-29; superseded in substance by `SECURITY_CERTIFICATION_REPORT.md` and `MVP_SECURITY_BASELINE.md` but not formally marked superseded |
| 41 | `SECURITY_CERTIFICATION_REPORT.md` | Formal security certification: 22/22 findings reconciled; WEF 87%; PASS at revision 864f213 | HISTORICAL | 2026-07-29 | Point-in-time certification record; valid until next architecture freeze review |
| 42 | `STYLEGUIDE.md` | Code style guide: TypeScript, Prettier, naming conventions, React patterns, Git conventions | AUTHORITATIVE | unknown | Permanent reference |
| 43 | `TASKS.md` | Task registry tracking Phase 0 and Epics 1–2; EPIC-002-005 (Admin Bot) marked Not Started | UNCERTAIN | unknown | Frozen at Phase 1 snapshot; does not reflect Wave 1–9 work completed in Phase 2; unreliable as current task reference |
| 44 | `VALIDATION_REPORT.md` | EPIC-003-006 validation: typecheck EXIT 0, 375/375 tests, clean secret scan | HISTORICAL | 2026-07-20 | Point-in-time validation record |
| 45 | `WAVE2_AUDIT_REPORT.md` | Audit finding: Wave 2 implemented directly, bypassing certified EPCL→WAS→WEF orchestration path | HISTORICAL | 2026-07-30 | Important gap record; see Conflict 7 below |
| 46 | `WORKFORCE_OBSERVABILITY_SUMMARY.md` | Workforce observability v1 implementation: observability service, D1 schema (migration 0005) | HISTORICAL | unknown | Implementation summary |
| 47 | `replit.md` | Original Replit scaffold: Express + Postgres + Drizzle ORM; pnpm workspaces; port 23815 | SUPERSEDED | unknown | Describes pre-Cloudflare prototype architecture; wholly replaced by Cloudflare Workers + D1 (ADR-001) |

---

## 4. docs/ Directory Table

All 26 subdirectories. File counts are as observed in discovery; dates are observed or inferred as noted.

| Directory | Files | Purpose | Authority | Notes |
|---|---|---|---|---|
| `docs/` (root, loose) | 1 | Single orphan completion record (`EPIC-002-006E-completion.md`) | HISTORICAL | Orphan; should be in `docs/operations/` |
| `docs/adr/` | 6 | Architecture Decision Records ADR-012 through ADR-018 (platform-level, recent) | AUTHORITATIVE | Most recently active ADR directory; see Overlap 3 (collision with `docs/decisions/`) |
| `docs/api/` | 1 | API overview README stub | UNCERTAIN | Placeholder only; no actual API spec documents |
| `docs/architecture/` | ~45 | Hermes platform architecture; EPIC baseline/completion reviews; WEF V2 analysis series; provider system docs | MIXED | Authoritative for provider/trust/capability architecture; `README.md` is stale (lists only ADR-001); WEF V2 series is an extensive multi-document analysis |
| `docs/certification/` | 19 | Pre-launch and post-launch certifications: security, accessibility, UX, operations, performance, WAS | HISTORICAL | Point-in-time evidence records; not living docs |
| `docs/company/` | 4 | Enterprise operating model: business unit model, workforce model, platform model | AUTHORITATIVE | Created by ADR-017 (2026-07-27); newest enterprise-level directory; supersedes equivalent content in `docs/organization/` |
| `docs/database/` | 4 | D1 database design, RBAC design, migration strategy | AUTHORITATIVE | Authoritative for database schema and RBAC model |
| `docs/decisions/` | 13 | ADR-001 through ADR-016 (early-series): Cloudflare migration, multi-agent ops, permission resolution, org architecture, Hermes platform, communication centre | AUTHORITATIVE (for ADR-001 to ADR-011, ADR-014) | ADR-009 missing; ADR-016 number collision with `docs/adr/`; see Conflict 2 and Overlap 3 |
| `docs/governance/` | 11 | Program status dashboards, decision log, governance index, phase gates, governance freeze declaration, WEF/WDC documentation, AI platform status | AUTHORITATIVE | `GOVERNANCE_INDEX.md` (20,569 bytes) is the closest existing global TOC; `CURRENT_SPRINT.md` here is authoritative over `docs/planning/CURRENT_SPRINT.md` per ADR-015 |
| `docs/launch/` | 14 | Phase 1 launch validation: DNS, Cloudflare Pages, production worker, secrets, rollback, analytics, monitoring, PSER activation, WEF operational validation | HISTORICAL | Point-in-time launch evidence records |
| `docs/mission/` | 4 | Hermes 10-layer model, agent inventory, organization blueprint, workforce reconciliation | MIXED | Overlaps with `docs/organization/`; see Overlap 2 |
| `docs/operations/` | 124 | Epic-by-epic completion/validation/baseline reports; AGS staging/activation runbooks; session handoff; deployment; secrets; technical debt; audit | HISTORICAL | Largest directory (124 files); per-EPIC granularity; overlaps with `docs/ops/`; see Overlap 1 |
| `docs/ops/` | 74 | Wave-by-wave scorecards; release operations; operator guide; skill/agent/department registries; executive dashboard; PO review packages | HISTORICAL (records) / AUTHORITATIVE (registries) | Per-wave granularity; overlaps with `docs/operations/`; contains agent, skill, and department registries; see Overlap 1 |
| `docs/organization/` | 19 | Three-layer org architecture, Hermes platform definition, AI workforce, dependency rules/graph, resource registry, identity model, environment model | MIXED | Predates `docs/company/`; ADR-017 designates `docs/company/` as new home for enterprise model content but old files were not removed; see Overlap 2 |
| `docs/phases/` | 1 | `PHASE_2_PATIENT_WORKFLOW_PLATFORM.md` planning doc | HISTORICAL | Near-orphan; single stale file; directory unused beyond this file |
| `docs/planning/` | 3 | `CURRENT_SPRINT.md`, `PHASE_2_PLANNING.md`, `PHASE_2_SKELETON.md` | UNCERTAIN | `CURRENT_SPRINT.md` here is NOT authoritative — `docs/governance/CURRENT_SPRINT.md` takes precedence per ADR-015; see Conflict 3 |
| `docs/platform/` | ~50 (multi-level) | Canonical platform capability architecture: trust-identity, workforce-identity, consent-trust, policy-engine, maturity-model, capability-registry, engineering-standards, PSER, release-management, workforce-activation, EPCL; also `AI_PLATFORM_ROADMAP.md` | AUTHORITATIVE | Most authoritative technical directory for platform capabilities; multi-level subdirectory structure |
| `docs/products/` | 1+ | `products/concierge/PRODUCT_STATUS.md` | AUTHORITATIVE | Current product status; sparse (only Concierge product so far) |
| `docs/reconciliation/` | 21 | Hermes runtime reconciliation: agent registry, organization, capability runtime, discipline runtime, execution trace, memory model, gap report, final reconciliation | HISTORICAL | Audit trail and reconciliation evidence; produced during execution phases; not living docs |
| `docs/releases/` | ~30 (multi-level) | Release artifacts: v1.0.0 cert, v1.1.0 notes/deploy/incidents/RCA, Phase 1 RC1 full release package, Wave 6 release package, `PHASE_1_EXIT.md` | HISTORICAL | Well-organized per-release structure under `releases/concierge/patient-portal/`; authoritative location for formal release packages |
| `docs/reviews/` | 3 | Infrastructure validation, operational readiness, production readiness review | HISTORICAL | Sparse (3 small files); pre-launch reviews |
| `docs/roadmaps/` | 1 | `wave-3-phase3-clinic-collaboration.md` — Wave 3 planning | HISTORICAL | Near-orphan; superseded by `docs/platform/AI_PLATFORM_ROADMAP.md` and root `ROADMAP.md`; see Overlap 4 |
| `docs/security/` | 1 | `README.md` stub (355 bytes) | UNCERTAIN | Placeholder only; no content; the substantive security docs are at root level and in `docs/certification/` |
| `docs/sprints/` | 3 | EPIC-002 planning, epic-001 retrospective, README | HISTORICAL | Sparse; most sprint records are in `docs/ops/` |
| `docs/templates/` | 5 | Templates: EPIC, PHASE, RETROSPECTIVE, SPRINT, STORY | AUTHORITATIVE (reference) | Not living docs; use when creating new documents of these types |
| `docs/wave7/` | 4 | Wave 7 reports: UX blueprint, research report, engineering report, architecture decision | HISTORICAL | Point-in-time wave deliverables |
| `docs/wave8/` | 5 | Wave 8 completion, reconciliation, knowledge, performance reports | HISTORICAL | Point-in-time wave deliverables |

---

## 5. Known Documentation Conflicts

These are explicit contradictions found in the evidence. Each entry names the conflict, identifies the documents involved, and designates which is authoritative and why.

---

### Conflict 1 — ADR-016 Number Collision (CRITICAL)

**The conflict:** Two completely different architectural decisions share the number ADR-016:
- `docs/decisions/ADR-016-communication-centre.md` — Communication Centre feature ADR
- `docs/adr/ADR-016-project-state-execution-registry.md` — Project State & Execution Registry (PSER)

**Why it happened:** The ADR series split across two directories mid-stream. `docs/decisions/` was used for ADR-001 through ADR-016 (first usage); `docs/adr/` was created later and used ADR-012 onward, creating an overlap zone from ADR-012 to ADR-016.

**This index designates as authoritative:** Both decisions are real and accepted. The number 016 is ambiguous without the directory qualifier. Always use the full path as identifier. When referencing by number alone in prose, prefer: `ADR-016 (decisions/communication-centre)` and `ADR-016 (adr/PSER)`. The PSER ADR (`docs/adr/`) is more recent and reflects the later platform evolution; treat `docs/adr/` as the active series going forward.

---

### Conflict 2 — Two `CURRENT_SPRINT.md` Files

**The conflict:** Two files with the same name exist in different directories:
- `docs/planning/CURRENT_SPRINT.md` (6,231 bytes)
- `docs/governance/CURRENT_SPRINT.md` (3,453 bytes)

**This index designates as authoritative:** `docs/governance/CURRENT_SPRINT.md`. ADR-015 explicitly designates `docs/governance/` as the canonical home for sprint tracking. The `docs/planning/` version is either an older copy or a working draft. Do not update or act on the `docs/planning/` version.

---

### Conflict 3 — `TASKS.md` Frozen at Phase 1 vs ROADMAP.md / `CURRENT_SPRINT.md` Claiming Phase 2 Complete

**The conflict:**
- `TASKS.md` (root): "EPIC-002-005: Hermes Admin Bot — Not Started"; tracks Phase 0 and Epics 1–2 only
- `ROADMAP.md` (2026-07-27): "Phase 2 complete — all 9 waves delivered"
- `CURRENT_SPRINT.md`: "Wave 9 complete; Phase 3 on deck"

**Why it happened:** `TASKS.md` was written at Phase 0–1 and never updated to reflect the Phase 2 wave-based delivery model. It does not mention Waves 1–9.

**This index designates as authoritative:** `ROADMAP.md` and `CURRENT_SPRINT.md` for current project state. `TASKS.md` is UNCERTAIN — it is a frozen Phase 1 snapshot, not a current task registry.

---

### Conflict 4 — `SECURITY.md` Stale vs `SECURITY_CERTIFICATION_REPORT.md`

**The conflict:**
- `SECURITY.md` (last reviewed 2026-07-18): states "141 tests", "Phase 2 auth planned", "Phase 1 live"
- `SECURITY_CERTIFICATION_REPORT.md` (2026-07-29): "614/614 tests; 39 routes authenticated via withJwtAuth; CERTIFIED for production"
- `MVP_SECURITY_BASELINE.md` (2026-07-29): JWT auth active on 39 routes; Phase 2 auth implemented

**This index designates as authoritative:** `MVP_SECURITY_BASELINE.md` for current security posture; `SECURITY-REVIEW-v2.md` for the technical review; `SECURITY_CERTIFICATION_REPORT.md` for certification evidence. `SECURITY.md` is UNCERTAIN — it describes Phase 2 items as "upcoming" when they were completed approximately 2026-07-29 and is significantly misleading to a new reader.

---

### Conflict 5 — `DECISIONS.md` Lists Only ADR-001

**The conflict:**
- `DECISIONS.md` (root): lists only one ADR — "ADR-001 Migration Strategy"
- `ARCHITECTURE.md`: references ADR-002, ADR-003, and others
- `HERMES_PROJECT_STATE_AUDIT_2026-07-25.md`: lists ADR-001 through ADR-013
- `SECURITY_CERTIFICATION_REPORT.md`: references ADR-018

There are at least 19 ADRs across `docs/decisions/` and `docs/adr/`; `DECISIONS.md` lists exactly 1.

**This index designates as authoritative:** `docs/decisions/` and `docs/adr/` as the actual ADR stores. `DECISIONS.md` is UNCERTAIN — it is a severely incomplete index stub and must not be used as an ADR reference. A complete ADR list is in Section 3 of `H_docs_tree_catalogue.md`.

---

### Conflict 6 — `docs/architecture/README.md` Stale About ADR Locations

**The conflict:**
- `docs/architecture/README.md`: "All significant architectural decisions are recorded in `docs/decisions/`" (mentions only ADR-001)
- Reality: 19+ ADRs exist across two directories (`docs/decisions/` and `docs/adr/`); `docs/architecture/README.md` was written before `docs/adr/` was created

**This index designates as authoritative:** The actual directories `docs/decisions/` and `docs/adr/`. The `docs/architecture/README.md` statement about ADR location is incorrect and stale.

---

### Conflict 7 — `WAVE2_AUDIT_REPORT.md` vs `CURRENT_SPRINT.md` on EPCL→WAS→WEF Certification

**The conflict:**
- `WAVE2_AUDIT_REPORT.md` (2026-07-30): "Wave 2 did not execute through the certified Hermes Foundation architecture. The certified execution path (EPCL→WAS→WEF) was never invoked. Runtime behaviour is that of a traditional coding agent. All EPCL flags default to false."
- `CURRENT_SPRINT.md`: "Quality gates: Implementation Passed, QA Agent Passed, Security Agent Passed, Governance synchronization Passed, Operational validation Passed"

**Why it matters:** `CURRENT_SPRINT.md`'s gate checks could be read as confirming the certified autonomous pipeline was followed. `WAVE2_AUDIT_REPORT.md` explicitly demonstrates it was not — the quality gates in `CURRENT_SPRINT.md` refer to human-reviewed quality checks, not automated EPCL/WAS/WEF orchestration.

**This index designates as authoritative:** `WAVE2_AUDIT_REPORT.md` for the factual question of whether the EPCL→WAS→WEF pipeline was used. The answer is: it was not used for Wave 2. `CURRENT_SPRINT.md`'s quality gates represent a different (human-review) gate model and do not contradict `WAVE2_AUDIT_REPORT.md` on that specific factual point, but the framing in `CURRENT_SPRINT.md` is ambiguous.

---

## 6. Overlapping Directories

These overlaps are documented as-found. Consolidations listed are **RECOMMENDED** — not yet executed. Do not act on them without a deliberate governance decision.

---

### Overlap 1 — `docs/operations/` vs `docs/ops/`

**Severity: HIGH**

| Directory | Files | Granularity | Content type |
|---|---|---|---|
| `docs/operations/` | 124 | Per-EPIC (EPIC-002-006A1 through EPIC-009) | Session handoffs, runbooks, baselines, completion reports, AGS activation records |
| `docs/ops/` | 74 | Per-Wave (Wave 3 through Wave 6) | Operator guides, skill/agent/department registries, release operations, PO review packages, executive dashboard |

Both directories cover operational history but at different granularity levels. The naming (`operations/` vs `ops/`) does not signal this distinction. Additionally, agent registries appear in three locations: `docs/ops/AGENT_REGISTRY.md`, `docs/ops/RELEASE_AGENT_REGISTRY.md`, and `docs/reconciliation/HERMES_RUNTIME_AGENT_REGISTRY.md`.

**RECOMMENDED consolidation:** Merge under a single `docs/operations/` tree, using subdirectories `epic/` and `wave/` to separate granularity levels. Consolidate the three agent registries into a single canonical file in `docs/platform/` or `docs/ops/`.

---

### Overlap 2 — `docs/company/` vs `docs/organization/` vs `docs/mission/`

**Severity: MEDIUM**

| Directory | Files | Focus |
|---|---|---|
| `docs/company/` | 4 | Enterprise operating model; business unit model; workforce model; platform model (ADR-017, 2026-07-27) |
| `docs/organization/` | 19 | Three-layer org architecture; Hermes platform definition; AI workforce; dependency rules; resource registry; identity model |
| `docs/mission/` | 4 | Hermes 10-layer model; agent inventory; organization blueprint; workforce reconciliation |

ADR-017 explicitly designates `docs/company/` as the new home for enterprise model content, implicitly superseding equivalent content in `docs/organization/`. The old `docs/organization/` files were not removed. `docs/mission/` overlaps most with `docs/organization/` — both contain Hermes platform descriptions and workforce models.

**RECOMMENDED consolidation:** Retain `docs/company/` as the authoritative enterprise model directory (per ADR-017). Archive `docs/organization/` and `docs/mission/` content that duplicates it into a `docs/organization/archive/` folder, with a README redirect to `docs/company/`.

---

### Overlap 3 — `docs/decisions/` vs `docs/adr/`

**Severity: CRITICAL**

| Directory | Files | ADR range | Notes |
|---|---|---|---|
| `docs/decisions/` | 13 | ADR-001 to ADR-016 (with gaps: ADR-009 missing, ADR-012/013/015 missing here) | Older series; started at project inception |
| `docs/adr/` | 6 | ADR-012 to ADR-018 | Newer series; all dated 2026-07-19+; currently active |

Overlap zone: ADR-012 through ADR-016. ADR-016 exists in both with different content (see Conflict 1). ADR-014 exists only in `docs/decisions/`. ADR-015 exists only in `docs/adr/`. The sequence was split mid-stream.

**RECOMMENDED consolidation:** Designate `docs/adr/` as the single canonical ADR home going forward. Move the `docs/decisions/` ADRs into `docs/adr/` with a sequential renumbering plan that resolves the ADR-016 collision. Place a redirect notice in `docs/decisions/README.md`. This requires a new ADR to record the decision.

---

### Overlap 4 — `docs/roadmaps/` vs Root `ROADMAP.md` vs `docs/platform/AI_PLATFORM_ROADMAP.md`

**Severity: HIGH**

| Location | Content | Status |
|---|---|---|
| `docs/roadmaps/` | 1 file: `wave-3-phase3-clinic-collaboration.md` | Near-orphan; stale |
| `ROADMAP.md` (root) | Full Concierge product roadmap (Phases 0–4) | AUTHORITATIVE |
| `docs/platform/AI_PLATFORM_ROADMAP.md` | AI Platform roadmap (separate from product roadmap, per ADR-015) | AUTHORITATIVE |

The live roadmap activity is split intentionally between the root (product level) and `docs/platform/` (platform level) per ADR-015. `docs/roadmaps/` was never cleaned up after this split.

**RECOMMENDED consolidation:** Delete or archive the single file in `docs/roadmaps/` to `docs/operations/` or wave archives. Remove the `docs/roadmaps/` directory. Update any links.

---

### Overlap 5 — `docs/releases/` vs `docs/ops/` Wave Release Notes vs Root Release Notes

**Severity: MEDIUM**

| Location | Content |
|---|---|
| `docs/releases/` | Structured per-version release packages: v1.0.0, v1.1.0, Phase 1 RC1, Wave 6 |
| `docs/ops/WAVE3_RELEASE_NOTES.md`, `WAVE4_RELEASE_NOTES.md`, `WAVE5_RELEASE_NOTES.md` | Wave-level operational release summaries |
| Root `CHANGELOG.md` | Authoritative version history |

The naming "release notes" appears in both `docs/ops/` (wave-level) and `docs/releases/` (version-level), creating confusion despite serving different purposes.

**RECOMMENDED consolidation:** Rename the `docs/ops/WAVEN_RELEASE_NOTES.md` files to `WAVEN_DELIVERY_SUMMARY.md` to distinguish them from formal versioned release notes. `docs/releases/` remains the authoritative location for formal release packages.

---

### Overlap 6 — Three Agent Registries

**Severity: MEDIUM**

| File | Location |
|---|---|
| `AGENT_REGISTRY.md` | `docs/ops/` |
| `RELEASE_AGENT_REGISTRY.md` | `docs/ops/` |
| `HERMES_RUNTIME_AGENT_REGISTRY.md` | `docs/reconciliation/` |

Three agent registry documents exist with unclear precedence.

**RECOMMENDED consolidation:** Establish a single canonical agent registry at `docs/platform/AGENT_REGISTRY.md` (within the authoritative platform capability directory). Mark the others as historical snapshots.

---

## 7. Where to Put New Documentation

Use this table to decide where a new document belongs.

| Kind of document | Destination | Notes |
|---|---|---|
| Architecture Decision Record | `docs/adr/` | Use next available ADR number after ADR-018; follow `docs/adr/` naming convention |
| Platform capability specification | `docs/platform/` | Subdirectory by capability area |
| EPIC completion or validation report | `docs/operations/` | File naming: `EPIC-NNN-NNN-completion.md` |
| Wave scorecard or delivery summary | `docs/ops/` | File naming: `WAVEN_SCORECARD.md` |
| Formal release package (versioned) | `docs/releases/concierge/patient-portal/vX.Y.Z/` | Match existing directory structure |
| Certification (security, UX, accessibility, etc.) | `docs/certification/` | Point-in-time evidence record |
| Governance dashboard or phase gate | `docs/governance/` | Check `GOVERNANCE_INDEX.md` for naming conventions |
| Sprint tracking | `docs/governance/` | Update `docs/governance/CURRENT_SPRINT.md` only |
| Database schema change | `docs/database/` | Update alongside `DATABASE.md` (root) |
| Enterprise org or business unit model | `docs/company/` | Per ADR-017 |
| Product status | `docs/products/concierge/` | `PRODUCT_STATUS.md` |
| Security policy or posture update | Root: `MVP_SECURITY_BASELINE.md` | Do not update `SECURITY.md`; it is de facto stale |
| Release notes for a new version | `CHANGELOG.md` (root) | Primary; also create entry in `docs/releases/` |
| Template for new document type | `docs/templates/` | — |
| New code style or engineering standard | `STYLEGUIDE.md` (root) | — |
| ADR index / global TOC update | This file (`DOCUMENT_INDEX.md`) | Update when new authoritative documents are added |
