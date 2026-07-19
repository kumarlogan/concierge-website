# API

> REST API documentation for the AG Synergy Platform.
> Deployed as Cloudflare Workers at the edge.
>
> **API Base URLs:**
> - Production: `https://agsynergy-api.kumarlogan.workers.dev`
> - Planned custom domain: `https://api.agsynergy.ca`
>
**Version:** 0.2.0 | **Status:** 🟢 Live (Epic 1 + Operations API complete)

## Architecture

The API is a Cloudflare Worker (TypeScript) with a zero-dependency native `URLPattern`-based router. The Worker is the **sole backend entry point** — the frontend never communicates directly with D1 or R2.

```
Request → Worker (CORS + Router) → Route Handler → Service Layer → D1 → Response
```

### Design Principles

- **RESTful** — resource-oriented endpoints, standard HTTP methods and status codes
- **JSON-only** — request/response bodies are JSON
- **Versioned** — all endpoints under `/api/v1/`
- **Stateless** — no session state (auth arrives in Phase 2)
- **Consistent error format** — all errors return `{ "success": false, "error": "...", "message": "..." }`
- **Zero external router dependencies** — ~87 lines of `URLPattern` code, no npm router

## Implemented Endpoints

### `GET /api/v1/health`

Operational readiness check. No database access, no business logic.

**Response `200 OK`:**
```json
{
  "status": "healthy",
  "service": "agsynergy-api",
  "version": "0.1.0",
  "environment": "production",
  "timestamp": "2026-07-18T12:00:00.000Z"
}
```

| Field | Type | Description |
|---|---|---|
| `status` | `string` | Always `"healthy"` |
| `service` | `string` | Always `"agsynergy-api"` |
| `version` | `string` | API version (`"0.1.0"`) |
| `environment` | `string` | Deployment environment: `"production"`, `"preview"`, or `"development"` |
| `timestamp` | `string` | ISO 8601 UTC timestamp of response |

---

### `POST /api/v1/consultations`

Submit a consultation request. Creates a new lead in D1 after validation, normalization, and duplicate detection.

**Request Body:**
```json
{
  "name": "Jane Smith",
  "email": "jane@example.com",
  "phone": "+1-555-0123",
  "treatment_interest": "IVF consultation",
  "message": "I'd like to learn more about options."
}
```

**Success Response `201 Created`:**
```json
{
  "success": true,
  "lead_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "new",
  "message": "Consultation request received."
}
```

**Validation Rules:**

| Rule | Detail |
|---|---|
| Required fields | `name`, `email`, `phone`, `treatment_interest` |
| Email format | Regex validation (`/^[^\s@]+@[^\s@]+\.[^\s@]+$/`) |
| Empty rejection | Whitespace-only values rejected |
| Max field lengths | name/email: 255, phone: 100, treatment_interest: 500, message: 2000 |
| Type enforcement | Non-string values rejected |

**Normalization:**

| Field | Rule |
|---|---|
| `email` | Lowercased |
| `phone` | Trimmed |
| `name` | Trimmed + multiple spaces collapsed |
| `treatment_interest` | Trimmed |
| `message` | Trimmed (null if empty) |

**Error Responses:**

| Status | Error Code | Condition |
|---|---|---|
| `400 Bad Request` | `validation_error` | Missing required field, invalid email, empty field, type mismatch, or malformed JSON |
| `400 Bad Request` | `validation_error` | Request body is not a JSON object (array, primitive, or unparseable) |
| `409 Conflict` | `duplicate_lead` | Active lead with same email already exists |
| `500 Internal Server Error` | `internal_error` | Unexpected server error (generic message, no internal details) |

**Duplicate Protection:**
- Searches `leads` table for existing email with `status != 'disqualified'`
- Returns `409 Conflict` when an active lead exists
- Does not create duplicate records

---

## Operations API

The Operations API (`/api/v1/ops/*`) is the backend for the internal operations
interface (Telegram bot, dashboard, mobile). It is **gated by the authorization
engine** — every endpoint requires a specific `permission` granted to the
caller's role via `role_permissions` (no hardcoded role checks; see
[SECURITY.md](./SECURITY.md) and ADR-003).

### Authentication & Authorization

All `/ops/*` requests must carry an identity header and are authorized by the
`requirePermission` middleware *before* the handler runs.

| Header | Required | Purpose |
|---|---|---|
| `X-Telegram-Chat-Id` | ✅ | Calling user's Telegram chat id. Resolved to a `users` row + role. |

**Authorization model (DB-backed RBAC):**

| Endpoint | Required permission | Allowed roles (current seed) |
|---|---|---|
| `GET /api/v1/ops/leads` | `leads.read` | `owner`, `admin`, `ops` |
| `GET /api/v1/ops/leads/mine` | `leads.read` | `owner`, `admin`, `ops` |
| `GET /api/v1/ops/leads/:id` | `leads.read` | `owner`, `admin`, `ops` |
| `PATCH /api/v1/ops/leads/:id` | `leads.update` | `owner`, `admin`, `ops` |
| `POST /api/v1/ops/leads/:id/assign` | `leads.assign` | `owner`, `admin`, `ops` |
| `GET /api/v1/ops/dashboard` | `leads.read` | `owner`, `admin`, `ops` |
| `GET /api/v1/ops/timeline` | `leads.read` | `owner`, `admin`, `ops` |

A `user_permissions` row with `granted = 0` revokes a single permission for one
user without touching the role grant (deny-wins). All denials and grants are
written to `audit_logs`.

**Error responses (auth):**

| Status | Error Code | Condition |
|---|---|---|
| `401 Unauthorized` | `unauthenticated` | Missing/invalid `X-Telegram-Chat-Id` |
| `403 Forbidden` | `forbidden` | Authenticated but lacks the required permission |
| `403 Forbidden` | `forbidden` | User's `status != 'active'` |
| `404 Not Found` | `not_found` | Chat id not linked to a `users` row |

---

### `GET /api/v1/ops/leads`

List leads with filtering, scoping, pagination, and sorting.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `status` | string | — | Filter by status (`new`, `contacted`, `qualified`, `disqualified`, …) |
| `priority` | string | — | Filter by priority (`urgent`, `high`, `normal`, `low`) |
| `scope` | `all` \| `mine` \| `unassigned` | `all` | `mine` = assigned to caller; `unassigned` = no assignee |
| `sort` | `created_at` \| `updated_at` \| `priority` \| `status` | `created_at` | Sort field |
| `order` | `asc` \| `desc` | `desc` | Sort direction |
| `limit` | int | 50 | Page size (server-capped) |
| `offset` | int | 0 | Pagination offset |

**Success `200 OK`:**
```json
{
  "success": true,
  "leads": [
    { "id": "L1", "name": "Alice New", "email": "alice@example.com",
      "status": "new", "priority": "normal", "assigned_to": "tg-ops",
      "treatment_interest": "ivf", "created_at": "2026-07-18T…", "updated_at": "2026-07-18T…" }
  ],
  "total": 42,
  "limit": 50,
  "offset": 0
}
```

---

### `GET /api/v1/ops/leads/mine`

Leads assigned to the calling user (scope = caller). Same query params as
listing except `scope` is fixed to the caller.

**Success `200 OK`:** `{ "success": true, "leads": [...], "total": N, "limit": 50, "offset": 0 }`

---

### `GET /api/v1/ops/leads/:id`

Retrieve a single lead by id.

**Success `200 OK`:** `{ "success": true, "lead": { ... } }`
**Error `404`:** `{ "success": false, "error": "not_found", "message": "Lead not found" }`

---

### `PATCH /api/v1/ops/leads/:id`

Update mutable lead fields. Only provided fields are changed; `updated_at` is
always refreshed. Does **not** change `assigned_to` (use the assign endpoint).

**Request body (all optional):**
```json
{ "name": "New Name", "email": "new@example.com", "phone": "+1-555-0000",
  "status": "contacted", "priority": "high", "treatment_interest": "egg-freezing",
  "notes": "Left voicemail." }
```

**Success `200 OK`:** `{ "success": true, "lead": { ... } }`

**Error responses:**

| Status | Error Code | Condition |
|---|---|---|
| `400` | `validation_error` | Invalid enum value for `status`/`priority`, or non-string field |
| `404` | `not_found` | Lead id does not exist |
| `409` | `duplicate_email` | New email collides with another active lead |

---

### `POST /api/v1/ops/leads/:id/assign`

Assign (or unassign) a lead. `assignee_id: null` or omitted → unassign.
Assignment is recorded in `audit_logs` with `decision = "allow"`.

**Request body:**
```json
{ "assignee_id": "tg-admin" }
```

**Success `200 OK`:** `{ "success": true, "lead": { ... } }`

**Error responses:**

| Status | Error Code | Condition |
|---|---|---|
| `400` | `validation_error` | `assignee_id` present but not a string or null |
| `404` | `not_found` | Lead or assignee user does not exist |
| `409` | `already_assigned` | Lead already assigned to the same user |

---

### `GET /api/v1/ops/dashboard`

Aggregate operational metrics across all leads.

**Success `200 OK`:**
```json
{
  "success": true,
  "dashboard": {
    "totals": { "all": 4, "new": 2, "contacted": 1, "qualified": 1,
                "disqualified": 0, "unassigned": 1, "urgent": 1 },
    "by_priority": { "urgent": 1, "high": 1, "normal": 2, "low": 0 },
    "recent": [ { "id": "L1", "name": "Alice New", "status": "new", "priority": "normal" } ]
  }
}
```

---

### `GET /api/v1/ops/timeline`

Chronological activity feed (lead events + audit entries), newest first.

**Query parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `limit` | int | 15 | Max events (clamped to 1–100) |

**Success `200 OK`:**
```json
{
  "success": true,
  "events": [
    { "id": "evt_1", "type": "lead_created", "lead_id": "L1",
      "actor_id": "tg-ops", "summary": "Lead L1 created",
      "timestamp": "2026-07-18T…" },
    { "id": "evt_2", "type": "permission_check", "actor_id": "tg-admin",
      "summary": "Permission leads.read → allow", "timestamp": "2026-07-18T…" }
  ]
}
```

---

## Telegram Webhook (Operations Bot)

The Operations Telegram Bot is served **inside the same Worker** — no separate
process or deployment. Telegram sends `update` objects to a registered webhook;
the Worker authenticates and authorizes the caller, then dispatches to the same
Ops handlers used by `/api/v1/ops/*`.

### `POST /telegram/webhook`

Receive a Telegram `update` (message) and respond with rendered text.

**Request (from Telegram):**

```json
{ "message": { "chat": { "id": 123456789 },
               "text": "/lead L1" } }
```

**Identity & authorization:**

| Header | Required | Purpose |
|---|---|---|
| `X-Telegram-Chat-Id` | ✅ | Chat id from the inbound `update.message.chat.id`. Resolved to a `users` row + role via the same `TelegramIdentityResolver` as the HTTP API. |

- Unknown chat id → `401`, responded with a safe "not authorized" text (no
  internal detail).
- Disabled user → `403`.
- Every command is gated by `requirePermission()` against an `ops.*`
  permission. Deny-wins; `OWNER` short-circuits.

**Command → permission map (current seed):**

| Command | Permission | Roles allowed |
|---|---|---|
| `/start`, `/help`, `/dashboard`, `/leads`, `/lead`, `/search`, `/today`, `/mine`, `/consultations`, `/stats` | `leads.read` (or `consultations.read` / `audit.read` for the consultation/stat variants) | owner, admin, ops |
| `/assign` | `leads.assign` | owner, admin, ops |
| `/update` | `leads.update` | owner, admin, ops |
| `/settings` | `settings.read` | owner, admin |

**Response `200 OK`:** plain-text Telegram message (user-safe — no stack
traces, SQL, tokens, or internal IDs). The bot returns `application/json` with
`{ "method": "sendMessage", "chat_id": ..., "text": "..." }` when wired to
Telegram's `webhook` response contract.

**Error responses (auth):** same `401` / `403` codes as the Operations API, but
rendered as friendly chat text rather than JSON.

> **Deployment note:** the handler is wire-ready but requires a registered
> Telegram bot token (`TELEGRAM_BOT_TOKEN`) and a webhook registration pointing
> at `/telegram/webhook`. BotFather setup, live push notifications, and
> interactive confirmation dialogs (spec §5/§7) are out of scope for the MVP.

---

Restricted to known origins:

| Origin | Status |
|---|---|
| `https://agsynergy.ca` | ✅ Allowed |
| `https://www.agsynergy.ca` | ✅ Allowed |
| `http://localhost:5173` | ✅ Allowed (dev) |
| `http://localhost:23815` | ✅ Allowed (artifact dev) |
| All others | ❌ No CORS headers |

Preflight (`OPTIONS`) responds `204 No Content` with appropriate headers.

## Security

| Measure | Status |
|---|---|
| HTTPS enforced | ✅ Cloudflare SSL/TLS |
| Input validation | ✅ Worker-level (type + content) |
| No stack traces exposed | ✅ All errors return structured JSON |
| No SQL injection | ✅ Prepared statements via D1 `stmt.bind()` |
| Rate limiting | ⬜ Planned (Phase 1 foundation ready) |
| Authentication | ⬜ Phase 2 (JWT-based) |

## Deployment

- **Framework:** Wrangler v4
- **Environments:** `production` (custom domain planned), `preview` (workers.dev)
- **Deploy command:** `cd workers && wrangler deploy [--env production|preview]`
- **Deployment runbook:** [`docs/operations/DEPLOYMENT.md`](./docs/operations/DEPLOYMENT.md)

## Testing

141 tests (120 prior + 21 Operations Bot integration) via Vitest + `@cloudflare/vitest-pool-workers`. See [`docs/operations/TESTING.md`](./docs/operations/TESTING.md).

## Future Endpoints (Planned)

| Endpoint | Phase | Purpose |
|---|---|---|
| `GET /api/v1/clinics` | Phase 1+ | List partner clinics |
| `GET /api/v1/services` | Phase 1+ | List available services |
| `GET /api/v1/faqs` | Phase 1+ | List published FAQs |
| `GET /api/v1/consultations/{id}` | Phase 2 | Retrieve consultation status |
| `POST /api/v1/auth/login` | Phase 2 | JWT authentication |
| `GET /api/v1/patients/{id}` | Phase 2 | Patient portal (authenticated) |

## Related Documents

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — System architecture and technology decisions
- [`DATABASE.md`](./DATABASE.md) — D1 schema and migrations
- [`SECURITY.md`](./SECURITY.md) — Security policies and posture
- [`docs/api/README.md`](./docs/api/README.md) — Detailed endpoint reference index