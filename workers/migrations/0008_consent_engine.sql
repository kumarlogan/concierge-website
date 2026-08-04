-- ═══════════════════════════════════════════════════════════════
-- AI Platform — Consent Engine D1 Persistence
-- Product-agnostic, reusable across all AGS products.
-- Platform Architecture Repair: replaces in-memory Map storage
-- with persistent D1-backed storage.
-- ───────────────────────────────────────────────────────────────
-- PHI Boundary: Consent engine stores consent metadata, NOT PHI.
-- PHI references are opaque IDs only. Consent scope contains
-- resource identifiers (not payloads).
-- ═══════════════════════════════════════════════════════════════

-- ── Consents Table ────────────────────────────────────────────
-- Source of truth for all consent records.
-- Dual-write pattern: D1 is source of truth; in-memory cache is
-- populated at startup and updated on every write.
CREATE TABLE IF NOT EXISTS consents (
    id                  TEXT PRIMARY KEY,                          -- consent UUID
    identity_id         TEXT NOT NULL,                             -- subject identity (who granted consent)
    patient_identity_id TEXT NOT NULL,                             -- patient identity (who consent is about)
    consent_type        TEXT NOT NULL,                             -- medical_treatment | privacy | marketing | research | document_sharing | clinic_sharing | international_transfer | ai_assistance | delegated_caregiver
    status              TEXT NOT NULL DEFAULT 'active',            -- active | revoked | expired
    scope               TEXT NOT NULL DEFAULT '[]',                -- JSON array of scope identifiers
    purpose             TEXT NOT NULL DEFAULT '',                  -- purpose of consent
    source              TEXT NOT NULL DEFAULT 'explicit',          -- explicit | implicit | emergency | delegation
    resource_type       TEXT,                                      -- optional: type of resource this consent applies to
    resource_id         TEXT,                                      -- optional: specific resource ID
    delegator_id        TEXT,                                      -- if delegated, who delegated
    granted_at          TEXT NOT NULL,                             -- ISO-8601 UTC when consent was granted
    expires_at          TEXT,                                      -- ISO-8601 UTC when consent expires (null = never)
    revoked_at          TEXT,                                      -- ISO-8601 UTC when consent was revoked
    revoked_by          TEXT,                                      -- identity who revoked
    revoke_reason       TEXT DEFAULT '',
    metadata            TEXT DEFAULT '{}',                         -- JSON object for extensible audit metadata
    version             INTEGER NOT NULL DEFAULT 1,
    version_token       TEXT NOT NULL,
    created_at          TEXT NOT NULL,                             -- record creation timestamp
    updated_at          TEXT NOT NULL                              -- record last-updated timestamp
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_consents_identity ON consents(identity_id);
CREATE INDEX IF NOT EXISTS idx_consents_type ON consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_consents_status ON consents(status);
CREATE INDEX IF NOT EXISTS idx_consents_active ON consents(identity_id, consent_type)
    WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_consents_expiry ON consents(expires_at)
    WHERE expires_at IS NOT NULL AND status = 'active';
-- NOTE: idx_consents_patient on patient_identity_id was removed because
-- that column belongs to the superseded 0008 design iteration. See 0012
-- and the DECLARATION.md for the schema reconciliation rationale.

-- ── Consent History Table ─────────────────────────────────────
-- Append-only audit trail for all consent state changes.
-- Every grant, revoke, and expiry creates an immutable record.
CREATE TABLE IF NOT EXISTS consent_history (
    id                  TEXT PRIMARY KEY,                          -- history entry UUID
    consent_id          TEXT NOT NULL,                             -- FK to consents.id
    identity_id         TEXT NOT NULL,                             -- subject identity
    patient_identity_id TEXT NOT NULL,                             -- patient identity
    consent_type        TEXT NOT NULL,
    status              TEXT NOT NULL,                             -- snapshot of status at this version
    scope               TEXT NOT NULL DEFAULT '[]',
    purpose             TEXT NOT NULL DEFAULT '',
    source              TEXT NOT NULL DEFAULT 'explicit',
    resource_type       TEXT,
    resource_id         TEXT,
    delegator_id        TEXT,
    version             INTEGER NOT NULL,
    changed_by          TEXT NOT NULL,                             -- identity who made the change
    change_reason       TEXT DEFAULT '',                           -- reason for the change
    granted_at          TEXT,
    expires_at          TEXT,
    revoked_at          TEXT,
    metadata            TEXT DEFAULT '{}',
    created_at          TEXT NOT NULL                              -- when this history entry was created
);

-- Indexes for history queries
CREATE INDEX IF NOT EXISTS idx_consent_history_identity ON consent_history(identity_id);
CREATE INDEX IF NOT EXISTS idx_consent_history_consent ON consent_history(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_history_type ON consent_history(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_history_created ON consent_history(created_at);
-- NOTE: idx_consent_history_patient on patient_identity_id was removed because
-- that column belongs to the superseded 0008 design iteration.