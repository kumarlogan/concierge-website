# LEGACY PROTOTYPE — REFERENCE ONLY

**Package:** `@workspace/api-server` (Express 5 API server)
**Status:** Dormant legacy prototype — NOT deployed, NOT actively developed.
**Authority:** [ADR-001 — Migration Strategy from Express/PostgreSQL Prototype to Cloudflare Platform](../../docs/decisions/ADR-001-cloudflare-migration.md)

## Why this exists
This Express server was built during Phase 1 (static website phase) as a working
reference for the consultation-form submission flow. ADR-001 (accepted 2026-07-18)
decided that future AG Synergy development follows the Cloudflare architecture
(Cloudflare Pages + Workers + D1 + R2), and that this Express/PostgreSQL backend
**will not be expanded**.

## What is live instead
- **Frontend:** `@workspace/ags-fertility` → Cloudflare Pages (built/deployed by `.github/workflows/deploy.yml`).
- **Backend API:** Cloudflare Workers (`workers/src/`) → D1 (SQLite). The live
  consultation endpoint is `workers/src/routes/consultations.ts`, which the
  production frontend actually calls.
- This `api-server` is **not** referenced by `deploy.yml` and **not** called by
  the production frontend.

## Rules (per ADR-001)
- ❌ Do not add new features to this server.
- ❌ Do not make schema changes that depend on it.
- ❌ Do not "fix" or refactor it as part of active work.
- ✅ Keep it as historical/reference material until intentional retirement.
- ✅ Retirement (physical deletion) is a planned, separate cleanup — not an
  ad-hoc edit.

Last reviewed: 2026-07-19 (AGS legacy prototype cleanup, ADR-001 alignment).
