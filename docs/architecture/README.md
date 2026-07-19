# Architecture Documentation

> Index of AG Synergy Platform architecture documentation.

---

## Authoritative Architecture Document

- **[`ARCHITECTURE.md`](../ARCHITECTURE.md)** — Complete system architecture for Phase 1:
  - Architecture overview and design goals
  - High-level component diagram (Mermaid)
  - Frontend architecture (React + Vite + TypeScript)
  - Backend architecture (Cloudflare Workers)
  - Database architecture (Cloudflare D1 — entity model + schema governance)
  - Storage architecture (Cloudflare R2 — security + pre-signed URL flow)
  - Hermes integration architecture (AI operations layer)
  - Security architecture (boundaries, posture, auditability)
  - Future expansion compatibility (pathways for Phases 2–4)
  - Phase 1 non-goals and scope boundaries

---

## Architecture Decision Records (ADRs)

All significant architectural decisions are recorded in [`docs/decisions/`](./decisions/):

| ADR | Title | Status |
|---|---|---|
| [ADR-001](./decisions/ADR-001-cloudflare-migration.md) | Migration Strategy from Express/PostgreSQL Prototype to Cloudflare Platform | Accepted |

*New ADRs are added here as architectural decisions are made during implementation.*

---

## Future Content

As the platform evolves, this directory will host:

| Content | Purpose | When |
|---|---|---|
| Component diagrams | Detailed per-component architecture (Workers internals, D1 schema evolution, R2 access patterns) | During Epic 1 implementation |
| Data flow diagrams | Request/response flows for specific workflows (consultation submission, clinic listing, lead management) | During Epic 1 implementation |
| Infrastructure topology | Full Cloudflare resource map (Workers, D1, R2, Pages, domain configuration) | After Epic 1 deployment |
| Security architecture details | Threat model, data classification, access control matrix | During Phase 2 (patient data) |
| Integration diagrams | Third-party service integrations (email, SMS, calendar) | When integrations are added |

---

*This directory is maintained alongside the root `ARCHITECTURE.md`. The root document is the authoritative overview; detailed specifications, diagrams, and ADRs live here.*