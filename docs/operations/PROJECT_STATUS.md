# AG Synergy Platform Status

> Operational overview — current state, capabilities, limitations, and next steps.
> For new AI sessions / developers landing in the repo. Read this first.
>
> **Last updated:** 2026-07-18

---

## Current Phase

| Detail | Value |
|---|---|
| **Phase** | Phase 1 — Digital Concierge Platform |
| **Epic** | EPIC-002 — Operations Platform Foundation (RBAC + Ops API) |
| **Status** | 🚧 In Progress — Ops API Foundation (EPIC-002-003A) |
| **Completed** | 2026-07-18 (Epic 1 + RBAC engine) |

---

## Production Capabilities

| Capability | Status | Detail |
|---|---|---|
| Public website | ✅ Live | `agsynergy.ca` — Cloudflare Pages + React 18 |
| Consultation form | ✅ Live | Submits to Worker API; validated + persisted to D1 |
| Worker API | ✅ Live | `agsynergy-api.kumarlogan.workers.dev` — REST at `/api/v1/` |
| D1 storage | ✅ Live | 6 tables, 14 indexes, forward-only migrations |
| Input validation | ✅ Live | 4 required fields + email format + length caps + whitespace trim |
| Duplicate protection | ✅ Live | Email-based duplicate detection; returns `409 Conflict` |
| Automated notifications | ❌ | Not yet implemented |
| Patient portal | ❌ | Phase 2 |
| Authentication | ❌ | Phase 2 (RBAC engine + `/me` bootstrap live; no login flow yet) |

---

## Infrastructure

| Layer | Technology | Status |
|---|---|---|
| **Frontend** | Cloudflare Pages + React 18 + Vite 7 + Tailwind CSS 4 | ✅ Deployed |
| **Backend** | Cloudflare Workers (TypeScript) | ✅ Deployed |
| **Database** | Cloudflare D1 (`agsynergy-db`) | ✅ Deployed |
| **Object Storage** | Cloudflare R2 | Configured (not yet active) |
| **Source Control** | GitHub (`kumarlogan`) | ✅ Active |
| **CI/CD** | GitHub Actions + wrangler v4 | ✅ Active |
| **AI Operations** | Hermes Agent + Telegram | ✅ Active |
| **Package Manager** | pnpm 11.13.1 | ✅ Active |

---

## Current Architecture

```
Visitor
  │
  ▼
Website (agsynergy.ca)
  │  consultation form → POST /api/v1/consultations
  ▼
Worker API (agsynergy-api.kumarlogan.workers.dev)
  │  validate → normalize → duplicate check → insert
  ▼
D1 (agsynergy-db)
  │  leads table
  ▼
Operational workflow (manual review via Telegram / Hermes)
```

---

## Completed Epics

### Epic 1 — Backend Foundation

**Delivered:** Working Cloudflare Workers API connected to D1. Consultation workflow end-to-end: form submission → validation → persistence → duplicate detection. 74 tests. Full documentation suite.

**Key artifacts:**
- Zero-dependency `URLPattern`-based API router
- Health endpoint: `GET /api/v1/health`
- Consultation endpoint: `POST /api/v1/consultations`
- 6-table D1 schema with forward-only migrations
- Frontend integration + E2E verification
- Deployment runbook + API reference + sprint retrospective

---

## Current Limitations

- ❌ No patient portal or dashboard
- ❌ No authentication / user accounts
- ❌ No clinic portal or dashboards
- ❌ No automated Telegram notifications on submission
- ❌ No operational dashboard for lead review
- ❌ No payment processing
- ❌ No medical records / PHI storage
- ❌ No advanced analytics

All above are explicitly out of scope for Phase 1. See Phase roadmap below.

---

## Next Planned Epic

### Epic 2 — Patient Management System

**Phase 2 target.** Core capability: authenticated patient accounts with a portal for managing consultations, appointments, and treatment history.

High-level scope (subject to detailed planning):
- Patient authentication and user accounts
- Patient portal with consultation history
- Appointment scheduling foundation
- Basic PHI-aware data model
- Clinic-side view of patient records

No detailed features invented here — see `ROADMAP.md` and future sprint planning for specifics.

---

## Quick Links

| Document | Purpose |
|---|---|
| [`PROJECT.md`](../PROJECT.md) | Project constitution — principles, phases, governance |
| [`ARCHITECTURE.md`](../ARCHITECTURE.md) | Full system architecture — every layer, every decision |
| [`AI_OPERATING_MODEL.md`](../AI_OPERATING_MODEL.md) | AI agent operating model and rules |
| [`PRODUCT_BOUNDARIES.md`](../PRODUCT_BOUNDARIES.md) | What AG Synergy is and is not |
| [`TASKS.md`](../TASKS.md) | Living task registry — all work, past and planned |
| [`CURRENT_SPRINT.md`](../CURRENT_SPRINT.md) | Active sprint tracker |
| [`SESSION_HANDOFF.md`](./SESSION_HANDOFF.md) | Active session handoff state |
| [`CHANGELOG.md`](../CHANGELOG.md) | Release history — every version |
| [`DEPLOYMENT.md`](./DEPLOYMENT.md) | Deploy, rollback, secrets, troubleshooting |
| [`epic-001-retrospective.md`](../sprints/epic-001-retrospective.md) | Sprint retrospective — lessons from Epic 1 |