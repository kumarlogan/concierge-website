# Capability Dependency Graph

> **Phase G deliverable** — Complete mapping of every discovered capability,
> provider, tool, and their interdependencies across the WEF v2 operating system.
>
> Total: **31 capability IDs** across 3 providers + 1 app routing layer +
> 5 tool provider domains + 1 platform discovery layer.

## 1. Provider-Level Capabilities

### 1.1 Cloudflare Provider (`edge.cloudflare`)

| Capability ID | Requires Approval | Description | Backend |
|---|---|---|---|
| `deploy.build` | — | Trigger a build (wrangler / pages build) | `wrangler build / wrangler pages build` |
| `deploy.pages` | **production** | Deploy Cloudflare Pages (agsynergy.ca) | `wrangler pages deploy` |
| `deploy.worker` | **production** | Deploy a Cloudflare Worker | `wrangler deploy` |
| `deploy.history` | — | List recent deployments/releases | `wrangler deployments list` |
| `deploy.rollback` | **production** | Roll back deployment | `wrangler rollback` |
| `ops.health` | — | Probe deployment health | HTTP status + edge status probe |
| `ops.logs` | — | Fetch runtime logs | `wrangler tail` / API |
| `ops.analytics` | — | Read edge analytics | Cloudflare Analytics API |

**Wiring:** `setCloudflareExecutor()` at deploy time. Until then, fail-closed:
```json
{ "ok": false, "error": "Cloudflare executor not wired", "backend": "edge.cloudflare" }
```

### 1.2 GitHub Provider (`vcs.github`)

| Capability ID | Requires Approval | Description | Backend |
|---|---|---|---|
| `code.vcs.repo` | — | Inspect repository (branch, visibility, metadata) | `gh repo view` |
| `code.vcs.pull-request` | **production** | Open or merge PR | `gh pr create / gh pr merge` |
| `code.vcs.branch` | **production** | List or create branches | `gh branch / git branch` |
| `code.vcs.commit-history` | — | Read commit history / compare refs | `gh api repos/:owner/:repo/commits` |
| `code.vcs.tag` | **production** | List or create tags/releases | `gh release create / git tag` |
| `code.vcs.rollback` | **production** | Revert commit or reset branch | `git revert / gh pr close` |

**Wiring:** `setGitHubExecutor()` at deploy time. Same fail-closed pattern.

### 1.3 Claude Code Provider (`dev.claude-code`)

| Capability ID | Requires Approval | Description |
|---|---|---|
| `dev.code.plan` | — | Produce implementation plan from spec |
| `dev.code.generate` | **production** | Generate code from prompt/plan |
| `dev.code.refactor` | **production** | Refactor existing code |
| `dev.code.explain` | — | Explain code or diff |
| `dev.code.review` | — | Review changeset for quality/risk |
| `dev.code.tests` | **production** | Generate/run tests |
| `dev.code.docs` | — | Generate documentation |

> All 7 capabilities are provider-neutral. Future providers (Codex, local models)
> can advertise the same IDs — zero agent-code changes to swap backends.

## 2. Application Routing Layer — AGS Website (`hermes.website`)

Maps 10 app-level intention IDs to underlying provider capabilities:

| App Capability | Routes To (Provider → Capability) | Requires Approval |
|---|---|---|
| `website.status` | `edge.cloudflare` → `ops.health` | — |
| `website.build` | `edge.cloudflare` → `deploy.build` | — |
| `website.deploy` | `edge.cloudflare` → `deploy.pages` | **production** |
| `website.preview` | `edge.cloudflare` → `deploy.pages` | — (preview env) |
| `website.publish` | `edge.cloudflare` → `deploy.pages` | **production** |
| `website.rollback` | `edge.cloudflare` → `deploy.rollback` | **production** |
| `website.health` | `edge.cloudflare` → `ops.health` | — |
| `website.logs` | `edge.cloudflare` → `ops.logs` | — |
| `website.analytics` | `edge.cloudflare` → `ops.analytics` | — |
| `website.version` | `edge.cloudflare` → `deploy.history` | — |

> **Note:** All 10 website app capabilities currently route exclusively to
> Cloudflare. This is by design (Concierge is Cloudflare-deployed). The routing
> table is extensible — same pattern, new entries.

## 3. Tool Provider Domains (EPIC-001/002 Platform Tooling)

These are available in the Hermes platform but **not registered through the
activation provider framework** — they execute directly through `ToolProvider`
rather than through `CapabilityExecutor`. They represent a parallel execution
path that exists alongside the Stack B activation system.

| Domain | Tool Set | Provider |
|---|---|---|
| Development | `dev-tools.ts` | Hermes (built-in) |
| Security | `security-tools.ts` | Hermes (built-in) |
| Monitoring | `monitoring-tools.ts` | Hermes (built-in) |
| Research | `research-tools.ts` | Hermes (built-in) |
| Documentation | `docs-tools.ts` | Hermes (built-in) |

> **Bridge to WEF v2:** These tool providers are candidates for eventual
> migration into the activation provider framework, making them visible
> to the Orchestration Fabric, Approval Manager, and Observability service.

## 4. Dependency Graph

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          CAPABILITY DEPENDENCY GRAPH                          │
│                                                                               │
│  APPLICATION LAYER (AGS Website — 10 capabilities)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  website.status ──┐                                                     │  │
│  │  website.health ──┤                                                     │  │
│  │  website.build ───┤                                                     │  │
│  │  website.deploy ──┤                                                     │  │
│  │  website.preview ─┤──→ hermes.website (ROUTES table) ───────┐          │  │
│  │  website.publish ─┤                                            │          │  │
│  │  website.rollback ┤                                            │          │  │
│  │  website.logs ────┤                                            │          │  │
│  │  website.analytics┘                                            │          │  │
│  │  website.version ─────────────────────────────────────────────┘          │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                           │                                                   │
│                           ▼                                                   │
│  PROVIDER FRAMEWORK (Stack B — 3 providers, 21 capabilities)                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐     │  │
│  │  │ edge.cloudflare  │    │   vcs.github     │    │ dev.claude-code  │     │  │
│  │  │ 8 capabilities  │    │ 6 capabilities   │    │ 7 capabilities  │     │  │
│  │  │ deploy.build   │    │ code.vcs.repo   │    │ dev.code.plan   │     │  │
│  │  │ deploy.pages*  │    │ code.vcs.pr*    │    │ dev.code.gen*   │     │  │
│  │  │ deploy.worker* │    │ code.vcs.branch*│    │ dev.code.refac* │     │  │
│  │  │ deploy.history │    │ code.vcs.hist   │    │ dev.code.explain│     │  │
│  │  │ deploy.roll*   │    │ code.vcs.tag*   │    │ dev.code.review │     │  │
│  │  │ ops.health     │    │ code.vcs.roll*  │    │ dev.code.tests* │     │  │
│  │  │ ops.logs       │    └───────┬─────────┘    │ dev.code.docs   │     │  │
│  │  │ ops.analytics  │            │              └────────┬────────┘     │  │
│  │  └───────┬────────┘            │                       │              │  │
│  │          │                     │                       │              │  │
│  │          └─────────────────┬───┴───────────────────┬───┘              │  │
│  │                            │                       │                  │  │
│  │                     ┌──────▼───────────────────────▼──────┐           │  │
│  │                     │  registerProvider → enableProvider   │           │  │
│  │                     │  → setProviderHealth → executeCap    │           │  │
│  │                     │  (all through HermesExecutionGateway) │           │  │
│  │                     └──────────────────┬───────────────────┘           │  │
│  └────────────────────────────────────────┼───────────────────────────────┘  │
│                                            │                                 │
│                                            ▼                                 │
│  EXECUTION BOUNDARY                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  HermesExecutionGateway (single boundary)                               │  │
│  │  ├─ StackBGatewayGuard: active + enabled + healthy + tenant check       │  │
│  │  ├─ ApprovalRef check: production env requires valid approval           │  │
│  │  └─ ProviderRuntimeGuard: SandboxPolicy (declared, not read yet)        │  │
│  │                             │                                            │  │
│  │                    ┌────────▼─────────┐                                 │  │
│  │                    │  CapabilityExecutor                                 │  │
│  │                    │  (capId, args, ctx) → ToolResult                    │  │
│  │                    └────────┬─────────┘                                 │  │
│  └─────────────────────────────┼───────────────────────────────────────────┘  │
│                                │                                              │
│                                ▼                                              │
│  REAL BACKENDS (wired at deploy time — fail-closed until wired)               │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  cloudflare-exec.ts │ github-exec.ts │ claude-code CLI (subprocess)     │  │
│  │  (wrangler CLI)     │ (gh CLI)       │                                  │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
│                                                                               │
│  PARALLEL EXECUTION PATH (ToolProvider — not through activation framework)    │
│  ┌─────────────────────────────────────────────────────────────────────────┐  │
│  │  dev-tools │ security-tools │ monitoring-tools │ research-tools │ docs   │  │
│  │  (5 domains, variable capability count — uncounted)                    │  │
│  │  → execute directly through ToolProvider, NOT through Gateway           │  │
│  │  → Not visible to Activation/Approval/Observability system             │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘

  * = requires approval in production
```

## 5. Approval Requirements by Layer

| Layer | Capabilities | Requires Production Approval |
|---|---|---|
| App — Read-only | 5 (`status`, `health`, `logs`, `analytics`, `version`) | — |
| App — Build | 1 (`build`) | — |
| App — Deploy/Mutate | 4 (`deploy`, `publish`, `preview`, `rollback`) | ✅ 3 of 4 (preview excluded) |
| Provider — Cloudflare read | 4 (`build`, `history`, `health`, `logs`, `analytics`) | — |
| Provider — Cloudflare mutate | 3 (`pages`, `worker`, `rollback`) | ✅ All 3 |
| Provider — GitHub read | 2 (`repo`, `commit-history`) | — |
| Provider — GitHub mutate | 4 (`pr`, `branch`, `tag`, `rollback`) | ✅ All 4 |
| Provider — Claude Code read | 4 (`plan`, `explain`, `review`, `docs`) | — |
| Provider — Claude Code mutate | 3 (`generate`, `refactor`, `tests`) | ✅ All 3 |

## 6. Dynamic Provider Discovery (Manager Layer)

In addition to the 3 statically wired providers, the `DynamicProviderManager`
supports runtime discovery and trust admission. This is the **future extension
path** for Phase 4's capability ecosystem.

```
Discovery → Loader → Trust Admission → Capability Registration → Activation
     │          │            │                    │                  │
     │    Provider package   │               Registered in          │
     │    read from disk    │               CapabilityRegistry      │
     │                      │                                       │
     │                 TrustRejected:         │                      │
     │                 visible in marketplace │                      │
     │                 but cannot execute     │                      │
     │                                        │                      │
     │                                  Duplicate check             │
     │                                  Collision check             │
```

The manager layer is **provider-neutral** — a Cloudflare provider package
and a Vercel provider package load through the same code path. The only
difference is the `ProviderManifestV2` metadata.

## 7. Gateway Dependency (Execution Chain)

Every execution follows this chain. There is **no bypass**:

```
1. App layer:   runWebsiteCapability("website.deploy", args, ctx)
     │               └→ resolves to edge.cloudflare → deploy.pages
     ▼
2. Provider:   executeCapability("deploy.pages", args, { approvalRef, ... })
     │               └→ calls registerProvider → enableProvider → setProviderHealth
     ▼
3. Gateway:    HermesExecutionGateway.execute(request)
     │               └→ StackBGatewayGuard.check()
     │                    ├─ isActive?
     │                    ├─ isEnabled?
     │                    ├─ isHealthy?
     │                    ├─ tenant === ctx.tenant?
     │                    └─ production && !approvalRef? → DENIED
     ▼
4. Executor:   CapabilityExecutor("deploy.pages", args, ctx)
     │               └→ runCloudflare(cap, args, ctx)
     │                    ├─ has executor?  → yes: call wrangler pages deploy
     │                    └─ no executor?   → fail-closed: { ok: false, error: "not wired" }
     ▼
5. Result:     ToolResult { ok, data, error, backend }
     │               └→ audit event emitted at every stage
     ▼
6. Audit:      agent_audit_events (D1) ← workforce_agents (D1)
```

## 8. Provider Neutrality Verification

Every capability ID in the system is provider-neutral. No vendor name appears
in any capability ID. The mapping is fully decoupled:

| Domain | Capability ID (neutral) | → | Provider ID (vendor) |
|---|---|---|---|
| Deploy | `deploy.pages` | → | `edge.cloudflare` (or future: `edge.vercel`, `edge.netlify`) |
| Code | `code.vcs.repo` | → | `vcs.github` (or future: `vcs.gitlab`, `vcs.gitea`) |
| Development | `dev.code.generate` | → | `dev.claude-code` (or future: `dev.codex`, `dev.opencode`) |
| Ops | `ops.health` | → | `edge.cloudflare` (or future: `edge.aws`, `edge.gcp`) |

> Swapping providers requires exactly one change: the routing entry in
> `website.ts` (or the provider registration step). Zero changes to
> agent definitions, approval policies, or observability dashboards.

## 9. Unmapped / Orphaned Capabilities

| Capability | Status | Gap |
|---|---|---|
| Deployment workflow (`runStagingWorkflow`) | Code exists, validated via dry-run | Not wired to any app-level capability or CLI trigger |
| Dynamic provider manager (discovery → trust → registration) | Complete code in `hermes/services/providers/` | Not wired to any production activation sequence |
| Tool provider domains (dev, security, monitoring, research, docs) | Active in Hermes platform | Not visible to activation/approval/observability system |

---

*This document is Phase G of the WEF v2 Evolution Blueprint (Phase C).
It is grounded in live source code inspection of `website.ts`,
`cloudflare/provider.ts`, `github/provider.ts`, `claude-code.ts`,
`provider-framework.ts`, `manager.ts`, and all related files.*