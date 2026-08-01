# AGENT_REGISTRY.md

**EPIC-010 — Organizational Runtime Activation**
**Phase D: Agent Model**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform

---

## Agent Registry

Every agent belongs to exactly ONE department.

### Research Intelligence

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| research-agent | Gather market and industry research | Research objective, budget | research.md, evidence.json | arxiv, blogwatcher, llm-wiki, polymarket, web-search | market-research, evidence-gathering | On roadmap research phase | Active → Complete → Archive | Research outputs validated against evidence |
| evidence-agent | Compile and validate evidence | Research outputs | evidence.json | web-search, terminal | evidence-compilation, validation | On roadmap research phase | Active → Complete → Archive | Evidence JSON schema validated |
| competitive-analysis-agent | Analyze competitor products and positioning | Market objective, competitor list | competitive-analysis.md | web-search, research | competitive-analysis, market-intelligence | On roadmap competitive analysis phase | Active → Complete → Archive | Analysis validated against sources |

### Experience & Design

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| ux-research-agent | Conduct UX research and user analysis | UX objective, user data | ux-research.md | design-md, claude-design | ux-research, user-analysis | On roadmap UX phase | Active → Complete → Archive | Research validated against user needs |
| ux-designer | Create wireframes and design specs | UX research, design system | wireframes.md, design-spec.md | design-md, sketch, claude-design | wireframing, design-specification | On roadmap design phase | Active → Complete → Archive | Design spec validated against research |
| accessibility-agent | Ensure accessibility compliance | Design spec, accessibility standards | accessibility-report.md | design-md | accessibility-check, a11y-validation | On roadmap accessibility phase | Active → Complete → Archive | WCAG checks pass; report generated |
| design-system-agent | Enforce design system consistency | Design spec, component library | design-system-report.md | design-md, claude-design | design-system-enforcement, consistency-check | On roadmap design phase | Active → Complete → Archive | Design system consistency validated |

### Engineering

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| backend-agent | Implement backend services and APIs | Architecture spec, API contract | implementation-report.md, build-report.md | feature-milestone-execution, hermes-platform-service, python-debugpy, node-inspect-debugger, requesting-code-review, simplify-code, spike, systematic-debugging, test-driven-development, enforcement-guard-integration | backend-development, api-development | On roadmap implementation phase | Active → Complete → Archive | Build passes; typecheck clean; tests pass |
| frontend-agent | Implement frontend UI and components | Design spec, API contract | implementation-report.md, build-report.md | feature-milestone-execution, hermes-platform-service, requesting-code-review, simplify-code, spike, systematic-debugging, test-driven-development | frontend-development, ui-implementation | On roadmap implementation phase | Active → Complete → Archive | Build passes; typecheck clean; tests pass |
| api-agent | Design and implement API endpoints | Architecture spec, backend implementation | implementation-report.md, build-report.md | feature-milestone-execution, hermes-platform-service, requesting-code-review, simplify-code, spike, systematic-debugging, test-driven-development | api-development, endpoint-design | On roadmap API phase | Active → Complete → Archive | API endpoints functional; contracts validated |
| cloudflare-agent | Deploy and manage Cloudflare Workers | Deployment config, build artifact | release-report.md | deploy-website, webops, concierge-production-deployment, openrouter-model-config, hermes-execution-gateway | cloudflare-deployment, workers-management | On roadmap release phase | Active → Complete → Archive | Deployment successful; routes functional |

### Quality Assurance

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| functional-qa | Execute functional tests | Implementation, test plan | functional-report.md | acceptance-audit, release-certification-audit | functional-testing, test-execution | After Engineering completes | Active → Complete → Archive | All functional tests pass |
| regression-qa | Execute regression tests | Implementation, test plan | regression-report.md | acceptance-audit, release-certification-audit | regression-testing, test-execution | After Engineering completes | Active → Complete → Archive | All regression tests pass |
| browser-qa | Execute browser compatibility tests | Implementation, browser matrix | browser-report.md | acceptance-audit | browser-testing, compatibility-check | After Engineering completes | Active → Complete → Archive | All browsers pass |
| performance-qa | Execute performance tests | Implementation, performance criteria | performance-report.md | acceptance-audit | performance-testing, benchmarks | After Engineering completes | Active → Complete → Archive | Performance within thresholds |

### Documentation

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| technical-writer | Produce and update technical documentation | Implementation, design spec | doc-updates.md | governance-dashboard, post-wave-reporting | doc-generation, architecture-doc, product-doc | After QA passes | Active → Complete → Archive | Documentation reflects current state |

### Release Operations

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| deployment-agent | Build artifacts and prepare deployment | Build artifact, deployment config | release-report.md | deploy-website, webops, concierge-production-deployment, openrouter-model-config, hermes-execution-gateway | build, import-validation, route-validation, deployment-prep | After Documentation completes | Active → Complete → Archive | Build artifact valid; routes functional |

### Verification

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| verification-agent | Perform comprehensive verification of all deliverables | All department outputs | verification-report.md | acceptance-audit, architecture-freeze-review, autonomous-execution-certification, platform-baseline-freeze, release-certification-audit, secret-remediation, trust-verification-audit | repository-verification, architecture-verification, ux-verification, accessibility-verification, performance-verification, responsive-verification, build-verification, test-verification, deployment-verification | After Release Operations completes | Active → Complete → Archive | All verification checks pass; certification granted |

### Knowledge Management

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| knowledge-capture-agent | Capture lessons learned and organizational knowledge | Verification report, all artifacts | knowledge-capture.md | phe-reflection-engine | knowledge-capture, lessons-learned, pattern-extraction | After Verification completes | Active → Complete → Archive | Lessons documented; patterns captured |

### Business & Growth

| Agent ID | Purpose | Inputs | Outputs | Skills | Capabilities | Activation Policy | Lifecycle | Verification |
|----------|---------|--------|---------|--------|-------------|-------------------|-----------|-------------|
| product-strategy-agent | Define product strategy and roadmap priorities | Business objective, market data | strategy-report.md | (to be defined) | product-strategy, roadmap-prioritization | On roadmap business strategy phase | Active → Complete → Archive | Strategy aligned with roadmap |
| seo-agent | Optimize SEO and content discoverability | Content, analytics data | seo-report.md | (to be defined) | seo-audit, content-optimization | On roadmap SEO phase | Active → Complete → Archive | SEO audit current; recommendations actionable |
| analytics-agent | Set up and maintain analytics tracking | Analytics plan, tracking requirements | analytics-plan.md | (to be defined) | analytics-setup, tracking-implementation | On roadmap analytics phase | Active → Complete → Archive | Analytics plan actionable; tracking implemented |

---

## Agent Summary

| Department | Agent Count |
|-----------|-------------|
| Research Intelligence | 3 |
| Experience & Design | 4 |
| Engineering | 4 |
| Quality Assurance | 4 |
| Documentation | 1 |
| Release Operations | 1 |
| Verification | 1 |
| Knowledge Management | 1 |
| Business & Growth | 3 |
| **Total** | **22** |

---

*End of Agent Registry*
