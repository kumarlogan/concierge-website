# EPIC-002 Planning — Operational Intelligence & AI Operations Platform

> **Status:** Planning only — no implementation. Code changes are explicitly out of scope for this document.
> **Author:** Hermes (AI Agent) · **Date:** 2026-07-18
> **Approved & Refined:** 2026-07-18 (5 architectural refinements applied — DB scope, API-first, dashboard prep, data classification, human approval controls)
> **Prerequisite:** EPIC-001 (Backend Foundation) — ✅ Complete (9/10 tasks; consultation workflow live, 74 tests, D1 `agsynergy-db` operational)
> **Governing docs:** `PROJECT.md`, `AI_OPERATING_MODEL.md`, `ARCHITECTURE.md`, `SECURITY.md`, `docs/decisions/ADR-001-cloudflare-migration.md`

---

## 1. Scope

Transform AG Synergy from a **lead-capture platform** (EPIC-001) into an **AI-assisted operational system**. EPIC-002 introduces a **multi-agent operations model** running on Telegram, with two distinct assistants that sit on top of the existing Workers + D1 backend.

### In Scope (this epic)
- Design and stand up **two separate Telegram assistants** with clearly separated authority:
  1. **Hermes Admin Assistant** — owner/technical operations only.
  2. **Operations Assistant Bot** — authorized team members (business operations only).
- A **role-based access control (RBAC)** layer with Telegram identity mapping.
- **Audit logging** for every privileged action.
- **Minimum RBAC database foundation** (Phase 2): `users`, `roles`, `permissions`, `user_permissions`, `audit_logs`. Complex workflow tables (`operational_notes`, `lead_activity_history`) are **deferred** until proven necessary.
- Secure permission boundaries that hard-block the Operations Bot from infra, secrets, and deployment.
- **API-first design** — Telegram bots are interfaces only; no bot accesses D1 directly.
- Architecture foundations for a future ops dashboard, additional agents, and API-based interfaces (dashboard/mobile/partner-portal ready).

### Out of Scope (this epic)
- Building the future operations dashboard UI (foundations only).
- Clinic Partner (`CLINIC_PARTNER`) role is **defined but not activated** — reserved for a future epic.
- Any medical, legal, or financial decision automation (human approval remains mandatory per `AI_OPERATING_MODEL.md`).
- Lead-capture changes (owned by EPIC-001).

---

## 2. Milestones

| Milestone | Title | Description | Depends On |
|---|---|---|---|
| **M1** | RBAC Data Model (Minimum) | Add **Phase 2** tables only: `users`, `roles`, `permissions`, `user_permissions`, `audit_logs` + seed OWNER/ADMIN/OPERATIONS roles. No workflow tables yet. | EPIC-001 schema |
| **M2** | Telegram Identity Mapping | Map Telegram user IDs → `users` rows; bootstrap owner from env/config; deny-unknown-by-default. | M1 |
| **M3** | Authorization Middleware | A reusable guard (used by both bots via the Workers API) that checks role → permission before any action; **the only path to D1**. Fails closed. | M1, M2 |
| **M4** | Audit Logging | Every privileged action writes to `audit_logs` (actor, role, action, target, timestamp, outcome). | M1 |
| **M5** | Operations API Surface | Workers `/api/v1/ops/*` endpoints (leads read/status, follow-ups, summaries) — API-first, bot-agnostic. Consumed by the Ops Bot. | M3, M4 |
| **M6** | Operations Assistant Bot | Thin Telegram interface over M5 endpoints only. No D1 access. Permission-bounded. | M5 |
| **M7** | Hermes Admin Assistant | Thin Telegram interface over admin endpoints (infra, docs, deploy, arch, monitor). Owner-only. | M3, M4 |
| **M8** | Security Hardening & Boundary Tests | Assert Ops Bot **cannot** reach GitHub/Cloudflare-admin/deploy/secrets/architecture; assert **no bot path reaches D1 except via middleware**; RBAC + human-approval negative tests. | M6, M7 |
| **M9** | Architecture Foundations for Future | Reserved API endpoints/extension points for ops dashboard + mobile + partner portals + additional agents. | M5, M6, M7 |

> Milestones are planning estimates. Task breakdown (EPIC-002-001…) is deferred to the implementation planning phase after sign-off.

---

## 3. Architecture Impact

### 3.1 Two-Bot Topology (Bots Are Interfaces Only)

Per the **API-first principle**, Telegram bots never touch D1. They are thin clients over the Workers API; the Authorization Middleware is the sole gateway to the database.

```
Operations Bot / Admin Assistant (Telegram)
        │  (HTTPS, scoped API token)
        ▼
Workers API  (/api/v1/ops/*)
        │
        ▼
Authorization Middleware   ← role → permission check, fails closed, audit log
        │
        ▼
D1: agsynergy-db  (Phase 2 RBAC tables + existing lead tables)
```

**No bot may directly access D1.** Any D1 read/write happens exclusively inside the Workers API, behind the Authorization Middleware.

### 3.2 Key Principles (carried from EPIC-001 + ADR-001)
- **Cloudflare-only backend** — no Express/Postgres expansion. New routes target Workers + D1.
- **Service-layer pattern** — business logic stays in `services/`; routes are thin HTTP↔service translation.
- **API-first principle** — Telegram bots are **interfaces only**. They call Workers API endpoints; they hold no D1 binding and no direct DB credentials. The Authorization Middleware is the only path to D1.
- **Fails-closed RBAC** — unknown Telegram ID or missing permission ⇒ denied, logged.
- **Separation of privilege** — the two bots are distinct bot tokens/identities; the Operations Bot token is provisioned with a **scoped** set of Worker endpoints only.
- **No secrets in bot context** — Cloudflare/GitHub tokens and deploy controls are never exposed to the Operations Bot process.
- **Dashboard preparation principle** — *Telegram is the first operational interface, not the final interface.* Every Epic 2 capability must be exposed as an API-first design consumable by a future internal dashboard, future mobile applications, and future partner portals. Build for the API; the Telegram bot is one of several future clients.

### 3.3 Extension Points for the Future
- A generic `agent_registry` concept (logical, not necessarily a table yet) so additional agents can be added without restructuring RBAC.
- Worker routes versioned under `/api/v1/ops/*` to separate operational endpoints from public lead-capture endpoints. These same endpoints serve the future dashboard/mobile/partner clients.
- Audit log is the single source of truth for "who did what" — dashboard and future agents consume it read-only.

---

## 4. Database Changes

> Current `agsynergy-db` has: `leads`, `contacts`, `clinics`, `consultations`, `services`, `faqs`. **No `users` table exists yet.** All additions below are forward migrations (roll-forward only, per `MIGRATION_STRATEGY.md`).

### 4.1 New Tables (Phase 2 — Minimum RBAC Foundation)

> **Refinement:** Initial database additions are reduced to the minimum RBAC foundation. Complex workflow tables (`operational_notes`, `lead_activity_history`) are **deferred** until a proven need exists.

| Table | Purpose | Key Columns |
|---|---|---|
| `users` | Telegram-identity-mapped platform users | `id TEXT PK`, `telegram_user_id TEXT UNIQUE`, `display_name TEXT`, `role TEXT`, `is_active INTEGER DEFAULT 1`, `created_at`, `updated_at` |
| `roles` | Role definitions | `id TEXT PK`, `name TEXT UNIQUE` (OWNER/ADMIN/OPERATIONS/CLINIC_PARTNER), `description TEXT` |
| `permissions` | Permission catalog | `id TEXT PK`, `scope TEXT` (e.g. `leads.read`, `deploy.execute`), `description TEXT` |
| `user_permissions` | Direct user→permission grants (override/joint with role) | `id TEXT PK`, `user_id TEXT`, `permission_id TEXT` |
| `audit_logs` | Immutable action record | `id TEXT PK`, `actor_user_id TEXT`, `actor_role TEXT`, `action TEXT`, `target_type TEXT`, `target_id TEXT`, `outcome TEXT`, `metadata TEXT`, `created_at` |

> **Deferred (not in Phase 2):** `operational_notes`, `lead_activity_history`, and any other workflow/activity tables. Revisit via a future ADR once the Ops Bot usage proves the need.

### 4.2 Schema Conventions (per `DATABASE_DESIGN.md`)
- PKs: `TEXT` UUID v4 (`crypto.randomUUID()`).
- Timestamps: `TEXT` ISO 8601 UTC.
- Booleans: `INTEGER` 0/1.
- Indexes: `idx_{table}_{column}` on every WHERE/JOIN/ORDER BY column (e.g. `idx_users_telegram_user_id`, `idx_audit_logs_actor_user_id`, `idx_lead_activity_history_lead_id`).
- FK constraints defined in schema; app handles cleanup (no `ON DELETE CASCADE`).

### 4.3 Seed Data
- `roles`: OWNER, ADMIN, OPERATIONS, CLINIC_PARTNER (reserved).
- `permissions`: scoped set covering `leads.read`, `leads.update`, `followups.read`, `summaries.generate` (OPERATIONS) vs. `infra.manage`, `deploy.execute`, `docs.write`, `arch.read`, `monitor.read` (OWNER/ADMIN).
- `user_permissions`: OWNER ⇒ all permissions granted directly; ADMIN ⇒ infra/docs/arch/monitor (no deploy unless explicitly granted); OPERATIONS ⇒ leads/followups/summaries only. Per-user overrides added via this table as needed.

---

## 4A. Data Classification

A data-handling model governs what each layer may store, log, and expose.

| Class | Examples | Handling Rule |
|---|---|---|
| **Public** | Website information (treatments, FAQs, clinic listings) | Safe to display publicly; no restriction. |
| **Operational** | Lead information, contact details, status, follow-up information | Accessible to OPERATIONS/ADMIN via authorized endpoints only; audit-logged; never exposed publicly. |
| **Sensitive / Future** | Medical records, clinical information, documents | **Not handled in Phase 2.** Requires additional controls (encryption-at-rest, stricter RBAC, retention policy, possible separate store) before any Epic touches it. |

> Patient data (PHI) remains the most sensitive asset per `AI_OPERATING_MODEL.md`. Phase 2 deliberately scopes to **Operational** data only; **Sensitive/Future** categories are out of reach until dedicated controls exist. The `audit_logs.metadata` field stores references/IDs only — never raw Operational or Sensitive payloads.

---

## 4B. Human Approval Controls

The following actions require explicit **human confirmation** (not autonomous bot execution), in addition to RBAC permission:

- **Deleting records** — any hard/soft delete of a lead, contact, consultation, or RBAC entity.
- **Changing permissions** — granting, revoking, or modifying any `user_permissions` / role grant.
- **Exporting data** — any bulk export or download of Operational/Sensitive data (files, dumps, external sends).
- **Destructive lifecycle changes** — record archival purges, schema-affecting migrations in production, bot deactivation that affects live operations.

> These are surfaced by the bot as confirmation prompts; the underlying API endpoint enforces the approval gate server-side (the middleware rejects the action without a valid approval token). This complements, not replaces, the RBAC layer.

---

## 5. Security Model

### 5.1 Roles
| Role | Who | Capabilities | Restrictions |
|---|---|---|---|
| **OWNER** | Platform owner (KL) | Everything — infra, deploy, secrets, architecture, docs, monitoring, all ops | None |
| **ADMIN** | Technical admins | Infra management, docs, architecture read, monitoring, ops oversight | No deploy unless explicitly granted; no secret exposure |
| **OPERATIONS** | Authorized team members | View leads, manage lead status, add notes, view follow-ups, daily summaries, workflow assist | **MUST NOT** access GitHub, Cloudflare admin, deploy controls, secrets, or architecture modifications |
| **CLINIC_PARTNER** | *Future* | Scoped clinic-facing views | Defined now, activated later |

### 5.2 Permission Enforcement
- **Deny by default.** Every bot action passes through the shared RBAC guard; absence of an explicit grant ⇒ 403/denied.
- **Telegram identity mapping** — the bot resolves the caller's Telegram user ID → `users` row → `role` → permission set. Unknown ID ⇒ denied + logged.
- **Token isolation** — Operations Bot runs with a scoped Worker API token that physically cannot call admin/deploy endpoints (defense in depth beyond app-level checks).
- **Audit logging** — every privileged action recorded with actor, role, action, target, outcome.

### 5.3 Hard Boundaries (Operations Bot)
The Operations Bot **must not** be able to:
- Reach GitHub (no `gh`/API access in its process).
- Perform Cloudflare administration (no `CLOUDFLARE_API_TOKEN` in its environment).
- Trigger deployments or migration applies.
- Read secrets, tokens, or environment credentials.
- Modify architecture (no writes to `ARCHITECTURE.md`/ADRs or Worker config).

These boundaries are enforced at **three layers**: (1) RBAC guard, (2) scoped API token, (3) process environment isolation.

### 5.4 Audit & Compliance
- `audit_logs` is append-only (no update/delete routes).
- Sensitive fields (tokens, PII beyond what's needed) never written to `audit_logs.metadata` — only references/IDs.
- Patient data (PHI) remains the most sensitive asset per `AI_OPERATING_MODEL.md`; operational notes reference leads by ID, not by copying PHI.

---

## 6. AI Boundaries

| Capability | Hermes Admin Assistant | Operations Assistant Bot |
|---|---|---|
| Infrastructure management | ✅ | ❌ |
| Documentation workflows | ✅ | ❌ |
| Deployment assistance | ✅ (OWNER) | ❌ |
| Architecture support | ✅ (OWNER/ADMIN) | ❌ |
| System monitoring | ✅ | ❌ |
| View leads | ✅ | ✅ |
| Manage lead status | ✅ | ✅ |
| Add operational notes | ✅ | ✅ |
| View follow-ups | ✅ | ✅ |
| Generate daily summaries | ✅ | ✅ |
| Assist workflow management | ✅ | ✅ |
| GitHub / Cloudflare admin / Secrets / Architecture mods | ✅ (OWNER/ADMIN) | ❌ **hard-blocked** |

**Human-in-the-loop:** Medical, legal, financial, security-sensitive, and production-impacting actions still require human approval per `AI_OPERATING_MODEL.md`. Bots assist and surface; they do not autonomously commit those actions.

---

## 7. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Operations Bot over-reach (accidental admin access) | Med | High | Three-layer boundary (RBAC + scoped token + env isolation); M8 negative tests |
| Telegram ID spoofing / unknown actor | Low | High | Deny-by-default; map only known IDs; log all denials |
| Audit log tampering | Low | High | Append-only table; no update/delete routes |
| PHI leakage via notes/summaries | Med | High | Reference leads by ID; never copy PHI into logs/notes bodies beyond need |
| Scope creep into dashboard build | Med | Med | Dashboard is foundations-only this epic; UI deferred |
| Single-session context loss (per EPIC-001 lesson) | Med | Med | Session handoff at each milestone; docs as source of truth |
| Documentation drift (EPIC-001 top failure) | High | Med | Documentation audit as an explicit closeout task; pair docs with each milestone |

---

## 8. Estimated Complexity

| Dimension | Estimate | Notes |
|---|---|---|
| New DB tables | 5 (Phase 2 minimum: `users`, `roles`, `permissions`, `user_permissions`, `audit_logs`) | Straightforward D1 migrations; seed data required. Workflow tables deferred. |
| New Worker endpoints | ~8–12 (`/api/v1/ops/*`) | Reuses EPIC-001 service-layer pattern; API-first, bot-agnostic |
| Authorization middleware | Medium | Fails-closed guard; **sole path to D1**; highest-correctness component |
| Bots (2) | Medium | Thin Telegram interfaces over the API; no D1 access |
| Boundary/test coverage | Medium | M8 negative tests are mandatory: no bot→D1 path, Ops Bot hard-blocked |
| Docs | High | Architecture, SECURITY, API, DATABASE updates + this plan |
| **Overall** | **High** | Multi-agent + security-critical; sequencing M1–M4 before any bot logic is essential |

### Suggested Sequencing Rationale
Build the **security + API substrate first** (M1–M4: minimum RBAC data model → identity → Authorization Middleware → audit) before either bot exists. Bots are thin clients over the API (M5 API surface, then M6/M7 bot interfaces) — never direct D1 clients. Only after the middleware is tested do bot surfaces get built, then M8 hardening (asserting no bot reaches D1 except via middleware + Ops Bot hard-blocks), then M9 future foundations (dashboard/mobile/partner-portal-ready endpoints).

---

## 9. Definition of Done (Epic 2)

Epic 2 is complete when all of the following criteria are met and verified.

### Architecture
- [ ] **RBAC implemented** — `users`, `roles`, `permissions`, `user_permissions` tables live in D1 with seeded OWNER/ADMIN/OPERATIONS roles and the Phase-2 permission catalog.
- [ ] **Authorization middleware enforced** — every privileged action flows through the middleware; it is the **sole path to D1**; fails closed on unknown identity or missing permission.
- [ ] **API-first interfaces** — all operational capabilities exposed via Workers API (`/api/v1/ops/*`); Telegram bots are thin clients with no direct D1 access.

### Security
- [ ] **Bot separation** — Hermes Admin Assistant and Operations Assistant Bot are distinct identities with distinct scoped tokens; Ops Bot physically cannot reach admin/deploy/secrets/architecture endpoints (three-layer boundary verified).
- [ ] **Permission enforcement** — role + `user_permissions` grants checked server-side on every action; deny-by-default.
- [ ] **Audit logging** — every privileged action written to `audit_logs` (actor, role, action, target, outcome, timestamp); table is append-only.
- [ ] **Approval gates** — delete, permission change, data export, and destructive lifecycle changes require explicit human confirmation enforced server-side.

### Operations
- [ ] **Lead management capability** — authorized users can view leads, manage lead status, view follow-ups, and generate daily summaries via the Operations Bot.
- [ ] **Operational workflows** — the Operations Assistant Bot supports the defined business-operations workflows end-to-end against the API.

### Future Readiness
- [ ] **Dashboard-ready APIs** — operational endpoints are documented and consumable by a future internal dashboard, mobile app, and partner portal (bot-agnostic).
- [ ] **Documented interfaces** — `API.md`, `SECURITY.md`, `ARCHITECTURE.md`, `DATABASE_DESIGN.md` updated; ADR-002 recorded; this plan's DoD and `TASKS.md`/`CHANGELOG.md` synced (post-implementation documentation audit passed).

---

## Sign-Off

| Role | Name | Date |
|---|---|---|
| Planning Author | Hermes (AI Agent) | 2026-07-18 |
| Approved & Refined | KL | 2026-07-18 |

---

*This document is planning only. No code, migrations, or configuration changes were made. Task breakdown and implementation planning follow sign-off.*
