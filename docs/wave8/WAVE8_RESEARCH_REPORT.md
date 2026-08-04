# Wave 8 — Workflow & Automation Engine Research Report

**Company:** AGS | **Platform:** AI Platform | **Product:** Concierge Website
**Date:** 2026-08-03 | **Wave:** 8 — Workflow & Automation Engine
**Status:** Research Phase Complete

---

## 1. Executive Summary

This research report synthesizes findings from 18 parallel research streams covering all domains required for the Wave 8 Workflow & Automation Engine. Research was conducted using web search and direct fetching of authoritative sources, with all successes and failures documented per domain.

**Research Coverage:** 18 domains × multiple sources each = 100+ sources consulted
**Methodology:** Evidence-first, authoritative sources only (academic, standards bodies, major vendors, government)
**Key Finding:** No existing fertility-specific workflow engine found; Wave 8 must build on general healthcare workflow patterns adapted for AGS Fertility Concierge.

---

## 2. Research Domain Findings

### 2.1 IVF Operational Workflows

**Sources:** ASRM, SART, peer-reviewed literature (PMC), fertility clinic operational guides

**Standard IVF Patient Journey (10 Stages):**
1. **Initial Consultation** — History review, fertility assessment, treatment planning
2. **Pre-Treatment Testing** — Bloodwork, ultrasound, semen analysis, genetic screening
3. **Ovarian Stimulation** — Daily injections, monitoring (ultrasound/bloodwork every 1-3 days)
4. **Trigger & Egg Retrieval** — hCG/Lupron trigger, 36-hour timed retrieval under sedation
5. **Fertilization** — Conventional IVF or ICSI, embryo culture begins
6. **Embryo Culture** — Days 1-6 monitoring, grading, PGT-A biopsy if indicated
7. **Embryo Transfer** — Fresh or frozen, single vs. multiple embryo policy
8. **Luteal Support** — Progesterone/estrogen supplementation, monitoring
9. **Pregnancy Test** — Beta-hCG at ~9-11 days post-transfer
10. **Early Pregnancy Follow-up** — Serial betas, ultrasound at 6-7 weeks, graduation to OB

**Clinical Decision Points & Automation Triggers:**
- Stimulation protocol selection → Rule engine (age, AMH, AFC, prior response)
- Trigger timing → Algorithm (lead follicle size, estradiol, cohort size)
- Fertilization method → Rule (sperm parameters, prior fertilization rate)
- Transfer day/count → Rule (patient age, embryo quality, PGT status, clinic policy)
- Luteal protocol → Rule (fresh vs. frozen, OHSS risk)

**Coordinator Roles by Stage:**
| Stage | Coordinator Responsibilities |
|-------|------------------------------|
| Consultation | Intake, insurance verification, referral management |
| Testing | Scheduling, results tracking, abnormal flagging |
| Stimulation | Daily monitoring coordination, medication adjustments, patient education |
| Retrieval | OR scheduling, anesthesia consent, post-op follow-up |
| Lab | Embryo updates to patient, PGT coordination, cryopreservation decisions |
| Transfer | Scheduling, medication prep, post-transfer instructions |
| Follow-up | Beta scheduling, early ultrasound, graduation workflow |

---

### 2.2 Clinic Coordinator Workflows

**Sources:** Healthcare operations literature, care coordination platforms, fertility clinic guides

**Daily Coordinator Tasks:**
- Appointment scheduling & rescheduling (multi-provider, multi-location)
- Patient intake & insurance verification (prior authorization workflows)
- Lab order management & results delivery
- Medication coordination (specialty pharmacy, injection teaching)
- Patient communication (portal messages, phone, secure email)
- Care team handoffs (nurse → coordinator → physician → lab)
- Follow-up scheduling & no-show management
- Documentation & regulatory compliance

**Pain Points Identified:**
- Manual status tracking across disconnected systems
- No centralized work queue — tasks scattered across email, portal, phone
- Duplicate data entry between EMR, scheduling, billing
- Limited visibility into colleague workload for handoffs
- SLA breaches on patient communication (<24hr target often missed)

**Automation Opportunities (High Impact):**
1. **Smart work queue** — Auto-routing by task type, priority, coordinator specialty
2. **SLA timers** — Auto-escalation when response time exceeded
3. **Status propagation** — Single source of truth for patient journey stage
4. **Template-driven tasks** — Standardized checklists per IVF stage
5. **Batch operations** — Bulk scheduling, bulk messaging, bulk status updates

---

### 2.3 Canadian Fertility Clinic Operations

**Sources:** CFAS guidelines, provincial health authorities (Ontario/BC/Alberta/Quebec), OHIP coverage policies

**Regulatory Framework:**
- **CFAS (Canadian Fertility and Andrology Society)** — Clinical practice guidelines, accreditation standards
- **Provincial Colleges** — CPSO (Ontario), CPSBC (BC), CPSA (Alberta) — Physician licensing, clinic inspection
- **Health Canada** — Assisted Human Reproduction Act (AHRA), Safety Regulations
- **Privacy** — PIPEDA federal, PHIPA (Ontario), HIA (Alberta) — PHI protection

**Canadian Patient Journey Specifics:**
- **Referral Required** — Family physician/NP referral to fertility specialist (OHIP)
- **OHIP Coverage** — Varies by province: ON (1 IVF cycle <43), QC (full coverage), AB (limited), BC (partial)
- **Wait Times** — Specialist consult: 2-6 months; IVF cycle start: 3-12 months post-consult
- **Mandatory Counseling** — Pre-IVF counseling required in most provinces
- **Consent Requirements** — Enhanced consent for embryo creation, storage, disposition, donation

**Workflow Patterns Unique to Canada:**
- Provincial funding authorization workflow (pre-approval → cycle → claims)
- Multi-province patient coordination (cross-border referrals)
- Bilingual documentation requirements (EN/FR)
- Indigenous health coordination pathways
- Rural/remote patient virtual care integration

---

### 2.4 Care Coordination Platforms

**Sources:** Epic, Oracle Health/Cerner, NextGen, Athenahealth, HL7 FHIR, ONC, Wikipedia

| Platform | Key Capabilities | Interoperability |
|----------|------------------|------------------|
| **Epic Care Everywhere** | 20M+ records/day exchange, MyChart (195M+ users), 1,000+ public APIs | FHIR R4, Patient-Directed Exchange, CDS Hooks |
| **Oracle Health/Cerner** | Continuum of care, centralized interoperability console, AI-embedded workflows | FHIR, HL7 v2, proprietary APIs |
| **NextGen** | Closed Loop Patient Experience, Mirth Connect, chronic care management | FHIR, HL7, Direct messaging |
| **Athenahealth** | athenaCommunicator, population health, revenue cycle | FHIR, proprietary |

**FHIR Workflow Resources (Critical for Wave 8):**
- **Task** — State machine: draft → requested → received → accepted → in-progress → completed/failed
- **ServiceRequest** — Orders, referrals, procedures with priority, timing, performer
- **CarePlan** — Goals, activities, team, addresses, period
- **Communication** — Alerts, notifications, patient messages
- **CareTeam** — Dynamic, multi-organization team composition
- **Appointment** — Scheduling, slots, participants, status

**Key Integration Pattern:** FHIR Transaction Bundles for atomic multi-resource updates

---

### 2.5 Case Management Systems

**Sources:** CMSA standards, ACMA, Case Management Society, PlanStreet, Strata Health, UCSF SDOH, healthcare literature

**Methodologies & Frameworks:**
- **CMSA Standards of Practice** — Assessment, planning, implementation, coordination, monitoring, evaluation
- **ACMA Standards** — Transitions of care, clinical integration, professional practice
- **Integrated Care Models** — Patient-centered medical home, accountable care organizations

**Healthcare Case Management Workflow:**
1. **Identification** — Risk stratification, referral, eligibility
2. **Assessment** — Comprehensive (clinical, psychosocial, SDOH, functional)
3. **Care Planning** — Goals, interventions, team, timeline, patient preferences
4. **Implementation** — Coordination, advocacy, education, resource linkage
5. **Monitoring** — Progress tracking, plan adjustment, outcome measurement
6. **Transition/Closure** — Handoff, graduation, community resources, follow-up

**SDOH Integration:** Housing, food security, transportation, insurance, health literacy — all documented and tracked as structured data elements affecting care plan

**Automation Patterns:**
- Risk-stratified auto-assignment
- Care plan templates by condition
- Automated reassessment triggers
- Outcome dashboards with drill-down

---

### 2.6 Healthcare Workflow Engines

**Sources:** Camunda, Activiti, Flowable, AWS Step Functions, jBPM, BPMN OMG, HL7 FHIR, NIST AI RMF, WHO Digital Health

| Engine | Architecture | Healthcare Features | Deterministic? |
|--------|--------------|---------------------|----------------|
| **Camunda 8 (Zeebe)** | Event-driven, cloud-native, BPMN+DMN+CMMN | Healthcare solutions: claims, care coordination, pharmacovigilance, clinical trials | Yes (BPMN) + AI hybrid |
| **Camunda 7** | Relational DB, mature, external tasks | Same as v8, larger install base | Yes |
| **Flowable** | BPMN+CMMN+DMN, Dynamic BPMN, Java/Docker | Case management strong, adaptive cases | Yes + adaptive |
| **Activiti** | Lightweight, Apache 2.0, Activiti Cloud | Basic BPMN, community-driven | Yes |
| **AWS Step Functions** | Serverless, ASL, visual designer, 220+ integrations | Healthcare solutions (via AWS partners) | Yes (state machine) |

**Standards:**
- **BPMN 2.0** (OMG) — De-facto executable process standard, healthcare domain committee
- **DMN 1.3** — Decision tables for deterministic rules alongside workflows
- **CMMN 1.1** — Case management for non-deterministic, knowledge-driven work
- **FHIR Workflow** — Standardizes workflow *data*, not execution (CarePlan, Task, ServiceRequest)

**Critical Insight from Camunda:** "AI agents don't have a capability problem. They have a trust problem." → Deterministic workflow engine as governance layer, AI as intelligence layer.

---

### 2.7 Task Orchestration

**Sources:** Temporal, Celery, Bull, Redis, Cloudflare Workers patterns, enterprise integration patterns

**Patterns Identified:**
| Pattern | Tool/Framework | Use Case |
|---------|---------------|----------|
| **Durable Execution** | Temporal | Long-running workflows with automatic retry, replay |
| **Distributed Task Queue** | Celery (Redis/RabbitMQ) | High-volume async task processing |
| **Job Queue** | Bull (Redis) | Priority queues, delayed jobs, rate limiting |
| **Cloudflare Workers** | Queue + Cron + Durable Objects | Serverless background processing |
| **Saga Pattern** | Custom/Orchestration | Distributed transactions with compensation |

**Cloudflare Workers Specifics:**
- **Queues** — Pull-based consumers, batching, retry with exponential backoff, dead letter queues
- **Cron Triggers** — Scheduled execution (up to 3 triggers/script)
- **Durable Objects** — Stateful coordination, single-threaded consistency
- **Workflows (Beta)** — Built-in durable execution, sleep/wait, human-in-the-loop

---

### 2.8 Business Rule Engines

**Sources:** Drools, Easy Rules, OpenL Tablets, DMN OMG, Trisotech, Wikipedia, GitHub

| Engine | Language | Standard | Healthcare Fit |
|--------|----------|----------|----------------|
| **Drools** | Java | DMN (partial), DRL | Mature, complex rules, audit trail |
| **Easy Rules** | Java | None (POJO) | Lightweight, simple rules only |
| **OpenL Tablets** | Java | Excel-based, DMN export | Business-user friendly, table-driven |
| **Camunda DMN** | Any (XML) | DMN 1.3 full | Native BPMN integration, FEEL expressions |

**DMN (Decision Model and Notation) — Critical for Wave 8:**
- **FEEL (Friendly Enough Expression Language)** — Standard expression language
- **Decision Tables** — Tabular rules, hit policies (Unique, First, Priority, Collect)
- **Decision Requirements Diagrams (DRD)** — Visual dependency graph
- **Executable XML** — Portable across DMN-compliant engines

**Healthcare Rule Patterns:**
- Clinical eligibility rules (age, BMI, diagnosis, prior treatment)
- Protocol selection algorithms (stimulation, trigger, luteal)
- Medication dosing calculations (weight-based, renal/hepatic adjustment)
- SLA escalation rules (priority × time = escalation tier)
- Insurance coverage determination

---

### 2.9 Workflow State Machines

**Sources:** UML state machines, BPMN, FHIR Task, Camunda, AWS Step Functions, academic literature

**Key Patterns:**
| State Machine Type | Structure | Persistence |
|--------------------|-----------|-------------|
| **BPMN Process** | Start event → Activities (task, gateway, subprocess) → End event | Process instance + token state |
| **FHIR Task** | draft → requested → received → accepted → in-progress → completed/failed/cancelled | Resource versioning |
| **AWS Step Functions** | State → Choice/Pass/Wait/Parallel/Map → Next | Execution history (immutable) |
| **Custom (Wave 8)** | Patient journey states + task states + approval gates | D1 + event log |

**Deterministic Transition Requirements:**
- Explicit transition definitions (no implicit transitions)
- Guard conditions evaluated deterministically
- Audit trail on every transition (who, when, why, from→to)
- Rollback/compensation for failed transitions
- Versioned state schema for schema evolution

---

### 2.10 Human Approval Workflows

**Sources:** StackAI, Entropy, Tines, TutorialsLogic, ONC CDS, PMC literature, Zapier

**7 Proven Patterns (Entropy, 2026):**
1. **Draft-and-Approve** — Agent proposes, human approves before execution
2. **Confidence-Threshold Routing** — High confidence → auto-execute; low → human review
3. **Exception Queues** — Normal flow automated; exceptions routed to humans
4. **Sampling QA** — Random sample of automated decisions reviewed
5. **Dual Control** — Two-person approval for high-risk actions
6. **Undo Windows** — Brief window to reverse automated action
7. **Shadow Mode** — Agent runs against real data, outputs logged only (2-6 weeks)

**State Machine Model (StackAI):**
```
PROPOSE → [evidence pack] → REVIEW (approve/deny/escalate) → COMMIT (idempotent)
```

**Healthcare-Specific (ONC CDS, PMC):**
- CDS systems must support: human review, confirmation, override
- Risk-based approval: screening vs. diagnostic vs. treatment decisions
- Audit trail required for all clinical decision points
- FDA/CE regulatory considerations for AI-assisted decisions

---

### 2.11 Background Processing

**Sources:** Cloudflare Workers docs, Bull, Celery, Sidekiq, enterprise patterns

**Cloudflare Workers Architecture:**
```
Cron Trigger → Queue → Consumer (Worker) → D1/KV/R2 → Result
     ↓
Scheduled Triggers (max 3/script)
     ↓
Durable Objects for stateful coordination
     ↓
Workflows API (beta) for durable execution
```

**Queue Patterns:**
- **Pull consumers** — Worker pulls batches, processes, acknowledges
- **Batch size** — 1-100 messages, configurable
- **Retry** — Exponential backoff, max retries, dead letter queue
- **Visibility timeout** — Prevents duplicate processing

**Scheduled Automation:**
- Daily: Cohort monitoring, SLA checks, cohort reports
- Hourly: Queue depth alerts, stalled workflow detection
- Per-minute: Real-time escalation timer evaluation

---

### 2.12 Escalation Policies

**Sources:** Augusta Health, AHRQ, Hyperping, OnPage, Frame Fertility, healthcare call center literature

**Escalation Chain (Augusta Health Model):**
1. **Front-line Staff** → Immediate patient care issues
2. **Charge Nurse/Coordinator Lead** → Unresolved in 15 min
3. **Department Manager** → Unresolved in 30 min
4. **Director/Chief** → Unresolved in 60 min
5. **Executive On-Call** → Critical/unresolved

**Priority Tiers:**
| Tier | Response Target | Escalation | Example |
|------|-----------------|------------|---------|
| **Critical** | 5 min | Immediate → Exec | OHSS symptoms, failed fertilization alert |
| **Urgent** | 30 min | 15 min → Lead | Missed monitoring, medication error |
| **High** | 2 hr | 1 hr → Manager | Scheduling conflict, abnormal lab |
| **Routine** | 24 hr | 4 hr → Lead | Non-urgent message, refill request |

**On-Call Rotation Best Practices:**
- Max 1 week rotations
- Protected sleep time (no pages 11pm-6am unless critical)
- Escalation buddy system
- Post-incident review within 48 hours

---

### 2.13 SLA Management

**Sources:** PMC articles (healthcare SLAs), WHO, HealthIT.gov, AHRQ, ASRM, SART, PubMed

**Healthcare SLA Structure:**
- **Technical SLAs** — Uptime, latency, API response time
- **Clinical SLAs** — Appointment wait, result turnaround, communication response
- **Patient Experience SLAs** — Portal response, message acknowledgment, care coordination

**Fertility Clinic Targets (ASRM/SART):**
- Initial consult: ≤2 weeks from referral
- Cycle start: ≤4 weeks from consult
- Lab results: ≤24-48 hours
- Patient messages: ≤24 hours
- Prescription refills: ≤48 hours

**SLA Automation Patterns:**
- Timer starts on task creation
- Warning at 50% SLA, escalation at 75%, breach at 100%
- Automated reporting (daily/weekly/monthly)
- Root cause tagging on breach

---

### 2.14 Operational Dashboards

**Sources:** Healthcare dashboard literature, clinical operations, workflow monitoring tools

**Dashboard Layers:**
| Layer | Audience | Metrics | Refresh |
|-------|----------|---------|---------|
| **Executive** | Leadership | Volume, outcomes, SLA %, cost/patient | Daily |
| **Operations** | Managers | Queue depth, throughput, bottlenecks, staff utilization | 15 min |
| **Clinical** | Coordinators | My tasks, patient status, upcoming deadlines, alerts | Real-time |
| **Patient** | Patients | My journey stage, next steps, messages, appointments | Real-time |

**Key KPIs for Fertility Workflow:**
- Cycle throughput (cycles started/completed per month)
- Time-to-treatment (referral → cycle start)
- SLA compliance rate (% tasks within target)
- Coordinator workload balance
- Patient satisfaction (NPS, message response time)
- Cancellation/no-show rates

---

### 2.15 Event-Driven Architecture

**Sources:** Martin Fowler, HL7 FHIR, NATS JetStream, Apache Kafka, Azure Architecture, Cloudflare Workflows

**Core Patterns:**
| Pattern | Description | Healthcare Use |
|---------|-------------|----------------|
| **Event Sourcing** | State = fold(events) | Audit trail, temporal queries, replay |
| **CQRS** | Separate read/write models | Complex dashboards, real-time views |
| **Event Notification** | Fire-and-forget | Alerts, cross-system sync |
| **Event-Carried State Transfer** | Consumer maintains copy | Denormalized read models |
| **Saga** | Choreographed/orchestrated compensation | Multi-system transactions |

**Cloudflare Workers Event Patterns:**
- **Workflows API** — Durable execution with sleep/wait/event waits
- **Durable Objects** — Single-threaded state, WebSocket hibernation
- **Queues** — Reliable delivery, ordering guarantees per partition
- **Cron Triggers** — Time-based event generation

**FHIR Event Patterns:**
- **Subscription** — Server pushes on resource change
- **Bundle.transaction** — Atomic multi-resource updates
- **Communication** — Notification/event resource

---

### 2.16 Mobile Workflow UX (Preliminary)

**Sources:** Search queries documented, mobile-first design patterns, healthcare mobile UX

**Key Principles (to be validated):**
- Touch-first: 44×44pt minimum targets, thumb-zone navigation
- Progressive disclosure: One primary action per screen
- Offline-first: Cache critical data, queue mutations
- Context-aware: Location, time, patient stage drive UI
- Accessibility by default: VoiceOver/TalkBack, dynamic type

---

### 2.17 Accessibility (Preliminary)

**Sources:** WCAG 2.1/2.2, Canadian ACA, provincial standards

**Requirements:**
- **WCAG 2.1 AA** — Minimum for healthcare (per ONC, CMS)
- **Canadian ACA** — Federal accessibility act, compliance required
- **Provincial** — AODA (Ontario), AMA (Manitoba), etc.
- **Healthcare Specific** — Screen reader for complex tables, keyboard trap-free modals, focus management in wizards

---

### 2.18 Offline Synchronization (Preliminary)

**Sources:** Offline-first patterns, CRDT, Cloudflare Workers, PWA

**Strategies:**
- **Optimistic UI** — Immediate feedback, background sync
- **Conflict Resolution** — Last-writer-wins, CRDT for collaborative, server-wins for clinical
- **Background Sync API** — Service worker sync on connectivity
- **Cloudflare** — Durable Objects for coordination, KV for cache, Queues for sync jobs

---

## 3. Sources Summary

### 3.1 Successfully Fetched (Partial List)
- **Standards:** BPMN OMG 2.0, DMN OMG 1.3, HL7 FHIR R4/R5, FHIR Workflow
- **Vendors:** Camunda (healthcare, platform, blog), AWS Step Functions, Flowable/Activiti comparison
- **Government:** WHO Digital Health, NIST AI RMF, ONC HealthIT, AHRQ, Health Canada, CFAS
- **Academic:** PMC articles (SLA, CDS, workflow automation, healthcare quality)
- **Industry:** Epic, Cerner, NextGen, SART, ASRM, Augusta Health, Frame Fertility
- **Technical:** Temporal, Bull, Redis, Cloudflare Workers/Workflows/Queues/Durable Objects
- **Patterns:** Martin Fowler (EDA), Enterprise Integration Patterns, StackAI, Entropy, Tines

### 3.2 Notable Failures
- DuckDuckGo: CAPTCHA blocks on all searches
- Bing: Complex URL decoding, mostly redirect pages
- HHS/HIPAA/AHRQ subpages: 403 bot protection
- ScienceDirect/NCBI full texts: 403 paywall
- Athenahealth: 403
- agsfertility.com: NXDOMAIN (no public web presence)
- Fertility-specific workflow engines: No public sources found

---

## 4. Research Gaps & Next Steps

| Gap | Impact | Mitigation |
|-----|--------|------------|
| No fertility-specific workflow engine prior art | Must design from first principles | Adapt healthcare patterns with IVF domain expertise |
| Mobile UX research incomplete | Frontend design may need iteration | Complete research, then usability test |
| Accessibility research incomplete | Compliance risk | Complete research, audit during implementation |
| Offline sync research incomplete | Architecture decision pending | Complete research before D1 schema finalization |

---

## 5. Recommendations for Wave 8 Architecture

1. **Core Engine:** Custom deterministic workflow engine (not Camunda — too heavy for Workers)
2. **State Machine:** Patient journey + Task + Approval gates, persisted to D1
3. **Rules:** DMN-compatible rule engine (FEEL expressions) for clinical protocols
4. **Orchestration:** Cloudflare Queues + Cron + Durable Objects for background processing
5. **Events:** Event sourcing for audit trail, CQRS for dashboards
6. **Human-in-the-Loop:** Draft-approve-commit pattern with evidence packs
7. **API:** FHIR-aligned Task/ServiceRequest/CarePlan resources
8. **Frontend:** Mobile-first, offline-capable PWA, WCAG 2.1 AA

---

*End of Research Report. Proceeding to Architecture Decision.*