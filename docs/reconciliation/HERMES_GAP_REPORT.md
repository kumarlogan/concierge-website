# HERMES Gap Report

> **EPIC-008 — Gap Analysis**
> Identifies gaps between the designed architecture and the current runtime implementation. Covers agent gaps, capability gaps, wiring gaps, and implementation gaps. Every gap has a severity, impact, and recommended resolution.

---

## Gap Summary

| Severity | Count | Description |
|----------|-------|-------------|
| 🔴 **Critical** | 2 | Blocks autonomous operation |
| 🟡 **Major** | 4 | Requires implementation before Mode B/C |
| 🟢 **Minor** | 6 | Nice-to-have; does not block operation |

---

## 🔴 Critical Gaps

### Gap 1: EPCL–WAS–WEF Pipeline Not Wired End-to-End

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-001 |
| **Severity** | 🔴 Critical |
| **Layer** | Executive (1) → Activation (3) → Execution (4) |
| **Affected Components** | `ExecutivePlanningWorkflow`, `WorkforceActivationService`, `WEFOperationalIntelligence` |
| **Description** | The three core services (EPCL, WAS, WEF) are implemented as independent modules but are not wired together in a single execution pipeline. The `ExecutivePlanningWorkflow` creates plans, but the plan is not passed to WAS for activation. WAS has delegation logic, but WEF is not wired as the execution target. The pipeline exists in code but not in runtime. |
| **Evidence** | `executive-workflow.ts` creates plans → WAS `workforce-activation-service.ts` has activation logic → WEF `wef-operational-intelligence.ts` has health checks. No code path connects them. |
| **Impact** | Autonomous operation is impossible. All execution currently requires manual dispatch. |
| **Resolution** | Wire WAS `consumePlan()` into the EPCL ExecutiveWorkflow after APPROVAL_CHECK stage. Wire WEF as the delegation target in WAS. Create a single entry point: `ExecutivePlanningWorkflow.run()` → WAS → WEF. |

### Gap 2: Autonomous Feature Flags All Disabled

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-002 |
| **Severity** | 🔴 Critical |
| **Layer** | Governance (10) |
| **Affected Components** | `feature-flags.ts`, `WASFeatureFlag` |
| **Description** | All core autonomous execution feature flags default to `false`. The `ENABLE_EXECUTIVE_WORKFLOW`, `ENABLE_AUTONOMOUS_EXECUTION`, `ENABLE_BATCH_GENERATION`, and `ENABLE_EXECUTIVE_REPORTING` flags must be explicitly enabled. No code changes are needed — but the flags are currently OFF. |
| **Evidence** | `feature-flags.ts`: `DEFAULT_FLAG_STATE` maps all flags to `false`. `DEFAULT_WAS_FLAG_STATE` maps all WAS flags to `false`. |
| **Impact** | No autonomous execution possible until flags are enabled. |
| **Resolution** | Enable flags in the target environment's config.yaml (`hermes config set ...`). Test in staging first. |

---

## 🟡 Major Gaps

### Gap 3: Unregistered Capabilities

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-003 |
| **Severity** | 🟡 Major |
| **Layer** | Planning (2) — CapabilitySelector |
| **Affected Components** | `capability-selector.ts` / `registerBuiltIn()` |
| **Description** | The `CapabilitySelector.registerBuiltIn()` only registers 12 capabilities. However, the `DISCIPLINE_CAPABILITY_MAP` in `discipline-selector.ts` references 21 capabilities. The following 9 capabilities are used in discipline mapping but NOT registered in the built-in capability registry: |
| **Missing Capabilities** | |
| | `research.synthesize` — used by `research_intelligence` |
| | `research.investigate` — used by `research_intelligence` |
| | `architecture.review` — used by `architecture_strategy` |
| | `experience.review` — used by `experience_design` |
| | `experience.prototype` — used by `experience_design` |
| | `test.verify` — used by `engineering_quality` |
| | `business.plan` — used by `business_growth` |
| | `business.report` — used by `business_growth` |
| | `platform.observe` — used by `platform_intelligence` |
| **Impact** | These 9 capabilities resolve as `NEW_WORK` (unknown) when selected by the capability selector. They will incorrectly require approval and have unknown providers. |
| **Resolution** | Add the 9 missing capabilities to the `registerBuiltIn()` method in `capability-selector.ts`. Each should have proper provider, cost, keywords, and discipline assignments. |

### Gap 4: Knowledge Capture Not Wired to WAS Lifecycle

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-004 |
| **Severity** | 🟡 Major |
| **Layer** | Knowledge (6) → Activation (3) |
| **Affected Components** | `KnowledgeCaptureTrigger`, `KnowledgeCapturer`, `WAS` |
| **Description** | The `KnowledgeCaptureTrigger` exists in WAS types but is not called from the WAS activation lifecycle. The `KnowledgeCapturer` exists in EPCL but is only called during Stage 11 (KNOWLEDGE_CAPTURE) of the ExecutiveWorkflow. Knowledge must be captured from every execution cycle, but the trigger is not wired to batch completion events. |
| **Evidence** | `was/types.ts` defines `KnowledgeCaptureTrigger` as a service but `workforce-activation-service.ts` does not call it. |
| **Impact** | Knowledge is not automatically captured. Skills and memory are only updated when explicitly requested. |
| **Resolution** | Wire `KnowledgeCaptureTrigger.onBatchComplete()` into the WAS activation lifecycle, called after each batch verification passes. Wire `KnowledgeCapturer.capture()` into the EPCL workflow's Stage 11. |

### Gap 5: Executive Reporting Not Wired to Activation Completion

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-005 |
| **Severity** | 🟡 Major |
| **Layer** | Observability (9) → Executive (1) |
| **Affected Components** | `ExecutiveStatusUpdater`, `ExecutiveReporter`, `WAS` |
| **Description** | The `ExecutiveStatusUpdater` exists in WAS types but is not called from the activation lifecycle. The `ExecutiveReporter` exists in EPCL but is only called during Stage 12 (REPORTING) of the ExecutiveWorkflow. Automatic executive reports are not generated or delivered. |
| **Evidence** | `was/types.ts` defines `ExecutiveStatusUpdater` but `workforce-activation-service.ts` does not call it. |
| **Impact** | No automatic report delivery. Product Owner must manually request status. |
| **Resolution** | Wire `ExecutiveStatusUpdater.generate()` into the WAS activation completion path. Wire `ExecutiveReporter.generate()` into the EPCL workflow's Stage 12. |

### Gap 6: Verification Not Called from WAS

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-006 |
| **Severity** | 🟡 Major |
| **Layer** | Activation (3) → Verification (5) |
| **Affected Components** | `VerificationRouter`, `WAS` |
| **Description** | The `VerificationRouter` exists in WAS types but is not called from the WAS activation lifecycle. Verification is mandatory (per the Platform Constitution) but is not wired into the execution pipeline. |
| **Evidence** | `was/types.ts` defines `VerificationRequest` and `VerificationResult` but `workforce-activation-service.ts` does not call `VerificationRouter.verify()`. |
| **Impact** | Execution outputs are not verified before acceptance. Unverified outputs could be accepted. |
| **Resolution** | Wire `VerificationRouter.verify()` into the WAS delegation pipeline, called after each WEF delegation returns. |

---

## 🟢 Minor Gaps

### Gap 7: Dormant Agents Not Managed

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-007 |
| **Severity** | 🟢 Minor |
| **Layer** | Operations (7) — Agent Registry |
| **Affected Components** | `hermes/agents/seed.ts` |
| **Description** | 12 agents are registered in the seed but all are dormant. The agent inventory document lists 8 agents, but the actual seed file has 12 (4 more were added: `developer-agent-claude-code`, `developer-agent-local`, `security-tooling-agent`, `monitoring-agent`). Three agents are duplicates of others. |
| **Impact** | Registry bloat. No execution impact since all are disabled. |
| **Resolution** | Consolidate duplicates: merge `developer-agent-local` → `developer-agent-claude-code`, merge `security-tooling-agent` → `security-agent`, absorb `monitoring-agent` into Observability Layer. |

### Gap 8: Missing AI_WORKFORCE.md Agents

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-008 |
| **Severity** | 🟢 Minor |
| **Layer** | Operations (7) — Agent Registry |
| **Affected Components** | `hermes/agents/seed.ts` (missing entries) |
| **Description** | 23+ agents are designed in `AI_WORKFORCE.md` but not seeded or implemented. These include: Marketing Agent, Content Agent, Analytics Agent, Sales Agent, CRM Agent, Clinical Agent, HR Agent, etc. None are needed for current operation. |
| **Impact** | No execution impact. These are future scope. |
| **Resolution** | Do NOT create these agents. Route their intended capabilities through the EPCL discipline system. Create new agents only when the discipline system cannot serve the requirement. |

### Gap 9: WAS Persistence Not Enabled

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-009 |
| **Severity** | 🟢 Minor |
| **Layer** | Activation (3) — WAS |
| **Affected Components** | `WASPersistence`, `WASConfig` |
| **Description** | WAS persistence to D1 is implemented but disabled by default. `enablePersistence: false`, `persistenceBackend: "memory"`. Activation state is not persisted across restarts. |
| **Impact** | Activation state is lost on process restart. WASRecovery cannot restore activations. |
| **Resolution** | Enable persistence when D1 is available: `hermes config set ...` or enable in config.yaml. |

### Gap 10: WEF Not Wired to WAS

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-010 |
| **Severity** | 🟢 Minor |
| **Layer** | Execution (4) |
| **Affected Components** | `WEFDelegator`, `WEF` |
| **Description** | WAS has a `WEFDelegator` type that creates `WEFDelegationRequest` objects, but WEF is not wired as the delegation target. The delegation function in `workforce-activation-service.ts` does not call WEF. |
| **Impact** | WAS cannot delegate to WEF. Batches cannot be executed through the pipeline. |
| **Resolution** | Wire `WEF.Delegator.dispatch()` into the WAS delegation path. |

### Gap 11: Discipline Gap Between Agent Inventory and EPCL

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-011 |
| **Severity** | 🟢 Minor |
| **Layer** | Cross-cutting |
| **Affected Components** | `hermes/agents/seed.ts` vs `workers/src/platform/epcl/discipline-selector.ts` |
| **Description** | The agent inventory uses a different discipline model (Engineering, Operations, Finance, Research, Support, Documentation, Security, Quality) than the EPCL discipline model (research_intelligence, architecture_strategy, experience_design, engineering_quality, business_growth, platform_intelligence). The EPCL model is the canonical runtime model; the agent inventory model is legacy. |
| **Impact** | Documentation mismatch. No runtime impact since agents are dormant. |
| **Resolution** | Document the mapping in the GAP report. The agent inventory discipline model is deprecated in favor of the EPCL model. Update the agent inventory document to reflect the EPCL discipline model. |

### Gap 12: No Documented Capability Lifecycle

| Field | Value |
|-------|-------|
| **Gap ID** | GAP-012 |
| **Severity** | 🟢 Minor |
| **Layer** | All |
| **Affected Components** | All capabilities |
| **Description** | Capabilities have no documented lifecycle (registration → deprecation → retirement). A capability is registered once in `registerBuiltIn()` and never removed. There is no capability versioning, deprecation path, or retirement policy. |
| **Impact** | Eventually, stale capabilities accumulate. No operational impact today. |
| **Resolution** | Define a capability lifecycle policy: Register → Active → Deprecated → Retired. Add deprecation metadata to `CapabilityEntry`. |

---

## Gap Resolution Priority

| Priority | Gap ID | Description | Effort | Impact | Recommended Action |
|----------|--------|-------------|--------|--------|-------------------|
| 1 | GAP-001 | Pipeline not wired | 2-3 days | Blocks autonomous mode | Wire EPCL → WAS → WEF |
| 2 | GAP-002 | Feature flags disabled | 5 minutes | Blocks autonomous mode | Enable flags in config |
| 3 | GAP-003 | 9 unregistered capabilities | 1 hour | Causes false NEW_WORK results | Add to registerBuiltIn() |
| 4 | GAP-006 | Verification not called | 1 day | Blocks verification compliance | Wire VerificationRouter |
| 5 | GAP-004 | Knowledge capture not wired | 1 day | Knowledge not captured | Wire KnowledgeCaptureTrigger |
| 6 | GAP-005 | Reporting not wired | 1 day | Reports not delivered | Wire ExecutiveStatusUpdater |
| 7 | GAP-010 | WEF not wired to WAS | 1 day | Batches cannot execute | Wire WEF delegation |
| 8 | GAP-009 | Persistence not enabled | 1 hour | State lost on restart | Enable D1 persistence |
| 9 | GAP-007 | Agent consolidation | 2 hours | Registry bloat | Merge duplicate agents |
| 10 | GAP-012 | No capability lifecycle | 1 hour | Documentation gap | Define lifecycle policy |
| 11 | GAP-011 | Discipline model mismatch | 1 hour | Documentation gap | Update agent inventory |
| 12 | GAP-008 | Missing agents | 0 hours | Future scope | Do not create agents |

---

## Gap Closure Roadmap

```
Phase 1: Pipeline Wiring (P1 — 3 days)
├── GAP-001: Wire EPCL → WAS → WEF pipeline
├── GAP-002: Enable feature flags in staging
├── GAP-003: Register 9 missing capabilities
└── GAP-010: Wire WEF as WAS delegation target

Phase 2: Compliance & Knowledge (P2 — 2 days)
├── GAP-006: Wire VerificationRouter into WAS
├── GAP-004: Wire KnowledgeCaptureTrigger
└── GAP-005: Wire ExecutiveStatusUpdater

Phase 3: Hardening (P3 — 1 day)
├── GAP-009: Enable D1 persistence
├── GAP-007: Consolidate duplicate agents
└── GAP-012: Define capability lifecycle policy

Phase 4: Documentation (P4 — 1 day)
├── GAP-011: Update agent inventory to EPCL model
└── GAP-008: Document missing agents as "future scope"
```

---

## Current State Assessment

| Category | Status | Gap Count |
|----------|--------|-----------|
| 🔴 Blocks autonomous operation | ❌ Not ready | 2 (GAP-001, GAP-002) |
| 🟡 Requires implementation | ⚠️ Partial | 4 (GAP-003, GAP-004, GAP-005, GAP-006) |
| 🟢 Nice-to-have improvements | ⚠️ Partial | 6 (GAP-007 through GAP-012) |
| **Total** | **Not ready for autonomous mode** | **12 gaps** |

> **Assessment**: The Hermes Platform is architecturally sound for autonomous operation. The design is complete. The code is implemented. What remains is wiring — connecting the services that already exist. The 12 gaps are all resolvable. No architectural redesign is needed.