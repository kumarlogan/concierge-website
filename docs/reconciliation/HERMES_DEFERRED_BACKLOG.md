# HERMES DEFERRED BACKLOG

> **EPIC-009 — Phase J (Deliverable)**
> Deferred items — things that cannot be done now due to constraints, dependencies, or frozen foundation.
> **Status**: ✅ COMPLETE

---

## 1. Backlog Overview

This backlog captures items that were considered during the Phase B–J reconciliation but deferred for valid reasons. Items are tracked with rationale, dependency, and re-evaluation trigger.

---

## 2. Deferred Items

### 2.1 New Runtime Agent Creation

| Item | Rationale | Dependency | Re-evaluation Trigger |
|------|-----------|-----------|----------------------|
| Create new agents for AI_WORKFORCE.md concepts | Foundation Rule: Only create new runtime agents when absolutely required | EPIC-009 Phase C complete | New epic requires agent not covered by existing 22 |
| Create agent for "autonomous-execution-certification" as standalone | Currently a skill owned by `release-agent` | If certification process grows beyond skill scope | Certification process complexity increase |
| Create agent for "platform-barrel-export-pattern" as standalone | Currently a skill owned by `backend-agent` | If pattern execution requires dedicated agent | Pattern execution frequency increase |

### 2.2 New Skill Creation

| Item | Rationale | Dependency | Re-evaluation Trigger |
|------|-----------|-----------|----------------------|
| Create new skills for future disciplines | Current 60 skills cover all 21 capabilities | New discipline added to department registry | New department added |
| Create "compliance-audit" skill | Not needed for current capabilities | Compliance requirements change | Regulatory change |
| Create "disaster-recovery" skill | Not needed for current capabilities | DR requirements change | Infrastructure change |

### 2.3 New Department Creation

| Item | Rationale | Dependency | Re-evaluation Trigger |
|------|-----------|-----------|----------------------|
| Create new department for "Legal & Compliance" | Current 11 departments cover all execution needs | Legal/compliance requirements change | Regulatory requirement change |
| Create new department for "Data Engineering" | Data work is currently within Engineering | Data engineering scope grows beyond Engineering capacity | Data pipeline complexity increase |

### 2.4 Infrastructure Items

| Item | Rationale | Dependency | Re-evaluation Trigger |
|------|-----------|-----------|----------------------|
| New persistence system for memory | Current memory service handles all needs | Memory requirements exceed current capacity | Memory dimension count grows beyond 10 |
| New dashboard tooling beyond Admin Console | Admin Console covers all 13 panels | Panel count exceeds Admin Console capacity | Dashboard requirements change |
| New CI/CD pipeline beyond existing | Existing `.github/workflows/deploy.yml` covers deployment | Deployment process changes significantly | Deployment requirements change |

### 2.5 Foundation Items (Frozen — Cannot Be Changed)

| Item | Rationale | Status |
|------|-----------|--------|
| EPCL redesign | Foundation Rule: EPCL is frozen | FROZEN |
| WAS redesign | Foundation Rule: WAS is frozen | FROZEN |
| WEF redesign | Foundation Rule: WEF is frozen | FROZEN |
| Executive Planning Workflow redesign | Foundation Rule: frozen | FROZEN |
| Governance redesign | Foundation Rule: frozen | FROZEN |
| Platform Constitution redesign | Foundation Rule: frozen | FROZEN |
| Capability Registry redesign | Foundation Rule: frozen | FROZEN |
| Identity Model redesign | Foundation Rule: frozen | FROZEN |
| Provider Abstractions redesign | Foundation Rule: frozen | FROZEN |
| Lifecycle Framework redesign | Foundation Rule: frozen | FROZEN |

---

## 3. Backlog Priority

| Priority | Items | Rationale |
|----------|-------|-----------|
| **High** | New agent creation for new epics | Required for operational continuity |
| **Medium** | New skill creation for new disciplines | Required as organization grows |
| **Low** | New department creation | Only if organizational scope changes significantly |
| **Deferred** | Infrastructure changes | Only when current infrastructure is insufficient |
| **Never** | Foundation redesign | Foundation Rules prohibit |

---

## 4. Backlog Governance

- All backlog items reviewed at each EPIC milestone.
- Items promoted to active work only with Product Owner approval.
- Foundation items never promoted — they remain frozen.
- Backlog is maintained in this document.

---

## 5. Phase J Completion Summary

- **14 deferred items** tracked with rationale, dependency, and re-evaluation trigger.
- **5 frozen foundation items** explicitly listed as never-to-be-changed.
- **Priority classification** for all deferred items.
- **Governance rules** for backlog management defined.
- **Ready for Platform Evolution Plan** (final deliverable).
