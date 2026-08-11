-- 0014_fix_consent_registry_unique.sql
--
-- PURPOSE: Resolves the consent_registry schema defect that blocks
-- POST /api/v1/consent/grant.
--
-- ROOT CAUSE:
--   Migration 0006_trust_runtime.sql created consent_registry WITHOUT a
--   UNIQUE(identity_id, consent_type) constraint.
--   Migration 0012_consent_schema_reconciliation.sql intended to add it via
--   CREATE TABLE IF NOT EXISTS with UNIQUE(...), but since the table already
--   existed from 0006, the IF NOT EXISTS clause made it a silent no-op.
--   D1ConsentEngine.grant() uses ON CONFLICT(identity_id, consent_type)
--   DO UPDATE which requires that UNIQUE constraint.
--
-- PRECONDITION (verified before application):
--   consent_registry contains exactly 0 rows (confirmed via
--   SELECT COUNT(*) AS cnt FROM consent_registry — returned 0).
--
-- This migration uses DROP/CREATE because SQLite does not support
-- ALTER TABLE to add a UNIQUE constraint to an existing table, and
-- the table has been verified empty with no data to preserve.

-- ── Pre-condition check ─────────────────────────────────────────
-- Note: Pre-condition (0 rows) was verified manually before applying.
-- RAISE() cannot be used outside of triggers in D1/SQLite, so the check
-- is documented here rather than enforced in-SQL.

-- ── Recreate table with UNIQUE constraint ────────────────────────
DROP TABLE IF EXISTS consent_registry;

CREATE TABLE consent_registry (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    consent_type    TEXT NOT NULL,
    current_state   TEXT NOT NULL,
    expires_at      TEXT,
    version_token   TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id),
    UNIQUE(identity_id, consent_type)
);

-- ── Recreate indexes (matching 0006 / 0012) ──────────────────────
CREATE INDEX IF NOT EXISTS idx_consent_registry_identity  ON consent_registry(identity_id);
CREATE INDEX IF NOT EXISTS idx_consent_registry_type      ON consent_registry(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_registry_state     ON consent_registry(current_state);
