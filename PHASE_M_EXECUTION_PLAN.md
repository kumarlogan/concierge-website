# Phase M — Production Validation Execution Plan

## Status Summary

### ✅ Completed (Code & Tests Ready)
1. **Phase M Token/Session Security Matrix** - 44 tests passing in Miniflare (local)
2. **Phase M Production Replay Test** - 22 tests created at `workers/tests/prod-replay/phaseM-prod-replay.test.ts`
3. **GitHub Actions Workflow** - Created at `.github/workflows/phase-m-prod-replay.yml`
4. **WAF Exemption Documentation** - Created at `docs/operations/PHASE-M-WAF-EXEMPTION-SETUP.md`
5. **Rollback Script** - Created at `scripts/rollback-cloudflare-waf-exemption.py`

### 🔄 Required: Cloudflare WAF Configuration
**Before running production replay**, configure the narrow WAF skip rule to exempt authenticated consent POSTs from Bot Fight Mode:

**Dashboard Steps:**
1. Cloudflare Dashboard → Security → WAF → Custom Rules → agsynergy.ca
2. Create rule:
   - Name: `Phase M: Exempt authenticated consent POSTs from Bot Fight Mode`
   - Expression: `(http.request.method == "POST" and http.request.uri.path matches "^/api/v1/consent/" and http.request.headers["authorization"][0] matches "^Bearer ")`
   - Action: **Skip** → **Bot Management**
   - Status: **Enabled**

**Or run the automation script:**
```bash
export CLOUDFLARE_API_TOKEN="your-token-with-zone-waf-edit"
export CLOUDFLARE_ZONE_ID="agsynergy-ca-zone-id"  # optional, auto-detected
python3 scripts/configure-cloudflare-waf-exemption.py
```

### 🚀 Execution Steps (After WAF Rule Active)

#### 1. Verify WAF Rule Works
```bash
# Should reach Worker (401/403 from auth layer, NOT Cloudflare challenge)
curl -X POST https://api.agsynergy.ca/api/v1/consent/grant \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer *** \
  -d '{"consentType":"privacy","scope":[],"purpose":"test"}'

# Should be blocked by Cloudflare (no auth header)
curl -X POST https://api.agsynergy.ca/api/v1/consent/grant \
  -H "Content-Type: application/json" \
  -d '{"consentType":"privacy","scope":[],"purpose":"test"}'
```

Expected: First = Worker response (401/403), Second = Cloudflare challenge (cf-mitigated: challenge)

#### 2. Run Production Replay
**Option A: GitHub Actions (Recommended - uses production JWT secrets)**
1. Go to GitHub → Actions → "Phase M Production Replay"
2. Click "Run workflow" → "Run workflow"
3. Wait for completion (~2-3 minutes)
4. Check results in workflow logs

**Option B: Local (requires production JWT key)**
```bash
export PROD_JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----..."
export PROD_JWT_KID="your-kid"
export PROD_API_BASE="https://api.agsynergy.ca"
cd workers && npx vitest run --config vitest.replay.config.ts --reporter=verbose
```

#### 3. Verify All Gates Pass
Required for **🟢 GREEN** certification:

| Gate | Test | Expected |
|------|------|----------|
| Engineering | Typecheck (Phase-introduced=0) | ✅ PASS |
| Security | Independent review - no critical/high | ✅ PASS |
| Architecture | EPCL→WAS→WEF preserved | ✅ PASS |
| QA | Full matrix re-run with evidence | ✅ PASS |
| Production | A→A grant = 201 | ✅ |
| Production | B→B grant = 201 | ✅ |
| Production | A→B grant = 403, 0 D1 mutation | ✅ |
| Production | B→A grant = 403, 0 D1 mutation | ✅ |
| Production | A→B revoke = 403, 0 D1 mutation | ✅ |
| Production | B→A revoke = 403, 0 D1 mutation | ✅ |
| Production | Malformed/expired/unknown tokens rejected | ✅ |
| Production | Cross-patient history reads = 403 | ✅ |
| Production | JWT validation active (no bypass) | ✅ |
| Production | Cloudflare exemption narrowly scoped | ✅ |

#### 4. Documentation Updates (If All Pass)
- Update `docs/context/KNOWN_GAPS.yaml` with Phase M entry
- Update `CURRENT_WORK.yaml` with Phase M completion
- Create Phase M Certification Report
- Update Cloudflare operational documentation with rule ID and rollback procedure

### 🔴 Stop Conditions (Any Failure = RED)
- Any cross-patient mutation succeeds (403 expected, got 200/201)
- Any unauthorized token accepted (malformed/expired/unknown key)
- Cloudflare exemption too broad (affects non-consent endpoints)
- Secret leakage in logs/responses
- Pre-existing behavior broken (A→A or B→B fails)

### 🟡 Conditional (If WAF Cannot Be Constrained)
- Do NOT weaken the rule further
- STOP - return to Engineering for alternative approach

### Rollback Information
| Item | Value |
|------|-------|
| Previous rule | None (Bot Fight Mode fully active) |
| New rule | `phase-m-consent-post-exemption` (skip botManagement for auth consent POSTs) |
| Rule ID | (from Cloudflare after creation) |
| Rollback action | Delete custom rule `phase-m-consent-post-exemption` |
| Rollback script | `scripts/rollback-cloudflare-waf-exemption.py` |
| Operator | (who runs the config) |
| Timestamp | (when applied) |

---

## Files Created/Modified

| File | Purpose |
|------|---------|
| `workers/tests/prod-replay/phaseM-prod-replay.test.ts` | Production replay test (22 tests) |
| `.github/workflows/phase-m-prod-replay.yml` | CI workflow for production replay |
| `scripts/configure-cloudflare-waf-exemption.py` | Automation script |
| `scripts/rollback-cloudflare-waf-exemption.py` | Rollback script |
| `docs/operations/PHASE-M-WAF-EXEMPTION-SETUP.md` | Manual dashboard instructions |

---

## Next Action Required
**Configure the Cloudflare WAF skip rule** (dashboard or script), then trigger the GitHub Actions workflow to execute the production replay and certify Phase M.