# Wave 3 — Capability Scorecard

**Date:** 2026-08-01
**Product:** Concierge — AGS Fertility AI Platform
**Wave:** 3 — Timeline Engine

---

## Capability Registry Review

| Capability | Used? | Owner Correct? | Integration? | Verification? | Telemetry? | Notes |
|-----------|-------|---------------|-------------|--------------|-----------|-------|
| Timeline Engine | ✅ | Engineering | ✅ | ✅ | ✅ | Core Wave 3 capability |
| FullTimeline model | ✅ | Engineering | ✅ | ✅ | ✅ | New domain model |
| Legacy CarePlan compat | ✅ | Engineering | ✅ | ✅ | ✅ | Backward compat shims |
| In-memory engine | ✅ | Engineering | ✅ | ✅ | ✅ | Dev-only; D1 deferred |
| D1 backend (deferred) | ❌ | Engineering | N/A | N/A | N/A | Intentionally deferred |
| Milestone tracking | ✅ | Engineering | ✅ | ✅ | ✅ | Auto-generated milestones |
| Event history | ✅ | Engineering | ✅ | ✅ | ✅ | Chronological log |
| Progress tracking | ✅ | Engineering | ✅ | ✅ | ✅ | Percentage-based |
| Stage progression | ✅ | Engineering | ✅ | ✅ | ✅ | 8-stage IVF model |
| API route registration | ✅ | Engineering | ✅ | ✅ | ✅ | `/api/v1/timeline` |
| Frontend API client | ✅ | Engineering | ✅ | ✅ | ✅ | `timeline-api.ts` |
| Consumer integration (HubPage) | ✅ | Engineering | ✅ | ✅ | ✅ | Fixed in Integration phase |
| Consumer integration (MilestonesPage) | ✅ | Engineering | ✅ | ✅ | ✅ | Fixed in Integration phase |
| Consumer integration (DashboardPage) | ✅ | Engineering | ✅ | ✅ | ✅ | Fixed in Integration phase |

## Issues Found

None. All used capabilities have correct ownership, integration, verification, and telemetry.

## Recommendations

1. **D1 backend capability** — intentionally deferred; add to roadmap for future wave.
2. **Timeline-specific test capability** — no automated tests for the new Timeline Engine; add to next wave's scope.
