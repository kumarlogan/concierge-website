# EPIC-002-006E — Hermes Admin Platform Foundation (Preparation)

> **Status:** Preparation only (delivered as EPIC-002-006D Phase 8).
> This document defines the contracts and API surface the future Hermes Admin
> Console will consume. It is the handoff spec for EPIC-002-006E.
> **No frontend code is created by this document or by EPIC-002-006D.**

## 1. Goal

A single internal console that lets an authorized human operate the entire
Hermes platform with full auditability:

- View the workforce, resources, applications, tasks, permissions, audit, health
- Approve / pause / retire agents through human gates
- Create and track controlled tasks
- Inspect agent permission + memory boundaries

**Constraint:** Internal-only. No public exposure. Every action authenticated,
authorized, and audited (inherited from the EPIC-002-006D workforce modules).

---

## 2. Dashboard Domains

The console is organized into six domains. Each maps to existing platform
contracts (read side) plus future UI requirements (write/visualize side).

### 2.1 Organization
| Concern | Source today | Future (EPIC-002-006E only) |
|---|---|---|
| Applications | `services/registry` (registered apps), `services/discovery` | Application list + ownership cards |
| Environments | `services/lifecycle`, resource `lifecycleState` | Environment matrix (dev/staging/prod) |
| Ownership | `registerResource({ owner })` metadata | Ownership tree / RACI view |

### 2.2 Resources
| Concern | Source today | Future (EPIC-002-006E only) |
|---|---|---|
| Registry inventory | `services/registry/registry.ts` (`registerResource`, `listResources`) | Searchable inventory table |
| Providers | `shared/interfaces/*` provider contracts, `services/providers` | Provider coverage board |
| Lifecycle state | `services/lifecycle`, `ResourceLifecycleState` | Lifecycle state badges + transition log |

### 2.3 AI Workforce
| Concern | Source today | Future (EPIC-002-006E only) |
|---|---|---|
| Agents | `agents/registry.ts` (`listAgents`, `getAgent`) | Agent roster + capability chips |
| Assignments | `services/agents/assignment.ts` (`listAssignments`, `agentsForApplication`) | Assignment matrix per application |
| Approvals | `services/agents/approval.ts` (`requestAgentApproval`, `approveAgent`) | Approval queue + human-gate action buttons |
| Permissions | `services/agents/permissions.ts` (`resolveAgentPermissions`, `listAgentPermissions`) | Permission grant viewer (separate from human perms) |
| Tasks | `services/agents/task.ts` (`listTasks`, `getTask`) | Task board / kanban |
| Lifecycle | `agents/registry.ts` state + `workforce/events.ts` | Lifecycle timeline per agent |

### 2.4 Operations
| Concern | Source today | Future (EPIC-002-006E only) |
|---|---|---|
| Task history | `services/agents/task.ts` (`listTasks({ status })`) | Filterable task history view |
| Events | `workforce/events.ts` (`readWorkforceAudit`) | Event stream / live feed |
| Audit trail | `audit/event.ts` (`readAuditBuffer`) | Correlated audit explorer (filter by actor/type) |

### 2.5 Security
| Concern | Source today | Future (EPIC-002-006E only) |
|---|---|---|
| Identities | `identity/principal.ts`, `identity/*` | Identity directory viewer |
| Permissions | `permissions/permissions.ts` + agent perms (`services/agents/permissions.ts`) | Permission matrix (human vs agent, side-by-side) |
| Authorization events | `audit/event.ts`, `workforce/events.ts` | Authz event monitor + deny alerts |

### 2.6 Platform Health
| Concern | Source today | Future (EPIC-002-006E only) |
|---|---|---|
| Services | `services/*` (registry, discovery, lifecycle, agents) | Service status panel |
| Providers | `services/providers`, `shared/interfaces` | Provider reachability / health |
| System status | `audit/event.ts` (startup/error events) | System health dashboard + anomaly signals |

---

## 3. Existing APIs / Contracts Available (consumed, not built)

These contracts already exist as of EPIC-002-006D and satisfy the console's
read + control surface. The console calls them **in-process (trusted runtime)** —
never over a public HTTP route.

| Capability | Module | Key exports |
|---|---|---|
| **Registry** | `hermes/services/registry/registry.ts` | `registerResource`, `listResources`, `getResource`, `_clearRegistry` |
| **Discovery** | `hermes/services/discovery/discovery.ts` | `discoverApplications`, `discoverResources` |
| **Lifecycle** | `hermes/services/lifecycle/lifecycle.ts` | `transitionAgent`, `transitionResource`, `canTransitionAgent` |
| **Agent Registry** | `hermes/agents/registry.ts` | `registerAgent`, `getAgent`, `listAgents`, `setState` |
| **Agent Assignment** | `hermes/services/agents/assignment.ts` | `assignAgentToApplication`, `listAssignments`, `getAssignment`, `agentsForApplication` |
| **Agent Approval** | `hermes/services/agents/approval.ts` | `requestAgentApproval`, `approveAgent`, `activateApprovedAgent`, `pauseAgent`, `resumeAgent`, `retireAgent`, `enableAgentForAssignment`, `disableAgentForAssignment` |
| **Tasks** | `hermes/services/agents/task.ts` | `createTask`, `assignTask`, `approveTask`, `startTask`, `completeTask`, `failTask`, `cancelTask`, `getTask`, `listTasks` |
| **Audit** | `hermes/audit/event.ts` | `emitAudit`, `readAuditBuffer` |
| **Permissions** | `hermes/services/agents/permissions.ts` + `hermes/permissions/permissions.ts` | `resolveAgentPermissions`, `authorizeAgentAction`, `agentHasPermission` (agent side); RBAC resolver (human side) |
| **Workforce Events** | `hermes/workforce/events.ts` | `WORKFORCE_EVENTS`, `emitWorkforceEvent`, `readWorkforceAudit`, `readWorkforceAuditByType`, `readWorkforceAuditByActor` |
| **Internal Workforce API** | `hermes/workforce/api.ts` | `apiListAgents`, `apiAssignAgent`, `apiRequestApproval`, `apiApproveAgent`, `apiPauseAgent`, `apiRetireAgent`, `apiEnableAgent`, `apiDisableAgent`, `apiCreateTask`, `apiAssignTask`, `apiViewTaskStatus`, `apiListTasks`, `apiResolveAgentPermissions`, `apiAuthorizeAgentAction`, `apiEvaluateMemoryAccess` |

---

## 4. Future Requirements Only (EPIC-002-006E scope — NOT built here)

These items require frontend, infrastructure, or deployment work that is
**explicitly out of scope for EPIC-002-006D**. They are listed so the
preparation is complete and the next EPIC has a ready backlog.

- **Frontend** — build the six dashboard domains as a single-page internal console.
- **Authentication UI** — console entry point that enforces an authenticated +
  authorized **human** principal before any `workforce/api.ts` call.
- **Dashboards** — render the six domains (Organization, Resources, AI Workforce,
  Operations, Security, Platform Health) with read views bound to §3 contracts.
- **Charts** — lifecycle timelines, task throughput, audit volume, health gauges.
- **Notifications** — surface approval-required events to humans (e.g. Telegram
  ops alert) so the human gate is actionable.
- **Operator workflows** — guided flows for approve / pause / retire / assign /
  create-task with confirmation + audit capture.

**Explicitly deferred (require approval, migrations, or external providers):**
1. **Persistence** — workforce modules currently use in-memory `Map` stores.
   A durable store (D1/sqlite) is required for production console state. No
   migrations without explicit owner approval.
2. **Memory provider** — Phase 5 (`memory.ts`) defines the boundary contract
   only; no real memory backend is wired (no external provider connected).
3. **Public exposure** — the console is internal-only; no public route is added.

---

## 5. State Machines the Console Must Render

**Agent lifecycle (governed):**
`registered → assigned → pending_approval → approved → active → paused → retired`
No direct `registered → active`. Retire is a terminal, recorded state.

**Task lifecycle (orchestration foundation):**
`created → assigned → approved → running → completed | failed | cancelled`

---

## 6. Guardrails Inherited from EPIC-002-006D

- No agent activation without explicit human approval.
- Least privilege: agents start with zero permissions (fail-closed).
- Deployment Agent has plan-prep ONLY — never `deploy:execute`.
- AGS Fertility remains isolated, unchanged, protected.
- Every phase reversible; no production secrets; no production data ownership.
