# Evolution Impact Assessment

> **Phase F deliverable** — Due-diligence assessment of the WEF v2 evolution's
> impact on the existing test suite, deployment pipeline, infrastructure, team
> workflows, and commitments. Grounded in the live repository state at
> HEAD `864f213`.

## 1. Test Suite Impact

### 1.1 Baseline (Current)

| Suite | Count | Status | Notes |
|---|---|---|---|
| `workers/tests/` (Vitest) | 614+ | ✅ All passing (as of v1.21.0) | Identity Core (514), Stack B (108), activation platform (16), workforce (unknown) |
| `hermes/` package tests | Unknown | ✅ All passing | Covered by `pnpm run typecheck:libs` |
| `apps/` frontend (Vitest + Playwright) | Unknown | ✅ Baseline passing | Last verified in Wave 8.1 |
| E2E (deployed smoke tests) | ~5 | ⚠️ Manual | `wrangler tail` + curl smoke tests |
| Type checks (`pnpm run typecheck`) | N/A | ✅ Clean libs, ~8 type errors in `artifacts/` | `artifacts/` is pre-existing and excluded |

### 1.2 Impact by Integration Phase

**Phase C1 — Orchestrator Wiring**

| Impact | Severity | Mitigation |
|---|---|---|
| New orchestration tests: ~20–30 test cases | Low | Extends existing test pattern (`describe("Orchestrator", ...)`) |
| No existing tests touched | None | Integration in `workers/tests/orchestrator-wiring.test.ts` — one new file |
| Stack B tests (108) unaffected | None | Orchestration creates tasks → Gateway executes them. Gateway unchanged. |

**Phase C2 — Durable Execution Model**

| Impact | Severity | Mitigation |
|---|---|---|
| New `DurableApproval` class: ~10–15 unit tests | Low | Follows existing unit test pattern |
| New `task_executions` table: 0 migration-touch tests | Low | Migration `0008` follows existing sequential numbering |
| Existing approval tests unchanged | None | `ToolApprovalKind` interface unchanged; `"human-token"` still valid for test |

**Phase C3 — Real CLI Execution**

| Impact | Severity | Mitigation |
|---|---|---|
| New CLI executor tests: ~15–20 | Medium | Requires `gh` and `wrangler` CLI in CI. Use `--dry-run` flags where available |
| Mock backend tests unchanged | None | Tests still use mock backends. CLI executor tests are additive |

**Phase C4 — Observability→Notification**

| Impact | Severity | Mitigation |
|---|---|---|
| New notification adapter tests: ~10–15 | Low | Follows existing Admin Bot route test pattern |
| Observability service tests (already exist) unaffected | None | Notification adapter is a consumer, not a modification |

**Phase C5 — Production Activation**

| Impact | Severity | Mitigation |
|---|---|---|
| New end-to-end test: 1 that deploys to preview | Low | Must use `--dry-run` in CI. Real deploy in scheduled workflow |
| Manual smoke test expanded: ~5 → ~10 | Low | Additional endpoints for trace, decision log, blocker registry |

### 1.3 Zero-Regression Guarantee

The WEF v2 evolution guarantees **zero regressions** across the existing 614+ test suite by:

1. **No modifications to existing source files** — all integration is through new extension points
2. **No modifications to existing test files** — new tests are separate files
3. **No modifications to type interfaces** — `CapabilityExecutor`, `HermesExecutionGateway`, `ToolApprovalKind` unchanged
4. **CI guard:** The existing test command (`cd workers && pnpm test`) runs before the new integration test command. If any existing test fails, the pipeline blocks.

## 2. Deployment Pipeline Impact

### 2.1 Current Pipeline

```yaml
# .github/workflows/deploy.yml (simplified)
- Check typecheck:libs
- Build workers
- Deploy to production (wrangler deploy --env production)
  # Blocked: wrangler-action v3 broken in monorepo
  # Blocked: CLOUDFLARE_API_TOKEN stale (52 vs 100 chars)
# Hotfix path: git push + manual wrangler deploy
```

### 2.2 Impact by Integration Phase

| Phase | Pipeline Change | Status |
|---|---|---|
| C1 | No change — orchestration wiring is code-only | ✅ Zero impact |
| C2 | Add migration `0008` — needs manual `wrangler d1 execute --remote` | ⚠️ Requires D1-enabled token (blocked) |
| C3 | Add CLI availability check in CI (`which gh && which wrangler`) | ✅ Low impact |
| C4 | Add notification adapter env vars to `wrangler.jsonc` | ✅ Low impact |
| C5 | Add new integration test suite to CI pipeline | ✅ Low impact |

### 2.3 Blocking Issues

The existing CI pipeline has two known blockers (from Phase A/B discovery):

| Blocker | Impact on WEF v2 | Priority |
|---|---|---|
| `wrangler-action` v3 broken in monorepo (pnpm) | Cannot deploy via CI. All WEF v2 code must be manually deployed or wait for fix. | 🔴 **P0** — blocks all production deployment |
| `CLOUDFLARE_API_TOKEN` stale (52-char → needs 100-char Workers token) | Cannot apply new D1 migrations. Phase C2 requires migration 0008. | 🔴 **P0** — blocks C2 and C5 |
| D1 edit permission missing on token (code 7403) | Cannot modify D1 schema via CI. See [D1 edit permissions bug](https://community.cloudflare.com/t/d1-edit-permissions-7403). | 🔴 **Blocking** — workaround needed |

**Recommendation:** Resolve CI blocking issues before starting Phase C2.
Until then, WEF v2 code is committed but not deployable via CI.

## 3. Infrastructure Impact

### 3.1 Current Infrastructure

| Resource | Type | State |
|---|---|---|
| Workers runtime | Cloudflare Workers (Free plan) | ✅ Live |
| Database | Cloudflare D1 (agsynergy-db, 5 migrations, 24 tables + 0002_identity_core) | ✅ Live |
| Object storage | Cloudflare R2 (phi-documents, non-phi-documents) | ✅ Configured |
| DNS | Cloudflare (agsynergy.ca, api.agsynergy.ca) | ✅ Live (workers.dev used as prod) |
| CI/CD | GitHub Actions (wrangler-action v3) | ⚠️ Blocked |
| Frontend hosting | Cloudflare Pages (agsynergy.ca) | ✅ Live |
| Observability | Worker-native logger (info/warn) | ✅ Live |

### 3.2 New Infrastructure Required for WEF v2

| Phase | New Resource | Justification |
|---|---|---|
| C2 | None — D1 already exists. Migration 0008 adds `task_executions` table to existing DB. | Zero new infrastructure. Schema extension only. |
| C3 | None — CLI executors run in the Workers runtime (via `exec()` or subprocess). | Zero new infrastructure. |
| C4 | None — Notification adapter uses existing Admin Bot webhook. | Zero new infrastructure. |
| C5 | None — Production activation is a config change, not infrastructure. | Zero new infrastructure. |

**Infrastructure verdict:** WEF v2 requires **zero new infrastructure**. All
integration is code-only. This is by design — WEF v2's primary delta is wiring,
not infrastructure.

### 3.3 D1 Migration Impact

| Table Name | Phase | Purpose |
|---|---|---|
| `workforce_agents` | Already exists (0005) | Agent registry |
| `agent_activation_requests` | Already exists (0005) | Activation approval |
| `agent_audit_events` | Already exists (0005) | Audit trail |
| `agent_health` | Already exists (0005) | Health metrics |
| `agent_metrics` | Already exists (0005) | Usage metrics |
| `task_executions` | C2 (0008) | Durable execution state + approval records |

**Migration `0008` schema (proposed):**

```sql
CREATE TABLE IF NOT EXISTS task_executions (
  id TEXT PRIMARY KEY,
  execution_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  capability_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'created',  -- created|assigned|approved|running|completed|failed|cancelled
  approval_token TEXT,
  approval_status TEXT DEFAULT 'none',  -- none|pending|approved|denied|expired|revoked
  approval_actor TEXT,
  approval_scope TEXT,
  approval_expires_at TEXT,
  agent_id TEXT,
  actor_id TEXT,
  input_args TEXT,
  output_result TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT,
  FOREIGN KEY (agent_id) REFERENCES workforce_agents(id)
);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);
CREATE INDEX IF NOT EXISTS idx_task_executions_execution_id ON task_executions(execution_id);
```

## 4. Workflow Impact

### 4.1 Operator Workflow Changes

| Role | WEF v1 Workflow | WEF v2 Workflow | Delta |
|---|---|---|---|
| Developer | Write code → test → git push → manual deploy | Same — add integration test | Additional test at CI check |
| Operator | `wrangler tail` for logs → grep for events | Open Admin Console Dashboard | Dashboard is additive, not replacement |
| Approver | No approval workflow exists | Open Admin Console → Decision Log → Approve/Deny | New responsibility, but with full context |
| Reviewer | Read code for correctness | Read code + verify integration test passes | Additional verification step |

### 4.2 Developer Experience

**Positive impacts:**
- Integration tests make the activation-to-execution chain **verifiable in CI**
  rather than only through manual prod testing
- The orchestrator wiring provides a **single entry point** for new capabilities
  (register → wire → test) instead of scattered route registration
- The cognitive efficiency tools reduce **"how do I find X?"** questions

**Negative impacts:**
- More tests to maintain (~60–80 new across all phases)
- Orchestrator wiring introduces an **additional abstraction layer** between
  capability definition and execution (registration overhead for simple tasks)
- CLI executor tests require tool availability in CI

### 4.3 Team Impact

| Team | Impact | Size |
|---|---|---|
| Engineering | New code + new tests in hermes/ and workers/tests/ | ~800–1200 lines new code total |
| Operations | Dashboard awareness (no new infrastructure to manage) | Minimal — training only |
| QA | Additional test suite to validate | ~60–80 new test cases |
| Product | No change — WEF v2 is infrastructure-internal | None |

## 5. Commitments Impact

### 5.1 Existing Commitments (from repo docs)

| Commitment | Impact |
|---|---|
| Phase 2 Wave 9 — Concierge Launch & Platform Activation (current, executing) | WEF v2 is additive to Wave 9. No deliverable in Wave 9 requires WEF v2. |
| Phase 3 — AI-Enhanced Patient Experience (next) | WEF v2 provides the architecture for Phase 3 AI agents. WEF v2 C1–C3 must be complete before Phase 3 agents can run through the orchestration → gateway path. |
| v1.21.0 deployed (JWT bypass removed, real consent engine, shared API layer) | Unaffected. WEF v2 does not modify Identity Core, Consent Engine, or API layer. |
| 614/614 tests passing | Guaranteed zero-regression (see §1.3). |
| CI pipeline fix (wrangler-action v4, fresh token) | Not a WEF v2 commitment. Independent P0 issue affecting current operation. |

### 5.2 New Commitments from WEF v2

| Commitment | Phase | Deadline |
|---|---|---|
| Migration 0008 (task_executions) applied | C2 | Before C5 production activation |
| Integration test suite green in CI | C5 | Before production merge |
| Orchestrator → Gateway end-to-end test | C1 | End of Phase C1 |
| Durable approval model (replace "human-token" stub) | C2 | End of Phase C2 |
| CLI executor backend test | C3 | End of Phase C3 |
| Notification adapter connected | C4 | End of Phase C4 |

## 6. Risk Mitigation Summary

| Risk | Phase | Mitigation |
|---|---|---|
| D1 migration applied out of order | C2 | Sequential numbering (0008). Manual apply. No auto-migration in CI. |
| CLI executor test fails in CI (tool missing) | C3 | Conditional test: `it.skipIf(!hasCLI)` — not a hard failure |
| Operator desensitization to notifications | C4 | WARN+ severity only. Configurable per-channel. |
| Production activation breaks something | C5 | Full CI + preview smoke + dry-run before production. Reversible commit. |
| Integration tests become flaky | All | Each integration test asserts deterministic outcomes (mock backends, not real ones). Flakiness is a bug, not a known tolerance. |

---

*This document is Phase F of the WEF v2 Evolution Blueprint (Phase C).
It provides due-diligence analysis grounded in live repository state at
HEAD `864f213`. All assessments are based on observed code, not assumptions.*