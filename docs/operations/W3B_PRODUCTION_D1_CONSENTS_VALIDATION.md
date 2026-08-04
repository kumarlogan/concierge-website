# Engineering Wave 3B — Production D1 Consents Table Validation

**Objective:** Validate the live production Cloudflare D1 database schema for the `consents` table against migration definitions 0006 and 0008.

**Date:** 2026-08-04
**Environment:** Production (remote D1: `agsynergy-db`, database_id: `45f52102-74e1-4ba2-86ca-f4d5f88e16c4`)
**Inspector:** Hermes Agent
**Status:** ✅ Complete — No database modifications made

---

## 1. Live Production Schema (Authoritative Source)

The `consents` table in production was queried directly from the remote D1 database via `wrangler d1 execute --remote`.

### 1.1 Table Definition

```sql
CREATE TABLE consents (
    id              TEXT PRIMARY KEY,
    identity_id     TEXT NOT NULL,
    consent_type    TEXT NOT NULL,
    granted         INTEGER NOT NULL,
    scope           TEXT DEFAULT '',
    purpose         TEXT DEFAULT '',
    source          TEXT DEFAULT '',
    delegator_id    TEXT,
    expires_at      TEXT,
    version         INTEGER NOT NULL DEFAULT 1,
    metadata        TEXT DEFAULT '{}',
    created_at      TEXT NOT NULL,
    revoked_at      TEXT,
    version_token   TEXT NOT NULL DEFAULT '',
    FOREIGN KEY (identity_id) REFERENCES identities(id)
);
```

### 1.2 Columns (14 total)

| Column | Type | Nullable | Default | Notes |
|--------|------|----------|---------|-------|
| `id` | TEXT | NO | — | PRIMARY KEY (UUID v4) |
| `identity_id` | TEXT | NO | — | FK → identities(id) |
| `consent_type` | TEXT | NO | — | Enum: medical_treatment, privacy, marketing, research, document_sharing, clinic_sharing, international_transfer, ai_assistance, delegated_caregiver |
| `granted` | INTEGER | NO | — | 0=denied, 1=granted, 2=withdrawn |
| `scope` | TEXT | YES | `''` | JSON array of resource scopes |
| `purpose` | TEXT | YES | `''` | Purpose-of-use descriptor |
| `source` | TEXT | YES | `''` | explicit, implicit, emergency, delegation |
| `delegator_id` | TEXT | YES | NULL | Identity who delegated |
| `expires_at` | TEXT | YES | NULL | ISO 8601 UTC; NULL = no expiry |
| `version` | INTEGER | NO | `1` | Incremented on changes |
| `metadata` | TEXT | YES | `'{}'` | JSON, NO PHI |
| `created_at` | TEXT | NO | — | ISO 8601 UTC |
| `revoked_at` | TEXT | YES | NULL | ISO 8601 UTC; NULL if not withdrawn |
| `version_token` | TEXT | NO | `''` | Integrity hash of consent snapshot |

### 1.3 Indexes (5 total)

| Index Name | Definition | Type |
|------------|------------|------|
| `sqlite_autoindex_consents_1` | PRIMARY KEY on `id` | Automatic (PK) |
| `idx_consents_identity` | `ON consents(identity_id)` | Standard |
| `idx_consents_type` | `ON consents(consent_type)` | Standard |
| `idx_consents_identity_type` | `ON consents(identity_id, consent_type)` | Composite |
| `idx_consents_expires` | `ON consents(expires_at)` | Standard |

### 1.4 Constraints

- **PRIMARY KEY:** `id` (TEXT UUID)
- **FOREIGN KEY:** `identity_id → identities(id)` — *Note: FK enforcement requires `PRAGMA foreign_keys = ON` at connection time*
- **NOT NULL:** `id`, `identity_id`, `consent_type`, `granted`, `created_at`
- **DEFAULT:** `scope=''`, `purpose=''`, `source=''`, `version=1`, `metadata='{}'`, `version_token=''`

---

## 2. Migration Version History (from `d1_migrations` table)

| ID | Migration Name | Applied At |
|----|----------------|------------|
| 1 | `0001_initial_schema.sql` | 2026-07-25 20:12:01 |
| 2 | `0002_rbac_foundation.sql` | 2026-07-25 20:12:01 |
| 3 | `0003_ops_lead_fields.sql` | 2026-07-25 20:12:02 |
| 4 | `0004_role_permissions_seed.sql` | 2026-07-25 20:12:02 |
| 5 | `0005_workforce_persistence.sql` | 2026-07-25 20:12:02 |
| 6 | `0002_identity_core.sql` | 2026-07-27 23:12:17 |
| 7 | `0006_trust_runtime.sql` | 2026-07-27 23:12:17 | ← **Created the consents table**
| 8 | `0007_document_upload.sql` | 2026-07-27 23:12:17 |
| 9 | `0008_d1_document_blobs.sql` | 2026-07-28 01:23:53 | ← **Current production version**

**Critical Finding:** Migration `0008_consent_engine.sql` (the file at `workers/migrations/0008_consent_engine.sql`) **was never applied to production**. The migration recorded as ID 9 in `d1_migrations` is `0008_d1_document_blobs.sql` — a different file with the same numeric prefix. This is a **naming collision**.

---

## 3. Schema Comparison: Live vs Migration Definitions

### 3.1 Live vs Migration 0006 (`0006_trust_runtime.sql`)

| Aspect | Match Status |
|--------|--------------|
| Column names | ✅ **EXACT MATCH** (14/14) |
| Column types | ✅ **EXACT MATCH** |
| Column constraints | ✅ **EXACT MATCH** |
| Primary key | ✅ **EXACT MATCH** |
| Foreign key | ✅ **EXACT MATCH** |
| Indexes | ✅ **EXACT MATCH** (4 user-defined + 1 auto PK) |

**Conclusion:** The live `consents` table **exactly matches** migration 0006 schema. No discrepancies.

---

### 3.2 Live vs Migration 0008 (`0008_consent_engine.sql`)

Migration 0008 defines a **substantially different** schema:

| Aspect | Live (0006) | Migration 0008 | Match |
|--------|-------------|----------------|-------|
| `patient_identity_id` | ❌ Absent | TEXT NOT NULL | **MISSING** |
| `status` | ❌ Absent (uses `granted` INTEGER) | TEXT NOT NULL DEFAULT 'active' | **DIFFERENT SEMANTICS** |
| `resource_type` | ❌ Absent | TEXT | **MISSING** |
| `resource_id` | ❌ Absent | TEXT | **MISSING** |
| `revoked_by` | ❌ Absent | TEXT | **MISSING** |
| `revoke_reason` | ❌ Absent | TEXT DEFAULT '' | **MISSING** |
| `granted_at` | ❌ Absent (uses `created_at`) | TEXT NOT NULL | **MISSING** |
| `updated_at` | ❌ Absent | TEXT NOT NULL | **MISSING** |
| `version_token` | TEXT NOT NULL DEFAULT '' | TEXT NOT NULL (no default) | **DIFFERENT** |
| `scope` default | `''` | `'[]'` (JSON array) | **DIFFERENT** |
| `source` default | `''` | `'explicit'` | **DIFFERENT** |
| `purpose` default | `''` | `''` (NOT NULL) | **DIFFERENT** |
| Foreign key | `identity_id → identities(id)` | **None** | **MISSING** |
| Partial indexes | Standard B-tree | 2 partial indexes (`WHERE status='active'`) | **MISSING** |

**Conclusion:** Migration 0008 was **never applied** and its schema is **incompatible** with the live table. Code written against the 0008 schema will fail against production.

---

## 4. Schema Discrepancies Summary

| # | Discrepancy | Severity | Impact |
|---|-------------|----------|--------|
| 1 | **Migration 0008 never applied to production** | 🔴 CRITICAL | Code in `consent-engine.ts` (Wave 4) assumes 0008 schema but live DB has 0006 schema |
| 2 | **Naming collision: two `0008_` migrations** | 🔴 CRITICAL | `0008_consent_engine.sql` (repo) vs `0008_d1_document_blobs.sql` (applied) — different files, same prefix |
| 3 | **Duplicate `consents` table definition** | 🔴 CRITICAL | 0006 and 0008 both `CREATE TABLE IF NOT EXISTS consents` — second silently skipped |
| 4 | **ConsentEngine uses in-memory Map, not D1** | 🔴 CRITICAL | Consent grants **do not persist** — data lost on Worker cold start (GAP-002) |
| 5 | **Foreign key may not be enforced** | 🟡 WARNING | D1 requires `PRAGMA foreign_keys = ON` at connection; verify Worker sets this |

---

## 5. Recommended Engineering Action

### Immediate (PRG-011 Blocking)

1. **Do NOT proceed with PRG-011** until the schema conflict is resolved.
   - PRG-011 assumes a stable, verified data layer. The `consents` table schema is unverified and code targets the wrong schema.

2. **Write a forward migration (`0012_reconcile_consents_schema.sql`)** that:
   - Adds missing 0008 columns to the live table: `patient_identity_id`, `status`, `resource_type`, `resource_id`, `revoked_by`, `revoke_reason`, `granted_at`, `updated_at`
   - Migrates data: `granted` INTEGER → `status` TEXT mapping (0→denied, 1→active, 2→revoked)
   - Adds partial indexes for active consent queries
   - Preserves FK to `identities(id)`
   - Uses **forward-only** approach (no DROP TABLE, no rollback)

3. **Wire `ConsentEngine` to D1** (resolve GAP-002):
   - Replace in-memory `Map` with D1 read/write in `workers/src/platform/trust/consent-engine.ts`
   - Ensure `PRAGMA foreign_keys = ON` is set on DB connection

4. **Fix migration numbering:**
   - Next migration **MUST be `0012_`** (four digits, incrementing past highest unambiguous number 0009)
   - Do NOT reuse `0008_` or `0011_` prefixes

### Near-term

5. **Verify `DelegationEngine` wiring** (same GAP-002 issue with `delegations` table)
6. **Update AI Context Layer** if any documentation claims 0008 schema is live (it is not)
7. **Add integration test** that validates live schema matches expected schema on deploy

---

## 6. PRG-011 Proceed Confirmation

> ❌ **PRG-011 MAY NOT PROCEED** at this time.

**Reason:** The foundational data layer for consent management has an unresolved critical schema conflict. The live production schema (0006) differs from the schema assumed by application code (0008), and the engines that should persist to D1 are currently in-memory only.

**Required before PRG-011:**
- [ ] Forward migration `0012_reconcile_consents_schema.sql` written and reviewed
- [ ] Migration applied to preview/staging and validated
- [ ] `ConsentEngine` wired to D1 persistence
- [ ] `DelegationEngine` wired to D1 persistence
- [ ] Integration tests passing against live schema
- [ ] AI Context Layer updated to reflect ground truth

---

## 7. Evidence Appendix

### 7.1 Queries Executed (Production Remote)

```bash
# Table schema
wrangler d1 execute agsynergy-db --command "SELECT sql FROM sqlite_master WHERE type='table' AND name='consents';" --env production --remote

# Indexes
wrangler d1 execute agsynergy-db --command "SELECT * FROM sqlite_master WHERE type='index' AND tbl_name='consents';" --env production --remote

# Migration history
wrangler d1 execute agsynergy-db --command "SELECT * FROM d1_migrations ORDER BY id;" --env production --remote
```

### 7.2 Files Referenced

| File | Purpose |
|------|---------|
| `workers/migrations/0006_trust_runtime.sql` | Created live `consents` table (applied 2026-07-27) |
| `workers/migrations/0008_consent_engine.sql` | Defines 0008 schema (NEVER applied to production) |
| `workers/migrations/0008_d1_document_blobs.sql` | Applied as migration 9 (naming collision) |
| `workers/src/platform/trust/consent-engine.ts` | In-memory engine, assumes 0008 schema |
| `docs/context/ARCHITECTURE.yaml` | Documents GAP-001 (schema conflict) |
| `docs/context/KNOWN_GAPS.yaml` | Documents GAP-001 & GAP-002 (in-memory engines) |
| `docs/context/ENGINEERING_GUIDE.md` | Documents duplicate table definition issue |

---

**Validation Complete.** No database modifications were made. This report establishes ground truth for the `consents` table schema in production.