# CONCIERGE_AUDIT — AGS-RCA-001
# New Patient State Validation Audit — Full Report

| Field             | Value                                               |
|-------------------|-----------------------------------------------------|
| Audit ID          | AGS-RCA-001                                         |
| Company           | AGS                                                 |
| Platform          | AI Platform                                         |
| Product           | Concierge                                           |
| Public Brand      | AG Synergy                                          |
| Module            | Patient Portal                                      |
| Sprint            | RC1 Validation                                      |
| Classification    | Release Candidate Regression Audit                  |
| Investigator      | Hermes Agent (hy3)                                  |
| Date              | 2026-07-30                                          |
| Status            | COMPLETE — READ-ONLY                                |

---

## Executive Summary

A brand-new patient account was created after RC1 validation. Unexpectedly, the
portal displayed pre-populated information including treatment progress,
care-plan phases with historical dates, journey milestones spanning Jan–May
2025, tasks with completed/in-progress/pending status, and references to a
provider name ("Dr. Sharma"). The Registration → Database → API → Frontend
pipeline was traced end-to-end to identify every source of unexpected data.

---

## Summary of Findings

| #   | Finding                                                | Severity | Source                    | Root Cause Type       |
|-----|--------------------------------------------------------|----------|---------------------------|-----------------------|
| RC1 | 40% treatment progress on new account                  | P0       | Worker API (timeline.ts)  | Hardcoded mock data   |
| RC2 | 5 care-plan phases with historical dates               | P0       | Worker API (timeline.ts)  | Hardcoded mock data   |
| RC3 | 7 journey milestones (Jan–May 2025 dates)             | P0       | Worker API (timeline.ts)  | Hardcoded mock data   |
| RC4 | 6 tasks with statuses (completed/in_progress/pending)  | P0       | Worker API (timeline.ts)  | Hardcoded mock data   |
| RC5 | "Dr. Sharma" referenced in a task                      | P0       | Worker API (timeline.ts)  | Hardcoded mock data   |
| RC6 | No care-team API endpoint exists                       | P0       | Worker routes             | Missing implementation |
| CC1 | Consent page correctly shows empty state               | PASS     | Frontend (ConsentMgmt)    | Correct               |
| CC2 | Care coordination page correctly shows empty state     | PASS     | Frontend (CareCoord)      | Correct               |
| CC3 | Appointments page correctly handles empty state        | PASS     | Frontend (Appointments)   | Correct               |
| CC4 | Dashboard shows Getting Started card for new users     | PASS     | Frontend (Dashboard)      | Correct               |

---

## Root Cause Summary

**All pre-populated data originates from a single file:**
`workers/src/routes/timeline.ts`

Lines 52–236 define `mockTimelineData`, a hardcoded JSON structure containing:

- **progressPercent: 40** (line 107) — drives the dashboard's 40% progress bar
- **5 phases** (lines 54–105) — with real dates in Jan–Mar 2025, 2 completed,
  1 in_progress, 2 not_started
- **6 tasks** (lines 109–169) — with real due dates, completed timestamps,
  and a reference to "Dr. Sharma"
- **7 milestones** (lines 171–235) — with dates spanning Jan–May 2025, 3
  achieved, 4 pending

The singleton store (`getTimelineStore`, lines 240–248) creates ONE copy of
this mock data on first access and returns it to EVERY user, regardless of
identity. There is no per-user isolation, no database query, and no calculation
based on actual patient activity.

**Three frontend features pass empty state correctly:**
- Consent management (ConsentManagementPage.tsx)
- Care coordination (CareCoordinationPage.tsx)
- Appointments (AppointmentsPage.tsx)

These features have no mock data and correctly display empty-state UI when
their respective APIs return no data. However, the care-team feature has NO
backend API endpoint at all — the frontend correctly shows "No care team
assigned" because `const careTeam: CareTeamMember[] = []` is initialized as
empty.

---

## Data Pipeline Tracing

Full trace: `NEW_PATIENT_ROOT_CAUSE_ANALYSIS.md`

```
User Registration
  └→ POST /identity/register
      └→ Worker creates identity record in D1 + auth tables
      └→ NO healthcare data created (no patient_profile, no care_team, no timeline)
      └→ Returns auth tokens to frontend

Dashboard Page Load
  └→ GET /api/v1/timeline
      └→ workers/src/routes/timeline.ts:_getTimeline
          └→ getTimelineStore(env)
              └→ returns mockTimelineData (HARDCODED)
                  └→ progressPercent: 40
                  └→ phases with real dates
                  └→ tasks with real dates + "Dr. Sharma"
                  └→ milestones with Jan-May 2025 dates
      └→ Frontend renders data directly — no fallback/empty check
```

---

## Answer to Investigation Questions

### Q1: Why does a brand-new patient see 40% completion?
**A1:** Because `workers/src/routes/timeline.ts` at line 107 hardcodes
`progressPercent: 40`. This is returned by `GET /api/v1/timeline` for every
user. There is no database query, no calculation based on patient activity, and
no per-user variation.

### Q2: Why are doctors already assigned?
**A2:** No doctor/care-team is assigned to the patient. The care-team page
correctly shows "No care team assigned" because `CareCoordinationPage.tsx`
initializes `const careTeam: CareTeamMember[] = []`. However, one task (task-2,
"Discuss treatment options") references "Dr. Sharma" in its description text
on line 123 of timeline.ts: `"Attend consultation with Dr. Sharma to
discuss..."`. This creates the illusion of a pre-assigned provider.

### Q3: Why are consent dates populated?
**A3:** The consent management page correctly shows "No consents recorded yet"
for new users. The consent engine has no seed data and returns empty results
for new identities. If the screenshot showed consent dates, those may have come
from the timeline mock data (task-4 "Consent to procedures" has a due date of
2025-03-25) or from test consent records in a non-pristine DB. In the current
codebase, new users see an empty consent state.

### Q4: Why does the journey already exist?
**A4:** Because `mockTimelineData` in timeline.ts (lines 52–236) contains 7
hardcoded milestones with fixed dates (2025-01-10 through 2025-05-01). These
are returned by `GET /api/v1/timeline` for every user. The milestones include
"Account Created" (Jan 10, 2025), "Initial Consultation Completed" (Jan 20,
2025), "Diagnostics Completed" (Feb 15, 2025), and 4 future milestones.

### Q5: Is the data coming from the database, the API, or the frontend?
**A5:** The data comes from the **API layer** (`workers/src/routes/timeline.ts`),
which returns hardcoded mock data on every request. It does NOT come from:
- The database (no patient healthcare tables exist)
- The frontend (which correctly renders whatever the API returns)
- Any seed/initialization routine

### Q6: What is the smallest change required to ensure a brand-new patient starts with a truly blank healthcare record?
**A6:** Replace `mockTimelineData` in `workers/src/routes/timeline.ts` with
empty/default values:
- `progressPercent: 0`
- `phases: []` (or a single "not_started" phase with null dates)
- `tasks: []`
- `milestones: []` (or one "Account Created" milestone with today's date)
- Remove "Dr. Sharma" reference from all task descriptions

This is a single-file change affecting lines 52–236 of timeline.ts.

---

## Severity Classification

| Severity | Count | Description                                    |
|----------|-------|------------------------------------------------|
| P0       | 6     | Incorrect healthcare data shown to new patients|
| P1       | 0     | Incorrect onboarding state                     |
| P2       | 0     | UX inconsistency                               |
| P3       | 0     | Enhancement opportunity                        |

All six findings are P0 because they display fabricated treatment history and
clinical data to new patients, creating false expectations and privacy concerns.

---

## Reconciliation with Screenshot (PDF Reference)

The original investigation was triggered by a screenshot PDF
(`/tmp/6D4AAA4C-2AA9-4786-9EA9-CC134017326A.pdf`) showing pre-populated data.
The current codebase has evolved since that screenshot was taken:

- **Consent dates visible in screenshot** → Now correctly empty (fixed)
- **Care team visible in screenshot** → Now correctly empty (fixed)
- **Timeline/journey/progress visible in screenshot** → Still broken (not fixed)

This confirms the RC1 codebase partially addresses the original issues but the
core problem — hardcoded timeline mock data — remains.

---

## Document References

| Document                                           | Description                                     |
|----------------------------------------------------|-------------------------------------------------|
| NEW_PATIENT_ROOT_CAUSE_ANALYSIS.md                 | Full end-to-end trace with file:line citations  |
| DEFAULT_DATA_INVENTORY.md                          | Inventory of every pre-populated data element   |
| EMPTY_STATE_COMPLIANCE_REPORT.md                   | Empty state audit across all pages              |
| NEW_PATIENT_FIX_PLAN.md                            | Remediation recommendations                     |

---

*End of Audit — READ-ONLY — No code was modified during this investigation*