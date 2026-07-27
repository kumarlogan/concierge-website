-- ===========================================================================
-- AI Platform Trust Runtime — Database Schema
-- ===========================================================================
-- Migration: 0006_trust_runtime.sql
-- Phase: 2 — Wave 4: AI Platform Trust Runtime v1
-- Created: 2026-07-26
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: ADR-010, ADR-011
-- ===========================================================================
--
-- Migration Philosophy:
--   - PHI Boundary: Trust Runtime tables store NO personal health information.
--     PHI references are opaque IDs only — never payloads.
--   - Separate encryption boundaries: trust/consent data uses separate keys.
--   - TEXT UUIDs for all primary keys (D1/SQLite-friendly, no auto-increment).
--   - ISO-8601 UTC timestamps for all date/time columns.
--   - INTEGER 0/1 for booleans (SQLite convention).
--   - JSON for flexible metadata; never embed PHI in JSON.
--   - Append-only audit tables: no UPDATE, no DELETE.
--   - All foreign keys use TEXT UUIDs referencing identity primitives.
-- ===========================================================================

PRAGMA foreign_keys = ON;

-- ===========================================================================
-- TABLE: policies
-- ===========================================================================
-- Central policy registry. Each policy is a named, versioned rule set.
-- Policies are product-agnostic and reusable across all AGS products.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS policies (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    name            TEXT NOT NULL UNIQUE,
    description     TEXT DEFAULT '',
    category        TEXT NOT NULL,                          -- rbac | abac | rebac | time | location | device | risk | purpose | emergency | maintenance
    version         INTEGER NOT NULL DEFAULT 1,
    enabled         INTEGER NOT NULL DEFAULT 1,             -- 0/1 boolean
    fail_closed     INTEGER NOT NULL DEFAULT 1,             -- 0/1 boolean (always DENY default)
    precedence      INTEGER NOT NULL DEFAULT 0,             -- lower number = higher priority
    content         TEXT NOT NULL DEFAULT '{}',             -- JSON: policy rule definitions
    metadata        TEXT DEFAULT '{}',                      -- JSON: extensible, NO PHI
    created_at      TEXT NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policies_category ON policies(category);
CREATE INDEX IF NOT EXISTS idx_policies_enabled ON policies(enabled);
CREATE INDEX IF NOT EXISTS idx_policies_precedence ON policies(precedence);

-- ===========================================================================
-- TABLE: policy_versions
-- ===========================================================================
-- Version history for every policy change. Append-only audit trail.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS policy_versions (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    policy_id       TEXT NOT NULL,
    version         INTEGER NOT NULL,
    content         TEXT NOT NULL,                         -- JSON: policy content at this version
    changed_by      TEXT NOT NULL,                         -- identity_id of the changer
    change_reason   TEXT DEFAULT '',
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL,
    FOREIGN KEY (policy_id) REFERENCES policies(id)
);

CREATE INDEX IF NOT EXISTS idx_policy_versions_policy ON policy_versions(policy_id);
CREATE INDEX IF NOT EXISTS idx_policy_versions_version ON policy_versions(policy_id, version);

-- ===========================================================================
-- TABLE: consents
-- ===========================================================================
-- Immutable consent records. Every consent grant/revoke creates a new row.
-- Never UPDATE existing rows — append only.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS consents (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    identity_id     TEXT NOT NULL,
    consent_type    TEXT NOT NULL,                          -- medical_treatment | privacy | marketing | research | document_sharing | clinic_sharing | international_transfer | ai_assistance | delegated_caregiver
    granted         INTEGER NOT NULL,                       -- 0 = denied, 1 = granted, 2 = withdrawn
    scope           TEXT DEFAULT '',                        -- JSON array of resource scopes
    purpose         TEXT DEFAULT '',                        -- purpose-of-use descriptor
    source          TEXT DEFAULT '',                        -- how consent was obtained (explicit | implicit | emergency | delegation)
    delegator_id    TEXT,                                   -- identity_id of delegating party (if delegated)
    expires_at      TEXT,                                   -- ISO 8601 UTC; NULL = no expiry
    version         INTEGER NOT NULL DEFAULT 1,
    metadata        TEXT DEFAULT '{}',                      -- JSON: NO PHI
    created_at      TEXT NOT NULL,
    revoked_at      TEXT,                                   -- ISO 8601 UTC; NULL if not withdrawn
    version_token   TEXT NOT NULL DEFAULT '',               -- integrity hash of consent snapshot
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_consents_identity ON consents(identity_id);
CREATE INDEX IF NOT EXISTS idx_consents_type ON consents(consent_type);
CREATE INDEX IF NOT EXISTS idx_consents_identity_type ON consents(identity_id, consent_type);
CREATE INDEX IF NOT EXISTS idx_consents_expires ON consents(expires_at);

-- ===========================================================================
-- TABLE: consent_versions
-- ===========================================================================
-- Version history for consent changes. Append-only audit trail.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS consent_versions (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    consent_id      TEXT NOT NULL,
    version         INTEGER NOT NULL,
    identity_id     TEXT NOT NULL,
    consent_type    TEXT NOT NULL,
    granted         INTEGER NOT NULL,
    scope           TEXT DEFAULT '',
    purpose         TEXT DEFAULT '',
    source          TEXT DEFAULT '',
    delegator_id    TEXT,
    expires_at      TEXT,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL,
    changed_by      TEXT NOT NULL,                          -- identity_id of who made the change
    change_reason   TEXT DEFAULT '',
    FOREIGN KEY (consent_id) REFERENCES consents(id)
);

CREATE INDEX IF NOT EXISTS idx_consent_versions_consent ON consent_versions(consent_id);
CREATE INDEX IF NOT EXISTS idx_consent_versions_identity ON consent_versions(identity_id);

-- ===========================================================================
-- TABLE: trust_scores
-- ===========================================================================
-- Current trust score per identity. Most recent snapshot.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS trust_scores (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    identity_id     TEXT NOT NULL,
    session_id      TEXT,                                   -- optional session binding
    trust_score     REAL NOT NULL,                          -- 0.0 – 1.0
    trust_level     TEXT NOT NULL,                          -- critical | low | medium | high | elevated
    factors         TEXT NOT NULL DEFAULT '[]',             -- JSON array of TrustFactor
    identity_confidence REAL DEFAULT 0.5,
    auth_strength   REAL DEFAULT 0.5,
    mfa_status      INTEGER NOT NULL DEFAULT 0,             -- 0/1 boolean
    device_trust    REAL DEFAULT 0.5,
    network_trust   REAL DEFAULT 0.5,
    behavioral_trust REAL DEFAULT 0.5,
    session_trust   REAL DEFAULT 0.5,
    credential_age  REAL DEFAULT 1.0,
    risk_history    REAL DEFAULT 0.5,
    administrative_override TEXT DEFAULT '',                -- JSON: override details
    expires_at      TEXT,                                   -- ISO 8601 UTC
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_trust_scores_identity ON trust_scores(identity_id);
CREATE INDEX IF NOT EXISTS idx_trust_scores_level ON trust_scores(trust_level);

-- ===========================================================================
-- TABLE: trust_history
-- ===========================================================================
-- Append-only历史: every trust score change is recorded.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS trust_history (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    identity_id     TEXT NOT NULL,
    trust_score     REAL NOT NULL,
    trust_level     TEXT NOT NULL,
    factor_name     TEXT,                                   -- which factor changed
    old_score       REAL,
    new_score       REAL,
    reason          TEXT DEFAULT '',
    session_id      TEXT,
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_trust_history_identity ON trust_history(identity_id);
CREATE INDEX IF NOT EXISTS idx_trust_history_created ON trust_history(created_at);

-- ===========================================================================
-- TABLE: delegations
-- ===========================================================================
-- Delegated authorization records. Defines what a delegatee can do on behalf of a delegator.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS delegations (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    delegator_id    TEXT NOT NULL,                          -- the identity granting authority
    delegatee_id    TEXT NOT NULL,                          -- the identity receiving authority
    scope           TEXT NOT NULL,                          -- JSON array of permitted actions/resources
    type            TEXT NOT NULL,                          -- patient_to_concierge | patient_to_family | patient_to_clinic | admin_to_workforce | platform_to_ai_worker
    expires_at      TEXT NOT NULL,                          -- ISO 8601 UTC
    revoked_at      TEXT,                                   -- ISO 8601 UTC; NULL if not revoked
    max_privilege   TEXT DEFAULT 'same_as_owner',           -- same_as_owner | limited | scoped
    constraints     TEXT DEFAULT '{}',                      -- JSON: time limits, location, device, purpose restrictions
    approval_chain  TEXT DEFAULT '[]',                      -- JSON array of approval identity_ids
    audit_tag       TEXT DEFAULT '',                        -- human-readable tag for audit trail
    metadata        TEXT DEFAULT '{}',                      -- JSON: NO PHI
    created_at      TEXT NOT NULL,
    FOREIGN KEY (delegator_id) REFERENCES identities(id),
    FOREIGN KEY (delegatee_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_delegations_delegator ON delegations(delegator_id);
CREATE INDEX IF NOT EXISTS idx_delegations_delegatee ON delegations(delegatee_id);
CREATE INDEX IF NOT EXISTS idx_delegations_type ON delegations(type);
CREATE INDEX IF NOT EXISTS idx_delegations_expires ON delegations(expires_at);
CREATE INDEX IF NOT EXISTS idx_delegations_active ON delegations(revoked_at);

-- ===========================================================================
-- TABLE: authorization_decisions
-- ===========================================================================
-- Every authorization decision is permanently recorded.
-- Append-only. No UPDATE, no DELETE.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS authorization_decisions (
    id                  TEXT PRIMARY KEY,                 -- UUID v4
    correlation_id      TEXT NOT NULL,
    identity_id         TEXT NOT NULL,
    session_id          TEXT,
    trust_score_id      TEXT,
    consent_snapshot_id TEXT,
    policy_snapshot_id  TEXT,
    resource            TEXT NOT NULL,
    action              TEXT NOT NULL,
    decision            TEXT NOT NULL,                     -- ALLOW | DENY | CONDITIONAL
    reason              TEXT NOT NULL,
    trust_score         REAL DEFAULT 0.0,
    risk_score          REAL DEFAULT 0.0,
    delegation_chain    TEXT DEFAULT '[]',                 -- JSON: chain of delegations in effect
    policy_evaluated    TEXT NOT NULL DEFAULT '{}',        -- JSON: which policies were evaluated
    consent_evaluated   TEXT NOT NULL DEFAULT '{}',        -- JSON: which consents were evaluated
    execution_time_ms   INTEGER DEFAULT 0,
    created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_auth_decisions_identity ON authorization_decisions(identity_id);
CREATE INDEX IF NOT EXISTS idx_auth_decisions_correlation ON authorization_decisions(correlation_id);
CREATE INDEX IF NOT EXISTS idx_auth_decisions_resource ON authorization_decisions(resource, action);
CREATE INDEX IF NOT EXISTS idx_auth_decisions_decision ON authorization_decisions(decision);
CREATE INDEX IF NOT EXISTS idx_auth_decisions_created ON authorization_decisions(created_at);

-- ===========================================================================
-- TABLE: decision_audit
-- ===========================================================================
-- Extended audit trail for authorization decisions. Full context capture.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS decision_audit (
    id                  TEXT PRIMARY KEY,                 -- UUID v4
    decision_id         TEXT NOT NULL,                     -- FK → authorization_decisions.id
    identity_id         TEXT NOT NULL,
    resource            TEXT NOT NULL,
    action              TEXT NOT NULL,
    decision            TEXT NOT NULL,
    consent_snapshot    TEXT DEFAULT '{}',                  -- JSON: full consent snapshot at decision time
    policy_snapshot     TEXT DEFAULT '{}',                  -- JSON: full policy snapshot at decision time
    trust_snapshot      TEXT DEFAULT '{}',                  -- JSON: full trust snapshot at decision time
    risk_factors        TEXT DEFAULT '{}',                  -- JSON: risk evaluation details
    context             TEXT DEFAULT '{}',                  -- JSON: request context (time, location, device, etc.)
    delegation_chain    TEXT DEFAULT '[]',                  -- JSON
    created_at          TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_decision_audit_decision ON decision_audit(decision_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_identity ON decision_audit(identity_id);
CREATE INDEX IF NOT EXISTS idx_decision_audit_created ON decision_audit(created_at);

-- ===========================================================================
-- TABLE: risk_events
-- ===========================================================================
-- Risk evaluation events for monitoring and analysis.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS risk_events (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    identity_id     TEXT NOT NULL,
    session_id      TEXT,
    risk_type       TEXT NOT NULL,                          -- auth_anomaly | policy_violation | consent_expired | trust_decay | delegation_expired | emergency_access | maintenance_override
    severity        TEXT NOT NULL,                          -- low | medium | high | critical
    score           REAL DEFAULT 0.0,
    details         TEXT DEFAULT '{}',                      -- JSON
    resolved        INTEGER NOT NULL DEFAULT 0,             -- 0/1 boolean
    resolved_at     TEXT,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_risk_events_identity ON risk_events(identity_id);
CREATE INDEX IF NOT EXISTS idx_risk_events_type ON risk_events(risk_type);
CREATE INDEX IF NOT EXISTS idx_risk_events_severity ON risk_events(severity);
CREATE INDEX IF NOT EXISTS idx_risk_events_resolved ON risk_events(resolved);
CREATE INDEX IF NOT EXISTS idx_risk_events_created ON risk_events(created_at);

-- ===========================================================================
-- TABLE: policy_registry
-- ===========================================================================
-- Active policy index for fast lookup. Derived from policies table.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS policy_registry (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    policy_id       TEXT NOT NULL,
    category        TEXT NOT NULL,
    resource_pattern TEXT DEFAULT '',                      -- JSON: pattern for resource matching
    action_pattern  TEXT DEFAULT '',                      -- JSON: pattern for action matching
    active_version  INTEGER NOT NULL,
    updated_at      TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_policy_registry_category ON policy_registry(category);
CREATE INDEX IF NOT EXISTS idx_policy_registry_policy ON policy_registry(policy_id);

-- ===========================================================================
-- TABLE: consent_registry
-- ===========================================================================
-- Active consent index for fast lookup. Tracks current consent state.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS consent_registry (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    identity_id     TEXT NOT NULL,
    consent_type    TEXT NOT NULL,
    current_state   TEXT NOT NULL,                          -- granted | denied | withdrawn | expired
    expires_at      TEXT,
    version_token   TEXT NOT NULL,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_consent_registry_identity ON consent_registry(identity_id);
CREATE INDEX IF NOT EXISTS idx_consent_registry_type ON consent_registry(consent_type);
CREATE INDEX IF NOT EXISTS idx_consent_registry_state ON consent_registry(current_state);

-- ===========================================================================
-- TABLE: trust_registry
-- ===========================================================================
-- Current trust state index for fast lookup.
-- ===========================================================================
CREATE TABLE IF NOT EXISTS trust_registry (
    id              TEXT PRIMARY KEY,                     -- UUID v4
    identity_id     TEXT NOT NULL,
    trust_level     TEXT NOT NULL,
    trust_score     REAL NOT NULL,
    expires_at      TEXT,
    updated_at      TEXT NOT NULL,
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);

CREATE INDEX IF NOT EXISTS idx_trust_registry_identity ON trust_registry(identity_id);
CREATE INDEX IF NOT EXISTS idx_trust_registry_level ON trust_registry(trust_level);