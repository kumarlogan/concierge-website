# Observability Plan — AG Synergy Email Infrastructure

**Purpose:** Operational monitoring for email delivery, provider health, and verification success.

**Last Updated:** 2026-08-05

---

## Monitoring Architecture

```
Resend API ←── Health Check ──→ Provider Health Endpoint
     ↓                              ↓
  Delivery Events            Health Dashboard
     ↓                              ↓
  Delivery Log             Email Metrics
     ↓                              ↓
  Operational Logs         Alerting Rules
```

---

## 1. Provider Health

### Health Endpoint

```
GET /identity/health
```

**Response:**

```json
{
  "success": true,
  "emailService": "configured",
  "provider": "resend",
  "providerHealth": {
    "status": "healthy",
    "providerName": "resend",
    "lastChecked": "2026-08-05T21:00:00Z",
    "latencyMs": 120
  }
}
```

**Status Values:**

| Status | Meaning | Action |
|--------|---------|--------|
| `healthy` | Provider responding normally | No action |
| `degraded` | Provider responding but with errors | Monitor closely |
| `unavailable` | Provider not responding | Investigate immediately |

### Implementation

The `ResendProvider.getProviderHealth()` method calls `https://api.resend.com/v1/emails` with the API key. The `EmailService.getProviderHealth()` delegates to the provider.

---

## 2. Email Send Success

### Metric: Email Send Success Rate

**Definition:** Percentage of email send requests that succeed (HTTP 200 from Resend).

**Calculation:**
```
success_rate = (successful_sends / total_sends) * 100
```

**Target:** ≥ 99%

**Collection:** The `EmailService` delivery log records every send attempt with `status: "sent"` or `status: "failed"`.

### Dashboard Query (Resend)

```
Resend Dashboard → Analytics → Sent emails (last 24h)
```

---

## 3. Email Failure Count

### Metric: Email Failure Count

**Definition:** Number of email send requests that failed.

**Collection:**
- `EmailDeliveryRecord.status = "failed"` in the delivery log
- Resend dashboard → Bounces + Rejects

**Alert Threshold:** > 5 failures in 15 minutes → PagerDuty/Slack alert

---

## 4. Retry Count

### Metric: Email Retry Count

**Definition:** Number of times email sends are retried after transient failures.

**Collection:**
- Track retry attempts in the `EmailService` delivery log
- Resend API may return retryable errors (429, 5xx)

**Target:** < 3 retries per email under normal conditions

---

## 5. Average Send Latency

### Metric: Average Send Latency

**Definition:** Average time (ms) for Resend API to respond to a send request.

**Collection:**
- `EmailDeliveryRecord.providerLatencyMs` (set by `ResendProvider.sendEmail()`)
- `ProviderHealth.latencyMs` (set by `ResendProvider.getProviderHealth()`)

**Target:** < 500ms average

**Alert Threshold:** > 2000ms average over 5 minutes → Warning

---

## 6. Verification Success Rate

### Metric: Verification Success Rate

**Definition:** Percentage of verification emails that result in successful verification.

**Calculation:**
```
verification_success_rate = (verified_emails / sent_verification_emails) * 100
```

**Target:** ≥ 95%

**Collection:** Track verification token creation vs. completion events.

---

## 7. Verification Failure Rate

### Metric: Verification Failure Rate

**Definition:** Percentage of verification emails that do NOT result in successful verification (expired, invalid, or unused tokens).

**Calculation:**
```
verification_failure_rate = (failed_verifications / total_verification_emails) * 100
```

**Target:** < 5% (most failures are user-initiated — user didn't click the link)

**Alert Threshold:** > 50% failure rate → Possible email delivery issue

---

## 8. Health Endpoint

### Implementation

```
GET /identity/health
```

**Response Schema:**

```typescript
interface HealthResponse {
  success: boolean;
  emailService: "configured" | "unconfigured";
  provider?: {
    name: string;
    status: "healthy" | "degraded" | "unavailable";
    lastChecked: string;
    latencyMs: number;
  };
  uptime: string;
  timestamp: string;
}
```

### Health Check Logic

1. Check if `emailService` is configured (has `RESEND_API_KEY` and `EMAIL_FROM`)
2. If configured: call `provider.getProviderHealth()`
3. If not configured: report `emailService: "unconfigured"`
4. Return health status with timestamp

---

## 9. Operational Logging

### Log Format

All email operations are logged with structured JSON:

```json
{
  "timestamp": "2026-08-05T21:00:00Z",
  "level": "info",
  "service": "email",
  "operation": "send_email",
  "referenceId": "user-123",
  "templateName": "verification",
  "to": "user@example.com",
  "status": "sent",
  "providerMessageId": "msg_abc123",
  "latencyMs": 150,
  "error": null
}
```

### Log Levels

| Level | When |
|-------|------|
| `info` | Successful send, health check OK |
| `warn` | Retry attempt, degraded provider |
| `error` | Send failure, provider unavailable |

### Security: No Secrets in Logs

**Mandatory rule:** No secrets may appear in logs. Specifically:

- ❌ `RESEND_API_KEY` — never log
- ❌ `EMAIL_FROM` — never log (log the template name instead)
- ❌ `APP_URL` — never log (log the route path instead)
- ❌ Full email body — never log
- ❌ Verification/reset tokens — never log

**Allowed in logs:**

- ✅ Template name (`verification`, `password-reset`)
- ✅ Recipient email (hashed or partial: `u***@example.com`)
- ✅ Reference ID (user ID, not email)
- ✅ Provider message ID (opaque, no secrets)
- ✅ Latency in ms
- ✅ Status (`sent`, `failed`)
- ✅ Error message (generic, no provider details)

### Sanitization Function

```typescript
function sanitizeLogEntry(entry: EmailDeliveryRecord): SanitizedLogEntry {
  return {
    ...entry,
    to: maskEmail(entry.to),
    error: entry.error ? "EMAIL_SEND_FAILED" : undefined,
  };
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!local || !domain) return "***@***";
  return `${local[0]}***@${domain}`;
}
```

---

## 10. Alerting Rules

| Metric | Condition | Severity | Action |
|--------|-----------|----------|--------|
| Provider health | `status = "unavailable"` for > 2 minutes | Critical | Page on-call |
| Send failure rate | > 10% over 5 minutes | High | Slack alert |
| Average latency | > 2000ms over 5 minutes | Medium | Slack alert |
| Verification failure rate | > 50% over 15 minutes | High | Slack alert |
| Bounce rate | > 5% over 1 hour | Medium | Slack alert |

---

## 11. Monitoring Dashboard

### Resend Dashboard

- https://resend.com/dashboard
- Key panels: Sent, Bounced, Delivered, Opened, Clicked

### Cloudflare Dashboard

- https://dash.cloudflare.com/
- Key panels: Worker invocations, Errors, Latency

### Custom Dashboard (recommended)

- Email send success/failure over time
- Provider health status
- Verification success/failure rates
- Average send latency
- Bounce rate

---

## 12. Log Retention

| Log Type | Retention |
|----------|-----------|
| Email delivery logs | 90 days |
| Health check logs | 30 days |
| Error logs | 90 days |
| Audit logs | 1 year |

---

## 13. Observability Verification Checklist

- [ ] Health endpoint returns 200 with correct status
- [ ] Provider health check works (healthy/degraded/unavailable)
- [ ] Email send success tracked in delivery log
- [ ] Email failure count tracked in delivery log
- [ ] Retry count tracked
- [ ] Average send latency tracked
- [ ] Verification success rate tracked
- [ ] Verification failure rate tracked
- [ ] No secrets appear in any log output
- [ ] Alerting rules configured and tested
- [ ] Dashboard accessible to Operations team