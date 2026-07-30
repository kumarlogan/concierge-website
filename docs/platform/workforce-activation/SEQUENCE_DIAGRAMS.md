# WAS — Sequence Diagrams

> **Workforce Activation Service — Sequence Diagrams**
> Visual flow documentation for all major activation lifecycle scenarios.
>
> **Last Updated:** 2026-07-30

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       WAS Sequence Diagrams
Capability:     Workforce Activation Service
Capability #:   17
```

---

## §1 — Roadmap → EPCL → WAS → WEF (Full Activation)

```
Roadmap MD      EPCL              WAS              WEF              Operator
    │             │                │                │                  │
    │──markdown──▶│                │                │                  │
    │             │ parseMarkdown()│                │                  │
    │             │ createPlan()   │                │                  │
    │             │ generateBatch()│                │                  │
    │             │ evaluatePlan() │                │                  │
    │             │  (APPROVED)    │                │                  │
    │             │────plan───────▶│                │                  │
    │             │                │ consume()      │                  │
    │             │                │ validate()     │                  │
    │             │                │ activate()     │                  │
    │             │                │────ACTIVE──────│────notify───────▶│
    │             │                │                │                  │
    │             │                │──batch───▶     │                  │
    │             │                │                │ delegate()       │
    │             │                │                │ execute()        │
    │             │                │◀──result──────│                  │
    │             │                │                │                  │
    │             │                │ verify()       │                  │
    │             │                │ capture()      │                  │
    │             │                │                │                  │
    │             │                │ (repeat for    │                  │
    │             │                │  each batch)   │                  │
    │             │                │                │                  │
    │             │                │ complete()     │                  │
    │             │                │────report──────│────notify───────▶│
    │             │◀──knowledge────│                │                  │
```

**Key:**
- `consume()` — validates plan is APPROVED, checks idempotency
- `validate()` — runs constitutional and feature flag gates
- `activate()` — transitions to ACTIVE, prepares batches
- `delegate()` — delegates a single batch to WEF
- `verify()` — verifies WEF delegation result
- `capture()` — captures knowledge from executed batch
- `complete()` — generates status report, transitions to DEACTIVATED

---

## §2 — Approval Required Workflow

```
Operator        EPCL              WAS              WEF
    │             │                │                │
    │──roadmap──▶│                │                │
    │             │ createPlan()  │                │
    │             │ evaluatePlan()│                │
    │             │──PENDING_APPROVAL──▶│           │
    │◀──briefing──│                │                │
    │             │                │                │
    │  [Operator reviews plan]    │                │
    │             │                │                │
    │──approve──▶│                │                │
    │             │ PlanStatus.APPROVED            │
    │             │────plan───────▶│                │
    │             │                │ activate()     │
    │             │                │────delegate──▶│
    │             │                │◀──result──────│
    │             │                │ verify()       │
    │             │                │ complete()     │
    │◀──report────│◀───────────────│                │
```

**When approval is required:**
- New capabilities with unknown risk
- Deployment, database, or security-sensitive batches
- Plans exceeding 20 batches (constitutional limit)
- Operator-configured approval gates

---

## §3 — Autonomous Execution Workflow

```
EPCL              WAS              WEF           Knowledge Layer
  │                │                │                │
  │──plan────────▶│                │                │
  │                │ validate()     │                │
  │                │ activate()     │                │
  │                │                │                │
  │                │ (per batch)    │                │
  │                │──delegate────▶│                │
  │                │                │ execute()      │
  │                │◀──result──────│                │
  │                │ verify()       │                │
  │                │──capture──────────────────────▶│
  │                │                │                │
  │                │ (repeat for all batches)        │
  │                │                │                │
  │                │ complete()     │                │
  │                │──report──────▶│                │
  │◀──knowledge────│                │                │
```

**Autonomous execution requires:**
- `ENABLE_AUTONOMOUS_EXECUTION = true` (WAS and EPCL)
- `ENABLE_BATCH_GENERATION = true` (WAS)
- `ENABLE_EXECUTIVE_WORKFLOW = true` (EPCL)
- Plan in `APPROVED` status
- All constitutional gates pass

---

## §4 — Pause and Resume

```
Operator              WAS              WEF
  │                    │                │
  │──activate────────▶│                │
  │                    │(delegating)   │
  │                    │──batch 1─────▶│
  │                    │◀──result─────│
  │                    │──batch 2─────▶│
  │                    │                │
  │  [PAUSE]           │                │
  │──stop delegating──▶│                │
  │                    │ (batch 2 in-flight)
  │                    │◀──result─────│
  │                    │                │
  │  [RESUME]          │                │
  │──resume──────────▶│                │
  │                    │──batch 3─────▶│
  │                    │◀──result─────│
  │                    │──batch 4─────▶│
  │                    │◀──result─────│
  │                    │                │
  │                    │ complete()     │
  │◀──report──────────│                │
```

**Pause semantics:**
- No new batches are delegated
- In-flight batches complete normally
- Activation remains in `ACTIVE` state
- Pending batches remain in `PENDING` status
- Resume by calling `delegateBatch()` for remaining batches

---

## §5 — Failure and Recovery

```
Operator              WAS              WEF
  │                    │                │
  │──activate────────▶│                │
  │                    │ validate()     │
  │                    │ activate()     │
  │                    │                │
  │                    │──batch 1─────▶│
  │                    │◀──RESULT──────│
  │                    │  (success)     │
  │                    │ verify() ✓     │
  │                    │                │
  │                    │──batch 2─────▶│
  │                    │◀──ERROR───────│
  │                    │  (failure)     │
  │                    │                │
  │  [BATCH FAILURE]   │                │
  │◀──failure.detail──│                │
  │                    │                │
  │  [OPERATOR RETRY]  │                │
  │──retry batch 2───▶│                │
  │                    │──batch 2─────▶│
  │                    │◀──RESULT──────│
  │                    │  (success)     │
  │                    │                │
  │                    │──batch 3─────▶│
  │                    │◀──RESULT──────│
  │                    │  (success)     │
  │                    │                │
  │                    │ complete()     │
  │◀──report──────────│                │
```

**Failure types:**
- **WEF delegation failure** — WEF returned an error → batch marked FAILED
- **Verification failure** — delegation succeeded but integrity check failed → batch marked FAILED
- **Knowledge capture failure** — non-fatal, activation continues

**Recovery from failure:**
1. Check `lifecycle.activatedBatches[].failure` for details
2. Fix the underlying issue (provider, config, plan)
3. Retry: `await was.delegateBatch(plan, batch, activationId)`

---

## §6 — Verification Routing

```
WAS Delegator     VerificationRouter         WEF
      │                    │                  │
      │──delegate────────▶│                  │
      │                    │──delegate───────▶│
      │                    │                  │ execute()
      │                    │◀──result────────│
      │                    │                  │
      │                    │ verify()         │
      │                    │  │               │
      │                    │  ├─ check: delegationId exists
      │                    │  ├─ check: status === COMPLETED
      │                    │  ├─ check: result has ok=true
      │                    │  └─ check: result has delegationId
      │                    │                  │
      │                    │ (all checks pass)│
      │◀──verification ok──│                  │
      │                    │                  │
      │ KnowledgeCaptureTrigger.trigger()     │
      │ ExecutiveStatusUpdater.report()       │
```

**Verification checks:**
1. Delegation result is not null/undefined
2. Result has a valid `delegationId`
3. Result `ok` is `true`
4. Result has a valid `timestamp`

---

## §7 — Knowledge Capture

```
WAS                 KnowledgeCaptureTrigger     Knowledge Layer
  │                          │                       │
  │──delegate batch────────▶│                       │
  │──verification result───▶│                       │
  │                          │                       │
  │                          │ captureEvidence()     │
  │                          │   ├─ plan metadata    │
  │                          │   ├─ batch results    │
  │                          │   ├─ delegation result│
  │                          │   └─ verification     │
  │                          │                       │
  │                          │──────────knowledge────▶│
  │                          │                       │
  │◀──event: was.knowledge──│                       │
  │    .captured            │                       │
```

**Knowledge capture is non-fatal.** If the trigger throws, the error is logged as a warning and the activation continues. The capture evidence includes:

- Plan ID, batch ID, activation ID
- WEF delegation result
- Verification result
- Timestamps for timing analysis

---

## §8 — Executive Reporting

```
WAS                 ExecutiveStatusUpdater       Operator
  │                          │                     │
  │──complete(plan, id)────▶│                     │
  │                          │                     │
  │                          │ buildReport()       │
  │                          │   ├─ batches        │
  │                          │   ├─ delegations    │
  │                          │   ├─ verifications  │
  │                          │   └─ failures       │
  │                          │                     │
  │                          │──activationReport──▶│
  │◀──report────────────────│                     │
  │                          │                     │
  │ state DEACTIVATING → DEACTIVATED               │
```

**Report contents:**
- Activation ID, plan ID, final state
- Duration (ms)
- Batches activated, delegated, completed, failed
- Progress percentage
- Failure records (if any)
- Validation results
- Human-readable summary