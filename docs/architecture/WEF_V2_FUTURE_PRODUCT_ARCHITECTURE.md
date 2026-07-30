# Future Product Architecture

> **Phase E deliverable** — How the WEF v2 operating system evolves beyond
> Phase 2 to support new products, multi-tenant capability ecosystems, and
> AI-enhanced experiences.
>
> This is a long-term trajectory document, not a detailed implementation plan.
> It sketches the architectural shape of Phase 3, Phase 4, and beyond.

## 1. The Multi-Product Platform

Today, the platform hosts exactly one product: **Concierge** (public brand:
AG Synergy). The WEF v2 architecture is designed from the ground up to host
multiple products on the same foundation.

### 1.1 Product Tenancy Model

```
┌─────────────────────────────────────────────────────────────────┐
│                  AI PLATFORM (single deployment)                  │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  Concierge   │  │  Product B  │  │  Product C  │   ...       │
│  │  (fertility) │  │  (genomics) │  │  (wellness) │              │
│  └──────┬───────┘  └──────┬──────┘  └──────┬──────┘              │
│         │                 │                 │                     │
│         └─────────────────┼─────────────────┘                     │
│                           │                                       │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │              Platform Core Services                       │    │
│  │  Identity │ Permissions │ Audit │ Consent │ Trust         │    │
│  └────────────────────────┬──────────────────────────────────┘    │
│                           │                                       │
│  ┌────────────────────────▼──────────────────────────────────┐    │
│  │              WEF v2 Operating System                      │    │
│  │  Orchestration │ Execution │ Persistence │ Observability  │    │
│  └───────────────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

**Architecture invariant:** Products do not share runtime state. Each product
gets isolated capability definitions, agent rosters, and approval policies.
They share identity (users can belong to multiple products), permissions
(product-scoped RBAC), and infrastructure (single Worker instance, single D1).

### 1.2 Product Registration

Adding a new product is a declarative operation:

```
// products/{name}/manifest.ts
export const productManifest = {
  id: "genomics-screening",
  displayName: "Genomics Screening",
  publicBrand: "AG Gene",
  capabilities: ["appointment.book", "results.view", "consent.manage"],
  agents: ["booking-bot", "result-notifier", "data-sync"],
  policies: { approval: "operator-required", storageDuration: "7y" },
  dependencies: ["identity.core", "documents.secure", "notifications.email"],
};
```

**What this means:** The platform operator does not write new activation code,
create new routes, or deploy new workers for a new product. They write a
manifest and the WEF OS resolves the capability → agent → execution chain
automatically.

**Why this matters:** Phase 3 (AI-Enhanced Patient Experience) can be implemented
as a product manifest extension on Concierge — not a separate platform. The
AI features are added capabilities on the same orchestration fabric.

### 1.3 Capability Ecosystem

Third-party capabilities follow the same pattern as first-party ones:

- `GET /api/v1/capabilities?product=concierge` → available capabilities
- `POST /api/v1/capabilities/register` → register a new capability
- `GET /api/v1/capabilities/:id/status` → capability health/version

This is an **API-first ecosystem** — not a marketplace. Capabilities are
registered by platform operators, not end users. The distinction preserves
the fail-closed property: capabilities are only registered after verification.

## 2. Phase 3: AI-Enhanced Patient Experience

The Blueprint (Phase C) and Program Status Dashboard both identify Phase 3
as the next major product phase. Here is how WEF v2 supports it.

### 2.1 AI Interaction Model

In Phase 3, two types of AI agents interact with the platform:

| Agent Type | Role | Authorization Model |
|---|---|---|
| **Frontend AI** | Patient-facing chat/assistant (the "Concierge" itself) | User-authenticated, patient-scoped RBAC. Cannot execute platform capabilities. |
| **Backend AI** | Operations/admin agent (scheduling, triage, data analysis) | Operator-authenticated, full product scope. Subject to WEF approval gates. |

**Architecture invariant:** Both agent types run through the same
`HermesExecutionGateway`. The distinction is in the **scope** and
**approval requirements** — not in the execution path. A Frontend AI
calling `patient.appointment.schedule` requires patient consent + product policy.
A Backend AI calling `schedule.bulk-update` requires operator approval.

### 2.2 Capability Additions for Phase 3

| Capability | AI Type | Data Source | Gate |
|---|---|---|---|
| `patient.appointment.suggest` | Frontend | Patient history + clinic availability | Patient consent |
| `patient.response.analyze` | Backend | Patient communication logs | HIPAA/BAA policy |
| `clinic.availability.predict` | Backend | Historical booking data | Operator approval |
| `treatment.plan.optimize` | Backend | Protocol database | Medical director approval |

**Implementation path:** These are new capability definitions following the
same pattern as website ops capabilities (EPIC-006). Each one:
1. Defines a typed backend contract (e.g., `ClinicBackend`, `PatientBackend`)
2. Registers the capability with the Orchestration Fabric
3. Wires a real provider at deploy time

### 2.3 Patient-Facing Architecture

```
User ─→ Website (apps/) ─→ API (workers/src/) ─→ Identity (auth)
                  │                                    │
                  └──→ Capability Request ──────────────┘
                              │
                    GET /api/v1/capabilities/patient.appointment.schedule
                              │
              ┌───────────────┴───────────────┐
              │  Gate: patient consent?       │
              │  Gate: policy allows?         │
              │  Gate: clinic available?      │
              └───────────────┬───────────────┘
                              │
              ┌───────────────▼───────────────┐
              │  CapabilityExecutor           │
              │  → scheduleAppointment(args)  │
              └───────────────────────────────┘
```

This is the same execution chain as the WEF v2 operating system — just
exposed through the patient API instead of the admin API. The patient
never sees the agent/approval/execution infrastructure. They see a
smooth appointment booking flow.

## 3. Phase 4+: Multi-Product Operating Platform

### 3.1 Cross-Product Concerns

When multiple products share the same platform, new concerns emerge:

| Concern | WEF v2 Solution |
|---|---|
| Cross-product identity | Single Identity Core, product-scoped roles |
| Cross-product data isolation | D1 schema per product (prefix: `concierge_`, `gene_`) |
| Cross-product consent | Consent Engine scoped by product + purpose |
| Cross-product audit | Audit events tagged with `productId` — queryable at platform level |
| Resource contention | Execution Gateway's tenant check: `tenant: productId` |
| Capability overlap | Capability namespaced by product: `concierge:appointment.book` |

### 3.2 Product Lifecycle

```
Product Registration → Active → Deprecated → Archived
     │                                          │
     │                                     All state frozen in D1
     │                                     No new capabilities
     │                                     Read-only for audit
     ▼
  All capabilities registered
  Agent roster created
  Identity realm configured
  Consent policies mapped
  Observability dashboard created
```

### 3.3 The Platform as a Business Asset

When Phase 4 is reached, the platform has transformed from "a website API"
into a **business operating system**:

- **New product time-to-market:** Days, not weeks. Write a manifest, register
  capabilities, deploy.
- **Cross-product intelligence:** Anonymized appointment data across products
  feeds the ML pipeline for better prediction models.
- **Operator efficiency:** One team operates the platform. Product teams
  operate within their product boundary through the Admin Console.
- **Compliance-by-architecture:** Every product inherits the platform's
  consent/trust/policy/audit infrastructure. New regulations don't require
  new per-product work.

## 4. Evolution Vectors (Long-Term)

Beyond Phase 4, the platform can evolve along these independent vectors:

### 4.1 Provider Runtime Sandboxing
**Today:** `SandboxPolicy` is declared but not read by the execution gateway.
**Future:** The gateway enforces `SandboxPolicy` at the provider level —
network isolation, filesystem sandbox, execution timeout, resource limits.

### 4.2 Multi-Agent Autonomy
**Today:** All agents require human approval for production execution.
**Future:** Agents can be granted bounded autonomy (e.g., "auto-approve
appointment reminders but require human for treatment changes"). This is
a policy change, not an architecture change — the approval gate already
evaluates policies.

### 4.3 External Provider Marketplace
**Today:** Capability providers are wired at deploy time (gh, wrangler).
**Future:** Third-party providers register through an authenticated API.
The platform validates the provider's compliance with platform policies
before activation. This is a WEF v2 capability manifest extension.

### 4.4 Federated Observability
**Today:** Observability data stays in the platform's D1.
**Future:** Platform can export observability events to the product's own
monitoring stack (Datadog, Grafana, etc.) via a structured event stream.
This is a new adapter on the existing observability service.

### 4.5 Organizational Hierarchy Integration
**Today:** The platform knows about agents, tasks, and products.
**Future:** The platform knows about the org chart — teams own agents,
managers approve tasks, directors set policies, compliance reviews audits.
This maps directly to the existing RBAC engine (roles are already in D1)
and the Admin Platform's 6-domain view.

## 5. What Stays the Same

Through all future phases, these WEF v1 invariants remain:

| Invariant | Why |
|---|---|
| Single execution boundary | `HermesExecutionGateway` — one point to audit, one point to harden |
| Fail-closed by default | Unknown capability → denied. Unknown approval → denied. Unknown provider → denied. |
| Provider-neutral contracts | Capabilities defined in product terms, not vendor names |
| Dual-path persistence | Cache + D1 — testable without infrastructure |
| Bounded context seams | App layer → Platform layer → Gateway → Provider. Each replaceable independently. |
| Agents disabled by default | Autonomy is a granted privilege, not a default. |

## 6. Architectural Guardrails

These guardrails prevent the platform from evolving in ways that violate its
design principles:

1. **No per-product deployment artifacts.** Adding a product does not add
   a new Worker, a new Lambda, or a new container. Products are configuration
   on the existing platform.
2. **No vendor lock-in at the platform level.** The platform runs on Cloudflare
   Workers today but the capability contracts are Cloudflare-neutral. Migration
   to a different runtime is a deploy-time wiring change, not a rewrite.
3. **No business logic in the gateway.** The `HermesExecutionGateway` evaluates
   policies and routes requests. It does not know what `appointment.book`
   means — only whether it's allowed. Business logic lives in capability executors.
4. **No bypasses for the core.** The Identity Core, Consent Engine, Trust Engine,
   and Audit system are never bypassed — not for faster execution, not for
   back-compat, not for any reason.

---

*This document is Phase E of the WEF v2 Evolution Blueprint (Phase C).
It defines the long-term product architecture trajectory from Phase 2
(Concierge) through Phase 4+ (multi-product operating platform).*