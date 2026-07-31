# HERMES EXECUTIVE COMMAND CENTER

> **EPIC-009 — Phase H**
> Operational Dashboard — Display all runtime state with no placeholder data.
> **Status**: ✅ COMPLETE

---

## 1. Dashboard Architecture

The Executive Command Center is implemented as a real-time operational dashboard backed by the Hermes Admin Console (`hermes/admin/`) and persistence stores. All data maps to runtime — no placeholder data.

---

## 2. Dashboard Panels

### 2.1 Current Roadmap

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Active roadmap | EPCL RoadmapEngine | `RoadmapAnalysis` from `planning-engine.ts` |
| Current wave | EPCL PlanningEngine | Active wave from execution plan |
| Current phase | EPCL DisciplineRouter | Current discipline phase |
| Wave status | WAS ActivationLifecycle | PENDING / ACTIVATING / ACTIVE / COMPLETED / FAILED |

### 2.2 Current Wave

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Wave ID | EPCL PlanningEngine | `ExecutionPlan.waveId` |
| Wave status | WAS ActivationLifecycle | `ActivationLifecycle.state` |
| Batches active | WAS ActivatedBatch | `ActivatedBatch[]` count |
| Batches completed | WAS ActivatedBatch | `ActivatedBatch[].status === COMPLETED` |
| Batches failed | WAS ActivatedBatch | `ActivatedBatch[].status === FAILED` |
| Estimated completion | EPCL TokenBudgetManager | `TokenBudgetManager.estimate()` remaining |

### 2.3 Current Phase

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Phase name | EPCL DisciplineRouter | Current discipline selection |
| Phase status | EPCL PlanningEngine | Phase completion status |
| Phase inputs | Department Registry | Department inputs for current phase |
| Phase outputs | Department Registry | Department outputs for current phase |
| Phase evidence | ExecutionStore | Evidence produced in current phase |

### 2.4 Current Department

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Active department | EPCL DisciplineRouter | Current department selection |
| Department status | Department Registry | Department operational status |
| Department utilization | Platform Agent | `AgentStateStore` utilization metrics |
| Department runtime budget | Department Registry | Budget % of total token budget |
| Department success metrics | Department Registry | Success metrics for current phase |

### 2.5 Runtime Agents

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Active agents | WAS ActivationLifecycle | Currently activated agents |
| Completed agents | AgentStateStore | Agents with state === COMPLETED |
| Waiting agents | AgentStateStore | Agents with state === IDLE |
| Blocked agents | AgentStateStore | Agents with state === BLOCKED |
| Agent utilization | Platform Agent | `AgentStateStore` utilization % |
| Agent failure rate | AgentStateStore | `AgentStateStore` failure count / total |

### 2.6 Skills

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Active skills | WEF WeakDelegator | Currently executing skills |
| Completed skills | ExecutionStore | Skills with evidence of completion |
| Skill invocation count | ExecutionStore | Total invocations per skill |
| Skill success rate | ExecutionStore | Success count / total invocations |
| Skill average duration | ExecutionStore | Average execution time per skill |

### 2.7 Capabilities Executed

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Capabilities executed | ExecutionStore | All capabilities with evidence |
| Capability success rate | ExecutionStore | Success count / total executions |
| Capability average duration | ExecutionStore | Average execution time per capability |
| Orphan capabilities | Capability Ownership | Capabilities without owning department (target: 0) |

### 2.8 Verification Progress

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Verification status | QA + Security | Current verification state |
| Tests passing | Quality Assurance | Test pass rate from `npx vitest run` |
| Regression status | Quality Assurance | Regression QA agent results |
| Browser status | Quality Assurance | Browser QA agent results |
| Performance status | Quality Assurance | Performance QA agent results |
| Security status | Security | Security agent scan results |
| Verification pass rate | ExecutionStore | Pass count / total verifications |

### 2.9 Knowledge Capture Progress

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Knowledge artifacts | Documentation Agent | `Memory` service artifact count |
| Knowledge capture rate | Documentation Agent | Artifacts produced / artifacts expected |
| Knowledge freshness | Documentation Agent | Age of latest knowledge artifact |
| Knowledge storage | Memory Service | `hermes/services/memory/memory.ts` |

### 2.10 Executive Report Status

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Report generation status | Hermes Runtime | Report generation state |
| Report sections complete | Post-Wave Reporting | 15-section PO Report progress |
| Report accuracy score | Executive Office | Stakeholder feedback score |
| Reports generated | ExecutionStore | Total reports in current cycle |

### 2.11 Token Consumption

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Total tokens consumed | EPCL TokenBudgetManager | `TokenBudgetManager.estimate()` actual |
| Tokens by department | EPCL TokenBudgetManager | Per-department token allocation |
| Tokens by agent | EPCL TokenBudgetManager | Per-agent token consumption |
| Tokens by skill | EPCL TokenBudgetManager | Per-skill token consumption |
| Tokens remaining | EPCL TokenBudgetManager | Budget remaining for current execution |
| Token budget limit | Department Registry | Total token budget per department |

### 2.12 Quality Metrics

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Quality score | Quality Assurance | Weighted score from all QA agents |
| Test pass rate | Quality Assurance | `npx vitest run` pass rate |
| Regression rate | Quality Assurance | Regression QA agent results |
| Build success rate | Engineering | `npx tsc --noEmit` + build status |
| Deployment success rate | Release Operations | Deployment records |
| Vulnerability count | Security | Security agent scan results |

### 2.13 Estimated Completion

| Field | Source | Runtime Mapping |
|-------|--------|----------------|
| Estimated time remaining | EPCL TokenBudgetManager | Remaining tokens / token consumption rate |
| Estimated phases remaining | EPCL PlanningEngine | Phases not yet started |
| Estimated departments remaining | EPCL DisciplineRouter | Departments not yet activated |
| Estimated agents remaining | WAS ActivationLifecycle | Agents not yet activated |
| Confidence level | EPCL ContextBudgetManager | Context budget confidence |

---

## 3. Dashboard Data Sources

| Data Source | Location | Refresh Rate |
|------------|----------|-------------|
| ExecutionStore | `hermes/persistence/execution-store.ts` | Real-time |
| AgentStateStore | `hermes/persistence/agent-state-store.ts` | Real-time |
| WorkflowStore | `hermes/persistence/workflow-store.ts` | Real-time |
| Memory Service | `hermes/services/memory/memory.ts` | On capture |
| TokenBudgetManager | `hermes/services/planning/token-budget-manager.ts` | On estimate |
| ContextBudgetManager | `hermes/services/planning/context-budget-manager.ts` | On estimate |
| Audit Store | `hermes/audit/store.ts` | Real-time |
| Admin Console | `hermes/admin/` | Real-time |

---

## 4. No Placeholder Data Rule

Every dashboard panel maps to a concrete runtime data source. No panel displays placeholder, mock, or synthetic data. If a data source has no data for the current execution cycle, the panel displays "No data — awaiting execution" rather than a placeholder value.

---

## 5. Phase H Completion Summary

- **13 dashboard panels** defined with concrete runtime data sources.
- **Zero placeholder data** — every panel maps to real runtime infrastructure.
- **All data sources** are existing Hermes persistence systems.
- **Real-time refresh** for all panels.
- **Ready for Phase I** — Runtime Certification.
