# ORGANIZATION_RECONCILIATION.md

**EPIC-010 — Organizational Runtime Activation**
**Phase B: Reconciliation**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform

---

## 1. Original Vision vs Current Runtime

### Original Vision (from EPIC-010 directive)

```
Roadmap
↓
Executive Office
↓
EPCL
↓
Departments
↓
Agents
↓
Skills
↓
Capabilities
↓
Verification
↓
Knowledge Capture
↓
Executive Reporting
↓
WAIT
```

### Current Runtime (observed in Wave 3)

```
Roadmap
↓
EPCL
↓
Departments (implicit)
↓
Agents (implicit)
↓
Skills (implicit)
↓
Capabilities (implicit)
↓
WAS activation
↓
WEF delegation
↓
Research Intelligence
↓
Architecture & Strategy
↓
Experience & Design
↓
Engineering
↓
QA
↓
Verification
↓
Documentation
↓
Knowledge Capture
↓
Executive Reporting
↓
WAIT
```

### Reconciliation Summary

The current runtime is a **hybrid** — it has the target department/agent/skill/capability hierarchy but lacks the explicit runtime wiring (Executive Office as orchestrator, explicit agent-to-department ownership, explicit skill-to-capability mapping, explicit artifact contracts).

---

## 2. Missing Links

| Link | Current State | Target State | Gap |
|------|--------------|-------------|-----|
| Executive Office → EPCL | EPCL runs without explicit Executive Office orchestration | Executive Office approves, allocates budget, tracks utilization | Missing orchestration layer |
| EPCL → Departments | Departments are implicit (hardcoded sequence) | EPCL outputs department assignments | Missing explicit mapping |
| Departments → Agents | Agents are spawned ad-hoc | Each department owns specific agents | Missing agent registry |
| Agents → Skills | Skills are loaded on demand | Each agent owns specific skills | Missing skill ownership |
| Skills → Capabilities | Capabilities are used implicitly | Each skill owns specific capabilities | Missing capability mapping |
| Capabilities → Verification | Verification is implicit | Explicit verification contracts | Missing verification artifacts |
| Verification → Knowledge | Knowledge capture is implicit | Explicit knowledge capture artifacts | Missing knowledge contracts |
| Knowledge → Executive Reporting | Reporting is implicit | Explicit executive reporting artifacts | Missing reporting contracts |
| Executive Reporting → WAIT | WAIT is implicit | Explicit WAIT state with PO decision | Missing decision artifact |

---

## 3. Duplicate Agents

None identified. Each department had exactly one active agent during Wave 3.

## 4. Duplicate Skills

None identified. All skills serve distinct purposes.

## 5. Duplicate Capabilities

None identified. All capabilities have single ownership.

## 6. Missing Ownership

| Component | Current Owner | Target Owner | Gap |
|-----------|--------------|-------------|-----|
| Executive Office | Implicit (Hermes Agent) | Explicit department | Missing as explicit department |
| Business & Growth | Does not exist | New department | Missing entirely |
| Research Agent | Implicit (Hermes Agent) | Research Intelligence dept | Missing explicit agent |
| Evidence Agent | Implicit (Hermes Agent) | Research Intelligence dept | Missing explicit agent |
| Competitive Analysis Agent | Implicit (Hermes Agent) | Research Intelligence dept | Missing explicit agent |
| UX Research Agent | Implicit (Hermes Agent) | Experience & Design dept | Missing explicit agent |
| UX Designer | Implicit (Hermes Agent) | Experience & Design dept | Missing explicit agent |
| Accessibility Agent | Implicit (Hermes Agent) | Experience & Design dept | Missing explicit agent |
| Design System Agent | Implicit (Hermes Agent) | Experience & Design dept | Missing explicit agent |
| Backend Agent | Implicit (Hermes Agent) | Engineering dept | Missing explicit agent |
| Frontend Agent | Implicit (Hermes Agent) | Engineering dept | Missing explicit agent |
| API Agent | Implicit (Hermes Agent) | Engineering dept | Missing explicit agent |
| Cloudflare Agent | Implicit (Hermes Agent) | Engineering dept | Missing explicit agent |
| Functional QA | Implicit (Hermes Agent) | QA dept | Missing explicit agent |
| Regression QA | Implicit (Hermes Agent) | QA dept | Missing explicit agent |
| Browser QA | Implicit (Hermes Agent) | QA dept | Missing explicit agent |
| Performance QA | Implicit (Hermes Agent) | QA dept | Missing explicit agent |
| Technical Writer | Implicit (Hermes Agent) | Documentation dept | Missing explicit agent |
| Deployment Agent | Implicit (Hermes Agent) | Release Operations dept | Missing explicit agent |
| Verification Agent | Implicit (Hermes Agent) | Verification dept | Missing explicit agent |
| Product Strategy Agent | Does not exist | Business & Growth dept | Missing entirely |
| SEO Agent | Does not exist | Business & Growth dept | Missing entirely |
| Analytics Agent | Does not exist | Business & Growth dept | Missing entirely |

## 7. Missing Runtime Paths

| Path | Current | Target | Gap |
|------|---------|--------|-----|
| Roadmap → Executive Office | Skipped | Executive Office approves | Missing entry gate |
| Executive Office → EPCL | Direct | Executive Office orchestrates | Missing orchestration |
| EPCL → Departments | Implicit | Explicit department routing | Missing routing |
| Departments → Agents | Implicit | Explicit agent assignment | Missing assignment |
| Agents → Skills | Implicit | Explicit skill ownership | Missing ownership |
| Skills → Capabilities | Implicit | Explicit capability mapping | Missing mapping |
| Capabilities → Verification | Implicit | Explicit verification contracts | Missing contracts |
| Verification → Knowledge | Implicit | Explicit knowledge capture | Missing capture |
| Knowledge → Executive Reporting | Implicit | Explicit reporting | Missing reporting |
| Executive Reporting → WAIT | Implicit | Explicit PO decision | Missing decision |

## 8. Missing Verification

| Verification Point | Current | Target | Gap |
|-------------------|---------|--------|-----|
| Department activation verified | No | Yes | Missing |
| Agent activation verified | No | Yes | Missing |
| Skill execution verified | No | Yes | Missing |
| Capability execution verified | No | Yes | Missing |
| Artifact schema verified | No | Yes | Missing |
| Runtime observability | No | Yes | Missing |
| Runtime replayability | No | Yes | Missing |
| Runtime determinism | No | Yes | Missing |

## 9. Reconciliation Summary

| Category | Count |
|----------|-------|
| Missing links | 9 |
| Duplicate agents | 0 |
| Duplicate skills | 0 |
| Duplicate capabilities | 0 |
| Missing ownership | 22 |
| Missing runtime paths | 10 |
| Missing verification | 8 |

### Key Findings

1. **The current runtime is functional but implicit** — departments, agents, skills, and capabilities exist but are not explicitly registered or wired.
2. **Executive Office is missing as an explicit department** — it currently functions as the Hermes Agent itself, not as a named department.
3. **Business & Growth is entirely missing** — no department exists for product strategy, SEO, or analytics.
4. **Agent ownership is implicit** — the Hermes Agent itself serves as all agents; no agent registry exists.
5. **Skill ownership is implicit** — skills are loaded on demand with no agent-to-skill mapping.
6. **Capability ownership is implicit** — capabilities exist but have no explicit skill ownership.
7. **Artifact contracts are missing** — no explicit producer/consumer/schema/lifecycle for research, UX, engineering, QA, verification, knowledge, or executive outputs.
8. **Verification is implicit** — checks happen but are not formalized as verification artifacts.

---

*End of Phase B — Reconciliation*
