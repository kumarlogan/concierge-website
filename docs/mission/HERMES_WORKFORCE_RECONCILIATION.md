# HERMES WORKFORCE RECONCILIATION
*Mission: Hermes Organization Reconstruction — Phase B Deliverable*

**Date:** 2026-07-30  
**Authority:** Product Owner Approval Granted  
**Status:** Complete workforce concept recovery

---

## EXECUTIVE SUMMARY

The Hermes workforce vision spans **11 workforce categories** (ENTERPRISE_WORKFORCE_MODEL.md), **5 collaborative agents** (WDC v1.0, superseded by WEF), and a **12-stage executive planning workflow** (EPCL) that is currently **disabled by feature flags**.

**Key Finding:** The workforce architecture is fully designed but mostly dormant. Activation requires human operator approval at multiple gates.

---

## RECOVERED WORKFORCE CONCEPTS

### 1. Enterprise Workforce Categories (11 total)

**Evidence:** `docs/company/ENTERPRISE_WORKFORCE_MODEL.md` (360 lines, v1.0.0)

| # | Workforce | Business Unit | WEF Role | Approval Authority |
|---|-----------|--------------|----------|-------------------|
| 1 | **Engineering** | Engineering | Developer, QA, Security, Documentation, Monitoring Agents | Tech Lead (epic), Wave Lead (wave), Phase Lead (phase) |
| 2 | **Executive** | Executive Office | Human Operator, Approver | Company-wide (all levels) |
| 3 | **Marketing** | Marketing | Marketing, Content, Analytics Agents | Marketing Lead (campaign), VP Marketing (strategy) |
| 4 | **Sales** | Sales | Sales, CRM, Pipeline Agents | Sales Lead (deal), VP Sales (pricing) |
| 5 | **Operations** | Operations | Operations, Coordination, Compliance Agents | Operations Lead (process), COO (policy) |
| 6 | **Medical** | Medical | Medical Review, Clinical Agents | Medical Director (clinical), CMO (policy) |
| 7 | **Finance** | Finance | Finance, Billing, Reporting Agents | Finance Lead (transaction), CFO (policy) |
| 8 | **Legal** | Legal | Legal Review, Compliance Agents | Legal Counsel (review), General Counsel (policy) |
| 9 | **HR** | HR | Recruitment, Onboarding, Personnel Agents | HR Lead (hiring), CHRO (policy) |
| 10 | **Research** | Research | Research, Analysis, Intelligence Agents | Research Lead (study), VP Research (strategy) |
| 11 | **Intelligence** | Intelligence | Data, Insights, Prediction Agents | Intelligence Lead (analysis), Chief Data Officer (strategy) |

**WEF/PSER Compatibility:** All 11 categories are marked WEF-compatible and PSER-compatible.

---

### 2. WEF (Workforce Execution Framework) v1.1

**Evidence:** `docs/company/AGS_ENTERPRISE_OPERATING_MODEL.md` (228 lines)

**Transition:** WDC v1.0 → WEF v1.0 (GOV-004, 2026-07-26) → WEF v1.1 (enterprise-wide)

**WEF v1.1 Principles:**
1. **Human Approval** — Every execution gate requires human operator approval
2. **Observability** — All execution is observable (dashboards, logs, metrics)
3. **Auditability** — Every decision/approval/action recorded in audit trail
4. **Fail Closed** — When a gate cannot evaluate, it denies
5. **Platform First** — Reusable platform capabilities preferred
6. **Workforce Agnostic** — Same gates apply to every workforce

**WEF Phases (8 phases):**
- Phase 0: Preparation (read current state, understand requirements)
- Phase 1: Platform First Review (verify platform capabilities before product-specific)
- Phase 2: Execution Plan (create plan with deliverables and gates)
- Phase 3: Implementation (execute the work)
- Phase 4: Quality Gates (verify quality, security, completeness)
- Phase 5: Documentation (update governance, dashboards, docs)
- Phase 6: Operator Review (present results for human approval)
- Phase 7: PSER Update (record resume point)

**Key Finding:** WEF is the enterprise execution framework for ALL workforces, not just engineering.

---

### 3. WDC v1.0 (Superseded by WEF)

**Evidence:** `docs/governance/WORKFORCE_DEVELOPMENT_CYCLE.md` (327 lines, 🔴 Superseded)

**Five Collaborative Agents (WDC model):**
1. **Developer Agent** — Implementation plans, code, architecture impact, reusable abstractions
2. **QA Agent** — Acceptance criteria, regression strategy, test execution, coverage
3. **Security Agent** — Vulnerability review, PHI boundary, trust boundary, permission audit
4. **Documentation Agent** — Docs updates, governance sync, ADR impact, roadmap sync
5. **Monitoring Agent** — Observability plan, metrics, health verification, runtime validation

**WDC Hierarchy (9 levels):**
```
Company → Platform → Product → Roadmap → Phase → Wave → Epic → Sprint → Story → Task
```

**Key Finding:** WDC's 5-agent model was engineering-specific. WEF v1.1 generalizes to 11 workforce categories.

---

### 4. EPCL (Executive Planning & Control Layer)

**Evidence:** `workers/src/platform/epcl/` (600+ lines, 12 stages)

**Status:** ✅ Fully implemented, ❌ Disabled by feature flags

**12-Stage Workflow:**
1. ROADMAP_ANALYSIS
2. DEPENDENCY_RESOLUTION
3. EXECUTION_PLAN
4. CAPABILITY_SELECTION
5. DISCIPLINE_SELECTION
6. BATCH_GENERATION
7. APPROVAL_CHECK
8. WEF_DELEGATION
9. EXECUTION_MONITORING
10. VERIFICATION
11. KNOWLEDGE_CAPTURE
12. EXECUTIVE_REPORT

**Feature Flags (all OFF by default):**
- `ENABLE_EXECUTIVE_WORKFLOW` — Master switch for EPCL
- `ENABLE_ROADMAP_INGESTION` — Roadmap parsing
- `ENABLE_BATCH_GENERATION` — Batch creation
- `ENABLE_EXECUTIVE_REPORTING` — Report generation
- `ENABLE_AUTONOMOUS_EXECUTION` — Autonomous execution (HIGH RISK)
- `ENABLE_AUTOMATIC_KNOWLEDGE_CAPTURE` — Auto knowledge capture
- `ENABLE_KNOWLEDGE_CAPTURE` — Knowledge capture

**Fail-Closed Design:** `requireExecutiveWorkflow()` guard throws if master flag is off.

---

### 5. WAS (Workforce Activation Service)

**Evidence:** `workers/src/platform/was/` (520+ lines)

**Purpose:** Activation boundary between EPCL (planning) and WEF (execution)

**8-State Machine:**
```
PENDING → ACTIVATING → ACTIVE
                ↓
            FAILED / REJECTED / ROLLING_BACK
```

**Sub-Services:**
- PlanConsumer — Detects APPROVED plans
- ConstitutionalValidator — Governance gates
- ExecutionStateManager — State transitions
- WEFDelegator — Delegates to WEF
- VerificationRouter — Verifies results
- KnowledgeCaptureTrigger — Captures knowledge
- ExecutiveStatusUpdater — Reports status

**Fail-Closed:** No autonomous execution without feature flags + validation.

---

### 6. AI Agent Registry (Planned)

**Evidence:** `docs/organization/AI_WORKFORCE.md` (90 lines)

**Registry Fields:**
- `id` — Unique worker identifier
- `name` — Human-readable name
- `purpose` — What the worker does
- `owner` — Responsible team/principal
- `application_assignment` — List of app IDs (empty = unassigned)
- `permissions` — Permission keys required
- `status` — inactive / active / deprecated
- `interfaces` — Channels it speaks (Telegram, dashboard, API, CLI)
- `supported_providers` — Backends it can run on
- `activation_state` — inactive by default

**Inactive-by-Default Rule:** Workers are registered (metadata exists) but do nothing until:
1. `activation_state` → `active`
2. At least one `application_assignment` is set

**Initial Catalog (18 cross-app + 5 domain-specialized workers):**
- Cross-app: Owner Assistant, Operations Assistant, Developer Assistant, Documentation Assistant, Security Assistant, Compliance Assistant, Audit Assistant, Monitoring Assistant, Deployment Assistant, Analytics Assistant, Customer Support Assistant, Knowledge Assistant, Reporting Assistant, Notification Assistant, Scheduler Assistant, Research Assistant
- Domain: Finance, Marketing, Sales, HR, Legal

**Current Reality:** Only Hermes (engineering agent) is operational. No registry runtime discovered.

---

### 7. Approval Workflows

**Evidence:** Multiple sources

**Human Approval Gates (WEF v1.1):**
- Phase 1: Roadmap validation → Wait for Human Operator approval
- Phase 2: Engineering Execution Plan → All plans must be approved before Phase 3
- Phase 6: Operator Review → Present results for human operator approval
- Production deployments → Human approval required (AI_OPERATING_MODEL.md)

**Constitutional Validation (WAS):**
- ConstitutionalValidator enforces governance gates before activation
- PSER resume points must be valid
- Feature flags must be enabled

**GitHub PR Workflow (Skill):**
- Conventional commits
- CI/CD checks
- Code review
- Approval before merge

---

### 8. Verification Flows

**Evidence:** Multiple sources

**Quality Gates (WEF Phase 4):**
- Verify quality, security, completeness
- Regression testing
- Coverage analysis

**WAS Verification:**
- VerificationRouter verifies results after WEF delegation
- PSER execution state validated

**Provider Trust Verification (EPIC-005):**
- Signature & checksum verification
- Trust lifecycle state machine
- Sandbox policy enforcement

**Test Suite Verification:**
- 750+ tests in `workers/` (687 pass, 20 EPCL failures, 43 persistence)
- 24/24 provider tests (EPIC-005.1 + EPIC-005.2)
- 158/158 Hermes platform tests (EPIC-002-006C)

---

### 9. Deployment Safeguards

**Evidence:** Multiple sources

**Cloudflare Deployment (Concierge):**
- `wrangler deploy` (root → hermes-website)
- `wrangler deploy --env production` (workers/ → agsynergy-api)
- JWT keys via GitHub Secrets at CI
- CI/CD: `.github/workflows/deploy.yml` on push main

**Release Management Architecture (Planned):**
- Standardized deployment workflows
- Environment model (Dev/Preview/Production)
- Promotion flow (Preview → Production)
- Rollback strategy (checkpoint-based)
- Smoke test framework (7-test suite)

**Feature Flag Safeguards:**
- All new capabilities feature-gated
- Can be disabled instantly without code changes
- Fail-closed by default

---

### 10. Testing Safeguards

**Evidence:** Test suite results

**Current Safeguards:**
- Vitest test runner (workers/, hermes/)
- 750+ tests in workers/ (Baseline: 614 tests, memory discrepancy)
- Provider tests (24/24 passing)
- Hermes platform tests (158/158 passing)
- Pre-existing EPCL failures (20) — known, documented

**Planned Safeguards (Release Management):**
- Smoke test framework (7-test suite)
- Environment strategy (isolated dev/preview/prod)
- Rollback strategy (operator-approved recovery)

---

### 11. Preview Workflows

**Evidence:** Release Management Architecture (planned)

**Preview Promotion Process:**
- Gate-driven promotion
- Criteria-evaluated (not automatic)
- Preview environment (Cloudflare Pages preview deployments)
- Human approval required for production promotion

**Current State:**
- Cloudflare Pages supports preview deployments
- No formal preview→production promotion workflow discovered

---

### 12. Knowledge Capture Mechanisms

**Evidence:** EPCL Stage 11, WAS KnowledgeCaptureTrigger

**EPCL Knowledge Capture:**
- Stage 11: KNOWLEDGE_CAPTURE — Capture knowledge from planning
- `KnowledgeCapturer` class in `epcl/knowledge-capturer.ts`
- `KnowledgeEntry` type (source, type, content, metadata)

**WAS Knowledge Capture:**
- KnowledgeCaptureTrigger — Triggers knowledge capture after verification
- Feeds into PSER (Project State & Execution Registry)

**PSER (Capability #12):**
- Execution context model
- State machine for session resume
- Resume points stored in D1 + KV cache + R2 archive

**Memory Tool (Hermes Agent):**
- Persistent memory across sessions
- User profile + agent notes
- 2,200 char budget (currently 91% used)

**Documentation Governance:**
- GOV-003/GOV-004 governance freeze
- Mandatory documentation updates (PROGRAM_STATUS.md, AI_PLATFORM_STATUS.md, etc.)
- ADR process for architectural decisions

---

### 13. Operational Disciplines

**Evidence:** Multiple sources

**Governance Disciplines:**
- Governance freeze (GOV-004) — No unauthorized changes
- Phase gates — No phase skip allowed
- Documentation synchronization — Every epic completion updates 6+ docs
- ADR process — All architectural decisions documented
- Audit trail — Every action logged

**Engineering Disciplines:**
- Platform First — Reusable capabilities before product-specific
- Deterministic Before AI — Exhaust deterministic paths first
- Fail Closed — Uncertainty blocks execution
- No Assumptions — Stop and clarify if facts unavailable
- Feature Flag First — All new flows disabled by default

**Execution Disciplines:**
- WEF phases — 8-phase execution framework
- PSER resume points — Exact execution continuation
- Batch execution — Work organized in batches
- Token budget management — EPCL TokenBudgetManager

---

### 14. Executive Reporting Mechanisms

**Evidence:** EPCL Stage 12, GOVERNANCE_INDEX.md

**EPCL Executive Reporting:**
- Stage 12: EXECUTIVE_REPORT — Generate executive report
- `ExecutiveReporter` class in `epcl/executive-reporter.ts`
- `ExecutiveDashboard` in `planning/executive-dashboard.ts`

**Governance Dashboards:**
- PROGRAM_STATUS.md — Company-level dashboard
- AI_PLATFORM_STATUS.md — Platform capabilities
- PRODUCT_STATUS.md — Product health (Concierge)
- COMPANY_STATUS.md — Executive dashboard for entire AGS org
- CURRENT_SPRINT.md — Active sprint tracking
- DECISION_LOG.md — Decision history
- CHANGELOG.md — Release history

**Post-Wave Reporting (Skill):**
- `governance/post-wave-reporting` skill
- 15-section Product Owner Report after each roadmap wave
- Evidence-based, metrics-driven

**PSER Reporting:**
- Execution state reports
- Resume point documentation
- Wave completion tracking

---

### 15. Provider Integrations

**Evidence:** `hermes/services/providers/` (EPIC-005)

**Universal Capability Platform:**
- Provider-neutral abstraction layer
- Manifest V2 loader
- Transport interface (local-process, CLI, MCP)
- Trust lifecycle state machine
- Dynamic provider loading

**Implemented Providers:**
1. **claude-code** — Claude Code CLI provider
2. **github** — GitHub provider (config + backend + port)
3. **cloudflare** — Cloudflare provider (config + backend + port + provider)

**Provider Trust Model:**
- Signature & checksum verification
- Sandbox policy enforcement
- Runtime security guard
- Marketplace security (collision detection)

**Future Providers (Planned):**
- openai-codex
- local-sandbox
- custom MCP servers

---

### 16. Orchestration Pathways

**Evidence:** EPCL → WAS → WEF pipeline

**Main Orchestration Pipeline:**
```
Roadmap Input
    ↓
EPCL (Executive Planning Workflow)
    ↓ (Stage 8: WEF_DELEGATION)
WAS (Workforce Activation Service)
    ↓ (WEFDelegator)
WEF (Workforce Execution Framework)
    ↓ (Phase 3: Implementation)
Execution Coordinator
    ↓
Workforce Dispatch
    ↓
Agent Task Execution
    ↓
Verification Router
    ↓
Knowledge Capture
    ↓
Executive Report
```

**Fail-Closed Gates:**
- EPCL: Feature flags (all OFF)
- WAS: Constitutional validation
- WEF: Human approval gates
- Execution: PSER resume point validation

---

### 17. Governance Rules

**Evidence:** PLATFORM_CONSTITUTION.md (12 principles), AI_OPERATING_MODEL.md (authority boundaries)

**Platform Constitution (12 Principles):**
1. Platform First
2. Deterministic Before AI
3. No Assumptions
4. Fail Closed
5. Repository Agnostic
6. Modular Design
7. Performance First
8-12. (Documented but truncated)

**AI Authority Boundaries (AI cannot):**
- Medical decisions
- Legal decisions
- Financial commitments
- Security-sensitive changes without approval
- Production-impacting releases without approval

**Governance Freeze (GOV-004):**
- No unauthorized changes to governance docs
- Phase gates enforced
- Documentation synchronization mandatory

---

### 18. Constitutional Restrictions

**Evidence:** PLATFORM_CONSTITUTION.md, FAIL_CLOSED design pattern

**Fail-Closed Everywhere:**
- EPCL: `requireExecutiveWorkflow()` throws if disabled
- WAS: ConstitutionalValidator blocks invalid activations
- WEF: Gates deny by default
- Providers: Trust lifecycle rejects untrusted providers
- Platform: Services must comply with constitution or be non-conformant

**Platform First Restriction:**
- Reusable capabilities MUST be in Hermes platform
- Product-specific logic MUST be in application
- No cross-application imports
- No vendor lock-in in core

---

### 19. Architectural Decisions (12 ADRs Discovered)

**Evidence:** `docs/decisions/` (12 ADRs)

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 | Cloudflare Migration | ✅ Adopted | — |
| 002 | Multi-Agent Operations Architecture | ✅ Adopted | — |
| 003 | Permission Resolution Strategy | ✅ Adopted | — |
| 004 | Organization Architecture | ✅ Adopted | — |
| 005 | Hermes as AGS Organization Platform | Proposed | 2026-07-19 |
| 006 | Organization Resource Registry | ✅ Adopted | — |
| 007 | Hermes Platform Extraction Strategy | Proposed | 2026-07-19 |
| 008 | Hermes Platform Core Services | ✅ Implemented | 2026-07-19 |
| 009 | (Deployment providers) | ✅ Implemented | — |
| 010 | Trust Identity Platform Capability | ✅ Adopted | — |
| 011 | AI Platform Governance Core | ✅ Adopted | — |
| 014 | Workforce Development Cycle | ✅ Adopted | — |
| 015 | Governance Freeze WEF | ✅ Adopted | 2026-07-26 |

**Key Finding:** ADR-005, 007 are still "Proposed" — Hermes platform extraction not fully ratified.

---

### 20. Reusable Platform Capabilities (17 in `hermes/services/`)

**Evidence:** `hermes/services/index.ts` (barrel export)

| # | Capability | Service | Reusable? |
|---|-----------|---------|-----------|
| 1 | Registry | Registry | ✅ Yes |
| 2 | Discovery | Discovery | ✅ Yes |
| 3 | Lifecycle | Lifecycle | ✅ Yes |
| 4 | Scheduler | Scheduler | ✅ Yes |
| 5 | Notification | Notification | ✅ Yes |
| 6 | Memory | Memory | ✅ Yes |
| 7 | Providers | Providers | ✅ Yes |
| 8 | Activation | Activation | ✅ Yes |
| 9 | Execution | Execution | ✅ Yes |
| 10 | Security | Security | ✅ Yes |
| 11 | Workforce | Workforce | ✅ Yes |
| 12 | Planning | Planning | ✅ Yes |
| 13 | MCP | MCP | ✅ Yes |
| 14 | Developer | Developer | ✅ Yes |
| 15 | Tools | Tools | ✅ Yes |
| 16 | Application | Application | ⚠️ Stub |
| 17 | Agents | Agents | ⚠️ Partial |

**All capabilities are provider-neutral and reusable across AGS applications.**

---

## WORKFORCE VISION SUMMARY

The original Hermes workforce vision is **fully architected but mostly dormant**:

1. ✅ **Designed:** 11 workforce categories, WEF v1.1, EPCL 12-stage workflow, WAS activation, 17 platform capabilities
2. ❌ **Implemented:** Only Engineering workforce (Hermes) is operational
3. ❌ **Activated:** EPCL disabled by feature flags, WAS fail-closed, WEF requires human approval
4. ⚠️ **Registry:** AI agent registry designed but not runtime-discovered
5. ⚠️ **Multi-App:** Only Concierge (Application #1) exists

**To achieve the vision:** Enable feature flags → Activate EPCL → Register agents → Assign to applications → Execute via WEF

---

**Evidence Base:** This reconciliation is supported by 20+ document reads, 150+ service file discoveries, 12 ADRs, and the live test suite (750+ tests).
