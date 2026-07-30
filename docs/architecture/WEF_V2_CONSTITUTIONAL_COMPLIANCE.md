# WEF v2 Constitutional Compliance

> **Constitutional Architecture Review Board — Compliance Verification**
> Review date: 2026-07-29
> Documents referenced: WEF v2 Evolution Blueprint, ADR-009 (AI Agent Architecture), ADR-011 (AI Platform Governance Core), ADR-017 (Enterprise Operating Model), Platform Engineering Standards

---

## Constitutional Principles Compliance Matrix

| # | Principle | Status | Score | Finding |
|---|-----------|--------|-------|---------|
| 1 | Deterministic Before AI | ✅ Compliant | 10/10 | All gates, guards, and orchestration are rule-based. No LLM calls in the execution path. |
| 2 | Human Approval First | ⚠️ Partial | 6/10 | Architecture design is correct (all production requires approval). But "human-token" stub bypasses all approval. See findings. |
| 3 | Fail-Closed Everywhere | ✅ Compliant | 10/10 | Every documented gate defaults to `{ ok: false }`. Unknown capabilities, unwired executors, missing credentials all fail closed. |
| 4 | Provider-Neutral Core | ✅ Compliant | 10/10 | Zero vendor SDKs in core. Capability IDs contain no vendor names. All providers are deploy-time wired. REFUSED #12 enforces permanently. |
| 5 | Observable by Default | ✅ Compliant | 8/10 | Activation/approval/execution events are auditable. Missing: 5 tool provider domains are not instrumented. |
| 6 | Single Execution Boundary | ⚠️ Partial | 7/10 | The Gateway is the single boundary for registered capabilities. But 5 ungoverned tool domains execute outside it. See findings. |
| 7 | Modular by Composition | ✅ Compliant | 9/10 | Bounded context seams preserved. Code extensions, not modifications. All new code in new files. |
| 8 | Incremental Context | ✅ Compliant | 7/10 | Cognitive tools add structured context. But orchestrator context loading strategy is undefined. |
| 9 | Repository Agnostic | ✅ Compliant | 9/10 | No repository-specific conventions in the execution path. Capability IDs are repo-agnostic. |
| 10 | Human-in-the-Loop | ⚠️ Partial | 6/10 | "human-token" stub means this principle is not currently enforced. |
| 11 | Governance Before Implementation | ✅ Compliant | 10/10 | All 7 WEF v2 deliverables precede implementation. 13 REFUSED features document deliberate decisions. |

**Overall Compliance Score: 8.4/10**

2 principles fully satisfied, 9 partially satisfied, 0 non-compliant.

---

## Detailed Compliance Verification

### 1. Deterministic Before AI — ✅ Compliant (10/10)

**Principle:** All gates and guards must be deterministic rule-based logic before LLM inference is introduced.

**Verification:**
- **Guard evaluation:** StackBGatewayGuard evaluates `ToolApprovalKind` and `approval_scope` deterministically. No LLM call.
- **Capability routing:** Lookup table based on capability ID → executor mapping. No LLM call.
- **Approval state machine:** DurableApproval lifecycle (request → grant → expire → revoke) is a deterministic state machine. No LLM call.
- **Orchestrator task scheduling:** FIFO/priority queue in Phase C1 scope. No LLM call.
- **CLI executor dispatch:** Subprocess invocation with well-defined command format. No LLM call.

**Edge cases verified:**
- Unknown capability: `{ ok: false }` — no LLM attempt to interpret
- Unknown executor: `{ ok: false, error: "not wired" }` — no LLM fallback
- Unknown action: `human` (fail to safe) — no LLM attempt to classify

**Falsifiable claim:** Every execution path in WEF v2 can be traced without crossing an LLM inference boundary. This can be verified by adding a single `console.trace()` at the gateway entry point — every path resolves without model inference.

### 2. Human Approval First — ⚠️ Partial Compliance (6/10)

**Principle:** Every production execution requires explicit human approval before proceeding.

**Verification:**
- **Approval model:** DurableApproval with lifecycle, scope verification, expiration — **design is correct**.
- **Current implementation:** "human-token" stub — **violates the principle**.
- **Capabilities without approval:** Tool provider domains (5 domains) execute without approval.

**Gap analysis:**

| Execution path | Approval enforced? | Detail |
|----------------|-------------------|--------|
| Gateway → registered capability (production) | ⚠️ No | Stub approves everything |
| Gateway → registered capability (non-prod) | ✅ Correct | Stub not required |
| Tool provider domains | ❌ No | Unregistered — no gateway |
| CLI executor (gh/wrangler) | ❌ No | Subprocess, no approval check |
| Notification adapter | ✅ Correct | No approval needed (passive) |
| Cognitive tools | ✅ Correct | Read-only data |

**Falsifiable claim:** Any deployment running with the "human-token" stub violates ADR-009 §4.2 (Human Approval Requirement). Proof: Deploy with stub → execute any capability → observe that approval succeeds without human interaction.

**Recommendation:** The stub is acceptable for development (C1), but the production activation (C5) MUST require real approval. Add a CI guard: `if (env === "production" && approval === "human-token") → CI_FAIL`.

### 3. Fail-Closed Everywhere — ✅ Compliant (10/10)

**Principle:** All gates default to deny. Unknown = denied.

**Verification — every documented gate:**

| Gate | Condition | Result | Fail-closed? |
|------|-----------|--------|-------------|
| Gateway | Unknown capability | `{ ok: false }` | ✅ |
| Gateway | Capability without wired executor | `{ ok: false }` | ✅ |
| Gateway | Production without ApprovalRef | Denied | ✅ |
| Executor | Missing credential | Provider skipped (NOT_INSTALLED) | ✅ |
| Guard | Unknown action | `human` (fail to safe) | ✅ |
| Routing | Unknown provider | No match → error | ✅ |
| Approval | No approver available | Denied | ✅ (REFUSED #7) |
| CLI executor | Tool not available | `it.skipIf(!hasCLI)` → skip test | ✅ |
| Migration | Token insufficient | Permission denied | ✅ |

**Edge case verified:** Is there any path where an unknown value results in "allow"? No. Every default is deny.

**Falsifiable claim:** Introduce a non-existent capability ID to any WEF v2 function → returns `{ ok: false }` with no side effects. This is the strongest compliance score in this review.

### 4. Provider-Neutral Core — ✅ Compliant (10/10)

**Principle:** Core architecture must not depend on any specific provider. Vendors are deploy-time wired.

**Verification:**
- **Capability IDs:** `deploy.pages`, `code.vcs.repo`, `dev.code.explain` — no vendor names
- **Core imports:** No vendor SDKs in `hermes/services/` or `hermes/core/`
- **Provider wiring:** `setCloudflareExecutor()`, `setGitHubExecutor()`, `setClaudeCodeExecutor()` — deploy-time
- **REFUSED #12:** "No Vendor SDK in Core" flagged as permanent invariant

**False positive check:** Is the Claude Code provider (`dev.claude-code.*`) a vendor dependency? Yes — but it's at the provider layer, not the core layer. The capability IDs are vendor-agnostic (`dev.code.*`). The provider implementation (`claude-code-backend.ts`) is deploy-time wired. Correct.

**Falsifiable claim:** Rename the `claude-code-backend.ts` to `copilot-backend.ts` — no core files change. Add a new provider `anthropic.computer-use` — register routing entry. No core changes.

### 5. Observable by Default — ⚠️ Partial Compliance (8/10)

**Principle:** All system operations must produce observable audit events.

**Verification:**
| Operation | Audit event? | Detail |
|-----------|-------------|--------|
| Capability execution | ✅ | `agent_audit_events` D1 table |
| Approval lifecycle | ✅ | Proposed `DurableApproval` records |
| Guard evaluation | ✅ | Event emitted per guard stage |
| Gateway entry | ✅ | Event emitted per request |
| Tool provider invocation | ❌ | 5 domains unregistered |
| CLI executor result | ⚠️ | Partially — stdout captured but not persisted |
| Failure (any gate) | ✅ | Event emitted per failure |
| Cognitive tool access | ⚠️ | Read-only — no audit trail for queries |

**Gap:** The 5 ungoverned tool provider domains have zero observability. A compromised tool running `gh repo clone` leaves no audit trail.

**Falsifiable claim:** Run a capability through a tool provider domain → no record exists in `agent_audit_events` or any other observability sink. This can be verified by inspecting the D1 table after execution.

**Recommendation:** Before C5, instrument the tool provider call site to emit events to the same `agent_audit_events` table. This is a read-only audit addition that requires no architectural change.

### 6. Single Execution Boundary — ⚠️ Partial Compliance (7/10)

**Principle:** All execution must pass through a single, uniform, auditable entry point.

**Verification:**

| Execution path | Passes Gateway? | 
|----------------|-----------------|
| App capability (website.deploy) | ✅ Yes |
| Provider capability (deploy.pages) | ✅ Yes |
| CLI executor (gh, wrangler) | ✅ Yes (through executor) |
| Tool provider domain (dev tools) | ❌ No — bypasses Gateway |
| Orchestrator internal operations | ✅ Yes (through Gateway) |

**Finding:** The Single Execution Boundary is true for "registered capabilities" but false for "all execution paths." The tool provider domains constitute a parallel execution path.

**Falsifiable claim:** Count the entry points to capability execution. If tool provider domains enter via a separate code path (not through the Gateway), the Single Execution Boundary principle is violated. This is a factual claim that can be verified by code inspection.

**Recommendation:** This does not require tool migration to the Gateway. At minimum, document the tool provider domains as a separate execution path with their own planned migration schedule. Honest documentation is better than claiming "single boundary" with a footnote.

### 7. Modular by Composition — ✅ Compliant (9/10)

**Principle:** Capabilities compose, they don't inherit. All new code is additive.

**Verification:**
- New capabilities register in the capability registry (additive)
- New executors wire at deploy time (additive)
- New D1 migrations create new tables (additive, except migration 0008)
- New cognitive tools create new endpoints (additive)
- New notification adapters route through existing bot webhooks (additive)

**Penalty:** -1 for the Orchestration Fabric/Activation Platform overlap. The two systems have overlapping responsibilities that aren't cleanly separated. Documentation should clarify that orchestration wraps activation.

### 8. Incremental Context — ⚠️ Partial Compliance (7/10)

**Principle:** Context is loaded incrementally — only what's needed for the current step.

**Verification:**
- **Cognitive tools:** Load structured error with execution trace. Appropriate — operator needs full context for failure diagnosis.
- **Status Dashboard:** Loads summary view. Correct — incremental (summary first, detail on drill-down).
- **Timeline View:** Loads full execution trace. Concern — full trace for a complex workflow could be 5-10KB per request.
- **Orchestrator context:** Not defined. The orchestrator picks up a task from the lattice — what context is loaded?

**Gap:** The orchestrator's task context loading strategy is undocumented. This is the biggest Incremental Context risk — if the orchestrator loads the complete workflow history for every task, context grows unbounded.

**Falsifiable claim:** Implement the orchestrator with full task history loading → context size grows linearly with workflow depth. Implement with incremental loading (task description + last result only) → context stays constant. The difference is measurable.

**Recommendation:** Before C1 implementation, document the orchestrator context contract:
- On task pickup: `{ taskId, taskDescription, approvalRecord, lastResult }` — ~1KB
- Not loaded: full workflow history, audit trail, agent activity log — ~10-50KB
- Overflow: If operator requests full context, it's a D1 query (cognitive tool)

### 9. Repository Agnostic — ✅ Compliant (9/10)

**Principle:** Architecture must not depend on any specific repository structure.

**Verification:**
- Capability IDs are repository-agnostic (`deploy.pages` — what pages? Configuration specifies the repo)
- CI pipeline uses `wrangler-action` with environment variables, not hardcoded paths
- CLI executor commands are parameterized (repo name, environment, branch)
- D1 connections are binding-based, not file-path-based

**Penalty:** -1 for the `website.*` capabilities implicitly referencing `concierge-website`. While the capability IDs are generic (`website.deploy`), the routing configuration maps to `concierge-website` specifically. This is a configuration detail, not an architecture flaw, but it creates the impression of repository coupling.

**Recommendation:** Add a `REPO_CONCIERGE` env variable for the website routing. The architecture is repository-agnostic, but the configuration should make it explicit.

### 10. Human-in-the-Loop — ⚠️ Partial Compliance (6/10)

**Principle:** Humans remain in the decision loop for safety-critical operations.

**Verification:**
- **Production deployments:** Require approval (design) / bypassed by stub (current)
- **Non-production deployments:** No approval required (correct — engineer can debug freely)
- **PHI-related operations:** No special handling (consent engine exists in WEF v1 but not connected to WEF v2 approval)
- **D1 schema migrations:** No human gate (migration is automated. If a migration corrupts data, there's no pre-flight review)
- **CLI executor operations:** No human gate (CLI executors run as subprocesses without operator supervision)
- **Security-critical operations:** No human gate (tool provider domains are unregistered)

**Gap:** The "human-token" stub is not the only HITL gap. The following operations bypass human review entirely:
- D1 schema migrations
- CLI executor invocations
- Tool provider domain operations
- Cognitive tool endpoint access (read-only — acceptable, but still an audit gap)

**Recommendation:** Add a CI gate that requires human approval for:
- Any D1 schema migration (manual review of the SQL before execution)
- Any production-relevant CLI invocation (`wrangler pages deploy` without `--dry-run`)

### 11. Governance Before Implementation — ✅ Compliant (10/10)

**Principle:** All governance decisions must precede implementation. No production code without prior governance approval.

**Verification:**
- 7 WEF v2 deliverables produced before any implementation (Phase C1-C5)
- 13 REFUSED features documented as deliberate decisions
- Capability Maturity Model enforced: C1 = Architecture → Prototype → Development → Production Ready
- Engineering Standards compliance required at Production Ready gate
- ADR-009, ADR-011, ADR-017 precedent governance documents

**This is the strongest aspect of the WEF v2 architecture.** The governance-before-implementation discipline is exceptional.

**Falsifiable claim:** No production code exists for any of the 6 WEF v2 phases that was written before the governance framework was approved. Proof: All code is forward-dated from the governance documents' acceptance dates.

---

## Enterprise Operating Model Compliance

| ADR-017 Requirement | WEF v2 Status | Compliance |
|--------------------|---------------|------------|
| Business Unit layer in PSER | Not updated (Phase 2 documents pre-date ADR-017) | 🔲 Pending |
| Portfolio field in PSER | Not updated | 🔲 Pending |
| Wave field in PSER | Implicit (document titles reference "Phase 2") | ⚠️ Partial |
| Story/Task in PSER | Not implemented | 🔲 Pending |
| WEF v1.1 framework reference | ✅ Blueprint references WEF v1.1 | ✅ Compliant |
| Enterprise hierarchy in governance headers | ✅ All WEF v2 docs use enterprise governance headers | ✅ Compliant |
| Engineering Standards compliance | ✅ Production Ready gate requires full compliance | ✅ Compliant |
| Maturity Model enforcement | ✅ Gates enforced per wave | ✅ Compliant |

**Action items:**
1. Update PSER to include Business Unit (Engineering), Portfolio (Clinical), and Wave fields
2. The WEF v2 documents correctly use the enterprise governance headers but PSER schema hasn't been updated

---

## Engineering Standards Compliance

| Standard Category | WEF v2 Compliance | Notes |
|-------------------|-------------------|-------|
| Authentication | ✅ Compliant | Identity Core integration |
| Authorization | ✅ Compliant | Approval model + Gateway guard |
| Encryption | ✅ Compliant | D1 encryption at rest |
| Secrets | ⚠️ Partial | CLI executors expose credential subprocess risk |
| Audit | ⚠️ Partial | 5 tool provider domains not audited |
| Logging | ✅ Compliant | Event-based logging throughout |
| Observability | ⚠️ Partial | Tool domains + cognitive tools need instrumentation |
| Error Handling | ✅ Compliant | Structured errors with guard stage |
| API Contracts | ✅ Compliant | New endpoints additive, existing unchanged |
| Versioning | ✅ Compliant | Maturity versioning, capability lifecycle |
| Dependency Management | ✅ Compliant | Provider abstraction |
| Naming | ✅ Compliant | Uniform capability ID convention |
| Configuration | ✅ Compliant | Environment variables + deploy-time wiring |
| Feature Flags | ❌ Non-compliant | No flags — all-or-nothing deployment |
| Documentation | ✅ Compliant | 7 WEF v2 deliverables |
| Testing | ✅ Compliant | ~60-80 new tests across all phases |
| Deployment | ⚠️ Partial | CI pipeline broken; no staging; no canary |

**Critical gap:** Engineering Standard #14 (Feature Flags) is not met. Every WEF v2 phase is all-or-nothing per commit. This is a specific Engineering Standards non-compliance that must be addressed before implementation.

---

## Summary

| Principle | Score | Critical Action Required |
|-----------|-------|--------------------------|
| Deterministic Before AI | 10/10 | ✅ None |
| Human Approval First | 6/10 | ❌ Replace human-token stub before C5 |
| Fail-Closed Everywhere | 10/10 | ✅ None |
| Provider-Neutral Core | 10/10 | ✅ None |
| Observable by Default | 8/10 | ⚪ Instrument tool provider domains |
| Single Execution Boundary | 7/10 | ⚪ Document tool path as separate execution domain |
| Modular by Composition | 9/10 | ⚪ Clarify Orchestration Fabric/Activation Platform relationship |
| Incremental Context | 7/10 | ⚪ Define orchestrator context contract |
| Repository Agnostic | 9/10 | ⚪ Parameterize repo references in configuration |
| Human-in-the-Loop | 6/10 | ❌ Replace human-token stub; add migration approval gate |
| Governance Before Implementation | 10/10 | ✅ None |

**❌ Must fix before C5:** Replace "human-token" stub with real DurableApproval. Add feature flags. Instrument tool provider domains.

**⚪ Should fix within C1-C4:** Document orchestrator context contract. Clarify orchestration/activation relationship. Add migration approval gate.

**✅ No action needed:** Determinism, fail-closed, provider-neutral, modular composition, governance-first.

---

*This compliance report verifies the WEF v2 architecture against 11 constitutional principles, ADR-017 enterprise operating model, and Engineering Standards. Compliance scores are based on the current architecture state — not the code implementation. Scores may change during implementation if design deviations are introduced.*

*Base commit: `864f213`*