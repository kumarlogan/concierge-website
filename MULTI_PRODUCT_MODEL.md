# MULTI_PRODUCT_MODEL

**Version:** 1.0
**Effective:** 2026-07-30
**Status:** Definitive — How Hermes manages multiple products

---

## Overview

Hermes manages multiple products under a single foundation. Each product has its own roadmap, backlog, executive dashboard, knowledge base, and metrics. Shared capabilities remain centralized within Hermes.

---

## Product Hierarchy

```
Hermes (Foundation)
├── AG Synergy (AGS Fertility)
│   ├── Roadmap
│   ├── Backlog
│   ├── Executive Dashboard
│   ├── Knowledge
│   └── Metrics
├── Product B (Future)
│   ├── Roadmap
│   ├── Backlog
│   ├── Executive Dashboard
│   ├── Knowledge
│   └── Metrics
├── Product C (Future)
│   ├── Roadmap
│   ├── Backlog
│   ├── Executive Dashboard
│   ├── Knowledge
│   └── Metrics
└── Future Products
    └── (Same structure per product)
```

---

## Shared Capabilities (Centralized in Hermes)

These capabilities are owned by the Foundation and shared across all products. They are NOT per-product and do not change per product.

| Shared Capability | Owner | Scope |
|-------------------|-------|-------|
| Intent Engine | Hermes Foundation | All products |
| EPCL (Planning) | Hermes Foundation | All products |
| Workforce Activation (WAS) | Hermes Foundation | All products |
| Execution Gateway | Hermes Foundation | All products |
| Governance Framework | Hermes Foundation | All products |
| Security Model (RBAC, Tenant Isolation) | Hermes Foundation | All products |
| D1 Schema (Migrations) | Hermes Foundation | All products |
| Audit Framework | Hermes Foundation | All products |
| Token Budget Management | Hermes Foundation | All products |
| Platform Constitution | Hermes Foundation | All products |
| Operating Model | Hermes Foundation | All products |

---

## Per-Product Components

Each product owns the following components. These are product-specific and managed independently.

| Component | Owner | Description |
|-----------|-------|-------------|
| Roadmap | Human (Product Owner) | Prioritized work items for this product |
| Backlog | Human (Product Owner) | Refined work items ready for execution |
| Executive Dashboard | Hermes (EPCL) | Per-product metrics, token usage, status |
| Knowledge | Hermes (WAS) | Per-product lessons, outcomes, patterns |
| Metrics | Hermes (Workforce Metrics) | Per-product KPIs, execution stats |

---

## Boundaries

### What Hermes Does Per Product
- Plans and decomposes product roadmap items
- Executes approved product work
- Tracks per-product token budgets
- Reports per-product metrics
- Captures per-product knowledge
- Enforces governance per product
- Maintains per-product audit trail

### What Hermes Does NOT Do Per Product
- Define product vision (human)
- Set product roadmap priorities (human)
- Approve product changes (human)
- Expand product scope without approval (human)
- Modify Foundation capabilities for a specific product (frozen)

---

## Product Onboarding

To add a new product to Hermes:

1. **Human defines product vision** (Phase 1 of Operating Model)
2. **Human creates product roadmap** (Phase 2)
3. **Human approves initial work batch** (Phase 4)
4. **Hermes executes per Product Execution Model** (Phases 3–9)
5. **Product dashboard and knowledge initialized** automatically by Foundation

### Requirements for New Products
- Product identity must be registered in the Capability Registry
- Tenant isolation must be configured (no cross-product data access)
- Roadmap must be defined before execution begins
- Initial token budget must be allocated

---

## Cross-Product Isolation

| Isolation Level | Mechanism | Enforcement |
|----------------|-----------|-------------|
| Data | Tenant-scoped D1 schema | Hard boundary (Constitution §7.4) |
| Execution | Per-product execution context | Capability + tenant check |
| Token Budget | Per-product token allocation | ContextBudgetManager + TokenBudgetManager |
| Knowledge | Per-product knowledge store | Separate knowledge bases per product |
| Roadmap | Per-product roadmap | No cross-product roadmap interference |
| Dashboard | Per-product executive dashboard | EPCL ExecutiveDashboard per product |

**Cross-product contamination is a constitutional violation.** Hermes MUST NOT execute work intended for Product A against Product B's data, even if technically possible.

---

## Example: AG Synergy as the First Product

### Current Status
- **Product Name:** AG Synergy (AGS Fertility)
- **Domain:** agsynergy.ca
- **Primary Worker:** `workers/src/`
- **D1 Tables:** leads, contacts, clinics, consultations, services, faqs (+ RBAC, workforce)
- **API Base:** `https://api.agsynergy.ca`
- **Current Foundation:** Hermes-Foundation-v1.0 (frozen)

### Product Execution
- Roadmap defined in `ROADMAP.md`
- Backlog items tracked in project management
- Token budget allocated from Foundation pool
- Executive Dashboard available per product
- Knowledge capture per product session

### Transition to Next Phase
1. Foundation is frozen at v1.0
2. AG Synergy execution begins under Product Execution Model
3. Future products onboarded using same model
4. Each product follows the same 9-phase lifecycle

---

## Governance

- Foundation capabilities governed by Platform Constitution
- Per-product governance enforced via tenant isolation
- Cross-product governance violations are constitutional breaches
- Human approves all product-level changes
- Hermes enforces rules but does not set them