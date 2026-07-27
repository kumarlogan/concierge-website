# AI Platform Status Dashboard

> **Tracks reusable platform capabilities independent of Concierge.**
> The AI Platform is the organizational layer between AGS (company) and individual products like Concierge.
> **Last Updated:** 2026-07-27
> **WEF Version:** 1.1.0

---

## 1. Governance Header

```
Company:        AGS
Business Unit:  Engineering
Platform:       AI Platform
Product:        Concierge (consumer) — first adopter
Public Brand:   AG Synergy
Repository:     concierge-website
Portfolio:      Clinical
Phase:          Phase 2 — Wave 9
Epic:           EPIC-2.4
Sprint:         S2.4.0
Status:         ✅ Phase 2 Complete — All 9 waves delivered
Workforce Mode: Human Supervised (WEF v1.1)
WEF Version:    1.1.0
WEF Workforce:  Developer Agent, QA Agent, Security Agent, Documentation Agent, Monitoring Agent
Human Authority: principal:human-operator
Governance:     ACTIVE — Wave 9 — Concierge Launch & Platform Activation
Framework:      WEF v1.1 (AGS Enterprise Execution Framework)
```

---

## 2. Reusable Platform Capabilities

| Capability | Status | Components | Consumers |
|---|---|---|---|
|| Execution Platform | ✅ **Live** | Work Planner, Workforce Dispatcher, Execution Queue, Review Pipeline | Hermes agents, workflows |
|| Authorization Engine | ✅ **Live** | Data-driven RBAC, `src/auth/` engine, deny-wins, OWNER short-circuit | All protected API routes |
|| Provider Framework | ✅ **Live** | Capability Registry, Provider Loader, Provider Discovery, Transport Layer | Security scanners, tool providers |
|| Workforce Orchestration | ✅ **Live** | Coordinator, 8 lifecycle states, human approval gates, notification integration | Agent lifecycle, workflow tasks |
|| Security Automation | ✅ **Live** | Security Agent, Risk Engine, OSS scanner adapters (gitleaks, semgrep, osv-scanner, trivy) | Developer pipeline, admin visibility |
|| Persistence Layer | ✅ **Live** | Agent state store, Execution store, Workflow store, Memory/persistence backends | Stateful operations, audit trails |
|| Platform Hardening | ✅ **Live** | Agent lifecycle management, audit persistence, tenant boundaries, provider seam isolation | Cross-boundary security |
||| **Trust & Identity** | ✅ **Live (Wave 3)** | Identity Core v1 (16 modules), Provider Abstractions (Google, OIDC), JWT Key Rotation, Refresh Token Hashing, MFA, Passwordless Auth, Session Management, Credential Rotation, D1 Persistence, Rate Limiting, Zero Trust Hooks, Audit & Identity Events | All products (implemented v1) |
||| **Policy Engine** | ✅ **Architecture Complete (Wave 2)** | Centralized policy evaluation — RBAC+ABAC+Time+Context+Consent+Trust, policy hierarchy, conflict resolution, fail-closed | All products (designed, not implemented) |
||| **Consent & Trust** | ✅ **Architecture Complete (Wave 2)** | 10 consent types, immutable consent records, consent lifecycle, trust evaluation, session binding | All products (designed, not implemented) |
||| **Capability Registry** | ✅ **Complete (Wave 2)** | 13-capability inventory, dependency map, product mapping, risk register, maintenance schedule | Platform-wide registry |
||| **Engineering Standards** | ✅ **Complete (Wave 2)** | 110 mandatory standards across 19 categories, compliance gates per maturity level, waiver process | All capabilities |
||| **Release Management** | ✅ **Architecture Complete (Wave 1)** | Standardized preview and production deployment workflows for all AGS products. 8 architecture documents, environment model, 10 platform interfaces, pipeline design, rollback/smoke test/promotion strategies. | Concierge (first adopter), all future products |
||| **Capability Maturity Model** | ✅ **Complete (Wave 2)** | 8 maturity levels with entry/exit criteria, advancement/demotion/re-promotion rules, waiver process | All capabilities |

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

|| Capability | Phase | Status |
||---|---|---|
||| Trust & Identity — Architecture | Phase 2 | ✅ **Complete (Wave 1)** |
||| Policy Engine — Architecture | Phase 2 | ✅ **Complete (Wave 2)** |
||| Consent & Trust — Architecture | Phase 2 | ✅ **Complete (Wave 2)** |
||| Capability Registry | Phase 2 | ✅ **Complete (Wave 2)** |
||| Engineering Standards | Phase 2 | ✅ **Complete (Wave 2)** |
||| Workforce Identity — Expanded | Phase 2 | ✅ **Complete (Wave 2)** |
||| Capability Maturity Model | Phase 2 | ✅ **Complete (Wave 2)** |
|||| Release Management — Architecture | Phase 2 | ✅ **Architecture Complete (Wave 1)** |
||||| Trust & Identity — Implementation | Phase 2 | ✅ **Complete (Wave 3)** — 514 tests, 16 modules |
||||| Patient Workspace — Frontend | Phase 2 | ✅ **Complete (Wave 5)** — identity routes, auth provider/guards, 10 patient pages |
||||| Secure Document Upload & Consent | Phase 2 | ✅ **Complete (Wave 6)** — R2 pre-signed URLs, consent trust, policy engine |
||||| Appointment Management & Messaging | Phase 2 | ✅ **Complete (Wave 7)** — scheduling, messaging, consent enforcement |
||||| Production Hardening & Security Closure | Phase 2 | ✅ **Complete (Wave 8.1)** — JWT, consent engine, rate limiting |
||||| Concierge Launch & Platform Activation | Phase 2 | 🚧 **Wave 9 (final wave) — In Progress** |
||| Full D1 persistence backends | Phase 2+ | 📋 Wave 9 deferred backlog |
|| Postgres/KV backends | Phase 3+ | 📋 Future |
|| External provider marketplace | Phase 3+ | 📋 Future |
|| Cross-product service mesh | Phase 4 | 📋 Future |
|| AI Platform as independent deployable | Post-Phase 4 | 📋 Vision |

---

*This dashboard is authoritative and must be updated by every epic completion.
Updates require: `PROGRAM_STATUS.md`, `AI_PLATFORM_STATUS.md`, `PRODUCT_STATUS.md`, `CURRENT_SPRINT.md`.*