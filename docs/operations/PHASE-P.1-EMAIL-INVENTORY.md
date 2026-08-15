# Phase P.1 — Email Recipient Flow Inventory

**Generated:** 2026-08-15  
**Authority:** Hermes Agent — Phase P.1 Audit  
**Purpose:** Complete inventory of every outbound email in the AG Synergy production platform

---

## Current Email Architecture Summary

| Component | Status |
|-----------|--------|
| **Provider** | Resend (primary, `mail.agsynergy.ca`) + SendGrid (root domain `support@agsynergy.ca`) |
| **Domain** | `agsynergy.ca` verified in Resend |
| **Production Sender** | `noreply@agsynergy.ca` (Resend), `support@agsynergy.ca` (SendGrid) |
| **RESEND_API_KEY** | ✅ Configured in production Worker secrets |
| **EMAIL_FROM** | ✅ Configured as `noreply@agsynergy.ca` |
| **APP_URL/FRONTEND_URL** | ✅ Configured as `https://www.agsynergy.ca` |
| **Routing** | `EmailService` with `EmailProviderRouting` — `from` address determines provider |

---

## Complete Outbound Email Inventory

### 1. PATIENT-FACING AUTHENTICATION EMAILS

| # | Trigger | Sender | Recipient | Template | Classification | Multi-Recipient Support | Hard-coded? | Configurable? | PHI Risk |
|---|---------|--------|-----------|----------|----------------|------------------------|-------------|---------------|----------|
| 1 | `POST /identity/register` → `EmailVerificationManager.createVerificationByEmail` | `noreply@agsynergy.ca` (Resend) | **Patient email only** | `verification` | **A. Patient-facing / D. Security** | ❌ Single `to` | ❌ Hard-coded to patient email | N/A | Low (verification link only) |
| 2 | `POST /identity/email/verify` (with identityId) → `createVerification` | `noreply@agsynergy.ca` (Resend) | **Patient email only** | `verification` | **A. Patient-facing / D. Security** | ❌ Single `to` | ❌ Hard-coded to patient email | N/A | Low |
| 3 | `POST /identity/email/verify/request` (self-serve by email) | `noreply@agsynergy.ca` (Resend) | **Patient email only** | `verification` | **A. Patient-facing / D. Security** | ❌ Single `to` | ❌ Hard-coded to patient email | N/A | Low |
| 4 | `POST /identity/password/reset` (request) | `support@agsynergy.ca` (SendGrid) | **Patient email only** | `password-reset` | **A. Patient-facing / D. Security** | ❌ Single `to` | ❌ Hard-coded to patient email | N/A | Medium (reset token) |
| 5 | `POST /identity/magic-link` (request) | Not implemented (email send commented out) | Would be patient email | — | **A. Patient-facing / D. Security** | N/A | N/A | N/A | High (magic link token) |

**Key Finding:** All authentication emails are **strictly single-recipient, patient-only**. The `to` address is always the patient's email derived from the request body. No CC/BCC, no internal recipients.

---

### 2. PATIENT-FACING OPERATIONAL EMAILS

| # | Trigger | Sender | Recipient | Template | Classification | Multi-Recipient Support | Hard-coded? | Configurable? | PHI Risk |
|---|---------|--------|-----------|----------|----------------|------------------------|-------------|---------------|----------|
| 6 | Consultation booked (not yet implemented in Worker) | Would be `noreply@agsynergy.ca` | Patient email | `consultation-confirmation` | **A. Patient-facing** | ❌ Not implemented | N/A | N/A | Medium (appointment details) |
| 7 | Appointment confirmed (not yet implemented in Worker) | Would be `noreply@agsynergy.ca` | Patient email | `appointment-confirmation` | **A. Patient-facing** | ❌ Not implemented | N/A | N/A | Medium |
| 8 | Document upload confirmed (not yet implemented in Worker) | Would be `noreply@agsynergy.ca` | Patient email | `document-upload` | **A. Patient-facing** | ❌ Not implemented | N/A | N/A | Medium (document type) |
| 9 | Generic notification (not yet triggered) | Would be `noreply@agsynergy.ca` | Patient email | `notification` | **A. Patient-facing** | ❌ Not implemented | N/A | N/A | Low-Medium (message content) |

**Key Finding:** Templates exist but **no Worker routes currently trigger these emails**. They are wired in `template-registry.ts` but not called from any route handler.

---

### 3. INTERNAL / SUPPORT EMAILS

| # | Trigger | Sender | Recipient | Template | Classification | Multi-Recipient Support | Hard-coded? | Configurable? | PHI Risk |
|---|---------|--------|-----------|----------|----------------|------------------------|-------------|---------------|----------|
| 10 | `POST /api/v1/contact` (contact form) | **No email sent** — only stored in D1 | Would be support team | — | **B. Internal / C. Support** | N/A | N/A | N/A | Low (contact form data) |
| 11 | Clinic message sent (in-memory messaging) | **No email sent** — only in-app | Would be patient | — | **B. Internal** | N/A | N/A | N/A | Low |

**Key Finding:** The contact form **does not send any email** — it only stores submissions in D1. No internal notification is generated.

---

### 4. SECURITY / ADMINISTRATIVE EMAILS (Not Currently Implemented)

| # | Trigger | Sender | Recipient | Template | Classification | Notes |
|---|---------|--------|-----------|----------|----------------|-------|
| 12 | New patient registration | `noreply@agsynergy.ca` | **Operations team** | Custom | **E. System/Administrative** | Not implemented |
| 13 | Failed login attempts threshold | `noreply@agsynergy.ca` | **Security team** | Custom | **E. System/Administrative / D. Security** | Not implemented |
| 14 | Consent grant/revoke (audit) | `noreply@agsynergy.ca` | **Operations team** | Custom | **E. System/Administrative** | Not implemented |
| 15 | Document upload (internal copy) | `noreply@agsynergy.ca` | **Operations team** | Custom | **E. System/Administrative** | Not implemented |
| 16 | System health alerts | `noreply@agsynergy.ca` | **DevOps team** | Custom | **E. System/Administrative** | Not implemented |

---

## Recipient Classification Matrix

| Email Type | Sender | Current Recipients | Desired Multi-Recipient | PHI Exposure |
|------------|--------|-------------------|------------------------|--------------|
| Verification | `noreply@agsynergy.ca` | Patient only | ❌ Never (patient-only) | Low |
| Password Reset | `support@agsynergy.ca` | Patient only | ❌ Never (patient-only) | Medium (token) |
| Contact Form | N/A (stored only) | — | ✅ **Support team (multiple)** | Low |
| New Registration Alert | — | — | ✅ **Operations (multiple)** | Low |
| Security Alerts | — | — | ✅ **Security team (multiple)** | None |
| Operational Alerts | — | — | ✅ **Operations (multiple)** | Low |
| Consent/Document Audit | — | — | ✅ **Operations (multiple)** | Low-Medium |

---

## Current Implementation Details

### EmailService.sendEmail() Signature
```typescript
interface EmailRequest {
  to: string;           // SINGLE recipient only
  subject: string;
  html: string;
  text: string;
  from?: string;        // Optional — determines provider routing
  templateName?: string;
  referenceId?: string;
}
```

### ResendProvider.sendEmail() — Sends to Array but Called with Single
```typescript
body: JSON.stringify({
  from: this.fromAddress,
  to: [to],   // ← Wraps single string in array
  subject,
  html,
  text,
})
```

### SendGridProvider.sendEmail() — Single Recipient Only
```json
personalizations: [{ to: [{ email: to }], subject }]
```

### EmailService Routing (from address → provider)
- `support@agsynergy.ca` → **SendGridProvider** (root domain)
- Everything else (including `noreply@agsynergy.ca`) → **ResendProvider** (mail.agsynergy.ca subdomain)

---

## Where Changes Are Needed for Multi-Recipient Support

### Minimal Change Locations

1. **`EmailService`** — `EmailRequest.to` needs to accept `string | string[]`
2. **`ResendProvider.sendEmail()`** — Already accepts array in API, just pass through
3. **`SendGridProvider.sendEmail()`** — Needs to iterate and send per-recipient (SendGrid API limitation)
4. **`EmailProvider` interface** — Update `sendEmail` signature
5. **Configuration** — New env vars for recipient lists: `EMAIL_SUPPORT_TO`, `EMAIL_OPERATIONS_TO`, `EMAIL_SECURITY_TO`
6. **Contact form handler** — Add email notification to support recipients
7. **Tests** — Add regression tests for all multi-recipient scenarios

---

## Security Constraints (Non-Negotiable)

| Constraint | Enforcement |
|------------|-------------|
| Patient auth emails → ONLY patient | Code-level: `to` derived from request email, never from config |
| No patient email in CC/BCC of internal emails | Design: Internal notifications use separate templates without patient data |
| No tokens/secrets in logs | Existing: ResendProvider logs only success/failure + messageId |
| No JWT/Authorization headers in emails | Existing: Templates don't include auth data |
| Least-privilege routing | EmailService routing by `from` address preserved |

---

## Configuration Requirements

| Variable | Status | Type | Example Value | Purpose |
|----------|--------|------|---------------|---------|
| `RESEND_API_KEY` | ✅ Existing | Secret | `re_...` | Resend authentication |
| `EMAIL_FROM` | ✅ Existing | Var | `noreply@agsynergy.ca` | Default sender |
| `APP_URL` / `FRONTEND_URL` | ✅ Existing | Var | `https://www.agsynergy.ca` | Frontend base for links |
| `EMAIL_SUPPORT_TO` | 🔴 **NEW** | Var | `support@agsynergy.ca,ops@agsynergy.ca` | Comma-separated support recipients |
| `EMAIL_OPERATIONS_TO` | 🔴 **NEW** | Var | `operations@agsynergy.ca,admin@agsynergy.ca` | Comma-separated ops recipients |
| `EMAIL_SECURITY_TO` | 🔴 **NEW** | Var | `security@agsynergy.ca` | Comma-separated security recipients |
| `SENDGRID_API_KEY` | ⚠️ Optional | Secret | `SG_...` | Only if root-domain sending needed |

**Note:** New recipient variables are **vars (not secrets)** — they contain email addresses, not credentials. They should be injected via CI like `EMAIL_FROM` and `APP_URL`.

---

## Test Coverage Requirements (New)

| Test | Description |
|------|-------------|
| T1 | Single internal recipient (support) |
| T2 | Multiple internal recipients (support, ops) |
| T3 | Duplicate addresses deduplicated |
| T4 | Empty config fails safely (returns error, not silent) |
| T5 | Malformed config (invalid email) fails safely |
| T6 | Patient verification email → ONLY patient (no internal CC) |
| T7 | Password reset email → ONLY patient (no internal CC) |
| T8 | Support notification reaches all configured support recipients |
| T9 | Operational notification reaches all configured ops recipients |
| T10 | No recipient leakage between patients (patient A never sees patient B's email) |
| T11 | No secrets/PHI in logs (verify log output) |
| T12 | Existing email flows remain green (verification, reset) |

---

## Files Requiring Changes

| File | Change Type |
|------|-------------|
| `workers/src/platform/email/email-provider.ts` | Interface update |
| `workers/src/platform/email/email-service.ts` | Core multi-recipient logic |
| `workers/src/platform/email/resend-provider.ts` | Pass-through array |
| `workers/src/platform/email/providers/sendgrid-provider.ts` | Iterate and send per-recipient |
| `workers/src/index.ts` | Inject new env vars, parse comma-separated lists |
| `workers/src/routes/contact.ts` | Add support email notification |
| `workers/tests/platform/email-multi-recipient.test.ts` | **NEW** — Regression tests |
| `.github/workflows/deploy.yml` | Inject new vars (EMAIL_SUPPORT_TO, etc.) |
| `docs/operations/email-operations-runbook.md` | Update with multi-recipient config |

---

## Phase P Report Reconciliation

The Phase P report (`PHASE-P-OPERATOR-ACTIONS.md`) lists 11 external infrastructure actions as **BLOCKED**. These are now **COMPLETE** based on the task prompt confirmation:

| P-EXT ID | Action | Phase P Status | **Actual Status** |
|----------|--------|----------------|-------------------|
| P-EXT-001 | Create Resend account | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-002 | Verify domain in Resend | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-003 | Add verified sender | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-004 | Generate API key | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-005 | Fix SPF | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-006 | Add Resend MX | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-007 | Enable Email Routing | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-008 | Set RESEND_API_KEY | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-009 | Set EMAIL_FROM | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-010 | Set APP_URL | 🔴 BLOCKED | ✅ **COMPLETE** |
| P-EXT-011 | Provision NOTIFICATIONS D1 | 🔴 BLOCKED | ⚠️ **UNVERIFIED** (not used by email flows) |

**Action:** Phase P.1 report must include a reconciliation section updating these to COMPLETE.