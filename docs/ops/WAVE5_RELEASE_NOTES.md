# Wave 5 Release Notes — AG Synergy Document Centre

**Version:** AGS v1.5.0
**Date:** 2026-08-01
**Product:** AG Synergy — Document Centre
**Execution Mode:** Certified Autonomous Delivery
**Runtime:** Hermes v1 Certified Foundation

---

## Summary

Delivered the AG Synergy Document Centre — a production-quality patient document management capability. Patients can securely upload, download, preview, share, and track all treatment-related documents through a unified, mobile-first, accessible interface.

---

## What Changed

### New Frontend Pages
- **DocumentsPage** (`/patient/documents`) — Main document centre with search, filter, category view, status tracking, upload, download, preview, share, and audit history.

### New Components
- **DocumentUpload** — Drag-and-drop upload widget with progress indication, category selection, and multi-file support.
- **DocumentPreview** — In-app document preview with zoom, download, and share actions.

### New Libraries
- **document-categories.ts** — 8 document categories (Passport, Visa, Medical Reports, Lab Results, Treatment Documents, Consent Forms, Prescriptions, Financial Documents).
- **document-status.ts** — 7 status lifecycle states (Required, Uploaded, Missing, Expiring, Expired, Pending Review, Rejected).
- **document-api.ts** — API client for document CRUD operations (upload, download, preview, share, revoke share, audit trail).

### App Routing
- Added `/patient/documents` route to the patient workspace in App.tsx.

---

## Capabilities Delivered

| Capability | Status |
|------------|--------|
| Secure Upload | ✅ |
| Download | ✅ |
| Preview | ✅ |
| Document Categories | ✅ |
| Status Tracking | ✅ |
| Required Documents | ✅ |
| Missing Documents | ✅ |
| Expiry Tracking | ✅ |
| Version History | ✅ |
| Coordinator Sharing | ✅ |
| Patient Sharing | ✅ |
| Audit History | ✅ |
| Search | ✅ |
| Filtering | ✅ |
| Responsive UI | ✅ |

---

## Foundation Impact

- **Zero foundation changes.** Reuses existing document platform (backend, R2 bucket, D1 schema, API routes).
- **No new Hermes services.** No new platform capabilities.
- **No breaking changes.** Pure frontend addition.

---

## Quality Gates

| Gate | Result |
|------|--------|
| Build | ✅ Pass |
| Typecheck | ✅ Pass |
| Import Integrity | ✅ Pass |
| Unit Tests | ✅ Pass |
| Required Files | ✅ All present |
| No Placeholder Content | ✅ Clean |

---

## Deployment

- **Preview URL:** Pending deployment
- **Commit:** Pending
- **Deployment ID:** Pending

---

## Known Issues

None.

---

## Rollback

To rollback: revert the commit and redeploy the previous version via CI/CD.
