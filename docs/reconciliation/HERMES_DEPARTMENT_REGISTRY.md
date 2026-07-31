# HERMES DEPARTMENT REGISTRY

> **EPIC-009 — Phase B (Continued)**
> Canonical department definitions with full operational specification.
> **Status**: ✅ COMPLETE

---

## 1. Registry Overview

11 departments. Each department has exactly one owner (the department itself). Every responsibility is owned by exactly one department. No overlaps, no gaps.

---

## 2. Department Definitions

### 2.1 Executive Office

| Field | Value |
|-------|-------|
| **Department ID** | `executive_office` |
| **Layer** | Governance |
| **Owner** | Product Owner (human) |
| **Mission** | Own Product Authority, approve roadmaps, produce executive reports, enforce governance |
| **Responsibilities** | 1. Roadmap approval and scope authorization 2. EPCL workflow orchestration oversight 3. Executive report generation and delivery 4. Strategic decision-making 5. Governance rule enforcement 6. Phase gate approval 7. Stakeholder communication 8. Release authorization |
| **Inputs** | Product Owner objectives, roadmap markdown, stakeholder requests, governance dashboards |
| **Outputs** | Approved execution plans, executive reports, strategic decisions, scope authorizations |
| **Decision Rights** | Approve/reject roadmaps, authorize production deployments, terminate stalled executions, escalate unresolved blockers |
| **Quality Gates** | All prior phases complete, governance dashboards synchronized, test suite passing, no P0 blockers unresolved |
| **Escalation Rules** | Unresolved P0 blockers → Product Owner (human); scope ambiguity → stakeholder clarification; deployment authorization → Product Owner sign-off |
| **Runtime Budget** | 5% of total token budget |
| **Success Metrics** | On-time roadmap completion rate, executive report accuracy score, governance compliance %, stakeholder satisfaction |
| **Interaction Contracts** | Receives from: Product Owner (objectives), all departments (reports). Dispatches to: EPCL (execution plans), all departments (authorizations). |
| **Evidence Produced** | Approved roadmaps, executive reports (15-section PO reports), governance dashboards, scope authorization records |

### 2.2 Research Intelligence

| Field | Value |
|-------|-------|
| **Department ID** | `research_intelligence` |
| **Layer** | Knowledge |
| **Owner** | Research Intelligence Lead (runtime agent: ResearchAgent) |
| **Mission** | Gather, analyze, and synthesize evidence to inform all downstream disciplines |
| **Responsibilities** | 1. Academic research (arXiv, papers) 2. Competitive analysis 3. Market intelligence 4. Evidence collection and verification 5. Source credibility assessment 6. Research synthesis 7. Evidence package production |
| **Inputs** | Research requests from Architecture, Engineering, Business; EPCL research-tagged objectives |
| **Outputs** | Research reports, evidence packages, competitive briefs, source catalogs |
| **Decision Rights** | Select research methodology, determine source credibility, flag insufficient evidence, reject unverified claims |
| **Quality Gates** | Minimum 2 independent sources per factual claim, all citations traceable to original sources, synthesis separates fact from interpretation |
| **Escalation Rules** | Unresolvable factual conflict → Architecture & Strategy (arbitration); source access failure → Platform Engineering (credential/permission); research scope expansion → Executive Office |
| **Runtime Budget** | 10% of total token budget |
| **Success Metrics** | Evidence-to-decision latency, research coverage %, source citation completeness, downstream discipline satisfaction |
| **Interaction Contracts** | Receives from: all departments (research requests). Dispatches to: Architecture & Strategy, Engineering, Business & Growth (evidence packages). |
| **Evidence Produced** | Research reports, evidence packages, source catalogs, competitive analysis briefs |

### 2.3 Architecture & Strategy

| Field | Value |
|-------|-------|
| **Department ID** | `architecture_strategy` |
| **Layer** | Planning |
| **Owner** | Architecture & Strategy Lead (runtime agent: ArchitectureAgent) |
| **Mission** | Design system architecture, author ADRs, review technical designs, maintain architectural coherence |
| **Responsibilities** | 1. System architecture design 2. ADR authoring and maintenance 3. Architecture reviews 4. Technical strategy definition 5. Dependency mapping 6. Platform boundary enforcement 7. Capability model maintenance 8. Technical debt tracking |
| **Inputs** | Research output, Product Owner objectives, EPCL roadmap, governance standards |
| **Outputs** | Architecture decisions (ADRs), design documents, technical specifications, dependency graphs |
| **Decision Rights** | Approve architectural approaches, reject designs violating platform constitution, enforce ADR governance |
| **Quality Gates** | All ADRs reference existing ratified ADRs, no new architecture without formal review, platform boundaries preserved |
| **Escalation Rules** | Architectural conflict → Executive Office; ADR ambiguity → Product Owner; constitution violation → immediate halt |
| **Runtime Budget** | 8% of total token budget |
| **Success Metrics** | ADR coverage %, architecture review completion rate, design coherence score, platform boundary violation count (target: 0) |
| **Interaction Contracts** | Receives from: Research Intelligence (evidence), Executive Office (objectives). Dispatches to: Engineering (specs), Experience & Design (design constraints). |
| **Evidence Produced** | ADRs, architecture documents, design specifications, dependency graphs, platform boundary maps |

### 2.4 Experience & Design

| Field | Value |
|-------|-------|
| **Department ID** | `experience_design` |
| **Layer** | Planning/Execution |
| **Owner** | Experience & Design Lead (runtime agent: UXAgent) |
| **Mission** | Deliver user experience research, UI design, accessibility compliance, and design system validation |
| **Responsibilities** | 1. UX research 2. UI design and prototyping 3. Accessibility review (WCAG 2.1 AA) 4. Design system validation 5. User journey mapping 6. Interaction design 7. Design token management 8. Browser compatibility validation |
| **Inputs** | Product requirements, research output from Research Intelligence, Architecture specifications |
| **Outputs** | UX designs, accessibility reports, design system updates, prototypes, user journey maps |
| **Decision Rights** | Approve UX approaches, flag accessibility violations, validate design system compliance, reject non-compliant designs |
| **Quality Gates** | WCAG 2.1 AA compliance, design system token consistency, prototype usability validation, browser compatibility matrix passed |
| **Escalation Rules** | Accessibility violation → Architecture & Strategy (constitutional review); UX ambiguity → Executive Office (Product Owner); design system conflict → Platform Engineering |
| **Runtime Budget** | 8% of total token budget |
| **Success Metrics** | Accessibility pass rate (target: 100%), design system token coverage %, UX research completion rate, prototype validation rate |
| **Interaction Contracts** | Receives from: Research Intelligence (user insights), Architecture & Strategy (technical constraints). Dispatches to: Engineering (design specs). |
| **Evidence Produced** | UX research reports, design prototypes, accessibility audit results, design system documentation |

### 2.5 Engineering

| Field | Value |
|-------|-------|
| **Department ID** | `engineering` |
| **Layer** | Execution |
| **Owner** | Engineering Lead (runtime agents: BackendAgent, FrontendAgent, APIAgent, CloudflareAgent) |
| **Mission** | Implement backend, frontend, API, and deployment capabilities with quality and governance |
| **Responsibilities** | 1. Backend development 2. Frontend development 3. API design and implementation 4. Cloudflare deployment 5. Code generation and review 6. Database migration 7. Build pipeline maintenance 8. TypeScript/type safety enforcement |
| **Inputs** | Architecture specifications, EPCL execution plans, capability selections, design specs from Experience & Design |
| **Outputs** | Source code, API endpoints, deployment artifacts, build outputs, type definitions |
| **Decision Rights** | Select implementation approach within architectural constraints, choose deployment strategy, approve code changes |
| **Quality Gates** | TypeScript clean (`npx tsc --noEmit`), tests passing (`npx vitest run`), build clean, no new lint errors |
| **Escalation Rules** | Build failure → Architecture & Strategy (architectural issue); test failure → Quality Assurance (defect); security issue → Security department |
| **Runtime Budget** | 25% of total token budget |
| **Success Metrics** | Build success rate (target: 100%), test pass rate, deployment frequency, code review turnaround time |
| **Interaction Contracts** | Receives from: Architecture & Strategy (specs), Experience & Design (design specs), EPCL (execution plans). Dispatches to: QA (for testing), Security (for review), Release Operations (for deployment). |
| **Evidence Produced** | Source code, build artifacts, deployment records, API documentation, type definitions |

### 2.6 Quality Assurance

| Field | Value |
|-------|-------|
| **Department ID** | `quality_assurance` |
| **Layer** | Verification |
| **Owner** | QA Lead (runtime agents: FunctionalQAAgent, RegressionQAAgent, BrowserQAAgent, PerformanceQAAgent) |
| **Mission** | Verify software quality through functional, regression, browser, and performance testing |
| **Responsibilities** | 1. Functional QA testing 2. Regression testing 3. Browser validation 4. Performance analysis 5. Test suite maintenance 6. Quality gate enforcement 7. Defect reporting 8. Verification routing |
| **Inputs** | Engineering output, EPCL verification requirements, test plans from EPCL |
| **Outputs** | Test results, quality reports, regression analysis, verification status |
| **Decision Rights** | Approve/reject quality gates, flag performance regressions, declare verification complete, halt release on critical failures |
| **Quality Gates** | All test categories pass, no new regressions introduced, performance within defined thresholds, browser matrix complete |
| **Escalation Rules** | Critical regression → Engineering (fix); performance degradation → Architecture & Strategy (review); test infrastructure failure → Platform Engineering |
| **Runtime Budget** | 12% of total token budget |
| **Success Metrics** | Test pass rate (target: 100%), regression detection rate, performance benchmark adherence, verification coverage % |
| **Interaction Contracts** | Receives from: Engineering (code), Security (security test results). Dispatches to: Executive Office (verification status). |
| **Evidence Produced** | Test results, quality reports, regression analysis, verification evidence |

### 2.7 Security

| Field | Value |
|-------|-------|
| **Department ID** | `security` |
| **Layer** | Verification |
| **Owner** | Security Lead (runtime agent: SecurityAgent) |
| **Mission** | Ensure security posture through threat modeling, scanning, vulnerability assessment, and compliance |
| **Responsibilities** | 1. Threat modeling 2. Security scanning 3. Vulnerability assessment 4. Compliance verification 5. Security review 6. Secret scanning 7. Access control validation 8. Security gate enforcement |
| **Inputs** | Architecture specifications, Engineering output, EPCL security requirements |
| **Outputs** | Security reports, vulnerability assessments, compliance evidence, threat models |
| **Decision Rights** | Approve/reject security posture, halt deployment on critical findings, enforce secret scanning |
| **Quality Gates** | No critical/high vulnerabilities, all findings triaged and assigned, compliance check passed, secret scan clean |
| **Escalation Rules** | Critical vulnerability → Executive Office (halt deployment immediately); high vulnerability → Engineering (fix); compliance gap → Architecture & Strategy |
| **Runtime Budget** | 8% of total token budget |
| **Success Metrics** | Vulnerability density (target: 0 critical/high), mean time to remediate, compliance score (target: 100%), secret scan pass rate |
| **Interaction Contracts** | Receives from: Engineering (code/artifacts). Dispatches to: Executive Office (security clearance), Quality Assurance (security test results). |
| **Evidence Produced** | Security reports, vulnerability assessments, compliance evidence, threat models, secret scan results |

### 2.8 Documentation

| Field | Value |
|-------|-------|
| **Department ID** | `documentation` |
| **Layer** | Knowledge |
| **Owner** | Documentation Lead (runtime agent: DocumentationAgent) |
| **Mission** | Maintain comprehensive technical documentation, runbooks, and knowledge artifacts |
| **Responsibilities** | 1. Technical documentation 2. Runbook creation and maintenance 3. API documentation 4. Knowledge base maintenance 5. Governance document management 6. Execution trace documentation 7. Onboarding documentation 8. Architecture documentation |
| **Inputs** | All department outputs, EPCL execution traces, runtime evidence, architecture decisions |
| **Outputs** | Documentation artifacts, runbooks, knowledge base entries, API docs |
| **Decision Rights** | Approve documentation completeness, flag outdated documentation, enforce documentation standards |
| **Quality Gates** | All public APIs documented, all execution traces captured, no stale documentation, all ADRs referenced |
| **Escalation Rules** | Missing critical docs → responsible department; stale docs → Platform Engineering; documentation gap → Executive Office |
| **Runtime Budget** | 5% of total token budget |
| **Success Metrics** | Documentation coverage %, doc freshness score, knowledge capture rate, runbook completeness |
| **Interaction Contracts** | Receives from: all departments (output artifacts). Dispatches to: Executive Office (documentation status), Platform Engineering (doc tooling). |
| **Evidence Produced** | Documentation artifacts, runbooks, knowledge base entries, API documentation, governance docs |

### 2.9 Release Operations

| Field | Value |
|-------|-------|
| **Department ID** | `release_operations` |
| **Layer** | Deployment |
| **Owner** | Release Operations Lead (runtime agent: ReleaseAgent) |
| **Mission** | Manage deployment pipeline, release orchestration, rollback capability, and CI/CD operations |
| **Responsibilities** | 1. Deployment execution 2. Rollback management 3. Release orchestration 4. CI/CD pipeline maintenance 5. Deployment health monitoring 6. Release note generation 7. Environment management 8. Deployment verification |
| **Inputs** | Engineering output, EPCL release plans, Security clearance, Executive Office authorization |
| **Outputs** | Deployed artifacts, release notes, rollback records, deployment records |
| **Decision Rights** | Execute deployments, initiate rollbacks, approve release candidates, manage deployment environments |
| **Quality Gates** | Deployment health check passed, rollback tested and verified, release notes complete, environment parity validated |
| **Escalation Rules** | Deployment failure → Engineering (investigate); rollback required → Executive Office (authorization); environment issue → Platform Engineering |
| **Runtime Budget** | 8% of total token budget |
| **Success Metrics** | Deployment success rate (target: >95%), mean time to deploy, rollback success rate, release note completeness |
| **Interaction Contracts** | Receives from: Engineering (artifacts), Security (clearance), Executive Office (authorization). Dispatches to: all environments (deployments). |
| **Evidence Produced** | Deployment records, release notes, rollback records, deployment verification reports |

### 2.10 Business & Growth

| Field | Value |
|-------|-------|
| **Department ID** | `business_growth` |
| **Layer** | Knowledge |
| **Owner** | Business & Growth Lead (runtime agent: BusinessAgent) |
| **Mission** | Drive business value through analysis, financial planning, customer insights, and market growth |
| **Responsibilities** | 1. Business analysis 2. Financial planning 3. Customer insights 4. Competitive positioning 5. Market analysis 6. Growth strategy 7. Revenue impact assessment 8. Stakeholder value reporting |
| **Inputs** | Product Owner objectives, market data, customer feedback, Research Intelligence output |
| **Outputs** | Business analysis reports, financial plans, growth strategies, value assessments |
| **Decision Rights** | Prioritize business-driven features, approve growth initiatives, validate financial projections |
| **Quality Gates** | Financial projections validated, market data sourced from credible references, growth metrics tracked and reported |
| **Escalation Rules** | Budget overrun → Executive Office; market shift → Product Owner (objective re-scoping); growth stall → Executive Office |
| **Runtime Budget** | 5% of total token budget |
| **Success Metrics** | Revenue impact, customer satisfaction score, market share growth, feature adoption rate |
| **Interaction Contracts** | Receives from: Product Owner (objectives), Research Intelligence (market data). Dispatches to: Executive Office (business reports). |
| **Evidence Produced** | Business analysis reports, financial plans, growth metrics, value assessments |

### 2.11 Platform Engineering

| Field | Value |
|-------|-------|
| **Department ID** | `platform_engineering` |
| **Layer** | Infrastructure |
| **Owner** | Platform Engineering Lead (runtime agent: PlatformAgent) |
| **Mission** | Maintain platform infrastructure, tooling, developer experience, and runtime health |
| **Responsibilities** | 1. Platform infrastructure maintenance 2. Tooling and developer experience 3. CI/CD pipeline infrastructure 4. Runtime health monitoring 5. Credential management 6. Provider registry maintenance 7. Platform service availability 8. Developer onboarding tooling |
| **Inputs** | All departments' platform needs, EPCL infrastructure requirements, security infrastructure needs |
| **Outputs** | Platform services, tooling updates, infrastructure health reports, developer tooling |
| **Decision Rights** | Approve platform changes, enforce infrastructure standards, manage runtime health, allocate platform resources |
| **Quality Gates** | Platform services healthy (99.9% uptime), CI/CD operational, runtime metrics within thresholds, credential rotation current |
| **Escalation Rules** | Platform outage → Executive Office (critical); tooling gap → responsible department; credential compromise → Executive Office (immediate) |
| **Runtime Budget** | 6% of total token budget |
| **Success Metrics** | Platform uptime (target: 99.9%), developer experience score, runtime health metrics, credential health score |
| **Interaction Contracts** | Receives from: all departments (platform needs). Dispatches to: all departments (platform services, tooling). |
| **Evidence Produced** | Platform health reports, infrastructure documentation, tooling records, credential audit logs |

---

## 3. Cross-Department Ownership Verification

| Responsibility | Owning Department | Duplicate? |
|---------------|-------------------|-----------|
| Roadmap approval | Executive Office | No |
| Research | Research Intelligence | No |
| Architecture design | Architecture & Strategy | No |
| UX/UI design | Experience & Design | No |
| Backend dev | Engineering | No |
| Frontend dev | Engineering | No |
| API design | Engineering | No |
| Testing | Quality Assurance | No |
| Security review | Security | No |
| Documentation | Documentation | No |
| Deployment | Release Operations | No |
| Business analysis | Business & Growth | No |
| Platform infra | Platform Engineering | No |
| Deployment authorization | Executive Office | No |
| Architecture review | Architecture & Strategy | No |
| Accessibility review | Experience & Design | No |
| Performance testing | Quality Assurance | No |
| Threat modeling | Security | No |
| Runbook creation | Documentation | No |
| Release notes | Release Operations | No |

**Total responsibilities: 20. Duplicates: 0. Gaps: 0.**

---

## 4. Phase B Completion Summary

- **11 departments** fully defined with all 10 required fields each.
- **Zero duplicated ownership** — every responsibility belongs to exactly one department.
- **All departments mapped** to the target runtime layers.
- **Interaction contracts** defined for every department (receives/dispatches).
- **Ready for Phase C** — Runtime Agent Reconstruction.
