# AGS First Staging Run (PHASE 4)

> **Scope:** A *controlled* **staging** deployment of `agsynergy.ca` (Cloudflare Pages, `staging` env).
> **No production deploy. No commit/stage. No secret exposure.**
> This is the operator-facing runbook derived from the verified `agsLaunch` path.

## 1. Required Operator Inputs
| Input | Value (example) | Source |
|---|---|---|
| AGS tenant | `ags-fertility` (fixed by policy) | `site-identity.ts` |
| GitHub repo | `kumarlogan/concierge-website` | operator |
| GitHub branch | `main` | operator |
| Cloudflare account | `<CF_ACCOUNT_ID>` | operator |
| Cloudflare project | `hermes-website` | operator |
| Release reference | semantic tag, e.g. `v0.0.1-staging` | operator |
| Authorized principal | `activationPrincipal("ops@ags")` (needs `hermes:activation:provider`) | operator |

## 2. Required Environment Variables (SecretSource)
Set **all** of the following in the operator secret source (env/vault). For Cloudflare, set **both** names to the same token until the ref-split (B1) is fixed:
```
GITHUB_TOKEN=<gh_token>
CLOUDFLARE_API_TOKEN=<cf_token>     # readiness / bootstrap gate
CF_API_TOKEN=<cf_token>             # deploy backend gate (same value)
AGS_GITHUB_REPOSITORY=kumarlogan/concierge-website
AGS_CLOUDFLARE_ACCOUNT=<CF_ACCOUNT_ID>
AGS_CLOUDFLARE_PROJECT=hermes-website
```
> **Do NOT** commit these. `SecretSource` resolves at runtime; no credential lives in source.

## 3. Secret Injection Process
1. Operator provisions tokens in the chosen `SecretSource` implementation (env by default; vault pluggable via `setSecretSource`).
2. `resolveSecret("GITHUB_TOKEN")` / `resolveSecret("CLOUDFLARE_API_TOKEN")` / `resolveSecret("CF_API_TOKEN")` must each return a non-empty value.
3. Verify fail-closed: with the source cleared, `agsLaunch(staging)` must return `result: "failed"` with **zero** provider calls (re-confirmed in PHASE 5 §[2]).

## 4. Dry-Run Command (safe — executes nothing)
```ts
await agsLaunch(
  { tenant: "ags-fertility", requester: "ops@ags", reference: "v0.0.1-staging",
    environment: "staging", dryRun: true, idempotencyKey: "stg-dryrun-<ts>" },
  cfg, spawner,
);
// Expect: result === "dry-run", 0 provider calls, audit event ags.launch.dry-run
```

## 5. Staging Execution Command (controlled)
```ts
// 1) bootstrap providers (wires backends only if config+creds valid; fail-closed otherwise)
bootstrapProviders(activationPrincipal("ops@ags"), { github, cloudflare });

// 2) run the governed launch (staging needs no human approval)
await agsLaunch(
  { tenant: "ags-fertility", requester: "ops@ags", reference: "v0.0.1-staging",
    environment: "staging", idempotencyKey: "stg-<ts>" },
  cfg, spawner,
);
// Expect: result === "success", 3+ provider calls (tag/push/deploy), audit ags.launch.success
```

## 6. Validation Checklist (post-run)
- [ ] `result === "success"`
- [ ] `deploymentId` present (deployment identity created)
- [ ] `readiness.allReady === true` (both providers reported ready)
- [ ] `live` smoke probe returned (site reachable)
- [ ] Ledger entry written for tenant `ags-fertility` with `result: "success"`
- [ ] `auditReference` correlates ledger entry to `ags.launch.success`
- [ ] `lastSuccessful("ags-fertility","staging")` now returns the new deployment (rollback target established)

## 7. Rollback Procedure
- **Automated (pre-flight):** staging launch does not require a prior rollback target (only production does).
- **On failure:** `deploymentLedger.revoke(tenant, deploymentId, reason, by)` records a revocation; `markResult(...,"failed")` is set automatically.
- **Cloudflare:** `wrangler deployments rollback <deploymentId>` (backend `rollback()` wired via spawner).
- **GitHub:** `git revert --no-edit <ref>` (backend `rollback()` wired via spawner).
- **Replay guard:** re-issuing the same `idempotencyKey` is DENIED (verified PHASE 5 §[6]); use a fresh key for any re-launch.

---

*Staging runbook — safe, governed, fail-closed. Production path is gated separately (see gate decision).*
