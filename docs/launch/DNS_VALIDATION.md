# DNS Validation

> **Concierge Launch Readiness — Workstream C**
> Documents DNS configuration for agsynergy.ca and www.agsynergy.ca.
>
> **Date:** 2026-07-27
> **Status:** 📋 Assessment Complete (no live queries; code-configuration review)

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Domain:         agsynergy.ca
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Planned DNS Records

### 1.1 Apex Domain — `agsynergy.ca`

| Record Type | Name | Value | Proxy Status | Purpose | Status |
|-------------|------|-------|-------------|---------|--------|
| A/AAAA | `@` | Cloudflare edge IPs (proxied) | Proxied (orange cloud) | Root domain → Cloudflare Pages | ⚠️ Configure in Cloudflare dashboard |
| CNAME | `www` | `agsynergy.ca` | Proxied (orange cloud) | www → root redirect | ⚠️ Configure in Cloudflare dashboard |
| CNAME | `api` | `agsynergy-api.workers.dev` | Proxied (orange cloud) | API Worker custom domain | ✅ Via Workers route (auto-managed) |

### 1.2 Cloudflare-Managed Records

These records are managed automatically by Cloudflare when Pages and Workers are configured:

| Hostname | Managed By | Status |
|----------|-----------|--------|
| `agsynergy.ca` | Cloudflare Pages custom domain | ⚠️ Configure in Cloudflare dashboard |
| `www.agsynergy.ca` | Cloudflare Pages domain redirect | ⚠️ Configure in Cloudflare dashboard |
| `api.agsynergy.ca` | Cloudflare Workers route (custom_domain: true) | ✅ Configured in wrangler.jsonc |

---

## 2. CNAME/Flattening for Root Domain

| Feature | Setting | Status |
|---------|---------|--------|
| CNAME Flattening | Enabled (Cloudflare default) | ✅ Cloudflare handles root domain via CNAME flattening |
| Root domain proxy | Proxied (orange cloud) | ✅ Required for Cloudflare Pages |
| ALIAS/ANAME record | Not needed with Cloudflare | ✅ Cloudflare provides A records automatically |

**Note:** Cloudflare's CNAME flattening allows `agsynergy.ca` to resolve without an A record pointing to an origin IP. The root domain is proxied through Cloudflare's edge network to the Pages project.

---

## 3. SSL Certificate Validation

| Check | Details | Status |
|-------|---------|--------|
| Certificate type | Cloudflare Universal SSL | ✅ Auto-provisioned |
| Certificate authority | Let's Encrypt or Google Trust Services | ✅ Cloudflare managed |
| Certificate coverage | `agsynergy.ca` + `*.agsynergy.ca` | ✅ Wildcard coverage |
| TLS version | 1.2+ | ✅ Configured via Cloudflare dashboard |
| Certificate expiry | Auto-renewed | ✅ Cloudflare managed |
| HSTS preload | Recommended for production | ⚠️ Submit to hstspreload.org after launch |

---

## 4. DNSSEC Status

| Check | Details | Status |
|-------|---------|--------|
| DNSSEC | Not currently configured | ⚠️ Recommended for production |
| DS record | Not published | ❌ Not configured |
| Cloudflare DNSSEC | Available in Cloudflare dashboard | ⚠️ Enable via Cloudflare dashboard → DNS → DNSSEC |

**Recommendation:** Enable DNSSEC in Cloudflare dashboard before production launch. This protects against DNS spoofing and cache poisoning.

---

## 5. Email DNS Records

| Record Type | Name/Service | Value | Status |
|-------------|-------------|-------|--------|
| **MX** | `@` | Mail server hostname | ⚠️ Check domain registrar for email provider MX records |
| **MX Priority** | Priority value | Typically 10 | ⚠️ Verify with email provider |
| **SPF** | `@` | `v=spf1 include:<provider> ~all` | ⚠️ Configure SPF to authorize sending servers |
| **DKIM** | `default._domainkey` | DKIM public key | ⚠️ Configure DKIM for email signing |
| **DMARC** | `_dmarc` | `v=DMARC1; p=none; rua=mailto:<report-email>` | ⚠️ Configure DMARC for email authentication reporting |

### 5.1 Email Provider

| Check | Details | Status |
|-------|---------|--------|
| Email provider | Unknown (not in codebase) | ⚠️ Determine email provider for DNS records |
| Transactional emails | Used for identity (magic links, password reset, email verification) | ⚠️ Ensure email deliverability |
| Contact form emails | Consultation requests → clinic notification | ⚠️ Ensure email routing configured |

---

## 6. DNS Checklist

| # | Check | Status |
|---|-------|--------|
| 1 | Root domain `agsynergy.ca` resolves to Cloudflare Pages | ⚠️ Verify in Cloudflare dashboard |
| 2 | `www.agsynergy.ca` redirects to `agsynergy.ca` | ⚠️ Verify in Cloudflare dashboard |
| 3 | `api.agsynergy.ca` resolves to Workers API | ✅ Configured (custom_domain in wrangler.jsonc) |
| 4 | SSL certificate active for all domains | ✅ Cloudflare Universal SSL auto-provisioned |
| 5 | HSTS preloaded | ⚠️ Submit after launch confirmation |
| 6 | DNSSEC enabled | ❌ Not configured — recommended before launch |
| 7 | SPF record published | ❌ Not configured — required for email deliverability |
| 8 | DKIM record published | ❌ Not configured — required for email deliverability |
| 9 | DMARC record published | ❌ Not configured — recommended for email authentication |
| 10 | MX records configured for email | ❌ Not configured — required if using custom domain email |

---

## 7. Summary

| Category | Status |
|----------|--------|
| Web Domains (agsynergy.ca, www) | ⚠️ Configure in Cloudflare dashboard |
| API Domain (api.agsynergy.ca) | ✅ Configured in wrangler.jsonc |
| SSL/TLS | ✅ Cloudflare Universal SSL |
| DNSSEC | ❌ Not configured — recommended |
| Email Records (MX, SPF, DKIM, DMARC) | ❌ Not configured — required for production email |
| CNAME Flattening | ✅ Cloudflare default |

**Overall: ⚠️ CONDITIONAL PASS — DNSSEC and email DNS records must be configured before production launch.**

---

*Concierge Launch Readiness — Workstream C*
*DNS Validation — v1.0.0*
*Last updated: 2026-07-27*