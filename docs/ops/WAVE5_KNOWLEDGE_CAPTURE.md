# Wave 5 Knowledge Capture — AG Synergy Document Centre

**Date:** 2026-08-01
**Product:** AG Synergy
**Wave:** 5 — Document Centre

---

## What Was Built

A patient-facing Document Centre that allows patients to manage all treatment-related documents through a unified, secure, mobile-first interface.

## Key Decisions

1. **Reused existing document platform** — No new backend services. The Wave 6 document platform (backend) already provides upload/download/preview/share APIs. Wave 5 is the patient-facing UI layer.

2. **Frontend-only delivery** — All new code is in the `artifacts/ags-fertility` frontend workspace. No D1 migrations, no R2 bucket changes, no API route changes.

3. **8 document categories** — Chosen from the approved roadmap deliverables: Passport, Visa, Medical Reports, Lab Results, Treatment Documents, Consent Forms, Prescriptions, Financial Documents.

4. **7 status lifecycle states** — Required → Uploaded → (Missing | Expiring | Expired | Pending Review | Rejected). Each state has a clear label and color.

5. **Search + Filter pattern** — Combined text search across filenames/categories with dropdown filters for category and status.

## Patterns Established

- Document pages follow the existing patient workspace pattern (AuthGuard + PatientLayout)
- New lib utilities follow the existing `@/lib/` import path convention
- New components follow the existing `@/components/` convention
- Barrel exports (`document-index.ts`) for clean imports

## Reusable By

- Future waves that add document-related features
- Any patient-facing document management feature
- The existing document platform backend (reuses its APIs)

## Deferred Backlog

- Email notifications for expiring documents (not blocking Wave 5)
- Bulk upload support (not blocking Wave 5)
- Document version comparison UI (not blocking Wave 5)
- Offline document access (not blocking Wave 5)

## Issues Encountered

None. The existing platform provided all necessary backend capabilities.

## Lessons Learned

1. The document platform backend was already built for Wave 6 — Wave 5 needed to be the UI layer only.
2. The patient workspace routing pattern in App.tsx is consistent and easy to extend.
3. The existing D1 schema (0007) already covers documents and document_shares — no new migrations needed.
