# Operations Telegram Bot — Specification & Architecture

**Epic:** EPIC-002-004 (Specification & Architecture)
**Status:** ✅ Implemented (MVP) — `src/routes/telegram.ts`, covered by `tests/telegram/bot.integration.test.ts` (21 tests).
**Audience:** Operations staff (incl. owner's partner)
**Backend:** Consumes existing Operations API (`/api/v1/ops/*`)
**Invariant:** The bot is a *thin client*. It never touches D1, GitHub,
Cloudflare, or deployment. All business logic, authorization, and audit live in
the Worker backend.

> **This document is specification only.** No code, webhook, token, or migration
> is created by this document. See §11 Out of Scope.

---

## 1. Purpose

The Operations Telegram Bot is a **conversational interface** that lets
operations staff manage leads and view operational status from Telegram — a
channel they already use daily.

**Responsibilities:**
- Let operations staff view leads, lead detail, and the operational dashboard.
- Allow assignment and status updates of leads from chat.
- Provide quick operational queries (`/today`, `/mine`, `/search`, `/stats`).
- Surface future notifications (new lead, follow-up due, daily summary).

**Explicitly operational-staff-only:**
The bot is intended **exclusively for AG Synergy operations personnel**
(owner, admin, operations, viewer roles defined in the RBAC system). It is
**not** a customer-facing channel, **not** a public inquiry form, and **not**
a marketing surface. Customers continue to use the website consultation form
(`POST /api/v1/consultations`), which is untouched.

---

## 2. Architecture

```
┌──────────────┐
│   Telegram   │  (user sends /command or messages)
└──────┬───────┘
       │ HTTPS (Telegram → Webhook URL)
       ▼
┌──────────────────────────────┐
│   Worker API  (agsynergy-api) │   ← The ONLY trusted boundary
│   - Telegram webhook route    │
│   - Authorization middleware   │   (resolves X-Telegram-Chat-Id → Principal)
│   - Operations API (/api/v1/ops/*)
└──────────┬───────────────────┘
           │ internal service call (same Worker)
           ▼
┌──────────────────────────────┐
│   Operations Service (opsService) │  ← business logic, validation, audit
└──────────┬───────────────────┘
           │ D1 query
           ▼
┌──────────────────────────────┐
│   Cloudflare D1 (agsynergy-db) │
└──────────────────────────────┘
```

**Hard boundaries (enforced by design, not convention):**
- ❌ **No direct D1 access** from the bot. The bot only ever calls the Worker
  API over HTTPS. The Worker resolves identity, enforces RBAC, and queries D1.
- ❌ **No GitHub access.** The bot cannot read or write repositories.
- ❌ **No Cloudflare access.** The bot cannot manage Workers, D1, or tokens.
- ❌ **No deployment capability.** The bot cannot deploy, roll back, or change
  infrastructure.
- ✅ **Every operation flows through the Workers API.** The bot is a client of
  `/api/v1/ops/*` exactly like the future dashboard, mobile app, and partner
  portal (see §10).

**Where the bot "lives":** the bot logic is a *webhook handler inside the
Worker* (a new route under the existing Worker, e.g. `POST /api/v1/telegram/webhook`),
**not** a separate process. This keeps the architecture single-boundary and
preserves the ADR-002 rule (all interfaces communicate only through the Workers
API). The bot handler translates Telegram updates → authorized calls to
`opsService` → Telegram reply. The bot handler itself contains **no business
logic** — it maps chat intent to API calls and formats responses.

---

## 3. User Roles

Roles are resolved by the backend from `users` → `roles` → `role_permissions`.
The bot merely sends the caller's Telegram chat id; the Worker determines the
role. The bot shows/hides commands based on the `GET /api/v1/ops/me` response
(effective permissions), but **permission enforcement is always server-side**.

| Role | Description | Accessible commands | Restricted commands |
|------|-------------|---------------------|---------------------|
| **OWNER** | Full control; implicit all permissions (short-circuited in engine). | All commands, including `/settings` (view), and future admin ops. | None (owner can do everything the API permits). |
| **ADMIN** | Operational management; can manage settings and assignments. | `/start /help /dashboard /leads /lead /assign /update /search /today /mine /consultations /stats /settings` | None operational; cannot change infrastructure (no deploy — out of scope for this bot regardless of role). |
| **OPERATIONS** | Day-to-day lead handling. | `/start /help /dashboard /leads /lead /assign /update /search /today /mine /consultations /stats` | `/settings` (read-only config is owner/admin only). |
| **VIEWER** | Read-only monitoring. | `/start /help /dashboard /leads /lead /search /today /consultations /stats` | `/assign`, `/update`, `/mine`(write-side), `/settings`. Viewer cannot mutate leads. |

> `restricted` = the bot client should hide/disable the command, AND the
> backend will return `403 Forbidden` if called directly. Client hiding is UX;
> server enforcement is security.

---

## 4. Commands

Permissions reference the seeded permission catalog. Of the 8 defined keys,
**6 are implemented in the current MVP** and **2 are reserved for future
use (not implemented)**:

- **Implemented MVP permissions** (enforced today by `requirePermission()`):
  `leads.read`, `leads.update`, `leads.assign`, `consultations.read`,
  `audit.read`, `settings.read`.
- **Future / reserved permissions** (NOT available in MVP): `leads.export`,
  `consultations.update`. These are **not granted to any current role**, and
  have **no API endpoint or workflow implemented yet** — they require future
  backend work before any command may depend on them.

All commands require `leads.read` at minimum except `/start` and `/help`.

### `/start`
- **Purpose:** Register/identify the user; show a welcome + role-aware menu.
- **API endpoint:** `GET /api/v1/ops/me`
- **Required permission:** none (identity resolution only)
- **Expected response:** "Welcome, {name}. You are {ROLE}. Use /help."
- **Error responses:** `401` unknown chat → "You are not registered.";
  `403` disabled account → "Your account is disabled."

### `/help`
- **Purpose:** List commands available to the caller's role.
- **API endpoint:** `GET /api/v1/ops/me` (to filter by permissions)
- **Required permission:** none
- **Expected response:** role-filtered command list.
- **Error responses:** `401`/`403` as above.

### `/dashboard`
- **Purpose:** Operational snapshot.
- **API endpoint:** `GET /api/v1/ops/dashboard`
- **Required permission:** `leads.read`
- **Expected response:** New/assigned/pending leads, today's consultations,
  follow-ups due (counts + short lists).
- **Error responses:** `403` insufficient → "You don't have access.";
  `503` API unavailable → "Service temporarily unavailable."

### `/leads`
- **Purpose:** Paginated lead list with filters.
- **API endpoint:** `GET /api/v1/ops/leads?limit=&offset=&status=&assigned_to=&q=&priority=&sort=&order=`
- **Required permission:** `leads.read`
- **Expected response:** list of leads (id, name, status, priority, assigned_to,
  updated_at). Supports pagination (see §6).
- **Error responses:** `400` bad filter → "Invalid filter."; `403`; `503`.

### `/lead <id>`
- **Purpose:** Single lead detail.
- **API endpoint:** `GET /api/v1/ops/leads/:id`
- **Required permission:** `leads.read`
- **Expected response:** full lead record + recent timeline entries.
- **Error responses:** `404` not found → "Lead {id} not found."; `403`; `503`.

### `/assign <lead_id> <operator>` (or interactive)
- **Purpose:** Assign a lead to an operator.
- **API endpoint:** `POST /api/v1/ops/leads/:id/assign`  `{ assigned_to }`
- **Required permission:** `leads.assign`
- **Expected response:** "Lead {id} assigned to {operator}." + confirmation
  dialog (see §5).
- **Error responses:** `400` invalid operator → "Unknown operator.";
  `403` → "You cannot assign leads."; `404`; `503`.

### `/update <lead_id>`
- **Purpose:** Update lead status / priority / notes.
- **API endpoint:** `PATCH /api/v1/ops/leads/:id` `{ status?, priority?, notes? }`
- **Required permission:** `leads.update`
- **Expected response:** confirmation of changed fields + confirmation dialog.
- **Error responses:** `400` invalid status value → "Status must be one of:
  new, contacted, qualified, booked, closed."; `403`; `404`; `503`.

### `/search <query>`
- **Purpose:** Free-text lead search.
- **API endpoint:** `GET /api/v1/ops/leads?q=<query>`
- **Required permission:** `leads.read`
- **Expected response:** matching leads list (same shape as `/leads`).
- **Error responses:** `400` empty query; `403`; `503`.

### `/today`
- **Purpose:** Today's operational items (consultations + follow-ups due).
- **API endpoint:** `GET /api/v1/ops/dashboard` (filtered to today) — or a
  future `/api/v1/ops/today` if added; bot consumes existing dashboard.
- **Required permission:** `leads.read`
- **Expected response:** today's consultations + follow-ups due list.
- **Error responses:** `403`; `503`.

### `/mine`
- **Purpose:** Leads assigned to the caller.
- **API endpoint:** `GET /api/v1/ops/leads/mine` (alias for
  `GET /api/v1/ops/leads?assigned_to=<caller>`)
- **Required permission:** `leads.read`
- **Expected response:** leads where `assigned_to = caller`.
- **Error responses:** `403`; `503`.

### `/consultations`
- **Purpose:** Recent consultation inquiries (Epic 1 pipeline).
- **API endpoint:** `GET /api/v1/ops/consultations` (future read endpoint) or
  sourced from dashboard; bot consumes the Operations API only.
- **Required permission:** `consultations.read`
- **Expected response:** recent consultation requests list.
- **Error responses:** `403`; `503`.

### `/stats`
- **Purpose:** Light operational metrics (read-only, non-revenue).
- **API endpoint:** `GET /api/v1/ops/dashboard` (aggregated counts)
- **Required permission:** `leads.read`
- **Expected response:** counts by status, assignments, follow-ups.
- **Error responses:** `403`; `503`.

### `/settings`
- **Purpose:** View operational configuration (read-only view for admins).
- **API endpoint:** `GET /api/v1/ops/settings` (future; read-only)
- **Required permission:** `settings.read`
- **Expected response:** current operational settings view.
- **Error responses:** `403` (OPERATIONS/VIEWER) → "Restricted."; `503`.

---

## 5. Conversation Flows

All flows are **request/response over chat**, driven by the bot calling the API
and formatting the result. The bot holds only minimal ephemeral conversation
state (current command context, e.g. "awaiting lead id for /update") — never
business data.

### Viewing leads
1. User: `/leads`
2. Bot → `GET /leads` → renders first page (see §6).
3. User taps **Next** / sends `/leads page 2` → bot → `GET /leads?offset=20`.
4. User: `/lead <id>` → detail.

### Assigning a lead
1. User: `/assign 42` (or `/assign` then bot asks "Which operator?").
2. Bot → `GET /ops/me`/operator list → presents operator choices (or user
   types operator name).
3. User picks operator.
4. Bot → `POST /leads/42/assign {assigned_to}` → **confirmation dialog**:
   "Assign lead 42 to {op}? [Confirm] [Cancel]".
5. On Confirm → final "✅ Assigned." On Cancel → "Cancelled."

### Updating lead status
1. User: `/update 42`
2. Bot asks which field (status / priority / notes).
3. User: `status → booked`
4. Bot → `PATCH /leads/42 {status:"booked"}` → confirmation dialog.
5. Confirm → "✅ Updated." Cancel → "Cancelled."

### Searching
1. User: `/search ivf toronto`
2. Bot → `GET /leads?q=ivf+toronto` → results list (paginated).

### Viewing dashboard
1. User: `/dashboard`
2. Bot → `GET /dashboard` → formatted summary with inline buttons for drill-down
   (`/leads?status=new`, `/today`).

### Confirmation dialogs
- Any mutating command (`/assign`, `/update`) shows an inline **Confirm /
  Cancel** keyboard before the API write is issued. The bot issues the write
  only after Confirm. This prevents accidental mutations from chat.
- Cancellation at any prompt returns to idle with "Cancelled."

### Cancellation
- User may send `/cancel` at any pending-prompt state → bot discards the
  in-flight context and replies "Cancelled." No API call is made.

### Timeout behaviour
- A pending prompt (e.g. awaiting operator choice) has a **5-minute TTL**.
- If no response within TTL, the bot sends "⌛ Timed out — use /assign to retry."
  and clears context. No partial write is committed.
- Timeouts are client-side conversation state only; they never affect backend
  data.

---

## 6. Pagination

- Lead lists return at most `limit` (default 20, max 50) rows.
- The bot renders a **Next / Prev** inline keyboard. `Next` → `offset += limit`;
  `Prev` → `offset = max(0, offset - limit)`.
- The bot shows "Page X" and total count when the API provides it
  (`X-Total-Count` header or a `total` field — to be confirmed against the Ops
  API response shape; bot adapts to whatever the API returns).
- Search (`/search`) and `/mine` use the same pagination controls.
- Pagination state lives in the chat message (callback data), not in backend
  session storage beyond the stateless offset param.

---

## 7. Notifications (specification only — not implemented)

The bot subscribes to backend-pushed events. The backend initiates; the bot
never polls for notifications. Mechanism (future): the Worker sends a Telegram
message to the relevant chat id when an audited event matches a subscription.

| Notification | Trigger (backend) | Recipient | Notes |
|--------------|-------------------|-----------|-------|
| **New lead** | `POST /consultations` creates a lead | OPERATIONS/VIEWER (per settings) | Pushed via Worker → Telegram send. |
| **Follow-up reminder** | lead `follow_up_due` date reached | assigned operator | Driven by a backend scheduler/cron (future). |
| **Daily summary** | scheduled (e.g. 09:00) | OWNER/ADMIN | Aggregated dashboard snapshot. |
| **Assignment** | `POST /leads/:id/assign` | the assigned operator | "You've been assigned lead {id}." |

> These are **specification only**. No webhook, no scheduler, no Telegram send
> logic is built in this epic. Notification delivery reuses the same
> authorized API path; the bot remains a client.

---

## 8. Error Handling

| Condition | Bot behaviour | Backend source |
|-----------|---------------|----------------|
| **Unknown command** | "Unknown command: /foo. Use /help." | Bot-side (no API call). |
| **Unauthorized (401)** | "You are not registered. Contact an admin." | `buildPrincipal()` → unknown chat. |
| **Forbidden (403)** | "You don't have permission for that." | `requirePermission()` deny. |
| **Validation (400)** | Echo the field error from API (`message`). | `opsService` validation. |
| **API unavailable (503)** | "Service temporarily unavailable. Try again shortly." | Worker/D1 down; health `degraded`. |
| **Rate limited (429)** | "Slow down — too many requests. Wait a moment." | Rate-limit middleware (EPIC-002-003.5). |
| **Expired session** | "Session expired. Send /start to refresh." | `GET /me` token/session invalid (future auth). |

All error messages are **user-safe**: no stack traces, SQL, tokens, or internal
identifiers are echoed. The detailed error is logged server-side only.

---

## 9. Security

- **No secrets in Telegram.** The bot token and any API keys live in the
  Worker's secret store / environment, never in chat or bot client code.
- **No business logic in Telegram.** Filtering, assignment rules, validation,
  and audit all happen in `opsService` / the authorization engine.
- **Every operation goes through the Workers API.** The bot issues HTTPS
  requests to `/api/v1/ops/*` (or the webhook route that proxies to them). It
  never connects to D1.
- **Every action is audited.** Mutating calls pass through
  `requirePermission()` + `AuditMiddleware`, which append to `audit_logs`
  (actor = resolved Principal from chat id, action, target, decision). This
  satisfies the audit requirement for both human and automated operations.
- **Identity is never trusted from the client.** The bot sends only the Telegram
  chat id via the `X-Telegram-Chat-Id` header; the Worker resolves it to a
  Principal. A user cannot impersonate another role by crafting requests.
- **Defence in depth.** The bot hides restricted commands client-side for UX,
  but the backend enforces `403` regardless — client hiding is convenience, not
  security.

---

## 10. Future Compatibility

The Operations API (`/api/v1/ops/*`) is the **single integration surface** for
all present and future interfaces. The same backend serves:

- **Operations Dashboard (web):** calls the same `/ops/*` endpoints from a
  browser; renders richer UI. Same RBAC, same audit.
- **Mobile app:** native client calling `/ops/*` over HTTPS with the same auth
  header scheme.
- **Partner portal:** a scoped subset of `/ops/*` (e.g. read-only lead views
  for clinic partners) behind the same authorization engine with partner-scoped
  permissions.

Because the bot contains no business logic and only formats API responses, any
change to lead workflow is made **once** in `opsService` and instantly available
to all four interfaces. No interface encodes rules.

---

## 11. Implementation Status (as built)

The MVP Telegram bot **is implemented** in `src/routes/telegram.ts` and exercised
end-to-end by `tests/telegram/bot.integration.test.ts`. What was built vs. deferred:

- ✅ Telegram webhook route (`POST /telegram/webhook`) in the Worker.
- ✅ Identity resolution via `X-Telegram-Chat-Id` → Principal (same engine as HTTP API).
- ✅ RBAC enforcement through the existing `requirePermission()` middleware — no duplicated logic.
- ✅ Command parsing, role-aware help, and user-safe error formatting.
- ✅ Read commands (`/dashboard`, `/leads`, `/lead <id>`, `/search`, `/mine`, `/today`, `/consultations`, `/stats`) and write commands (`/assign`, `/update`) dispatch through the **same** Ops handlers used by the HTTP API.
- ✅ 21 integration tests covering parsing, identity, authorized/forbidden/disabled, malformed input, and API-shape mapping.

**Key implementation decision — `callOps` direct dispatch:**
The bot does NOT issue a second HTTP round-trip; instead `callOps()` runs the
authorization gate and then invokes the Ops **handler function directly** (same
process). Because it bypasses the HTTP router, `callOps` must supply the path
parameters the handler expects. It derives them with `pathParamsFromUrl()`, which
extracts the trailing `:id` from `/api/v1/ops/leads/<id>` and
`/api/v1/ops/leads/<id>/assign`. **Gotcha:** passing `{}` here makes every
detail/update/assign command fail with `400 Missing lead id` — params must be
reconstructed, not left empty. This keeps the bot consistent with the router
without duplicating the route table.

Still **out of scope** (per original spec, unchanged):
- ❌ No Telegram BotFather registration / token provisioning (runtime secret).
- ❌ No live notification push (backend-scheduled events) — spec only.
- ❌ No interactive confirmation dialogs / conversation TTL (spec only; current MVP issues writes directly).

Implementation details live in the code and tests; this document remains the
authoritative command/permission contract.

---

## 11b. Out of Scope (explicit, original)

This specification originally created **none** of the following (carried forward
for traceability):

- ❌ No Telegram BotFather registration / app creation.
- ❌ No Workers source code changes *beyond* the bot handler and its tests.
- ❌ No D1 schema changes (bot reuses existing `users`/`roles`/`role_permissions`).
- ❌ No new migrations.
- ❌ No Operations API contract changes (the bot is a pure client of `/api/v1/ops/*`).
- ❌ No deployment.

---

## Appendix A — Command → Endpoint → Permission Matrix

| Command | Method + Endpoint | Permission |
|---------|-------------------|------------|
| `/start` | `GET /ops/me` | identity only |
| `/help` | `GET /ops/me` | identity only |
| `/dashboard` | `GET /ops/dashboard` | `leads.read` |
| `/leads` | `GET /ops/leads` | `leads.read` |
| `/lead <id>` | `GET /ops/leads/:id` | `leads.read` |
| `/assign <id> <op>` | `POST /ops/leads/:id/assign` | `leads.assign` |
| `/update <id>` | `PATCH /ops/leads/:id` | `leads.update` |
| `/search <q>` | `GET /ops/leads?q=` | `leads.read` |
| `/today` | `GET /ops/dashboard` (today filter) | `leads.read` |
| `/mine` | `GET /ops/leads/mine` | `leads.read` |
| `/consultations` | `GET /ops/consultations` | `consultations.read` |
| `/stats` | `GET /ops/dashboard` | `leads.read` |
| `/settings` | `GET /ops/settings` | `settings.read` |

## Appendix B — Design Principles (summary)

1. Thin client — format, don't decide.
2. Single boundary — Worker API is the only door.
3. Server-enforced RBAC — never trust the client.
4. Audit everything — every write is logged.
5. Fail safe — unknown/forbidden/expired → clear message, no data change.
6. Interface-agnostic backend — one API, many faces.
