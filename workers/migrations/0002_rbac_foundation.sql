-- ============================================================================
-- AG Synergy Platform — RBAC Security & Authorization Foundation
-- ============================================================================
-- Migration: 0002_rbac_foundation.sql
-- Phase: 2 — Operations Platform Foundation (EPIC-002)
-- Created: 2026-07-18
-- Database: Cloudflare D1 (agsynergy-db)
-- ADR: ADR-002 (Multi-Agent Operations Architecture) + ADR for RBAC schema
-- ============================================================================
-- Design Reference: docs/database/RBAC_DESIGN.md v1.0
-- ============================================================================
--
-- Scope of this migration:
--   Database foundation ONLY. Creates the tables and seed data required for
--   future role-based access control (RBAC). It does NOT:
--     - implement authentication flows
--     - create Telegram bots or dashboard components
--     - enforce authorization at the middleware layer (future EPIC-002 task)
--     - store PHI, medical, or clinical data
--
-- All future interfaces (Hermes Admin, Operations Bot, dashboard, mobile)
-- communicate ONLY through the Workers API. D1 remains accessible solely
-- through Worker services (see ADR-002). This migration merely lays the
-- storage foundation those interfaces will use.
--
-- Migration Philosophy (consistent with 0001):
--   - Forward-only: no rollback migrations.
--   - TEXT UUIDs for all primary keys.
--   - ISO-8601 UTC timestamps for all date/time columns.
--   - INTEGER 0/1 for booleans.
--   - Foreign keys defined for structural clarity; enforcement requires
--     PRAGMA foreign_keys = ON at connection time (set in the Worker).

-- ============================================================================
-- PRAGMA: Enable foreign key support (for local SQLite tooling)
-- ============================================================================
PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: roles
-- ============================================================================
-- Named access tiers for platform users. Roles are the coarse-grained unit
-- of authorization. The four seed roles define the platform's trust model:
--   OWNER      — full platform control (the account owner)
--   ADMIN      — administrative control short of owning the account
--   OPERATIONS — day-to-day lead/consultation management
--   VIEWER     — read-only access for reporting/oversight
--
-- A role is a stable, low-churn reference entity. Permissions are granted to
-- roles via the `permissions` mapping table (group permissions), and can be
-- further refined per-user via `user_permissions` (row-level overrides).
-- ============================================================================

CREATE TABLE IF NOT EXISTS roles (
    id          TEXT PRIMARY KEY,          -- UUID v4
    name        TEXT NOT NULL UNIQUE,      -- 'OWNER' | 'ADMIN' | 'OPERATIONS' | 'VIEWER'
    description TEXT,                      -- Human-readable purpose of the role
    is_system   INTEGER NOT NULL DEFAULT 1, -- 1 = seeded/system role (not deletable), 0 = custom
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: lookup role by stable name (auth checks resolve role_name → id)
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);

-- ============================================================================
-- TABLE: permissions
-- ============================================================================
-- Fine-grained capabilities the platform understands. Permissions use a
-- dot-namespaced key (e.g. `leads.read`) so they are both human-readable and
-- machine-checkable. Every authorization decision ultimately resolves to
-- "does this principal hold permission X?".
--
-- Initial permission set is scoped to the operations the platform needs for
-- EPIC-002:
--   leads.read, leads.update, leads.assign
--   consultations.read, consultations.update
--   users.manage, roles.manage
--   audit.read
--
-- These are seeded but NOT yet enforced — enforcement arrives with the
-- authorization middleware (future EPIC-002 task).
-- ============================================================================

CREATE TABLE IF NOT EXISTS permissions (
    id          TEXT PRIMARY KEY,          -- UUID v4
    key         TEXT NOT NULL UNIQUE,      -- dot-namespaced capability, e.g. 'leads.read'
    description TEXT,                      -- Human-readable description of the capability
    resource    TEXT NOT NULL,             -- namespace segment before the dot, e.g. 'leads'
    action      TEXT NOT NULL,             -- action segment after the dot, e.g. 'read'
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC
);

-- Query pattern: lookup permission by stable key (middleware resolves key → id)
CREATE INDEX IF NOT EXISTS idx_permissions_key ON permissions(key);

-- Query pattern: list permissions by resource namespace (UI grouping)
CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource);

-- ============================================================================
-- TABLE: users
-- ============================================================================
-- Human (or agent) principals who can access the platform. This is the
-- storage foundation only — NO authentication columns (password hash, tokens,
-- MFA) are included. Those arrive with the auth implementation (future phase).
--
-- Design notes:
--   - `external_id` is a soft reference to the external identity provider that
--     will issue this user's credentials (e.g. a Telegram user id, an SSO
--     subject, or a future auth service). Kept as a nullable TEXT so the table
--     does not depend on any one auth mechanism yet.
--   - A user has exactly ONE role (the coarse grant). Fine-grained overrides
--     live in `user_permissions`.
--   - `is_active` lets the platform disable a principal without deleting the
--     audit trail they produced.
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,          -- UUID v4
    role_id     TEXT NOT NULL,             -- FK → roles(id)
    external_id TEXT,                      -- Soft reference to external identity (Telegram id, SSO sub, etc.)
    display_name TEXT NOT NULL,            -- Human-friendly name shown in UI / audit trail
    email       TEXT,                      -- Optional contact email (no uniqueness constraint yet — auth not built)
    is_active   INTEGER NOT NULL DEFAULT 1, -- 1 = active, 0 = disabled (audit trail preserved)
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC
    updated_at  TEXT NOT NULL,             -- ISO 8601 UTC

    FOREIGN KEY (role_id) REFERENCES roles(id)
);

-- Query pattern: resolve external identity → user (login / bot lookup)
CREATE INDEX IF NOT EXISTS idx_users_external_id ON users(external_id);

-- Query pattern: filter active/inactive principals
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- Query pattern: join user → role for authorization resolution
CREATE INDEX IF NOT EXISTS idx_users_role_id ON users(role_id);

-- ============================================================================
-- TABLE: user_permissions
-- ============================================================================
-- Per-user permission overrides. This is the row-level refinement layer on top
-- of the role's group permissions. It supports two shapes:
--   - GRANT: an extra capability the user holds beyond their role
--   - REVOKE: a capability their role grants but this user is explicitly
--     denied (deny wins — see RBAC_DESIGN.md security model)
--
-- `permission_id` references `permissions(id)`. `user_id` references
-- `users(id)`. Both are hard FKs (enforced when PRAGMA is on).
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_permissions (
    id            TEXT PRIMARY KEY,        -- UUID v4
    user_id       TEXT NOT NULL,           -- FK → users(id)
    permission_id TEXT NOT NULL,           -- FK → permissions(id)
    effect        TEXT NOT NULL DEFAULT 'grant', -- 'grant' | 'revoke' (deny wins)
    granted_by    TEXT,                    -- FK → users(id) — who set this override (nullable for seed)
    created_at    TEXT NOT NULL,           -- ISO 8601 UTC
    updated_at    TEXT NOT NULL,           -- ISO 8601 UTC

    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (permission_id) REFERENCES permissions(id),
    FOREIGN KEY (granted_by) REFERENCES users(id)
);

-- Query pattern: resolve all overrides for a user (auth resolution)
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_id ON user_permissions(user_id);

-- Query pattern: resolve a specific override (user + permission)
CREATE INDEX IF NOT EXISTS idx_user_permissions_user_perm
    ON user_permissions(user_id, permission_id);

-- ============================================================================
-- TABLE: audit_logs
-- ============================================================================
-- Immutable record of security-relevant and data-mutating actions. Every
-- authorization decision, sensitive read, and write should be appended here.
-- Rows are append-only in practice (the middleware will only INSERT; no
-- UPDATE/DELETE paths are defined for the application layer).
--
-- Design notes:
--   - `actor_id` soft-references `users(id)` — soft link (not a hard FK)
--     because audit entries must survive user deletion (audit trail integrity).
--   - `action` is a stable verb string (e.g. 'leads.update', 'roles.manage').
--   - `target_type` / `target_id` describe the affected entity (loosely
--     coupled — no FK, since targets span many tables and may be deleted).
--   - `ip_address` and `user_agent` support forensic tracing (no PII beyond
--     what the platform already legitimately collects).
-- ============================================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id          TEXT PRIMARY KEY,          -- UUID v4
    actor_id    TEXT,                      -- Soft reference to users(id) — may be NULL (system/anon)
    action      TEXT NOT NULL,             -- Verb string, e.g. 'leads.update'
    target_type TEXT,                      -- Affected entity type, e.g. 'lead', 'user', 'role'
    target_id   TEXT,                      -- Affected entity id (TEXT UUID or external ref)
    ip_address  TEXT,                      -- Request source IP (forensic tracing)
    user_agent  TEXT,                      -- Request user-agent (forensic tracing)
    decision    TEXT,                      -- Authorization outcome: 'allow' | 'deny' (forensic tracing)
    metadata    TEXT,                      -- Optional JSON blob (request id, diff summary, etc.)
    created_at  TEXT NOT NULL,             -- ISO 8601 UTC (event time)
    updated_at  TEXT NOT NULL              -- ISO 8601 UTC (kept for schema consistency; = created_at)
);

-- Query pattern: full audit trail for an actor
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);

-- Query pattern: audit trail by action type (compliance reporting)
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- Query pattern: audit trail by target entity
CREATE INDEX IF NOT EXISTS idx_audit_logs_target ON audit_logs(target_type, target_id);

-- Query pattern: time-ordered audit retrieval (forensic / reporting)
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- SEED DATA: roles
-- ============================================================================
-- Four fixed roles defining the platform trust model. `is_system = 1` marks
-- them as non-deletable so the role vocabulary stays stable.

INSERT INTO roles (id, name, description, is_system, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000001', 'OWNER',      'Full platform control — account owner. All permissions implicitly.', 1, '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000002', 'ADMIN',      'Administrative control short of owning the account (users, roles, audit).', 1, '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000003', 'OPERATIONS', 'Day-to-day lead and consultation management.', 1, '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000004', 'VIEWER',     'Read-only access for reporting and oversight.', 1, '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z');

-- ============================================================================
-- SEED DATA: permissions
-- ============================================================================
-- The initial capability set required for EPIC-002 operations. Keys are
-- dot-namespaced (resource.action) for readability and programmatic checks.

INSERT INTO permissions (id, key, description, resource, action, created_at, updated_at) VALUES
    ('00000000-0000-0000-0000-000000000101', 'leads.read',         'View lead records and lists', 'leads', 'read', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000102', 'leads.update',       'Edit lead records (status, notes, assignment)', 'leads', 'update', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000103', 'leads.assign',       'Assign leads to operations staff', 'leads', 'assign', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000104', 'consultations.read', 'View consultation records and schedules', 'consultations', 'read', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000105', 'consultations.update', 'Edit consultation records (status, notes, scheduling)', 'consultations', 'update', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000106', 'users.manage',       'Create, disable, and manage platform users', 'users', 'manage', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000107', 'roles.manage',       'Create, modify, and assign roles and permissions', 'roles', 'manage', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z'),
    ('00000000-0000-0000-0000-000000000108', 'audit.read',         'Read the audit log for compliance and forensics', 'audit', 'read', '2026-07-18T00:00:00Z', '2026-07-18T00:00:00Z');

-- ============================================================================
-- SEED DATA: default role → permission mapping (group grants)
-- ============================================================================
-- The platform's default authorization model. A role's effective permissions
-- = (permissions mapped here) UNION (user_permissions grants) MINUS
-- (user_permissions revokes). This mapping table is the canonical "what does
-- each role get by default" source; it is implemented as rows in
-- `user_permissions` with a NULL user_id? No — instead we keep role grants
-- implicit in this design by storing them as user_permissions rows anchored to
-- a sentinel? To keep the schema clean, group grants are expressed by the
-- middleware reading this comment + the ROLE_PERMISSIONS map below, which is
-- ALSO encoded as explicit `user_permissions` rows keyed to a sentinel
-- "role anchor" user per role is NOT used. Instead, the canonical mapping is:
--
--   OWNER      → ALL permissions (implicit — middleware short-circuits OWNER)
--   ADMIN      → leads.read, leads.update, leads.assign,
--                consultations.read, consultations.update,
--                users.manage, roles.manage, audit.read   (everything)
--   OPERATIONS → leads.read, leads.update, leads.assign,
--                consultations.read, consultations.update
--   VIEWER     → leads.read, consultations.read, audit.read
--
-- This mapping is documented in RBAC_DESIGN.md and will be enforced by the
-- future authorization middleware. No extra rows are written here because the
-- mapping is deterministic from (role, permission) and is owned by the
-- middleware, not the database, keeping the seed minimal and the source of
-- truth single (the design doc + middleware constant).
-- ============================================================================

-- ============================================================================
-- Migration complete.
-- Total tables added: 5 (roles, permissions, users, user_permissions, audit_logs)
-- Total indexes added: 12
-- Foreign keys added: 6 (users→roles; user_permissions→users, permissions, users[granted_by])
-- Soft links: 1 (audit_logs.actor_id → users.id, no FK — audit survives deletion)
-- Seed rows: 4 roles, 8 permissions
-- Existing Epic 1 tables (leads, contacts, consultations, clinics, services,
--   faqs) are UNCHANGED — this is an additive, forward-only migration.
-- ============================================================================
