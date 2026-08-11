-- 0015_fix_consent_versions_columns.sql
--
-- PURPOSE: Adds missing columns to consent_versions table that
-- D1ConsentEngine.withdraw() expects but migration 0006 did not create.
--
-- ROOT CAUSE:
--   Migration 0006 created consent_versions with columns matching the
--   schema at that time. Subsequent code (d1-consent-engine.ts) evolved
--   to INSERT revoked_at and version_token into consent_versions during
--   the withdraw() flow, but no migration was created to add those columns.
--   This was never caught because the consent_registry UNIQUE constraint
--   bug (fixed in 0014) prevented consent granting entirely — so revoke
--   was never exercised in production.
--
-- PRECONDITION: consent_versions contains 0 rows (verified before apply).
-- Uses ALTER TABLE ADD COLUMN (safe for D1, no data loss).

ALTER TABLE consent_versions ADD COLUMN revoked_at    TEXT;
ALTER TABLE consent_versions ADD COLUMN version_token TEXT;
