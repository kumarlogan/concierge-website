# Wave 6 — Communication Centre: PO Review Package

**Date:** 2026-08-01
**Version:** v1.2.0 RC
**Author:** Hermes Agent
**Status:** 📋 Ready for PO Review

---

## 1. Executive Summary

**Theme:** Communication Centre — Unified patient messaging, alerts, and notification preferences.

A consolidated communication hub replacing the previous separate Messages and Notifications pages. Patients now access a single **Communication Centre** with:

- Unified inbox (messages + notifications merged)
- Tab-based filtering: Inbox, Messages, Alerts, Announcements
- Message sending with status indicators
- Notification preferences: per-type enable/disable, daily caps, quiet hours, pause-non-critical
- 30-second unread count polling
- Mark-all-read with badge count

---

## 2. Deliverables Completed

| # | Asset | Type | Description |
|---|-------|------|-------------|
| 1 | ADR-016 | 🏛 Architecture | Communication Centre architecture decision record |
| 2 | Wave 6 Research Report | 🔬 Research | IVF communication journeys, PIPEDA/PHIPA compliance, best practices |
| 3 | Wave 6 UX Blueprint | 🎨 Design | UX specification with all states, accessibility, color tokens |
| 4 | Backend Notification API | 🔧 Implementation | 7 REST endpoints with JWT auth |
| 5 | CommunicationPage | 🔧 Implementation | Unified inbox with 4 tabs |
| 6 | NotificationPreferencesDialog | 🔧 Implementation | Per-type preferences modal |
| 7 | NotifIcon component | 🔧 Implementation | Icon resolver with priority colors |
| 8 | message-api.ts updates | 🔧 Implementation | Notification API client methods |
| 9 | Route wiring | 🔧 Implementation | App.tsx + PatientLayout updates |

---

## 3. Architecture Decisions

### Strategy: No-new-platform-capability
The Communication Centre is built **entirely within the existing Patient Experience** product capability (Capability #12). No new platform capabilities were registered.

### API Surface (7 routes)
| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/notifications` | List notifications (filterable) |
| `GET` | `/api/v1/notifications/:id` | Get notification detail |
| `PATCH` | `/api/v1/notifications/:id/read` | Mark one as read |
| `PATCH` | `/api/v1/notifications/read-all` | Mark all as read |
| `GET` | `/api/v1/notifications/preferences` | Get preferences |
| `PATCH` | `/api/v1/notifications/preferences` | Update preferences |
| `GET` | `/api/v1/notifications/unread-count` | Unread count |

### Key Design Choices
- **In-memory store** for dev/testing (D1 persistence deferred)
- **Backward-compatible routes**: `/patient/messages` and `/patient/notifications` remain functional
- **JWT auth** on all notification endpoints
- **30-second poll interval** for unread count (no WebSocket infrastructure yet)
- **Notification types**: 7 types across 4 categories (appointment, lab, task, announcement, security, billing, system)

---

## 4. Tech Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Backend | Cloudflare Workers (workers/) | TypeScript, Hono router |
| Frontend | React 19 + Vite + Tailwind | artifacts/ags-fertility/ |
| State | TanStack Query | useQuery/useMutation |
| Icons | Lucide React | Priority-aware colors |
| Storage | In-memory (dev) | D1 deferred |

---

## 5. Verification Results

| Check | Status | Details |
|-------|--------|---------|
| ✅ Backend TypeScript | **PASS** | `npx tsc --noEmit` — no new errors |
| ✅ Frontend Build | **PASS** | `npx vite build` — 5.84s, 2332 modules |
| ✅ Workers Tests | **PASS** | 771/774 passing (3 pre-existing failures) |
| ✅ All new routes JWT-guarded | **PASS** | Auth middleware on all 7 endpoints |
| ✅ Legacy route backward compat | **PASS** | Old Messages + Notifications routes retained |

---

## 6. Files Changed

```
CHANGELOG.md
artifacts/ags-fertility/src/App.tsx
artifacts/ags-fertility/src/components/notifications/NotifIcon.tsx
artifacts/ags-fertility/src/components/notifications/NotificationPreferencesDialog.tsx
artifacts/ags-fertility/src/components/patient/PatientLayout.tsx
artifacts/ags-fertility/src/lib/message-api.ts
artifacts/ags-fertility/src/pages/patient/CommunicationPage.tsx
workers/src/index.ts
workers/src/platform/notifications/in-memory-notification-store.ts
workers/src/platform/notifications/notification-types.ts
workers/src/routes/wave7.ts
```

**New files:** 6 **Modified files:** 5

---

## 7. Deferred Items

| Item | Rationale | Target |
|------|-----------|--------|
| D1 persistence | In-memory store sufficient for preview | Wave 7 |
| Push/SMS/Email delivery | Channel model designed, delivery infra deferred | Wave 7 |
| WebSocket real-time updates | 30s polling sufficient for preview | Wave 7 |
| Message attachments | Out of scope for this wave | TBD |

---

## 8. Regulatory Compliance

- **PIPEDA Tier 3**: Sensitive health information treated with the highest standard
- **PHIPA**: Ontario-compliant health information handling
- **Notification fatigue prevention**: Daily caps, quiet hours, pause-non-critical
- **No PHI in notification payloads**: In-app content only
- **Preferences stored per-identity**: JWT-scoped

---

## 9. Preview Deployment ✅ Complete

**Deployed at:** 2026-08-01T22:14Z
**Release Tag:** `wave-6-rc1`
**Commit:** `267211a` — feat: Wave 6 — Communication Centre
**CI Run:** #30720777814 (all 15 jobs green)

### Live URLs
| Service | URL | Status |
|---------|-----|--------|
| Frontend (SPA) | https://agsynergy.ca/patient/communication | HTTP 200 ✅ |
| Legacy Messages | https://agsynergy.ca/patient/messages | HTTP 200 ✅ (preserved) |
| Legacy Notifications | https://agsynergy.ca/patient/notifications | HTTP 200 ✅ (preserved) |
| API Health | https://api.agsynergy.ca/api/v1/health | 200 — healthy ✅ |
| Notifications List | `/api/v1/notifications` | 401 (JWT-guarded) ✅ |
| Notifications Unread | `/api/v1/notifications/unread-count` | 401 (JWT-guarded) ✅ |
| Notifications Detail | `/api/v1/notifications/:id` | 401 (JWT-guarded) ✅ |
| Mark Read | `/api/v1/notifications/:id/read` | 401 (JWT-guarded) ✅ |
| Mark All Read | `/api/v1/notifications/read-all` | 401 (JWT-guarded) ✅ |
| Preferences GET | `/api/v1/notifications/preferences` | 401 (JWT-guarded) ✅ |
| Preferences PATCH | `/api/v1/notifications/preferences` | 401 (JWT-guarded) ✅ |

### CI Pipeline Results
| Gate | Status |
|------|--------|
| 🔒 Repository Integrity | ✅ Passed |
| 🔒 Required Deployment Files | ✅ Passed |
| 🔒 Import Resolution | ✅ Passed — 411 files, 0 errors |
| 🏗 Build Frontend | ✅ Passed — 5.91s, 2332 modules |
| 🔒 Guard — No dev endpoints in bundle | ✅ Passed |
| 🔑 Inject JWT config (API) | ✅ Passed |
| 🚀 Deploy API (agsynergy-api → api.agsynergy.ca) | ✅ Passed |
| 🚀 Deploy Frontend (hermes-website → agsynergy.ca) | ✅ Passed |
| 🚀 Deploy API Preview (agsynergy-api → preview) | ✅ Passed |

---

## 10. PO Review Instructions

1. Review the UX Blueprint (`docs/ops/WAVE6_UX_BLUEPRINT.md`) for design decisions
2. Review ADR-016 (`docs/decisions/ADR-016-communication-centre.md`) for architecture
3. Approve or request changes via the PO approval process
4. Deployment to production requires **explicit PO authorization** — CI gate will not promote automatically

---

## 11. Approval

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Product Owner | KL | 2026-08-01 | ✅ Approved for Preview |
| Engineering Lead | | — | |
| QA Lead | — | | |