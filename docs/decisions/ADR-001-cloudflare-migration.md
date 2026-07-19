# ADR-001: Migration Strategy from Express/PostgreSQL Prototype to Cloudflare Platform

**Status:** Accepted  
**Date:** 2026-07-18

---

## Context

The current repository contains prototype backend components implemented during
Phase 1 (static website phase):

- **Express 5** API server (`artifacts/api-server/`)
- **PostgreSQL** database with **Drizzle ORM** (`lib/db/`)
- **pnpm workspace** monorepo structure with shared libraries

The target architecture, defined in PROJECT.md and ARCHITECTURE.md, specifies:

- **Cloudflare Pages** for frontend hosting
- **Cloudflare Workers** for backend API
- **Cloudflare D1** for database (SQLite-compatible)
- **Cloudflare R2** for object storage

The platform must prioritize:

- Low operational cost
- Simplicity
- Maintainability
- Serverless architecture
- Free-tier-first development

---

## Decision

Future AG Synergy development will follow the Cloudflare architecture. The
existing Express/PostgreSQL backend will **not** be expanded.

Migration from Express/PostgreSQL to Workers/D1 will happen incrementally when
required by feature development. The existing implementation remains preserved
in the repository until migration activities are explicitly planned and
scheduled.

No new features will be added to the Express API server. No new tables or
schema changes will be made to the PostgreSQL database. The existing
implementation serves as a working reference for the consultation form
submission flow and will be replaced when the Workers/D1 equivalent is built.

---

## Reasons

### Positive Factors

| Factor | Detail |
|---|---|
| Aligns with existing hosting | The frontend is already on Cloudflare Pages; extending to Workers and D1 keeps the entire platform in one ecosystem |
| Reduces infrastructure management | Workers and D1 are serverless — no server provisioning, patching, or scaling |
| Supports free-tier MVP development | Cloudflare's free tier covers Workers (100k requests/day), D1 (5GB storage, 5M reads/day), and R2 (10GB storage) |
| Simplifies deployment | Single `wrangler` CLI for all Cloudflare resources; no separate database hosting or connection management |
| Enables future scaling | Workers scale to zero when idle and handle spikes automatically; D1 and R2 scale with usage |

---

## Consequences

### Positive

- **Consistent architecture** — the entire platform operates within the Cloudflare ecosystem, reducing cognitive overhead and tooling fragmentation
- **Lower operational complexity** — no server management, no database hosting, no connection pooling, no infrastructure drift
- **Easier maintenance** — a single deployment pipeline, a single configuration surface, a single vendor relationship

### Negative

- **Future migration effort required** — the consultation form submission flow currently depends on Express/PostgreSQL; this must be reimplemented on Workers/D1 before the existing backend can be decommissioned
- **Temporary coexistence of technologies** — during the transition period, the repository will contain both Express and Workers code, both PostgreSQL and D1 schemas; clear documentation and directory organization are required to prevent confusion
- **D1 limitations** — D1 is SQLite-based and does not support all PostgreSQL features; any PostgreSQL-specific queries or schema features in the prototype will need adaptation

---

## Related Decisions

*None yet — this is the first ADR.*

## Supersedes

*None.*

## Superseded By

*None.*