# WEF v2 Evolution Blueprint

> **Phase C deliverable** — The next-generation organizational operating system
> that bridges WEF v1's individually-validated components into an integrated,
> deployable execution fabric with cognitive efficiency as a first-class property.
>
> **Mission:** Transform the AGS Concierge platform from a collection of
> validated-but-disconnected capabilities into a unified operating system
> where every component is reachable, observable, and orchestrated.

## 1. Guiding Principles

### 1.1 Fail-Closed is Non-Negotiable
Every integration point must preserve the existing fail-closed property. An activation that cannot reach its approval gate must remain denied — not silently pass through. WEF v1 achieved this at the component level; WEF v2 extends it to the system level.

### 1.2 Integration Before Innovation
WEF v1 has 6 identified gaps where components exist in isolation but aren't wired together. WEF v2's primary delta is **wiring** — not new capability. The activation sequence, the execution path, the persistence layer, and observability must form a continuous chain before adding new features.

### 1.3 Cognitive Efficiency as a First-Class Property
The operating system must reduce operator cognitive load, not increase it. Every new integration must be traceable from a single dashboard. Every failure must surface with context. Every approval decision must be reversible.

### 1.4 Provider-Neutral by Default
All capability definitions remain vendor-neutral. Real executors are injected at deploy time. No vendor name appears in the activation/execution/observability path.

### 1.5 Ephemeral by Default, Persistent by Design
Agents run in ephemeral sandboxes unless explicitly configured otherwise. Persistent state requires explicit policy opt-in. Scratch state is discarded on seal.

## 2. WEF v2 Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                        WEF v2 — ORGANIZATIONAL OS                         │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  1. ORCHESTRATION FABRIC (new integration layer)                 │    │
│  │                                                                  │    │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │    │
│  │  │ Agent        │  │ Task         │  │ Approval     │           │    │
│  │  │ Orchestrator │  │ Scheduler    │  │ Manager      │           │    │
│  │  │ • register   │  │ • queue      │  │ • request    │           │    │
│  │  │ • assign     │  │ • dispatch   │  │ • approve    │           │    │
│  │  │ • activate   │  │ • retry      │  │ • expire     │           │    │
│  │  │ • deactivate │  │ • cancel     │  │ • revoke     │           │    │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘           │    │
│  │         └─────────────────┼──────────────────┘                   │    │
│  │                           │                                      │    │
│  └───────────────────────────┼──────────────────────────────────────┘    │
│                               │                                          │
│  ┌───────────────────────────┼──────────────────────────────────────┐    │
│  │  2. EXECUTION CHAIN (wired from WEF v1)                          │    │
│  │                           │                                      │    │
│  │  ┌────────────────────────▼────────────────────────────────┐     │    │
│  │  │  HermesExecutionGateway (single boundary — unmodified)  │     │    │
│  │  │  StackBGatewayGuard (active+enabled+healthy+tenant)     │     │    │
│  │  │  CapabilityExecutor(capId, args, ctx) → ToolResult      │     │    │
│  │  └────────────────────────┬────────────────────────────────┘     │    │
│  │                           │                                      │    │
│  │  ┌────────────────────────▼────────────────────────────────┐     │    │
│  │  │  Provider Runtime (gh, wrangler, code, ...)             │     │    │
│  │  │  → Mock for tests, real CLI exeutors at deploy          │     │    │
│  │  └─────────────────────────────────────────────────────────┘     │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  3. PERSISTENCE & OBSERVABILITY (extended from WEF v1)            │    │
│  │                                                                  │    │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐     │    │
│  │  │ Workforce D1     │  │ ExecutionStore  │  │ Observability│     │    │
│  │  │ • agents         │  │ (durable, not   │  │ • metrics    │     │    │
│  │  │ • activation_req │  │  just in-memory)│  │ • health     │     │    │
│  │  │ • audit_events   │  │ • task history  │  │ • safety     │     │    │
│  │  └─────────────────┘  └─────────────────┘  └──────┬───────┘     │    │
│  │                                                    │             │    │
│  │  ┌─────────────────────────────────────────────────▼──────────┐  │    │
│  │  │  Notification Adapter (new — connects observability→ops)    │  │    │
│  │  │  → Telegram / Admin Bot / Admin Console dashboard          │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  4. COGNITIVE EFFICIENCY LAYER (new)                              │    │
│  │                                                                  │    │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │    │
│  │  │ Status     │  │ Timeline   │  │ Decision   │  │ Blocker  │  │    │
│  │  │ Dashboard  │  │ View       │  │ Log        │  │ Registry │  │    │
│  │  │ • live      │  │ • history  │  │ • full     │  │ • active │  │    │
│  │  │ • per-agent │  │ • filters  │  │   audit    │  │ • triage │  │    │
│  │  │ • system    │  │ • search   │  │   trail    │  │ • resolve│  │    │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  5. ADMIN INTERFACE (extended from WEF v1 Admin Platform)         │    │
│  │                                                                  │    │
│  │  ┌──────────────────────────────────────────────────────────┐   │    │
│  │  │  BFF (unmodified from EPIC-002-006E/F)                    │   │    │
│  │  │  → assertHumanPrincipal + requireDomainRead + audit       │   │    │
│  │  └──────────────────────┬───────────────────────────────────┘   │    │
│  │                         │                                       │    │
│  │  ┌──────────────────────▼───────────────────────────────────┐   │    │
│  │  │  Console UI (6-domain IA — unmodified)                    │   │    │
│  │  │  → governance, infrastructure, operations, organization,  │   │    │
│  │  │    security, workforce                                    │   │    │
│  │  └──────────────────────────────────────────────────────────┘   │    │
│  └──────────────────────────────────────────────────────────────────┘    │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐    │
│  │  6. PLATFORM CORE SERVICES (unmodified from WEF v1)              │    │
│  │  → Identity, Permissions, Audit, Consent, Trust, Policy, Risk,   │    │
│  │    Document — all deployed and stable                             │    │
│  └──────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────────────┘
```

## 3. Integration Phases

Each phase produces a **verifiable integration point** — not just design docs,
but green test suites and deployable wiring.

### Phase C1 — Orchestrator Wiring
**Bridge:** Agent lifecycle (WEF v1) → Task lattice (EPIC-002-007) → Execution Gateway (EPIC-005.6)

| From | To | New Code |
|---|---|---|
| `agent.register()` → returns agent id | `createTask(id, action, ctx)` → task in `created` state | Wire orchestration.ts into index.ts |
| `assignTask(id, actor)` → `assigned` | `approveTask(id, actor)` → `approved` | Approval token minting path |
| `orchestrate(id)` → `running` | `executeCapability(capId, args, ctx)` → Gateway | Integration test (worker-level) |

**Verification:** A test that registers an agent, creates a task, approves it, and executes a capability through the gateway end-to-end — using mock backends.

### Phase C2 — Durable Execution Model
**Bridge:** ExecutionStore (in-memory) → D1 persistence

| Component | Current | Target |
|---|---|---|
| `ExecutionStore` | `Map<string, TaskExecution>` in-memory | D1-backed via DocumentService archetype |
| `ExecutionApproval` | Non-empty-string check | `DurableApproval` with lifecycle (request→grant→expire→revoke) |
| Task history | Lost on restart | Queryable from D1 `task_executions` table |

**Verification:** Create a task, approve it, execute it. Restart the Worker. Query task history — still present. Approval state survives restart.

### Phase C3 — Real CLI Execution
**Bridge:** Mock backends → real `gh`/`wrangler` executors

| Capability | Backend | Deploy Wiring |
|---|---|---|
| `website.status` | `connectCloudflareBackend()` | Env var: `CLOUDFLARE_API_TOKEN` |
| `website.deploy` | `connectCloudflareBackend()` | Env var: `CLOUDFLARE_API_TOKEN` |
| `deploy.pages` | `connectGitHubBackend()` | Env var: `GITHUB_TOKEN` |
| `dev.code.generate` | `setClaudeCodeExecutor()` | Env var: `CLAUDE_CODE_PATH` |

**Verification:** `tsx` runtime tests with real CLI stubs (not mocks). Dry-run returns valid plans. Production executions still require `ApprovalRef`.

### Phase C4 — Observability→Notification
**Bridge:** Workforce observability metrics → operator alerting

| Observable Event | Notification Channel | Severity |
|---|---|---|
| Agent suspended | Admin Bot (Telegram) | WARN |
| Repeated failures (5+/hour) | Admin Bot | ERROR |
| Safety violation | Admin Bot | CRITICAL |
| Execution denied (unresolved capability) | Log only | DEBUG |

**Verification:** Trigger a safety violation in test → verify Telegram channel receives formatted alert.

### Phase C5 — Production Activation Sequence
**Bridge:** All previous phases → deploy to production

**Sequence:**
1. Run `pnpm run typecheck:libs` — zero errors (hermes/)
2. Run `cd workers && pnpm test` — all tests green (baseline + new)
3. Run `grep -rEn "bypass|skipGuard|human-token" hermes/` — clean
4. Deploy Worker to preview → smoke test activation endpoints
5. Apply any new migrations via D1-enabled token
6. Deploy Worker to production

## 4. Cognitive Efficiency Analysis

The WEF v2 operating system reduces operator cognitive load along these axes:

### 4.1 Traceability
**Current (WEF v1):** To trace an execution from agent → approval → execution → result, an operator must cross-reference 4+ files across `workers/tests/`, `hermes/services/activation/`, `hermes/services/workforce/`, and the audit event log.

**WEF v2 Target:** A single `GET /api/v1/workforce/trace/{executionId}` returns the full chain: agent state, approval request, approval decision, capability call, guard decision, executor result, audit events. Available from the Admin Console's Timeline View.

### 4.2 Failure Diagnosis
**Current (WEF v1):** When a capability is denied, the operator sees `{ ok: false, error: "..." }`. The context (why the guard denied it, which provider was active, what the approval scoping looked like) requires manually checking the audit buffer.

**WEF v2 Target:** Denied executions emit structured error events with: guard stage, active provider, requester's permissions, applied scope, and a reference to the audit event. The operator sees one card with all diagnosis data.

### 4.3 Approval Management
**Current (WEF v1):** The approval token is a non-empty string (`"human-token"`). There is no lifecycle — it never expires, can't be revoked, and has no parent task reference.

**WEF v2 Target:** Every approval has a `DurableApproval` record with: id, task reference, grant scope, valid window, status (pending/active/expired/revoked), and approval chain (who approved it, at what stage). Revocable. Observable via the Decision Log.

### 4.4 Organizational Visibility
**Current (WEF v1):** Workforce summary exists in code (`getWorkforceSummary()`, `getAgentHealth()`) but isn't exposed through any API endpoint or dashboard.

**WEF v2 Target:** The Admin Console's Workforce domain shows: agent roster and status, recent activations, pending approvals, health summary, and safety alerts — all driven by the existing observability data already flowing into D1.

## 5. Key Architectural Decisions

### ADR-WEF-001: Orchestrator is a Service, Not a Monolith
The Orchestration Fabric is implemented as a service within `hermes/services/workforce/orchestration.ts` (extending the existing module), not a new separate process. This preserves the existing audit/secrecy/tenant context and avoids introducing a new deployment artifact.

### ADR-WEF-002: Durable ExecutionStore Uses DocumentService Archetype
The ExecutionStore follows the `db?` + `durable` flag pattern: `Map<string, TaskExecution>` in-memory cache + D1 `task_executions` table. Tests without D1 use pure in-memory. Production uses dual-path. No new architectural pattern.

### ADR-WEF-003: Approval Model Extends Existing Tool Contracts
The `DurableApproval` record lives in `hermes/services/activation/` and extends the existing `ToolApprovalKind` from `tool-contracts.ts`. The same `requestApproval()`/`guardToolCall()` contract applies — only the backing store changes from `"human-token"` to a `DurableApproval` with lifecycle.

### ADR-WEF-004: Notification Adapter Uses Existing Gateway
Observability→notification flows through the existing Admin Bot (`/admin/webhook`) and Telegram Bot (`/telegram/webhook`) endpoints — not a new channel. The observability service emits events; the bots format and deliver them. No new infrastructure.

### ADR-WEF-005: All Phases Are Reversible
Every integration phase must be a reversible commit (single `git revert` restores the previous state). No phase modifies core components (`HermesExecutionGateway`, `StackBGatewayGuard`, Trust/Identity/Document engines). Extension only.

## 6. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Orchestration → Gateway integration breaks fail-closed | Low | Critical | Every integration test asserts denied state for unapproved tasks. Dedicated test: `unapproved_task_cannot_execute` |
| Durable ExecutionStore introduces latency on hot path | Medium | Medium | DocumentService lazy-warm pattern (cache hit = 0 D1 calls). D1 queries are ~5ms — acceptable for administration flows |
| Notification adapter floods operators | Low | Low | All notifications are WARN+ severity by default. Configurable per-channel via existing `/telegram/notify` level system |
| CLI executor wiring exposes credentials | Low | Critical | Secret-source abstraction (EPIC-006 pattern #2). All credentials through `resolveSecret()` — never hardcoded |
| D1 migration applied out of order | Low | Medium | Sequential migration numbering (next: `0008`). Manual apply with D1-enabled token, not auto-applied by CI |

## 7. Success Criteria

The WEF v2 operating system is complete when:

1. ✅ A single operator can **register an agent**, **create a task**, **approve it**, **execute a capability**, and **see the result** — all through the Admin Console
2. ✅ Every execution produces a **traceable audit trail** from agent→approval→guard→executor→result
3. ✅ A **production deployment** requires an explicit `ApprovalRef` at every stage
4. ✅ The **observability dashboard** shows live agent health, recent activity, and safety alerts
5. ✅ **Zero core files modified** — all integration is extension through existing seams
6. ✅ **All existing tests pass** — no regressions across 614+ baseline + new integration suites

---

*This blueprint was generated from the WEF Architecture Reconciliation (Phase B)
and the full reference library of 12 architecture documents. It proposes
integration phases, not new component design — respecting the rule that
WEF v2's primary delta is wiring, not invention.*