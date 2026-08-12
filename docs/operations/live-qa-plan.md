# Live QA Plan — AG Synergy Email Infrastructure

**Purpose:** Step-by-step validation checklist for the complete authenticated patient journey with email integration.

**Last Updated:** 2026-08-05

---

## Prerequisites

- [ ] Resend account provisioned and verified
- [ ] Domain `agsynergy.ca` verified in Resend
- [ ] SPF, DKIM, DMARC DNS records configured and verified
- [ ] Cloudflare Email Routing enabled
- [ ] Worker Secrets set (`RESEND_API_KEY`, `EMAIL_FROM`, `APP_URL`)
- [ ] Worker deployed to production
- [ ] Health endpoint returning 200
- [ ] Test email address ready (e.g. `pilot-test@agsynergy.ca`)
- [ ] Resend dashboard accessible
- [ ] Email client accessible (inbox monitoring)

---

## Test Environment

| Item | Value |
|------|-------|
| Base URL | `https://www.agsynergy.ca` |
| API Base | `https://api.agsynergy.ca` |
| Test Email | `pilot-test@agsynergy.ca` |
| Test Patient Name | `Pilot Test User` |

---

## Test Steps

### Step 1: Registration

| Field | Value |
|-------|-------|
| Action | `POST /identity/register` |
| Payload | `{ "email": "pilot-test@agsynergy.ca", "password": "PilotTest123!", "name": "Pilot Test User" }` |
| Expected | `200 OK`, `{ success: true, message: "Registration successful" }` |
| Evidence | Screenshot of API response + Resend dashboard showing verification email queued |

### Step 2: Verification Email Delivered

| Field | Value |
|-------|-------|
| Action | Check inbox for verification email |
| Expected | Email received within 60 seconds |
| Evidence | Screenshot of inbox showing email from `noreply@agsynergy.ca` with subject "Verify your AG Synergy account" |

### Step 3: Verification Link Opens

| Field | Value |
|-------|-------|
| Action | Click "Verify Email" button in email |
| Expected | Browser navigates to `https://www.agsynergy.ca/identity/email/verify?token=...` |
| Evidence | Screenshot of browser URL bar showing verification page |

### Step 4: Email Verified

| Field | Value |
|-------|-------|
| Action | Wait for verification page to confirm success |
| Expected | `{ success: true, message: "Email verified" }` |
| Evidence | Screenshot of verification success page |

### Step 5: Login

| Field | Value |
|-------|-------|
| Action | `POST /identity/login` |
| Payload | `{ "email": "pilot-test@agsynergy.ca", "password": "PilotTest123!" }` |
| Expected | `200 OK`, JWT token returned |
| Evidence | Screenshot of API response showing `{ success: true, token: "..." }` |

### Step 6: Dashboard

| Field | Value |
|-------|-------|
| Action | `GET /patient/dashboard` (with JWT in Authorization header) |
| Expected | `200 OK`, patient dashboard data returned |
| Evidence | Screenshot of dashboard response |

### Step 7: Document Upload

| Field | Value |
|-------|-------|
| Action | `POST /patient/documents` (with JWT and document file) |
| Expected | `200 OK`, document uploaded, confirmation email sent |
| Evidence | Screenshot of upload response + confirmation email in inbox |

### Step 8: Appointment

| Field | Value |
|-------|-------|
| Action | `POST /patient/appointments` (with JWT and appointment data) |
| Expected | `200 OK`, appointment created, confirmation email sent |
| Evidence | Screenshot of appointment response + confirmation email in inbox |

### Step 9: Timeline

| Field | Value |
|-------|-------|
| Action | `GET /patient/timeline` (with JWT) |
| Expected | `200 OK`, timeline events returned |
| Evidence | Screenshot of timeline response |

### Step 10: Consent

| Field | Value |
|-------|-------|
| Action | `POST /patient/consent` (with JWT and consent data) |
| Expected | `200 OK`, consent recorded, confirmation email sent |
| Evidence | Screenshot of consent response + confirmation email in inbox |

### Step 11: Logout

| Field | Value |
|-------|-------|
| Action | `POST /identity/logout` (with JWT) |
| Expected | `200 OK`, `{ success: true, message: "Logged out" }` |
| Evidence | Screenshot of logout response |

### Step 12: Login Again

| Field | Value |
|-------|-------|
| Action | `POST /identity/login` (same credentials as Step 5) |
| Expected | `200 OK`, new JWT token returned |
| Evidence | Screenshot of API response showing new token |

---

## Evidence Requirements

For each step, the following evidence must be captured:

1. **Screenshot** — visual confirmation of the action and result
2. **API response** — status code and response body
3. **Email evidence** — screenshot of received email (for email-sending steps)
4. **Email headers** — SPF/DKIM/DMARC pass indicators (for email-sending steps)
5. **Resend dashboard** — message ID and delivery status (for email-sending steps)
6. **Timestamp** — ISO 8601 timestamp of each test step

---

## Pass Criteria

- All 12 steps return expected status codes and response bodies
- All verification emails are delivered within 60 seconds
- All emails pass SPF/DKIM/DMARC checks
- No broken links in any email
- No secrets exposed in any API response or log
- No error responses during the journey
- Verification token works correctly on first use
- Login after logout returns a valid new token

---

## Fail Criteria

Any of the following constitutes a test failure:

- Any step returns an unexpected status code
- Email not delivered within 60 seconds
- Email lands in spam/junk folder
- SPF/DKIM/DMARC fails
- Verification link is broken or returns 404
- Any secret is exposed in API response or logs
- Patient journey cannot be completed end-to-end