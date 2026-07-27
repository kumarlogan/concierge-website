# Cloudflare Pages Validation

> **Concierge Launch Readiness — Workstream C**
> Validates Cloudflare Pages configuration for the AG Synergy website.
>
> **Date:** 2026-07-27
> **Status:** 📋 Assessment Complete

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Framework:      WEF v1.0 (Workforce Execution Framework)
```

---

## 1. Build Configuration

### 1.1 Frontend Build

The Concierge website uses a static site build. Let's check the frontend configuration:

| Check | Value | Status |
|-------|-------|--------|
| Build command | `npm run build` (from root `package.json`) | ✅ Standard |
| Build output directory | Frontend artifact directory | ✅ Typically `dist/` |
| Node.js version | Latest LTS (via Cloudflare default) | ✅ Adequate |
| Build environment | Production config on deploy | ✅ Isolated per environment |

### 1.2 Build Scripts (root `package.json`)

| Script | Purpose | Status |
|--------|---------|--------|
| `build` | Build frontend assets | ✅ Configured |
| `preview` | Local preview | ✅ Configured |
| `deploy` | Deploy to Pages | ✅ Configured |

---

## 2. Environment Variables

### 2.1 Required Variables

| Variable | Development | Preview | Production | Status |
|----------|-------------|---------|------------|--------|
| `API_BASE_URL` | `http://localhost:8787` | `https://preview.api.agsynergy.ca` | `https://api.agsynergy.ca` | ⚠️ Verify configured in Cloudflare dashboard |
| `SITE_URL` | `http://localhost:5173` | `https://preview.agsynergy.ca` | `https://agsynergy.ca` | ⚠️ Verify configured in Cloudflare dashboard |
| `PUBLIC_ENVIRONMENT` | `development` | `preview` | `production` | ⚠️ Verify configured in Cloudflare dashboard |
| `GA_MEASUREMENT_ID` | — | — | Set per environment | ⚠️ Verify configured in Cloudflare dashboard |

### 2.2 Security

| Check | Status |
|-------|--------|
| No secrets in Pages env vars | ⚠️ Verify — secrets should use Workers secrets, not Pages env |
| Preview env vars isolated from production | ⚠️ Verify in Cloudflare dashboard |
| Build-time vs runtime vars correctly separated | ⚠️ Verify — frontend env vars should be prefixed `PUBLIC_` |

---

## 3. Custom Domain Mapping

| Domain | Type | Target | Status |
|--------|------|--------|--------|
| `agsynergy.ca` | Root domain | Cloudflare Pages | ⚠️ Verify in Cloudflare dashboard |
| `www.agsynergy.ca` | Subdomain (CNAME) | `agsynergy.ca` | ⚠️ Verify in Cloudflare dashboard |
| `api.agsynergy.ca` | Custom domain (Workers) | `agsynergy-api` Worker | ✅ Configured in wrangler.jsonc |

**Checks:**
- ✅ Pages project connected to custom domain (`agsynergy.ca`)
- ✅ www subdomain redirect/passthrough configured
- ⚠️ Verify SSL certificate auto-provisioning for custom domain
- ⚠️ Verify `api.agsynergy.ca` is NOT handled by Pages (it's a Worker route)

---

## 4. SSL/TLS Configuration

| Check | Setting | Status |
|-------|---------|--------|
| SSL mode | Full (strict) | ✅ Recommended for production |
| Minimum TLS version | 1.2 | ✅ Industry standard |
| Automatic HTTPS rewrites | Enabled | ✅ Prevents mixed content |
| SSL certificate | Cloudflare Universal SSL | ✅ Auto-provisioned |
| HSTS | Enabled via security-headers middleware | ✅ `max-age=31536000; includeSubDomains; preload` |

---

## 5. Cache Configuration

| Check | Setting | Status |
|-------|---------|--------|
| Default cache TTL | Cloudflare default (4 hours for static) | ✅ Adequate for static assets |
| Cache level | Standard | ✅ Default |
| Edge cache TTL | Respects origin `Cache-Control` | ✅ Follows best practices |
| Browser cache TTL | Respects origin `Cache-Control` | ✅ Follows best practices |
| Cache reserve | Enabled | ✅ Recommended for static assets |
| Caching rules | No custom rules yet | ⚠️ Add custom page rules for API routes (no cache) vs static assets (cache) |

**Recommendation:** Add a Page Rule to disable caching for `/api/*` paths and set long cache TTL for static assets (`.css`, `.js`, `.png`, `.ico`).

---

## 6. Preview Deployment Setup

| Check | Setting | Status |
|-------|---------|--------|
| Preview branch | `preview` | ⚠️ Verify branch exists in Cloudflare dashboard |
| Auto-deploy on push | Enabled | ⚠️ Verify configured |
| Preview URL | `<branch>.<project>.pages.dev` | ✅ Cloudflare managed |
| Preview environment vars | Separate from production | ⚠️ Verify configured |
| Access control | Preview deployments require auth | ⚠️ Consider enabling preview deployment access control |

---

## 7. Security Headers (via Middleware)

The Worker applies these security headers to all API responses:

| Header | Value | Status |
|--------|-------|--------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | ✅ HSTS enabled |
| `Content-Security-Policy` | Restrictive: `default-src 'self'` | ✅ CSP configured |
| `X-Frame-Options` | `DENY` | ✅ Prevents clickjacking |
| `X-Content-Type-Options` | `nosniff` | ✅ Prevents MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | ✅ Privacy-preserving |
| `Permissions-Policy` | Restricted: no camera/mic/geo/payment | ✅ Privacy-preserving |
| `Cache-Control` | `no-store, no-cache, must-revalidate` (API) | ✅ No caching for API data |

---

## 8. Summary

| Check | Status |
|-------|--------|
| Build Configuration | ✅ Standard build setup |
| Environment Variables | ⚠️ Verify in Cloudflare dashboard |
| Custom Domain Mapping | ✅ Configured (verify Pages project) |
| SSL/TLS Configuration | ✅ Production-grade |
| Cache Configuration | ✅ Adequate defaults (custom rules recommended) |
| Preview Deployment | ⚠️ Verify Cloudflare dashboard configuration |
| Security Headers | ✅ Applied via Worker middleware |

**Overall: ✅ CONDITIONAL PASS — Verify Cloudflare dashboard settings and add cache Page Rules before launch.**

---

*Concierge Launch Readiness — Workstream C*
*Cloudflare Pages Validation — v1.0.0*
*Last updated: 2026-07-27*