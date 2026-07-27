# Analytics Setup

> **Workstream:** D — Business Activation
> **Last Updated:** 2026-07-27
> **Status:** ✅ Complete

---

## 1. Overview

This document describes the analytics configuration for the AGS Fertility Concierge website. Analytics are implemented with **GDPR compliance** as a core requirement, using the cookie consent banner to gate non-essential tracking.

## 2. Approach

| Aspect | Decision | Rationale |
|---|---|---|
| **Platform** | Plausible Analytics (self-hosted or cloud) | Privacy-first, no cookies by default, GDPR-compliant, lightweight (~1KB script) |
| **Cookie Consent** | Essential-only vs. All | Analytics cookies are non-essential; only loaded after user consent |
| **Consent Mechanism** | `CookieConsentBanner` component | Stores consent level in `localStorage`; analytics script loads only when `consent === 'all'` |
| **Data Anonymization** | Yes (by Plausible default) | IP addresses anonymized, no personal data collected |

## 3. Integration

### 3.1 Plausible Script (with Consent Gating)

Add this to `index.html` or inject via React:

```html
<!-- Plausible Analytics (loaded only with consent) -->
<script
  id="plausible-script"
  defer
  data-domain="agsynergy.ca"
  src="https://plausible.io/js/script.js"
></script>
```

### 3.2 Consent-Gated Loading

The analytics script should be dynamically loaded only when `consent === 'all'`. Example via the `useCookieConsent` hook:

```typescript
import { useEffect } from 'react';
import { useCookieConsent } from '@/components/CookieConsentBanner';

export function useAnalytics() {
  const consent = useCookieConsent();

  useEffect(() => {
    if (consent !== 'all') return;

    // Load Plausible dynamically
    const script = document.createElement('script');
    script.src = 'https://plausible.io/js/script.js';
    script.defer = true;
    script.dataset.domain = 'agsynergy.ca';
    script.id = 'plausible-script';
    document.head.appendChild(script);

    // Ensure window.plausible is available
    (window as any).plausible =
      (window as any).plausible ||
      function () {
        ((window as any).plausible.q =
          (window as any).plausible.q || []).push(arguments);
      };

    return () => {
      const existing = document.getElementById('plausible-script');
      if (existing) existing.remove();
    };
  }, [consent]);
}
```

## 4. Events to Track

| Event | Trigger | Purpose |
|---|---|---|
| `Pageview` | Automatic (Plausible) | Understand popular content |
| `Consultation Request` | Form submission | Track lead generation |
| `Contact Form Submit` | Contact form submission | Track inquiry volume |
| `Outbound Link: Click` | External link clicks | Understand referral traffic |
| `File Download` | Document downloads | Track resource engagement |

## 5. Privacy Compliance

### 5.1 GDPR

- Non-essential analytics scripts are **blocked by default**
- User must provide explicit consent via the cookie banner
- Consent is stored in `localStorage` (preferences cookie)
- No personal data (PII) is sent to analytics platform
- IP addresses are anonymized

### 5.2 PIPEDA (Canada)

- Data collection is limited to what is necessary
- No data is shared with third parties for advertising
- Opt-out mechanism available via cookie preferences

### 5.3 CalOPPA (California)

- "Do Not Track" signals are respected
- Privacy Policy includes disclosure of third-party tracking

## 6. Dashboard Setup

1. Sign up at [Plausible](https://plausible.io) (or self-host)
2. Add domain: `agsynergy.ca`
3. Copy the provided script snippet
4. Implement consent-gated loading as described above
5. Verify installation via Plausible's live dashboard

## 7. Alternative: Google Analytics 4 (if required)

If Plausible is not acceptable and GA4 is required:

- Use `gtag.js` with `consent mode v2`
- Set `analytics_storage: 'denied'` by default
- Update to `analytics_storage: 'granted'` on consent
- Enable IP anonymization
- Disable data sharing with Google

**Recommendation:** Prefer Plausible for privacy-first tracking aligned with the brand's trust-focused positioning.