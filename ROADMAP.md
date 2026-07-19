# Roadmap

> High-level product direction, planned milestones, and future capabilities.
> Updated as phases are planned and delivered.

---

## Phase 0: Platform Foundation ✅ Complete

- [x] Static marketing website (React + Vite + Tailwind)
- [x] Cloudflare Pages deployment
- [x] GitHub repository + CI/CD pipeline
- [x] Telegram/Hermes development workflow
- [x] Automated deployment pipeline (deploy-website skill)
- [x] Project documentation structure (`/docs/`)
- [x] PROJECT.md — Project Constitution v1.0
- [x] AI_OPERATING_MODEL.md — AI Operating Model v1.0
- [x] PRODUCT_BOUNDARIES.md — Product Boundaries v1.0
- [x] ARCHITECTURE.md — System Architecture v2.0
- [x] ADR-001 — Cloudflare Migration Strategy
- [x] CURRENT_SPRINT.md — Epic 1 planning
- [x] TASKS.md — Epic 1 task breakdown
- [x] ROADMAP.md — Updated with Epics and future capabilities

---

## Phase 1: Concierge Platform Foundation 🚧 In Progress

### Epic 1 — Backend Foundation *(current sprint)*

**Target:** Working Cloudflare Workers API connected to D1, ready for first
production workflow.

| Deliverable | Status |
|---|---|
| Cloudflare Workers project | ⬜ Not Started |
| D1 database + initial schema | ⬜ Not Started |
| API routing (`/api/v1/`) | ⬜ Not Started |
| Health endpoint | ⬜ Not Started |
| Consultation workflow (Worker → D1) | ⬜ Not Started |
| Backend testing | ⬜ Not Started |
| Backend documentation | ⬜ Not Started |

### EPIC-003-001 — Hermes Execution Platform ✅ Complete (2026-07-19)

Operational AI OS execution layer: Work Planner, Workforce Dispatcher, Execution
Queue, Review Pipeline, Multi-Agent Coordination, Provider Abstraction, and
Application Automation (simulation-only). Built on existing Hermes foundations
(orchestrator, task framework, provider registry, git provider) — no production
touch, no vendor lock-in.

| Deliverable | Status |
|---|---|
| Work Planner (dependency-ordered waves, cycle fail-closed) | ✅ |
| Workforce Dispatcher (registry → workforce → fail-closed) | ✅ |
| Execution Queue (human approval gate, retry/pause/cancel, audit) | ✅ |
| Review Pipeline (aggregate, conflict detect, human approval gate) | ✅ |
| Multi-Agent Coordination (dev/qa/security/docs/research domains) | ✅ |
| Provider Abstraction (replaceable backends, no lock-in) | ✅ |
| Application Automation (simulation-only, privileged blocked) | ✅ |

Validation: `hermes.execution.003.test.ts` **28/28 pass**; full workers suite
**299/299 pass**. See `docs/operations/EPIC-003-001_VALIDATION_REPORT.md` and
`docs/operations/EPIC-003-001_COMPLETION_REPORT.md`.

### EPIC-003-002 — Hermes Developer Automation Pipeline ✅ Complete (2026-07-19)

Complete engineering workflow from feature request to simulated git operations,
composed on the EPIC-003-001 foundations (Identity, Authorization, Audit, Workforce,
Activation Platform). No production touch, no vendor lock-in, simulation-only git.

| Deliverable | Status |
|---|---|
| M1 · Development Work Request spec + normalization | ✅ |
| M2 · Engineering Planner (GoalSpec, waves, ADR heuristic) | ✅ |
| M3 · Claude Code ToolProvider (fail-closed, simulated executor) | ✅ |
| M4 · QA Pipeline (5 suites, boundary fail) | ✅ |
| M5 · Security Pipeline (permission / approval / aggregate) | ✅ |
| M6 · Docs Pipeline (doc rec + ADR authoring) | ✅ |
| M7 · Contribution Aggregator (blocks on security fail) | ✅ |
| M8 · Review Package + Simulated Git Plan | ✅ |
| M9 · End-to-End Simulation (no real side effects) | ✅ |

Validation: `hermes.developer.003.test.ts` **17/17 pass**; full workers suite
**316/316 pass** (23 files). See `docs/operations/EPIC-003-002_VALIDATION_REPORT.md`
and `docs/operations/EPIC-003-002_COMPLETION_REPORT.md`.

### Upcoming Epics (Phase 1)

| Epic | Description | Status |
|---|---|---|
| Epic 2 | Frontend integration — connect React forms to Workers API | Not Planned |
| Epic 3 | Concierge workflow tools — Hermes-managed lead tracking and consultation management | Not Planned |
| Epic 4 | Content management — D1-backed clinics, services, and FAQs replacing static TypeScript data | Not Planned |

---

## Phase 2: Patient Workflow Platform *(future)*

Patient accounts, authentication, personal journey dashboards, secure document
upload, direct concierge messaging, appointment management.

*Not yet planned. Will be scoped after Phase 1 completion.*

---

## Phase 3: Clinic Collaboration Platform *(future)*

Clinic accounts and dashboards, shared patient journey views, clinic-side
document management, treatment milestone tracking, operational analytics.

*Not yet planned. Will be scoped after Phase 2 completion.*

---

## Phase 4: Healthcare Technology Ecosystem *(future)*

API ecosystem for third-party integration, advanced analytics, AI-assisted
operational intelligence, multi-clinic coordination, expanded service offerings.

*Not yet planned. Will be scoped after Phase 3 completion.*

---

## Future Capabilities

Capabilities identified for future consideration but not yet assigned to a phase.

### AI Session Management

**Status:** Planned
**Purpose:** Allow Hermes to efficiently manage long-running engineering sessions
through context monitoring, summaries, handoff notes, and controlled session
restarts.

**Future commands:**

| Command | Function |
|---|---|
| `/status` | Report current session state — active sprint, in-progress tasks, context size, session duration |
| `/handoff` | Generate a structured handoff note capturing current state, decisions made, and next steps for a new session to pick up |
| `/new` | Start a fresh session with context reset, optionally loading a handoff note from a previous session |
| `/resume` | Load a previous handoff note and restore working context to continue where a session left off |

**Benefits:**

- Reduces context window pressure during long engineering sessions
- Enables clean session boundaries at natural break points (end of sprint, task completion)
- Preserves engineering continuity across sessions without relying on conversational memory
- Handoff notes serve as lightweight, structured progress records

---

## Timeline

| Milestone | Target | Status |
|---|---|---|
| Phase 0 Complete | 2026-07-18 | ✅ Complete |
| Epic 1 Kickoff | 2026-07-18 | 🚧 Planning Complete |
| Epic 1 Complete | est. 2026-07-25 | ⬜ Not Started |
| Phase 1 Complete | TBD | ⬜ Not Started |