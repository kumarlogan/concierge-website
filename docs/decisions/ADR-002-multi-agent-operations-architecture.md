# ADR-002: Multi-Agent Operations Architecture

**Status:** Accepted
**Date:** 2026-07-18

---

## Context

AG Synergy requires separate AI interfaces for two distinct audiences:

- **Owner / technical administration** — infrastructure management, documentation workflows, deployment assistance, architecture support, system monitoring. This is highly privileged and must be restricted to the platform owner.
- **Business operations** — authorized team members who view leads, manage lead status, add operational notes, view follow-ups, and generate daily summaries. This must be restricted from any infrastructure, secret, or deployment capability.

A single undifferentiated assistant cannot safely serve both: the operations audience must be hard-separated from owner-level power, and the system must remain securable, auditable, and future-extensible (dashboard, mobile, partner portals).

---

## Decision

1. **Two separate Telegram interfaces** will be built:
   - **Hermes Admin Assistant** — owner-only, technical operations.
   - **Operations Assistant Bot** — authorized team members, business operations only.
2. **Both communicate exclusively through the Workers API** (`/api/v1/ops/*` and related endpoints). They are thin clients — they translate user intent into API calls and render API responses.
3. **No AI agent directly accesses D1.** All database reads/writes occur inside the Workers API, behind a shared **Authorization Middleware** that enforces RBAC and writes audit logs. Bots hold no D1 binding and no database credentials.

This decision is consistent with and builds upon ADR-001 (Cloudflare-only backend: Workers + D1).

---

## Reasons

| Factor | Detail |
|---|---|
| Security boundaries | Separate bot identities + scoped API tokens let the Operations Bot be physically unable to reach admin/deploy/secrets endpoints |
| API-first reuse | Because bots are just API clients, the same endpoints serve a future dashboard, mobile app, and partner portal without rework |
| Auditability | A single chokepoint (Authorization Middleware) means every privileged action is authenticated, authorized, and logged in one place |
| Failure containment | If a bot process is compromised, it can only call the scoped endpoints its token permits — blast radius is bounded |

---

## Consequences

### Positive
- **Improved security boundaries** — clear separation between owner and operations authority; defense-in-depth via RBAC guard + scoped token + process isolation.
- **Future dashboard/mobile compatibility** — all capabilities are exposed as API-first designs, so Telegram is the first interface, not the final one.
- **Consistent architecture** — aligns with ADR-001; no new backend technology introduced.

### Negative
- **Additional authorization complexity** — every action must flow through the Authorization Middleware; RBAC, `user_permissions`, and human-approval gates must be implemented and tested before any bot delivers value.
- **Indirect data access** — bots cannot query D1 directly, so all operational reads/writes require corresponding API endpoints to exist first (API surface precedes bot surface).

---

## Related Decisions
- **ADR-001** — Cloudflare migration (Workers + D1 backend). This ADR extends that foundation with the multi-agent operations model.

## Supersedes
*None.*

## Superseded By
*None.*
