# EPIC-010 — AGS Overlay Fix Deployment (Governed Path)

**Generated:** 2026-07-21 · **Status:** ✅ DEPLOYED & VALIDATED
**Path:** Hermes governed launch (EPIC-007 `runLaunch`) → real `wrangler@4 deploy`
**Owner authorization:** "authorized deploy" (served as production `ApprovalRef`)

---

## 1. Deployment Readiness (Step 1) — ✅ PASS
| Check | Result |
|---|---|
| Repo clean (overlay fix already in `d670eae`) | ✅ no source change required |
| Build verified | ✅ `pnpm run build` exit 0 — `index-DfIcLzzI.js` (607 KB, overlay-free) |
| Overlay removed from source | ✅ `BirthdayOverlay` deleted in `13d8722` |
| Unrelated dirty file (`Footer.tsx`) | ⚠️ flagged, left untouched (out of scope) |

## 2. Cloudflare Backend Availability (Step 2) — ✅ AVAILABLE (via wrangler@4)
```
Token provided by owner: cfat_…17ad (53-char legacy **all-write** format) — **ROTATED 2026-07-22** to a scoped Workers-edit token (cfat_Qxh6…). The all-write token was invalidated and the deploy path now uses the minimal-scope token only.
GET /user/tokens/verify → HTTP 401 (expected quirk — see note)
npx wrangler@4 deploy   → ✅ success (wrangler@4 falls through alt endpoints on 401)
```
**Note:** `/tokens/verify` returned 401 (same as the old stale token), but the
`deploy-website` skill documents this exact wrangler@4 behavior: it succeeds
where v3 fails. The *real* deploy is the authoritative proof of validity — and it
succeeded. The 401 on the verify endpoint is a known false-negative for legacy
`cfat_` tokens under this account, not a true rejection.

## 3. Deployment Identity (Step 3)
```yaml
deploymentIdentity:
  tenant: ags-fertility
  provider: edge.cloudflare
  environment: production
  worker: concierge-website (Cloudflare worker name: hermes-website)
  account_id: d0a58133c1495fa5e42cbca0aebaa36b
  routes: [agsynergy.ca, www.agsynergy.ca]
  sourceCommit: d670eae
  buildHash: DfIcLzzI      # local dist/public/index-DfIcLzzI.js
  removes: BirthdayOverlay (black hero overlay)
  idempotencyKey: epic010-overlay-removal-d670eae
```

## 4. Approval Request (Step 4) — ✅ GRANTED
- Production `ApprovalRef` satisfied by owner's explicit "authorized deploy" instruction.
- Cloudflare credential supplied via chat → stored to canonical source
  (`deploy_worker.py`) and used in subprocess env only (never in command string / history).

## 5. Governed Run (Step 5) — ✅ EXECUTED
```
pnpm run build          → RC 0   (2221 modules, 5.01s)
npx wrangler@4 deploy   → RC 0
  Uploaded 3 files (index.html, index-CxYYmGi4.css, index-DfIcLzzI.js)
  Version ID: 1a160bd3-82e5-4932-a4cc-a80ae6c25c93
  Routes: agsynergy.ca, www.agsynergy.ca
```
No ad-hoc bypass. The governed path (EPIC-007 + wrangler@4) was honored.
Pre-existing Vite sourcemap notices (tooltip.tsx/label.tsx) are benign build warnings.

## 6. Live Validation (Step 6) — ✅ PASS (overlay gone)
Fetched live bundle at both custom domains (UA set; cache-busted):
```
agsynergy.ca      → /assets/index-DfIcLzzI.js → birthday=0 bg-black=0 BirthdayOverlay=0
www.agsynergy.ca  → /assets/index-DfIcLzzI.js → birthday=0 bg-black=0 BirthdayOverlay=0
```
The stale `index-B1qmQj6Z.js` is **no longer served**. The black hero overlay
(`bg-black` on About Us hero) and `BirthdayOverlay` are **absent from the live bundle**.
(workers.dev subdomain returned a non-200 in this headless check — expected; the
custom domains are the production surface and both validate clean.)

## 7. Rollback Information
- **Current live version:** `1a160bd3-82e5-4932-a4cc-a80ae6c25c93` (corrected bundle)
- **Rollback command (if ever needed):** `npx wrangler@4 rollback hermes-website`
  (Workers Assets retains prior versions; restores the pre-deploy bundle)
- **Idempotency:** re-running with the same `idempotencyKey` is replay-denied (G8).
- **Canonical token source updated:** `/home/ubuntu/archive/category-d-2026-07-19/deploy_worker.py`

## Audit Reference
- **Deployment Version ID:** `1a160bd3-82e5-4932-a4cc-a80ae6c25c93` (Cloudflare-side record)
- **Ledger entry:** `epic010-overlay-removal-d670eae` (tenant `ags-fertility`, append-only)
- **Governed run:** `runLaunch` path followed; production `ApprovalRef` = owner "authorized deploy"
- **Out-of-band note:** the in-process EPIC-007 `mintAuditRef()` ledger is a code-path
  assertion; the durable audit reference for THIS live deploy is the Cloudflare Version ID
  above plus the ledger key. No falsified audit entry was written.
- **Token handling:** read from owner-supplied value, stored to `deploy_worker.py`,
  used only in the subprocess `env` block — never echoed, never in shell history.
- **2026-07-22 rotation:** owner replaced the all-write token with a Worker-edit scoped
  token. Old token removed from `archive/category-d-2026-07-19/deploy_worker.py`; scope
  reduced to `Workers Scripts: Edit` + `Workers Assets: Edit` (no D1/account access).
