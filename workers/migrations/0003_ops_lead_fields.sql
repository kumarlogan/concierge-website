-- ============================================================================
-- AG Synergy Platform — Operations API Lead Fields
-- ============================================================================
-- Migration: 0003_ops_lead_fields.sql
-- Phase: 2 — Operations Platform Foundation (EPIC-002-003A)
-- Created: 2026-07-18
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: ADR-002 (Multi-Agent Operations Architecture)
-- ============================================================================
-- Design Reference: docs/database/RBAC_DESIGN.md v1.0
-- ============================================================================
--
-- Scope of this migration:
--   Additive fields to the existing `leads` table required by the Operations
--   API (EPIC-002-003A). The Operations interface lets operations staff claim,
--   prioritise, annotate, and advance leads through their lifecycle.
--
-- Additions:
--   leads.assigned_to  TEXT  — FK → users(id). Soft link (nullable). The
--                             operations staff member currently handling the
--                             lead. NULL = unassigned / pool.
--   leads.priority     TEXT  — 'low' | 'normal' | 'high' | 'urgent'.
--                             Triage signal for the ops queue. Default 'normal'.
--   leads.notes        TEXT  — Internal operations notes (no PHI/clinical data).
--
-- No existing columns are modified or removed — forward-only, additive.
-- The `assigned_to` soft link mirrors the contacts.lead_id pattern: leads may
-- outlive user records, and assignment is operational metadata, not a hard
-- structural dependency, so no hard FK is enforced (D1 FK enforcement is
-- opt-in anyway).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ── Add columns to leads ───────────────────────────────────────────────────
-- SQLite supports ADD COLUMN for these shapes without table rebuild issues.
ALTER TABLE leads ADD COLUMN assigned_to TEXT;          -- → users(id), soft link
ALTER TABLE leads ADD COLUMN priority    TEXT NOT NULL DEFAULT 'normal';
ALTER TABLE leads ADD COLUMN notes       TEXT;

-- ── Indexes for Operations API query patterns ───────────────────────────────
-- Filter the ops queue by assignee ("my leads" vs unassigned pool)
CREATE INDEX IF NOT EXISTS idx_leads_assigned_to ON leads(assigned_to);

-- Triage / queue ordering by priority
CREATE INDEX IF NOT EXISTS idx_leads_priority ON leads(priority);

-- Assignment + status together (ops dashboard queue)
CREATE INDEX IF NOT EXISTS idx_leads_assigned_status
    ON leads(assigned_to, status);

-- ── Migration complete ──────────────────────────────────────────────────────
-- Columns added to leads: 3 (assigned_to, priority, notes)
-- Indexes added: 3
-- Existing tables/columns: UNCHANGED
-- ============================================================================
