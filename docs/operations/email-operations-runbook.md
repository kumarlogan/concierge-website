# Email Operations Runbook — AG Synergy

**Purpose:** Operational procedures for transactional email delivery via Resend + Cloudflare Email Routing.

**Last Updated:** 2026-08-05
**Owner:** Operations
**Status:** DRAFT — awaiting Resend account provisioning

---

## 1. Architecture Overview

```
Patient → AG Synergy Frontend → Cloudflare Worker → IdentityRouter
  → EmailService → EmailProvider → ResendProvider → Resend API
  → Cloudflare Email Routing → Patient Inbox
```

**Dependency Chain:** Routes → Business Services → EmailService → EmailProvider → ResendProvider

**Key Interfaces:**
- `EmailProvider` (`workers/src/platform/email/email-provider.ts`) — abstract interface
- `ResendProvider` (`workers/src/platform/email/resend-provider.ts`) — concrete Resend implementation
- `EmailService` (`workers/src/platform/email/email-service.ts`) — business layer with delivery tracking
- `EmailRouter` (`workers/src/platform/email/email-router.ts`) — route-level email dispatch

---

## 2. Email Templates

| Template | Location | Use Case |
|----------|----------|----------|
| verification | `workers/src/platform/email/templates/verification.ts` | Account email verification |
| password-reset | `workers/src/platform/email/templates/password-reset.ts` | Password reset link |
| consultation-confirmation | `workers/src/platform/email/templates/consultation-confirmation.ts` | Appointment confirmation |
| appointment-confirmation | `workers/src/platform/email/templates/appointment-confirmation.ts` | Appointment reminder |
| document-upload | `workers/src/platform/email/templates/document-upload.ts` | Document upload notification |
| notification | `workers/src/platform/email/templates/notification.ts` | Generic notification |

Templates are rendered by `EmailService.renderTemplate()` using the `TemplateRegistry`.

---

## 3. Configuration

### Environment Variables

| Variable | Required | Description | Set Via |
|----------|----------|-------------|---------|
| `RESEND_API_KEY` | Yes | Resend API key for sending | `wrangler secret put RESEND_API_KEY` |
| `EMAIL_FROM` | Yes | Sender email address (e.g. `noreply@agsynergy.ca`) | `wrangler secret put EMAIL_FROM` |
| `APP_URL` | Yes | Base URL for email links (e.g. `https://www.agsynergy.ca`) | `wrangler secret put APP_URL` |

### wrangler.jsonc

All three environments (development, preview, production) declare `RESEND_API_KEY`, `EMAIL_FROM`, and `APP_URL` as empty-string placeholders in `vars`. Real values are injected via Worker Secrets at deploy time.

---

## 4. Service Creation Logic

`EmailService` is **only** instantiated in `workers/src/index.ts` (composition root) when both `RESEND_API_KEY` and `EMAIL_FROM` are present:

```typescript
const emailService = env.RESEND_API_KEY && env.EMAIL_FROM
  ? new EmailService(new ResendProvider(env.RESEND_API_KEY, env.EMAIL_FROM))
  : undefined;
```

When `emailService` is `undefined`, identity routes gracefully skip email sending and return success responses without delivering email.

---

## 5. Operational Procedures

### 5.1 Sending Test Email

```bash
# Via the running worker:
curl -X POST https://api.agsynergy.ca/identity/email/verify \
  -H "Content-Type: application/json" \
  -d '{"identityId":"test","email":"test@example.com"}'
```

### 5.2 Checking Email Delivery Status

Monitor the Resend dashboard at https://resend.com/dashboard for:
- Sent count (last 24h)
- Bounce rate
- Delivery latency
- Complaint rate

### 5.3 Restarting Email Service

No restart needed — the Worker is stateless. Redeploy with `wrangler deploy` to pick up new secrets.

### 5.4 Rotating Resend API Key

1. Generate new key in Resend dashboard
2. `wrangler secret put RESEND_API_KEY` — paste new key
3. Redeploy: `wrangler deploy`
4. Verify delivery in Resend dashboard

---

## 6. Troubleshooting

| Symptom | Cause | Resolution |
|---------|-------|------------|
| No email sent, 200 OK | `RESEND_API_KEY` or `EMAIL_FROM` not set | Check secrets: `wrangler secret list` |
| Email in spam folder | SPF/DKIM/DMARC not configured | Run DNS verification checklist (see §8) |
| 401 from Resend | Invalid/revoked API key | Regenerate key in Resend dashboard |
| Template not found | Unknown `TemplateName` | Check `TemplateName` union in `template-registry.ts` |
| Verification link broken | `APP_URL` misconfigured | Verify `APP_URL` matches production domain |
| Rate limit exceeded | Resend free tier limit | Upgrade Resend plan or implement backoff |

---

## 7. Monitoring

See Phase 6 (Observability) for the full monitoring plan including health endpoint, send success/failure metrics, and operational logging.