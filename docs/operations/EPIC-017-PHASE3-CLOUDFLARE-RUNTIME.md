# Phase 3 — Cloudflare Runtime Configuration Checklist

**EPIC-017** — Production Email Activation & First Patient Certification
**Status:** AWAITING PHASE 2 COMPLETION
**Owner:** Operations
**Date:** 2026-08-06

---

## 3.1 Prerequisites (from Phase 2)

- [ ] All DNS records verified (SPF, DKIM, DMARC, MX)
- [ ] Resend dashboard: Domain = Verified, DKIM = Verified
- [ ] Cloudflare Email Routing active
- [ ] Resend API key generated (`re_...`)

---

## 3.2 Worker Configuration Validation

### 3.2.1 Verify `wrangler.jsonc` — Production Environment

**File:** `workers/wrangler.jsonc` → `env.production.vars`

| Variable | Current Value | Required | Action |
|----------|---------------|----------|--------|
| `ENVIRONMENT` | `production` | ✓ | Already set |
| `RATE_LIMIT_WINDOW_MS` | `60000` | ✓ | Already set |
| `RATE_LIMIT_LIMIT` | `60` | ✓ | Already set |
| `TURNSTILE_SECRET_KEY` | `""` | ✓ | Set via secret |
| `RESEND_API_KEY` | `""` | **REQUIRED** | **Set via secret** |
| `EMAIL_FROM` | `""` | **REQUIRED** | **Set via secret** |
| `APP_URL` | `""` | **REQUIRED** | **Set via secret** |

**Note:** All three email variables are declared as empty strings in `vars` — real values MUST be injected via Worker Secrets.

---

### 3.2.2 Verify `wrangler.jsonc` — Preview Environment

**File:** `workers/wrangler.jsonc` → `env.preview.vars`

| Variable | Current Value | Required | Action |
|----------|---------------|----------|--------|
| `ENVIRONMENT` | `preview` | ✓ | Already set |
| `RATE_LIMIT_WINDOW_MS` | `60000` | ✓ | Already set |
| `RATE_LIMIT_LIMIT` | `60` | ✓ | Already set |
| `TURNSTILE_SECRET_KEY` | `""` | ✓ | Set via secret |
| `RESEND_API_KEY` | `""` | **REQUIRED** | **Set via secret** |
| `EMAIL_FROM` | `""` | **REQUIRED** | **Set via secret** |
| `APP_URL` | `""` | **REQUIRED** | **Set via secret** |

---

### 3.2.3 Verify Root `wrangler.jsonc` (Frontend Worker)

**File:** `/home/ubuntu/concierge-website/wrangler.jsonc` (root)

The frontend worker doesn't need email secrets directly, but verify:
- [ ] `vars.APP_URL` is set (used by frontend for API calls)
- [ ] No secrets committed in this file

---

## 3.3 Worker Secrets Configuration

### 3.3.1 Production Secrets (agsynergy-api)

```bash
cd /home/ubuntu/concierge-website/workers

# Set Resend API Key
wrangler secret put RESEND_API_KEY --env production
# Paste: re_xxxxxxxxxxxxxxxxxxxxxxxx

# Set Email From Address
wrangler secret put EMAIL_FROM --env production
# Paste: noreply@agsynergy.ca

# Set Application URL
wrangler secret put APP_URL --env production
# Paste: https://www.agsynergy.ca

# Verify JWT secrets are already set (from previous deployments)
wrangler secret list --env production
# Should show: JWT_PRIVATE_KEY, JWT_PUBLIC_KEY, JWT_KID, PLATFORM_JWT_PUBLIC_KEY, PLATFORM_JWT_KID
```

**Verification:**
```bash
wrangler secret list --env production
# Expected output includes:
# RESEND_API_KEY
# EMAIL_FROM
# APP_URL
# JWT_PRIVATE_KEY
# JWT_PUBLIC_KEY
# JWT_KID
# PLATFORM_JWT_PUBLIC_KEY
# PLATFORM_JWT_KID
# TURNSTILE_SECRET_KEY
```

---

### 3.3.2 Preview Secrets (agsynergy-api)

```bash
cd /home/ubuntu/concierge-website/workers

# Use same values or preview-specific if different
wrangler secret put RESEND_API_KEY --env preview
# Paste: re_xxxxxxxxxxxxxxxxxxxxxxxx (can use same or different key)

wrangler secret put EMAIL_FROM --env preview
# Paste: noreply@agsynergy.ca

wrangler secret put APP_URL --env preview
# Paste: https://agsynergy-api-preview.kumarlogan.workers.dev
# OR: https://preview.agsynergy.ca (if configured)

# Verify
wrangler secret list --env preview
```

---

### 3.3.3 Development Secrets (Local)

```bash
cd /home/ubuntu/concierge-website/workers

# Create .dev.vars file (NOT committed to git)
cat > .dev.vars << 'EOF'
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxx
EMAIL_FROM=noreply@agsynergy.ca
APP_URL=http://localhost:8787
JWT_PRIVATE_KEY=...
JWT_PUBLIC_KEY=...
JWT_KID=default
PLATFORM_JWT_PUBLIC_KEY=...
PLATFORM_JWT_KID=default
TURNSTILE_SECRET_KEY=...
EOF

# Verify .dev.vars is in .gitignore
grep ".dev.vars" .gitignore
```

---

## 3.4 Environment Bindings Validation

### 3.4.1 D1 Database Bindings (Production)

**File:** `workers/wrangler.jsonc` → `env.production.d1_databases`

| Binding | Database Name | Database ID | Status |
|---------|---------------|-------------|--------|
| `DB` | `agsynergy-db` | `45f52102-74e1-4ba2-86ca-f4d5f88e16c4` | ✓ Configured |
| `NOTIFICATIONS` | `agsynergy-notifications` | *(empty)* | ⚠️ **Needs ID** |

> **Action:** Get NOTIFICATIONS database ID from Cloudflare dashboard and update `wrangler.jsonc`

### 3.4.2 R2 Bucket Bindings

**File:** `workers/wrangler.jsonc` → top-level `r2_buckets`

| Binding | Bucket Name | Preview Bucket | Status |
|---------|-------------|----------------|--------|
| `DOCUMENT_STORAGE` | `agsynergy-documents` | `agsynergy-documents-preview` | ✓ Configured |

---

## 3.5 Environment Variable Validation Matrix

| Variable | Type | Prod | Preview | Dev | Notes |
|----------|------|------|---------|-----|-------|
| `ENVIRONMENT` | var | `production` | `preview` | `development` | Auto-set by wrangler |
| `RESEND_API_KEY` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | `re_...` format |
| `EMAIL_FROM` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | `noreply@agsynergy.ca` |
| `APP_URL` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | HTTPS URL |
| `JWT_PRIVATE_KEY` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | RS256 PEM |
| `JWT_PUBLIC_KEY` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | RS256 PEM |
| `JWT_KID` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | e.g., `default` |
| `PLATFORM_JWT_PUBLIC_KEY` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | Same as JWT_PUBLIC_KEY |
| `PLATFORM_JWT_KID` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | Same as JWT_KID |
| `TURNSTILE_SECRET_KEY` | secret | **REQUIRED** | **REQUIRED** | **REQUIRED** | From Cloudflare Turnstile |
| `DB` | binding | ✓ | ✓ | ✓ | D1 database |
| `NOTIFICATIONS` | binding | ⚠️ Needs ID | ⚠️ Needs ID | ✓ | D1 database |
| `DOCUMENT_STORAGE` | binding | ✓ | ✓ | ✓ | R2 bucket |

---

## 3.6 No Secrets Committed Check

```bash
# Search for potential secret patterns in committed files
cd /home/ubuntu/concierge-website
git log --all -p --source --remotes -S "re_" -- "*.ts" "*.json" "*.jsonc" "*.md" | head -100

# Check wrangler.jsonc for hardcoded values
grep -n "re_" workers/wrangler.jsonc
grep -n "noreply@" workers/wrangler.jsonc
grep -n "https://www.agsynergy.ca" workers/wrangler.jsonc

# All should return NO RESULTS (only empty string placeholders)
```

---

## 3.7 Deployment Verification

### 3.7.1 Deploy to Preview

```bash
cd /home/ubuntu/concierge-website/workers
wrangler deploy --env production
# Verify deployment succeeds
```

### 3.7.2 Smoke Test Production API

```bash
# Health endpoint
curl -s https://api.agsynergy.ca/api/v1/health
# Expected: 200, {"status":"healthy",...}

# Identity register endpoint
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.agsynergy.ca/identity/register \
  -H "Content-Type: application/json" \
  -d '{"identityType":"patient","email":"test@example.com","password":"Test12345678!"}'
# Expected: 200 (or 500 if email not configured yet)

# Identity email verification endpoint
curl -s -o /dev/null -w "%{http_code}" -X POST https://api.agsynergy.ca/identity/email/verify \
  -H "Content-Type: application/json" \
  -d '{"identityId":"...","email":"test@example.com"}'
# Expected: 200
```

---

## 3.8 Configuration Validation Report Template

| Component | Status | Evidence |
|-----------|--------|----------|
| wrangler.jsonc production vars | ⬜ | |
| wrangler.jsonc preview vars | ⬜ | |
| Root wrangler.jsonc clean | ⬜ | |
| RESEND_API_KEY (prod) | ⬜ | `wrangler secret list --env production` |
| EMAIL_FROM (prod) | ⬜ | `wrangler secret list --env production` |
| APP_URL (prod) | ⬜ | `wrangler secret list --env production` |
| JWT secrets (prod) | ⬜ | `wrangler secret list --env production` |
| RESEND_API_KEY (preview) | ⬜ | `wrangler secret list --env preview` |
| EMAIL_FROM (preview) | ⬜ | `wrangler secret list --env preview` |
| APP_URL (preview) | ⬜ | `wrangler secret list --env preview` |
| NOTIFICATIONS DB ID | ⬜ | Updated in wrangler.jsonc |
| No secrets in git | ⬜ | `git log -p` search clean |
| Preview deployment | ⬜ | `wrangler deploy --env preview` |
| Production deployment | ⬜ | `wrangler deploy --env production` |
| Health endpoint | ⬜ | `curl api.agsynergy.ca/api/v1/health` |
| Identity routes accessible | ⬜ | Test register/verify endpoints |

---

## 3.9 Deliverables

- [ ] All 3 email secrets set in **production** environment
- [ ] All 3 email secrets set in **preview** environment
- [ ] JWT secrets verified in both environments
- [ ] TURNSTILE_SECRET_KEY set in both environments
- [ ] NOTIFICATIONS database ID added to `wrangler.jsonc`
- [ ] Zero secrets in git history
- [ ] Preview deployment successful
- [ ] Production deployment successful
- [ ] Health endpoint returns 200
- [ ] Identity routes respond (not 404)

---

## 3.10 Next Phase Dependency

**Phase 4 (Operational Smoke Test) cannot proceed until:**
- All secrets configured in production
- Production deployment successful
- Health endpoint returns 200
- Identity routes accessible (not 404)