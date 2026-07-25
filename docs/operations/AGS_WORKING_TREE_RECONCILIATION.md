# AGS Working-Tree Reconciliation (PHASE 1 — read-only)

> **Authority:** Read-only assessment. `git` was invoked in read mode only.
> **NO** reset / clean / stash / commit was performed.

## 1. Snapshot (read-only)

- **Branch:** `main`
- **Last 5 commits:** EPIC-004 (6/6) documentation/validation, EPIC-004 (5/6) tenant enforcement, EPIC-004 (4/6) AgentStateStore, EPIC-004 (3/6) WorkflowStore, EPIC-004 (2/6) persistence seam.
- **Working-tree counts:** `126` untracked (`??`), `1` added (`A`), `2` added-modified (`AM`), `20` modified (`M`) → **149 total entries**.

## 2. Classification of Changed Files

### A — Required for AGS activation (the live activation seam)
- `hermes/services/activation/providers/github/` (provider, backend, port, config)
- `hermes/services/activation/providers/cloudflare/` (provider, backend, port, config)
- `hermes/services/activation/providers/deployment/` (index, launch, ledger, rlse, guardrails, executors, site-identity, backends/*)
- `hermes/services/activation/providers/secret-source.ts`
- `hermes/services/activation/providers/bootstrap.ts`
- `hermes/audit/event.ts`, `hermes/audit/store.ts`, `hermes/audit/store.durable.ts`, `hermes/audit/emitter.ts`
- `hermes/services/activation/provider-framework.ts`, `approval-gates.ts`

### B — Previous completed EPIC artifacts (FROZEN Foundation, not AGS-specific)
- EPIC-004/005/006/007/008 completion/baseline/validation reports under `docs/operations/` and `docs/architecture/`
- `hermes/services/execution/` (gateway, idempotency, lease, metrics, policy-evaluator, coordinator) — Foundation execution boundary
- `hermes/services/providers/` (capability, manager, discovery, loader, marketplace, trust/*) — Foundation provider framework
- `hermes/services/security/security-agent.ts`, `hermes/services/tools/tool-provider.ts`
- `hermes/admin/console/bff-client.ts`, `session.ts`
- `hermes/services/developer/developer-runtime.ts`, `developer-agent.ts`
- `ROADMAP.md`, `pnpm-lock.yaml`, `workers/package.json`, `workers/tsconfig.json`, `workers/tests/globalSetup.ts`

### C — Deferred backlog / non-blocking
- `HERMES_CORE_NIGHT_PROMPT.md` (this task's prompt, untracked)
- `docs/architecture/EPIC-00x_*.md` design drafts not yet promoted to completion
- `workers/tests-epic0059/`, `hermes/services/execution/epic-004.6.test.ts` (test scaffolding)

### D — Unknown / requires review
- `hermes/services/providers/sdk.ts` (added) — verify it does not import vendor SDK into the core activation path.
- `hermes/services/providers/trust/lifecycle.ts` (`AM`) and `.../trust/persistence/trust-state-store.ts` (`AM`) — staged-with-modifications; confirm trust state durability wiring matches the FROZEN architecture (no new trust model).
- `hermes/services/execution/index.ts` (`M`) and `hermes/services/index.ts` (`M`) — confirm no new execution boundary was introduced.
- `hermes/tsconfig.json`, `hermes/tsconfig.epic005.json`, `hermes/tsconfig.epic007.json`, `hermes/vitest.config.js` (untracked) — tooling config; relate to deferred D2 (typecheck environment).

## 3. Activation-Relevant Conclusion
- **Nothing in class A is missing** — the entire AGS activation seam is present and self-consistent (re-verified by suite execution).
- The dirty tree is **expected** (many prior-epic artifacts) and does **not** block *documentation + safe validation*. It is a **hygiene prerequisite** (B7) before any real deploy, to be reconciled by the operator — not by this checkpoint.

---

*Reconciliation is read-only. No working-tree mutation performed.*
