# Wave 7 Engineering Report — Notification & Engagement Platform

**Date:** 2026-08-02
**Product:** AGS Fertility Concierge v1.6.0
**Wave:** 7 — Notification & Engagement Platform
**Status:** ✅ Engineering Complete

---

## Implementation Summary

Wave 7 transforms the Communication Centre's in-memory notification system into a persistent, production-grade engagement platform. All changes are low-risk and build on existing patterns.

---

## Changes Made

### 1. D1 Notification Store (New)

**File:** `workers/src/platform/notifications/d1-notification-store.ts`

Replaces `InMemoryNotificationStore` with a D1-backed persistent store. The in-memory store is retained for development/testing.

**Schema:**
```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  priority TEXT NOT NULL DEFAULT 'informational',
  channel TEXT NOT NULL DEFAULT 'in_app',
  action_url TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_identity ON notifications(identity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);
```

**Key methods:**
- `addNotification(notification)` — persists to D1
- `getNotifications(identityId, options)` — queries D1 with filters
- `markRead(id)` — updates status + read_at
- `markAllRead(identityId)` — bulk update
- `getUnreadCount(identityId)` — count query
- `getPreferences(identityId)` — D1-backed preferences
- `updatePreferences(identityId, updates)` — D1 update
- `seedSampleNotifications(identityId)` — retained for dev/testing

### 2. Delivery Engine (New)

**File:** `workers/src/platform/notifications/delivery-engine.ts`

Multi-channel delivery engine with channel routing and status tracking.

**Key methods:**
- `deliver(notification)` — routes to configured channels
- `trackDelivery(notificationId, channel, status)` — records delivery status
- `retryFailed()` — retries failed deliveries with exponential backoff
- `getDeliveryStatus(notificationId)` — returns per-channel delivery status

**Delivery status tracking:**
```sql
CREATE TABLE IF NOT EXISTS notification_delivery (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL
);
```

### 3. Escalation Engine (New)

**File:** `workers/src/platform/notifications/escalation-engine.ts`

Priority-based escalation engine. Runs on a scheduled check (every 5 minutes).

**Escalation chain:**
- Level 1: Patient (in-app + push) — 5 min (critical), 15 min (important)
- Level 2: Care Coordinator (in-app + email + SMS) — 10 min (critical), 30 min (important)
- Level 3: Physician (all channels) — action required

**Key methods:**
- `checkEscalations()` — scheduled check for overdue critical/important notifications
- `escalate(notification, level)` — routes to next escalation level
- `getEscalationStatus(notificationId)` — returns current escalation state

### 4. Notification Audit (New)

**File:** `workers/src/platform/notifications/notification-audit.ts`

Notification-specific audit logging. Reuses existing audit infrastructure.

**Audit events:**
- `notification.created` — metadata only (no PHI)
- `notification.sent` — channel + status
- `notification.delivered` — channel + status
- `notification.read` — notification ID only
- `notification.dismissed` — notification ID only
- `notification.escalated` — notification ID + level
- `notification.failed` — channel + error code

### 5. Analytics (New)

**File:** `workers/src/platform/notifications/analytics.ts`

Delivery analytics tracking. Computed from audit events.

**Metrics:**
- delivered_count, read_count, dismissed_count, failed_count, escalated_count
- avg_delivery_time, avg_read_time, engagement_rate

**API endpoint:** `GET /api/v1/notifications/analytics` (admin-only)

### 6. SSE Stream (New)

**Route:** `GET /api/v1/notifications/stream`

Server-Sent Events endpoint for real-time notification updates.

**Events:**
- `notification.new` — new notification arrived
- `notification.read` — notification marked as read
- `notification.unread-count` — unread count changed

**Authentication:** JWT token in `Authorization` header
**Timeout:** 30s idle, auto-reconnect

### 7. New API Routes (Wave 7)

Added to `workers/src/routes/wave7.ts`:

| Route | Method | Purpose | Auth |
|-------|--------|---------|------|
| `/api/v1/notifications/stream` | GET | SSE real-time stream | JWT |
| `/api/v1/notifications/delivery-status/:id` | GET | Delivery status for notification | JWT |
| `/api/v1/notifications/analytics` | GET | Delivery analytics | JWT + Admin |
| `/api/v1/notifications/escalation/status` | GET | Escalation status | JWT + Admin |

### 8. Wrangler Configuration Update

**File:** `workers/wrangler.jsonc`

Added D1 notification binding:
```json
{
  "d1_databases": [
    {
      "binding": "NOTIFICATIONS",
      "database_name": "agsynergy-notifications",
      "database_id": "<to-be-configured>"
    }
  ]
}
```

### 9. Environment Type Update

**File:** `workers/src/types/env.ts`

Added D1 notification binding:
```typescript
NOTIFICATIONS: D1Database;
```

### 10. Frontend Updates

**File:** `artifacts/ags-fertility/src/pages/patient/NotificationCenterPage.tsx`

- Replaced category view with actual notification list
- Added filter tabs (All/Unread/By type)
- Added search functionality
- Added batch actions (mark read, dismiss, archive)
- Added live unread badge
- Added pull-to-refresh
- Added empty state

**File:** `artifacts/ags-fertility/src/pages/patient/CommunicationPage.tsx`

- Added real-time notification updates via SSE
- Added delivery status indicators
- Added unread badge on notification tab

**File:** `artifacts/ags-fertility/src/components/patient/PatientLayout.tsx`

- Added notification badge to mobile bottom nav
- Badge shows unread count (persisted across sessions)

---

## D1 Schema Migration

### Migration File

**File:** `workers/migrations/007_notifications.sql`

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  identity_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'unread',
  priority TEXT NOT NULL DEFAULT 'informational',
  channel TEXT NOT NULL DEFAULT 'in_app',
  action_url TEXT,
  metadata TEXT,
  created_at TEXT NOT NULL,
  read_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_notifications_identity ON notifications(identity_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(status);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at);

CREATE TABLE IF NOT EXISTS notification_delivery (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  error TEXT,
  retry_count INTEGER DEFAULT 0,
  last_retry_at TEXT,
  delivered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_delivery_notification ON notification_delivery(notification_id);
CREATE INDEX IF NOT EXISTS idx_delivery_channel ON notification_delivery(channel);

CREATE TABLE IF NOT EXISTS notification_escalation (
  id TEXT PRIMARY KEY,
  notification_id TEXT NOT NULL,
  level INTEGER NOT NULL,
  target_role TEXT NOT NULL,
  triggered_at TEXT NOT NULL,
  resolved_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS notification_analytics (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  channel TEXT NOT NULL,
  delivered_count INTEGER DEFAULT 0,
  read_count INTEGER DEFAULT 0,
  dismissed_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  escalated_count INTEGER DEFAULT 0,
  avg_delivery_time_ms INTEGER DEFAULT 0,
  avg_read_time_ms INTEGER DEFAULT 0,
  engagement_rate REAL DEFAULT 0.0,
  created_at TEXT NOT NULL
);
```

---

## TypeScript Changes

### New Types

```typescript
// workers/src/platform/notifications/delivery-types.ts
export enum DeliveryStatus {
  PENDING = "pending",
  SENT = "sent",
  DELIVERED = "delivered",
  READ = "read",
  FAILED = "failed",
}

export enum EscalationLevel {
  LEVEL_1 = 1,
  LEVEL_2 = 2,
  LEVEL_3 = 3,
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channel: NotificationChannel;
  status: DeliveryStatus;
  error: string | null;
  retryCount: number;
  lastRetryAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface EscalationEvent {
  id: string;
  notificationId: string;
  level: EscalationLevel;
  targetRole: string;
  triggeredAt: string;
  resolvedAt: string | null;
  createdAt: string;
}

export interface NotificationAnalytics {
  date: string;
  notificationType: NotificationType;
  channel: NotificationChannel;
  deliveredCount: number;
  readCount: number;
  dismissedCount: number;
  failedCount: number;
  escalatedCount: number;
  avgDeliveryTimeMs: number;
  avgReadTimeMs: number;
  engagementRate: number;
}
```

---

## Code Quality

- All new files follow existing code patterns and conventions
- TypeScript strict mode compatible
- No `any` casts introduced (proper type guards used)
- Error handling consistent with existing patterns (fail-closed)
- PHI never logged or exposed in audit trails
- All new API routes JWT-guarded
- Admin routes require admin role

---

## Risk Assessment

| Risk | Severity | Mitigation |
|------|----------|-----------|
| D1 migration failure | Medium | In-memory fallback retained; migration is additive |
| SSE connection overload | Low | 30s idle timeout, auto-reconnect |
| Delivery engine external dependency | Medium | Graceful degradation if external service unavailable |
| Analytics table growth | Low | Daily aggregation, 90-day retention policy |
| Escalation false positives | Low | Configurable timeouts, admin override |

---

*Engineering Report for Wave 7 — Notification & Engagement Platform.*
