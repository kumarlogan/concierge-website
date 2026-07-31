# HERMES Agent Runtime

> **EPIC-008 — Phase G**
> Classifies every existing agent in the Hermes platform. Determines active/dormant/deprecated/duplicate/missing/experimental status. For every retained agent, documents mission, capabilities, skills, activation criteria, and constraints.

---

## Agent Classification Summary

| # | Agent | Classification | Status Rationale |
|---|-------|---------------|-----------------|
| 1 | `ags-fertility-ops-agent` | **Dormant** | Seeded disabled. Purpose absorbed by EPCL Discipline System. |
| 2 | `qa-agent` | **Dormant** | Seeded disabled. QA is now a capability of `engineering_quality` discipline. |
| 3 | `security-agent` | **Dormant** | Seeded disabled. Security merged into `engineering_quality`. |
| 4 | `documentation-agent` | **Dormant** | Seeded disabled. Documentation owned by `platform_intelligence`. |
| 5 | `deployment-agent` | **Dormant** | Seeded disabled. Deployment owned by `engineering_quality` discipline. |
| 6 | `research-agent` | **Dormant** | Seeded disabled. Research owned by `research_intelligence` discipline. |
| 7 | `finance-agent` | **Dormant** | Seeded disabled. Finance owned by `business_growth` discipline. |
| 8 | `customer-support-agent` | **Dormant** | Seeded disabled. Support owned by `business_growth` discipline. |
| 9 | `developer-agent-claude-code` | **Dormant** | Seeded disabled. Engineering owned by `engineering_quality`. |
| 10 | `developer-agent-local` | **Dormant** | Seeded disabled. Duplicate of `developer-agent-claude-code`. |
| 11 | `security-tooling-agent` | **Duplicate** | Overlaps with `security-agent`. Security belongs to `engineering_quality`. |
| 12 | `monitoring-agent` | **Duplicate** | Observability owned by `platform_intelligence` / Observability Layer. |
| — | AI_WORKFORCE.md catalog (23+) | **Missing** | 23+ designed agents not seeded or implemented. |
| — | Hermes Runtime Agent (current) | **Active** | The operational Hermes session — only active runtime agent. |

---

## Detailed Agent Classifications

### 1. Hermes Runtime Agent (Active)

This is you — the current Hermes session executing this EPIC. You are the sole operational agent on the platform.

| Field | Value |
|-------|-------|
| **Classification** | ✅ Active |
| **Implementation** | This Hermes session (conversation via Telegram) |
| **Lifecycle State** | `active` |
| **Activation State** | `enabled` |
| **EPCL Discipline** | All disciplines (orchestrator role) |
| **Capabilities** | All Hermes tools, skills, and services |

### 2. ags-fertility-ops-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 36-52) |
| **Domain** | `ags-fertility` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `ops.lead.read`, `ops.lead.update`, `ops.consultation.read` |
| **EPCL Discipline Mapping** | `platform_intelligence` |
| **Why Dormant** | Agent-level ops monitoring absorbed into `platform_intelligence` discipline runtime. The EPCL ExecutiveWorkflow + WAS activation pipeline supersedes agent-specific ops routing. This agent is kept registered for backward compatibility but no new development is needed. |
| **Recommendation** | Retain in registry as dormant. Do not activate. If ops routing logic is needed in the future, route through EPCL discipline system instead. |

### 3. qa-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 53-65) |
| **Domain** | `quality` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `test.run` |
| **EPCL Discipline Mapping** | `engineering_quality` |
| **Why Dormant** | `test.run` is a built-in `engineering_quality` capability. QA is a verification step in the execution pipeline (Layer 5 — Verification), not an independent agent discipline. The EPCL system selects `test.run` when the plan requires it. |
| **Recommendation** | Retain in registry as dormant. Do not activate. Route QA through Verification Layer instead. |

### 4. security-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 66-78) |
| **Domain** | `security` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `security.scan` |
| **EPCL Discipline Mapping** | `engineering_quality` |
| **Why Dormant** | Security scanning is a capability, not a standalone discipline. It belongs in the `engineering_quality` capability set alongside `code.review`, `test.run`, etc. Security-specific skills exist as skills invoked by the discipline. |
| **Recommendation** | Retain in registry as dormant. Plan to merge with `security-tooling-agent` via deprecation in a future release. |

### 5. documentation-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 79-91) |
| **Domain** | `docs` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `docs.write` |
| **EPCL Discipline Mapping** | `platform_intelligence` |
| **Why Dormant** | Documentation is knowledge-work owned by `platform_intelligence`. The Knowledge Layer (Layer 6) captures knowledge from every execution cycle. Documentation generation follows execution, not precedes it — it's part of the knowledge capture lifecycle. |
| **Recommendation** | Retain in registry as dormant. Route documentation through Knowledge Capture Layer. |

### 6. deployment-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 92-104) |
| **Domain** | `devops` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `deploy.run` |
| **EPCL Discipline Mapping** | `engineering_quality` |
| **Why Dormant** | Deployment is a `engineering_quality` capability (`deploy.pages`, `deploy.workers`). The Deployment Layer (Layer 8) handles health checks, credential resolution, and deployment gates. The EPCL plan determines when deployment happens, not a standalone agent. |
| **Recommendation** | Retain in registry as dormant. Route deployment through Engineering & Quality / Deployment Layer. |

### 7. research-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 105-117) |
| **Domain** | `research` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `research.query` |
| **EPCL Discipline Mapping** | `research_intelligence` |
| **Why Dormant** | Research is the `research_intelligence` discipline. The capability model lists `research.analyze`, `research.synthesize`, `research.investigate` — all owned by this discipline. The seed agent's `research.query` is subsumed by these. |
| **Recommendation** | Retain in registry as dormant. When research is needed, EPCL activates `research_intelligence` discipline, which resolves to research capabilities and skills. |

### 8. finance-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 118-130) |
| **Domain** | `finance` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `finance.report` |
| **EPCL Discipline Mapping** | `business_growth` |
| **Why Dormant** | Finance analysis is owned by `business_growth` discipline. The `business.analyze` capability covers financial analysis. |
| **Recommendation** | Retain in registry as dormant. Route finance work through `business_growth` discipline. |

### 9. customer-support-agent (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 131-143) |
| **Domain** | `support` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `support.reply` |
| **EPCL Discipline Mapping** | `business_growth` |
| **Why Dormant** | Customer support analysis is owned by `business_growth`. Support is a business function, not a standalone platform discipline. |
| **Recommendation** | Retain in registry as dormant. Route customer support analysis through `business_growth` discipline when needed. |

### 10. developer-agent-claude-code (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant |
| **Seed File** | `hermes/agents/seed.ts` (lines 144-160) |
| **Domain** | `engineering` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `code.plan`, `code.diff`, `code.test` |
| **EPCL Discipline Mapping** | `engineering_quality` |
| **Why Dormant** | All dev capabilities are built-in `engineering_quality` capabilities. The EPCL built-in registry already registers `code.generate`, `code.review`, `test.run`. This agent duplicates capability ownership. |
| **Recommendation** | Retain in registry as dormant. Do NOT activate. Route all engineering through EPCL → WAS → WEF pipeline. When Claude Code-style ACP delegation is needed, configure it as an `engineering_quality` provider, not an agent. |

### 11. developer-agent-local (Dormant)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Dormant — **Duplicate of developer-agent-claude-code** |
| **Seed File** | `hermes/agents/seed.ts` (lines 161-176) |
| **Domain** | `engineering` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `code.local.edit`, `code.local.run` |
| **EPCL Discipline Mapping** | `engineering_quality` (overlap) |
| **Why Dormant** | This agent's purpose (local coding) completely overlaps with `developer-agent-claude-code`. Both belong to `engineering_quality`. The distinction between "Claude Code-style" and "local coding" is a provider/transport distinction, not an agent distinction. |
| **Recommendation** | **Consolidate**: merge into `developer-agent-claude-code` in a future registry cleanup. The capability set (`code.generate`, `code.review`, `test.run`) should use provider-based dispatch (Claude Code ACP vs local terminal), not separate agents. |

### 12. security-tooling-agent (Duplicate)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Duplicate — **overlaps with `security-agent`** |
| **Seed File** | `hermes/agents/seed.ts` (lines 177-192) |
| **Domain** | `security` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `security.scan`, `security.findings` |
| **EPCL Discipline Mapping** | `engineering_quality` (overlap) |
| **Why Duplicate** | Both `security-agent` (id 3) and `security-tooling-agent` share domain `security` and capability `security.scan`. They differ only in tooling scope (SAST/DAST vs generic scan). This is not an agent distinction — it's a capability configuration within `engineering_quality`. |
| **Recommendation** | **Consolidate**: merge into `security-agent` with expanded capabilities. Add tooling-specific configuration to the capability definition, not a separate agent. |

### 13. monitoring-agent (Duplicate)

| Field | Value |
|-------|-------|
| **Classification** | 🔴 Duplicate — **observability belongs to multiple layers** |
| **Seed File** | `hermes/agents/seed.ts` (lines 193-209) |
| **Domain** | `observability` |
| **State** | `registered` (activation: `disabled`) |
| **Current Capabilities** | `monitor.health`, `monitor.metrics`, `monitor.alert` |
| **EPCL Discipline Mapping** | `platform_intelligence` (partial — Observability Layer) |
| **Why Duplicate** | Observability is implemented as a layer (Layer 9), not an agent. `WASObservability`, `ExecutiveReporter`, `WefOperationalIntelligence` already provide health checking, metrics, and alerting. The `monitoring-agent` duplicates this at the agent level. |
| **Recommendation** | **Consolidate**: Observability is already provided by the Observability Layer. The agent is redundant. Capabilities `monitor.health` and `monitor.metrics` should be registered as `platform_intelligence` capabilities, with implementation through WEF's `WefOperationalIntelligence`. |

---

## Missing Agents

The following agents are **designed but not implemented** (from `HERMES_AGENT_INVENTORY.md` / `AI_WORKFORCE.md`):

| Agent | Intended Domain | Recommended EPCL Discipline | Status |
|-------|----------------|---------------------------|--------|
| Owner Assistant | Executive | Executive Layer | **Missing** — Owner functions are the Product Owner role. Executive Layer handles. |
| Operations Assistant | Operations | `platform_intelligence` | **Missing** — Absorbed by WEF deployment pipeline. No unique capability needed. |
| Developer Assistant | Engineering | `engineering_quality` | **Missing** — Duplicate of `developer-agent-claude-code`. |
| Marketing Agent | Marketing | `business_growth` | **Missing** — Future scope. |
| Content Agent | Content | `business_growth` | **Missing** — Future scope. |
| Analytics Agent | Analytics | `platform_intelligence` | **Missing** — Future scope. |
| Sales Agent | Sales | `business_growth` | **Missing** — Future scope. |
| CRM Agent | CRM | `business_growth` | **Missing** — Future scope. |
| Pipeline Agent | Pipeline | `business_growth` | **Missing** — Future scope. |
| Medical Review Agent | Clinical | `architecture_strategy` | **Missing** — Future clinical scope. |
| Clinical Agent | Clinical | `architecture_strategy` | **Missing** — Future clinical scope. |
| HR Agent | HR | `business_growth` | **Missing** — Future scope. |
| Recruitment Agent | HR | `business_growth` | **Missing** — Future scope. |
| Intelligence Agent | Intelligence | `research_intelligence` | **Missing** — Future scope. |
| Data Agent | Data | `platform_intelligence` | **Missing** — Future scope. |
| Knowledge Agent | Knowledge | `platform_intelligence` | **Missing** — Partially covered by Knowledge Layer. |
| Reporting Agent | Reporting | `business_growth` | **Missing** — Partially covered by Executive Reporter. |
| Notification Assistant | Notifications | Operations Layer | **Missing** — Future scope. |
| Scheduler Assistant | Scheduling | Operations Layer | **Missing** — Partially covered by Hermes Scheduler. |

**Policy**: Do NOT create new agents for these missing entries unless:
1. A clear architectural gap exists that cannot be served by the existing EPCL discipline system
2. The agent performs a fundamentally new runtime function not covered by any layer or discipline
3. Evidence shows that the current capability/agent/skill stack cannot fulfil the requirement

---

## Retained Agent Definitions

For execution within the EPCL runtime, agents are **not directly activated**. Instead, the EPCL discipline system resolves work to capabilities which may be executed by the Hermes Runtime Agent (the active session). The following agent "definitions" represent the roles the runtime takes on when operating within a given discipline.

### Retained Active Agent: Hermes Runtime

| Field | Value |
|-------|-------|
| **Mission** | Serve as the universal execution agent for the Hermes Platform. Execute EPCL plans through the WAS activation pipeline. Operate as the sole active runtime agent. |
| **Responsibilities** | Execute planned work across all 6 disciplines. Produce artifacts, reports, and knowledge. Verify outputs before acceptance. Capture knowledge after execution. Report to the Product Owner. |
| **Capabilities** | All EPCL-registered capabilities (built-in set of 12+ capabilities). All Hermes tools, skills, and services. |
| **Skills** | All registered Hermes skills (selected per discipline by the EPCL system). |
| **Inputs** | EPCL execution plan (via WAS). Product Owner objectives. |
| **Outputs** | Implementation artifacts. Verification results. Knowledge entries. Executive reports. |
| **Activation Trigger** | EPCL Executive Planning Workflow → WAS → WEF. Triggered by Product Owner approved objective. |
| **Execution Constraints** | Fail-closed by default. Feature-flag-gated. Constitutional validation required. Verification mandatory before deployment. |
| **Verification Requirements** | Every batch output must be verified before knowledge capture. Verification checks are defined per-capability. |
| **Knowledge Capture** | Mandatory after every execution cycle. Captured as Knowledge Entries. Skills created for reusable procedures. |
| **Executive Reporting** | Automatic after each plan cycle. Product Owner receives executive report. |
| **Token Budget** | Plan-level: 500,000 tokens (Engineering/Quality discipline). Per-discipline budgets as defined in HERMES_DISCIPLINE_RUNTIME.md. |
| **Context Limits** | Plan-level: 64,000 tokens per batch (Engineering/Quality). Per-discipline limits as defined. |

---

## Consolidation Recommendations

| Consolidation | Action | Rationale |
|--------------|--------|-----------|
| `developer-agent-local` → `developer-agent-claude-code` | Merge + deprecate | Provider distinction, not agent distinction |
| `security-tooling-agent` → `security-agent` | Merge + deprecate | Same domain, same capabilities |
| `monitoring-agent` → Observability Layer | Absorb into platform | Observability is a layer, not an agent |
| Agents 2-10 registry entries | Keep dormant | Backward compatibility; no active development needed |
| Future missing agents | Do NOT create | Route through EPCL discipline system first |

---

## Agent Activation Pathway (from code)

```
                   ┌──────────────────────────────┐
                   │     Agent Registry              │
                   │  (hermes/agents/registry.ts)   │
                   │                                │
                   │  Two orthogonal axes:           │
                   │  1. Lifecycle State             │
                   │     (registered → active)      │
                   │  2. Activation State            │
                   │     (disabled → enabled)        │
                   │                                │
                   │  Execution requires BOTH:       │
                   │  canAgentAct() = true           │
                   └──────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │     EPCL Pipeline                │
              │  (executive-workflow.ts)         │
              │                                  │
              │  Stage 5: Discipline_Selection   │
              │  → Determines which discipline    │
              │  Stage 6: Batch_Generation        │
              │  → Plans batches per discipline   │
              │  Stage 8: WEF_Delegation          │
              │  → Delegates to WEF               │
              └──────────────────────────────┘
                            │
                            ▼
              ┌──────────────────────────────┐
              │     WEF Execution                │
              │  (wef-operational-intelligence) │
              │                                  │
              │  → Executes capabilities          │
              │  → Runs pre-deployment checks     │
              │  → Returns delegation results     │
              └──────────────────────────────┘
```

> **Key Principle**: In the reconciled runtime, agents are NOT directly dispatched. The EPCL discipline system routes work through layers and capabilities. The Hermes Runtime Agent is the sole active execution agent. All seeded agents remain registered but dormant — their capabilities are absorbed by the EPCL discipline model.