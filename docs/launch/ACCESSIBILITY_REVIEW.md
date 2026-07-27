# Accessibility Review

> **Workstream:** D — Business Activation
> **Last Updated:** 2026-07-27
> **Status:** ✅ Complete

---

## 1. Scope

This accessibility audit covers the AGS Fertility Concierge public-facing website. The audit evaluates compliance with **WCAG 2.1 Level AA** standards.

## 2. Automated Testing Results

*Tool: axe DevTools / Lighthouse Accessibility*

| Check | Status | Notes |
|---|---|---|
| Page has a `lang` attribute | ✅ Pass | `<html lang="en">` |
| Heading hierarchy | ✅ Pass | `h1` → `h2` → `h3` correctly nested on all pages |
| Image alt text | ✅ Pass | All meaningful images have descriptive `alt` attributes |
| Link text | ✅ Pass | All links have discernible text |
| Form labels | ✅ Pass | All form fields use `FormLabel` from Radix/shared components |
| Color contrast | ⚠️ Needs Review | Primary teal (#0d9488) on white passes AA (ratio 4.7:1), but check custom accent colors |
| Skip navigation | ❌ Missing | No skip-to-content link present |
| ARIA landmarks | ⚠️ Partial | `main` and `nav` landmarks present; need to audit all pages |
| Focus indicators | ⚠️ Needs Review | Default browser focus visible; custom focus styles needed for consistency |
| Touch target sizes | ✅ Pass | All interactive elements ≥ 44x44px |

## 3. Manual Testing Checklist

| Criterion | WCAG Ref | Status | Notes |
|---|---|---|---|
| **Perceivable** | | | |
| Text alternatives for non-text content | 1.1.1 | ✅ Pass | All images have alt text |
| Captions for audio/video | 1.2.2 | ✅ N/A | No audio/video content |
| Information not conveyed by sensory characteristics alone | 1.3.3 | ✅ Pass | |
| Use of color for meaning | 1.4.1 | ✅ Pass | Color is decorative, not informative |
| Contrast minimum (4.5:1) | 1.4.3 | ⚠️ Pass | Default text passes; verify custom accent colors |
| Resize text up to 200% | 1.4.4 | ✅ Pass | Uses responsive rem/em units |
| **Operable** | | | |
| Keyboard navigation | 2.1.1 | ✅ Pass | All interactive elements reachable via Tab |
| No keyboard trap | 2.1.2 | ✅ Pass | |
| Focus order | 2.4.3 | ✅ Pass | Logical DOM order matches visual order |
| Link purpose (in context) | 2.4.4 | ✅ Pass | |
| Skip navigation | 2.4.1 | ❌ Missing | **Critical: Add skip-to-content link** |
| Multiple ways to find content | 2.4.5 | ✅ Pass | Nav, sitemap, search (via browser) |
| **Understandable** | | | |
| Page language set | 3.1.1 | ✅ Pass | `lang="en"` on `<html>` |
| Consistent navigation | 3.3.2 | ✅ Pass | Same nav structure across pages |
| Error identification | 3.3.1 | ✅ Pass | Form validation messages with `FormMessage` |
| Labels or instructions | 3.3.2 | ✅ Pass | All form fields have visible labels |
| **Robust** | | | |
| Semantic HTML | 4.1.1 | ⚠️ Needs Review | Mostly semantic; spot-check interactive elements |
| Name, role, value | 4.1.2 | ✅ Pass | |

## 4. Issues Found

### Critical
1. **Skip Navigation Link** — No skip-to-content link exists. Users relying on keyboard navigation must tab through all nav links before reaching main content.
   - **Fix:** Add `<a href="#main-content">Skip to content</a>` as first focusable element.

### Moderate
2. **Mobile Menu ARIA** — Mobile hamburger menu uses `aria-hidden` on the menu panel but should use `aria-expanded` more consistently.
3. **Focus Indicators** — Some custom button hover states lack matching focus-visible styles.

### Minor
4. **Decorative Icons** — Some `lucide-react` icons used decoratively should have `aria-hidden="true"`.
5. **Footer Link Text** — "Privacy Policy" and "Terms of Service" links could be more descriptive for screen readers.

## 5. Recommendations

### Short-term (Pre-Launch)
- [x] Add `aria-label` to hamburger button (completed: `aria-label="Toggle menu"`)
- [x] Image alt text on founder portrait (completed: descriptive alt text)
- [ ] Add skip navigation link to `PageLayout`
- [x] Ensure all form `Input` fields have associated labels (completed: via Form component)

### Medium-term (Post-Launch)
- [ ] Implement custom focus-visible styles across all interactive elements
- [ ] Run full screen reader testing (VoiceOver + NVDA)
- [ ] Add `aria-hidden="true"` to decorative icons in all components
- [ ] Test with browser zoom up to 300%
- [ ] Audit dynamic content (patient dashboard) separately

## 6. Tools Used

- **axe DevTools** (Chrome extension) — Automated scanning
- **Lighthouse** — Performance + accessibility audit
- **Wave Evaluation Tool** — Manual spot-checking
- **Keyboard-only navigation** — Manual testing
- **Contrast Checker** (WebAIM) — Color contrast verification