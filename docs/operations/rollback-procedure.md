# Rollback Procedure — AG Synergy Email Infrastructure

**Purpose:** Steps to revert email infrastructure changes safely.

**Last Updated:** 2026-08-05

---

## Trigger Conditions

- Email delivery failures affecting >5% of sends
- Resend provider outage
- Misconfigured `EMAIL_FROM` causing bounces
- `APP_URL` misconfiguration breaking verification links
- Security incident involving email credentials

## Rollback Steps

### 1. Identify the offending commit

```bash
git log --oneline -10
# Identify the commit that introduced the email changes
```

### 2. Revert the commit

```bash
git revert <offending-commit-hash>
git push origin main
```

### 3. Verify rollback

```bash
# Check the previous deployment is serving
curl https://api.agsynergy.ca/health
# Should return 200

# Verify email sending is disabled (no secrets = no service)
# The Worker will skip email sending when RESEND_API_KEY is absent
```

### 4. Resend API Key revocation (if compromised)

1. Go to https://resend.com/api-keys
2. Revoke the compromised key
3. Generate a new key
4. Update via `wrangler secret put RESEND_API_KEY`
5. Redeploy

### 5. DNS rollback (if SPF/DKIM/DMARC misconfigured)

1. Remove incorrect DNS records
2. Re-add correct records per the DNS Verification Checklist
3. Wait 5-10 minutes for DNS propagation
4. Verify with `dig` or online DNS checker

### 6. Post-rollback verification

- [ ] Health endpoint returns 200
- [ ] No email sends attempted (check Resend dashboard)
- [ ] Identity routes still functional (register, login)
- [ ] No regression in other Worker functionality

## Rollback Authorization

Rollback requires approval from:
- Operations lead
- Security lead (if credentials compromised)

## Rollback Time Estimate

- Code revert: ~2 minutes
- DNS rollback: ~10 minutes (propagation)
- Full rollback: ~15 minutes