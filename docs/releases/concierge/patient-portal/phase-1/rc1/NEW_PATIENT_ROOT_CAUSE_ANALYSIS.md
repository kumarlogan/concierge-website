# CONCIERGE_AUDIT — AGS-RCA-001
# New Patient Root Cause Analysis — Full Trace
# Registration → Database → API → Frontend → UI Pipeline

---

## 1. Registration Flow

### 1.1 Registration Endpoint

The frontend calls `patientAuth.register(email, password, displayName)`
which sends `POST /identity/register` with body:
```json
{
  "identityType": "patient",
  "email": "user@example.com",
  "password": "********",
  "profile": { "displayName": "Test User" }
}
```

### 1.2 Database Inserts on Registration

Based on `0002_identity_core.sql` (298 lines) and `0001_initial_schema.sql`
(204 lines), registration creates records in:

| Table            | Purpose                        | Rows Created |
|------------------|--------------------------------|--------------|
| identities       | Core identity record           | 1            |
| identity_emails  | Email credential               | 1            |
| identity_secrets | Password hash                  | 1            |
| sessions         | Login session (if auto-login)  | 1            |

### 1.3 Tables NOT Inserted During Registration

These tables have NO registration trigger, seed, or default:

| Table / Data Area           | Status                              |
|-----------------------------|-------------------------------------|
| patient_profiles            | Table does not exist in schema      |
| care_teams                  | Table does not exist in schema      |
| care_team_members           | Table does not exist in schema      |
| timeline_events             | Table does not exist in schema      |
| milestones                  | Table does not exist in schema      |
| treatment_phases            | Table does not exist in schema      |
| progress_tracking           | Table does not exist in schema      |
| consents                    | Table exists (0008) but empty       |
| appointments                | In-memory only — empty per instance |
| clinic_assignments          | Table does not exist in schema      |
| clinic_partner_relationships| Table does not exist                |
| provider_assignments        | Table does not exist in schema      |

**Conclusion: Registration creates only identity/auth records. No healthcare
data is created, and no tables exist to store treatment history. The data
visible in the dashboard is NOT from the database.**

---

## 2. Backend API — Services Layer

### 2.1 Identity Service (`platform/identity/`)

Real implementation with D1 persistence. Returns only what's stored in the
database. No mock data, no fallback.

### 2.2 Consent Engine (`platform/trust/consent-engine.ts`)

Real implementation with D1 persistence (backed by `0008_consent_engine.sql`)
+ in-memory fallback. For new users, `getHistory()` returns empty arrays.
No seed data exists.

### 2.3 Document Engine (`platform/documents/`)

In-memory with D1 persistence via configured storage. Empty per-instance.

### 2.4 Appointment Engine (`platform/appointments/in-memory-appointment-engine.ts`)

In-memory singleton. Empty per-instance — no pre-seeded appointments. See
`0003_ops_lead_fields.sql` and `0001_initial_schema.sql` for the schema
reference. The singleton creates a new empty engine if one doesn't exist.

---

## 3. Worker API Routes — The Problematic Layer

### 3.1 Timeline Routes (`workers/src/routes/timeline.ts`)

**This is the single source of ALL pre-populated data.**

Implementation: `getTimelineStore()` singleton (lines 240–248)

```typescript
function getTimelineStore(_env: Env): TimelineData {
  if (!(globalThis as any).__timelineStore) {
    (globalThis as any).__timelineStore = { ...mockTimelineData };
  }
  return (globalThis as any).__timelineStore;
}
```

The `mockTimelineData` constant (lines 52–236) contains:

#### 3.1.1 Progress (line 107)
```typescript
progressPercent: 40  // HARDCODED — no calculation
```

#### 3.1.2 Care Plan Phases (lines 54–105)
| ID      | Name                 | Status       | Start          | Completed      |
|---------|----------------------|--------------|----------------|----------------|
| phase-1 | Initial Consultation | completed    | 2025-01-15     | 2025-01-20     |
| phase-2 | Diagnostic Testing   | completed    | 2025-02-01     | 2025-02-15     |
| phase-3 | Treatment Planning   | in_progress  | 2025-03-01     | null           |
| phase-4 | Treatment Cycle      | not_started  | null           | null           |
| phase-5 | Recovery & Follow-up | not_started  | null           | null           |

Current phase: `phase-3` (Treatment Planning)

#### 3.1.3 Tasks (lines 109–169)
| ID    | Title                        | Phase   | Status       | Due Date       |
|-------|------------------------------|---------|--------------|----------------|
| task-1| Review diagnostic results    | phase-3 | completed    | 2025-03-05     |
| task-2| Discuss treatment options    | phase-3 | in_progress  | 2025-03-12     |
| task-3| Finalize treatment plan      | phase-3 | pending      | 2025-03-20     |
| task-4| Consent to procedures        | phase-3 | pending      | 2025-03-25     |
| task-5| Blood work panel             | phase-2 | completed    | 2025-02-05     |
| task-6| Medication orientation       | phase-4 | pending      | 2025-04-01     |

Task-2 description (line 123) references "Dr. Sharma":
```
"Attend consultation with Dr. Sharma to discuss available treatment options
based on your results."
```

#### 3.1.4 Milestones (lines 171–235)
| ID   | Title                       | Type           | Date         | Achieved |
|------|----------------------------|----------------|--------------|----------|
| ms-1 | Account Created            | registration   | 2025-01-10   | true     |
| ms-2 | Initial Consultation Compl.| consultation   | 2025-01-20   | true     |
| ms-3 | Diagnostics Completed      | consultation   | 2025-02-15   | true     |
| ms-4 | Treatment Plan Finalized   | treatment_plan | 2025-03-20   | false    |
| ms-5 | Treatment Cycle Started    | procedure      | 2025-04-01   | false    |
| ms-6 | Procedure Day              | procedure      | 2025-04-15   | false    |
| ms-7 | Follow-up Complete         | follow_up      | 2025-05-01   | false    |

### 3.2 Consent Routes (`workers/src/routes/trustRuntime.ts`)

**Correctly implemented.** `GET /api/v1/consent/history` calls
`env.CONSENT_ENGINE.getHistory()`, which returns empty for new users.

### 3.3 Care Team Routes

**DO NOT EXIST.** No `/api/v1/care-team` endpoint is registered in any Worker
route file. The Worker registers routes from:
- `timeline.ts` — timeline, phases, tasks, milestones
- `trustRuntime.ts` — trust, policy, consent, delegation, authorization
- `wave7.ts` — Wave 7 appointment APIs
- `coordination.ts` — appointment coordination
- `consultations.ts` — consultation APIs
- `contact.ts` — contact form
- `clinic.ts` — clinic APIs
- `clinic-messages.ts` — clinic messaging
- `documents.ts` — document APIs
- `adminBot.ts` — admin bot
- `health.ts` — health check
- `telegram.ts` — Telegram bot
- `ops.ts` — ops endpoints

No care-team route exists among these.

### 3.4 Appointment Routes (`workers/src/routes/wave7.ts`)

Correctly returns empty for new users. The in-memory engine has no pre-seeded
appointments, and the D1-backed routes return empty results for new identities.

---

## 4. Frontend Pages — Rendering & State

### 4.1 DashboardPage.tsx (lines 38–505)

Calls `getTimeline()` which hits `GET /api/v1/timeline`.

- **Progress display** (line 205): `{progressPercent}%` — renders the
  hardcoded 40% directly
- **Current phase** (lines 52–55): picks current phase from mock phases array
- **Next milestone** (lines 57–66): finds first unachieved milestone in mock
  data
- **Upcoming tasks** (lines 68–71): counts pending/in_progress tasks from mock
- NO fallback check — assumes API data is real, never validates it against
  actual patient activity
- Getting Started card (lines 358–414) only shows when `!currentPhaseName &&
  !timelineError` — since mock data always has a currentPhaseName, this card
  NEVER shows for new users

### 4.2 CarePlanPage.tsx

Renders phases from `GET /api/v1/timeline/phases`. Displayes 5 phases with
status badges, dates, and tasks directly from mock data. No empty-state check
for new users.

### 4.3 CareCoordinationPage.tsx

**Correctly empty.** Initializes `const careTeam: CareTeamMember[] = []`.
No API call to populate it. Shows "No care team assigned" message.

### 4.4 ConsentManagementPage.tsx (lines 41–219)

**Correctly empty.** Calls `patientConsent.list()` → `GET /api/v1/consent/history`.
Shows ShieldCheck icon with "No consents recorded yet" message when the API
returns empty array (lines 107–114).

### 4.5 AppointmentsPage.tsx

**Correctly empty.** Calls `getAppointments()` → empty array returned. Shows
"No upcoming appointments" with CTA to book.

### 4.6 Timeline/Tasks/Milestones Pages

These pages consume the mock data endpoints (`GET /api/v1/timeline/tasks`,
`GET /api/v1/timeline/milestones`). All return hardcoded mock data with
no empty-state handling for new users.

---

## 5. Per-User Isolation Analysis

### 5.1 Identity-layer isolation
- All identity/consent/trust APIs use `identityId` to scope data
- These are identity-aware and return correct per-user results

### 5.2 Timeline-layer isolation
- The timeline route does NOT use `identityId` at all
- `getTimelineStore()` ignores the `env` parameter entirely
- The singleton is shared across all requests for the Worker's lifetime
- Every user gets the SAME progress, phases, tasks, and milestones
- The mock data dates (Jan–May 2025) are static and never relative to the
  current date or user registration date

---

## 6. Data Source Classification

| Data Element        | Source                 | File:Line     | Type        |
|---------------------|------------------------|---------------|-------------|
| progressPercent: 40 | timeline.ts            | 107           | Hardcoded   |
| 5 phases            | timeline.ts            | 54–105        | Hardcoded   |
| 6 tasks             | timeline.ts            | 109–169       | Hardcoded   |
| 7 milestones        | timeline.ts            | 171–235       | Hardcoded   |
| "Dr. Sharma" name   | timeline.ts (task-2)   | 123           | Hardcoded   |
| Consent dates       | N/A — correctly empty  | —             | Correct     |
| Care team           | N/A — no endpoint      | —             | Missing     |
| Appointments        | N/A — correctly empty  | —             | Correct     |

**Single source of all P0 findings: workers/src/routes/timeline.ts**

---

*End of Root Cause Analysis — READ-ONLY*