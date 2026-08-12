# Worker Secret Checklist — AG Synergy Email Infrastructure

**Purpose:** Ensure all required secrets are configured for email delivery.

**Last Updated:** 2026-08-05

---

## Required Secrets

| Secret | Description | Format | Required For |
|--------|-------------|--------|-------------|
| `RESEND_API_KEY` | Resend API key for sending emails | `re_xxxxxxxxxxxxxxxxxxxxxxxx` | Email delivery |
| `EMAIL_FROM` | Sender email address | `noreply@agsynergy.ca` | Email delivery |
| `APP_URL` | Base URL for email links | `https://www.agsynergy.ca` | Verification/reset links |

---

## Secret Configuration

### Setting Secrets

```bash
# Set Resend API Key
wrangler secret put RESEND_API_KEY
# Paste: re_xxxxxxxxxxxxxxxxxxxxxxxx

# Set Email From Address
wrangler secret put EMAIL_FROM
# Paste: noreply@agsynergy.ca

# Set Application URL
wrangler secret put APP_URL
# Paste: https://www.agsynergy.ca
```

### Verifying Secrets

```bash
# List all secrets (does not reveal values)
wrangler secret list

# Expected output includes:
# RESEND_API_KEY
# EMAIL_FROM
# APP_URL
# JWT_PRIVATE_KEY
# JWT_PUBLIC_KEY
# JWT_KID
# PLATFORM_JWT_PUBLIC_KEY
# PLATFORM_JWT_KID
# TURNSTILE_SECRET_KEY
```

### Checking Secret Values (Safely)

Secrets are never visible via CLI. To verify a secret is set correctly:
1. Deploy the Worker
2. Test the functionality that uses the secret
3. Check the Resend dashboard for successful sends

---

## Environment-Specific Configuration

### Development

```bash
# For local development, use wrangler dev with secrets
wrangler dev --local
# Secrets are loaded from .dev.vars or the CLI prompt
```

### Preview

```bash
# Preview deployments use the same secrets as production
# unless overridden in wrangler.jsonc preview.env
wrangler deploy --env preview
```

### Production

```bash
# Production deployments use production secrets
wrangler deploy --env production
```

---

## Secret Rotation

### When to Rotate

- Security incident involving leaked credentials
- Resend API key compromised
- Email from address changed
- APP_URL changed (domain migration)

### Rotation Procedure

1. Generate new secret value in the provider dashboard
2. Set new secret via `wrangler secret put <NAME>`
3. Redeploy with `wrangler deploy`
4. Verify functionality with new secret
5. Old secret is automatically invalidated by the provider

---

## Secret Security

### Do NOT

- ❌ Hardcode secrets in source files
- ❌ Commit secrets to git
- ❌ Share secrets in chat channels
- ❌ Log secret values in application logs
- ❌ Include secrets in error messages

### Do

- ✅ Use `wrangler secret put` for all secrets
- ✅ Reference secrets via `env.SECRET_NAME` in code
- ✅ Rotate secrets on a regular schedule
- ✅ Monitor for unauthorized usage via provider dashboard
- ✅ Use separate keys for development, preview, and production

---

## Verification Checklist

- [ ] `RESEND_API_KEY` is set in all environments
- [ ] `EMAIL_FROM` is set in all environments
- [ ] `APP_URL` is set in all environments
- [ ] `RESEND_API_KEY` format is `re_...`
- [ ] `EMAIL_FROM` is a valid email address
- [ ] `APP_URL` uses HTTPS
- [ ] No secrets hardcoded in source files
- [ ] Secrets are not in git history (check with `git log -p`)
- [ ] `wrangler secret list` shows all required secrets