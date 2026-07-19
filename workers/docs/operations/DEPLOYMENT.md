# AG Synergy — Production Deployment Workflow (EPIC-002-003.5)

**Scope:** Repeatable, idempotent production deployment of the `agsynergy-api`
Worker + D1 migrations, run from an *authenticated* Wrangler environment.
**This document does NOT deploy anything** — it is the operator runbook.

> Prerequisites (resolve before running):
> - `npx wrangler --version` works (Wrangler installed).
> - Authenticated with a token that has **Workers + D1** permissions.
>   The D1-scoped token stored in project memory is NOT sufficient for
>   `wrangler d1 migrations apply` — it returns `Authentication error [code: 10000]`.
>   Use `CLOUDFLARE_API_TOKEN=<full token>` or `wrangler login`.
> - Run from the `workers/` directory.

---

## 0. Setup (one-time per shell)

```bash
cd /home/ubuntu/hermes-website/workers
export CLOUDFLARE_API_TOKEN="<YOUR_WORKERS+D1_TOKEN>"   # or: wrangler login
export CLOUDFLARE_ACCOUNT_ID="d0a58133c1495fa5e42cbca0aebaa36b"
ACCOUNT_NAME="Nous Research"
DB="agsynergy-db"
```

**Expected:**
- No output on success. `cd` succeeds; exports set silently.
- If `CLOUDFLARE_API_TOKEN` is wrong, later steps fail with `code: 10000`.

---

## 1. Verify Wrangler authentication

```bash
npx wrangler whoami
```

**Expected:**
```
───────────────────────────
Getting User settings...
👋 You are logged in as <email> (<ACCOUNT_NAME>)
───────────────────────────
```
**PASS** = shows an account. **FAIL** = `not authenticated` → stop, fix token.

---

## 2. Verify the target account

```bash
npx wrangler accounts list | grep -i "$ACCOUNT_NAME"
```

**Expected:**
```
<account-id>  <ACCOUNT_NAME>
```
**PASS** = the line above appears and `account-id` == `d0a58133c1495fa5e42cbca0aebaa36b`.
**FAIL** = not listed → wrong token/account, stop.

---

## 3. Apply pending D1 migrations (idempotent)

```bash
echo "=== BEFORE: applied migrations ===" 
npx wrangler d1 migrations list "$DB" --env production

echo "=== APPLY (idempotent: already-applied = no-op, not an error) ==="
npx wrangler d1 migrations apply "$DB" --env production --remote
```

**Expected:**
- `migrations list` shows 4 entries; pending ones marked `🕒`/not applied.
- `apply` prints each file; already-applied files show `(already applied)` and
  the command exits **0**. New files apply and report success.
- Final state: `0001`–`0004` all `✅`.
**PASS** = exit 0, 4 migrations applied/confirmed.
**FAIL** = non-zero exit or SQL error → stop, do NOT deploy.

---

## 4. Deploy the Worker (safe replace)

```bash
npx wrangler deploy --env production
```

**Expected:**
```
✅ Success! Uploaded agsynergy-api (X.XX sec)
🌍 Deployed to: https://api.agsynergy.ca
```
**PASS** = `Success!` + deployed URL printed. Deploy replaces the prior
version automatically (kept for `wrangler rollback`).
**FAIL** = build/bind error → read message, fix, retry. Do not proceed.

---

## 5. Verify the deployment is live

```bash
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://api.agsynergy.ca/api/v1/health
```

**Expected:** `HTTP 200`
**PASS** = `200`. **FAIL** = anything else → check `wrangler tail` / deploy logs.

---

## 6. Verify the health endpoint (expanded contract)

```bash
curl -s https://api.agsynergy.ca/api/v1/health | python3 -m json.tool
```

**Expected (all fields present, DB healthy):**
```json
{
  "status": "healthy",
  "service": "agsynergy-api",
  "version": "1.3.0",
  "environment": "production",
  "timestamp": "<ISO-8601 UTC>",
  "database": {
    "connected": true,
    "migrationVersion": 4,
    "migrationCount": 4
  }
}
```
**PASS** = `status: "healthy"`, `database.connected: true`, `migrationVersion: 4`.
**FAIL** = `status: "degraded"` / `database.connected: false` → page on-call
(DB unreachable). No secrets are ever returned by this endpoint.

---

## 7. Smoke test — Operations API

```bash
BASE="https://api.agsynergy.ca"

echo "--- Ops dashboard (requires auth header if enforced) ---"
curl -s -o /dev/null -w "dashboard HTTP %{http_code}\n" \
  -H "Authorization: Bearer <OPS_TOKEN_IF_REQUIRED>" \
  "$BASE/api/v1/ops/dashboard"

echo "--- Ops timeline ---"
curl -s -o /dev/null -w "timeline HTTP %{http_code}\n" \
  -H "Authorization: Bearer <OPS_TOKEN_IF_REQUIRED>" \
  "$BASE/api/v1/ops/timeline"

echo "--- Rate-limit headers present? ---"
curl -s -D - -o /dev/null "$BASE/api/v1/health" | grep -i "x-ratelimit" && echo "rate-limit headers OK"

echo "--- Epic 1 consultation happy path (unchanged) ---"
curl -s -X POST "$BASE/api/v1/consultations" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"Smoke\",\"email\":\"smoke-$(date +%s)@example.com\",\"phone\":\"+1-555-000-1111\",\"treatment_interest\":\"IVF\"}" \
  | grep -o '"status":"new"' && echo "consultation OK"
```

**Expected:**
- `dashboard HTTP 200` (or `401` if auth enforced and token omitted — supply token).
- `timeline HTTP 200`.
- `x-ratelimit-limit` / `x-ratelimit-remaining` headers printed.
- `"status":"new"` from the consultation POST.
**PASS** = all three endpoints return expected codes and the consultation
creates a `new` lead. **FAIL** = `5xx` or missing `new` → investigate.

---

## 8. Final report (operator fills in)

| Step | Command | Result |
|------|---------|--------|
| 1 Auth | `wrangler whoami` | PASS / FAIL |
| 2 Account | `accounts list` | PASS / FAIL |
| 3 Migrations | `d1 migrations apply` | PASS / FAIL |
| 4 Deploy | `wrangler deploy` | PASS / FAIL |
| 5 Live | `curl /health` | PASS / FAIL |
| 6 Health | `curl /health` (JSON) | PASS / FAIL |
| 7 Smoke | Ops API curl | PASS / FAIL |

**All PASS → production ready. Any FAIL → stop, remediate, re-run from that step.**

---

## Idempotency notes
- `d1 migrations apply` is safe to re-run; applied files are skipped (no error).
- `wrangler deploy` replaces the live version; previous kept for `wrangler rollback`.
- Health/smoke checks are read-only; safe to repeat.

## Rollback (if needed)
```bash
npx wrangler rollback --env production          # to previous version
# DB migrations are NOT auto-reversible — write a new forward migration to undo.
```
