-- ============================================================================
-- AG Synergy Platform — Initial Database Schema
-- ============================================================================
-- Migration: 0001_initial_schema.sql
-- Phase: 1 — Concierge Platform Foundation
-- Created: 2026-07-18
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: Schema governed by docs/decisions/ (future ADR for schema changes)
-- ============================================================================
-- Design Reference: docs/database/DATABASE_DESIGN.md v1.0
-- ============================================================================
--
-- Migration Philosophy:
--   - Forward-only: no rollback migrations. Fix schema with new migrations.
--   - TEXT UUIDs for all primary keys (D1/SQLite-friendly, no auto-increment).
--   - ISO-8601 UTC timestamps for all date/time columns.
--   - INTEGER 0/1 for booleans (SQLite convention).
--   - Minimal, intentional indexing — only where query patterns demand it.
--   - Foreign keys defined for structural clarity; enforcement requires
--     PRAGMA foreign_keys = ON in the Worker at connection time.

-- ============================================================================
-- PRAGMA: Enable foreign key support
-- ============================================================================
-- D1 does not enforce foreign keys by default. This pragma is set at connection
-- time by the Worker, not persisted. Included here for documentation and for
-- local SQLite tooling that respects PRAGMAs during migration application.
PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: leads
-- ============================================================================
-- Inbound consultation inquiries from the marketing website. A lead is
-- created when a visitor submits the consultation request form.
-- Represents an unqualified, uncontacted inquiry.
--
-- Lifecycle: new → contacted → qualified (→ converts to contact) | disqualified
-- ============================================================================

CREATE TABLE IF NOT EXISTS leads (
    id          TEXT PRIMARY KEY,          -- UUID v4
    name        TEXT NOT NULL,             -- Submitter's full name
    email       TEXT NOT NULL,             -- Submitter's email address
    phone       TEXT,                      -- Optional phone number
    preferred_contact_method TEXT,         -- 'email' | 'phone' | 'either'
    treatment_interest TEXT,               -- Free-text: what treatment/service they inquired about
    message     TEXT,                      -- Optional message from the inquiry form
    status      TEXT NOT NULL DEFAULT 'new', -- new | contacted | qualified | disqualified
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: lookup by email (dedup, follow-up)
CREATE INDEX IF NOT EXISTS idx_leads_email ON leads(email);

-- Query pattern: filter by status (dashboard, reporting)
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);

-- ============================================================================
-- TABLE: contacts
-- ============================================================================
-- Vetted, contacted individuals who have engaged with the platform.
-- A contact is created when a lead is qualified — a real person has been
-- reached and has expressed genuine interest. Contacts persist across
-- multiple consultations.
--
-- Relationship to leads: soft link (lead_id). Not a hard FK because:
--   - Leads may be deleted/archived independently.
--   - Not all contacts originate from the web form (manual entry, imports).
--   - Keeps the migration simple and avoids cascade complexity.
-- ============================================================================

CREATE TABLE IF NOT EXISTS contacts (
    id          TEXT PRIMARY KEY,          -- UUID v4
    lead_id     TEXT,                      -- Soft reference to leads(id) — may be NULL
    name        TEXT NOT NULL,             -- Contact's full name
    email       TEXT NOT NULL,             -- Contact's email address
    phone       TEXT,                      -- Optional phone number
    preferred_contact_method TEXT,         -- 'email' | 'phone' | 'either'
    status      TEXT NOT NULL DEFAULT 'active', -- active | inactive
    notes       TEXT,                      -- Internal notes about this contact
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: lookup by email (primary lookup key for contacts)
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email);

-- Query pattern: filter by status (active/inactive segmentation)
CREATE INDEX IF NOT EXISTS idx_contacts_status ON contacts(status);

-- ============================================================================
-- TABLE: clinics
-- ============================================================================
-- Directory of partner fertility clinics. A clinic is a physical location
-- where consultations and treatments occur.
-- Phase 1: reference data with limited rows (<50 clinics expected).
-- ============================================================================

CREATE TABLE IF NOT EXISTS clinics (
    id          TEXT PRIMARY KEY,          -- UUID v4
    name        TEXT NOT NULL,             -- Clinic name (e.g., "Ottawa Fertility Centre")
    address     TEXT,                      -- Physical address
    phone       TEXT,                      -- Clinic phone number
    email       TEXT,                      -- Clinic contact email
    website     TEXT,                      -- Clinic website URL
    is_active   INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = inactive
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: lookup by name (frequent reference in consultation workflows)
CREATE INDEX IF NOT EXISTS idx_clinics_name ON clinics(name);

-- ============================================================================
-- TABLE: consultations
-- ============================================================================
-- Core business event: scheduled and completed consultation appointments.
-- Connects a contact with a clinic at a specific date/time.
--
-- Foreign keys:
--   - contact_id → contacts(id) — which person is being consulted
--   - clinic_id  → clinics(id)  — where the consultation takes place
-- ============================================================================

CREATE TABLE IF NOT EXISTS consultations (
    id          TEXT PRIMARY KEY,          -- UUID v4
    contact_id  TEXT NOT NULL,             -- FK → contacts(id)
    clinic_id   TEXT NOT NULL,             -- FK → clinics(id)
    scheduled_at TEXT NOT NULL,            -- ISO 8601 UTC — when the consultation is scheduled
    status      TEXT NOT NULL DEFAULT 'scheduled', -- scheduled | completed | cancelled | no_show
    notes       TEXT,                      -- Internal notes (no clinical/medical data)
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL,             -- ISO 8601 UTC

    FOREIGN KEY (contact_id) REFERENCES contacts(id),
    FOREIGN KEY (clinic_id)  REFERENCES clinics(id)
);

-- Query pattern: filter by status (scheduled/completed/cancelled dashboard views)
CREATE INDEX IF NOT EXISTS idx_consultations_status ON consultations(status);

-- Query pattern: find consultations by contact (contact history view)
CREATE INDEX IF NOT EXISTS idx_consultations_contact_id ON consultations(contact_id);

-- Query pattern: find consultations by clinic (clinic schedule view)
CREATE INDEX IF NOT EXISTS idx_consultations_clinic_id ON consultations(clinic_id);

-- Query pattern: upcoming consultations sorted by date (dashboard, reminders)
CREATE INDEX IF NOT EXISTS idx_consultations_scheduled_at ON consultations(scheduled_at);

-- ============================================================================
-- TABLE: services
-- ============================================================================
-- Catalog of fertility services and treatments offered by partner clinics.
-- Phase 1: read-only reference data. Many-to-many relationship with clinics
-- via a junction table arrives in Phase 2.
-- ============================================================================

CREATE TABLE IF NOT EXISTS services (
    id          TEXT PRIMARY KEY,          -- UUID v4
    name        TEXT NOT NULL,             -- Service name (e.g., "IVF Consultation")
    description TEXT,                      -- Brief description of the service
    category    TEXT,                      -- Grouping: 'consultation', 'diagnostic', 'treatment', 'support'
    is_active   INTEGER NOT NULL DEFAULT 1, -- 1 = active/displayed, 0 = inactive/hidden
    sort_order  INTEGER DEFAULT 0,         -- Display order (ascending)
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: filter by active services for public-facing display
CREATE INDEX IF NOT EXISTS idx_services_active ON services(is_active);

-- Query pattern: group by category (service catalog views)
CREATE INDEX IF NOT EXISTS idx_services_category ON services(category);

-- ============================================================================
-- TABLE: faqs
-- ============================================================================
-- Frequently asked questions displayed on the marketing website and used
-- by the concierge team as a knowledge base.
-- Standalone content entity — no FK relationships.
-- ============================================================================

CREATE TABLE IF NOT EXISTS faqs (
    id          TEXT PRIMARY KEY,          -- UUID v4
    question    TEXT NOT NULL,             -- The FAQ question
    answer      TEXT NOT NULL,             -- The FAQ answer (markdown-supported)
    category    TEXT,                      -- Grouping: 'general', 'services', 'cost', 'process', 'medical'
    sort_order  INTEGER DEFAULT 0,         -- Display order within category (ascending)
    is_published INTEGER NOT NULL DEFAULT 1, -- 1 = published, 0 = draft/hidden
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: published FAQs sorted by category + order (website display)
CREATE INDEX IF NOT EXISTS idx_faqs_published_category ON faqs(is_published, category);

-- ============================================================================
-- Migration complete.
-- Total tables: 6 (leads, contacts, clinics, consultations, services, faqs)
-- Total indexes: 14
-- Foreign keys: 2 (consultations → contacts, consultations → clinics)
-- Soft links: 1 (contacts.lead_id → leads.id)
-- ============================================================================