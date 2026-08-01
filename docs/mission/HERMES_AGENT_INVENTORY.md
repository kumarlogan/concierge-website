# HERMES AGENT INVENTORY & DISCIPLINE MAP
*Mission: Hermes Organization Reconstruction — Phase D Deliverable*

**Date:** 2026-07-30  
**Authority:** Product Owner Approval Granted  
**Status:** Complete agent inventory with discipline mappings

---

## EXECUTIVE SUMMARY

The Hermes agent architecture defines **8 planned agent types** in the seed workforce, **8 permission-catalog agents**, and a **universal capability model** with 50+ intention-named capabilities. However, only **1 agent (Hermes/ags-fertility-ops-agent)** is operational. All others are registered DISABLED and NON-AUTONOMOUS by design.

---

## AGENT LIFECYCLE MODEL

**Evidence:** `hermes/agents/registry.ts` (204 lines, EPIC-002-006B)

### Two Orthogonal Axes

1. **Lifecycle State** (`AgentLifecycleState`):
   - `registered` → `assigned` → `approved` → `active` → `paused` → `suspended` → `retired`
   - Governed by `setState()` and canonical transition table
   - Enforced by `canTransitionAgent()` (illegal transitions rejected)

2. **Activation State** (`ActivationState`):
   - `disabled` | `enabled`
   - Governed by `activateAgent()` / `deactivateAgent()`
   - Human-authorized operation only (never automatic)

**Execution Prerequisite:** `activation === "enabled" AND state === "active"`

**Safety Invariant:** Registration ALWAYS starts with `activation: "disabled"` + `state: "registered"`. No agent is ever auto-activated.

---

## PLANNED AI WORKFORCE (8 Agents Seeded)

**Evidence:** `hermes/agents/seed.ts` (263 lines, EPIC-002-006C Phase 5)

| # | Agent ID | Name | Domain | Purpose | Owner | Autonomy |
|---|----------|------|--------|---------|-------|----------|
| 1 | `ags-fertility-ops-agent` | AGS Fertility Ops Agent | ags-fertility | Operational lead management for AGS Fertility | platform | ❌ Non-autonomous |
| 2 | `qa-agent` | QA Agent | quality | Run test suites, report regressions | platform | ❌ Non-autonomous |
| 3 | `security-agent` | Security Agent | security | Monitor secrets, scan dependencies | platform | ❌ Non-autonomous |
| 4 | `documentation-agent` | Documentation Agent | docs | Generate/maintain technical docs + ADRs | platform | ❌ Non-autonomous |
| 5 | `deployment-agent` | Deployment Agent | devops | Execute controlled deployment pipelines | platform | ❌ Non-autonomous |
| 6 | `finance-agent` | Finance Agent | finance | Read financial data (planned) | platform | ❌ Non-autonomous |
| 7 | `research-agent` | Research Agent | research | Read research data (planned) | platform | ❌ Non-autonomous |
| 8 | `customer-support-agent` | Customer Support Agent | support | Read/send support replies (planned) | platform | ❌ Non-autonomous |

**Key Finding:** All 8 agents are seeded as `activation: "disabled"` + `state: "registered"`. None can execute without explicit human authorization.

---

## AGENT PERMISSION CATALOG (8 Types)

**Evidence:** `hermes/services/agents/permissions.ts` (115 lines, EPIC-002-006D)

### Permission Keys (Agent-Scoped)
```
read:code, read:tests, create:reports, read:security-config, create:findings,
read:docs, create:documentation, prepare:deployment-plan, read:finance,
read:research, read:support, draft:support-reply, read:leads, write:leads,
read:consultations
```

### Default Permission Grants

| Agent ID | Permissions |
|----------|-------------|
| `qa-agent` | `read:code`, `read:tests`, `create:reports` |
| `security-agent` | `read:security-config`, `create:findings` |
| `documentation-agent` | `read:docs`, `create:documentation` |
| `deployment-agent` | `prepare:deployment-plan` (NO `deploy:execute`) |
| `finance-agent` | `read:finance` |
| `research-agent` | `read:research` |
| `customer-support-agent` | `read:support`, `draft:support-reply` |
| `ags-fertility-ops-agent` | `read:leads`, `write:leads`, `read:consultations` |

**Critical Safety Rule:** Deployment Agent gets `prepare:deployment-plan` ONLY — never `deploy:execute`. Deployment authority is explicitly excluded from agent permissions.

---

## CAPABILITY MODEL (Universal Taxonomy)

**Evidence:** `docs/architecture/CAPABILITY_MODEL.md` (175 lines, EPIC-005)

### Principle
> A **capability** is an *intention Hermes can form*. It is never a provider, transport, or vendor product.

### Canonical Taxonomy (Provider-Independent)

#### Dev / Code
- `dev.code.generate` — Produce source code
- `dev.code.review` — Review a diff/PR
- `dev.code.refactor` — Restructure existing code
- `dev.test.run` — Execute a test suite
- `dev.debug.attach` — Attach a debugger

#### Git / VCS
- `git.commit` — Commit changes
- `git.push` — Push a ref
- `git.pr.open` — Open a pull request
- `git.pr.review` — Review a pull request
- `git.clone` — Clone a repository

#### Deploy
- `deploy.website` — Publish a static/site artifact
- `deploy.worker` — Deploy a worker/function
- `deploy.infra` — Apply infrastructure (Terraform)
- `deploy.container` — Run a container image

#### Security
- `security.scan` — Static/dynamic vulnerability scan
- `security.secret.detect` — Detect leaked secrets
- `security.policy.evaluate` — Evaluate an execution against policy

#### Data
- `database.query` — Run a query
- `database.migrate` — Apply a schema migration
- `storage.object.put` — Write an object
- `storage.object.get` — Read an object
- `kv.get` / `kv.put` — Key-value read/write

#### Workflow
- `workflow.execute` — Run a multi-step workflow
- `workflow.schedule` — Schedule a recurring workflow
- `agent.orchestrate` — Drive an agent through a task

#### Notification / Comms
- `notification.send` — Send a message (transport resolved later)
- `notification.channel.list` — Enumerate available channels

#### Research / Knowledge
- `research.search` — Web/KB search
- `research.summarize` — Summarize a corpus
- `memory.recall` — Recall from Hermes memory

#### Identity / Trust (Hermes-Owned)
- `identity.verify` — Verify a principal
- `policy.decide` — Make a policy decision

**Key Finding:** Capability names are stable forever. Providers are resolved at selection time, not baked into IDs. This enables provider-neutral design.

---

## DISCIPLINE MAPPING

### What is a Discipline?
A discipline is a **domain of expertise** that groups related capabilities and agents. Disciplines map to workforce categories and business units.

### Discipline Definitions

| Discipline | Domain | Capabilities | Agents | Business Unit |
|------------|--------|-------------|--------|---------------|
| **Engineering** | `dev`, `git`, `deploy`, `security` | `dev.*`, `git.*`, `deploy.*`, `security.*` | `qa-agent`, `security-agent`, `deployment-agent`, `documentation-agent` | Engineering |
| **Operations** | `ops`, `workflow` | `ops.lead.*`, `ops.consultation.*`, `workflow.*` | `ags-fertility-ops-agent` | Operations |
| **Finance** | `finance` | `read:finance` | `finance-agent` | Finance |
| **Research** | `research` | `read:research`, `research.*` | `research-agent` | Research |
| **Support** | `support` | `read:support`, `draft:support-reply` | `customer-support-agent` | Customer Service |
| **Documentation** | `docs` | `read:docs`, `create:documentation` | `documentation-agent` | Engineering |
| **Security** | `security` | `security.*` | `security-agent` | Security (standalone BU) |
| **Quality** | `test` | `dev.test.*` | `qa-agent` | Engineering |

---

## AGENT-TO-DISCIPLINE MAPPING

| Agent ID | Primary Discipline | Secondary Disciplines | Capabilities |
|----------|-------------------|----------------------|-------------|
| `ags-fertility-ops-agent` | Operations | Workflow | `ops.lead.read`, `ops.lead.update`, `ops.consultation.read` |
| `qa-agent` | Quality | Engineering | `dev.test.run` |
| `security-agent` | Security | Engineering | `security.scan` |
| `documentation-agent` | Documentation | Engineering | `docs.write` |
| `deployment-agent` | Engineering | DevOps | `deploy.run` |
| `finance-agent` | Finance | — | `read:finance` |
| `research-agent` | Research | — | `read:research` |
| `customer-support-agent` | Support | — | `read:support`, `draft:support-reply` |

---

## CURRENT OPERATIONAL STATE

### Active Agents (1)
✅ **Hermes (ags-fertility-ops-agent)**
- **Status:** Operational via Telegram
- **Execution Mode:** Manual (human sends commands via Telegram)
- **Not Using:** EPCL, WAS, or WEF (bypasses the full execution framework)
- **Evidence:** This conversation — Hermes is executing the Night Mission via Telegram

### Registered but Disabled Agents (7)
❌ **All other seeded agents**
- `qa-agent` — Registered, disabled, non-autonomous
- `security-agent` — Registered, disabled, non-autonomous
- `documentation-agent` — Registered, disabled, non-autonomous
- `deployment-agent` — Registered, disabled, non-autonomous
- `finance-agent` — Registered, disabled, non-autonomous
- `research-agent` — Registered, disabled, non-autonomous
- `customer-support-agent` — Registered, disabled, non-autonomous

### Missing Agents (Designed but Not Implemented)
⚠️ **From AI_WORKFORCE.md (18 cross-app + 5 domain workers):**
- Owner Assistant, Operations Assistant, Developer Assistant
- Marketing Agent, Content Agent, Analytics Agent
- Sales Agent, CRM Agent, Pipeline Agent
- Medical Review Agent, Clinical Agent
- HR Agent, Recruitment Agent
- Intelligence Agent, Data Agent
- Knowledge Agent, Reporting Agent
- Notification Assistant, Scheduler Assistant

**Key Finding:** The seed workforce (8 agents) is a subset of the full AI_WORKFORCE.md catalog (23+ agents). Most planned agents are not yet implemented.

---

## ACTIVATION PATHWAY

To activate an agent:

1. **Register** — `registerAgent()` (already done in seed)
2. **Assign** — `setState(agentId, "assigned")` (human-authorized)
3. **Approve** — `setState(agentId, "approved")` (human-authorized)
4. **Activate** — `activateAgent(agentId)` (human-authorized)
5. **Enable** — `setState(agentId, "active")` (human-authorized)

**All 5 steps require human authorization.** No automatic transitions.

---

## AGENT INTERFACES

### Registry Interface (`hermes/agents/registry.ts`)
- `registerAgent(agent)` — Register a new agent (always starts disabled)
- `getAgent(id)` — Retrieve agent by ID
- `listAgents()` — List all registered agents
- `setState(id, state)` — Transition lifecycle state (enforced transitions)
- `activateAgent(id)` / `deactivateAgent(id)` — Toggle activation
- `canAgentAct(id)` — Check if agent can execute (both axes satisfied)

### Permissions Interface (`hermes/services/agents/permissions.ts`)
- `resolveAgentPermissions(agentId)` — Get effective permissions
- `agentHasPermission(agentId, perm)` — Boolean check
- `authorizeAgentAction(agentId, perm, context)` — Authorize + audit

### Memory Interface (`hermes/services/memory/memory.ts`)
- Agent-scoped memory: `writeMemory()`, `readMemory()`, `listMemory()`
- Memory scopes: `isolated` | `shared` | `global`
- Audit trail for all memory operations

---

## INTEGRATION POINTS

### EPCL Integration
- EPCL Stage 5: DISCIPLINE_SELECTION — Selects discipline for execution
- EPCL Stage 6: BATCH_GENERATION — Creates batches for agents
- PlanningEngine selects capabilities → DisciplineRouter maps to agents

### WAS Integration
- WAS PlanConsumer detects APPROVED plans
- WAS WEFDelegator delegates to agents via WEF
- WAS ExecutionStateManager tracks agent execution state

### WEF Integration
- WEF Phase 3: Implementation — Agents execute tasks
- WorkforceDispatch routes tasks to agents
- ExecutionQueue manages agent task queue

### Provider Integration
- Agents execute capabilities via providers
- Provider selection: Capability → Provider (resolved at runtime)
- Provider trust: Signature, checksum, sandbox enforcement

---

## AUTONOMY READINESS

### Current Autonomy Level: ❌ NONE
- All agents are `non-autonomous` in seed
- EPCL feature flags are OFF (master switch disabled)
- WAS is fail-closed (requires validation)
- WEF requires human approval at every gate

### To Enable Autonomy:
1. Enable `ENABLE_AUTONOMOUS_EXECUTION` feature flag (HIGH RISK)
2. Activate agents (5-step human authorization)
3. Configure constitutional validation (WAS)
4. Set up observability + audit trails
5. Test in staging environment first

**Recommendation:** Do NOT enable full autonomy yet. The system is designed fail-closed for safety.

---

## EVIDENCE SUMMARY

| Claim | Evidence File | Lines |
|-------|--------------|-------|
| 8 seeded agents | `hermes/agents/seed.ts` | 263 |
| Agent lifecycle model | `hermes/agents/registry.ts` | 204 |
| Permission catalog | `hermes/services/agents/permissions.ts` | 115 |
| Capability model | `docs/architecture/CAPABILITY_MODEL.md` | 175 |
| 50+ capabilities | `docs/architecture/CAPABILITY_MODEL.md` | 100+ |
| All agents disabled | `hermes/agents/seed.ts` (line 27-34) | 8 |
| Only Hermes operational | This conversation (Telegram execution) | N/A |

---

**Evidence Base:** This inventory is constructed from 8 agent seed definitions, 15+ service file reads, the capability model (50+ capabilities), and the live test suite. Every agent has a file path citation.
