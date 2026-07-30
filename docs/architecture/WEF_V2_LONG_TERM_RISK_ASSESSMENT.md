# WEF v2 Long-Term Risk Assessment

> **Constitutional Architecture Review Board — 5-Year Failure Analysis**
> Review date: 2026-07-29
> Horizon: 2026-2031
> Method: For each risk, define trigger → failure scenario → likelihood × impact → mitigation. Non-trivial mitigation only.

---

## Executive Summary

**WEF v2 architecture has 3 existential risks over 5 years.** Two are controllable (single-provider coupling, ungoverned tool execution). One is external (Cloudflare platform evolution).

**Risk matrix:**

| ID | Risk | Likelihood (5yr) | Impact | Score | Mitigatable? |
|----|------|-----------------|--------|-------|-------------|
| **R-EX1** | Single-provider coupling (Cloudflare) | Medium | Critical | **15** | ✅ Yes — multi-provider architecture |
| **R-EX2** | D1 product evolution incompatible | Medium | High | **12** | ⚪ Partial — abstraction layer |
| **R-EX3** | CI pipeline permanently blocked | High | High | **16** | ✅ Yes — immediate action |
| **R-EX4** | GitHub API deprecations | Low | Low | **3** | ✅ Yes — abstraction layer |
| **R-EX5** | Claude Code provider discontinued | Low | Low | **2** | ✅ Yes — provider-neutral core |
| **R-IN1** | Tool provider domains become unmanageable | Medium | High | **12** | ✅ Yes — migration plan |
| **R-IN2** | "human-token" stub reaches production | Medium | Critical | **15** | ✅ Yes — CI guard |
| **R-IN3** | Orchestrator context grows unbounded | High | Medium | **10** | ✅ Yes — bounds enforcement |
| **R-IN4** | Feature flag non-compliance causes deployment | Medium | High | **12** | ✅ Yes — add flags C1 |
| **R-IN5** | Single-operator approval bottleneck | Low | Medium | **6** | ⚪ Partial — multi-operator |
| **R-IN6** | Audit table growth overwhelms D1 (1M events) | High | Medium | **10** | ✅ Yes — indexing + archival |
| **R-IN7** | No DR plan for D1 outage | Medium | Critical | **12** | ✅ Yes — produce DR runbook |
| **R-IN8** | CLI supply chain compromised | Low | Critical | **6** | ✅ Yes — CLI integrity verification |
| **R-IN9** | Agent autonomy escalation | Medium | High | **12** | ✅ Yes — governance re-freeze |
| **R-IN10** | PSER/Governance schema drift | High | Low | **6** | ✅ Yes — automated sync gate |

**Risk rating: CRITICAL** — 3 risks score ≥15 (out of 25). Mitigations exist for all 3.

---

## External Risks

### R-EX1: Single-Provider Coupling (Cloudflare)

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium (30-50% over 5 years) |
| **Impact** | Critical — all 10 app capabilities unavailable |
| **Score** | **15/25** |

**Failure scenario:** Cloudflare undergoes a significant platform change — pricing restructuring that makes Workers/D1 uneconomical, a major policy shift affecting healthcare data processing, or a sustained outage (>24h) during a patient-critical operation. All 10 `website.*` capabilities and all D1-dependent operations are affected simultaneously.

**Exacerbating factors:**
- The app layer (10 capabilities) routes exclusively to Cloudflare
- D1 has no multi-region/failover in the Free Plan
- CF Workers runtime is the only execution environment
- No documented Cloudflare exit strategy

**Mitigation (controllable):** 
1. Document the Cloudflare migration path in the Architecture Freeze scope
2. Define the provider-neutral app layer interface (the current architecture supports this — the routing table can be swapped)
3. Estimate the cost of switching to an alternative (e.g., AWS Lambda + DynamoDB, or Fly Machines + SQLite)
4. **Do not** implement the alternative now — but maintain the "one week pivot" option

**Falsifiable prediction:** Architecture Freeze documents a Cloudflare exit strategy (provider-neutral interface definition + estimated migration cost). If Cloudflare becomes problematic, the pivot time is documented, not discovered.

**Failure trigger events:**
- Cloudflare D1 product EOL announcement
- Cloudflare pricing restructuring >3× current cost
- Cloudflare sustained outage (>24h)
- HIPAA/PIPEDA compliance gap in CF Workers

### R-EX2: D1 Product Evolution Incompatibility

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium (40% over 5 years) |
| **Impact** | High — all D1-dependent operations |
| **Score** | **12/25** |

**Failure scenario:** Cloudflare evolves D1 (e.g., to D2, introducing breaking API changes) and the current D1 Worker bindings become deprecated. The platform has 24+ tables, 5 migrations, and heavy D1 usage across execution state, audit, approval, and cognitive tools. Migration to the new API requires rewriting all D1 code paths.

**Exacerbating factors:**
- No D1 abstraction layer in the current architecture (all Worker modules directly call `env.DB.*`)
- The DocumentService archetype partially abstracts D1, but most audit/execution code calls D1 directly
- No D1 query logging (can't measure current D1 query volume to estimate migration cost)

**Mitigation (partial):**
1. Add a lightweight D1 abstraction layer in the `hermes/services/persistence/` module
2. Create a `D1Adapter` interface that wraps `env.DB.*` calls
3. New code (migration 0008, cognitive tools, durable approval) uses the adapter
4. Legacy code (24+ tables) is migrated incrementally

**Falsifiable prediction:** After the D1 adapter is introduced, a hypothetical D1→D2 migration requires changing only the `D1Adapter` implementation. All 100+ D1 call sites in the codebase are wrapped.

**Failure trigger events:**
- Cloudflare announces D1 deprecation timeline
- Cloudflare D1 hits maximum scale ceiling (read/write throughput)
- D1 API breaking change in a Workers runtime update

### R-EX3: CI Pipeline Permanently Blocked

| Aspect | Detail |
|--------|--------|
| **Likelihood** | High (60%+ over next 6 months) |
| **Impact** | High — cannot deploy |
| **Score** | **16/25** |

**Failure scenario:** The CI pipeline (`wrangler-action` v3 incompatibility, stale D1 token, missing D1 edit permissions) is not resolved within 30 days. During this window:
- No automated deployments run
- Manual `wrangler deploy` is used for hotfixes (not auditable)
- Integration tests run locally only (not in CI)
- Security scans (gitleaks, semgrep) are skipped
- The "no deployment" policy is violated for critical fixes

**Exacerbating factors:**
- 3 independent blockers (action version, token, permissions) — all must be resolved
- Token rotation requires Cloudflare Dashboard access (may not be available to all team members)
- `wrangler-action` v3 is maintained by Cloudflare — the fix is external

**Mitigation (controllable):**
1. Prioritize CI pipeline repair as Phase 0
2. Document the manual deployment procedure (approval required, audit trail in changelog)
3. Automate token rotation (GitHub secrets + Cloudflare API token rotation via scheduled workflow)
4. Add a CI health check that fails if any pipeline component is unverified

**Falsifiable prediction:** CI pipeline is restored within 14 days of this review being submitted, or manual deployments are documented with approval requirements that equal existing automation.

**Failure trigger events:**
- Any new PR cannot be deployed through CI
- Manual deployment is the default path for 14+ consecutive days
- A hotfix is deployed without audit trail

### R-EX4: GitHub API Deprecations

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Low — GitHub API v3 is stable and long-supported |
| **Impact** | Low — affects `code.vcs.*` capabilities only |
| **Score** | **3/25** |

**Mitigation:** Provider-neutral core means the `code.vcs.*` provider can be swapped to GitLab/Bitbucket API. No migration needed for most capabilities.

### R-EX5: Claude Code Provider Discontinued

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Low — Anthropic is well-funded and Claude Code is a strategic product |
| **Impact** | Low — affects `dev.code.*` capabilities only |
| **Score** | **2/25** |

**Mitigation:** The `dev.code.*` capability IDs are provider-neutral. `claude-code-backend.ts` can be replaced with any code generation backend. The capability definitions don't change. This is the architecture's provider-neutrality paying off.

---

## Internal Risks

### R-IN1: Tool Provider Domains Become Unmanageable

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium (40% over 2 years) |
| **Impact** | High — ungoverned execution path grows |
| **Score** | **12/25** |

**Failure scenario:** The 5 ungoverned tool provider domains (dev, security, monitoring, research, docs) grow in scope and complexity. New tools are added as tool providers instead of registered capabilities (because registration requires governance). After 2 years, the tool provider domains contain 20+ tools with zero observability, no approval model, and no audit trail.

**Exacerbating factors:**
- Adding a tool to a tool domain is easier than registering a capability
- No team is responsible for tool provider governance (they're "knowledge objects")
- The domains are not instrumented — no one can measure their growth

**Mitigation:**
1. Instrument tool provider call sites to emit audit events (same `agent_audit_events` table)
2. Set a maximum tool count per domain (e.g., 10 tools per domain)
3. Require a capability registration for any new tool beyond the limit
4. Audit tool provider domains quarterly as part of the Capability Registry maintenance

**Falsifiable prediction:** Tool provider domain size grows linearly with time (new tools = new entries) until instrumented. After instrumentation, growth stabilizes because the cost (discoverability, observability) is visible.

### R-IN2: "human-token" Stub Reaches Production

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium (30% — someone deploys C1 without C2) |
| **Impact** | Critical — human approval bypassed in production |
| **Score** | **15/25** |

**Failure scenario:** C1 is deployed (code-only Orchestration Fabric). The "human-token" approval stub is live in production because C2 (DurableApproval) is blocked by D1 migration 0008. Agents begin executing production capabilities with automatic approval. Every security property that depends on human approval is bypassed.

**Exacerbating factors:**
- C1 is described as "code-only, deployable" — it CAN be deployed to production without C2
- The CI pipeline is broken — there's no CI guard to prevent it
- "human-token" passes all tests (it's a valid stub)
- No documented rule says "do not deploy C1 without C2"

**Mitigation:**
1. Add a CI guard: `if (env === "production" && approval === "human-token") → CI_FAIL`
2. Document: "C1 and C2 are a single production deployment unit"
3. Make the stub return `{ ok: false }` in production — tests override it with `process.env.TEST_MODE`
4. Add a `WARN` level log at platform startup: "⚠️ human-token approval is active. This is insecure for production."

**Falsifiable prediction:** The `human-token` stub, if deployed to production, would allow any agent to execute any capability without human approval. This can be verified by tracing a capability execution through the Gateway with the stub active — the approval check passes immediately.

### R-IN3: Orchestrator Context Grows Unbounded

| Aspect | Detail |
|--------|--------|
| **Likelihood** | High — if context bounds not enforced in C1 |
| **Impact** | Medium — token cost increases, operator sessions expire |
| **Score** | **10/25** |

**Mitigation documented in TOKEN_EFFICIENCY_REVIEW.md.** Simple: enforce incremental context at the orchestrator.

### R-IN4: Feature Flag Non-Compliance Causes Uncontrolled Deployment

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium — if feature flags are not added |
| **Impact** | High — phased deployment impossible |
| **Score** | **12/25** |

**Failure scenario:** A partial phase deployment (C1 done, C2 blocked) must be deployed for a time-sensitive reason. Without feature flags, the full C1-C5 code is deployed together. A partially-implemented feature is exposed to production.

**Mitigation:** Add `ENABLE_ORCHESTRATOR`, `ENABLE_DURABLE_APPROVAL`, `ENABLE_CLI_EXECUTOR`, `ENABLE_NOTIFICATIONS` env vars before C1 deployment. Each defaults to `false`.

### R-IN5: Single-Operator Approval Bottleneck

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Low — at current scale, one operator is sufficient |
| **Impact** | Medium — deployment slowed |
| **Score** | **6/25** |

**Mitigation:** Not an immediate risk. Track time-to-approval metric. If >30 minutes average, add a second operator.

### R-IN6: Audit Table Growth Overwhelms D1

| Aspect | Detail |
|--------|--------|
| **Likelihood** | High (>60% at 1K workflows/day within 6 months) |
| **Impact** | Medium — cognitive tools degrade, D1 reads increase |
| **Score** | **10/25** |

**Mitigation:**
- Add D1 index on `audit_events(workflow_id, timestamp)` before 100K rows
- Add D1 index on `audit_events(severity, timestamp)` for Status Dashboard queries
- Implement audit event archival policy: keep N days in D1, archive older to R2
- Monitor D1 row count in Cloudflare dashboard

**Falsifiable prediction:** Without an index, `SELECT ... WHERE workflow_id = ? ORDER BY timestamp` degrades to sequential scan at >100K rows. Measure query time before and after index creation.

### R-IN7: No Disaster Recovery Plan for D1 Outage

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium — D1 is a relatively new product |
| **Impact** | Critical — all operations blocked |
| **Score** | **12/25** |

**Failure scenario:** D1 is unavailable for 1+ hour. All operations that depend on state (execution, approval, audit, cognitive tools) are blocked. The system fails closed (correct behaviour) but operators have no documented procedure for:
- Verifying D1 is the cause
- Communicating the outage to stakeholders
- Restoring from backup
- Resuming operations when D1 returns

**Mitigation:**
1. Produce a DR runbook (before C5 production activation)
2. Define D1 outage symptoms (health endpoint returns `degraded: true`)
3. Define fallback: read-only mode with cached data, deny all mutations
4. Define RTO (target: 4 hours) and RPO (target: 5 minutes — D1 synchronous replication)
5. Test DR procedure quarterly

### R-IN8: CLI Supply Chain Compromised

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Low — but non-zero for widely-used tools (gh, wrangler) |
| **Impact** | Critical — compromised CLI in the execution path |
| **Score** | **6/25** |

**Failure scenario:** A malicious release of `gh` CLI executes unauthorized Git operations through the platform's credentials. Or a `wrangler` release deploys unauthorized Workers. The platform has no integrity verification on CLI binaries.

**Mitigation:**
- Pin CLI versions in deployment configuration
- Add checksum verification before CLI execution
- Run CLI executors in restricted mode (limited PATH, no network access beyond required endpoints)
- Document CLI supply chain in security appendix

### R-IN9: Agent Autonomy Escalation

| Aspect | Detail |
|--------|--------|
| **Likelihood** | Medium — "autonomy is a granted privilege" model can erode |
| **Impact** | High — agents executing outside intended scope |
| **Score** | **12/25** |

**Failure scenario:** As agents demonstrate reliable operation, the team gradually increases autonomy settings. A "well-behaved" agent receives autonomy for `deploy.pages` — then a prompt injection causes it to deploy a malicious site. The agent was trusted because it had been reliable, not because the trust model prevented misuse.

**Mitigation:**
1. Enforce the "autonomy is a granted privilege" model formally — every autonomy escalation requires a governance review
2. Maintain the default-disabled agent policy
3. Annual governance freeze review (per ADR-011 maintenance schedule)
4. Document the agent autonomy lifecycle in the Capability Registry

**Falsifiable prediction:** Autonomous agents (autonomy=true) will increase over time as operators become comfortable. The governance review gate must be documented, not aspirational. If no autonomous agent is reviewed in 12 months, autonomy escalation is still a governance process gap.

### R-IN10: PSER/Governance Schema Drift

| Aspect | Detail |
|--------|--------|
| **Likelihood** | High — governance documents always drift |
| **Impact** | Low — operational, not safety-critical |
| **Score** | **6/25** |

**Failure scenario:** The WEF v2 governance documents (7 deliverables) are not updated as the architecture evolves. After 12 months, the documented architecture and the actual code diverge. New engineers learn from outdated documentation.

**Mitigation:**
1. Automated gate: CI fails if governance document update is not included in any PR that changes core architecture
2. Quarterly architecture review (per Capability Registry maintenance schedule)
3. PSER schema validation (automated check that PSER fields match governance document headers)

---

## 5-Year Timeline of Expected Failures

```
Year 1:
├── Month 1-3: [R-EX3] CI pipeline blocked (high likelihood — fix immediately)
├── Month 3-6: [R-IN6] Audit table exceeds 100K rows (add index)
└── Month 9-12: [R-IN1] Tool provider domains start growing

Year 2:
├── [R-IN2] human-token deployment risk (highest before C2 implementation)
├── [R-IN7] D1 outage (first incident — test DR runbook)
└── [R-IN9] Agent autonomy escalation pressure

Year 3:
├── [R-EX2] D1 product evolution pressure (Cloudflare product cycle)
└── [R-IN10] Governance documentation drift (quarterly audit)

Year 4:
└── [R-EX1] Single-provider coupling pressure (multi-product expansion)

Year 5:
└── [R-IN8] CLI supply chain concern (if not mitigated before)
```

---

## Non-Mitigatable Risks (Accept as Inherent)

| Risk | Why non-mitigatable | Acceptance criteria |
|------|--------------------|--------------------|
| LLM hallucination in agent output | The platform executes capabilities — it cannot validate agent outputs for semantic correctness | Accept: capability outputs are not verified for semantic accuracy. Structural validation only (JSON schema, state machine, approval refs). |
| Prompt injection in agent inputs | Agents accept natural language. Any agent is subject to prompt injection. | Accept: guard against execution-level injection (the capability invocation is parameterized, not free-form). Document prompt injection boundary. |
| Cloudflare Workers runtime deprecation | The platform runs on Workers. If Workers is deprecated, the platform must migrate. | Accept: document migration window (6 months), estimate cost ($10K-50K for migration). |
| D1 data loss (beyond RPO window) | D1 is a managed service. Data loss is possible but unlikely. | Accept: RPO is 5 minutes (D1 sync replication). If that's insufficient, add R2 daily backups. |

---

## Risk Management Recommendations (Priority Order)

| Priority | Action | Risk addressed | Deadline |
|----------|--------|---------------|----------|
| **P0** | Fix CI pipeline (wrangler-action v3, D1 token, D1 permissions) | R-EX3 | **Before C1 deployment** |
| **P0** | Add CI guard: `human-token` blocked in production | R-IN2 | **Before C1 deployment** |
| **P0** | Add feature flags (`ENABLE_*`) for all phase components | R-IN4 | **Before C1 deployment** |
| **P1** | Produce DR runbook for D1 outage | R-IN7 | **Before C5 production** |
| **P1** | Instrument tool provider domains with audit events | R-IN1 | **Within Phase C2** |
| **P1** | Add D1 index on `audit_events(workflow_id, timestamp)` | R-IN6 | **Before 100K audit events** |
| **P1** | Implement orchestrator context bounds | R-IN3 | **Within Phase C1** |
| **P2** | Document Cloudflare exit strategy in Architecture Freeze | R-EX1 | **Before Phase 4** |
| **P2** | Add D1 abstraction layer (D1Adapter) | R-EX2 | **Before multi-product** |
| **P2** | Pin CLI versions + checksum verification | R-IN8 | **Before Phase C3** |
| **P3** | PSER governance schema automated sync | R-IN10 | **Quarterly audit** |
| **P3** | Agent autonomy governance review process | R-IN9 | **Year 2** |

---

## Conclusion

WEF v2 architecture has strong defenses against most long-term risks. The three highest-scoring risks (CI pipeline blocked, human-token production exposure, single-provider coupling) are all **controllable** — mitigation strategies exist and are actionable. None require architectural changes.

The single external risk that requires vigilance is **D1 product evolution (R-EX2)** — it has no perfect mitigation because it depends on Cloudflare's product direction. A lightweight D1 abstraction layer would turn this from "high impact" to "low impact" at the cost of ~200 lines of adapter code.

*Base commit: `864f213`*