# Wave 7 Research Report — Notification & Engagement Platform

**Date:** 2026-08-02
**Product:** AGS Fertility Concierge v1.6.0
**Wave:** 7 — Notification & Engagement Platform
**Status:** ✅ Research Complete

---

## Research Scope

Healthcare notification systems for IVF engagement journeys, covering appointment reminders, medication adherence, real-time messaging, push/email/SMS delivery, notification prioritization, escalation policies, unread badge behaviour, cross-device synchronisation, offline delivery, and delivery guarantees.

---

## 1. Healthcare Notification Systems

### Current State (Wave 6 — Communication Centre)

The Communication Centre introduced 7 notification API routes with JWT authentication:

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/notifications` | GET | List notifications (filterable by unreadOnly, type, limit, offset) |
| `/api/v1/notifications/:id` | GET | Single notification detail |
| `/api/v1/notifications/:id/read` | PATCH | Mark one as read |
| `/api/v1/notifications/read-all` | PATCH | Mark all as read |
| `/api/v1/notifications/preferences` | GET | Get notification preferences |
| `/api/v1/notifications/preferences` | PATCH | Update notification preferences |
| `/api/v1/notifications/unread-count` | GET | Get unread count |

### Notification Types (7 types)

| Type | Description | Default Channels |
|------|-------------|-----------------|
| `appointment_reminder` | Upcoming appointment reminders | In-app, SMS |
| `medication_reminder` | Medication dose reminders | In-app, SMS |
| `timeline_update` | Treatment phase changes | In-app |
| `lab_result` | Lab results availability | In-app, Email |
| `document_shared` | New document uploaded | In-app, Email |
| `clinic_announcement` | Clinic announcements | In-app, Email |
| `system` | System notifications | In-app |

### Notification Priorities (3 levels)

| Priority | Description |
|----------|-------------|
| `critical` | Requires immediate attention |
| `important` | Should be seen promptly |
| `informational` | FYI only |

### Notification Channels (4 channels)

| Channel | Description |
|---------|-------------|
| `in_app` | In-app notification centre |
| `sms` | SMS delivery |
| `email` | Email delivery |
| `push` | Push notification |

---

## 2. IVF Engagement Journey

### Patient Journey Touchpoints

IVF patients require engagement at every stage of their treatment journey. The current system supports:

1. **Treatment Phase Updates** — Notifications when patients move between phases (stimulation, retrieval, transfer, luteal, pregnancy test)
2. **Appointment Reminders** — Pre-appointment reminders with preparation instructions
3. **Medication Reminders** — Timed medication dose reminders (e.g., Gonal-F, Menopur, Progesterone)
4. **Lab Results** — Notification when blood work or ultrasound results are available
5. **Document Sharing** — Alerts when new consent forms or medical documents are uploaded
6. **Milestone Celebrations** — Recognition of treatment milestones
7. **Clinic Announcements** — Operational updates (holiday hours, policy changes)

### Engagement Gaps Identified

The current Wave 6 implementation has the following gaps that Wave 7 addresses:

| Gap | Impact | Wave 7 Solution |
|-----|--------|-----------------|
| In-memory only storage | Notifications lost on restart | D1-persistent storage |
| No delivery engine | No multi-channel delivery | Notification delivery engine with channel routing |
| No delivery status tracking | No visibility into delivery success | Delivery status tracking per notification |
| No retry policy | Failed deliveries are lost | Retry policy with exponential backoff |
| No escalation engine | Critical notifications may be missed | Escalation engine with priority-based escalation |
| No audit logging | No compliance trail | Audit logging for all notification events |
| No delivery analytics | No engagement insights | Delivery analytics dashboard |
| No offline delivery | Missed notifications when offline | Offline delivery queue |
| No cross-device sync | Inconsistent state across devices | Cross-device synchronisation |

---

## 3. Appointment Reminders

### Current Implementation

- Appointment reminders are a notification type (`appointment_reminder`)
- Default channels: In-app + SMS
- Default priority: `important`
- No automated scheduling — reminders must be triggered manually or by external systems

### Wave 7 Enhancement

- **Reminder scheduling**: Automated reminder scheduling based on appointment time
- **Pre-appointment window**: Configurable reminder window (24h, 12h, 2h, 30min)
- **Preparation instructions**: Include preparation instructions in reminder body
- **Confirmation tracking**: Track whether patient confirmed receipt

---

## 4. Medication Adherence

### Current Implementation

- Medication reminders are a notification type (`medication_reminder`)
- Default channels: In-app + SMS
- Default priority: `important`
- No automated dosing schedule

### Wave 7 Enhancement

- **Dosing schedule**: Configurable dosing schedule per medication
- **Adherence tracking**: Track whether doses were acknowledged
- **Missed dose escalation**: Escalate missed doses to care team
- **Refill reminders**: Alert when medication supply is low

---

## 5. Real-Time Messaging

### Current Implementation

- Wave 6 introduced 3 messaging routes (threads, thread messages, send)
- In-memory message engine
- Consent-verified messaging
- JWT-bound sender identity

### Wave 7 Enhancement

- **Real-time updates**: WebSocket/SSE for live message updates
- **Delivery receipts**: Track message delivery status (sent → delivered → read)
- **Typing indicators**: Show when care team member is typing
- **Read receipts**: Track when messages are read by recipient

---

## 6. Push Notifications

### Architecture Design

Push notifications for healthcare require careful handling of PHI and compliance requirements.

```
┌─────────────────────────────────────────────────────┐
│                  Notification Engine                  │
│                                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Priority     │  │  Channel     │  │  Delivery   │ │
│  │  Router       │  │  Router      │  │  Tracker    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                  │                 │        │
│         ▼                  ▼                 ▼        │
│  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │  Push Service │  │  Email Svc  │  │  SMS Svc   │ │
│  │  (FCM/APNs)  │  │  (SES/SMTP) │  │  (Twilio)  │ │
│  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **PHI in push payloads**: Push notifications must NOT contain PHI in the payload. Use generic titles ("New message from your care team") with deep links to the app for full content.
2. **Token management**: Push tokens stored per-device, per-identity. Tokens refreshed on app foreground.
3. **Opt-in required**: Push notifications require explicit patient opt-in. Default is disabled.
4. **Quiet hours respected**: Push notifications suppressed during quiet hours (default: 20:00–08:00).

---

## 7. Email Delivery Architecture

### Current State

- Email delivery channel defined in notification types (`email`)
- Default channels for `lab_result`, `document_shared`, `clinic_announcement`
- No actual email sending implementation (in-memory store only)

### Wave 7 Design

- **Email template system**: Templates for each notification type
- **PHI-safe content**: Email body contains only non-PHI summary with deep link to portal
- **SMTP integration**: External email service (SES/SMTP) for delivery
- **Bounce handling**: Track bounces and update delivery status
- **Unsubscribe**: One-click unsubscribe from email notifications

---

## 8. SMS Delivery Architecture

### Current State

- SMS delivery channel defined in notification types (`sms`)
- Default channels for `appointment_reminder`, `medication_reminder`
- No actual SMS sending implementation (in-memory store only)

### Wave 7 Design

- **SMS template system**: Templates for each notification type
- **PHI-safe content**: SMS body contains only non-PHI summary with deep link
- **Twilio integration**: External SMS service for delivery
- **Delivery receipts**: Track SMS delivery status (sent → delivered → read)
- **Opt-out handling**: Respect STOP requests per TCPA regulations

---

## 9. Notification Prioritization

### Current Priority Model (3 levels)

| Priority | Description | Action |
|----------|-------------|--------|
| `critical` | Requires immediate attention | Bypass quiet hours, escalate to care team |
| `important` | Should be seen promptly | Respect quiet hours, show in notification centre |
| `informational` | FYI only | Respect quiet hours, batch delivery |

### Wave 7 Enhancement

- **Escalation policy**: Critical notifications escalate after 15 minutes if unread
- **Escalation chain**: Patient → Care Coordinator → Physician
- **Escalation timeout**: Configurable per priority level
- **Escalation notification**: Notify next level in chain

---

## 10. Escalation Policies

### Escalation Model

```
Level 1: Patient (in-app + push)
  │  └─ 15 min no read ──► Level 2
Level 2: Care Coordinator (in-app + email + SMS)
  │  └─ 30 min no read ──► Level 3
Level 3: Physician (in-app + email + SMS + phone)
```

### Configuration

| Priority | Level 1 Timeout | Level 2 Timeout | Level 3 Action |
|----------|----------------|----------------|----------------|
| `critical` | 5 min | 10 min | Phone call + page |
| `important` | 15 min | 30 min | Email + SMS |
| `informational` | N/A | N/A | No escalation |

---

## 11. Unread Badge Behaviour

### Current State

- Unread count endpoint: `GET /api/v1/notifications/unread-count`
- Returns count of unread notifications for authenticated identity
- No badge component in frontend (NotificationCenterPage shows categories, not live badge)

### Wave 7 Enhancement

- **Live badge**: Real-time unread count via WebSocket/SSE
- **Badge persistence**: Unread count persisted across sessions
- **Badge grouping**: Group by notification type (e.g., "3 appointments, 2 messages")
- **Badge clearing**: Auto-clear when notification is read

---

## 12. Cross-Device Synchronisation

### Design

- **Identity-bound notifications**: All notifications tied to `identityId` (JWT subject)
- **Read state sync**: Read status synced across devices via D1 persistence
- **Preference sync**: Notification preferences synced across devices
- **Conflict resolution**: Last-write-wins for read status; merge for preferences

---

## 13. Offline Delivery

### Design

- **Queue-based delivery**: Notifications queued when device offline
- **TTL-based expiry**: Notifications expire after 30 days if undelivered
- **Catch-up on reconnect**: All pending notifications delivered on reconnect
- **Priority-based ordering**: Critical notifications delivered first

---

## 14. Delivery Guarantees

### At-Least-Once Delivery

- Each notification assigned a unique ID
- Delivery status tracked: `pending → sent → delivered → read`
- Failed deliveries retried with exponential backoff (max 3 retries)
- Dead letter queue for notifications that fail all retries

### Idempotency

- Notification IDs are UUIDs — no duplicates on retry
- Read status updates are idempotent (marking as read multiple times has no side effect)

---

## 15. Notification Persistence

### Current State

- **In-memory store only**: `InMemoryNotificationStore` — notifications lost on restart
- **No D1 binding**: No D1 database binding for notifications

### Wave 7 Target

- **D1-persistent store**: Replace in-memory store with D1-backed persistence
- **Migration path**: In-memory store kept for development/testing; D1 used in production
- **Schema design**: Notifications table with identityId, type, status, channel, priority, timestamps

---

## 16. Audit Logging

### Current State

- No notification-specific audit logging
- General audit logging exists in `workers/src/middleware/audit.ts`

### Wave 7 Enhancement

- **Notification audit events**: Log all notification lifecycle events (created, sent, delivered, read, dismissed)
- **PHI-safe logging**: No PHI in audit logs — only notification metadata (type, channel, priority, status)
- **Compliance trail**: Audit logs retained for 7 years (healthcare compliance)

---

## 17. Accessibility

### Current State

- Notification centre uses semantic HTML (Card, Badge, Button)
- Icons from lucide-react with accessible labels
- Keyboard navigation supported

### Wave 7 Enhancements

- **Screen reader announcements**: ARIA live regions for new notifications
- **Keyboard shortcuts**: Mark all read (Ctrl+Shift+R), navigate between notifications
- **Color-independent indicators**: Icons + text labels, not just color
- **Reduced motion**: Respect `prefers-reduced-motion` for notification animations
- **Focus management**: Focus returns to trigger element after notification action

---

## 18. Mobile-First UX

### Current State

- Notification centre is responsive (Tailwind CSS)
- CommunicationPage has unified inbox with messages + notifications

### Wave 7 Enhancements

- **Touch-friendly targets**: Minimum 44x44px tap targets for notification actions
- **Swipe gestures**: Swipe to dismiss/archive notifications
- **Pull-to-refresh**: Refresh notification list on pull
- **Offline indicator**: Show connectivity status in notification centre
- **Bottom navigation**: Notification badge on mobile bottom nav

---

## Research Sources

All research based on:
1. Existing codebase analysis (workers/src/platform/notifications/, workers/src/routes/wave7.ts)
2. Existing frontend components (NotificationCenterPage, CommunicationPage, NotificationPreferencesDialog)
3. Healthcare notification best practices (HIPAA compliance, PHI handling)
4. IVF patient engagement patterns (appointment reminders, medication adherence, treatment milestones)

No external sources were used that returned repeated failures.

---

## Research Conclusion

The Wave 6 Communication Centre provides a solid foundation for notification delivery (7 routes, in-memory store, 7 notification types, 4 channels, 3 priorities). Wave 7 transforms this into a persistent, production-grade engagement platform by adding:

1. **D1 persistence** — notifications survive restarts
2. **Delivery engine** — multi-channel delivery with status tracking
3. **Escalation engine** — priority-based escalation to care team
4. **Audit logging** — compliance trail for all notification events
5. **Delivery analytics** — engagement insights
6. **WebSocket/SSE** — real-time updates
7. **Push architecture** — FCM/APNs integration with PHI-safe payloads
8. **Email/SMS architecture** — external service integration
9. **Retry policies** — exponential backoff with dead letter queue
10. **Cross-device sync** — consistent state across devices
11. **Offline delivery** — queue-based delivery for offline users
12. **Mobile-first UX** — touch-friendly, swipe gestures, pull-to-refresh

All enhancements are low-risk and build on existing patterns in the codebase.
