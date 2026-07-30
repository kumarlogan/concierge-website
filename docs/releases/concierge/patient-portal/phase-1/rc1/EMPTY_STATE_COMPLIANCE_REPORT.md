# CONCIERGE_AUDIT — AGS-RCA-001
# Empty State Compliance Report

---

## Assessment Criteria

For each page, verify:
1. Does the page fetch real data from the backend?
2. When no data exists (new user), does the page show an appropriate empty state?
3. Does the page ever render mock/placeholder data as real data?
4. Is the page's behavior correct for a brand-new patient?

---

## 1. Dashboard Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | NO       | Calls `getTimeline()` → `GET /api/v1/timeline` → returns mock     |
| Appropriate empty state? | FAIL     | Always shows 40% progress + fake phase + fake milestone + fake    |
|                          |          | tasks. "Getting Started" card is SUPPRESSED because mock data     |
|                          |          | provides `currentPhaseName` (line 358: `!currentPhaseName` gate) |
| Mock rendered as real?   | YES      | All timeline data is mock, rendered as real patient data          |
| Correct for new user?    | NO       | P0 VIOLATION — fabricated treatment history                       |

**File:** `artifacts/ags-fertility/src/pages/patient/DashboardPage.tsx`

---

## 2. Care Plan Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | NO       | Calls `getPhases()` → `GET /api/v1/timeline/phases` → mock        |
| Appropriate empty state? | FAIL     | Shows 5 phases with fake statuses and dates                       |
| Mock rendered as real?   | YES      | All phase data is mock, rendered as real patient journey          |
| Correct for new user?    | NO       | P0 VIOLATION — fabricated care plan timeline                       |

**File:** `artifacts/ags-fertility/src/pages/patient/CarePlanPage.tsx`

---

## 3. Care Coordination Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | N/A      | No API endpoint exists for care team                              |
| Appropriate empty state? | PASS     | Shows "No care team assigned" with helpful text                   |
| Mock rendered as real?   | NO       | `const careTeam: CareTeamMember[] = []` — empty array             |
| Correct for new user?    | YES      | Correctly shows empty state                                       |

**File:** `artifacts/ags-fertility/src/pages/patient/CareCoordinationPage.tsx`

---

## 4. Consent Management Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | YES      | Calls `patientConsent.list()` → `GET /api/v1/consent/history`     |
| Appropriate empty state? | PASS     | Shows ShieldCheck + "No consents recorded yet" + grant UI         |
| Mock rendered as real?   | NO       | Correctly shows available consent types for granting              |
| Correct for new user?    | YES      | Correctly shows empty state with CTA                              |

**File:** `artifacts/ags-fertility/src/pages/patient/ConsentManagementPage.tsx`

---

## 5. Appointments Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | YES      | Calls `getAppointments()` → empty array returned                  |
| Appropriate empty state? | PASS     | Shows "No upcoming appointments" with CTA to book                 |
| Mock rendered as real?   | NO       | Correctly empty                                                   |
| Correct for new user?    | YES      | Correctly shows empty state                                       |

**File:** `artifacts/ags-fertility/src/pages/patient/AppointmentsPage.tsx`

---

## 6. Milestones Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | NO       | Calls `GET /api/v1/timeline/milestones` → returns mock            |
| Appropriate empty state? | FAIL     | Shows 7 milestones with fake dates and goals                      |
| Mock rendered as real?   | YES      | All milestone data is mock, rendered as real achievements         |
| Correct for new user?    | NO       | P0 VIOLATION — fabricated treatment milestones                    |

**File:** Client-side milestone rendering component.

---

## 7. Tasks Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | NO       | Calls `GET /api/v1/timeline/tasks` → returns mock                 |
| Appropriate empty state? | FAIL     | Shows 6 tasks with fake statuses and due dates                    |
| Mock rendered as real?   | YES      | All task data is mock, includes "Dr. Sharma" reference            |
| Correct for new user?    | NO       | P0 VIOLATION — fabricated task list includes provider name        |

**File:** Client-side task rendering component.

---

## 8. Timeline/Journey Page

| Criterion                | Verdict  | Evidence                                                          |
|--------------------------|----------|-------------------------------------------------------------------|
| Fetches real data?       | NO       | Calls `GET /api/v1/timeline` → returns mock                       |
| Appropriate empty state? | FAIL     | Shows full treatment journey with fake data                       |
| Mock rendered as real?   | YES      | Entire journey is fabricated                                       |
| Correct for new user?    | NO       | P0 VIOLATION — fabricated patient journey                         |

---

## Summary

| Page                    | Correct | Violation | Severity | Root Cause                   |
|-------------------------|---------|-----------|----------|------------------------------|
| Dashboard               | NO      | RC1–RC4   | P0       | timeline.ts mock data        |
| Care Plan               | NO      | RC2       | P0       | timeline.ts mock data        |
| Care Coordination       | YES     | —         | —        | —                            |
| Consent Management      | YES     | —         | —        | —                            |
| Appointments            | YES     | —         | —        | —                            |
| Milestones              | NO      | RC3       | P0       | timeline.ts mock data        |
| Tasks                   | NO      | RC4       | P0       | timeline.ts mock data        |
| Timeline/Journey        | NO      | RC3       | P0       | timeline.ts mock data        |

**4 pages pass** — correctly show empty state for new users.
**4 pages fail** — show fabricated data due to hardcoded mock data in
`workers/src/routes/timeline.ts`.

---

*End of Empty State Compliance Report*