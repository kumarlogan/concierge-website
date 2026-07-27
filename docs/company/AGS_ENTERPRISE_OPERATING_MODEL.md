# AGS Enterprise Operating Model

> **Defines how AGS operates as an enterprise organization.**
> Establishes the permanent hierarchy, governance framework, and
> operating principles that span all business units, platforms, products,
> and workforces.
>
> **Version:** 1.0.0
> **Last Updated:** 2026-07-27
> **Framework:** WEF v1.1 (AGS Enterprise Execution Framework)

---

## Governance Header

```
Company:        AGS
Business Unit:  Executive Office
Document:       Enterprise Operating Model
Framework:      WEF v1.1
```

---

## 1. Enterprise Hierarchy

AGS operates with a consistent, permanent hierarchy that applies across all
business units, platforms, and products:

```
AGS (Company)
  │
  ├── Business Unit
  │     │
  │     ├── Platform
  │     │     │
  │     │     ├── Product
  │     │     │     │
  │     │     │     ├── Portfolio
  │     │     │     │     │
  │     │     │     │     ├── Roadmap
  │     │     │     │     │     │
  │     │     │     │     │     ├── Phase
  │     │     │     │     │     │     │
  │     │     │     │     │     │     ├── Wave
  │     │     │     │     │     │     │     │
  │     │     │     │     │     │     │     ├── Epic
  │     │     │     │     │     │     │     │     │
  │     │     │     │     │     │     │     │     ├── Sprint
  │     │     │     │     │     │     │     │     │     │
  │     │     │     │     │     │     │     │     │     ├── Story
  │     │     │     │     │     │     │     │     │     │     │
  │     │     │     │     │     │     │     │     │     │     ├── Task
```

### Hierarchy Rules

| Rule | Description |
|------|-------------|
| **Company owns Business Units** | Every business unit reports to AGS. No business unit is self-owned. |
| **Business Units own Platforms** | A business unit may own one or more platforms. Platforms are never shared across business units. |
| **Platforms serve Products** | Products consume platform capabilities. Platforms never own products. |
| **Products own Portfolios** | A product may have one or more portfolios (e.g., clinical, operational, commercial). |
| **Portfolios own Roadmaps** | Each portfolio has its own roadmap. Roadmaps are never shared across portfolios. |
| **Roadmaps own Phases** | Phases are sequential, numbered milestones within a roadmap. |
| **Phases own Waves** | Waves are implementation units within a phase. |
| **Waves own Epics** | Epics are large feature groups within a wave. |
| **Epics own Sprints** | Sprints are time-boxed delivery cycles within an epic. |
| **Sprints own Stories** | Stories are user- or system-visible features within a sprint. |
| **Stories own Tasks** | Tasks are the smallest unit of work. |

---

## 2. Company Identity

| Attribute | Value |
|-----------|-------|
| **Legal Name** | AGS |
| **Type** | Private company |
| **Industry** | Healthcare / Fertility Services |
| **Primary Registry** | PSER — Project State & Execution Registry |
| **Execution Framework** | WEF v1.1 — AGS Enterprise Execution Framework |
| **Governance Standard** | GOV-004 (Governance Freeze) |

### Company Responsibilities

- Define the enterprise hierarchy and ensure it is consistently applied
- Own the company-level execution registry (PSER)
- Own the enterprise execution framework (WEF)
- Set company-wide policies, standards, and compliance requirements
- Appoint business unit leaders
- Maintain the enterprise governance dashboard

---

## 3. Enterprise Execution Framework (WEF v1.1)

WEF is now the **AGS Enterprise Execution Framework** — not just an engineering
framework. All workforces across all business units execute work through WEF.

### WEF v1.1 Principles

| Principle | Description |
|-----------|-------------|
| **Human Approval** | Every execution gate requires human operator approval. No autonomous execution across critical gates. |
| **Observability** | All execution is observable. Dashboards, logs, and metrics are mandatory. |
| **Auditability** | Every decision, approval, and action is recorded in the audit trail. |
| **Fail Closed** | When a gate cannot evaluate, it denies. Safety is the default. |
| **Platform First** | Reusable platform capabilities are preferred over product-specific solutions. |
| **Workforce Agnostic** | The same gates apply to every workforce — Engineering, Marketing, Sales, Operations, etc. |

### WEF Phases

| Phase | Name | Description |
|-------|------|-------------|
| 0 | Preparation | Read current state, understand requirements |
| 1 | Platform First Review | Verify platform capabilities before building product-specific |
| 2 | Execution Plan | Create the execution plan with deliverables and gates |
| 3 | Implementation | Execute the work |
| 4 | Quality Gates | Verify quality, security, and completeness |
| 5 | Documentation | Update governance, dashboards, and documentation |
| 6 | Operator Review | Present results for human operator approval |
| 7 | PSER Update | Record resume point in PSER |

---

## 4. Enterprise Governance

### Governance Documents

| Document | Location | Purpose |
|----------|----------|---------|
| Enterprise Operating Model | `docs/company/AGS_ENTERPRISE_OPERATING_MODEL.md` | This document |
| Business Unit Model | `docs/company/BUSINESS_UNIT_MODEL.md` | Business unit definitions |
| Enterprise Workforce Model | `docs/company/ENTERPRISE_WORKFORCE_MODEL.md` | Workforce categories and authority |
| Enterprise Platform Model | `docs/company/ENTERPRISE_PLATFORM_MODEL.md` | Platform definitions |
| Program Status | `docs/governance/PROGRAM_STATUS.md` | Executive dashboard |
| AI Platform Status | `docs/governance/AI_PLATFORM_STATUS.md` | Platform capabilities |
| Product Status | `docs/products/concierge/PRODUCT_STATUS.md` | Product health |
| PSER Execution State | `docs/platform/project-state-registry/PSER_EXECUTION_STATE.md` | Resume points |

### Governance Synchronization

Every epic completion must update:
1. PROGRAM_STATUS.md — company-level dashboard
2. AI_PLATFORM_STATUS.md — platform capabilities (if applicable)
3. PRODUCT_STATUS.md — product health (if applicable)
4. CURRENT_SPRINT.md — sprint tracking
5. CHANGELOG.md — release history
6. DECISION_LOG.md — decisions
7. GOVERNANCE_INDEX.md — document index
8. PSER — resume point

---

## 5. PSER Scope

PSER now tracks the full enterprise hierarchy:

| Field | Description |
|-------|-------------|
| Company | AGS |
| Business Unit | The business unit owning the execution |
| Platform | The platform(s) involved |
| Product | The product(s) affected |
| Portfolio | The portfolio within the product |
| Roadmap | The roadmap under execution |
| Phase | The current phase |
| Wave | The current wave |
| Epic | The current epic |
| Sprint | The current sprint |
| Story | The current story |
| Task | Individual tasks |

---

## 6. Enterprise Decision Hierarchy

| Level | Authority | Scope |
|-------|-----------|-------|
| Company | AGS Executive | Enterprise-wide strategy, policy, compliance |
| Business Unit | Business Unit Lead | Unit strategy, resource allocation, OKRs |
| Platform | Platform Owner | Platform capability roadmap, SLAs |
| Product | Product Owner | Product roadmap, feature prioritization |
| Portfolio | Portfolio Manager | Portfolio scope, dependencies |
| Roadmap | Product Manager | Phase sequencing, milestone targets |
| Phase | Phase Lead | Phase scope, wave planning |
| Wave | Wave Lead | Wave scope, epic planning |
| Epic | Tech Lead | Epic scope, sprint planning |
| Sprint | Scrum Master | Sprint execution, daily standup |
| Story | Developer | Story implementation |
| Task | Assignee | Task completion |

---

## 7. Adoption Path

### Current State

AGS currently operates as an engineering-centric organization with:
- **1 Business Unit:** Engineering (implicit)
- **1 Platform:** AI Platform
- **1 Product:** Concierge
- **1 Portfolio:** Clinical (default)

### Transition

The enterprise operating model is adopted immediately. Future business units,
platforms, and products slot into the hierarchy without restructuring.

### Enterprise Readiness

| Criterion | Status | Notes |
|-----------|--------|-------|
| Enterprise hierarchy defined | ✅ Complete | This document |
| Business unit model created | ✅ Complete | BUSINESS_UNIT_MODEL.md |
| Workforce model created | ✅ Complete | ENTERPRISE_WORKFORCE_MODEL.md |
| Platform model created | ✅ Complete | ENTERPRISE_PLATFORM_MODEL.md |
| WEF expanded to enterprise | ✅ Complete | WEF v1.1 — enterprise-wide |
| PSER expanded to enterprise | ✅ Complete | Full hierarchy tracked |
| Naming standards updated | ✅ Complete | NAMING_STANDARDS.md updated |
| All governance docs synchronized | ⚠️ In progress | 11 files being updated |
| ADR created | ✅ Complete | Enterprise Operating Model ADR |

---

*AGS Enterprise Operating Model — v1.0.0*
*Last updated: 2026-07-27*
*Framework: WEF v1.1*