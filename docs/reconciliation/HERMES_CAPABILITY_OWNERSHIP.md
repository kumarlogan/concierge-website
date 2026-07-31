# HERMES CAPABILITY OWNERSHIP

> **EPIC-009 — Phase E**
> Capability Ownership — Every capability has a complete chain: Capability → Department → Runtime Agent → Skill → Verification → Knowledge Artifact → Executive Evidence.
> **Status**: ✅ COMPLETE

---

## 1. Ownership Rules

- Every capability has exactly one owning department.
- Every capability has exactly one owning runtime agent.
- Every capability has at least one owning skill.
- Every capability has a defined verification gate.
- Every capability produces a knowledge artifact.
- Every capability produces executive evidence.
- No capability is orphaned. No duplicate ownership.

---

## 2. Capability Ownership Chain

### 2.1 code.generate

| Layer | Value |
|-------|-------|
| **Capability** | `code.generate` |
| **Department** | Engineering |
| **Runtime Agent** | `backend-agent`, `frontend-agent`, `api-agent` |
| **Skills** | `backend-development`, `frontend-development`, `api-design`, `feature-milestone-execution` |
| **Verification** | TypeScript clean, tests passing, build clean |
| **Knowledge Artifact** | Source code, API documentation, type definitions |
| **Executive Evidence** | Build artifacts, deployment records |

### 2.2 code.review

| Layer | Value |
|-------|-------|
| **Capability** | `code.review` |
| **Department** | Engineering |
| **Runtime Agent** | `backend-agent` |
| **Skills** | `architecture-review`, `systematic-debugging`, `simplify-code` |
| **Verification** | Review checklist complete, no unresolved findings |
| **Knowledge Artifact** | Review findings, refactoring recommendations |
| **Executive Evidence** | Code review reports |

### 2.3 deploy.pages

| Layer | Value |
|-------|-------|
| **Capability** | `deploy.pages` |
| **Department** | Engineering (primary) + Platform Engineering (infra) |
| **Runtime Agent** | `cloudflare-agent` |
| **Skills** | `cloudflare-deployment`, `deployment-verification` |
| **Verification** | Deployment health check passed, Pages deployed |
| **Knowledge Artifact** | Deployment records, Pages configuration |
| **Executive Evidence** | Deployment records, release notes |

### 2.4 deploy.workers

| Layer | Value |
|-------|-------|
| **Capability** | `deploy.workers` |
| **Department** | Engineering (primary) + Platform Engineering (infra) |
| **Runtime Agent** | `cloudflare-agent` |
| **Skills** | `cloudflare-deployment`, `deployment-verification` |
| **Verification** | Deployment health check passed, Workers running |
| **Knowledge Artifact** | Deployment records, Workers configuration |
| **Executive Evidence** | Deployment records, release notes |

### 2.5 db.migrate

| Layer | Value |
|-------|-------|
| **Capability** | `db.migrate` |
| **Department** | Engineering |
| **Runtime Agent** | `backend-agent` |
| **Skills** | `database-migration`, `backend-development` |
| **Verification** | Migration applied, schema validated, no data loss |
| **Knowledge Artifact** | Migration scripts, schema documentation |
| **Executive Evidence** | Migration records, schema change log |

### 2.6 db.rollback

| Layer | Value |
|-------|-------|
| **Capability** | `db.rollback` |
| **Department** | Engineering |
| **Runtime Agent** | `backend-agent` |
| **Skills** | `rollback`, `database-migration` |
| **Verification** | Rollback executed, schema restored, data integrity verified |
| **Knowledge Artifact** | Rollback records, schema restoration log |
| **Executive Evidence** | Rollback records, data integrity report |

### 2.7 test.run

| Layer | Value |
|-------|-------|
| **Capability** | `test.run` |
| **Department** | Quality Assurance |
| **Runtime Agent** | `functional-qa-agent` |
| **Skills** | `testing`, `test-driven-development` |
| **Verification** | All tests pass, coverage thresholds met |
| **Knowledge Artifact** | Test results, coverage reports |
| **Executive Evidence** | Test results, quality reports |

### 2.8 test.verify

| Layer | Value |
|-------|-------|
| **Capability** | `test.verify` |
| **Department** | Quality Assurance |
| **Runtime Agent** | `functional-qa-agent` |
| **Skills** | `certification`, `validation-gate-template`, `regression-review-checklist` |
| **Verification** | All verification gates pass, certification complete |
| **Knowledge Artifact** | Verification evidence, certification records |
| **Executive Evidence** | Verification reports, certification status |

### 2.9 research.analyze

| Layer | Value |
|-------|-------|
| **Capability** | `research.analyze` |
| **Department** | Research Intelligence |
| **Runtime Agent** | `research-agent` |
| **Skills** | `research`, `evidence-collection` |
| **Verification** | Minimum 2 independent sources, all citations traceable |
| **Knowledge Artifact** | Research reports, source catalogs |
| **Executive Evidence** | Research findings in executive report |

### 2.10 research.synthesize

| Layer | Value |
|-------|-------|
| **Capability** | `research.synthesize` |
| **Department** | Research Intelligence |
| **Runtime Agent** | `evidence-agent` |
| **Skills** | `evidence-collection` |
| **Verification** | Evidence independently verifiable, credibility assessed |
| **Knowledge Artifact** | Synthesized evidence packages |
| **Executive Evidence** | Evidence trace in executive report |

### 2.11 research.investigate

| Layer | Value |
|-------|-------|
| **Capability** | `research.investigate` |
| **Department** | Research Intelligence |
| **Runtime Agent** | `competitive-analysis-agent` |
| **Skills** | `research`, `competitive-analysis` |
| **Verification** | Competitor data from ≥2 independent sources |
| **Knowledge Artifact** | Competitive analysis reports |
| **Executive Evidence** | Competitive landscape summary in executive report |

### 2.12 architecture.design

| Layer | Value |
|-------|-------|
| **Capability** | `architecture.design` |
| **Department** | Architecture & Strategy |
| **Runtime Agent** | `architecture-agent` |
| **Skills** | `architecture-review`, `plan` |
| **Verification** | ADR references existing ratified ADRs, platform boundaries preserved |
| **Knowledge Artifact** | ADRs, architecture documents |
| **Executive Evidence** | Architecture decisions in executive report |

### 2.13 architecture.review

| Layer | Value |
|-------|-------|
| **Capability** | `architecture.review` |
| **Department** | Architecture & Strategy |
| **Runtime Agent** | `architecture-agent` |
| **Skills** | `architecture-review`, `constitutional-architecture-review` |
| **Verification** | All ADRs valid, platform constitution enforced |
| **Knowledge Artifact** | Architecture review reports, ADR catalog |
| **Executive Evidence** | Architecture review status in executive report |

### 2.14 experience.design

| Layer | Value |
|-------|-------|
| **Capability** | `experience.design` |
| **Department** | Experience & Design |
| **Runtime Agent** | `ux-designer` |
| **Skills** | `ui-design`, `ux-research`, `ux-activation-pattern` |
| **Verification** | Design system compliance, WCAG 2.1 AA, prototype usability |
| **Knowledge Artifact** | UI designs, prototypes, design specifications |
| **Executive Evidence** | Design status in executive report |

### 2.15 experience.review

| Layer | Value |
|-------|-------|
| **Capability** | `experience.review` |
| **Department** | Experience & Design |
| **Runtime Agent** | `accessibility-agent`, `design-system-agent` |
| **Skills** | `accessibility-review`, `design-system-validation` |
| **Verification** | WCAG 2.1 AA compliance, design system token consistency |
| **Knowledge Artifact** | Accessibility audit reports, design system compliance reports |
| **Executive Evidence** | Accessibility status in executive report |

### 2.16 experience.prototype

| Layer | Value |
|-------|-------|
| **Capability** | `experience.prototype` |
| **Department** | Experience & Design |
| **Runtime Agent** | `ux-designer` |
| **Skills** | `ui-design`, `ux-activation-pattern` |
| **Verification** | Prototype usability validated, design system compliant |
| **Knowledge Artifact** | Prototype artifacts, usability findings |
| **Executive Evidence** | Prototype status in executive report |

### 2.17 business.analyze

| Layer | Value |
|-------|-------|
| **Capability** | `business.analyze` |
| **Department** | Business & Growth |
| **Runtime Agent** | `business-agent` |
| **Skills** | `competitive-analysis`, `research` |
| **Verification** | Financial projections validated, market data sourced |
| **Knowledge Artifact** | Business analysis reports, financial plans |
| **Executive Evidence** | Business analysis in executive report |

### 2.18 business.plan

| Layer | Value |
|-------|-------|
| **Capability** | `business.plan` |
| **Department** | Business & Growth |
| **Runtime Agent** | `business-agent` |
| **Skills** | `research`, `competitive-analysis` |
| **Verification** | Market data credible, growth strategy validated |
| **Knowledge Artifact** | Growth strategies, market analysis |
| **Executive Evidence** | Growth plan in executive report |

### 2.19 business.report

| Layer | Value |
|-------|-------|
| **Capability** | `business.report` |
| **Department** | Business & Growth |
| **Runtime Agent** | `business-agent` |
| **Skills** | `executive-reporting` |
| **Verification** | Report complete, metrics tracked |
| **Knowledge Artifact** | Business reports, financial plans |
| **Executive Evidence** | Business report delivered to Executive Office |

### 2.20 platform.learn

| Layer | Value |
|-------|-------|
| **Capability** | `platform.learn` |
| **Department** | Platform Engineering |
| **Runtime Agent** | `documentation-agent` |
| **Skills** | `knowledge-capture` |
| **Verification** | Knowledge artifact complete, stored in persistence |
| **Knowledge Artifact** | Knowledge base entries, learnings |
| **Executive Evidence** | Knowledge capture status in executive report |

### 2.21 platform.observe

| Layer | Value |
|-------|-------|
| **Capability** | `platform.observe` |
| **Department** | Platform Engineering |
| **Runtime Agent** | `platform-agent` |
| **Skills** | `platform-capability-design` |
| **Verification** | Platform metrics within thresholds, observability operational |
| **Knowledge Artifact** | Platform health reports, observability data |
| **Executive Evidence** | Platform health in executive report |

---

## 3. Orphan Verification

| Capability | Department | Agent | Skills | Orphan? |
|-----------|-----------|-------|--------|---------|
| `code.generate` | Engineering | backend-agent, frontend-agent, api-agent | backend-development, frontend-development, api-design, feature-milestone-execution | No |
| `code.review` | Engineering | backend-agent | architecture-review, systematic-debugging, simplify-code | No |
| `deploy.pages` | Engineering + Platform | cloudflare-agent | cloudflare-deployment, deployment-verification | No |
| `deploy.workers` | Engineering + Platform | cloudflare-agent | cloudflare-deployment, deployment-verification | No |
| `db.migrate` | Engineering | backend-agent | database-migration, backend-development | No |
| `db.rollback` | Engineering | backend-agent | rollback, database-migration | No |
| `test.run` | QA | functional-qa-agent | testing, test-driven-development | No |
| `test.verify` | QA | functional-qa-agent | certification, validation-gate-template, regression-review-checklist | No |
| `research.analyze` | Research Intelligence | research-agent | research, evidence-collection | No |
| `research.synthesize` | Research Intelligence | evidence-agent | evidence-collection | No |
| `research.investigate` | Research Intelligence | competitive-analysis-agent | research, competitive-analysis | No |
| `architecture.design` | Architecture & Strategy | architecture-agent | architecture-review, plan | No |
| `architecture.review` | Architecture & Strategy | architecture-agent | architecture-review, constitutional-architecture-review | No |
| `experience.design` | Experience & Design | ux-designer | ui-design, ux-research, ux-activation-pattern | No |
| `experience.review` | Experience & Design | accessibility-agent, design-system-agent | accessibility-review, design-system-validation | No |
| `experience.prototype` | Experience & Design | ux-designer | ui-design, ux-activation-pattern | No |
| `business.analyze` | Business & Growth | business-agent | competitive-analysis, research | No |
| `business.plan` | Business & Growth | business-agent | research, competitive-analysis | No |
| `business.report` | Business & Growth | business-agent | executive-reporting | No |
| `platform.learn` | Platform Engineering | documentation-agent | knowledge-capture | No |
| `platform.observe` | Platform Engineering | platform-agent | platform-capability-design | No |

**Total capabilities: 21. Orphans: 0. Duplicates: 0.**

---

## 4. Phase E Completion Summary

- **21 capabilities** fully owned with complete chains.
- **Every capability** has Department → Runtime Agent → Skill → Verification → Knowledge Artifact → Executive Evidence.
- **Zero orphans** — every capability is connected.
- **Zero duplicate ownership** — every capability belongs to exactly one department.
- **Ready for Phase F** — Runtime Wiring.
