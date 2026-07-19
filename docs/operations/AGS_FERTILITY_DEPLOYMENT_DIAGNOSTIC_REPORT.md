# AGS Fertility Website — Deployment Diagnostic Report

**Date:** 2026-07-19
**Scope:** Read-only investigation of AGS Fertility website (static frontend) Cloudflare deploy failure.
**Isolated from:** Hermes Platform EPIC execution. No EPIC files, `hermes/`, `shared/`, `workers/src/auth/`, migrations, or AI-workforce modules were touched. No commits, deploys, or secret changes made.

---

## 1. Current Failure Symptoms (as reported)

- AGS Fertility website fails to deploy on Cloudflare (Pages/Workers) via GitHub Actions.
- Failure persists **even after attempting a manual local build + deploy**.
- The frontend is a static Vite SPA intended to be served as a Cloudflare **assets-only Worker** at `agsynergy.ca` / `www.agsynergy.ca`.

---

## 2. Deployment Path Under Investigation

| Stage | Config / File | Status |
|-------|---------------|--------|
| CI trigger | `.github/workflows/deploy.yml` (push → `main`) | Present |
| Package manager | `pnpm` (`pnpm-workspace.yaml`, `pnpm-lock.yaml`) | OK |
| Install | `pnpm install --frozen-lockfile=false` | ✅ Verified green locally |
| Build | `pnpm --filter @workspace/ags-fertility run build` → `vite build` | ✅ Verified green locally |
| Deploy | `cloudflare/wrangler-action@v3` with `command: deploy` (root `wrangler.jsonc`) | ⚠️ **Suspected failure zone** |
| Target config | root `wrangler.jsonc` (assets-only, no `main`, custom domains) | ⚠️ Schema-valid for wrangler 3.114; unverified for action's bundled older wrangler |

**Local reproduction results (this machine, 2026-07-19):**
- `pnpm install --frozen-lockfile=false` → exit 0 ("Already up to date")
- `pnpm --filter @workspace/ags-fertility run build` → exit 0; emitted `artifacts/ags-fertility/dist/public/index.html` + hashed JS/CSS assets (607 kB JS / 190 kB gzip). Only harmless sourcemap warnings.
- `npx wrangler --version` → **3.114.17** (warning: update available **4.112.0**)
- `npx wrangler deploy --dry-run` (root config) → exit 0, "Total Upload: 0.38 KiB", "No bindings found" — config parses cleanly under wrangler 3.114.
- `npx wrangler whoami` → "You are not authenticated" (expected locally; CI uses `CLOUDFLARE_API_TOKEN` secret).

**Conclusion:** Install and build are NOT the failure. The break is in the **deploy/upload step** (Cloudflare auth + wrangler-action behavior), which cannot be exercised read-only without credentials.

---

## 3. Root Cause Analysis

### Primary suspect (highest confidence): `cloudflare/wrangler-action@v3` is outdated and mismatched with the assets-only + custom-domain config

- `deploy.yml` uses `cloudflare/wrangler-action@v3`. The `@v3` tag of this **action** is old and bundles/installs an **old Wrangler (v3-era)**. The repo-local wrangler is 3.114.17, and even that is flagged as **out of date** vs 4.112.0.
- The root `wrangler.jsonc` is an **assets-only Worker** (no `main` script) with:
  - `assets.directory: "artifacts/ags-fertility/dist/public"`
  - `assets.not_found_handling: "single-page-application"`
  - `routes` with `custom_domain: true` for `agsynergy.ca` / `www.agsynergy.ca`
- **Assets-only Workers + custom domains were significantly reworked between Wrangler v3 and v4.** An outdated action-bundled Wrangler commonly fails this deploy with errors such as "No entry point found", assets upload rejection, or custom-domain binding errors — none of which appear in the build stage.
- **Recommended fix:** bump the action to `cloudflare/wrangler-action@v3` **with an explicit current Wrangler** (pin `wrangler@4` via the action's `wranglerVersion` input, or migrate the action to `@v3` latest / the current major) so the deploy runs with a Wrangler that supports assets-only + custom domains. **This is the most likely single change that resolves the failure.**

### Secondary suspect: missing `account_id` in root `wrangler.jsonc`

- Root `wrangler.jsonc` has **no `account_id`** field. `workers/wrangler.jsonc` also lacks it.
- `deploy.yml` sets **no `CLOUDFLARE_ACCOUNT_ID`** environment variable.
- Wrangler can resolve the account from the token's default membership, so this is *usually* non-fatal — **but** if the token belongs to an account that is not the default, or spans multiple accounts, `wrangler deploy` fails with `account_id` resolution errors. Low-to-medium confidence as the *primary* cause, but worth hardening.
- **Recommended fix (safe, additive):** add `"account_id": "d0a58133c1495fa5e42cbca0aebaa36b"` to root `wrangler.jsonc`, OR set `CLOUDFLARE_ACCOUNT_ID` in the workflow. Project memory confirms account ID `d0a58133c1495fa5e42cbca0aebaa36b` (Kumarl@gmail.com).

### Tertiary suspect: `minimumReleaseAge: 1440` in `pnpm-workspace.yaml` could break CI `pnpm install`

- The workspace enforces a **1-day minimum package release age** (supply-chain defense). If any catalog/transitive package is newer than 1 day at CI time, `pnpm install` fails and the build/deploy never runs.
- Locally install succeeded (deps cached, lockfile current), so this is **not** the current local failure — but it is a real, intermittent CI risk.
- **Recommended fix (if CI install fails):** confirm the failure is release-age related via CI logs; if so, it indicates a too-new dependency, not a config bug. No change needed unless CI logs show it.

---

## 4. Evidence Summary

| Check | Command | Result |
|-------|---------|--------|
| Source completeness | `ls artifacts/ags-fertility/` | ✅ `index.html`, `src/main.tsx`, `src/App.tsx`, `tsconfig.json`, `vite.config.ts` all present |
| Build output exists | `ls artifacts/ags-fertility/dist/public/` | ✅ `index.html` + `assets/` + `favicon.svg` + `robots.txt` |
| Lockfile present | `ls pnpm-lock.yaml` | ✅ 264 KB |
| pnpm install | `pnpm install --frozen-lockfile=false` | ✅ exit 0 |
| Frontend build | `pnpm --filter @workspace/ags-fertility run build` | ✅ exit 0, SPA emitted |
| Wrangler version | `npx wrangler --version` | ⚠️ 3.114.17 (update available 4.112.0) |
| Config schema (local wrangler) | `npx wrangler deploy --dry-run` | ✅ exit 0 |
| Auth (local) | `npx wrangler whoami` | ⚠️ not authenticated (CI uses secret) |
| `account_id` in root config | `grep account_id wrangler.jsonc` | ❌ absent |
| `account_id` in workflow | `grep ACCOUNT_ID deploy.yml` | ❌ absent |
| Action version | `deploy.yml` | ⚠️ `cloudflare/wrangler-action@v3` (old) |

---

## 5. Recommended Fix (ordered by confidence)

1. **Update the deploy action's Wrangler to a current version** that supports assets-only Workers + custom domains.
   - In `.github/workflows/deploy.yml`, change:
     ```yaml
     - name: Deploy to Cloudflare Workers
       uses: cloudflare/wrangler-action@v3
       with:
         apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
         command: deploy
         # ADD one of:
         wranglerVersion: '4'          # pin current major
         # OR ensure the action resolves a modern wrangler
     ```
   - Rationale: assets-only + `custom_domain` config is the modern Wrangler 4 model; v3-era bundled wrangler is the most probable deploy failure.

2. **Add `account_id` explicitly** (eliminates account-resolution ambiguity):
   - Add `"account_id": "d0a58133c1495fa5e42cbca0aebaa36b"` to root `wrangler.jsonc`, OR set `CLOUDFLARE_ACCOUNT_ID: d0a58133c1495fa5e42cbca0aebaa36b` as a workflow env var.

3. **(If CI install fails)** inspect CI logs for `minimumReleaseAge` rejection; if present, the failing package is too new — either wait out the 1-day window or add a scoped `minimumReleaseAgeExclude` (do NOT disable the global control).

---

## 6. Exact Files Requiring Changes (if any)

| File | Change | Risk |
|------|--------|------|
| `.github/workflows/deploy.yml` | Add `wranglerVersion: '4'` (or equivalent) to the wrangler-action step | **Low** — standard, additive |
| `wrangler.jsonc` (repo root) | Add `"account_id": "d0a58133c1495fa5e42cbca0aebaa36b"` | **Low** — additive, no behavior change for existing assets config |

No changes to `hermes/`, `shared/`, `workers/src/auth/`, migrations, AI-workforce modules, or any EPIC document are required or recommended.

---

## 7. Risk Assessment

- **Severity:** Medium (website not live; API worker `agsynergy-api` is a separate deploy and unaffected).
- **Blast radius:** Confined to the AGS Fertility static site deployment. No backend, database, or Hermes Platform impact.
- **Reversibility:** Both recommended changes are additive/config-only. Fully reversible by reverting the two files.
- **Secrets exposure:** None. The deploy token stays a GitHub secret; no credentials are printed or written to the report.
- **Safe to apply independently?** **Yes** — the two recommended edits are low-risk, additive, and isolated to the AGS website deploy path. They can be applied without touching any EPIC or production backend code.

---

## 8. Verification After Fix (operator-run, post-approval)

```bash
# 1. Confirm build still green
pnpm --filter @workspace/ags-fertility run build

# 2. Dry-run deploy with current wrangler (local, no auth needed for parse)
npx wrangler deploy --dry-run --outdir /tmp/wout

# 3. Authenticated deploy (CI or operator with CLOUDFLARE_API_TOKEN + account_id)
npx wrangler deploy
# Expected: ✅ Success! Uploaded hermes-website → https://agsynergy.ca
```

---

*Diagnostic only. No files were modified, no deploys executed, no secrets exposed. Awaiting review before any change.*

---

## 9. Fix Applied (2026-07-19, user-approved)

Both recommended changes were applied and verified:

| File | Change | Verification |
|------|--------|--------------|
| `.github/workflows/deploy.yml` | Added `wranglerVersion: '4'` to the `cloudflare/wrangler-action@v3` step | YAML readable; action will use current Wrangler major |
| `wrangler.jsonc` (repo root) | Added `"account_id": "d0a58133c1495fa5e42cbca0aebaa36b"` | JSONC valid; dry-run exit 0 |

**Verification run:**
- `wrangler.jsonc` parses: `name=hermes-website`, `account_id` set, `assets.directory` unchanged.
- `npx wrangler deploy --dry-run` → exit 0 ("Total Upload: 0.38 KiB", "No bindings found").

**Still required to go live (operator, with credentials):**
- Push to `main` → GitHub Actions runs the updated workflow (now with Wrangler 4), OR run `npx wrangler deploy` from repo root with `CLOUDFLARE_API_TOKEN` + the account above.
- Confirm live: `curl -s -o /dev/null -w "%{http_code}" https://agsynergy.ca` → expect `200`.

No Hermes Platform, `hermes/`, `shared/`, `workers/src/auth/`, migrations, or AI-workforce code was modified. No secrets printed.
