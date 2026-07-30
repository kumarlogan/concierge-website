# WEF Architecture Reconciliation

> **Phase B deliverable** — Unified view of the Workforce Execution Framework
> across all EPICs (002-006 through 005/006), mapping every discovered component,
> its status, connectivity, and gaps.
>
> Generated from 12 architecture-reference documents in
> `~/.hermes/skills/ag-synergy-platform/references/` + live code inspection.

## 1. Architectural Map

```
┌────────────────────────────────────────────────────────────────────────┐
│                     WORKFORCE EXECUTION FRAMEWORK (WEF)                   │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │   APPLICATION LAYER (EPIC-006 — Website Ops Wiring)             │   │
│  │   ┌────────────────────────┐  ┌──────────────────────────────┐   │   │
│  │   │ website.status/build  │  │ deploy.pages / analytics     │   │   │
│  │   │ publish/rollback      │  │ health/logs/version          │   │   │
│  │   └──────────────────┬─────┘  └──────────────┬───────────────┘   │   │
│  │                      │                        │                   │   │
│  │               ┌──────▼────────────────────────▼──────┐            │   │
│  │               │     runWebsiteCapability()           │            │   │
│  │               │     → executeCapability(cap,args,ctx) │            │   │
│  │               └──────────────────┬───────────────────┘            │   │
│  └──────────────────────────────────┼─────────────────────────────────┘
│                                     │
│  ┌──────────────────────────────────┼─────────────────────────────────┐
│  │   EXECUTION GATEWAY (EPIC-005.6/5.9)                            │ │
│  │                                     │                            │ │
│  │   ┌─────────────────────────────────▼────────────────────────┐   │ │
│  │   │        HermesExecutionGateway (single boundary)          │   │ │
│  │   │  ┌─────────────────────────────────────────────────────┐ │   │ │
│  │   │  │  StackBGatewayGuard (active+enabled+healthy+tenant) │ │   │ │
│  │   │  │  ↓ fail-closed                                    │ │   │ │
│  │   │  │  CapabilityExecutor(capId, args, ctx)             │ │   │ │
│  │   │  │  → ToolResult | Promise<ToolResult>               │ │   │ │
│  │   │  └──────────────────────┬─────────────────────────────┘ │   │ │
│  │   └─────────────────────────┼───────────────────────────────┘   │ │
│  └─────────────────────────────┼───────────────────────────────────┘
│                                │
│  ┌─────────────────────────────┼───────────────────────────────────┐
│  │   ACTIVATION PLATFORM (EPIC-002-007 — Stack B/C)                │
│  │  ┌──────────────────────────▼──────────────────────────────┐   │
│  │  │  Task Lattice: created→assigned→approved→running→done   │   │
│  │  │  Approval chain: capability approval → requestGitApproval│   │
│  │  │  → resumeAfterApproval → re-evaluate gates              │   │
│  │  └──────────────────────────┬──────────────────────────────┘   │
│  │                             │                                  │
│  │  ┌──────────────────────────▼──────────────────────────────┐   │
│  │  │  Tool Contracts: guardToolCall, resolveMemoryScope,     │   │
│  │  │  beginEphemeralRun/sealEphemeralRun, requestApproval    │   │
│  │  │  Application scoping, namespace separation              │   │
│  │  └─────────────────────────────────────────────────────────┘   │
│  └─────────────────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────────────────┐
│  │   WORKFORCE LAYER (EPIC-002-006D / EPIC-005 Phase 5)            │
│  │  ┌─────────────────────┐  ┌────────────────────────────────┐    │
│  │  │ Agent Lifecycle     │  │ Activation Validation          │    │
│  │  │ registered→assigned→│  │ ─ Gating rules                 │    │
│  │  │ pending_approval→   │  │ ─ Approval scoping             │    │
│  │  │ approved→active→    │  │ ─ Fail-closed enforcement      │    │
│  │  │ paused→retired      │  │ ─ Audit emission               │    │
│  │  └─────────┬───────────┘  └──────────────┬─────────────────┘    │
│  │            │                              │                     │
│  │  ┌─────────▼──────────────────────────────▼──────────────────┐  │
│  │  │  Workforce Persistence (D1)                              │  │
│  │  │  workforce_agents | agent_activation_requests |          │  │
│  │  │  agent_audit_events                                      │  │
│  │  └──────────────────────────────────────────────────────────┘  │
│  │                                                                 │
│  │  ┌──────────────────────────────────────────────────────────┐  │
│  │  │  Workforce Observability                                 │  │
│  │  │  Metrics: lifecycle transitions, execution, safety...    │  │
│  │  │  Health: per-agent health, workforce summary, activity   │  │
│  │  │  Safety: repeated failures, unauthorized access, ...     │  │
│  │  └──────────────────────────────────────────────────────────┘  │
│  └─────────────────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────────────────┐
│  │   ADMIN PLATFORM (EPIC-002-006E/F)                             │
│  │  ┌────────────────┐ ┌───────────────┐ ┌──────────────────┐     │
│  │  │ BFF            │ │ Governance    │ │ UI (Console)     │     │
│  │  │ bffBootstrap   │ │ viewGovernance│ │ Dashboard IA     │     │
│  │  │ bffDomain      │ │ Adrs/Policies │ │ 6-domain view    │     │
│  │  │ assertHuman    │ │ /Approvals    │ │ Console shell    │     │
│  │  │ requireDomain  │ └───────────────┘ └──────────────────┘     │
│  │  └────────────────┘                                            │
│  │  + Tool Providers: dev-tools, security-tools, docs-tools, ...  │
│  └─────────────────────────────────────────────────────────────────┘
│
│  ┌─────────────────────────────────────────────────────────────────┐
│  │   PLATFORM CORE SERVICES (EPIC-002-006C)                       │
│  │  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐            │
│  │  │ Identity │ │ Perms  │ │ Audit    │ │ Document  │            │
│  │  │ (16 mods)│ │ RBAC   │ │ Events   │ │ Service   │            │
│  │  │ JWT/MFA/ │ │ Engine │ │ Emitter  │ │ (D1 arch) │            │
│  │  │ OAuth/etc│ └────────┘ └──────────┘ └───────────┘            │
│  │  └──────────┘                                                  │
│  │  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌───────────┐            │
│  │  │ Consent  │ │ Trust  │ │ Policy   │ │ Risk      │            │
│  │  │ Engine   │ │ Engine │ │ Engine   │ │ Engine    │            │
│  │  └──────────┘ └────────┘ └──────────┘ └───────────┘            │
│  └─────────────────────────────────────────────────────────────────┘
```
## 2. Component Maturity

### Committed & Deployed (production)
| Component | Evidence |
|---|---|
| Identity Core v1 (16 modules, 514+ tests) | `workers/src/platform/identity/` + migration 0002 |
| Platform Engines (Consent, Trust, Policy, Risk, Document) | `workers/src/platform/{trust,documents}/` + migrations 0001–0007 |
| JWT key rotation, MFA (TOTP/SMS/recovery), OAuth (Google/OIDC) | Identity Core modules |
| D1 persistence pattern (DocumentService archetype) | DocumentService with `db?` + `durable` flag |
| Hermes Platform Extraction (identity/permissions/audit → hermes/) | EPIC-002-006B — P1–P7 committed |
| Stack B Execution Path (108/108) | `provider-framework.ts` + `StackBGatewayGuard` |
| Admin Platform Foundation + BFF (205+217 passing) | EPIC-002-006E/F committed |

### Designed, Verified, but Not Deployed in Prod
| Component | Status | Barrier |
|---|---|---|
| Workforce agent lifecycle + persistence | Schema migrated (0005), code in `hermes/services/workforce/` | No activation sequence wired in prod `index.ts` |
| Workforce observability | Code in `hermes/services/workforce/observability.ts` | Not wired — activation-first dependency |
| Activation Platform (Stack B/C task lattice) | Tests pass (16/16), code in `hermes/services/activation/` | No orchestrator deployment config |
| EPIC-006 Website Ops wiring (75/75) | 10 capabilities defined, test suite green | CLI executors not wired — deploy-phase only |
| HermesExecutionGateway in prod | Code present, guard logic validated | Durable ApprovalRef model still non-empty-string check |
| Console UI (6-domain dashboard) | `hermes/admin/console/` shell + viewmodels | Not deployed — activation-first dependency |

### Designed but Not Yet Built
| Component | EPIC | Notes |
|---|---|---|
| Durable ExecutionApproval (G2/G3) | Stack B s5–s9 | Current: non-empty-string presence check (self-issued "human-token") |
| Approval-modeling phase | Stack B s5–s9 | Deferred from Stack B close-out |
| ExecutionStore durability (G9/G12) | Stack B s5–s9 | Defaults to in-memory |
| approveTask arbitrary-approver weakness (G8) | Stack C | Known gap |
| Provider Runtime Security enforcement | EPIC-005.4/5.5/5.7 | Designed in docs, `SandboxPolicy` declared but not read |
| Full activation-to-execution chain in prod | WEF v2 | All pieces exist in isolation, integration pending |

## 3. Architectural Patterns (Emerged)

### 3.1 Dual-Path Persistence (DocumentService Archetype)
```
Write: cache.set() → D1 INSERT        (cache always first)
Read:  D1 SELECT → cache.set() → return  (D1-first, warm cache on hit)
Test:  no db → in-memory only           (zero-code-change for unit tests)
```
Used by DocumentService, proposed for ConsentEngine extension. The `lazy warmCache` variant exists for hot-path evaluate loops (consent/trust/risk).

### 3.2 Provider-Neutral Backend Contracts
Each capability domain defines a typed interface (`CloudflareBackend`, `GitHubBackend`). Tests inject mock backends. Real executors wired at deploy time. No vendor names in capability definitions.

### 3.3 Bounded Context Seams
```
App → runCapability → executeCapability → Gateway → Guard → Executor → Backend
         ↑                                  ↑                     ↑
    app layer                         hermes/                deploy-time
    (workers/src)                     (platform lib)         (provider wiring)
```

### 3.4 Fail-Closed by Default
- Config validators return `NOT_INSTALLED` → provider skipped
- Gate functions index policy maps → unknown action = `human`
- Production env always requires `ApprovalRef`
- Unresolved capability → `ok:false`
- Agents: disabled by default, non-autonomous
- Every `executeCapability` with `env:"production"` without `ApprovalRef` → denied

## 4. Known Gaps

### G1 — Workforce not wired to the API
The workforce layer (agents, activation, lifecycle) exists in `hermes/services/workforce/` with D1 schema (0005) applied, but no activation sequence wires it into the production Worker's `index.ts`. Agents are defined but unreachable from the API.

### G2 — ExecutionApproval is a stub
Stack B's approval token is still a non-empty-string presence check (`"human-token"`). The durable `ExecutionApproval` model with full approval lifecycle (request → grant → expire → revoke) is designed but not implemented.

### G3 — No autonomous agent scheduling
By design (agents are `disabled` + `non-autonomous`), but the infrastructure for eventual controlled scheduling (task lattice → orchestrate → execute) exists in code without a deployment path.

### G4 — Observability is worker-internal
Workforce observability metrics flow into D1 but have no dashboard or real-time alerting connector. The observability service detects safety violations but has no notification channel (deferred by EPIC constraints).

### G5 — CLI executors not wired
EPIC-006's website ops wiring has 75/75 tests passing with mock backends, but real `gh`/`wrangler` executors are injected at deploy time and haven't been exercised.

### G6 — D1 migrations not auto-applied
`wrangler.jsonc` has no `migrations_dir` → CI pipeline does not apply pending `.sql` files. The `cfat_` deploy token lacks D1 edit permission (code 7403). Any feature needing a new D1 table requires manual `wrangler d1 execute --remote` with a D1-enabled token.

## 5. Layer Dependency Graph

```
Identity Core ──────→ Permissions ────→ Audit
      │                                      │
      ├──→ Consent Engine ──────────────→ Document Service
      │         │                              │
      ├──→ Trust Engine                     R2 Storage
      │         │
      ├──→ Policy Engine
      │         │
      ├──→ Risk Engine
      │
      └──→ Admin Platform (BFF) ──→ Console UI
                │
                ├──→ Governance Views
                │
                └──→ Workforce View ──→ Agent Lifecycle
                                              │
                          Activation Platform ←┘
                                │
                    HermesExecutionGateway
                                │
                  ┌─────────────┴──────────────┐
                  │                            │
           Stack B Guard              Developer Agent
                  │                    Security Agent
        Provider Runtimes                    │
          (gh, wrangler, code)       Tool Contract Layer
```

## 6. Evolution Vectors (WEF v2 Entry Points)

From this reconciliation, the WEF v2 evolution can target these dimensions:

1. **Activation-to-Execution Chain** — Wire workforce + activation + gateway end-to-end
2. **Durable Approval Model** — Replace stub token with lifecycle-managed approvals
3. **Durable ExecutionStore** — Persist task state beyond in-memory
4. **Provider Runtime Security** — Enforce `SandboxPolicy` at the guard level
5. **Observability-to-Notification** — Surface workforce metrics to operators
6. **CLI Executor Activation** — Wire real gh/wrangler backends for website ops
7. **Multi-Agent Orchestration** — Controlled scheduling via task lattice

Each vector is orthogonal — they can be addressed in any order based on priority.

---

*This document was generated by analyzing 12 architecture-reference documents
covering EPIC-002-006B through EPIC-006. Files are read-only; the working tree
(HEAD `864f213`) is unmodified by this reconciliation.*