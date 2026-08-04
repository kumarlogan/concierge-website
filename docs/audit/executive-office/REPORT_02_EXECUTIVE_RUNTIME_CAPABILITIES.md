# Executive Runtime Capabilities

> **Audit Date:** 2026-08-04T05:03:23Z
> **Scope:** All runtime components that execute work, manage state, and enforce governance
> **Auditor:** Hermes Agent — Executive Office Discovery
> **Methodology:** READ-ONLY source code analysis + document reconciliation
> **Status:** COMPLETE

---

## 1. Runtime Architecture Overview

The Executive Runtime is the execution layer that orchestrates all platform capabilities.
It is composed of 10 interconnected subsystems:

```
┌─────────────────────────────────────────────────────────────────┐
│                    EXECUTIVE RUNTIME                           │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  EPCL         │  │  WAS          │  │  WEF               │  │
│  │  Planning &   │  │  Workforce    │  │  Execution         │  │
│  │  Control      │  │  Activation   │  │  Framework         │  │
│  └──────┬───────┘  └──────┬───────┘  └────────┬───────────┘  │
│         │                 │                    │               │
│  ┌──────▼─────────────────▼────────────────────▼───────────┐  │
│  │              EXECUTION GATEWAY                          │  │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────────┐ │  │
│  │  │Approval │ │Policy   │ │Tenant   │ │Idempotency  │ │  │
│  │  │Gate     │ │Eval     │ │Enforce  │ │Check        │ │  │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────────┘ │  │
│  └────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Trust        │  │  Identity     │  │  Observability     │  │
│  │  Runtime      │  │  Core         │  │  & Audit           │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │  Workflow     │  │  Release      │  │  Deployment        │  │
│  │  Engine       │  │  Orchestrator │  │  Resolution        │  │
│  └──────────────┘  └──────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Runtime Subsystem Inventory

### 2.1 EPCL — Executive Planning & Control Layer
| Component | File | Lines | Status |
|---|---|---|---|
| PlanningEngine | `workers/src/platform/epcl/execution-planner.ts` | — | Production |
| RoadmapEngine | `workers/src/platform/epcl/roadmap-engine.ts` | — | Production |
| DisciplineRouter | `workers/src/platform/epcl/discipline-selector.ts` | — | Production |
| ContextBudgetManager | `workers/src/platform/epcl/context-budget-manager.ts` | — | Production |
| TokenBudgetManager | `workers/src/platform/epcl/token-budget-manager.ts` | — | Production |
| ExecutiveDashboard | `workers/src/platform/epcl/executive-dashboard.ts` | — | Production |
| FeatureFlags | `workers/src/platform/epcl/feature-flags.ts` | — | Production |
| PlanAtomService | `workers/src/platform/epcl/plan-atom-service.ts` | — | Production |
| ApprovalManager | `workers/src/platform/epcl/approval-manager.ts` | — | Production |
| RecoveryManager | `workers/src/platform/epcl/recovery-manager.ts` | — | Production |
| KnowledgeCapturer | `workers/src/platform/epcl/knowledge-capturer.ts` | — | Production |
| ExecutiveReporter | `workers/src/platform/epcl/executive-reporter.ts` | — | Production |
| ExecutiveWorkflow | `workers/src/platform/epcl/executive-workflow.ts` | — | Production |
| CapabilitySelector | `workers/src/platform/epcl/capability-selector.ts` | 426 | Production |
| EPCL Index | `workers/src/platform/epcl/index.ts` | — | Production |
| EPCL Types | `workers/src/platform/epcl/types.ts` | — | Production |

**EPCL Interface:** `hermes/contracts/planning.ts` — defines `PlanningEngine`, `RoadmapEngine`, `DisciplineRouter`, `ContextBudgetManager`, `TokenBudgetManager`, `ExecutiveDashboard`, `FeatureFlags`, `PlanAtomService`

### 2.2 WAS — Workforce Activation Service
| Component | File | Status |
|---|---|---|
| Execution State Manager | `workers/src/platform/was/execution-state-manager.ts` | Production |
| Constitutional Validator | `workers/src/platform/was/constitutional-validator.ts` | Production |
| Executive Status Updater | `workers/src/platform/was/executive-status-updater.ts` | Production |
| Knowledge Capture Trigger | `workers/src/platform/was/knowledge-capture-trigger.ts` | Production |
| Plan Consumer | `workers/src/platform/was/plan-consumer.ts` | Production |
| Verification Router | `workers/src/platform/was/verification-router.ts` | Production |
| Duplicate Protection | `workers/src/platform/was/was-duplicate-protection.ts` | Production |
| Feature Flags | `workers/src/platform/was/was-feature-flags.ts` | Production |
| Graceful Degradation | `workers/src/platform/was/was-graceful-degradation.ts` | Production |
| Observability | `workers/src/platform/was/was-observability.ts` | Production |
| Persistence | `workers/src/platform/was/was-persistence.ts` | Production |
| Recovery | `workers/src/platform/was/was-recovery.ts` | Production |
| WEF Delegator | `workers/src/platform/was/wef-delegator.ts` | Production |
| Workforce Activation Service | `workers/src/platform/was/workforce-activation-service.ts` | Production |
| WAS Types | `workers/src/platform/was/types.ts` | Production |
| WAS Index | `workers/src/platform/was/index.ts` | Production |

**WAS State Machine:** PENDING → ACTIVATING → ACTIVE / FAILED / REJECTED / ROLLING_BACK
**WAS Tests:** 68/68 passing

### 2.3 WEF — Workforce Execution Framework
| Component | File | Status |
|---|---|---|
| WEF Index | `workers/src/platform/wef/index.ts` | Production |
| WEF Operational Intelligence | `workers/src/platform/wef/wef-operational-intelligence.ts` | Production |

**WEF Version:** v1.1 (supersedes WDC v1.0)
**WEF Governance Freeze:** Feature Complete (GOV-004)

### 2.4 Trust Runtime
| Component | File | Status |
|---|---|---|
| Trust Engine | `workers/src/platform/trust/trust-engine.ts` | Production |
| Policy Engine | `workers/src/platform/trust/policy-engine.ts` | Production |
| Risk Engine | `workers/src/platform/trust/risk-engine.ts` | Production |
| Decision Engine | `workers/src/platform/trust/decision-engine.ts` | Production |
| Delegation Engine | `workers/src/platform/trust/delegation-engine.ts` | Production |
| Consent Engine | `workers/src/platform/trust/consent-engine.ts` | Production |
| Auth Middleware | `workers/src/platform/trust/auth-middleware.ts` | Production |
| Authorization Middleware | `workers/src/platform/trust/authorization-middleware.ts` | Production |
| Event Bus | `workers/src/platform/trust/event-bus.ts` | Production |
| Errors | `workers/src/platform/trust/errors.ts` | Production |
| Trust Types | `workers/src/platform/trust/types.ts` | Production |

### 2.5 Identity Runtime
| Component | File | Status |
|---|---|---|
| Identity Service | `workers/src/platform/identity/identity-service.ts` | Production |
| Identity Provider Registry | `workers/src/platform/identity/identity-provider-registry.ts` | Production |
| Session Manager | `workers/src/platform/identity/session-manager.ts` | Production |
| JWT Manager | `workers/src/platform/identity/jwt-manager.ts` | Production |
| MFA | `workers/src/platform/identity/mfa.ts` | Production |
| OAuth Provider | `workers/src/platform/identity/oauth-provider.ts` | Production |
| Password Manager | `workers/src/platform/identity/password-manager.ts` | Production |
| Credential Rotation | `workers/src/platform/identity/credential-rotation.ts` | Production |
| Credential Registry | `workers/src/platform/identity/credential-registry.ts` | Production |
| Email Verification | `workers/src/platform/identity/email-verification.ts` | Production |
| Magic Link | `workers/src/platform/identity/magic-link.ts` | Production |
| Refresh Token Manager | `workers/src/platform/identity/refresh-token-manager.ts` | Production |
| Identity Events | `workers/src/platform/identity/identity-events.ts` | Production |
| Identity Hooks | `workers/src/platform/identity/identity-hooks.ts` | Production |
| Identity Repository | `workers/src/platform/identity/identity-repository.ts` | Production |
| Credential Health Checker | `workers/src/platform/identity/credential-health-checker.ts` | Production |
| Credential Resolver | `workers/src/platform/identity/credential-resolver.ts` | Production |
| Credential Validator | `workers/src/platform/identity/credential-validator.ts` | Production |
| Credential Audit | `workers/src/platform/identity/credential-audit.ts` | Production |
| OIDC Provider | `workers/src/platform/identity/providers/oidc.ts` | Production |
| Google Provider | `workers/src/platform/identity/providers/google.ts` | Production |
| Identity Routes | `workers/src/platform/identity/routes/identity-routes.ts` | Production |

### 2.6 Workflow Engine
| Component | File | Status |
|---|---|---|
| Workflow Engine | `workers/src/platform/workflow/engine/workflow-engine.ts` | Production |
| State Machine | `workers/src/platform/workflow/engine/state-machine.ts` | Production |
| Context Manager | `workers/src/platform/workflow/engine/context-manager.ts` | Production |
| Transition Validator | `workers/src/platform/workflow/engine/transition-validator.ts` | Production |
| Approval Gate | `workers/src/platform/workflow/approval/approval-gate.ts` | Production |
| Decision Processor | `workers/src/platform/workflow/approval/decision-processor.ts` | Production |
| Evidence Pack | `workers/src/platform/workflow/approval/evidence-pack.ts` | Production |
| Event Reader | `workers/src/platform/workflow/events/event-reader.ts` | Production |
| Event Store | `workers/src/platform/workflow/events/event-store.ts` | Production |
| Projection Engine | `workers/src/platform/workflow/events/projection-engine.ts` | Production |
| Task Generator | `workers/src/platform/workflow/tasks/task-generator.ts` | Production |
| Task Orchestrator | `workers/src/platform/workflow/tasks/task-orchestrator.ts` | Production |
| Assignment Engine | `workers/src/platform/workflow/tasks/assignment-engine.ts` | Production |
| Batch Operations | `workers/src/platform/workflow/tasks/batch-operations.ts` | Production |
| Queue Manager | `workers/src/platform/workflow/tasks/queue-manager.ts` | Production |
| Cron Scheduler | `workers/src/platform/workflow/timers/cron-scheduler.ts` | Production |
| Escalation Timer | `workers/src/platform/workflow/timers/escalation-timer.ts` | Production |
| Timer Service | `workers/src/platform/workflow/timers/timer-service.ts` | Production |
| Workflow Index | `workers/src/platform/workflow/index.ts` | Production |
| Workflow Types | `workers/src/platform/workflow/types.ts` | Production |

### 2.7 Release Runtime
| Component | File | Status |
|---|---|---|
| Release Runtime | `workers/src/platform/release/release-runtime.ts` | Production |
| Release Index | `workers/src/platform/release/index.ts` | Production |

### 2.8 Deployment Runtime
| Component | File | Status |
|---|---|---|
| Deployment Health | `workers/src/platform/deployment/deployment-health.ts` | Production |
| Deployment Resolution Engine | `workers/src/platform/deployment/deployment-resolution-engine.ts` | Production |

### 2.9 Notification Runtime
| Component | File | Status |
|---|---|---|
| Delivery Engine | `workers/src/platform/notifications/delivery-engine.ts` | Development |
| Escalation Engine | `workers/src/platform/notifications/escalation-engine.ts` | Development |
| Analytics | `workers/src/platform/notifications/analytics.ts` | Development |
| D1 Notification Store | `workers/src/platform/notifications/d1-notification-store.ts` | Development |
| In-Memory Notification Store | `workers/src/platform/notifications/in-memory-notification-store.ts` | Development |
| Notification Audit | `workers/src/platform/notifications/notification-audit.ts` | Development |
| Notification Types | `workers/src/platform/notifications/notification-types.ts` | Development |
| Delivery Types | `workers/src/platform/notifications/delivery-types.ts` | Development |
| Escalation Types | `workers/src/platform/notifications/escalation-types.ts` | Development |

### 2.10 Document Runtime
| Component | File | Status |
|---|---|---|
| Document Service | `workers/src/platform/documents/document-service.ts` | Production |
| Document Storage | `workers/src/platform/documents/document-storage.ts` | Production |
| Document Audit | `workers/src/platform/documents/document-audit.ts` | Production |
| Document Consent Integration | `workers/src/platform/documents/document-consent-integration.ts` | Production |
| Document Encryption | `workers/src/platform/documents/document-encryption.ts` | Production |
| Document Policy Integration | `workers/src/platform/documents/document-policy-integration.ts` | Production |
| Document Types | `workers/src/platform/documents/types.ts` | Production |

---

## 3. Runtime Component Count

| Category | Component Count | Production | Development |
|---|---|---|---|
| EPCL | 16 | 16 | 0 |
| WAS | 16 | 16 | 0 |
| WEF | 2 | 2 | 0 |
| Trust Runtime | 11 | 11 | 0 |
| Identity Runtime | 23 | 23 | 0 |
| Workflow Engine | 19 | 19 | 0 |
| Release Runtime | 2 | 2 | 0 |
| Deployment Runtime | 2 | 2 | 0 |
| Notification Runtime | 8 | 0 | 8 |
| Document Runtime | 7 | 7 | 0 |
| **Total** | **106** | **98** | **8** |

---

## 4. Runtime Interfaces (hermes/contracts/)

| Interface File | Defines |
|---|---|
| `hermes/contracts/planning.ts` | EPCL contracts (PlanningEngine, RoadmapEngine, etc.) |
| `hermes/contracts/platform-api.ts` | Platform API contracts |
| `hermes/contracts/dispatcher.ts` | Dispatcher contracts |
| `hermes/contracts/index.ts` | Contract exports |

---

## 5. Runtime Guard (Hermes Core)

Located at `hermes/services/providers/runtime/guard.ts`:
- 8-dimension provider runtime guard
- Deterministic-first execution enforcement
- Fail-closed behavior on all failures
- Telemetry emission per Observability Contract (Constitution §1.9)

---

*Report 2 of 9 — Executive Runtime Capabilities*
