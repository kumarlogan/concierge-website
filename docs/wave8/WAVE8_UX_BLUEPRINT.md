# Wave 8 — UX Blueprint

**Company:** AGS | **Platform:** AI Platform | **Product:** Concierge Website
**Date:** 2026-08-03 | **Wave:** 8 — Workflow & Automation Engine
**Status:** DRAFT FOR REVIEW

---

## 1. User Personas & Journeys

### 1.1 Primary Personas

| Persona | Role | Primary Goals | Pain Points |
|---------|------|---------------|-------------|
| **Sarah (Coordinator)** | IVF Coordinator, 5 yrs exp | Manage 20-30 patients, zero SLA breaches, smooth handoffs | Scattered tools, manual tracking, no visibility into colleague load |
| **Dr. Chen (Physician)** | Reproductive Endocrinologist | Clinical decisions fast, evidence-based, compliant | Interruptions, hunting for data, approval bottlenecks |
| **Maria (Patient)** | IVF Patient, 34, first cycle | Know what's next, get answers fast, feel supported | Anxiety, information gaps, portal confusion |
| **Lisa (Nurse)** | IVF Nurse, 8 yrs exp | Monitoring coordination, patient education, safety | Double entry, delayed orders, unclear priorities |
| **Alex (Admin/Manager)** | Clinic Operations Manager | Dashboard visibility, SLA compliance, resource planning | Reactive firefighting, no predictive insights |

### 1.2 Journey Maps

**Coordinator Daily Journey:**
```
Login → Dashboard (queue overview) → Claim next task → Review context → 
Execute/decide → Complete with notes → Next task → 
Mid-day: Escalation check → Handoff prep → End-of-day report
```

**Physician Decision Journey:**
```
Notification → Open task → Review evidence pack (auto-generated) → 
See rule recommendation → Confirm/override → Document reason → 
Patient notified automatically
```

**Patient Journey:**
```
Portal login → Journey timeline (visual) → Current stage highlighted → 
Next steps clear → Message care team → View results → 
Receive notifications → Feel informed
```

---

## 2. Information Architecture

### 2.1 Navigation Structure (Coordinator/Clinical)

```
Patient Workspace (Patient)
├── Dashboard
├── My Journey (Timeline)
├── Messages
├── Appointments
├── Documents
├── Medications
└── Profile & Consent

Clinical Workspace (Coordinator/Nurse/Physician)
├── Dashboard (Operational)
│   ├── My Queue
│   ├── Team Queue
│   ├── Escalations
│   └── SLA at Risk
├── Workflows
│   ├── Active Cycles
│   ├── Templates
│   └── Definitions (Admin)
├── Tasks
│   ├── All Tasks (Search)
│   ├── My Tasks
│   └── Approvals Pending
├── Patients
│   ├── Search
│   ├── Cohort Views
│   └── Journey Detail
├── Analytics
│   ├── Operational
│   ├── Clinical
│   └── Quality
└── Settings
    ├── Rules (Admin)
    ├── Templates (Admin)
    └── Users (Admin)
```

---

## 3. Key Screens & Components

### 3.1 Coordinator Dashboard (`/clinical/dashboard`)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ AGS Fertility Concierge                    [User Menu] [Notifications]      │
├─────────────────────────────────────────────────────────────────────────────┤
│ ▼ My Queue (12)    ▼ Team Queue (8)    ▲ Escalations (2)    ◉ SLA at Risk (3) │
├─────────────────────────────────────────────────────────────────────────────┤
│ ┌─────────────────────────────────────┐ ┌─────────────────────────────────┐ │
│ │ TASK CARDS (My Queue)               │ │ QUICK STATS                     │ │
│ ├─────────────────────────────────────┤ ├─────────────────────────────────┤ │
│ │ 🔴 CRITICAL  Trigger Decision       │ │ Active Workflows: 24            │ │
│ │ Patient: #P-8472 | Due: 45m         │ │ Tasks Completed Today: 18       │ │
│ │ Context: Lead 19mm, E2 3200, Day 10 │ │ SLA Compliance (24h): 96%       │ │
│ │ Rule: hCG 10k @ 36h                 │ │ Escalations Open: 2             │ │
│ │ [View] [Claim] [Complete]           │ │ Avg Response: 2.3h              │ │
│ ├─────────────────────────────────────┤ ├─────────────────────────────────┤ │
│ │ 🟠 URGENT    Insurance Auth         │ │ WORKLOAD BALANCE                │ │
│ │ Patient: #P-9103 | Due: 2h          │ │ Sarah: 12  ████████░░ 60%       │ │
│ │ Carrier: BlueCross | Auth # needed  │ │ Mike: 8    ██████░░░░ 40%       │ │
│ │ [View] [Claim] [Escalate]           │ │ Jen: 15    ██████████░ 75%       │ │
│ ├─────────────────────────────────────┤ │ Dave: 5    ████░░░░░░ 25%       │ │
│ │ 🟡 HIGH      Monitoring Order       │ └─────────────────────────────────┘ │
│ │ Patient: #P-7721 | Due: 4h          │                                     │
│ │ Day 6 stim | US + E2 needed         │                                     │
│ │ [View] [Claim] [Batch]              │                                     │
│ └─────────────────────────────────────┘                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Task Detail Modal

```
┌────────────────────────────────────────────────────────────┐
│ Task: Trigger Decision                    [×]              │
├────────────────────────────────────────────────────────────┤
│ Patient: #P-8472 (Sarah J.)  |  Workflow: IVF Cycle #123   │
│ Priority: 🔴 CRITICAL  |  SLA: 36m remaining               │
│ Assignee: Unassigned  |  Type: Clinical Decision           │
├────────────────────────────────────────────────────────────┤
│ CLINICAL CONTEXT                                           │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ Stimulation Day 10 | Antagonist Protocol | 300 IU      │ │
│ │ Lead Follicle: 19mm (R) | Endometrium: 9mm            │ │
│ │ Estradiol: 3,200 pg/mL | Cohort ≥14mm: 4              │ │
│ │ LH: 1.2 | Progesterone: 0.8                           │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ RULE RECOMMENDATION                                        │
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ▶ hCG 10,000 IU trigger in 36 hours                    │ │
│ │   Rationale: Lead follicle ≥18mm, E2 200-300/follicle, │ │
│ │   cohort 1-3 → Rule 1 (FIRST hit policy)              │ │
│ │   Confidence: HIGH (all criteria met)                 │ │
│ │   [View Rule Logic]                                    │ │
│ └────────────────────────────────────────────────────────┘ │
├────────────────────────────────────────────────────────────┤
│ ACTIONS                                                    │
│ [✓ Approve Recommendation]  [✎ Override: Enter Custom]    │
│     Requires: Confirmation          Requires: Reason +    │
│     Auto-notifies patient           Physician co-sign     │
├────────────────────────────────────────────────────────────┤
│ HISTORY                                                    │
│ 09:15 Task created (auto from monitoring)                 │
│ 09:16 Rule evaluated → hCG 10k @ 36h                      │
│ 09:17 Notification sent to Dr. Chen                       │
└────────────────────────────────────────────────────────────┘
```

### 3.3 Patient Journey Timeline (`/patient/journey`)

```
┌────────────────────────────────────────────────────────────┐
│ My IVF Journey                                    [Menu]   │
├────────────────────────────────────────────────────────────┤
│ Cycle: IVF #1  |  Started: Jul 15  |  Day: 10 of Stim    │
│                                                                 │
│ ┌────────────────────────────────────────────────────────┐  │
│ │ PROGRESS: ████████████████████░░░░░░░░░░░░  45%        │  │
│ └────────────────────────────────────────────────────────┘  │
│                                                                 │
│ ● CONSULTATION        ✓ Complete        Jul 15              │
│ ● TESTING             ✓ Complete        Jul 18              │
│ ● AUTHORIZATION       ✓ Complete        Jul 22              │
│ ● STIMULATION         ◉ IN PROGRESS     Jul 25 — Present    │
│   ├─ Monitoring Day 1  ✓ Jul 25                                │
│   ├─ Monitoring Day 3  ✓ Jul 27                                │
│   ├─ Monitoring Day 5  ✓ Jul 29                                │
│   ├─ Monitoring Day 7  ✓ Jul 31                                │
│   ├─ Monitoring Day 9  ✓ Aug 2                                 │
│   └─ MONITORING DAY 10 ◉ TODAY — Trigger Decision Soon      │
│                                                                 │
│ ○ TRIGGER & RETRIEVAL  ⏳ Pending       ~Aug 5                │
│ ○ LABORATORY           ⏳ Pending       ~Aug 5-11             │
│ ○ TRANSFER             ⏳ Pending       ~Aug 12               │
│ ○ PREGNANCY TEST       ⏳ Pending       ~Aug 22               │
│ ○ FOLLOW-UP            ⏳ Pending       ~Sep onward           │
│                                                                 │
│ NEXT STEP: Your physician will decide on trigger medication  │
│ today. You'll receive a notification with instructions.      │
│                                                                 │
│ [Message Care Team]  [View Medications]  [Upcoming Appts]   │
└────────────────────────────────────────────────────────────┘
```

### 3.4 Workflow Definition Builder (Admin) (`/clinical/workflows/definitions`)

```
┌────────────────────────────────────────────────────────────┐
│ Workflow Definitions                    [+ New Definition] │
├────────────────────────────────────────────────────────────┤
│ Search: [________________]  Filter: [Status ▼] [Type ▼]   │
├────────────────────────────────────────────────────────────┤
│ ┌────────────────────────────────────────────────────────┐ │
│ │ ivf-standard-v1.3          ACTIVE      IVF Cycle       │ │
│ │ Updated: Aug 1, 2026  |  12 phases  |  47 tasks       │ │
│ │ [Edit] [Version] [Clone] [Archive] [View Diagram]      │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ fet-standard-v1.1          ACTIVE      FET Cycle       │ │
│ │ Updated: Jul 15, 2026  |  6 phases  |  22 tasks       │ │
│ │ [Edit] [Version] [Clone] [Archive] [View Diagram]      │ │
│ ├────────────────────────────────────────────────────────┤ │
│ │ donor-gc-v1.0              DRAFT       Donor/GC        │ │
│ │ Updated: Jul 28, 2026  |  8 phases  |  31 tasks       │ │
│ │ [Edit] [Publish] [Clone] [Delete]                      │ │
│ └────────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────────┘
```

### 3.5 Visual Workflow Diagram (Mermaid-based)

```
┌────────────────────────────────────────────────────────────┐
│ Workflow: ivf-standard-v1.3                    [Zoom]      │
├────────────────────────────────────────────────────────────┤
│  graph TD                                                    │
│    A[Start] --> B{Pre-Treatment}                            │
│    B --> C[Consultation]                                    │
│    B --> D[Testing Orders]                                  │
│    B --> E[Insurance Auth]                                  │
│    C & D & E --> F[All Complete?]                           │
│    F -->|Yes| G[Stimulation]                                │
│    G --> H[Monitoring Series]                               │
│    H --> I{Trigger Decision}                                │
│    I -->|hCG| J[Retrieval]                                  │
│    I -->|Lupron| J                                          │
│    J --> K[Laboratory]                                      │
│    K --> L[Fertilization]                                   │
│    K --> M[Culture]                                         │
│    K --> N{PGT?}                                            │
│    N -->|Yes| O[Biopsy]                                     │
│    N -->|No| P[Transfer Strategy]                           │
│    O --> P                                                  │
│    P --> Q[Transfer]                                        │
│    Q --> R[Luteal Support]                                  │
│    R --> S[Beta hCG]                                        │
│    S --> T{Positive?}                                       │
│    T -->|Yes| U[Follow-up]                                  │
│    T -->|No| V[Cycle Review]                                │
│    U --> W[Graduation]                                      │
│    V --> X[Next Cycle Planning]                             │
│    W & X --> Y[End]                                         │
│                                                              │
│  ███ = Current Phase (Stimulation)                          │
│  ◉ = Active Task                                            │
│  ✓ = Completed                                              │
│  ⏳ = Pending                                               │
└────────────────────────────────────────────────────────────┘
```

---

## 4. Mobile-First Design

### 4.1 Breakpoints
| Breakpoint | Width | Target |
|------------|-------|--------|
| Mobile | 320-480px | Patient, Coordinator (on-the-go) |
| Tablet | 481-768px | Nurse station, Physician rounding |
| Desktop | 769-1440px | Coordinator primary, Admin |
| Wide | 1441px+ | Dashboard multi-panel |

### 4.2 Mobile Patterns

**Task Card (Mobile):**
```
┌─────────────────────────────┐
│ 🔴 CRITICAL  Trigger Dec.   │
│ Patient #P-8472  Due: 45m   │
│ Lead: 19mm | E2: 3200       │
│ Rule: hCG 10k @ 36h         │
│ ─────────────────────────── │
│ [View] [Claim] [Complete]   │
└─────────────────────────────┘
```

**Bottom Navigation (Patient Mobile):**
```
┌─────────────────────────────┐
│ Journey  Messages  Appts  Me│
│  📍      💬        📅    👤 │
└─────────────────────────────┘
```

### 4.3 Touch Targets
- Minimum 44×44pt (iOS) / 48×48dp (Android)
- 8pt spacing between interactive elements
- Thumb-zone primary actions (bottom right)

---

## 5. Accessibility (WCAG 2.1 AA)

### 5.1 Compliance Checklist

| Criterion | Implementation |
|-----------|----------------|
| **1.1.1 Non-text Content** | All icons have aria-labels; charts have data tables |
| **1.3.1 Info & Relationships** | Semantic HTML5 (nav, main, section, article); ARIA landmarks |
| **1.4.3 Contrast** | 4.5:1 normal text, 3:1 large text; validated in design system |
| **1.4.4 Resize Text** | Rem units; supports 200% zoom without horizontal scroll |
| **2.1.1 Keyboard** | All interactive elements reachable; focus visible (3px outline) |
| **2.1.2 No Keyboard Trap** | Modals trap focus; ESC closes; focus returns to trigger |
| **2.4.3 Focus Order** | Logical tab order; skip to main content link |
| **2.4.6 Headings & Labels** | h1-h6 hierarchy; form labels associated |
| **3.2.1 On Focus** | No auto-submit on focus; no unexpected navigation |
| **3.3.1 Error Identification** | Inline errors with aria-describedby; color + icon + text |
| **4.1.2 Name, Role, Value** | Custom components use ARIA roles; state announced |

### 5.2 Screen Reader Experience

**Task Card Announcement:**
> "Critical priority, Trigger Decision, patient P-8472, due in 45 minutes. Lead follicle 19 millimeters, estradiol 3200. Rule recommends hCG 10000 units in 36 hours. Buttons: View, Claim, Complete."

**Journey Timeline Announcement:**
> "IVF Cycle 1, 45 percent complete. Current stage: Stimulation, Day 10. Completed: Consultation, Testing, Authorization. Next: Trigger and Retrieval, estimated August 5."

---

## 6. Offline Capability (PWA)

### 6.1 Offline-First Strategy

| Data | Cache Strategy | Sync Priority |
|------|----------------|---------------|
| Workflow definitions | Cache-first (static) | Background |
| Patient journey (read) | Stale-while-revalidate | High |
| Task list (my queue) | Network-first, fallback cache | High |
| Task completion (write) | Optimistic UI + background sync | Critical |
| Notifications | Push received online; queue offline | High |
| Reference data (rules, protocols) | Cache-first, update on version change | Low |

### 6.2 Service Worker Lifecycle

```
Install → Cache static assets (shell, definitions, icons)
  ↓
Activate → Clean old caches
  ↓
Fetch → 
  ├── Static (shell, definitions) → Cache-first
  ├── API GET (journey, tasks) → Stale-while-revalidate (30s)
  ├── API POST (complete, claim) → Network-only + queue if offline
  └── Push → Show notification; cache for offline view
  ↓
Sync (Background Sync API) → Flush queued mutations on connectivity
```

### 6.3 Offline Indicators

```
┌─────────────────────────────────────┐
│ ☁ Online          [Banner]          │
│ ─────────────────────────────────── │
│ ⚠ Offline — Changes will sync when  │
│    connection restored. 3 pending.  │
│    [View Queue] [Dismiss]           │
└─────────────────────────────────────┘
```

---

## 7. Component Library (shadcn/ui Extensions)

### 7.1 New Components for Wave 8

| Component | Purpose | Variants |
|-----------|---------|----------|
| `TaskCard` | Queue item display | priority, type, compact/full |
| `PriorityBadge` | Visual priority indicator | critical/urgent/high/routine |
| `SLAIndicator` | Time remaining visualization | countdown, progress, breach |
| `RuleRecommendation` | Decision support display | confidence, reasoning, override |
| `JourneyTimeline` | Patient progress visualization | horizontal, vertical, mobile |
| `WorkflowDiagram` | Mermaid-based visual editor | view, edit, zoom |
| `ApprovalGate` | Human-in-the-loop interface | evidence pack, decision buttons |
| `QueueFilters` | Multi-filter toolbar | saved views, shareable URLs |
| `BatchActions` | Multi-select toolbar | claim, reassign, complete, export |

### 7.2 Design Tokens (Extension)

```css
:root {
  /* Priority Colors */
  --priority-critical: hsl(0 84% 60%);      /* Red */
  --priority-urgent: hsl(25 95% 53%);        /* Orange */
  --priority-high: hsl(45 93% 47%);          /* Amber */
  --priority-routine: hsl(221 83% 53%);      /* Blue */
  
  /* SLA States */
  --sla-safe: hsl(142 76% 36%);              /* Green */
  --sla-warning: hsl(45 93% 47%);            /* Amber */
  --sla-breach: hsl(0 84% 60%);              /* Red */
  
  /* Workflow States */
  --state-running: hsl(221 83% 53%);
  --state-paused: hsl(45 93% 47%);
  --state-completed: hsl(142 76% 36%);
  --state-failed: hsl(0 84% 60%);
  
  /* Spacing for Touch */
  --touch-target: 44px;
  --touch-spacing: 8px;
}
```

---

## 8. Responsive Behavior

### 8.1 Dashboard Layouts

| Viewport | My Queue | Team Queue | Stats | Workload |
|----------|----------|------------|-------|----------|
| Mobile | Stack (full) | Collapsed accordion | Cards | Hidden (tab) |
| Tablet | 2-col | 2-col | 2-col | Bottom sheet |
| Desktop | 3-col | 3-col | Sidebar | Sidebar |
| Wide | 4-col | 4-col | Sidebar + mini | Sidebar |

### 8.2 Task Detail

| Viewport | Layout |
|----------|--------|
| Mobile | Full-screen modal, bottom sheet |
| Tablet | Side panel (50%) |
| Desktop | Side panel (400px) |
| Wide | Center modal (600px) |

---

## 9. Internationalization (i18n)

### 9.1 Supported Locales
- `en-CA` (English Canada) — Primary
- `fr-CA` (French Canada) — Required for Quebec

### 9.2 Implementation
- All strings externalized to JSON
- RTL-ready (future-proofing)
- Date/number formatting via Intl API
- Medical terminology reviewed by bilingual clinical team

---

## 10. Performance Budgets

| Metric | Target | Measurement |
|--------|--------|-------------|
| Initial JS (gz) | < 150 KB | Vite bundle analyzer |
| Time to Interactive | < 3.5s | Lighthouse |
| Largest Contentful Paint | < 2.5s | Web Vitals |
| First Input Delay | < 100ms | Web Vitals |
| Cumulative Layout Shift | < 0.1 | Web Vitals |

---

## 11. Usability Testing Plan

### 11.1 Test Scenarios
1. **Coordinator:** Complete 10 tasks in 30 min (baseline: 45 min)
2. **Physician:** Review and decide 5 trigger decisions in 10 min
3. **Patient:** Find next appointment and message nurse in 2 min
4. **Nurse:** Enter monitoring data for 3 patients in 5 min
5. **Accessibility:** Screen reader navigation of full dashboard

### 11.2 Success Criteria
- Task completion rate ≥ 95%
- Time on task ≤ baseline × 0.7
- SUS score ≥ 80
- Zero critical accessibility violations

---

*End of UX Blueprint. Proceeding to Engineering Report.*