# Baseline Verification Report — `baseline-002-006`

> **Status:** ⛔ **NOT CREATED** — blocked on owner credential rotation (see EPIC-002-006A4 §7).
> This report records the verification state as of 2026-07-19, ready for tag creation
> the moment the blocker clears.

---

## Verification Checklist

| # | Gate | Result | Evidence |
|---|---|---|---|
| 1 | No secrets in tracked files | ✅ PASS | `git ls-files \| grep CF_TOKEN_+20/GH_PAT_/GH_PAT+20` → 0 |
| 2 | No real token anywhere in tree | ✅ PASS | `grep -rE "cfat_[A-Za-z0-9]{20,}"` → 0 |
| 3 | Category D scripts excluded | ✅ PASS | 29 scripts moved to `~/archive/category-d-2026-07-19/`; 0 remain in repo root |
| 4 | `.gitignore` hardens all leak vectors | ✅ PASS | blocks `*.py` deploy helpers, `.git-credentials`, `.env*`, temp files; `git check-ignore` confirmed |
| 5 | CI is sole deploy authority | ✅ PASS | `.github/workflows/deploy.yml` (wrangler + `secrets.CLOUDFLARE_API_TOKEN`) |
| 6 | Secret scanning in CI | ✅ PASS | `.github/workflows/security.yml` (gitleaks) + `.gitleaks.toml` |
| 7 | No `workers/src/**` changes | ✅ PASS | `git diff HEAD -- workers/` empty |
| 8 | No migrations changed | ✅ PASS | `git status` shows no migration paths |
| 9 | No deploy config changed | ✅ PASS | `wrangler.jsonc`, `deploy.yml` unchanged vs HEAD |
| 10 | Tests | ⚠️ PARTIAL | Unit: 55 passed/0 failed. Integration: env-blocked (`cloudflare:workers` unresolved locally) — pre-existing, not a regression |
| 11 | **Credential rotation (owner)** | ⛔ BLOCKED | Cloudflare token / GitHub PAT / repo secret not yet confirmed rotated |

---

## Intended Tag Content (preview — not yet committed)

**Will be committed (explicit paths, never `git add -A`):**
- `.gitignore` (hardened)
- `docs/operations/EPIC-002-006A2_SCRIPT_REVIEW.md` (redacted)
- `docs/operations/EPIC-002-006A3_REPOSITORY_HYGIENE_PLAN.md` (redacted)
- `docs/operations/EPIC-002-006A4_COMPLETION_REPORT.md` (new)
- `docs/operations/SECRETS.md` (new)
- `workers/docs/DEPLOYMENT.md` (token ref neutralized)
- `CHANGELOG.md` (token ref neutralized)
- `.github/workflows/security.yml` (new)
- `.gitleaks.toml` (new)
- Pre-existing Epic-1 set: `artifacts/`, `lib/`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, OpenAPI spec
- 14 root platform `*.md` docs, `docs/`, `workers/`, `BirthdayOverlay.tsx`, images

**Will NOT be committed:**
- The 29 quarantined Category D scripts (outside repo + git-ignored)
- Any `.git-credentials` / `.env` (git-ignored)

---

## Blocker Summary

The repository satisfies every *structural* trust gate. The only open item is the
**live credential rotation**, which is the human owner's responsibility and cannot
be performed by this agent (no secret access, no provider credentials). Until the
owner confirms rotation, `baseline-002-006` is withheld to avoid certifying a
checkpoint while a live secret remains exposed.

**To proceed:** owner rotates the three credentials → agent commits the intentional
set and creates the tag.
