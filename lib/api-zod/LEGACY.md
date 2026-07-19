# LEGACY PROTOTYPE — REFERENCE ONLY

**Package:** `@workspace/api-zod` (Zod request/response schemas)
**Status:** Dormant legacy prototype — NOT deployed, NOT actively developed.
**Authority:** [ADR-001 — Migration Strategy from Express/PostgreSQL Prototype to Cloudflare Platform](../../docs/decisions/ADR-001-cloudflare-migration.md)

## Why this exists
These Zod schemas were used by the Phase-1 Express prototype for request
validation. ADR-001 decided the production backend is Cloudflare Workers, which
validates request bodies **inline** in `workers/src/` — not via this package.

## Dependency island
- This package is imported **only** by `artifacts/api-server` (the legacy Express
  server), which is not deployed.
- The production path does **not** import `@workspace/api-zod`.

## Rules (per ADR-001)
- ❌ Do not add or change schemas here.
- ✅ Preserved as historical/reference material until intentional retirement.

Last reviewed: 2026-07-19 (AGS legacy prototype cleanup, ADR-001 alignment).
