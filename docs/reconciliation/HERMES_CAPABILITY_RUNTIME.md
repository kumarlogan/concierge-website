# HERMES Capability Runtime

> **EPIC-008 — Phase H**
> Defines every registered capability in the Hermes Platform. Capabilities are organized by their owning discipline. Each capability has exactly one owner, zero or one support skills, and verification/knowledge/deployment rules. No capability is owned by more than one discipline.

---

## Capability Registry (from code)

**Source**: `workers/src/platform/epcl/capability-selector.ts` (lines 240-425) — `registerBuiltIn()`

**Total Registered**: 12 built-in capabilities

---

## Capability Ownership Matrix

| # | Capability ID | Owning Discipline | Layer | Provider | Provider Type |
|---|--------------|-------------------|-------|----------|---------------|
| 1 | `code.generate` | engineering_quality | Execution | hermes | AI |
| 2 | `code.review` | engineering_quality | Execution | hermes | AI |
| 3 | `deploy.pages` | engineering_quality | Deployment | wrangler | CLI |
| 4 | `deploy.workers` | engineering_quality | Deployment | wrangler | CLI |
| 5 | `db.migrate` | engineering_quality | Deployment | wrangler | CLI |
| 6 | `db.rollback` | engineering_quality | Deployment | wrangler | CLI |
| 7 | `test.run` | engineering_quality | Execution | hermes | AI |
| 8 | `test.verify` | engineering_quality | Execution | hermes | AI |
| 9 | `research.analyze` | research_intelligence | Knowledge | hermes | AI |
| 10 | `research.synthesize` | research_intelligence | Knowledge | hermes | AI |
| 11 | `research.investigate` | research_intelligence | Knowledge | hermes | AI |
| 12 | `architecture.design` | architecture_strategy | Planning | hermes | AI |
| 13 | `architecture.review` | architecture_strategy | Planning | hermes | AI |
| 14 | `experience.design` | experience_design | Planning/Execution | hermes | AI |
| 15 | `experience.review` | experience_design | Planning/Execution | hermes | AI |
| 16 | `experience.prototype` | experience_design | Planning/Execution | hermes | AI |
| 17 | `business.analyze` | business_growth | Knowledge | hermes | AI |
| 18 | `business.plan` | business_growth | Knowledge | hermes | AI |
| 19 | `business.report` | business_growth | Knowledge | hermes | AI |
| 20 | `platform.learn` | platform_intelligence | Knowledge | hermes | AI |
| 21 | `platform.observe` | platform_intelligence | Observability | hermes | AI |

> **Note**: `deploy.pages` and `deploy.workers` are shared between `engineering_quality` and `platform_intelligence` in the discipline selector mapping. This is intentional — Engineering implements and tests deployments, Platform Intelligence owns platform-level deploys (infrastructure, configuration). The **owning discipline** (primary) is `engineering_quality` because that's where code changes are deployed.

---

## Engineering & Quality Capabilities

### 1. code.generate — Generate Code from Specifications

| Field | Value |
|-------|-------|
| **Capability ID** | `code.generate` |
| **Owning Discipline** | `engineering_quality` |
| **Layer** | Execution (Layer 4) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 10 |
| **Fallback Capabilities** | None |
| **Keywords** | generate, code, write, implement |

**Version**: EPCL selector built-in, 2026-07-30

**Ownership**:
- **Discipline Owner**: `engineering_quality`
- **Executive Sponsor**: Product Owner
- **Implementation**: Hermes Runtime (via `engineering_quality` discipline activation)

**Execution**:
- **Pre-requisite**: Architecture design complete (`architecture.design` if applicable)
- **Verification**: `test.run` must pass; `code.review` must pass
- **Approval Gates**: None for generation; deployment requires approval
- **ID Generation**: `platform.learn` captures patterns as skills

**Skills**:
| Skill | When to Use |
|-------|-------------|
| `feature-milestone-execution` | Structured milestone implementation |
| `test-driven-development` | TDD (RED-GREEN-REFACTOR) |
| `spike` | Throwaway experiments before implementation |

**Constraints**:
- Code must pass existing test suite before submission
- New code requires tests (unit + integration)
- TypeScript: `npx tsc --noEmit` must pass
- Pre-existing errors in codebase are not blockers — only check NEW code

**Fallback Chain**:
1. `hermes` — direct code generation
2. `delegate_task(claude-code)` — ACP subprocess (future)
3. Human — manual implementation (when all automated paths fail)

---

### 2. code.review — Automated Code Review

| Field | Value |
|-------|-------|
| **Capability ID** | `code.review` |
| **Owning Discipline** | `engineering_quality` |
| **Layer** | Execution (Layer 4) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | review, code, quality, lint |

**Skills**:
| Skill | When to Use |
|-------|-------------|
| `requesting-code-review` | Pre-commit security scan and quality gates |
| `github-code-review` | PR review inline comments |

**Verification**:
- Review must check: correctness, style, security, performance
- Architectural compliance against design docs
- Test coverage for new code

**Constraints**:
- Blocking findings (security vulnerabilities, correctness bugs) must be fixed before merge
- Non-blocking suggestions are logged but do not gate

---

### 3. deploy.pages — Deploy Static Pages

| Field | Value |
|-------|-------|
| **Capability ID** | `deploy.pages` |
| **Owning Discipline** | `engineering_quality` (primary) |
| **Co-owned By** | `platform_intelligence` |
| **Layer** | Deployment (Layer 8) |
| **Provider** | `wrangler` |
| **Requires Approval** | Yes |
| **Estimated Cost** | 1 |
| **Keywords** | deploy, pages, cloudflare, publish |

**Skills**:
| Skill | When to Use |
|-------|-------------|
| `webops` | End-to-end website deployment — Cloudflare Pages |
| `deploy-website` | Deploy agsynergy.ca to Cloudflare |

**Pre-Deployment**:
- WEF `preDeploymentReport()` must return `overallHealth: green`
- `canDeploy()` must return `true`
- `deployment_approval` feature flag must be enabled

**Verification**:
- Post-deployment health check must pass
- Deployment output URL must be accessible
- Rollback capability verified before deployment

**Approval Chain**:
1. Feature flag gate (`ENABLE_AUTONOMOUS_EXECUTION`)
2. Deployment approval gate (`deployment_approval`)
3. Pre-deployment health check (WEF Operational Intelligence)

**Constraints**:
- Staging environment only by default (production requires human approval)
- Credential resolution must succeed before deployment command
- Rollback plan must exist

---

### 4. deploy.workers — Deploy Cloudflare Workers

| Field | Value |
|-------|-------|
| **Capability ID** | `deploy.workers` |
| **Owning Discipline** | `engineering_quality` (primary) |
| **Co-owned By** | `platform_intelligence` |
| **Layer** | Deployment (Layer 8) |
| **Provider** | `wrangler` |
| **Requires Approval** | Yes |
| **Estimated Cost** | 1 |
| **Keywords** | deploy, worker, cloudflare |
| **Fallback** | None |

Same governance as `deploy.pages` — approval gates, pre-deployment health check, rollback capability.

---

### 5. db.migrate — Database Migration

| Field | Value |
|-------|-------|
| **Capability ID** | `db.migrate` |
| **Owning Discipline** | `engineering_quality` |
| **Layer** | Deployment (Layer 8) |
| **Provider** | `wrangler` |
| **Requires Approval** | Yes |
| **Estimated Cost** | 2 |
| **Keywords** | database, migration, d1, schema |
| **Fallback** | `db.rollback` (if migration fails) |

**Constraints**:
- Migration must be reversible (rollback plan required)
- D1 production migrations require human approval
- Pre-migration backup must be confirmed

---

### 6. db.rollback — Database Migration Rollback

| Field | Value |
|-------|-------|
| **Capability ID** | `db.rollback` |
| **Owning Discipline** | `engineering_quality` |
| **Layer** | Deployment (Layer 8) |
| **Provider** | `wrangler` |
| **Requires Approval** | Yes |
| **Estimated Cost** | 2 |
| **Keywords** | database, rollback, d1 |
| **Fallback** | None |

**Note**: Rollback is preferred over hotfixing for database changes. Always roll back to a known-good state, then redeploy with the fix.

---

### 7. test.run — Run Test Suites

| Field | Value |
|-------|-------|
| **Capability ID** | `test.run` |
| **Owning Discipline** | `engineering_quality` |
| **Layer** | Execution (Layer 4) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 3 |
| **Keywords** | test, run, verify, spec |
| **Fallback** | None |

**Verification**:
- Green test suite → code generation accepted
- Red test suite (existing passing tests) → code generation rejected
- Pre-existing test failures are catalogued but do not gate

**Skills**:
| Skill | When to Use |
|-------|-------------|
| `feature-milestone-execution` | Typecheck after each batch run |

---

### 8. test.verify — Verify Test Results

| Field | Value |
|-------|-------|
| **Capability ID** | `test.verify` |
| **Owning Discipline** | `engineering_quality` |
| **Layer** | Verification (Layer 5) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 3 |
| **Keywords** | test, verify |
| **Fallback** | None |

**Purpose**: Verify that test results meet acceptance criteria defined in the execution plan. Runs as part of the Verification Layer after test execution.

---

## Research Intelligence Capabilities

### 9. research.analyze — Research Analysis

| Field | Value |
|-------|-------|
| **Capability ID** | `research.analyze` |
| **Owning Discipline** | `research_intelligence` |
| **Layer** | Knowledge (Layer 6) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | research, analyze, synthesize, investigate |
| **Skills** | arxiv, youtube-content, blogwatcher, xurl, llm-wiki |

**Verification**:
- Sources must be cited
- Claims must be traceable to original source
- Confidence score must be assigned per finding

**Knowledge Capture**:
- Research findings → `KnowledgeEntry` in Knowledge Store
- Sources catalogued with metadata (date, type, confidence)

---

### 10. research.synthesize — Research Synthesis

| Field | Value |
|-------|-------|
| **Capability ID** | `research.synthesize` |
| **Owning Discipline** | `research_intelligence` |
| **Layer** | Knowledge (Layer 6) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | research, synthesize |
| **Skills** | Same as research.analyze |

**Verification**:
- Synthesis must separate factual findings from interpretation
- Multiple independent sources required for factual claims
- Synthesis must identify gaps, contradictions, and consensus

---

### 11. research.investigate — Research Investigation

| Field | Value |
|-------|-------|
| **Capability ID** | `research.investigate` |
| **Owning Discipline** | `research_intelligence` |
| **Layer** | Knowledge (Layer 6) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | research, investigate |

---

## Architecture & Strategy Capabilities

### 12. architecture.design — Architecture Design

| Field | Value |
|-------|-------|
| **Capability ID** | `architecture.design` |
| **Owning Discipline** | `architecture_strategy` |
| **Layer** | Planning (Layer 2) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 8 |
| **Keywords** | architecture, design, adr, system |
| **Skills** | architecture-diagram, excalidraw, systematic-debugging |

**Verification**:
- ADR must be produced with context, decision, and consequences
- Architecture must satisfy non-functional requirements (security, performance, scalability)
- Design review must complete before engineering begins

**Knowledge Capture**:
- ADRs → Knowledge Entry as reusable architecture patterns
- Key technical decisions catalogued in decision log

---

### 13. architecture.review — Architecture Review

| Field | Value |
|-------|-------|
| **Capability ID** | `architecture.review` |
| **Owning Discipline** | `architecture_strategy` |
| **Layer** | Planning (Layer 2) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | architecture, review |

**Verification**:
- Architecture compliance against existing standards
- Security architecture review for any privileged component
- Cross-system impact assessment

---

## Experience & Design Capabilities

### 14. experience.design — Experience/UX Design

| Field | Value |
|-------|-------|
| **Capability ID** | `experience.design` |
| **Owning Discipline** | `experience_design` |
| **Layer** | Planning/Execution (Layer 2/4) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 8 |
| **Keywords** | design, ux, ui, experience, interface |
| **Skills** | sketch, claude-design, popular-web-designs, excalidraw, p5js, design-md |

**Verification**:
- Mockups must be viewable artifacts (HTML, Excalidraw, or image)
- Accessibility review: contrast, keyboard navigation, screen reader
- UX flows validated against user stories

**Prerequisite**: Architecture design complete (`architecture.design`)

**Skills Priority**:
1. `sketch` — fastest for throwaway mockups
2. `popular-web-designs` — reference real design systems
3. `design-md` — formal design token specifications

---

### 15. experience.review — UX/UI Review

| Field | Value |
|-------|-------|
| **Capability ID** | `experience.review` |
| **Owning Discipline** | `experience_design` |
| **Layer** | Planning/Execution |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | review, ux, ui, design |

---

### 16. experience.prototype — UX Prototyping

| Field | Value |
|-------|-------|
| **Capability ID** | `experience.prototype` |
| **Owning Discipline** | `experience_design` |
| **Layer** | Execution |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 8 |
| **Keywords** | prototype, ux, design |

---

## Business & Growth Capabilities

### 17. business.analyze — Business Analysis

| Field | Value |
|-------|-------|
| **Capability ID** | `business.analyze` |
| **Owning Discipline** | `business_growth` |
| **Layer** | Knowledge (Layer 6) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | business, analyze, market, requirements |

**Skills**:
| Skill | When to Use |
|-------|-------------|
| `governance-dashboard` | Create multi-layered governance dashboards |
| `post-wave-reporting` | 15-section executive reports |
| `acceptance-audit` | Independent read-only audits |

**Verification**:
- Data sources cited
- Assumptions documented
- Analysis separates fact from interpretation

---

### 18. business.plan — Business Planning

| Field | Value |
|-------|-------|
| **Capability ID** | `business.plan` |
| **Owning Discipline** | `business_growth` |
| **Layer** | Knowledge |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | business, plan, strategy |

---

### 19. business.report — Business Reporting

| Field | Value |
|-------|-------|
| **Capability ID** | `business.report` |
| **Owning Discipline** | `business_growth` |
| **Layer** | Knowledge |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 5 |
| **Keywords** | business, report |
| **Skills** | post-wave-reporting, governance-dashboard |

---

## Platform Intelligence Capabilities

### 20. platform.learn — Platform Learning

| Field | Value |
|-------|-------|
| **Capability ID** | `platform.learn` |
| **Owning Discipline** | `platform_intelligence` |
| **Layer** | Knowledge (Layer 6) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 3 |
| **Keywords** | learn, knowledge, capture, skill |

**Skills**:
| Skill | When to Use |
|-------|-------------|
| `hermes-agent-skill-authoring` | Author/validate SKILL.md |
| `llm-wiki` | Build/query interlinked knowledge bases |

**Knowledge Rules**:
- Every execution cycle triggers knowledge capture
- Reusable procedures → Skills (via `skill_manage`)
- Durable cross-session facts → Memory (via `memory`)
- Task outcomes → Knowledge Entries

---

### 21. platform.observe — Platform Observability

| Field | Value |
|-------|-------|
| **Capability ID** | `platform.observe` |
| **Owning Discipline** | `platform_intelligence` |
| **Layer** | Observability (Layer 9) |
| **Provider** | `hermes` |
| **Requires Approval** | No |
| **Estimated Cost** | 3 |
| **Keywords** | observe, monitor, health |

**Implementation**:
- `WASObservability` — WAS lifecycle events
- `ExecutiveReporter` — Executive reports
- `WefOperationalIntelligence` — Deployment health reports
- `ExecutiveStatusUpdater` — Activation status reports

---

## Capability Interaction Matrix

```
┌─────────────────────┬───────────────┬───────────────┬─────────────────┐
│ Capability           │ Depends On    │ Triggers       │ Outputs To       │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ architecture.design  │ research.*    │ experience.*  │ code.generate    │
│                      │ (if research  │               │                  │
│                      │  needed)      │               │                  │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ experience.design    │ architecture  │ code.generate │ engineering      │
│                      │ .design       │               │                  │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ code.generate        │ architecture  │ test.run,     │ deploy.pages     │
│                      │ .design,      │ code.review   │ deploy.workers   │
│                      │ experience.*  │               │                  │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ code.review          │ code.         │ —             │ test.verify      │
│                      │ generate      │               │                  │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ test.run             │ code.generate │ test.verify   │ —               │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ test.verify          │ test.run      │ deploy.*      │ —               │
│                      │               │ (if pass)     │                  │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ deploy.pages         │ test.verify   │ platform.learn│ Verification     │
│ deploy.workers       │               │                │ Layer           │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ db.migrate           │ deploy.*      │ test.verify   │ Verification     │
│                      │ (app context) │ (if pass)     │ Layer           │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ db.rollback          │ —             │ —             │ Verification     │
│                      │               │                │ Layer           │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ research.*           │ —             │ architecture  │ Knowledge        │
│                      │               │ .design       │ Layer           │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ business.*           │ —             │ —             │ Reports          │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ platform.learn       │ All           │ —             │ Knowledge        │
│                      │ capabilities  │                │ Layer           │
├─────────────────────┼───────────────┼───────────────┼─────────────────┤
│ platform.observe     │ All           │ —             │ Observability    │
│                      │ layers        │                │ Layer           │
└─────────────────────┴───────────────┴───────────────┴─────────────────┘
```

---

## Capability Lifecycle

Each capability follows this lifecycle through the EPCL Executive Workflow stages:

| Stage | What Happens for Capabilities |
|-------|------------------------------|
| Stage 1 (OBJECTIVE_INTAKE) | Capability requirements identified from objective |
| Stage 2 (PLAN_PARSING) | EPCL roadmap parsed into capability-annotated epics |
| Stage 3 (CAPABILITY_SELECTION) | CapabilitySelector selects capabilities for epics |
| Stage 4 (RESOURCE_ESTIMATION) | Token/context budgets allocated per capability |
| Stage 5 (DISCIPLINE_SELECTION) | DisciplineSelector picks discipline per capability |
| Stage 6 (BATCH_GENERATION) | Batches formed per capability per discipline |
| Stage 7 (APPROVAL_CHECK) | Approval required checked per capability |
| Stage 8 (WEF_DELEGATION) | Batches delegated to WEF via WAS |
| Stage 9 (EXECUTION) | Capabilities executed by WEF |
| Stage 10 (VERIFICATION) | Verification of capability outputs |
| Stage 11 (KNOWLEDGE_CAPTURE) | Knowledge from capability execution captured |
| Stage 12 (REPORTING) | Capability execution reported in executive summary |

---

## Capability Registration (from code)

Capabilities are registered in the `CapabilitySelector` (`workers/src/platform/epcl/capability-selector.ts`) via `registerBuiltIn()`:

```typescript
const builtIns: CapabilityEntry[] = [
  { id: "deploy.pages", name: "Deploy Pages", provider: "wrangler", ... },
  { id: "deploy.workers", ... },
  { id: "db.migrate", ... },
  { id: "db.rollback", ... },
  { id: "code.review", ... },
  { id: "code.generate", ... },
  { id: "research.analyze", ... },
  { id: "architecture.design", ... },
  { id: "experience.design", ... },
  { id: "test.run", ... },
  { id: "platform.learn", ... },
  { id: "business.analyze", ... },
];
```

**Total**: 12 built-in capabilities. 9 additional capabilities are defined in the discipline mapping (synthesize, investigate, review, prototype, plan, report, observe) but are not yet registered in the built-in registry. This is noted in the GAP report.

---

## Terminology

| Term | Definition |
|------|-----------|
| **Capability** | An intention Hermes can form — never a provider, transport, or vendor product. Stable forever. |
| **Capability ID** | Dot-separated name: `<domain>.<action>` e.g. `code.generate`, `deploy.pages` |
| **Owning Discipline** | The single EPCL discipline that owns the capability. All capability execution routes through this discipline's activation. |
| **Provider** | The runtime service that implements the capability. Resolved at selection time, not baked into the capability ID. |
| **Fallback** | Alternative capability to use if the primary is unavailable. Chained at the provider level. |
| **Approval Required** | Whether human authorization is needed before the capability may be used. Fail-closed: unknown capabilities require approval. |
| **Keywords** | Search terms used by `CapabilitySelector` for keyword matching per capability entry.