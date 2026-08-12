# Phase 2 — DNS Validation Checklist

**EPIC-017** — Production Email Activation & First Patient Certification
**Status:** AWAITING PHASE 1 COMPLETION
**Owner:** Operations
**Date:** 2026-08-06

---

## 2.1 Prerequisites (from Phase 1)

- [ ] Resend account created
- [ ] `agsynergy.ca` domain added to Resend
- [ ] Domain verification initiated in Resend
- [ ] Resend provides: DKIM CNAME, SPF include, MX records

---

## 2.2 Required DNS Records

### SPF Record (TXT at zone apex)

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Name** | `@` (or `agsynergy.ca`) |
| **Value** | `v=spf1 include:_spf.resend.com ~all` |
| **TTL** | `Auto` (or 3600) |
| **Proxy** | DNS Only (gray cloud) |

**Verification:**
```bash
dig TXT agsynergy.ca +short
# Expected: "v=spf1 include:_spf.resend.com ~all"
```

**Checks:**
- [ ] SPF record exists at zone apex
- [ ] Includes `include:_spf.resend.com`
- [ ] Uses `~all` (soft fail) or `-all` (hard fail)
- [ ] **Only ONE SPF record** (multiple = validation failure)
- [ ] Propagated globally (check dnschecker.org)

---

### DKIM Record (CNAME)

| Field | Value |
|-------|-------|
| **Type** | CNAME |
| **Name** | `resend._domainkey` |
| **Target** | `resend.dkim.resend.com.` (provided by Resend) |
| **TTL** | `Auto` (or 3600) |
| **Proxy** | DNS Only (gray cloud) |

**Verification:**
```bash
dig CNAME resend._domainkey.agsynergy.ca +short
# Expected: resend.dkim.resend.com.
```

**Checks:**
- [ ] DKIM CNAME record created in Cloudflare DNS
- [ ] Points to Resend's DKIM endpoint (exact value from Resend)
- [ ] Propagated globally
- [ ] Resend dashboard shows DKIM as "verified"

---

### DMARC Record (TXT)

| Field | Value |
|-------|-------|
| **Type** | TXT |
| **Name** | `_dmarc` |
| **Value** | `v=DMARC1; p=quarantine; rua=mailto:dmarc@agsynergy.ca; ruf=mailto:dmarc@agsynergy.ca; pct=100` |
| **TTL** | `Auto` (or 3600) |
| **Proxy** | DNS Only (gray cloud) |

**Verification:**
```bash
dig TXT _dmarc.agsynergy.ca +short
# Expected: "v=DMARC1; p=quarantine; rua=mailto:dmarc@agsynergy.ca; ruf=mailto:dmarc@agsynergy.ca; pct=100"
```

**Checks:**
- [ ] DMARC record exists at `_dmarc.agsynergy.ca`
- [ ] Version is `v=DMARC1`
- [ ] Policy is `p=quarantine` (start here, can move to `p=reject` later)
- [ ] `rua` aggregate report URI configured
- [ ] `ruf` forensic report URI configured
- [ ] `pct=100` applies policy to 100%
- [ ] Propagated globally

---

### MX Records (for Cloudflare Email Routing)

| Field | Value |
|-------|-------|
| **Type** | MX |
| **Name** | `@` (or `agsynergy.ca`) |
| **Value** | `mx1.resend.com.` |
| **Priority** | `10` |
| **TTL** | `Auto` (or 3600) |
| **Proxy** | DNS Only (gray cloud) |

| Field | Value |
|-------|-------|
| **Type** | MX |
| **Name** | `@` (or `agsynergy.ca`) |
| **Value** | `mx2.resend.com.` |
| **Priority** | `20` |
| **TTL** | `Auto` (or 3600) |
| **Proxy** | DNS Only (gray cloud) |

**Verification:**
```bash
dig MX agsynergy.ca +short
# Expected:
# 10 mx1.resend.com.
# 20 mx2.resend.com.
```

**Checks:**
- [ ] MX records point to Resend mail servers
- [ ] Priorities correct (10, 20)
- [ ] Cloudflare Email Routing enabled in dashboard
- [ ] Routing rules configured to forward to Resend

---

## 2.3 Cloudflare Email Routing Configuration

| Step | Action | Expected |
|------|--------|----------|
| 2.3.1 | Cloudflare Dashboard → Email → Email Routing | Page loads |
| 2.3.2 | Enable Email Routing for `agsynergy.ca` | Status: Active |
| 2.3.3 | Add routing rule: `noreply@agsynergy.ca` → Resend | Rule created |
| 2.3.4 | Add routing rule: `support@agsynergy.ca` → Resend | Rule created |
| 2.3.5 | Add routing rule: `notifications@agsynergy.ca` → Resend | Rule created |
| 2.3.6 | Add catch-all: `*@agsynergy.ca` → Resend (optional) | Rule created |

---

## 2.4 DNS Validation Report Template

| Record | Status | Verified | Notes |
|--------|--------|----------|-------|
| SPF | ⬜ Pending | ⬜ | |
| DKIM | ⬜ Pending | ⬜ | |
| DMARC | ⬜ Pending | ⬜ | |
| MX (10) | ⬜ Pending | ⬜ | |
| MX (20) | ⬜ Pending | ⬜ | |
| Email Routing | ⬜ Pending | ⬜ | |

**Run all verification commands:**
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

## 2.5 Post-Verification

- [ ] All DNS records verified via `dig`
- [ ] Resend dashboard shows domain as "verified"
- [ ] Cloudflare Email Routing shows active routing
- [ ] Test email sent from Resend dashboard → received
- [ ] Email headers show SPF=pass, DKIM=pass, DMARC=pass

---

## 2.6 Common Issues to Avoid

| Issue | Symptom | Fix |
|-------|---------|-----|
| Duplicate SPF | Multiple TXT records with `v=spf1` | Consolidate into ONE record |
| Broken DKIM | CNAME points to wrong target | Use EXACT value from Resend |
| Missing MX | No mail delivery | Add both MX records with correct priority |
| Incorrect TTL | Slow propagation | Use Auto or 3600 |
| Proxied DNS (orange cloud) | Records not visible externally | Set to DNS Only (gray cloud) |
| Wrong DMARC policy | Rejection of legitimate mail | Start with `p=quarantine` |

---

## 2.7 Deliverables

- [ ] All 5 DNS records added to Cloudflare
- [ ] Cloudflare Email Routing enabled and configured
- [ ] DNS Validation Report completed (table above)
- [ ] All records propagated globally (verified via dnschecker.org)
- [ ] Resend dashboard: Domain = Verified, DKIM = Verified

---

## 2.8 Next Phase Dependency

**Phase 3 (Cloudflare Runtime Configuration) cannot proceed until:**
- DNS validation is 100% GREEN
- Resend dashboard shows domain fully verified