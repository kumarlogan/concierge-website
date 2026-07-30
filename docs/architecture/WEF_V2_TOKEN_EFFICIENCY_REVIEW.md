# WEF v2 Token Efficiency Review

> **Constitutional Architecture Review Board — Context/Prompt/Token Analysis**
> Review date: 2026-07-29
> Focus: Token profile of WEF v2 execution paths, with falsifiable projections for the 10-product, 100-agent, 1,000-workload/day target

---

## Executive Summary

WEF v2 maintains excellent token efficiency across most execution paths. The core orchestration layer uses zero LLM tokens — all routing, approval, and guard decisions are deterministic. Token consumption is concentrated in **agent-capability interactions** (which are inherent to LLM-powered execution) and a well-scoped **cognitive efficiency layer** (4 read-only tools using deterministic D1 queries).

**Token Profile (1,000 workflows/day):**

| Component | Tokens/day | % of total | Notes |
|-----------|-----------|-----------|-------|
| Core orchestration (deterministic) | **0** | 0% | No LLM calls in routing, approval, guards |
| Capability execution | ~2M-5M | ~85% | LLM agents consuming capabilities |
| Cognitive efficiency tools | ~100K-300K | ~5% | Deterministic D1 queries, minimal prompts |
| Approval lifecycle | **0** | 0% | Human-driven, no LLM in approval path |
| Audit events | **0** | 0% | Deterministic write, no LLM |
| CLI executor output | ~500K-1M | ~10% | stdout/stderr returned to caller |

**Total daily tokens (est.):** ~2.6M-6.3M tokens/day | ~$5-13/day at current OpenRouter pricing

---

## Token Flow Diagram (Single Execution)

```
Agent (LLM) ──prompt──→ App Capability ──routing──→ Gateway ──→ Guard ──→ Executor ──→ Backend
                              │                         │         │           │
                              │                         │         │           └── CLI stdout/stderr → tokens
                              │                         │         │               (if CLI executor, ~500-1K tokens)
                              │                         │         │
                              │                         │         └── Guard decision: 0 tokens (deterministic)
                              │                         │
                              │                         └── Gateway check: 0 tokens (deterministic)
                              │
                              └── Cognitive tool: 0 tokens (deterministic D1 query)
```

**Key insight:** The only token-generating point in the execution path is the Agent's prompt to the App Capability and the capability's response. Every other hop is deterministic.

---

## Token Analysis by Component

### 1. Core Orchestration — 0 tokens (deterministic)

**Token cost: 0% of total**

Components: Task scheduler, gateway guard, approval evaluation, capability routing, error handling.

**Verification:**
- Gateway: `GuardStage.is_production ? checkApproval() : pass` — deterministic conditional
- Guard: `ToolApprovalKind === 'unattended' ? deny : allow` — deterministic lookup
- Approval: `DurableApproval.status === 'granted' && expiry > now ? allow : deny` — deterministic logic
- Routing: `capabilityRegistry[capabilityId]` — deterministic hash lookup

**Falsifiable claim:** No WEF v2 orchestration function makes an HTTP request to an LLM API. Every decision is resolvable from in-memory state (cached D1 data, runtime configuration, deterministic logic). If a new engineer inserts `await model.complete("should I allow this?")` into the Gateway, token consumption would immediately spike — which is exactly the guardrail this analysis provides.

### 2. Capability Execution — ~85% of tokens (inherent)

**Token cost: 2M-5M tokens/day at 1,000 workflows**

This is the agent-to-capability interaction. Each agent sends a natural language request to the capability, and the capability returns a result.

**Token budget per workflow (~10 capabilities/workflow):**

| Step | Input tokens | Output tokens | Total |
|------|-------------|--------------|-------|
| Agent sends capability request | ~500 | ~200 | ~700 |
| Capability processes request | ~1,000 | ~500 | ~1,500 |
| Agent interprets result | ~500 | ~300 | ~800 |
| **Per capability interaction** | | | **~3,000 tokens** |
| **Per workflow (10 capabilities)** | | | **~30,000 tokens** |

**Daily: 1,000 workflows × ~30K tokens = ~30M tokens/day.** However, this is the model cost of executing capabilities — not an architecture overhead. The same cost exists regardless of architecture. WEF v2 neither adds nor saves tokens at this layer.

**Optimization opportunity (Phase 3+):** Reduce agent-to-capability token consumption through:
- Structured capability interfaces (typed inputs/outputs)
- Few-shot examples reused across calls (cached prompts)
- Result caching for idempotent capabilities

### 3. Cognitive Efficiency Tools — ~5% of tokens

**Token cost: 100K-300K tokens/day at 1,000 workflows**

Four tools, all read-only D1 queries with deterministic output formatting. Token cost comes from the LLM reading the tool output (not the query itself).

**Tool #1: Status Dashboard**
- Query: `SELECT * FROM agent_audit_events WHERE time_window = ? LIMIT 50`
- Output: ~2KB of structured JSON → ~500 tokens when read by LLM
- Usage: Operator reviews every ~5th workflow → 200 queries/day
- **Daily tokens: 200 × 500 = 100K tokens**

**Tool #2: Timeline View**
- Query: `SELECT * FROM agent_audit_events WHERE workflow_id = ? ORDER BY timestamp`
- Output: ~5KB for a complete workflow trace → ~1,250 tokens
- Usage: Operator investigates ~10% of workflows → 100 queries/day
- **Daily tokens: 100 × 1,250 = 125K tokens**

**Tool #3: Decision Log**
- Query: `SELECT * FROM durable_approval ORDER BY timestamp DESC LIMIT 50`
- Output: ~2KB → ~500 tokens
- Usage: Operator reviews approvals every ~10th workflow → 100 queries/day
- **Daily tokens: 100 × 500 = 50K tokens**

**Tool #4: Blocker Registry**
- Query: `SELECT * FROM blockers WHERE active = true`
- Output: ~500 bytes → ~125 tokens
- Usage: Checked on every operator session → ~50 sessions/day
- **Daily tokens: 50 × 125 = 6.25K tokens**

**Total cognitive tools daily:** ~281K tokens → ~$0.56/day

**Recommendation:** The cognitive tools' token cost is minimal. No optimization needed at current scale. At 10× scale (10K workflows/day), the Timeline View would dominate (~1.25M tokens/day). Preemptive mitigation: Add query pagination before reaching 10K workflows/day.

### 4. Approval Lifecycle — 0 tokens (human-driven)

**Token cost: 0% of total**

Approvals are human decisions, not LLM decisions. An operator receives a notification ("Approve execution of `deploy.pages`?") and responds yes/no/deny. The entire lifecycle (request → grant → expire → revoke) is deterministic state management.

**Edge case:** If the approval notification includes an LLM-generated summary of the operation being approved, that would add ~200-500 tokens per approval. The blueprint doesn't specify this, but it's a potential future optimization. **Do not add LLM summaries to approval notifications** — the approval should be based on the capability name + scope, not an LLM summary that could hallucinate.

**Falsifiable claim:** Every approval action in WEF v2 produces zero LLM tokens. The operator's approval/deny response is processed as a deterministic state transition.

### 5. CLI Executor Output — ~10% of tokens

**Token cost: 500K-1M tokens/day at 1,000 workflows**

CLI executors (gh, wrangler, claude-code) produce stdout/stderr that passes through to the caller. This is the token cost of tool execution — not an architecture overhead.

**Token budget per CLI invocation:**

| CLI | Typical output | Tokens |
|-----|---------------|--------|
| `gh` | ~200-500 bytes (JSON or text) | ~50-125 |
| `wrangler` | ~500-2000 bytes (deploy output) | ~125-500 |
| `claude-code` | ~1000-5000 bytes (code diff) | ~250-1,250 |

**Optimization opportunity:** For `gh` and `wrangler`, use `--format json --quiet` flags to minimize output. This could reduce CLI executor tokens by 50-70%. For `claude-code`, the output is inherently verbose (code diffs). No optimization possible without losing functionality.

**Recommendation:** Add a "compressed output" flag to CLI executors (C3 scope) that strips trailing whitespace, removes ANSI codes, and truncates long values. This reduces token consumption without losing structural information.

### 6. Orchestrator Context — NEW token cost (Phase C1)

**Token cost estimate: 50K-100K tokens/day (at 1K workflows)**

The orchestrator picks up tasks from the lattice with context. **This is the new token cost center that doesn't exist in WEF v1.**

| Context element | Size | 1K tasks/day |
|----------------|------|-------------|
| Task description | ~200 tokens | 200K tokens |
| Approval record | ~100 tokens | 100K tokens |
| Last execution result | ~500 tokens | 500K tokens |
| Full workflow history (worst case) | ~5,000 tokens | 5M tokens **(dangerous)** |

**Risk:** If the orchestrator loads full workflow history (instead of incremental context), the token cost balloons from 800K to 5M+ tokens/day — a 6× increase.

**Recommendation:** Strictly enforce incremental context at the orchestrator:
- **Must load:** Task ID, task description, approval record, last result (~800 tokens)
- **Must NOT load:** Full workflow history, full audit trail, previous agent outputs
- **On request:** Operator can query Timeline View for full context (separate D1 query)

**Falsifiable claim:** Before enforcing context bounds, orchestrator context averages ~2,500 tokens/task. After adding context bounds (task ID + description + last result only), it drops to ~800 tokens/task. Measure at the orchestrator's context loading call site.

---

## Token Profile Summary

| Component | Tokens/day (1K workflows) | % | Trend at 10× scale |
|-----------|--------------------------|---|-------------------|
| Core orchestration | 0 | 0% | Stays at 0 |
| Capability execution | ~30M | ~89% | 300M |
| Cognitive tools | ~281K | ~1% | 2.8M (linear) |
| CLI executor output | ~3M | ~9% | 30M (linear) |
| Orchestrator context (bounded) | ~800K | ~2% | 8M (linear with bounds) |
| **Total (bounded)** | **~34M** | **100%** | **~340M** |

**Total daily cost (OpenRouter):**
- 1K workflows: ~$68/day at ~$2/M tokens
- 10K workflows: ~$680/day (linear scaling)

**Total daily cost (local models):** $0 (but at slower throughput and higher host cost)

---

## Token Optimization Opportunities

| Opportunity | Tokens saved/day (1K workflows) | Effort | Recommended? |
|------------|-------------------------------|--------|-------------|
| CLI executor compressed output (-50%) | ~1.5M | Low (C3 scope) | ✅ Before C5 |
| Orchestrator context bounds | ~4.2M | Low (C1 scope) | ✅ Critical before C1 deployment |
| Capability result caching (idempotent ops) | ~10M | Medium (Phase 3) | ⚪ Phase 3+ |
| Structured capability interfaces | ~15M | High (Phase 3) | ⚪ Phase 3+ |
| Approval token optimization | N/A — already 0 | None | ✅ No action needed |
| Cognitive tool pagination | ~1M at 10K scale | Low | ✅ Before 10K workflows |
| `gh --format json --quiet` | ~1M | Low (C3 scope) | ✅ Before C5 |

---

## Token Ceilings

| Component | Ceiling | Failure Mode | Mitigation |
|-----------|---------|--------------|------------|
| Orchestrator context | 2,500 tokens/task (unbounded) → 800 tokens/task (bounded) | Operator session token window exhausted | Enforce incremental context bounds |
| CLI executor output | 5,000 tokens/invocation (claude-code) | Token window fragmentation | Truncate at 5,000 tokens |
| Cognitive tools | 1,250 tokens/query (Timeline View) | Dashboard pages become prohibitively expensive | Pagination at 50 events/page |
| Capability execution | 30K tokens/workflow | Token cost exceeds operator budget | Cost monitoring dashboard |

---

## Falsifiable Predictions

| # | Prediction | Verification | Timeframe |
|---|-----------|-------------|-----------|
| 1 | Orchestrator context bounded to <1,000 tokens/task after applying incremental context rules | Measure `context.length` at orchestrator context loading call | C1 deployment |
| 2 | Cognitive tools contribute <2% of total daily tokens at 1K workflows/day | Compare D1 read volume to LLM token consumption | Post-C4 deployment |
| 3 | CLI executors contribute ~9-10% of daily tokens | Measure total stdout bytes at executor exit | C3 deployment |
| 4 | Approval path adds exactly 0 tokens to any execution | Trace approval flow — no LLM call found in approval code | C2 deployment |
| 5 | Capability execution dominates token consumption at >85% (inherent — no optimization changes this) | Compare token consumption across all components | Steady state |

---

## Conclusion

WEF v2 adds minimal token overhead beyond what's inherent to agent-driven execution:

- **Zero tokens** for orchestration, approval, routing, guards, and audit
- **~1M tokens/day** (deterministic) for cognitive tools + CLI executor output
- **~30M tokens/day** (inherent) for agent-capability interactions — this cost exists in any architecture

The single token-efficiency risk is **unbounded orchestrator context** (C1 scope). With incremental context bounds applied, WEF v2 is token-efficient by design and adds negligible overhead to the base cost of running LLM agents.

*Base commit: `864f213`*