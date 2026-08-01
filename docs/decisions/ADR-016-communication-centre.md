---
title: "ADR-016 Communication Centre Architecture"
status: "Approved"
date: "2026-08-01"
product: "AG Synergy"
wave: 6
---

# ADR-016: Communication Centre Architecture

**Status:** Approved
**Date:** 2026-08-01
**Product:** AG Synergy v1.5.0 RC
**Wave:** 6

---

## Context

Wave 5 delivered the Document Centre. Wave 6 must deliver a unified **Communication Centre** — the single location for every conversation between Patient, Clinic, Care Coordinator, AI Care Companion, and Internal Operations.

Research (see `WAVE6_RESEARCH_REPORT.md`) validated:
- IVF patient communication journey has 15+ touchpoints across 3 phases
- Canadian privacy framework requires TLS 1.2+/AES-256, MFA, 10-year retention, patient-controlled consent
- Best-in-class portals (MyChart, NHS App) use threaded conversations, notification preference hubs, and escalation workflows
- Notification fatigue triggers at 5+/day; smart suppression is essential
- Existing MessageEngine platform capability already provides core messaging infrastructure

## Decision

Build the Communication Centre as a **frontend integration layer** over the existing Hermes Platform messaging capability, adding unified inbox, notification delivery, and patient-controlled preferences. **No new backend platform code** — reuse MessageEngine, MessageAuditLogger, MessagePolicy, and the Consent Engine.

### Architecture Summary

```
Patient Browser/App
        │
        ▼
CommunicationPage (/patient/communication)
    ┌──────────────────────────────────────────┐
    │  UnifiedInbox                            │
    │  ┌────────────────────────────────┐      │
    │  │ Tabs: All | Messages | Alerts  │      │
    │  │ Search bar + filters           │      │
    │  │────────────────────────────────│      │
    │  │ ThreadListItem (message)       │      │
    │  │ NotificationItem (alert)       │      │
    │  │ SystemAnnouncement (broadcast) │      │
    │  └────────────────────────────────┘      │
    │                                          │
    │  ConversationView [when thread selected]  │
    │  ┌────────────────────────────────┐      │
    │  │ Message bubbles (existing)     │      │
    │  │ Compose (existing) + attach    │      │
    │  │ Status indicators (existing)   │      │
    │  └────────────────────────────────┘      │
    │                                          │
    │  NotificationPreferences [sidebar/dialog] │
    │  ┌────────────────────────────────┐      │
    │  │ Per-channel toggles           │      │
    │  │ Per-type granularity          │      │
    │  │ Quiet hours config            │      │
    │  │ Daily notification cap        │      │
    │  │ Pause non-critical toggle     │      │
    │  └────────────────────────────────┘      │
    └──────────────────────────────────────────┘
        │
        ▼
   Existing API Layer
   ┌──────────────────────────────┐
   │ GET /api/v1/messages/threads │
   │ GET /api/v1/messages/threads/:id │
   │ POST /api/v1/messages        │
   │ NEW: GET /api/v1/notifications │
   │ NEW: PATCH /api/v1/notifications/preferences │
   └──────────────────────────────┘
        │
        ▼
   Platform Capabilities
   ┌──────────────────────────────┐
   │ MessageEngine (existing)     │
   │ MessageAuditLogger (existing)│
   │ MessagePolicy (existing)     │
   │ Consent Engine (existing)    │
   │ Document Engine (reuse for attachments) │
   └──────────────────────────────┘
```

### API Changes (Minimal)

Add these routes to `workers/src/routes/wave7.ts`:

```
GET  /api/v1/notifications       — List notifications for current user (with ?unreadOnly, ?type, ?limit, ?offset)
GET  /api/v1/notifications/:id   — Get single notification detail
PATCH /api/v1/notifications/:id/read — Mark notification as read
PATCH /api/v1/notifications/preferences — Update notification preferences
GET  /api/v1/notifications/preferences — Get current notification preferences
```

Notification preference storage uses the existing D1 database or in-memory for dev.

### Frontend Changes

| Component | Action |
|-----------|--------|
| `MessagesPage.tsx` | **Refactor** → move existing thread list + conversation into `CommunicationPage` |
| `NotificationCenterPage.tsx` | **Replace** static "Coming Soon" with live data from `/api/v1/notifications` |
| `CommunicationPage.tsx` | **New** — unified inbox combining messages + notifications, tabs, search, filters |
| `NotificationPreferences.tsx` | **New** — preference panel (sidebar/dialog) |
| `PatientLayout.tsx` | Replace "Messages" + "Notifications" nav items with single "Communication" link to `/patient/communication` |
| `App.tsx` | Replace `/patient/messages` and `/patient/notifications` with `/patient/communication` |
| `message-api.ts` | Add notification API methods (`getNotifications`, `markRead`, `getPreferences`, `updatePreferences`) |

### Notification Model

```typescript
interface Notification {
  id: string;
  type: "appointment_reminder" | "medication_reminder" | "timeline_update" 
      | "lab_result" | "document_shared" | "clinic_announcement" | "system";
  title: string;
  body: string;
  status: "unread" | "read" | "dismissed";
  priority: "critical" | "important" | "informational";
  channel: "in_app" | "sms" | "email" | "push";
  actionUrl: string | null;      // Deep link (e.g., /patient/appointments)
  metadata: Record<string, unknown>;
  createdAt: string;
  readAt: string | null;
}
```

### Notification Preferences Model

```typescript
interface NotificationPreferences {
  channels: {
    sms: boolean;       // Default: false
    email: boolean;     // Default: true
    push: boolean;      // Default: false (mobile app future)
    in_app: boolean;    // Default: true
  };
  dailyCap: number;     // Default: 5
  quietHours: {
    enabled: boolean;   // Default: true
    start: string;      // Default: "20:00"
    end: string;        // Default: "08:00"
  };
  pauseNonCritical: boolean;  // Default: false
  typePreferences: Record<string, {
    channel: ("in_app" | "sms" | "email" | "push")[];
    enabled: boolean;
  }>;
  // Default: critical and important types enabled; informational daily digest
}
```

## Rationale

1. **No new platform capability needed** — MessageEngine, MessagePolicy, MessageAudit exist and are PHI-compliant. Notifications build on the same audit log pattern.
2. **Minimal backend change** — 6 new notification routes vs rebuilding the messaging layer. Notification data is ephemeral (not PHI) and stored separately from message content.
3. **Unified frontend, same API** — Single Communication Centre page calls existing message routes + new notification routes. No API breaking changes.
4. **Reuses Document Centre** — Attachments in messages reuse the existing document upload/download engine from Wave 5.
5. **IVF-adaptive** — Notification preferences support phase-aware settings (quiet hours during two-week wait, no suppression during stimulation).

## Consequences

- **Positive**: Single patient entry point for all communication. Consistent UX. No new platform infrastructure.
- **Positive**: Notification preferences reduce fatigue and improve engagement.
- **Positive**: Audit trail exists (MessageAuditLogger) for all communications.
- **Neutral**: Notifications require new D1 table or in-memory store.
- **Neutral**: Existing Messages page URL will redirect to new Communication page.
- **Negative**: Push/SMS/Email notification delivery is designed as integration architecture (hooks) not implemented delivery — actual delivery channels deferred to Wave 7.

## Deferred Decisions

| Item | Reason | Target |
|------|--------|--------|
| Push notification delivery | Requires mobile app or Web Push API | Wave 7 |
| SMS delivery integration | Requires Twilio/SMS provider contract | Wave 7 |
| Email digest delivery | Requires email service (Resend/SendGrid) | Wave 7 |
| Offline message access | Requires service worker caching strategy | Wave 8 |
| i18n / multi-language | Requires translation infrastructure | Wave 8 |
| AI triage / auto-suggest replies | Requires Care Companion integration | Wave 9 |

## References

- `WAVE6_RESEARCH_REPORT.md` — Research evidence
- `workers/src/routes/wave7.ts` — Existing message routes
- `workers/src/platform/messaging/` — Existing MessageEngine
- `artifacts/ags-fertility/src/lib/message-api.ts` — Existing API client
- `artifacts/ags-fertility/src/pages/patient/MessagesPage.tsx` — Existing messages page
- `artifacts/ags-fertility/src/pages/patient/NotificationCenterPage.tsx` — Existing notification page
- ROADMAP.md — Product roadmap
- CHANGELOG.md — Previous wave deliverables