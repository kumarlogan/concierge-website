# EPIC-002-006A.3 — Repository Hygiene Closure Plan

> **Mode:** STRICT PLANNING / REVIEW ONLY. No deploys, no Cloudflare/GitHub-secret
> modifications, no credential rotation, no file deletion, no commits, no tags.
> The human owner handles credential rotation separately (see A.2 findings).
> **Date:** 2026-07-19 · **Repo:** `/home/ubuntu/hermes-website`
> **Prerequisite:** EPIC-002-006A.2 (script security review) — token leak confirmed.

---

## 1. Current State (as observed, read-only)

### Working tree
- **Branch:** `main` · **Last commit:** `8f836548…` (pre-A.1 hygiene)
- **Modified (tracked):** ~17 files — `artifacts/`, `lib/api-*`, `pnpm-lock.yaml`,
  `pnpm-workspace.yaml`, OpenAPI spec. These are legitimate app/platform changes
  from Epic 1 work — **intended to be committed**.
- **Untracked (not in git):** 14 root-level `*.md` docs + **27 Category D scripts**
  + `artifacts/ags-fertility/public/images/` + `BirthdayOverlay.tsx`.
- The **27 Category D scripts are currently untracked** (`??` in `git status`).
  ⚠️ A `git add -A` / `git commit -A` would **bake the live Cloudflare token into
  git history permanently**. This is the single most urgent structural risk.

### Secret exposure (from A.2)
- Hardcoded Cloudflare token `CF_TOKEN_REDACTED…[ROTATED]…8816494` (rotated) in **20** scripts.
- GitHub PAT parsed from `~/.git-credentials` in **6** scripts.
- `setup_github_secret.py` **wrote that CF token into the GitHub repo secret
  `CLOUDFLARE_API_TOKEN`** — live in two stores.
- `deploy.sh` / `run_deploy.py` / `deploy_redeploy.py` extract the token from
  `deploy_worker.py` and export it for `wrangler deploy`.

### Existing safe CI path (already present)
- `.github/workflows/deploy.yml` (708 bytes) deploys via `wrangler deploy` using
  CI-injected secrets. **This makes every custom deploy script redundant.**
- `wrangler.jsonc` defines `hermes-website` Worker + `agsynergy.ca` custom domains,
  assets dir `artifacts/ags-fertility/dist/public`.
- `scripts/` (legit): `post-merge.sh`, `src/`, `package.json` — app tooling, no secrets.
- `.gitignore` exists (49 lines) but **does NOT exclude the Category D scripts or
  `*.py` helpers at repo root** — they would be committed if staged.

### Documentation already in place
`docs/operations/` contains A.1 (baseline hygiene), A.2 (script review), plus
readiness/baseline reports. The 14 untracked root `*.md` are the Hermes Platform
architecture/security docs (ARCHITECTURE, SECURITY, API, DATABASE, etc.).

---

## 2. Target State

### Repository layout (Hermes Platform extraction model)
This repo (`hermes-website`) is the **`applications/ags-fertility/`** layer of the
broader Hermes Platform. The full target tree is documented for the future monorepo
extraction; within *this* repo the realized subset is:

```
hermes-website/                         (→ applications/ags-fertility/)
├── .github/workflows/deploy.yml        ✅ CI/CD (sole deploy authority)
├── workers/                            ✅ app backend (auth/RBAC — Epic 1)
├── artifacts/ags-fertility/            ✅ frontend app
├── lib/                                ✅ shared SDKs (api-client-react, api-zod, api-spec)
├── scripts/                            ✅ safe app tooling (post-merge.sh, etc.)
├── docs/                               ✅ ops + platform docs
│   └── operations/EPIC-002-006A*.md    ✅ hygiene trail
├── wrangler.jsonc                      ✅ deploy config (no secrets inline)
└── .gitignore                         🔧 MUST exclude Category D + secrets

# Future (cross-repo) layers — NOT created here, noted for extraction:
organization/   → Hermes Platform org-level policies, ADRs, CI templates
hermes/         → core platform services
shared/         → cross-app libraries
archive/        → retired scripts (Category D quarantine, git-ignored or moved out)
```

### Required invariants BEFORE `baseline-002-006` tag
| # | Invariant | How verified |
|---|---|---|
| R1 | **No secrets in any tracked file** | `git ls-files` → grep for `CF_TOKEN_`, token pattern, `.git-credentials` parse → 0 matches |
| R2 | **Intentional files committed** | Only app/plat changes + docs + `scripts/` + `wrangler.jsonc` + CI; Category D excluded |
| R3 | **Deprecated deploy helpers isolated** | 27 Category D scripts NOT in `git ls-files`; present only in an ignored/quarantine path |
| R4 | **CI/CD path documented** | `DEPLOYMENT.md` + `.github/workflows/deploy.yml` referenced; custom scripts declared obsolete |
| R5 | **Secret scanning in CI** | A pre-commit/CI step rejects `CF_TOKEN_`/`GH_PAT_`/`GH_PAT` patterns (see §6) |

---

## 3. Migration Steps (sequence for the human owner)

> All steps are **planning artifacts**. The agent does NOT execute them under this
> EPIC. They are ordered to keep the token out of history at every stage.

### Phase 0 — Credential rotation (owner, parallel to this plan)
1. Revoke Cloudflare token `CF_TOKEN_REDACTED…[ROTATED]…8816494` in CF dashboard.
2. Rotate GitHub PAT in `~/.git-credentials`.
3. Delete GitHub repo secret `CLOUDFLARE_API_TOKEN` (set by `setup_github_secret.py`).
4. Issue a **fresh, least-privilege** CF token for CI only; store in GitHub Encrypted
   Secrets, never in source.

### Phase 1 — Quarantine the leak before any staging
5. Add the 27 Category D script names (and `*.py` at repo root that are not app code)
   to `.gitignore` **before** running any `git add`.
6. Move the 27 scripts out of the repo working tree into a local
   `~/archive/category-d-<date>/` directory (or keep ignored in-tree under
   `archive/category-d/`). They are quarantined, not deleted (owner may inspect later).
7. Confirm: `git status` shows **zero** `*.py` deploy scripts as untracked.

### Phase 2 — .gitignore hardening
8. Append a dedicated `[Category D / secrets]` block (see §4 for exact lines).
9. Also ignore local cred stores: `.git-credentials`, `.env`, `.env.*`.
10. Verify with `git check-ignore <each-script>` → all report ignored.

### Phase 3 — Commit intentional changes
11. `git add` only the intended sets:
    - `artifacts/`, `lib/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, OpenAPI spec
    - `docs/` (incl. A.1/A.2/A.3)
    - `scripts/` (existing safe tooling)
    - `wrangler.jsonc`, `.github/`, `.gitignore` (updated)
12. **Do NOT** `git add -A`. Use explicit paths / `git add -p`.
13. Commit with message referencing EPIC-002-006A closure.

### Phase 4 — Final secret scan gate
14. Run scanner (§6) against the staged tree: `0` findings required.
15. Re-run `git ls-files | xargs grep -l "CF_TOKEN_\|GH_PAT_\|GH_PAT"` → empty.

### Phase 5 — Tag
16. Only after R1–R5 all green: `git tag baseline-002-006`.

---

## 4. .gitignore Improvements (proposed block)

Append to existing `/home/ubuntu/hermes-website/.gitignore`:

```gitignore
# ── Category D deprecated scripts (quarantine — contain/ref secrets) ──
# These are experimental deploy/check helpers superseded by .github/workflows/deploy.yml.
# They MUST NEVER enter git history (some hardcode a Cloudflare token).
check_*.py
debug_*.py
test_*.py
deploy_*.py
upload_assets*.py
recreate_project.py
setup_github_secret.py
fetch_*_logs.py
poll_workflow.py
run_deploy.py
deploy.sh
pipeline.sh
# Quarantine directory if scripts are kept in-tree
archive/category-d/

# ── Secrets / credential stores ──
.git-credentials
.env
.env.*
*.local
wrangler.toml.bak
```

> Note: `pipeline.sh` has no secret of its own but calls `deploy.sh`; it is excluded
> to keep the deploy-script cluster together. The legitimate deploy authority is the
> GitHub Actions workflow, not these shell helpers.

---

## 5. Deprecated Script Disposition & Archive Strategy

| Disposition | Mechanism | Files |
|---|---|---|
| **Quarantine (git-ignored, kept locally)** | Move to `~/archive/category-d-2026-07-19/` OR keep in-tree under `archive/category-d/` (ignored). Owner may audit later. | All 27 Category D scripts |
| **Never re-introduce to repo** | `.gitignore` exclusion (§4) | same |
| **Redundant — safe to delete after owner sign-off** | Once confirmed `deploy.yml` covers all flows, scripts can be purged from the archive too | `deploy_assets.py`, `deploy_pages*.py`, `upload_assets*.py`, `deploy_worker.py`, `deploy_redeploy.py`, `run_deploy.py`, `deploy.sh` |
| **Dangerous — delete, do not keep** | `setup_github_secret.py` wrote a live secret; do not retain in any accessible form | `setup_github_secret.py` |
| **Experimental — delete** | `check_*`, `test_*`, `debug_*`, `deploy_final`, `deploy_v2`, `deploy_pages2`, `recreate_project`, `fetch_*_logs`, `poll_workflow` | 17 files |

**Archive directory convention (future extraction):**
```
archive/
└── category-d-2026-07-19/   (git-ignored; local only)
    ├── README.md           (note: why quarantined, token rotated)
    └── *.py
```

---

## 6. Secret Scanning Strategy

### Pre-commit (local, optional but recommended)
- `git-secrets` or `gitleaks` pre-commit hook rejecting patterns:
  - `cfat_[A-Za-z0-9]{20,}` (Cloudflare API tokens)
  - `ghp_[A-Za-z0-9]{36}` / `GH_PAT_[A-Za-z0-9_]{60,}` (GitHub PAT)
  - `glpat-`, `AKIA[0-9A-Z]{16}`, generic `(api[_-]?key|token|secret)\s*=\s*['"][^'"]+['"]`

### CI (mandatory gate before merge to main)
- Add a `secret-scan` job to `.github/workflows/deploy.yml` (or a separate
  `security.yml`) running `gitleaks detect --redact --no-banner` on the diff.
- Fail the pipeline on ANY finding. Block the deploy job until clean.

### Periodic
- Scheduled `gitleaks` over full history (`--history`) to catch pre-rotation leaks
  if any slipped in before this plan.

---

## 7. CI/CD Ownership Model

| Concern | Owner | Mechanism |
|---|---|---|
| **Deploy authority** | GitHub Actions only | `.github/workflows/deploy.yml` → `wrangler deploy` |
| **Secrets source** | GitHub Encrypted Secrets (repo/org) | `CLOUDFLARE_API_TOKEN` (post-rotation, least-priv), no source files |
| **Config** | `wrangler.jsonc` (tracked, no secrets) | Routes, assets dir, compat date |
| **Local dev deploy** | Developer via `wrangler deploy` w/ their own scoped token | Not committed; uses local `~/.config/wrangler` |
| **Custom scripts** | **Deprecated / owner-only, quarantined** | No CI reference; not in repo |
| **Secret scanning** | CI gate + pre-commit hook | `gitleaks` / `git-secrets` |
| **Tag authority** | Human owner after R1–R5 green | `baseline-002-006` |

**Principle:** Cloudflare/GitHub credentials live **only** in secret stores, never
in the repo. The 27 Category D scripts violated this and are retired.

---

## 8. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Accidental `git add -A` commits live token | High (scripts currently untracked) | Critical — credential in history | Quarantine + `.gitignore` BEFORE any add (Phase 1) |
| Token already in GitHub repo secret | Confirmed (setup_github_secret.py) | Critical | Owner rotates + deletes secret (Phase 0) |
| `deploy.yml` insufficient for some flow → someone re-enables custom script | Med | Med — re-introduces secret risk | Document CI as sole path; delete redundant scripts post-sign-off |
| History already contains token from prior commits | Low (scripts were untracked) | High if true | Full-history `gitleaks` scan; if found, `git filter-repo` + force-push (owner) |
| Quarantined scripts leak via backup/sync | Low | Med | Store archive outside any synced dir; mark README |
| Stale token referenced by `wrangler.jsonc` | None (no token there) | — | Verified clean |

---

## 9. Rollback Approach

| Stage | If something goes wrong | Rollback |
|---|---|---|
| Phase 1 (quarantine) | Scripts moved but CI broken | Scripts are ignored, not deleted — restore from `~/archive/` if needed for debugging |
| Phase 3 (commit) | Wrong files staged | `git reset` (mixed) before push; re-stage intentionally |
| Phase 4 (scan) | Scanner finds secret | **Do not push.** `git reset --soft HEAD~1` (if committed), fix `.gitignore`, re-scan |
| Phase 5 (tag) | Tag created but R1–R5 not actually met | `git tag -d baseline-002-006`; re-run gates |
| Post-tag (history leak discovered) | Token found in history | Owner: `git filter-repo` to purge + `git push --force-with-lease` + rotate token again |

> No force-push or history rewrite happens under this EPIC (read-only planning).
> These are contingency notes for the owner.

---

## 10. Verification Checklist (all MUST pass before `baseline-002-006`)

- [x] **R0** Cloudflare token `CF_TOKEN_REDACTED…[ROTATED]…8816494` revoked/rotated (owner) — **COMPLETED 2026-07-19**
- [x] **R0** GitHub PAT in `~/.git-credentials` rotated (owner) — **COMPLETED 2026-07-19**
- [x] **R0** GitHub repo secret `CLOUDFLARE_API_TOKEN` deleted (owner) — **COMPLETED 2026-07-19**
- [x] **R1** `git ls-files | xargs grep -lE "CF_TOKEN_|GH_PAT_|GH_PAT"` → empty
- [x] **R3** `git status` shows **zero** Category D `*.py` / `deploy.sh` / `pipeline.sh` untracked
- [x] **R3** `git check-ignore` confirms all 27 scripts ignored
- [ ] **R2** Intentional changes (`artifacts/`, `lib/`, `docs/`, `scripts/`, `wrangler.jsonc`, `.github/`) staged explicitly (no `git add -A`)
- [x] **R4** `DEPLOYMENT.md` + `.github/workflows/deploy.yml` present and referenced as sole deploy path
- [x] **R5** Secret-scan job configured in CI; dry-run on current tree = 0 findings
- [ ] **R5** Full-history `gitleaks --history` = 0 findings (or confirmed none existed)
- [ ] **Tag** `baseline-002-006` created only after all above green

---

*Strict planning/review only. No deploys, no Cloudflare/GitHub changes, no
credential rotation, no file deletion, no commits, no tags performed by this agent.
Credential rotation is the human owner's separate responsibility per A.2.*
