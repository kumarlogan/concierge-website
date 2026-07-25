# AGS Integration — Provider-Neutral Capability Layer (EPIC-AGS)

**Status:** Implemented + verified (tsc clean, runtime integration test 18/18).
**Architecture:** Built entirely on the frozen Hermes Platform Foundation's Stack B activation seam.
**No core changes. No secrets in repo. Existing AGS website CI/CD untouched.**

---

## 1. What this delivers

Hermes-side, *provider-neutral* capabilities for the AGS website (agsynergy.ca) that
route through the **one** execution boundary — `HermesExecutionGateway` (tenant →
policy → approval → runtime-guard). Two platform providers are registered and a thin
website app-capability layer maps business intentions (e.g. `website.deploy`) onto them.

| Layer | File | Role |
|---|---|---|
| GitHub provider | `activation/providers/github/provider.ts` | Registers `vcs.github` provider + 6 capabilities |
| | `activation/providers/github/port.ts` | Vendored executor port (fail-closed until wired) |
| Cloudflare provider | `activation/providers/cloudflare/provider.ts` | Registers `edge.cloudflare` provider + 7 capabilities |
| | `activation/providers/cloudflare/port.ts` | Vendored executor port (fail-closed until wired) |
| Website app layer | `activation/providers/website.ts` | Maps `website.*` → platform capabilities via gateway |
| Integration test | `activation/providers/__tests__/ags.integration.ts` | Real gateway-path test (18 assertions, no vitest dep) |

## 2. Design principles (why this is Foundation-safe)

1. **One execution boundary.** Every capability — GitHub, Cloudflare, or website — is
   executed via `executeCapability()` → `HermesExecutionGateway`. No provider owns its
   own execution path. This is exactly how `claude-code.ts` is wired (the reference impl).
2. **Vendored ports, not vendored SDKs.** The repo contains **no** `gh`/`octokit`/
   `wrangler`/workers-types import in the core path. The concrete backend is a single
   `CapabilityExecutor` function wired at **deploy time** via `setGitHubExecutor()` /
   `setCloudflareExecutor()`. Until wired, the provider is `not_installed` and **refuses**
   execution (fail-closed) — it never fabricates output.
3. **Provider-neutral capability ids.** Intention ids are vendor-agnostic
   (`code.vcs.repo`, `deploy.pages`, `ops.health`, `website.deploy`). The website layer
   never names GitHub/Cloudflare in its public surface.
4. **Secrets stay in trust config.** No token is read or stored in these files. The
   deploy-time executor (supplied by ops) carries its own credential resolution from the
   trust store — consistent with the Foundation's "secrets live in trust config" rule.
5. **Approval gate preserved.** `website.deploy` / `deploy.pages` / rollback capabilities
   carry `requiresApprovalIn: ["production"]`. A production call without a durable
   `ApprovalRef` is **refused**; with one it proceeds. Verified in the integration test.

## 3. Capability catalog

**GitHub (`vcs.github`)**
- `code.vcs.repo` — inspect repo metadata
- `code.vcs.pull-request` *(approval: prod)* — open/merge PR
- `code.vcs.branch` *(approval: prod)* — list/create branch
- `code.vcs.commit-history` — read history / compare refs
- `code.vcs.tag` *(approval: prod)* — list/create tags
- `code.vcs.rollback` *(approval: prod)* — revert/reset to known-good ref

**Cloudflare (`edge.cloudflare`)**
- `deploy.pages` *(approval: prod)* — deploy Pages project (agsynergy.ca)
- `deploy.worker` *(approval: prod)* — deploy Worker (hermes-website)
- `deploy.history` — list deployments
- `deploy.rollback` *(approval: prod)* — roll back to prior version
- `ops.health` — probe deployment health
- `ops.logs` — fetch logs
- `ops.analytics` — read edge analytics

**Website app layer (`website.*`)** — routes to Cloudflare via gateway
- `website.deploy`, `website.preview`, `website.rollback`, `website.health`,
  `website.logs`, `website.analytics`, `website.version`

## 4. How to wire a real backend (deploy-time only — NOT in this repo)

```ts
// supplied by ops at runtime, resolves credentials from trust store
import { connectGitHubBackend, connectCloudflareBackend } from "./providers/...";
import { activationPrincipal } from "./providers/github/provider.js";

const ghExecutor: CapabilityExecutor = async (capability, args, ctx) => {
  // e.g. call `gh` CLI or Octokit using ctx + trust-resolved token
};
connectGitHubBackend(ghExecutor, activationPrincipal("ops@ags"));

const cfExecutor: CapabilityExecutor = async (capability, args, ctx) => {
  // e.g. call `wrangler` using ctx + trust-resolved CF_API_TOKEN
};
connectCloudflareBackend(cfExecutor, activationPrincipal("ops@ags"));
```

## 5. Verification

- `tsc --noEmit -p hermes/tsconfig.json` → **0 errors** in `providers/github|cloudflare|website`
  (pre-existing tree errors are environmental: missing `vitest`, `@cloudflare/workers-types`,
  `@hermes/*` aliases, `@types/node` in this sandbox — unrelated to this work).
- Runtime test: `tsx hermes/services/activation/providers/__tests__/ags.integration.ts`
  → **18/18 pass**, exercising the real `HermesExecutionGateway` path:
  registration, fail-closed refusal, deploy-time wiring, execution, prod approval gate,
  unknown-capability refusal.

## 6. Remaining work (deploy-time, out of scope for this commit)

- [ ] Implement the real `gh`/`wrangler` executors (deploy glue, carries trust credentials).
- [ ] Wire provider registration into the agent bootstrap (call `registerGitHubProvider` /
      `registerCloudflareProvider` once at startup, authorized by an ops principal).
- [ ] Add a production deploy *operator* flow that calls `grantStackBApproval` (human
      approval) before invoking `website.deploy` in prod.
- [ ] Refresh the stale Cloudflare Workers API token noted in workspace state, verify via
      `/user/tokens/verify` before any real deploy.
- [ ] Optional: add vitest-native spec mirroring `claude-code.test.ts` once vitest is
      installed in the monorepo.

> **Halt:** Docs only. No commit, no Cloudflare/Worker/secret changes, no deploy performed.
