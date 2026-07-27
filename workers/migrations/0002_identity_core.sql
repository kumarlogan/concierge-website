-- ============================================================================
-- AI Platform Identity Core — Database Schema
-- ============================================================================
-- Migration: 0002_identity_core.sql
-- Phase: 2 — Wave 3: AI Platform Identity Core v1
-- Created: 2026-07-26
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: ADR-010 — Provider-Neutral Identity Abstraction
-- ============================================================================
--
-- Migration Philosophy:
--   - PHI Boundary: Identity tables store NO personal health information.
--     PHI is stored in product-scoped tables, linked by opaque identity_id.
--   - Separate encryption boundaries: identity data uses different keys than PHI.
--   - TEXT UUIDs for all primary keys (D1/SQLite-friendly, no auto-increment).
--   - ISO-8601 UTC timestamps for all date/time columns.
--   - INTEGER 0/1 for booleans (SQLite convention).
--   - Token values are always hashed (SHA-256) before storage — never plaintext.
--   - Minimal, intentional indexing — only where query patterns demand it.

PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: identities
-- ============================================================================
-- Canonical identity record for every actor on the AI Platform.
-- Every identity type (patient, staff, admin, clinic, partner, AI worker,
-- platform service) authenticates through the same core.
--
-- PHI Boundary: NO personal health information stored here.
-- Lifecycle: registered → verified → active → suspended | archived | deleted
-- ============================================================================
CREATE TABLE IF NOT EXISTS identities (
    id              TEXT PRIMARY KEY,                          -- UUID v4
    identity_type   TEXT NOT NULL,                             -- patient | staff | administrator | clinic | partner | ai_worker | platform_service
    status          TEXT NOT NULL DEFAULT 'registered',        -- registered | verified | active | suspended | archived | deleted
    email           TEXT,                                      -- Primary email (nullable for system accounts)
    email_verified  INTEGER NOT NULL DEFAULT 0,                -- 0/1 boolean
    phone           TEXT,                                      -- Phone number (nullable)
    phone_verified  INTEGER NOT NULL DEFAULT 0,                -- 0/1 boolean
    display_name    TEXT,                                      -- Human-readable name
    password_hash   TEXT,                                      -- PBKDF2-SHA256 hash; NULL for OAuth-only accounts
    mfa_enabled     INTEGER NOT NULL DEFAULT 0,                -- 0/1 boolean
    mfa_method      TEXT,                                      -- totp | sms_otp | email_otp | security_key | backup_code
    trust_score     REAL DEFAULT 0.5,                          -- 0.0 – 1.0 baseline trust
    created_at      TEXT NOT NULL,                             -- ISO 8601 UTC
    updated_at      TEXT NOT NULL,                             -- ISO 8601 UTC
    last_login_at   TEXT,                                      -- ISO 8601 UTC
    metadata        TEXT DEFAULT '{}',                         -- JSON: extensible metadata
    UNIQUE(email)
);

CREATE INDEX IF NOT EXISTS idx_identities_type ON identities(identity_type);
CREATE INDEX IF NOT EXISTS idx_identities_status ON identities(status);
CREATE INDEX IF NOT EXISTS idx_identities_email ON identities(email);

-- ============================================================================
-- TABLE: identity_providers
-- ============================================================================
-- Configured authentication providers for the Identity Provider Registry.
-- Each row represents a configured provider (Google, Microsoft, etc.).
-- ============================================================================
CREATE TABLE IF NOT EXISTS identity_providers (
    id              TEXT PRIMARY KEY,                          -- UUID v4
    name            TEXT NOT NULL,                             -- Human-readable name
    provider_type   TEXT NOT NULL,                             -- google | microsoft | apple | github | oidc | saml
    client_id       TEXT,                                      -- OAuth client ID (encrypted at rest)
    client_secret   TEXT,                                      -- OAuth client secret (encrypted at rest)
    issuer_url      TEXT,                                      -- OIDC issuer URL
    scopes          TEXT DEFAULT '[]',                         -- JSON array of scopes
    enabled         INTEGER NOT NULL DEFAULT 0,                -- 0/1 boolean
    config          TEXT DEFAULT '{}',                         -- JSON: provider-specific configuration
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

-- ============================================================================
-- TABLE: identity_sessions
-- ============================================================================
-- Active and historical sessions for all identity types.
-- Sessions are created on successful authentication and validated on each
-- request. Includes device fingerprinting and risk scoring.
-- ============================================================================
CREATE TABLE IF NOT EXISTS identity_sessions (
    id                  TEXT PRIMARY KEY,                     -- UUID v4
    identity_id         TEXT NOT NULL,                        -- FK → identities.id
    session_type        TEXT NOT NULL,                        -- browser_patient | browser_staff | browser_admin | api_token | agent | machine
    auth_method         TEXT NOT NULL,                        -- email_password | magic_link | google_oauth | etc.
    mfa_level           INTEGER NOT NULL DEFAULT 0,           -- 0=none 1=single 2=two 3=mfa+device
    status              TEXT NOT NULL DEFAULT 'active',       -- active | expired | revoked | refreshed
    ip_address          TEXT,
    device_fingerprint  TEXT,                                 -- Hashed device fingerprint
    user_agent          TEXT,
    risk_score          REAL DEFAULT 0,                       -- 0.0 – 1.0 session risk
    started_at          TEXT NOT NULL,
    expires_at          TEXT NOT NULL,
    last_activity_at    TEXT NOT NULL,
    metadata            TEXT DEFAULT '{}',                    -- JSON
    consent_snapshot    TEXT DEFAULT '{}',                    -- JSON: snapshot of active consents
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_sessions_identity ON identity_sessions(identity_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON identity_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON identity_sessions(expires_at);

-- ============================================================================
-- TABLE: identity_credentials
-- ============================================================================
-- Credential lifecycle tracking. Supports rotation, expiry, and revocation.
-- Tokens/passwords are always hashed before storage.
-- ============================================================================
CREATE TABLE IF NOT EXISTS identity_credentials (
    id                TEXT PRIMARY KEY,
    identity_id       TEXT NOT NULL,
    credential_type   TEXT NOT NULL,                        -- password_hash | refresh_token | api_token | oauth_access_token | oauth_refresh_token | session_token | magic_link_token | verification_token
    credential_hash   TEXT NOT NULL,                        -- SHA-256 hash of the credential
    expires_at        TEXT,                                 -- ISO 8601 UTC; NULL = no expiry
    rotated_at        TEXT,                                 -- ISO 8601 UTC; when this credential was rotated
    revoked_at        TEXT,                                 -- ISO 8601 UTC; when this credential was revoked
    created_at        TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_credentials_identity ON identity_credentials(identity_id);

-- ============================================================================
-- TABLE: refresh_tokens
-- ============================================================================
-- Refresh token lifecycle with rotation tracking.
-- Token values are always SHA-256 hashed before storage.
-- Rotation: each use creates a new token and replaces the old one.
-- ============================================================================
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,                   -- SHA-256 of refresh token
    expires_at      TEXT NOT NULL,
    revoked_at      TEXT,                                   -- ISO 8601 UTC
    created_at      TEXT NOT NULL,
    replaced_by     TEXT,                                   -- Token ID that replaced this one (rotation chain)
    FOREIGN KEY (identity_id) REFERENCES identities(id),
    FOREIGN KEY (session_id) REFERENCES identity_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_identity ON refresh_tokens(identity_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);

-- ============================================================================
-- TABLE: email_verifications
-- ============================================================================
-- Email verification tokens. One-time use, time-limited.
-- ============================================================================
CREATE TABLE IF NOT EXISTS email_verifications (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    email           TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,                   -- SHA-256 of verification token
    expires_at      TEXT NOT NULL,
    verified_at     TEXT,                                   -- ISO 8601 UTC; NULL until verified
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_email_verifications_hash ON email_verifications(token_hash);

-- ============================================================================
-- TABLE: password_resets
-- ============================================================================
-- Password reset tokens. One-time use, time-limited.
-- ============================================================================
CREATE TABLE IF NOT EXISTS password_resets (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    token_hash      TEXT NOT NULL UNIQUE,                   -- SHA-256 of reset token
    expires_at      TEXT NOT NULL,
    used_at         TEXT,                                   -- ISO 8601 UTC; NULL until used
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_password_resets_hash ON password_resets(token_hash);

-- ============================================================================
-- TABLE: oauth_accounts
-- ============================================================================
-- OAuth account links — associates external provider accounts with platform identities.
-- ============================================================================
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    provider_id     TEXT NOT NULL,                          -- FK → identity_providers.id
    subject_id      TEXT NOT NULL,                          -- Provider-internal user/subject ID
    email           TEXT,
    display_name    TEXT,
    access_token    TEXT,                                   -- Encrypted at rest via Workers secrets
    refresh_token   TEXT,                                   -- Encrypted at rest via Workers secrets
    token_expires_at TEXT,                                  -- ISO 8601 UTC
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id),
    FOREIGN KEY (provider_id) REFERENCES identity_providers(id),
    UNIQUE(provider_id, subject_id)
);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_identity ON oauth_accounts(identity_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider_id, subject_id);

-- ============================================================================
-- TABLE: identity_events
-- ============================================================================
-- Security-relevant identity events for monitoring and analysis.
-- Append-only log.
-- ============================================================================
CREATE TABLE IF NOT EXISTS identity_events (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT,
    event_type      TEXT NOT NULL,                          -- identity.created | login.failed | etc.
    severity        TEXT NOT NULL DEFAULT 'INFO',           -- DEBUG | INFO | WARN | ERROR | CRITICAL
    details         TEXT DEFAULT '{}',                      -- JSON: event-specific data
    ip_address      TEXT,
    user_agent      TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_events_identity ON identity_events(identity_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON identity_events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_created ON identity_events(created_at);

-- ============================================================================
-- TABLE: identity_audit
-- ============================================================================
-- Audit trail for identity operations. Append-only.
-- Captures who did what, when, and the outcome.
-- ============================================================================
CREATE TABLE IF NOT EXISTS identity_audit (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT,
    action          TEXT NOT NULL,                          -- identity.register | identity.login | etc.
    resource_type   TEXT NOT NULL,                          -- identity | session | credential | etc.
    resource_id     TEXT,                                   -- UUID of the affected resource
    outcome         TEXT NOT NULL,                          -- SUCCESS | FAILURE | REVOKED
    reason          TEXT,                                   -- Human-readable reason for outcome
    ip_address      TEXT,
    session_id      TEXT,
    metadata        TEXT DEFAULT '{}',                      -- JSON: extensible audit data
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_audit_identity ON identity_audit(identity_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON identity_audit(action);
CREATE INDEX IF NOT EXISTS idx_audit_created ON identity_audit(created_at);

-- ============================================================================
-- TABLE: trust_snapshots
-- ============================================================================
-- Trust snapshots captured at authentication time.
-- Used for Zero Trust evaluation and session validation.
-- ============================================================================
CREATE TABLE IF NOT EXISTS trust_snapshots (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    trust_score     REAL NOT NULL,                          -- 0.0 – 1.0
    trust_level     TEXT NOT NULL,                          -- low | medium | high
    factors         TEXT NOT NULL DEFAULT '[]',             -- JSON array of TrustFactor
    expires_at      TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id),
    FOREIGN KEY (session_id) REFERENCES identity_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_trust_identity ON trust_snapshots(identity_id);
CREATE INDEX IF NOT EXISTS idx_trust_session ON trust_snapshots(session_id);

-- ============================================================================
-- TABLE: consent_snapshots
-- ============================================================================
-- Consent snapshots captured at authentication time.
-- Records which consents were active when the session was created.
-- ============================================================================
CREATE TABLE IF NOT EXISTS consent_snapshots (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    session_id      TEXT NOT NULL,
    consent_type    TEXT NOT NULL,                          -- auth_session | data_processing | etc.
    granted         INTEGER NOT NULL DEFAULT 0,             -- 0/1 boolean
    snapshot_data   TEXT DEFAULT '{}',                      -- JSON: consent details
    expires_at      TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id),
    FOREIGN KEY (session_id) REFERENCES identity_sessions(id)
);

CREATE INDEX IF NOT EXISTS idx_consent_identity ON consent_snapshots(identity_id);
CREATE INDEX IF NOT EXISTS idx_consent_session ON consent_snapshots(session_id);