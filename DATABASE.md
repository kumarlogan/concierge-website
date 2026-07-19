# DATABASE

> AG Synergy Platform — Database Design and Configuration
>
> **Database:** Cloudflare D1 (`agsynergy-db`) | **Binding:** `DB` | **Status:** 🟢 Live
>
> **Database ID:** `45f52102-74e1-4ba2-86ca-f4d5f88e16c4`
> **Worker:** `agsynergy-api` (wrangler binding)

## Overview

The AG Synergy D1 database is the source of truth for the Concierge Platform's operational data. It stores structured information about leads, contacts, consultations, services, clinics, and FAQs.

### Core Principles

| Principle | Description |
|---|---|
| **Cloudflare Workers only** | No external database access — all data flows through the Worker |
| **Zero-trust interfaces** | Hermes, Operations Bot, dashboard — all reach D1 *only* via the Worker API. No direct D1 access (ADR-002) |
| **Minimal data collection** | Only what is strictly necessary for the platform to function |
| **Privacy by design** | No medical records, no clinical data, no PHI |
| **Forward-only migrations** | No rollback migrations. Fix schema with new forward migrations. |
| **SQLite at the edge** | Queries execute close to users via D1's distributed SQLite engine |

## Schema

**Phase 1 (Epic 1):** 6 operational tables created by `0001_initial_schema.sql`.

**Phase 2 (Epic 2):** 5 RBAC/authorization tables added by `0002_rbac_foundation.sql`, plus the `role_permissions` mapping table added by `0003_role_permissions.sql` (see [RBAC tables](#rbac-tables-epic-2) below).

### Operational Tables (Epic 1)

| Table | Purpose | Status |
|---|---|---|
| `leads` | Inbound consultation inquiries from website | 🟢 Active (writes) |
| `contacts` | Vetted, contacted individuals | 🟢 Ready (no writes yet) |
| `consultations` | Scheduled/completed consultation appointments | 🟢 Ready (no writes yet) |
| `clinics` | Partner fertility clinic directory (reference) | 🟢 Ready (no data seeded) |
| `services` | Catalog of fertility services (reference) | 🟢 Ready (no data seeded) |
| `faqs` | FAQ content management | 🟢 Ready (no data seeded) |

### RBAC Tables (Epic 2)

| Table | Purpose | Status |
|---|---|---|
| `roles` | Named access tiers (OWNER, ADMIN, OPERATIONS, VIEWER) | 🟢 Active (seeded) |
| `permissions` | Dot-namespaced capabilities (e.g. `leads.read`) | 🟢 Active (seeded) |
| `users` | Principals (person or bot identity) — storage only, no auth | 🟢 Active (no rows yet) |
| `user_permissions` | Per-user grant/revoke overrides | 🟢 Active (no rows yet) |
| `role_permissions` | Role→permission group-grant mapping (**stored as data**, not code) | 🟢 Active (seeded: ADMIN×6, OPERATIONS×4, VIEWER×2) |
| `audit_logs` | Append-only security/audit trail | 🟢 Active (no rows yet) |

> **RBAC resolution rule (ADR-003):** Permissions are stored as data and resolved by middleware. Application code must not hardcode role-to-permission mappings. The middleware reads `role_permissions` (role grants) + `user_permissions` (per-user overrides) dynamically.

> Full RBAC design, relationships, and security model: [`docs/database/RBAC_DESIGN.md`](./docs/database/RBAC_DESIGN.md)

### Entity Relationships

```
leads ──(soft link)──▶ contacts ──▶ consultations ◀── clinics
                                           │
faqs (standalone)          services ◀─── (Phase 2 junction)
```

Currently only `leads` receives writes (via `POST /api/v1/consultations`). The other tables are created and ready for Phase 1 endpoint expansion (clinic listing, FAQ serving).

### `leads` Table

The only table currently receiving production writes.

| Column | Type | Description |
|---|---|---|
| `id` | `TEXT PK` | UUID v4 |
| `name` | `TEXT NOT NULL` | Submitter's full name |
| `email` | `TEXT NOT NULL` | Submitter's email (indexed, lowercased) |
| `phone` | `TEXT` | Optional phone number |
| `preferred_contact_method` | `TEXT` | `email`, `phone`, or `either` |
| `treatment_interest` | `TEXT` | Free-text treatment/service inquiry |
| `message` | `TEXT` | Optional message from form |
| `status` | `TEXT NOT NULL DEFAULT 'new'` | `new`, `contacted`, `qualified`, `disqualified` |
| `created_at` | `TEXT NOT NULL` | ISO 8601 UTC |
| `updated_at` | `TEXT NOT NULL` | ISO 8601 UTC |

**Indexes:**
- `idx_leads_email` — duplicate detection (every POST checks for existing email)
- `idx_leads_status` — dashboard filtering/reporting

## Migration History

| Migration | File | Date | Description |
|---|---|---|---|
| 0001 | `0001_initial_schema.sql` | 2026-07-18 | Initial schema — all 6 tables + 14 indexes + 2 foreign keys |
| 0002 | `0002_rbac_foundation.sql` | 2026-07-18 | RBAC foundation — 5 tables (`roles`, `permissions`, `users`, `user_permissions`, `audit_logs`) + 12 indexes + seed 4 roles & 8 permissions |
| 0003 | `0003_role_permissions.sql` | 2026-07-18 | Role→permission mapping as **data** — `role_permissions` table + 3 indexes + 2 FKs + seed 12 mappings (ADMIN×6, OPERATIONS×4, VIEWER×2; OWNER implicit) |

### Applying Migrations

```bash
# Local (Miniflare)
cd workers && wrangler d1 migrations apply agsynergy-db --local

# Production
cd workers && wrangler d1 migrations apply agsynergy-db --env production

# Preview (workers.dev staging)
cd workers && wrangler d1 migrations apply agsynergy-db --env preview
```

Full strategy: [`docs/database/MIGRATION_STRATEGY.md`](./docs/database/MIGRATION_STRATEGY.md)

## D1 Configuration

Set in `workers/wrangler.jsonc`:

```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_name": "agsynergy-db",
    "database_id": "45f52102-74e1-4ba2-86ca-f4d5f88e16c4"
  }
]
```

The `DB` binding is available in the Worker as `env.DB` and matches the TypeScript binding in `src/types/env.ts`.

## D1-Specific Considerations

### Performance
- D1 uses SQLite under the hood — indexes work identically
- Queries execute at the edge, close to the Worker (no network hop)
- Free tier: 5 GB storage, 5M reads/day, 100K writes/day
- Query latency: ~5-50ms cold, <1ms warm (V8 isolates)

### Limitations
- **No foreign key enforcement by default** — `PRAGMA foreign_keys = ON` must be set at connection time
- **No stored procedures** — business logic lives in the Worker
- **Backup is manual** — `wrangler d1 backup` or Cloudflare dashboard
- **No direct external access** — all data access through the Worker

### Best Practices (In Use)
- ✅ Prepared statements via `stmt.bind()` — no SQL injection
- ✅ TEXT UUIDs for all primary keys (SQLite-friendly)
- ✅ ISO 8601 UTC for all timestamps
- ✅ INTEGER 0/1 for booleans (SQLite convention)
- ✅ Indexes on every column used in WHERE/JOIN queries
- ✅ Short transactions — edge functions have CPU time limits

## Data Boundaries

### ✅ Collected — Phase 1

| Data | Examples |
|---|---|
| Contact information | Name, email, phone |
| Communication preferences | Preferred method, best time to call |
| Service interest | Treatment type inquired about |
| Scheduling data | Appointment date/time, clinic selection (prepared) |
| FAQ content | Questions and answers for display (schema ready) |

### ❌ Explicitly Excluded — All Phases

| Excluded | Reason |
|---|---|
| Medical records | Platform boundary — provider responsibility |
| Clinical data | Lab results, diagnoses, treatment outcomes |
| PHI (Protected Health Information) | HIPAA scope — not our role |
| Payment information | PCI scope — use external processor |
| Government IDs | Privacy risk, unnecessary |
| Genetic data | Extreme sensitivity, no platform need |

## Future Phases

| Phase | Entity/Change | Notes |
|---|---|---|
| 2 | `clinics_services` junction table | Many-to-many clinic ↔ service mapping |
| 2 | `users` table | ✅ Created in EPIC-002-001 (storage foundation); authentication + RBAC middleware arrive in EPIC-002-002 |
| 2 | Extended contact fields | Communication history, consent tracking, GDPR/CCPA flags |
| 3 | `providers` table | Individual healthcare providers at clinics |
| 3 | `reviews` table | Patient reviews and ratings |
| 4 | `analytics_events` | Event sourcing for business intelligence |
| 4 | `integrations` | External system connection metadata |

## Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System architecture and technology decisions
- [`API.md`](./API.md) — REST API documentation
- [`docs/database/DATABASE_DESIGN.md`](./docs/database/DATABASE_DESIGN.md) — Detailed entity design and rationale
- [`docs/database/MIGRATION_STRATEGY.md`](./docs/database/MIGRATION_STRATEGY.md) — Migration numbering, process, and policy
- Cloudflare D1 Docs: https://developers.cloudflare.com/d1/