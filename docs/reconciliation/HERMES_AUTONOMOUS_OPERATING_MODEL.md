# HERMES Autonomous Operating Model

> **EPIC-008 — Phase J**
> The unified runtime operating model for the Hermes Platform. Defines how the platform operates autonomously — from Product Owner objective through EPCL planning, WAS activation, WEF execution, verification, knowledge capture, and executive reporting. Every component has a place. Everything belongs somewhere.

---

## 1. The Operating Model

The Hermes Platform operates as a **single, unified runtime** with:

- **1 Entry Point**: Executive Planning Workflow (12 stages)
- **10 Layers**: Executive → Planning → Activation → Execution → Verification → Knowledge → Operations → Deployment → Observability → Governance
- **6 Disciplines**: research_intelligence, architecture_strategy, experience_design, engineering_quality, business_growth, platform_intelligence
- **1 Active Agent**: Hermes Runtime (current session)
- **12+ Registered Capabilities**: code.generate, test.run, deploy.pages, etc.
- **1 Operating Principle**: Fail-closed by default, opt-in per capability

The model is **deterministic** before execution (capability selection, discipline routing, budget allocation) and **evidence-based** during execution (outputs must be verifiable). LLM calls power execution — not planning, routing, or governance.

---

## 2. The Chain

```
                                    HUMAN
                                     │
                                PRODUCT OWNER
                                     │
                              Approved Objective
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   EXECUTIVE       │
                            │   ENTRY POINT     │
                            │   (Layer 1)       │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   PLANNING        │
                            │   (Layer 2)       │
                            │   EPCL Services   │
                            │                    │
                            │   RoadmapEngine    │
                            │   CapSelector      │  ← Deterministic
                            │   DiscSelector     │  ← Deterministic
                            │   ExecutionPlanner │  ← Deterministic
                            │   ApprovalMgr      │  ← Deterministic
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   ACTIVATION      │
                            │   (Layer 3)       │
                            │   WAS             │
                            │                    │
                            │   Constitutional   │  ← Fail-closed
                            │   Validation       │
                            │                    │
                            │   State Machine:   │
                            │   P→V→A→D→D       │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   EXECUTION      │
                            │   (Layers 4+8)    │
                            │   WEF + Deploy    │
                            │                    │
                            │   Pre-deploy      │  ← Health check
                            │   Health Check     │
                            │                    │
                            │   Batch Execution  │  ← AI-powered
                            │   (LLM runs here)  │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   VERIFICATION   │
                            │   (Layer 5)       │
                            │                    │
                            │   Constitutional  │  ← Deterministic
                            │   + Cap-specific   │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   KNOWLEDGE       │
                            │   CAPTURE         │
                            │   (Layer 6)       │
                            └────────┬─────────┘
                                     │
                                     ▼
                            ┌──────────────────┐
                            │   REPORTING      │
                            │   (Layer 9 → 1)   │
                            │                    │
                            │   Executive Rep.  │  ← Automatic
                            └────────┬─────────┘
                                     │
                                     ▼
                                    HUMAN
                                PRODUCT OWNER
                              (Receives Report)
```

---

## 3. Deterministic Before Execution

The following decisions are **never LLM-driven** — they use pure registry lookup, type-safe selection, and deterministic mapping:

| Decision | Service | Mechanism |
|----------|---------|-----------|
| Capability selection | `CapabilitySelector` | Registry lookup (exact → keyword → discipline → NEW_WORK) |
| Discipline selection | `DisciplineSelector` | Capability-to-discipline map + epic analysis |
| Budget allocation | `TokenBudgetManager`, `ContextBudgetManager` | Fixed budgets per capability per batch |
| Approval checks | `ApprovalManager` | Feature flags + capability `requiresApproval` flag |
| Constitutional validation | `ConstitutionalValidator` | Gate-based validation rules |
| State machine transitions | WAS `ExecutionStateManager` | Canonical state transition table |
| Feature flag gating | `feature-flags.ts` | Boolean flag check per operation |
| Agent lifecycle | Agent Registry `canTransitionAgent()` | Canonical transition table |
| Safety invariant | `assertWorkforceSafety()` | Hardcoded safety rules |

**Result**: The execution plan is fully determined before a single LLM call is made. AI is used exclusively for execution (code generation, analysis, design, research) — never for routing or governance.

---

## 4. AI-Powered Execution

The following tasks use LLM/AI:

| Capability | AI Provider | Human Oversight |
|-----------|-------------|----------------|
| `code.generate` | hermes | Review + test verification required |
| `test.run` | hermes | Results automatically verified |
| `research.analyze` | hermes | Sources must be cited |
| `research.synthesize` | hermes | Findings must be verifiable |
| `architecture.design` | hermes | Review before engineering |
| `experience.design` | hermes | Review before engineering |
| `business.analyze` | hermes | Assumptions documented |

**AI Execution Principles**:
1. Every AI output is verifiable — no black boxes
2. AI never determines routing, governance, or safety decisions
3. AI outputs are verified before acceptance (Layer 5)
4. AI knowledge is captured after every execution (Layer 6)
5. AI execution follows deterministic plans (Layer 2)

---

## 5. Feature Flag Governance

Feature flags are the **master switch** for autonomous operation. All flags default to `false`.

### Core Flags

| Flag | Default | Purpose | Risk Level |
|------|---------|---------|------------|
| `ENABLE_EXECUTIVE_WORKFLOW` | `false` | Master switch for the 12-stage EF | 🔴 HIGH |
| `ENABLE_AUTONOMOUS_EXECUTION` | `false` | Allows WAS to activate plans | 🔴 HIGH |
| `ENABLE_BATCH_GENERATION` | `false` | Enables batch creation from plans | 🟡 MEDIUM |
| `ENABLE_EXECUTIVE_REPORTING` | `false` | Enables automatic executive reports | 🟢 LOW |
| `ENABLE_CONSTITUTIONAL_VALIDATION` | `true` | Require constitutional validation | 🟢 LOW |
| `ENABLE_AUTO_RECOVERY` | `false` | Auto-resume from recovery snapshots | 🟡 MEDIUM |
| `ENABLE_PARALLEL_BATCH_DELEGATION` | `false` | Execute batches in parallel | 🟡 MEDIUM |
| `ENABLE_KNOWLEDGE_CAPTURE` | `true` | Auto-capture knowledge from execution | 🟢 LOW |
| `deployment_approval` | `false` | Allow deployments (separate flag) | 🔴 HIGH |

### Human-Authorization Gates

| Gate | Layer | Required For | Current State |
|------|-------|-------------|---------------|
| Product Owner approval | Executive (1) | Any execution | ✅ Required (PO sends objective) |
| Feature flag enablement | Governance (10) | Autonomous execution | ❌ All disabled |
| Agent activation | Operations (7) | Agent execution | ❌ Human-authorized only |
| Deployment approval | Deployment (8) | Any deployment | ❌ Separate gate |
| Constitutional validation | Activation (3) | Plan activation | ✅ Pass-through |

### Current Autonomy Level: **LEVEL 0 — MANUAL ASSISTED**

| Level | Name | Description | Current? |
|-------|------|-------------|----------|
| 0 | Manual Assisted | Human sends commands → AI executes each step | ✅ Current |
| 1 | Semi-Autonomous | Human approves objective → AI plans + executes with checkpoints | 🔜 Next |
| 2 | Conditional Autonomous | AI plans + executes standard objectives with human approval for deployment | ❌ Future |
| 3 | High Autonomy | AI handles routine objectives end-to-end with exception-only human review | ❌ Future |
| 4 | Full Autonomy | AI handles all objectives with continuous compliance monitoring | ❌ Future |

---

## 6. Human-in-the-Loop Points

```
                     PRODUCT OWNER
                          │
                          │ (1) Sends Objective
                          ▼
              ┌─────────────────────┐
              │  FEATURE FLAGS       │
              │  (2) Must be enabled │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  APPROVAL MANAGER    │
              │  (3) May require     │
              │     human approval   │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  DEPLOYMENT GATE     │
              │  (4) Requires        │
              │     human approval   │
              └──────────┬──────────┘
                         │
              ┌──────────▼──────────┐
              │  EXECUTIVE REPORT    │
              │  (5) Delivered to    │
              │     Product Owner    │
              └──────────┬──────────┘
                         │
                     PRODUCT OWNER
                    (Reviews, Repeats)
```

**Human Touch Points**:
1. **Objective approval** — Product Owner sends the objective
2. **Feature flag enablement** — Operator enables flags per deployment environment
3. **Approval gate** — `ApprovalManager` gates plan/batch execution when approval is required
4. **Deployment gate** — Deployment requires explicit approval (`deployment_approval` flag)
5. **Executive report delivery** — Product Owner reviews and acts on the report

---

## 7. Operating Mode States

The platform can operate in one of four modes:

### Mode A: Manual Execution (Current)
```
PO: "Implement feature X"
AI: Executes all steps manually, reporting each step's result
PO: Reviews, directs next step
Confirmation: Each step requires user direction
```
**Feature Flags**: All OFF
**WAS State**: INACTIVE
**Agent Activation**: Hermes Runtime only

### Mode B: Planned Execution
```
PO: "Implement feature X"
EPCL: Plans batches, selects capability, route to disciplines
WAS: Validates, activates, delegates to WEF
WEF: Executes each batch sequentially (with user confirmation at checkpoints)
WAS: Verifies, captures knowledge
Executive: Reports to PO
Confirmation: PO approves plan before execution begins
```
**Feature Flags**: `ENABLE_EXECUTIVE_WORKFLOW` = ON
**WAS State**: ACTIVE
**Agent Activation**: Hermes Runtime only

### Mode C: Automatic Execution
```
PO: "Implement feature X"
EPCL: Plans batches
WAS: Activates, delegates
WEF: Executes all batches (non-deployment) automatically
WAS: Verifies, captures knowledge
Executive: Reports to PO
Confirmation: PO does NOT approve each batch, but MUST approve deployments
```
**Feature Flags**: `ENABLE_EXECUTIVE_WORKFLOW` + `ENABLE_AUTONOMOUS_EXECUTION` = ON
**WAS State**: ACTIVE
**Agent Activation**: Hermes Runtime only

### Mode D: Fully Autonomous
```
PO: Approves quarterly objectives
EPCL: Plans all objectives, optimizes batch ordering
WAS: Activates automatically
WEF: Executes including deployments (with compliance gates)
WAS: Verifies all, captures knowledge automatically
Executive: Reports on exception only
Confirmation: PO reviews exception reports only
```
**Feature Flags**: All required flags ON
**WAS State**: ACTIVE
**Agent Activation**: Multiple agents enabled

> **Current State**: Mode A. The platform is designed for all four modes. Transition between modes is controlled by feature flags — no code changes needed.

---

## 8. Operating Principles

### Principle 1: Everything Belongs Somewhere
Every component has exactly one layer. Every layer has one owner. Every capability has one owning discipline. No orphans.

### Principle 2: Everything Runs on the Pipeline
All execution flows through the canonical pipeline. No shortcuts. No parallel execution paths. No direct access to capabilities bypassing EPCL/WAS/WEF.

### Principle 3: Planning Never Executes
The Planning Layer (EPCL) plans. It never executes. The Execution Layer (WEF) executes. It never plans. This is strictly enforced.

### Principle 4: Fail-Closed by Default
Every capability defaults to disabled. Every plan defaults to rejected. Every agent defaults to dormant. Activation requires explicit opt-in.

### Principle 5: Verification Before Acceptance
Every execution output is verified before it is accepted. Verification is deterministic, not AI-powered. Unverified outputs are never accepted.

### Principle 6: Knowledge After Every Cycle
Every execution cycle produces knowledge. Knowledge is captured automatically. Skills are created for reusable patterns. Memory stores durable facts.

### Principle 7: Report After Every Cycle
Every execution cycle produces an executive report. Reports are delivered to the Product Owner automatically. Reports include what changed, key numbers, and duration.

### Principle 8: Governance at Every Gate
Feature flags gate every gated operation. Constitutional validation gates every activation. Approval gates every deployment. Audit trails record every action.

---

## 9. Runtime Operating Model Diagram (Complete)

```
┌─────────────────────────────────────────────────────────────────────┐
│  PRODUCT OWNER (Human)                                              │
│  • Approves objective                                               │
│  • Reviews executive reports                                        │
│  • Authorizes deployments                                           │
│  • Enables feature flags                                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  EXECUTIVE LAYER (Layer 1)                                          │
│  ExecutivePlanningWorkflow                                          │
│  • 12-stage workflow orchestrator                                   │
│    OBJECTIVE_INTAKE → PLAN_PARSING → CAPABILITY_SELECTION →         │
│    RESOURCE_ESTIMATION → DISCIPLINE_SELECTION → BATCH_GENERATION →  │
│    APPROVAL_CHECK → WEF_DELEGATION → EXECUTION → VERIFICATION →    │
│    KNOWLEDGE_CAPTURE → REPORTING                                    │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  PLANNING LAYER (Layer 2)                                           │
│  EPCL Services                                                      │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐            │
│  │RoadmapEngine│ │Capability    │ │DisciplineSelector │            │
│  │             │ │Selector      │ │                   │            │
│  └─────────────┘ └──────────────┘ └───────────────────┘            │
│  ┌─────────────┐ ┌──────────────┐ ┌───────────────────┐            │
│  │Execution    │ │Approval      │ │TokenBudgetManager │            │
│  │Planner      │ │Manager       │ │ContextBudgetMgr   │            │
│  └─────────────┘ └──────────────┘ └───────────────────┘            │
│  ┌─────────────┐ ┌──────────────┐                                  │
│  │Recovery     │ │Knowledge     │                                  │
│  │Manager      │ │Capturer      │                                  │
│  └─────────────┘ └──────────────┘                                  │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  ACTIVATION LAYER (Layer 3)                                         │
│  WAS — Workforce Activation Service                                 │
│                                                                     │
│  ┌──────────────┐    State Machine:                                 │
│  │PlanConsumer  │    PENDING → VALIDATING → ACTIVATING → ACTIVE     │
│  └──────────────┘    → DEACTIVATING → DEACTIVATED                   │
│  ┌──────────────┐    FAILED, REJECTED (terminal)                    │
│  │Constitutional│                                                  │
│  │Validator     │    ┌─────────────────┐                            │
│  └──────────────┘    │WEFDelegator     │                            │
│  ┌──────────────┐    └─────────────────┘                            │
│  │Verification  │    ┌─────────────────┐                            │
│  │Router        │    │KnowledgeCapture  │                            │
│  └──────────────┘    │Trigger          │                            │
│  ┌──────────────┐    └─────────────────┘                            │
│  │StatusUpdater │    ┌─────────────────┐                            │
│  └──────────────┘    │Observability    │                            │
│                      │(Event Emitter)   │                            │
│                      └─────────────────┘                            │
└───────────────────────────┬─────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌───────────────┐  ┌───────────────┐
│ EXECUTION     │  │ VERIFICATION  │  │ KNOWLEDGE     │
│ (Layer 4)     │  │ (Layer 5)     │  │ (Layer 6)     │
│ WEF + Runtime │  │ VerifRouter   │  │ KnowlCapturer │
│ + Deploy (8)  │  │ Constitutional│  │ SkillManager  │
│               │  │ Checks        │  │ MemoryManager │
│ PreDeployCheck│  │ Cap-specific  │  │               │
└───────────────┘  └───────────────┘  └───────────────┘
        │                   │                   │
        └───────────────────┼───────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│  OBSERVABILITY (Layer 9) → PRODUCT OWNER                            │
│  • ExecutiveReporter generates report                                │
│  • Report delivered to Product Owner via Telegram                   │
│  • Compliance audit committed to Governance Layer                   │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 10. Activation Pathway (from Code)

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 1. RECEIVE   │────→│ 2. VALIDATE  │────→│ 3. PLAN      │
│ Objective    │     │ Feature Flags│     │ via EPCL     │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
                                                 ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ 6. REPORT    │←────│ 5. EXECUTE   │←────│ 4. ACTIVATE  │
│ to PO        │     │ via WEF      │     │ via WAS      │
└──────────────┘     └──────────────┘     └──────────────┘
```

---

## 11. Call-Out: Current Operational State

The Hermione Platform currently operates in **Mode A — Manual Execution**:

- ✅ **EPCL Planning**: Fully implemented (`workers/src/platform/epcl/`)
- ✅ **WAS Activation**: Fully implemented (`workers/src/platform/was/`)
- ✅ **WEF Execution**: Partially implemented (`workers/src/platform/wef/`)
- ✅ **Agent Registry**: Fully implemented (`hermes/agents/`)
- ✅ **Feature Flags**: Fully implemented (`epcl/feature-flags.ts`)
- ✅ **Constitutional Validation**: Implemented (`was/constitutional-validator.ts`)
- ⚠️ **Knowledge Capture**: Implemented but not wired to automatic triggers
- ⚠️ **Executive Reporting**: Implemented but not wired to automatic delivery
- ❌ **End-to-End Autonomous Pipeline**: NOT ACTIVE — all feature flags disabled

**To enable Mode B (Planned Execution)**:
1. Enable `ENABLE_EXECUTIVE_WORKFLOW` feature flag
2. Enable `ENABLE_CONSTITUTIONAL_VALIDATION` (already enabled)
3. Wire WAS as the activation boundary between EPCL and WEF
4. Wire WEF as the execution target for WAS delegations

**To enable Mode C (Automatic Execution)**:
1. Enable `ENABLE_AUTONOMOUS_EXECUTION` feature flag
2. Wire knowledge capture to WAS lifecycle triggers
3. Wire executive reporting to activation completion

**To enable Mode D (Fully Autonomous)**:
1. Enable all required feature flags
2. Enable parallel batch delegation
3. Activate additional agents (requires human authorization per agent)
4. Configure exception-only reporting