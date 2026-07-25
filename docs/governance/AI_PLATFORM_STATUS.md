# AI Platform Status Dashboard

> **Tracks reusable platform capabilities independent of Concierge.**
> The AI Platform is the organizational layer between AGS (company) and individual products like Concierge.
> **Last Updated:** 2026-07-25

---

## 1. Governance Header

```
Company:        AGS
Platform:       AI Platform
Product:        Concierge
Public Brand:   AG Synergy
Repository:     concierge-website
```

---

## 2. Reusable Platform Capabilities

| Capability | Status | Components | Consumers |
|---|---|---|---|
| Execution Platform | ✅ **Live** | Work Planner, Workforce Dispatcher, Execution Queue, Review Pipeline | Hermes agents, workflows |
| Authorization Engine | ✅ **Live** | Data-driven RBAC, `src/auth/` engine, deny-wins, OWNER short-circuit | All protected API routes |
| Provider Framework | ✅ **Live** | Capability Registry, Provider Loader, Provider Discovery, Transport Layer | Security scanners, tool providers |
| Workforce Orchestration | ✅ **Live** | Coordinator, 8 lifecycle states, human approval gates, notification integration | Agent lifecycle, workflow tasks |
| Security Automation | ✅ **Live** | Security Agent, Risk Engine, OSS scanner adapters (gitleaks, semgrep, osv-scanner, trivy) | Developer pipeline, admin visibility |
| Persistence Layer | ✅ **Live** | Agent state store, Execution store, Workflow store, Memory/persistence backends | Stateful operations, audit trails |
| Platform Hardening | ✅ **Live** | Agent lifecycle management, audit persistence, tenant boundaries, provider seam isolation | Cross-boundary security |

---

## 3. Workforce

| Role | Count | Status |
|---|---|---|
| Hermes Agent (primary) | 1 | ✅ Active |
| Operations Bot (Telegram) | 1 | ⚠️ Wire-ready |
| Admin Bot (Telegram) | 1 | ⚠️ Wire-ready |
| Human operators | TBD | Pre-launch |

---

## 4. Execution Engine

| Component | Implementation | Status |
|---|---|---|
| Work Planner | `hermes/services/execution/work-planner.ts` | ✅ Complete |
| Workforce Dispatcher | `hermes/services/execution/workforce-dispatch.ts` | ✅ Complete |
| Execution Queue | `hermes/services/execution/execution-queue.ts` | ✅ Complete |
| Review Pipeline | `hermes/services/execution/review-pipeline.ts` | ✅ Complete |
| Execution Durability | `hermes/persistence/execution-store.ts` | ✅ Complete |

---

## 5. Provider Framework

| Component | Description | Status |
|---|---|---|
| Capability Registry | Single source of truth for provider registration | ✅ Complete |
| Provider Loader | Only code path where vendor code enters the system | ✅ Complete |
| Provider Discovery | Version + installation state + health monitoring | ✅ Complete |
| Transport Layer | Provider-neutral transport abstraction | ✅ Complete |
| Security Provider Integration | OSS scanner adapters (gitleaks, semgrep, osv-scanner, trivy) | ✅ Complete |

---

## 6. Orchestration

| Component | Location | Status |
|---|---|---|
| Coordinator | `hermes/services/workforce/orchestration.ts` | ✅ Complete |
| Agent Lifecycle | `shared/contracts/lifecycle.ts` | ✅ Complete |
| Agent Registry | `hermes/agents/registry.ts` | ✅ Complete |
| Human Approval Gates | Env-driven, production always gated | ✅ Complete |
| Notification Integration | Approval lifecycle events (fire-and-forget) | ✅ Complete |

---

## 7. Security

| Layer | Component | Status |
|---|---|---|
| Authorization | Data-driven RBAC (deny-wins, OWNER short-circuit) | ✅ Live |
| Audit | `audit_logs` — every allow and deny recorded | ✅ Live |
| Agent Safety | `canAgentAct()` — single execution gate (enabled AND active) | ✅ Live |
| Tenant Isolation | `withinTenantScope()` — hard cross-org wall | ✅ Live |
| Provider Seam | `ProviderManifest → ProviderLoader → CapabilityRegistry` | ✅ Live |
| Secret Detection | Runtime secret scan on tool output | ✅ Configured |
| OSS Scanner Integration | gitleaks, semgrep, osv-scanner, trivy adapters | ✅ Live (fail-closed) |
| PHI Protections | No PHI collected in Phase 1; API boundary enforcement | ✅ Designed |

---

## 8. Observability

| Capability | Implementation | Status |
|---|---|---|
| Health Endpoint | `GET /api/v1/health` → version sourced from CHANGELOG.md (single source of truth) | ✅ Live |
| Structured Logging | Workers Observability (JSON-line logs) | ✅ Enabled |
| Rate Limiting | In-memory sliding window (per-isolate, approximate) | ✅ Implemented |
| Deployment Monitoring | Workers CI → GitHub check runs | ✅ Configured |
| Audit Logs | `audit_logs` D1 table, append-only | ✅ Live |
| Error Metrics | Workers Observability platform | ✅ Enabled |

---

## 9. Extraction Progress

The AI Platform currently co-exists with Concierge in a single repository. Capabilities built for Phase 1 were designed with provider-neutral interfaces to support future extraction into a standalone platform.

| Seam | Status | Extraction Readiness |
|---|---|---|
| `hermes/` directory | ✅ Separate source directory | High — modular, independent tests |
| Provider interfaces | ✅ Contract-based | High — swap backends without code changes |
| Persistence backends | ✅ `Memory*` + D1 implementations | High — interface-driven |
| Capability Registry | ✅ Registry pattern | High — independent of product logic |
| Authorization engine | ✅ Provider-agnostic | Medium — currently in `workers/` tree |

---

## 10. Reusable Services

| Service | Interface | Backend Implementations | Status |
|---|---|---|---|
| Execution Store | `ExecutionPersistenceBackend` | Memory | ✅ Complete |
| Auth Engine | `IdentityResolver` registry | TelegramIdentityResolver | ✅ Complete |
| Workforce Repository | `WorkforcePersistenceBackend` | Memory, D1 | ✅ Complete |
| Provider Framework | Provider-neutral contracts | OSS scanners (4 adapters) | ✅ Complete |
| Audit Store | `AuditStore` interface | MemoryAuditStore | ✅ Complete |

---

## 11. Future Platform Roadmap

| Capability | Phase | Status |
|---|---|---|
| Full D1 persistence backends | Phase 2+ | 📋 Planned |
| Postgres/KV backends | Phase 3+ | 📋 Future |
| External provider marketplace | Phase 3+ | 📋 Future |
| Cross-product service mesh | Phase 4 | 📋 Future |
| AI Platform as independent deployable | Post-Phase 4 | 📋 Vision |

---

*This dashboard is authoritative and must be updated by every epic completion.
Updates require: `PROGRAM_STATUS.md`, `AI_PLATFORM_STATUS.md`, `PRODUCT_STATUS.md`, `CURRENT_SPRINT.md`.*