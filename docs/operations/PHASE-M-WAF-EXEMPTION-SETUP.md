# Phase M: Cloudflare WAF Skip Rule Configuration (Manual Dashboard Steps)

## Prerequisites
- Cloudflare Dashboard access for agsynergy.ca zone
- WAF Rules permissions

## Configuration

### 1. Navigate to WAF Custom Rules
1. Go to **Cloudflare Dashboard** → **Security** → **WAF** → **Custom Rules**
2. Select zone: **agsynergy.ca**

### 2. Create New Custom Rule
Click **Create rule** and configure:

| Field | Value |
|-------|-------|
| **Rule name** | `Phase M: Exempt authenticated consent POSTs from Bot Fight Mode` |
| **Expression** | `(http.request.method == "POST" and http.request.uri.path matches "^/api/v1/consent/" and http.request.headers["authorization"][0] matches "^Bearer ")` |
| **Action** | **Skip** → **Bot Management** |
| **Status** | **Enabled** |

### 3. Expression Breakdown
The expression ensures the exemption ONLY applies when ALL conditions are met:
- ✅ `http.request.method == "POST"` - Only POST requests
- ✅ `http.request.uri.path matches "^/api/v1/consent/"` - Only consent endpoints
- ✅ `http.request.headers["authorization"][0] matches "^Bearer "` - Only requests with valid Authorization: Bearer header

### 4. What This Does NOT Exempt
- ❌ GET requests to `/api/v1/consent/*`
- ❌ POST requests without Authorization header
- ❌ POST requests with malformed Authorization header
- ❌ Any other endpoints (timeline, messages, documents, etc.)
- ❌ Bot Fight Mode for all other traffic

### 5. Verify the Rule Works
After saving, test with:

```bash
# This should get 401 (reaches worker) - NOT blocked by challenge
curl -X POST https://api.agsynergy.ca/api/v1/consent/grant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer invalid.token" \
  -d '{"consentType":"privacy","scope":[],"purpose":"test"}'

# This should be blocked by Cloudflare (no auth header)
curl -X POST https://api.agsynergy.ca/api/v1/consent/grant \
  -H "Content-Type: application/json" \
  -d '{"consentType":"privacy","scope":[],"purpose":"test"}'
```

Expected results:
- First request: `401 VERIFICATION_FAILED` or `403` (reaches Worker)
- Second request: `403` with `cf-mitigated: challenge` (Managed Challenge)

### 6. Rollback Procedure
If issues arise, disable/delete the rule:
1. Go to **Security** → **WAF** → **Custom Rules**
2. Find rule: `Phase M: Exempt authenticated consent POSTs from Bot Fight Mode`
3. Click **Delete** or toggle **Enabled** to **Off**

This restores original Bot Fight Mode behavior for all requests.

---

## Automation Script (for CI/CD)

If you prefer to automate, run this after exporting credentials:

```bash
export CLOUDFLARE_API_TOKEN="your-token-with-zone-waf-edit"
export CLOUDFLARE_ZONE_ID="your-zone-id"  # or let script auto-detect

python3 scripts/configure-cloudflare-waf-exemption.py
```

To rollback:
```bash
python3 scripts/rollback-cloudflare-waf-exemption.py
```