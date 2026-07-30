# WAS — State Machine

> **Workforce Activation Service — State Machine Reference**
> Every execution state, its transitions, recovery behaviour, and operator actions.
>
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       WAS State Machine
Capability:     Workforce Activation Service
Capability #:   17
```

---

## State Map

```
                    ┌──────────────────────────────────────────────────────────────┐
                    │                    Activation States                          │
                    │                                                              │
                    │    ┌─────────┐    ┌────────────┐    ┌──────────────┐        │
                    │    │ PENDING │───▶│ VALIDATING │───▶│ ACTIVATING   │        │
                    │    └────┬────┘    └─────┬──────┘    └──────┬───────┘        │
                    │         │               │                  │                │
                    │         ▼               ▼                  ▼                │
                    │    ┌─────────┐    ┌────────────┐    ┌──────────────┐        │
                    │    │ FAILED  │    │ REJECTED   │    │   ACTIVE     │        │
                    │    └─────────┘    └────────────┘    └──────┬───────┘        │
                    │         ▲                                  │                │
                    │         │                                  ▼                │
                    │         │                            ┌──────────────┐        │
                    │         │                            │ DEACTIVATING │        │
                    │         │                            └──────┬───────┘        │
                    │         │                                   │                │
                    │         │          ┌────────────────────┐   │                │
                    │         │          │   DEACTIVATED      │◀──┘                │
                    │         │          └────────────────────┘                    │
                    │         │          ┌────────────────────┐                    │
                    │         └──────────│   FAILED (terminal)│                    │
                    │                    └────────────────────┘                    │
                    └──────────────────────────────────────────────────────────────┘
```

---

## State Definitions

### S1 — PENDING

**Description:** Activation created. Plan received but not yet processed.

**Entry Conditions:**
- `PlanConsumer.consume(plan)` succeeds
- Plan is in `PlanStatus.APPROVED`
- No existing activation for this plan (idempotency check passes)
- Idempotency key generated

**Exit Conditions:**
- `VALIDATING` — when `activate()` begins validation
- `FAILED` — on state transition error, plan consumption failure

**Allowed Transitions:**
- `PENDING → VALIDATING` (normal path)
- `PENDING → FAILED` (error path)

**Recovery Behaviour:**
- On restart: if `autoResume=true`, activations in PENDING are re-validated
- On restart: if `autoResume=false` (default), PENDING activations are marked FAILED

**Audit Events:**
- `was.activation.started` — emitted on creation

**Operator Actions:**
- None required. PENDING is transient.

---

### S2 — VALIDATING

**Description:** Constitutional validation is running. Feature flags, plan integrity, policy checks.

**Entry Conditions:**
- State transition from `PENDING` succeeds
- `ConstitutionalValidator.validate(plan)` is invoked

**Exit Conditions:**
- `ACTIVATING` — all validation gates pass (`validation.ok === true`)
- `REJECTED` — one or more gates fail with `severity: "error"`
- `FAILED` — state transition error during validation

**Allowed Transitions:**
- `VALIDATING → ACTIVATING` (all gates pass)
- `VALIDATING → REJECTED` (gate fails)
- `VALIDATING → FAILED` (transition error)

**Recovery Behaviour:**
- Not recoverable — VALIDATING is synchronous. If the worker crashes during validation, the activation is in PENDING or FAILED state on restart.

**Audit Events:**
- `was.activation.validated` — emitted when validation completes (pass or fail)
- `was.activation.rejected` — emitted when plan is rejected

**Operator Actions:**
- If plan is rejected: review `rejection.reason`, `rejection.gate`, and `rejection.resolution`
- Fix the issue (enable flags, fix plan integrity, adjust constraints)
- Re-activate with corrected plan

---

### S3 — ACTIVATING

**Description:** Validation passed. Batches being activated and prepared for WEF delegation.

**Entry Conditions:**
- State transition from `VALIDATING` succeeds
- Validation result is `ok: true`
- Plan has at least one batch

**Exit Conditions:**
- `ACTIVE` — all batches added to activation lifecycle
- `FAILED` — state transition error, batch activation failure

**Allowed Transitions:**
- `ACTIVATING → ACTIVE` (normal path)
- `ACTIVATING → FAILED` (error path)

**Recovery Behaviour:**
- Not recoverable — ACTIVATING is synchronous. Activation is still in this state briefly.

**Audit Events:**
- `was.batch.activated` — emitted per batch as it's added to the activation

**Operator Actions:**
- None required. ACTIVATING is transient.

---

### S4 — ACTIVE

**Description:** Plan is actively executing. Batches are being delegated to WEF.

**Entry Conditions:**
- State transition from `ACTIVATING` succeeds
- All batches added to activation lifecycle

**Exit Conditions:**
- `DEACTIVATING` — when `complete()` is called
- `FAILED` — on state transition error during delegation

**Allowed Transitions:**
- `ACTIVE → DEACTIVATING` (normal path — completion)
- `ACTIVE → DEACTIVATING` (via `cancel()` — graceful shutdown)
- `ACTIVE → FAILED` (transition error, though cancel handles this)

**Recovery Behaviour:**
- On restart: ACTIVE activations are candidates for recovery
- Default (`autoResume=false`): marked FAILED
- Experimental (`autoResume=true`): reverted to PENDING for re-activation

**Audit Events:**
- `was.batch.delegated` — per batch delegated to WEF
- `was.batch.completed` — per batch completed successfully
- `was.batch.failed` — per batch that failed
- `was.wef.delegation.started` — WEF delegation initiated
- `was.wef.delegation.completed` — WEF delegation succeeded
- `was.wef.delegation.failed` — WEF delegation failed
- `was.verification.started` — verification check initiated
- `was.verification.completed` — verification passed
- `was.knowledge.captured` — knowledge captured from batch

**Operator Actions:**
- Monitor batch progress: `was.getActivation(id).activatedBatches`
- Handle failed batches: investigate and retry
- Pause execution: stop delegating new batches (let in-flight complete)
- Cancel activation: `was.cancel(plan, id, reason)`

---

### S5 — DEACTIVATING

**Description:** Graceful shutdown in progress. Status report being generated.

**Entry Conditions:**
- `complete()` called on an `ACTIVE` activation
- `cancel()` called on an `ACTIVE` activation
- State transition from `ACTIVE` succeeds

**Exit Conditions:**
- `DEACTIVATED` — status report generated, final state reached
- `FAILED` — state transition error during deactivation

**Allowed Transitions:**
- `DEACTIVATING → DEACTIVATED` (normal path)
- `DEACTIVATING → FAILED` (transition error during report generation)

**Recovery Behaviour:**
- On restart: DEACTIVATING activations are treated as in-progress. Default: marked FAILED.

**Audit Events:**
- `was.status.reported` — emitted when executive status report is generated

**Operator Actions:**
- None required. DEACTIVATING is transient.
- Verify the status report was generated after transition to DEACTIVATED.

---

### S6 — DEACTIVATED

**Description:** Terminal state. Activation completed successfully.

**Entry Conditions:**
- State transition from `DEACTIVATING` succeeds
- Status report generated

**Exit Conditions:**
- None — terminal state

**Allowed Transitions:**
- None — terminal state

**Recovery Behaviour:**
- Not applicable. DEACTIVATED activations are complete and do not need recovery.

**Audit Events:**
- `was.activation.completed` — emitted when activation reaches DEACTIVATED

**Operator Actions:**
- Review the activation status report
- File the report for audit purposes
- Archive if needed

---

### S7 — FAILED

**Description:** Terminal state. Activation failed at any stage.

**Entry Conditions:**
- State transition error at any stage
- `cancel()` called (transitions through DEACTIVATING → FAILED)
- Restart recovery with `autoResume=false` (default)

**Exit Conditions:**
- None — terminal state

**Allowed Transitions:**
- None — terminal state

**Recovery Behaviour:**
- Not applicable. Failed activations are terminal.
- Operator must create a new activation with a corrected plan.

**Audit Events:**
- `was.activation.failed` — emitted when activation enters FAILED state
- `was.recovery.failed` — emitted if recovery fails

**Operator Actions:**
- Check `lifecycle.failure` for details (code, message, stage, timestamp)
- Check `lifecycle.failure.stage` to identify where the failure occurred
- Fix the underlying issue
- Re-activate with corrected plan

---

### S8 — REJECTED

**Description:** Terminal state. Plan was rejected by constitutional validation.

**Entry Conditions:**
- Validation gate fails with `severity: "error"`
- State transition from `VALIDATING` to `REJECTED`

**Exit Conditions:**
- None — terminal state

**Allowed Transitions:**
- None — terminal state

**Recovery Behaviour:**
- Not applicable. Rejected activations are terminal.
- Operator must fix the plan and re-activate.

**Audit Events:**
- `was.activation.rejected` — emitted when plan is rejected

**Operator Actions:**
- Check `lifecycle.rejection` for details (reason, gate, resolution)
- Check `lifecycle.validation.gates` for individual gate results
- Follow `rejection.resolution` to fix the issue
- Re-activate with corrected plan

---

## Transition Matrix

| From \ To | PENDING | VALIDATING | ACTIVATING | ACTIVE | DEACTIVATING | DEACTIVATED | FAILED | REJECTED |
|-----------|---------|-----------|------------|--------|-------------|-------------|--------|----------|
| PENDING | — | ✓ | ✗ | ✗ | ✗ | ✗ | ✓ | ✗ |
| VALIDATING | ✗ | — | ✓ | ✗ | ✗ | ✗ | ✓ | ✓ |
| ACTIVATING | ✗ | ✗ | — | ✓ | ✗ | ✗ | ✓ | ✗ |
| ACTIVE | ✗ | ✗ | ✗ | — | ✓ | ✗ | ✓ | ✗ |
| DEACTIVATING | ✗ | ✗ | ✗ | ✗ | — | ✓ | ✓ | ✗ |
| DEACTIVATED | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ | ✗ |
| FAILED | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — | ✗ |
| REJECTED | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | ✗ | — |

**Legend:**
- ✓ — Valid transition
- ✗ — Invalid transition (throws `StateTransitionError`)
- Empty — terminal state

---

## Batch Activation States

Each batch within an activation has its own sub-state:

| State | Description | Transitions To |
|-------|-------------|---------------|
| `PENDING` | Batch registered but not yet activated | `ACTIVATING` |
| `ACTIVATING` | Being prepared for WEF delegation | `DELEGATED`, `FAILED` |
| `DELEGATED` | Sent to WEF for execution | `COMPLETED`, `FAILED` |
| `COMPLETED` | Delegation + verification succeeded | Terminal |
| `FAILED` | Delegation or verification failed | Terminal |
| `SKIPPED` | Explicitly skipped by operator | Terminal |

---

## Execution Monitoring States

WAS monitors delegated batches through a separate execution status:

| Status | Description | Terminal? |
|--------|-------------|-----------|
| `PENDING` | Not yet checked | No |
| `RUNNING` | In-flight in WEF | No |
| `COMPLETED` | Execution completed successfully | Yes |
| `FAILED` | Execution failed | Yes |
| `TIMEOUT` | Execution exceeded timeout | Yes |
| `CANCELLED` | Execution cancelled by operator | Yes |