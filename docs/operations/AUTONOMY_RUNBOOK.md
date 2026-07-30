# Autonomy Runbook

> **Operational Runbook — AI Platform Autonomous Execution**
> How to handle every major scenario involving the Workforce Activation Service (WAS) and autonomous execution pipeline.
>
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       Autonomy Runbook
Capability:     Workforce Activation Service
Capability #:   17
Framework:      WEF v1.1
```

---

## Runbook Index

| Scenario | Page | Expected RTO |
|----------|------|-------------|
| Normal operation | §1 | N/A |
| Planned maintenance | §2 | 15 min |
| Provider outage (degraded) | §3 | 5 min |
| Provider outage (full) | §3 | 30 min |
| Worker restart | §4 | 1 min |
| Checkpoint recovery | §5 | 5 min |
| Execution pause | §6 | Immediate |
| Execution resume | §7 | 1 min |
| Approval timeout | §8 | 10 min |
| Constitutional pause | §9 | 5 min |
| Emergency shutdown | §10 | 30 sec |
| Escalation procedures | §11 | N/A |

---

## §1 — Normal Operation

### Condition

All systems nominal. WAS is configured with appropriate flags. Plans are being activated and delegated through WEF.

### Operator Actions

1. **Verify system health**
   - Check activation counts: `was.countByState()`
   - All active activations should be in `ACTIVE` state
   - No activations in `FAILED` or `REJECTED` state

2. **Monitor batch completion**
   - Check progress: `was.getActivation(id).activatedBatches`
   - Batches should transition: `PENDING → ACTIVATING → DELEGATED → COMPLETED`

3. **Review completed reports**
   - After `complete()`, review the `ActivationStatusReport`
   - Expected: `batchesFailed === 0`, `progress === 1.0`

4. **Log normal state**
   - Record duration, batch count, and any warnings
   - File: `docs/governance/AI_PLATFORM_STATUS.md` (if applicable)

### Success Criteria

- All activations complete successfully
- No errors or warnings in observability events
- Knowledge captured for each completed batch

### Recovery Time

Not applicable — normal operation.

---

## §2 — Planned Maintenance

### Condition

Scheduled downtime for platform upgrades, configuration changes, or dependency updates (WEF, EPCL, PSER, etc.).

### Operator Checklist

| # | Step | Command | Duration |
|---|------|---------|----------|
| 1 | **Notify operators** | Broadcast maintenance window | 15 min before |
| 2 | **Pause new activations** | Disable master switch: `disableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)` | 30 sec |
| 3 | **Let in-flight batches complete** | Check `was.listActive()` — wait for all to reach `DEACTIVATED` or `FAILED` | Variable |
| 4 | **Force-complete stragglers** | If any activation remains active after timeout: `was.cancel(plan, id, "Maintenance window")` | 1 min |
| 5 | **Verify zero active** | `was.listActive().length === 0` | 5 sec |
| 6 | **Perform maintenance** | Proceed with platform updates | TBD |
| 7 | **Verify system after restart** | Run `was.recover()` — check no unexpected failures | 30 sec |
| 8 | **Re-enable flags** | `enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)` | 10 sec |
| 9 | **Verify activation capability** | Activate a test plan | 1 min |
| 10 | **Notify operators** | Maintenance complete | 30 sec |

### Rollback

If maintenance fails:
1. Restore previous configuration from backup
2. Re-run steps 7-9
3. If system still unstable, escalate to platform engineering

### Expected RTO

15 minutes (excluding actual maintenance work).

---

## §3 — Provider Outage

### Condition A: Degraded (Single Provider Down)

WEF experiences a provider failure. In-flight batches may fail, but the system is not fully down.

### Operator Actions

1. **Identify failing batches**
   ```
   lifecycle = was.getActivation(activationId)
   failed = lifecycle.activatedBatches.filter(b => b.status === "failed")
   ```
2. **Check failure details** — `failed[0].failure` for error code and message
3. **If transient** (network blip, timeout): retry: `await was.delegateBatch(plan, batch, activationId)`
4. **If provider-specific** (API key, rate limit): switch providers in WEF config, retry
5. **If persistent** (provider fully down): fail-safe

### Condition B: Full Outage (WEF Unavailable)

WEF is completely unreachable. No batches can be delegated.

### Operator Actions

1. **Stop new activations**: `disableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)`
2. **Cancel in-flight activations**: `was.cancel(plan, id, "Provider outage")`
3. **Investigate WEF** — check WEF health endpoints, provider dashboards
4. **Resolve at WEF level** — restore provider connectivity
5. **Re-enable WAS**: `enableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)`
6. **Re-activate plans** that were cancelled

### Expected RTO

- Degraded: 5 minutes
- Full outage: 30 minutes (including root cause resolution)

---

## §4 — Worker Restart

### Condition

The Hermes worker process (or the platform runtime) is restarted — intentionally or due to crash. All in-memory WAS activation state is lost.

### Operator Actions

1. **Run recovery**
   ```typescript
   was.recover();
   ```
2. **Check recovery results**
   - Default (safe): all in-progress activations → `FAILED`
   - Auto-resume (experimental): activations → `PENDING`
3. **Verify no orphaned activations**
   ```
   const all = was.listAll();
   if (all.length > 0 && was.countByState().failed === all.length) {
     console.log("All recovered activations safely failed");
   }
   ```
4. **Re-activate plans** that were interrupted (if applicable)
5. **Check observability events** for `was.recovery` events

### Auto-Resume (Experimental)

If `autoResume: true` was configured before the restart:

```
was.recover() → activations in PENDING state
→ Re-activate each plan manually
→ Batches pending re-delegation
```

### Expected RTO

1 minute (manual recovery). 10 seconds (with auto-recovery script).

### Notes

- WAS does not use persistent storage. All activation state is in-memory.
- Long-term state tracking is handled by PSER (Project State & Execution Registry).
- Consider adding a storage adapter for production deployments requiring persistent state.

---

## §5 — Checkpoint Recovery

### Condition

A multi-batch activation was interrupted mid-execution. The operator has a checkpoint (batch index) and wants to resume from where it stopped.

### Operator Actions

1. **Identify the checkpoint**
   - From operator notes: "Batch N was the last completed"
   - From activation lifecycle: check `activatedBatches` for completed vs pending

2. **Verify activation state**
   ```typescript
   const lifecycle = was.getActivation(activationId);
   if (lifecycle) {
     // Already exists — resume from checkpoint
     // lifecycle.state should be ACTIVE or FAILED
   }
   ```

3. **If activation is FAILED** (restart scenario):
   - Re-activate the plan: `await was.activate(plan)`
   - Skip completed batches (they'll be idempotent)

4. **If activation is ACTIVE** (mid-execution):
   - Find pending batches
   - Call `delegateBatch()` for each pending batch

5. **Complete the activation**
   ```typescript
   const report = was.complete(plan, activationId);
   ```

### Expected RTO

5 minutes (including investigation).

---

## §6 — Execution Pause

### Condition

Operator needs to temporarily halt autonomous execution without cancelling activations.

### Operator Actions

1. **Stop new batch delegation**
   - Do not call `delegateBatch()` for remaining batches
   - Let in-flight batches complete

2. **Record pause state**
   - Note which activations are active
   - Note which batch index each activation is at
   - Record timestamp

3. **Monitor in-flight batches**
   - Check `was.getActivation(id).activatedBatches` for completion
   - Wait for all in-flight batches to reach `COMPLETED` or `FAILED`

4. **System is now paused**
   - Activations remain in `ACTIVE` state
   - No new batches being delegated
   - No new activations being created

### Expected RTO

Immediate (no new delegation). Variable for in-flight completion.

---

## §7 — Execution Resume

### Condition

Operator wants to resume a paused execution.

### Operator Actions

1. **Verify activation state**
   ```typescript
   const lifecycle = was.getActivation(activationId);
   // Must be ACTIVE
   ```

2. **Identify pending batches**
   ```typescript
   const pending = lifecycle.activatedBatches
     .filter(b => b.status === "pending" || b.status === "activating");
   ```

3. **Resume delegation**
   ```typescript
   for (const batch of pending) {
     await was.delegateBatch(plan, batch, activationId);
   }
   ```

4. **Complete when done**
   ```typescript
   const report = was.complete(plan, activationId);
   ```

### Expected RTO

1 minute (plus delegation time for pending batches).

---

## §8 — Approval Timeout

### Condition

An approval gate is taking too long. This is handled at the EPCL level (ApprovalManager), but WAS may be waiting for an approved plan.

### Operator Actions

1. **Check EPCL approval status**
   - Is the plan in `PENDING_APPROVAL` state?
   - Has the approval evaluation stalled?

2. **Manual override options**
   - If the plan is safe: approve it at EPCL level
   - If the plan needs changes: reject and resubmit
   - If the operator is unavailable: configure auto-approval for known-safe batch types

3. **Once approved**, WAS can proceed with activation

### Expected RTO

10 minutes (operator decision time).

---

## §9 — Constitutional Pause

### Condition

WAS rejects a plan during constitutional validation. The operator must review and resolve.

### Operator Actions

1. **Check rejection details**
   ```typescript
   const lifecycle = was.getActivation(activationId);
   console.log(lifecycle.rejection);
   // { reason, gate, resolution, timestamp }
   ```

2. **Identify the failing gate**
   - `feature_flags` — enable required flags
   - `constitutional` — fix plan integrity, batch count, or constraints
   - `budget` — reduce batch size or token estimates

3. **Fix the issue**
   - Enable flags if disabled
   - Modify the plan (fewer batches, simpler tasks)
   - Re-run EPCL planning with corrections

4. **Re-activate**
   ```typescript
   const newLifecycle = await was.activate(fixedPlan);
   ```

### Expected RTO

5 minutes (for flag issues). Variable (for plan fixes).

---

## §10 — Emergency Shutdown

### Condition

Critical issue requires immediate halt of all autonomous execution. This is the nuclear option.

### Operator Actions

| # | Step | Command | Time |
|---|------|---------|------|
| 1 | **Disable master switch** | `disableWASFlag(WASFeatureFlag.ENABLE_AUTONOMOUS_EXECUTION)` | 2 sec |
| 2 | **Disable EPCL switch** | `setFlags({ ENABLE_AUTONOMOUS_EXECUTION: false })` | 2 sec |
| 3 | **Cancel all active** | `was.listActive().forEach(a => was.cancel(a.planId, a.id, "Emergency shutdown"))` | 5 sec |
| 4 | **Reset all flags** | `resetAllFlagsForTest()` | 2 sec |
| 5 | **Verify no active** | `was.listActive().length === 0` | 2 sec |
| 6 | **Log incident** | Record reason, timestamp, affected activations | 5 sec |
| 7 | **Notify platform team** | Escalate per §11 | 30 sec |

### Total Expected Time

Under 30 seconds.

### Recovery

1. Investigate root cause of the emergency
2. Resolve the issue
3. Re-enable flags one at a time
4. Re-activate plans as needed

---

## §11 — Escalation Procedures

### Levels

| Level | Contact | Response Time | Trigger |
|-------|---------|--------------|---------|
| **L1** | Platform Operator (on-call) | 15 min | Batch failure, single activation failure |
| **L2** | Platform Engineering | 1 hr | Repeated failures, worker restart, flag issues |
| **L3** | Platform Architecture | 4 hrs | Constitutional failure, design issue, emergency |
| **L4** | Product Owner | Same day | Business impact, policy decision |

### Escalation Criteria

| Condition | Escalate To |
|-----------|-------------|
| Single batch failure (retry succeeds) | L1 (log only) |
| Repeated batch failures (3+ retries) | L1 → L2 |
| Full activation failure | L1 → L2 |
| Worker restart (auto-recovery failed) | L2 |
| Constitutional pause (cannot resolve) | L2 → L3 |
| Emergency shutdown | L1 → L3 → L4 |
| Feature flag discrepancy | L2 → L3 |
| Provider outage (persistent) | L2 → L3 |

### Escalation Template

```
ESCALATION: [L1|L2|L3|L4]
Timestamp:  [ISO-8601]
Scenario:   [Runbook §X]
Impact:     [Activations affected, batches lost]
Symptoms:   [Error messages, state, events]
Actions Taken: [Steps already tried]
Resolution: [Proposed next step]
```

---

## Operator Checklist (Quick Reference)

### Daily Checks

- [ ] `was.countByState()` — no unexpected FAILED or REJECTED activations
- [ ] In-flight activations progressing normally
- [ ] No recovery events from unplanned restarts
- [ ] Feature flags match expected configuration

### Before Activation

- [ ] `ENABLE_AUTONOMOUS_EXECUTION` is `true`
- [ ] `ENABLE_BATCH_GENERATION` is `true`
- [ ] EPCL flags are in correct state
- [ ] Plan is in `APPROVED` status
- [ ] No active maintenance windows

### After Activation

- [ ] Activation reached `DEACTIVATED` state
- [ ] All batches completed (or failed with logged reasons)
- [ ] Status report generated
- [ ] Knowledge captured
- [ ] No unexpected events in observability log

### Emergency Response

- [ ] Disable master switch immediately
- [ ] Cancel all active activations
- [ ] Log incident details
- [ ] Escalate per §11
- [ ] Do not re-enable until root cause is resolved