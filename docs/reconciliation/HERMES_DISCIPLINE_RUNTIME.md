# HERMES Discipline Runtime

> **EPIC-008 — Phase F**
> Defines the six Hermes Runtime disciplines. Every discipline has an executive sponsor, supported agents, capabilities, skills, and clearly defined activation/completion criteria. No duplicated ownership between disciplines.

---

## Discipline Architecture

```
                  ┌──────────────────────────────┐
                  │       PRODUCT OWNER            │
                  │  (Approved Roadmap / Objective)│
                  └──────────────┬───────────────┘
                                 │
                  ┌──────────────▼───────────────┐
                  │     EXECUTIVE PLANNING          │
                  │     WORKFLOW (12 stages)         │
                  │     ↓                           │
                  │     DisciplineSelector selects  │
                  │     disciplines per epic         │
                  └──────────────┬───────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  RESEARCH      │      │ ARCHITECTURE  │      │  EXPERIENCE   │
│  INTELLIGENCE  │      │  & STRATEGY   │      │   & DESIGN    │
├───────────────┤      ├───────────────┤      ├───────────────┤
│               │      │               │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
        │                        │                        │
        │                        │                        │
        ▼                        ▼                        ▼
┌───────────────┐      ┌───────────────┐      ┌───────────────┐
│  ENGINEERING  │      │   BUSINESS    │      │   PLATFORM    │
│  & QUALITY    │      │   & GROWTH    │      │  INTELLIGENCE │
├───────────────┤      ├───────────────┤      ├───────────────┤
│               │      │               │      │               │
└───────────────┘      └───────────────┘      └───────────────┘
```

---

## 1. Research Intelligence

### Identity

| Field | Value |
|-------|-------|
| **Discipline ID** | `research_intelligence` |
| **Label** | Research Intelligence |
| **Layer** | Executive / Knowledge (hybrid) |
| **Executive Sponsor** | Product Owner |
| **Discipline Lead** | Hermes Runtime (via EPCL DisciplineSelector) |

### Supported Capabilities
| Capability ID | Description | Provider |
|-------------|-------------|---------|
| `research.analyze` | Analyze and synthesize research findings | hermes |
| `research.synthesize` | Synthesize research into actionable insights | hermes |
| `research.investigate` | Investigate topics, domains, or problems | hermes |

### Supported Skills
| Skill | Purpose |
|-------|---------|
| `arxiv` | Search and retrieve academic papers |
| `youtube-content` | YouTube transcripts → summaries |
| `blogwatcher` | Monitor RSS/Atom feeds |
| `xurl` | Search and retrieve X/Twitter content |
| `llm-wiki` | Build/query interlinked markdown knowledge bases |

### Supported Agents
*(Defined in HERMES_AGENT_RUNTIME.md — primary agents: Research Analyst, Intelligence Gatherer)*

### Verification Rules
- All research outputs must cite sources
- Claims must be traceable to original sources
- Synthesis must separate fact from interpretation
- Analysis quality gate: at least 2 independent sources for factual claims

### Knowledge Rules
- Research findings → Knowledge Entry in Knowledge Layer
- Sources catalogued with metadata (date, source type, confidence)
- Syntheses stored as reusable artifacts

### Deployment Rules
- Research Intelligence does NOT deploy code or infrastructure
- Research outputs are consumed by Architecture & Strategy or Engineering
- No deployment approval required

### Escalation Rules
| Condition | Escalate To | Action |
|-----------|-------------|--------|
| Unresolvable factual conflict | Architecture & Strategy | Arbitration |
| Research direction change | Product Owner | Objective clarification |
| Source access failure | Operations Layer | Credential/permission resolution |

### Token Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 10,000 tokens |
| Per-batch | 50,000 tokens |
| Per-plan | 200,000 tokens |

### Context Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 8,000 tokens |
| Per-batch | 32,000 tokens |
| Strategy | INCREMENTAL |

### Activation Criteria
- Epic explicitly requests research/analysis/investigation
- Epic contains keywords: "research", "investigat", "study"
- Architecture & Strategy requests research input
- No activated discipline exists for the epic

### Completion Criteria
- Research output artifacts exist (analysis, synthesis, investigation report)
- All source citations are verified
- Knowledge capture completed
- Research has informed downstream disciplines or a decision has been made

---

## 2. Architecture & Strategy

### Identity

| Field | Value |
|-------|-------|
| **Discipline ID** | `architecture_strategy` |
| **Label** | Architecture & Strategy |
| **Layer** | Executive / Planning |
| **Executive Sponsor** | Product Owner |
| **Discipline Lead** | Hermes Runtime (via EPCL DisciplineSelector) |

### Supported Capabilities
| Capability ID | Description | Provider |
|-------------|-------------|---------|
| `architecture.design` | Design system architecture and document decisions | hermes |
| `architecture.review` | Review architecture decisions and designs | hermes |
| `code.review` | Automated code review and quality analysis | hermes |
| `research.analyze` | Analyze and synthesize research findings | hermes |

### Supported Skills
| Skill | Purpose |
|-------|---------|
| `architecture-diagram` | Generate architecture/infra diagrams |
| `excalidraw` | Hand-drawn architecture and flow diagrams |
| `systematic-debugging` | Root cause debugging before architecture |

### Supported Agents
*(Defined in HERMES_AGENT_RUNTIME.md — primary agents: Architect, System Designer)*

### Verification Rules
- Architecture decisions must have ADR documentation
- Designs must be verified against non-functional requirements
- Code reviews must check architectural compliance
- Architecture review must complete before engineering begins

### Knowledge Rules
- ADRs → Knowledge Entry as reusable architecture patterns
- Architecture decisions catalogued with date, context, and consequences
- Design patterns = skills for future reuse

### Deployment Rules
- Architecture reviews do NOT deploy code
- Architecture outputs are consumed by Engineering & Quality
- Architecture documents are checked into the knowledge base

### Escalation Rules
| Condition | Escalate To | Action |
|-----------|-------------|--------|
| Architecture conflict | Executive Layer | Decision arbitration |
| Security architecture concern | Security (Operations Layer) | Security review |
| Cross-product architecture impact | Product Owner | Strategic alignment |
| Platform architecture change | Platform Intelligence | Platform impact assessment |

### Token Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 12,000 tokens |
| Per-batch | 60,000 tokens |
| Per-plan | 250,000 tokens |

### Context Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 10,000 tokens |
| Per-batch | 40,000 tokens |
| Strategy | RESERVED |

### Activation Criteria
- Epic explicitly requests architecture/design/strategy
- Epic contains keywords: "architect", "design", "strategy"
- Research Intelligence has completed its analysis
- Engineering & Quality requires architecture input
- UI/UX design requires architecture validation

### Completion Criteria
- Architecture document or ADR created/updated
- Design review completed
- Architecture validated against requirements
- Downstream disciplines briefed on architecture decisions
- Knowledge capture completed

---

## 3. Experience & Design

### Identity

| Field | Value |
|-------|-------|
| **Discipline ID** | `experience_design` |
| **Label** | Experience & Design |
| **Layer** | Planning / Execution |
| **Executive Sponsor** | Product Owner |
| **Discipline Lead** | Hermes Runtime (via EPCL DisciplineSelector) |

### Supported Capabilities
| Capability ID | Description | Provider |
|-------------|-------------|---------|
| `experience.design` | Design user experiences and interfaces | hermes |
| `experience.review` | Review UX/UI designs | hermes |
| `experience.prototype` | Prototype user interfaces | hermes |

### Supported Skills
| Skill | Purpose |
|-------|---------|
| `sketch` | HTML mockups — 2-3 design variants |
| `claude-design` | Design HTML artifacts |
| `popular-web-designs` | 54 real design systems as HTML/CSS |
| `excalidraw` | Hand-drawn design diagrams |
| `architecture-diagram` | UX flow diagrams |
| `design-md` | Author/validate DESIGN.md token spec files |
| `p5js` | Creative visual sketches |

### Supported Agents
*(Defined in HERMES_AGENT_RUNTIME.md — primary agents: UX Designer)*

### Verification Rules
- Design mockups must be produced as viewable artifacts
- Designs must pass accessibility review (contrast, keyboard nav, screen reader)
- UX flows must be validated against user stories
- Designs must be reviewed before engineering implementation starts

### Knowledge Rules
- Design systems and patterns → reusable style skills
- UX research findings → Knowledge Entry
- Component designs → design token specifications

### Deployment Rules
- UX designs do NOT deploy directly to production
- Design artifacts are consumed by Engineering & Quality
- CSS/component libraries deploy through Engineering

### Escalation Rules
| Condition | Escalate To | Action |
|-----------|-------------|--------|
| Design direction conflict | Product Owner | UX decision |
| Accessibility compliance gap | Architecture & Strategy | Technical constraint assessment |
| Scope creep in design phase | Executive Layer | Scope revalidation |

### Token Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 15,000 tokens |
| Per-batch | 60,000 tokens |
| Per-plan | 250,000 tokens |

### Context Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 10,000 tokens |
| Per-batch | 40,000 tokens |
| Strategy | RESERVED |

### Activation Criteria
- Epic explicitly requests UX/UI/experience/interface design
- Epic contains keywords: "ux", "ui", "experience", "interface"
- Architecture & Strategy has completed architecture design
- Engineering & Quality requires design input

### Completion Criteria
- Design mockups produced and viewable
- Accessibility review completed
- UX flow validated against user stories
- Design decisions documented
- Downstream disciplines briefed
- Knowledge capture completed

---

## 4. Engineering & Quality

### Identity

| Field | Value |
|-------|-------|
| **Discipline ID** | `engineering_quality` |
| **Label** | Engineering & Quality |
| **Layer** | Execution |
| **Executive Sponsor** | Product Owner |
| **Discipline Lead** | Hermes Runtime (via EPCL DisciplineSelector) |

### Supported Capabilities
| Capability ID | Description | Provider |
|-------------|-------------|---------|
| `code.generate` | Generate code from specifications | hermes |
| `code.review` | Automated code review and quality analysis | hermes |
| `deploy.pages` | Deploy static pages to Cloudflare Pages | wrangler |
| `deploy.workers` | Deploy Cloudflare Workers | wrangler |
| `db.migrate` | Run D1 database migrations | wrangler |
| `db.rollback` | Roll back D1 database migrations | wrangler |
| `test.run` | Run test suites and verify results | hermes |
| `test.verify` | Verify test results against acceptance criteria | hermes |

### Supported Skills
| Skill | Purpose |
|-------|---------|
| `feature-milestone-execution` | Structured milestone implementation |
| `test-driven-development` | Enforce RED-GREEN-REFACTOR |
| `systematic-debugging` | 4-phase root cause debugging |
| `python-debugpy` | Python remote debugging |
| `node-inspect-debugger` | Node.js DevTools debugging |
| `simplify-code` | Parallel 3-agent code cleanup |
| `spike` | Throwaway experiments |
| `enforcement-guard-integration` | Add fail-closed security boundaries |
| `requesting-code-review` | Pre-commit security scan |

### Supported Agents
*(Defined in HERMES_AGENT_RUNTIME.md — primary agents: Developer, Engineer, QA)*

### Verification Rules
- All generated code must pass existing test suite
- New code must have tests (unit + integration as applicable)
- Code review must pass before merge
- TypeScript: `npx tsc --noEmit` must pass
- Build must succeed before deployment
- Performance regression checks for critical paths

### Knowledge Rules
- Implementation patterns → skills for future reuse
- Debugging lessons → Knowledge Entry
- Architecture decisions during implementation → ADRs
- QA findings → bug tracker + knowledge base

### Deployment Rules
- `deploy.pages` and `deploy.workers` require `deployment_approval` flag
- Pre-deployment health check must pass (WEF Operational Intelligence)
- `db.migrate` and `db.rollback` require explicit approval
- Rolling back is preferred over hotfixing

### Escalation Rules
| Condition | Escalate To | Action |
|-----------|-------------|--------|
| Build failure | Architecture & Strategy | Build system triage |
| Test regression > 5% | Architecture & Strategy | Test quality assessment |
| Deployment failure | Deployment Layer | Infrastructure triage |
| Security vulnerability | Security (Operations) | Security incident |
| Performance regression | Platform Intelligence | Performance analysis |

### Token Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 20,000 tokens |
| Per-batch | 100,000 tokens |
| Per-plan | 500,000 tokens |

### Context Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 16,000 tokens |
| Per-batch | 64,000 tokens |
| Strategy | DYNAMIC |

### Activation Criteria
- Epic explicitly requests code/test/deploy
- Epic contains keywords: "code", "test", "deploy", "build"
- Architecture & Strategy has completed architecture design
- Experience & Design has completed UX design
- No other discipline has better capability match

### Completion Criteria
- Code implemented and reviewed
- All tests pass (existing + new)
- Build succeeds
- Code generation complete
- Knowledge capture completed
- (If deployed) Deployment health check passed

---

## 5. Business & Growth

### Identity

| Field | Value |
|-------|-------|
| **Discipline ID** | `business_growth` |
| **Label** | Business & Growth |
| **Layer** | Executive / Knowledge |
| **Executive Sponsor** | Product Owner |
| **Discipline Lead** | Hermes Runtime (via EPCL DisciplineSelector) |

### Supported Capabilities
| Capability ID | Description | Provider |
|-------------|-------------|---------|
| `business.analyze` | Analyze business requirements and market conditions | hermes |
| `business.plan` | Create business plans and growth strategies | hermes |
| `business.report` | Generate business reports and dashboards | hermes |

### Supported Skills
| Skill | Purpose |
|-------|---------|
| `governance-dashboard` | Multi-layered governance dashboards |
| `post-wave-reporting` | Structured executive reports |
| `acceptance-audit` | READ-ONLY acceptance audits |

### Supported Agents
*(Defined in HERMES_AGENT_RUNTIME.md — primary agents: Business Analyst, Product Analyst)*

### Verification Rules
- Business analysis must cite data sources
- Growth projections must state assumptions
- Reports must separate facts from recommendations
- All reports must be auditable

### Knowledge Rules
- Market research → Knowledge Entry
- Business analysis patterns → skills for reuse
- Governance dashboards → persistent reports

### Deployment Rules
- Business & Growth does NOT deploy code or infrastructure
- Reports are knowledge artifacts
- Governance dashboards may be deployed as static reports

### Escalation Rules
| Condition | Escalate To | Action |
|-----------|-------------|--------|
| Market/regulatory concern | Product Owner | Strategic decision |
| Resource allocation conflict | Executive Layer | Priority arbitration |
| Compliance concern | Governance Layer | Compliance review |

### Token Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 8,000 tokens |
| Per-batch | 40,000 tokens |
| Per-plan | 150,000 tokens |

### Context Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 6,000 tokens |
| Per-batch | 24,000 tokens |
| Strategy | INCREMENTAL |

### Activation Criteria
- Epic explicitly requests business/market/growth/revenue analysis
- Epic contains keywords: "business", "market", "growth", "revenue"
- Product Owner requests business analysis

### Completion Criteria
- Business analysis artifact delivered
- Data sources cited
- Assumptions documented
- Knowledge capture completed

---

## 6. Platform Intelligence & Learning

### Identity

| Field | Value |
|-------|-------|
| **Discipline ID** | `platform_intelligence` |
| **Label** | Platform Intelligence & Learning |
| **Layer** | Infrastructure / Knowledge |
| **Executive Sponsor** | Product Owner |
| **Discipline Lead** | Hermes Runtime |

### Supported Capabilities
| Capability ID | Description | Provider |
|-------------|-------------|---------|
| `platform.learn` | Capture and integrate knowledge back into the platform | hermes |
| `platform.observe` | Observe platform behavior and health | hermes |
| `deploy.pages` | Deploy static pages to Cloudflare Pages | wrangler |
| `deploy.workers` | Deploy Cloudflare Workers | wrangler |

### Supported Skills
| Skill | Purpose |
|-------|---------|
| `llm-wiki` | Build/query interlinked markdown KB |
| `hermes-agent` | Configure, extend, contribute to Hermes |
| `hermes-agent-skill-authoring` | Author in-repo SKILL.md files |
| `platform-baseline-freeze` | Platform baseline & freeze reviews |
| `trust-verification-audit` | Verify security/trust enforcement |
| `release-certification-audit` | Release certification audits |

### Supported Agents
*(Defined in HERMES_AGENT_RUNTIME.md — primary agents: Platform Operator, Knowledge Manager)*

### Verification Rules
- Platform changes must pass health check before deployment
- Knowledge artifacts must be independently verifiable
- Skill definitions must have testable usage instructions
- Platform configuration changes require change log entry

### Knowledge Rules
- Every execution cycle produces knowledge capture
- Skills created for reusable procedures
- Memory used for durable cross-session facts
- Knowledge is the platform's learning mechanism

### Deployment Rules
- Platform deployments use `deploy.pages` and `deploy.workers` capabilities
- Platform changes require pre-deployment health check
- Rollback capability must exist before any deployment
- Configuration changes require approval

### Escalation Rules
| Condition | Escalate To | Action |
|-----------|-------------|--------|
| Platform health degradation | Product Owner | Platform incident |
| Knowledge corruption | Operations Layer | Knowledge restoration |
| Skill dependency conflict | Executive Layer | Skill lifecycle management |
| Platform architecture change | Executive Layer | Approval gate |

### Token Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 10,000 tokens |
| Per-batch | 50,000 tokens |
| Per-plan | 200,000 tokens |

### Context Budget
| Parameter | Default |
|-----------|---------|
| Per-task | 8,000 tokens |
| Per-batch | 32,000 tokens |
| Strategy | INCREMENTAL |

### Activation Criteria
- Epic explicitly requests platform/learn/knowledge/observe
- Epic contains keywords: "platform", "learn", "knowledge", "observe"
- Any discipline produces knowledge that needs capture
- Post-execution knowledge capture cycle
- Platform health check required

### Completion Criteria
- Knowledge captured and stored
- (If platform change) Health check passed
- (If deployment) Deployment completed and verified
- Knowledge entries indexed and retrievable
- Executive reporting completed

---

## Discipline Ownership Summary

| # | Discipline | Executive Sponsor | Lead Mechanism | Layer |
|---|-----------|-------------------|----------------|-------|
| 1 | Research Intelligence | Product Owner | EPCL DisciplineSelector | Executive/Knowledge |
| 2 | Architecture & Strategy | Product Owner | EPCL DisciplineSelector | Executive/Planning |
| 3 | Experience & Design | Product Owner | EPCL DisciplineSelector | Planning/Execution |
| 4 | Engineering & Quality | Product Owner | EPCL DisciplineSelector | Execution |
| 5 | Business & Growth | Product Owner | EPCL DisciplineSelector | Executive/Knowledge |
| 6 | Platform Intelligence | Product Owner | EPCL DisciplineSelector | Infrastructure/Knowledge |

> **Note**: All disciplines report through the Executive Layer. The Product Owner is the sole human authority. The EPCL `DisciplineSelector` (`workers/src/platform/epcl/discipline-selector.ts`) deterministically routes epics to disciplines. No LLM call is made for discipline selection.

## Capability–Discipline Mapping (from code)

```
┌─────────────────────┬──────────────────────────────────────────┐
│ Discipline           │ Capabilities                               │
├─────────────────────┼──────────────────────────────────────────┤
│ research_intelligence │ research.analyze, research.synthesize,    │
│                      │ research.investigate                        │
├─────────────────────┼──────────────────────────────────────────┤
│ architecture_strategy │ architecture.design, architecture.review, │
│                      │ code.review, research.analyze               │
├─────────────────────┼──────────────────────────────────────────┤
│ experience_design     │ experience.design, experience.review,     │
│                      │ experience.prototype                        │
├─────────────────────┼──────────────────────────────────────────┤
│ engineering_quality   │ code.generate, code.review, deploy.pages, │
│                      │ deploy.workers, db.migrate, db.rollback,   │
│                      │ test.run, test.verify                       │
├─────────────────────┼──────────────────────────────────────────┤
│ business_growth       │ business.analyze, business.plan,          │
│                      │ business.report                             │
├─────────────────────┼──────────────────────────────────────────┤
│ platform_intelligence │ platform.learn, platform.observe,         │
│                      │ deploy.pages, deploy.workers                │
└─────────────────────┴──────────────────────────────────────────┘
```

> Note: `deploy.pages` and `deploy.workers` are shared between `engineering_quality` and `platform_intelligence`. This is intentional — Engineering implements and tests deployments, Platform Intelligence owns platform-level deploys (infrastructure, configuration). Duplicate capability mapping is NOT a conflict when the execution context (epic) determines which discipline is activated.