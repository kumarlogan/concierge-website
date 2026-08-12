# Pilot QA Checklist — AG Synergy Email Infrastructure

**Purpose:** Validate email infrastructure and the complete authenticated patient journey before Pilot Readiness certification.

**Last Updated:** 2026-08-05

---

## Pre-Test Setup

### Infrastructure Readiness

- [ ] Resend account created and verified
- [ ] Domain `agsynergy.ca` verified in Resend
- [ ] SPF record configured and verified
- [ ] DKIM record configured and verified
- [ ] DMARC record configured and verified
- [ ] Cloudflare Email Routing enabled and configured
- [ ] Worker Secrets set (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`)
- [ ] Worker deployed to production
- [ ] Health endpoint returning 200

### Test Environment

- [ ] Test email address prepared (e.g. `pilot-test@agsynergy.ca`)
- [ ] Resend dashboard accessible for monitoring
- [ ] Cloudflare dashboard accessible for routing checks
- [ ] Email client accessible for receiving test emails

---

## Test Execution

### Phase 1: Email Delivery

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 1 | Send verification email | Email received in inbox within 60s | |
| 2 | Send password reset email | Email received in inbox within 60s | |
| 3 | Check email headers | SPF: pass, DKIM: pass, DMARC: pass | |
| 4 | Check sender address | From: `noreply@agsynergy.ca` | |
| 5 | Check subject line | Matches template subject | |
| 6 | Check HTML rendering | Email renders correctly in client | |
| 7 | Check text fallback | Plain text version present | |
| 8 | Check link URLs | Links use `APP_URL` correctly | |

### Phase 2: Verification Flow

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 1 | Register new account | Returns 200, verification email sent | |
| 2 | Open verification link | Navigates to verification page | |
| 3 | Complete verification | Returns success, identity marked verified | |
| 4 | Login with verified email | Returns 200, JWT token issued | |
| 5 | Access dashboard | Returns 200, patient data shown | |

### Phase 3: Password Reset Flow

| # | Test | Expected Result | Pass/Fail |
|---|------|----------------|-----------|
| 1 | Request password reset | Returns 200, reset email sent | |
| 2 | Open reset link | Navigates to reset page | |
| 3 | Complete password reset | Returns success, password updated | |
| 4 | Login with new password | Returns 200, JWT token issued | |

### Phase 4: Full Patient Journey

| Step | Action | Expected Result | Pass/Fail |
|------|--------|----------------|-----------|
| 1 | Register | Account created, verification email sent | |
| 2 | Verify email | Verification link works, identity verified | |
| 3 | Login | JWT token issued, session created | |
| 4 | Access dashboard | Patient dashboard loads correctly | |
| 5 | Upload document | Document uploaded, confirmation email sent | |
| 6 | Book appointment | Appointment created, confirmation email sent | |
| 7 | View timeline | Timeline shows all events | |
| 8 | Provide consent | Consent recorded, confirmation sent | |
| 9 | Logout | Session terminated | |
| 10 | Login again | New session created, JWT token issued | |

---

## Evidence Collection

For each test step, capture:

- [ ] Screenshot of the action
- [ ] API response (status code, body)
- [ ] Email received (screenshot of inbox)
- [ ] Email headers (SPF/DKIM/DMARC results)
- [ ] Resend dashboard entry (message ID, status)
- [ ] Timestamp of the test

---

## Acceptance Criteria

- [ ] All Phase 1 tests pass (8/8)
- [ ] All Phase 2 tests pass (5/5)
- [ ] All Phase 3 tests pass (4/4)
- [ ] All Phase 4 tests pass (10/10)
- [ ] No email delivery failures
- [ ] No broken links in emails
- [ ] SPF/DKIM/DMARC all pass
- [ ] No secrets exposed in any logs or responses
- [ ] Error responses are user-friendly for all failure scenarios