# AG Synergy Platform — Project Constitution

> Version 1.0 | 2026-07-18
>
> This document is the highest-level authority in the AG Synergy Platform repository.
> It defines the vision, engineering principles, technology philosophy, and operating
> rules for the entire project. When any other document conflicts with this one, this
> document governs.

---

## 1. Executive Summary

AG Synergy is a **digital fertility concierge platform** connecting Canadian patients
with carefully selected fertility clinics in India. The platform combines human
support, technology, automation, and trusted healthcare partnerships to simplify and
support international fertility journeys.

The public-facing website is the visible interface of a larger technology-enabled
concierge operation. Behind the website sits a structured platform for patient
management, clinic collaboration, secure document handling, and AI-assisted
operations — all designed to reduce friction, increase transparency, and maintain
the highest standards of care and privacy.

The platform is not a medical device. It does not diagnose, treat, or prescribe. It
is an operational and informational layer that supports the human concierge team,
patients, and partner clinics.

---

## 2. Mission

To simplify and support international fertility journeys through transparency,
technology, compassionate guidance, and trusted healthcare connections.

Every feature, every line of code, and every operational decision must serve this
mission. If something does not make the journey simpler, more transparent, or more
compassionate, it does not belong in the platform.

---

## 3. Vision

A trusted fertility concierge ecosystem where patients receive personalized support,
clinics collaborate efficiently, and operations are enhanced through intelligent
automation.

### Future Platform Capabilities

| Capability | Description |
|---|---|
| Patient Portal | Secure dashboard for journey tracking, document upload, and concierge communication |
| Clinic Collaboration | Shared workflow tools connecting Canadian coordinators with Indian clinic staff |
| Secure Document Management | Encrypted storage and transfer of medical records, consent forms, and treatment plans |
| AI-Assisted Concierge | Intelligent triage, information retrieval, and workflow suggestions for concierge staff |
| Automated Workflows | Rule-based automation of repetitive coordination tasks, reminders, and status updates |
| Operational Intelligence | Analytics and reporting on patient journeys, clinic performance, and business metrics |

These capabilities will be delivered incrementally. No single release will deliver
all of them. The platform evolves toward this vision one sprint at a time.

---

## 4. Product Philosophy

The product philosophy governs how features are designed, prioritized, and evaluated.

**Patient-First Design**

Every interface, workflow, and interaction must be designed from the patient's
perspective. The platform exists to serve patients; internal efficiency gains are
secondary.

**Human-Centered Technology**

Technology augments human concierge staff — it does not replace them. Fertility
journeys are deeply personal and emotionally significant. Automation handles
repetition; humans handle empathy.

**Automation of Repetitive Tasks**

Anything a human does more than three times in the same way is a candidate for
automation. Automate the mechanical to free time for the meaningful.

**Simplicity Before Complexity**

The simplest solution that meets the need is always preferred. Complexity is only
justified when it solves a demonstrated problem, not an anticipated one. Avoid
speculative generality.

**Reliability Over Unnecessary Features**

A small set of features that work perfectly is worth more than a large set of
features that work inconsistently. The platform handles sensitive healthcare
information — reliability is non-negotiable.

**Long-Term Maintainability**

Code is read far more often than it is written. Write for the next developer. Favour
clarity over cleverness. Document decisions so their rationale survives the original
author.

---

## 5. Engineering Principles

These principles govern all technical decisions.

**Modular Architecture**

The platform is composed of discrete, well-defined modules. Each module has a clear
responsibility and a minimal public interface. Modules can be developed, tested, and
deployed independently.

**Loose Coupling**

Modules communicate through defined contracts (APIs, events, shared types). Changes
to one module should not require changes to another unless the contract itself
changes. Avoid implicit dependencies.

**Clear Separation of Responsibilities**

Each component — frontend, API, database, storage, admin — has a distinct role.
Responsibilities do not overlap. A component does one thing and does it well.

**Maintainable Code**

Code must be readable, consistent, and well-structured. Follow the style guide.
Write tests for critical paths. Refactor when the cost of not refactoring exceeds
the cost of doing it.

**Documented Decisions**

Every significant architectural choice must be recorded as an Architecture Decision
Record (ADR) in `docs/decisions/`. The ADR explains the context, the decision, and
the trade-offs. Future contributors should understand why things are the way they
are.

**Incremental Development**

Ship small, ship often. Each increment must be independently valuable and
production-ready. Avoid large, monolithic releases. Prefer vertical slices over
horizontal layers.

**Security-Conscious Design**

Security is not a feature to be added later. It is a property of every decision.
Consider the security implications of every design choice. Default to secure.
Document what is protected and why.

---

## 6. Technology Philosophy

### Current Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | React + Vite (TypeScript) | Mature ecosystem, strong typing, fast builds |
| Hosting | Cloudflare Pages | Global CDN, free tier, git-integrated deploys |
| Backend | Cloudflare Workers | Edge-native, zero cold starts, generous free tier |
| Database | Cloudflare D1 (initial) | SQLite-compatible, serverless, free tier available |
| Object Storage | Cloudflare R2 | S3-compatible, no egress fees, free tier available |
| Repository | GitHub | Industry standard, Actions CI, broad tooling support |
| Administration | Telegram + Hermes Agent | Conversational admin, automation, monitoring |

### AI Philosophy

Hermes Agent (by Nous Research) is the primary AI assistant and operational
intelligence layer for the platform. It assists with development, documentation,
automation, and operational tasks via Telegram.

The underlying AI models, providers, and infrastructure may change over time.
The platform architecture must not be tightly coupled to any specific AI model
provider. The AI integration layer must remain replaceable through clean
abstractions and provider-agnostic interfaces.

Hermes is a tool used by the development and operations team. It is not a
customer-facing AI. It does not interact with patients directly.

### Cost Philosophy

Prefer free-tier and low-cost services until business revenue justifies scaling.
Cloudflare's free tier is the foundation — Workers, Pages, D1, and R2 all offer
generous free allowances. Only upgrade when usage genuinely exceeds free limits and
the marginal cost is justified by revenue.

Avoid services that require significant upfront investment or lock the platform into
a pricing tier that cannot be sustained without revenue. Every service choice must
include an exit strategy.

---

## 7. Hermes AI Operating Philosophy

Hermes Agent assists with the following operational domains:

- Development workflows (code generation, review, debugging)
- Project management (task tracking, sprint planning, status reporting)
- Documentation (generation, validation, consistency checking)
- Automation (CI/CD workflows, deployment orchestration, monitoring)
- Operational assistance (log analysis, incident response, health checks)
- Content workflows (copy editing, SEO review, accessibility checks)
- System monitoring (uptime, error rates, performance alerting)

### Boundaries

Hermes must not independently approve or execute actions in the following domains
without explicit human review and confirmation:

- Medical decisions of any kind
- Legal decisions (terms of service, privacy policy, regulatory compliance)
- Financial commitments (service upgrades, paid tool adoption, contracts)
- Security-sensitive changes (authentication, authorization, encryption, secrets)
- Production-impacting changes (deployments, database migrations, DNS changes)

These boundaries are absolute. Hermes can recommend, draft, and prepare — but a
human must approve before execution.

---

## 8. Security Philosophy

**Privacy by Design**

Patient privacy is the default state, not an afterthought. Data collection,
storage, and processing must all default to the most privacy-preserving option.
PHI (Protected Health Information) must be identified, classified, and protected
at every layer.

**Least Privilege**

Every component, service, and user must operate with the minimum permissions
necessary to perform its function. No component should have access to data or
operations it does not need. Review permissions regularly and revoke what is
unused.

**Secure Defaults**

Configuration defaults must be the most secure option. Opt-in to less secure
configurations only when explicitly required and documented. Never ship with
debug modes, verbose logging, or open endpoints enabled by default.

**Encryption Where Available**

Data must be encrypted in transit (TLS) and at rest. Use platform-native
encryption where available (D1 encryption, R2 server-side encryption). Manage
keys through the platform's secrets management, never in code or configuration
files.

**Minimal Data Collection**

Collect only what is necessary. Every field in a form, every column in a
database, every log entry must be justified. If there is no clear purpose for
collecting a piece of data, do not collect it. Regularly audit stored data and
purge what is no longer needed.

**Auditability**

Security-relevant events must be logged. Who accessed what, when, and from where.
Access logs, change logs, and deployment logs must be retained and reviewable.
The platform must be able to answer the question: "What happened?"

**Protection of Sensitive Patient Information**

Patient data is the most sensitive asset in the platform. It must be protected
with the highest level of care. Access must be strictly controlled. Data must
never be used for purposes the patient has not explicitly consented to. Data
retention and deletion policies must be documented and enforced.

---

## 9. Development Workflow

All development follows a structured, documented workflow:

```
Idea
  |
  v
Epic (large outcome, spans multiple sprints)
  |
  v
Sprint (time-boxed iteration, typically 1-2 weeks)
  |
  v
Tasks (discrete units of work, one person, one purpose)
  |
  v
Implementation (code, tests, configuration)
  |
  v
Testing (unit, integration, manual where appropriate)
  |
  v
Review (code review, security review, documentation review)
  |
  v
Deployment (automated via CI/CD to Cloudflare)
  |
  v
Documentation Update (update affected docs as part of the task)
```

### Workflow Rules

- Every task originates from a documented epic or sprint plan.
- Implementation happens on a feature branch off `main`.
- All changes go through pull request review before merging.
- The CI pipeline must pass (lint, typecheck, test, build) before merge.
- Documentation updates are part of the task, not a separate step.
- Deployments are automated. Manual deployments are exceptional and documented.

---

## 10. Documentation Policy

Documentation is the **single source of truth** for the platform. When code and
documentation disagree, the documentation is corrected — unless the documentation
describes intent and the code has not yet reached it, in which case the code is
brought into alignment.

### Requirements

**Major decisions must be recorded.**

Every architectural decision, technology choice, and significant trade-off must
be captured as an ADR in `docs/decisions/`. Decisions made without a record are
decisions that will be questioned and potentially reversed later.

**Architecture changes require documentation updates.**

When the system architecture changes, the corresponding documentation in
`ARCHITECTURE.md` and `docs/architecture/` must be updated in the same pull
request. Architecture documentation that does not reflect reality is worse than
no documentation.

**Features require corresponding documentation.**

Every new feature must include documentation updates. API changes require
OpenAPI spec updates. Database changes require schema documentation updates.
User-facing changes require README or help content updates.

**AI assistants must read project documentation before making changes.**

Hermes Agent and any other AI tools used in development must load and reference
the project's documentation before proposing or making changes. The
documentation provides the context, constraints, and conventions that govern
all development work.

### Documentation Principles

- **Modular** — each document covers one domain, cross-referenced not duplicated
- **Concise** — say what is necessary, nothing more
- **Version controlled** — documentation lives in the repository alongside code
- **Human readable** — clear language, good structure, accessible to new contributors
- **AI readable** — structured, well-formatted, machine-parseable where appropriate

---

## 11. Definition of Done

A task is complete only when all of the following conditions are met:

| Condition | Verification |
|---|---|
| Implementation completed | Code is written and committed |
| Testing completed | Unit tests pass; integration tests pass where applicable; manual testing performed where automated testing is not feasible |
| Documentation updated | Affected documentation files are updated in the same pull request |
| Build successful | CI pipeline passes: lint, typecheck, test, build |
| Deployment ready | Change is merged to `main` and deployable; deployment is automated or documented |
| No unresolved critical issues | No known bugs, security vulnerabilities, or broken functionality introduced |

Partial completion is not completion. A feature that works but is not documented
is not done. A feature that is documented but not tested is not done. The
definition of done is binary: all conditions are met, or the task is not done.

---

## 12. Future Platform Vision

The platform evolves through distinct phases. Each phase builds on the previous
one and delivers independently useful capabilities.

```
Static Website
  |
  v
Digital Concierge Platform
  |
  v
Patient Management System
  |
  v
Clinic Collaboration Platform
  |
  v
AI-Assisted Operations Platform
```

| Phase | Status | Description |
|---|---|---|
| Static Website | Complete | Marketing site with treatment information, clinic profiles, consultation form |
| Digital Concierge Platform | Current | Structured backend, patient intake workflows, concierge dashboard |
| Patient Management System | Planned | Patient portal, journey tracking, secure document exchange |
| Clinic Collaboration Platform | Planned | Shared workflows, clinic dashboards, treatment coordination tools |
| AI-Assisted Operations Platform | Planned | Intelligent automation, predictive insights, operational intelligence |

Each phase is an independent value delivery. The platform does not need to reach
the final phase to be useful. Each phase solves real problems for real users.

---

## Governance

This document may only be amended through a documented decision process. Proposed
changes must be:

1. Documented as an ADR or amendment proposal
2. Reviewed by the project lead
3. Applied consistently across all affected documentation

The current version of this document is the authoritative reference. Previous
versions are preserved in git history.

---

*End of Project Constitution. Version 1.0, ratified 2026-07-18.*