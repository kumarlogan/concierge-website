-- ============================================================================
-- Hermes Platform — WAS Activation State Persistence
-- ============================================================================
-- Migration: 0009_was_activation_state_persistence.sql
-- Phase: 9 — Durable Execution & Deterministic Recovery
-- Created: 2026-07-30
-- Database: Cloudflare D1 (agsynergy-db)
-- ============================================================================
-- Stores checkpointed ActivationLifecycle state for crash recovery.
-- Each row is a serialized snapshot of a single activation at a point in time.
-- checkpoint_version tracks schema evolution of the serialized format.
-- ============================================================================

PRAGMA foreign_keys = ON;

-- ============================================================================
-- TABLE: was_activation_state
-- ============================================================================
-- Checkpointed activation lifecycle records for durable execution.
-- Written on every state transition and key lifecycle event.
-- Read at startup to recover in-flight activations after a restart.
-- ============================================================================
CREATE TABLE IF NOT EXISTS was_activation_state (
    activation_id          TEXT PRIMARY KEY,
    plan_id                TEXT NOT NULL,
    state                  TEXT NOT NULL,
    created_at             TEXT NOT NULL,
    updated_at             TEXT NOT NULL,
    completed_at           TEXT,
    idempotency_key        TEXT NOT NULL,
    validation_json        TEXT,
    activated_batches_json TEXT NOT NULL DEFAULT '[]',
    failure_json           TEXT,
    rejection_json         TEXT,
    checkpoint_version     INTEGER NOT NULL DEFAULT 1,
    created_at_epoch       INTEGER NOT NULL DEFAULT (unixepoch()),
    updated_at_epoch       INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Query pattern: recoverable activations at startup (non-terminal states)
CREATE INDEX IF NOT EXISTS idx_was_activation_state_recoverable
    ON was_activation_state(state)
    WHERE state NOT IN ('deactivated', 'failed', 'rejected');

-- Query pattern: find all activations for a plan (idempotency check)
CREATE INDEX IF NOT EXISTS idx_was_activation_state_plan_id
    ON was_activation_state(plan_id);

-- Query pattern: periodic cleanup / TTL-based archival
CREATE INDEX IF NOT EXISTS idx_was_activation_state_updated_epoch
    ON was_activation_state(updated_at_epoch);