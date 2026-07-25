# GOV-001 Manual Migration Checklist

> Actions that cannot be automated through code changes.
> Perform these in the order listed.

---

## Phase 1 — Repository Rename

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 1.1 | **Rename GitHub repository** from `kumarlogan/hermes-website` to `kumarlogan/concierge-website` | `gh repo rename concierge-website` | 🔴 High — all remote refs break | Verify `git remote -v` shows new name |
| 1.2 | **Update local remote URL** | `git remote set-url origin git@github.com:kumarlogan/concierge-website.git` | 🟠 Medium | `git remote -v` |
| 1.3 | **Verify GitHub redirect** | Visit `https://github.com/kumarlogan/hermes-website` → should redirect to new name | 🟢 Low | Manual URL check |
| 1.4 | **Update branch protection rules** | GitHub Settings → Branches → reconfigure rules on new repo name | 🟠 Medium | PR workflow still works |

## Phase 2 — Branch Protection Verification

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 2.1 | Verify `main` branch protection is intact | `gh api repos/kumarlogan/concierge-website/branches/main/protection` | 🟠 Medium | Returns protection config JSON |
| 2.2 | Verify required PR reviews | Check settings: require PR, require 1 approval | 🟠 Medium | GitHub UI |
| 2.3 | Verify status checks are configured | Check settings: CI must pass before merge | 🟠 Medium | GitHub UI |

## Phase 3 — GitHub Actions CI/CD

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 3.1 | **Verify deploy workflow triggers on push** | Push to `main` → check Actions tab | 🔴 High | Action runs successfully |
| 3.2 | **Check secrets migrated** | `gh secret list --repo kumarlogan/concierge-website` | 🔴 High | All secrets present |
| 3.3 | **Verify Wrangler auth works in CI** | Check last deploy action log for auth success | 🔴 High | Deploy completes |

## Phase 4 — Cloudflare Configuration

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 4.1 | **Verify Worker still deploys** | Run `npx wrangler deploy --env production` | 🔴 High | `Success!` + URL |
| 4.2 | **Verify custom domains still serve** | `curl -s -o /dev/null -w "%{http_code}" https://agsynergy.ca` | 🔴 High | HTTP 200 |
| 4.3 | **Check D1 migrations are intact** | `npx wrangler d1 migrations list agsynergy-db --env production` | 🟠 Medium | All 5 migrations applied |
| 4.4 | **Check API Worker routes** | `curl -s https://api.agsynergy.ca/api/v1/health` | 🔴 High | HTTP 200 + healthy |

## Phase 5 — Webhooks

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 5.1 | **Verify deploy webhook** | Check GitHub repo → Settings → Webhooks | 🟠 Medium | Still pointing to correct endpoint |
| 5.2 | **Verify any third-party webhooks** | Check Zapier/Make/other integrations | 🟠 Medium | Test event succeeds |

## Phase 6 — README & Badge Links

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 6.1 | **Update GitHub Stars / Fork badges** | README now references new repo name | 🟢 Low | Visual check on repo homepage |
| 6.2 | **Verify all README links work** | Manual click-through of every link | 🟢 Low | All 200 OK |

## Phase 7 — Deployment Identity

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 7.1 | **Update deploy script paths** | ✅ DONE in GOV-001 | 🟢 Low | Already complete |
| 7.2 | **Update wrangler.jsonc Worker name** | ⚠️ **OPTIONAL** — rename Cloudflare Worker from `hermes-website` to `concierge-website` in `workers/wrangler.jsonc` | 🔴 High — breaks CDN + cached URLs | Must plan separately |
| 7.3 | **Update GitHub secret reference in CI** | If worker name changes in wrangler.jsonc, update deploy.yml accordingly | 🟠 Medium | CI passes |

## Phase 8 — Search Console & External

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 8.1 | **Google Search Console** | Verify property still linked to correct repo | 🟢 Low | Search Console dashboard |
| 8.2 | **Update any documentation referencing old repo URL** | Pointing to external git clone instructions | 🟢 Low | Visual check |

## Phase 9 — Final Verification

| # | Action | How | Risk | Verified By |
|---|---|---|---|---|
| 9.1 | Full smoke test | Run the deployment runbook from DEPLOYMENT.md | 🔴 High | All 8 steps PASS |
| 9.2 | Clone fresh and verify | `git clone git@github.com:kumarlogan/concierge-website.git` | 🟢 Low | Clean clone works |
| 9.3 | Confirm no stale references | `grep -r 'hermes-website' --include='*.md' .` | 🟢 Low | Only historical records remain |

---

## Worker Rename Decision

The Cloudflare Worker name (`hermes-website`) was intentionally left unchanged in `wrangler.jsonc` during GOV-001. Renaming the Worker carries deployment risk (CDN cache invalidation, route binding updates) and belongs in a separate migration.

**Plan for Worker rename (future):**
1. Create new Worker `concierge-website` in Cloudflare dashboard
2. Update `wrangler.jsonc` `name` field
3. Migrate D1 bindings
4. Update custom domain routes
5. Deploy via governed path
6. Verify 100% uptime
7. Delete old `hermes-website` Worker