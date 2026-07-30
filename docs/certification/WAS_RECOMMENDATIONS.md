# WAS — Recommendations & Next Steps

> **Recommendations for the Workforce Activation Service (WAS) post-M4.**
> Based on implementation evidence, documentation, and operational readiness assessment.
>
> **Last Updated:** 2026-07-30

---

## Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        <consumer> (first: Concierge)
Public Brand:   AG Synergy
Repository:     concierge-website
Document:       WAS Recommendations
Capability:     Workforce Activation Service (#17)
Phase:          Phase 2 — Wave 9
Epic:           EPIC-006
Milestone:      M4 (Documentation) — Complete
Author:         Hermes Agent (AI Platform)
```

---

## 1. Executive Summary

WAS is **implementation-complete and documented** (68/68 tests, zero type errors, 5 architecture/operational documents). It provides a robust activation boundary between EPCL and WEF with fail-closed defaults. The following recommendations address gaps identified during M4 and chart the path to production readiness.

**Top 3 Priorities:**
1. **Persistent state storage** — Without it, WAS state is lost on every worker restart
2. **Auto-resume stabilization** — The recovery path needs validation before production use
3. **Production certification** — Full certification audit and operator training

---

## 2. Critical Recommendations (Must Do)

| # | Recommendation | Rationale | Effort | Priority |
|---|---------------|-----------|--------|----------|
| R1 | **Implement D1/KV storage adapter for ExecutionStateManager** | All activation state is in-memory — lost on worker restart. Breaks recovery across deployments. | 2-3 days | 🔴 Critical |
| R2 | **Stabilize and validate auto-resume** | Recovery currently marks in-progress→FAILED on restart. Auto-resume flag exists but is experimental. | 2 days | 🔴 Critical |
| R3 | **Production certification audit** | Full certification checklist (see WAS_READINESS_EVIDENCE.md) before enabling WAS in production. | 1 day | 🔴 Critical |

---

## 3. High Priority Recommendations

| # | Recommendation | Rationale | Effort | Priority |
|---|---------------|-----------|--------|----------|
| R4 | **Enable parallel batch delegation** | Serial delegation is the default. Parallel flag exists but needs testing. Enables concurrent WEF dispatch. | 1 day | 🟠 High |
| R5 | **Implement D1 persistence for ExecutiveStatusUpdater** | Reports are in-memory — lost on restart. Prevents post-mortem analysis. | 1 day | 🟠 High |
| R6 | **Add load/stress test suite** | No sustained-operation tests exist. Need confidence in long-running deployments. | 2 days | 🟠 High |
| R7 | **Create operator runbook drills** | Operator Guide exists but untested. Run tabletop exercises for outages, rollbacks, failure scenarios. | 1 day | 🟠 High |

---

## 4. Medium Priority Recommendations

| # | Recommendation | Rationale | Effort | Priority |
|---|---------------|-----------|--------|----------|
| R8 | **Add metrics dashboard** | No operator UI — manual monitoring only. Web dashboard with activation status, batch completion, error rates. | 3-5 days | 🟡 Medium |
| R9 | **Implement alerting for activation failures** | No alert hooks for WAS failures. Integrate with Notification capability. | 1 day | 🟡 Medium |
| R10 | **Document rollback procedure for WAS activation** | Rollback of an active WAS execution is not documented. Add to operator runbook. | 0.5 day | 🟡 Medium |
| R11 | **Add pre-flight validation for WAS config** | WAS config is applied without validation. Schema validation on configure() prevents misconfiguration. | 0.5 day | 🟡 Medium |
| R12 | **Extend knowledge capture to include failure analysis** | Knowledge capture currently records success paths only. Add failure analysis capture for post-mortems. | 1 day | 🟡 Medium |
| R13 | **Assign capability registry slots #15-#16** | Numbering gap in registry. Assign when new capabilities are created. | 0.1 day | 🟡 Medium |

---

## 5. Low Priority Recommendations (Future)

| # | Recommendation | Rationale | Effort | Priority |
|---|---------------|-----------|--------|----------|
| R14 | **Audit trail for WAS feature flag changes** | Flag state changes are not logged. Add audit events for enable/disable/sync. | 0.5 day | 🟢 Low |
| R15 | **Graceful shutdown for active activations** | No drain mechanism for in-flight batches on shutdown. | 1 day | 🟢 Low |
| R16 | **Multi-tenancy for WAS state** | Current singleton — no isolation between plans from different products. | 2 days | 🟢 Low |
| R17 | **WAS UI controls in administration panel** | Operator dashboard for flag toggles, activation inspection. | 3-5 days | 🟢 Low |

---

## 6. Architectural Recommendations

| # | Recommendation | Rationale | Priority |
|---|---------------|-----------|----------|
| A1 | **Move WAS state machine to shared/contracts** | Currently in workers/src/platform. EPCL state machine lives in shared/. Move for consistency. | 🟠 High |
| A2 | **Standardize event naming convention** | WAS uses snake_case (`activation_created`, `batch_dispatched`). EPCL uses camelCase. Pick one. | 🟡 Medium |
| A3 | **Add WAS event types to shared event registry** | WAS events are internal. Register with Observability for cross-capability visibility. | 🟡 Medium |
| A4 | **Consider moving WAS to hermes/services** | If WAS becomes a platform service used by multiple products, it belongs in hermes/ rather than workers/src/platform. Requires extraction. | 🟢 Low |

---

## 7. Documentation Recommendations

| # | Recommendation | Rationale | Priority |
|---|---------------|-----------|----------|
| D1 | **Add WAS to AI_PLATFORM_STATUS.md** | Platform status dashboard should list WAS under reusable capabilities. | 🟠 High |
| D2 | **Add WAS to capability→product mapping** | Capability registry §5 should show WAS consumed by Hermes. | 🟡 Medium |
| D3 | **Add WAS events to observability documentation** | 20 WAS event types need documentation for operators. | 🟡 Medium |
| D4 | **Add WAS risk to platform risk register** | Capability registry §7 should include WAS-specific risks. | 🟡 Medium |

---

## 8. Milestone Roadmap

After M4 (Documentation — Complete ✅), the remaining milestones:

| Milestone | Focus | Recommendations | Estimated Duration | Target |
|-----------|-------|-----------------|-------------------|--------|
| **M5** | Production Hardening | R1 (D1 storage), R2 (auto-resume), R5 (report persistence) | 1 week | Phase 2 |
| **M6** | Parallel Delegation | R4 (parallel), R3 (certification), A1 (state machine move) | 3-4 days | Phase 2 |
| **M7** | Dashboard Integration | R8 (metrics dashboard), R9 (alerting), R14 (audit trail) | 1 week | Phase 3 |
| **M8** | Long-Running Verification | R6 (load tests), R7 (operator drills), R15 (graceful shutdown) | 1 week | Phase 3 |

---

## 9. Phase Alignment

| Phase | WAS Status | Phase Focus |
|-------|-----------|-------------|
| Phase 1 (Foundation) | N/A | Identity Core, Patient Portal |
| Phase 2 (Platform) | **Current** | WAS implementation, EPCL integration, M4 documentation |
| Phase 3 (Production) | Next | Production hardening, dashboard, parallel delegation |
| Phase 4 (Scale) | Future | Multi-product, multi-tenancy, standalone extraction |

*Recommendations authored by Hermes Agent (AI Platform) based on WAS M4 completion evidence.*