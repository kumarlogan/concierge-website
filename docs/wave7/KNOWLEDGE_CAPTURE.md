# Wave 7 Knowledge Capture — Notification & Engagement Platform

**Date:** 2026-08-02
**Product:** AGS Fertility Concierge v1.6.0
**Wave:** 7 — Notification & Engagement Platform

---

## Key Learnings

### 1. D1 vs In-Memory Store Trade-offs
- The existing in-memory store was sufficient for Wave 6's real-time features but lacked persistence
- Wave 7's D1 store provides persistence across server restarts and browser refreshes
- The in-memory store is kept as a fallback when D1 is not configured, ensuring backward compatibility
- D1 requires a separate binding per environment; all 3 environments (development, preview, production) need the `NOTIFICATIONS` binding

### 2. SSE for Real-Time Notifications
- Server-Sent Events provide a lightweight alternative to WebSockets for notification streaming
- Works well with Cloudflare Workers' streaming response API
- Falls back gracefully to polling when SSE is not available
- The `EventSource` API in the browser handles reconnection automatically

### 3. Multi-Channel Delivery Architecture
- The delivery engine decouples notification creation from delivery
- Each channel (in_app, sms, email, push) is an independent delivery attempt
- Delivery status tracking enables users to see exactly where a notification is in its lifecycle
- The escalation engine uses delivery status to trigger escalation when notifications fail

### 4. Escalation Patterns in Healthcare
- Healthcare notifications require guaranteed delivery — missed notifications can impact patient care
- The 3-tier escalation chain (patient → coordinator → physician) mirrors clinical workflows
- Escalation timeouts should be configurable per notification type
- Audit trail is critical for healthcare compliance

### 5. Frontend Notification Patterns
- The notification center needs filters, search, and batch actions to be usable at scale
- Real-time updates via SSE prevent notification staleness
- The notification badge on the mobile nav provides quick access to unread items
- Delivery status indicators build trust in the system's reliability

## Architecture Decisions

| Decision | Rationale |
|---|---|
| D1 for persistence | Native Cloudflare D1 integration; no external DB needed |
| SSE for real-time | Lightweight, works with Workers, auto-reconnects |
| In-memory fallback | Backward compatibility when D1 is not configured |
| 3-tier escalation | Mirrors clinical workflows (patient → coordinator → physician) |
| Per-channel delivery tracking | Enables granular status visibility and retry logic |
| Audit logging for all events | Healthcare compliance requires full traceability |

## Patterns to Reuse

- **D1 Store pattern**: The `D1NotificationStore` class pattern can be reused for other D1-backed entities
- **Delivery engine pattern**: The `DeliveryEngine` with channel-specific handlers can be extended for new channels
- **Escalation engine pattern**: The `EscalationEngine` with configurable rules can be adapted for other escalation scenarios
- **SSE stream pattern**: The `GET /notifications/stream` endpoint pattern can be reused for other real-time data streams

## Patterns to Avoid

- **Direct D1 queries from frontend**: Always go through the Workers API route layer
- **Storing secrets in code**: TURNSTILE_SECRET_KEY is injected via wrangler.jsonc vars and deploy.yml secrets
- **Blocking escalation on delivery failure**: Escalation should be async and non-blocking
- **Over-notification**: Respect user preferences and quiet hours

## Open Questions for Future Waves

1. Should notification preferences support per-type channel preferences (e.g., appointment reminders via SMS, lab results via email)?
2. Should the analytics engine aggregate data in D1 or compute on-read?
3. Should the escalation engine support manual override by administrators?
4. Should notification templates be configurable via the admin dashboard?
5. Should there be a notification digest/summary feature (batching multiple notifications into one)?

## Dependencies

- D1 database binding (`NOTIFICATIONS`)
- Cloudflare Workers runtime
- React 18+ (frontend)
- Vite (frontend build)

## Testing Strategy

- Unit tests for each module (D1 store, delivery engine, escalation engine, audit, analytics)
- Integration tests for the API routes
- Manual verification of SSE stream and delivery status indicators
- Regression test suite (774 tests, all passing)