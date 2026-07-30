# CONCIERGE_AUDIT — AGS-RCA-001
# New Patient Fix Plan — Remediation Recommendations

---

## Executive Summary

All 6 P0 findings originate from a single file:
`workers/src/routes/timeline.ts` (lines 52–236).

The file contains a hardcoded `mockTimelineData` constant that is returned to
every user regardless of identity. Three frontend features
(consent/care-team/appointments) correctly handle empty state; four features
(dashboard/care-plan/milestones/tasks) all consume this mock timeline data.

**Smallest possible fix:** Replace the mock data structure with empty defaults
in the same file. No new database tables, no schema migrations, no new API
endpoints, no frontend changes required.

---

## Fix Classification Legend

| Category | Meaning                                              |
|----------|------------------------------------------------------|
| CRITICAL | Must fix before any production use                   |
| HIGH     | Should fix before limited pilot                      |
| MEDIUM   | Fix after pilot — important but not blocking          |
| LOW      | Enhancement — nice to have                           |

---

## FIX-1: Replace Mock Data with Empty Defaults

**Priority: CRITICAL**
**File:** `workers/src/routes/timeline.ts`
**Lines affected:** 52–236

### Current behavior (lines 52–236):
```typescript
const mockTimelineData: TimelineData = {
  carePlan: {
    phases: [ /* 5 hardcoded phases with real dates */ ],
    currentPhase: "phase-3",
    progressPercent: 40,
  },
  tasks: [ /* 6 hardcoded tasks with real dates and "Dr. Sharma" */ ],
  milestones: [ /* 7 hardcoded milestones with Jan-May 2025 dates */ ],
};
```

### Recommended replacement:
```typescript
const defaultTimelineData: TimelineData = {
  carePlan: {
    phases: [],
    currentPhase: null,
    progressPercent: 0,
  },
  tasks: [],
  milestones: [
    {
      id: "ms-account",
      title: "Account Created",
      description: "Your patient portal account was successfully created.",
      date: new Date().toISOString(),
      type: "registration" as const,
      achieved: true,
      achievedAt: new Date().toISOString(),
    },
  ],
};
```

Key changes:
- `progressPercent: 40` → `progressPercent: 0`
- `phases: [5 items]` → `phases: []`
- `tasks: [6 items]` → `tasks: []`
- `milestones: [7 items]` → `milestones: [1 item]` (Account Created only)
- Remove all fake provider names ("Dr. Sharma")
- Remove all fake dates (Jan–May 2025)
- The single Account Created milestone uses dynamic `new Date()` — the real
  registration time rather than a hardcoded past date

### Impact:
- Dashboard shows 0% progress instead of 40%
- Care Plan shows no phases instead of 5 fake phases
- Tasks page shows 0 tasks instead of 6
- Milestones shows 1 real milestone (Account Created) instead of 7 fake ones
- "Dr. Sharma" name removed from all display
- Getting Started card on Dashboard starts appearing (because
  `currentPhaseName` is now null, satisfying the `!currentPhaseName` gate)

### Risk: NONE
This is a constant replacement. No schema changes, no frontend changes.

---

## FIX-2: Add Identity-Aware Timeline Storage

**Priority: HIGH**
**File:** `workers/src/routes/timeline.ts`
**Lines affected:** 240–248 (store factory)

### Current behavior:
```typescript
function getTimelineStore(_env: Env): TimelineData {
  if (!(globalThis as any).__timelineStore) {
    (globalThis as any).__timelineStore = { ...mockTimelineData };
  }
  return (globalThis as any).__timelineStore;
}
```

The global singleton is shared across all requests. A user who has actual
treatment data and a brand-new user see the exact same timeline.

### Recommendation:
Replace the global singleton with a per-identity store or, ideally, database
backing:

**Option A — Per-identity in-memory Map:**
```typescript
const userTimelines = new Map<string, TimelineData>();

function getTimelineStore(identityId: string): TimelineData {
  if (!userTimelines.has(identityId)) {
    userTimelines.set(identityId, { ...defaultTimelineData });
  }
  return userTimelines.get(identityId)!;
}
```

**Option B — D1 database (preferred):** Add D1-backed timeline storage and
real progress calculation based on actual completed tasks/phases.

### Risk: LOW (Option A) / MEDIUM (Option B)
Option A is a simple Map replacement. Option B requires a migration and table.

---

## FIX-3: Update Dashboard "Getting Started" Gate

**Priority: LOW**
**File:** `artifacts/ags-fertility/src/pages/patient/DashboardPage.tsx`
**Line:** 358

### Current behavior:
```typescript
{!loading && !currentPhaseName && !timelineError && (
  /* Getting Started card */
)}
```

The `!currentPhaseName` gate suppresses the Getting Started card when mock data
provides a phase name. After Fix-1, `currentPhaseName` becomes null and the
card appears automatically.

### Recommendation:
Verify the card renders correctly after Fix-1. Consider adding a more explicit
"new user" check if needed.

### Risk: NONE — Fix-1 automatically resolves this.

---

## FIX-4: Add Care Team API Endpoint

**Priority: MEDIUM**
**File(s):** Create `workers/src/routes/care-team.ts`, register in index

### Current behavior:
No `/api/v1/care-team` endpoint exists. The frontend correctly handles empty
state, but the feature is non-functional.

### Recommendation:
Create a care-team API with:
- `GET /api/v1/care-team/:identityId` — returns assigned providers
- `POST /api/v1/care-team/assign` — assign providers to a patient
- `DELETE /api/v1/care-team/:id` — remove provider assignment

### Risk: LOW — adds functionality without breaking existing features.

---

## FIX-5: Add Progress Calculation Logic

**Priority: HIGH**
**File:** `workers/src/routes/timeline.ts`

### Current behavior:
`progressPercent: 40` — hardcoded, no calculation.

### Recommendation:
After Fix-1 (empty defaults), implement a real calculation:
- `progressPercent = (completedPhases / totalPhases) * 100`
- When phases are empty: 0%
- When a task is completed: re-evaluate phase completion

This can be deferred until phase/task management APIs exist, but the default
should be 0% for new users.

### Risk: LOW — Fix-1 sets default to 0%.

---

## Fix Priority Matrix

| Fix   | Description           | Priority | Effort | Depends On | Estimated Timing |
|-------|-----------------------|----------|--------|------------|------------------|
| FIX-1 | Replace mock with default empty data | CRITICAL | 15 min | None | Before any deployment |
| FIX-2 | Per-identity timeline storage | HIGH | 2 hours | FIX-1 | Before limited pilot |
| FIX-5 | Real progress calculation | HIGH | 1 hour | FIX-1 | Before limited pilot |
| FIX-4 | Care team API | MEDIUM | 4 hours | None | Before production |
| FIX-3 | Verify Getting Started gate | LOW | 10 min | FIX-1 | Verify after FIX-1 |

---

## Verification Steps

After implementing FIX-1:

1. Create a brand-new patient account
2. Navigate to Dashboard
   - Verify progress shows 0%
   - Verify Getting Started card appears
   - Verify "No current phase" shows instead of "Treatment Planning"
3. Navigate to Care Plan
   - Verify "No phases yet" or empty state
4. Navigate to Tasks
   - Verify "No tasks" or empty state
5. Navigate to Milestones
   - Verify only "Account Created" milestone shows with today's date
6. Navigate to Care Coordination
   - Verify "No care team assigned" (unchanged)
7. Navigate to Consent Management
   - Verify "No consents recorded yet" (unchanged)
8. Navigate to Appointments
   - Verify "No upcoming appointments" (unchanged)

---

## Rollback Plan

If FIX-1 causes issues:
1. Revert the single constant in `workers/src/routes/timeline.ts`
2. Restore `mockTimelineData` original
3. Optionally: toggle via feature flag `USE_REAL_TIMELINE_DATA`

---

*End of Fix Plan — READ-ONLY — recommendations only, no implementation requested*