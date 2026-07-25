# EPIC-002-006A4B — Remaining Owner Actions

The repository is secure and ready. The **only** remaining manual work requires
the owner's highest-privilege accounts. Do these in order:

## 1. Rotate the leaked Cloudflare API token (CRITICAL)
- **Credential:** Cloudflare API token ending `…8816494` (hardcoded in 20 quarantined scripts).
- **Why owner:** needs Cloudflare dashboard API-Token admin (the D1-scoped token available
  to Hermes cannot manage API tokens).
- **Steps:**
  1. dash.cloudflare.com → **My Profile → API Tokens**.
  2. Locate the token ending `…8816494` → **Delete** (or **Roll**).
  3. Audit its granted scopes (Zone/Account permissions).
- **Verify:** `curl -H "Authorization: Bearer <old>" …/accounts` → 401/403.

## 2. Rotate the GitHub PAT in `~/.git-credentials`
- **Credential:** the PAT old scripts read from `~/.git-credentials`.
- **Why owner:** GitHub account-holder action.
- **Steps:**
  1. github.com → **Settings → Developer settings → PATs → revoke**.
  2. Remove the line from `~/.git-credentials`.
- **Verify:** old PAT returns 401.

## 3. Delete + re-create the GitHub repo secret `CLOUDFLARE_API_TOKEN`
- **Why owner:** needs valid GitHub PAT with repo admin (local `gh` token is invalid).
- **Steps:**
  1. `gh auth login` (or dashboard).
  2. `gh secret delete CLOUDFLARE_API_TOKEN --repo kumarlogan/concierge-website`
     (or Settings → Secrets → Actions → delete).
  3. **Re-create** `CLOUDFLARE_API_TOKEN` with a **NEW rotated** Cloudflare token.
     > Required: `deploy.yml` reads this secret. Without it the official CI deploy fails.
- **Verify:** `gh secret list --repo kumarlogan/concierge-website` shows the new value only.

## 4. Confirm to Hermes
Reply "rotation complete" → Hermes creates the `baseline-002-006` tag.

---
*No other manual work remains. All repository-side remediation is complete and verified.*
