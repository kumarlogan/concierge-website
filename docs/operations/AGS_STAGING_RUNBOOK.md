# AGS Staging Activation Runbook — Hermes Platform v1.0

> **Night Prompt:** PHASE 3 — AGS Staging Activation Plan
> **Scope:** Controlled, supervised staging activation of agsynergy.ca via the governed `agsLaunch` path.
> **NO actual deployment is performed by this document. It is an operator procedure.**

---

## 1. Required Operator Inputs

| Input | Example | Source |
|---|---|---|
| GitHub repo | `kumarlogan/concierge-website` | `site-identity.ts` / `index.ts` config |
| GitHub branch | `main` | `AgsDeploymentConfig.githubBranch` |
| Cloudflare account id | `ag-account` | operator |
| Cloudflare project | `agsynergy` | `AgsDeploymentConfig.cfProject` |
| Site URL | `https://agsynergy.ca` | `AGS_SITE_URL` |
| AGS tenant | `ags-fertility` | `AGS_TENANT` (fixed by policy) |
| Reference (staging) | git sha / branch | operator |
| Authorized principal | `activationPrincipal("ops@ags")` | `provider.ts` |

## 2. Required Secrets / Config Locations

| Secret ref | Resolution | Fail-closed behavior if absent |
|---|---|---|
| `GITHUB_TOKEN` | `SecretSource.get("GITHUB_TOKEN")` | GitHub backend ⇒ `NOT_INSTALLED`, capabilities refused |
| `CF_API_TOKEN` | `SecretSource.get("CF_API_TOKEN")` | Cloudflare backend ⇒ `NOT_INSTALLED`, `deploy.*` refused |

- **No secret is stored in source.** Resolved at runtime via `setSecretSource(...)` (env var / vault / platform store). Default = `EnvSecretSource` reading `process.env` only at resolution time.
- **Production** also requires a live `CF_API_TOKEN` presence check (`checkSecretExpiry`, guardrails) — staging does not gate on it.

## 3. Approval Flow

- **Staging:** routine, **no human `ApprovalRef` required**. `runLaunch` allows staging after governance pre-flight (tenant + site identity + env-valid + change-freeze N/A).
- **Production:** requires a durable `ApprovalRef` from an authorized approver (`lead@ags` / `admin@ags`), plus semantic release tag (`vX.Y.Z`), AGS-owned domain, verified rollback target, and live secret.
- Audit: every step emits `emitAudit` (`ags.launch.*`) correlated to the ledger `auditReference`.

## 4. Staging Launch Sequence (safe path)

```
1. setSecretSource({ get: ref => process.env[ref] })   // operator injects GITHUB_TOKEN, CF_API_TOKEN
2. bootstrapProviders(activationPrincipal("ops@ags"), {
     github: createGitHubCliBackend(spawner, {...}),
     cloudflare: createCloudflareWranglerBackend(spawner, {...}),
   })                                                  // registers + wires backends; NOT_INSTALLED if creds missing
3. const deps = buildAgsLaunchDeps(cfg, spawner)
4. const out = await agsLaunch({
     tenant: "ags-fertility", requester: "deployer@ags",
     reference: "<sha-or-branch>", environment: "staging",
   }, cfg, spawner)
5. // inspect out.result === "success", out.live, out.ready
```

- `spawner` is the injected `Spawner` (wraps `gh`/`git`/`wrangler`). Never import vendor SDKs in core.
- `dryRun: true` produces a plan and executes nothing (recommended first step).

## 5. Validation Checklist (post-staging)

- [ ] `providerStatus()` returns `github: healthy`, `cloudflare: healthy`
- [ ] `out.result === "success"`
- [ ] `out.ready.github === true` and `out.ready.cloudflare === true`
- [ ] `out.live === true` (probeSite reached agsynergy.ca)
- [ ] Ledger entry written for `ags-fertility` tenant, `environment: staging`
- [ ] Corresponding `ags.launch.success` audit event emitted (correlate `auditReference`)
- [ ] Tenant isolation: no cross-tenant ledger entries
- [ ] Replay test: same `idempotencyKey` second call ⇒ `denied`

## 6. Rollback Procedure (staging)

1. Identify last successful deployment: `deploymentLedger.lastSuccessful("ags-fertility", "staging")`.
2. GitHub: `git revert --no-edit <ref>` via `createGitHubCliBackend(...).rollback({ref})`.
3. Cloudflare: `wrangler deployments rollback <id>` via `createCloudflareWranglerBackend(...).rollback({deploymentId})`.
4. Record revocation: `deploymentLedger.revoke("ags-fertility", deploymentId, reason, by)` (durable + audited).

## 7. Failure Handling

| Symptom | Cause | Action |
|---|---|---|
| `out.result === "denied"` (no deploy attempted) | Governance guard tripped (tenant/env/domain) | Inspect `out.error`; correct request, re-run |
| `out.result === "failed"` | Provider backend returned `ok:false` | Read `out.error`; check token validity / network; no fabricated success |
| `github: not_installed` | `GITHUB_TOKEN` absent | Inject secret via `SecretSource` |
| `cloudflare: not_installed` | `CF_API_TOKEN` absent | Inject secret via `SecretSource` |
| `probeSite` reports `ok:false` | Site unreachable / DNS/TLS | Verify `agsynergy.ca` DNS + cert; do not proceed if live check fails |
| D1 defect surfaced (`recordFromIdentity`) | `workflow.ts` superseded dry-run path | **Not on `agsLaunch` path**; ignore for staging. Track B1. |

---

*Runbook only. No deploy executed. See `AGS_PRODUCTION_READINESS_DECISION.md` for production gate.*
