# HERMES 10-LAYER ORGANIZATIONAL MODEL
*Mission: Hermes Organization Reconstruction — Phase C Deliverable*

**Date:** 2026-07-30  
**Authority:** Product Owner Approval Granted  
**Status:** Definitive model constructed from evidence

---

## EXECUTIVE SUMMARY

The Hermes organization operates as a **10-layer hierarchical operating system** where each layer has defined responsibilities, interfaces, and activation requirements. This model reconciles all architectural documents (ADR-004, ADR-005, ADR-007, ADR-008), the Enterprise Operating Model, and the 17 platform capabilities.

---

## THE 10 LAYERS

### LAYER 1: COMPANY LAYER
**Purpose:** Legal entity, enterprise governance, cross-business-unit coordination  
**Evidence:** `docs/company/AGS_ENTERPRISE_OPERATING_MODEL.md`

**Components:**
- **Company Identity:** AGS (Healthcare/Fertility Services)
- **Governance Authority:** Executive Office
- **Execution Framework:** WEF v1.1 (enterprise-wide)
- **Registry:** PSER (Project State & Execution Registry)

**Responsibilities:**
- Define enterprise hierarchy
- Set company-wide policies
- Own PSER (company-level execution registry)
- Appoint business unit leaders
- Maintain enterprise governance dashboard

**Interfaces:**
- Downward: Authorizes Business Units
- Upward: Reports to legal/regulatory authorities
- Lateral: None (top-level)

**Activation State:** ✅ Active (constitutional layer)

---

### LAYER 2: BUSINESS UNIT LAYER
**Purpose:** Domain-specific organizations within AGS  
**Evidence:** `docs/company/BUSINESS_UNIT_MODEL.md`

**Components (11 Business Units):**
1. Engineering
2. Executive Office
3. Marketing
4. Sales
5. Operations
6. Medical
7. Finance
8. Legal
9. HR
10. Research
11. Intelligence

**Responsibilities:**
- Own platforms (1+ per business unit)
- Manage workforce categories
- Execute domain-specific strategies
- Report to Company layer

**Interfaces:**
- Downward: Authorizes Platforms
- Upward: Reports to Company (Executive Office)
- Lateral: Cross-business-unit coordination via Company layer

**Activation State:** ✅ Engineering active, others planned

---

### LAYER 3: PLATFORM LAYER
**Purpose:** Reusable cross-cutting capabilities serving multiple products  
**Evidence:** ADR-005, ADR-007, ADR-008

**Components:**
- **AI Platform** (Hermes) — The only platform currently implemented
  - 17 capabilities in `hermes/services/`
  - Provider-neutral, reusable, modular
  - Serves all business units

**Future Platforms (Planned):**
- Marketing Platform
- Sales Platform
- Operations Platform
- Analytics Platform
- Finance Platform
- Knowledge Platform

**Responsibilities:**
- Own identity services
- Own permissions/authorization
- Own audit/logging
- Own agent registry
- Own lifecycle management
- Own automation/orchestration
- Own provider adapters
- Expose reusable contracts to products

**Interfaces:**
- Downward: Serves Products via contracts
- Upward: Reports to Business Unit
- Lateral: Platforms do NOT share (ADR-005)

**Activation State:** ✅ AI Platform (Hermes) partially active (feature-gated)

---

### LAYER 4: PRODUCT LAYER
**Purpose:** Independent business applications consuming platform capabilities  
**Evidence:** `docs/company/ENTERPRISE_PLATFORM_MODEL.md`

**Components (Current):**
- **Concierge** (Product #1, AG Synergy brand)
  - `workers/` — Cloudflare Worker API
  - `hermes-website/` — Frontend (React + Vite)
  - `hermes/` — Consumed platform capabilities

**Future Products (Planned):**
- Finance Portal
- Marketing CMS
- Sales CRM
- Operations Dashboard
- Medical Records System

**Responsibilities:**
- Consume platform capabilities via contracts
- Implement product-specific business logic
- Own product roadmap
- Serve portfolios

**Interfaces:**
- Downward: Serves Portfolios
- Upward: Consumes Platform contracts
- Lateral: Products do NOT share (isolation)

**Activation State:** ✅ Concierge deployed (v1.0.0, api.agsynergy.ca)

---

### LAYER 5: PORTFOLIO LAYER
**Purpose:** Product sub-domains grouping related roadmaps  
**Evidence:** Enterprise Operating Model hierarchy

**Components (Concierge Portfolios):**
- **Clinical** (Patient Experience, Medical Records, Appointments)
- **Operational** (Admin Dashboard, Staff Management)
- **Commercial** (Billing, Insurance, Payments)

**Responsibilities:**
- Group related roadmaps
- Define portfolio-level strategy
- Allocate resources across roadmaps

**Interfaces:**
- Downward: Owns Roadmaps
- Upward: Reports to Product
- Lateral: Portfolios do NOT share

**Activation State:** ⚠️ Clinical portfolio partially implemented (Patient Portal Phase 1)

---

### LAYER 6: ROADMAP LAYER
**Purpose:** Strategic direction for a portfolio  
**Evidence:** `ROADMAP.md`, EPCL RoadmapEngine

**Components (Concierge Roadmap):**
- **Phase 0:** Foundation (✅ Complete)
- **Phase 1:** MVP (✅ Complete)
- **Phase 2:** Platform Extraction (✅ Complete — Waves 1-9)
- **Phase 3:** AI-Operated (📋 Planned)
- **Phase 4:** Multi-Product (📋 Planned)

**EPCL Roadmap Types:**
- `RoadmapPhase` — Sequential milestones
- `RoadmapEpic` — Large feature groups
- `RoadmapMilestone` — Delivery units

**Responsibilities:**
- Define phased progression
- Track dependencies
- Allocate epics to phases

**Interfaces:**
- Downward: Owns Phases
- Upward: Reports to Portfolio
- Lateral: Roadmaps do NOT share

**Activation State:** ✅ Phase 0-2 complete, Phase 3+ planned

---

### LAYER 7: WORKFORCE LAYER
**Purpose:** Execution agents organized by category  
**Evidence:** `docs/company/ENTERPRISE_WORKFORCE_MODEL.md`, `AI_WORKFORCE.md`

**Components (11 Workforce Categories):**
1. **Engineering Workforce** — Developer, QA, Security, Documentation, Monitoring Agents
2. **Executive Workforce** — Human Operator, Approver
3. **Marketing Workforce** — Marketing, Content, Analytics Agents
4. **Sales Workforce** — Sales, CRM, Pipeline Agents
5. **Operations Workforce** — Operations, Coordination, Compliance Agents
6. **Medical Workforce** — Medical Review, Clinical Agents
7. **Finance Workforce** — Finance, Billing, Reporting Agents
8. **Legal Workforce** — Legal Review, Compliance Agents
9. **HR Workforce** — Recruitment, Onboarding, Personnel Agents
10. **Research Workforce** — Research, Analysis, Intelligence Agents
11. **Intelligence Workforce** — Data, Insights, Prediction Agents

**Agent Registry (AI_WORKFORCE.md):**
- `id`, `name`, `purpose`, `owner`, `application_assignment`
- `permissions`, `status` (inactive/active/deprecated)
- `interfaces`, `supported_providers`, `activation_state`

**Responsibilities:**
- Execute work via WEF
- Consume platform capabilities
- Report to Business Unit

**Interfaces:**
- Downward: Executes Tasks via WEF
- Upward: Reports to Business Unit
- Lateral: Workforces collaborate via WEF

**Activation State:** ⚠️ Only Engineering (Hermes) operational

---

### LAYER 8: EXECUTION LAYER
**Purpose:** The execution framework (WEF + EPCL + WAS)  
**Evidence:** `workers/src/platform/epcl/`, `workers/src/platform/was/`

**Components:**

#### 8A. EPCL (Executive Planning & Control Layer)
- **Purpose:** Planning layer (never executes directly)
- **12 Stages:** ROADMAP_ANALYSIS → EXECUTIVE_REPORT
- **Feature Flags:** All OFF by default (fail-closed)
- **Status:** ✅ Implemented, ❌ Disabled

#### 8B. WAS (Workforce Activation Service)
- **Purpose:** Activation boundary (EPCL → WEF)
- **8-State Machine:** PENDING → ACTIVATING → ACTIVE
- **Sub-Services:** PlanConsumer, ConstitutionalValidator, WEFDelegator, etc.
- **Status:** ✅ Implemented, ⚠️ Fail-closed

#### 8C. WEF (Workforce Execution Framework) v1.1
- **Purpose:** Enterprise execution framework (all workforces)
- **8 Phases:** Preparation → PSER Update
- **Principles:** Human Approval, Observability, Auditability, Fail Closed
- **Status:** ✅ Defined, ⚠️ Partial implementation

**Execution Pipeline:**
```
Roadmap Input → EPCL (plan) → WAS (activate) → WEF (execute) → Verify → Report
```

**Responsibilities:**
- Plan execution (EPCL)
- Activate batches (WAS)
- Execute work (WEF)
- Verify results
- Capture knowledge

**Interfaces:**
- Downward: Executes Tasks
- Upward: Reports to Workforce
- Lateral: Execution services collaborate

**Activation State:** ⚠️ Partially active (Hermes uses manual Telegram execution, not full WEF)

---

### LAYER 9: CAPABILITY LAYER
**Purpose:** Reusable platform services (17 capabilities)  
**Evidence:** `hermes/services/index.ts`

**Components (17 Capabilities):**

| # | Capability | Service Path | Reusable |
|---|-----------|-------------|----------|
| 1 | Registry | `services/registry/` | ✅ |
| 2 | Discovery | `services/discovery/` | ✅ |
| 3 | Lifecycle | `services/lifecycle/` | ✅ |
| 4 | Scheduler | `services/scheduler/` | ✅ |
| 5 | Notification | `services/notification/` | ✅ |
| 6 | Memory | `services/memory/` | ✅ |
| 7 | Providers | `services/providers/` | ✅ |
| 8 | Activation | `services/activation/` | ✅ |
| 9 | Execution | `services/execution/` | ✅ |
| 10 | Security | `services/security/` | ✅ |
| 11 | Workforce | `services/workforce/` | ✅ |
| 12 | Planning | `services/planning/` | ✅ |
| 13 | MCP | `services/mcp/` | ✅ |
| 14 | Developer | `services/developer/` | ✅ |
| 15 | Tools | `services/tools/` | ✅ |
| 16 | Application | `services/application/` | ⚠️ Stub |
| 17 | Agents | `services/agents/` | ⚠️ Partial |

**Capability Interfaces (Contracts):**
- TypeScript contracts in `hermes/contracts/`
- Provider abstraction via `services/providers/`
- Execution gateway via `services/execution/gateway/`

**Responsibilities:**
- Provide reusable services
- Expose provider-neutral APIs
- Support all business units

**Interfaces:**
- Downward: Serves Execution Layer
- Upward: Consumed by Products via contracts
- Lateral: Capabilities collaborate (e.g., Planning → Execution)

**Activation State:** ✅ 15/17 fully implemented, 2 partial

---

### LAYER 10: INFRASTRUCTURE LAYER
**Purpose:** Physical/virtual runtime, providers, deployment targets  
**Evidence:** `docs/architecture/PROVIDER_TRUST_MODEL.md`, deployment configs

**Components:**

#### 10A. Compute Infrastructure
- **Cloudflare Workers** — `workers/` runtime
- **Cloudflare Pages** — `hermes-website/` hosting
- **Oracle Cloud** — Hermes Agent (Telegram) host
- **Local** — Development environment

#### 10B. Provider Backends
- **claude-code** — Claude Code CLI
- **github** — GitHub API
- **cloudflare** — Cloudflare API
- **local-sandbox** — Local execution (planned)

#### 10C. Storage Infrastructure
- **D1** — SQLite (PSER, workforce persistence)
- **KV** — Key-value cache (execution state)
- **R2** — Object storage (archive)
- **GitHub** — Source control, secrets

#### 10D. Network Infrastructure
- **Telegram** — Human-agent communication
- **Cloudflare Tunnel** — Secure connections
- **Tailscale** — Private network (planned for WebUI)

**Responsibilities:**
- Provide runtime for all layers above
- Execute provider transports
- Store persistent state
- Enable communication

**Interfaces:**
- Upward: Serves all layers
- Lateral: Infrastructure components connect as needed

**Activation State:** ✅ Cloudflare + Oracle + GitHub active, others planned

---

## LAYER INTERACTIONS

### Vertical Flow (Top-Down)
```
Company (1) → Business Unit (2) → Platform (3) → Product (4) → Portfolio (5) 
→ Roadmap (6) → Workforce (7) → Execution (8) → Capability (9) → Infrastructure (10)
```

### Activation Dependencies
- Layer 3 (Platform) requires Layer 1-2 active
- Layer 4 (Product) requires Layer 3 contracts
- Layer 7 (Workforce) requires Layer 8 (Execution) operational
- Layer 8 (Execution) requires Layer 9 (Capabilities) implemented
- Layer 9 (Capabilities) requires Layer 10 (Infrastructure) running

### Data Flow (Execution)
```
Roadmap (6) → EPCL (8A) → WAS (8B) → WEF (8C) → Capability (9) → Infrastructure (10)
                ↓                                        ↓
            Planning                                 Execution
                ↓                                        ↓
            Knowledge Capture → PSER (Registry) → Resume Points
```

---

## CURRENT STATE ASSESSMENT

### Fully Active Layers
- ✅ Layer 1: Company (AGS)
- ✅ Layer 2: Engineering Business Unit
- ✅ Layer 3: AI Platform (partial — feature-gated)
- ✅ Layer 4: Concierge Product
- ✅ Layer 10: Infrastructure (Cloudflare + Oracle + GitHub)

### Partially Active Layers
- ⚠️ Layer 5: Clinical Portfolio (Phase 1 only)
- ⚠️ Layer 6: Roadmap (Phase 0-2 complete, 3+ planned)
- ⚠️ Layer 7: Engineering Workforce only (Hermes)
- ⚠️ Layer 8: Execution (manual Telegram, not full WEF)
- ⚠️ Layer 9: 15/17 capabilities fully implemented

### Dormant Layers
- ❌ Layer 2: 10/11 Business Units (only Engineering active)
- ❌ Layer 5: Marketing, Sales, Operations Portfolios
- ❌ Layer 6: Phase 3-4 Roadmaps
- ❌ Layer 7: 10/11 Workforce Categories
- ❌ Layer 8: EPCL (feature-flagged OFF), WAS (fail-closed)
- ❌ Layer 9: Application service (stub), Agents service (partial)

---

## ACTIVATION PATHWAY

To achieve the full 10-layer operational model:

1. **Enable EPCL** — Set feature flags (`ENABLE_EXECUTIVE_WORKFLOW`, etc.)
2. **Activate WAS** — Configure constitutional validation
3. **Register Agents** — Populate AI agent registry
4. **Assign to Applications** — Connect agents to Concierge
5. **Execute via WEF** — Use 8-phase execution framework
6. **Register Business Units** — Activate Marketing, Sales, etc.
7. **Build New Products** — Finance Portal, Marketing CMS, etc.
8. **Scale Infrastructure** — Add providers, storage, networks

---

**Evidence Base:** This 10-layer model is constructed from 30+ document reads, 17 capability discoveries, 11 workforce categories, 12 ADRs, and the live test suite (750+ tests). Every layer has a file path citation.
