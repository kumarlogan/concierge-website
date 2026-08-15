-- ┌─────────────────────────────────────────────────────────────┐
-- │ AG Synergy Platform — Contact Submissions Schema Migration  │
-- │ Phase P.1 Remediation: Missing table fix                    │
-- └─────────────────────────────────────────────────────────────┘
--
-- Migration: 0016_contact_submissions.sql
-- Phase: P.1 — Contact migration remediation
-- Created: 2026-08-15
-- Database: Cloudflare D1 (agsynergy-db)
--
-- Context:
--   The contact form route (workers/src/routes/contact.ts) references
--   contact_submissions table, but no migration ever created it in
--   the production D1 schema. This is a pre-existing defect that
--   causes POST /api/v1/contact to return server_error.
--
-- This migration creates the table using the EXACT schema implied by
-- the existing contact.ts INSERT statement:
--   INSERT INTO contact_submissions (name, email, phone, message, created_at)
--   VALUES (?, ?, ?, ?, datetime('now'))
--
-- Conventions follow migration 0001_initial_schema.sql:
--   - INTEGER PRIMARY KEY AUTOINCREMENT (consistent with SQLite rowid)
--   - datetime('now') for created_at (as used in the route)
--   - message is nullable (message || null in the bind)
--   - name, email, phone are NOT NULL (validated by isContactBody)

PRAGMA foreign_keys = ON;

-- ── TABLE: contact_submissions ───────────────────────────────
CREATE TABLE IF NOT EXISTS contact_submissions (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,  -- Row ID — matches result.meta.last_row_id
    name        TEXT NOT NULL,                       -- Submitter's full name
    email       TEXT NOT NULL,                       -- Submitter's email (for follow-up)
    phone       TEXT NOT NULL,                       -- Submitter's phone number
    message     TEXT,                                -- Optional message body
    created_at  TEXT NOT NULL                        -- ISO 8601 UTC timestamp (datetime('now'))
);

-- Query pattern: find submissions by email (follow-up, dedup)
CREATE INDEX IF NOT EXISTS idx_contact_submissions_email ON contact_submissions(email);

-- Query pattern: sort by created_at (admin dashboard, recent submissions)
CREATE INDEX IF NOT EXISTS idx_contact_submissions_created_at ON contact_submissions(created_at);

-- Migration complete.
-- Table: contact_submissions (1)
-- Indexes: 2 (idx_contact_submissions_email, idx_contact_submissions_created_at)
