# EPIC-002 Implementation Handoff

> **Purpose:** Bridge from approved planning (`docs/sprints/EPIC-002-PLANNING.md`) to implementation.
> **Status:** Preparation complete — implementation not yet started.
> **Date:** 2026-07-18 · **Author:** Hermes (AI Agent)

---

## Approved Scope

Transform AG Synergy from a lead-capture platform (EPIC-001) into an AI-assisted operational system via a **multi-agent operations model** on Telegram, built API-first on the existing Workers + D1 backend.

**In scope:**
- Two separate Telegram assistants with separated authority:
  - **Hermes Admin Assistant** — owner-only (infra, docs, deploy, arch, monitoring).
  - **Operations Assistant Bot** — authorized team members (leads, status, notes, follow-ups, summaries).
- Minimum RBAC database foundation (Phase 2): `users`, `roles`, `permissions`, `user_permissions`, `audit_logs`.
- Authorization Middleware as the **sole path to D1**.
- Audit logging for every privileged action.
- Human approval gates (delete / permission change / export / destructive lifecycle).
- API-first design ready for future dashboard, mobile, and partner portals.

**Out of scope (this epic):**
- Building the future dashboard UI (foundations only).
- `CLINIC_PARTNER` role activation (defined, deferred).
- `operational_notes` / `lead_activity_history` tables (deferred until proven necessary).
- Any Sensitive/Future data class (medical records, clinical info) — Phase 2 handles Operational data only.

---

## Architecture Decisions

| Ref | Decision | Summary |
|---|---|---|
| ADR-001 | Cloudflare-only backend | Workers + D1; no Express/Postgres expansion. |
| ADR-002 | Multi-agent operations architecture | Two separate bot interfaces; both via Workers API; **no agent touches D1 directly**. |

**Key architectural rules (from EPIC-002-PLANNING.md):**
- **API-first principle** — Telegram bots are interfaces only.
  ```
  Bot (Telegram) → Workers API → Authorization Middleware → D1
  ```
  No bot may directly access D1.
- **Dashboard preparation principle** — Telegram is the first operational interface, not the final one. Every capability is API-first.
- **Data classification** — Public / Operational / Sensitive-Future. Phase 2 = Operational only.
- **Fails-closed RBAC** — unknown ID or missing permission ⇒ denied + logged.
- **Three-layer Ops Bot boundary** — RBAC guard + scoped API token + process env isolation.

---

## Milestone Order (final)

1. **M1** — RBAC Data Model (minimum 5 tables) + seed roles
2. **M2** — Telegram Identity Mapping (deny-unknown-by-default)
3. **M3** — Authorization Middleware (sole D1 path, fails closed, audit)
4. **M4** — Audit Logging
5. **M5** — Operations API Surface (`/api/v1/ops/*`, bot-agnostic)
6. **M6** — Operations Assistant Bot (thin client)
7. **M7** — Hermes Admin Assistant (thin client)
8. **M8** — Security Hardening & Boundary Tests (no bot→D1 except via middleware; Ops Bot hard-blocked; approval gates)
9. **M9** — Future Foundations (dashboard/mobile/partner-portal-ready endpoints)

**Sequencing rationale:** security + API substrate (M1–M4) before any bot; bots are thin API clients, never direct D1 clients.

---

## First Implementation Task

### EPIC-002-001 — RBAC Data Foundation

**Goal:** Create the minimum Phase-2 RBAC tables in `agsynergy-db` and seed the role/permission foundation. No bot, no endpoint logic yet.

**Deliverables:**
- Migration `workers/migrations/0002_rbac_foundation.sql` creating:
  - `users` (`id TEXT PK`, `telegram_user_id TEXT UNIQUE`, `display_name TEXT`, `role TEXT`, `is_active INTEGER DEFAULT 1`, `created_at`, `updated_at`)
  - `roles` (`id TEXT PK`, `name TEXT UNIQUE`, `description TEXT`) — seed OWNER/ADMIN/OPERATIONS/CLINIC_PARTNER (reserved)
  - `permissions` (`id TEXT PK`, `scope TEXT`, `description TEXT`)
  - `user_permissions` (`id TEXT PK`, `user_id TEXT`, `permission_id TEXT`)
  - `audit_logs` (`id TEXT PK`, `actor_user_id TEXT`, `actor_role TEXT`, `action TEXT`, `target_type TEXT`, `target_id TEXT`, `outcome TEXT`, `metadata TEXT`, `created_at`)
- Indexes: `idx_users_telegram_user_id`, `idx_audit_logs_actor_user_id`, `idx_user_permissions_user_id`, etc.
- Seed rows for roles + the Phase-2 permission catalog (`leads.read`, `leads.update`, `followups.read`, `summaries.generate`, `infra.manage`, `deploy.execute`, `docs.write`, `arch.read`, `monitor.read`).
- Per `MIGRATION_STRATEGY.md`: forward-only migrations, header block (number/phase/date/db/ADR), verify with `wrangler d1 execute ... --command "SELECT ..."`.
- Update `TASKS.md`, `CURRENT_SPRINT.md`, `CHANGELOG.md`, `docs/database/DATABASE_DESIGN.md` per the documentation-audit rule.

**Explicitly NOT in this task:** `operational_notes`, `lead_activity_history`, any endpoint code, any bot code, secret changes.

**DoD (this task):** migration applies cleanly to local + preview; tables present; seed rows present; `tsc --noEmit` clean; docs updated; verification query returns expected counts.

---

## Readiness

| Gate | Status |
|---|---|
| Planning approved | ✅ |
| ADR-002 recorded | ✅ |
| DoD defined | ✅ |
| Handoff written | ✅ |
| Implementation started | ❌ (not yet) |

**Next action:** begin **EPIC-002-001 — RBAC Data Foundation** when the user authorizes implementation.
