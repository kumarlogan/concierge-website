# Wave 7 Release Notes — Notification & Engagement Platform

**Version:** 1.6.0
**Date:** 2026-08-02
**Product:** AGS Fertility Concierge
**Wave:** 7 — Notification & Engagement Platform

---

## What's New

### Persistent Notification Store
- Notifications now persist in D1 database, replacing the in-memory store
- Notifications survive browser refreshes and server restarts
- New `NOTIFICATIONS` D1 binding added to all environments

### Multi-Channel Delivery Engine
- Supports in-app, SMS, email, and push notification channels
- Delivery status tracking: pending → sent → delivered → read/failed
- Per-channel delivery status visible in Communication Centre

### Escalation System
- Priority-based escalation: patient → coordinator → physician
- Configurable escalation levels and timeouts
- Escalation status tracked in D1 with audit trail

### Notification Audit Trail
- Every notification lifecycle event is logged (created, delivered, read, escalated)
- Audit records include timestamp, actor, and correlation ID
- Supports compliance and debugging workflows

### Analytics Dashboard
- Delivery, read, and engagement rates by notification type
- Channel performance breakdown
- Escalation frequency and response time metrics

### Real-Time Updates (SSE)
- Notification stream via Server-Sent Events
- Live unread count updates
- New notification alerts without page refresh

### Notification Center (Frontend)
- Persistent notification list with filters by type
- Full-text search across titles and bodies
- Batch mark-as-read and batch dismiss actions
- Priority indicators (critical/important/informational)
- Time-ago formatting for notification timestamps

### Communication Centre Updates
- Delivery status indicators on messages (pending/sent/delivered/read/failed)
- SSE integration for real-time message updates
- Notification badge on mobile bottom navigation

## Configuration Changes

### wrangler.jsonc
- Added `NOTIFICATIONS` D1 database binding (all environments)
- Added `TURNSTILE_SECRET_KEY` to all environment vars (Operational Fix 001)

### env.ts
- Added `NOTIFICATIONS: D1Database` to `Env` interface

### deploy.yml
- Added `TURNSTILE_SECRET_KEY` to secret injection (preview/production)

## API Changes

### New Endpoints
- `GET /api/v1/notifications/stream` — SSE notification stream
- `GET /api/v1/notifications/delivery-status/:id` — Delivery status for a notification
- `GET /api/v1/notifications/analytics/:date` — Analytics for a specific date
- `GET /api/v1/notifications/escalation-status` — Active escalation queue
- `GET /api/v1/notifications/preferences/:identityId` — User notification preferences
- `PUT /api/v1/notifications/preferences/:identityId` — Update preferences

### Modified Endpoints
- `GET /api/v1/notifications` — Now queries D1 (was in-memory only)
- `GET /api/v1/notifications/unread-count` — Now queries D1

## Database Migrations

- `migrations/011_notifications.sql` — Creates 5 new D1 tables:
  - `notifications` — Persistent notification records
  - `notification_delivery` — Per-channel delivery tracking
  - `notification_escalation` — Escalation chain tracking
  - `notification_analytics` — Aggregated delivery metrics
  - `notification_preferences` — Per-identity notification preferences

## Breaking Changes

None. The in-memory store is preserved as a fallback when D1 is not configured.

## Migration Notes

1. Run `migrations/011_notifications.sql` against the `NOTIFICATIONS` D1 database
2. Configure the `NOTIFICATIONS` D1 binding in wrangler.jsonc for each environment
3. Deploy the updated workers
4. Existing in-memory notifications are not migrated (they are ephemeral by design)

## Rollback

To rollback Wave 7 changes:
1. Revert `workers/src/routes/wave7.ts` to previous version
2. Revert `workers/src/types/env.ts` to previous version
3. Revert `workers/wrangler.jsonc` to previous version
4. Revert `workers/src/index.ts` to previous version
5. Drop the `notifications` D1 tables if needed

## Testing

- All 774 existing tests pass (no regressions)
- 4 new test files added for Wave 7 modules
- TypeScript compilation clean (no new errors)
- Import integrity check passed (422 files, 0 errors)