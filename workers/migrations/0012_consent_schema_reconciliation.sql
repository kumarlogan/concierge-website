-- 0012_consent_schema_reconciliation.sql
--
-- PURPOSE: Resolves PRG-014. Migration 0006_trust_runtime.sql created the
-- `consents` table first. Migration 0008_consent_engine.sql tried to create
-- it again with additional columns (patient_identity_id, status, resource_type,
-- revoked_by, updated_at) but IF NOT EXISTS caused it to be a silent no-op.
-- The D1ConsentEngine is written against the live 0006 schema.
--
-- This migration adds only `updated_at` which is genuinely useful for tracking
-- when a consent record was last modified.
--
-- All other 0008 columns are intentionally NOT added — they reflect a design
-- iteration that was superseded by the 0006 model.

ALTER TABLE consents ADD COLUMN updated_at TEXT;

-- Backfill existing rows
UPDATE consents SET updated_at = created_at WHERE updated_at IS NULL;

-- Update consent_registry to ensure it exists (0006 created it but some
-- deployments may have skipped that table if 0006 ran partially).
CREATE TABLE IF NOT EXISTS consent_registry (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    consent_type    TEXT NOT NULL,
    current_state   TEXT NOT NULL,
    expires_at      TEXT,
    version_token   TEXT NOT NULL DEFAULT '',
    updated_at      TEXT NOT NULL,
    UNIQUE(identity_id, consent_type)
);
CREATE INDEX IF NOT EXISTS idx_consent_registry_identity ON consent_registry(identity_id);
CREATE INDEX IF NOT EXISTS idx_consent_registry_type ON consent_registry(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_registry_state ON consent_registry(current_state);
