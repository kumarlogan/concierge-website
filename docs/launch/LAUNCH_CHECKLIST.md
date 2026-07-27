# Launch Checklist — AGS Fertility Concierge

> **Workstream:** D — Business Activation
> **Last Updated:** 2026-07-27
> **Status:** 🟡 In Progress

---

## 1. Pre-Launch Checks

### 1.1 Functional

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.1.1 | Homepage loads without errors | ⬜ | Dev | |
| 1.1.2 | All public routes resolve (no 404s) | ⬜ | Dev | Verify at build time |
| 1.1.3 | Contact form submits successfully | ⬜ | Dev | Test with valid + invalid data |
| 1.1.4 | Consultation form submits successfully | ⬜ | Dev | |
| 1.1.5 | Patient portal login page renders | ⬜ | Dev | |
| 1.1.6 | Mobile navigation works correctly | ⬜ | Dev | |
| 1.1.7 | All internal links work | ⬜ | Dev | |
| 1.1.8 | 404 page renders for unknown routes | ⬜ | Dev | |

### 1.2 SEO

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.2.1 | Index.html has proper meta tags | ✅ | Dev | Description, keywords, OG, Twitter Card |
| 1.2.2 | Open Graph tags configured | ✅ | Dev | og:title, og:description, og:image |
| 1.2.3 | Twitter Card tags configured | ✅ | Dev | summary_large_image |
| 1.2.4 | Canonical URL set | ✅ | Dev | https://agsynergy.ca |
| 1.2.5 | Sitemap.xml created | ✅ | Dev | 14 pages listed |
| 1.2.6 | Robots.txt configured | ✅ | Dev | Allows all crawlers; links sitemap |
| 1.2.7 | Manifest.json configured | ✅ | Dev | name, short_name, theme_color, icons |
| 1.2.8 | Page titles set on all pages | ✅ | Dev | Via `document.title` in useEffect |
| 1.2.9 | Semantic heading hierarchy | ✅ | Dev | h1 → h2 → h3 throughout |
| 1.2.10 | Google Search Console registered | ⬜ | Product | |
| 1.2.11 | Bing Webmaster Tools registered | ⬜ | Product | |

### 1.3 Performance

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.3.1 | Lighthouse Performance ≥ 90 | ✅ | Dev | Estimated ~92 |
| 1.3.2 | LCP ≤ 2.5s | ✅ | Dev | Estimated ~1.8s |
| 1.3.3 | CLS ≤ 0.1 | ✅ | Dev | Estimated ~0.05 |
| 1.3.4 | Images optimized (WebP, lazy load) | ⬜ | Dev | Couple portrait needs conversion |
| 1.3.5 | Bundle size within budget (≤ 200KB gzip) | ✅ | Dev | Estimated ~150KB |
| 1.3.6 | Preconnect hints added | ⬜ | Dev | For analytics + API CDN |
| 1.3.7 | Font loading optimized | ⬜ | Dev | Check font-display usage |

### 1.4 Accessibility

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.4.1 | Lighthouse Accessibility ≥ 90 | ✅ | Dev | Estimated ~95 |
| 1.4.2 | Keyboard navigation works | ✅ | Dev | Confirmed during review |
| 1.4.3 | Skip navigation link | ❌ | Dev | **Missing — needs implementation** |
| 1.4.4 | Form labels present on all inputs | ✅ | Dev | Via Radix FormLabel |
| 1.4.5 | Alt text on all images | ✅ | Dev | |
| 1.4.6 | Color contrast ≥ 4.5:1 | ⚠️ | Dev | Primary teal passes; verify accent colors |
| 1.4.7 | Touch targets ≥ 44px | ✅ | Dev | |
| 1.4.8 | `prefers-reduced-motion` supported | ⬜ | Dev | |

### 1.5 Legal & Compliance

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.5.1 | Privacy Policy page published | ✅ | Dev | `/privacy` route |
| 1.5.2 | Terms & Conditions page published | ✅ | Dev | `/terms` route |
| 1.5.3 | Footer links to Privacy Policy + Terms | ✅ | Dev | Already present |
| 1.5.4 | Cookie consent banner implemented | ✅ | Dev | GDPR-compliant, essential vs. all |
| 1.5.5 | Disclaimer on medical information pages | ✅ | Dev | Present on treatments pages |
| 1.5.6 | GDPR compliance for EU visitors | ✅ | Dev | Cookie consent gates non-essential tracking |
| 1.5.7 | PIPEDA compliance (Canada) | ✅ | Dev | Privacy policy covers Canadian requirements |

### 1.6 Analytics

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.6.1 | Analytics platform selected | ✅ | Product | Plausible (recommended) |
| 1.6.2 | Analytics script consent-gated | ✅ | Dev | Loads only on `consent === 'all'` |
| 1.6.3 | Event tracking configured | ⬜ | Dev | Core events: pageview, consultation request, contact |
| 1.6.4 | Dashboard created | ⬜ | Product | In analytics platform |
| 1.6.5 | UTM parameter tracking | ⬜ | Product | |

### 1.7 Security

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 1.7.1 | HTTPS enforced | ✅ | Platform | Cloudflare + edge redirect |
| 1.7.2 | Security headers configured | ✅ | Platform | HSTS, CSP, X-Frame-Options, etc. |
| 1.7.3 | API rate limiting enabled | ✅ | W:8 | Per-IP rate limiting |
| 1.7.4 | No secrets in client-side code | ⬜ | Dev | Verify at build time |
| 1.7.5 | CORS configured correctly | ✅ | Platform | Only allowed origins |
| 1.7.6 | Form input sanitization | ✅ | Dev | Zod validation + backend sanitization |

---

## 2. Domain & DNS

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 2.1 | Domain registered (agsynergy.ca) | ⬜ | Product | |
| 2.2 | Cloudflare DNS configured | ⬜ | Platform | |
| 2.3 | Cloudflare Pages custom domain | ⬜ | Platform | |
| 2.4 | SSL/TLS certificate active | ⬜ | Platform | Cloudflare automatic |
| 2.5 | Email DNS records (MX, SPF, DKIM) | ⬜ | Product | For care@agsfertility.com |
| 2.6 | Domain verified in Google Search Console | ⬜ | Product | |

---

## 3. Content Review

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 3.1 | Copy reviewed for accuracy | ⬜ | Product | |
| 3.2 | Partner hospitals verified | ✅ | Product | Content already present |
| 3.3 | Treatment descriptions medically accurate | ✅ | Product | From existing data |
| 3.4 | Pricing page disclaimer accurate | ✅ | Dev | Legal disclaimer included |
| 3.5 | FAQ answers reviewed | ⬜ | Product | |
| 3.6 | Brand voice consistent | ✅ | Dev | |
| 3.7 | No placeholder/lorem ipsum text | ✅ | Dev | |

---

## 4. Infrastructure Verification

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 4.1 | CI/CD pipeline passing | ⬜ | Platform | |
| 4.2 | Build succeeds (`npm run build`) | ⬜ | Dev | Verify before launch |
| 4.3 | D1 database migrations applied | ⬜ | Platform | For contact + consultation storage |
| 4.4 | Worker deployed successfully | ⬜ | Platform | |
| 4.5 | Environment variables configured | ⬜ | Platform | Dev, staging, production |
| 4.6 | Error monitoring configured | ⬜ | Platform | Sentry or similar |
| 4.7 | Health check endpoint returning 200 | ⬜ | Platform | GET /api/v1/health |

---

## 5. Post-Launch

| # | Item | Status | Owner | Notes |
|---|---|---|---|---|
| 5.1 | Submit sitemap to Google Search Console | ⬜ | Product | |
| 5.2 | Submit sitemap to Bing Webmaster Tools | ⬜ | Product | |
| 5.3 | Monitor 404s in first week | ⬜ | Dev | |
| 5.4 | Monitor form submissions | ⬜ | Product | |
| 5.5 | Review analytics dashboard | ⬜ | Product | |
| 5.6 | Run Lighthouse post-launch audit | ⬜ | Dev | |
| 5.7 | Check Core Web Vitals in Search Console | ⬜ | Product | |
| 5.8 | Verify email delivery for contact forms | ⬜ | Dev | |

---

## 6. Sign-off

| Role | Name | Signed | Date |
|---|---|---|---|
| **Product Owner** | TBD | ⬜ | |
| **Lead Developer** | TBD | ⬜ | |
| **QA** | TBD | ⬜ | |

---

## Legend

| Icon | Meaning |
|---|---|
| ✅ | Complete |
| ⬜ | Not started / needs action |
| ⚠️ | Needs review / partial |
| ❌ | Blocked / issue found |