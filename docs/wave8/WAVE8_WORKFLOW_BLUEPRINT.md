# Wave 8 — Workflow Blueprint

**Company:** AGS | **Platform:** AI Platform | **Product:** Concierge Website
**Date:** 2026-08-03 | **Wave:** 8 — Workflow & Automation Engine
**Status:** DRAFT FOR REVIEW

---

## 1. Workflow Templates (Definitions)

### 1.1 Standard IVF Journey (`ivf-standard-v1`)

**Purpose:** End-to-end orchestration of a standard IVF cycle from consultation through graduation

**Structure:**
```
ivf-standard-v1
├── pre_treatment (parallel branches)
│   ├── consultation_task (manual, physician)
│   ├── testing_order (automated → lab integration)
│   └── insurance_authorization (manual, coordinator)
├── stimulation (sequential)
│   ├── protocol_selection (rule: age, AMH, AFC, BMI)
│   ├── medication_order (automated → pharmacy)
│   ├── monitoring_series (recurring daily tasks, nurse)
│   │   ├── ultrasound_scheduling
│   │   ├── bloodwork_order
│   │   ├── dose_adjustment (rule: estradiol, follicle count)
│   │   └── patient_update (automated notification)
│   └── trigger_decision (rule: lead follicle, estradiol, cohort)
├── retrieval (sequential)
│   ├── or_scheduling (automated)
│   ├── anesthesia_consent (approval, patient)
│   ├── retrieval_procedure (manual, physician)
│   └── post_op_recovery (task, nurse)
├── laboratory (parallel)
│   ├── fertilization_method (rule: sperm params, prior rate)
│   ├── embryo_culture (automated daily updates, embryologist)
│   │   ├── day1_fertilization_check
│   │   ├── day3_cleavage_assessment
│   │   ├── day5_blastocyst_grading
│   │   └── pgt_biopsy_decision (rule: patient age, indication)
│   └── cryopreservation (automated if surplus)
├── transfer (sequential)
│   ├── transfer_strategy (rule: age, quality, PGT, prior fails)
│   ├── endometrial_prep (tasks, nurse)
│   ├── transfer_procedure (manual, physician)
│   └── luteal_protocol (rule: fresh vs frozen, OHSS risk)
├── pregnancy_test (sequential)
│   ├── beta_hcg_order (automated scheduling)
│   ├── result_review (manual, physician)
│   └── patient_notification (automated)
└── follow_up (sequential)
    ├── serial_betas (recurring, nurse)
    ├── viability_ultrasound (scheduling, physician)
    └── graduation_handoff (task, coordinator → OB)
```

**State Transitions:**
- Each major phase = workflow state
- Sub-tasks = task instances with own lifecycle
- Phase transition = all required tasks completed + rules satisfied
- Approval gates at: consent, trigger, transfer strategy, PGT

---

### 1.2 Frozen Embryo Transfer (`fet-standard-v1`)

**Purpose:** FET cycle orchestration (simpler, no stimulation/retrieval)

**Structure:**
```
fet-standard-v1
├── preparation
│   ├── consultation_review (manual, physician)
│   ├── endometrial_prep_protocol (rule: natural vs medicated)
│   ├── medication_order (if medicated)
│   └── monitoring (ultrasound/bloodwork series)
├── transfer
│   ├── embryo_selection (rule: grade, PGT, patient preference)
│   ├── thaw_confirmation (automated, embryologist)
│   ├── transfer_scheduling
│   ├── transfer_procedure
│   └── luteal_support
├── pregnancy_test (same as IVF)
└── follow_up (same as IVF)
```

---

### 1.3 Donor Egg / Gestational Carrier (`donor-gc-v1`)

**Purpose:** Third-party reproduction workflows with additional legal/consent gates

**Additional Gates:**
- Legal contract verification (approval, legal team)
- Donor/GC screening completion (automated checklist)
- Psychological clearance (approval, counselor)
- Regulatory compliance check (automated, Canadian AHRA)

---

### 1.4 Coordinator Work Queue Management (`coordinator-queue-v1`)

**Purpose:** Daily operational workflow for coordinator task management

**Structure:**
```
coordinator-queue-v1
├── daily_startup (automated, cron)
│   ├── queue_refresh
│   ├── sla_evaluation
│   ├── escalation_check
│   └── dashboard_update
├── task_processing (per task)
│   ├── claim → in_progress → complete
│   ├── reassign (with reason)
│   ├── escalate (manual or auto-SLA)
│   └── batch_operations
├── patient_communication
│   ├── message_review
│   ├── response_draft
│   ├── approval_if_clinical
│   └── send
└── daily_shutdown (automated, cron)
    ├── handoff_preparation
    ├── outstanding_sla_report
    └── next_day_prep
```

---

## 2. Task Definitions (Catalog)

### 2.1 Clinical Tasks

| Task Type | Definition ID | Assignee | SLA | Automation |
|-----------|---------------|----------|-----|------------|
| Protocol Selection | `task.protocol.select` | Physician | 24h | Rule-driven (DMN) |
| Monitoring Order | `task.monitoring.order` | Nurse | 2h | Auto from protocol |
| Dose Adjustment | `task.monitoring.adjust` | Physician | 4h | Rule + physician confirm |
| Trigger Decision | `task.trigger.decide` | Physician | 2h | Rule + physician confirm |
| Fertilization Method | `task.lab.fert_method` | Embryologist | 4h | Rule (sperm params) |
| Embryo Grading | `task.lab.grade` | Embryologist | 24h | Manual + photo upload |
| PGT Decision | `task.lab.pgt` | Physician + Patient | 72h | Approval gate |
| Transfer Strategy | `task.transfer.strategy` | Physician | 24h | Rule + approval |
| Beta Review | `task.pregnancy.beta` | Physician | 4h | Auto-fetch + review |

### 2.2 Coordinator Tasks

| Task Type | Definition ID | Assignee | SLA | Automation |
|-----------|---------------|----------|-----|------------|
| Insurance Auth | `task.coord.insurance` | Coordinator | 48h | Portal integration |
| Scheduling | `task.coord.schedule` | Coordinator | 4h | Calendar integration |
| Patient Intake | `task.coord.intake` | Coordinator | 24h | Form-driven |
| Med Coordination | `task.coord.meds` | Coordinator | 24h | Pharmacy API |
| Results Delivery | `task.coord.results` | Coordinator | 24h | Auto-fetch + notify |
| Follow-up Scheduling | `task.coord.followup` | Coordinator | 48h | Rule-based timing |

### 2.3 Automated Tasks

| Task Type | Definition ID | Trigger | Action |
|-----------|---------------|---------|--------|
| SLA Evaluation | `task.auto.sla_eval` | Cron (hourly) | Check all open tasks |
| Escalation | `task.auto.escalate` | SLA breach | Create escalation task |
| Notification | `task.auto.notify` | Task events | Wave 7 notification |
| State Transition | `task.auto.transition` | Task completion | Evaluate next state |
| Timer Fire | `task.auto.timer` | Scheduled | Execute delayed action |
| Metrics Rollup | `task.auto.metrics` | Cron (daily) | Aggregate dashboard data |

---

## 3. Automation Rules (DMN Decision Tables)

### 3.1 Stimulation Protocol Selection

**Inputs:** age, amh_ngml, afc_count, bmi, prior_response (poor/normal/high/none)

| Rule | Age | AMH | AFC | BMI | Prior | Protocol | Dose (IU) | Monitoring |
|------|-----|-----|-----|-----|-------|----------|-----------|------------|
| 1 | <35 | >3.0 | >20 | <30 | none/normal | Antagonist | 225 | q2-3d |
| 2 | <35 | >3.0 | >20 | ≥30 | none/normal | Antagonist | 150 | q2-3d |
| 3 | <35 | 1.0-3.0 | 10-20 | any | none/normal | Antagonist | 300 | q2-3d |
| 4 | <35 | <1.0 | <10 | any | any | Flare/Microflare | 450 | q2d |
| 5 | 35-37 | >2.0 | >15 | <30 | none/normal | Antagonist | 300 | q2d |
| 6 | 35-37 | 1.0-2.0 | 8-15 | any | none/normal | Antagonist | 375 | q2d |
| 7 | 35-37 | <1.0 | <8 | any | any | Flare/Estrogen priming | 450 | q2d |
| 8 | 38-40 | any | any | any | any | Flare/Estrogen priming | 450 | q2d |
| 9 | 41-42 | any | any | any | any | Flare/Estrogen priming | 450 | q2d |
| 10 | any | any | any | any | high | Antagonist | -25% prior | q2d |
| 11 | any | any | any | any | poor | Flare | +25% prior | q2d |

**Hit Policy:** FIRST (ordered by specificity)

---

### 3.2 Trigger Timing

**Inputs:** lead_follicle_mm, estradiol_pgml, cohort_count_ge14mm

| Rule | Lead Follicle | Estradiol | Cohort ≥14mm | Trigger | Timing |
|------|---------------|-----------|--------------|---------|--------|
| 1 | ≥18 | 200-300/follicle | 1-3 | hCG 10k | 36h |
| 2 | ≥18 | >300/follicle | >3 | Lupron 4mg | 36h |
| 3 | ≥18 | >300/follicle | >3 | Dual (hCG+Lupron) | 36h |
| 4 | 16-17 | adequate | any | hCG 10k | 38h |
| 5 | ≥22 | any | any | hCG 10k | 34h (accelerated) |
| 6 | <16 | any | any | Delay | Reassess 24h |

**Hit Policy:** FIRST

---

### 3.3 Transfer Strategy

**Inputs:** patient_age, embryo_quality (A/B/C), pgt_status (euploid/aneuploid/none), prior_failures

| Rule | Age | Quality | PGT | Prior Fails | Day | Count | Fresh/Frozen |
|------|-----|---------|-----|-------------|-----|-------|--------------|
| 1 | <35 | A | euploid | 0 | 5 | 1 | Frozen |
| 2 | <35 | A | none | 0 | 5 | 1 | Fresh* |
| 3 | <35 | B | euploid | 0 | 5 | 1 | Frozen |
| 4 | <35 | B | none | 0 | 5 | 1-2 | Fresh* |
| 5 | 35-37 | A | euploid | 0 | 5 | 1 | Frozen |
| 6 | 35-37 | A | none | 0 | 5 | 1 | Fresh* |
| 7 | 35-37 | B | euploid | 0 | 5 | 1 | Frozen |
| 8 | 35-37 | B | none | 1+ | 5 | 2 | Frozen |
| 9 | 38-40 | any | euploid | any | 5 | 1 | Frozen |
| 10 | 38-40 | A/B | none | 0 | 5 | 2 | Frozen |
| 11 | 41-42 | any | euploid | any | 5 | 1 | Frozen |
| 12 | any | C | any | any | 5 | 2 | Frozen |
| 13 | any | any | aneuploid | any | — | 0 | Discard/Donate |

*Fresh only if no OHSS risk, progesterone <1.5, lining >7mm

**Hit Policy:** PRIORITY (explicit priority column)

---

### 3.4 Escalation Rules

**Inputs:** task_priority, time_elapsed_pct, task_type, patient_risk

| Rule | Priority | Elapsed % | Type | Risk | Action |
|------|----------|-----------|------|------|--------|
| 1 | critical | 50 | any | any | Page on-call |
| 2 | urgent | 75 | any | any | Notify lead + manager |
| 3 | high | 75 | clinical | high | Notify physician |
| 4 | high | 100 | any | any | Auto-escalate to manager |
| 5 | routine | 100 | any | any | Notify lead |
| 6 | any | 150 | any | any | Executive notification |

**Hit Policy:** COLLECT (all matching rules fire, highest priority wins)

---

### 3.5 SLA Targets by Task Type

| Task Type | Critical | Urgent | High | Routine |
|-----------|----------|--------|------|---------|
| Clinical Decision | 1h | 4h | 8h | 24h |
| Scheduling | 2h | 4h | 8h | 24h |
| Patient Communication | 2h | 4h | 8h | 24h |
| Lab Orders | 1h | 2h | 4h | 8h |
| Med Coordination | 2h | 4h | 8h | 24h |
| Insurance Auth | 4h | 8h | 24h | 72h |
| Documentation | 4h | 8h | 24h | 48h |

---

## 4. Coordinator Work Queue Design

### 4.1 Queue Views

| View | Filters | Sort | Purpose |
|------|---------|------|---------|
| **My Tasks** | assignee=me, status≠completed | priority ↓, sla_deadline ↑ | Daily work |
| **Team Queue** | role=coordinator, status=pending | priority ↓, created_at ↑ | Triage |
| **Escalations** | status=escalated | sla_deadline ↑ | Urgent |
| **SLA at Risk** | sla_deadline < now+2h | sla_deadline ↑ | Prevention |
| **Patient View** | patient_id=X | workflow_state, task_due | Context |

### 4.2 Task Card Information

```
┌─────────────────────────────────────────────────────┐
│ [PRIORITY BADGE]  Task Name                         │
│ Patient: [opaque ref]  |  Workflow: IVF Cycle #123  │
│ Due: 2h 15m  |  SLA: 4h  |  Type: Clinical Decision │
│ ─────────────────────────────────────────────────── │
│ Context: Lead follicle 18mm, E2 2800, Day 9 stim   │
│ Rule Suggestion: hCG 10k trigger in 36h            │
│ [View Details]  [Claim]  [Escalate]  [Complete]     │
└─────────────────────────────────────────────────────┘
```

### 4.3 Batch Operations

- Multi-claim (shift handoff)
- Bulk reassign (coordinator out)
- Bulk complete (routine tasks)
- Print queue (paper backup)

---

## 5. Approval Gates (Human-in-the-Loop)

| Gate | Trigger | Required Approvers | Evidence Pack | Timeout |
|------|---------|-------------------|---------------|---------|
| Treatment Consent | Workflow start | 1 (patient) | Protocol, risks, alternatives, costs | 7 days |
| Trigger Authorization | Trigger decision | 1 (physician) | Monitoring chart, rule output | 2h |
| PGT Authorization | Embryo day 5 | 2 (physician + patient) | Embryo grades, indications, costs | 72h |
| Transfer Strategy | Pre-transfer | 1 (physician) | Embryo data, rule output, patient prefs | 24h |
| Cycle Cancellation | Any clinical reason | 1 (physician) | Clinical rationale, patient discussion | 4h |
| Embryo Disposition | Storage expiry | 2 (patient + witness) | Consent form, options, legal | 30 days |

---

## 6. Timer & Delayed Actions

| Timer | Trigger | Action | Recurrence |
|-------|---------|--------|------------|
| Monitoring Reminder | Monitoring task created | Notify nurse/patient | Daily during stim |
| SLA Warning | Task at 50% SLA | Notify assignee + lead | Once per task |
| SLA Breach | Task past deadline | Escalate + notify | Once per task |
| Approval Timeout | Approval gate at 75% | Escalate to backup | Once per gate |
| Beta Scheduling | Transfer complete | Schedule beta at 9/11d | Once |
| Follow-up Series | Pregnancy confirmed | Schedule serial betas + US | Recurring |
| Storage Expiry | Embryo storage anniversary | Disposition workflow | Annual |
| Protocol Review | Cycle complete | Generate outcome report | Once |

---

## 7. Assignment Engine Rules

### 7.1 Coordinator Assignment
- **Specialty Match:** IVF coordinators → IVF tasks; FET coordinators → FET tasks
- **Workload Balance:** Least busy (open tasks < threshold) gets next task
- **Continuity:** Same coordinator for patient journey (sticky assignment)
- **Language:** FR/EN match for Quebec patients
- **Availability:** Skip offline/on-leave coordinators

### 7.2 Clinical Assignment
- **Physician of Record:** Primary physician gets clinical decisions
- **On-Call Rotation:** After-hours → on-call physician
- **Sub-specialty:** PGT decisions → genetic counselor + physician
- **Nurse Assignment:** Monitoring → primary nurse; procedures → OR nurse

---

## 8. Workflow History & Audit

### 8.1 Event Types (Immutable Log)

| Event Type | Payload | Retention |
|------------|---------|-----------|
| `workflow.started` | definition_id, patient_id, initial_context | 7 years |
| `workflow.state_changed` | from_state, to_state, trigger, actor | 7 years |
| `workflow.paused` | reason, actor | 7 years |
| `workflow.resumed` | actor | 7 years |
| `workflow.completed` | final_state, outcome | 7 years |
| `workflow.cancelled` | reason, actor | 7 years |
| `task.created` | task_def_id, workflow_id, priority, sla | 7 years |
| `task.claimed` | assignee_id, actor | 7 years |
| `task.completed` | output_json, actor | 7 years |
| `task.failed` | error, actor | 7 years |
| `task.escalated` | from_assignee, to_assignee, reason | 7 years |
| `approval.requested` | gate_id, required_approvers, evidence | 7 years |
| `approval.decided` | gate_id, approver, decision, reason | 7 years |
| `rule.evaluated` | rule_id, inputs, output, version | 3 years |
| `timer.fired` | timer_id, action_taken | 3 years |
| `error.occurred` | error_type, message, context, stack | 3 years |

### 8.2 Query Patterns
- Patient journey timeline (all events for workflow_instance)
- Task audit trail (all events for task_instance)
- Coordinator activity (events by actor_id)
- Rule evaluation history (for protocol drift detection)
- SLA breach root cause (events leading to breach)

---

## 9. Manual Override & Pause/Resume

### 9.1 Manual Override Scenarios
- Physician overrides rule recommendation (documented with reason)
- Coordinator reassigns task outside algorithm
- Patient requests non-standard timeline
- Emergency protocol deviation

### 9.2 Override Requirements
- **Mandatory Fields:** Override reason (free text), clinical justification, authorizing provider
- **Audit:** Separate event type `manual.override` with full context
- **Review:** All overrides flagged for weekly medical director review
- **Limit:** No override on safety-critical rules (OHSS prevention, embryo disposition)

### 9.3 Pause/Resume
- **Pause:** Workflow instance → status=paused, all timers suspended, no new tasks
- **Resume:** Status=running, timers recalculated from pause duration, SLA adjusted
- **Auto-Pause:** On critical safety alert, consent withdrawal, patient hold request
- **Max Pause:** 30 days (then requires medical director approval to extend)

---

## 10. Retry & Dead Letter Queue

### 10.1 Retry Policy

| Task Type | Max Retries | Backoff | DLQ After |
|-----------|-------------|---------|-----------|
| Automated (API calls) | 3 | 1m, 5m, 15m | 3 failures |
| Notification send | 5 | 30s, 1m, 5m, 15m, 1h | 5 failures |
| Rule evaluation | 1 | — | 1 failure (alert) |
| State transition | 2 | 1s, 5s | 2 failures (alert) |

### 10.2 Dead Letter Queue
- Separate D1 table: `workflow_dlq`
- Fields: original_task_id, error, attempts, last_attempt, payload_json, created_at
- Dashboard view for manual intervention
- Replay capability after fix

---

## 11. Analytics & Metrics

### 11.1 Operational Metrics (Real-time)
- Queue depth by priority
- Tasks completed/hr per coordinator
- SLA compliance rate (rolling 24h)
- Active workflows by state
- Escalation rate

### 11.2 Clinical Metrics (Daily Rollup)
- Cycle starts/completions
- Time-to-treatment (referral → start)
- Cancellation rates by reason
- Protocol distribution
- Pregnancy rates by protocol

### 11.3 Quality Metrics (Weekly)
- Override frequency & reasons
- Rule deviation patterns
- Approval turnaround time
- Communication response time
- Patient satisfaction correlation

---

## 12. Search & Discovery

### 12.1 Searchable Entities
- Workflow instances (by patient, state, date range, definition)
- Task instances (by assignee, status, type, SLA, date)
- Approval gates (by status, approver, date)
- Events (by workflow, type, actor, correlation_id)
- Rules (by id, version, clinical domain)

### 12.2 Search API
```
GET /api/v1/workflows/search?q=patient:X+state:stimulation
GET /api/v1/tasks/search?assignee=me&status=pending&priority=urgent
GET /api/v1/events/search?workflow=X&type=state_changed
```

---

*End of Workflow Blueprint. Proceeding to UX Blueprint.*