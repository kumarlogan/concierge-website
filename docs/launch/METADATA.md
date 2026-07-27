# Metadata & SEO Configuration

> **Workstream:** D — Business Activation
> **Last Updated:** 2026-07-27
> **Status:** ✅ Complete

---

## 1. HTML Meta Tags (`index.html`)

| Property | Value | Notes |
|---|---|---|
| `title` | AGS Fertility Concierge — IVF Coordination for Canadians in Bangalore | Primary page title |
| `description` | Trusted fertility treatment coordination for Canadian families. We connect you with experienced IVF specialists and partner hospitals in Bangalore, India — with personal guidance at every step. | 150 chars, includes target audience + location |
| `keywords` | IVF Canada, fertility treatment Bangalore, IVF coordination, fertility concierge, Canadian fertility abroad, surrogacy India, egg donation Bangalore, AGS Fertility, AG Synergy | SEO keywords |
| `robots` | index, follow | Allow indexing |
| `author` | AGS Fertility Concierge (AG Synergy) | Brand attribution |
| `theme-color` | `#0d9488` (teal-600) | Matches brand primary colour |
| `canonical` | `https://agsynergy.ca` | Avoids duplicate content |

## 2. Open Graph Tags

| Property | Value |
|---|---|
| `og:title` | AGS Fertility Concierge — IVF Coordination for Canadians in Bangalore |
| `og:description` | Trusted fertility treatment coordination for Canadian families. Connecting you with experienced IVF specialists in Bangalore. |
| `og:type` | website |
| `og:url` | `https://agsynergy.ca` |
| `og:image` | `https://agsynergy.ca/og-image.png` |
| `og:image:width` | 1200 |
| `og:image:height` | 630 |
| `og:locale` | en_CA |
| `og:site_name` | AGS Fertility Concierge |

## 3. Twitter Card

| Property | Value |
|---|---|
| `twitter:card` | summary_large_image |
| `twitter:title` | AGS Fertility Concierge — IVF Coordination for Canadians in Bangalore |
| `twitter:description` | Trusted fertility treatment coordination for Canadian families. Connecting you with experienced IVF specialists in Bangalore. |
| `twitter:image` | `https://agsynergy.ca/og-image.png` |

## 4. Web App Manifest (`public/manifest.json`)

| Property | Value |
|---|---|
| `name` | AGS Fertility Concierge |
| `short_name` | AGS Fertility |
| `description` | Trusted fertility treatment coordination for Canadian families. Connecting you with experienced IVF specialists and partner hospitals in Bangalore, India. |
| `start_url` | `/` |
| `display` | standalone |
| `background_color` | `#ffffff` |
| `theme_color` | `#0d9488` |
| `orientation` | portrait-primary |
| `lang` | en-CA |
| `icons` | SVG favicon (any + maskable) |

## 5. Sitemap (`public/sitemap.xml`)

| Page | Priority | Change Frequency |
|---|---|---|
| `/` | 1.0 | weekly |
| `/about` | 0.8 | monthly |
| `/services` | 0.8 | monthly |
| `/treatments` | 0.9 | weekly |
| `/fertility-treatments` | 0.7 | monthly |
| `/pricing` | 0.7 | monthly |
| `/partner-hospitals` | 0.8 | monthly |
| `/contact` | 0.7 | monthly |
| `/faq` | 0.7 | monthly |
| `/cost-guide` | 0.6 | monthly |
| `/success-stories` | 0.6 | monthly |
| `/ivf-bangalore` | 0.6 | monthly |
| `/privacy` | 0.3 | yearly |
| `/terms` | 0.3 | yearly |

## 6. Robots (`public/robots.txt`)

```
User-agent: *
Allow: /
Sitemap: https://agsynergy.ca/sitemap.xml
Disallow: /patient/
```

Patient workspace is disallowed from crawling to prevent private portal paths from appearing in search results.