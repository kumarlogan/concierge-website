# AG Synergy Platform — Database Design

> **Document Version:** 1.0  
> **Created:** 2026-07-18  
> **Phase:** 1 — Concierge Platform Foundation  
> **Database:** Cloudflare D1 (`agsynergy-db`)  
> **Binding:** `DB` in Worker environment

---

## 1. Purpose

The AG Synergy D1 database is the source of truth for the Concierge Platform's
operational data. It stores structured information about leads, contacts,
consultations, services, clinics, and FAQs.

### Core Principles

| Principle | Description |
|---|---|
| **Minimal data collection** | Only collect what is strictly necessary for the platform to function |
| **Privacy by design** | No medical records, no clinical data, no PHI — ever |
| **Phase 1 scope** | Implement only entities needed for the concierge workflow |
| **Schema as contract** | All schema changes require an ADR (Architecture Decision Record) |
| **Serverless-optimized** | Schema designed for D1's SQLite engine at the edge |

---

## 2. Phase 1 Entities

The following entities are planned for Phase 1. Detailed schema definitions
(SQL migrations) arrive in **EPIC-001-006**.

### 2.1 `leads`

**Purpose:** Captures inbound consultation inquiries from the website.

A lead is created when a visitor submits the consultation request form.
It represents an unqualified, uncontacted inquiry.

| Aspect | Detail |
|---|---|
| **Purpose** | Store raw consultation requests from the marketing website |
| **Key fields** | Name, email, phone, preferred contact method, treatment interest, message |
| **Relationships** | May convert to a `contact` + `consultation` after outreach |
| **Phase** | 1 |
| **Future considerations** | Lead scoring, source tracking (UTM/campaign), auto-assignment to clinics |

---

### 2.2 `contacts`

**Purpose:** Stores vetted, contacted individuals who have engaged with the
platform.

A contact is created when a lead is qualified — meaning a real person has been
reached and has expressed genuine interest. Contacts persist across multiple
consultations.

| Aspect | Detail |
|---|---|
| **Purpose** | Track individuals who have engaged with AG Synergy |
| **Key fields** | Name, email, phone, contact preferences, status (active/inactive) |
| **Relationships** | Has many `consultations`. Originates from a `lead`. |
| **Phase** | 1 |
| **Future considerations** | Communication history, consent tracking, GDPR/CCPA compliance flags |

---

### 2.3 `consultations`

**Purpose:** Records scheduled and completed consultation appointments.

A consultation is the core business event — it connects a contact with a clinic
at a specific date/time.

| Aspect | Detail |
|---|---|
| **Purpose** | Track consultation appointments and outcomes |
| **Key fields** | Contact ID, clinic ID, scheduled datetime, status (scheduled/completed/cancelled), notes |
| **Relationships** | Belongs to a `contact` and a `clinic` |
| **Phase** | 1 |
| **Future considerations** | Consultation types (virtual/in-person), follow-up scheduling, outcome tracking |

---

### 2.4 `services`

**Purpose:** Catalog of fertility services and treatments offered.

A service is a specific treatment or procedure that a clinic offers. This is
primarily a reference/lookup table.

| Aspect | Detail |
|---|---|
| **Purpose** | Reference catalog of available fertility services |
| **Key fields** | Name, description, category, is_active |
| **Relationships** | Many-to-many with `clinics` (via junction table in Phase 2+) |
| **Phase** | 1 (read-only reference data) |
| **Future considerations** | Pricing tiers, eligibility criteria, multi-language descriptions |

---

### 2.5 `clinics`

**Purpose:** Stores partner fertility clinics.

A clinic is a physical location where consultations and treatments occur.

| Aspect | Detail |
|---|---|
| **Purpose** | Directory of partner fertility clinics |
| **Key fields** | Name, address, phone, email, is_active |
| **Relationships** | Has many `consultations`. Offers many `services` (Phase 2+). |
| **Phase** | 1 (reference data, limited rows) |
| **Future considerations** | Operating hours, provider roster, accreditation status, multi-location chains |

---

### 2.6 `faqs`

**Purpose:** Frequently asked questions displayed on the website and used by
the concierge team.

| Aspect | Detail |
|---|---|
| **Purpose** | Content management for FAQ section and concierge knowledge base |
| **Key fields** | Question, answer, category, sort_order, is_published |
| **Relationships** | None (standalone content entity) |
| **Phase** | 1 |
| **Future considerations** | Multi-language, audience segments (patient vs. provider), search indexing |

---

## 3. Entity Relationship Overview

```
┌──────────┐       ┌───────────┐       ┌──────────┐
│  leads   │──────▶│ contacts  │──────▶│consultations│
└──────────┘       └───────────┘       └────┬─────┘
                                            │
                                       ┌────▼─────┐
┌──────────┐       ┌──────────┐       │ clinics  │
│ services │◀─────▶│ clinics  │◀──────│          │
└──────────┘       └──────────┘       └──────────┘

┌──────────┐
│   faqs   │  (standalone — no FK relationships)
└──────────┘
```

**Key relationships:**
- `leads` → may convert to → `contacts` (soft link, not a hard FK)
- `contacts` 1──N `consultations`
- `clinics` 1──N `consultations`
- `clinics` N──M `services` (Phase 2+ junction table)

---

## 4. Data Boundaries

### ✅ Phase 1 — Collected

| Data | Example |
|---|---|
| Contact information | Name, email, phone |
| Communication preferences | Preferred method, best time to call |
| Service interest | Type of treatment inquired about |
| Scheduling data | Appointment date/time, clinic selection |
| FAQ content | Questions and answers for display |

### ❌ Explicitly Excluded — All Phases

| Excluded | Reason |
|---|---|
| Medical records | Platform boundary — healthcare provider responsibility |
| Clinical data | Lab results, diagnoses, treatment outcomes |
| PHI (Protected Health Information) | HIPAA scope — not our role |
| Payment information | PCI scope — use external processor |
| Government IDs | Privacy risk, unnecessary for matching |
| Genetic data | Extreme sensitivity, no platform need |
| Patient portals / login | Phase 2; auth is separate ADR |

---

## 5. Schema Change Process

All database schema changes follow this formal process:

1. **Propose** — Document the change rationale in a new ADR (`docs/decisions/`)
2. **Review** — ADR is reviewed against project constitution and engineering principles
3. **Approve** — ADR is accepted before any migration is written
4. **Migrate** — Create a numbered SQL migration file in `workers/migrations/`
5. **Apply** — `wrangler d1 migrations apply agsynergy-db`
6. **Document** — Update this DATABASE_DESIGN.md and CHANGELOG.md

**Migrations are forward-only.** No rollback migrations. Rollback is handled via
new forward migrations.

---

## 6. D1-Specific Considerations

### Performance

- D1 uses SQLite under the hood — indexes work the same way
- Queries execute at the edge, close to the Worker
- 5 GB storage, 5M reads/day, 100K writes/day on free tier
- Cold starts: <1ms for V8 isolates; D1 queries add ~5-50ms

### Limitations

- No foreign key enforcement by default (SQLite pragma must be enabled)
- No stored procedures — logic lives in the Worker
- Backup is manual (`wrangler d1 backup`) or via Cloudflare dashboard
- No direct external access — all data access goes through the Worker

### Best Practices

- Use **prepared statements** via D1's `stmt.bind()` to prevent SQL injection
- Keep transactions short — edge functions have CPU time limits (30s free, 30m paid)
- Index every column used in WHERE/JOIN clauses
- Use INTEGER for booleans (SQLite convention: 0/1)
- Use TEXT for dates in ISO 8601 format (SQLite has no native date type)
- Limit TEXT columns to reasonable sizes — no unbounded blobs

---

## 7. Future Phases

| Phase | Entity/Change | Notes |
|---|---|---|
| 2 | `users` table | Authentication, role-based access (patient, concierge, admin) |
| 2 | `appointments` | Extends `consultations` with recurrence, reminders |
| 2 | `clinics_services` | Many-to-many junction table |
| 3 | `providers` | Individual healthcare providers at clinics |
| 3 | `reviews` | Patient reviews and ratings |
| 4 | `analytics_events` | Event sourcing for business intelligence |
| 4 | `integrations` | External system connection metadata |

---

## 8. References

- `ARCHITECTURE.md` — System architecture and technology decisions
- `ADR-001` — Cloudflare Migration decision
- `PRODUCT_BOUNDARIES.md` — Platform scope and data boundaries
- `CURRENT_SPRINT.md` — Active sprint tracking (EPIC-001)
- Cloudflare D1 Docs: https://developers.cloudflare.com/d1/