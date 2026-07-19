# LEGACY PROTOTYPE — REFERENCE ONLY

**Package:** `@workspace/db` (PostgreSQL + Drizzle ORM schema)
**Status:** Dormant legacy prototype — NOT deployed, NOT actively developed.
**Authority:** [ADR-001 — Migration Strategy from Express/PostgreSQL Prototype to Cloudflare Platform](../../docs/decisions/ADR-001-cloudflare-migration.md)

## Why this exists
This PostgreSQL schema package backed the Phase-1 Express prototype. ADR-001
decided the production database is **Cloudflare D1 (SQLite)**, accessed directly
by `workers/` — not this package.

## Dependency island
- This package is imported **only** by `artifacts/api-server` (the legacy Express
  server), which is not deployed.
- The production path (`workers/`) uses D1 directly and does **not** import
  `@workspace/db`.

## Rules (per ADR-001)
- ❌ No new tables or schema changes to this PostgreSQL database.
- ❌ Do not add migrations here.
- ✅ Preserved as historical/reference material until intentional retirement.

Last reviewed: 2026-07-19 (AGS legacy prototype cleanup, ADR-001 alignment).
