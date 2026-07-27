-- ===========================================================================
-- AI Platform Secure Document Upload — Database Schema
-- ===========================================================================
-- Migration: 0007_document_upload.sql
-- Phase: 2 — Wave 6: Secure Document Upload & Consent Runtime Completion
-- Created: 2026-07-27
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: ADR-017, ADR-014
-- ===========================================================================
--
-- Migration Philosophy:
--   - PHI Boundary: Document metadata tables store NO personal health information
--     in indexable columns. PHI-sensitive fields (file names, descriptions) are
--     stored encrypted in metadata JSON.
--   - Documents are stored in R2, not in D1. D1 stores metadata only.
--   - R2 buckets: phi-* for PHI documents, non-phi-* for non-PHI documents.
--   - Audit tables are append-only: no UPDATE, no DELETE.
--   - All timestamps are ISO-8601 UTC.
--   - TEXT UUIDs for all primary keys (D1/SQLite-friendly).
--   - INTEGER 0/1 for booleans (SQLite convention).
--   - JSON for flexible metadata; never embed PHI in JSON.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- TABLE: documents
-- ===========================================================================
-- Central document metadata registry. Each document is a single file stored
-- in R2. Documents are owned by an identity (patient) and contain metadata
-- for PHI classification, encryption, and access control.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS documents (
    id                  TEXT PRIMARY KEY,                     -- UUID v4
    identity_id         TEXT NOT NULL,                         -- owner identity_id (patient)
    patient_id          TEXT NOT NULL,                         -- patient identifier (may differ from identity_id for caregivers)
    category            TEXT NOT NULL,                         -- lab_result | imaging | prescription | consent_form | clinical_note | identification | insurance_card | other
    status              TEXT NOT NULL DEFAULT 'pending_upload', -- pending_upload | uploading | available | archived | deleted | quarantined
    file_name           TEXT NOT NULL,                         -- original file name (may be encrypted in transit)
    mime_type           TEXT NOT NULL,                         -- MIME type (application/pdf, image/jpeg, etc.)
    file_size           INTEGER NOT NULL DEFAULT 0,            -- file size in bytes
    encryption          TEXT NOT NULL DEFAULT 'server_side_encrypted', -- aes_256_gcm | client_side_encrypted | server_side_encrypted | unencrypted
    phi_classification  TEXT NOT NULL DEFAULT 'unknown',       -- phi_direct | phi_indirect | non_phi | unknown
    phi_classified_by   TEXT,                                 -- identity_id who classified this document
    phi_classified_at   TEXT,                                 -- when classification was performed
    storage_bucket      TEXT NOT NULL,                         -- R2 bucket name
    storage_key         TEXT NOT NULL,                         -- R2 object key
    storage_provider    TEXT NOT NULL DEFAULT 'r2',            -- storage provider (r2, s3, etc.)
    checksum_sha256     TEXT,                                 -- SHA-256 hex digest
    checksum_algorithm  TEXT DEFAULT 'sha-256',                -- hash algorithm used
    metadata            TEXT DEFAULT '{}',                     -- JSON: extensible metadata, encrypted for PHI fields
    tags                TEXT DEFAULT '[]',                     -- JSON array of string tags
    version             INTEGER NOT NULL DEFAULT 1,
    uploaded_at         TEXT,                                 -- when upload completed
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL,
    expires_at          TEXT,                                 -- document retention expiry
    archived_at         TEXT,                                 -- when archived
    deleted_at          TEXT                                  -- soft delete timestamp
);

CREATE INDEX IF NOT EXISTS idx_documents_identity ON documents(identity_id);
CREATE INDEX IF NOT EXISTS idx_documents_patient ON documents(patient_id);
CREATE INDEX IF NOT EXISTS idx_documents_category ON documents(category);
CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);
CREATE INDEX IF NOT EXISTS idx_documents_phi ON documents(phi_classification);
CREATE INDEX IF NOT EXISTS idx_documents_storage ON documents(storage_bucket, storage_key);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at);
CREATE INDEX IF NOT EXISTS idx_documents_expires ON documents(expires_at);

-- ===========================================================================
-- TABLE: document_shares
-- ===========================================================================
-- Access control records for document sharing. Each row represents a
-- grant of access from an owner to a delegatee (caregiver, staff, etc.).
-- Revocation is soft (revoked_at is set, row is never deleted).
-- ===========================================================================
CREATE TABLE IF NOT EXISTS document_shares (
    id                  TEXT PRIMARY KEY,                     -- UUID v4
    document_id         TEXT NOT NULL,
    owner_identity_id   TEXT NOT NULL,                         -- document owner
    delegate_identity_id TEXT NOT NULL,                        -- who gets access
    consent_type        TEXT NOT NULL,                         -- document_sharing | delegated_caregiver
    consent_id          TEXT,                                 -- reference to consent record
    delegation_id       TEXT,                                 -- reference to delegation record
    access_level        TEXT NOT NULL DEFAULT 'read',          -- read | write | read_write | admin
    purpose_of_use      TEXT DEFAULT '',                      -- why access is granted
    expires_at          TEXT,                                 -- access expiry
    granted_at          TEXT NOT NULL,
    revoked_at          TEXT,                                 -- when revoked
    revoked_by          TEXT,                                 -- identity_id who revoked
    revoke_reason       TEXT DEFAULT '',
    constraints         TEXT DEFAULT '{}',                    -- JSON: additional constraints (time windows, locations, etc.)
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_doc_shares_document ON document_shares(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_owner ON document_shares(owner_identity_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_delegatee ON document_shares(delegate_identity_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_consent ON document_shares(consent_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_delegation ON document_shares(delegation_id);
CREATE INDEX IF NOT EXISTS idx_doc_shares_active ON document_shares(delegate_identity_id, revoked_at)
    WHERE revoked_at IS NULL;

-- ===========================================================================
-- TABLE: document_access_log
-- ===========================================================================
-- Append-only audit trail for every document access event.
-- Never UPDATE, never DELETE — only INSERT.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS document_access_log (
    id                  TEXT PRIMARY KEY,                     -- UUID v4
    document_id         TEXT NOT NULL,
    identity_id         TEXT NOT NULL,                         -- who performed the action
    action              TEXT NOT NULL,                         -- document:read | document:write | document:upload | document:share | document:revoke | document:delete | document:archive
    access_type         TEXT NOT NULL,                         -- owner | shared | delegated | emergency | system
    outcome             TEXT NOT NULL,                         -- ALLOW | DENY | ERROR
    timestamp           TEXT NOT NULL,
    ip_address          TEXT,
    user_agent          TEXT,
    purpose_of_use      TEXT DEFAULT '',
    policy_evaluation_id TEXT,                                -- reference to policy evaluation
    trust_score         REAL,                                 -- trust score at time of access (0.0-1.0)
    risk_score          REAL,                                 -- risk score at time of access (0.0-1.0)
    delegation_chain    TEXT DEFAULT '[]',                    -- JSON array of delegation IDs
    metadata            TEXT DEFAULT '{}',                     -- JSON: additional context
    version             INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_doc_access_log_document ON document_access_log(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_log_identity ON document_access_log(identity_id);
CREATE INDEX IF NOT EXISTS idx_doc_access_log_action ON document_access_log(action);
CREATE INDEX IF NOT EXISTS idx_doc_access_log_outcome ON document_access_log(outcome);
CREATE INDEX IF NOT EXISTS idx_doc_access_log_timestamp ON document_access_log(timestamp);

-- ===========================================================================
-- TABLE: document_encryption_keys
-- ===========================================================================
-- Key management for document encryption. Each document can have multiple
-- encryption keys (key rotation support). Actual key material is stored
-- externally (encrypted in KV or R2). This table stores key metadata.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS document_encryption_keys (
    id                  TEXT PRIMARY KEY,                     -- UUID v4
    document_id         TEXT NOT NULL,                         -- document this key belongs to
    algorithm           TEXT NOT NULL,                         -- aes-256-gcm | chacha20-poly1305
    key_id              TEXT NOT NULL,                         -- reference to external key store
    encrypted_key       TEXT NOT NULL,                         -- encrypted key material (envelope encryption)
    key_version         INTEGER NOT NULL DEFAULT 1,
    active              INTEGER NOT NULL DEFAULT 1,             -- 0/1: is this the current active key
    rotated_at          TEXT,                                 -- when this key replaced the previous
    created_at          TEXT NOT NULL,
    expires_at          TEXT,                                 -- key rotation schedule
    metadata            TEXT DEFAULT '{}',                     -- JSON: key metadata
    FOREIGN KEY (document_id) REFERENCES documents(id)
);

CREATE INDEX IF NOT EXISTS idx_doc_enc_keys_document ON document_encryption_keys(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_enc_keys_active ON document_encryption_keys(document_id, active)
    WHERE active = 1;

-- ===========================================================================
-- TABLE: caregiver_authorizations
-- ===========================================================================
-- Caregiver authorization records. Patients authorize caregivers to access
-- their documents. Each authorization is linked to a consent and delegation.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS caregiver_authorizations (
    id                  TEXT PRIMARY KEY,                     -- UUID v4
    patient_identity_id TEXT NOT NULL,                         -- patient granting access
    caregiver_identity_id TEXT NOT NULL,                       -- caregiver receiving access
    status              TEXT NOT NULL DEFAULT 'pending',       -- pending | active | revoked | expired
    consent_id          TEXT,                                 -- reference to consent record
    delegation_id       TEXT,                                 -- reference to delegation record
    scope               TEXT NOT NULL DEFAULT '[]',            -- JSON array of document IDs or categories
    access_level        TEXT NOT NULL DEFAULT 'read',          -- read | read_write
    purpose_of_use      TEXT DEFAULT '',                      -- clinical_care | administrative | emergency
    expires_at          TEXT,                                 -- authorization expiry
    granted_at          TEXT,
    revoked_at          TEXT,
    revoked_by          TEXT,
    revoke_reason       TEXT DEFAULT '',
    metadata            TEXT DEFAULT '{}',                     -- JSON: extensible
    version             INTEGER NOT NULL DEFAULT 1,
    created_at          TEXT NOT NULL,
    updated_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_caregiver_auth_patient ON caregiver_authorizations(patient_identity_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_auth_caregiver ON caregiver_authorizations(caregiver_identity_id);
CREATE INDEX IF NOT EXISTS idx_caregiver_auth_status ON caregiver_authorizations(status);
CREATE INDEX IF NOT EXISTS idx_caregiver_auth_active ON caregiver_authorizations(patient_identity_id, caregiver_identity_id, status)
    WHERE status = 'active';

-- ===========================================================================
-- Document Policy Defaults
-- ===========================================================================
-- Default policies for document access control. These are registered
-- with the Policy Engine at startup.
-- ===========================================================================
INSERT INTO policies (id, name, description, category, version, enabled, fail_closed, precedence, content, metadata, created_at, updated_at)
VALUES
    ('doc-policy-001', 'Document Owner Access', 'Document owner always has full access to their documents', 'rbac', 1, 1, 1, 100,
        '{"rules":[{"id":"doc-owner-read","name":"Owner Read","action":"document:read","resource":"document:*","effect":"allow","precedence":100},{"id":"doc-owner-write","name":"Owner Write","action":"document:write","resource":"document:*","effect":"allow","precedence":100},{"id":"doc-owner-share","name":"Owner Share","action":"document:share","resource":"document:*","effect":"allow","precedence":100},{"id":"doc-owner-delete","name":"Owner Delete","action":"document:delete","resource":"document:*","effect":"allow","precedence":100},{"id":"doc-owner-archive","name":"Owner Archive","action":"document:archive","resource":"document:*","effect":"allow","precedence":100}]}',
        '{"type":"system","owner_identity_attribute":"identity_id","source":"Wave 6 Document Upload"}',
        datetime('now'), datetime('now')),

    ('doc-policy-002', 'Shared Document Access', 'Users with active document shares can read shared documents', 'rebac', 1, 1, 1, 200,
        '{"rules":[{"id":"doc-share-read","name":"Share Read","action":"document:read","resource":"document:shared:*","effect":"allow","precedence":200,"conditions":[{"id":"share-active","type":"consent","attribute":"context.consentStatus.document_sharing","operator":"eq","value":"granted","weight":1}]}]}',
        '{"type":"system","source":"Wave 6 Document Upload"}',
        datetime('now'), datetime('now')),

    ('doc-policy-003', 'Caregiver Delegated Access', 'Authorized caregivers can access patient documents via delegation', 'rebac', 1, 1, 1, 300,
        '{"rules":[{"id":"doc-caregiver-read","name":"Caregiver Read","action":"document:read","resource":"document:patient:*","effect":"allow","precedence":300,"conditions":[{"id":"delegation-active","type":"consent","attribute":"context.consentStatus.delegated_caregiver","operator":"eq","value":"granted","weight":1}]}]}',
        '{"type":"system","source":"Wave 6 Document Upload"}',
        datetime('now'), datetime('now')),

    ('doc-policy-004', 'Emergency Document Access', 'Break-glass access for emergency document access with audit', 'emergency', 1, 1, 1, 50,
        '{"emergencyRules":[{"id":"doc-emergency","name":"Emergency Access","breakGlassCode":"DOC-EMERG-2026","allowedActions":["document:read"],"maxDurationMinutes":60,"requiresApproval":true,"approvalChain":["admin"],"auditRequired":true}]}',
        '{"type":"system","source":"Wave 6 Document Upload"}',
        datetime('now'), datetime('now'));