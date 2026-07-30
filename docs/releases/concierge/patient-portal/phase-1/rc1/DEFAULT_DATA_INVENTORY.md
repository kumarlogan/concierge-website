# CONCIERGE_AUDIT — AGS-RCA-001
# Default Data Inventory — Every Pre-Populated Element

## Scope

Complete inventory of every data element returned to a brand-new patient whose
account was created moments ago. Covers all API endpoints called during initial
portal load.

---

## 1. Timeline API — GET /api/v1/timeline

**Source file:** `workers/src/routes/timeline.ts:52-236`
**Store type:** In-memory singleton (globalThis.__timelineStore)

### 1.1 Care Plan Progress

| Field            | Value | Type      | Source:Line    |
|------------------|-------|-----------|----------------|
| progressPercent  | 40    | number    | timeline.ts:107|

### 1.2 Care Plan Phases (5 records)

| ID        | Name                     | Status      | Start        | Completed        |
|-----------|--------------------------|-------------|--------------|------------------|
| phase-1   | Initial Consultation     | completed   | 2025-01-15   | 2025-01-20       |
| phase-2   | Diagnostic Testing       | completed   | 2025-02-01   | 2025-02-15       |
| phase-3   | Treatment Planning       | in_progress | 2025-03-01   | null             |
| phase-4   | Treatment Cycle          | not_started | null         | null             |
| phase-5   | Recovery & Follow-up     | not_started | null         | null             |

Current phase: `phase-3` (Treatment Planning)

### 1.3 Tasks (6 records)

| ID     | Title                      | Phase   | Status       | Due          | Completed     |
|--------|----------------------------|---------|--------------|--------------|---------------|
| task-1 | Review diagnostic results  | phase-3 | completed    | 2025-03-05   | 2025-03-04    |
| task-2 | Discuss treatment options  | phase-3 | in_progress  | 2025-03-12   | null          |
| task-3 | Finalize treatment plan    | phase-3 | pending      | 2025-03-20   | null          |
| task-4 | Consent to procedures      | phase-3 | pending      | 2025-03-25   | null          |
| task-5 | Blood work panel           | phase-2 | completed    | 2025-02-05   | 2025-02-03    |
| task-6 | Medication orientation     | phase-4 | pending      | 2025-04-01   | null          |

### 1.4 Milestones (7 records)

| ID   | Title                         | Type           | Date         | Achieved | Achieved At       |
|------|-------------------------------|----------------|--------------|----------|-------------------|
| ms-1 | Account Created               | registration   | 2025-01-10   | true     | 2025-01-10        |
| ms-2 | Initial Consultation Completed| consultation   | 2025-01-20   | true     | 2025-01-20        |
| ms-3 | Diagnostics Completed         | consultation   | 2025-02-15   | true     | 2025-02-15        |
| ms-4 | Treatment Plan Finalized      | treatment_plan | 2025-03-20   | false    | null               |
| ms-5 | Treatment Cycle Started       | procedure      | 2025-04-01   | false    | null               |
| ms-6 | Procedure Day                 | procedure      | 2025-04-15   | false    | null               |
| ms-7 | Follow-up Complete            | follow_up      | 2025-05-01   | false    | null               |

---

## 2. Consent API — GET /api/v1/consent/history

**Source file:** `workers/src/routes/trustRuntime.ts:188-221`
**Backend:** D1-backed consent engine

| Data Element | Value       | Status          |
|--------------|-------------|-----------------|
| consents     | []          | CORRECT — empty |
| total        | 0           | CORRECT — zero  |

---

## 3. Care Team — (No API Endpoint)

**Status:** No `/api/v1/care-team` endpoint registered in any route file.

| Data Element | Value | Status          |
|--------------|-------|-----------------|
| care team    | []    | CORRECT — empty |

---

## 4. Appointments API — GET /api/v1/appointments

**Source file:** `workers/src/routes/wave7.ts`
**Backend:** In-memory appointment engine

| Data Element | Value | Status          |
|--------------|-------|-----------------|
| appointments | []    | CORRECT — empty |

---

## 5. Identity API — GET /identity/me

**Source file:** Worker identity routes
**Backend:** D1-backed

Returns the user's actual identity record:
- id, email, displayName, status, mfaEnabled, etc.
- No healthcare data is included

---

## 6. Consent/Timeline Cross-Reference

The timeline's task-4 "Consent to procedures" (due 2025-03-25) and the
timeline's phase-3 "Treatment Planning" suggest consent was already given.
However, the actual consent engine returns empty. This inconsistency confirms
the timeline mock data is entirely disconnected from the real consent system.

---

## 7. All Pre-Populated Data Count

| Category          | Record Count | Fake Values | Source                |
|-------------------|-------------|-------------|-----------------------|
| Progress percent  | 1           | 40%         | timeline.ts           |
| Phases            | 5           | 5 fake      | timeline.ts           |
| Tasks             | 6           | 6 fake      | timeline.ts           |
| Milestones        | 7           | 7 fake      | timeline.ts           |
| Providers named   | 1           | "Dr. Sharma"| timeline.ts (task-2)  |

**Total fake records returned to a new user: 19**

(all from a single file: workers/src/routes/timeline.ts)

---

*End of Default Data Inventory*