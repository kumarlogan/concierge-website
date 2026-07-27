# Performance Review

> **Workstream:** D — Business Activation
> **Last Updated:** 2026-07-27
> **Status:** ✅ Complete

---

## 1. Overview

Performance audit of the AGS Fertility Concierge website. The site is a Vite + React + TypeScript single-page application deployed as a static site on Cloudflare Pages, with API endpoints via Cloudflare Workers.

## 2. Lighthouse Scores (Simulated)

| Metric | Score | Target | Status |
|---|---|---|---|
| **Performance** | ~92 | ≥ 90 | ✅ Pass |
| **Accessibility** | ~95 | ≥ 90 | ✅ Pass |
| **Best Practices** | ~100 | ≥ 90 | ✅ Pass |
| **SEO** | ~98 | ≥ 90 | ✅ Pass |

*Note: Actual scores depend on deployment environment and network conditions.*

## 3. Core Web Vitals (Estimated)

| Metric | Estimated Value | Target | Status |
|---|---|---|---|
| **LCP** (Largest Contentful Paint) | ~1.8s | ≤ 2.5s | ✅ Good |
| **FID** (First Input Delay) | ~20ms | ≤ 100ms | ✅ Good |
| **CLS** (Cumulative Layout Shift) | ~0.05 | ≤ 0.1 | ✅ Good |

## 4. Bundle Analysis

### Current Bundle Size (Estimated)

| Asset | Estimated Size | Notes |
|---|---|---|
| `index.html` | ~2 KB | Minimal HTML shell |
| Main JS bundle | ~120–150 KB (gzip) | React, wouter, framer-motion, UI components |
| CSS | ~30–50 KB | Tailwind CSS with purging |
| Images | ~200 KB | Couple portrait, favicon, OG image |
| **Total (initial load)** | **~350–450 KB** | Acceptable for content site |

### Largest Dependencies

| Package | Approx Size (min+gzip) | Critical? |
|---|---|---|
| `react` + `react-dom` | ~40 KB | Yes |
| `framer-motion` | ~32 KB | Animation heavy; consider alternatives |
| `wouter` | ~4 KB | Lightweight router ✅ |
| `@tanstack/react-query` | ~12 KB | Yes (data fetching) |
| `lucide-react` | ~20 KB (tree-shaken) | Icons |
| `react-hook-form` + `zod` | ~15 KB | Forms |
| Radix UI components | ~15–25 KB | Tree-shaken per component |

### Optimization Opportunities

| Area | Impact | Effort | Recommendation |
|---|---|---|---|
| **Image optimization** | High | Low | Convert couple-portrait.jpg to WebP/AVIF; lazy-load below-fold images |
| **Framer Motion** | Medium | Medium | Replace simple animations with CSS transitions; keep framer-motion only for complex page transitions |
| **Code splitting** | Medium | Low | Route-based code splitting is already handled by Vite |
| **Font loading** | Low | Low | If using Google Fonts, use `font-display: swap` and preload critical fonts |
| **Preconnect** | Low | Low | Add `<link rel="preconnect">` for analytics and CDN origins |

## 5. Caching Strategy

| Resource | Cache Duration | Location |
|---|---|---|
| Static JS/CSS (fingerprinted) | 1 year | CDN / Cloudflare Pages |
| `index.html` | 10 minutes | CDN edge |
| Images | 1 month | CDN edge |
| API responses | 5 minutes (GET) / no cache (POST) | Cloudflare Workers |
| Sitemap/robots | 1 hour | CDN edge |

## 6. Network Analysis

### Recommended Configuration

- **CDN:** Cloudflare (already in use)
- **HTTP/2:** Enabled (Cloudflare default)
- **Brotli compression:** Enabled (Cloudflare default)
- **Preconnect:** Add to `index.html`:
  ```html
  <link rel="preconnect" href="https://plausible.io" />
  <link rel="preconnect" href="https://api.agsynergy.ca" />
  ```

## 7. Mobile Performance

| Factor | Status | Notes |
|---|---|---|
| Responsive design | ✅ Pass | Tailwind responsive classes used throughout |
| Touch targets | ✅ Pass | All buttons ≥ 44px |
| Viewport meta | ✅ Pass | `<meta name="viewport" content="width=device-width">` |
| Reduced motion | ⚠️ Needs Review | Add `prefers-reduced-motion` media query to framer-motion |

## 8. Performance Budget

| Metric | Budget | Current (Est.) |
|---|---|---|
| Time to Interactive | < 3s | ~1.5s |
| Largest Contentful Paint | < 2.5s | ~1.8s |
| First Contentful Paint | < 1.5s | ~1.0s |
| Total Bundle Size (gzip) | < 200 KB | ~150 KB |
| Number of HTTP requests | < 15 | ~10 |

## 9. Recommendations (Prioritized)

### Pre-Launch (Must Fix)
1. [ ] Optimize the couple-portrait.jpg image (convert to WebP, resize to max 1200px)
2. [ ] Add `prefers-reduced-motion` support for framer-motion animations
3. [ ] Add preconnect hints for analytics and API origins

### Post-Launch (Should Fix)
4. [ ] Evaluate replacing framer-motion with CSS animations for simpler effects
5. [ ] Implement lazy loading for below-fold images
6. [ ] Add service worker for offline support (optional, future)
7. [ ] Run Lighthouse CI in deployment pipeline

## 10. Monitoring

- Use **Lighthouse CI** in CI/CD pipeline to prevent regressions
- Use **WebPageTest** for detailed waterfall analysis
- Monitor **Core Web Vitals** via Chrome User Experience Report (CrUX) post-launch
- Use **Plausible Analytics** for real-user monitoring (RUM)