# Migration Strategy

> **Document Version:** 1.0
> **Created:** 2026-07-18
> **Database:** Cloudflare D1 (`agsynergy-db`)
> **Binding:** `DB` in Worker environment
> **Scope:** All database schema changes for the AG Synergy Platform

---

## 1. Migration Numbering Convention

Migration files use **zero-padded sequential numbering** with a descriptive suffix.

### Format

```
NNNN_descriptive_name.sql
```

### Examples

| File | Description |
|---|---|
| `0001_initial_schema.sql` | Initial schema — Phase 1 tables |
| `0002_add_users_table.sql` | Phase 2 — user authentication |
| `0003_add_clinics_services.sql` | Phase 2 — many-to-many junction |

### Rules

- **Sequential only.** No gaps in the numbering. If a migration is deprecated before applying, renumber successors.
- **Padded to 4 digits.** Supports up to 9,999 migrations (far beyond our needs).
- **Descriptive name.** Uses `snake_case` and clearly describes the change.
- **No rollback migrations.** Schema fixes are new forward migrations (see §3).

---

## 2. Migration File Structure

Every migration file must follow this structure:

```sql
-- ============================================================================
-- AG Synergy Platform — [Brief Description]
-- ============================================================================
-- Migration: NNNN_descriptive_name.sql
-- Phase: [1–4]
-- Created: YYYY-MM-DD
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: [ADR reference or "N/A"]
-- ============================================================================
```

### Included in each migration:

- **Header block** — Migration number, phase, date, ADR reference
- **PRAGMA statement** (if needed) — `PRAGMA foreign_keys = ON;` for FK-enforcing migrations
- **Schema operations** — `CREATE TABLE`, `ALTER TABLE`, `CREATE INDEX`
- **Comments** — Every table and index includes a comment explaining purpose and query patterns
- **Footer summary** — Counts of tables, indexes, and foreign keys added in this migration

---

## 3. Roll-Forward Philosophy

### No Rollback

AG Synergy does not support database rollbacks. All schema changes are **forward-only**.

If a migration introduces a problem, the fix is a **new migration** that corrects it.

### Rationale

| Principle | Explanation |
|---|---|
| **Simplicity** | One direction only. No reverse-engineering of schema changes. |
| **Auditability** | Every state change is a numbered, timestamped file. Full audit trail. |
| **D1 compatibility** | D1 has no built-in rollback mechanism. Forward-only avoids tooling friction. |
| **Safety** | Rollbacks in production databases carrying operational data are dangerous regardless of tooling. |

### Examples of Forward Fixes

| Problem | Migration | Fix Migration |
|---|---|---|
| Wrong column type | 0005 — added `phone` as `INTEGER` | 0006 — `ALTER TABLE` to change type |
| Missing index | 0003 — table without needed index | 0004 — `CREATE INDEX` |
| Dropped column | 0007 — dropped `legacy_field` too early | 0008 — `ALTER TABLE ADD COLUMN` to restore it |

---

## 4. Local Migration Process

### Prerequisites

- `wrangler` CLI installed (v4+)
- Authenticated with Cloudflare (`wrangler login` or `CLOUDFLARE_API_TOKEN`)
- Database already created (`wrangler d1 create agsynergy-db`)

### Apply Migrations Locally

```bash
# From the workers/ directory:
cd workers

# Apply all unapplied migrations to the local D1 database
npx wrangler d1 migrations apply agsynergy-db --local

# Apply to the remote (preview) database
npx wrangler d1 migrations apply agsynergy-db --env preview

# Apply to production
npx wrangler d1 migrations apply agsynergy-db --env production
```

### Verify Migration Applied

```bash
# List all tables in the local database
npx wrangler d1 execute agsynergy-db --local \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Check schema for a specific table
npx wrangler d1 execute agsynergy-db --local \
  --command "SELECT sql FROM sqlite_master WHERE name='leads';"
```

---

## 5. Production Migration Process

### Pre-Migration Checklist

- [ ] Migration reviewed against DATABASE_DESIGN.md
- [ ] ADR written and accepted (if required — see §6)
- [ ] Migration tested against local D1
- [ ] Migration tested against preview D1 (remote)
- [ ] `wrangler deploy --env preview` succeeds with the new migration
- [ ] Preview Worker health endpoint returns healthy

### Apply to Production

```bash
cd workers

# 1. Deploy Worker code (if Worker logic changed)
npx wrangler deploy --env production

# 2. Apply migration to production D1
npx wrangler d1 migrations apply agsynergy-db --env production

# 3. Verify health
curl https://api.agsynergy.ca/api/v1/health
```

### Post-Migration Verification

```bash
# Verify tables exist in production
npx wrangler d1 execute agsynergy-db --env production \
  --command "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;"

# Verify row counts (sanity check)
npx wrangler d1 execute agsynergy-db --env production \
  --command "SELECT 'leads' AS tbl, COUNT(*) AS rows FROM leads
             UNION ALL SELECT 'contacts', COUNT(*) FROM contacts
             UNION ALL SELECT 'consultations', COUNT(*) FROM consultations
             UNION ALL SELECT 'clinics', COUNT(*) FROM clinics
             UNION ALL SELECT 'services', COUNT(*) FROM services
             UNION ALL SELECT 'faqs', COUNT(*) FROM faqs;"
```

---

## 6. ADR Requirement for Schema Changes

### When an ADR is Required

An Architecture Decision Record (ADR) is **required** for any schema change that:

- Adds a new table
- Drops a table or column
- Changes a column's type or constraints
- Adds or removes a foreign key relationship
- Introduces a new data domain (e.g., payment data, PHI-adjacent data)

### When an ADR is NOT Required

- Adding a non-semantic index to an existing table
- Adding a nullable column to an existing table
- Correcting a typo in a column name (that has no data yet)

### ADR Process

1. Create `docs/decisions/ADR-NNNN-brief-title.md`
2. Document the change rationale, alternatives considered, and consequences
3. Reference the ADR number in the migration header
4. The ADR must be **accepted** before the migration is written

---

## 7. Best Practices

### Schema Design

| Practice | Rationale |
|---|---|
| **TEXT UUIDs for primary keys** | Portable, no auto-increment collisions, D1/SQLite-friendly |
| **ISO 8601 UTC timestamps** | Unambiguous, sortable, timezone-safe. `created_at` + `updated_at` on every table |
| **INTEGER 0/1 for booleans** | SQLite convention; `is_active`, `is_published` |
| **Explicit column constraints** | `NOT NULL`, `DEFAULT` values prevent data integrity issues at the database level |
| **Forward-compatible column additions** | New columns should be nullable or have a DEFAULT — never break existing rows |

### Indexing

| Practice | Rationale |
|---|---|
| **Index every WHERE/JOIN/ORDER BY column** | D1 is SQLite; index scans beat full table scans every time |
| **Composite indexes for paired queries** | e.g., `(is_published, category)` when you always filter by both |
| **Don't over-index** | Each index has a write cost. Phase 1 is read-heavy but avoid premature optimization |
| **Name indexes descriptively** | `idx_{table}_{column}` — self-documenting |

### Foreign Keys

| Practice | Rationale |
|---|---|
| **Define FK constraints in migrations** | Documents relationships even if enforcement is at the application layer |
| **No CASCADE deletes** | Too easy to accidentally delete related data. Application handles cleanup explicitly. |
| **Soft links for optional relationships** | e.g., `contacts.lead_id` is a soft reference — no FK constraint because the relationship is optional and the source may be deleted independently |

### SQL Injection Prevention

- All Worker queries use **prepared statements** via `env.DB.prepare()` with `bind()`
- Never concatenate user input into SQL strings
- Migration files contain only static SQL — no dynamic values

---

## 8. Current Migration State

| Migration | Description | Applied (Local) | Applied (Preview) | Applied (Production) |
|---|---|---|---|---|
| `0001_initial_schema.sql` | Phase 1 schema — 6 tables, 14 indexes | Pending | Pending | Pending |

---

## 9. References

- `DATABASE_DESIGN.md` — Complete entity and relationship design
- `ARCHITECTURE.md` — System architecture and D1 role
- `ADR-001` — Cloudflare Migration decision
- `CURRENT_SPRINT.md` — Active sprint tracking (EPIC-001)
- Cloudflare D1 Docs: https://developers.cloudflare.com/d1/
- Wrangler D1 Migrations: https://developers.cloudflare.com/d1/reference/migrations/