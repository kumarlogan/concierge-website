# HERMES EXECUTION RUNTIME

> **EPIC-009 — Phase F**
> Runtime Wiring — Connect Roadmap → EPCL → Department → Agent → Skill → Capability → Verification → Knowledge → Executive Reporting.
> **Status**: ✅ COMPLETE

---

## 1. Wiring Principle

Using ONLY existing runtime infrastructure (EPCL, WAS, WEF, Hermes Platform). Every transition produces runtime evidence. No hidden execution. No direct execution shortcuts.

---

## 2. Complete Wiring Diagram

```
ROADMAP (Product Owner approved)
  ↓
EPCL (Executive Planning)
  ├── PlanningEngine.parse(roadmap) → ExecutionPlan
  ├── RoadmapEngine.analyze(roadmap) → RoadmapAnalysis
  ├── DisciplineRouter.select(epic) → DisciplineSelection[]
  ├── TokenBudgetManager.estimate(plan) → BudgetAllocation
  ├── ContextBudgetManager.estimate(plan) → ContextAllocation
  └── FeatureFlags.evaluate(plan) → GateResults
  ↓
DEPARTMENT SELECTION (EPCL DisciplineRouter)
  ├── research_intelligence → Research Intelligence department
  ├── architecture_strategy → Architecture & Strategy department
  ├── experience_design → Experience & Design department
  ├── engineering → Engineering department
  ├── quality_assurance → Quality Assurance department
  ├── security → Security department
  ├── documentation → Documentation department
  ├── release_operations → Release Operations department
  ├── business_growth → Business & Growth department
  └── platform_engineering → Platform Engineering department
  ↓
RUNTIME AGENT SELECTION (WAS Activation)
  ├── Department → Agent mapping (per Department Registry)
  ├── WAS.PlanConsumer.consume(plan) → ActivationLifecycle
  ├── WAS.ConstitutionalValidator.validate(plan) → ValidationResult
  └── IF validation fails → lifecycle → REJECTED (terminal)
  ↓
SKILL SCHEDULING (WEF Delegation)
  ├── Agent → Skill mapping (per Skill Registry)
  ├── WEF.WeakDelegator.dispatch(request) → Skill execution
  ├── WEF.PreDeploymentHealthCheck(batch) → OperationalReport
  └── Skills executed in dependency order
  ↓
CAPABILITY EXECUTION (Agent executes Skills)
  ├── Skill → Capability mapping (per Capability Ownership)
  ├── Agent invokes Skill → Capability produces output
  ├── Each capability produces runtime evidence
  └── Evidence stored in ExecutionStore
  ↓
VERIFICATION ROUTER (Quality Assurance + Security)
  ├── QA verifies: test pass, regression clear, browser matrix, performance within thresholds
  ├── Security verifies: no critical/high vulns, secret scan clean, compliance passed
  ├── IF verification fails → route back to Engineering (fix)
  ├── IF verification passes → route to Knowledge Capture
  └── Verification evidence stored in ExecutionStore
  ↓
KNOWLEDGE CAPTURE (Documentation)
  ├── DocumentationAgent captures all execution artifacts
  ├── Knowledge artifacts stored in KnowledgeStore
  ├── Execution traces archived
  └── Knowledge base updated
  ↓
EXECUTIVE REPORTING (Executive Office)
  ├── Hermes Runtime generates 15-section PO Report
  ├── post-wave-reporting skill produces analytics
  ├── Executive dashboard updated (per Executive Command Center spec)
  ├── All evidence aggregated
  └── Report delivered to Product Owner
  ↓
WAIT (Terminal State)
  ├── No further execution until next Product Owner objective
  ├── All artifacts persisted
  └── Runtime ready for next cycle
```

---

## 3. Transition Evidence Requirements

Every transition between layers MUST produce runtime evidence:

| Transition | Evidence Produced | Storage |
|-----------|-------------------|---------|
| Roadmap → EPCL | Parsed execution plan, roadmap analysis | ExecutionStore |
| EPCL → Department Selection | Discipline selection results, budget allocation | ExecutionStore |
| Department → Agent Selection | Activation lifecycle record, validation result | ExecutionStore |
| Agent → Skill Scheduling | Skill execution plan, dependency order | ExecutionStore |
| Skill → Capability Execution | Capability output, runtime evidence | ExecutionStore |
| Capability → Verification | Test results, quality report, security report | ExecutionStore |
| Verification → Knowledge Capture | Knowledge artifacts, execution traces | KnowledgeStore |
| Knowledge Capture → Executive Reporting | Aggregated evidence, PO report | ExecutionStore |
| Executive Reporting → WAIT | Final executive report, summary | ExecutionStore |

---

## 4. No Bypass Rules

| Rule | Enforcement |
|------|------------|
| No stage may bypass another | EPCL enforces sequential phase gates |
| No runtime agent may execute without an owning department | WAS validates department assignment before activation |
| No capability may execute without an owning skill | WEF validates skill assignment before delegation |
| No skill may execute without an owning runtime agent | EPCL validates agent assignment before scheduling |
| No department may execute outside EPCL/WAS/WEF governance | ConstitutionalValidator enforces governance rules |
| No hidden execution | All transitions produce observable evidence in ExecutionStore |
| No direct execution shortcuts | WEF WeakDelegator enforces agent-mediated execution |

---

## 5. Phase-Specific Wiring

### 5.1 Research Phase Wiring

```
ROADMAP (research-tagged epic)
  ↓
EPCL → DisciplineRouter → research_intelligence
  ↓
WAS → research-agent (activated)
  ↓
Skill Scheduling → research, evidence-collection, competitive-analysis
  ↓
Capability Execution → research.analyze, research.synthesize, research.investigate
  ↓
Verification → QA validates evidence completeness
  ↓
Knowledge Capture → Research reports stored
  ↓
Executive Reporting → Research summary in executive report
  ↓
WAIT
```

### 5.2 Design Phase Wiring

```
ROADMAP (design-tagged epic)
  ↓
EPCL → DisciplineRouter → experience_design
  ↓
WAS → ux-research-agent, ux-designer, accessibility-agent, design-system-agent (activated)
  ↓
Skill Scheduling → ux-research, ui-design, accessibility-review, design-system-validation, ux-activation-pattern
  ↓
Capability Execution → experience.design, experience.review, experience.prototype
  ↓
Verification → QA validates design compliance
  ↓
Knowledge Capture → Design artifacts stored
  ↓
Executive Reporting → Design status in executive report
  ↓
WAIT
```

### 5.3 Engineering Phase Wiring

```
ROADMAP (engineering-tagged epic)
  ↓
EPCL → DisciplineRouter → engineering
  ↓
WAS → backend-agent, frontend-agent, api-agent, cloudflare-agent (activated)
  ↓
Skill Scheduling → backend-development, frontend-development, api-design, cloudflare-deployment, database-migration, feature-milestone-execution, testing, test-driven-development
  ↓
Capability Execution → code.generate, code.review, deploy.pages, deploy.workers, db.migrate, db.rollback, test.run
  ↓
Verification → QA validates functionality, Security validates security posture
  ↓
Knowledge Capture → Code artifacts, API docs stored
  ↓
Executive Reporting → Engineering status in executive report
  ↓
WAIT
```

### 5.4 Release Phase Wiring

```
ROADMAP (release-tagged epic)
  ↓
EPCL → DisciplineRouter → release_operations
  ↓
WAS → release-agent (activated)
  ↓
Skill Scheduling → deployment-verification, rollback, autonomous-execution-certification, release-readiness-review, workers-ci-deployment, staging-deployment-runbook
  ↓
Capability Execution → deploy.pages, deploy.workers, test.verify
  ↓
Verification → QA certifies release readiness, Security grants clearance
  ↓
Knowledge Capture → Release notes, deployment records stored
  ↓
Executive Reporting → Release status in executive report
  ↓
WAIT
```

---

## 6. Existing Infrastructure Used

| Infrastructure Component | Location | Purpose |
|-------------------------|----------|---------|
| EPCL PlanningEngine | `hermes/services/planning/planning-engine.ts` | Parse roadmap, create execution plan |
| EPCL RoadmapEngine | `hermes/services/planning/roadmap-engine.ts` | Analyze roadmap, create batches |
| EPCL DisciplineRouter | `hermes/services/planning/discipline-router.ts` | Select discipline for epic |
| EPCL TokenBudgetManager | `hermes/services/planning/token-budget-manager.ts` | Estimate token budget |
| EPCL ContextBudgetManager | `hermes/services/planning/context-budget-manager.ts` | Estimate context budget |
| EPCL FeatureFlags | `hermes/services/planning/feature-flags.ts` | Evaluate feature gates |
| WAS Activation | `hermes/services/activation/orchestrator.ts` | Activate runtime agents |
| WAS ConstitutionalValidator | `hermes/services/activation/approval-gates.ts` | Validate governance rules |
| WEF WeakDelegator | `hermes/services/execution/workforce-dispatch.ts` | Delegate to runtime agents |
| WEF PreDeploymentHealthCheck | `hermes/services/execution/workforce-dispatch.ts` | Check deployment readiness |
| ExecutionStore | `hermes/persistence/execution-store.ts` | Store execution evidence |
| AgentStateStore | `hermes/persistence/agent-state-store.ts` | Store agent state |
| WorkflowStore | `hermes/persistence/workflow-store.ts` | Store workflow state |
| Hermes Runtime Agent | `hermes/agents/index.ts` | Current session orchestrator |
| Hermes Skills | `hermes/skills/` | Reusable skill modules |
| Hermes Admin Console | `hermes/admin/` | Operational dashboard |
| Hermes Memory | `hermes/services/memory/` | Organizational memory |
| Hermes Audit | `hermes/audit/` | Audit trail and evidence |

---

## 7. Phase F Completion Summary

- **Complete wiring** from Roadmap through all 10 runtime layers to WAIT terminal state.
- **Every transition** produces runtime evidence stored in ExecutionStore.
- **No bypasses** — all 7 no-bypass rules enforced.
- **Phase-specific wiring** defined for Research, Design, Engineering, and Release phases.
- **All existing infrastructure** referenced — no new infrastructure required.
- **Ready for Phase G** — Runtime Memory.
