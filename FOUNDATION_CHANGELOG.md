# FOUNDATION_CHANGELOG

All notable changes to the Hermes Platform Foundation.

---

## [1.0.0] — 2026-07-30

### Certified
- Foundation certification completed for controlled autonomous execution
- All 614/614 tests passing across 40 test files
- All verification gates passed (implementation, regression, security, governance, operational)
- Foundation frozen — no new capabilities added

### Foundation Scope Defined
- Intent Engine (production)
- EPCL — Executive Planning & Control Layer (production)
- WAS — Workforce Activation Service (production)
- WEF — Workforce Execution Framework (production)
- Capability Registry (production)
- Execution Gateway (production)
- Governance Framework (production)
- Security Model (production)
- Data Model / D1 Schema v6 (production)
- Observability & Reporting (production)

### Deferred (Not Included in v1.0)
- Provider Marketplace (full implementation)
- Provider Manifest V2 production manifests
- Memory Service (stub)
- D1 Backend production activation
- Provider Sandbox Contract (design doc exists)
- Provider Violation Model integration
- Startup recovery (multi-workflow, mixed states)

---

## [0.9.0] — 2026-07-26

### Stabilization
- Workforce persistence Phase 9+ complete (750 tests, 43 new persistence tests)
- WAS persistence backend wired (D1/Memory)
- Execution state checkpointing implemented
- Duplicate execution protection verified
- Graceful degradation for persistence layer confirmed

### Fixes
- 13 previously-known test failures resolved during stabilization
- `@hermes/permissions/permissions.js` package resolution fixed
- `renameSync` Cloudflare vitest pool exclusion for workforce tests
- `@hermes/services/activation` package resolution fixed
- 4 custom-runner files excluded from vitest auto-discovery
- 4 Cloudflare pool system import issues documented

---

## [0.8.0] — 2026-07-22

### Platform Hardening & Boundary Segregation (EPIC-003-006)
- Hard-merged into `main`
- Boundary segregation complete
- Hardening tests passing
- Security review pass

### Execution Gateway (EPIC-005.6)
- Execution Gateway implementation complete (286 lines)
- Policy evaluator complete (280 lines)
- ApprovalRef complete (144 lines)
- Execution coordinator complete (341 lines)
- Tenant enforcement wired
- Fail-closed behavior verified

---

## [0.7.0] — 2026-07-20

### Persistent Operations Platform (EPIC-004)
- Persistent operations complete
- D1 schema migrations 0001–0004 applied
- RBAC foundation live

### Execution Durability Alignment (EPIC-004.5)
- Execution store complete
- Recovery mechanism complete
- Idempotency tracker implemented

---

## [0.6.0] — 2026-07-19

### Core Execution Platform (EPIC-003-001)
- Hermes Execution Platform complete
- Developer Automation Pipeline complete
- Security Automation Platform complete
- Security Provider Integration complete

### Workforce Orchestration (EPIC-003-005)
- M1–M9 complete
- R4–R6 complete
- 8-state activation machine operational

---

## [0.5.0] — 2026-07-18

### Platform Foundation (Phase 0)
- Foundation architecture established
- Worker directory structure created
- Core interfaces defined
- Constitional framework adopted

---

## [0.1.0] — Initial

- Project scaffold
- Wrangler configuration
- Basic worker structure