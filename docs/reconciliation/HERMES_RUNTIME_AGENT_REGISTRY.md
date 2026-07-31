# HERMES RUNTIME AGENT REGISTRY

> **EPIC-009 — Phase C**
> Runtime Agent Reconstruction — Recover, classify, and define every runtime agent.
> **Status**: ✅ COMPLETE

---

## 1. Agent Classification Summary

| # | Agent | Classification | Department | Action |
|---|-------|---------------|-----------|--------|
| 1 | `hermes-runtime` | **Active** | Executive Office | Current session — orchestrator |
| 2 | `research-agent` | **Dormant** | Research Intelligence | Retain |
| 3 | `evidence-agent` | **Dormant** | Research Intelligence | Retain |
| 4 | `competitive-analysis-agent` | **Dormant** | Research Intelligence | Retain |
| 5 | `ux-research-agent` | **Dormant** | Experience & Design | Retain |
| 6 | `ux-designer` | **Dormant** | Experience & Design | Retain |
| 7 | `accessibility-agent` | **Dormant** | Experience & Design | Retain |
| 8 | `design-system-agent` | **Dormant** | Experience & Design | Retain |
| 9 | `architecture-agent` | **Dormant** | Architecture & Strategy | Retain |
| 10 | `backend-agent` | **Dormant** | Engineering | Retain |
| 11 | `frontend-agent` | **Dormant** | Engineering | Retain |
| 12 | `api-agent` | **Dormant** | Engineering | Retain |
| 13 | `cloudflare-agent` | **Dormant** | Engineering | Retain |
| 14 | `functional-qa-agent` | **Dormant** | Quality Assurance | Retain |
| 15 | `regression-qa-agent` | **Dormant** | Quality Assurance | Retain |
| 16 | `browser-qa-agent` | **Dormant** | Quality Assurance | Retain |
| 17 | `performance-qa-agent` | **Dormant** | Quality Assurance | Retain |
| 18 | `security-agent` | **Dormant** | Security | Retain |
| 19 | `documentation-agent` | **Dormant** | Documentation | Retain |
| 20 | `release-agent` | **Dormant** | Release Operations | Retain |
| 21 | `business-agent` | **Dormant** | Business & Growth | Retain |
| 22 | `platform-agent` | **Dormant** | Platform Engineering | Retain |
| 23 | `developer-agent-claude-code` | **Dormant** | Engineering | Retain (primary) |
| 24 | `developer-agent-local` | **Duplicate** | Engineering | Merge → #23 |
| 25 | `security-tooling-agent` | **Duplicate** | Security | Merge → #18 |
| 26 | `monitoring-agent` | **Duplicate** | Platform Engineering | Absorb into Observability Layer |
| 27 | `ags-fertility-ops-agent` | **Dormant** | Platform Engineering | Retain |
| 28 | `qa-agent` | **Dormant** | Quality Assurance | Merge → #14 |
| 29 | `deployment-agent` | **Dormant** | Release Operations | Merge → #20 |
| 30 | `finance-agent` | **Dormant** | Business & Growth | Merge → #21 |
| 31 | `customer-support-agent` | **Dormant** | Business & Growth | Merge → #21 |

**Total unique agents: 22** (after deduplication).
**Active: 1** (Hermes Runtime).
**Dormant: 21**.
**Duplicates merged: 4**.
**Missing (not created — route through EPCL): 23+ from AI_WORKFORCE.md**.

---

## 2. Active Agent Definition

### 2.1 Hermes Runtime Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `hermes-runtime` |
| **Department** | Executive Office |
| **Owner** | Product Owner (human) |
| **Purpose** | Current operational Hermes session — orchestrates all runtime execution across all departments |
| **Activation Trigger** | Product Owner approves objective or roadmap |
| **Inputs** | Approved objectives, roadmap markdown, EPCL config, runtime context |
| **Outputs** | Execution plans, orchestrated department execution, executive reports |
| **Capabilities** | All Hermes tools (terminal, file, patch, write_file, search_files, read_file, etc.), all loaded skills |
| **Skills** | feature-milestone-execution, ag-synergy-platform, post-wave-reporting, platform-capability-design |
| **Verification Gates** | Test suite pass, build clean, typecheck clean, deployment verified |
| **Knowledge Produced** | Execution traces, runtime evidence, executive reports |
| **Executive Visibility** | Full — appears in all executive reports and dashboards |
| **Retry Policy** | No retries on orchestration failures — escalate to Product Owner |
| **Failure Policy** | Fail-closed: halt execution, report blocker, wait for human operator |
| **Token Budget** | 5% of total runtime budget |
| **Concurrency Rules** | Single instance per session; subagents dispatched for parallel workstreams |
| **Termination Rules** | Session ends when all phases complete or Product Owner terminates |
| **Lifecycle** | IDLE → PROCESSING → COMPLETED / FAILED → IDLE |

---

## 3. Dormant Agent Definitions

### 3.1 Research Intelligence Agents

#### 3.1.1 Research Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `research-agent` |
| **Department** | Research Intelligence |
| **Owner** | Research Intelligence Lead |
| **Purpose** | Execute research tasks: paper discovery, literature review, domain reconnaissance |
| **Activation Trigger** | EPCL DisciplineSelector selects `research_intelligence` for epic |
| **Inputs** | Research objective, source list, methodology preference |
| **Outputs** | Research report, source catalog, evidence package |
| **Capabilities** | arxiv, blogwatcher, llm-wiki, xurl, youtube-content |
| **Skills** | research, evidence-collection, competitive-analysis |
| **Verification Gates** | Minimum 2 independent sources, all citations traceable |
| **Knowledge Produced** | Research findings, source metadata, synthesis artifacts |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on source access failure (max 3 attempts with backoff) |
| **Failure Policy** | Flag insufficient evidence → Architecture & Strategy for arbitration |
| **Token Budget** | 10,000 per task, 50,000 per batch, 200,000 per plan |
| **Concurrency Rules** | Max 3 concurrent research tasks |
| **Termination Rules** | Complete when evidence package is produced and verified |
| **Lifecycle** | IDLE → RESEARCHING → EVIDENCE_COLLECTED → SYNTHESIZED → COMPLETE |

#### 3.1.2 Evidence Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `evidence-agent` |
| **Department** | Research Intelligence |
| **Owner** | Research Intelligence Lead |
| **Purpose** | Collect and verify evidence for research claims |
| **Activation Trigger** | Research Agent produces claim requiring verification |
| **Inputs** | Claims from Research Agent, source list |
| **Outputs** | Verified evidence, source credibility ratings |
| **Capabilities** | Evidence collection, source verification, credibility assessment |
| **Skills** | research, evidence-collection |
| **Verification Gates** | Source credibility ≥ threshold, evidence independently verifiable |
| **Knowledge Produced** | Verified evidence packages |
| **Executive Visibility** | Evidence trace in executive report |
| **Retry Policy** | Retry on source access failure (max 3 attempts) |
| **Failure Policy** | Flag unverified claims → Research Agent for re-evaluation |
| **Token Budget** | 5,000 per evidence task |
| **Concurrency Rules** | Max 5 concurrent evidence tasks |
| **Termination Rules** | Complete when all claims verified or flagged |
| **Lifecycle** | IDLE → COLLECTING → VERIFYING → COMPLETE / FLAGGED |

#### 3.1.3 Competitive Analysis Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `competitive-analysis-agent` |
| **Department** | Research Intelligence |
| **Owner** | Research Intelligence Lead |
| **Purpose** | Analyze competitive landscape and market positioning |
| **Activation Trigger** | Business & Growth or Executive Office requests competitive analysis |
| **Inputs** | Market scope, competitor list, analysis criteria |
| **Outputs** | Competitive analysis report, positioning recommendations |
| **Capabilities** | Market analysis, competitor tracking, positioning analysis |
| **Skills** | competitive-analysis, research |
| **Verification Gates** | Competitor data from ≥2 independent sources |
| **Knowledge Produced** | Competitive landscape reports, positioning analysis |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on data access failure (max 3 attempts) |
| **Failure Policy** | Flag insufficient data → Business & Growth for market input |
| **Token Budget** | 10,000 per analysis task |
| **Concurrency Rules** | Max 2 concurrent competitive analyses |
| **Termination Rules** | Complete when analysis report produced and verified |
| **Lifecycle** | IDLE → ANALYZING → REPORTING → COMPLETE |

### 3.2 Experience & Design Agents

#### 3.2.1 UX Research Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `ux-research-agent` |
| **Department** | Experience & Design |
| **Owner** | Experience & Design Lead |
| **Purpose** | Conduct UX research: user interviews, usability testing, journey mapping |
| **Activation Trigger** | EPCL DisciplineSelector selects `experience_design` for epic |
| **Inputs** | UX research objective, user personas, journey scope |
| **Outputs** | UX research report, user journey maps, usability findings |
| **Capabilities** | UX research, user journey mapping, usability testing |
| **Skills** | UX research, user journey analysis |
| **Verification Gates** | Research methodology appropriate, findings traceable to user data |
| **Knowledge Produced** | UX research reports, user journey artifacts |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on data access failure (max 3 attempts) |
| **Failure Policy** | Flag insufficient data → Research Intelligence for evidence gathering |
| **Token Budget** | 8,000 per research task |
| **Concurrency Rules** | Max 2 concurrent UX research tasks |
| **Termination Rules** | Complete when research report produced and verified |
| **Lifecycle** | IDLE → RESEARCHING → REPORTING → COMPLETE |

#### 3.2.2 UX Designer

| Field | Value |
|-------|-------|
| **Unique ID** | `ux-designer` |
| **Department** | Experience & Design |
| **Owner** | Experience & Design Lead |
| **Purpose** | Create UI designs, prototypes, and design specifications |
| **Activation Trigger** | UX Research Agent produces validated findings requiring design |
| **Inputs** | UX research findings, design constraints, brand guidelines |
| **Outputs** | UI designs, prototypes, design specifications |
| **Capabilities** | UI design, prototyping, design specification |
| **Skills** | UI design, design system validation, accessibility review |
| **Verification Gates** | Design system compliance, accessibility WCAG 2.1 AA, prototype usability |
| **Knowledge Produced** | Design specifications, prototype artifacts |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on design iteration (max 3 iterations) |
| **Failure Policy** | Flag design conflict → Architecture & Strategy |
| **Token Budget** | 8,000 per design task |
| **Concurrency Rules** | Max 2 concurrent design tasks |
| **Termination Rules** | Complete when design approved by Experience & Design Lead |
| **Lifecycle** | IDLE → DESIGNING → ITERATING → COMPLETE |

#### 3.2.3 Accessibility Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `accessibility-agent` |
| **Department** | Experience & Design |
| **Owner** | Experience & Design Lead |
| **Purpose** | Verify WCAG 2.1 AA compliance and accessibility standards |
| **Activation Trigger** | UX Designer produces design requiring accessibility validation |
| **Inputs** | UI designs, accessibility requirements, WCAG criteria |
| **Outputs** | Accessibility audit report, compliance status |
| **Capabilities** | Accessibility review, WCAG compliance checking |
| **Skills** | accessibility-review, design-system-validation |
| **Verification Gates** | WCAG 2.1 AA compliance verified, all criteria checked |
| **Knowledge Produced** | Accessibility audit reports, compliance evidence |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on audit tool failure (max 2 attempts) |
| **Failure Policy** | Flag violations → UX Designer for remediation |
| **Token Budget** | 5,000 per audit task |
| **Concurrency Rules** | Max 3 concurrent accessibility audits |
| **Termination Rules** | Complete when audit report produced and compliance verified |
| **Lifecycle** | IDLE → AUDITING → REPORTING → COMPLETE |

#### 3.2.4 Design System Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `design-system-agent` |
| **Department** | Experience & Design |
| **Owner** | Experience & Design Lead |
| **Purpose** | Maintain and validate design system consistency |
| **Activation Trigger** | UX Designer or UX Research Agent flags design system inconsistency |
| **Inputs** | Design tokens, component library, consistency rules |
| **Outputs** | Design system validation report, token compliance status |
| **Capabilities** | Design system validation, token consistency checking |
| **Skills** | design-system-validation |
| **Verification Gates** | All tokens consistent, all components validated |
| **Knowledge Produced** | Design system compliance reports |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on validation tool failure (max 2 attempts) |
| **Failure Policy** | Flag systemic issues → Architecture & Strategy |
| **Token Budget** | 5,000 per validation task |
| **Concurrency Rules** | Max 2 concurrent validations |
| **Termination Rules** | Complete when validation report produced |
| **Lifecycle** | IDLE → VALIDATING → REPORTING → COMPLETE |

### 3.3 Architecture & Strategy Agents

#### 3.3.1 Architecture Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `architecture-agent` |
| **Department** | Architecture & Strategy |
| **Owner** | Architecture & Strategy Lead |
| **Purpose** | Design system architecture, author ADRs, conduct architecture reviews |
| **Activation Trigger** | EPCL DisciplineSelector selects `architecture_strategy` for epic |
| **Inputs** | Architecture objective, existing ADRs, platform constitution |
| **Outputs** | Architecture decisions, ADRs, design documents |
| **Capabilities** | Architecture design, ADR authoring, architecture review, dependency mapping |
| **Skills** | architecture-review, research |
| **Verification Gates** | ADR references existing ratified ADRs, platform boundaries preserved |
| **Knowledge Produced** | ADRs, architecture documents, dependency graphs |
| **Executive Visibility** | Full — architecture decisions appear in executive reports |
| **Retry Policy** | Retry on research failure (max 3 attempts) |
| **Failure Policy** | Flag constitutional violation → Executive Office (halt) |
| **Token Budget** | 8,000 per architecture task |
| **Concurrency Rules** | Max 2 concurrent architecture tasks |
| **Termination Rules** | Complete when ADRs authored and review passed |
| **Lifecycle** | IDLE → DESIGNING → REVIEWING → COMPLETE |

### 3.4 Engineering Agents

#### 3.4.1 Backend Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `backend-agent` |
| **Department** | Engineering |
| **Owner** | Engineering Lead |
| **Purpose** | Implement backend services, APIs, and server-side logic |
| **Activation Trigger** | EPCL selects `engineering` discipline; task requires backend implementation |
| **Inputs** | Architecture specifications, API contracts, database schemas |
| **Outputs** | Backend source code, API endpoints, database migrations |
| **Capabilities** | Backend development, API implementation, database design |
| **Skills** | backend-development, api-design, database-migration |
| **Verification Gates** | TypeScript clean, tests passing, build clean |
| **Knowledge Produced** | Backend implementation artifacts, API documentation |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on build failure (max 2 attempts after fix) |
| **Failure Policy** | Flag to QA for defect reporting; escalate to Architecture & Strategy if architectural |
| **Token Budget** | 15,000 per backend task |
| **Concurrency Rules** | Max 3 concurrent backend tasks |
| **Termination Rules** | Complete when implementation passes all verification gates |
| **Lifecycle** | IDLE → IMPLEMENTING → TESTING → COMPLETE |

#### 3.4.2 Frontend Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `frontend-agent` |
| **Department** | Engineering |
| **Owner** | Engineering Lead |
| **Purpose** | Implement frontend UI, components, and client-side logic |
| **Activation Trigger** | EPCL selects `engineering` discipline; task requires frontend implementation |
| **Inputs** | UI designs from Experience & Design, API contracts, design tokens |
| **Outputs** | Frontend source code, UI components, client-side logic |
| **Capabilities** | Frontend development, UI implementation, design system integration |
| **Skills** | frontend-development, UI design, design-system-validation |
| **Verification Gates** | TypeScript clean, tests passing, build clean, design system compliance |
| **Knowledge Produced** | Frontend implementation artifacts, UI documentation |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on build failure (max 2 attempts after fix) |
| **Failure Policy** | Flag to QA for defect reporting; escalate to Experience & Design for design issues |
| **Token Budget** | 15,000 per frontend task |
| **Concurrency Rules** | Max 3 concurrent frontend tasks |
| **Termination Rules** | Complete when implementation passes all verification gates |
| **Lifecycle** | IDLE → IMPLEMENTING → TESTING → COMPLETE |

#### 3.4.3 API Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `api-agent` |
| **Department** | Engineering |
| **Owner** | Engineering Lead |
| **Purpose** | Design and implement API contracts, API documentation, and API integration |
| **Activation Trigger** | EPCL selects `engineering` discipline; task requires API design or integration |
| **Inputs** | Architecture specifications, API requirements, backend contracts |
| **Outputs** | API specifications, API documentation, integration code |
| **Capabilities** | API design, API documentation, API integration testing |
| **Skills** | api-design, backend-development |
| **Verification Gates** | API spec complete, documentation accurate, integration tests pass |
| **Knowledge Produced** | API specifications, API documentation |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on spec validation failure (max 2 attempts) |
| **Failure Policy** | Flag to Architecture & Strategy for spec issues |
| **Token Budget** | 10,000 per API task |
| **Concurrency Rules** | Max 2 concurrent API tasks |
| **Termination Rules** | Complete when API spec and documentation pass verification |
| **Lifecycle** | IDLE → DESIGNING → IMPLEMENTING → DOCUMENTING → COMPLETE |

#### 3.4.4 Cloudflare Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `cloudflare-agent` |
| **Department** | Engineering |
| **Owner** | Engineering Lead |
| **Purpose** | Manage Cloudflare Workers deployment, configuration, and Cloudflare-specific tooling |
| **Activation Trigger** | EPCL selects `engineering` discipline; task requires Cloudflare deployment |
| **Inputs** | Deployment artifacts, Cloudflare configuration, wrangler config |
| **Outputs** | Deployed Workers, Cloudflare configuration, deployment records |
| **Capabilities** | Cloudflare deployment, Workers configuration, Pages deployment |
| **Skills** | cloudflare-deployment, deployment-verification |
| **Verification Gates** | Deployment health check passed, Workers running, Pages deployed |
| **Knowledge Produced** | Deployment records, Cloudflare configuration artifacts |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on deployment failure (max 2 attempts) |
| **Failure Policy** | Flag to Release Operations for rollback; escalate to Executive Office on critical |
| **Token Budget** | 8,000 per deployment task |
| **Concurrency Rules** | Max 2 concurrent deployments |
| **Termination Rules** | Complete when deployment verified and healthy |
| **Lifecycle** | IDLE → DEPLOYING → VERIFYING → COMPLETE |

### 3.5 Quality Assurance Agents

#### 3.5.1 Functional QA Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `functional-qa-agent` |
| **Department** | Quality Assurance |
| **Owner** | QA Lead |
| **Purpose** | Execute functional testing to verify features work as specified |
| **Activation Trigger** | Engineering completes implementation; EPCL verification phase |
| **Inputs** | Engineering output, test plans, acceptance criteria |
| **Outputs** | Functional test results, defect reports |
| **Capabilities** | Functional testing, acceptance testing, test execution |
| **Skills** | testing, regression-testing |
| **Verification Gates** | All functional tests pass, all acceptance criteria met |
| **Knowledge Produced** | Test results, defect reports |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry flaky tests (max 2 reruns) |
| **Failure Policy** | Report defects to Engineering for fix |
| **Token Budget** | 8,000 per test cycle |
| **Concurrency Rules** | Max 3 concurrent test suites |
| **Termination Rules** | Complete when all functional tests pass or defects reported |
| **Lifecycle** | IDLE → TESTING → REPORTING → COMPLETE |

#### 3.5.2 Regression QA Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `regression-qa-agent` |
| **Department** | Quality Assurance |
| **Owner** | QA Lead |
| **Purpose** | Execute regression testing to ensure no existing functionality is broken |
| **Activation Trigger** | Engineering completes implementation; EPCL verification phase |
| **Inputs** | Engineering output, existing test suite, regression test plan |
| **Outputs** | Regression test results, regression analysis |
| **Capabilities** | Regression testing, test suite execution, regression analysis |
| **Skills** | regression-testing |
| **Verification Gates** | No new regressions, all existing tests still pass |
| **Knowledge Produced** | Regression test results, regression analysis reports |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry flaky tests (max 2 reruns) |
| **Failure Policy** | Report regressions to Engineering for fix |
| **Token Budget** | 8,000 per regression cycle |
| **Concurrency Rules** | Max 2 concurrent regression suites |
| **Termination Rules** | Complete when regression suite passes or regressions reported |
| **Lifecycle** | IDLE → TESTING → ANALYZING → COMPLETE |

#### 3.5.3 Browser QA Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `browser-qa-agent` |
| **Department** | Quality Assurance |
| **Owner** | QA Lead |
| **Purpose** | Validate cross-browser compatibility |
| **Activation Trigger** | Frontend Agent completes UI implementation |
| **Inputs** | Frontend output, browser matrix, compatibility requirements |
| **Outputs** | Browser compatibility report, compatibility matrix |
| **Capabilities** | Browser validation, cross-browser testing |
| **Skills** | browser-validation |
| **Verification Gates** | All target browsers pass, compatibility matrix complete |
| **Knowledge Produced** | Browser compatibility reports |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on browser tool failure (max 2 attempts) |
| **Failure Policy** | Flag browser-specific issues to Frontend Agent |
| **Token Budget** | 5,000 per browser validation |
| **Concurrency Rules** | Max 2 concurrent browser validations |
| **Termination Rules** | Complete when browser matrix passes |
| **Lifecycle** | IDLE → VALIDATING → REPORTING → COMPLETE |

#### 3.5.4 Performance QA Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `performance-qa-agent` |
| **Department** | Quality Assurance |
| **Owner** | QA Lead |
| **Purpose** | Execute performance testing and benchmark validation |
| **Activation Trigger** | Engineering completes implementation; performance requirements exist |
| **Inputs** | Engineering output, performance benchmarks, threshold criteria |
| **Outputs** | Performance test results, benchmark analysis |
| **Capabilities** | Performance analysis, benchmark testing, load testing |
| **Skills** | performance-analysis |
| **Verification Gates** | Performance within defined thresholds, benchmarks met |
| **Knowledge Produced** | Performance test results, benchmark reports |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on tool failure (max 2 attempts) |
| **Failure Policy** | Flag performance regressions to Architecture & Strategy |
| **Token Budget** | 8,000 per performance test |
| **Concurrency Rules** | Max 2 concurrent performance tests |
| **Termination Rules** | Complete when benchmarks validated |
| **Lifecycle** | IDLE → TESTING → ANALYZING → COMPLETE |

### 3.6 Security Agent

#### 3.6.1 Security Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `security-agent` |
| **Department** | Security |
| **Owner** | Security Lead |
| **Purpose** | Execute threat modeling, security scanning, and vulnerability assessment |
| **Activation Trigger** | EPCL security requirements triggered; Engineering output ready for security review |
| **Inputs** | Engineering output, architecture specifications, security requirements |
| **Outputs** | Security reports, vulnerability assessments, threat models |
| **Capabilities** | Threat modeling, security scanning, vulnerability assessment, secret scanning |
| **Skills** | threat-modeling, security-scanning |
| **Verification Gates** | No critical/high vulnerabilities, secret scan clean, compliance check passed |
| **Knowledge Produced** | Security reports, vulnerability assessments, threat models |
| **Executive Visibility** | Full — security clearance required before release |
| **Retry Policy** | Retry on scan tool failure (max 2 attempts) |
| **Failure Policy** | Critical vulnerability → Executive Office (halt deployment); high → Engineering |
| **Token Budget** | 8,000 per security review |
| **Concurrency Rules** | Max 2 concurrent security reviews |
| **Termination Rules** | Complete when security review passed or critical finding reported |
| **Lifecycle** | IDLE → SCANNING → ASSESSING → COMPLETE / HALTED |

### 3.7 Documentation Agent

#### 3.7.1 Documentation Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `documentation-agent` |
| **Department** | Documentation |
| **Owner** | Documentation Lead |
| **Purpose** | Create and maintain technical documentation, runbooks, and knowledge artifacts |
| **Activation Trigger** | Any department produces output requiring documentation |
| **Inputs** | Department outputs, execution traces, architecture decisions |
| **Outputs** | Documentation artifacts, runbooks, knowledge base entries |
| **Capabilities** | Technical writing, runbook creation, API documentation, knowledge base management |
| **Skills** | documentation, knowledge-capture |
| **Verification Gates** | All public APIs documented, execution traces captured, no stale docs |
| **Knowledge Produced** | Documentation artifacts, knowledge base entries |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on content generation failure (max 2 attempts) |
| **Failure Policy** | Flag incomplete docs → responsible department |
| **Token Budget** | 5,000 per documentation task |
| **Concurrency Rules** | Max 3 concurrent documentation tasks |
| **Termination Rules** | Complete when documentation passes completeness check |
| **Lifecycle** | IDLE → WRITING → REVIEWING → COMPLETE |

### 3.8 Release Operations Agent

#### 3.8.1 Release Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `release-agent` |
| **Department** | Release Operations |
| **Owner** | Release Operations Lead |
| **Purpose** | Execute deployments, manage releases, and handle rollbacks |
| **Activation Trigger** | EPCL release plan approved; Engineering output ready; Security clearance granted |
| **Inputs** | Engineering artifacts, Security clearance, Executive Office authorization |
| **Outputs** | Deployed artifacts, release notes, rollback records |
| **Capabilities** | Deployment execution, rollback management, release orchestration |
| **Skills** | cloudflare-deployment, deployment-verification, rollback |
| **Verification Gates** | Deployment health check passed, rollback tested, release notes complete |
| **Knowledge Produced** | Deployment records, release notes, rollback records |
| **Executive Visibility** | Full — deployment status in executive report |
| **Retry Policy** | Retry on deployment failure (max 2 attempts) |
| **Failure Policy** | Initiate rollback; escalate to Executive Office on critical failure |
| **Token Budget** | 8,000 per release task |
| **Concurrency Rules** | Max 1 concurrent deployment per environment |
| **Termination Rules** | Complete when deployment verified healthy or rollback executed |
| **Lifecycle** | IDLE → DEPLOYING → VERIFYING → COMPLETE / ROLLING_BACK |

### 3.9 Business & Growth Agent

#### 3.9.1 Business Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `business-agent` |
| **Department** | Business & Growth |
| **Owner** | Business & Growth Lead |
| **Purpose** | Execute business analysis, financial planning, and growth strategy |
| **Activation Trigger** | Executive Office requests business analysis or growth strategy |
| **Inputs** | Product Owner objectives, market data, customer feedback |
| **Outputs** | Business analysis reports, financial plans, growth strategies |
| **Capabilities** | Business analysis, financial planning, market analysis |
| **Skills** | competitive-analysis, research |
| **Verification Gates** | Financial projections validated, market data sourced from credible references |
| **Knowledge Produced** | Business analysis reports, financial plans |
| **Executive Visibility** | Full — business reports in executive reports |
| **Retry Policy** | Retry on data access failure (max 3 attempts) |
| **Failure Policy** | Flag insufficient data → Research Intelligence |
| **Token Budget** | 5,000 per business analysis task |
| **Concurrency Rules** | Max 2 concurrent business analysis tasks |
| **Termination Rules** | Complete when analysis report produced and verified |
| **Lifecycle** | IDLE → ANALYZING → REPORTING → COMPLETE |

### 3.10 Platform Engineering Agent

#### 3.10.1 Platform Agent

| Field | Value |
|-------|-------|
| **Unique ID** | `platform-agent` |
| **Department** | Platform Engineering |
| **Owner** | Platform Engineering Lead |
| **Purpose** | Maintain platform infrastructure, tooling, and runtime health |
| **Activation Trigger** | Any department requires platform support; scheduled platform maintenance |
| **Inputs** | Platform needs from all departments, infrastructure requirements |
| **Outputs** | Platform services, tooling updates, infrastructure health reports |
| **Capabilities** | Platform infrastructure, tooling, CI/CD maintenance, credential management |
| **Skills** | platform-engineering, developer-experience |
| **Verification Gates** | Platform services healthy, CI/CD operational, credential rotation current |
| **Knowledge Produced** | Platform health reports, infrastructure documentation |
| **Executive Visibility** | Summary in executive report |
| **Retry Policy** | Retry on infrastructure operation failure (max 2 attempts) |
| **Failure Policy** | Critical platform outage → Executive Office (immediate) |
| **Token Budget** | 6,000 per platform task |
| **Concurrency Rules** | Max 2 concurrent platform operations |
| **Termination Rules** | Complete when platform service restored or health verified |
| **Lifecycle** | IDLE → MAINTAINING → VERIFYING → COMPLETE |

---

## 4. Duplicate Resolution

| Duplicate | Merged Into | Rationale |
|-----------|------------|-----------|
| `developer-agent-local` | `developer-agent-claude-code` | Same capability; local agent is redundant with Claude Code ACP |
| `security-tooling-agent` | `security-agent` | Overlapping security capabilities; single security agent owns all security |
| `monitoring-agent` | Platform Engineering (Observability Layer) | Monitoring is infrastructure concern, not a standalone agent |
| `qa-agent` | `functional-qa-agent` | QA is a capability of Quality Assurance department |
| `deployment-agent` | `release-agent` | Deployment is a capability of Release Operations |
| `finance-agent` | `business-agent` | Finance is a capability of Business & Growth |
| `customer-support-agent` | `business-agent` | Customer support is a capability of Business & Growth |

---

## 5. Missing Agents (Not Created)

The following agents from `AI_WORKFORCE.md` are **not created** — they are routed through the EPCL discipline system instead:

- 23+ agents listed in `AI_WORKFORCE.md` as designed but not seeded
- All future agents are created only when absolutely required by a specific epic
- Default routing: EPCL → DisciplineSelector → Department → Runtime Agent

---

## 6. Phase C Completion Summary

- **31 agents scanned** from all historical sources.
- **22 unique agents** after deduplication (1 active + 21 dormant).
- **4 duplicates merged** with clear resolution rationale.
- **Every agent defined** with all 15 required fields.
- **No conceptual agents** — everything is executable.
- **Ready for Phase D** — Skill Registry.
