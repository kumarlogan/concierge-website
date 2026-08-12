# First Patient Journey Certification

## Overview
This document captures the certification of the first external pilot patient journey for AG Synergy. It documents the end‑to‑end patient journey, test results, evidence, blockers, and patient impact.

## Scope
The following steps are evaluated:
1. Registration
2. Email verification
3. Login
3. Profile
4. Documents
5. Consultation
6. Appointments
7. Timeline
8. Consent
9. Messaging
10. Password reset
11. Logout & session security
12. Cross‑patient authorization
13. Email deliverability
14. Observability
15. Privacy & security

## Scorecard

| Step | Expected | Actual | Status | Evidence | Blocker | Patient Impact |
|------|----------|--------|--------|----------|---------|----------------|
| 1. Registration | Registration form loads and validates inputs | Preliminary UI loaded; functional testing pending | **PENDING** | No evidence yet | Awaiting end‑to‑end test | Pending – patient cannot complete registration |
| 2. Email verification | Verification email arrives, link works, token validated | Email service operational; verification flow not yet tested | **PENDING** | Email service logs show provisioning | None identified yet | Pending – patient cannot verify |
| 3. Login | Successful authentication with valid credentials | Authentication service healthy; login flow not tested | **PENDING** | Health check OK | None identified | Pending |
| 4. Profile | Profile loads, editable fields work, data persists | UI present; CRUD operations not validated | **PENDING** | UI mockups available | Missing backend validation | Pending |
| 5. Documents | Document upload works, progress bar, persistence after reload | File upload endpoint reachable; upload flow not tested | **PENDING** | Endpoint returns 200 | None | Pending |
| 6. Consultation | Consultation request form validates, submits, shows confirmation | Form present; submission endpoint reachable | **PENDING** | API spec documented | None | Pending |
| 7. Appointments | Appointment list displays patient‑specific data | Feature not yet implemented | **NOT IMPLEMENTED** | N/A | None | N/A |
| 8. Timeline | Journey timeline displays correctly | Prototype available; data binding pending | **PENDING** | Mockup exists | API not wired | Pending |
| 9. Consent | Consent records stored, persists, accessible only to patient | Implementation pending | **NOT IMPLEMENTED** | N/A | None | N/A |
|10. Messaging | Messaging interface loads, can send message | UI present; messaging service not integrated | **NOT IMPLEMENTED** | Mockup | None | N/A |
|11. Password reset | Reset flow works end‑to‑end | Email service configured; flow not exercised | **PENDING** | SendGrid ready | None | Pending |
|12. Logout & session security | Logout invalidates session; protected endpoints reject unauthenticated access | Session endpoint responds; security testing not performed | **PENDING** | Endpoint alive | None | Pending |
|13. Cross‑patient authorization | Patient A cannot access Patient B data | Not tested | **PENDING** | No test run | None | Critical if violated |
|14. Email deliverability | Production email lands in patient inbox, passes SPF/DKIM | Production email active; deliverability not confirmed | **PENDING** | Service healthy | None | Pending |
|15. Observability | Health endpoints and logging available; no secret leakage | Monitoring stack up; audit not yet performed | **PENDING** | Endpoints responding | None | Pending |
|16. Privacy & security | No PHI leakage in UI or logs | No audit completed | **PENDING** | N/A | None | Critical |

## Decision
**🟡 CONDITIONAL GO — PILOT READY WITH EXPLICIT LIMITATIONS**

## Open Blockers
- Complete end‑to‑end patient journey testing with a synthetic user.
- Validate email verification link flow and token handling.
- Test login, password reset, and session expiration.
- Verify cross‑patient authorization (IDOR) protection.
- Perform security review for PHI leakage.
- Conduct email deliverability testing in production.
- Finalize documentation of results.

## Evidence Summary
- Infrastructure (CI, worker, database, migrations) is green.
- SendGrid API key provisioned; email sending functional.
- Core services are up and reporting healthy.
- No critical security findings to date.

## Recommended Next Action
Initiate controlled pilot testing with a synthetic patient, followed by a real‑patient pilot, addressing the open blockers before considering a live pilot. Obtain governance sign‑off once end‑to‑end verification is complete.