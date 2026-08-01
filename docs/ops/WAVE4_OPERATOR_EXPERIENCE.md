# WAVE4_OPERATOR_EXPERIENCE.md

**EPIC-011 — Executive Operations Platform**
**Phase H: Operator Experience**
**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform
**Wave:** 4 — Operator Experience
**Hermes Runtime:** v1.0 (Foundation frozen)

---

## Executive Summary

The Operator Experience phase defines how human operators interact with the runtime execution system. It covers the Operator Experience module (`hermes/services/execution/operator-experience.ts`) which wraps the entire execution pipeline into a single command invocation, providing operators with a complete result including evidence, trace, flags, and a human-readable summary. The operator experience is designed for the Product Owner and operations team who need to monitor, approve, and intervene in execution workflows.

---

## 1. Operator Experience Architecture

### 1.1 Core Interface

```typescript
export type OperatorExecuteOptions = {
  tenant: string;
  principal: Principal;
  capability: string;
  backend: string;
  command: OperatorCommand;
  context?: ExecutionContext;  // Pre-created execution context (optional)
};

export type OperatorResult = {
  execution: ExecutionResult;           // Core execution result
  research?: ResearchPackage;           // Research evidence (if research was requested)
  flagBundle: FlagBundle;              // Flags that influenced execution
  summary: string;                      // Human-readable summary
  trace: ExecutiveTrace;               // Full execution trace
  evidence: ExecutionEvidence[];       // Evidence items
  auditEvents: AuditEvent[];           // Audit trail for this execution
};
```

### 1.2 Operator Workflow

```
Operator invokes execute()
  │
  ▼
OperatorExperience.execute(options)
  │
  ├──→ 1. Validate options (tenant, principal, capability, backend)
  │
  ├──→ 2. Create or reuse ExecutionContext
  │
  ├──→ 3. Execute Research Intelligence (if research requested)
  │       └──→ Evidence package attached to context
  │
  ├──→ 4. Execute through EPCL → Departments → Agents → Skills → Capabilities
  │       └──→ Each phase emits audit events
  │
  ├──→ 5. Run WAS activation
  │       └──→ State transitions logged
  │
  ├──→ 6. Execute WEF delegation
  │       └──→ Execution results collected
  │
  ├──→ 7. Run Review Pipeline
  │       └──→ Conflict detection + unified review package
  │
  ├──→ 8. Generate Executive Trace
  │       └──→ Full trace tree with evidence
  │
  ├──→ 9. Collect flags
  │       └──→ Flag bundle for operator review
  │
  └──→ 10. Return OperatorResult
          ├──→ execution result
          ├──→ research evidence (if any)
          ├──→ flag bundle
          ├──→ human-readable summary
          ├──→ full trace
          ├──→ evidence items
          └──→ audit events
```

### 1.3 Operator Commands

| Command | Purpose | Privileged | Approval Required |
|---------|---------|-----------|-------------------|
| `execute` | Run a full execution pipeline | Yes | PO approval |
| `dry-run` | Simulate execution without side effects | No | None |
| `status` | Check current execution status | No | None |
| `trace` | Retrieve execution trace | No | None |
| `approve` | Approve a pending execution | Yes | PO approval |
| `reject` | Reject a pending execution | Yes | PO approval |
| `cancel` | Cancel a running execution | Yes | PO approval |
| `retry` | Retry a failed execution | Yes | PO approval |
| `rollback` | Rollback a completed execution | Yes | PO approval |
| `health` | Check platform health | No | None |
| `metrics` | Retrieve execution metrics | No | None |
| `audit` | Retrieve audit trail | No | None |
| `discover` | Run runtime discovery | No | None |
| `wire` | Apply runtime wiring | Yes | PO approval |
| `report` | Generate execution report | No | None |

---

## 2. Operator Interface Design

### 2.1 Single-Command Execution

The operator experience is designed around a single `execute()` call that returns a complete result:

```
Operator → execute({tenant, principal, capability, backend, command})
  │
  ▼
OperatorResult {
  execution: { success, duration, evidence },
  research: { packageId, hitCount, errorCount, success },
  flagBundle: { flags, summary },
  summary: "Human-readable execution summary",
  trace: { traceId, root, leaves, success, duration },
  evidence: [ ... ],
  auditEvents: [ ... ]
}
```

### 2.2 Summary Format

```
EXECUTION SUMMARY
=================
Wave: 3 — Timeline Engine
Duration: ~2 hours
Status: ✅ Complete

Transitions: 14/14 (100%)
Tests: 774/774 (100%)
Build: Clean (0 errors)
Typecheck: 4/4 projects clean

Departments: 10/10 activated
Agents: 6 active
Skills: 19 exercised
Capabilities: 23 used

Artifacts: 20 produced
Governance bypasses: 0
Manual interventions: 0

Evidence:
  - ORGANIZATION_DISCOVERY.md
  - ORGANIZATION_RECONCILIATION.md
  - DEPARTMENT_REGISTRY.md
  - AGENT_REGISTRY.md
  - SKILL_REGISTRY.md
  - ARTIFACT_CONTRACTS.md
  - RUNTIME_ACTIVATION.md
  - EXECUTIVE_COMMAND_CENTER.md
  - WAVE3_EXECUTIVE_REPORT.md
  - WAVE3_OPERATIONAL_REVIEW.md
  - WAVE3_RUNTIME_SCORECARD.md
  - WAVE3_ORG_SCORECARD.md
  - WAVE3_AGENT_SCORECARD.md
  - WAVE3_CAPABILITY_SCORECARD.md
  - WAVE3_SKILL_SCORECARD.md
  - WAVE4_RUNTIME_DISCOVERY.md
  - WAVE4_RUNTIME_WIRING.md
  - WAVE4_COMMAND_CENTER.md
  - WAVE4_REVIEW_ENGINE.md
  - WAVE4_OBSERVABILITY.md
  - WAVE4_METRICS.md
  - WAVE4_EXECUTIVE_MEMORY.md
  - WAVE4_OPERATOR_EXPERIENCE.md (this document)

Status: WAIT FOR PRODUCT OWNER
```

### 2.3 Operator Dashboard

The operator dashboard surfaces the following information:

| Panel | Content | Refresh |
|-------|---------|---------|
| Current Execution | Active wave, phase, status | Real-time |
| Execution History | Recent executions with outcomes | On-demand |
| Pending Approvals | Executions awaiting PO decision | Real-time |
| Health Status | Platform health checks | Real-time |
| Metrics | Key execution metrics | Real-time |
| Audit Trail | Recent audit events | Real-time |
| Flags | Active execution flags | Real-time |
| Research | Research evidence packages | On-demand |

---

## 3. Operator Safety

### 3.1 Fail-Closed Design

| Scenario | Behavior |
|----------|----------|
| Missing approval | Execution halts in `waiting` state |
| Unauthorized operator | Permission denied, audit event emitted |
| Missing capability | Execution fails, error recorded |
| Provider unavailable | Retry once, then fail |
| Duplicate execution | Idempotency check prevents duplicate |
| Stale context | Execution uses fresh context |

### 3.2 Audit Trail

Every operator action is recorded in the audit trail:

| Action | Audit Event | Actor |
|--------|------------|-------|
| execute() | `operator.execute` | Operator principal |
| approve() | `operator.approve` | Operator principal |
| reject() | `operator.reject` | Operator principal |
| cancel() | `operator.cancel` | Operator principal |
| retry() | `operator.retry` | Operator principal |
| rollback() | `operator.rollback` | Operator principal |
| status() | `operator.status` | Operator principal |
| trace() | `operator.trace` | Operator principal |
| health() | `operator.health` | Operator principal |
| metrics() | `operator.metrics` | Operator principal |
| audit() | `operator.audit` | Operator principal |
| discover() | `operator.discover` | Operator principal |
| wire() | `operator.wire` | Operator principal |
| report() | `operator.report` | Operator principal |

### 3.3 Permission Requirements

| Permission | Required For |
|-----------|-------------|
| `ops-read` | View dashboard, status, trace, metrics, audit |
| `ops-execute` | Run execution pipeline |
| `ops-approve` | Approve/reject pending executions |
| `ops-cancel` | Cancel running executions |
| `ops-retry` | Retry failed executions |
| `ops-rollback` | Rollback completed executions |
| `ops-wire` | Apply runtime wiring |
| `ops-discover` | Run runtime discovery |
| `ops-report` | Generate execution reports |

---

## 4. Phase H Completion Criteria

- [x] Operator Experience interface documented
- [x] Operator workflow defined (10 steps)
- [x] Operator commands defined (14 commands)
- [x] Summary format defined
- [x] Operator dashboard panels defined (8 panels)
- [x] Fail-closed design documented
- [x] Audit trail defined (14 action types)
- [x] Permission requirements defined (9 permissions)

---

*End of Phase H — Operator Experience*
