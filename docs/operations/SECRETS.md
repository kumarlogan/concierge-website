# Secret Handling & Deployment Authority

> **Authoritative deployment path:** `.github/workflows/deploy.yml`
> (Cloudflare Workers, via `cloudflare/wrangler-action` using the
> `secrets.CLOUDFLARE_API_TOKEN` CI secret).

## Deprecated: manual deployment scripts
As of EPIC-002-006A4, all root-level `*.py`/`*.sh` deployment and helper
scripts (Category D) are **deprecated and quarantined** outside this repository
(`~/archive/category-d-2026-07-19/`). They are superseded by:

- **Deploys:** GitHub Actions → `wrangler deploy` (no local scripts).
- **CI/log inspection:** `gh` CLI or the GitHub web UI.
- **Local dev deploy:** developer runs `wrangler deploy` with their own
  scoped token (from `~/.config/wrangler`); never committed.

## Secret storage rules (enforced)
1. Credentials live **only** in GitHub Encrypted Secrets (repo/org level).
2. Never hardcode tokens in source. The Cloudflare token previously found in
   Category D scripts was rotated (see EPIC-002-006A2/A3).
3. `.gitignore` excludes `*.py` deploy helpers, `.git-credentials`, `.env*`.
4. Every push/PR is scanned by `.github/workflows/security.yml` (gitleaks).
   A finding **fails the pipeline** and blocks deploy.

## If you find a leaked secret
1. Rotate/revoke it immediately in the provider dashboard.
2. Remove it from the repo (and history if committed — `git filter-repo`).
3. Re-run the gitleaks scan until clean.
