# EPIC-002-006A.2 — Category D Script Security & Ownership Review

> **Mode:** STRICT READ-ONLY. No files modified, renamed, moved, deleted, committed,
> deployed, or executed. No production secrets accessed. Token values are shown
> only to evidence the leak and to support rotation — they must be treated as
> COMPROMISED.
> **Date:** 2026-07-19 · **Repo:** `/home/ubuntu/concierge-website`

---

## 🔴 CRITICAL SECURITY FINDING (read first)

**A live Cloudflare API token is hardcoded in plaintext** in the majority of
these scripts. The same token string appears in **20 files**:

```
cfat_KTs...[REDACTED-LEAKED-TOKEN-ROTATED]...8816494
```

It is paired with a hardcoded account ID `d0a58133c1495fa5e42cbca0aebaa36b`
(and a `zone_id` `79eb19fb6005f9b53231965413af44fd` in `deploy_worker.py`).

Also present:
- **GitHub token extracted at runtime** from `/home/ubuntu/.git-credentials`
  (parsed via `split('//')[1].split('@')[0].split(':')[1]`) in **6 files**.
- **`setup_github_secret.py`** reads the Cloudflare token from source and **writes
  it into the GitHub repo's `CLOUDFLARE_API_TOKEN` secret** (via the GitHub
  Actions secrets API). This means the leaked token is ALSO live in the repo's
  CI secret store.
- `deploy.sh` / `run_deploy.py` / `deploy_redeploy.py` extract the token from
  `deploy_worker.py` and export it as `CLOUDFLARE_API_TOKEN` for `wrangler deploy`.

**Because these files are untracked and in a repo that will be committed/tagged,
any future `git add .` or `git commit -A` would permanently bake a live,
infrastructure-controlling credential into git history.** Even in the current
untracked state, the token is exposed on disk and in shell history.

### Required action BEFORE any commit or tag (human, out-of-band)
1. **Rotate/revoke the Cloudflare token** `CF_TOKEN_REDACTED…[ROTATED]…8816494` in the Cloudflare
   dashboard immediately — treat it as compromised.
2. **Rotate the GitHub token** stored in `/home/ubuntu/.git-credentials`
   (and any token the CI secret `CLOUDFLARE_API_TOKEN` was set to).
3. **Delete/overwrite the GitHub repo secret** `CLOUDFLARE_API_TOKEN` if
   `setup_github_secret.py` succeeded.
4. Confirm `.gitignore` excludes these scripts, OR ensure they are never staged.

> This review performs **none** of those actions (read-only). They are flagged
> for the human owner.

---

## Leaked secret inventory

| Secret | Where | # files | Severity |
|---|---|---|---|
| Cloudflare API token `CF_TOKEN_REDACTED…[ROTATED]…8816494` | hardcoded in source | 20 | 🔴 CRITICAL |
| Cloudflare Account ID `d0a58133…aa36b` | hardcoded | 20+ | 🟡 (identifier, not secret alone) |
| Cloudflare Zone ID `79eb19fb…af44fd` | hardcoded (`deploy_worker.py`) | 1 | 🟡 |
| GitHub PAT | read from `~/.git-credentials` at runtime | 6 | 🔴 CRITICAL |
| GitHub repo secret `CLOUDFLARE_API_TOKEN` | written by `setup_github_secret.py` | 1 (action) | 🔴 CRITICAL |

---

## Per-file review (all 29)

### Cloudflare deploy/asset scripts (token hardcoded)

| # | File | Purpose | Tech | Infra | Secret handling | Ownership | Rec. | Future home |
|---|---|---|---|---|---|---|---|---|
| 1 | `deploy_worker.py` | Deploy `agsynergy-ca` Worker via Cloudflare API (multipart PUT) | Py | CF | 🔴 hardcoded token + account + zone id | A (app deploy) | **D / do NOT commit** | `scripts/deploy/` (after secret removal) |
| 2 | `deploy_assets.py` | Upload static assets to `hermes-website` Worker Assets API | Py | CF | 🔴 hardcoded token | B | **D** | `scripts/deploy/` |
| 3 | `deploy_final.py` | Upload assets + create Worker version (trial of JWT methods) | Py | CF | 🔴 hardcoded token + prints full JWT | C (experiment) | **D** | archive |
| 4 | `deploy_pages.py` | Deploy to Cloudflare **Pages** project `agsynergy-ca` | Py | CF (Pages) | 🔴 hardcoded token | A | **D** | `scripts/deploy/` |
| 5 | `deploy_pages2.py` | Delete stuck Pages deployment + redeploy | Py | CF (Pages) | 🔴 hardcoded token | C | **D** | archive |
| 6 | `deploy_redeploy.py` | Redeploy `hermes-website` Worker, reads token from `deploy_worker.py` | Py | CF | 🟠 reads token from #1, exports to wrangler | B | **D** | `scripts/deploy/` |
| 7 | `deploy_v2.py` | DELETE + recreate `hermes-website` Worker w/ assets | Py | CF | 🟠 token masked as `'CF_TOKEN_K...6494'` (still a real token ref) | C | **D** | archive |
| 8 | `run_deploy.py` | Run `npx wrangler@4 deploy` w/ token from `deploy_worker.py` | Py | CF | 🟠 reads token, sets env | B | **D** | `scripts/deploy/` |
| 9 | `upload_assets.py` | Assets upload session + multipart upload + Worker version | Py | CF | 🔴 hardcoded token | C | **D** | archive |
| 10 | `upload_assets2.py` | Same as #9 (variant) | Py | CF | 🔴 hardcoded token | C | **D** | archive |
| 11 | `upload_assets3.py` | Same as #9 (variant) | Py | CF | 🔴 hardcoded token | C | **D** | archive |

### Cloudflare check/debug scripts (token hardcoded)

| # | File | Purpose | Tech | Infra | Secret | Ownership | Rec. | Future home |
|---|---|---|---|---|---|---|---|---|
| 12 | `check_token.py` | Verify what the CF token can access (memberships/accounts) | Py | CF | 🔴 hardcoded | C | **D** | archive |
| 13 | `check_worker_status.py` | Inspect Worker script/versions/deployments | Py | CF | 🔴 hardcoded | C | **D** | archive |
| 14 | `debug_upload_response.py` | Assets upload session + file upload, prints JWTs | Py | CF | 🔴 hardcoded + prints upload JWT | C | **D** | archive |
| 15 | `test_one_file.py` | Upload ONE file to test response format | Py | CF | 🔴 hardcoded | C | **D** | archive |
| 16 | `test_upload.py` | Test asset upload API (base64 vs raw) | Py | CF | 🔴 hardcoded | C | **D** | archive |
| 17 | `test_upload_methods.py` | Try 3 upload methods, decode JWT header | Py | CF | 🔴 hardcoded + JWT decode | C | **D** | archive |

### GitHub check/CI scripts (token from ~/.git-credentials)

| # | File | Purpose | Tech | Infra | Secret | Ownership | Rec. | Future home |
|---|---|---|---|---|---|---|---|---|
| 18 | `check_workflow.py` | List recent GH Actions runs | Py | GitHub | 🔴 reads `~/.git-credentials` | C | **D** | archive |
| 19 | `check_workflow_jobs.py` | Show jobs/steps of a failed run | Py | GitHub | 🔴 reads creds | C | **D** | archive |
| 20 | `check_run3.py` | Show jobs + artifacts of a run | Py | GitHub | 🔴 reads creds | C | **D** | archive |
| 21 | `fetch_workflow_logs.py` | Download + print deploy job logs (zip) | Py | GitHub | 🔴 reads creds | C | **D** | archive |
| 22 | `fetch_deploy_logs.py` | Fetch run logs via jobs API | Py | GitHub | 🔴 reads creds | C | **D** | archive |
| 23 | `poll_workflow.py` | Poll latest run until complete, print logs | Py | GitHub | 🔴 reads creds | C | **D** | archive |

### Shell / setup / recreate scripts

| # | File | Purpose | Tech | Infra | Secret | Ownership | Rec. | Future home |
|---|---|---|---|---|---|---|---|---|
| 24 | `deploy.sh` | Bash: decode token from `deploy_worker.py`, `wrangler deploy` | Bash | CF | 🟠 extracts + exports token (base64 obfuscation — NOT real protection) | B | **D** | `scripts/deploy/` |
| 25 | `pipeline.sh` | Bash: `npm run build` + call `deploy.sh` + curl verify | Bash | CF | 🟢 none itself (calls deploy.sh) | B | **commit (safe)** | `scripts/` |
| 26 | `recreate_project.py` | DELETE + recreate CF Pages project, redeploy | Py | CF (Pages) | 🔴 hardcoded token | C | **D** | archive |
| 27 | `setup_github_secret.py` | Encrypt CF token → set GH repo secret `CLOUDFLARE_API_TOKEN` | Py | GitHub+CF | 🔴 hardcoded CF token + reads GH creds + writes repo secret | C (dangerous) | **D / do NOT commit** | — (remove) |

> `pipeline.sh` is the **only file with no secret of its own** — it orchestrates
> build + deploy but holds no credentials. It is safe to keep (provided its
> callee `deploy.sh` is never committed with the token).

---

## Ownership classification summary

| Class | Meaning | Count | Files |
|---|---|---|---|
| **A** — organization/platform tooling | Keep as platform deploy tooling | 0 | — |
| **A** — application tooling | Keep as app deploy tooling | 3 | `deploy_worker.py`, `deploy_pages.py`, `pipeline.sh`* |
| **B** — application tooling (safe w/o secret) | Keep after secret removal | 4 | `deploy_assets.py`, `deploy_redeploy.py`, `run_deploy.py`, `deploy.sh` |
| **C** — archive/deprecate | Experimental duplicates | 17 | all `check_*`, `test_*`, `debug_*`, `upload_assets2/3`, `deploy_final`, `deploy_pages2`, `deploy_v2`, `recreate_project` |
| **D** — remove after confirmation | Contains live secret; never commit | 27 | all of the above that hardcode/extract tokens + `setup_github_secret.py` |

\* `pipeline.sh` has no secret but depends on `deploy.sh` (which does).

---

## Recommendation by disposition

| Disposition | Files | Action |
|---|---|---|
| **NEVER COMMIT (contains live secret)** | 27 files (all except `pipeline.sh`) | Add to `.gitignore` immediately; quarantine outside repo; rotate token |
| **Commit-safe (no secret)** | `pipeline.sh` | May commit to `scripts/` — but ensure it never pulls a secret-bearing callee into the repo |
| **Archive (experimental, no value, also has secret)** | 17 class-C files | Same as never-commit; do not keep in repo |

---

## Impact on baseline tag

The presence of these files **does not block the auth/RBAC security baseline**
(no `workers/src/auth/*` or migrations are touched — verified in A.1). However,
they **block a trustworthy `git tag`** because:

1. The working tree currently contains a live credential in plaintext.
2. Any `git add -A` / `git commit` would immortalize it in history.
3. The token is already propagated to a GitHub repo secret via
   `setup_github_secret.py`.

**Mandatory pre-tag gate:** rotate the Cloudflare token + GitHub token, purge
the GitHub repo secret, and ensure these 27 files are excluded (`.gitignore` or
removal) BEFORE `git tag baseline-002-006`.

---

## Future architecture mapping (post-rotation, illustrative only)

| If kept (after secret removal) | Where it should live |
|---|---|
| App build+deploy orchestration | `scripts/deploy/` (w/ token from env/CI secret, never source) |
| Cloudflare Workers deploy | `scripts/deploy/deploy-worker.sh` (wrangler, token via `$CLOUDFLARE_API_TOKEN`) |
| Cloudflare Pages deploy | superseded by `.github/workflows/deploy.yml` (already exists) |
| CI log inspection | `gh` CLI or GitHub UI — no custom scripts |
| Asset upload experiments | discard (wrangler handles assets natively) |

> The repo already has `.github/workflows/deploy.yml` (verified in A) which
> deploys via `wrangler deploy` using CI secrets. **All custom deploy scripts
> are redundant** with the existing GitHub Actions pipeline and should be
> retired.

---

*Strict read-only review. No files modified, committed, deployed, or executed.
No secrets accessed beyond reading the scripts' own source. Tag not created.*
