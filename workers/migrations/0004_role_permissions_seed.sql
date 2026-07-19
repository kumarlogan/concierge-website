-- ============================================================================
-- AG Synergy Platform — Role Permission Grants (data-driven RBAC)
-- ============================================================================
-- Migration: 0004_role_permissions_seed.sql
-- Phase: 2 — Operations Platform Foundation (EPIC-002)
-- Created: 2026-07-18
-- Database: Cloudflare D1 (agsynergy-db)
-- Depends on: 0002_rbac_foundation.sql (roles, permissions, user_permissions)
-- ADR: ADR-003 (Deny-Wins RBAC Model)
-- ============================================================================
-- WHY THIS MIGRATION EXISTS
-- ----------------------------------------------------------------------------
-- The Identity & Authorization Engine (src/auth/permissions.ts) resolves a
-- principal's effective permissions ENTIRELY from data:
--
--     effective = role_permissions(role) ∪ user_permissions(grants)
--                  − user_permissions(revokes)
--
-- It reads role grants from the `role_permissions` table (NEVER a code
-- constant). Migration 0002 created the RBAC tables and *documented* the
-- canonical role→permission mapping in a comment, but did not materialize it
-- as rows. Without this migration, every non-OWNER principal would resolve to
-- an empty permission set and be denied by the middleware. This migration
-- makes the mapping real, queryable data — the single source of truth.
-- ============================================================================
-- PRAGMA: Enable foreign key support (for local SQLite tooling)
-- ============================================================================
PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: role_permissions
-- ============================================================================
-- The canonical group-grant layer. Each row says "role X holds permission Y".
-- OWNER is intentionally absent (the engine short-circuits OWNER to all
-- permissions — see permissions.ts — so it needs no rows here).
-- ============================================================================
CREATE TABLE IF NOT EXISTS role_permissions (
    id            TEXT PRIMARY KEY,          -- UUID v4
    role_id       TEXT NOT NULL,             -- FK → roles(id)
    permission_id TEXT NOT NULL,             -- FK → permissions(id)
    created_at    TEXT NOT NULL,             -- ISO 8601 UTC

    FOREIGN KEY (role_id) REFERENCES roles(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id),

    UNIQUE (role_id, permission_id)
);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role
    ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_perm
    ON role_permissions(permission_id);

-- ============================================================================
-- SEED DATA: role → permission grants
-- ============================================================================
-- Role UUIDs and permission UUIDs are the fixed seed values from migration
-- 0002_rbac_foundation.sql. This is the authoritative, data-driven mapping
-- (previously only described in a comment in 0002).
--
--   ADMIN      → every permission (platform administration)
--   OPERATIONS → leads.read, leads.update, leads.assign,
--                consultations.read, consultations.update
--   VIEWER     → leads.read, consultations.read, audit.read
--   OWNER      → (implicit superuser — no rows)
-- ============================================================================
INSERT INTO role_permissions (id, role_id, permission_id, created_at) VALUES
    -- ADMIN (id ...002) — full administrative capability
    ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000101', '2026-07-18T00:00:00Z'), -- leads.read
    ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000102', '2026-07-18T00:00:00Z'), -- leads.update
    ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000103', '2026-07-18T00:00:00Z'), -- leads.assign
    ('10000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000104', '2026-07-18T00:00:00Z'), -- consultations.read
    ('10000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000105', '2026-07-18T00:00:00Z'), -- consultations.update
    ('10000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000106', '2026-07-18T00:00:00Z'), -- users.manage
    ('10000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000107', '2026-07-18T00:00:00Z'), -- roles.manage
    ('10000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000108', '2026-07-18T00:00:00Z'), -- audit.read

    -- OPERATIONS (id ...003) — day-to-day lead & consultation management
    ('10000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000101', '2026-07-18T00:00:00Z'), -- leads.read
    ('10000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000102', '2026-07-18T00:00:00Z'), -- leads.update
    ('10000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000103', '2026-07-18T00:00:00Z'), -- leads.assign
    ('10000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000104', '2026-07-18T00:00:00Z'), -- consultations.read
    ('10000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000105', '2026-07-18T00:00:00Z'), -- consultations.update

    -- VIEWER (id ...004) — read-only oversight
    ('10000000-0000-0000-0000-000000000021', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000101', '2026-07-18T00:00:00Z'), -- leads.read
    ('10000000-0000-0000-0000-000000000022', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000104', '2026-07-18T00:00:00Z'), -- consultations.read
    ('10000000-0000-0000-0000-000000000023', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000108', '2026-07-18T00:00:00Z'); -- audit.read

-- ============================================================================
-- Migration complete.
-- Total tables added: 1 (role_permissions)
-- Seed rows: 16 role→permission grants across ADMIN / OPERATIONS / VIEWER
-- OWNER intentionally has no rows (implicit superuser short-circuit).
-- ============================================================================
