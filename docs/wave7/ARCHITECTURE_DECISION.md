# Wave 7 Architecture Decision — Notification & Engagement Platform

**Date:** 2026-08-02
**Product:** AGS Fertility Concierge v1.6.0
**Wave:** 7 — Notification & Engagement Platform
**Status:** ✅ Decision Recorded

---

## ADR-007: Notification Persistence — D1-Backed Store

### Context

Wave 6 introduced an in-memory notification store (`InMemoryNotificationStore`). Notifications are lost on worker restart, which is unacceptable for a healthcare engagement platform where missed notifications could delay patient care.

### Decision

Replace the in-memory notification store with a D1-backed persistent store. The in-memory store is retained for development/testing environments.

### Alternatives Considered

| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| Keep in-memory | Simple, no schema changes | Data lost on restart | Unacceptable for healthcare |
| Redis/KV | Fast, persistent | Additional cost, complexity | D1 already available and bound |
| D1 (chosen) | Already bound, serverless, SQL queryable | Slight latency vs in-memory | Best fit for existing infra |

### Implementation

- New file: `workers/src/platform/notifications/d1-notification-store.ts`
- D1 table: `notifications` with columns: `id`, `identity_id`, `type`, `title`, `body`, `status`, `priority`, `channel`, `action_url`, `metadata`, `created_at`, `read_at`
- New file: `workers/src/platform/notifications/d1-notification-store.test.ts`
- In-memory store kept for dev/testing (guarded by `ENVIRONMENT !== "production"`)

### Consequences

- Notifications persist across worker restarts
- SQL queries enable analytics and audit trails
- Slight latency increase vs in-memory (acceptable for notification delivery)
- D1 read/write capacity must be monitored

---

## ADR-008: Notification Delivery Engine — Multi-Channel Router

### Context

Wave 6 defines notification channels (in_app, sms, email, push) but has no actual delivery mechanism. Notifications are stored and retrieved but never sent via external channels.

### Decision

Implement a notification delivery engine with channel routing. Each notification is routed to its configured channels. Delivery status is tracked per notification per channel.

### Architecture

```
Notification Created
        │
        ▼
┌─────────────────┐
│ Delivery Router  │ ── Routes to configured channels
└────────┬────────┘
         │
         ├──► In-App (immediate, via API)
         ├──► Push (FCM/APNs, async)
         ├──► Email (SES/SMTP, async)
         └──► SMS (Twilio, async)
         │
         ▼
┌─────────────────┐
│ Delivery Tracker │ ── Records status per channel
└─────────────────┘
```

### Key Design Decisions

1. **PHI-safe payloads**: Push/email/SMS payloads contain no PHI. Only generic titles with deep links to the portal.
2. **Async delivery**: External channels (push, email, SMS) are async — notification is stored immediately, delivery happens in background.
3. **Delivery status tracking**: Each channel gets its own delivery status: `pending → sent → delivered → read/failed`.
4. **Retry policy**: Failed deliveries retry with exponential backoff (1min, 5min, 15min, 1hr). Max 3 retries.
5. **Dead letter queue**: Notifications that fail all retries are moved to a dead letter table for manual review.

### Implementation

- New file: `workers/src/platform/notifications/delivery-engine.ts`
- New file: `workers/src/platform/notifications/delivery-types.ts`
- New file: `workers/src/platform/notifications/delivery-engine.test.ts`

### Consequences

- Multi-channel delivery capability added
- Delivery status visible in notification centre
- Failed deliveries retried automatically
- External service dependencies (FCM, SES, Twilio) required for production

---

## ADR-009: Real-Time Updates — WebSocket/SSE

### Context

Wave 6 notification routes are request-response (polling). Patients and care teams need real-time updates when new notifications arrive or read status changes.

### Decision

Implement Server-Sent Events (SSE) for notification updates. SSE is simpler than WebSocket for one-way server-to-client updates and works over HTTP/1.1 without special infrastructure.

### Alternatives Considered

| Alternative | Pros | Cons | Rejected Because |
|-------------|------|------|------------------|
| WebSocket | Full duplex | Complex, requires connection management | Overkill for notification updates |
| SSE (chosen) | Simple, HTTP-based, auto-reconnect | One-way only | Best fit for notification push |
| Polling | Simple | Wasteful, latency | Already in use, inefficient |

### Implementation

- New route: `GET /api/v1/notifications/stream` — SSE endpoint
- SSE events: `notification.new`, `notification.read`, `notification.unread-count`
- Connection timeout: 30s idle, auto-reconnect
- Authentication: JWT token in `Authorization` header

### Consequences

- Real-time notification updates without polling
- Reduced server load vs polling
- SSE connection management adds complexity to worker lifecycle

---

## ADR-010: Escalation Engine — Priority-Based Escalation

### Context

Critical notifications (e.g., lab results requiring immediate action) may be missed if patients don't check the notification centre promptly. An escalation mechanism ensures critical notifications reach the care team.

### Decision

Implement an escalation engine that triggers after configurable timeouts per priority level. Escalation routes notifications to the next level in the care chain.

### Escalation Chain

```
Level 1: Patient (in-app + push) — 5 min (critical), 15 min (important)
  │  └─ timeout ──► Level 2
Level 2: Care Coordinator (in-app + email + SMS) — 10 min (critical), 30 min (important)
  │  └─ timeout ──► Level 3
Level 3: Physician (in-app + email + SMS + phone) — action required
```

### Implementation

- New file: `workers/src/platform/notifications/escalation-engine.ts`
- New file: `workers/src/platform/notifications/escalation-types.ts`
- Escalation checks run on a scheduled D1 query (every 5 minutes)
- Escalation events logged to audit trail

### Consequences

- Critical notifications reach care team even if patient doesn't respond
- Care team workload increases for critical notifications
- Requires care team contact information in the system

---

## ADR-011: Notification Audit Logging

### Context

Healthcare compliance requires audit trails for all notification events. The current system has general audit logging but no notification-specific events.

### Decision

Add notification-specific audit events for all lifecycle stages: created, sent, delivered, read, dismissed, escalated, failed.

### Audit Events

| Event | Description | PHI in Log |
|-------|-------------|------------|
| `notification.created` | Notification created | No (metadata only) |
| `notification.sent` | Notification sent to channel | No (channel + status only) |
| `notification.delivered` | Channel reports delivery | No (channel + status only) |
| `notification.read` | Patient read notification | No (notification ID only) |
| `notification.dismissed` | Patient dismissed notification | No (notification ID only) |
| `notification.escalated` | Escalation triggered | No (notification ID + level only) |
| `notification.failed` | Delivery failed | No (channel + error code only) |

### Implementation

- New file: `workers/src/platform/notifications/notification-audit.ts`
- Reuses existing audit infrastructure (`workers/src/middleware/audit.ts`)
- Audit events written to D1 `audit_log` table

### Consequences

- Full compliance trail for notification events
- No PHI exposure in audit logs
- Audit table size grows over time (7-year retention policy)

---

## ADR-012: Delivery Analytics

### Context

The platform needs visibility into notification delivery and engagement to improve patient communication.

### Decision

Implement delivery analytics tracking per notification type, channel, and time period. Analytics are computed from audit events and stored in a D1 analytics table.

### Metrics Tracked

| Metric | Description |
|--------|-------------|
| `delivered_count` | Notifications successfully delivered |
| `read_count` | Notifications read by patients |
| `dismissed_count` | Notifications dismissed without reading |
| `failed_count` | Notifications that failed delivery |
| `escalated_count` | Notifications that triggered escalation |
| `avg_delivery_time` | Average time from creation to delivery |
| `avg_read_time` | Average time from delivery to read |
| `engagement_rate` | read_count / delivered_count |

### Implementation

- New file: `workers/src/platform/notifications/analytics.ts`
- New D1 table: `notification_analytics`
- Analytics computed daily via scheduled D1 query
- API endpoint: `GET /api/v1/notifications/analytics` (admin-only)

### Consequences

- Data-driven insights into notification effectiveness
- Admin-only access to analytics
- Additional D1 storage for analytics table

---

## Architecture Summary

### New Files (Wave 7)

| File | Purpose |
|------|---------|
| `workers/src/platform/notifications/d1-notification-store.ts` | D1-backed persistent notification store |
| `workers/src/platform/notifications/delivery-engine.ts` | Multi-channel delivery engine |
| `workers/src/platform/notifications/delivery-types.ts` | Delivery status types |
| `workers/src/platform/notifications/escalation-engine.ts` | Priority-based escalation engine |
| `workers/src/platform/notifications/escalation-types.ts` | Escalation configuration types |
| `workers/src/platform/notifications/notification-audit.ts` | Notification-specific audit logging |
| `workers/src/platform/notifications/analytics.ts` | Delivery analytics |
| `workers/src/platform/notifications/types.ts` | Consolidated notification types (extended) |

### Modified Files (Wave 7)

| File | Change |
|------|--------|
| `workers/src/types/env.ts` | Add D1 notification binding |
| `workers/src/routes/wave7.ts` | Add delivery, escalation, analytics routes |
| `workers/wrangler.jsonc` | Add D1 notification binding |

### New D1 Tables (Wave 7)

| Table | Purpose |
|-------|---------|
| `notifications` | Persistent notification storage |
| `notification_delivery` | Per-channel delivery status tracking |
| `notification_escalation` | Escalation event tracking |
| `notification_analytics` | Daily analytics aggregation |

### New API Routes (Wave 7)

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/v1/notifications/stream` | GET | SSE real-time notification stream |
| `/api/v1/notifications/delivery-status` | GET | Get delivery status for a notification |
| `/api/v1/notifications/analytics` | GET | Get delivery analytics (admin) |
| `/api/v1/notifications/escalation/status` | GET | Get escalation status (admin) |

---

*Architecture decisions recorded for Wave 7 — Notification & Engagement Platform.*
