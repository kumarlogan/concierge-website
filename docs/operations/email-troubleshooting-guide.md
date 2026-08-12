# Email Troubleshooting Guide — AG Synergy

**Purpose:** Diagnose and resolve email delivery issues.

**Last Updated:** 2026-08-05

---

## Quick Diagnostic Flow

```
Email not received?
  ├─ Is emailService configured? (RESEND_API_KEY + EMAIL_FROM set?)
  │   ├─ NO → Check secrets → Set via wrangler secret put
  │   └─ YES → Continue
  ├─ Did the request return 200?
  │   ├─ NO → Check error response
  │   └─ YES → Continue
  ├─ Is the email in spam/junk?
  │   ├─ YES → Check SPF/DKIM/DMARC
  │   └─ NO → Check Resend dashboard
  └─ Check Resend dashboard for send status
```

---

## Common Issues

### 1. No Email Sent (200 OK, but no email received)

**Symptom:** API returns success but no email arrives.

**Cause:** `emailService` is `undefined` because `RESEND_API_KEY` or `EMAIL_FROM` is not set.

**Diagnosis:**
```bash
# Check if secrets are set
wrangler secret list

# Check if the Worker has the secrets
# The Worker will skip email sending if either is missing
```

**Resolution:**
```bash
wrangler secret put RESEND_API_KEY
wrangler secret put EMAIL_FROM
wrangler deploy
```

---

### 2. Email in Spam Folder

**Symptom:** Email delivered but lands in spam/junk folder.

**Cause:** Missing or misconfigured SPF, DKIM, or DMARC records.

**Diagnosis:**
```bash
# Check SPF
dig TXT agsynergy.ca +short | grep spf

# Check DKIM
dig CNAME resend._domainkey.agsynergy.ca +short

# Check DMARC
dig TXT _dmarc.agsynergy.ca +short
```

**Resolution:** Follow the DNS Verification Checklist to add missing records.

---

### 3. 401 Unauthorized from Resend

**Symptom:** API returns 401 error from Resend.

**Cause:** Invalid or revoked Resend API key.

**Resolution:**
1. Go to https://resend.com/api-keys
2. Verify the key is active
3. If revoked, generate a new key
4. `wrangler secret put RESEND_API_KEY`
5. `wrangler deploy`

---

### 4. Verification/Reset Link Broken

**Symptom:** Email received but link returns 404 or wrong page.

**Cause:** `APP_URL` misconfigured or doesn't match the production domain.

**Diagnosis:**
```bash
# Check what APP_URL is set to
# The link in the email will be: ${APP_URL}/identity/email/verify?token=...
```

**Resolution:**
```bash
wrangler secret put APP_URL
# Enter: https://www.agsynergy.ca
wrangler deploy
```

---

### 5. Resend Rate Limit Exceeded

**Symptom:** Resend returns 429 Too Many Requests.

**Cause:** Exceeded Resend free tier rate limit (3,000 emails/month).

**Resolution:**
1. Upgrade Resend plan for higher limits
2. Implement exponential backoff in the provider
3. Batch email sends where possible

---

### 6. Bounce Rate High

**Symptom:** Many emails bouncing back.

**Cause:** Invalid recipient addresses, poor sender reputation, or missing DNS records.

**Diagnosis:**
1. Check Resend dashboard for bounce details
2. Verify SPF/DKIM/DMARC are correctly configured
3. Check `EMAIL_FROM` address is valid and verified in Resend

---

### 7. Template Rendering Error

**Symptom:** Email sent but content is missing or malformed.

**Cause:** Template context missing required fields.

**Diagnosis:**
1. Check `TemplateContext` fields in `template-registry.ts`
2. Verify all required fields are passed in `EmailRequest`

---

### 8. Cloudflare Email Routing Not Forwarding

**Symptom:** Emails sent via Resend but not reaching inbox.

**Cause:** Cloudflare Email Routing not configured or rules incorrect.

**Resolution:**
1. Enable Email Routing in Cloudflare dashboard
2. Add MX records pointing to Resend
3. Configure routing rules to forward to destination inbox
4. Verify DNS records are correct

---

## Monitoring Commands

```bash
# Check Worker health
curl https://api.agsynergy.ca/health

# Check email service health
curl https://api.agsynergy.ca/identity/health

# Test verification email send
curl -X POST https://api.agsynergy.ca/identity/email/verify \
  -H "Content-Type: application/json" \
  -d '{"identityId":"test","email":"test@example.com"}'

# Check DNS records
dig TXT agsynergy.ca +short
dig CNAME resend._domainkey.agsynergy.ca +short
dig TXT _dmarc.agsynergy.ca +short
dig MX agsynergy.ca +short
```

---

## Escalation

If issues persist after troubleshooting:

1. **Resend Support:** https://resend.com/support
2. **Cloudflare Support:** Check Cloudflare status dashboard
3. **Internal:** Contact Operations lead with:
   - Error messages from Resend dashboard
   - Email headers from received email (if any)
   - DNS verification output
   - Worker logs from Cloudflare dashboard