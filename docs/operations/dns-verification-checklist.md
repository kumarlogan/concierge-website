# DNS Verification Checklist — AG Synergy Email Infrastructure

**Purpose:** Verify DNS records for email deliverability (SPF, DKIM, DMARC).

**Last Updated:** 2026-08-05

---

## Prerequisites

- Resend account created and verified
- Domain `agsynergy.ca` added to Resend
- Cloudflare DNS management for `agsynergy.ca`

---

## SPF Record

### What to add

```dns
agsynergy.ca.  IN  TXT  "v=spf1 include:_spf.resend.com ~all"
```

### Verification

```bash
dig TXT agsynergy.ca +short
# Expected output: "v=spf1 include:_spf.resend.com ~all"
```

### Checks

- [ ] SPF record exists at zone apex (`agsynergy.ca`)
- [ ] SPF record includes `include:_spf.resend.com`
- [ ] SPF record uses `~all` (soft fail) or `-all` (hard fail)
- [ ] Only one SPF record exists (multiple SPF records break validation)
- [ ] SPF record is propagated globally (check from multiple locations)

---

## DKIM Record

### What to add

Resend provides a DKIM CNAME record after domain verification. The record will be in the format:

```dns
resend._domainkey.agsynergy.ca.  IN  CNAME  resend.dkim.resend.com.
```

### Verification

```bash
dig CNAME resend._domainkey.agsynergy.ca +short
# Expected output: resend.dkim.resend.com.
```

### Checks

- [ ] DKIM CNAME record created in Cloudflare DNS
- [ ] DKIM record points to Resend's DKIM endpoint
- [ ] DKIM record is propagated globally
- [ ] Resend dashboard shows DKIM as "verified"

---

## DMARC Record

### What to add

```dns
_dmarc.agsynergy.ca.  IN  TXT  "v=DMARC1; p=quarantine; rua=mailto:dmarc@agsynergy.ca; ruf=mailto:dmarc@agsynergy.ca; pct=100"
```

### Verification

```bash
dig TXT _dmarc.agsynergy.ca +short
# Expected output: "v=DMARC1; p=quarantine; rua=mailto:dmarc@agsynergy.ca; ruf=mailto:dmarc@agsynergy.ca; pct=100"
```

### Checks

- [ ] DMARC record exists at `_dmarc.agsynergy.ca`
- [ ] DMARC version is `v=DMARC1`
- [ ] Policy is `p=quarantine` (start with quarantine, can move to `p=reject`)
- [ ] `rua` aggregate report URI is configured
- [ ] `ruf` forensic report URI is configured
- [ ] `pct=100` applies policy to 100% of failing emails
- [ ] DMARC record is propagated globally

---

## Cloudflare Email Routing Records

### What to add

Cloudflare Email Routing requires MX and TXT records:

```dns
agsynergy.ca.  IN  MX  10  mx1.resend.com.
agsynergy.ca.  IN  MX  20  mx2.resend.com.
agsynergy.ca.  IN  TXT  "v=spf1 include:_spf.resend.com ~all"
```

### Verification

```bash
dig MX agsynergy.ca +short
# Expected: 10 mx1.resend.com. / 20 mx2.resend.com.
```

### Checks

- [ ] MX records point to Resend mail servers
- [ ] MX priority is correct (10, 20)
- [ ] Cloudflare Email Routing is enabled in the Cloudflare dashboard
- [ ] Routing rules configured to forward to Resend

---

## Verification Commands (Run All)

```bash
echo "=== SPF ==="
dig TXT agsynergy.ca +short | grep spf

echo "=== DKIM ==="
dig CNAME resend._domainkey.agsynergy.ca +short

echo "=== DMARC ==="
dig TXT _dmarc.agsynergy.ca +short | grep DMARC1

echo "=== MX ==="
dig MX agsynergy.ca +short

echo "=== A Record ==="
dig A agsynergy.ca +short
```

---

## DNS Propagation

DNS changes may take 5-30 minutes to propagate globally. Use these tools to verify:

- https://dnschecker.org/
- https://www.whatsmydns.net/
- `dig` command from multiple locations

---

## Post-Verification

- [ ] All DNS records verified via `dig`
- [ ] Resend dashboard shows domain as "verified"
- [ ] Cloudflare Email Routing shows active routing
- [ ] Test email sent and received
- [ ] Email headers show SPF/DKIM/DMARC pass