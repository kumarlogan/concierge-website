# EPIC-002-005 — Hermes Admin Bot: Implementation Plan

**Status:** Plan only — do NOT implement
**Priority:** 🟡 Medium
**Dependency:** EPIC-002-002 (Identity Engine) — ✅ Done
**Pattern:** Follows EPIC-002-004 (Operations Bot) architecture

---

## Scope

> **"Owner-only infrastructure/deploy control via Workers API only."**

Admin-only Telegram bot for infrastructure operations: deployment triggers, credential verification, secret management, D1 migration management, and system health checks. Exposed only to users with the `OWNER` role.

---

## Architecture

```
Telegram Update → webhook → [auth: OWNER] → Admin API → Workers API → (Cloudflare/D1/GitHub)
                                     ↓
                             Telegram Reply
```

**Key constraint (ADR-002):** All interfaces communicate ONLY through the Workers API. D1 remains accessible solely through Worker services. The Admin Bot never holds credentials — it delegates all infrastructure actions to the Workers API layer.

Same thin-client pattern as the Operations Bot (`workers/src/routes/telegram.ts`):
- Telegram update parsing (safe, ignore unsupported types)
- Command routing (OWNER-only commands)
- Delegates to Workers API service layer
- Never reads D1, never holds business logic, never bypasses RBAC

---

## Dependencies

| Dependency | Status | Required For |
|------------|--------|-------------|
| EPIC-002-002 Identity Engine | ✅ Done | `requirePermission('owner')` gate |
| Workers API route framework | ✅ Done | Route handler pattern established |
| Telegram webhook handler | ✅ Done | Reuse from Operations Bot |
| `deploy.sh` | ✅ Exists | One-shot Cloudflare deploy |
| Wrangler CLI | ✅ Via npx | Worker deploy commands |
| gh CLI | ⚠️ Expired auth | GitHub secret sync |
| Cloudflare API token | ❌ Missing | Remote D1 operations |
| `workers/src/secrets/` | ❌ Does not exist | Secret management service |
| `workers/src/routes/admin.ts` | ❌ Does not exist | Admin API route handler |
| `workers/src/services/adminService.ts` | ❌ Does not exist | Admin business logic |

---

## Implementation Steps

### Step 1: Admin Service Layer (`workers/src/services/adminService.ts`)

Create the core admin service module. This is the ONLY module that talks to infrastructure (via npx/child_process). Every operation must:
- Be gated by `requirePermission('owner')`
- Log to `audit_logs`
- Never accept user-supplied shell commands
- Return structured results (success/failure + detail)

**Endpoints to implement:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `GET /admin/health` | Read-only | Full system health (Workers, D1, Cloudflare, GitHub) |
| `POST /admin/deploy` | Action | Trigger `deploy.sh` via subprocess, stream output |
| `POST /admin/migrations/apply` | Action | Apply pending D1 migrations |
| `GET /admin/migrations/status` | Read-only | List applied vs pending migrations |
| `GET /admin/credentials/verify` | Read-only | Verify CLOUDFLARE_API_TOKEN, GITHUB_TOKEN validity |
| `POST /admin/secrets/sync` | Action | Sync secrets from env to Cloudflare Workers |
| `POST /admin/worker/redeploy` | Action | Redeploy the agsynergy-api worker |
| `GET /admin/logs` | Read-only | Tail recent audit_logs entries |

### Step 2: Admin Bot Handler (`workers/src/routes/admin.ts`)

Create the Telegram admin bot route handler following the Operations Bot pattern:

```
/admin/bot → webhook → OWNER gate → admin service → Telegram reply
```

**Commands:**

| Command | Permission | Description |
|---------|------------|-------------|
| `/admin health` | OWNER | System health summary |
| `/admin deploy` | OWNER | Deploy static website |
| `/admin migrations` | OWNER | List/apply D1 migrations |
| `/admin credentials` | OWNER | Verify credential health |
| `/admin worker` | OWNER | Worker status/redeploy |
| `/admin logs` | OWNER | Recent audit entries |

### Step 3: Admin API Routes (`workers/src/routes/ops.ts` — extend existing or new `admin.ts`)

Wire the admin service endpoints into the Workers API router:
- All under `/api/v1/admin/`
- All require `requirePermission('owner')`
- Audit every write action
- Reuse existing middleware (CORS, rate limiting, auth)

### Step 4: Integration Tests

Create test file `workers/tests/admin-bot.test.ts` testing:
- OWNER can access admin commands
- ADMIN/OPERATIONS/VIEWER are rejected with 403
- Health endpoint returns expected structure
- Audit log entries are created for admin actions
- Invalid commands return friendly errors

---

## Estimated Effort

| Step | Files | Est. Hours | Complexity |
|------|-------|-----------|------------|
| Step 1: Admin Service | 1 new file (~250 lines) | 4h | Medium |
| Step 2: Admin Bot Handler | 1 new file (~350 lines) | 4h | Medium |
| Step 3: Admin API Routes | 1-2 new files (~100 lines) + router wiring | 2h | Low |
| Step 4: Integration Tests | 1 new file (~150 lines) | 2h | Medium |
| **Total** | **3-4 new files** | **12h** | |

---

## Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Wrangler/gh auth expired mid-operation | High | Medium | Pre-flight credential check before any action; report clear error |
| Subprocess execution in Workers | High | High | Workers sandbox blocks shell access — must run admin operations via **delegate to external process** or **Cloudflare API calls directly** |
| Cloudflare API token rotation | Medium | High | Store in `wrangler secret`; admin bot should expose verification endpoint |
| Accidental production deploy | Low | High | Require confirmation step (`/admin deploy confirm`) with 30s timeout |
| No admin bot before cloudflare credentials | High | High | Admin bot cannot deploy itself — deploy stack: `deploy.sh` → wrangler → Workers API → Admin Bot route |
| `workers_dev: true` exposes dev API publicly | Medium | Medium | Restrict admin routes to OWNER role; do not expose `/admin/*` on preview |

---

## Acceptance Criteria

- [ ] `OWNER` users can execute all admin commands via Telegram
- [ ] `ADMIN`/`OPERATIONS`/`VIEWER` users receive permission-denied message
- [ ] Every admin action is logged to `audit_logs`
- [ ] Health endpoint reports live status of: API, D1, Cloudflare, GitHub
- [ ] Deploy command triggers `deploy.sh` and streams output
- [ ] Migration command lists pending migrations and applies safely
- [ ] Credential verification reports token expiry/validity
- [ ] All actions idempotent (safe to retry)
- [ ] 403 response for non-OWNER includes no operational details
- [ ] Tests: OWNER access ✅, role denial ✅, health shape ✅, audit ✅

---

## Pre-Implementation Checklist

1. ✅ EPIC-002-002 (Identity Engine) — done
2. ✅ EPIC-002-003/004 (Operations Bot pattern) — done
3. ⬜ Resolve gh auth (expired token)
4. ⬜ Resolve Cloudflare auth (missing credentials)
5. ⬜ Create admin service layer (Step 1)
6. ⬜ Wire admin API routes (Step 3)
7. ⬜ Create admin bot handler (Step 2)
8. ⬜ Write integration tests (Step 4)

---

*EPIC-002-005 — Plan only. Not implemented.*