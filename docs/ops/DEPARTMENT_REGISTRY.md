# DEPARTMENT_REGISTRY.md

**EPIC-010 — Organizational Runtime Activation**
**Phase C: Department Model**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform

---

## Canonical Department Registry

### 1. Executive Office

| Field | Value |
|-------|-------|
| **Purpose** | Orchestrate the entire product delivery lifecycle; approve objectives, allocate budget, track utilization, and make go/no-go decisions |
| **Activation Policy** | Activated on every roadmap wave entry; approves EPCL execution plan before any department activation |
| **Entry Criteria** | Roadmap wave objective approved; budget allocated; PO sign-off |
| **Exit Criteria** | All departments completed; executive report generated; PO decision received |
| **Skills** | governance, planning, reporting |
| **Capabilities** | orchestration, budget-tracking, approval-gate |
| **Artifacts** | executive-summary.md, approval-decision.md |
| **Verification** | All departments completed; all artifacts produced; PO decision recorded |
| **Budget** | Standard wave execution budget |

### 2. Research Intelligence

| Field | Value |
|-------|-------|
| **Purpose** | Gather market intelligence, industry standards, competitor analysis, and user research to inform product decisions |
| **Activation Policy** | Activated when roadmap requires market research, competitive analysis, or user research |
| **Entry Criteria** | Research objective defined; budget allocated |
| **Exit Criteria** | research.md produced; evidence.json compiled; competitive-analysis.md delivered |
| **Skills** | arxiv, blogwatcher, llm-wiki, polymarket, web-search |
| **Capabilities** | market-research, competitive-analysis, user-research, evidence-gathering |
| **Artifacts** | research.md, evidence.json, competitive-analysis.md |
| **Verification** | Research outputs validated against evidence; competitor analysis current |
| **Budget** | Standard research budget |

### 3. Architecture & Strategy

| Field | Value |
|-------|-------|
| **Purpose** | Validate platform architecture, ensure reuse, define component boundaries, and assess technical feasibility |
| **Activation Policy** | Activated when roadmap requires architecture validation or technical strategy |
| **Entry Criteria** | Architecture review requested; existing platform state documented |
| **Exit Criteria** | Architecture validation report produced; component boundaries defined; feasibility assessed |
| **Skills** | platform-capability-design, architecture-freeze-review, acceptance-audit |
| **Capabilities** | architecture-validation, component-boundary-analysis, feasibility-assessment |
| **Artifacts** | architecture-update.md, implementation-report.md |
| **Verification** | Architecture decisions documented; component boundaries validated |
| **Budget** | Standard architecture budget |

### 4. Experience & Design

| Field | Value |
|-------|-------|
| **Purpose** | Design user experience, ensure accessibility, create responsive layouts, and maintain design system consistency |
| **Activation Policy** | Activated when roadmap requires UX work, design changes, or accessibility improvements |
| **Entry Criteria** | UX requirements defined; design system reference available |
| **Exit Criteria** | UX research complete; wireframes produced; design spec delivered; accessibility report generated |
| **Skills** | design-md, claude-design, sketch, pretext |
| **Capabilities** | ux-design, accessibility, responsive-design, design-system |
| **Artifacts** | ux-research.md, wireframes.md, design-spec.md, accessibility-report.md |
| **Verification** | Accessibility checks pass; design system consistency validated; responsive verified |
| **Budget** | Standard UX budget |

### 5. Engineering

| Field | Value |
|-------|-------|
| **Purpose** | Implement product features, fix integration issues, and produce production-ready code |
| **Activation Policy** | Activated when roadmap requires feature implementation or code changes |
| **Entry Criteria** | Architecture validated; design spec approved; implementation plan defined |
| **Exit Criteria** | Code implemented; tests passing; build clean; typecheck clean |
| **Skills** | feature-milestone-execution, hermes-platform-service, hermes-gateway-extension, python-debugpy, node-inspect-debugger, requesting-code-review, simplify-code, spike, systematic-debugging, test-driven-development, enforcement-guard-integration |
| **Capabilities** | backend-development, frontend-development, api-development, cloudflare-workers, integration-fix |
| **Artifacts** | implementation-report.md, build-report.md |
| **Verification** | Build passes; typecheck clean; tests pass; integration verified |
| **Budget** | Standard engineering budget |

### 6. Quality Assurance

| Field | Value |
|-------|-------|
| **Purpose** | Verify product quality through functional, regression, browser, and performance testing |
| **Activation Policy** | Activated after Engineering completes; before Verification |
| **Entry Criteria** | Implementation complete; build passes |
| **Exit Criteria** | Test evidence produced; pass/fail recorded; quality gate passed |
| **Skills** | acceptance-audit, architecture-freeze-review, release-certification-audit, secret-remediation, trust-verification-audit |
| **Capabilities** | functional-testing, regression-testing, browser-testing, performance-testing |
| **Artifacts** | functional-report.md, regression-report.md, browser-report.md, performance-report.md |
| **Verification** | All test categories pass; quality gates met |
| **Budget** | Standard QA budget |

### 7. Documentation

| Field | Value |
|-------|-------|
| **Purpose** | Update architecture docs, product docs, technical docs, and decision records |
| **Activation Policy** | Activated after QA passes; before Knowledge Capture |
| **Entry Criteria** | Implementation verified; test evidence recorded |
| **Exit Criteria** | All affected documentation updated; accuracy verified |
| **Skills** | governance-dashboard, post-wave-reporting |
| **Capabilities** | doc-update, architecture-doc, product-doc, technical-doc |
| **Artifacts** | doc-updates.md |
| **Verification** | Documentation reflects current state; no stale references |
| **Budget** | Standard documentation budget |

### 8. Release Operations

| Field | Value |
|-------|-------|
| **Purpose** | Build, test imports, validate routes, and prepare deployment artifacts |
| **Activation Policy** | Activated after Documentation completes; before Verification |
| **Entry Criteria** | Code implemented; docs updated; build passes |
| **Exit Criteria** | Build artifact ready; deployment checklist complete; route validation passed |
| **Skills** | deploy-website, webops, concierge-production-deployment, openrouter-model-config, hermes-execution-gateway |
| **Capabilities** | build, import-validation, route-validation, deployment-prep |
| **Artifacts** | release-report.md |
| **Verification** | Build artifact valid; routes functional; deployment ready |
| **Budget** | Standard release budget |

### 9. Verification

| Field | Value |
|-------|-------|
| **Purpose** | Perform comprehensive verification of all deliverables across all dimensions |
| **Activation Policy** | Activated after Release Operations completes; before Knowledge Capture |
| **Entry Criteria** | All implementation complete; build passes; tests pass |
| **Exit Criteria** | Verification report produced; all checks passed; certification granted |
| **Skills** | acceptance-audit, architecture-freeze-review, autonomous-execution-certification, platform-baseline-freeze, release-certification-audit, secret-remediation, trust-verification-audit |
| **Capabilities** | repository-verification, architecture-verification, ux-verification, accessibility-verification, performance-verification, responsive-verification, build-verification, test-verification, deployment-verification |
| **Artifacts** | verification-report.md |
| **Verification** | All verification checks pass; certification granted |
| **Budget** | Standard verification budget |

### 10. Knowledge Management

| Field | Value |
|-------|-------|
| **Purpose** | Capture lessons learned, research findings, UX decisions, and architecture decisions for organizational memory |
| **Activation Policy** | Activated after Verification completes; before Executive Reporting |
| **Entry Criteria** | Verification complete; all artifacts produced |
| **Exit Criteria** | Knowledge capture report produced; lessons documented |
| **Skills** | phe-reflection-engine |
| **Capabilities** | knowledge-capture, lessons-learned, pattern-extraction |
| **Artifacts** | knowledge-capture.md |
| **Verification** | Lessons documented; patterns captured; knowledge stored |
| **Budget** | Standard knowledge budget |

### 11. Business & Growth

| Field | Value |
|-------|-------|
| **Purpose** | Product strategy, SEO optimization, analytics tracking, and business growth initiatives |
| **Activation Policy** | Activated when roadmap requires business strategy, SEO, or analytics work |
| **Entry Criteria** | Business objective defined; strategy scope approved |
| **Exit Criteria** | Strategy report produced; SEO audit complete; analytics plan documented |
| **Skills** | (to be defined based on business requirements) |
| **Capabilities** | product-strategy, seo, analytics |
| **Artifacts** | strategy-report.md, seo-report.md, analytics-plan.md |
| **Verification** | Strategy aligned with roadmap; SEO audit current; analytics plan actionable |
| **Budget** | Standard business budget |

---

## Department Activation Sequence (Wave 3 Observed)

```
Executive Office (approve)
↓
EPCL (plan)
↓
Research Intelligence
↓
Architecture & Strategy
↓
Experience & Design
↓
Engineering
↓
Quality Assurance
↓
Release Operations
↓
Verification
↓
Documentation
↓
Knowledge Management
↓
Executive Office (report)
↓
WAIT
```

---

*End of Department Registry*
