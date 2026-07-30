# CONCIERGE_VALIDATION — AGS-PZE-001
# Patient Zero Validation — Test Procedures

| Field             | Value                                                       |
|-------------------|-------------------------------------------------------------|
| Document ID       | AGS-PZE-001-VALIDATION                                      |
| Company           | AGS                                                         |
| Platform          | AI Platform                                                 |
| Product           | Concierge                                                   |
| Public Brand      | AG Synergy                                                  |
| Module            | Patient Portal                                              |
| Sprint            | RC1 Remediation                                             |
| Classification    | Validation Procedures                                       |
| Author            | Hermes Agent (hy3)                                          |
| Date              | 2026-07-30                                                  |
| Status            | READY FOR EXECUTION                                         |

---

## Prerequisites

1. **Deployed code** — `workers/src/routes/timeline.ts` must be built and deployed
2. **Two independent test accounts** — Create two brand-new patient accounts
   (Account A and Account B) via the registration flow
3. **No shared state** — Account A and Account B must be created in separate
   browser sessions (or incognito windows) to prevent cookie/session leakage
4. **JWT tokens** — Each account must have a valid JWT token from the
   registration flow; the token is required for authenticated API calls

---

## Validation Scope

### 9 interface areas to verify

| # | Area | Endpoint | Expected State |
|---|------|----------|----------------|
| 1 | Dashboard — Progress | `GET /api/v1/timeline` | 0% progress |
| 2 | Dashboard — Getting Started card | `GET /api/v1/timeline` | Card visible |
| 3 | Care Plan — Phases | `GET /api/v1/timeline/phases` | Empty phases array |
| 4 | Care Plan — Current phase | `GET /api/v1/timeline/phases` | null |
| 5 | Tasks — Task list | `GET /api/v1/timeline/tasks` | Empty tasks array |
| 6 | Milestones — Milestone list | `GET /api/v1/timeline/milestones` | 1 milestone (Account Created) |
| 7 | Care Coordination | `GET /api/v1/care-team/*` | "No care team assigned" |
| 8 | Consent Management | `GET /api/v1/consents/*` | "No consents recorded yet" |
| 9 | Appointments | `GET /api/v1/appointments/*` | "No upcoming appointments" |

---

## Test Procedure

### Step 1: Create Account A

1. Navigate to the Patient Portal registration page
2. Complete the registration flow with a unique email (e.g., `patient-zero-a@test.agsynergy.ca`)
3. Verify registration succeeds and JWT token is returned
4. Record the JWT token for API testing

### Step 2: Verify Account A API Responses

Execute the following curl commands with Account A's JWT token:

```bash
# Replace TOKEN_A with the actual JWT token from registration

# Test 1: Timeline — should return Patient Zero default state
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline | jq '.timeline.carePlan.progressPercent'
# EXPECTED: 0

# Test 2: Phases — should be empty
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline/phases | jq '.phases | length'
# EXPECTED: 0

# Test 3: Current phase — should be null
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline/phases | jq '.currentPhase'
# EXPECTED: null

# Test 4: Tasks — should be empty
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline/tasks | jq '.tasks | length'
# EXPECTED: 0

# Test 5: Milestones — should have exactly 1 (Account Created)
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline/milestones | jq '.milestones | length'
# EXPECTED: 1

# Test 6: Milestone details — should be "Account Created"
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline/milestones | jq '.milestones[0].title'
# EXPECTED: "Account Created"

# Test 7: Verify no fake provider names
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline | jq '.. | strings | select(test("Sharma|Dr\\."))'
# EXPECTED: empty (no output)

# Test 8: Verify no 2025 dates
curl -s -H "Authorization: Bearer TOKEN_A" \
  https://<deployment-url>/api/v1/timeline | jq '.. | strings | select(test("2025"))'
# EXPECTED: empty (no output)
```

### Step 3: Verify Account A Frontend Pages

1. Log in to the Patient Portal as Account A
2. Navigate to **Dashboard**:
   - ✅ Verify progress bar shows 0%
   - ✅ Verify Getting Started card is visible
   - ✅ Verify no "40% complete" text
   - ✅ Verify no provider name references
3. Navigate to **Care Plan**:
   - ✅ Verify "No phases yet" or similar empty state
   - ✅ Verify no pre-existing phases with dates
4. Navigate to **Tasks**:
   - ✅ Verify "No tasks" or similar empty state
   - ✅ Verify no "Dr. Sharma" references
5. Navigate to **Milestones**:
   - ✅ Verify exactly 1 milestone: "Account Created"
   - ✅ Verify milestone date is today's date (not a 2025 date)
6. Navigate to **Care Coordination**:
   - ✅ Verify "No care team assigned" (unchanged behavior)
7. Navigate to **Consent Management**:
   - ✅ Verify "No consents recorded yet" (unchanged behavior)
8. Navigate to **Appointments**:
   - ✅ Verify "No upcoming appointments" (unchanged behavior)

### Step 4: Create Account B

1. Open a new incognito/private browser window (different session from Account A)
2. Complete the registration flow with a different email (e.g., `patient-zero-b@test.agsynergy.ca`)
3. Verify registration succeeds

### Step 5: Verify Account B Isolation

Repeat Steps 2–3 for Account B.

**Critical isolation checks:**
- ✅ Account B must also show 0% progress, empty phases, empty tasks, 1 milestone
- ✅ Account B's "Account Created" milestone must show Account B's registration time
- ✅ Account A's data (if any was created) must NOT be visible in Account B
- ✅ Account B's data must NOT be visible in Account A

### Step 6: Cross-User Isolation Test

1. If Account A made any state changes (e.g., adding a task via PATCH), verify that
   Account B's timeline still shows the Patient Zero default state
2. If neither account made changes, verify that both accounts independently show
   their own "Account Created" milestone with their own registration timestamps

---

## Expected Results Summary

| # | Test | Account A | Account B |
|---|------|-----------|-----------|
| 1 | Progress | 0% | 0% |
| 2 | Getting Started card | Visible | Visible |
| 3 | Phases | [] | [] |
| 4 | Current phase | null | null |
| 5 | Tasks | [] | [] |
| 6 | Milestones | 1 (Account Created) | 1 (Account Created) |
| 7 | No fake provider names | ✅ | ✅ |
| 8 | No 2025 dates | ✅ | ✅ |
| 9 | No cross-user data | ✅ | ✅ |

---

## Test Environment

### Required credentials
- Two unique email addresses for registration
- One deployed instance of the Patient Portal (any environment)

### Cleanup
After validation is complete:
- Test accounts can be deleted or left in place
- Test data in per-identity store is ephemeral (in-memory Map)
- No persistent database records were created by this validation

---

## Failure Conditions

| Symptom | Likely Cause | Action |
|---------|-------------|--------|
| Progress still shows 40% | Old code deployed | Verify build includes updated timeline.ts |
| Phases still visible | Old mock data cached | Clear browser cache or hard refresh |
| Cross-user data visible | Singleton store still in use | Verify `getTimelineStore` was replaced with `getOrCreateTimelineStore` |
| JWT errors (401) | JWT token expired or invalid | Re-register to get a fresh token |
| "Dr. Sharma" still visible | Old build deployed | Rebuild workers with updated source |

---

*End of Validation Procedures — Ready for Execution*