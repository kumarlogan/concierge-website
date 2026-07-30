# Cognitive Efficiency

> **Phase D deliverable** — How the WEF v2 operating system reduces operator
> cognitive load as a first-class property of the architecture.
>
> This document defines the operator experience model: what an operator sees,
> how they diagnose failures, how they manage approvals, and how the platform
> actively reduces mental overhead rather than adding to it.

## 1. Cognitive Load Model

Every interaction between an operator and WEF has a cognitive cost. We model
this as three axes:

| Axis | Description | WEF v1 Cost | WEF v2 Target |
|---|---|---|---|
| **Discovery** | Time to find relevant state (agent status, execution history, audit trail) | High — cross-reference 4+ files across 3 directory trees | Low — single trace endpoint from Admin Console |
| **Diagnosis** | Time to understand why something failed or was denied | High — error object without context | Low — structured error with stage, guard, scope, and audit ref |
| **Decision** | Time to make an approval/rejection decision | Medium — no lifecycle or context for approvals | Low — approval card with full task context, grant scope, valid window |

Reducing any axis reduces total operator cognitive load. WEF v2 targets all three.

## 2. The Four Cognitive Tools

### 2.1 Status Dashboard

**Purpose:** Answer "what is the state of the system right now?" in \<1 second.

```
┌────────────────────────────────────────────────────────────────────────┐
│  WEF OPERATIONS DASHBOARD — LIVE                                        │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐               │
│  │ Active Agents │  │ Pending       │  │ Failed Today  │               │
│  │      3        │  │ Approvals     │  │      0        │               │
│  │ ───────────── │  │      2        │  │ ───────────── │               │
│  │ website-bot   │  │ 🟡 deploy-site│  │ Last error    │               │
│  │ security-scan │  │ 🟡 backup-db  │  │ 7h ago:       │               │
│  │ data-sync     │  │               │  │ timeout       │               │
│  └──────┬────────┘  └──────┬────────┘  └──────┬────────┘               │
│         │                  │                  │                         │
│  ┌──────▼──────────────────▼──────────────────▼────────┐               │
│  │  Agent          │ Status    │ Last Active │ Health   │               │
│  │  website-bot    │ ● active  │ 2m ago      │ ✅       │               │
│  │  security-scan  │ ● active  │ 15s ago     │ ✅       │               │
│  │  data-sync      │ ● active  │ 30s ago     │ ✅       │               │
│  │  email-notifier │ ◐ paused  │ 1h ago      │ ⏸       │               │
│  │  audit-walker   │ ○ disabled│ 3d ago      │ ⚪       │               │
│  └──────────────────────────────────────────────────────┘               │
└────────────────────────────────────────────────────────────────────────┘
```

**Implementation:** The dashboard data is already collected by `getWorkforceSummary()`
and `getAgentHealth()` in the observability service. WEF v2 exposes them through
the Admin Console's existing 6-domain IA (workforce domain).

**Cognitive reduction:** Previously, an operator ran `wrangler tail` or grepped
audit logs to see agent activity. Now they see it in one view.

### 2.2 Timeline View

**Purpose:** Answer "what happened and in what order?" for any execution or time window.

```
┌────────────────────────────────────────────────────────────────────────┐
│  EXECUTION TRACE: 7a5b751-ef42                                        │
│                                                                        │
│  ┌─ Agent Registration ────────────────────────────────────────────┐   │
│  │ agent: website-bot | registered | 2026-07-29 14:23:01 UTC       │   │
│  │ initiator: admin@agsynergy.ca                                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─ Task Creation ──────────────────────────────────────────────────┐   │
│  │ task: deploy-site | status: pending_approval | 14:23:05 UTC      │   │
│  │ action: deploy.pages | target: preview                           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─ Approval ───────────────────────────────────────────────────────┐   │
│  │ approved by: admin@agsynergy.ca | 14:23:30 UTC                   │   │
│  │ scope: { env: "preview", allow: ["website.deploy"] }             │   │
│  │ valid_until: 14:33:30 UTC                                        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─ Execution Gateway ──────────────────────────────────────────────┐   │
│  │ capability: deploy.pages | approved: true | 14:23:31 UTC          │   │
│  │ guard: StackBGatewayGuard | stage: active+enabled+healthy+tenant  │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─ Executor ───────────────────────────────────────────────────────┐   │
│  │ provider: wrangler | exit_code: 0 | duration: 8.4s              │   │
│  │ output: "Published to https://preview.agsynergy.pages.dev"      │   │
│  │ stored_artifacts: ["wrangler-publish-log.txt"]                   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│       │                                                                  │
│       ▼                                                                  │
│  ┌─ Audit Event ────────────────────────────────────────────────────┐   │
│  │ event: execution.completed | trace_id: 7a5b751-ef42              │   │
│  │ stored in: workforce_agents | agent_audit_events                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└────────────────────────────────────────────────────────────────────────┘
```

**Implementation:** New `GET /api/v1/workforce/trace/{executionId}` endpoint.
This is a read-only query across D1 (workforce_audit_events + task_executions)
— no new infrastructure.

**Cognitive reduction:** Previously, an operator reconstructed the chain from
partial logs. Now a single endpoint returns the complete, ordered sequence.

### 2.3 Decision Log

**Purpose:** Answer "what decisions were made and why?"

| Timestamp | Decision | Actor | Entity | Reason | Reversible |
|---|---|---|---|---|---|
| 14:23:30 | ✅ Approved | admin | task:deploy-site (preview) | "Testing branch deploy workflow" | Yes — revoke |
| 13:15:00 | ❌ Denied | system | capability:db.drop | Not in approved capability list | N/A — automated |
| 12:00:00 | ⏸ Paused | operations | agent:email-notifier | "Consent reflow in progress" | Yes — resume |
| 11:30:00 | 🔄 Retried | system | task:backup-db (attempt 2/3) | "D1 timeout on attempt 1" | N/A — automated |

**Implementation:** New `GET /api/v1/governance/decisions` endpoint reading
from workforce_audit_events. Filters: `actor`, `entity_type`, `decision`,
`timerange`.

**Cognitive reduction:** Previously, decisions were distributed across audit
events, test assertions, and code comments. Now they're a first-class
queryable view.

### 2.4 Blocker Registry

**Purpose:** Answer "what's blocking progress and what's being done about it?"

| Blocker | Severity | Impact | Owner | Status |
|---|---|---|---|---|
| Durable Approval not implemented | Medium | Approval token is stub | Engineering | 🟡 Designed — pending implementation |
| D1 deploy token lacks edit permission | High | Cannot auto-apply migrations | Operations | 🔴 Blocked — needs token rotation |
| CLI executors not wired | Low | Website ops not fully automated | Engineering | 🟢 Wired in test — pending production |
| Observability→notification missing | Low | Safety violations unnoticed | Engineering | 🟢 Designed — pending implementation |

**Implementation:** The blocker registry is a living view derived from the
Blueprint's known gaps (Phase B §4) + live system state. It points to the
relevant integration phase.

**Cognitive reduction:** Previously, blockers lived in meeting notes or
mental context. Now they're permanent, queryable, and traceable to their
resolution path.

## 3. Cognitive Load Reduction by Interaction

### 3.1 "What agents are running?"

| Metric | WEF v1 | WEF v2 |
|---|---|---|
| Steps required | 4+ (grep log, check D1, check code, cross-reference) | 1 (open Dashboard) |
| Time to answer | 2-5 minutes | \<1 second |
| Context switches | 3+ (terminal → code → D1 browser) | 0 |

### 3.2 "Why was that execution denied?"

| Metric | WEF v1 | WEF v2 |
|---|---|---|
| Steps required | 5+ (find error, find audit event, find guard state, check activation, check provider) | 1 (open Trace) |
| Time to answer | 5-15 minutes | \<5 seconds |
| Certainty | Medium (must cross-reference) | High (single source) |

### 3.3 "Who approved this and why?"

| Metric | WEF v1 | WEF v2 |
|---|---|---|
| Steps required | N/A (no approval record exists) | 1 (open Decision Log) |
| Time to answer | Unknown | \<3 seconds |
| Auditability | None | Full trail |

## 4. Implementation Path

The four cognitive tools map to existing or minimally-extended code paths:

| Tool | Primary Data Source | New Code | D1 Query |
|---|---|---|---|
| Status Dashboard | `getWorkforceSummary()` + `getAgentHealth()` | Admin Console workforce view | `SELECT count(*) ... GROUP BY status` |
| Timeline View | `agent_audit_events` | New `GET /api/v1/workforce/trace/:id` | `SELECT * FROM agent_audit_events WHERE execution_id = ?` |
| Decision Log | `agent_audit_events` | New `GET /api/v1/governance/decisions` | `SELECT * FROM agent_audit_events WHERE event_type LIKE 'decision.%'` |
| Blocker Registry | Blueprint gaps + live system | Static doc + dynamic check | `SELECT count(*) FROM active_blockers` (or hardcoded) |

## 5. Anti-Patterns (What We Do NOT Do)

| Anti-Pattern | Why Not |
|---|---|
| **Dashboard as a separate service** | Adds deployment artifact, network hop, auth surface. Unnecessary — the existing Admin Console shell is sufficient. |
| **Real-time push via WebSocket** | Adds complexity without need. The observability service already polls at configurable intervals. Poll-driven views with manual refresh match operator expectation. |
| **ML-powered anomaly detection** | Premature. The system doesn't have enough execution data for meaningful models. Start with threshold-based alerts. |
| **Every failure must notify** | Operator desensitization. WEF v2 uses WARN+ severity (matching the Telegram notification level system). Unresolved capability errors are DEBUG. |
| **Rewrite existing tools** | The cognitive tools are extensions, not replacements. The existing `runCapability`, `executeCapability`, `Guard`, and audit event system remain unchanged. |

## 6. Verification

The cognitive efficiency layer is verified by operator walkthrough:

1. 📋 Open Admin Console → Workforce domain → see 5 agent statuses in \<1s
2. 📋 Click an agent → see full activity timeline with ordered events
3. 📋 Click a denied execution → see structured error with guard stage, scope, and audit ref
4. 📋 Navigate to Decision Log → filter by `actor:system` → see all automated denials
5. 📋 Open Blocker Registry → see known gaps linked to Blueprint phases

Each walkthrough is a scripted integration test — not a manual QA pass.

---

*This document is Phase D of the WEF v2 Evolution Blueprint (Phase C).
It extends the cognitive efficiency layer introduced in the Blueprint
into a detailed operator experience model with implementation paths.*